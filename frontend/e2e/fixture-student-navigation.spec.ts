import { BASE_URL, expect, loginThroughUi, parseSeededAccount, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated student world');

test('student fixture waits for its accepted login and real landing navigation', async ({ page }, testInfo) => {
  const account = parseSeededAccount(process.env.CQ_E2E_STUDENT, 'CQ_E2E_STUDENT');
  let submissions = 0;
  let heldNavigations = 0;
  const statuses: number[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/auth/login') submissions += 1;
  });
  page.on('response', response => {
    if (response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/login') statuses.push(response.status());
  });
  // Deliberate navigation latency only: credentials still reach the real
  // endpoint. A successful login must not fail a5-second UI assertion while
  // its actual landing request is still pending.
  await page.route(url => url.origin === new URL(BASE_URL).origin && url.pathname === '/', async route => {
    heldNavigations += 1;
    await new Promise(resolve => setTimeout(resolve, 6500));
    await route.continue();
  });
  try {
    await loginThroughUi(page, account);
    await expect(page).toHaveURL(new URL('/', BASE_URL).toString());
    await expect(page.getByRole('heading', { name: '首页', level: 1, exact: true })).toBeVisible();
    expect(heldNavigations).toBeGreaterThan(0);
    expect(submissions).toBe(1);
    expect(statuses).toEqual([200]);
  } finally {
    await testInfo.attach('student-navigation-observation', {
      body: Buffer.from(JSON.stringify({ submissions, statuses, heldNavigations })),
      contentType: 'application/json',
    });
  }
});
