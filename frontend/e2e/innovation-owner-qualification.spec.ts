import type { BrowserContext, Page } from "@playwright/test";
import { BASE_URL, ensureStudentLogin, expect, loginThroughUi, parseSeededAccount, staffLogin, test } from "./fixtures";

test.skip(process.env.CQ_E2E !== "1", "set CQ_E2E=1 with the disposable browser world");

async function saveProfile(page: Page, name: string, major: string) {
  await page.goto(`${BASE_URL}/profile/owner-profile`);
  const editor = page.getByRole("region", { name: "负责人资料编辑器" });
  await expect(editor).toBeVisible();
  for (const [label, value] of Object.entries({ 姓名: name, 学号: "00123456", 专业: major, 年级: "2026级" })) {
    await editor.getByLabel(label, { exact: true }).fill(value);
  }
  await editor.getByRole("button", { name: "保存负责人资料", exact: true }).click();
  await expect(editor.getByRole("status", { name: "负责人资料保存状态" })).toContainText("资料已保存");
}

// This file runs serially (the runner has one worker). Keep only the genuine
// admin session's latest cookies in worker memory: every app navigation rotates
// the single-use refresh cookie, so a snapshot taken at login becomes stale.
// Each test still gets a fresh context and drives the real qualification UI.
let adminCookies: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;
const authenticatedAdminContexts = new WeakSet<BrowserContext>();

async function rememberAdminSession(context: BrowserContext) {
  if (authenticatedAdminContexts.has(context)) adminCookies = await context.cookies();
}

async function adminLogin(page: Page) {
  const account = process.env.CQ_E2E_ADMIN;
  const secret = process.env.CQ_E2E_ADMIN_TOTP_SECRET;
  if (!account || !secret) throw new Error("world must export genuine admin TOTP credentials");
  if (adminCookies) {
    await page.context().addCookies(adminCookies);
    const meResponse = page.waitForResponse((response) =>
      response.url().includes("/api/v1/me") && response.status() === 200);
    await page.goto(`${BASE_URL}/`);
    const me = await (await meResponse).json();
    expect(me.username).toBe(account.split(":")[0]);
    expect(me.role).toBe("ADMIN");
  } else {
    await staffLogin(page, account, secret);
  }
  authenticatedAdminContexts.add(page.context());
  await page.goto(`${BASE_URL}/admin/owner-qualifications`);
}

async function viewOnlyPendingApplication(page: Page) {
  const queue = page.getByRole("region", { name: "负责人资格申请队列" });
  await expect(queue).toBeVisible();
  const view = queue.getByRole("button", { name: "查看申请", exact: true });
  await expect(view).toHaveCount(1);
  await view.click();
  await expect(page.getByRole("region", { name: "负责人资格申请详情" })).toBeVisible();
}

test("owner qualification: student applies, admin confirms, account switch clears private state", async ({ page, browser }, testInfo) => {
  await ensureStudentLogin(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await saveProfile(page, "开通演示甲", "示例专业甲");
  const qualification = page.getByRole("region", { name: "负责人资格", exact: true });
  await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("未申请");
  await qualification.getByRole("button", { name: "申请负责人资格", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("等待管理员");
  await page.reload();
  await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("等待管理员");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
  try {
    const admin = await context.newPage();
    await adminLogin(admin);
    const queue = admin.getByRole("region", { name: "负责人资格申请队列" });
    await expect(queue).toBeVisible();
    await expect(queue).not.toContainText("00123456");
    await expect(queue).not.toContainText("开通演示甲");
    await viewOnlyPendingApplication(admin);
    const detail = admin.getByRole("region", { name: "负责人资格申请详情" });
    await expect(detail).toContainText("示例专业甲");
    const compositionDifferences: string[] = [];
    for (const width of [320, 390, 640, 800, 1440]) {
      await admin.setViewportSize({ width, height: 900 });
      await admin.evaluate(async () => { await document.fonts.ready; });
      const pairs = await detail.locator("dl > div").evaluateAll((fields) => fields.map((field) => {
        const label = field.querySelector("dt")!.getBoundingClientRect(), value = field.querySelector("dd")!.getBoundingClientRect();
        return label.right <= value.left + 1 && Math.abs(label.top - value.top) <= 3;
      }));
      if (pairs.length !== 4 || !pairs.every(Boolean)) compositionDifferences.push(`${width}: four horizontal snapshot facts`);
      const tops = await detail.locator("dl > div").evaluateAll(fields => [...new Set(fields.map(field => Math.round(field.getBoundingClientRect().top)))]);
      if (tops.length !== (width < 1024 ? 4 : 2)) compositionDifferences.push(`${width}: source snapshot rows ${tops.length}`);
      const snapshotGeometry = await detail.locator("dl").evaluate(dl => ({
        width: dl.getBoundingClientRect().width, available: dl.parentElement!.clientWidth,
        fields: [...dl.children].map(field => {
          const key = field.querySelector("dt")!, value = field.querySelector("dd")!;
          return { top: field.getBoundingClientRect().top, bottom: field.getBoundingClientRect().bottom, keyWidth: key.getBoundingClientRect().width, keyFont: getComputedStyle(key).fontSize, valueFont: getComputedStyle(value).fontSize, gap: parseFloat(getComputedStyle(field).columnGap) };
        }),
      }));
      if (Math.abs(snapshotGeometry.width - Math.min(720, snapshotGeometry.available)) > 1) compositionDifferences.push(`${width}: source snapshot cap720:${snapshotGeometry.width}`);
      if (!snapshotGeometry.fields.every(field => Math.abs(field.keyWidth - (width >= 1024 ? 90 : 80)) <= 1 && field.keyFont === "12px" && field.valueFont === "14px" && Math.abs(field.gap - (width >= 1024 ? 12 : 10)) <= 1)) compositionDifferences.push(`${width}: source snapshot key/value hierarchy:${JSON.stringify(snapshotGeometry.fields)}`);
      const expectedPairGap = width < 640 ? 10 : 11;
      const fields = snapshotGeometry.fields;
      if (fields.length === 4) {
        const gaps = width >= 1024 ? [fields[1].top - fields[0].bottom, fields[3].top - fields[2].bottom] : fields.slice(1).map((field, index) => field.top - fields[index].bottom);
        const expected = width >= 1024 ? [11, 11] : [expectedPairGap, 0, expectedPairGap];
        if (!gaps.every((gap, index) => Math.abs(gap - expected[index]) <= 1)) compositionDifferences.push(`${width}: source independent fact-pair gaps:${JSON.stringify(gaps)}`);
      }
      const primaryAccount = await queue.locator('tbody td').first().evaluate(node => getComputedStyle(node).fontSize);
      if (primaryAccount !== `${width < 640 ? 14 : 13}px`) compositionDifferences.push(`${width}: primary application account ${primaryAccount}`);
      const sourcePaint = await detail.evaluate(section => {
        const header = section.querySelector('.campus-admin-detail-heading')!, status = header.querySelector('[aria-label="申请开通状态"]')!;
        const note = Array.from(section.querySelectorAll('p')).find(node => node.textContent?.includes('不会核实成果'))!;
        const style = getComputedStyle(note), canvas = document.createElement('canvas').getContext('2d')!;
        const rgb = (color: string) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = color; canvas.fillRect(0, 0, 1, 1); return Array.from(canvas.getImageData(0, 0, 1, 1).data).join(','); };
        return { statusAtEdge: Math.abs(status.getBoundingClientRect().right - header.getBoundingClientRect().right) < 1, font: style.fontSize, padding: style.padding, border: style.borderLeftWidth, borderInk: rgb(style.borderLeftColor), ground: rgb(style.backgroundColor), ink: rgb(style.color) };
      });
      if (!sourcePaint.statusAtEdge) compositionDifferences.push(`${width}: qualification state belongs at the heading edge`);
      if (sourcePaint.font !== '14px' || sourcePaint.padding !== (width < 640 ? '9px 11px' : '10px 13px') || sourcePaint.border !== '2px' || sourcePaint.borderInk !== '175,186,164,255' || sourcePaint.ground !== '237,236,227,255' || sourcePaint.ink !== '69,72,63,255') compositionDifferences.push(`${width}: approved consequence note ${JSON.stringify(sourcePaint)}`);
      if (await queue.locator('.cq-status-cell .badge').count() !== 1) compositionDifferences.push(`${width}: actual queue state uses the source compact tag`);
      expect(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await admin.screenshot({ path: testInfo.outputPath("admin-qualification-selected-" + width + ".png"), fullPage: true });
    }
    await admin.setViewportSize({ width: 390, height: 844 });
    expect(compositionDifferences, "approved selected qualification composition").toEqual([]);
    const open = detail.getByRole("button", { name: "开通负责人资格", exact: true });
    const dialog = admin.getByRole("dialog", { name: "开通负责人资格", exact: true });
    await open.click();
    await expect(dialog).toContainText("成果仍需单独核实");
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(open).toBeFocused();
    await admin.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await admin.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole("button", { name: "确认开通", exact: true }).click();
    await expect(detail.getByRole("status", { name: "管理员资格操作结果" })).toHaveText("负责人资格已开通。");
    await expect(detail.getByRole("button", { name: "重新读取申请详情", exact: true })).toBeFocused();
    await qualification.getByRole("button", { name: "重新读取资格状态", exact: true }).click();
    await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("已开通");
    await admin.screenshot({ path: testInfo.outputPath("owner-qualification-admin-mobile.png"), fullPage: true });
    await page.screenshot({ path: testInfo.outputPath("owner-qualification-student-mobile.png"), fullPage: true });
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const sibling = await page.context().newPage();
    try {
      await loginThroughUi(sibling, parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT, "CQ_E2E_AUTHOR_STUDENT"));
      await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("未申请");
      await expect(page.getByLabel("姓名", { exact: true })).toHaveValue("");
      await loginThroughUi(sibling, parseSeededAccount(process.env.CQ_E2E_STUDENT, "CQ_E2E_STUDENT"));
      await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("已开通");
      await expect(page.getByLabel("姓名", { exact: true })).toHaveValue("开通演示甲");
    } finally { await sibling.close(); }
  } finally { await rememberAdminSession(context); await context.close(); }
});

test("owner qualification: updated snapshot rejects old admin page and lost acknowledgement reconciles", async ({ browser }, testInfo) => {
  const studentContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const adminContext = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const student = await studentContext.newPage();
    await loginThroughUi(student, parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT, "CQ_E2E_AUTHOR_STUDENT"));
    await saveProfile(student, "开通演示乙", "申请快照一");
    const qualification = student.getByRole("region", { name: "负责人资格", exact: true });
    await qualification.getByRole("button", { name: "申请负责人资格", exact: true }).click();
    await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("等待管理员");
    const first = await adminContext.newPage();
    await adminLogin(first);
    await viewOnlyPendingApplication(first);
    const second = await adminContext.newPage();
    await second.goto(`${BASE_URL}/admin/owner-qualifications`);
    await viewOnlyPendingApplication(second);
    await student.getByLabel("专业", { exact: true }).fill("申请快照二");
    await expect(qualification.getByRole("button", { name: "更新资格申请", exact: true })).toBeDisabled();
    await student.getByRole("button", { name: "保存负责人资料", exact: true }).click();
    await expect(student.getByRole("status", { name: "负责人资料保存状态" })).toContainText("资料已保存");
    await qualification.getByRole("button", { name: "更新资格申请", exact: true }).click();
    await expect(qualification.getByRole("status", { name: "资格操作结果" })).toContainText("资格申请已提交");
    const detail = second.getByRole("region", { name: "负责人资格申请详情" });
    await expect(detail).toContainText("申请快照一");
    await detail.getByRole("button", { name: "开通负责人资格", exact: true }).click();
    await second.getByRole("button", { name: "确认开通", exact: true }).click();
    await expect(detail.getByRole("alert")).toContainText("重新读取");
    await expect(detail.getByRole("button", { name: "开通负责人资格", exact: true })).toBeDisabled();
    await expect(detail.getByRole("button", { name: "重新读取申请详情", exact: true })).toBeFocused();
    await detail.getByRole("button", { name: "重新读取申请详情", exact: true }).click();
    await expect(detail).toContainText("申请快照二");
    await second.route("**/api/v1/admin/ie/owner-qualifications/*/approve", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort("connectionfailed");
    });
    await detail.getByRole("button", { name: "开通负责人资格", exact: true }).click();
    await second.getByRole("button", { name: "确认开通", exact: true }).click();
    await expect(detail.getByRole("alert")).toContainText("重新读取");
    await expect(detail.getByRole("button", { name: "开通负责人资格", exact: true })).toBeDisabled();
    await detail.getByRole("button", { name: "重新读取申请详情", exact: true }).click();
    await expect(detail.getByRole("status", { name: "申请开通状态" })).toContainText("已开通");
    await qualification.getByRole("button", { name: "重新读取资格状态", exact: true }).click();
    await expect(qualification.getByRole("status", { name: "负责人资格状态" })).toContainText("已开通");
    await second.screenshot({ path: testInfo.outputPath("owner-qualification-admin-desktop.png"), fullPage: true });
  } finally { await rememberAdminSession(adminContext); await studentContext.close(); await adminContext.close(); }
});

test("owner qualification: empty later queue page retains navigation after refresh", async ({ page }) => {
  const rows = Array.from({ length: 21 }, (_, index) => ({
    user_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    version: 1, requested_at: "2026-10-09T01:00:00Z",
  }));
  let remaining = rows;
  // This read-only fixture isolates pagination; approval is exercised through
  // the real backend in the two tests above.
  await page.route("**/api/v1/admin/ie/owner-qualifications?*", async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    await route.fulfill({ json: { items: remaining.slice(offset, offset + 20), total: remaining.length } });
  });
  await adminLogin(page);
  const queue = page.getByRole("region", { name: "负责人资格申请队列" });
  await expect(queue.getByRole("button", { name: "查看申请", exact: true })).toHaveCount(20);
  await queue.getByRole("button", { name: "下一页申请", exact: true }).click();
  await expect(queue.getByRole("button", { name: "查看申请", exact: true })).toHaveCount(1);
  remaining = rows.slice(0, 20);
  await queue.getByRole("button", { name: "刷新申请队列", exact: true }).click();
  await expect(queue.getByText("暂无等待开通的资格申请", { exact: true })).toBeVisible();
  await queue.getByRole("button", { name: "上一页申请", exact: true }).click();
  await expect(queue.getByRole("button", { name: "查看申请", exact: true })).toHaveCount(20);
});
