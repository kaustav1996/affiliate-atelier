"use client";

import { useMemo, useState, useTransition } from "react";

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
  const [isPending, startTransition] = useTransition();

  const latestRun = runs[0];
  const passed = latestRun?.status === "PASSED";
  const hasDraft = files.length > 0;

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

  function generate() {
    setMessage(hasDraft ? "Applying changes with Codex CLI..." : "Generating with Codex CLI...");
    startTransition(async () => {
      const response = await fetch("/api/atelier/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const payload = (await response.json()) as { files?: string[]; logs?: string; error?: string };

      if (!response.ok) {
        setMessage(payload.error || "Generation failed.");
        return;
      }

      setFiles(payload.files || []);
      setLogs(payload.logs || "");
      setRuns([]);
      setMessage(
        hasDraft
          ? "Codex updated the draft. Run validation again before publishing."
          : "Generated files are ready. Run validation before publishing.",
      );
      setPreviewKey((value) => value + 1);
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
        <button className="primary-action" disabled={isPending} onClick={generate}>
          {isPending ? "Working" : hasDraft ? "Apply changes with Codex" : "Generate with Codex"}
        </button>
      </section>

      <section className="atelier-panel status-panel">
        <p className="eyebrow">Generation status</p>
        <h2>{message || (files.length ? "Generated files" : "Idle")}</h2>
        <ul className="file-list">
          {files.length ? files.map((file) => <li key={file}>{file}</li>) : <li>No draft files yet.</li>}
        </ul>
        <div className={`validation-state ${latestRun?.status?.toLowerCase() || "idle"}`}>
          <strong>{latestRun ? `Latest validation: ${latestRun.status}` : "No validation run yet"}</strong>
          {latestRun?.failureReason ? <span>{latestRun.failureReason}</span> : null}
        </div>
        <div className="action-row">
          <button className="secondary-action" disabled={isPending || files.length === 0} onClick={runValidation}>
            Run validation tests
          </button>
          <button className="primary-action" disabled={isPending || !passed} onClick={publish}>
            Publish
          </button>
          <button className="text-button" disabled={isPending} onClick={resetToDefault}>
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
