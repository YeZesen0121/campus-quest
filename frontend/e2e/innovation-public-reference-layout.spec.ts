import { readSourceTagPaint, BASE_URL, ensureStudentLogin, expect, test } from './fixtures';
import { prepare, fillRole, publish } from './recruitment-helpers';
import { prepareTalent, fillTalent, saveTalent, publishTalent } from './talent-helpers';
import type { Page } from '@playwright/test';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the isolated campus world');
const widths = [320, 390, 800, 1440];
test('public final reference: project filters are exposed on desktop and collapsible on phone',async({page})=>{
  await ensureStudentLogin(page);await page.setViewportSize({width:1440,height:900});
  await page.goto(`${BASE_URL}/innovation/projects`);
  const direction=page.getByLabel('方向',{exact:true});
  await expect(direction).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(direction).not.toBeVisible();
  await page.getByRole('button',{name:'筛选',exact:true}).click();
  await expect(direction).toBeVisible();await direction.fill('模拟方向');
  await page.getByRole('button',{name:'筛选',exact:true}).click();
  await page.getByRole('button',{name:'筛选',exact:true}).click();
  await expect(direction).toHaveValue('模拟方向');
});
test('public final reference: talent filter inputs align and retain an outlined reset',async({page})=>{
  await ensureStudentLogin(page);await page.setViewportSize({width:1440,height:900});
  await page.goto(`${BASE_URL}/innovation/talents`);
  const form=page.getByRole('form',{name:'人才筛选',exact:true});await expect(form).toBeVisible();await settle(page);
  const positions=await form.evaluate(el=>['#talent-search','#talent-filter-state','#talent-filter-materials'].map(selector=>el.querySelector(selector)!.getBoundingClientRect().y));
  expect(Math.max(...positions)-Math.min(...positions),'Approved first-row inputs share a baseline').toBeLessThan(1);
  await expect(form.getByRole('link',{name:'清除筛选',exact:true})).toHaveClass(/btn-secondary/);
  await expect(form.getByRole('textbox',{name:'搜索同学或技能',exact:true})).toHaveAttribute('placeholder','姓名、院系或技能，最多 100 字');
});
test('public final reference: recruitment filters show the approved field guidance',async({page})=>{
  await ensureStudentLogin(page);await page.goto(`${BASE_URL}/innovation/recruitments`);
  await expect(page.getByLabel('搜索',{exact:true})).toHaveAttribute('placeholder','岗位、项目名称或职责');
  await expect(page.getByLabel('方向',{exact:true})).toHaveAttribute('placeholder','例如 校园服务');
  await expect(page.getByLabel('阶段',{exact:true})).toHaveAttribute('placeholder','例如 原型验证');
});
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getTiming().iterations ?? 1)).map(animation => animation.finished.catch(() => {})));
  });
}

async function sourceDivider(list: ReturnType<Page['locator']>, width: number) {
  const divider = await list.evaluate(node => {
    const box = node.getBoundingClientRect(), pseudo = getComputedStyle(node, '::before');
    const cards = [...node.children].map(child => child.getBoundingClientRect());
    return { display: pseudo.display, size: pseudo.width, height: parseFloat(pseudo.height), parentHeight: box.height,
      center: box.x + parseFloat(pseudo.left) + parseFloat(pseudo.width) / 2,
      gutter: cards.length > 1 ? (cards[0].right + cards[1].left) / 2 : box.x + box.width / 2 };
  });
  expect.soft(divider.display).toBe(width >= 640 ? 'block' : 'none');
  if (width >= 640) {
    expect.soft(divider.size).toBe('2px');
    expect.soft(Math.abs(divider.center - divider.gutter)).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(divider.height - divider.parentHeight)).toBeLessThanOrEqual(1);
  }
}

for (const width of widths) {
  test(`public reference: three libraries and divided discovery feeds at ${width}px`, async ({ page }, testInfo) => {
    await ensureStudentLogin(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/innovation`);
    await expect(page.getByRole('region', { name: '校内已核实成果', exact: true })).toBeVisible();
    await expect(page.locator('.campus-discovery-feeds .skeleton')).toHaveCount(0);
    await settle(page);
    await expect(page.getByRole('main')).toHaveCSS('padding-left', `${width < 360 ? 14 : width < 768 ? 17 : width < 1024 ? 25 : 36}px`);
    const tabs = page.getByRole('navigation', { name: '双创公共浏览', exact: true }).getByRole('link');
    expect((await tabs.last().boundingBox())!.y).toBeCloseTo((await tabs.first().boundingBox())!.y, 0);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', `${width < 640 ? 29 : width < 1024 ? 32 : 34}px`);
    const libraries = page.getByRole('region', { name: '双创三库', exact: true });
    const libraryRules = await page.locator('.campus-library-links').evaluate(node => ({ top: getComputedStyle(node).borderTopWidth, bottom: getComputedStyle(node).borderBottomWidth, children: [...node.children].map(child => getComputedStyle(child).borderTopWidth) }));
    expect.soft(libraryRules.top).toBe('1px'); expect.soft(libraryRules.bottom).toBe('1px');
    expect.soft(libraryRules.children.every(border => border === '0px')).toBe(true);

    const project = (await libraries.locator('a[href="/innovation/projects"]').boundingBox())!;
    const talent = (await libraries.locator('a[href="/innovation/talents"]').boundingBox())!;
    const mentor = (await libraries.locator('a[href="/innovation/mentors"]').boundingBox())!;
    expect(talent.x).toBeGreaterThan(project.x);
    expect(talent.y).toBeCloseTo(project.y, 0);
    if (width >= 768) expect(mentor.y).toBeCloseTo(project.y, 0);
    else expect(mentor.y).toBeGreaterThan(project.y);
    await expect(page.getByRole('heading', { name: '校内成果', exact: true })).toBeVisible();
    const left = (await page.getByRole('region', { name: '校内已核实成果', exact: true }).boundingBox())!;
    const right = (await page.getByRole('region', { name: '校内招募岗位', exact: true }).boundingBox())!;
    if (width >= 768) { expect(right.x).toBeGreaterThan(left.x); expect(right.y).toBeCloseTo(left.y, 0); }
    else expect(right.y).toBeGreaterThanOrEqual(left.y + left.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
  });
}

test('public reference: talent management stays beside the directory heading', async ({ page }, testInfo) => {
  await ensureStudentLogin(page);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/innovation/talents`);
    await expect(page.getByRole('form', { name: '人才筛选', exact: true })).toBeVisible();
    const management = page.getByRole('link', { name: '建立或管理我的人才档案', exact: true });
    await expect(management).toBeVisible(); await settle(page);
    const heading = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const link = (await management.boundingBox())!;
    expect.soft(link.y).toBeCloseTo(heading.y, 0);
    expect.soft(link.x).toBeGreaterThan(heading.x);
    expect.soft(link.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`management-header-${width}.png`) });
  }
});

test('public reference: real long project, recruitment and talent fit and retain list returns', async ({ page }, testInfo) => {
  // Two real project/publication chains, a talent publication, and4viewport reads.
  test.setTimeout(300_000);
  const marker = '样张核对';
  const titles = [`${marker}校园公共信息整理与学习实践项目`.repeat(3), `${marker}模拟课程资料实践`];
  const roles = [`${marker}访谈记录与开放信息整理的研究实践伙伴`.repeat(3), `${marker}模拟资料整理伙伴`];
  const projectIds: string[] = [], rolePaths: string[] = [];
  for (let i = 0; i < 2; i++) {
    const projectId = await prepare(page, { title: titles[i], summary: 'PRIVATE_PARENT_SENTINEL', direction: '学习', stage: '调研中' });
    const role = await fillRole(page);
    await role.getByLabel('项目名称', { exact: true }).fill(titles[i]);
    await role.getByLabel('岗位名称', { exact: true }).fill(roles[i]);
    await role.getByLabel('项目介绍', { exact: true }).fill('模拟公开资料：保留真实观察与未知信息。'.repeat(16));
    await role.getByLabel('主要职责', { exact: true }).fill('模拟公开职责：访谈、核对来源、整理记录并说明不确定之处。'.repeat(14));
    await role.getByRole('button', { name: '保存招募草稿', exact: true }).click();
    await expect(page.getByRole('status', { name: '招募操作结果', exact: true })).toContainText('已保存');
    await publish(page);
    projectIds.push(projectId);
    rolePaths.push((await role.getByRole('link', { name: '查看校内岗位', exact: true }).getAttribute('href'))!);
  }
  const talentName = `${marker}愿意参与开放资料整理与学习实验的模拟同学`;
  await prepareTalent(page); const talent = await fillTalent(page, talentName);
  await talent.getByLabel('一句话介绍', { exact: true }).fill('模拟资料：愿意倾听真实问题，核对公开来源并保留尚未确认的信息。');
  await saveTalent(page); await publishTalent(page);
  const capture = async (name: string, width: number) => {
    await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif;--font-mono:"Liberation Mono",monospace}' });
    await page.evaluate(() => document.fonts.ready);
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
  };
  const query = `q=${encodeURIComponent(marker)}`;
  let talentPath = '';
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE_URL}/innovation/projects?${query}`);
    const projects = page.getByRole('region', { name: '校内项目列表', exact: true });
    await expect(projects.locator('.ie-discovery-list > li')).toHaveCount(2);
    await settle(page);
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', `${width < 640 ? 31 : 38}px`, { timeout: 1000 });
    if(width<768)await expect.soft(projects.getByRole('checkbox', { name: '仅看正在招募', exact: true })).toBeHidden({ timeout: 1000 });
    else await expect.soft(projects.getByRole('checkbox', { name: '仅看正在招募', exact: true })).toBeVisible({ timeout: 1000 });
    await expect.soft(projects.getByRole('heading', { level: 2 }).first()).toHaveCSS('font-size', `${width < 360 ? 17 : width < 640 ? 18 : 19}px`, { timeout: 1000 });
    const cards = projects.locator('.ie-discovery-list > li'), first = (await cards.nth(0).boundingBox())!, second = (await cards.nth(1).boundingBox())!;
    if (width >= 640) { expect.soft(second.x).toBeGreaterThan(first.x); expect.soft(second.y).toBeCloseTo(first.y, 0); }
    else expect.soft(second.y).toBeGreaterThan(first.y);
    await expect(projects.locator(`a[href^="/innovation/projects/${projectIds[0]}"]`)).toBeVisible();

    await sourceDivider(projects.locator('.ie-discovery-list'), width);
    expect.soft(await projects.locator('.campus-project-facts strong').count()).toBe(4);
    expect.soft(await projects.getByRole('heading', { level: 2 }).first().locator('a svg[aria-hidden="true"]').count()).toBe(1);
    expect.soft(await page.locator('.campus-directory-count').allTextContents()).toEqual(['2 个项目']);
    const projectTitle = (await page.getByRole('heading', { level: 1 }).boundingBox())!, projectCount = (await page.locator('.campus-directory-count').boundingBox())!;
    expect.soft(projectCount.x - projectTitle.x - projectTitle.width).toBeGreaterThanOrEqual(8);
    expect.soft(projectCount.x - projectTitle.x - projectTitle.width).toBeLessThanOrEqual(16);
    await expect.soft(page.locator('.campus-projects-heading')).toHaveCSS('margin-top', `${width < 640 ? 20 : 25}px`, { timeout: 1000 });
    await expect.soft(projects.locator('.ie-draft-excerpt').first()).toHaveCSS('font-size', '14px', { timeout: 1000 });

    if (width < 1024) expect.soft(await page.locator('.app-topbar .avatar-chip').isVisible()).toBe(false);
    await capture('projects', width);
    await page.goto(`${BASE_URL}/innovation/recruitments?${query}`);
    const recruitment = page.getByRole('region', { name: '校内招募岗位', exact: true });
    await expect(recruitment.locator('.ie-discovery-list > li')).toHaveCount(2);
    await expect.soft(recruitment.locator('.ie-discovery-list > li').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)', { timeout: 1000 });

    expect.soft(await page.getByRole('heading', { level: 1 }).allTextContents()).toEqual(['校内招募']);
    expect.soft(await recruitment.getByRole('heading', { name: '当前有效岗位', exact: true }).count()).toBe(1);
    const filterRows = await recruitment.getByRole('form', { name: '校内浏览筛选', exact: true }).evaluate(form => {
      const ids = ['filter-q', 'filter-direction', 'filter-stage', 'filter-beginner'];
      return ids.map(id => { const b = form.querySelector('#' + id)!.getBoundingClientRect(); return { y: b.y, bottom: b.bottom }; }).concat([...form.querySelectorAll('button[type="submit"]')].map(button => { const b = button.getBoundingClientRect(); return { y: b.y, bottom: b.bottom }; }));
    });
    if (width === 800) { expect.soft(filterRows[0].y).toBeCloseTo(filterRows[2].y, 0); expect.soft(filterRows[3].y).toBeGreaterThan(filterRows[0].bottom); expect.soft(filterRows[4].bottom).toBeCloseTo(filterRows[3].bottom, 0); }
    if (width === 1440) expect.soft(filterRows.every(row => Math.abs(row.bottom - filterRows[0].bottom) < 1)).toBe(true);
    await capture('recruitments', width);
    await page.goto(`${BASE_URL}${rolePaths[0]}`);
    await expect(page.getByRole('article', { name: '校内招募详情', exact: true })).toContainText(roles[0]);
    await settle(page);
    await expect.soft(page.getByRole('navigation', { name: '双创公共浏览', exact: true })).toHaveCount(0);
    const factsBox = (await page.locator('.campus-role-facts').boundingBox())!;
    const introBox = (await page.getByRole('region', { name: '招募项目介绍', exact: true }).boundingBox())!;
    if (width < 768) expect.soft(factsBox.y).toBeLessThan(introBox.y);
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', `${width < 640 ? 33 : width < 1024 ? 37 : 43}px`, { timeout: 1000 });
    await expect(page.locator('body')).not.toContainText('demo_partner');
    await expect(page.locator('body')).not.toContainText('PRIVATE_PARENT_SENTINEL');

    expect.soft(await page.locator('.campus-role-reading').evaluate(node => getComputedStyle(node, '::before').display)).toBe('none');
    const roleFacts = page.locator('.campus-role-facts');
    if (width >= 768) {
      expect.soft(await roleFacts.locator('dl > div').evaluateAll(nodes => nodes.every(node => node.querySelector('dt')!.getBoundingClientRect().right <= node.querySelector('dd')!.getBoundingClientRect().left + 1))).toBe(true);
      if (width === 800) expect.soft((await roleFacts.boundingBox())!.width).toBeCloseTo(245, 0);
    }
    const roleContact = page.getByRole('region', { name: '授权联系方式', exact: true }).getByRole('button', { name: '查看联系方式', exact: true });
    if (width < 640) {
      const paint = await roleContact.evaluate(node => { const style = getComputedStyle(node, '::before'); return node.getBoundingClientRect().height - parseFloat(style.top) - parseFloat(style.bottom); });
      expect.soft(paint).toBeGreaterThanOrEqual(44);
      expect.soft(await roleContact.locator('[aria-hidden="true"]').count()).toBe(1);
    }

    expect.soft((await roleContact.boundingBox())!.width).toBeCloseTo((await page.getByRole('region', { name: '授权联系方式', exact: true }).boundingBox())!.width, 0);
    const rolePaintHeight = await roleContact.evaluate(node => { const style = getComputedStyle(node, '::before'); return node.getBoundingClientRect().height - parseFloat(style.top) - parseFloat(style.bottom); });
    expect.soft(rolePaintHeight).toBeCloseTo(width < 640 ? 46 : 42, 0);

    const roleTitle = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect.soft(roleTitle.y - (await page.getByRole('main').boundingBox())!.y).toBeCloseTo(width < 640 ? 95.1875 : 103.796875, 0);
    expect.soft(await page.locator('.campus-role-heading').count()).toBe(1);
    await capture('recruitment-detail', width);
    await page.goto(`${BASE_URL}/innovation/projects/${projectIds[0]}`);
    await expect(page.getByRole('article', { name: '校内项目详情', exact: true })).toContainText(titles[0]);
    await settle(page);
    const rolesBox = (await page.getByRole('region', { name: '项目正在招募', exact: true }).boundingBox())!;
    const achievementsBox = (await page.getByRole('region', { name: '项目已核实成果', exact: true }).boundingBox())!;
    const mentorsBox = (await page.getByRole('region', { name: '项目已同意导师', exact: true }).boundingBox())!;
    if (width >= 768) { expect.soft(achievementsBox.x).toBeGreaterThan(rolesBox.x); expect.soft(achievementsBox.y).toBeCloseTo(rolesBox.y, 0); }
    else expect.soft(achievementsBox.y).toBeGreaterThanOrEqual(rolesBox.y + rolesBox.height);
    expect.soft(mentorsBox.y).toBeGreaterThanOrEqual(Math.max(rolesBox.y + rolesBox.height, achievementsBox.y + achievementsBox.height));
    await expect(page.locator('body')).not.toContainText('PRIVATE_PARENT_SENTINEL');
    await capture('project-detail', width);
    await page.goto(`${BASE_URL}/innovation/talents?${query}`);
    const directory = page.getByRole('region', { name: '校内人才库', exact: true });
    const link = directory.getByRole('link', { name: talentName, exact: true }); await expect(link).toBeVisible(); talentPath = (await link.getAttribute('href'))!;
    await expect.soft(directory.getByLabel('PPT 制作', { exact: true })).toBeHidden({ timeout: 1000 });
    const list = directory.locator('.ie-discovery-list'), card = list.locator('li').first();
    const stateTag = card.locator('.ie-talent-state'), looking = (await stateTag.innerText()) === '找项目';
    expect.soft(await readSourceTagPaint(stateTag), `talent state/${width}: source purpose palette`).toMatchObject({ ink: looking ? '53,94,130,255' : '95,104,85,255', ground: looking ? '231,237,240,255' : '232,233,223,255', border: '0px', padding: '2px 6px', font: '11px', weight: '400', radius: '3px' });
    for (const skill of await card.locator('.ie-talent-tags > li').all()) expect.soft(await readSourceTagPaint(skill), `talent skill/${width}: source framed tag`).toMatchObject({ ink: '69,72,63,255', ground: '239,238,230,255', borderInk: '222,223,210,255', border: '1px', padding: '1px 6px', font: '11px', weight: '400', radius: '3px' });
    if (width >= 640) expect.soft((await card.boundingBox())!.width).toBeLessThan((await list.boundingBox())!.width * .56);

    await sourceDivider(list, width);
    const talentHeading = card.locator('.ie-talent-heading');
    const talentState = (await talentHeading.locator('.ie-talent-state').boundingBox())!, talentTitle = (await talentHeading.locator('h2').boundingBox())!;
    expect.soft(talentState.x).toBeGreaterThanOrEqual(talentTitle.x + talentTitle.width);
    expect.soft(Math.abs(talentState.y - talentTitle.y)).toBeLessThanOrEqual(6);
    await capture('talents', width);
    await link.click(); await expect(page.getByRole('article', { name: '校内人才详情', exact: true })).toContainText(talentName);
    await expect(page.locator('body')).not.toContainText('demo_partner');


    const publicSummary = page.locator('.ie-talent-summary');
    expect.soft(await publicSummary.locator('.ie-talent-heading .ie-talent-state').count()).toBe(0);
    const publicMeta = page.locator('.ie-talent-public .campus-talent-public-meta');
    expect.soft(await publicMeta.count()).toBe(1);
    if (await publicMeta.count()) expect.soft((await publicMeta.boundingBox())!.y).toBeGreaterThanOrEqual((await publicSummary.locator('.page-subtitle').boundingBox())!.y + (await publicSummary.locator('.page-subtitle').boundingBox())!.height);
    const backStyle = await page.getByRole('link', { name: '返回人才列表', exact: true }).evaluate(node => {
      const ctx = document.createElement('canvas').getContext('2d')!; ctx.fillStyle = getComputedStyle(node).color; ctx.fillRect(0, 0, 1, 1);
      return { size: getComputedStyle(node).fontSize, ink: [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).join(',') };
    });
    expect.soft(backStyle).toEqual({ size: '12px', ink: '108,109,98' });
    const headline = (await page.locator('.ie-talent-headline').boundingBox())!, contact = (await page.locator('.campus-talent-contact-bar').boundingBox())!;
    expect.soft(headline.y + headline.height).toBeLessThanOrEqual(contact.y);
    const materials = page.locator('.campus-talent-materials');
    expect.soft(await materials.count()).toBe(1);
    if (await materials.count()) {
      const links = (await materials.getByRole('region', { name: '公开作品链接', exact: true }).boundingBox())!;
      const files = (await materials.getByRole('region', { name: '公开作品文件', exact: true }).boundingBox())!;
      if (width >= 1024) { expect.soft(files.x).toBeGreaterThan(links.x); expect.soft(files.y).toBeCloseTo(links.y, 0); }
      else expect.soft(files.y).toBeGreaterThanOrEqual(links.y + links.height);
      expect.soft(await materials.evaluate(node => getComputedStyle(node, '::before').display)).not.toBe('block');
      expect.soft(await materials.getByRole('heading', { level: 2 }).evaluateAll(nodes => nodes.every(node => getComputedStyle(node).fontWeight === '600'))).toBe(true);

    }

    const tabs = (await page.getByRole('navigation', { name: '双创公共浏览', exact: true }).boundingBox())!;
    expect.soft((await page.getByRole('heading', { level: 1 }).boundingBox())!.y - tabs.y - tabs.height).toBeCloseTo(65, 0);
    expect.soft(await page.locator('.campus-discovery-page').evaluate(el => getComputedStyle(el).fontSize)).toBe('15px');
    await capture('talent-detail', width);
  }
  await page.goto(`${BASE_URL}/innovation/projects?${query}`);
  await page.locator(`a[href^="/innovation/projects/${projectIds[0]}"]`).click();
  await expect.soft(page.getByRole('link', { name: '返回项目库', exact: true })).toHaveAttribute('href', `/innovation/projects?${query}`);
  await page.goto(`${BASE_URL}/innovation/recruitments?${query}`);
  await page.getByRole('link', { name: roles[0], exact: true }).click();
  await expect.soft(page.getByRole('link', { name: '返回招募列表', exact: true })).toHaveAttribute('href', `/innovation/recruitments?${query}`);
  await page.goto(new URL(talentPath, BASE_URL).toString());
  await expect(page.getByRole('link', { name: '返回人才列表', exact: true })).toHaveAttribute('href', `/innovation/talents?${query}`);
  await page.setViewportSize({width:390,height:900});
  await page.goto(`${BASE_URL}/innovation/projects`);
  const projectSearch = page.getByLabel('搜索', { exact: true });
  await projectSearch.fill(marker); await projectSearch.press('Enter');
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(marker)}`));
  await expect(page.getByRole('region', { name: '校内项目列表', exact: true }).locator('.ie-discovery-list > li')).toHaveCount(2);
  await page.getByRole('button', { name: '筛选', exact: true }).click();
  await page.getByLabel('方向', { exact: true }).fill('学习');
  await page.getByRole('button', { name: '应用筛选', exact: true }).click();
  await expect(page).toHaveURL(/direction=%E5%AD%A6%E4%B9%A0/);
  await expect(page.getByRole('checkbox', { name: '仅看正在招募', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '清空筛选', exact: true }).click();
  await expect(page).toHaveURL(`${BASE_URL}/innovation/projects`);
  await expect(projectSearch).toHaveValue('');
  await expect(page.getByRole('button', { name: '筛选', exact: true })).toHaveAttribute('aria-expanded', 'false');
});
