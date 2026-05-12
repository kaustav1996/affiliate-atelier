import { promises as fs } from "node:fs";
import path from "node:path";
import type { GeneratedManifest } from "@/lib/storefront-theme";

const ROOT = path.join(process.cwd(), "generated", "affiliates");

export function assertSafeSlug(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error("Affiliate slug contains unsupported characters.");
  }
}

export function generatedPaths(slug: string) {
  assertSafeSlug(slug);
  const affiliateRoot = path.join(ROOT, slug);

  return {
    affiliateRoot,
    draftDir: path.join(affiliateRoot, "draft"),
    publishedDir: path.join(affiliateRoot, "published"),
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

function shouldIgnoreGeneratedEntry(relativePath: string) {
  return relativePath === ".DS_Store"
    || relativePath.startsWith(`node_modules${path.sep}`)
    || relativePath.includes(`${path.sep}.vite${path.sep}`);
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
