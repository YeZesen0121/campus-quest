/**
 * CampusQuest teacher workspace e2e — Plan 09 Task 9, wired to the
 * runner and seeded for real by Plan 10's world (PR #6 final review:
 * the CQ_E2E_STAFF* contract below is the browser_world export, so
 * every test RUNS under the gate — the release gate asserts this
 * suite at zero skips).
 *
 * Every test is skipped unless CQ_E2E=1 (the suite-wide convention),
 * so importing the file can never depend on a live backend during
 * ordinary development.
 *
 * Environment contract (the seeded world's; defaults work against the
 * orchestrated local servers):
 * - CQ_E2E=1                enable the suite (required);
 * - CQ_E2E_BASE_URL         frontend origin (default https://localhost:3000);
 * - CQ_E2E_STAFF_LOGIN_URL  staff login page (default $CQ_E2E_BASE_URL/staff/login);
 * - CQ_E2E_STAFF            pre-seeded TEACHER credentials
 *                           "email:password" + CQ_E2E_STAFF_TOTP_SECRET
 *                           (the run's answerable browser teacher — the
 *                           code is computed IN-TEST via node:crypto
 *                           RFC 6238, what a real authenticator shows
 *                           for the same secret);
 * - CQ_E2E_STAFF2 / CQ_E2E_STAFF2_TOTP_SECRET  an UNRELATED second
 *                           teacher for the access-denied negative (F6);
 * - CQ_E2E_STUDENT          a seeded student for the role-negative.
 *
 * Brief flow: task-create -> import (preview/confirm) -> publish, plus
 * the review-decision surfaces' gating copy (mandatory note/reason, the
 * invalidate warning) against the VALIDATED queue row the fixture
 * seeds on the browser teacher's own task.
 */
import { expect, test } from "@playwright/test";
import { readControlClearance, API_URL, mintToken, staffLogin as loginAsStaff } from "./fixtures";

const E2E_ENABLED = process.env.CQ_E2E === "1";
const BASE_URL = process.env.CQ_E2E_BASE_URL ?? "https://localhost:3000";
const STAFF = process.env.CQ_E2E_STAFF; // "e2e-teacher-{run}@school.edu:password" (factories' DEFAULT_PASSWORD)
const STAFF_TOTP_SECRET = process.env.CQ_E2E_STAFF_TOTP_SECRET;
// An UNRELATED teacher for the access-denied negative (F6): a second
// seeded account with no collaboration on the first teacher's task.
const STAFF2 = process.env.CQ_E2E_STAFF2;
const STAFF2_TOTP_SECRET = process.env.CQ_E2E_STAFF2_TOTP_SECRET;

test.skip(
  !E2E_ENABLED,
  "set CQ_E2E=1 (and the CQ_E2E_* vars) to run this suite.",
);

// The staff contract itself is a HARD requirement now (PR #6 final
// review): the world always provides it, and a missing export must
// fail the suite — never read as a skip the gate would have to catch.

/** The §7.1 CSV payload: a valid row plus a duplicate-in-file error row.
 * The platform must be one of the closed import vocabulary
 * (xiaohongshu/douyin/zhihu) — the historical "weibo" row hit
 * UNSUPPORTED_PLATFORM on its first real run. */
function assignmentsCsv(): string {
  return "platform,keyword\nxiaohongshu,图书馆\nxiaohongshu,图书馆\n";
}

test.describe("teacher workspace (brief: create -> import -> publish)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsStaff(page, STAFF!, STAFF_TOTP_SECRET!);
  });

  test("create draft -> edit-in schema -> import preview/confirm -> publish; unrelated teacher denied", async ({
    page,
    browser,
  }) => {
    await page.goto(`${BASE_URL}/teacher/tasks`);

    // Create dialog: the publish-validation fields; obvious mistakes stay
    // client-side (a too-short reward never sends).
    await page.getByRole("button", { name: "新建任务" }).first().click();
    const dialog = page.getByRole("dialog", { name: "新建任务" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("基础奖励积分").fill("0");
    await dialog.getByRole("button", { name: "创建草稿" }).click();
    await expect(dialog.getByText("基础奖励积分必须大于 0")).toBeVisible();

    await dialog.getByLabel("任务标题").fill(`e2e 教师任务 ${Date.now()}`);
    await dialog.getByLabel("任务描述").fill("e2e 创建的采集任务");
    await dialog.getByLabel("基础奖励积分").fill("120");
    await dialog.getByLabel("固定截止时间").fill("2030-09-30T18:00");
    // Defect #22: the schema rides collapsed in the 高级 section and
    // arrives PRE-FILLED with the per-type default template (CSV is
    // the default type selection).
    await dialog.getByText("高级：提交校验规则").click();
    const schemaField = dialog.locator("#task-schema");
    await expect(schemaField).toHaveValue(/"platform"/);
    // §10.1 document family: a DOCX-only selection carries NO schema —
    // the pristine template blanks; back on CSV it returns. The type
    // checkboxes reuse the identity-option pattern (hidden native
    // inputs): act on the visible label text, exactly like the
    // community identity radios.
    await dialog.getByText("DOCX", { exact: true }).click();
    await dialog.getByText("CSV", { exact: true }).click();
    await expect(schemaField).toHaveValue("");
    await dialog.getByText("CSV", { exact: true }).click();
    await expect(schemaField).toHaveValue(/"platform"/);
    // Return DOCX to off: the flow's task below stays CSV-only (the
    // toggle dance above is the assertion itself, not the task shape).
    await dialog.getByText("DOCX", { exact: true }).click();
    await schemaField.fill('{"columns":["platform","keyword"]}');
    await dialog.locator("#task-schema-version").fill("1");
    for (const label of ["截止前 24 小时", "截止前 4 小时", "站内", "短信", "已验证邮箱"]) {
      await expect(dialog.getByRole("checkbox", { name: label, exact: true })).toBeChecked();
      await dialog.getByRole("checkbox", { name: label, exact: true }).uncheck();
    }
    const createdPolicy = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/teacher/tasks");
    await dialog.getByRole("button", { name: "创建草稿" }).click();
    const createPolicyResponse = await createdPolicy;
    expect(createPolicyResponse.status()).toBe(201);
    expect(await createPolicyResponse.json()).toMatchObject({ notify_24h: false, notify_4h: false, notification_channels: [] });

    // The draft row appears in the workbench list with the 草稿 badge.
    const row = page.locator("tr", { hasText: "e2e 教师任务" }).first();
    await expect(row).toBeVisible();
    await expect(row.getByText("草稿")).toBeVisible();

    // Detail: import flow (spec §7.1 preview -> explicit confirm -> summary).
    await row.getByRole("link").click();
    // Settle the navigation BEFORE reading the URL: page.url() right
    // after the link click still names the list page (Playwright does
    // not auto-wait for link navigations), and the unrelated-teacher
    // negative below deep-links exactly this value.
    await expect(page).toHaveURL(/\/teacher\/tasks\/.+/);
    const detailUrl = page.url();
    await page.getByLabel("任务单元导入").scrollIntoViewIfNeeded();
    await page.locator("#assignment-import-file").setInputFiles({
      name: "assignments.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(assignmentsCsv(), "utf8"),
    });

    const preview = page.locator(".import-preview");
    await expect(preview).toBeVisible();
    // Counts line: 2 rows total, 1 importable, 1 problematic (in-file dup).
    await expect(preview.getByText(/共 2 行：可导入 1 行，存在问题 1 行/)).toBeVisible();
    await expect(preview.getByText("第 2 行")).toBeVisible();
    await expect(
      preview.getByText("文件内重复的 platform + keyword 组合"),
    ).toBeVisible();

    await preview.getByRole("button", { name: /确认导入 1 行/ }).click();
    await expect(page.getByText("已成功导入 1 个任务单元")).toBeVisible();

    // Edit-in the publish-required schema (the create dialog left it
    // draft-legal): the edit dialog reuses the create fields, prefilled.
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    const editDialog = page.getByRole("dialog", { name: "编辑任务" });
    await expect(editDialog).toBeVisible();
    // The 高级 section is collapsed here too (defect #22).
    await editDialog.getByText("高级：提交校验规则").click();
    await editDialog.locator("#task-schema").fill('{"columns":["platform","keyword"]}');
    await editDialog.locator("#task-schema-version").fill("1");
    for (const label of ["截止前 24 小时", "截止前 4 小时", "站内", "短信", "已验证邮箱"]) await expect(editDialog.getByRole("checkbox", { name: label, exact: true })).not.toBeChecked();
    await editDialog.getByRole("checkbox", { name: "截止前 24 小时", exact: true }).check();
    await editDialog.getByRole("checkbox", { name: "已验证邮箱", exact: true }).check();
    const draftPolicy = page.waitForResponse(response => response.request().method() === "PATCH" && /\/api\/v1\/teacher\/tasks\/[^/]+$/.test(new URL(response.url()).pathname));
    await editDialog.getByRole("button", { name: "保存修改" }).click();
    const draftPolicyResponse = await draftPolicy;
    expect(draftPolicyResponse.status()).toBe(200);
    expect(draftPolicyResponse.request().postDataJSON()).toEqual({ notify_24h: true, notification_channels: ["EMAIL"] });
    expect(await draftPolicyResponse.json()).toMatchObject({ notify_24h: true, notify_4h: false, notification_channels: ["EMAIL"] });
    await expect(editDialog).not.toBeVisible();
    // The detail refetch renders the stored schema in the facts.
    const schemaDetails = page.locator('details.campus-task-schema');
    expect.soft(await schemaDetails.count()).toBe(1);
    if (await schemaDetails.count()) {
      await expect(schemaDetails).not.toHaveAttribute('open');
      const summary = schemaDetails.locator('summary');
      await expect(summary).toContainText('v1');
      await summary.focus(); await page.keyboard.press('Enter');
      await expect(schemaDetails).toHaveAttribute('open', '');
      expect(JSON.parse((await schemaDetails.locator('pre').textContent())!)).toEqual({ columns: ['platform', 'keyword'] });
      await summary.press('Enter'); await expect(schemaDetails).not.toHaveAttribute('open');
    } else {
      await expect(page.getByText(/v1.*columns/)).toBeVisible();
    }

    // Publish from the detail head: explicit confirm, then the badge flips.
    await page.getByRole("button", { name: "发布", exact: true }).click();
    const confirm = page.getByRole("dialog", { name: "发布任务" });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(/发布后任务立即对学生可见/)).toBeVisible();
    await expect(confirm.getByText(/不可修改/)).toBeVisible();
    await confirm.getByRole("button", { name: "确认发布" }).click();
    await expect(page.locator(".page-head").getByText("已发布")).toBeVisible();

    // The existing API permits reminder policy edits after publication.
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByRole("checkbox", { name: "截止前 24 小时", exact: true })).toBeEnabled();
    await expect(editDialog.getByRole("checkbox", { name: "已验证邮箱", exact: true })).toBeChecked();
    await editDialog.getByRole("checkbox", { name: "截止前 24 小时", exact: true }).uncheck();
    await editDialog.getByRole("checkbox", { name: "已验证邮箱", exact: true }).uncheck();
    const publishedPolicy = page.waitForResponse(response => response.request().method() === "PATCH" && /\/api\/v1\/teacher\/tasks\/[^/]+$/.test(new URL(response.url()).pathname));
    await editDialog.getByRole("button", { name: "保存修改" }).click();
    const publishedPolicyResponse = await publishedPolicy;
    expect(publishedPolicyResponse.status()).toBe(200);
    expect(publishedPolicyResponse.request().postDataJSON()).toEqual({ notify_24h: false, notification_channels: [] });
    expect(await publishedPolicyResponse.json()).toMatchObject({ notify_24h: false, notify_4h: false, notification_channels: [] });
    await page.reload();
    await expect(page.getByRole("region", { name: "任务配置", exact: true })).toContainText("24 小时：关闭；4 小时：关闭");
    await expect(page.getByRole("region", { name: "任务配置", exact: true })).toContainText("未选择通知渠道");
    await page.getByRole("button", { name: "编辑", exact: true }).click();
    for (const label of ["截止前 24 小时", "截止前 4 小时", "站内", "短信", "已验证邮箱"]) await expect(editDialog.getByRole("checkbox", { name: label, exact: true })).not.toBeChecked();
    await editDialog.getByRole("button", { name: "取消", exact: true }).click();

    // F6: an UNRELATED teacher (no ownership/collaboration) opening this
    // task's detail gets the access-denied panel, not broken sections.
    const context = await browser.newContext();
    const other = await context.newPage();
    await loginAsStaff(other, STAFF2!, STAFF2_TOTP_SECRET!);
    await other.goto(detailUrl);
    await expect(
      other.getByText("任务不存在，或您不是该任务的所有者 / 协作者，无法访问。"),
    ).toBeVisible();
    await expect(other.getByRole("link", { name: "返回任务管理" })).toBeVisible();
    await context.close();

    // Continue the same owned task through every existing lifecycle action.
    await page.getByRole("button", { name: "暂停领取", exact: true }).click();
    await expect(page.locator(".page-head").getByText("已暂停", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "恢复领取", exact: true }).click();
    await expect(page.locator(".page-head").getByText("已发布", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "关闭任务", exact: true }).click();
    const close = page.getByRole("dialog", { name: "关闭任务", exact: true });
    await expect(close).toContainText("已有领取继续");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "关闭任务", exact: true })).toBeFocused();
    await page.keyboard.press("Enter"); await close.getByRole("button", { name: "确认关闭", exact: true }).click();
    await expect(page.locator(".page-head").getByText("已关闭", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "编辑", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "归档", exact: true }).click();
    await page.getByRole("dialog", { name: "归档任务", exact: true }).getByRole("button", { name: "确认归档", exact: true }).click();
    await expect(page).toHaveURL(/\/teacher\/tasks$/);
  });

  test("student session gets the permission-denied panel, not broken controls", async ({
    browser,
  }) => {
    // The teacher session from beforeEach navigated; open a student context.
    const context = await browser.newContext();
    const studentPage = await context.newPage();
    const [username, password] = (process.env.CQ_E2E_STUDENT ?? "").split(":");
    await studentPage.goto(`${BASE_URL}/login`);
    await studentPage.getByRole("button", { name: "使用密码登录" }).click();
    await studentPage.getByLabel("账号", { exact: true }).fill(username);
    await studentPage.getByLabel("密码").fill(password);
    await studentPage.getByRole("button", { name: "登录", exact: true }).click();
    // Wait for the login to actually LAND before navigating (the same
    // in-flight-abort race the staff helper above guards against).
    await expect(studentPage).not.toHaveURL(/\/login/, { timeout: 10_000 });
    await studentPage.goto(`${BASE_URL}/teacher/tasks`);
    await expect(
      studentPage.getByText("教师工作台仅对教师与管理员开放"),
    ).toBeVisible();
    await context.close();
  });

  test("the workspace carries its own profile page (defect #17)", async ({
    page,
  }) => {
    // 个人信息 is a first-class nav destination post-login.
    await page.goto(`${BASE_URL}/teacher/reviews`);
    const nav = page.getByRole("link", { name: "个人信息", exact: true });
    await expect(nav).toBeVisible();
    await nav.click();
    await expect(page).toHaveURL(/\/teacher\/profile/);

    // The /me facts render as definition rows (the owner's own account
    // view, spec §40). 注册日期 joined with PR #46's created_at —
    // date-only, year-inclusive, so the row must read 年.
    const section = page.getByRole("region", { name: "个人信息" });
    await expect(section).toBeVisible();
    for (const label of ["昵称", "账号", "角色", "账号状态", "注册日期"]) {
      await expect(section.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(section.getByText("教师", { exact: true })).toBeVisible();
    await expect(section.getByText("正常", { exact: true })).toBeVisible();
    const registration = section
      .locator(".fact-row", { hasText: "注册日期" })
      .locator(".fact-value");
    await expect(registration).toContainText(/年/);
  });

  test("review decisions: mandatory note/reason and the invalidate warning", async ({
    page,
  }) => {
    await page.goto(`${BASE_URL}/teacher/reviews`);
    const firstRow = page.locator(".review-item").first();
    await expect(firstRow).toBeVisible();
    // §12.4 UI list fields on the row: platform/keyword pair + locked tier.
    await expect(firstRow.locator(".review-pair")).toBeVisible();
    await expect(firstRow.locator(".review-tier")).toContainText(/积分|未锁定/);

    await firstRow.click();
    await expect(page.getByRole("heading", { name: "审核提交", exact: true })).toBeVisible();

    // 退回修改: a blank note is refused client-side (transport mirror).
    await page.getByRole("button", { name: "退回修改" }).click();
    await page.getByRole("button", { name: "确认退回" }).click();
    await expect(page.getByText("退回说明不能为空")).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();

    // 判无效: the prominent warning renders BEFORE the mandatory reason.
    await page.getByRole("button", { name: "判无效", exact: true }).click();
    await expect(page.getByText(/判无效会取消锁定的奖励与积分/)).toBeVisible();
    await page.getByRole("button", { name: "确认判无效" }).click();
    await expect(page.getByText("判无效原因不能为空")).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();

    // 通过 shows the explicit grant confirm.
    await page.getByRole("button", { name: "通过并发放奖励" }).click();
    await expect(page.getByText(/该领取将标记完成/)).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();
  });

  test("final teacher metadata keeps time inline and names the machine report", async ({ page }) => {
    for (const width of [390, 800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/teacher/reviews`);
      const row=page.locator('.review-item').first(); await expect(row).toBeVisible();
      const state=(await row.locator('.review-item-meta > span').first().boundingBox())!, time=(await row.locator('.review-item-meta time').boundingBox())!;
      expect.soft(Math.abs(state.y-time.y), `State metadata and timestamp stay inline at ${width}`).toBeLessThan(4);
    }
    await page.locator('.review-item').first().click();
    await expect.soft(page.getByRole('heading', {name:'机器校验报告',exact:true})).toBeVisible();
    await expect.soft(page.getByText('机器校验仅检查文件与数据格式；内容质量由人工核对。', {exact:true})).toBeVisible();
  });

  test("final teacher task refinement groups rarity with its task title", async ({ page }) => {
    await page.goto(`${BASE_URL}/teacher/tasks`);
    const first=page.getByRole('table', { name: '我的任务（含协作）' }).locator('tbody tr').first();
    await expect(first).toBeVisible();
    await expect(first.locator('td').first().locator('.rarity-badge')).toHaveCount(1);
    await expect(first.locator('td').nth(2)).toContainText('积分');
    await expect(first.locator('td').nth(2).locator('.rarity-badge')).toHaveCount(0);
  });

  test("final teacher queue refinement removes duplicate state badges", async ({page})=>{
    await page.goto(`${BASE_URL}/teacher/reviews`);
    const row=page.locator('.review-item').first();await expect(row).toBeVisible();
    const pending=await row.locator('.badge').allTextContents();
    expect(pending.filter(label=>label==='待审核'),'The same state is presented once').toHaveLength(1);
  });

  test("approved teacher composition: phone queue return, centered state, task context and native fields", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const failures: string[] = [];
    let governanceTaskId: string | undefined;
    const governanceContent = "模拟教师治理检查：这条匿名评论用于核对权限与删除后历史。";
    const check = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
    async function capture(name: string, width: number) {
      await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif}' });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations ?? 1)).map(a => a.finished.catch(() => {}))); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${width}: horizontal overflow`);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true, animations: "disabled" });
    }
    async function natural(control: import("@playwright/test").Locator, name: string, width: number) {
      await control.focus();
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
      await expect(control).toBeFocused(); const box = await control.boundingBox();
      const clearance = await readControlClearance(control);
      check(clearance.ring > 0 && clearance.full && clearance.hit, `${name}/${width}: complete44px target and keyboard focus ring ${JSON.stringify(clearance)}`);
      check(Boolean(box && box.width >= 44 && box.height >= 44), `${name}/${width}: target smaller than44`);
      check(await control.evaluate(el => { const b = el.getBoundingClientRect(), n = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return n === el || el.contains(n); }), `${name}/${width}: target covered`);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-natural.png`), animations: "disabled" });
    }
    for (const width of [320, 390, 800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/teacher/reviews`);
      const first = page.locator(".review-item").first(); await expect(first).toBeVisible();
      await capture("teacher-reviews", width);
      const font = await page.getByRole("heading", { level: 1 }).evaluate(el => getComputedStyle(el).fontSize);
      check(font === (width === 320 ? "27px" : width === 390 ? "29px" : width === 800 ? "32px" : "34px"), `review/${width}: title ${font}`);
      await first.focus(); await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { name: "审核提交", exact: true })).toBeVisible();
      if (width < 640) await expect(page.getByRole("button", { name: "返回待审核队列", exact: true })).toBeFocused();
      else await expect(first).toBeFocused();
      const composition = await page.locator(".review-layout").evaluate(el => {
        const s = getComputedStyle(el), d = getComputedStyle(el, "::before"), queue = el.querySelector(".review-queue")!;
        return { columns: s.gridTemplateColumns, gap: s.columnGap, divider: d.display, dividerWidth: d.width, queueVisible: queue.getClientRects().length > 0 };
      });
      check(composition.queueVisible === (width >= 640), `review/${width}: selected queue visibility ${composition.queueVisible}`);
      check(width < 640 ? composition.divider === "none" : composition.divider !== "none" && composition.dividerWidth === "2px", `review/${width}: divider ${JSON.stringify(composition)}`);
      if (width >= 640) {
        check(await page.locator(".review-queue h2").evaluate(el => el.getBoundingClientRect().width > 44), `review/${width}: queue heading visually hidden`);
        const columns = composition.columns.split(" ").map(parseFloat);
        check(columns.length === 2 && columns[1] > columns[0], `review/${width}: independent panes ${composition.columns}`);
        check(composition.gap === (width === 800 ? "20px" : "28px"), `review/${width}: gutter ${composition.gap}`);
      }
      const pageRhythm = await page.getByRole("main").evaluate(el => getComputedStyle(el).rowGap);
      check(pageRhythm === "0px", `review/${width}: duplicate page grid gap ${pageRhythm}`);
      if (width >= 640) check(await page.locator(".review-actions .btn").first().evaluate(el => getComputedStyle(el).flexGrow === "0"), `review/${width}: decision buttons stretched`);
      if (width === 320) {
        const actions = await page.locator('.review-actions .btn').evaluateAll(nodes => nodes.map(el => ({ top: Math.round(el.getBoundingClientRect().top), font: getComputedStyle(el).fontSize })));
        check(actions.length === 3 && new Set(actions.map(a => a.top)).size === 1 && actions.every(a => a.font === '13px'), `review/${width}: source three actions in one row ${JSON.stringify(actions)}`);
      }
      const back = page.getByRole("button", { name: "返回待审核队列", exact: true });
      check(await back.count() === (width < 640 ? 1 : 0), `review/${width}: phone return visibility`);
      await capture("teacher-review-detail", width);
      for (const [label, title] of [["通过并发放奖励", "通过该提交"], ["退回修改", "退回修改"], ["判无效", "判无效（取消奖励锁定）"]]) {
        const action = page.locator(".review-detail").getByRole("button", { name: label, exact: true });
        await natural(action, `teacher-review-${label}`, width); await action.click();
        await expect(page.getByRole("dialog", { name: title, exact: true })).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`teacher-review-${label}-${width}-dialog.png`), animations: "disabled" });
        await page.keyboard.press("Escape"); await expect(page.getByRole("dialog", { name: title, exact: true })).toHaveCount(0);
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        check(await action.evaluate(el => document.activeElement === el), `${label}/${width}: Escape did not return focus`);
      }
      if (width < 640 && await back.count()) {
        await natural(back, "teacher-review-return", width);
        await back.press("Enter"); await expect(first).toBeVisible(); await expect(first).toBeFocused();
      }
      await page.goto(`${BASE_URL}/teacher/tasks`);
      const table = page.getByRole("table", { name: "我的任务（含协作）" }); await expect(table.locator("tbody").getByRole("row").first()).toBeVisible();
      const rarityTags = await table.locator('.rarity-badge').evaluateAll(nodes => nodes.map(el => { const s = getComputedStyle(el); return { font: s.fontSize, weight: s.fontWeight, radius: s.borderRadius }; }));
      check(rarityTags.length > 0 && rarityTags.every(s => s.font === '11px' && s.weight === '400' && s.radius === '3px'), `tasks/${width}: source quiet rectangular rarity labels ${JSON.stringify(rarityTags)}`);
      const outer = await table.locator("..").evaluate(el => { const s = getComputedStyle(el); return { radius: s.borderRadius, border: s.borderTopWidth }; });
      check(outer.radius === "0px" && outer.border === "0px", `tasks/${width}: outer card remains ${JSON.stringify(outer)}`);
      const titleAndCreate = await page.evaluate(() => { const h = document.querySelector("h1")!.getBoundingClientRect(), b = document.querySelector(".campus-teacher-tasks > .section-head button")!.getBoundingClientRect(); return { headingTop: h.y, buttonTop: b.y }; });
      check(Math.abs(titleAndCreate.headingTop - titleAndCreate.buttonTop) <= 8, `tasks/${width}: create action detached from page title ${JSON.stringify(titleAndCreate)}`);
      const axes = await table.evaluate(el => { const header = el.querySelectorAll("th")[1], cell = el.querySelector("tbody tr")!.querySelectorAll("td")[1]; return { header: getComputedStyle(header).textAlign, cell: getComputedStyle(cell).textAlign }; });
      if (width >= 640) check(axes.header === "center" && axes.cell === "center", `tasks/${width}: state axes ${JSON.stringify(axes)}`);
      await capture("teacher-tasks", width);
      await page.getByRole("button", { name: "新建任务", exact: true }).first().click();
      const form = page.getByRole("dialog", { name: "新建任务", exact: true }); await expect(form).toBeVisible();
      const fieldFont = await form.getByLabel("任务标题", { exact: true }).evaluate(el => getComputedStyle(el).fontSize);
      check(fieldFont === "14px", `editor/${width}: native field font ${fieldFont}`);
      for (const name of ["基本资料", "奖励与时限", "文件与校验规则"]) check(await form.getByRole("heading", { name, exact: true }).count() === 1, `editor/${width}: missing ${name}`);
      check(await form.locator('.identity-option input[type="checkbox"]').first().evaluate(el => getComputedStyle(el).opacity === "1" && getComputedStyle(el).position === "static"), `editor/${width}: native file checkbox hidden`);
      check(await form.getByLabel("固定截止前停止领取（分钟）", { exact: true }).count() === 1, `editor/${width}: incorrect cutoff meaning`);
      const fieldOrder = await form.locator("label").evaluateAll(nodes => nodes.map(n => (n as HTMLLabelElement).htmlFor));
      check(fieldOrder.indexOf("task-deadline-mode") < fieldOrder.indexOf("task-deadline") && fieldOrder.indexOf("task-deadline") < fieldOrder.indexOf("task-cutoff"), `editor/${width}: deadline fields differ from source order`);
      await capture("teacher-task-editor", width);
      for (const name of ["基本资料", "奖励与时限", "文件与校验规则"]) {
        const section = form.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) });
        await section.scrollIntoViewIfNeeded(); await section.screenshot({ path: testInfo.outputPath(`teacher-editor-${name}-${width}.png`), animations: "disabled" });
      }
      await page.keyboard.press("Escape");
      await expect(form).toHaveCount(0);
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      check(await page.getByRole("button", { name: "新建任务", exact: true }).first().evaluate(el => document.activeElement === el), `create/${width}: Escape did not return focus`);
      const published = table.locator("tbody tr").filter({ has: page.getByText("已发布", { exact: true }) }).first(); await expect(published).toBeVisible();
      await published.getByRole("link").click(); await expect(page).toHaveURL(/\/teacher\/tasks\/.+/);
      await expect(page.getByRole("region", { name: "任务配置", exact: true })).toBeVisible();
      const detailRarity = await page.locator('.rarity-badge').evaluate(el => { const s = getComputedStyle(el); return { font: s.fontSize, weight: s.fontWeight, radius: s.borderRadius }; });
      check(detailRarity.font === '11px' && detailRarity.weight === '400' && detailRarity.radius === '3px', `task/${width}: source quiet rectangular rarity label ${JSON.stringify(detailRarity)}`);
      if (!governanceTaskId) {
        governanceTaskId = new URL(page.url()).pathname.split("/").at(-1)!;
        const seeded = await page.request.post(`${API_URL}/tasks/${governanceTaskId}/comments`, { headers: { Authorization: `Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}` }, data: { content: governanceContent, is_anonymous: true } });
        expect(seeded.status(), await seeded.text()).toBe(201);
        await page.reload(); await expect(page.getByRole("region", { name: "任务配置", exact: true })).toBeVisible();
      }

      const stats = page.getByRole('region', { name: '任务统计', exact: true }).locator('.metric-row');
      await expect(stats.locator('.metric-value')).toHaveCount(5);
      const statStyle = await stats.evaluate(el => ({ top: getComputedStyle(el).borderTopStyle, bottom: getComputedStyle(el).borderBottomStyle,
        values: [...el.querySelectorAll('.metric-value')].map(value => getComputedStyle(value).fontSize), labels: [...el.querySelectorAll('.metric-label')].map(label => getComputedStyle(label).fontSize) }));
      check(statStyle.top === 'solid' && statStyle.bottom === 'solid' && statStyle.values.every(v => v === `${width < 640 ? 20 : 21}px`) && statStyle.labels.every(v => v === '12px'), `task/${width}: source compact ruled statistics ${JSON.stringify(statStyle)}`);
      const navigation = page.getByRole("navigation", { name: "任务管理章节", exact: true });
      check(await navigation.count() === 1, `task/${width}: missing context navigation`);
      check(await page.getByRole("link", { name: "返回任务管理", exact: true }).count() === 1, `task/${width}: missing real return`);
      check(!await page.getByRole("region", { name: "任务配置", exact: true }).getByText(/发布后.*分钟/).count(), `task/${width}: cutoff still described from publish time`);
      const collaborators = page.getByRole("region", { name: "协作者管理", exact: true });
      check(await collaborators.locator('input[type="checkbox"]').first().evaluate(el => getComputedStyle(el).opacity === "1" && getComputedStyle(el).position === "static"), `collaborators/${width}: native permission checkbox hidden`);
      const collaboratorColumns = await collaborators.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length);
      check(collaboratorColumns === (width >= 640 ? 2 : 1), `collaborators/${width}: independent field columns ${collaboratorColumns}`);
      check(await collaborators.locator(".dialog-actions .btn").first().evaluate(el => getComputedStyle(el).flexGrow === "0"), `collaborators/${width}: authorization actions stretched`);
      await capture("teacher-task", width);
      for (const [label, title] of [["编辑", "编辑任务"], ["关闭任务", "关闭任务"]]) {
        const action = page.getByRole("button", { name: label, exact: true }); await natural(action, `teacher-task-${label}`, width); await action.click();
        const dialog = page.getByRole("dialog", { name: title, exact: true }); await expect(dialog).toBeVisible();
        if (label === "编辑") { await expect(dialog.getByLabel("基础奖励积分", { exact: true })).toBeDisabled(); await expect(dialog.getByLabel("任务标题", { exact: true })).toBeEnabled(); }
        if (label === "关闭任务") await expect(dialog).toContainText("已有领取继续");
        await page.screenshot({ path: testInfo.outputPath(`teacher-task-${label}-${width}-dialog.png`), animations: "disabled" });
        await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        check(await action.evaluate(el => document.activeElement === el), `${label}/${width}: Escape did not return focus`);
      }
      const community = page.getByRole("region", { name: "社区与举报", exact: true }); await expect(community).toBeVisible();
      await expect(community.locator(".skeleton")).toHaveCount(0);
      const communityDivider = await community.locator(".workbench-columns, .cq-divided-sections").evaluate(el => { const d = getComputedStyle(el, "::before"); return { display: d.display, width: d.width }; });
      check(width < 640 ? communityDivider.display === "none" : communityDivider.display !== "none" && communityDivider.width === "2px", `community/${width}: independent rule ${JSON.stringify(communityDivider)}`);
      await expect(community.getByRole("button", { name: /揭示/ })).toHaveCount(0);
      await capture("teacher-community", width);
      await community.locator(".workbench-columns").screenshot({ path: testInfo.outputPath(`teacher-community-panes-${width}.png`), animations: "disabled" });
    }
    const comments = page.getByRole("region", { name: "评论管理列表", exact: true });
    const governed = comments.getByRole("listitem").filter({ hasText: governanceContent }); await expect(governed).toHaveCount(1);
    await expect(governed.getByRole("button", { name: "揭示身份", exact: true })).toHaveCount(0);
    const pseudonym = await governed.locator(".moderation-key").innerText();
    await governed.getByRole("button", { name: "删除评论", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "删除评论", exact: true });
    await deletion.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(deletion).toContainText("删除原因必填（将记入审计日志）");
    await deletion.getByLabel("删除原因", { exact: true }).fill("模拟治理检查完成，按原权限删除并保留历史。");
    await deletion.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(comments).toBeFocused();
    const history = comments.getByRole("listitem").filter({ hasText: governanceContent }).filter({ hasText: pseudonym });
    await expect(history).toHaveAttribute("data-deleted", "true");
    await expect(history.locator(".badge-warning")).toHaveText("已删除");
    await expect(history.locator(".comment-content")).toContainText(governanceContent);
    await expect(history.locator(".comment-author")).toHaveText("匿名用户");
    await page.goto(`${BASE_URL}/teacher/reviews`);
    await page.locator(".review-item").first().click();
    await page.getByRole("button", { name: "退回修改", exact: true }).click();
    const revision = page.getByRole("dialog", { name: "退回修改", exact: true });
    await revision.getByLabel("退回说明（必填，学生会看到）", { exact: true }).fill("模拟审核检查：请补充资料来源并重新核对关键词。");
    await revision.getByRole("button", { name: "确认退回", exact: true }).click();
    const outcome = page.getByRole("region", { name: "任务审核处理结果", exact: true });
    await expect(outcome).toContainText("已退回修改"); await expect(outcome).toBeFocused();
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
