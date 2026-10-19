import { BASE_URL, ensureStudentLogin, expect, test } from './fixtures';
import type { Locator } from '@playwright/test';

async function sourceLabelPaint(label: Locator) {
  return label.evaluate(element => {
    const style = getComputedStyle(element), canvas = document.createElement('canvas').getContext('2d')!;
    const rgb = (color: string) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = color; canvas.fillRect(0, 0, 1, 1); return Array.from(canvas.getImageData(0, 0, 1, 1).data).join(','); };
    return { ink: rgb(style.color), ground: rgb(style.backgroundColor), borderInk: rgb(style.borderTopColor), border: style.borderTopWidth, padding: style.padding, font: style.fontSize, weight: style.fontWeight, radius: style.borderRadius };
  });
}

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated student world');

for (const width of [320, 390, 800, 1440]) {
  test(`growth reference: compact rewards, ranking, inbox and profile at ${width}px`, async ({ page }, testInfo) => {
    const noOverflow = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const capture = async (name: string) => {
      await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif;--font-mono:"Liberation Mono",monospace}' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    };
    await page.setViewportSize({ width, height: 900 });
    await ensureStudentLogin(page);
    await page.goto(`${BASE_URL}/dev/gallery`);
    const initialDialog = page.getByRole('dialog', { name: '确认操作', exact: true });
    await expect(initialDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(initialDialog).toHaveCount(0);
    await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif;--font-mono:"Liberation Mono",monospace}' });
    await page.evaluate(() => document.fonts.ready);
    const rewards = page.getByRole('region', { name: '奖励卡片', exact: true });
    const first = rewards.locator('.reward-card').first();
    await expect(first.locator('.reward-card-title')).toHaveCSS('font-size', `${width < 640 ? 17 : 18}px`);
    await expect(first.locator('.reward-card-title')).toHaveCSS('font-weight', '400');
    const price = (await first.locator('.reward-price').boundingBox())!;
    const button = first.getByRole('button', { name: '兑换', exact: true });
    const action = (await button.boundingBox())!;
    expect(Math.abs(price.y + price.height / 2 - action.y - action.height / 2)).toBeLessThanOrEqual(2);
    expect(action.height).toBeGreaterThanOrEqual(44);
    expect(action.width).toBe(width < 360 ? 60 : width < 640 ? 64 : 66);
    const insufficient = rewards.locator('.reward-card').filter({ has: page.locator('.reward-cta-note') });
    await expect(insufficient.getByRole('button', { name: '兑换', exact: true })).toBeDisabled();
    await expect(insufficient).toContainText('还差 20 积分');
    await expect(rewards.locator('.reward-unavailable')).toHaveCount(2);

    const board = page.getByRole('region', { name: '排行榜行', exact: true });
    const row = board.locator('.board-row').first();
    expect((await row.boundingBox())!.height).toBeCloseTo(width < 640 ? 36 : 35, 0);
    const name = (await row.locator('.board-nick-name').boundingBox())!;
    const honor = (await row.locator('.board-honor').boundingBox())!;
    expect(honor.x).toBeGreaterThan(name.x + name.width);
    expect(Math.abs(honor.y - name.y)).toBeLessThanOrEqual(6);
    const ownRankPaint = await sourceLabelPaint(board.locator('.board-me-tag').first());
    expect.soft({ ink: ownRankPaint.ink, ground: ownRankPaint.ground, border: ownRankPaint.border, padding: ownRankPaint.padding, font: ownRankPaint.font, weight: ownRankPaint.weight, radius: ownRankPaint.radius }, 'rank self label has its own source recipe').toEqual({ ink: '36,79,135,255', ground: '213,224,231,255', border: '0px', padding: '1px 5px', font: '10px', weight: '500', radius: '3px' });

    const inbox = page.getByRole('region', { name: '通知行', exact: true });
    await expect.soft(inbox.locator('.notif-icon svg')).toHaveCount(await inbox.locator('.notif-icon').count());
    await expect.soft(inbox.locator('.notif-icon').first()).toHaveCSS('border-top-width', '1px');
    await expect(inbox.locator('.notif-item[data-read="false"]').first()).toHaveCSS('background-color', 'rgb(248, 246, 240)');
    await expect(inbox.locator('.notif-unread-badge').first()).toHaveText('未读');
    expect((await inbox.getByRole('button', { name: '标为已读', exact: true }).first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const noticeTime = inbox.locator('.notif-time').first();
    const noticeBadge = inbox.locator('.notif-unread-badge').first();
    await expect.soft(noticeTime).toHaveCSS('font-size', `${width < 640 ? 11 : 12}px`);
    await expect.soft(noticeBadge).toHaveCSS('font-size', '10px');
    await expect.soft(noticeBadge).toHaveCSS('border-radius', '3px');
    expect.soft(await sourceLabelPaint(noticeBadge), 'unread label keeps its source transparent framed recipe').toEqual({ ink: '60,99,132,255', ground: '0,0,0,0', borderInk: '185,198,205,255', border: '1px', padding: width < 640 ? '0px 4px' : '1px 5px', font: '10px', weight: '500', radius: '3px' });
    const noticeTypeBox = (await inbox.locator('.notif-type').first().boundingBox())!;
    const noticeTimeBox = (await noticeTime.boundingBox())!;
    if (width < 360) expect.soft(noticeTimeBox.y).toBeGreaterThanOrEqual(noticeTypeBox.y + noticeTypeBox.height);
    else expect.soft(Math.abs(noticeTimeBox.y - noticeTypeBox.y)).toBeLessThanOrEqual(3);
    const longMessage = inbox.locator('.notif-item').filter({ hasText: '第三段补充' }).locator('.notif-body');
    expect(await longMessage.evaluate(node => node.scrollHeight <= node.clientHeight)).toBe(true);

    const boundaries = page.getByRole('region', { name: '成长边界示例', exact: true });
    await expect.soft(boundaries.locator('.growth-honor-icon svg')).toHaveCount(await boundaries.locator('.honor-row').count());
    await expect(boundaries.getByRole('group', { name: '零余额与透支', exact: true })).toContainText('当前积分透支 20');
    await expect(boundaries.getByRole('group', { name: '极大余额与冻结', exact: true })).toContainText('999999999899');
    await expect(boundaries.getByRole('group', { name: '极大余额与冻结', exact: true })).toContainText('100 积分冻结');
    await expect(boundaries.getByRole('group', { name: '空成长', exact: true })).toContainText('还没有获得荣誉');
    const emptyGrowth = boundaries.getByRole('group', { name: '空成长', exact: true }).locator('.empty-state');
    await expect.soft(emptyGrowth).toHaveCSS('text-align', 'start');
    await expect.soft(emptyGrowth).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect.soft(emptyGrowth).toHaveCSS('padding-left', '0px');
    await expect.soft(emptyGrowth).toHaveCSS('min-height', '230px');
    await expect.soft(emptyGrowth.locator('.empty-title')).toHaveCSS('font-size', '17.55px');
    await expect.soft(boundaries.getByRole('group', { name: '空成长', exact: true }).getByRole('heading', { name: '获得的荣誉', exact: true })).toHaveCSS('font-size', `${width < 640 ? 18 : 19}px`);

    const signalInks = await boundaries.locator('.stat-focus,.metric-value').evaluateAll(nodes => nodes.map(node => {
      const ctx = document.createElement('canvas').getContext('2d')!;
      ctx.fillStyle = getComputedStyle(node).color; ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).join(',');
    }));
    expect.soft(signalInks.length).toBeGreaterThan(10);
    expect.soft(signalInks.every(ink => ink === '38,40,32')).toBe(true);

    await expect(boundaries.getByRole('group', { name: '有荣誉的成长', exact: true })).toContainText('2026年10月15日');
    expect(await boundaries.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await noOverflow();
    for (const [name, region] of [['reward-states', rewards], ['ranking-states', board], ['notification-states', inbox], ['growth-boundaries', boundaries]] as const) {
      await region.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`) });
    }

    for (const path of ['/rewards', '/rankings', '/notifications', '/profile']) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', `${width < 360 ? 29 : width < 640 ? 31 : 37}px`);
      if (path === '/profile') await expect(page.getByRole('region', { name: '获得的荣誉', exact: true })).toBeVisible();
      else if (path === '/rewards') await expect(page.locator('.reward-card').first()).toBeVisible();
      else await expect(page.locator('main .skeleton')).toHaveCount(0);
      await noOverflow();
      await capture(path.slice(1));
      if (path === '/rewards') {
        const shelf = page.getByRole('region', { name: '奖励货架', exact: true });
        await expect.soft(shelf.getByRole('heading', { name: '奖励货架', exact: true })).toHaveCSS('font-size', `${width < 640 ? 18 : 19}px`);

        const card = shelf.locator('.reward-card').first();
        const bounds = (await card.boundingBox())!;
        const area = (await shelf.boundingBox())!;
        expect(bounds.x).toBeCloseTo(area.x, 0);
        if (width < 640) expect(bounds.width).toBeCloseTo(area.width, 0);
        const redeem = card.getByRole('button', { name: '兑换', exact: true });
        await redeem.click();
        const dialog = page.getByRole('dialog', { name: '确认兑换', exact: true });
        await expect(dialog).toBeVisible();
        const dialogBounds = (await dialog.boundingBox())!;
        expect(dialogBounds.width).toBeCloseTo(Math.min(465, width - 32), 0);
        expect(dialogBounds.x).toBeGreaterThanOrEqual(16);
        expect(dialogBounds.y).toBeGreaterThanOrEqual(0);
        expect(dialogBounds.height).toBeLessThanOrEqual(900);
        await expect(dialog.getByRole('button', { name: '确认兑换', exact: true })).toBeFocused();
        await page.screenshot({ path: testInfo.outputPath(`redeem-confirm-${width}.png`), fullPage: false });
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(redeem).toBeFocused();
      } else if (path === '/rankings') {
        const layout = page.locator('.rank-layout');
        expect.soft(await layout.getByRole('heading', { level: 2 }).evaluateAll(nodes => nodes.every(node => getComputedStyle(node).fontSize === '18px'))).toBe(true);

        if (width >= 640) {
          const metric = await layout.evaluate(node => {
            const parent = node.getBoundingClientRect();
            const children = [...node.children].map(child => child.getBoundingClientRect());
            const pseudo = getComputedStyle(node, '::before');
            return { actual: parent.x + parseFloat(pseudo.left), expected: (children[0].right + children[1].left) / 2, display: pseudo.display };
          });
          expect(metric.display).toBe('block');
          expect(metric.actual).toBeCloseTo(metric.expected, 0);
        } else expect(await layout.evaluate(node => getComputedStyle(node, '::before').display)).toBe('none');
      } else if (path === '/profile') {

        await expect.soft(page.getByRole('region', { name: '我的成长', exact: true }).getByRole('heading', { name: '我的成长', exact: true })).toHaveCSS('font-size', '18px');
        const management = page.getByRole('navigation', { name: '本人双创管理', exact: true });
        const tabs = page.getByRole('navigation', { name: '个人主页分区', exact: true });
        expect.soft((await management.boundingBox())!.y + (await management.boundingBox())!.height).toBeLessThanOrEqual((await tabs.boundingBox())!.y);
        await expect(management.getByRole('link', { name: '我的项目', exact: true })).toHaveAttribute('href', '/profile/project-drafts');
        await expect(management.getByRole('link', { name: '负责人资料与资格', exact: true })).toHaveAttribute('href', '/profile/owner-profile');
        await expect(management.getByRole('link', { name: '我的人才档案', exact: true })).toHaveAttribute('href', '/profile/talent-profile');
        const exit = page.getByRole('region', { name: '退出当前账号', exact: true }).getByRole('link', { name: '退出登录', exact: true });
        await exit.focus();
        expect(await exit.evaluate(node => {
          const box = node.getBoundingClientRect();
          const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
          return hit !== null && node.contains(hit);
        })).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`profile-exit-viewport-${width}.png`), fullPage: false });
      }
    }
    await page.goto(`${BASE_URL}/profile?tab=info`);
    await expect(page.getByRole('region', { name: '昵称', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: '我的成长', exact: true })).toHaveCount(0);
    await noOverflow();
  });
}
