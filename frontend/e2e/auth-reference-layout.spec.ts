import { BASE_URL, expect, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the owned UI test world');

const entries = [
  { path: '/register', title: '注册学生账号', detail: '完成手机号验证后，使用学号登录。', action: '注册', brief: '仅支持老师导入的白名单学号。' },
  { path: '/forgot-password', title: '找回密码', detail: '通过绑定手机号验证，重新设置密码。', action: '获取验证码', steps: '找回密码步骤' },
  { path: '/staff/login', title: '员工登录', detail: '使用员工邮箱、密码和动态验证码登录。', action: '登录', brief: '教师与管理员使用独立员工账号登录。' },
  { path: '/staff/invite/ui-layout-placeholder', title: '接受员工邀请', detail: '设置密码后，继续完成动态口令绑定。', action: '设置密码并继续', steps: '账号激活步骤' },
  { path: '/mentor/login', title: '导师登录', detail: '使用导师账号确认与管理本人的导师档案。', action: '登录' },
  { path: '/logout', title: '退出当前账号', detail: '退出前，请确认当前操作已保存。', action: '确认退出登录' },
] as const;

for (const width of [390, 1440]) {
  for (const entry of entries) {
    test(`approved identity entry ${entry.path} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${BASE_URL}${entry.path}`);
      const heading = page.getByRole('heading', { name: entry.title, exact: true });
      await expect(heading).toBeVisible();
      await expect(page.getByText(entry.detail, { exact: true })).toBeVisible();
      const card = page.locator('.auth-card');
      const cardBox = (await card.boundingBox())!;
      expect((await heading.boundingBox())!.y + (await heading.boundingBox())!.height).toBeLessThan(cardBox.y);
      expect(cardBox.width).toBeCloseTo(width === 390 ? 354 : 420, 0);
      const action = card.getByRole('button', { name: entry.action, exact: true });
      expect((await action.boundingBox())!.width).toBeLessThan(170);
      expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      if ('brief' in entry) await expect(card.getByText(entry.brief, { exact: true })).toBeVisible();
      if ('steps' in entry) {
        const steps = card.getByRole('list', { name: entry.steps });
        await expect(steps.getByRole('listitem')).toHaveCount(2);
        await expect(steps.locator('[aria-current="step"]')).toHaveText(/^1 /);
      }
      if (entry.path === '/forgot-password') {
        await expect(page.getByRole('link', { name: /返回登录/ })).toHaveCount(1);
        expect((await page.getByRole('navigation', { name: '其他登录与注册入口' }).boundingBox())!.y).toBeGreaterThan(cardBox.y + cardBox.height);
      }
      if (entry.path === '/mentor/login') {
        await expect(card.getByRole('link', { name: '返回学生登录' })).toBeVisible();
        await expect(card).toHaveCSS('border-top-width', '0px');
        await expect(card).toHaveCSS('padding-top', '0px');
      }
      if (entry.path === '/register') {
        const phone = (await card.getByLabel('手机号', { exact: true }).boundingBox())!;
        const code = (await card.getByRole('button', { name: '获取验证码', exact: true }).boundingBox())!;
        expect(code.y).toBeCloseTo(phone.y, 0);
        expect(code.x).toBeGreaterThan(phone.x + phone.width);
        expect(code.width).toBeLessThan(140);
      }
      await expect(page.getByRole('button', { name: '填入虚构演示数据' })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath('identity-entry.png'), fullPage: true, caret: 'initial' });
    });
  }
}

// Values come from the approved auth-login.html + completion/access.css,
// measured at the same CSS viewports. This checks reference fidelity rather
// than merely accepting a new screenshot of our own implementation.
for (const width of [390, 1440]) {
  test(`approved student login composition at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/login`);
    const banner = page.getByRole('banner');
    await expect(banner.getByRole('link', { name: '华师令', exact: true })).toBeVisible();
    const heading = page.getByRole('heading', { name: '登录华师令', exact: true });
    const main = page.getByRole('main');
    const form = main.locator('form');
    const card = page.locator('.auth-card');
    const mobile = width < 768;
    const bannerBox = (await banner.boundingBox())!;
    const headingBox = (await heading.boundingBox())!;
    const cardBox = (await card.boundingBox())!;
    expect(bannerBox.y).toBe(0);
    expect(bannerBox.height).toBeCloseTo(mobile ? 60 : 70, 0);
    expect((await main.boundingBox())!.y).toBeCloseTo(mobile ? 85 : 108, 0);
    expect(cardBox.width).toBeCloseTo(mobile ? width - 36 : 420, 0);
    expect(cardBox.x).toBeCloseTo(mobile ? 18 : (width - 420) / 2, 0);
    expect(headingBox.x).toBeCloseTo(cardBox.x, 0);
    expect(headingBox.y).toBeCloseTo(mobile ? 107.75 : 132.5, 0);
    expect(cardBox.y).toBeCloseTo(mobile ? 198.09375 : 228.1953125, 0);
    expect(headingBox.y + headingBox.height).toBeLessThan(cardBox.y);
    expect(await heading.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBe(mobile ? 29 : 32);
    const input = form.getByLabel('学号', { exact: true });
    expect((await input.boundingBox())!.height).toBe(44);
    expect(await input.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBe(14);
    const submit = form.getByRole('button', { name: '登录', exact: true });
    expect((await submit.boundingBox())!.width).toBeLessThan(80);
    expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(form.getByRole('link', { name: '忘记密码', exact: true })).toBeVisible();
    const links = page.getByRole('navigation', { name: '其他登录与注册入口' });
    for (const [name, href] of [['首次使用，注册账号', '/register'], ['教师 / 管理员入口', '/staff/login'], ['导师入口', '/mentor/login']]) {
      await expect(links.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
    }
    expect((await links.boundingBox())!.y).toBeGreaterThan(cardBox.y + cardBox.height);
    await expect(page.getByRole('button', { name: '填入虚构演示数据' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath('actual-login.png'), fullPage: true, caret: 'initial' });
  });
}

// Controlled slow-script reproduction: server HTML must not offer a form
// whose controlled inputs have no handlers yet. This is not a retry or a
// page-load stabilization sleep; the 6500ms gate is the regression stimulus.
for (const entry of [{ path: '/login', label: '学号' }, { path: '/mentor/login', label: '导师账号' }]) {
  test(`login hydration readiness ${entry.path}: controlled delayed scripts`, async ({ page }) => {
    let release!: () => void;
    const scripts = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async route => { await scripts; await route.continue(); });
    try {
      await page.goto(`${BASE_URL}${entry.path}`, { waitUntil: 'commit' });
      const username = page.getByLabel(entry.label, { exact: true });
      const password = page.getByLabel('密码', { exact: true });
      const submit = page.getByRole('button', { name: '登录', exact: true });
      await expect(username).toBeVisible();
      expect.soft(await username.isDisabled(), 'SSR username waits for its handlers').toBe(true);
      expect.soft(await password.isDisabled(), 'SSR password waits for its handlers').toBe(true);
      expect.soft(await submit.isDisabled(), 'SSR submit waits for its handlers').toBe(true);
      await new Promise(resolve => setTimeout(resolve, 6500));
      release();
      await expect(username).toBeEnabled(); await expect(password).toBeEnabled(); await expect(submit).toBeEnabled();
      await username.fill('2026000001'); await password.fill('DemoPass2026!');
      await username.press('End'); await username.press('2');
      await expect(username).toHaveValue('20260000012'); await expect(password).toHaveValue('DemoPass2026!');
    } finally { release(); }
  });
}

test('C1 staff form: same controlled slow-script readiness and typed-value preservation', async ({ page }) => {
  let release!: () => void;
  const scripts = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async route => { await scripts; await route.continue(); });
  try {
    await page.goto(`${BASE_URL}/staff/login`, { waitUntil: 'commit' });
    const username = page.getByLabel('邮箱', { exact: true });
    const password = page.getByLabel('密码', { exact: true });
    const factor = page.getByLabel('动态验证码', { exact: true });
    const submit = page.getByRole('button', { name: '登录', exact: true });
    await expect(username).toBeVisible();
    for (const control of [username, password, factor, submit]) expect.soft(await control.isDisabled(), 'SSR staff control waits for its handlers').toBe(true);
    await new Promise(resolve => setTimeout(resolve, 6500));
    release();
    for (const control of [username, password, factor, submit]) await expect(control).toBeEnabled();
    await username.fill('readiness@example.invalid');
    await password.fill('DemoPass2026!');
    await factor.fill('123456');
    await username.press('End'); await username.press('2');
    await expect(username).toHaveValue('readiness@example.invalid2');
    await expect(password).toHaveValue('DemoPass2026!');
    await expect(factor).toHaveValue('123456');
  } finally { release(); }
});
