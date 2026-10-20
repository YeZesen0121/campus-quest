import { BASE_URL, expect, staffLogin, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated integration world');

for (const width of [320, 390]) {
  test(`batch selection preserves readable account record fields at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await staffLogin(page, process.env.CQ_E2E_ADMIN!, process.env.CQ_E2E_ADMIN_TOTP_SECRET!);
    await page.goto(`${BASE_URL}/admin/users`);
    const table = page.getByRole('table', { name: '账号列表', exact: true });
    await expect(table.getByRole('checkbox').first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const rows = table.locator('tbody tr');
    const geometry = await rows.evaluateAll(elements => elements.map(row => {
      const bounds = row.getBoundingClientRect();
      return { row: bounds.toJSON(), cells: Array.from(row.querySelectorAll('td')).map(cell => ({
        label: cell.dataset.label ?? '', rect: cell.getBoundingClientRect().toJSON(),
      })) };
    }));
    for (const record of geometry) {
      for (const cell of record.cells) {
        expect.soft(cell.rect.left, cell.label).toBeGreaterThanOrEqual(record.row.left - 1);
        expect.soft(cell.rect.right, cell.label).toBeLessThanOrEqual(record.row.right + 1);
        if (cell.label === '角色' || cell.label === '状态') {
          expect.soft(cell.rect.width, `${cell.label} keeps readable width`).toBeGreaterThanOrEqual(36);
        }
      }
      for (let i = 0; i < record.cells.length; i++) for (let j = i + 1; j < record.cells.length; j++) {
        const a = record.cells[i], b = record.cells[j];
        const horizontal = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const vertical = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        expect.soft(horizontal <= 1 || vertical <= 1, `${a.label} and ${b.label} do not overlap`).toBe(true);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath('account-mobile-records.png'), fullPage: true });
  });
}
