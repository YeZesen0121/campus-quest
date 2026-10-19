import { expect, test } from './fixtures';
import { authenticate, SHOTS } from './shot-surfaces';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated staff world');

// Approved teacher review metadata is 12px; the administrator default stays
// 13px. Both remain independent of the denser 11px student inbox timestamp.
for (const [name, fontSize] of [['teacher-reviews', '12px'], ['admin-users', '13px']] as const) {
  test(`growth styles keep approved staff timestamp typography: ${name}`, async ({ page }) => {
    const shot = SHOTS.find((surface) => surface.name === name)!;
    await authenticate(page, shot.auth);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(new URL(shot.path!, process.env.CQ_E2E_BASE_URL ?? 'https://localhost:3000').toString());
    const timestamp = page.locator('main .notif-time').first();
    await expect(timestamp).toBeVisible();
    await expect(timestamp).toHaveCSS('font-size', fontSize);
  });
}
