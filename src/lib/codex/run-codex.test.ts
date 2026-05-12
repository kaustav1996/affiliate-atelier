import { describe, expect, it } from "vitest";
import { buildCodexPrompt, parseCodexJsonLine } from "@/lib/codex/run-codex";

describe("Codex progress parsing", () => {
  it("turns shell inspection calls into structured progress details", () => {
    const parsed = parseCodexJsonLine(JSON.stringify({
      type: "response_item",
      payload: {
        type: "function_call",
        name: "functions.exec_command",
        arguments: JSON.stringify({ cmd: "rg -n \"generation\" src/components" }),
      },
    }));

    expect(parsed.progressEvent).toMatchObject({
      phase: "inspection",
      toolName: "exec_command",
      detail: "rg -n \"generation\" src/components",
    });
    expect(parsed.progressEvent?.message).toContain("rg -n");
  });

  it("passes concise Codex assistant messages through to the poll stream", () => {
    const parsed = parseCodexJsonLine(JSON.stringify({
      type: "response_item",
      payload: {
        type: "message",
        content: [{ text: "I found the generated manifest and am wiring the preview refresh now." }],
      },
    }));

    expect(parsed.progressEvent).toEqual({
      message: "I found the generated manifest and am wiring the preview refresh now.",
      phase: "summary",
    });
  });

  it("instructs Codex to write draft-local progress events", () => {
    const prompt = buildCodexPrompt({
      slug: "demo",
      prompt: "Make the storefront feel like a rainy perfume atelier.",
      mode: "design-revision",
    });

    expect(prompt).toContain("generated/affiliates/demo/draft/.codex-progress.jsonl");
    expect(prompt).toContain("Append one JSON object per line");
    expect(prompt).toContain("which generated file is being inspected, edited, or verified");
  });
});
