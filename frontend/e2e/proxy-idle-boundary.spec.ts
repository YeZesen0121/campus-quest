import { expect, test } from '@playwright/test';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the orchestrated API proxy');

const base = process.env.CQ_E2E_BASE_URL ?? 'https://localhost:3000';

// The client overhead places these requests on both sides of Uvicorn's
// five-second idle boundary. A retired pooled connection must never turn
// the real anonymous 401 into a proxy 500. Every request runs exactly once.
for (const idleMs of [4940, 4955, 4965, 4975]) {
  test(`API proxy preserves the anonymous verdict at the ${idleMs}ms idle boundary`, async ({ request }, info) => {
    const statuses: { elapsedMs: number; status: number }[] = [];
    const start = Date.now();
    try {
      for (let n = 0; n < 9; n += 1) {
        if (n) await new Promise(resolve => setTimeout(resolve, idleMs));
        const response = await request.get(`${base}/api/v1/me`);
        statuses.push({ elapsedMs: Date.now() - start, status: response.status() });
        expect(response.status()).toBe(401);
      }
    } finally {
      await info.attach('idle-boundary-statuses', { body: JSON.stringify(statuses), contentType: 'application/json' });
    }
  });
}
