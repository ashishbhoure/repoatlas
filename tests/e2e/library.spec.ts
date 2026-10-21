import { expect, test } from "@playwright/test";
import { signIn } from "./auth";

test.describe("accounts and library", () => {
  test("signed-out visitors are sent to sign-in for library pages", async ({ page }) => {
    await page.goto("/saved");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fsaved/);
    await expect(page.getByTestId("github-sign-in")).toBeVisible();
  });

  test("protected APIs reject anonymous and cross-origin requests", async ({ request, baseURL }) => {
    const anon = await request.post("/api/saved", { data: { fullName: "fixture-org/fixture-repo-1" }, headers: { origin: baseURL! } });
    expect(anon.status()).toBe(401);
    const cross = await request.post("/api/saved", { data: { fullName: "fixture-org/fixture-repo-1" }, headers: { origin: "https://evil.example" } });
    expect(cross.status()).toBe(403);
  });

  test("saved repositories persist for a signed-in user", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "saver");
    await page.goto("/repository/fixture-org/fixture-repo-3");
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/saved") && r.request().method() === "POST");
    await page.getByTestId("save-button").click();
    await expect(page.getByTestId("save-button")).toHaveAttribute("aria-pressed", "true");
    expect((await saved).status()).toBe(201);
    await page.goto("/saved");
    await expect(page.getByTestId("saved-list")).toContainText("fixture-org/fixture-repo-3");
    await page.reload();
    await expect(page.getByTestId("saved-list")).toContainText("fixture-org/fixture-repo-3");
  });

  test("collections can be created, filled, renamed and emptied", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "curator");
    await page.goto("/collections");
    await page.getByTestId("create-collection").getByLabel("Name").fill("E2E picks");
    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E picks");

    await page.goto("/repository/fixture-org/fixture-repo-4");
    await page.getByTestId("add-to-collection").click();
    await page.getByRole("dialog").getByText("E2E picks").click();
    await expect(page.getByRole("dialog").getByRole("checkbox")).toBeChecked();
    await page.keyboard.press("Escape");

    await page.goto("/collections");
    await page.getByRole("link", { name: /E2E picks/ }).click();
    await expect(page.getByTestId("collection-items")).toContainText("fixture-org/fixture-repo-4");

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("E2E favourites");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E favourites");

    await page.getByRole("button", { name: /remove fixture-org\/fixture-repo-4/i }).click();
    await expect(page.getByText("This collection is empty")).toBeVisible();
  });

  test("watching a repository lists it with its alert settings", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "watcher");
    await page.goto("/repository/fixture-org/fixture-repo-5");
    await page.getByTestId("watch-button").click();
    await page.getByLabel("Star milestone (optional)").fill("60000");
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/watches") && r.request().method() === "PUT");
    await page.getByRole("button", { name: "Watch repository" }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByTestId("watch-button")).toHaveText(/Watching/);
    await page.goto("/notifications");
    await expect(page.getByText("Watching (1)")).toBeVisible();
    await expect(page.getByText(/60,000 stars/)).toBeVisible();
  });

  test("scheduled jobs require the cron secret", async ({ request }) => {
    expect((await request.get("/api/cron/alerts")).status()).toBe(401);
    expect((await request.get("/api/cron/snapshots", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/alerts", { headers: { authorization: "Bearer e2e-cron-secret" } });
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toHaveProperty("checked");
  });

  test("saved searches restore the exact search", async ({ page, context, baseURL }) => {
    await signIn(context, baseURL!, "searcher");
    await page.goto("/explore?q=fixture&language=Rust&sort=stars");
    await page.getByTestId("save-search").click();
    await page.getByLabel("Name").fill("Rust fixtures");
    const created = page.waitForResponse((r) => r.url().endsWith("/api/saved-searches") && r.request().method() === "POST");
    await page.getByRole("dialog").getByRole("button", { name: "Save search" }).click();
    expect((await created).status()).toBe(201);
    await page.goto("/saved-searches");
    await page.getByRole("link", { name: "Rust fixtures" }).click();
    await expect(page).toHaveURL(/q=fixture/);
    await expect(page).toHaveURL(/language=Rust/);
    await expect(page).toHaveURL(/sort=stars/);
  });
});
