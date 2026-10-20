/**
 * CampusQuest admin workspace e2e — Plan 09 Task 10, wired to the
 * runner and seeded for real by Plan 10's world (PR #6 final review:
 * the CQ_E2E_TEACHER/CQ_E2E_ADMIN contracts below are the
 * browser_world exports, so every test RUNS under the gate — the
 * release gate asserts this suite at zero skips).
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
 * - CQ_E2E_TEACHER          pre-seeded TEACHER credentials
 *                           "email:password" + CQ_E2E_TEACHER_TOTP_SECRET
 *                           (the step-1 privilege negative: a teacher
 *                           opening /admin/* gets guidance and ZERO
 *                           admin API calls);
 * - CQ_E2E_ADMIN            pre-seeded ADMIN credentials
 *                           "email:password" + CQ_E2E_ADMIN_TOTP_SECRET
 *                           (the operational flows: the world seeds
 *                           the pending redemption, the suspend-target
 *                           student, and the review-queue row).
 *
 * Brief flow: privilege navigation (teacher denied on /admin/approvals,
 * no admin data request fires), user suspend, redemption decisions,
 * user suspend with mandatory reason, redemption decisions, and the
 * settings confirm dialog.
 */
import { randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page, type Response } from "@playwright/test";

import { staffLogin } from "./fixtures";

const E2E_ENABLED = process.env.CQ_E2E === "1";
const BASE_URL = process.env.CQ_E2E_BASE_URL ?? "https://localhost:3000";
const TEACHER = process.env.CQ_E2E_TEACHER;
const TEACHER_TOTP_SECRET = process.env.CQ_E2E_TEACHER_TOTP_SECRET;
const ADMIN = process.env.CQ_E2E_ADMIN;
const ADMIN_TOTP_SECRET = process.env.CQ_E2E_ADMIN_TOTP_SECRET;
// The seeded item name is run-derived (factories: 端到端奖励卡 +
// run[:6]) — the redemption queue's business key (see the redemption
// test).
const RUN = process.env.CQ_E2E_RUN;

test.skip(
  !E2E_ENABLED,
  "set CQ_E2E=1 (and the CQ_E2E_* vars) to run this suite.",
);

// The staff contract itself is a HARD requirement now (PR #6 final
// review): the world always provides it, and a missing export must
// fail the suite — never read as a skip the gate would have to catch.

/** Preserve the shared response-acknowledged unified login contract. */
const loginAsStaff = staffLogin;

test("approved administrator login acknowledgement is not resubmitted while the landing route loads", async ({page}) => {
  // Real login response and real destination, with only navigation latency held.
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  let accepted=0, timer:ReturnType<typeof setTimeout>|undefined;
  page.on('response', response=>{
    if(response.request().method()==='POST' && new URL(response.url()).pathname==='/api/v1/auth/challenge/totp' && response.ok()) {
      accepted+=1;
      if(accepted===1) timer=setTimeout(release,6500);
    }
  });
  await page.route('**/admin**',async route=>{if(new URL(route.request().url()).pathname==='/admin')await held;await route.continue();});
  try {
    await loginAsStaff(page,ADMIN!,ADMIN_TOTP_SECRET!);
    expect(accepted,'A successful login must not be submitted again while its landing route loads').toBe(1);
    await expect(page).not.toHaveURL(/\/login/);
  } finally {
    release();if(timer)clearTimeout(timer);await page.unrouteAll({behavior:'wait'});
  }
});

// Exercise a genuine login; the serial operations group deliberately resumes
// at /admin/users and cannot serve as a new-login landing assertion.
test("an admin login lands on the admin workspace, not the teacher cockpit", async ({ page }) => {
  await loginAsStaff(page, ADMIN!, ADMIN_TOTP_SECRET!);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "管理台概览", exact: true })).toBeVisible();
});

test.describe("admin workspace privilege navigation (plan step 1)", () => {
  test("a teacher opening /admin/approvals gets guidance and ZERO admin API calls", async ({
    page,
  }) => {
    await loginAsStaff(page, TEACHER!, TEACHER_TOTP_SECRET!);

    // Arm the recorder BEFORE the first /admin navigation: the gate must
    // keep every admin data request from firing (the shell renders only
    // the guidance panel, never the pages).
    const adminRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/v1/admin/")) {
        adminRequests.push(request.url());
      }
    });

    await page.goto(`${BASE_URL}/admin/approvals`);
    await expect(page.getByText("管理后台仅对管理员开放，当前账号是教师账号")).toBeVisible();
    await expect(page.getByRole("link", { name: "返回教师工作台" })).toBeVisible();
    // No admin data rendered and no admin API call fired.
    await expect(page.getByRole("table")).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(adminRequests, "no /admin API request may fire for a teacher session").toEqual([]);
  });
});

test.describe("admin workspace operations (brief: users / redemptions / settings)", () => {
  // This serial workflow exercises operations, not nine independent logins.
  // Carry only the latest real rotating cookies between fresh contexts; the
  // response-acknowledged login and session rotation remain real requests.
  let adminCookies: Awaited<ReturnType<BrowserContext["cookies"]>> | undefined;
  let successfulLogins = 0;
  const authenticatedContexts = new WeakSet<BrowserContext>();
  test.beforeEach(async ({ page }) => {
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/v1/auth/challenge/totp" && response.ok()) successfulLogins += 1;
    });
    if (adminCookies) {
      await page.context().addCookies(adminCookies);
      const meResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/me" && response.ok());
      await page.goto(`${BASE_URL}/admin/users`);
      const me = await (await meResponse).json();
      expect(me.username).toBe(ADMIN!.split(":")[0]);
      expect(me.role).toBe("ADMIN");
    } else {
      await loginAsStaff(page, ADMIN!, ADMIN_TOTP_SECRET!);
    }
    authenticatedContexts.add(page.context());
  });
  test.afterEach(async ({ page }) => {
    if (authenticatedContexts.has(page.context())) adminCookies = await page.context().cookies();
  });
  test.afterAll(() => {
    expect(successfulLogins, "serial operations reuse one genuine authenticated admin session").toBe(1);
  });

  test("approved account filters: clear restores both selectors and the unfiltered server page", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`);
    const role = page.getByRole("combobox", { name: "角色筛选", exact: true });
    const status = page.getByRole("combobox", { name: "状态筛选", exact: true });
    const clear = page.getByRole("button", { name: "清空", exact: true });
    await expect(clear).toBeVisible();
    await role.selectOption("TEACHER");
    const filtered = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/admin/users" && url.searchParams.get("role") === "TEACHER" && url.searchParams.get("status") === "SUSPENDED" && response.ok();
    });
    await status.selectOption("SUSPENDED");
    expect((await (await filtered).json()).items).toEqual([]);
    await expect(page.getByText("没有符合条件的账号", { exact: true })).toBeVisible();
    const restored = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/admin/users" && !url.searchParams.has("role") && !url.searchParams.has("status") && (!url.searchParams.has("offset") || url.searchParams.get("offset") === "0") && response.ok();
    });
    await clear.press("Enter");
    expect((await (await restored).json()).items.length).toBeGreaterThan(0);
    await expect(role).toHaveValue(""); await expect(status).toHaveValue("");
    await expect(page.getByRole("table", { name: "账号列表" }).locator("tbody tr").first()).toBeVisible();
    await expect(clear).toBeFocused();
  });

  test("reward review authorization: one source form retains target and dispatches grant and revoke", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await expect(page.getByRole("table", { name: "账号列表" }).locator("tbody tr").first()).toBeVisible();
    const directoryResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/admin/users" && response.ok());
    await page.getByRole("button", { name: "筛选", exact: true }).click();
    const directory = await directoryResponse;
    const target = (await directory.json()).items.find((user: { username: string }) => user.username === TEACHER!.split(":")[0]);
    expect(target?.role).toBe("TEACHER");
    let authorization = directory.request().headers().authorization;
    expect(authorization).toBeTruthy();
    const readStanding = async () => {
      const response = await page.request.get(`${BASE_URL}/api/v1/admin/reward-review-grants?limit=50`, { headers: { Authorization: authorization } });
      expect(response.status()).toBe(200);
      return (await response.json()).items.some((grant: { teacher_id: string }) => grant.teacher_id === target.id);
    };
    expect(await readStanding()).toBe(false);
    await page.goto(`${BASE_URL}/admin/rewards`);
    const workspace = page.getByRole("region", { name: "审阅授权管理", exact: true });
    const operation = workspace.getByRole("combobox", { name: "授权操作", exact: true });
    await expect(operation).toBeVisible();
    const teacher = workspace.getByRole("textbox", { name: "教师用户 ID", exact: true });
    const reason = workspace.getByRole("textbox", { name: "操作原因", exact: true });
    const confirm = workspace.getByRole("button", { name: "确认操作", exact: true });
    for (const width of [320, 390, 639, 640, 800, 1023, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const geometry = await workspace.evaluate(region => {
        const form = region.querySelector("form")!;
        const style = getComputedStyle(form);
        const id = form.querySelector("input")!.getBoundingClientRect();
        const mode = form.querySelector("select")!.getBoundingClientRect();
        return { forms: region.querySelectorAll("form").length, available: region.getBoundingClientRect().width,
          width: form.getBoundingClientRect().width, border: style.borderTopWidth, background: style.backgroundColor,
          sameRow: Math.abs(id.top - mode.top) < 1, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(geometry.forms).toBe(1);
      expect(Math.abs(geometry.width - Math.min(850, geometry.available))).toBeLessThanOrEqual(1);
      expect(geometry.border).toBe("0px");
      expect(geometry.background).toBe("rgba(0, 0, 0, 0)");
      expect(geometry.sameRow).toBe(width >= 640);
      expect(geometry.overflow).toBe(false);
      await page.screenshot({ path: testInfo.outputPath(`admin-review-authorization-${width}.png`), fullPage: true });
    }
    await teacher.fill(target.id);
    await confirm.click();
    await expect(workspace.getByText("操作原因必填（将记入审计日志）", { exact: true })).toBeVisible();
    await reason.fill("  模拟授权：核对同一目标和服务端状态  ");
    await operation.selectOption("revoke");
    await expect(teacher).toHaveValue(target.id);
    await expect(reason).toHaveValue("  模拟授权：核对同一目标和服务端状态  ");
    await operation.selectOption("grant");
    let releaseGrant!: () => void;
    const grantHold = new Promise<void>(resolve => { releaseGrant = resolve; });
    await page.route("**/api/v1/admin/reward-review-grants", async route => {
      if (route.request().method() === "POST") await grantHold;
      await route.continue();
    });
    const grantRequest = page.waitForRequest(request => request.method() === "POST" && new URL(request.url()).pathname === "/api/v1/admin/reward-review-grants");
    const grantResponse = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/admin/reward-review-grants");
    await confirm.click();
    try {
      const request = await grantRequest;
      expect(request.postDataJSON()).toEqual({ teacher_id: target.id, reason: "模拟授权：核对同一目标和服务端状态" });
      await expect(operation).toBeDisabled(); await expect(teacher).toBeDisabled(); await expect(reason).toBeDisabled();
    } finally { releaseGrant(); }
    const granted = await grantResponse;
    expect(granted.status()).toBe(204);
    authorization = granted.request().headers().authorization;
    await expect(workspace.getByRole("status")).toContainText("已授予审阅权限。");
    expect(await readStanding()).toBe(true);
    await page.unroute("**/api/v1/admin/reward-review-grants");
    await workspace.getByRole("button", { name: "再操作一次", exact: true }).click();
    await teacher.fill(target.id); await reason.fill("  模拟撤销：核对授权实际移除  ");
    await operation.selectOption("revoke");
    const revoked = page.waitForResponse(response => response.request().method() === "DELETE" && new URL(response.url()).pathname === `/api/v1/admin/reward-review-grants/${target.id}`);
    await confirm.press("Enter");
    const response = await revoked;
    expect(new URL(response.url()).searchParams.get("reason")).toBe("模拟撤销：核对授权实际移除");
    expect(response.status()).toBe(204);
    authorization = response.request().headers().authorization;
    await expect(workspace.getByRole("status")).toContainText("已撤销审阅权限。");
    expect(await readStanding()).toBe(false);
  });

  test("final administrator metadata keeps time in the applicant row", async ({ page }) => {
    for (const width of [390, 800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}/admin/redemptions`);
      const row=page.locator('.review-item').first(); await expect(row).toBeVisible();
      const actor=(await row.locator('.review-item-meta > span').first().boundingBox())!, time=(await row.locator('.review-item-meta time').boundingBox())!;
      expect.soft(Math.abs(actor.y-time.y), `Applicant and timestamp remain inline at ${width}`).toBeLessThan(4);
    }
  });

  test("final administrator audit refinement keeps concise labels and exact-match guidance", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/audit`);
    await expect(page.locator('label[for="audit-filter-action"]')).toHaveText('操作名');
    await expect(page.locator('label[for="audit-filter-target"]')).toHaveText('目标类型');
    await expect(page.getByLabel('操作名（如 USER_SUSPENDED）', { exact: true })).toHaveAccessibleDescription(/精确匹配/);
  });

  test("final administrator queue refinement follows source title and amount row", async ({page})=>{
    for(const width of [390,1440]){
      await page.setViewportSize({width,height:900});
      await page.goto(`${BASE_URL}/admin/redemptions`);
      const row=page.locator('.review-item').first();await expect(row).toBeVisible();
      const title=(await row.locator('.review-item-title').boundingBox())!, amount=(await row.locator('.review-tier').boundingBox())!;
      expect(Math.abs(title.y-amount.y),'Approved reward name and amount share their row').toBeLessThan(3);
      expect(amount.x).toBeGreaterThan(title.x+title.width);
    }
  });

  test("approved administrator composition: eight current families at four widths and native dialog return", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    page.setDefaultTimeout(12_000);
    const differences: string[] = [];
    const focusSettlements: { name: string; width: number; immediate: boolean; settled: boolean }[] = [];
    const routes = ["users", "innovation-operations", "owner-qualifications", "approvals", "rewards", "redemptions", "audit", "system"];
    const check = (ok: boolean, label: string) => { if (!ok) differences.push(label); };
    const checkFocus = async (control: ReturnType<Page["getByRole"]>, name: string, width: number) => {
      const immediate = await control.evaluate((el) => el === document.activeElement);
      // Radix FocusScope schedules onUnmountAutoFocus with setTimeout(0).
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      const settled = await control.evaluate((el) => el === document.activeElement);
      focusSettlements.push({ name, width, immediate, settled });
      check(settled, `${name}@${width} Escape return`);
    };
    // The upstream approval queue replaces the retired whitelist UI.
    // Real register/approve/reject business journeys live in auth-extension-2;
    // this layout pass preserves the current queue's honest empty state.
    for (const width of [320, 390, 640, 800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(`${BASE_URL}/admin/${route}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("main .skeleton")).toHaveCount(0);
        if (route === "redemptions") {
          await page.locator(".review-item").first().click();
          await expect(page.locator(".review-detail")).toBeVisible();
        }
        await page.evaluate(async () => { await document.fonts.ready; });
        const metrics = await page.locator("main").evaluate((main) => {
          const heading = main.querySelector("h1")!;
          const visible = (e: Element) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
          const tables = Array.from(main.querySelectorAll("table")).filter(visible);
          const header = document.querySelector(".app-topbar")!.getBoundingClientRect();
          const brand = document.querySelector(".app-topbar .app-brand")!;
          const inkCanvas = document.createElement("canvas").getContext("2d")!;
          inkCanvas.fillStyle = getComputedStyle(heading).color;
          inkCanvas.fillRect(0, 0, 1, 1);
          return {
            headerHeight: Math.round(header.height),
            brandHeight: brand.getBoundingClientRect().height,
            brandWrap: getComputedStyle(brand).whiteSpace,
            railWidth: Math.round(document.querySelector(".app-sidebar")!.getBoundingClientRect().width),
            bodyFont: getComputedStyle(document.body).fontSize,
            headingInk: Array.from(inkCanvas.getImageData(0, 0, 1, 1).data).slice(0, 3).join(","),
            title: getComputedStyle(heading).fontSize,
            display: getComputedStyle(heading).fontFamily,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            tables: tables.map((table) => ({
              name: table.getAttribute("aria-label"),
              width: table.getBoundingClientRect().width,
              columns: Array.from(table.querySelectorAll("thead th")).map(cell => cell.getBoundingClientRect().width),
              head: (() => {
                const cell = table.querySelector("th"); if (!cell) return null;
                const style = getComputedStyle(cell);
                inkCanvas.clearRect(0, 0, 1, 1); inkCanvas.fillStyle = style.backgroundColor; inkCanvas.fillRect(0, 0, 1, 1);
                return { padding: style.padding, line: parseFloat(style.lineHeight), background: [...inkCanvas.getImageData(0, 0, 1, 1).data].join(",") };
              })(),
              record: (() => {
                const row = table.querySelector("tbody tr"); if (!row) return null;
                const style = getComputedStyle(row);
                return { rowGap: parseFloat(style.rowGap), columnGap: parseFloat(style.columnGap), blockPadding: parseFloat(style.paddingTop) };
              })(),
              primaryFont: (() => {
                const cell = table.querySelector(table.getAttribute("aria-label") === "账号列表" ? 'tbody tr td[data-label="学号 / 用户名"]' : "tbody tr td:first-child");
                return cell ? getComputedStyle(cell.querySelector("time") ?? cell).fontSize : null;
              })(),
              scrolls: table.scrollWidth > innerWidth,
              cells: Array.from(table.querySelectorAll("tbody td")).map((cell) => ({
                label: cell.getAttribute("data-label"),
                block: getComputedStyle(cell).display,
              })),
              states: Array.from(table.querySelectorAll("thead th")).flatMap((th, column) =>
                th.textContent?.trim() === "状态" ? [getComputedStyle(th).textAlign, ...Array.from(table.querySelectorAll("tbody tr")).map((row) => getComputedStyle(row.children[column]).textAlign)] : []),
            })),
            fields: Array.from(main.querySelectorAll(".input,.field-label")).filter(visible).map((e) => ({
              font: getComputedStyle(e).fontSize,
              label: e.classList.contains("field-label"),
              compact: e.id === "operations-account" || e.getAttribute("for") === "operations-account" || e.closest('[data-admin-return="users"] .campus-admin-filter') !== null,
              audit: e.closest(".campus-admin-audit-filter") !== null,
              snapshotLabel: e.matches('[aria-label="负责人资格申请详情"] dt'),
            })),
            settingsDisclosures: main.querySelectorAll(".campus-admin-setting-editor:not([open])").length,
            settingsColumns: Array.from(main.querySelectorAll(".campus-admin-setting-row")).map((row) => ({
              row: row.getBoundingClientRect().width,
              heading: row.querySelector(":scope > .section-title")!.getBoundingClientRect().width,
              value: row.querySelector(":scope > .fact-rows")!.getBoundingClientRect().width,
              hint: row.querySelector(":scope > .campus-admin-setting-hint")!.getBoundingClientRect().width,
            })),
            redemptionConsequences: (() => {
              const detail = main.querySelector(".review-detail");
              const actions = detail?.querySelector(".review-actions"), note = detail?.querySelector('[role="note"]');
              return !!actions && !!note && actions.getBoundingClientRect().bottom <= note.getBoundingClientRect().top && note.textContent?.includes("冻结") && note.textContent?.includes("拒绝");
            })(),
            redundantHeadings: Array.from(main.querySelectorAll("h2")).map((el) => el.textContent?.trim()),
            accountRefreshInFilter: main.querySelector('[data-admin-return="users"] form button') !== null,
            auditFields: ["audit-filter-action", "audit-filter-actor", "audit-filter-target"].map((id) => {
              const el = main.querySelector(`#${id}`);
              return el ? { top: el.getBoundingClientRect().top, left: el.getBoundingClientRect().left } : null;
            }),
            settingsNavigationRows: new Set(Array.from(main.querySelectorAll('.campus-admin-nav a')).map((el) => Math.round(el.getBoundingClientRect().top))).size,
            settingsNavigationPlain: Array.from(main.querySelectorAll('.campus-admin-nav a')).every((el) => getComputedStyle(el).textDecorationLine === 'none'),
            workspaceCaption: document.querySelector('.app-sidebar-workspace')?.textContent,
            workspaceContext: document.querySelector('.app-context')?.textContent,
            roleTagVisible: (() => {
              const role = document.querySelector('.app-topbar .staff-role-tag'), owner = role?.closest('.app-user');
              if (!role || !owner) return false;
              const a = role.getBoundingClientRect(), b = owner.getBoundingClientRect();
              return a.width > 0 && a.right <= b.right + 1 && a.left >= b.left - 1;
            })(),
            sectionActionsFramed: Array.from(main.querySelectorAll('.section-head .btn-ghost')).every((el) => {
              const style = getComputedStyle(el, '::before'), canvas = document.createElement('canvas').getContext('2d')!;
              canvas.fillStyle = style.borderTopColor; canvas.fillRect(0, 0, 1, 1);
              return style.borderTopStyle === 'solid' && parseFloat(style.borderTopWidth) > 0 && canvas.getImageData(0, 0, 1, 1).data[3] === 255;
            }),
            secondarySourceInk: Array.from(main.querySelectorAll('.btn-secondary:not(:disabled)')).every(el => {
              const canvas = document.createElement('canvas').getContext('2d')!;
              canvas.fillStyle = getComputedStyle(el).color; canvas.fillRect(0, 0, 1, 1);
              return [...canvas.getImageData(0, 0, 1, 1).data].join(',') === '69,72,63,255';
            }),
            rewardHeadingFlow: (() => {
              const heading = main.querySelector('.page-head'), actions = main.querySelector('[data-admin-return="rewards"] > .section-head > .row-actions');
              if (!heading || !actions) return null;
              const h = heading.getBoundingClientRect(), a = actions.getBoundingClientRect(), subtitle = heading.querySelector('.page-subtitle')!.getBoundingClientRect();
              return { gap: a.top - subtitle.bottom, left: a.left - h.left, center: Math.abs(a.top + a.height / 2 - h.top - h.height / 2) };
            })(),
            settingsActionsOutlined: Array.from(main.querySelectorAll('.campus-admin-setting-editor > summary')).every((el) => getComputedStyle(el, "::before").borderTopStyle === "solid"),
            templatePairAligned: (() => {
              const event = main.querySelector('#template-event'), channel = main.querySelector('#template-channel');
              return !!event && !!channel && Math.abs(event.getBoundingClientRect().top - channel.getBoundingClientRect().top) < 1;
            })(),
          };
        });
        const prefix = `${route}@${width}`;
        check(metrics.headerHeight === (width < 640 ? 57 : width < 1024 ? 60 : 69), `${prefix} source shell height:${metrics.headerHeight}`);
        if (width < 1024) check(metrics.brandWrap === "nowrap" && metrics.brandHeight < 40, `${prefix} intrinsic horizontal brand:${metrics.brandHeight}/${metrics.brandWrap}`);
        else check(metrics.railWidth === 208, `${prefix} source administrator rail:${metrics.railWidth}`);
        if (width >= 1024) {
          check(metrics.workspaceCaption === '管理后台', `${prefix} source visible workspace caption:${metrics.workspaceCaption}`);
          check(metrics.roleTagVisible, `${prefix} role label must not be ellipsized with the real nickname`);
        }
        const contextTitle: Record<string, string> = { users: '用户与账户', 'innovation-operations': '双创运营授权', 'owner-qualifications': '负责人资格', approvals: '注册审批', rewards: '奖励目录', redemptions: '兑换审核', audit: '审计日志', system: '系统设置' };
        if (width >= 1024) check(metrics.workspaceContext === `管理后台 / ${contextTitle[route]}`, `${prefix} actual destination context:${metrics.workspaceContext}`);
        check(metrics.sectionActionsFramed, `${prefix} approved framed section actions`);
        check(metrics.secondarySourceInk, `${prefix} source body ink on enabled outlined actions`);
        if (route === 'rewards') {
          const flow = metrics.rewardHeadingFlow;
          check(!!flow && (width < 640 ? Math.abs(flow.gap - 27) < 1 && Math.abs(flow.left) < 1 : flow.center < 1), `${prefix} source native heading/action flow:${JSON.stringify(flow)}`);
        }
        check(metrics.bodyFont === "15px" && metrics.headingInk === "38,40,32", `${prefix} source body/heading hierarchy:${metrics.bodyFont}/${metrics.headingInk}`);
        check(metrics.title === `${width >= 1024 ? 34 : width >= 640 ? 32 : width >= 360 ? 29 : 27}px`, `${prefix} heading:${metrics.title}`);
        check(/Noto Serif|SimSun|Songti/.test(metrics.display), `${prefix} display font`);
        check(!metrics.overflow, `${prefix} document overflow`);
        // Actual approved-source measurements: audit inputs stay14px;
        // user/grant filter inputs13px on desktop, all filter labels12px.
        check(metrics.fields.every(field => field.font === `${field.snapshotLabel || (field.label && (field.compact || field.audit)) ? 12 : field.compact && width >= 640 ? 13 : 14}px`), `${prefix} source-context field typography:${JSON.stringify(metrics.fields)}`);
        if (route === "system") check(metrics.settingsDisclosures === 5, `${prefix} five parameter editors initially collapsed:${metrics.settingsDisclosures}`);
        if (route === "users") {
          check(!metrics.redundantHeadings.includes("账号目录"), `${prefix} source single heading`);
          check(metrics.accountRefreshInFilter, `${prefix} refresh aligned with filters`);
        }
        if (route === "audit") {
          check(!metrics.redundantHeadings.includes("审计日志"), `${prefix} source single heading`);
          const [action, actor, target] = metrics.auditFields;
          check(!!action && !!actor && !!target && Math.abs(actor.top - target.top) < 1 && (width >= 640 ? Math.abs(action.top - actor.top) < 1 : action.top < actor.top), `${prefix} source audit filter grouping`);
        }
        if (route === "system") {
          check(metrics.settingsNavigationRows === 1, `${prefix} compact section navigation`);
          check(metrics.settingsNavigationPlain, `${prefix} source plain local anchors`);
          check(metrics.settingsActionsOutlined, `${prefix} parameter outline actions`);
          if (width >= 640) check(metrics.templatePairAligned, `${prefix} event and channel field pair`);
          else check(metrics.settingsColumns.every((column) => column.heading >= column.row - 1 && column.value >= column.row * 0.4 && column.hint >= column.row * 0.4), `${prefix} readable paired parameter columns:${JSON.stringify(metrics.settingsColumns)}`);
        }
        if (route === "redemptions") check(!!metrics.redemptionConsequences, `${prefix} consequences attached below detail actions`);
        for (const table of metrics.tables) {
          check(table.head !== null && table.head.padding === "9px 10px" && Math.abs(table.head.line - 19.2) < 0.2 && table.head.background === "238,238,229,255", `${prefix}/${table.name} source header density:${JSON.stringify(table.head)}`);
          if (width >= 640) {
            const specified = new Map<number, number>();
            if (width >= 1024) {
              specified.set(table.columns.length - 1, table.width * 0.22);
              if (table.name === "账号列表") { specified.set(0, 64); specified.set(1, table.width * 0.15); specified.set(6, table.width * 0.12); specified.set(table.columns.length - 1, table.width * 0.18); }
              if (table.name === "奖励目录列表") { specified.set(0, table.width * 0.24); specified.set(table.columns.length - 1, table.width * 0.18); }
              if (table.name === "审计日志列表") { specified.set(1, table.width * 0.22); specified.set(table.columns.length - 1, table.width * 0.12); }
              if (table.name === "负责人资格申请列表") specified.set(0, table.width * 0.30);
            }
            const rest = (table.width - [...specified.values()].reduce((sum, value) => sum + value, 0)) / (table.columns.length - specified.size);
            check(table.columns.every((column, index) => Math.abs(column - (specified.get(index) ?? rest)) <= 1), `${prefix}/${table.name} source responsive columns:${JSON.stringify(table.columns)}`);
          }
          if (["users", "approvals", "audit"].includes(route) && table.primaryFont !== null) check(table.primaryFont === `${width < 640 ? 14 : 13}px`, `${prefix}/${table.name} source primary field typography:${table.primaryFont}`);
          if (width < 640) {
            const accountRows = table.name === "账号列表";
            if (table.record) check(Math.abs(table.record.rowGap - (accountRows ? 3 : 5)) < 0.2 && Math.abs(table.record.columnGap - (accountRows || width < 360 ? 10 : 14)) < 0.2 && Math.abs(table.record.blockPadding - (accountRows ? 9 : 10)) < 0.2, `${prefix}/${table.name} source record spacing:${JSON.stringify(table.record)}`);
            check(!table.scrolls, `${prefix}/${table.name} phone table scrolls`);
            check(table.cells.every((cell) => !!cell.label && cell.block !== "table-cell"), `${prefix}/${table.name} missing labelled phone records`);
          } else check(table.states.every((align) => align === "center"), `${prefix}/${table.name} status axis`);
        }

        if (route === "system" && width >= 640) {
          const columns = page.locator('.campus-admin-setting-columns');
          check(await columns.count() === 1, `${prefix} source parameter column headings missing`);
          check(JSON.stringify(await columns.locator(':scope > span').allTextContents()) === JSON.stringify(['参数', '当前值', '说明', '操作']), `${prefix} source parameter/current/description/action labels`);
          const columnGeometry = await columns.evaluate(node => ({ width: node.getBoundingClientRect().width, cells: [...node.children].map(cell => ({ width: cell.getBoundingClientRect().width, padding: getComputedStyle(cell).paddingInline })) }));
          const sourceFractions = width >= 1024 ? [0.26, 0.26, 0.26, 0.22] : [0.25, 0.25, 0.25, 0.25];
          check(columnGeometry.cells.length === 4 && columnGeometry.cells.every((cell, index) => Math.abs(cell.width - columnGeometry.width * sourceFractions[index]) <= 1 && cell.padding === "10px"), `${prefix} source setting columns:${JSON.stringify(columnGeometry)}`);
          const settingsValues = await page.locator('.campus-admin-setting-row > .fact-rows').evaluateAll(nodes => nodes.map(node => {
            const value = node.querySelector('.fact-value')!;
            return { start: node.getBoundingClientRect().left + parseFloat(getComputedStyle(node).paddingLeft), value: value.getBoundingClientRect().left, align: getComputedStyle(value).textAlign };
          }));
          check(settingsValues.length === 5 && settingsValues.every(value => Math.abs(value.start - value.value) <= 1 && value.align !== 'right'), `${prefix} compact start-aligned truthful settings:${JSON.stringify(settingsValues)}`);
        }
        await page.screenshot({ path: testInfo.outputPath(`admin-${route}-${width}.png`), fullPage: true });
      }
      await page.goto(`${BASE_URL}/admin/users`);
      const user = page.locator("tbody tr", { hasText: "e2e-suspended-student" });
      await expect(user).toBeVisible();
      const accountOpen = user.getByRole("button", { name: "停用", exact: true });
      await accountOpen.click();
      await expect(page.getByRole("dialog", { name: "停用账号" })).toBeVisible();
      const accountDialog = page.getByRole("dialog", { name: "停用账号", exact: true });
      const dialogStyle = await accountDialog.evaluate(dialog => {
        const title = getComputedStyle(dialog.querySelector("h2")!);
        return { titleSize: title.fontSize, titleFont: title.fontFamily, titleWeight: title.fontWeight,
          actions: [...dialog.querySelectorAll("[data-slot=dialog-footer] button")].map(button => ({ text: button.textContent?.trim(), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })) };
      });
      check(dialogStyle.titleSize === `${width < 640 ? 25 : 27}px` && dialogStyle.titleWeight === "400" && /Noto Serif|SimSun|Songti/.test(dialogStyle.titleFont), `account/${width} source dialog heading:${JSON.stringify(dialogStyle)}`);
      check(dialogStyle.actions[0]?.text === "取消" && dialogStyle.actions[1]?.text === "确认停用", `account/${width} source DOM action order:${JSON.stringify(dialogStyle.actions)}`);
      check(dialogStyle.actions.every(button => button.width < 120 && button.height >= 44), `account/${width} intrinsic actions with44px targets:${JSON.stringify(dialogStyle.actions)}`);
      check(Math.abs((await accountDialog.boundingBox())!.width - Math.min(660, width - 30)) <= 1, `account/${width} source660dialog/15pxgutters`);
      check(await user.locator('.badge').first().evaluate(node => getComputedStyle(node).fontWeight) === "400", `account/${width} source normal status weight`);
      const dangerTrigger = user.locator('.btn-danger').first();
      if (await dangerTrigger.count()) {
        const triggerPaint = await dangerTrigger.evaluate(node => {
          const ctx = document.createElement('canvas').getContext('2d')!; ctx.fillStyle = getComputedStyle(node, '::before').backgroundColor; ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).join(',');
        });
        check(triggerPaint === "253,252,248", `account/${width} source outline destructive trigger:${triggerPaint}`);
      }

      const badgeStyles = await user.locator(".badge").evaluateAll(nodes => nodes.map(node => ({ radius: getComputedStyle(node).borderRadius, size: getComputedStyle(node).fontSize })));
      check(badgeStyles.length > 0 && badgeStyles.every(style => style.radius === "3px" && style.size === "11px"), `account/${width} source rectangular status:${JSON.stringify(badgeStyles)}`);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await checkFocus(accountOpen, "account", width);
      await page.goto(`${BASE_URL}/admin/rewards`);
      const create = page.getByRole("button", { name: "新建奖励", exact: true });
      await expect(create).toBeVisible();
      await create.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`admin-reward-editor-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await checkFocus(create, "reward", width);
      const cancelDialog = async (open: ReturnType<Page["getByRole"]>, name: string) => {
        await open.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.screenshot({ path: testInfo.outputPath(`admin-${name}-${width}-dialog.png`) });
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await checkFocus(open, name, width);
      };
      const reward = page.locator("tbody tr").first();
      check(await reward.count() > 0, `reward@${width} real admin catalogue missing`);
      if (await reward.count() > 0) {
        await cancelDialog(reward.getByRole("button", { name: "编辑", exact: true }), "reward-edit");
        await cancelDialog(reward.getByRole("button", { name: "下架", exact: true }), "reward-disable");
      }
      await page.goto(`${BASE_URL}/admin/users`);
      const selection = page.getByRole("table", { name: "账号列表", exact: true }).getByRole("checkbox").first();
      await selection.check();
      await cancelDialog(page.getByRole("button", { name: "批量停用", exact: true }), "batch-suspend");
      await selection.uncheck();
      await page.goto(`${BASE_URL}/admin/redemptions`);
      await page.locator(".review-item").first().click();
      await cancelDialog(page.getByRole("button", { name: "通过并扣减积分", exact: true }), "redemption-approve");
      await cancelDialog(page.getByRole("button", { name: "拒绝申请", exact: true }), "redemption-reject");
      await page.goto(`${BASE_URL}/admin/system`);
      const term = page.locator(".panel", { hasText: "当前学期" }).first();
      await term.getByLabel("修改当前学期", { exact: true }).click();
      await term.getByLabel("新学期值").fill("e2e-source-cancel-only");
      await cancelDialog(term.getByRole("button", { name: "保存修改", exact: true }), "setting-confirm");
    }
    await testInfo.attach("approved-layout-differences", { body: JSON.stringify(differences, null, 2), contentType: "application/json" });
    await testInfo.attach("native-focus-settlement", { body: JSON.stringify(focusSettlements, null, 2), contentType: "application/json" });
    expect(differences, "approved admin source geometry and native focus").toEqual([]);
  });

  test("administrator catalogue uses existing admin listing and retains disabled rows after refresh", async ({ page }) => {
    const reads: { path: string; status: number }[] = [];
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (response.request().method() === "GET" && /\/api\/v1\/(admin\/)?rewards$/.test(url.pathname)) reads.push({ path: url.pathname, status: response.status() });
    });
    await page.goto(`${BASE_URL}/admin/rewards`);
    await expect(page.locator("main .skeleton")).toHaveCount(0);
    expect(reads, "admin page must use its existing authorized catalogue").toContainEqual({ path: "/api/v1/admin/rewards", status: 200 });
    expect(reads.some((read) => read.path === "/api/v1/rewards"), "student capability must not be requested by admin catalogue").toBe(false);
    const name = `管理目录刷新${Date.now()}`;
    await page.getByRole("button", { name: "新建奖励", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "新建奖励", exact: true });
    await dialog.getByLabel("名称", { exact: true }).fill(name);
    await dialog.getByLabel("兑换积分", { exact: true }).fill("10");
    await dialog.getByLabel("描述（选填）", { exact: true }).fill("模拟管理目录描述");
    await dialog.getByLabel("发放说明（选填，学生兑换后可见）", { exact: true }).fill("模拟发放说明");
    await dialog.getByLabel("操作原因", { exact: true }).fill("独立UI验证管理目录");
    await dialog.getByRole("button", { name: "创建奖励", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const row = page.locator("tbody tr", { hasText: name });
    async function findCreatedReward() {
      await expect(page.locator("main .skeleton")).toHaveCount(0);
      const more = page.getByRole("button", { name: /加载更多/ });
      while (!(await row.isVisible()) && (await more.count()) > 0) {
        const count = await page.locator("tbody tr").count();
        await more.click();
        await expect.poll(() => page.locator("tbody tr").count()).toBeGreaterThan(count);
      }
      await expect(row).toBeVisible();
    }
    await findCreatedReward();
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByLabel("描述（选填）", { exact: true })).toHaveValue("模拟管理目录描述");
    await expect(edit.getByLabel("发放说明（选填，学生兑换后可见）", { exact: true })).toHaveValue("模拟发放说明");
    await edit.getByLabel("描述（选填）", { exact: true }).fill("模拟编辑后的描述");
    await edit.getByLabel("发放说明（选填，学生兑换后可见）", { exact: true }).fill("模拟编辑后的发放说明");
    await edit.getByLabel("兑换积分", { exact: true }).fill("11");
    await edit.getByLabel("操作原因", { exact: true }).fill("独立UI验证编辑结果与弹窗关闭");
    const updated = page.waitForResponse(response => response.request().method() === "PATCH" && /\/api\/v1\/admin\/rewards\/[^/]+$/.test(new URL(response.url()).pathname));
    await edit.getByRole("button", { name: "保存修改", exact: true }).click();
    const updatedResponse = await updated; expect(updatedResponse.status()).toBe(200);
    expect(updatedResponse.request().postDataJSON()).not.toHaveProperty("requires_manual_review");
    expect(await updatedResponse.json()).toMatchObject({ description: "模拟编辑后的描述", fulfillment_instructions: "模拟编辑后的发放说明" });
    await expect(edit).toHaveCount(0);
    await findCreatedReward();
    await expect(row.getByText("11", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "编辑", exact: true }).click();
    const reread = page.getByRole("dialog");
    await expect(reread.getByLabel("描述（选填）", { exact: true })).toHaveValue("模拟编辑后的描述");
    await expect(reread.getByLabel("发放说明（选填，学生兑换后可见）", { exact: true })).toHaveValue("模拟编辑后的发放说明");
    await reread.getByLabel("发放说明（选填，学生兑换后可见）", { exact: true }).fill("");
    await reread.getByLabel("操作原因", { exact: true }).fill("模拟清除发放说明");
    const cleared = page.waitForResponse(response => response.request().method() === "PATCH" && /\/api\/v1\/admin\/rewards\/[^/]+$/.test(new URL(response.url()).pathname));
    await reread.getByRole("button", { name: "保存修改", exact: true }).click();
    const clearedResponse = await cleared; expect(clearedResponse.status()).toBe(200);
    expect(clearedResponse.request().postDataJSON()).toEqual({ fulfillment_instructions: null, reason: "模拟清除发放说明" });
    expect((await clearedResponse.json()).fulfillment_instructions).toBeNull();
    await expect(reread).toHaveCount(0); await findCreatedReward();
    await row.getByRole("button", { name: "下架", exact: true }).click();
    const disable = page.getByRole("dialog");
    await disable.getByLabel("下架原因").fill("独立UI验证刷新仍可管理");
    await disable.getByRole("button", { name: "确认下架", exact: true }).click();
    await expect(disable).toHaveCount(0);
    await page.reload();
    await findCreatedReward();
    await expect(row.getByText("已下架", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "编辑", exact: true })).toBeVisible();
  });

  test("administrator catalogue server paging refreshes order after a name edit and never loses a record", async ({ page }) => {
    test.setTimeout(180_000);
    const [initial] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/admin/rewards" && response.status() === 200),
      page.goto(`${BASE_URL}/admin/rewards`),
    ]);
    const initialTotal = (await initial.json()).total as number;
    expect(Number.isInteger(initialTotal)).toBe(true);
    const catalogue = page.getByRole("region", { name: "奖励目录", exact: true });
    const prefix = `AA管理分页${Date.now()}`;
    const names = Array.from({ length: 21 }, (_, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`);
    for (const [index, name] of names.entries()) {
      await page.getByRole("button", { name: "新建奖励", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "新建奖励", exact: true });
      await dialog.getByLabel("名称", { exact: true }).fill(name);
      await dialog.getByLabel("兑换积分", { exact: true }).fill("10");
      await dialog.getByLabel("操作原因", { exact: true }).fill("独立分页与排序回归样本");
      await dialog.getByRole("button", { name: "创建奖励", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(catalogue.locator(".list-footer")).toContainText(`共 ${initialTotal + index + 1} 项奖励`);
    }
    await expect(catalogue.locator("tbody tr")).toHaveCount(20);
    let releaseOldPage = () => {};
    let oldPageHeld = false;
    const release = new Promise<void>((resolve) => { releaseOldPage = resolve; });
    const delayedPage = "**/api/v1/admin/rewards?limit=20&offset=20";
    await page.route(delayedPage, async (route) => {
      const response = await route.fetch();
      oldPageHeld = true;
      await release;
      await route.fulfill({ response });
    });
    try {
    await catalogue.getByRole("button", { name: /加载更多/ }).click();
    await expect.poll(() => oldPageHeld, { message: "hold one genuine pre-edit server page" }).toBe(true);
    const first = catalogue.locator("tbody tr", { hasText: names[0] });
    await first.getByRole("button", { name: "编辑", exact: true }).click();
    const edit = page.getByRole("dialog");
    const renamed = `ZZ管理分页${Date.now()}`;
    await edit.getByLabel("名称", { exact: true }).fill(renamed);
    await edit.getByLabel("操作原因", { exact: true }).fill("名称排序跨越当前服务端页界");
    await edit.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(edit).toHaveCount(0);
    await expect(catalogue.locator("tbody tr", { hasText: names[20] })).toBeVisible();
    const oldResponse = page.waitForResponse((response) => new URL(response.url()).searchParams.get("offset") === "20" && new URL(response.url()).pathname === "/api/v1/admin/rewards");
    releaseOldPage();
    await oldResponse;
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(catalogue.locator("tbody tr")).toHaveCount(20);
    await page.unroute(delayedPage);
    const pages: number[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "GET" && url.pathname === "/api/v1/admin/rewards") pages.push(Number(url.searchParams.get("offset") ?? 0));
    });
    await catalogue.getByRole("button", { name: /加载更多/ }).click();
    await expect(catalogue.locator("tbody tr")).toHaveCount(initialTotal + names.length);
    expect(pages).toContain(20);
    for (const name of [...names.slice(1), renamed]) await expect(catalogue.locator("tbody tr", { hasText: name })).toHaveCount(1);
    await expect(catalogue.getByRole("button", { name: /加载更多/ })).toHaveCount(0);
    } finally {
      releaseOldPage();
      if (!page.isClosed()) await page.unroute(delayedPage);
    }
  });

  test("administrator audit uses real paging and exact equality filters without mutation", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.startsWith("/api/v1/admin/") && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) writes.push(request.method() + " " + request.url());
    });
    const isAuditRead = (response: Response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/admin/audit-logs" && response.status() === 200;
    const [initial] = await Promise.all([page.waitForResponse(isAuditRead), page.goto(`${BASE_URL}/admin/audit`)]);
    const result = await initial.json();
    expect(result.total).toBeGreaterThan(20);
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(20);
    await page.getByRole("button", { name: /加载更多/ }).click();
    await expect(rows).toHaveCount(Math.min(40, result.total));
    const selected = result.items[0];
    await page.getByLabel("操作名（如 USER_SUSPENDED）", { exact: true }).fill(selected.action);
    await page.getByLabel("操作者用户 ID", { exact: true }).fill(selected.actor_user_id);
    await page.getByLabel("目标类型（如 system_setting）", { exact: true }).fill(selected.target_type);
    const [filtered] = await Promise.all([
      page.waitForResponse((response) => isAuditRead(response) && new URL(response.url()).searchParams.get("action") === selected.action),
      page.getByRole("button", { name: "检索", exact: true }).click(),
    ]);
    const query = new URL(filtered.url()).searchParams;
    expect(query.get("actor_user_id")).toBe(selected.actor_user_id);
    expect(query.get("target_type")).toBe(selected.target_type);
    expect(query.has("offset")).toBe(false);
    const filteredResult = await filtered.json();
    expect(filteredResult.items.length).toBeGreaterThan(0);
    for (const item of filteredResult.items) {
      expect(item.action).toBe(selected.action);
      expect(item.actor_user_id).toBe(selected.actor_user_id);
      expect(item.target_type).toBe(selected.target_type);
    }
    await expect(rows).toHaveCount(filteredResult.items.length);
    await expect(rows.locator("pre:visible")).toHaveCount(0);
    const snapshot = rows.locator("details").first();
    await snapshot.locator("summary").click();
    await expect(snapshot.locator("pre").first()).toBeVisible();
    const [cleared] = await Promise.all([
      page.waitForResponse((response) => isAuditRead(response) && !new URL(response.url()).searchParams.has("action")),
      page.getByRole("button", { name: "清空条件", exact: true }).click(),
    ]);
    expect(new URL(cleared.url()).searchParams.has("actor_user_id")).toBe(false);
    expect(new URL(cleared.url()).searchParams.has("target_type")).toBe(false);
    await expect(rows).toHaveCount(20);
    expect(writes).toEqual([]);
  });

  test("user suspend blocks on a blank reason, then applies with one", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/users`);

    const row = page.locator("tr", { hasText: "e2e-suspended-student" });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "停用" }).click();

    const dialog = page.getByRole("dialog", { name: "停用账号" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "确认停用" }).click();
    await expect(dialog.getByText("操作原因必填（将记入审计日志）")).toBeVisible();

    await dialog.getByLabel("操作原因").fill("e2e：违规行为核查期间临时停用");
    await dialog.getByRole("button", { name: "确认停用" }).click();
    await expect(dialog).not.toBeVisible();
    await expect(row.getByText("已停用")).toBeVisible();

    // Restore for reruns: reactivate with a reason.
    await row.getByRole("button", { name: "恢复" }).click();
    const restore = page.getByRole("dialog", { name: "恢复账号" });
    await restore.getByLabel("操作原因").fill("e2e：恢复账号");
    await restore.getByRole("button", { name: "确认恢复" }).click();
    await expect(row.getByText("正常")).toBeVisible();
  });

  test("redemption decisions: reject demands a reason; approve then fulfill", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/redemptions`);

    // Business-key location (the cross-run pollution post-mortem,
    // 2026-10-09): the queue's FIRST row is the OLDEST pending
    // request — with a residue world's redemption parked there, a
    // positional .first() pick would decide a STRANGER's request. The
    // seeded item's name is run-derived (端到端奖励卡 + RUN[:6]), so
    // the row is located by THAT key, never by queue position.
    const itemName = `端到端奖励卡${RUN!.slice(0, 6)}`;
    const firstRow = page.locator(".review-item", { hasText: itemName });
    await expect(firstRow).toBeVisible();
    await firstRow.click();

    // Reject: blank reason is refused client-side (the transport mirror).
    await page.getByRole("button", { name: "拒绝申请" }).click();
    const reject = page.getByRole("dialog", { name: "拒绝兑换申请" });
    await expect(reject).toBeVisible();
    await reject.getByRole("button", { name: "确认拒绝" }).click();
    await expect(reject.getByText("拒绝原因必填（将通过通知送达申请者）")).toBeVisible();
    await reject.getByRole("button", { name: "取消" }).click();

    // Approve: explicit confirm, then the row lands in 待发放 and fulfill
    // becomes available on the server verdict.
    await page.getByRole("button", { name: "通过并扣减积分" }).click();
    const approve = page.getByRole("dialog", { name: "通过兑换申请" });
    await expect(approve.getByText(/将扣减积分进入待发放/)).toBeVisible();
    await approve.getByRole("button", { name: "确认通过" }).click();
    // .first(): after approval the badge renders on BOTH the queue row
    // and the selected detail — the strict-mode ambiguity would fail
    // the otherwise-correct wait.
    await expect(page.getByText("已批准 · 待发放").first()).toBeVisible();

    await page.getByRole("button", { name: "标记已发放" }).click();
    const fulfill = page.getByRole("dialog", { name: "标记已发放" });
    await expect(fulfill).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(fulfill).toHaveCount(0);
    await expect(page.getByRole("button", { name: "标记已发放", exact: true })).toBeFocused();
    await page.getByRole("button", { name: "标记已发放", exact: true }).click();
    await fulfill.getByRole("button", { name: "确认发放" }).click();
    await expect(page.getByText("已发放").first()).toBeVisible();
  });

  test("administrator maintenance uses real template versions and reasoned repair refusals", async ({ page }, testInfo) => {
    await page.goto(`${BASE_URL}/admin/system`);
    const templates = page.getByRole("region", { name: "通知模板管理", exact: true });
    const create = templates.locator("form").filter({ has: page.getByRole("heading", { name: "创建模板", exact: true }) });
    await create.getByLabel("事件类型", { exact: true }).selectOption("ASSIGNMENT_DEADLINE_24H");
    await create.getByLabel("渠道", { exact: true }).selectOption("IN_APP");
    const title = `独立管理模板${Date.now()}`;
    await create.getByLabel("标题", { exact: true }).fill(title);
    await create.getByLabel("正文", { exact: true }).fill("独立验证模板正文。");
    const path = "/api/v1/admin/notification-templates";
    const [createdResponse] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === path),
      create.getByRole("button", { name: "创建模板", exact: true }).click(),
    ]);
    expect(createdResponse.status()).toBe(200);
    const created = await createdResponse.json();
    expect(created.enabled).toBe(true);
    const row = templates.getByRole("table", { name: "本次会话管理的模板", exact: true }).locator("tbody tr", { hasText: created.id });
    await expect(row).toHaveCount(1);
    await expect(row.locator('[data-label="标题"]')).toHaveText(title);
    const manage = templates.locator(".panel").filter({ has: page.getByRole("heading", { name: "按 ID 管理", exact: true }) });
    await manage.getByLabel("模板 ID", { exact: true }).fill(created.id);
    await manage.getByLabel("新标题（更新时必填）", { exact: true }).fill(title + "已更新");
    await manage.getByLabel("新正文（更新时必填）", { exact: true }).fill("已更新的独立验证模板正文。");
    async function applyTemplate(button: string, method: string, suffix: string) {
      const [response] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === method && new URL(response.url()).pathname === `${path}/${created.id}${suffix}`),
        manage.getByRole("button", { name: button, exact: true }).click(),
      ]);
      expect(response.status()).toBe(200);
      return response.json();
    }
    const updated = await applyTemplate("更新内容", "PATCH", "");
    expect(updated.version).toBe(created.version + 1);
    await expect(row.locator('[data-label="标题"]')).toHaveText(title + "已更新");
    await expect(row.locator('[data-label="版本"]')).toHaveText(`v${updated.version}`);
    const disabled = await applyTemplate("停用", "POST", "/disable");
    expect(disabled.enabled).toBe(false);
    expect(disabled.version).toBe(updated.version);
    await expect(row.locator('[data-label="状态"]')).toHaveText("停用");
    const enabled = await applyTemplate("启用", "POST", "/enable");
    expect(enabled.enabled).toBe(true);
    expect(enabled.version).toBe(updated.version);
    await expect(row.locator('[data-label="状态"]')).toHaveText("启用");
    // Leave the override disabled until owned-world cleanup removes it.
    await applyTemplate("停用", "POST", "/disable");
    await expect(row.locator('[data-label="状态"]')).toHaveText("停用");
    const repairs = page.getByRole("region", { name: "具名状态修复", exact: true });
    for (const repair of [
      { title: "释放占用中的任务单元", field: "任务单元 ID", button: "确认释放占用", endpoint: "release-occupied-assignment", key: "assignment_id" },
      { title: "强制失败卡住的投递", field: "投递 ID", button: "确认强制失败", endpoint: "force-fail-delivery", key: "delivery_id" },
    ]) {
      const form = repairs.locator("form").filter({ has: page.getByRole("heading", { name: repair.title, exact: true }) });
      const button = form.getByRole("button", { name: repair.button, exact: true });
      await button.click();
      await expect(form.locator(".field-error")).toContainText("请填写");
      const id = randomUUID();
      await form.getByLabel(repair.field, { exact: true }).fill(id);
      await button.click();
      await expect(form.locator(".field-error")).toContainText("原因必填");
      const reason = "独立 UI 验证不存在对象的真实修复拒绝";
      await form.getByLabel("修复原因", { exact: true }).fill(reason);
      const [response] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/v1/admin/repairs/${repair.endpoint}`),
        button.click(),
      ]);
      expect(response.status()).toBe(404);
      expect(response.request().postDataJSON()).toEqual({ [repair.key]: id, reason });
      await expect(form.getByRole("alert")).toBeVisible();
      await expect(form.getByLabel(repair.field, { exact: true })).toHaveValue(id);
      await expect(form.getByLabel("修复原因", { exact: true })).toHaveValue(reason);
      await expect(button).toBeEnabled();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: testInfo.outputPath("admin-system-maintenance-390-natural.png"), fullPage: true });
  });

  test("settings: term edit confirms the old -> new diff before the PUT", async ({ page }) => {
    await page.goto(`${BASE_URL}/admin/system`);

    const termCard = page.locator(".panel", { hasText: "当前学期" }).first();
    await termCard.getByLabel("修改当前学期", { exact: true }).click();
    const nativeEditor = termCard.locator(".campus-admin-setting-editor[open]");
    await expect(nativeEditor).toBeVisible();
    const editorWidth = await nativeEditor.evaluate(editor => ({ width: editor.getBoundingClientRect().width, available: editor.parentElement!.clientWidth }));
    expect(Math.abs(editorWidth.width - Math.min(760, editorWidth.available)), "approved inline parameter editor max760px").toBeLessThanOrEqual(1);
    const termInput = termCard.getByLabel("新学期值");
    await termInput.fill("e2e-term-2026-2");
    await termCard.getByRole("button", { name: "保存修改" }).click();

    const confirm = page.getByRole("dialog", { name: "修改当前学期" });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(/切换学期后，新创建的兑换将快照新学期/)).toBeVisible();
    await confirm.getByRole("button", { name: "确认修改" }).click();
    await expect(confirm).not.toBeVisible();
    await expect(termCard.getByText("e2e-term-2026-2").first()).toBeVisible();
  });
});
