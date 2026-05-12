import { randomUUID } from "node:crypto";
import {
  codexRunOptions,
  CODEX_GENERATION_TIMEOUT_SECONDS,
  type CodexGenerationMode,
  type CodexProgressEvent,
  type CodexProgressPhase,
  determineGenerationMode,
  generateAffiliateStorefront,
} from "@/lib/codex/run-codex";
import { getGeneratedFileStatus, listGeneratedFiles } from "@/lib/generated-storefront";
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
  currentPhase: CodexProgressPhase;
  currentDetail?: string;
  currentToolName?: string;
  draftReady: boolean;
  draftUpdatedAt: string | null;
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
      { at: now.toISOString(), message: "Preparing Codex CLI job.", phase: "setup" },
      { at: now.toISOString(), message: modeMessage, phase: "setup" },
    ],
    currentPhase: "setup",
    draftReady: false,
    draftUpdatedAt: null,
  };

  jobStore().set(job.id, job);
  void runGenerationJob(job);

  return toSnapshot(job);
}

export async function getActiveGenerationJob(affiliateId: string) {
  const activeJob = [...jobStore().values()].find(
    (job) => job.affiliateId === affiliateId && job.status === "RUNNING",
  );

  return activeJob ? toSnapshot(activeJob) : null;
}

export async function getGenerationJob(affiliateId: string, jobId: string) {
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
      onProgress: (event) => addProgress(job, event),
    });

    await prisma.affiliate.update({
      where: { id: job.affiliateId },
      data: { draftGeneratedAt: new Date() },
    });

    job.status = "COMPLETED";
    job.message = "Codex finished the draft. Run validation before publishing.";
    job.files = result.files;
    job.logs = result.logs;
    addProgress(job, { at: new Date().toISOString(), message: job.message, phase: "summary" });
  } catch (error) {
    job.status = "FAILED";
    job.message = "Codex generation failed.";
    job.error = error instanceof Error ? error.message : String(error);
    job.logs = job.error;
    addProgress(job, { at: new Date().toISOString(), message: job.error || job.message, phase: "error" });
  } finally {
    clearInterval(heartbeat);
    job.completedAt = new Date().toISOString();
    job.elapsedSeconds = elapsedSeconds(job.startedAt);
  }
}

async function toSnapshot(job: GenerationJob): Promise<GenerationJobSnapshot> {
  const draftStatus = await getGeneratedFileStatus(job.slug, "draft");
  const latestProgress = job.progressEvents.at(-1);
  const files = job.files || draftStatus.files;
  const draftReady = draftStatus.manifestReady;
  const draftUpdatedAt = draftStatus.updatedAt;

  job.draftReady = draftReady;
  job.draftUpdatedAt = draftUpdatedAt;
  job.files = files;

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
    currentPhase: latestProgress?.phase || job.currentPhase,
    currentDetail: latestProgress?.detail,
    currentToolName: latestProgress?.toolName,
    draftReady,
    draftUpdatedAt,
    progressEvents: job.progressEvents,
    files,
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

function addProgress(job: GenerationJob, event: CodexProgressEvent) {
  if (job.progressEvents.at(-1)?.message === event.message) {
    return;
  }

  job.message = event.message;
  job.currentPhase = event.phase;
  job.currentDetail = event.detail;
  job.currentToolName = event.toolName;
  job.progressEvents = [...job.progressEvents, event].slice(-12);
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

    addProgress(job, heartbeatEvent(job, silenceSeconds));
  }, HEARTBEAT_INTERVAL_MS);
}

function heartbeatEvent(job: GenerationJob, silenceSeconds: number): CodexProgressEvent {
  const latest = job.progressEvents.at(-1);
  const lastActivity = latest?.message || "Codex CLI started.";

  return {
    at: new Date().toISOString(),
    message: `No new Codex output for ${formatShortDuration(silenceSeconds)}.`,
    phase: "heartbeat",
    detail: `Last activity: ${lastActivity}`,
    toolName: latest?.toolName,
  };
}

function formatShortDuration(totalSeconds: number) {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
