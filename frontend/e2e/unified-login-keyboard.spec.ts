import { BASE_URL, expect, recoverEmailCode, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated integration world');

test('identifier Enter requests the code before code Enter verifies the real login', async ({ page }) => {
  // Reserve the second teacher's mailbox so the following six-chain suite
  // can exercise the first teacher without violating the real resend bucket.
  const [email] = process.env.CQ_E2E_STAFF2!.split(':');
  let sends = 0, verifies = 0;
  page.on('request', request => {
    if (request.method() !== 'POST') return;
    const path = new URL(request.url()).pathname;
    if (path === '/api/v1/auth/challenge/request') sends++;
    if (path === '/api/v1/auth/challenge/verify') verifies++;
  });
  await page.goto(`${BASE_URL}/login`);
  const identifier = page.getByLabel('账号', { exact: true });
  await identifier.fill(email);
  await identifier.press('Enter');
  const code = page.getByLabel('验证码', { exact: true });
  await expect(code).toBeVisible();
  expect(sends).toBe(1);
  expect(verifies).toBe(0);
  await code.fill(recoverEmailCode(email));
  await code.press('Enter');
  await expect(page).toHaveURL(`${BASE_URL}/teacher/reviews`);
  await expect(page.getByRole('heading', { name: '提交审核', exact: true })).toBeVisible();
  expect(sends).toBe(1);
  expect(verifies).toBe(1);
});
