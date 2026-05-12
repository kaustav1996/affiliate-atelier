import { randomUUID } from "node:crypto";
import {
  CODEX_GENERATION_TIMEOUT_SECONDS,
  generateAffiliateStorefront,
} from "@/lib/codex/run-codex";
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

declare global {
  var __scentforgeGenerationJobs: Map<string, GenerationJob> | undefined;
}

function jobStore() {
  globalThis.__scentforgeGenerationJobs ??= new Map<string, GenerationJob>();
  return globalThis.__scentforgeGenerationJobs;
}

export function startGenerationJob({
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
  const job: GenerationJob = {
    id: randomUUID(),
    affiliateId,
    slug,
    prompt,
    status: "RUNNING",
    message: "Codex CLI is generating the storefront in the background.",
    startedAt: now.toISOString(),
    completedAt: null,
    elapsedSeconds: 0,
    timeoutSeconds: GENERATION_TIMEOUT_SECONDS,
    expectedDuration: GENERATION_EXPECTED_DURATION,
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
  try {
    const result = await generateAffiliateStorefront({ slug: job.slug, prompt: job.prompt });

    await prisma.affiliate.update({
      where: { id: job.affiliateId },
      data: { draftGeneratedAt: new Date() },
    });

    job.status = "COMPLETED";
    job.message = "Codex finished the draft. Run validation before publishing.";
    job.files = result.files;
    job.logs = result.logs;
  } catch (error) {
    job.status = "FAILED";
    job.message = "Codex generation failed.";
    job.error = error instanceof Error ? error.message : String(error);
    job.logs = job.error;
  } finally {
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
