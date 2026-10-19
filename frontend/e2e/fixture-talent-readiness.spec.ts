import type { Page } from '@playwright/test';
import { API_URL, expect, test } from './fixtures';
import { TALENT_OWN, editor, ownRecord, ownerHeaders, prepareTalent } from './talent-helpers';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated student world');
// Budget only these new fault-injection scenarios for real seed/reset work,
// delayed sequential reads and cleanup; the helper's UI assertions stay5s.
test.describe.configure({ timeout: 120_000 });

async function delayInitialReads(page: Page) {
  const paths = new Set(['/api/v1/ie/talent-tags', '/api/v1/ie/me/talent-profile', '/api/v1/ie/me/talent-profile/files']);
  const reads: string[] = [];
  await page.route(url => paths.has(url.pathname), async route => {
    if (route.request().method() === 'GET') {
      reads.push(new URL(route.request().url()).pathname);
      // Controlled latency in real responses, beyond the old five-second
      // editor assertion; no fake profile, tags, file list or identity.
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
    if (!page.isClosed()) await route.continue();
  });
  return reads;
}

test('talent fixture waits for initial reads when no draft exists', async ({ page }) => {
  expect(await ownRecord(page), 'the isolated world starts without a talent draft').toBeNull();
  const reads = await delayInitialReads(page);
  await prepareTalent(page);
  await expect(editor(page).getByLabel('一句话介绍', { exact: true })).toBeVisible();
  expect(reads).toContain('/api/v1/ie/talent-tags');
  expect(reads).toContain('/api/v1/ie/me/talent-profile');
  expect(reads).not.toContain('/api/v1/ie/me/talent-profile/files');
});

test('talent fixture also waits for dependent files when a draft exists', async ({ page }) => {
  const created = await page.request.put(`${API_URL}${TALENT_OWN}`, {
    headers: ownerHeaders(),
    data: { request_id: crypto.randomUUID(), version: 0, fields: { headline: '模拟就绪检查档案' } },
  });
  expect(created.status()).toBe(200);
  const reads = await delayInitialReads(page);
  await prepareTalent(page);
  await expect(editor(page).getByLabel('一句话介绍', { exact: true })).toBeVisible();
  expect(reads).toContain('/api/v1/ie/me/talent-profile/files');
});
