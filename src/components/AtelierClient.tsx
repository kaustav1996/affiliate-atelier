"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

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
  files?: string[];
  logs?: string;
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

  const latestRun = runs[0];
  const passed = latestRun?.status === "PASSED";
  const hasDraft = files.length > 0;
  const isGenerating = generationJob?.status === "RUNNING";
  const generationJobId = generationJob?.id;
  const generationJobStatus = generationJob?.status;
  const generationStartedAt = generationJob?.startedAt;
  const isBusy = isPending || isGenerating;
  const visibleElapsedSeconds = isGenerating ? elapsedSeconds : generationJob?.elapsedSeconds || 0;
  const progressPercent = generationJob
    ? Math.min(100, Math.max(7, Math.round((visibleElapsedSeconds / generationJob.timeoutSeconds) * 100)))
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
        const payload = (await response.json()) as { job?: GenerationJobView; error?: string };

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

        setGenerationJob(payload.job);
        setMessage(payload.job.message);

        if (payload.job.status === "COMPLETED") {
          setFiles(payload.job.files || []);
          setLogs(payload.job.logs || "");
          setRuns([]);
          setPreviewKey((value) => value + 1);
        }

        if (payload.job.status === "FAILED") {
          setLogs(payload.job.logs || payload.job.error || "");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Generation status check failed.");
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
        const payload = (await response.json()) as { job?: GenerationJobView; error?: string };

        if (!response.ok || !payload.job) {
          setMessage(payload.error || "Generation failed to start.");
          return;
        }

        setGenerationJob(payload.job);
        setElapsedSeconds(payload.job.elapsedSeconds);
        setLogs("Codex CLI job started. Live status will update here when generation completes.");
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
      const payload = (await response.json()) as {
        run?: ValidationRunView;
        logs?: string;
        files?: string[];
        error?: string;
      };

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
      const payload = (await response.json()) as { error?: string };
      setMessage(response.ok ? "Published. /a/" + slug + " now uses the generated storefront." : payload.error || "Publish failed.");
    });
  }

  function resetToDefault() {
    setMessage("Publishing the default storefront...");
    startTransition(async () => {
      const response = await fetch("/api/atelier/reset", { method: "POST" });
      const payload = (await response.json()) as { files?: string[]; error?: string };

      if (!response.ok) {
        setMessage(payload.error || "Reset failed.");
        return;
      }

      setFiles(payload.files || []);
      setRuns([]);
      setGenerationJob(null);
      setElapsedSeconds(0);
      setLogs("Default platform storefront is now live. Generated draft and published artifacts were removed.");
      setMessage("Default storefront is live at /a/" + slug + ".");
      setPreviewKey((value) => value + 1);
    });
  }

  return (
    <div className="atelier-grid">
      <section className="atelier-panel prompt-panel">
        <p className="eyebrow">Prompt panel</p>
        <h2>Describe your storefront</h2>
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
        <p className="eyebrow">Generation status</p>
        <h2>{message || (files.length ? "Generated files" : "Idle")}</h2>
        {generationJob ? (
          <div className={`generation-job ${generationJob.status.toLowerCase()}`}>
            <div className="generation-job-copy">
              <strong>
                {generationJob.status === "RUNNING"
                  ? "Codex is running outside the browser request."
                  : generationJob.status === "COMPLETED"
                    ? "Generation finished."
                    : "Generation stopped."}
              </strong>
              <span>
                Elapsed {formatDuration(visibleElapsedSeconds)} · {generationJob.expectedDuration} · hard limit{" "}
                {formatDuration(generationJob.timeoutSeconds)}
              </span>
            </div>
            <div className="generation-progress" aria-label="Generation time progress">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <p>
              The browser is polling a short status endpoint, so the tab should not time out while Codex writes files.
            </p>
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
            <p className="eyebrow">Preview panel</p>
            <h2>/a/{slug}/preview</h2>
          </div>
          <a href={`/a/${slug}/preview`} target="_blank">
            Open
          </a>
        </div>
        <iframe key={previewKey} src={`/a/${slug}/preview?atelierKey=${previewKey}`} title="Generated storefront preview" />
      </section>

      <section className="atelier-panel console-panel">
        <p className="eyebrow">Validation console</p>
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
