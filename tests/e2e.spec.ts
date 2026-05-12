import { expect, test } from "@playwright/test";
import { expectReadableCheckoutField } from "./checkout-contrast";

test("public checkout flow reaches payment success", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("storefront-root")).toBeVisible();
  await page.getByTestId("add-to-cart-button").first().click();
  await page.getByTestId("checkout-button").click();
  await expect(page.getByText("4242 4242 4242 4242")).toBeVisible();
  await page.getByLabel("Checkout").getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("checkout-email")).toBeHidden();
  await page.getByTestId("checkout-button").click();
  await expectReadableCheckoutField(page.getByTestId("checkout-email"));
  await expectReadableCheckoutField(page.getByTestId("checkout-address"));
  await page.getByTestId("checkout-email").fill("buyer@scentforge.test");
  await page.getByTestId("checkout-address").fill("21 Customer Lane, Mumbai");
  await page.getByTestId("pay-button").click();
  await expect(page.getByTestId("success-message")).toBeVisible();
  await page.getByRole("button", { name: "Continue shopping" }).click();
  await expect(page.getByTestId("cart-button")).toContainText("0");
});

test("affiliate live commission flow updates dashboard", async ({ page }) => {
  await page.goto("/a/demo");
  await page.getByTestId("add-to-cart-button").first().click();
  await page.getByTestId("checkout-button").click();
  await page.getByTestId("checkout-email").fill("affiliate-buyer@scentforge.test");
  await page.getByTestId("checkout-address").fill("7 Affiliate Road, Mumbai");
  await page.getByTestId("pay-button").click();
  await expect(page.getByTestId("success-message")).toBeVisible();

  await page.goto("/login");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page.getByText("Total live commission")).toBeVisible();
  await expect(page.getByText("Affiliate dashboard")).toBeVisible();
});
