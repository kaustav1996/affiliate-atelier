import { execa } from "execa";
import { promises as fs } from "node:fs";
import { ensureDraftDirectory, generatedPaths, listGeneratedFiles, resetDraftProgressFile } from "@/lib/generated-storefront";

export type GenerateAffiliateStorefrontInput = {
  slug: string;
  prompt: string;
  onProgress?: CodexProgressHandler;
};

export type RepairAffiliateStorefrontInput = Omit<GenerateAffiliateStorefrontInput, "onProgress"> & {
  validationLogs: string;
  onProgress?: CodexProgressHandler;
};

export type CodexGenerationMode = "full-generation" | "design-revision" | "surgical-revision";

export type CodexProgressPhase =
  | "setup"
  | "planning"
  | "inspection"
  | "editing"
  | "verification"
  | "tool"
  | "summary"
  | "heartbeat"
  | "error";

export type CodexProgressEvent = {
  at: string;
  message: string;
  phase: CodexProgressPhase;
  detail?: string;
  toolName?: string;
};

export type CodexProgressHandler = (event: CodexProgressEvent) => void;

export type CodexRunOptions = {
  mode: CodexGenerationMode;
  timeoutMs: number;
  expectedDuration: string;
};

export const CODEX_FULL_GENERATION_TIMEOUT_MS = 1000 * 60 * 15;
export const CODEX_SURGICAL_REVISION_TIMEOUT_MS = 1000 * 60 * 5;
export const CODEX_GENERATION_TIMEOUT_MS = CODEX_FULL_GENERATION_TIMEOUT_MS;
export const CODEX_GENERATION_TIMEOUT_SECONDS = CODEX_GENERATION_TIMEOUT_MS / 1000;

const FULL_GENERATION_EXPECTED_DURATION = "Usually 5-10 minutes";
const DESIGN_REVISION_EXPECTED_DURATION = "Usually 3-6 minutes";
const SURGICAL_REVISION_EXPECTED_DURATION = "Usually 1-3 minutes";
const REFERENCE_URL_PATTERN = /https?:\/\/\S+/i;
const BROAD_REVISION_PATTERN =
  /\b(redesign|re-design|rebuild|full|entire|whole|branding|brand|theme|style|aesthetic|inspired by|go along with|make everything|change design|cyberpunk|luxury|minimal)\b/i;

export function determineGenerationMode(prompt: string, hasExistingDraft: boolean): CodexGenerationMode {
  if (!hasExistingDraft) {
    return "full-generation";
  }

  return BROAD_REVISION_PATTERN.test(prompt) || REFERENCE_URL_PATTERN.test(prompt) ? "design-revision" : "surgical-revision";
}

export function codexRunOptions(mode: CodexGenerationMode): CodexRunOptions {
  if (mode === "surgical-revision") {
    return {
      mode,
      timeoutMs: CODEX_SURGICAL_REVISION_TIMEOUT_MS,
      expectedDuration: SURGICAL_REVISION_EXPECTED_DURATION,
    };
  }

  return {
    mode,
    timeoutMs: CODEX_FULL_GENERATION_TIMEOUT_MS,
    expectedDuration: mode === "design-revision" ? DESIGN_REVISION_EXPECTED_DURATION : FULL_GENERATION_EXPECTED_DURATION,
  };
}

export function buildCodexPrompt({
  slug,
  prompt,
  mode = "full-generation",
}: {
  slug: string;
  prompt: string;
  mode?: CodexGenerationMode;
}) {
  const localPreviewUrl = `${process.env.BASE_URL || "http://localhost:3002"}/a/${slug}/preview`;
  const isSurgical = mode === "surgical-revision";

  return `You are Codex running inside ScentForge Atelier.

${isSurgical ? "Apply a narrow follow-up edit to an existing custom affiliate perfume storefront." : "Generate or revise a custom affiliate perfume storefront."}

Affiliate slug:
${slug}

Affiliate request, including any new changes they want:
${prompt}

Revision mode:
${mode}

Only create or edit files inside:
generated/affiliates/${slug}/draft

If files already exist in that draft directory, inspect them first and revise the current draft according to the affiliate request. Do not discard working checkout/cart/test ids unless the affiliate explicitly asks for a full rebuild.

Progress reporting:
- Also write short progress updates to generated/affiliates/${slug}/draft/.codex-progress.jsonl as you work.
- Append one JSON object per line before and after meaningful phases. Use this shape:
  {"at":"<ISO timestamp>","phase":"inspection|editing|verification|summary","message":"<specific present-tense status>","detail":"<optional file, command, or component detail>"}
- Keep each message specific, such as which generated file is being inspected, edited, or verified.
- Do not include secrets or environment values. This file is runtime status only and is ignored by the platform file list.
- You can append with a shell command like:
  node -e 'require("node:fs").appendFileSync("generated/affiliates/${slug}/draft/.codex-progress.jsonl", JSON.stringify({at:new Date().toISOString(),phase:"inspection",message:"Inspecting the draft manifest and generated component contract."})+"\\n")'

${isSurgical
    ? `Surgical revision rules:
- Change only the files and CSS selectors needed for the affiliate's exact request.
- Preserve the existing manifest title, brandDirection, palette, hero, subcopy, badge, success copy, layout, product cards, cart behavior, checkout wiring, and overall visual direction unless the request explicitly names one of those things.
- Do not reinterpret the storefront aesthetic. Do not redesign the page. Do not adjust unrelated copy, colors, spacing, animations, or component structure.
- Prefer a minimal diff. If the request can be fixed with one CSS rule, make one CSS rule.
- Do not run long optional browser or unit test suites for simple CSS/markup fixes. Do the smallest useful verification, then exit immediately with a short summary.`
    : `Design/reference rules:
- When the affiliate gives an http or https reference URL, use browser access to open it, inspect the visual language, and capture a screenshot or visual notes before editing.
- You may use network access, HTTP fetches, and browser tools for public design references and local preview URLs.
- Local preview URL for this draft: ${localPreviewUrl}
- Do not copy copyrighted assets, logos, or exact text from reference sites. Adapt the design language instead.
- Do not call external commerce, payment, account, or write APIs. Do not submit forms or make purchases on external sites.`}

Create:
- index.ts
- Storefront.tsx
- Hero.tsx
- ProductGrid.tsx
- ProductCard.tsx
- CartExperience.tsx
- CheckoutExperience.tsx
- SuccessExperience.tsx
- storefront.css
- manifest.json
- generated.test.tsx

Follow the storefront contract from src/lib/storefront-contract.ts.
Products are database records. Use product.name, product.description, product.priceInCents, product.scentFamily, product.imageUrl, and product.commissionRate from props rather than hard-coded product mocks.
Important runtime boundary: the live preview and published storefront render through the platform commerce shell in src/components/CommerceExperience.tsx. The generated React/CSS files are artifact boundaries and tests; manifest.json is the main generated input the runtime consumes. Cart, checkout, payment, and attribution behavior are platform-owned. Do not assume edits to generated CheckoutExperience.tsx or generated checkout CSS will change the visible platform checkout drawer.
The runtime reads manifest.json for generated brand direction. Include a "success" object in manifest.json with:
- eyebrow
- title
- body
- affiliateAttribution
- continueLabel
Use {orderId}, {kind}, {affiliateSlug}, and {commission} placeholders where useful. The checkout success screen must feel like the generated affiliate storefront, not the platform default.
If the affiliate asks for visible environmental effects such as breeze, bubbles, fog, sparks, rain, smoke, drifting petals, or light trails, define them in manifest.json with "ambientEffects". Do not rely on hard-coded platform effect names. The platform renders ambientEffects as safe, manifest-driven animated layers.
Use this schema:
"ambientEffects": [
  {
    "id": "short-effect-id",
    "label": "Human-readable effect name",
    "placement": "background",
    "elements": [
      {
        "id": "stream-1",
        "style": {
          "top": "18%",
          "left": "-20%",
          "width": "44vw",
          "height": "3px",
          "borderRadius": "999px",
          "background": "linear-gradient(90deg, transparent, color-mix(in oklch, var(--tone-accent) 42%, transparent), transparent)",
          "opacity": 0.58,
          "mixBlendMode": "screen"
        },
        "animation": {
          "durationSeconds": 18,
          "delaySeconds": -7,
          "timingFunction": "linear",
          "iterationCount": "infinite"
        }
      }
    ],
    "keyframes": [
      { "offset": 0, "transform": "translate3d(-12vw, 0, 0)", "opacity": 0 },
      { "offset": 18, "opacity": 0.58 },
      { "offset": 100, "transform": "translate3d(120vw, -2vh, 0)", "opacity": 0 }
    ]
  }
]
Keep ambient effect CSS values compact and safe: no urls, no HTML, no semicolons. Use CSS variables from the platform palette such as var(--tone-bg), var(--tone-ink), var(--tone-panel), var(--tone-accent), and var(--tone-rose). Prefer 3-12 lightweight elements per effect.

Do not modify package.json.
Do not install dependencies.
Do not modify Prisma.
Do not modify auth.
Do not modify routes outside generated folder.
Do not directly create orders.
Do not bypass checkout.
Use the props and callbacks provided by the platform.
Include required data-testid attributes:
storefront-root, product-card, add-to-cart-button, cart-button, cart-drawer, checkout-button, checkout-email, checkout-address, pay-button, success-message.

${isSurgical
    ? "Keep the existing generated design intact and aligned with the already-published draft."
    : "Make it visually distinctive, production-quality, and aligned with the user's requested aesthetic."}

After writing files, briefly summarize what you changed and exit.`;
}

export function codexExecArgs() {
  return ["exec", "--dangerously-bypass-approvals-and-sandbox", "--json", "-"];
}

function isMissingCodexExecutable(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}

export async function generateAffiliateStorefront(input: GenerateAffiliateStorefrontInput) {
  await ensureDraftDirectory(input.slug);

  const existingFiles = await listGeneratedFiles(input.slug, "draft");
  const mode = determineGenerationMode(input.prompt, existingFiles.length > 0);
  const options = codexRunOptions(mode);
  const codexPrompt = buildCodexPrompt({ slug: input.slug, prompt: input.prompt, mode });
  const { promptPath } = generatedPaths(input.slug);
  await resetDraftProgressFile(input.slug);
  await fs.writeFile(promptPath, codexPrompt, "utf8");

  try {
    input.onProgress?.(progress(`Using ${formatMode(mode)}. ${options.expectedDuration}.`, "setup"));
    await ensurePlaywrightMcp(input.onProgress);
    const result = await runCodexCli(codexPrompt, options, input.onProgress);

    const files = await listGeneratedFiles(input.slug, "draft");

    if (result.timedOut) {
      throw new Error(`Codex ${formatMode(mode)} exceeded the ${Math.round(options.timeoutMs / 60000)}-minute limit. Try a narrower prompt or run generation again.`);
    }

    if (result.exitCode !== 0) {
      throw new Error(result.logs || `Codex exited with code ${result.exitCode}.`);
    }

    return {
      files,
      logs: result.logs || "Codex completed without console output.",
      mode,
      expectedDuration: options.expectedDuration,
    };
  } catch (error) {
    if (isMissingCodexExecutable(error)) {
      throw new Error("Codex CLI was not found. Install and authenticate Codex CLI, then retry.");
    }

    throw error;
  }
}

export function buildCodexRepairPrompt({ slug, prompt, validationLogs }: RepairAffiliateStorefrontInput) {
  return `You are Codex running inside ScentForge Atelier.

The generated affiliate perfume storefront failed validation.

Affiliate slug:
${slug}

Original affiliate request:
${prompt || "No original prompt was stored."}

Validation failure logs:
${validationLogs.slice(0, 12000)}

Fix the generated storefront package so the validation flow can pass.

Only create or edit files inside:
generated/affiliates/${slug}/draft

Progress reporting:
- Also write short progress updates to generated/affiliates/${slug}/draft/.codex-progress.jsonl as you repair the package.
- Append one JSON object per line before and after meaningful phases. Use this shape:
  {"at":"<ISO timestamp>","phase":"inspection|editing|verification|summary","message":"<specific present-tense status>","detail":"<optional file, command, or component detail>"}
- Keep each message specific, such as which generated file or validation issue is being inspected, edited, or verified.
- Do not include secrets or environment values. This file is runtime status only and is ignored by the platform file list.
- You can append with a shell command like:
  node -e 'require("node:fs").appendFileSync("generated/affiliates/${slug}/draft/.codex-progress.jsonl", JSON.stringify({at:new Date().toISOString(),phase:"inspection",message:"Inspecting validation logs and generated storefront files."})+"\\n")'

Do not modify package.json.
Do not install dependencies.
Do not modify Prisma.
Do not modify auth.
Do not modify routes outside generated folder.
Do not directly create orders.
Do not bypass checkout.
You may use browser, network, and local preview access to diagnose the validation failure, but do not call external commerce, payment, account, or write APIs.

Preserve the generated storefront contract from src/lib/storefront-contract.ts.
Remember that the visible preview renders through the platform commerce shell and consumes manifest.json for generated brand direction. Generated component files are artifacts and tests, so repair manifest-driven output and generated contract files only.
Preserve or repair the manifest.json success object so the checkout success screen stays aligned with the generated storefront's aesthetic.
Preserve or repair manifest.json "ambientEffects" entries that represent requested visible environmental effects. If an effect only exists as generated component CSS, translate it into ambientEffects so the platform runtime can display it.
Ensure these exact data-testid attributes are present and wired to the provided callbacks:
storefront-root, product-card, add-to-cart-button, cart-button, cart-drawer, checkout-button, checkout-email, checkout-address, pay-button, success-message.

After writing the fix, summarize what failed and what you changed.`;
}

export async function repairAffiliateStorefront(input: RepairAffiliateStorefrontInput) {
  await ensureDraftDirectory(input.slug);
  await resetDraftProgressFile(input.slug);

  const codexPrompt = buildCodexRepairPrompt(input);

  try {
    input.onProgress?.(progress("Starting Codex auto-repair with validation logs.", "setup"));
    await ensurePlaywrightMcp(input.onProgress);
    const result = await runCodexCli(
      codexPrompt,
      {
        mode: "surgical-revision",
        timeoutMs: CODEX_SURGICAL_REVISION_TIMEOUT_MS,
        expectedDuration: SURGICAL_REVISION_EXPECTED_DURATION,
      },
      input.onProgress,
    );
    const files = await listGeneratedFiles(input.slug, "draft");

    if (result.timedOut) {
      throw new Error("Codex repair exceeded the 5-minute limit. Review the validation logs and try a narrower repair prompt.");
    }

    if (result.exitCode !== 0) {
      throw new Error(result.logs || `Codex repair exited with code ${result.exitCode}.`);
    }

    return {
      files,
      logs: result.logs || "Codex repair completed without console output.",
    };
  } catch (error) {
    if (isMissingCodexExecutable(error)) {
      throw new Error("Codex CLI was not found. Install and authenticate Codex CLI, then retry.");
    }

    throw error;
  }
}

async function ensurePlaywrightMcp(onProgress?: CodexProgressHandler) {
  onProgress?.(progress("Checking Codex browser MCP access.", "setup"));

  const list = await execa("codex", ["mcp", "list"], {
    cwd: process.cwd(),
    env: process.env,
    reject: false,
    timeout: 30_000,
  });
  const mcpList = [list.stdout, list.stderr].filter(Boolean).join("\n");

  if (list.exitCode !== 0) {
    throw new Error(mcpList || "Could not inspect Codex MCP servers.");
  }

  if (/^playwright\s+/m.test(list.stdout)) {
    onProgress?.(progress("Playwright MCP is available for browser screenshots.", "setup"));
    return;
  }

  onProgress?.(progress("Installing Playwright MCP for future Codex browser access.", "setup"));
  const add = await execa(
    "codex",
    ["mcp", "add", "playwright", "--", "npx", "-y", "@playwright/mcp@latest", "--headless"],
    {
      cwd: process.cwd(),
      env: process.env,
      reject: false,
      timeout: 120_000,
    },
  );
  const addLogs = [add.stdout, add.stderr].filter(Boolean).join("\n");

  if (add.exitCode !== 0) {
    throw new Error(addLogs || "Could not install Playwright MCP for Codex.");
  }

  onProgress?.(progress("Playwright MCP installed; Codex can inspect reference URLs.", "setup"));
}

async function runCodexCli(
  prompt: string,
  options: CodexRunOptions,
  onProgress?: CodexProgressHandler,
) {
  onProgress?.(progress("Launching Codex CLI.", "setup"));
  const child = execa("codex", codexExecArgs(), {
    cwd: process.cwd(),
    env: process.env,
    input: prompt,
    timeout: options.timeoutMs,
    reject: false,
  });
  const logs: string[] = [];

  child.stdout?.on("data", (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }
      const parsed = parseCodexJsonLine(line);
      logs.push(parsed.logLine);

      if (parsed.progressEvent) {
        onProgress?.(timestampProgress(parsed.progressEvent));
      }
    }
  });

  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    logs.push(text.trimEnd());
  });

  const result = await child;

  return {
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    logs: logs.filter(Boolean).join("\n"),
  };
}

export function parseCodexJsonLine(line: string) {
  try {
    const event = JSON.parse(line) as unknown;
    const progressEvent = progressEventForCodexEvent(event);
    return {
      logLine: humanizeCodexEvent(event),
      progressEvent,
    };
  } catch {
    return {
      logLine: line,
      progressEvent: line.length < 160 ? { message: line, phase: "summary" as const } : undefined,
    };
  }
}

function progressEventForCodexEvent(event: unknown): Omit<CodexProgressEvent, "at"> | undefined {
  if (!event || typeof event !== "object") {
    return undefined;
  }

  const type = "type" in event ? String(event.type) : "";
  const payload = "payload" in event && event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : null;
  const payloadType = payload && "type" in payload ? String(payload.type) : "";

  if (type === "response_item" && payloadType === "message" && payload && "content" in payload) {
    const message = compactText(extractText(payload.content));

    if (message && message.length <= 260) {
      return { message, phase: "summary" };
    }
  }

  if (type === "response_item" && payloadType === "function_call") {
    const name = payload && "name" in payload ? String(payload.name) : "a tool";
    return progressForToolCall(name, payload || {});
  }

  if (type === "response_item" && payloadType === "function_call_output") {
    return {
      message: "Codex finished the previous tool call.",
      phase: "tool",
    };
  }

  if (type === "turn_started") {
    return {
      message: "Codex started a reasoning turn.",
      phase: "planning",
    };
  }

  if (type === "turn_completed") {
    return {
      message: "Codex completed a reasoning turn.",
      phase: "summary",
    };
  }

  if (type === "error") {
    const message = "message" in event && typeof event.message === "string"
      ? compactText(event.message)
      : "Codex reported an error.";
    return {
      message,
      phase: "error",
    };
  }

  return undefined;
}

function progressForToolCall(name: string, payload: Record<string, unknown>): Omit<CodexProgressEvent, "at"> {
  const toolName = normalizeToolName(name);
  const args = parseToolArguments(payload);
  const command = typeof args?.cmd === "string" ? args.cmd : "";
  const detail = command ? summarizeCommand(command) : undefined;

  if (toolName === "apply_patch") {
    return {
      message: "Codex is applying a source patch.",
      phase: "editing",
      toolName,
    };
  }

  if (toolName === "exec_command") {
    return {
      message: commandMessage(command),
      phase: commandPhase(command),
      detail,
      toolName,
    };
  }

  if (toolName === "view_image" || toolName.includes("browser") || toolName.includes("playwright")) {
    return {
      message: `Codex is checking the preview with ${toolName}.`,
      phase: "verification",
      toolName,
    };
  }

  return {
    message: `Codex is using ${toolName}.`,
    phase: "tool",
    toolName,
  };
}

function normalizeToolName(name: string) {
  return name.split(".").at(-1)?.replace(/^_/, "") || name;
}

function parseToolArguments(payload: Record<string, unknown>) {
  const raw = payload.arguments ?? payload.args ?? payload.input;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  return raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
}

function commandPhase(command: string): CodexProgressPhase {
  if (/\b(apply_patch|cat\s*>|tee\s+|mv\s+|cp\s+|rm\s+|mkdir\s+)/.test(command)) {
    return "editing";
  }

  if (/\b(npm run (typecheck|lint|test|build)|vitest|playwright|tsc|eslint|curl|psql|prisma)\b/.test(command)) {
    return "verification";
  }

  if (/\b(rg|sed|ls|find|git (status|diff|show|log)|wc|file)\b/.test(command)) {
    return "inspection";
  }

  return "tool";
}

function commandMessage(command: string) {
  const phase = commandPhase(command);

  if (phase === "verification") {
    return `Codex is running ${shortCommandLabel(command)}.`;
  }

  if (phase === "editing") {
    return `Codex is updating files with ${shortCommandLabel(command)}.`;
  }

  if (phase === "inspection") {
    return `Codex is inspecting ${shortCommandLabel(command)}.`;
  }

  return `Codex is running ${shortCommandLabel(command)}.`;
}

function shortCommandLabel(command: string) {
  const trimmed = command.trim().replace(/\s+/g, " ");
  const firstSegment = trimmed.split("&&")[0]?.split(";")[0]?.trim() || trimmed;

  return firstSegment.length > 72 ? `${firstSegment.slice(0, 69)}...` : firstSegment;
}

function summarizeCommand(command: string) {
  const compact = command.trim().replace(/\s+/g, " ");

  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function humanizeCodexEvent(event: unknown) {
  if (!event || typeof event !== "object") {
    return String(event);
  }

  const type = "type" in event ? String(event.type) : "event";
  const payload = "payload" in event && event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : null;
  const payloadType = payload && "type" in payload ? String(payload.type) : "";

  if (type === "response_item" && payloadType === "message" && payload && "content" in payload) {
    return extractText(payload.content) || `${type}: ${payloadType}`;
  }

  if (type === "response_item" && payloadType === "function_call") {
    const name = payload && "name" in payload ? String(payload.name) : "tool";
    return `tool_call: ${name}`;
  }

  if (type === "response_item" && payloadType === "function_call_output") {
    return "tool_output";
  }

  if ("message" in event && typeof event.message === "string") {
    return event.message;
  }

  return payloadType ? `${type}: ${payloadType}` : type;
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).filter(Boolean).join("\n");
  }

  if (value && typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text;
  }

  return "";
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function progress(message: string, phase: CodexProgressPhase): CodexProgressEvent {
  return {
    at: new Date().toISOString(),
    message,
    phase,
  };
}

function timestampProgress(event: Omit<CodexProgressEvent, "at">): CodexProgressEvent {
  return {
    at: new Date().toISOString(),
    ...event,
  };
}

function formatMode(mode: CodexGenerationMode) {
  return mode.replace(/-/g, " ");
}
