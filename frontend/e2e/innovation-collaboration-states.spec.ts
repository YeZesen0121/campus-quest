import AxeBuilder from '@axe-core/playwright';
import { API_URL, BASE_URL, expect, test, ensureStudentLogin, loginThroughUi, parseSeededAccount, mintToken } from './fixtures';
import { captureR6Evidence } from './collaboration-screenshots';

test.skip(process.env.CQ_E2E !== '1', 'CQ_E2E=1 with the owned real login world');
test.use({ actionTimeout: 15_000 });

test('R6 personal lists announce loading, recover safely, paginate with focus and remain usable on narrow screens', async ({page}, info) => {
  await ensureStudentLogin(page);
  await page.setViewportSize({width:390,height:900});
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let attempts = 0;
  let fail = true;
  const offsets: number[] = [];
  await page.route('**/api/v1/ie/me/collaboration-projects?*', async route => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get('role')).toBe('MEMBER');
    const offset = Number(query.get('offset')); offsets.push(offset);
    attempts++;
    if (fail) {
      await held;
      return route.fulfill({status:503,json:{error:{code:'INTERNAL_ERROR',message:'INTERNAL_SENTINEL',request_id:'r6-loading-retry'}}});
    }
    const items = Array.from({length:offset === 0 ? 20 : 1}, (_,i) => ({
      project_id:crypto.randomUUID(),collaboration_id:crypto.randomUUID(),role:'MEMBER',
      title:`模拟分页项目 ${offset+i+1} ${'很长的项目名称'.repeat(12)}`,
      summary:'模拟说明'.repeat(80),public_name:'模拟已同意姓名',division:'模拟分工'.repeat(20),
      can_edit:false,can_open_public:false,can_publish_recruitment:false,
    }));
    await route.fulfill({json:{items,total:21,limit:20,offset}});
  });
  await page.goto(`${BASE_URL}/profile/collaboration?role=MEMBER`);
  const section=page.getByRole('region',{name:'我参与的',exact:true});
  try {
    await expect.poll(()=>attempts).toBeGreaterThan(0);
    await expect(section.getByRole('status',{name:'正在读取协作资料'})).toBeVisible();
    await captureR6Evidence(page,section,info.outputPath('r6-list-loading-simulated-390.png'));
  }
  finally { release(); }
  await expect(section.getByRole('alert')).toBeVisible();
  await expect(section).not.toContainText('INTERNAL_SENTINEL');
  await captureR6Evidence(page,section,info.outputPath('r6-list-error-simulated-390.png'));
  fail=false;await section.getByRole('button',{name:'重试',exact:true}).click();
  await expect(section.getByRole('listitem')).toHaveCount(20);
  const next=section.getByRole('button',{name:'下一页',exact:true});
  await next.focus(); await page.keyboard.press('Enter');
  await expect(section.getByRole('listitem')).toHaveCount(1);
  await expect(section).toContainText('模拟分页项目 21');
  await expect(section.getByRole('heading',{name:'我参与的',exact:true})).toBeFocused();
  expect(offsets.filter((offset,index)=>index===0||offset!==offsets[index-1])).toEqual([0,20]);
  for(const width of [320,390,800,1440]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await captureR6Evidence(page,page.getByRole('main'),info.outputPath('r6-member-list-long-1440.png'));
  await page.setViewportSize({width:390,height:900});expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await captureR6Evidence(page,page.getByRole('main'),info.outputPath('r6-member-list-long-390.png'));
});

test('R6 a private project remains private after completion and cannot publish a first introduction',async({page},info)=>{
  await ensureStudentLogin(page);
  const headers={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`};
  const created=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers,data:{request_id:crypto.randomUUID(),title:'模拟从未公开项目',summary:'模拟私有计划，仅用于核对未公开项目的结项边界。',direction:'模拟方向',stage:'模拟阶段',team_status:''}});
  expect(created.status()).toBe(201);const project=await created.json();
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${project.id}`);
  const life=page.getByRole('region',{name:'项目状态与公开介绍',exact:true});
  await expect(life).toContainText('此前没有可留存的公开来源');
  await life.getByRole('button',{name:'预览结项后果',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'确认结项',exact:true});await expect(dialog).toContainText('仍保持私有');
  await dialog.getByRole('button',{name:'确认结项并关闭岗位',exact:true}).click();
  await expect(life.getByRole('status').first()).toContainText('已结项');
  expect((await page.request.get(`${API_URL}/ie/projects/${project.id}`,{headers})).status()).toBe(404);
  await life.getByRole('button',{name:'生成介绍预览',exact:true}).click();await expect(life.getByRole('alert')).toBeVisible();
  await expect(life.getByRole('button',{name:'核对并发布此介绍',exact:true})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});await captureR6Evidence(page,life,info.outputPath('r6-private-completed.png'));
});

test('R6 account changes fence a late real private list response and deny the old workspace',async({page})=>{
  test.setTimeout(120_000);await ensureStudentLogin(page);
  const ownerHeaders={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`};
  const created=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers:ownerHeaders,data:{request_id:crypto.randomUUID(),title:'PRIVATE_LATE_OWNER_SENTINEL',summary:'模拟账号隔离资料',direction:'',stage:'',team_status:''}});
  expect(created.status()).toBe(201);const project=await created.json();
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  let arrived!:()=>void;const arrival=new Promise<void>(resolve=>{arrived=resolve;});
  let first=true;
  await page.route('**/api/v1/ie/me/collaboration-projects?*',async route=>{
    const response=await route.fetch();
    if(first){first=false;arrived();await held;}
    await route.fulfill({response});
  });
  const sibling=await page.context().newPage();
  try{
    await page.goto(`${BASE_URL}/profile/collaboration`);await arrival;
    await loginThroughUi(sibling,parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT'));
    release();
    const section=page.getByRole('region',{name:'我负责的',exact:true});await expect(section.getByRole('status',{name:'正在读取协作资料'})).toHaveCount(0);
    await expect(page.getByRole('main')).not.toContainText('PRIVATE_LATE_OWNER_SENTINEL');
    await page.unrouteAll({behavior:'wait'});
    await page.goto(`${BASE_URL}/profile/collaboration/projects/${project.id}`);
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page.getByRole('main')).not.toContainText('PRIVATE_LATE_OWNER_SENTINEL');
    await expect(page.getByLabel('项目简介',{exact:true})).toHaveCount(0);
  }finally{release();await sibling.close();await page.unrouteAll({behavior:'wait'});}
});
