import { execa } from "execa";
import { promises as fs } from "node:fs";
import { ensureDraftDirectory, generatedPaths, listGeneratedFiles, writeMockGeneratedStorefront } from "@/lib/generated-storefront";

export type GenerateAffiliateStorefrontInput = {
  slug: string;
  prompt: string;
};

export type RepairAffiliateStorefrontInput = GenerateAffiliateStorefrontInput & {
  validationLogs: string;
};

export function buildCodexPrompt({ slug, prompt }: GenerateAffiliateStorefrontInput) {
  return `You are Codex running inside ScentForge Atelier.

Generate a custom affiliate perfume storefront.

Affiliate slug:
${slug}

Affiliate request:
${prompt}

Only create or edit files inside:
generated/affiliates/${slug}/draft

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

Do not modify package.json.
Do not install dependencies.
Do not modify Prisma.
Do not modify auth.
Do not modify routes outside generated folder.
Do not directly create orders.
Do not bypass checkout.
Do not call external network APIs.
Use the props and callbacks provided by the platform.
Include required data-testid attributes:
storefront-root, product-card, add-to-cart-button, cart-button, cart-drawer, checkout-button, checkout-email, checkout-address, pay-button, success-message.

Make it visually distinctive, production-quality, and aligned with the user's requested aesthetic.

After writing files, briefly summarize what you created.`;
}

export async function generateAffiliateStorefront(input: GenerateAffiliateStorefrontInput) {
  await ensureDraftDirectory(input.slug);

  const codexPrompt = buildCodexPrompt(input);
  const { promptPath } = generatedPaths(input.slug);
  await fs.writeFile(promptPath, codexPrompt, "utf8");

  if (process.env.CODEX_MOCK === "1") {
    const files = await writeMockGeneratedStorefront(input.slug, codexPrompt);
    return {
      files,
      logs: "CODEX_MOCK=1 generated deterministic sample storefront package.",
    };
  }

  try {
    const result = await execa(
      "codex",
      ["exec", "--sandbox", "workspace-write", "--ask-for-approval", "never", codexPrompt],
      {
        cwd: process.cwd(),
        env: process.env,
        timeout: 1000 * 60 * 8,
        reject: false,
      },
    );

    const files = await listGeneratedFiles(input.slug, "draft");
    const logs = [result.stdout, result.stderr].filter(Boolean).join("\n\n");

    if (result.exitCode !== 0) {
      throw new Error(logs || `Codex exited with code ${result.exitCode}.`);
    }

    return {
      files,
      logs: logs || "Codex completed without console output.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("ENOENT") || message.includes("not found")) {
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

Do not modify package.json.
Do not install dependencies.
Do not modify Prisma.
Do not modify auth.
Do not modify routes outside generated folder.
Do not directly create orders.
Do not bypass checkout.
Do not call external network APIs.

Preserve the generated storefront contract from src/lib/storefront-contract.ts.
Ensure these exact data-testid attributes are present and wired to the provided callbacks:
storefront-root, product-card, add-to-cart-button, cart-button, cart-drawer, checkout-button, checkout-email, checkout-address, pay-button, success-message.

After writing the fix, summarize what failed and what you changed.`;
}

export async function repairAffiliateStorefront(input: RepairAffiliateStorefrontInput) {
  await ensureDraftDirectory(input.slug);

  const codexPrompt = buildCodexRepairPrompt(input);

  if (process.env.CODEX_MOCK === "1") {
    const files = await writeMockGeneratedStorefront(input.slug, codexPrompt);
    return {
      files,
      logs: "CODEX_MOCK=1 repaired the draft by rewriting the deterministic sample storefront package.",
    };
  }

  try {
    const result = await execa(
      "codex",
      ["exec", "--sandbox", "workspace-write", "--ask-for-approval", "never", codexPrompt],
      {
        cwd: process.cwd(),
        env: process.env,
        timeout: 1000 * 60 * 8,
        reject: false,
      },
    );
    const files = await listGeneratedFiles(input.slug, "draft");
    const logs = [result.stdout, result.stderr].filter(Boolean).join("\n\n");

    if (result.exitCode !== 0) {
      throw new Error(logs || `Codex repair exited with code ${result.exitCode}.`);
    }

    return {
      files,
      logs: logs || "Codex repair completed without console output.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("ENOENT") || message.includes("not found")) {
      throw new Error("Codex CLI was not found. Install and authenticate Codex CLI, then retry.");
    }

    throw error;
  }
}
