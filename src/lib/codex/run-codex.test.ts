import { describe, expect, it } from "vitest";
import { buildCodexPrompt, filterCodexCliLogText, parseCodexJsonLine } from "@/lib/codex/run-codex";

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

  it("instructs Codex to use generic manifest-driven ambient effects", () => {
    const prompt = buildCodexPrompt({
      slug: "demo",
      prompt: "Add a breeze animation behind the bottles.",
      mode: "design-revision",
    });

    expect(prompt).toContain('"ambientEffects"');
    expect(prompt).toContain("Do not rely on hard-coded platform effect names");
    expect(prompt).toContain("breeze, bubbles, fog, sparks");
    expect(prompt).not.toContain("floating-bubbles");
  });

  it("suppresses benign Codex CLI noise from logs and progress events", () => {
    const pluginWarning = "2026-05-12T22:42:27.073790Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt: maximum of 3 prompts is supported path=/Users/kaustav/.codex/.tmp/plugins/plugins/openai-developers/.codex-plugin/plugin.json";
    const mcpWarning = "2026-05-12T22:42:40.530091Z  WARN codex_rmcp_client::stdio_server_launcher: Failed to terminate MCP process group 13942: No such process (os error 3)";

    expect(parseCodexJsonLine(pluginWarning)).toEqual({ logLine: "", progressEvent: undefined });
    expect(parseCodexJsonLine("item.completed")).toEqual({ logLine: "", progressEvent: undefined });

    expect(filterCodexCliLogText([pluginWarning, "actual error detail", "turn.completed", mcpWarning].join("\n")))
      .toBe("actual error detail");
  });
});
