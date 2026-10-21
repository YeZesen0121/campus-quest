/**
 * P3-B: cross-browser smoke — Firefox + WebKit ride a deliberately
 * NARROW subset (the trade-off is recorded in the PR: a full
 * three-browser matrix triples CI time for marginal signal — the
 * Chromium full suite remains the behavioral authority; the smoke
 * subset catches engine-level rendering/API breaks where they most
 * likely appear: auth → task discovery → the claim flow's client
 * island → one staff surface).
 *
 * Runs under --project=firefox / --project=webkit ONLY; the default
 * Chromium run collects nothing from this file, so the main suite and
 * its baselines are untouched.
 *
 * Native keyboard entry starts only after the form enables its inputs.
 * pressSequentially does not wait for enabled state: typing into the
 * server-rendered disabled field loses keystrokes before hydration.
 * Assert the complete entered value before submitting. Each TOTP attempt
 * replaces the previous value and only a real auth rejection can retry.
 */
import { completeStaffPasswordLogin, expect, logoutStudentThroughUi, test } from "./fixtures";

const E2E_ENABLED = process.env.CQ_E2E === "1";
const BASE = process.env.CQ_E2E_BASE_URL ?? "https://localhost:3000";

test.skip(!E2E_ENABLED, "set CQ_E2E=1 (and the CQ_E2E_* env) to run this suite.");

// Retain only method/path/status/timing, so a late read can be distinguished
// from a rendering failure without recording credentials, bodies or queries.
let network: object[] = [];
test.beforeEach(() => { network = []; });
test.afterEach(async () => {
  await test.info().attach("cross-engine-read-timing", { body: JSON.stringify(network), contentType: "application/json" });
});
function observeReads(page: import("@playwright/test").Page): void {
  const start = Date.now();
  const record = (event: string, request: import("@playwright/test").Request, status?: number) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/v1/") && network.length < 1000) {
      network.push({ event, method: request.method(), path, status, elapsed: Date.now() - start });
    }
  };
  page.on("request", request => record("request", request));
  page.on("response", response => record("response", response.request(), response.status()));
  page.on("requestfinished", request => record("finished", request));
  page.on("requestfailed", request => record("failed", request));
}

/** Native keyboard login keeps the cross-engine input/hydration contract. */
async function studentLoginTyped(
  page: import("@playwright/test").Page,
  credentials: string,
): Promise<void> {
  observeReads(page);
  const [username, password] = credentials.split(":");
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "使用密码登录" }).click();
  const identifier = page.getByLabel("账号", { exact: true });
  await expect(identifier).toBeEnabled();
  await identifier.pressSequentially(username, { delay: 2 });
  await page.getByLabel("密码").pressSequentially(password, { delay: 2 });
  await expect(identifier).toHaveValue(username);
  await expect(page.getByLabel("密码")).toHaveValue(password);
  const accepted = page.waitForResponse(response =>
    response.request().method() === "POST" &&
    new URL(response.url()).pathname === "/api/v1/auth/login");
  const identityRead = page.waitForResponse(response =>
    response.request().method() === "GET" && response.status() === 200 &&
    new URL(response.url()).pathname === "/api/v1/me");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  expect((await accepted).status()).toBe(200);
  expect(await (await identityRead).json()).toMatchObject({ username, role: "STUDENT" });
  await page.waitForURL(url => !url.pathname.startsWith("/login"));
  // I1's optimistic shell also renders the sidebar toggle and links. Only
  // the resolved identity, real account link and home content prove readiness.
  await expect(page.getByRole("button", { name: /收起侧边栏|展开侧边栏/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("banner").getByRole("link", { name: "我的账户", exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "首页", level: 1, exact: true })).toBeVisible({ timeout: 15_000 });
}

test.describe("cross-browser smoke (firefox + webkit subset)", () => {
  test("R1 innovation navigation and real logout fence browser back", async ({ page }) => {
    await studentLoginTyped(page, process.env.CQ_E2E_STUDENT ?? "");
    await page.getByRole("navigation", { name: "主导航", exact: true }).filter({ visible: true }).getByRole("link", { name: "创新创业", exact: true }).click();
    await expect(page.getByRole("region", { name: "校内已核实成果" })).toBeVisible();
    await page.goto(`${BASE}/profile/project-drafts`);
    await expect(page.getByRole("button", { name: "新建项目草稿", exact: true })).toBeVisible();
    const growthRead = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/growth/me");
    await page.getByRole("link", { name: "我的账户", exact: true }).click();
    const growth = await growthRead;
    expect(growth.status()).toBe(200);
    expect(await growth.finished()).toBeNull();
    // Growth's ready-only honors region settles the page above the footer.
    // Otherwise its skeleton can expand between mouse-down and mouse-up,
    // moving the logout link away from the pointer without activating it.
    await expect(page.getByRole("region", { name: "获得的荣誉", exact: true })).toBeVisible();
    await logoutStudentThroughUi(page);
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await expect(page.getByRole("button", { name: "新建项目草稿", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "去登录", exact: true })).toBeVisible();
  });
  test("login → task square renders cards → one task detail loads", async ({ page }) => {
    await studentLoginTyped(page, process.env.CQ_E2E_STUDENT ?? "");
    await page.goto(`${BASE}/tasks`);
    const firstCard = page.locator(".task-card").first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });
    await firstCard.getByRole("link").first().click();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("claim flow surface mounts (the client island)", async ({ page }) => {
    await studentLoginTyped(page, process.env.CQ_E2E_STUDENT ?? "");
    const taskUrl = process.env.CQ_E2E_TASK_URL;
    test.skip(
      taskUrl === undefined,
      "needs CQ_E2E_TASK_URL (the seeded open task deep link)",
    );
    const task = new URL(taskUrl!, BASE);
    const detailRead = page.waitForResponse(response => response.request().method() === "GET" && new URL(response.url()).pathname === `/api/v1${task.pathname}`);
    await page.goto(task.href);
    const detail = await detailRead;
    expect(detail.status()).toBe(200);
    expect(await detail.finished()).toBeNull();
    await expect(
      page.locator(".claim-panel, .task-detail-body section").first(),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("staff surface renders behind its gate", async ({ browser }) => {
    const staff = (process.env.CQ_E2E_STAFF ?? "").split(":");
    const totpSecret = process.env.CQ_E2E_STAFF_TOTP_SECRET ?? "";
    test.skip(
      !(staff[0] && totpSecret),
      "needs CQ_E2E_STAFF + CQ_E2E_STAFF_TOTP_SECRET (the seeded staff contract)",
    );
    const page = await browser.newPage();
    observeReads(page);
    await page.goto(`${BASE}/login`);
    await page.getByRole("button", { name: "使用密码登录" }).click();
    await page.getByLabel("账号", { exact: true }).pressSequentially(staff[0], { delay: 2 });
    await page.getByLabel("密码").pressSequentially(staff[1] ?? "", { delay: 2 });
    await expect(page.getByLabel("账号", { exact: true })).toHaveValue(staff[0]);
    await expect(page.getByLabel("密码")).toHaveValue(staff[1] ?? "");
    // Observe the accepted login's own read; a second navigation can
    // discard its body. Both empty and populated queues are valid states.
    const queueRead = page.waitForResponse(response =>
      response.request().method() === "GET" &&
      new URL(response.url()).pathname === "/api/v1/teacher/submissions/review-queue");
    await completeStaffPasswordLogin(page, totpSecret);
    await expect(page).toHaveURL(/\/teacher\/reviews$/);
    const response = await queueRead;
    expect(response.status()).toBe(200);
    expect(await response.finished()).toBeNull();
    const queue = await response.json() as { items: unknown[] };
    expect(Array.isArray(queue.items)).toBe(true);
    const workspace = page.getByRole("region", { name: "任务审核工作区", exact: true });
    await expect(page.getByRole("heading", { name: "提交审核", level: 1, exact: true })).toBeVisible();
    await expect(workspace).toBeVisible({ timeout: 20_000 });
    if (queue.items.length === 0) {
      await expect(workspace.getByText("审核队列为空", { exact: true })).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(workspace.locator(".review-item")).toHaveCount(queue.items.length, { timeout: 20_000 });
      await expect(workspace.locator(".review-item").first()).toBeVisible({ timeout: 20_000 });
    }
    await test.info().attach("staff-review-state", {
      body: JSON.stringify({ itemsCount: queue.items.length }),
      contentType: "application/json",
    });
    await page.close();
  });
});
