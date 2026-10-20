import AxeBuilder from '@axe-core/playwright';
import { BASE_URL, expect, staffLogin, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated integration world');

for (const width of [390, 1440]) {
  test(`upstream reset-token form follows approved auth composition at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/reset-password`);
    const title = page.getByRole('heading', { name: '重置密码', exact: true });
    const card = page.locator('.auth-card');
    await expect(title).toBeVisible();
    await expect(card).toBeVisible();
    const bounds = (await card.boundingBox())!;
    expect((await title.boundingBox())!.y + (await title.boundingBox())!.height).toBeLessThan(bounds.y);
    expect(bounds.width).toBeCloseTo(width === 390 ? 354 : 420, 0);
    const submit = card.getByRole('button', { name: '重置密码', exact: true });
    expect((await submit.boundingBox())!.width).toBeLessThan(170);
    expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const footer = page.getByRole('navigation', { name: '其他登录与注册入口' });
    await expect(footer.getByRole('link', { name: '返回登录', exact: true })).toHaveAttribute('href', '/login');
    expect((await footer.boundingBox())!.y).toBeGreaterThan(bounds.y + bounds.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath('reset-token-composition.png'), fullPage: true });
  });

  test(`upstream not-found keeps the product brand and compact way home at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(`${BASE_URL}/definitely-not-a-page`);
    expect(response!.status()).toBe(404);
    await expect(page.getByRole('banner').getByRole('link', { name: '华师令', exact: true })).toBeVisible();
    const heading = page.getByRole('heading', { name: '页面不存在', exact: true });
    const card = page.locator('.auth-card');
    const bounds = (await card.boundingBox())!;
    expect((await heading.boundingBox())!.y + (await heading.boundingBox())!.height).toBeLessThan(bounds.y);
    expect(bounds.width).toBeCloseTo(width === 390 ? 354 : 420, 0);
    const home = card.getByRole('link', { name: '返回首页', exact: true });
    await expect(home).toHaveAttribute('href', '/');
    expect((await home.boundingBox())!.width).toBeLessThan(170);
    expect((await home.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await home.focus();
    await expect(home).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath('not-found-composition.png'), fullPage: true });
  });

  test(`upstream batch selection keeps compact columns and native targets at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await staffLogin(page, process.env.CQ_E2E_ADMIN!, process.env.CQ_E2E_ADMIN_TOTP_SECRET!);
    await page.goto(`${BASE_URL}/admin/users`);
    const table = page.getByRole('table', { name: '账号列表', exact: true });
    const checkbox = table.getByRole('checkbox').first();
    await expect(checkbox).toBeVisible();
    if (width === 1440) {
      expect.soft((await table.getByRole('columnheader', { name: '选择', exact: true }).boundingBox())!.width).toBeLessThanOrEqual(80);
      await expect.soft(table.locator('td[data-label="用户 ID"] .mono').first()).toHaveCSS('white-space', 'nowrap');
    }
    const target = checkbox.locator('..');
    expect.soft((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect.soft((await target.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await checkbox.focus();
    await page.keyboard.press('Space');
    await expect(checkbox).toBeChecked();
    await expect(page.getByText('已选 1 项', { exact: true })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(checkbox).not.toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: info.outputPath('batch-selection-composition.png'), fullPage: true });
  });
}
