"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

type ValidationRunView = {
  id: string;
  status: "RUNNING" | "PASSED" | "FAILED";
  logs: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
};

type AtelierClientProps = {
  slug: string;
  initialPrompt: string;
  initialFiles: string[];
  validationRuns: ValidationRunView[];
};

type GenerationJobView = {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  message: string;
  startedAt: string;
  completedAt: string | null;
  elapsedSeconds: number;
  timeoutSeconds: number;
  expectedDuration: string;
  mode: "full-generation" | "design-revision" | "surgical-revision";
  currentPhase: ProgressPhase;
  currentDetail?: string;
  currentToolName?: string;
  draftReady: boolean;
  draftUpdatedAt: string | null;
  progressEvents: ProgressEventView[];
  files?: string[];
  logs?: string;
  error?: string;
};

type ProgressPhase =
  | "setup"
  | "planning"
  | "inspection"
  | "editing"
  | "verification"
  | "tool"
  | "summary"
  | "heartbeat"
  | "error";

type ProgressEventView = {
  at: string;
  message: string;
  phase: ProgressPhase;
  detail?: string;
  toolName?: string;
};

type JsonPayload = {
  job?: GenerationJobView;
  run?: ValidationRunView;
  logs?: string;
  files?: string[];
  error?: string;
};

const examples = [
  "Dark luxury Parisian boutique with black, gold, serif type, poetic copy.",
  "Cyberpunk Tokyo fragrance bar with neon cards and fast checkout.",
  "Soft Bengali monsoon perfume shop, green rain, poetry, nostalgic warmth.",
];

export function AtelierClient({ slug, initialPrompt, initialFiles, validationRuns }: AtelierClientProps) {
  const [prompt, setPrompt] = useState(initialPrompt || examples[0]);
  const [files, setFiles] = useState(initialFiles);
  const [logs, setLogs] = useState(validationRuns[0]?.logs || "");
  const [runs, setRuns] = useState(validationRuns);
  const [message, setMessage] = useState("");
  const [previewKey, setPreviewKey] = useState(0);
  const [generationJob, setGenerationJob] = useState<GenerationJobView | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();
  const refreshedDraftAt = useRef<string | null>(null);

  const latestRun = runs[0];
  const passed = latestRun?.status === "PASSED";
  const hasDraft = files.length > 0;
  const isGenerating = generationJob?.status === "RUNNING";
  const generationJobId = generationJob?.id;
  const generationJobStatus = generationJob?.status;
  const generationStartedAt = generationJob?.startedAt;
  const isBusy = isPending || isGenerating;
  const visibleElapsedSeconds = isGenerating ? elapsedSeconds : generationJob?.elapsedSeconds || 0;
  const latestProgressEvent = generationJob?.progressEvents?.at(-1);
  const generationClock = generationStartedAt ? new Date(generationStartedAt).getTime() + visibleElapsedSeconds * 1000 : 0;
  const secondsSinceLastProgress = isGenerating && latestProgressEvent
    ? Math.max(0, Math.floor((generationClock - new Date(latestProgressEvent.at).getTime()) / 1000))
    : 0;
  const progressIsQuiet = isGenerating && secondsSinceLastProgress >= 90;
  const generationStatusHeading = generationJob ? generationHeading(generationJob) : message || (files.length ? "Generated files" : "Idle");
  const progressPercent = generationJob
    ? generationJob.draftReady && generationJob.status === "RUNNING"
      ? Math.min(98, Math.max(82, Math.round((visibleElapsedSeconds / generationJob.timeoutSeconds) * 100)))
      : Math.min(100, Math.max(7, Math.round((visibleElapsedSeconds / generationJob.timeoutSeconds) * 100)))
    : 0;

  const checklist = useMemo(
    () => [
      ["Storefront rendered", passed || latestRun?.status === "FAILED"],
      ["Product added to cart", passed || latestRun?.status === "FAILED"],
      ["Cart opened", passed || latestRun?.status === "FAILED"],
      ["Checkout completed", passed],
      ["Validation order created", passed],
      ["Affiliate commission calculated", passed],
      ["Live dashboard unchanged", passed],
      ["Publish gate passed", passed],
    ],
    [latestRun?.status, passed],
  );

  function syncGeneratedDraft(job: GenerationJobView) {
    if (job.files) {
      setFiles(job.files);
    }

    if (!job.draftReady || !job.draftUpdatedAt || refreshedDraftAt.current === job.draftUpdatedAt) {
      return;
    }

    refreshedDraftAt.current = job.draftUpdatedAt;
    setPreviewKey((value) => value + 1);
  }

  useEffect(() => {
    if (!isGenerating || !generationStartedAt) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - new Date(generationStartedAt).getTime()) / 1000));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [generationStartedAt, isGenerating]);

  useEffect(() => {
    if (!generationJobId || generationJobStatus !== "RUNNING") {
      return;
    }

    let cancelled = false;
    const jobId = generationJobId;

    async function pollGenerationJob() {
      try {
        const response = await fetch(`/api/atelier/generate/${jobId}`, { cache: "no-store" });
        const payload = await readJsonPayload(response);

        if (cancelled) {
          return;
        }

        if (!response.ok || !payload.job) {
          setGenerationJob((current) =>
            current && current.id === jobId
              ? { ...current, status: "FAILED", message: payload.error || "Generation status was lost." }
              : current,
          );
          setMessage(payload.error || "Generation status was lost. Start generation again.");
          return;
        }

        syncGeneratedDraft(payload.job);
        setGenerationJob(payload.job);
        setMessage(payload.job.message);

        if (payload.job.status === "COMPLETED") {
          setLogs(payload.job.logs || "");
          setRuns([]);
        }

        if (payload.job.status === "FAILED") {
          setLogs(payload.job.logs || payload.job.error || "");
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Generation status check failed.";
          setGenerationJob((current) =>
            current && current.id === jobId ? { ...current, status: "FAILED", message, error: message } : current,
          );
          setLogs(message);
          setMessage(message);
        }
      }
    }

    const poller = window.setInterval(pollGenerationJob, 5000);
    void pollGenerationJob();

    return () => {
      cancelled = true;
      window.clearInterval(poller);
    };
  }, [generationJobId, generationJobStatus]);

  function generate() {
    setMessage(hasDraft ? "Starting a Codex revision job..." : "Starting a Codex generation job...");
    setGenerationJob(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/atelier/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const payload = await readJsonPayload(response);

        if (!response.ok || !payload.job) {
          setMessage(payload.error || "Generation failed to start.");
          return;
        }

        syncGeneratedDraft(payload.job);
        setGenerationJob(payload.job);
        setElapsedSeconds(payload.job.elapsedSeconds);
        setLogs("Codex CLI job started. Live status will update here as progress events arrive.");
        setMessage(payload.job.message);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Generation failed to start.");
      }
    });
  }

  function runValidation() {
    setMessage("Running validation tests...");
    startTransition(async () => {
      const response = await fetch("/api/atelier/run-tests", { method: "POST" });
      const payload = await readJsonPayload(response);

      if (payload.run) {
        const nextRun: ValidationRunView = {
          id: payload.run.id,
          status: payload.run.status,
          logs: payload.run.logs,
          failureReason: payload.run.failureReason,
          createdAt: payload.run.createdAt || new Date().toISOString(),
          completedAt: payload.run.completedAt,
        };
        setRuns((current) => [nextRun, ...current]);
      }

      setLogs(payload.logs || payload.error || "");
      if (payload.files) {
        setFiles(payload.files);
      }
      setMessage(
        response.ok
          ? "Generated storefront passed validation."
          : payload.error || "Validation failed. Codex auto-repair was attempted; review logs and run validation again.",
      );
    });
  }

  function publish() {
    setMessage("Publishing generated storefront...");
    startTransition(async () => {
      const response = await fetch("/api/atelier/publish", { method: "POST" });
      const payload = await readJsonPayload(response);
      setMessage(response.ok ? "Published. /a/" + slug + " now uses the generated storefront." : payload.error || "Publish failed.");
    });
  }

  function resetToDefault() {
    setMessage("Publishing the default storefront...");
    startTransition(async () => {
      const response = await fetch("/api/atelier/reset", { method: "POST" });
      const payload = await readJsonPayload(response);

      if (!response.ok) {
        setMessage(payload.error || "Reset failed.");
        return;
      }

      setFiles(payload.files || []);
      setRuns([]);
      setGenerationJob(null);
      setElapsedSeconds(0);
      refreshedDraftAt.current = null;
      setLogs("Default platform storefront is now live. Generated draft and published artifacts were removed.");
      setMessage("Default storefront is live at /a/" + slug + ".");
      setPreviewKey((value) => value + 1);
    });
  }

  return (
    <div className="atelier-grid">
      <section className="atelier-panel prompt-panel">
        <div className="atelier-step">
          <span>01</span>
          <div>
            <p className="eyebrow">Prompt panel</p>
            <h2>Describe your storefront</h2>
          </div>
        </div>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <div className="example-prompts">
          {examples.map((example) => (
            <button key={example} onClick={() => setPrompt(example)}>
              {example}
            </button>
          ))}
        </div>
        <button className="primary-action" disabled={isBusy} onClick={generate}>
          {generationButtonLabel({ hasDraft, isGenerating, isPending })}
        </button>
      </section>

      <section className="atelier-panel status-panel">
        <div className="atelier-step">
          <span>02</span>
          <div>
            <p className="eyebrow">Generation status</p>
            <h2>{generationStatusHeading}</h2>
          </div>
        </div>
        {generationJob ? (
          <div className={`generation-job ${generationJob.status.toLowerCase()}`}>
            <div className="generation-job-copy">
              <strong>
                {generationPrimaryStatus(generationJob)}
              </strong>
              <span>
                {formatGenerationMode(generationJob.mode)} · elapsed {formatDuration(visibleElapsedSeconds)} ·{" "}
                {generationJob.expectedDuration} · hard limit{" "}
                {formatDuration(generationJob.timeoutSeconds)}
              </span>
              {generationJob.currentDetail ? <span>{generationJob.currentDetail}</span> : null}
            </div>
            <div className="generation-progress" aria-label="Generation time progress">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <p>
              {generationJob.draftReady && generationJob.status === "RUNNING"
                ? "The draft manifest is already available in preview; Codex is finishing the run and reporting final output."
                : "The browser is polling a short status endpoint while Codex works outside the request."}
            </p>
            {latestProgressEvent ? (
              <div className={`generation-recency ${progressIsQuiet ? "quiet" : ""}`}>
                <div className="generation-recency-line">
                  <span>Last update:</span>
                  <strong>{formatRelativeDuration(secondsSinceLastProgress)}</strong>
                </div>
                {progressIsQuiet ? (
                  <p className="generation-recency-note">
                    {latestProgressEvent.detail || `Last activity: ${latestProgressEvent.message}`}
                  </p>
                ) : null}
              </div>
            ) : null}
            {generationJob.progressEvents?.length ? (
              <ol className="generation-events" aria-label="Codex progress events">
                {generationJob.progressEvents.map((event) => (
                  <li key={`${event.at}-${event.message}`}>
                    <time>{formatEventTime(event.at)}</time>
                    <span>
                      <strong className={`generation-event-phase phase-${event.phase}`}>{formatProgressPhase(event.phase)}</strong>
                      {event.message}
                      {event.detail ? <small>{event.detail}</small> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {generationJob.error ? <p className="form-error">{generationJob.error}</p> : null}
          </div>
        ) : null}
        <ul className="file-list">
          {files.length ? files.map((file) => <li key={file}>{file}</li>) : <li>No draft files yet.</li>}
        </ul>
        <div className={`validation-state ${latestRun?.status?.toLowerCase() || "idle"}`}>
          <strong>{latestRun ? `Latest validation: ${latestRun.status}` : "No validation run yet"}</strong>
          {latestRun?.failureReason ? <span>{latestRun.failureReason}</span> : null}
        </div>
        <div className="action-row">
          <button className="secondary-action" disabled={isBusy || files.length === 0} onClick={runValidation}>
            Run validation tests
          </button>
          <button className="primary-action" disabled={isBusy || !passed} onClick={publish}>
            Publish
          </button>
          <button className="text-button" disabled={isBusy} onClick={resetToDefault}>
            Reset to default storefront
          </button>
        </div>
      </section>

      <section className="atelier-panel preview-panel">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">03 Preview panel</p>
            <h2>/a/{slug}/preview</h2>
          </div>
          <a href={`/a/${slug}/preview`} target="_blank">
            Open
          </a>
        </div>
        <iframe key={previewKey} src={`/a/${slug}/preview?atelierKey=${previewKey}`} title="Generated storefront preview" />
      </section>

      <section className="atelier-panel console-panel">
        <p className="eyebrow">04 Validation console</p>
        <h2>{passed ? "Generated storefront passed validation" : "Publish disabled until validation passes"}</h2>
        <ul className="validation-checklist">
          {checklist.map(([label, done]) => (
            <li key={String(label)} className={done ? "done" : ""}>
              <span>{done ? "✓" : "·"}</span>
              {label}
            </li>
          ))}
        </ul>
        {passed ? (
          <div className="validation-success-copy">
            <p>1 validation checkout completed</p>
            <p>Commission calculation verified</p>
            <p>Live affiliate dashboard unchanged</p>
          </div>
        ) : null}
        <pre>{logs || "Validation logs will appear here."}</pre>
      </section>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRelativeDuration(totalSeconds: number) {
  if (totalSeconds < 5) {
    return "just now";
  }

  if (totalSeconds < 60) {
    return `${totalSeconds}s ago`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return seconds ? `${minutes}m ${seconds}s ago` : `${minutes}m ago`;
}

function formatEventTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function formatGenerationMode(mode: GenerationJobView["mode"]) {
  if (mode === "surgical-revision") {
    return "Surgical edit";
  }

  if (mode === "design-revision") {
    return "Design revision";
  }

  return "Full generation";
}

function generationHeading(job: GenerationJobView) {
  if (job.status === "COMPLETED") {
    return "Generation finished";
  }

  if (job.status === "FAILED") {
    return "Generation stopped";
  }

  return job.draftReady ? "Preview updated" : "Generating storefront";
}

function generationPrimaryStatus(job: GenerationJobView) {
  if (job.status === "COMPLETED") {
    return "Generation finished.";
  }

  if (job.status === "FAILED") {
    return "Generation stopped.";
  }

  if (job.draftReady) {
    return "Draft preview is ready; Codex is finishing final output.";
  }

  return `Current step: ${formatProgressPhase(job.currentPhase)}.`;
}

function formatProgressPhase(phase: ProgressPhase) {
  const labels: Record<ProgressPhase, string> = {
    setup: "Setup",
    planning: "Planning",
    inspection: "Inspecting",
    editing: "Editing",
    verification: "Verifying",
    tool: "Tool",
    summary: "Update",
    heartbeat: "Waiting",
    error: "Error",
  };

  return labels[phase];
}

function generationButtonLabel({
  hasDraft,
  isGenerating,
  isPending,
}: {
  hasDraft: boolean;
  isGenerating: boolean;
  isPending: boolean;
}) {
  if (isGenerating) {
    return "Codex running";
  }

  if (isPending) {
    return "Starting";
  }

  return hasDraft ? "Apply changes with Codex" : "Generate with Codex";
}

async function readJsonPayload(response: Response): Promise<JsonPayload> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as JsonPayload;
  }

  const body = await response.text();
  const isHtml = body.trimStart().startsWith("<!DOCTYPE") || body.trimStart().startsWith("<html");
  const detail = isHtml
    ? "The server returned an HTML page instead of JSON. You may need to log in again or restart the dev server."
    : body.slice(0, 180) || response.statusText;

  throw new Error(`Request failed (${response.status}): ${detail}`);
}
