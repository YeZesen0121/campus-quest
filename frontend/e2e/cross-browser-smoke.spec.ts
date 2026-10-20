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
import { completeStaffPasswordLogin, expect, test } from "./fixtures";

const E2E_ENABLED = process.env.CQ_E2E === "1";
const BASE = process.env.CQ_E2E_BASE_URL ?? "https://localhost:3000";

test.skip(!E2E_ENABLED, "set CQ_E2E=1 (and the CQ_E2E_* env) to run this suite.");

test.describe("cross-browser smoke (firefox + webkit subset)", () => {
  test("R1 innovation navigation and real logout fence browser back", async ({ page }) => {
    await studentLoginTyped(page, process.env.CQ_E2E_STUDENT ?? "");
    await page.getByRole("navigation", { name: "主导航", exact: true }).filter({ visible: true }).getByRole("link", { name: "创新创业", exact: true }).click();
    await expect(page.getByRole("region", { name: "校内已核实成果" })).toBeVisible();
    await page.goto(`${BASE}/profile/project-drafts`);
    await expect(page.getByRole("button", { name: "新建项目草稿", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "我的账户", exact: true }).click();
    // Growth's ready-only honors region settles the page above the footer.
    // Otherwise its skeleton can expand between mouse-down and mouse-up,
    // moving the logout link away from the pointer without activating it.
    await expect(page.getByRole("region", { name: "获得的荣誉", exact: true })).toBeVisible();
    await page.getByRole("region", { name: "退出当前账号", exact: true }).getByRole("link", { name: "退出登录", exact: true }).click();
    await page.getByRole("button", { name: "确认退出登录", exact: true }).click();
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
    await page.goto(`${BASE}${taskUrl}`);
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
    await page.goto(`${BASE}/login`);
    await page.getByRole("button", { name: "使用密码登录" }).click();
    await page.getByLabel("账号", { exact: true }).pressSequentially(staff[0], { delay: 2 });
    await page.getByLabel("密码").pressSequentially(staff[1] ?? "", { delay: 2 });
    await expect(page.getByLabel("账号", { exact: true })).toHaveValue(staff[0]);
    await expect(page.getByLabel("密码")).toHaveValue(staff[1] ?? "");
    await completeStaffPasswordLogin(page, totpSecret);
    await page.goto(`${BASE}/teacher/reviews`);
    await expect(page.locator(".review-item, .section").first()).toBeVisible({
      timeout: 20_000,
    });
    await page.close();
  });
});
