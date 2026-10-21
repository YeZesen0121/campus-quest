import { BASE_URL, ensureStudentLogin, expect, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the owned UI test world');

test('student navigation keeps one current destination across all three bands', async ({ page }) => {
  await ensureStudentLogin(page);
  await page.goto(`${BASE_URL}/profile?tab=info`);
  await expect(page.getByRole('region', { name: '昵称', exact: true })).toBeVisible();
  for (const width of [390, 639, 640, 800, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const menuOnly = width > 640 && width < 1024;
    const toggle = page.getByRole('button', { name: '全部导航', exact: true });
    const menu = page.getByRole('dialog', { name: '全部导航', exact: true });
    if (menuOnly) {
      await expect(page.getByRole('navigation', { name: '主导航', exact: true }).filter({ visible: true })).toHaveCount(0);
      await toggle.click();
      await expect(menu).toBeVisible();
    }
    const navigation = menuOnly ? menu.getByRole('navigation', { name: '全部导航', exact: true }) : page.getByRole('navigation', { name: width >= 1024 ? '个人' : '主导航', exact: true }).filter({ visible: true });
    await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(navigation.getByRole('link', { name: '我的', exact: true })).toHaveAttribute('aria-current', 'page');
    if (width <= 640) await expect(navigation.getByRole('link')).toHaveCount(5);
    if (width < 1024) {
      if (!menuOnly) await toggle.click();
      await expect(menu.getByRole('link', { name: '积分奖励', exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible();
      await expect(toggle).toBeFocused();
    }
    const brand = page.getByRole('link', { name: '华师令', exact: true }).filter({ visible: true });
    await expect(brand).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

for (const width of [390, 1440]) {
  test(`approved account independent sections at ${width}px`, async ({ page }, info) => {
    await ensureStudentLogin(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/profile?tab=info`);
    const avatar = page.getByRole('region', { name: '头像', exact: true });
    const nickname = page.getByRole('region', { name: '昵称', exact: true });
    const phone = page.getByRole('region', { name: '手机号', exact: true });
    const email = page.getByRole('region', { name: '邮箱', exact: true });
    await expect(avatar).toBeVisible();
    await expect(nickname).toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished.catch(() => undefined)));
    });
    // Read all four independent sections in the same frame, after entry motion.
    const [a, n, p, e] = await page.locator('.profile-page').evaluate(element =>
      ['头像', '昵称', '手机号', '邮箱'].map(name => {
        const rect = element.querySelector(`[aria-label="${name}"]`)!.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));
    if (width >= 640) {
      expect(a.y).toBeCloseTo(n.y, 0);
      expect(p.y).toBeCloseTo(e.y, 0);
      expect(n.x).toBeGreaterThan(a.x + a.width);
      expect(e.x).toBeGreaterThan(p.x + p.width);
      const banner = page.getByRole('banner');
      expect((await banner.boundingBox())!.height).toBeCloseTo(69, 0);
      await expect(banner.getByText('校内空间 / 个人信息', { exact: true })).toBeVisible();
    } else {
      expect(n.y).toBeGreaterThan(a.y + a.height);
      expect(e.y).toBeGreaterThan(p.y + p.height);
    }
    const button = nickname.getByRole('button', { name: '保存昵称', exact: true });
    expect((await button.boundingBox())!.width).toBeLessThan(130);
    const emailInput = email.getByLabel('绑定邮箱', { exact: true });
    expect((await emailInput.boundingBox())!.width).toBeCloseTo(e.width, 0);
    const currentTab = page.getByRole('navigation', { name: '个人主页分区' }).getByRole('link', { name: '个人信息', exact: true });
    await expect(currentTab).toHaveCSS('border-bottom-width', '2px');
    const logout = page.getByRole('region', { name: '退出当前账号', exact: true }).getByRole('link', { name: '退出登录', exact: true });
    expect((await logout.boundingBox())!.width).toBeLessThan(150);
    for (const field of [nickname.getByLabel('昵称', { exact: true }), phone.getByLabel('新手机号', { exact: true })]) {
      expect(await field.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBe(14);
    }
    await expect(page.getByText('仅本人可见', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath('account.png'), fullPage: true, caret: 'initial' });
  });
}
