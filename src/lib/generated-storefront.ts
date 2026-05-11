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
        entries.map((entry) => {
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

export async function writeMockGeneratedStorefront(slug: string, prompt: string) {
  const draftDir = await ensureDraftDirectory(slug);
  const manifest: GeneratedManifest = {
    title: "Paris at Midnight",
    eyebrow: "Codex-generated draft",
    hero: "Black lacquer, gold light, and perfume after the last train.",
    subcopy:
      "A cinematic affiliate boutique with velvet spacing, nocturne copy, and checkout language polished for a late-night collector.",
    badge: `Draft for ${slug}`,
    checkoutLanguage: "Complete the midnight ritual",
    palette: {
      background: "#11100F",
      ink: "#F6F0E6",
      panel: "#201B17",
      accent: "#C58A3A",
      rose: "#C97B7B",
    },
  };

  const files: Record<string, string> = {
    "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "index.ts": `export { Storefront } from "./Storefront";\nexport { CartExperience } from "./CartExperience";\nexport { CheckoutExperience } from "./CheckoutExperience";\nexport { SuccessExperience } from "./SuccessExperience";\n`,
    "Storefront.tsx": `"use client";\n\nimport type { StorefrontProps } from "@/lib/storefront-contract";\nimport { Hero } from "./Hero";\nimport { ProductGrid } from "./ProductGrid";\nimport "./storefront.css";\n\nexport function Storefront(props: StorefrontProps) {\n  return <main className="generated-storefront" data-testid="storefront-root"><Hero affiliateSlug={props.affiliateSlug} /><ProductGrid {...props} /></main>;\n}\n`,
    "Hero.tsx": `export function Hero({ affiliateSlug }: { affiliateSlug?: string }) {\n  return <section className="generated-hero"><p>Paris at midnight {affiliateSlug ? "for " + affiliateSlug : ""}</p><h1>Black lacquer, gold light, perfume after the last train.</h1></section>;\n}\n`,
    "ProductGrid.tsx": `import type { StorefrontProps } from "@/lib/storefront-contract";\nimport { ProductCard } from "./ProductCard";\n\nexport function ProductGrid({ products, onAddToCart, onOpenCart }: StorefrontProps) {\n  return <section className="generated-grid"><button data-testid="cart-button" onClick={onOpenCart}>Open cart</button>{products.map((product) => <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />)}</section>;\n}\n`,
    "ProductCard.tsx": `import type { ProductView } from "@/lib/storefront-contract";\n\nexport function ProductCard({ product, onAddToCart }: { product: ProductView; onAddToCart: (id: string) => void }) {\n  return <article data-testid="product-card" className="generated-card"><p>{product.scentFamily}</p><h2>{product.name}</h2><p>{product.description}</p><span>{Math.round(product.commissionRate * 100)}% creator commission</span><button data-testid="add-to-cart-button" onClick={() => onAddToCart(product.id)}>Add to cart</button></article>;\n}\n`,
    "CartExperience.tsx": `import type { CartExperienceProps } from "@/lib/storefront-contract";\n\nexport function CartExperience({ items, onCheckout }: CartExperienceProps) {\n  return <aside data-testid="cart-drawer"><p>{items.length} item(s)</p><button data-testid="checkout-button" onClick={onCheckout}>Checkout</button></aside>;\n}\n`,
    "CheckoutExperience.tsx": `import type { CheckoutExperienceProps } from "@/lib/storefront-contract";\n\nexport function CheckoutExperience({ email, address, onEmailChange, onAddressChange, onPay, isPaying }: CheckoutExperienceProps) {\n  return <section><input data-testid="checkout-email" value={email} onChange={(event) => onEmailChange(event.target.value)} /><textarea data-testid="checkout-address" value={address} onChange={(event) => onAddressChange(event.target.value)} /><button data-testid="pay-button" onClick={onPay}>{isPaying ? "Paying" : "Pay"}</button></section>;\n}\n`,
    "SuccessExperience.tsx": `import type { SuccessExperienceProps } from "@/lib/storefront-contract";\n\nexport function SuccessExperience({ orderId }: SuccessExperienceProps) {\n  return <section data-testid="success-message">Payment success. Order {orderId}</section>;\n}\n`,
    "storefront.css": `.generated-storefront{background:#11100f;color:#f6f0e6;min-height:100vh;padding:48px}.generated-hero{max-width:920px}.generated-hero h1{font-size:clamp(3rem,8vw,7rem);line-height:.9}.generated-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px}.generated-card{border:1px solid rgba(197,138,58,.45);padding:24px;background:#201b17}button{cursor:pointer}\n`,
    "generated.test.tsx": `import { describe, expect, it } from "vitest";\n\ndescribe("generated storefront contract", () => {\n  it("documents required test ids", () => {\n    expect(["storefront-root", "product-card", "add-to-cart-button", "cart-button", "cart-drawer", "checkout-button", "checkout-email", "checkout-address", "pay-button", "success-message"]).toHaveLength(10);\n  });\n});\n`,
  };

  await fs.writeFile(path.join(generatedPaths(slug).affiliateRoot, "draft-prompt.md"), prompt, "utf8");

  await Promise.all(
    Object.entries(files).map(async ([fileName, contents]) => {
      await fs.writeFile(path.join(draftDir, fileName), contents, "utf8");
    }),
  );

  return Object.keys(files).sort();
}
