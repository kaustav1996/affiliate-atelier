import { promises as fs } from "node:fs";
import path from "node:path";
import type { GeneratedManifest } from "@/lib/storefront-theme";

const CODEX_PROGRESS_FILENAME = ".codex-progress.jsonl";

export type GeneratedProgressFileEvent = {
  at: string;
  message: string;
  phase?: string;
  detail?: string;
  toolName?: string;
};

export function assertSafeSlug(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Affiliate slug contains unsupported characters.");
  }
}

export function generatedPaths(slug: string) {
  assertSafeSlug(slug);
  const affiliateRoot = path.join(process.cwd(), "generated", "affiliates", slug);
  const draftDir = path.join(process.cwd(), "generated", "affiliates", slug, "draft");
  const publishedDir = path.join(process.cwd(), "generated", "affiliates", slug, "published");

  return {
    affiliateRoot,
    draftDir,
    publishedDir,
    progressPath: path.join(process.cwd(), "generated", "affiliates", slug, "draft", CODEX_PROGRESS_FILENAME),
    promptPath: path.join(affiliateRoot, "draft-prompt.md"),
  };
}

export async function ensureDraftDirectory(slug: string) {
  const { draftDir, affiliateRoot } = generatedPaths(slug);
  await fs.mkdir(affiliateRoot, { recursive: true });
  await fs.mkdir(draftDir, { recursive: true });
  return draftDir;
}

export async function clearDraftDirectory(slug: string) {
  const { draftDir } = generatedPaths(slug);
  await fs.rm(draftDir, { recursive: true, force: true });
  await fs.mkdir(draftDir, { recursive: true });
}

export async function clearAffiliateGeneratedStorefront(slug: string) {
  const { affiliateRoot } = generatedPaths(slug);
  await fs.rm(affiliateRoot, { recursive: true, force: true });
}

export async function copyDraftToPublished(slug: string) {
  const { draftDir, publishedDir } = generatedPaths(slug);
  await fs.rm(publishedDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(publishedDir), { recursive: true });
  await fs.cp(draftDir, publishedDir, { recursive: true });
}

export async function listGeneratedFiles(slug: string, state: "draft" | "published" = "draft") {
  const directory = state === "draft" ? generatedPaths(slug).draftDir : generatedPaths(slug).publishedDir;

  async function walk(current: string, prefix = ""): Promise<string[]> {
    try {
      const entries = await fs.readdir(current, { withFileTypes: true });
      const files = await Promise.all(
        entries.filter((entry) => !shouldIgnoreGeneratedEntry(path.join(prefix, entry.name))).map((entry) => {
          const nextPrefix = path.join(prefix, entry.name);
          const nextPath = path.join(current, entry.name);
          return entry.isDirectory() ? walk(nextPath, nextPrefix) : Promise.resolve([nextPrefix]);
        }),
      );
      return files.flat().sort();
    } catch {
      return [];
    }
  }

  return walk(directory);
}

export async function getGeneratedFileStatus(slug: string, state: "draft" | "published" = "draft") {
  const directory = state === "draft" ? generatedPaths(slug).draftDir : generatedPaths(slug).publishedDir;
  const files = await listGeneratedFiles(slug, state);
  const [manifest, newestMtime, progressEvents] = await Promise.all([
    readGeneratedManifest(slug, state),
    newestGeneratedMtime(directory, files),
    state === "draft" ? readDraftProgressEvents(slug) : Promise.resolve([]),
  ]);

  return {
    files,
    manifestReady: Boolean(manifest),
    updatedAt: newestMtime?.toISOString() || null,
    progressEvents,
  };
}

function shouldIgnoreGeneratedEntry(relativePath: string) {
  return relativePath === ".DS_Store"
    || relativePath === CODEX_PROGRESS_FILENAME
    || relativePath.startsWith(`node_modules${path.sep}`)
    || relativePath.includes(`${path.sep}.vite${path.sep}`);
}

export async function resetDraftProgressFile(slug: string) {
  await ensureDraftDirectory(slug);
  const { progressPath } = generatedPaths(slug);
  await fs.writeFile(progressPath, "", "utf8");
}

export async function readDraftProgressEvents(slug: string) {
  const { progressPath } = generatedPaths(slug);

  try {
    const raw = await fs.readFile(progressPath, "utf8");
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseProgressLine)
      .filter((event): event is GeneratedProgressFileEvent => Boolean(event))
      .slice(-24);
  } catch {
    return [];
  }
}

export async function readGeneratedManifest(slug: string, state: "draft" | "published") {
  const directory = state === "draft" ? generatedPaths(slug).draftDir : generatedPaths(slug).publishedDir;
  const manifestPath = path.join(directory, "manifest.json");

  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(raw) as GeneratedManifest;
  } catch {
    return null;
  }
}

async function newestGeneratedMtime(directory: string, files: string[]) {
  const mtimes = await Promise.all(
    files.map(async (file) => {
      try {
        const stat = await fs.stat(path.join(directory, file));
        return stat.mtime;
      } catch {
        return null;
      }
    }),
  );

  return mtimes.reduce<Date | null>((newest, value) => {
    if (!value) {
      return newest;
    }

    return !newest || value > newest ? value : newest;
  }, null);
}

function parseProgressLine(line: string): GeneratedProgressFileEvent | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const at = typeof parsed.at === "string" ? parsed.at : "";
    const message = typeof parsed.message === "string" ? parsed.message : "";

    if (!at || !message) {
      return null;
    }

    return {
      at,
      message,
      phase: typeof parsed.phase === "string" ? parsed.phase : undefined,
      detail: typeof parsed.detail === "string" ? parsed.detail : undefined,
      toolName: typeof parsed.toolName === "string" ? parsed.toolName : undefined,
    };
  } catch {
    return null;
  }
}
