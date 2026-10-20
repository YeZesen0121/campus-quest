import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

import { BASE_URL, expect, recoverMobileCode, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated integration world');

async function expectValidationFocus(page: Page, field: string) {
  const input = page.getByLabel(field, { exact: true });
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  const description = await input.getAttribute('aria-describedby');
  expect(description).toBeTruthy();
  await expect(page.locator(`#${description}`)).toBeVisible();
  const summary = page.locator('form').getByRole('alert');
  await expect(summary).toContainText('请检查表单填写后重试');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(field === '密码' ? '账号' : field, { exact: true })).toBeFocused();
}

test('local identifier and password validation announces and focuses the error', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expectValidationFocus(page, '账号');
  await page.getByRole('button', { name: '使用密码登录', exact: true }).click();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expectValidationFocus(page, '密码');
});

test('code validation announces without submitting an invalid challenge', async ({ page }) => {
  // A fresh valid address exercises anti-enumeration202 without reusing a
  // seeded account's already-consumed challenge from another scenario.
  const email = `e2e-ui-validation-${process.env.CQ_E2E_RUN}@school.edu`;
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('账号', { exact: true }).fill(email);
  const send = page.waitForResponse(response => response.url().endsWith('/auth/challenge/request') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  expect((await send).status()).toBe(202);
  await expect(page.getByLabel('验证码', { exact: true })).toBeVisible();
  let verifies = 0;
  page.on('request', request => { if (request.url().endsWith('/auth/challenge/verify')) verifies++; });
  await page.getByRole('button', { name: '登录', exact: true }).click();
  // The summary precedes the account field; the code keeps its own error association.
  const code = page.getByLabel('验证码', { exact: true });
  await expect(code).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('form').getByRole('alert')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('账号', { exact: true })).toBeFocused();
  expect(verifies).toBe(0);
});

test('weak mode controls keep approved quiet 44px targets', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/login`);
    const mode = page.getByRole('button', { name: '使用密码登录', exact: true });
    await expect(mode).toBeEnabled();
    expect.soft((await mode.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect.soft(mode).toHaveCSS('border-top-width', '0px');
    await expect.soft(mode).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await mode.focus();
    await expect(mode).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: '使用验证码登录', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByLabel('密码', { exact: true })).toBeVisible();
  }
});

test('admin TOTP local validation retains the second factor and focuses its error', async ({ page }) => {
  const [email, password] = process.env.CQ_E2E_ADMIN!.split(':');
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('button', { name: '使用密码登录', exact: true }).click();
  await page.getByLabel('账号', { exact: true }).fill(email);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByTestId('unified-login-totp-leg')).toBeVisible();
  await page.getByRole('button', { name: '完成登录', exact: true }).click();
  await expectValidationFocus(page, '动态验证码');
  await expect(page).toHaveURL(`${BASE_URL}/login`);
});

test('inline pending-approval registration announces invalid student number', async ({ page }) => {
  const phone = `157${String(Date.now()).slice(-8)}`;
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel('账号', { exact: true }).fill(phone);
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await expect(page.getByLabel('验证码', { exact: true })).toBeVisible();
  await page.getByLabel('验证码', { exact: true }).fill(recoverMobileCode(`+86${phone}`));
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByText(/账号需管理员审核，审核前可浏览/)).toBeVisible();
  await page.getByRole('button', { name: '完成注册并登录', exact: true }).click();
  await expectValidationFocus(page, '学号');
});

for (const width of [390, 1440]) {
  test(`recent account keyboard removal and long content at ${width}px`, async ({ page }, info) => {
    const nickname = '👩🏽‍💻'.repeat(8);
    const email = `teacher@${'long'.repeat(40)}.example.edu`;
    const masked = `t***@${'long'.repeat(40)}.example.edu`;
    await page.addInitScript(({ email, masked, nickname }) => {
      if (localStorage.getItem('cq.recent-logins') !== null) return;
      localStorage.setItem('cq.recent-logins', JSON.stringify([
        { identifier: email, masked, nickname, role: 'TEACHER', lastUsedAt: 2 },
        { identifier: '2026000001', masked: '20****01', nickname: '同学', role: 'STUDENT', lastUsedAt: 1 },
      ]));
    }, { email, masked, nickname });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/login`);
    const cards = page.locator('.login-recent-card');
    await expect(cards).toHaveCount(2);
    expect.soft(await cards.first().locator('.login-recent-avatar').textContent()).toBe('👩🏽‍💻');
    const remove = cards.first().getByRole('button', { name: `从本机移除 ${masked}`, exact: true });
    const box = (await remove.boundingBox())!;
    expect.soft(box.x + box.width).toBeLessThanOrEqual(width);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('recent-long-content.png'), fullPage: true });
    const result = await new AxeBuilder({ page }).analyze();
    expect.soft(result.violations).toEqual([]);
    await remove.focus();
    await page.keyboard.press('Enter');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().getByRole('button', { name: '切换到 20****01', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('账号', { exact: true })).toHaveValue('2026000001');
    await cards.first().getByRole('button', { name: /从本机移除/ }).focus();
    await page.keyboard.press('Enter');
    await expect(cards).toHaveCount(0);
    await expect(page.getByLabel('账号', { exact: true })).toBeFocused();
    await page.reload();
    await expect(cards).toHaveCount(0);
  });
}
