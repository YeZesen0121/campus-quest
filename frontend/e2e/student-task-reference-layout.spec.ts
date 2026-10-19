// Approved student-task layout contracts. Read existing seeded claims only;
// the existing allocation journey owns the shared task's single mutation.
import { BASE_URL, ensureStudentLogin, expect, test } from './fixtures';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated student world');

for (const width of [320, 390, 800, 1440]) {
  test(`student task reference: discovery, decision and assigned work at ${width}px`, async ({ page }, testInfo) => {
    const capture = async (name: string, fullPage = true) => {
      await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif;--font-mono:"Liberation Mono",monospace}' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished.catch(() => undefined)));
      });
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage });
    };
    const task = process.env.CQ_E2E_TASK_URL;
    const claim = process.env.CQ_E2E_CLAIM_PATH;
    if (!task || !claim) throw new Error('The isolated student task and own claim are required');
    await page.setViewportSize({ width, height: 900 });
    await ensureStudentLogin(page);
    await page.goto(`${BASE_URL}/tasks`);
    const cards = page.locator('.task-card');
    await expect(cards.first()).toBeVisible();
    const heading = cards.first().getByRole('heading', { level: 2 });
    await expect(heading).toBeVisible();
    // The first cards enter with different delays. Measure their final grid
    // positions after those finite animations, as the capture below does.
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().iterations)).map(animation => animation.finished.catch(() => undefined)));
    });
    const title = await heading.evaluate(node => ({ size: getComputedStyle(node).fontSize, weight: getComputedStyle(node).fontWeight }));
    expect(title).toEqual({ size: `${width < 360 ? 17 : width <= 1023 ? 18 : 19}px`, weight: '400' });
    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;
    if (width < 640) expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    else {
      expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
      expect(second.x).toBeGreaterThan(first.x + first.width);
    }
    expect(await cards.first().locator('.task-card-reward strong').evaluate(node => getComputedStyle(node).fontSize)).toBe(width < 640 ? '20px' : '21px');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture('task-discovery');

    await page.goto(task);
    const decision = page.locator('.task-decision');
    await expect(page.getByRole('button', { name: '领取任务', exact: true })).toBeVisible();
    const description = (await page.getByRole('region', { name: '任务说明', exact: true }).boundingBox())!;
    const facts = (await decision.boundingBox())!;
    const lastFact = (await decision.locator('.fact-row').last().boundingBox())!;
    const claimAction = (await page.getByRole('button', { name: '领取任务', exact: true }).boundingBox())!;
    expect(claimAction.y).toBeGreaterThanOrEqual(lastFact.y + lastFact.height);
    if (width < 640) expect(facts.y).toBeGreaterThanOrEqual(description.y + description.height);
    else {
      expect(facts.width).toBeCloseTo(width <= 1023 ? 255 : 280, 0);
      expect(facts.x).toBeGreaterThan(description.x + description.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture('task-detail');
    const action = page.getByRole('button', { name: '领取任务', exact: true });
    await action.scrollIntoViewIfNeeded();
    expect(await action.evaluate(node => {
      const box = node.getBoundingClientRect();
      const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return target !== null && node.contains(target);
    })).toBe(true);
    await capture('task-action-viewport', false);

    // Read the seeded own claim only. Do not claim the shared task here:
    // existing task-claim journeys deliberately own that single mutation.
    await page.goto(new URL(claim, BASE_URL).toString());
    await expect(page.getByRole('region', { name: '分配给你的任务单元', exact: true })).toBeVisible();
    const steps = page.getByRole('list', { name: '进度', exact: true });
    await expect(steps.getByRole('listitem')).toHaveCount(5);
    await expect(steps.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', /\.csv/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture('own-claim');
    const fileInput = page.locator('#submission-file');
    await fileInput.focus();
    await expect(fileInput).toBeFocused();
    await expect.poll(() => page.locator('label[for="submission-file"]').evaluate(node => {
      const box = node.getBoundingClientRect();
      const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return target !== null && node.contains(target);
    })).toBe(true);
    await capture('file-picker-focused-viewport', false);

    await page.goto(`${BASE_URL}/`);
    const hero = page.getByRole('region', { name: '当前最重要', exact: true });
    await expect(hero.getByRole('link', { name: /继续提交|去修改提交/ })).toBeVisible();
    if (width < 640) {
      const metrics = await hero.evaluate(node => {
        const action = node.querySelector('.hero-cta')!;
        const styles = getComputedStyle(node);
        const bottom = node.querySelector('.hero-bottom')!;
        return { expected: node.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight), actual: action.getBoundingClientRect().width, bottomWidth: bottom.getBoundingClientRect().width, alignSelf: getComputedStyle(action).alignSelf, bottomDisplay: getComputedStyle(bottom).display };
      });
      await testInfo.attach('home-action-geometry', { body: JSON.stringify(metrics), contentType: 'application/json' });
      expect(metrics.actual).toBeCloseTo(metrics.expected, 0);
    }
    await expect(page.getByRole('region', { name: '积分与奖励', exact: true }).getByText('可用积分', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture('student-home');

    // The existing filled fixtures compose the same real community controls.
    // Close only the gallery's example dialog before inspecting this region.
    await page.goto(`${BASE_URL}/dev/gallery`);
    const initialDialog = page.getByRole('dialog', { name: '确认操作', exact: true });
    await expect(initialDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(initialDialog).toHaveCount(0);
    const community = page.getByRole('region', { name: '评论区', exact: true });
    await expect(community.locator('.comment-tombstone-text')).toBeVisible();
    await expect(community.locator('.comment-tombstone + .comment-depth-2')).toContainText('楼上说的方法亲测有效');
    await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif;--font-mono:"Liberation Mono",monospace}' });
    await page.evaluate(() => document.fonts.ready);
    expect(await community.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await community.screenshot({ path: testInfo.outputPath(`community-filled-${width}.png`) });
  });
}
test('final visual refinement: student headings, return affordance and unselected rating', async ({ page }, info) => {
  await ensureStudentLogin(page);
  for (const width of [320, 390, 800, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, title, subtitle] of [
      ['/', '首页', null],
      ['/rewards', '积分奖励', '把每一次完成，积累成下一份奖励。'],
      ['/rankings', '排行榜', '每一次认真完成，都在积累。'],
      ['/profile', '我的档案', '每一次完成，都是成长的一部分。'],
    ]) {
      await page.goto(`${BASE_URL}${path}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!);
      if (subtitle) await expect(page.locator('.page-subtitle').first()).toHaveText(subtitle);
      if (path === '/') {
        await expect(page.locator('.hero-cta svg[aria-hidden="true"]')).toBeVisible();
        await expect(page.getByRole('region',{name:'最新任务',exact:true}).getByRole('link',{name:'查看全部',exact:true}).locator('svg[aria-hidden="true"]')).toBeVisible();
        const rows=page.getByRole('region',{name:'我的任务',exact:true}).locator('.claim-row-link');
        for (const row of await rows.all()) await expect(row.locator('svg[aria-hidden="true"]')).toBeVisible();
      }
      if (path === '/rankings') await expect(page.getByRole('link',{name:'查看我的附近',exact:true}).locator('svg[aria-hidden="true"]')).toBeVisible();
      if (path === '/profile') {
        const month=page.getByRole('link',{name:'查看月榜',exact:true});
        await expect(month).toHaveAttribute('href','/rankings?period=monthly');
        await expect(month.locator('svg[aria-hidden="true"]')).toBeVisible();
        if (width === 390) {
          await month.click();
          await expect(page).toHaveURL(/period=monthly/);
          await expect(page.getByRole('link',{name:'本月榜',exact:true})).toHaveAttribute('aria-current','page');
          await page.goto(`${BASE_URL}/profile`);
        }
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath(`${path === '/' ? 'home' : path.slice(1)}-${width}.png`), fullPage: true });
    }
    await page.goto(`${BASE_URL}/profile?tab=info`);
    await expect(page.locator('.page-subtitle').first()).toHaveText('成长数据、获得的荣誉与个人信息');
    const task = process.env.CQ_E2E_TASK_URL;
    if (!task) throw new Error('Isolated task is required');
    await page.goto(task);
    const back = page.getByRole('link', { name: '返回任务列表', exact: true });
    await expect(back.locator('[aria-hidden="true"]')).toHaveText('←');
    const stars = page.locator('.star-glyph');
    await expect(stars).toHaveCount(5);
    await expect(stars.first()).toHaveText('☆');
    await expect(page.locator('.star-option input').first()).not.toBeChecked();
    await page.screenshot({ path: info.outputPath(`task-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
