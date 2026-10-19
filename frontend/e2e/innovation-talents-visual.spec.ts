import AxeBuilder from '@axe-core/playwright';
import { captureOwnedVisual, BASE_URL, expect, test, ensureStudentLogin } from './fixtures';
import { captureR6Evidence } from './collaboration-screenshots';
import { editor, prepareTalent, fillTalent, saveTalent, publishTalent, uploadTalent } from './talent-helpers';

test.skip(process.env.CQ_E2E!=='1'||process.env.CQ_VISUAL!=='1'||process.env.CQ_E2E_FIXED_LABELS!=='1','separate Linux pinned-font R4 visual world');
async function stable(page:import('@playwright/test').Page){
  await page.addStyleTag({content:':root { --font-sans: "Noto Sans CJK SC", sans-serif; --font-display: "Noto Serif CJK SC", serif; --font-mono: "Liberation Mono", monospace; } *, *::before, *::after { animation: none !important; transition: none !important; }'});
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
}

test('R4.1 visual: public materials remain neutral in directory and detail',async({page})=>{
  test.setTimeout(180_000);await prepareTalent(page);await fillTalent(page,'模拟材料同学');await saveTalent(page);await(await uploadTalent(page,'模拟证明材料.png')).check();await saveTalent(page);await publishTalent(page);
  await page.setViewportSize({width:1440,height:900});await page.goto(`${BASE_URL}/innovation/talents?has_public_materials=true`);await expect(page.getByRole('link',{name:'模拟材料同学',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'校内人才库'})).toContainText('含作品/证明材料');await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-materials-list-desktop.png');
  await page.getByRole('link',{name:'模拟材料同学',exact:true}).click();await page.setViewportSize({width:390,height:844});await expect(page.getByRole('button',{name:'下载 模拟证明材料.png',exact:true})).toBeVisible();await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-materials-detail-mobile.png');
});
test('R4 visual: owner, mobile preview and public talent',async({page})=>{
  test.setTimeout(150_000);await prepareTalent(page);await fillTalent(page,'模拟人才同学');await editor(page).getByLabel('授权微信',{exact:true}).check();await editor(page).getByLabel('微信',{exact:true}).fill('demo_talent_visual');await saveTalent(page);
  await page.setViewportSize({width:1440,height:900});await stable(page);await captureOwnedVisual(page, editor(page), 'talent-owner-desktop.png');
  await page.setViewportSize({width:390,height:844});const opener=editor(page).getByRole('button',{name:'预览开启校内展示',exact:true});await opener.click();await expect(page.getByRole('dialog')).toBeVisible();await stable(page);await captureOwnedVisual(page, page.getByRole('dialog'), 'talent-preview-mobile.png');await page.keyboard.press('Escape');await expect(opener).toBeFocused();await publishTalent(page);
  await editor(page).getByRole('link',{name:'查看校内公开档案',exact:true}).click();await expect(page.getByRole('article',{name:'校内人才详情'})).toBeVisible();await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-detail-mobile.png');await expect(page.getByRole('main')).not.toContainText('demo_talent_visual');
  await captureR6Evidence(page, page.getByRole('main'), test.info().outputPath('guide-talent-public-mobile.png'));
  await page.getByRole('button',{name:'查看授权联系方式',exact:true}).click();await expect(page.getByRole('region',{name:'人才授权联系'})).toContainText('demo_talent_visual');await stable(page);await captureOwnedVisual(page, page.getByRole('region',{name:'人才授权联系'}), 'talent-contacts-mobile.png');
  await page.setViewportSize({width:1440,height:900});await page.goto(`${BASE_URL}/innovation/talents`);await expect(page.getByRole('link',{name:'模拟人才同学',exact:true})).toBeVisible();await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-list-desktop.png');
  await page.setViewportSize({width:390,height:844});await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-list-mobile.png');
});
test('R4 visual: empty, unavailable, loading and error',async({page})=>{
  await ensureStudentLogin(page);await page.setViewportSize({width:390,height:844});await page.goto(`${BASE_URL}/innovation/talents?q=不存在的模拟同学`);await expect(page.getByRole('region',{name:'校内人才库'})).toContainText('暂无符合条件的人才');await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-empty-mobile.png');
  await page.goto(`${BASE_URL}/innovation/talents/00000000-0000-4000-8000-000000000000`);await expect(page.getByRole('main').getByRole('alert')).toContainText('不存在');await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-unavailable-mobile.png');
  // Match the pathname: browsers may omit an empty query separator.
  const path=(url:URL)=>url.pathname==='/api/v1/ie/talents';
  let release!:()=>void;let intercepted!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});const requested=new Promise<void>(resolve=>{intercepted=resolve;});await page.route(path,async route=>{intercepted();await held;await route.continue();});
  try{await page.goto(`${BASE_URL}/innovation/talents`);await requested;await expect(page.getByRole('status',{name:'正在查找人才'})).toBeVisible();await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-loading-mobile.png');}finally{release();await page.unrouteAll({behavior:'wait'});}
  await expect(page.getByRole('form',{name:'人才筛选'})).toBeVisible();
  await page.route(path,route=>route.fulfill({status:503,json:{error:{code:'HTTP_ERROR',message:'模拟服务暂不可用，请稍后重试'}}}));
  const unavailable=page.waitForResponse(response=>path(new URL(response.url()))&&response.status()===503);
  await page.goto(`${BASE_URL}/innovation/talents?q=模拟错误场景`);await unavailable;
  await expect(page.getByRole('main').getByRole('alert')).toContainText('服务暂时不可用，请稍后重试');await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-error-mobile.png');await page.unroute(path);await page.getByRole('main').getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByRole('form',{name:'人才筛选'})).toBeVisible();
});

test('R4 visual: long content and zero availability remain usable on mobile',async({page})=>{
  test.setTimeout(150_000);await prepareTalent(page);await fillTalent(page,'A'.repeat(50));await page.setViewportSize({width:390,height:844});
  await editor(page).getByLabel('自我介绍',{exact:true}).fill('模拟长资料'.repeat(100));await editor(page).getByLabel('我的优势',{exact:true}).fill('Skill'.repeat(400));await editor(page).getByLabel('每周可投入小时',{exact:true}).fill('0');await editor(page).getByLabel('当前合作状态',{exact:true}).selectOption('NOT_AVAILABLE');
  await editor(page).getByRole('button',{name:'添加作品链接',exact:true}).click();await editor(page).getByLabel('作品 1 名称',{exact:true}).fill('W'.repeat(100));await editor(page).getByLabel('作品 1 链接',{exact:true}).fill('https://example.invalid/'+'a'.repeat(1800));await saveTalent(page);await stable(page);await captureOwnedVisual(page, editor(page), 'talent-long-form-mobile.png');
  await publishTalent(page);await editor(page).getByRole('link',{name:'查看校内公开档案',exact:true}).click();await expect(page.getByRole('article',{name:'校内人才详情'})).toContainText('暂不接洽');await expect(page.getByRole('article')).toContainText('0 小时');await stable(page);await captureOwnedVisual(page, page.getByRole("main"), 'talent-long-detail-mobile.png');
});
