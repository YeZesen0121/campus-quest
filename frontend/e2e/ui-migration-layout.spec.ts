import { BASE_URL, expect, test } from './fixtures';
import type { Page } from '@playwright/test';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the owned UI test world');

async function openGallery(page: Page) {
  await page.goto(`${BASE_URL}/dev/gallery`);
  const initial = page.getByRole('dialog', { name: '确认操作', exact: true });
  await expect(initial).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(initial).toHaveCount(0);
  const fixture = page.getByRole('region', { name: '共享视觉基础', exact: true });
  await expect(fixture).toBeVisible();
  return fixture;
}

for (const width of [320, 390, 639, 640, 800, 1440]) {
  test(`shared foundation: real controls and unequal sections at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = await openGallery(page);
    const divided = fixture.getByRole('group', { name: '独立分区示例' }).locator('.cq-divided-sections');
    const left = await fixture.getByRole('region', { name: '基础填写区' }).boundingBox();
    const right = await fixture.getByRole('region', { name: '补充说明区' }).boundingBox();
    expect(left).not.toBeNull(); expect(right).not.toBeNull();
    const line = await divided.evaluate(element => {
      const style = getComputedStyle(element, '::before');
      return { display: style.display, height: Number.parseFloat(style.height), left: Number.parseFloat(style.left), width: element.getBoundingClientRect().width };
    });
    if (width < 640) {
      expect(right!.y).toBeGreaterThanOrEqual(left!.y + left!.height);
      expect(line.display).toBe('none');
    } else {
      expect(Math.abs(left!.y - right!.y)).toBeLessThanOrEqual(1);
      expect(right!.x).toBeGreaterThan(left!.x + left!.width);
      expect(Math.abs(left!.height - right!.height)).toBeGreaterThan(40);
      expect(line.display).toBe('block');
      expect(line.height).toBeCloseTo(Math.max(left!.height, right!.height), 0);
      expect(line.left).toBeCloseTo(line.width / 2, 0);
    }
    for (const field of [fixture.getByLabel('示例姓名', { exact: true }), fixture.getByText('示例姓名', { exact: true })]) {
      expect(await field.evaluate(element => getComputedStyle(element).fontSize)).toBe('14px');
    }
    const ordinary = fixture.getByRole('group', { name: '普通字段对' });
    expect(await ordinary.evaluate(element => getComputedStyle(element, '::before').content)).toBe('none');
    const actions = fixture.getByRole('group', { name: '相邻操作示例' });
    const buttons = await actions.getByRole('button').all();
    const boxes = [];
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
      boxes.push(box!);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlap = Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) && Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
      expect(overlap).toBe(false);
    }
    const save = actions.getByRole('button', { name: '保存示例', exact: true });
    const frame = await save.evaluate(element => ({ hit: element.getBoundingClientRect().height, visible: Number.parseFloat(getComputedStyle(element, '::before').height) }));
    expect(frame.visible).toBeGreaterThanOrEqual(28);
    expect(frame.visible).toBeLessThanOrEqual(36);
    expect(frame.visible).toBeLessThan(frame.hit);
    const table = fixture.getByRole('table', { name: '状态列示例' });
    expect(await table.getByRole('columnheader', { name: '状态', exact: true }).evaluate(element => getComputedStyle(element).textAlign)).toBe('center');
    expect(await table.getByRole('cell', { name: '待完善', exact: true }).evaluate(element => getComputedStyle(element).textAlign)).toBe('center');
    expect(await table.getByRole('cell', { name: '模拟资料', exact: true }).evaluate(element => getComputedStyle(element).textAlign)).not.toBe('center');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('shared foundation: compact frame keeps its full touch target and long labels wrap', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const fixture = await openGallery(page);
  const save = fixture.getByRole('button', { name: '保存示例', exact: true });
  await save.scrollIntoViewIfNeeded();
  const box = (await save.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + 1);
  await expect(fixture.getByRole('status', { name: '共享示例结果' })).toHaveText('示例已保存');
  const long = fixture.getByRole('button', { name: /^保存这份包含很长中文名称/ });
  expect(await long.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shared foundation: field associations and keyboard dialog focus survive', async ({ page }) => {
  const fixture = await openGallery(page);
  const input = fixture.getByLabel('示例邮箱', { exact: true });
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute('aria-describedby', /ui-migration-email-error.*ui-migration-email-hint/);
  const trigger = fixture.getByRole('button', { name: '打开共享弹窗', exact: true });
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: '共享弹窗示例', exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  const outline = await trigger.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, width: Number.parseFloat(getComputedStyle(element).outlineWidth) }));
  expect(outline.style).not.toBe('none'); expect(outline.width).toBeGreaterThanOrEqual(2);
});

test('shared foundation: reduced motion removes visual frame transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const fixture = await openGallery(page);
  const durations = await fixture.getByRole('button', { name: '保存示例', exact: true }).evaluate(element => getComputedStyle(element, '::before').transitionDuration.split(',').map(value => Number.parseFloat(value)));
  expect(durations.every(value => value === 0)).toBe(true);
});

test('approved source paint: workflow tags stay neutral and destructive triggers keep quiet frames', async ({ page }, info) => {
  // Actual approved64-scene source probe: workflow .ie-tag variants are neutral;
  // purpose-specific blue tags and the unread/rank labels have separate owners.
  for (const width of [320, 390, 800, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openGallery(page);
    for (const tone of ['info', 'success', 'warning', 'danger', 'muted']) {
      const badge = page.locator(`.badge-${tone}`).first();
      const paint = await badge.evaluate(element => {
        const style = getComputedStyle(element);
        const canvas = document.createElement('canvas').getContext('2d')!;
        const rgb = (color: string) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = color; canvas.fillRect(0, 0, 1, 1); return Array.from(canvas.getImageData(0, 0, 1, 1).data).join(','); };
        return { ink: rgb(style.color), ground: rgb(style.backgroundColor), font: style.fontSize, weight: style.fontWeight, line: style.lineHeight, padding: style.padding, radius: style.borderRadius, border: style.borderTopWidth };
      });
      expect.soft(paint, `${tone}/${width}: approved workflow tag paint`).toEqual({ ink: '95,104,85,255', ground: '232,233,223,255', font: '11px', weight: '400', line: '17.6px', padding: '2px 6px', radius: '3px', border: '0px' });
    }
    const destructive = page.getByRole('button', { name: '危险操作', exact: true });
    for (const hover of [false, true]) {
      if (hover) await destructive.hover();
      const paint = await destructive.evaluate(element => {
        const style = getComputedStyle(element), frame = getComputedStyle(element, '::before');
        const canvas = document.createElement('canvas').getContext('2d')!;
        const rgb = (color: string) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = color; canvas.fillRect(0, 0, 1, 1); return Array.from(canvas.getImageData(0, 0, 1, 1).data).join(','); };
        return { ink: rgb(style.color), ground: rgb(frame.backgroundColor), border: frame.borderTopStyle, target: element.getBoundingClientRect().height };
      });
      expect.soft(paint.ink, `quiet destructive ink/${width}/${hover}`).toBe('69,72,63,255');
      expect.soft(paint.ground, `quiet destructive ground/${width}/${hover}`).toBe('253,252,248,255');
      expect.soft(paint.border).toBe('solid');
      expect.soft(paint.target).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: info.outputPath(`source-paint-${width}.png`), fullPage: true });
  }
});
