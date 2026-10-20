import { BASE_URL, expect, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated integration world');

test('unified login waits for handlers before accepting identifier and mode changes', async ({ page }, info) => {
  let release!: () => void;
  const scripts = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async route => {
    await scripts;
    await route.continue();
  });
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'commit' });
    const identifier = page.getByLabel('账号', { exact: true });
    const send = page.getByRole('button', { name: '获取验证码', exact: true });
    const passwordMode = page.getByRole('button', { name: '使用密码登录', exact: true });
    await expect(identifier).toBeVisible();
    expect.soft(await identifier.isDisabled(), 'SSR identifier waits for its input handler').toBe(true);
    expect.soft(await send.isDisabled(), 'SSR send waits for its request handler').toBe(true);
    expect.soft(await passwordMode.isDisabled(), 'SSR mode switch waits for its handler').toBe(true);
    await page.screenshot({ path: info.outputPath('unified-ssr-before-handlers.png'), fullPage: true, caret: 'initial' });
    // Controlled fault injection, retaining the existing 6500ms stimulus.
    await new Promise(resolve => setTimeout(resolve, 6500));
    release();
    await expect(identifier).toBeEnabled();
    await expect(send).toBeEnabled();
    await expect(passwordMode).toBeEnabled();
    await identifier.fill('readiness@example.invalid');
    await passwordMode.click();
    await expect(identifier).toHaveValue('readiness@example.invalid');
    const password = page.getByLabel('密码', { exact: true });
    await password.fill('DemoPass2026!');
    await identifier.press('End');
    await identifier.press('2');
    await expect(identifier).toHaveValue('readiness@example.invalid2');
    await expect(password).toHaveValue('DemoPass2026!');
  } finally { release(); }
});
