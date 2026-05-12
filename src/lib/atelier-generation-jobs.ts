import { randomUUID } from "node:crypto";
import {
  codexRunOptions,
  CODEX_GENERATION_TIMEOUT_SECONDS,
  type CodexGenerationMode,
  type CodexProgressEvent,
  determineGenerationMode,
  generateAffiliateStorefront,
} from "@/lib/codex/run-codex";
import { listGeneratedFiles } from "@/lib/generated-storefront";
import { prisma } from "@/lib/prisma";

export const GENERATION_TIMEOUT_SECONDS = CODEX_GENERATION_TIMEOUT_SECONDS;
export const GENERATION_EXPECTED_DURATION = "Usually 5-10 minutes";

export type GenerationJobStatus = "RUNNING" | "COMPLETED" | "FAILED";

export type GenerationJobSnapshot = {
  id: string;
  status: GenerationJobStatus;
  message: string;
  startedAt: string;
  completedAt: string | null;
  elapsedSeconds: number;
  timeoutSeconds: number;
  expectedDuration: string;
  mode: CodexGenerationMode;
  progressEvents: CodexProgressEvent[];
  files?: string[];
  logs?: string;
  error?: string;
};

type GenerationJob = GenerationJobSnapshot & {
  affiliateId: string;
  slug: string;
  prompt: string;
};

const JOB_RETENTION_MS = 1000 * 60 * 30;
const HEARTBEAT_INTERVAL_MS = 1000 * 30;

declare global {
  var __scentforgeGenerationJobs: Map<string, GenerationJob> | undefined;
}

function jobStore() {
  globalThis.__scentforgeGenerationJobs ??= new Map<string, GenerationJob>();
  return globalThis.__scentforgeGenerationJobs;
}

export async function startGenerationJob({
  affiliateId,
  slug,
  prompt,
}: {
  affiliateId: string;
  slug: string;
  prompt: string;
}) {
  const activeJob = [...jobStore().values()].find(
    (job) => job.affiliateId === affiliateId && job.status === "RUNNING",
  );

  if (activeJob) {
    return toSnapshot(activeJob);
  }

  cleanupOldJobs();

  const now = new Date();
  const existingFiles = await listGeneratedFiles(slug, "draft");
  const mode = determineGenerationMode(prompt, existingFiles.length > 0);
  const options = codexRunOptions(mode);
  const modeMessage = `Using ${mode.replace(/-/g, " ")}. ${options.expectedDuration}.`;
  const job: GenerationJob = {
    id: randomUUID(),
    affiliateId,
    slug,
    prompt,
    status: "RUNNING",
    message: "Preparing Codex CLI job.",
    startedAt: now.toISOString(),
    completedAt: null,
    elapsedSeconds: 0,
    timeoutSeconds: options.timeoutMs / 1000,
    expectedDuration: options.expectedDuration,
    mode,
    progressEvents: [
      { at: now.toISOString(), message: "Preparing Codex CLI job." },
      { at: now.toISOString(), message: modeMessage },
    ],
  };

  jobStore().set(job.id, job);
  void runGenerationJob(job);

  return toSnapshot(job);
}

export function getActiveGenerationJob(affiliateId: string) {
  const activeJob = [...jobStore().values()].find(
    (job) => job.affiliateId === affiliateId && job.status === "RUNNING",
  );

  return activeJob ? toSnapshot(activeJob) : null;
}

export function getGenerationJob(affiliateId: string, jobId: string) {
  const job = jobStore().get(jobId);

  if (!job || job.affiliateId !== affiliateId) {
    return null;
  }

  return toSnapshot(job);
}

async function runGenerationJob(job: GenerationJob) {
  const heartbeat = startHeartbeat(job);

  try {
    const result = await generateAffiliateStorefront({
      slug: job.slug,
      prompt: job.prompt,
      onProgress: (event) => addProgress(job, event.message, event.at),
    });

    await prisma.affiliate.update({
      where: { id: job.affiliateId },
      data: { draftGeneratedAt: new Date() },
    });

    job.status = "COMPLETED";
    job.message = "Codex finished the draft. Run validation before publishing.";
    job.files = result.files;
    job.logs = result.logs;
    addProgress(job, job.message);
  } catch (error) {
    job.status = "FAILED";
    job.message = "Codex generation failed.";
    job.error = error instanceof Error ? error.message : String(error);
    job.logs = job.error;
    addProgress(job, job.error || job.message);
  } finally {
    clearInterval(heartbeat);
    job.completedAt = new Date().toISOString();
    job.elapsedSeconds = elapsedSeconds(job.startedAt);
  }
}

function toSnapshot(job: GenerationJob): GenerationJobSnapshot {
  return {
    id: job.id,
    status: job.status,
    message: job.message,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    elapsedSeconds: job.status === "RUNNING" ? elapsedSeconds(job.startedAt) : job.elapsedSeconds,
    timeoutSeconds: job.timeoutSeconds,
    expectedDuration: job.expectedDuration,
    mode: job.mode,
    progressEvents: job.progressEvents,
    files: job.files,
    logs: job.logs,
    error: job.error,
  };
}

function elapsedSeconds(startedAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

function cleanupOldJobs() {
  const cutoff = Date.now() - JOB_RETENTION_MS;

  for (const [id, job] of jobStore()) {
    if (job.status !== "RUNNING" && new Date(job.completedAt || job.startedAt).getTime() < cutoff) {
      jobStore().delete(id);
    }
  }
}

function addProgress(job: GenerationJob, message: string, at = new Date().toISOString()) {
  if (job.progressEvents.at(-1)?.message === message) {
    return;
  }

  job.message = message;
  job.progressEvents = [...job.progressEvents, { at, message }].slice(-12);
}

function startHeartbeat(job: GenerationJob) {
  return setInterval(() => {
    if (job.status !== "RUNNING") {
      return;
    }

    const latest = job.progressEvents.at(-1);
    const silenceSeconds = latest ? elapsedSeconds(latest.at) : elapsedSeconds(job.startedAt);

    if (silenceSeconds < 30) {
      return;
    }

    addProgress(job, heartbeatMessage(job, silenceSeconds));
  }, HEARTBEAT_INTERVAL_MS);
}

function heartbeatMessage(job: GenerationJob, silenceSeconds: number) {
  if (job.mode === "surgical-revision") {
    return `Still waiting on Codex CLI. No new output for ${formatShortDuration(silenceSeconds)}.`;
  }

  return `Still running. Codex may be browsing, editing, or verifying. No new output for ${formatShortDuration(silenceSeconds)}.`;
}

function formatShortDuration(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
