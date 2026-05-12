import { execa } from "execa";
import { promises as fs } from "node:fs";
import { ensureDraftDirectory, generatedPaths, listGeneratedFiles } from "@/lib/generated-storefront";

export type GenerateAffiliateStorefrontInput = {
  slug: string;
  prompt: string;
};

export type RepairAffiliateStorefrontInput = GenerateAffiliateStorefrontInput & {
  validationLogs: string;
};

export function buildCodexPrompt({ slug, prompt }: GenerateAffiliateStorefrontInput) {
  return `You are Codex running inside ScentForge Atelier.

Generate or revise a custom affiliate perfume storefront.

Affiliate slug:
${slug}

Affiliate request, including any new changes they want:
${prompt}

Only create or edit files inside:
generated/affiliates/${slug}/draft

If files already exist in that draft directory, inspect them first and revise the current draft according to the affiliate request. Do not discard working checkout/cart/test ids unless the affiliate explicitly asks for a full rebuild.

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
The runtime reads manifest.json for generated brand direction. Include a "success" object in manifest.json with:
- eyebrow
- title
- body
- affiliateAttribution
- continueLabel
Use {orderId}, {kind}, {affiliateSlug}, and {commission} placeholders where useful. The checkout success screen must feel like the generated affiliate storefront, not the platform default.
If the affiliate asks for visible environmental effects such as bubbles, fog, sparks, rain, smoke, or light trails, include an "effects" array in manifest.json with stable lower-case labels such as "floating-bubbles".

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

export function codexExecArgs() {
  return ["exec", "--dangerously-bypass-approvals-and-sandbox", "-"];
}

function isMissingCodexExecutable(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: string }).code === "ENOENT";
}

export async function generateAffiliateStorefront(input: GenerateAffiliateStorefrontInput) {
  await ensureDraftDirectory(input.slug);

  const codexPrompt = buildCodexPrompt(input);
  const { promptPath } = generatedPaths(input.slug);
  await fs.writeFile(promptPath, codexPrompt, "utf8");

  try {
    const result = await execa(
      "codex",
      codexExecArgs(),
      {
        cwd: process.cwd(),
        env: process.env,
        input: codexPrompt,
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

Do not modify package.json.
Do not install dependencies.
Do not modify Prisma.
Do not modify auth.
Do not modify routes outside generated folder.
Do not directly create orders.
Do not bypass checkout.
Do not call external network APIs.

Preserve the generated storefront contract from src/lib/storefront-contract.ts.
Preserve or repair the manifest.json success object so the checkout success screen stays aligned with the generated storefront's aesthetic.
Preserve or repair any manifest.json "effects" array that represents requested visible environmental effects.
Ensure these exact data-testid attributes are present and wired to the provided callbacks:
storefront-root, product-card, add-to-cart-button, cart-button, cart-drawer, checkout-button, checkout-email, checkout-address, pay-button, success-message.

After writing the fix, summarize what failed and what you changed.`;
}

export async function repairAffiliateStorefront(input: RepairAffiliateStorefrontInput) {
  await ensureDraftDirectory(input.slug);

  const codexPrompt = buildCodexRepairPrompt(input);

  try {
    const result = await execa(
      "codex",
      codexExecArgs(),
      {
        cwd: process.cwd(),
        env: process.env,
        input: codexPrompt,
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
    if (isMissingCodexExecutable(error)) {
      throw new Error("Codex CLI was not found. Install and authenticate Codex CLI, then retry.");
    }

    throw error;
  }
}
