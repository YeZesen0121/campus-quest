import type { Locator, Page, TestInfo } from '@playwright/test';
import { readSourceTagPaint, readControlClearance, API_URL, BASE_URL, ensureStudentLogin, expect, mintToken, test } from './fixtures';
import { prepare, fillRole, publish } from './recruitment-helpers';
import { editor as talentEditor, prepareTalent, fillTalent, saveTalent, publishTalent, uploadTalent } from './talent-helpers';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated campus world');
const widths = [320, 390, 800, 1440];
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations ?? 1)).map(a => a.finished.catch(() => {})));
  });
}
async function capture(page: Page, info: TestInfo, name: string, width: number, variant?: 'bridge' | 'recruitment') {
  await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif;--font-mono:"Liberation Mono",monospace}' });
  await settle(page); await page.evaluate(() => {
    // Static captures reset focus before moving to the page top. The following
    // natural action must exercise a new focus transition, not a no-op on the
    // previous width's still-focused control after an artificial page scroll.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    window.scrollTo(0, 0);
  });
  const expectedTitle = variant === 'bridge' ? width < 640 ? 29 : width < 1024 ? 32 : 34 : width < 360 ? 28 : width < 640 ? variant === 'recruitment' ? 30 : 31 : 37;
  expect.soft(await page.getByRole('heading', { level: 1 }).evaluate(el => getComputedStyle(el).fontSize)).toBe(`${expectedTitle}px`);
  expect.soft(await page.getByRole('main').evaluate(el => getComputedStyle(el).paddingLeft)).toBe(`${width < 360 ? 14 : width < 640 ? 17 : width < 1024 ? 25 : variant === 'bridge' ? 36 : 42}px`);
  const hasMaintenanceNav = ['owner', 'my-projects', 'project-editor', 'my-achievements', 'talent-editor'].includes(name);
  const maintenanceLinks=page.getByRole('navigation', { name: '本人双创管理', exact: true }).getByRole('link');
  await expect.soft(maintenanceLinks).toHaveText(hasMaintenanceNav ? ['我的项目','协作与交接','负责人资料与资格','我的人才档案'] : []);
  if(hasMaintenanceNav){
    const destinations=['/profile/project-drafts','/profile/collaboration','/profile/owner-profile','/profile/talent-profile'];
    for(const [index,href] of destinations.entries())await expect.soft(maintenanceLinks.nth(index)).toHaveAttribute('href',href);
  }
  expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const state of await page.locator('.campus-private-state').all()) {
    const paint = await readSourceTagPaint(state), publishedTalent = name === 'talent-editor' && await state.getAttribute('data-visible') === 'true';
    expect.soft(paint, `${name}/${width}: actual source private state`).toMatchObject({ ink: publishedTalent ? '53,94,130,255' : '95,104,85,255', ground: publishedTalent ? '231,237,240,255' : '232,233,223,255', border: '0px', padding: '2px 6px', font: name === 'talent-editor' ? '12px' : '11px', weight: '400', radius: '3px' });
  }
  await page.screenshot({ path: info.outputPath(`${name}-${width}.png`), fullPage: true, animations: 'disabled' });
}
async function natural(page: Page, info: TestInfo, control: Locator, name: string, width: number) {
  await settle(page); await control.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await expect.soft(control).toBeFocused();
  const clearance = await readControlClearance(control);
  expect.soft(clearance.ring > 0 && clearance.full && clearance.hit, JSON.stringify(clearance)).toBe(true);
  const box = (await control.boundingBox())!;
  expect.soft(box.width).toBeGreaterThanOrEqual(44); expect.soft(box.height).toBeGreaterThanOrEqual(44);
  if (name.endsWith('-save')) {
    const formWidth = await control.evaluate(el => el.closest('form')!.getBoundingClientRect().width);
    if (name === 'recruitment-save' && width < 640) expect.soft(box.width).toBeGreaterThan(formWidth * 0.9);
    else expect.soft(box.width).toBeLessThan(formWidth * 0.8);
    if (width < 640 && name !== 'recruitment-save') expect.soft(await control.evaluate(el => {
      const paint = getComputedStyle(el, '::before');
      return el.getBoundingClientRect().height - parseFloat(paint.top) - parseFloat(paint.bottom);
    }), 'Compact visible button frame retains the full44px hit target').toBeLessThan(box.height - 1);
  }
  expect.soft(await control.evaluate(el => { const b = el.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return hit === el || el.contains(hit); })).toBe(true);
  await page.screenshot({ path: info.outputPath(`${name}-${width}-natural.png`), animations: 'disabled' });
}
async function boundedContent(control: Locator, width: number) {
  const original = await control.inputValue();
  await control.fill('模拟资料'); const short = (await control.boundingBox())!.height;
  await control.fill('模拟资料，'.repeat(200)); const long = (await control.boundingBox())!.height;
  expect.soft(long, `Textarea expands with content at ${width}px`).toBeGreaterThan(short + 15);
  expect.soft(short).toBeGreaterThanOrEqual(78); expect.soft(long).toBeLessThanOrEqual(240);
  await control.fill(original);
}

for (const width of widths) {
  test(`private reference: owner profile and qualification at ${width}px`, async ({ page }, info) => {
    await ensureStudentLogin(page); await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/profile/owner-profile`);
    const editor = page.getByRole('region', { name: '负责人资料编辑器', exact: true }); await expect(editor).toBeVisible();
    await expect(page.getByRole('status', { name: '负责人资格状态', exact: true })).toBeVisible();
    await capture(page, info, 'owner', width);
    const form = editor.locator('form'), qualification = page.getByRole('region', { name: '负责人资格', exact: true });
    const left = (await form.boundingBox())!, right = (await qualification.boundingBox())!;
    if (width > 850) {
      expect.soft(right.x).toBeGreaterThan(left.x + left.width); expect.soft(left.width / right.width).toBeCloseTo(1.35, 2);
      const ownHeading = (await editor.getByRole('heading', { level: 2 }).first().boundingBox())!, qualificationHeading = (await qualification.getByRole('heading', { name: '负责人资格', exact: true }).boundingBox())!;
      expect.soft(qualificationHeading.y).toBeCloseTo(ownHeading.y, 0);
    }
    else expect.soft(right.y).toBeGreaterThanOrEqual(left.y + left.height);
    expect.soft(await form.evaluate(el => getComputedStyle(el).paddingLeft)).toBe(`${width < 640 ? 14 : 15}px`);
    const name = (await editor.getByLabel('姓名', { exact: true }).boundingBox())!, number = (await editor.getByLabel('学号', { exact: true }).boundingBox())!;
    if (width >= 640) { expect.soft(number.x).toBeGreaterThan(name.x); expect.soft(number.y).toBeCloseTo(name.y, 0); }
    else expect.soft(number.y).toBeGreaterThan(name.y);
    await natural(page, info, editor.getByRole('button', { name: '保存负责人资料', exact: true }), 'owner-save', width);
  });
}

test('private reference: real inline editors, proof ordering and published talent keep their source layout', async ({ page }, info) => {
  test.setTimeout(300_000);
  const projectTitle = '模拟样张维护项目';
  const projectId = await prepare(page, { title: projectTitle, summary: '模拟资料：整理真实问题并保留待核实信息。', direction: '校园服务', stage: '原型验证' });
  await page.goto(`${BASE_URL}/profile/project-drafts`);
  for (const width of widths) { await page.setViewportSize({ width, height: 900 }); await capture(page, info, 'my-projects', width); }
  await page.getByRole('button', { name: `编辑项目：${projectTitle}`, exact: true }).click();
  const project = page.getByRole('region', { name: '项目草稿编辑器', exact: true });
  await project.getByLabel('团队现状', { exact: true }).fill('模拟资料：两位同学分工记录与核对来源。');
  await project.getByRole('button', { name: '保存草稿', exact: true }).click();
  await expect(project.getByRole('status', { name: '项目草稿保存状态', exact: true })).toHaveText('草稿已保存，仅自己可见。');
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await boundedContent(project.getByLabel('项目简介', { exact: true }), width);
    for (const label of ['项目简介', '团队现状']) {
      const field = project.getByLabel(label, { exact: true });
      expect.soft((await field.boundingBox())!.height, 'R5 completion stylesheet keeps the project textarea floor at90px').toBeGreaterThanOrEqual(90);
      expect.soft(await field.evaluate(el => getComputedStyle(el).lineHeight)).toBe('21px');
    }
    await capture(page, info, 'project-editor', width, 'bridge');
    expect.soft(await page.getByRole('heading', { level: 1 }).textContent()).toBe('编辑项目草稿');
    const title = project.getByLabel('项目名称', { exact: true }), direction = project.getByLabel('项目方向', { exact: true });
    const t = (await title.boundingBox())!, d = (await direction.boundingBox())!, summary = (await project.getByLabel('项目简介', { exact: true }).boundingBox())!;
    if (width >= 768) { expect.soft(d.x).toBeGreaterThan(t.x); expect.soft(d.y).toBeCloseTo(t.y, 0); expect.soft(summary.width).toBeGreaterThan(t.width * 1.9); }
    else expect.soft(d.y).toBeGreaterThan(t.y);
    await title.focus(); await page.keyboard.press('Tab'); await expect.soft(direction).toBeFocused();
    const form = project.locator('form').filter({ has: page.getByLabel('项目名称', { exact: true }) }), mentors = project.getByRole('region', { name: '项目导师挂名', exact: true });
    expect.soft((await mentors.boundingBox())!.y).toBeGreaterThanOrEqual((await form.boundingBox())!.y + (await form.boundingBox())!.height);
    expect.soft(await mentors.evaluate(el => el.closest('form') === null)).toBe(true);
    await natural(page, info, project.getByRole('button', { name: '保存草稿', exact: true }), 'project-save', width);
  }
  await project.getByRole('link', { name: '管理成果草稿', exact: true }).click();
  await page.getByRole('button', { name: '新建成果草稿', exact: true }).click();
  const achievement = page.getByRole('region', { name: '成果草稿编辑器', exact: true });
  const achievementTitle = '模拟维护的第一轮来源核对记录';
  await achievement.getByLabel('成果名称', { exact: true }).fill(achievementTitle);
  await achievement.getByLabel('作品与阶段成果说明', { exact: true }).fill('模拟资料：记录第一轮观察，保留原始来源与待核实的问题。');
  await achievement.getByLabel('立项或获奖说明', { exact: true }).fill('模拟资料：暂无奖项。');
  await achievement.getByRole('button', { name: '保存成果草稿', exact: true }).click();
  const review = page.getByRole('region', { name: '成果核实与证明', exact: true });
  await expect(review.getByText('还没有证明材料。', { exact: true })).toBeVisible();
  await review.getByLabel('上传证明材料', { exact: true }).setInputFiles({ name: '模拟维护证明.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n') });
  const proof = review.getByRole('checkbox', { name: '选择证明 1', exact: true }); await expect(proof).toBeEnabled({ timeout: 150_000 }); await proof.check();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await boundedContent(achievement.getByLabel('作品与阶段成果说明', { exact: true }), width);
    await expect.soft(achievement.getByLabel('作品与阶段成果说明', { exact: true })).toHaveAttribute('rows', '2');
    await capture(page, info, 'achievement-editor', width);
    const guidance = achievement.getByRole('navigation', { name: '成果流程指引', exact: true });
    expect.soft(await guidance.count()).toBe(1);
    if (await guidance.count()) {
      const navigation=(await guidance.boundingBox())!, statusBox=(await review.locator('.campus-achievement-status').boundingBox())!, formBox=(await achievement.locator('form').first().boundingBox())!;
      expect.soft(navigation.y,'Approved guidance follows the decision surface').toBeGreaterThanOrEqual(statusBox.y+statusBox.height);
      if(width>=768) expect.soft(navigation.x,'Approved guidance shares the right decision column').toBeGreaterThanOrEqual(formBox.x+formBox.width);
      await expect(guidance.getByRole('link', { name: '校对项目概况（我的项目）', exact: true })).toHaveCount(1);
      await expect.soft(guidance.getByRole('link', { name: '校对项目概况（我的项目）', exact: true })).toHaveAttribute('href', '/profile/project-drafts');
      await expect.soft(guidance.getByRole('link', { name: '负责人资料与资格', exact: true })).toHaveAttribute('href', '/profile/owner-profile');
      const projectLink=(await guidance.getByRole('link', {name:'校对项目概况（我的项目）',exact:true}).boundingBox())!, ownerLink=(await guidance.getByRole('link',{name:'负责人资料与资格',exact:true}).boundingBox())!;
      expect.soft(ownerLink.y,'Each source guidance link occupies its own row').toBeGreaterThanOrEqual(projectLink.y+projectLink.height);
      await expect.soft(guidance).not.toContainText('所属项目：');
    }

    const form = achievement.locator('form').filter({ has: page.getByLabel('成果名称', { exact: true }) });
    const f = (await form.boundingBox())!, material = (await review.getByRole('heading', { name: '私密证明材料', exact: true }).boundingBox())!, status = (await review.getByRole('heading', { name: '核实与公开状态', exact: true }).boundingBox())!;
    if (width >= 768) { expect.soft(status.x).toBeGreaterThan(f.x + f.width); expect.soft(material.x).toBeCloseTo(f.x, 0); }
    else { expect.soft(material.y).toBeGreaterThan(f.y + f.height); expect.soft(status.y).toBeGreaterThan(material.y); }
    await natural(page, info, review.getByLabel('上传证明材料', { exact: true }), 'achievement-upload', width);
  }
  await achievement.getByRole('button', { name: '返回成果列表', exact: true }).click();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 }); await capture(page, info, 'my-achievements', width);
    const create = page.getByRole('button', { name: '新建成果草稿', exact: true });
    expect.soft(await create.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); return new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size; }), 'Create action keeps its complete label on one line').toBe(1);
    if (width === 320) {
      const caption = (await page.getByRole('heading', { name: '私有草稿 · 打开后查看核实与公开状态', exact: true }).boundingBox())!;
      expect.soft((await create.boundingBox())!.y, 'Narrow list header stacks the action below its caption').toBeGreaterThanOrEqual(caption.y + caption.height);
    }
    const title = (await page.getByRole('heading', { name: achievementTitle, exact: true }).boundingBox())!, edit = (await page.getByRole('button', { name: `编辑成果：${achievementTitle}`, exact: true }).boundingBox())!;
    expect.soft(edit.x, 'Editing a long-titled draft stays beside its content').toBeGreaterThan(title.x + title.width - 1);
  }
  await page.goto(`${BASE_URL}/profile/project-drafts/${projectId}/recruitments`);
  const role = await fillRole(page);
  const longRoleTitle = '模拟招募岗位的长标题用于窄屏换行和状态验证'.repeat(3);
  await role.getByLabel('岗位名称', { exact: true }).fill(longRoleTitle);
  await role.getByRole('button', { name: '保存招募草稿', exact: true }).click();
  await expect(page.getByRole('status', { name: '招募操作结果', exact: true })).toContainText('已保存'); await publish(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await boundedContent(role.getByLabel('项目介绍', { exact: true }), width);
    await expect.soft(role.getByLabel('项目介绍', { exact: true })).toHaveAttribute('rows', '3');
    for (const label of ['阶段目标', '初步方案']) await expect.soft(role.getByLabel(label, { exact: true })).toHaveAttribute('rows', '2');
    await capture(page, info, 'recruitment-editor', width, 'recruitment');
    const context = role.locator('.campus-private-context');
    expect.soft(await context.count()).toBe(1);
    if (await context.count()) {
      await expect.soft(context).toHaveText(`${projectTitle} 私有草稿`);
      const c = (await context.boundingBox())!, h = (await role.getByRole('heading', { level: 1 }).boundingBox())!;
      expect.soft(c.y + c.height).toBeLessThanOrEqual(h.y);
    }

    if (width >= 640) {
      const contact = role.getByLabel('微信', { exact: true });
      expect.soft((await contact.boundingBox())!.width, 'Recruitment contact values span the source form width').toBeGreaterThan(await role.locator('form').evaluate(el => el.getBoundingClientRect().width * 0.9));
    }
    const title = (await role.getByLabel('项目名称', { exact: true }).boundingBox())!, a = (await role.getByLabel('项目方向', { exact: true }).boundingBox())!, b = (await role.getByLabel('项目阶段', { exact: true }).boundingBox())!;
    if (width >= 768) { expect.soft(b.x).toBeGreaterThan(a.x); expect.soft(b.y).toBeCloseTo(a.y, 0); expect.soft(title.width).toBeGreaterThan(a.width * 1.9); } else expect.soft(b.y).toBeGreaterThan(a.y);
    if (width < 640) {
      const count = (await role.getByLabel('招募人数', { exact: true }).boundingBox())!, beginner = (await role.getByLabel('零基础友好', { exact: true }).boundingBox())!;
      expect.soft(beginner.x).toBeGreaterThan(count.x); expect.soft(beginner.y).toBeCloseTo(count.y, 0);
      const channels = await role.getByRole('group', { name: '联系授权', exact: true }).getByRole('checkbox').all();
      const first = (await channels[0].locator('..').boundingBox())!, second = (await channels[1].locator('..').boundingBox())!, third = (await channels[2].locator('..').boundingBox())!;
      expect.soft(second.x).toBeGreaterThan(first.x); expect.soft(second.y).toBeCloseTo(first.y, 0);
      expect.soft(third.x).toBeCloseTo(first.x, 0); expect.soft(third.y).toBeGreaterThan(first.y);
    }
    await natural(page, info, role.getByRole('button', { name: '保存招募草稿', exact: true }), 'recruitment-save', width);
  }
  await role.getByRole('button', { name: '返回招募列表', exact: true }).click();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 }); await capture(page, info, 'my-recruitments', width);
    const state = page.locator('.campus-recruitment-overview .campus-private-state');
    expect.soft(await state.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');
    expect.soft(await state.evaluate(el => {
      const range = document.createRange(); range.selectNodeContents(el);
      return new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size;
    })).toBe(1);
  }
  await page.getByRole('button', { name: `编辑招募：${longRoleTitle}`, exact: true }).click();
  await expect(role.getByLabel('岗位名称', { exact: true })).toHaveValue(longRoleTitle);
  await expect(role.getByLabel('项目名称', { exact: true })).toHaveValue('模拟学习实验');
  const loadedContext = role.locator('.campus-private-context');
  expect.soft(await loadedContext.count()).toBe(1);
  if (await loadedContext.count()) await expect.soft(loadedContext).toHaveText(`${projectTitle} 私有草稿`);

  await prepareTalent(page); await fillTalent(page, '模拟维护同学'); await saveTalent(page);
  await (await uploadTalent(page, '模拟维护记录.png')).check(); await saveTalent(page); await publishTalent(page);
  const talent = talentEditor(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await boundedContent(talent.getByLabel('自我介绍', { exact: true }), width);
    await expect.soft(talent.getByText('标准技能标签', { exact: true })).toBeVisible();
    const choices = talent.locator('.ie-talent-choices > label');
    expect.soft(await choices.first().evaluate(el => getComputedStyle(el).fontSize)).toBe('13px');
    if (width === 320) {
      const first = (await choices.nth(0).boundingBox())!, third = (await choices.nth(2).boundingBox())!;
      expect.soft(third.y, 'Approved compact skill choices keep three labels on the first narrow row').toBeCloseTo(first.y, 0);
    }
    await capture(page, info, 'talent-editor', width);
    expect.soft(await talent.locator('form.ie-draft-form').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect.soft(await talent.getByLabel('展示姓名', { exact: true }).evaluate(el => el.tagName)).toBe('INPUT');
    expect.soft(await talent.getByRole('group', { name: '基本资料', exact: true }).count()).toBe(1);
    expect.soft(await talent.getByRole('group', { name: '技能与补充', exact: true }).count()).toBe(1);
    for (const label of ['自我介绍', '我的优势', '实践经历']) expect.soft(await talent.getByLabel(label, { exact: true }).getAttribute('rows')).toBe('2');
    expect.soft(await talent.getByLabel('展示姓名', { exact: true }).locator('..').locator('.field-counter').count()).toBe(0);
    const addLink = talent.getByRole('button', { name: '添加作品链接', exact: true });
    expect.soft((await addLink.boundingBox())!.width).toBeLessThan(await addLink.evaluate(el => el.closest('fieldset')!.getBoundingClientRect().width * 0.8));
    const ownDownload = talent.getByRole('button', { name: '本人下载 模拟维护记录.png', exact: true });
    await expect.soft(ownDownload).toHaveText('本人下载');
    expect.soft(await talent.getByLabel('选择作品或证明文件', { exact: true }).evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
    if (width >= 768) {
      const fileLabel = (await talent.getByRole('checkbox', { name: '公开 模拟维护记录.png', exact: true }).locator('..').boundingBox())!;
      expect.soft((await ownDownload.boundingBox())!.x).toBeGreaterThan(fileLabel.x + fileLabel.width);
    }
    const name = (await talent.getByLabel('展示姓名', { exact: true }).boundingBox())!, faculty = (await talent.getByLabel('院系', { exact: true }).boundingBox())!;
    const state = (await talent.getByLabel('当前合作状态', { exact: true }).boundingBox())!, mode = (await talent.getByLabel('合作方式', { exact: true }).boundingBox())!, hours = (await talent.getByLabel('每周可投入小时', { exact: true }).boundingBox())!;
    if (width >= 640) { expect.soft(faculty.x).toBeGreaterThan(name.x); expect.soft(faculty.y).toBeCloseTo(name.y, 0); expect.soft(mode.x).toBeGreaterThan(state.x); expect.soft(mode.y).toBeCloseTo(state.y, 0); }
    else { expect.soft(faculty.y).toBeGreaterThan(name.y); expect.soft(mode.y).toBeGreaterThan(state.y); }
    expect.soft(hours.y).toBeGreaterThan(mode.y);
    await natural(page, info, talent.getByRole('button', { name: '保存人才草稿', exact: true }), 'talent-save', width);
    await natural(page, info, talent.getByLabel('选择作品或证明文件', { exact: true }), 'talent-upload', width);
    const opener = talent.getByRole('button', { name: '预览更新公开档案', exact: true }); await opener.click();
    await expect(page.getByRole('dialog')).toBeVisible(); await page.screenshot({ path: info.outputPath(`talent-preview-${width}.png`), fullPage: true, animations: 'disabled' });
    await page.keyboard.press('Escape'); await expect(opener).toBeFocused();
  }
});

test('private reference: new maintenance navigation preserves unsaved project input when leaving is cancelled', async ({ page }) => {
  const title = '模拟维护导航保护';
  await prepare(page, { title, summary: '模拟已保存输入', direction: '校园服务', stage: '原型验证' });
  await page.goto(`${BASE_URL}/profile/project-drafts`); await page.getByRole('button', { name: `编辑项目：${title}`, exact: true }).click();
  await page.getByLabel('项目简介', { exact: true }).fill('模拟尚未保存、取消离开后仍需保留的输入');
  const navigation = page.getByRole('navigation', { name: '本人双创管理', exact: true }); await expect(navigation).toBeVisible();
  page.once('dialog', dialog => void dialog.dismiss());
  await navigation.getByRole('link', { name: '我的人才档案', exact: true }).click();
  await expect(page).toHaveURL(`${BASE_URL}/profile/project-drafts`);
  await expect(page.getByLabel('项目简介', { exact: true })).toHaveValue('模拟尚未保存、取消离开后仍需保留的输入');
});

for (const [path, title] of [['achievements', '我的成果'], ['recruitments', '我的招募']]) {
  test(`private read state: ${path} retains its heading and return on an unavailable project`, async ({ page }) => {
    await ensureStudentLogin(page);
    await page.goto(`${BASE_URL}/profile/project-drafts/00000000-0000-4000-8000-000000000000/${path}`);
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '返回我的项目', exact: true })).toHaveAttribute('href', '/profile/project-drafts');
    await expect(page.getByRole('main').locator('input')).toHaveCount(0);
  });
}

for (const stale of [false, true]) {
  test(`private recruitment overview: ${stale ? 'fresh closed state rejects a stale shortcut' : 'explicit close opens existing confirmation without executing it'}`, async ({ page }) => {
    test.setTimeout(120_000);
    const projectId = await prepare(page); const role = await fillRole(page);
    await role.getByRole('button', { name: '保存招募草稿', exact: true }).click();
    await expect(page.getByRole('status', { name: '招募操作结果', exact: true })).toContainText('已保存'); await publish(page);
    await role.getByRole('button', { name: '返回招募列表', exact: true }).click();
    const overview = page.getByRole('region', { name: '当前招募摘要', exact: true }); await expect(overview).toBeVisible();
    await expect(overview).toContainText('微信'); await expect(overview.getByRole('heading', { name: '研究伙伴', exact: true })).toBeVisible();
    if (!stale) for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const label of await overview.locator('dt').all()) expect.soft(await label.evaluate(el => {
        const text = document.createRange(); text.selectNodeContents(el);
        return text.getClientRects().length;
      }), `Summary label text stays on one line at ${width}px`).toBe(1);
    }
    if (stale) {
      const headers = { Authorization: `Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}` };
      const response = await page.request.get(`${API_URL}/ie/me/project-drafts/${projectId}/recruitments`, { headers }); expect(response.status()).toBe(200);
      const saved = (await response.json()).items[0];
      expect((await page.request.post(`${API_URL}/ie/me/project-drafts/${projectId}/recruitments/${saved.id}/close`, { headers, data: { version: saved.version, request_id: crypto.randomUUID() } })).status()).toBe(200);
    }
    let writes = 0; page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/close')) writes++; });
    await overview.getByRole('button', { name: '关闭招募', exact: true }).click();
    const editor = page.getByRole('region', { name: '招募岗位编辑器', exact: true });
    if (stale) { await expect(editor).toBeVisible(); await expect(editor).toContainText('状态已变化'); await expect(page.getByRole('dialog')).toHaveCount(0); }
    else {
      const dialog = page.getByRole('dialog', { name: '关闭招募', exact: true }); await expect(dialog).toBeVisible();
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(editor).toBeVisible();
      await expect.poll(() => editor.evaluate(el => el.contains(document.activeElement)), { message: 'A removed list opener returns focus inside the existing editor' }).toBe(true);
    }
    expect(writes).toBe(0);
  });
}

test('private file feedback: publication does not keep a stale private receipt', async ({ page }) => {
  test.setTimeout(180_000);
  await prepareTalent(page); await fillTalent(page, '模拟文件状态同学'); await saveTalent(page);
  await (await uploadTalent(page, '模拟状态记录.png')).check(); await saveTalent(page); await publishTalent(page);
  const talent = talentEditor(page);
  await expect(talent.getByRole('listitem').filter({ hasText: '模拟状态记录.png' })).toContainText('当前公开');
  const feedback = talent.getByRole('status', { name: '人才文件操作结果', exact: true });
  await expect(feedback).toContainText('文件检查通过');
  await expect(feedback).not.toContainText('仍仅自己可见');
});
