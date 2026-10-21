import { expect, test } from "@playwright/test";

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
}

test.describe("mobile layout", () => {
  test("explore is usable on a phone", async ({ page }) => {
    await page.goto("/explore?q=fixture");
    await expect(page.getByTestId("result-count")).toContainText("45");
    await noHorizontalScroll(page);
    await page.getByTestId("filters-trigger").click();
    await expect(page.getByRole("dialog").getByText("Every filter is applied by GitHub")).toBeVisible();
  });

  test("navigation drawer opens and navigates", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Most starred" }).click();
    await expect(page).toHaveURL(/\/most-starred/);
  });

  test("repository page fits the screen", async ({ page }) => {
    await page.goto("/repository/fixture-org/fixture-repo-1");
    await expect(page.getByTestId("health-card")).toBeVisible();
    await noHorizontalScroll(page);
  });
});
