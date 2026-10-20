import { BASE_URL, ensureStudentLogin, expect, staffLogin, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated integration world');

test('upstream admin destinations name the actual public route', async ({ page }) => {
  await staffLogin(page, process.env.CQ_E2E_ADMIN!, process.env.CQ_E2E_ADMIN_TOTP_SECRET!);
  for (const [path, text] of [
    ['/admin', '管理后台 / 概览'],
    ['/admin/invitations', '管理后台 / 员工邀请'],
    ['/admin/platforms', '管理后台 / 平台管理'],
    ['/admin/approvals', '管理后台 / 注册审批'],
  ]) {
    await page.goto(`${BASE_URL}${path}`);
    await expect.soft(page.locator('.app-context')).toHaveText(text);
  }
});

test('upstream teacher profile names its own account destination', async ({ page }) => {
  await staffLogin(page, process.env.CQ_E2E_STAFF!, process.env.CQ_E2E_STAFF_TOTP_SECRET!);
  await page.goto(`${BASE_URL}/teacher/profile`);
  await expect(page.locator('.app-context')).toHaveText('教师工作台 / 个人信息');
});

test('R6 collaboration home keeps its public context without private name reads', async ({ page }) => {
  await ensureStudentLogin(page);
  await page.goto(`${BASE_URL}/profile/collaboration`);
  await expect(page.getByRole('region', { name: '我负责的', exact: true })).toBeVisible();
  await expect(page.locator('.app-context')).toHaveText('我的 / 项目协作与交接');
});
