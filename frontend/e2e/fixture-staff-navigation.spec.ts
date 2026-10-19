import { BASE_URL, expect, staffLogin, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated staff world');

test('staff fixture never resubmits accepted credentials while navigation is pending', async ({ page }) => {
  const credentials = process.env.CQ_E2E_STAFF;
  const secret = process.env.CQ_E2E_STAFF_TOTP_SECRET;
  if (!credentials || !secret) throw new Error('The isolated world must export the staff contract');
  let submissions = 0;
  let heldNavigations = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/auth/staff/login') submissions += 1;
  });
  // Deliberate fault injection: an accepted login's RSC navigation takes
  // longer than the helper's former5-second URL assertion. The real auth
  // endpoint and all product handlers remain untouched.
  await page.route('**/teacher/reviews*', async route => {
    heldNavigations += 1;
    await new Promise(resolve => setTimeout(resolve, 6500));
    await route.continue();
  });
  await staffLogin(page, credentials, secret);
  await expect(page).toHaveURL(`${BASE_URL}/teacher/reviews`);
  await expect(page.getByRole('heading', { name: '提交审核', exact: true })).toBeVisible();
  expect(heldNavigations).toBeGreaterThan(0);
  expect(submissions, 'an accepted login must not be sent again for a slow route').toBe(1);
});

test('staff fixture recomputes TOTP after a typed authentication rejection', async ({ page }) => {
  const credentials = process.env.CQ_E2E_STAFF;
  const secret = process.env.CQ_E2E_STAFF_TOTP_SECRET;
  if (!credentials || !secret) throw new Error('The isolated world must export the staff contract');
  let submissions = 0;
  await page.route('**/api/v1/auth/staff/login', async route => {
    submissions += 1;
    if (submissions === 1) {
      // Synthetic expired-factor response; the next attempt reaches the
      // real endpoint with the helper's freshly computed current code.
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'AUTHENTICATION_REQUIRED', message: '登录信息不正确', details: null, request_id: null } }) });
    } else await route.continue();
  });
  await staffLogin(page, credentials, secret);
  await expect(page.getByRole('heading', { name: '提交审核', exact: true })).toBeVisible();
  expect(submissions).toBe(2);
});
