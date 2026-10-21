import { expect, test } from "@playwright/test";

test.describe("discovery and search", () => {
  test("home page loads and the hero search opens Explore", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /find open-source projects worth building on/i })).toBeVisible();
    await page.getByTestId("home-search").fill("testing tools");
    await page.getByTestId("home-search").press("Enter");
    await expect(page).toHaveURL(/\/explore\?q=testing\+tools/);
    await expect(page.getByTestId("result-count")).toContainText("45 repositories");
  });

  test("search returns results with the query shown transparently", async ({ page }) => {
    await page.goto("/explore?q=fixture&language=Go");
    await expect(page.getByTestId("result-count")).toContainText("45");
    await expect(page.getByTestId("repo-link").first()).toContainText("fixture-org/fixture-repo-1");
    await page.getByTestId("query-panel").locator("summary").click();
    await expect(page.getByTestId("query-panel")).toContainText("fixture language:Go");
  });

  test("filters update the URL, chips and results", async ({ page }) => {
    await page.goto("/explore?q=fixture");
    const panel = page.getByTestId("filter-panel").first();
    await panel.getByPlaceholder("Min").first().fill("1000");
    await panel.getByTestId("apply-filters").click();
    await expect(page).toHaveURL(/minStars=1000/);
    await expect(page.getByTestId("filter-chips")).toContainText("≥ 1,000 stars");
    await page.getByRole("link", { name: /remove filter: ≥ 1,000 stars/i }).click();
    await expect(page).not.toHaveURL(/minStars/);
  });

  test("sorting changes the order requested from GitHub", async ({ page }) => {
    await page.goto("/explore?q=fixture");
    await page.getByTestId("sort-select").click();
    await page.getByRole("option", { name: "Most forks" }).click();
    await expect(page).toHaveURL(/sort=forks/);
    await expect(page.getByTestId("repo-link").first()).toContainText("fixture-repo-45");
  });

  test("pagination moves through results", async ({ page }) => {
    await page.goto("/explore?q=fixture");
    await page.getByTestId("pagination").getByRole("link", { name: "Page 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByTestId("result-count")).toContainText("showing 21–40");
    await expect(page.getByTestId("pagination").getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
  });

  test("repository details open with metadata, health score and a sanitized README", async ({ page }) => {
    await page.goto("/explore?q=fixture");
    await page.getByTestId("repo-link").first().click();
    await expect(page).toHaveURL(/\/repository\/fixture-org\/fixture-repo-1$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("fixture-org/fixture-repo-1");
    await expect(page.getByTestId("health-card")).toContainText("/100");
    await expect(page.getByRole("link", { name: /open on github/i })).toHaveAttribute("href", "https://github.com/fixture-org/fixture-repo-1");
    const readme = page.locator(".readme");
    await expect(readme).toContainText("Fixture README.");
    await expect(readme.locator("script")).toHaveCount(0);
    await expect(readme.locator("img")).toHaveAttribute("src", "https://raw.githubusercontent.com/fixture-org/fixture-repo-1/main/docs/x.png");
    expect(await readme.locator("img").getAttribute("onerror")).toBeNull();
  });

  test("invalid URL parameters are reported, not silently dropped", async ({ page }) => {
    await page.goto("/explore?q=fixture&minStars=-4&sort=random");
    await expect(page.getByTestId("param-issues")).toContainText("minStars");
    await expect(page.getByTestId("param-issues")).toContainText("sort");
    await expect(page.getByTestId("result-count")).toContainText("45");
  });

  test("empty results suggest broadening the search", async ({ page }) => {
    await page.goto("/explore?q=nomatchxyz");
    await expect(page.getByTestId("empty-state")).toContainText("No repositories match");
  });

  test("GitHub rate limits produce a recoverable error", async ({ page }) => {
    await page.goto("/explore?q=ratelimitxyz");
    await expect(page.getByTestId("error-state")).toContainText("rate limit");
    await expect(page.getByTestId("error-state").getByRole("link", { name: /try again/i })).toBeVisible();
  });

  test("unknown repositories show the not-found page", async ({ page }) => {
    await page.goto("/repository/fixture-org/missing");
    await expect(page.getByRole("heading", { name: /does not exist/i })).toBeVisible();
  });

  test("compare shows a table for two repositories and a shareable URL", async ({ page }) => {
    await page.goto("/compare?repos=fixture-org/fixture-repo-1");
    await page.getByTestId("compare-input").fill("fixture-org/fixture-repo-2");
    await page.getByRole("button", { name: "Add" }).click();
    await expect(page).toHaveURL(/repos=fixture-org\/fixture-repo-1,fixture-org\/fixture-repo-2/);
    const table = page.getByTestId("compare-table");
    await expect(table).toContainText("fixture-org/fixture-repo-2");
    await expect(table).toContainText("v1.2.3");
  });

  test("theme switching works and persists", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("theme-toggle").click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });

  test("discovery pages render real ranking labels", async ({ page }) => {
    await page.goto("/most-starred");
    await expect(page.getByText("Public repositories sorted by GitHub star count")).toBeVisible();
    await page.goto("/trending");
    await expect(page.getByText(/not enough observations yet|stars\/day/i).first()).toBeVisible();
    await page.goto("/hidden-gems");
    await expect(page.getByText(/star count itself is not a scoring input/i)).toBeVisible();
  });
});
