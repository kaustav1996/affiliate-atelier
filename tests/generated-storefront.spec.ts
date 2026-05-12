import { expect, test } from "@playwright/test";
import { expectReadableCheckoutField } from "./checkout-contrast";

test("generated storefront validation purchase flow keeps live metrics isolated", async ({ page, request }) => {
  const slug = process.env.AFFILIATE_SLUG || "demo";
  const validationRunId = process.env.VALIDATION_RUN_ID;
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  expect(validationRunId, "VALIDATION_RUN_ID env var is required").toBeTruthy();

  const beforeResponse = await request.get(`${baseUrl}/api/affiliates/${slug}/metrics`);
  expect(beforeResponse.ok()).toBeTruthy();
  const before = (await beforeResponse.json()) as {
    metrics: { totalCommissionInCents: number; liveOrderCount: number };
  };

  await page.goto(`${baseUrl}/a/${slug}/preview?validationRunId=${validationRunId}`);
  await expect(page.getByTestId("storefront-root")).toBeVisible();
  await page.getByTestId("add-to-cart-button").first().click();
  await page.getByTestId("cart-button").click();
  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await page.getByTestId("checkout-button").click();
  await expectReadableCheckoutField(page.getByTestId("checkout-email"));
  await expectReadableCheckoutField(page.getByTestId("checkout-address"));
  await page.getByTestId("checkout-email").fill("validation-buyer@scentforge.test");
  await page.getByTestId("checkout-address").fill("88 Validation Road, Mumbai 400001");
  await page.getByTestId("pay-button").click();
  await expect(page.getByTestId("success-message")).toBeVisible();

  const runResponse = await request.get(`${baseUrl}/api/validation-runs/${validationRunId}`);
  expect(runResponse.ok()).toBeTruthy();
  const runPayload = (await runResponse.json()) as {
    run: {
      orders: Array<{
        kind: string;
        commissionInCents: number;
      }>;
    };
  };
  expect(runPayload.run.orders.length).toBeGreaterThan(0);
  expect(runPayload.run.orders[0].kind).toBe("VALIDATION");
  expect(runPayload.run.orders[0].commissionInCents).toBeGreaterThan(0);

  const afterResponse = await request.get(`${baseUrl}/api/affiliates/${slug}/metrics`);
  expect(afterResponse.ok()).toBeTruthy();
  const after = (await afterResponse.json()) as {
    metrics: { totalCommissionInCents: number; liveOrderCount: number };
  };

  expect(after.metrics.totalCommissionInCents).toBe(before.metrics.totalCommissionInCents);
  expect(after.metrics.liveOrderCount).toBe(before.metrics.liveOrderCount);
});
