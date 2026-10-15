import AxeBuilder from '@axe-core/playwright';
import { API_URL, BASE_URL, expect, test, loginThroughUi, parseSeededAccount, mentorLogin, mintToken, ensureStudentLogin } from './fixtures';
import type { Page, Locator } from '@playwright/test';
import type { components } from '../src/lib/api/schema';

test.skip(process.env.CQ_E2E!=='1','CQ_E2E=1 with an owned real database');

test('R5 mentor directory is reachable, filters persist, mobile and keyboard remain usable',async({page})=>{
  await ensureStudentLogin(page);
  await page.goto(`${BASE_URL}/innovation/mentors`);
  await expect(page.getByRole('heading',{name:'导师库',exact:true})).toBeVisible();
  await page.getByLabel('搜索导师',{exact:true}).fill('不存在的模拟导师');
  await page.getByLabel('接受联系筛选',{exact:true}).selectOption('false');
  await page.getByRole('button',{name:'查找导师',exact:true}).click();
  await expect(page).toHaveURL(/accepting_contact=false/);
  await expect(page.getByText('暂无符合条件的导师',{exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByLabel('搜索导师',{exact:true}).focus();
  await page.keyboard.press('Tab');await expect(page.getByLabel('指导方向筛选',{exact:true})).toBeFocused();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});

test('R5 mentor directory exposes loading and safe retryable errors',async({page})=>{
  await ensureStudentLogin(page);let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let fail=true;
  const path='**/api/v1/ie/mentors?*';
  await page.route(path,async route=>{if(fail){await held;return route.fulfill({status:503,json:{error:{code:'INTERNAL_ERROR',message:'R5_INTERNAL_SENTINEL'}}});}return route.continue();});
  try{await page.goto(`${BASE_URL}/innovation/mentors`);await expect(page.getByRole('status',{name:'正在查找导师'})).toBeVisible();release();await expect(page.getByRole('region',{name:'校内导师库'}).getByRole('alert')).toBeVisible();await expect(page.getByRole('main')).not.toContainText('R5_INTERNAL_SENTINEL');fail=false;await page.getByRole('button',{name:'重试',exact:true}).click();await expect(page.getByRole('region',{name:'校内导师库'}).getByRole('status').last()).toContainText('找到');}finally{release();await page.unrouteAll({behavior:'wait'});}
});

const operationEditor=(page:Page)=>page.getByRole('region',{name:'导师运营编辑器'});
const consentForm=(page:Page)=>page.getByRole('form',{name:'导师本人确认'});
const auth=(id:string)=>({Authorization:`Bearer ${mintToken(id)}`});
async function grantOperations(page:Page){
  const headers=auth(process.env.CQ_E2E_ADMIN_ID!);const path=`${API_URL}/admin/ie/operations-grants/${process.env.CQ_E2E_STUDENT_ID!}`;
  const read=await page.request.get(path,{headers});expect(read.status()).toBe(200);const record=await read.json();
  if(!record.enabled)expect((await page.request.put(path,{headers,data:{version:record.version,enabled:true,reason:'R5模拟运营验收'}})).status()).toBe(200);
}
async function ownProfile(page:Page){const result=await page.request.get(`${API_URL}/ie/me/mentor`,{headers:auth(process.env.CQ_E2E_MENTOR_ID!)});expect(result.status()).toBe(200);return (await result.json()).profile as components['schemas']['MentorProfileResponse']|null;}
async function pendingProfile(page:Page){
  const existing=await ownProfile(page);if(existing)return existing;
  const response=await page.request.post(`${API_URL}/ie/operations/mentors`,{headers:auth(process.env.CQ_E2E_STUDENT_ID!),data:{request_id:crypto.randomUUID(),mentor_username:parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR').username,fields:{name:'模拟冲突导师',unit:'模拟学院',introduction:'模拟简介',directions:'学习研究',achievements:'',project_types:'学习实验',contacts:[{channel:'EMAIL',value:'mentor@example.invalid'},{channel:'QQ',value:'12345678'}]}}});expect(response.status()).toBe(200);return (await response.json()).current as components['schemas']['MentorProfileResponse'];
}
async function saveOperations(page:Page){await operationEditor(page).getByRole('button',{name:'保存导师资料',exact:true}).click();await expect(operationEditor(page).getByRole('status',{name:'导师操作结果'})).toContainText('操作已保存');}
async function consent(page:Page){const form=consentForm(page);await form.getByRole('checkbox',{name:'我已核对以上资料，同意在校内展示',exact:true}).check();await form.getByRole('checkbox',{name:/允许展示邮箱/}).check();await form.getByRole('checkbox',{name:/允许展示QQ/}).check();await form.getByRole('checkbox',{name:'接受校内用户联系',exact:true}).check();await form.getByRole('checkbox',{name:'导师简介',exact:true}).check();await form.getByRole('button',{name:'确认资料与授权',exact:true}).click();await expect(page.getByRole('region',{name:'我的导师资料',exact:true}).getByRole('status',{name:'导师操作结果'}).first()).toContainText('操作已保存');}
async function stableShot(page:Page,locator:Locator,name:string){
  if(process.env.CQ_VISUAL!=='1')return;
  // This baseline owns the content region; the reused sticky shell is outside
  // it and must not overlay a tall locator while Playwright scrolls to capture.
  const style=await page.addStyleTag({content:':root { --font-sans: "Noto Sans CJK SC", sans-serif; } *, *::before, *::after { animation: none !important; transition: none !important; } .app-topbar { visibility: hidden !important; }'});
  try{await page.evaluate(()=>document.fonts.ready);await expect(locator).toHaveScreenshot(name,{maxDiffPixelRatio:0.01});}finally{await style.evaluate(element=>element.remove());}
}

test.describe('R5 mentor consent world',()=>{
  test.skip(process.env.CQ_E2E_MENTOR_WORLD!=='1','CQ_E2E_MENTOR_WORLD=1 creates only the isolated simulated mentor identity');

  test('R5 mentor lifecycle: operations, explicit consent, scoped maintenance, contact and project links',async({page,browser})=>{
    test.setTimeout(240_000);await grantOperations(page);await ensureStudentLogin(page);
    await page.goto(`${BASE_URL}/innovation/operations/mentors`);await page.getByRole('button',{name:'录入导师',exact:true}).click();
    const editor=operationEditor(page);await editor.getByLabel('导师账号',{exact:true}).fill(parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR').username);
    for(const [label,value] of Object.entries({'导师姓名':'模拟学习导师','所在单位':'模拟学院','导师简介':'模拟资料：关注学习实践与信息整理。','指导方向':'学习研究','代表成果':'模拟案例记录','适合的项目类型':'学习实验'}))await editor.getByLabel(label,{exact:true}).fill(value);
    await editor.getByRole('checkbox',{name:'录入邮箱',exact:true}).check();await editor.getByLabel('邮箱联系值',{exact:true}).fill('mentor@example.invalid');
    await editor.getByRole('checkbox',{name:'录入QQ',exact:true}).check();await editor.getByLabel('QQ联系值',{exact:true}).fill('12345678');
    await editor.getByLabel('邮箱联系值',{exact:true}).fill('invalid');await editor.getByRole('button',{name:'保存导师资料',exact:true}).click();await expect(editor.getByLabel('邮箱联系值',{exact:true})).toBeFocused();await expect(editor.getByLabel('邮箱联系值',{exact:true})).toHaveAttribute('aria-invalid','true');await editor.getByLabel('邮箱联系值',{exact:true}).fill('mentor@example.invalid');
    await saveOperations(page);const profile=(await ownProfile(page))!;expect(profile.visibility).toBe('HIDDEN');
    const viewHeaders=auth(process.env.CQ_E2E_AUTHOR_STUDENT_ID!);
    expect((await page.request.get(`${API_URL}/ie/mentors/${profile.id}`,{headers:viewHeaders})).status()).toBe(404);
    await stableShot(page,editor,'mentor-operations-form.png');
    const context=await browser.newContext({ignoreHTTPSErrors:true});const mentor=await context.newPage();
    const viewerContext=await browser.newContext({ignoreHTTPSErrors:true});const viewer=await viewerContext.newPage();
    try{
      await mentorLogin(mentor,parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR'));
      await expect(mentor.getByRole('link',{name:'返回工作台',exact:true})).toHaveAttribute('href','/innovation/mentors/me');
      await expect(consentForm(mentor).getByRole('checkbox').first()).not.toBeChecked();
      await consentForm(mentor).getByRole('button',{name:'确认资料与授权',exact:true}).click();await expect(consentForm(mentor).getByRole('alert')).toContainText('明确勾选');
      await stableShot(mentor,mentor.getByRole('region',{name:'我的导师资料',exact:true}),'mentor-confirmation.png');
      await consent(mentor);
      await loginThroughUi(viewer,parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT'));await viewer.goto(`${BASE_URL}/innovation/mentors/${profile.id}`);
      await expect(viewer.getByRole('article',{name:'校内导师详情'})).not.toContainText('mentor@example.invalid');
      await viewer.getByRole('button',{name:'查看授权联系方式',exact:true}).click();await expect(viewer.getByRole('region',{name:'导师授权联系'})).toContainText('mentor@example.invalid');
      await page.goto(`${BASE_URL}/innovation/operations/mentors/${profile.id}`);await operationEditor(page).getByLabel('导师简介',{exact:true}).fill('授权内更新的模拟介绍');await saveOperations(page);
      await viewer.reload();await expect(viewer.getByRole('article')).toContainText('授权内更新的模拟介绍');
      await operationEditor(page).getByLabel('所在单位',{exact:true}).fill('尚未确认的新单位');await saveOperations(page);await viewer.reload();await expect(viewer.getByRole('article')).toContainText('模拟学院');await expect(viewer.getByRole('article')).not.toContainText('尚未确认的新单位');
      await mentor.reload();await mentor.getByRole('button',{name:'拒绝候选资料',exact:true}).click();await expect(mentor.getByRole('region',{name:'我的导师资料',exact:true})).toContainText('候选资料已拒绝');
      await viewer.reload();await expect(viewer.getByRole('article')).toContainText('模拟学院');
      const ownerHeaders=auth(process.env.CQ_E2E_STUDENT_ID!);const adminHeaders=auth(process.env.CQ_E2E_ADMIN_ID!);
      const owner=await page.request.get(`${API_URL}/ie/me/owner-profile`,{headers:ownerHeaders});const previous=(await owner.json()).profile;
      const saved=await page.request.put(`${API_URL}/ie/me/owner-profile`,{headers:ownerHeaders,data:{name:'模拟项目负责人',student_no:'00123456',major:'模拟专业',grade:'2026级',version:previous?.version??0}});expect(saved.status()).toBe(200);
      const qualification=await page.request.get(`${API_URL}/ie/me/owner-qualification`,{headers:ownerHeaders});const currentQualification=await qualification.json();
      if(currentQualification.status!=='APPROVED'){const application=await page.request.post(`${API_URL}/ie/me/owner-qualification`,{headers:ownerHeaders,data:{version:currentQualification.version,profile_version:(await saved.json()).version}});expect(application.status()).toBe(200);expect((await page.request.post(`${API_URL}/admin/ie/owner-qualifications/${process.env.CQ_E2E_STUDENT_ID}/approve`,{headers:adminHeaders,data:{version:(await application.json()).version}})).status()).toBe(200);}
      const created=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers:ownerHeaders,data:{request_id:crypto.randomUUID(),title:'模拟导师合作项目',summary:'提供给导师的私有项目摘要',direction:'学习研究',stage:'创意',team_status:'寻找伙伴'}});expect(created.status()).toBe(201);const project=await created.json();
      await page.goto(`${BASE_URL}/profile/project-drafts`);await page.getByRole('button',{name:'编辑项目：模拟导师合作项目',exact:true}).click();
      const projectSection=page.getByRole('region',{name:'项目导师挂名',exact:true});await projectSection.getByLabel('查找已展示的导师',{exact:true}).fill('模拟学习导师');await projectSection.getByRole('button',{name:'搜索可邀请导师',exact:true}).click();await projectSection.getByRole('radio',{name:/模拟学习导师/}).check();
      const invite=projectSection.getByRole('button',{name:'向导师发起挂名确认',exact:true});
      let releaseSave!:()=>void;const saveHeld=new Promise<void>(resolve=>{releaseSave=resolve;});const projectPath=`**/api/v1/ie/me/project-drafts/${project.id}`;
      await page.route(projectPath,async route=>{if(route.request().method()==='PATCH')await saveHeld;await route.continue();});
      try{await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(page.getByRole('button',{name:'保存草稿',exact:true})).toHaveAttribute('aria-busy','true');await expect(invite).toBeDisabled();releaseSave();await expect(invite).toBeEnabled();}finally{releaseSave();await page.unrouteAll({behavior:'wait'});}
      await page.getByLabel('项目简介',{exact:true}).fill('已重新保存的私有项目摘要');await expect(invite).toBeDisabled();await expect(projectSection).toContainText('先保存项目修改');await page.getByRole('button',{name:'保存草稿',exact:true}).click();await expect(invite).toBeEnabled();
      const invitePath=`**/api/v1/ie/me/project-drafts/${project.id}/mentors`;const invitationBodies:string[]=[];
      await page.route(invitePath,async route=>{if(route.request().method()!=='POST')return route.continue();const attempt=invitationBodies.push(route.request().postData()!);if(attempt!==1)return route.continue();const response=await page.request.post(`${API_URL}/ie/me/project-drafts/${project.id}/mentors`,{headers:ownerHeaders,data:route.request().postDataJSON()});expect(response.status()).toBe(200);return route.fulfill({status:503,json:{error:{code:'INTERNAL_ERROR',message:'模拟邀请回执丢失'}}});});
      try{await invite.click();await expect(projectSection.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await page.getByRole('button',{name:'返回草稿列表',exact:true}).click();await page.getByRole('button',{name:'编辑项目：模拟导师合作项目',exact:true}).click();await expect(projectSection.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(projectSection).toContainText('提供给 模拟学习导师 核对');await projectSection.getByRole('button',{name:'重试原请求',exact:true}).click();await expect(projectSection).toContainText('待导师确认');expect(invitationBodies).toHaveLength(2);expect(invitationBodies[1]).toBe(invitationBodies[0]);}finally{await page.unroute(invitePath);}
      await mentor.reload();const inbox=mentor.getByRole('region',{name:'导师项目挂名待办'});await expect(inbox).toContainText('已重新保存的私有项目摘要');await inbox.getByRole('button',{name:'同意此项目挂名',exact:true}).click();await expect(inbox).toContainText('导师已同意');
      expect((await page.request.get(`${API_URL}/ie/projects/${project.id}/mentors`,{headers:viewHeaders})).status()).toBe(404);
      const role=await page.request.post(`${API_URL}/ie/me/project-drafts/${project.id}/recruitments`,{headers:ownerHeaders,data:{request_id:crypto.randomUUID(),fields:{project_title:'公开的模拟项目名称',direction:'学习研究',stage:'创意起步',introduction:'已确认公开的模拟项目介绍',idea_stage:true,goal:'完成访谈',initial_plan:'整理观察',role_name:'学习伙伴',headcount:1,duties:'参与讨论',requirements:'愿意尝试',time_commitment:'每周一小时',beginner_friendly:true,deadline_at:null,contacts:[{channel:'QQ',value:'12345678'}]}}});expect(role.status()).toBe(201);const roleRecord=await role.json();expect((await page.request.post(`${API_URL}/ie/me/project-drafts/${project.id}/recruitments/${roleRecord.id}/publish`,{headers:ownerHeaders,data:{request_id:crypto.randomUUID(),version:roleRecord.version}})).status()).toBe(200);
      await viewer.goto(`${BASE_URL}/innovation/projects/${project.id}`);await expect(viewer.getByRole('region',{name:'项目已同意导师'})).toContainText('模拟学习导师');await expect(viewer.getByRole('main')).not.toContainText('已重新保存的私有项目摘要');
      await inbox.getByRole('button',{name:'解除此项目挂名',exact:true}).click();await expect(inbox).toContainText('已解除');await viewer.reload();await expect(viewer.getByRole('region',{name:'项目已同意导师'})).not.toContainText('模拟学习导师');
      await page.reload();await page.getByRole('button',{name:'编辑项目：模拟导师合作项目',exact:true}).click();await projectSection.getByRole('button',{name:'搜索可邀请导师',exact:true}).click();await projectSection.getByRole('radio',{name:/模拟学习导师/}).check();await invite.click();await expect(projectSection).toContainText('待导师确认');await mentor.reload();await inbox.getByRole('button',{name:'拒绝此项目挂名',exact:true}).click();await expect(inbox).toContainText('导师已拒绝');
      await page.reload();await page.getByRole('button',{name:'编辑项目：模拟导师合作项目',exact:true}).click();await projectSection.getByRole('button',{name:'搜索可邀请导师',exact:true}).click();await projectSection.getByRole('radio',{name:/模拟学习导师/}).check();await invite.click();await expect(projectSection).toContainText('待导师确认');await mentor.reload();await inbox.getByRole('button',{name:'同意此项目挂名',exact:true}).click();await expect(inbox).toContainText('导师已同意');
      await page.reload();await page.getByRole('button',{name:'编辑项目：模拟导师合作项目',exact:true}).click();await page.getByLabel('项目简介',{exact:true}).fill('不应阻止解除挂名的未保存输入');await expect(projectSection.getByRole('button',{name:'搜索可邀请导师',exact:true})).toBeDisabled();await projectSection.getByRole('button',{name:'解除此项目挂名',exact:true}).click();await expect(projectSection).toContainText('已解除');await page.getByLabel('项目简介',{exact:true}).fill('已重新保存的私有项目摘要');await viewer.reload();await expect(viewer.getByRole('region',{name:'项目已同意导师'})).not.toContainText('模拟学习导师');
      await mentor.getByRole('button',{name:'暂停联系',exact:true}).click();await expect(mentor.getByRole('button',{name:'恢复联系',exact:true})).toBeVisible();
      await viewer.goto(`${BASE_URL}/innovation/mentors/${profile.id}`);await expect(viewer.getByRole('button',{name:'查看授权联系方式',exact:true})).toHaveCount(0);await expect(viewer.getByRole('article')).toContainText('暂停联系');
      await mentor.getByRole('button',{name:'恢复联系',exact:true}).click();await expect(mentor.getByRole('button',{name:'暂停联系',exact:true})).toBeVisible();
      await mentor.getByRole('button',{name:'撤销邮箱联系授权',exact:true}).click();await viewer.reload();await viewer.getByRole('button',{name:'查看授权联系方式',exact:true}).click();await expect(viewer.getByRole('region',{name:'导师授权联系'})).toContainText('12345678');await expect(viewer.getByRole('region',{name:'导师授权联系'})).not.toContainText('mentor@example.invalid');
      await viewer.setViewportSize({width:390,height:844});expect(await viewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page:viewer}).analyze()).violations).toEqual([]);await stableShot(viewer,viewer.getByRole('article'),'mentor-public-mobile.png');
      await mentor.getByRole('button',{name:'撤回导师展示',exact:true}).click();await expect(mentor.getByRole('dialog',{name:'撤回导师展示'})).toBeVisible();await mentor.keyboard.press('Escape');await expect(mentor.getByRole('button',{name:'撤回导师展示',exact:true})).toBeFocused();await mentor.getByRole('button',{name:'撤回导师展示',exact:true}).click();await mentor.getByRole('dialog').getByRole('button',{name:'确认撤回展示',exact:true}).click();await expect(mentor.getByRole('dialog')).toHaveCount(0);
      await viewer.reload();await expect(viewer.getByRole('main').getByRole('alert')).toContainText('已停止展示');await viewer.goto(`${BASE_URL}/innovation/mentors?q=模拟学习导师`);await expect(viewer.getByText('暂无符合条件的导师',{exact:true})).toBeVisible();
    }finally{await context.close();await viewerContext.close();}
  });

  test('R5 mentor conflict preserves operations input and resets stale personal consent',async({page,browser})=>{
    test.setTimeout(120_000);await grantOperations(page);await ensureStudentLogin(page);let profile=await pendingProfile(page);
    await page.goto(`${BASE_URL}/innovation/operations/mentors/${profile.id}`);await operationEditor(page).getByLabel('导师简介',{exact:true}).fill('本窗口未保存的模拟介绍');
    let warned=false;page.once('dialog',async dialog=>{warned=true;await dialog.dismiss();});await operationEditor(page).getByRole('link',{name:'返回导师运营列表',exact:true}).click();expect(warned).toBe(true);await expect(operationEditor(page).getByLabel('导师简介',{exact:true})).toHaveValue('本窗口未保存的模拟介绍');
    const changed=await page.request.patch(`${API_URL}/ie/operations/mentors/${profile.id}`,{headers:auth(process.env.CQ_E2E_STUDENT_ID!),data:{request_id:crypto.randomUUID(),version:profile.version,fields:{...profile.fields,directions:'另一窗口已保存的方向'}}});expect(changed.status()).toBe(200);
    await operationEditor(page).getByRole('button',{name:'保存导师资料',exact:true}).click();await expect(operationEditor(page).getByRole('alert')).toContainText('资料或权限已改变');await expect(operationEditor(page).getByLabel('导师简介',{exact:true})).toHaveValue('本窗口未保存的模拟介绍');
    await page.getByRole('button',{name:'读取最新版本（保留输入）',exact:true}).click();await expect(page.getByRole('region',{name:'最新导师版本'})).toContainText('另一窗口已保存的方向');await page.getByRole('button',{name:'以最新版本继续（保留输入）',exact:true}).click();await expect(operationEditor(page).getByLabel('导师简介',{exact:true})).toHaveValue('本窗口未保存的模拟介绍');await saveOperations(page);
    const context=await browser.newContext({ignoreHTTPSErrors:true});const mentor=await context.newPage();
    try{
      await mentorLogin(mentor,parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR'));await consentForm(mentor).getByRole('checkbox',{name:'我已核对以上资料，同意在校内展示',exact:true}).check();profile=(await ownProfile(page))!;
      expect((await page.request.patch(`${API_URL}/ie/operations/mentors/${profile.id}`,{headers:auth(process.env.CQ_E2E_STUDENT_ID!),data:{request_id:crypto.randomUUID(),version:profile.version,fields:{...profile.fields,unit:'冲突后新单位'}}})).status()).toBe(200);
      await consentForm(mentor).getByRole('button',{name:'确认资料与授权',exact:true}).click();await expect(mentor.getByRole('region',{name:'我的导师资料',exact:true}).getByRole('alert')).toContainText('资料或权限已改变');await mentor.getByRole('button',{name:'读取最新版本（保留输入）',exact:true}).click();await expect(mentor.getByRole('region',{name:'最新待确认导师资料'})).toContainText('冲突后新单位');await mentor.getByRole('button',{name:'载入最新资料并重新选择',exact:true}).click();await expect(consentForm(mentor).getByRole('checkbox').first()).not.toBeChecked();
    }finally{await context.close();}
  });

  test('R5 mentor uncertain save retries the same command and account changes clear private inputs',async({page})=>{
    test.setTimeout(120_000);await grantOperations(page);await ensureStudentLogin(page);const profile=await pendingProfile(page);
    await page.goto(`${BASE_URL}/innovation/operations/mentors`);await page.getByRole('button',{name:'录入导师',exact:true}).click();await operationEditor(page).getByLabel('导师账号',{exact:true}).fill(parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR').username);await operationEditor(page).getByLabel('导师姓名',{exact:true}).fill('重复录入需保留的输入');await operationEditor(page).getByRole('button',{name:'保存导师资料',exact:true}).click();await expect(operationEditor(page).getByRole('alert')).toBeVisible();await operationEditor(page).getByRole('button',{name:'重新核对导师账号',exact:true}).click();await expect(operationEditor(page).getByLabel('导师账号',{exact:true})).toBeFocused();await expect(operationEditor(page).getByLabel('导师姓名',{exact:true})).toHaveValue('重复录入需保留的输入');page.once('dialog',dialog=>dialog.accept());await operationEditor(page).getByRole('button',{name:'返回导师运营列表',exact:true}).click();await expect(page.getByRole('region',{name:'导师运营列表'})).toBeVisible();
    await page.getByRole('region',{name:'导师运营列表',exact:true}).getByRole('link').first().click();await expect(page).toHaveURL(`${BASE_URL}/innovation/operations/mentors/${profile.id}`);await operationEditor(page).getByLabel('导师简介',{exact:true}).fill('R5_PRIVATE_DRAFT_SENTINEL');
    const bodies:string[]=[];const path=`**/api/v1/ie/operations/mentors/${profile.id}`;
    await page.route(path,async route=>{if(route.request().method()!=='PATCH')return route.continue();bodies.push(route.request().postData()!);const response=await route.fetch();expect(response.status()).toBe(200);if(bodies.length===1)return route.fulfill({status:503,json:{error:{code:'INTERNAL_ERROR',message:'模拟回执丢失'}}});return route.fulfill({response});});
    await operationEditor(page).getByRole('button',{name:'保存导师资料',exact:true}).click();await expect(operationEditor(page).getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(operationEditor(page).getByLabel('导师简介',{exact:true})).toHaveValue('R5_PRIVATE_DRAFT_SENTINEL');
    const returnLink=operationEditor(page).getByRole('link',{name:'返回导师运营列表',exact:true});await expect(returnLink).toHaveAttribute('aria-disabled','true');await returnLink.click({force:true});await expect(operationEditor(page).getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();
    await page.locator('a[href="/innovation"]:visible').first().click();await expect(page).toHaveURL(/\/innovation$/);await page.goBack();await expect(operationEditor(page).getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(operationEditor(page).getByLabel('导师简介',{exact:true})).toHaveValue('R5_PRIVATE_DRAFT_SENTINEL');
    await page.goBack();await expect(page.getByRole('region',{name:'导师运营列表',exact:true})).toBeVisible();await page.getByRole('region',{name:'导师运营列表',exact:true}).getByRole('link').first().click();await expect(operationEditor(page).getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(operationEditor(page).getByLabel('导师简介',{exact:true})).toHaveValue('R5_PRIVATE_DRAFT_SENTINEL');
    await operationEditor(page).getByRole('button',{name:'重试原请求',exact:true}).click();await expect(operationEditor(page).getByRole('status',{name:'导师操作结果'})).toContainText('操作已保存');expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);await page.unroute(path);
    await page.goto(`${BASE_URL}/logout`);await page.getByRole('button',{name:'确认退出登录',exact:true}).click();await expect(page).toHaveURL(/\/login/);await loginThroughUi(page,parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT'));
    await page.goto(`${BASE_URL}/innovation/operations/mentors/${profile.id}`);await expect(page.getByRole('main')).toContainText('尚未获得双创运营授权');await expect(page.getByRole('main')).not.toContainText('R5_PRIVATE_DRAFT_SENTINEL');await expect(operationEditor(page)).toHaveCount(0);
  });

  test('R5 mentor create recovery survives navigation and clears after cross-tab logout',async({page})=>{
    test.setTimeout(120_000);await grantOperations(page);await ensureStudentLogin(page);await pendingProfile(page);
    await page.goto(`${BASE_URL}/innovation/operations/mentors`);const marker=crypto.randomUUID();await page.evaluate(value=>{(window as Window & {r5RecoveryDocument?:string}).r5RecoveryDocument=value;},marker);
    await page.getByRole('button',{name:'录入导师',exact:true}).click();const editor=operationEditor(page);const account=parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR');await editor.getByLabel('导师账号',{exact:true}).fill(account.username);await editor.getByLabel('导师姓名',{exact:true}).fill('R5_CREATE_PRIVATE_SENTINEL');
    const bodies:string[]=[];const path='**/api/v1/ie/operations/mentors';
    // The real PostgreSQL suite owns creation/receipt semantics. This fixture
    // isolates recovery before an acknowledgement, followed by a definite 409.
    await page.route(path,async route=>{if(route.request().method()!=='POST')return route.continue();bodies.push(route.request().postData()!);return route.fulfill(bodies.length===2?{status:409,json:{error:{code:'CONFLICT',message:'模拟已存在的导师资料'}}}:{status:503,json:{error:{code:'INTERNAL_ERROR',message:'模拟创建回执未知'}}});});
    try{
      await editor.getByRole('button',{name:'保存导师资料',exact:true}).click();await expect(editor.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await page.locator('a[href="/innovation"]:visible').first().click();await expect(page).toHaveURL(/\/innovation$/);await page.goBack();await expect(editor.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(editor.getByLabel('导师账号',{exact:true})).toHaveValue(account.username);await expect(editor.getByLabel('导师姓名',{exact:true})).toHaveValue('R5_CREATE_PRIVATE_SENTINEL');
      await editor.getByRole('button',{name:'重试原请求',exact:true}).click();await expect(editor.getByRole('alert')).toBeVisible();expect(bodies).toHaveLength(2);expect(bodies[1]).toBe(bodies[0]);await expect(editor.getByRole('button',{name:'重试原请求',exact:true})).toHaveCount(0);await editor.getByRole('button',{name:'重新核对导师账号',exact:true}).click();await editor.getByRole('button',{name:'保存导师资料',exact:true}).click();await expect(editor.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();expect(bodies).toHaveLength(3);expect(JSON.parse(bodies[2]).request_id).not.toBe(JSON.parse(bodies[0]).request_id);
      const sibling=await page.context().newPage();
      try{await sibling.goto(`${BASE_URL}/profile`);await sibling.getByRole('region',{name:'退出当前账号',exact:true}).getByRole('link',{name:'退出登录',exact:true}).click();await sibling.getByRole('button',{name:'确认退出登录',exact:true}).click();await expect(sibling).toHaveURL(/\/login$/);await expect(editor).toHaveCount(0);await expect(page.getByRole('link',{name:'登录校内账号',exact:true})).toBeVisible();expect(await page.evaluate(()=>(window as Window & {r5RecoveryDocument?:string}).r5RecoveryDocument)).toBe(marker);
        const viewer=parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT');await sibling.getByLabel('学号',{exact:true}).fill(viewer.username);await sibling.getByLabel('密码',{exact:true}).fill(viewer.password);await sibling.getByRole('button',{name:'登录',exact:true}).click();await expect(sibling).not.toHaveURL(/\/login$/);await expect(page.getByRole('main')).not.toContainText('R5_CREATE_PRIVATE_SENTINEL');await expect(editor).toHaveCount(0);await expect(page.getByRole('button',{name:'重试原请求',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>(window as Window & {r5RecoveryDocument?:string}).r5RecoveryDocument)).toBe(marker);
      }finally{await sibling.close();}
    }finally{await page.unroute(path);}
  });

  test('R5 mentor long content stays usable on mobile and desktop',async({page,browser})=>{
    test.setTimeout(120_000);await grantOperations(page);await ensureStudentLogin(page);const profile=await pendingProfile(page);
    const changed=await page.request.patch(`${API_URL}/ie/operations/mentors/${profile.id}`,{headers:auth(process.env.CQ_E2E_STUDENT_ID!),data:{request_id:crypto.randomUUID(),version:profile.version,fields:{name:'模拟长姓名'.repeat(8),unit:'模拟学院'+'长单位'.repeat(30),introduction:'LONG_MENTOR_'+'x'.repeat(1950),directions:'学习方向'.repeat(240),achievements:'示例成果'.repeat(700),project_types:'实践项目'.repeat(240),contacts:[]}}});expect(changed.status()).toBe(200);
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});const mentor=await context.newPage();
    try{await mentorLogin(mentor,parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR'));await expect(mentor.getByRole('region',{name:'我的导师资料',exact:true})).toContainText('LONG_MENTOR_');expect(await mentor.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page:mentor}).analyze()).violations).toEqual([]);const checkbox=consentForm(mentor).getByRole('checkbox',{name:'我已核对以上资料，同意在校内展示',exact:true});await checkbox.focus();await mentor.keyboard.press('Space');await expect(checkbox).toBeChecked();await consentForm(mentor).getByRole('button',{name:'确认资料与授权',exact:true}).click();await expect(mentor.getByRole('region',{name:'我的导师资料',exact:true}).getByRole('status',{name:'导师操作结果'}).first()).toContainText('操作已保存');
      await page.setViewportSize({width:390,height:844});await page.goto(`${BASE_URL}/innovation/mentors/${profile.id}`);await expect(page.getByRole('article')).toContainText('LONG_MENTOR_');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);await page.screenshot({path:'test-results/r5-mentor-long-mobile.png'});await page.setViewportSize({width:1280,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }finally{await context.close();}
  });

  test('R5 mentor and owner can reach older links and refresh the current page after actions',async({page,browser})=>{
    test.setTimeout(120_000);await grantOperations(page);await ensureStudentLogin(page);let profile=await pendingProfile(page);
    if(profile.confirmation_state!=='PENDING'){const candidate=await page.request.patch(`${API_URL}/ie/operations/mentors/${profile.id}`,{headers:auth(process.env.CQ_E2E_STUDENT_ID!),data:{request_id:crypto.randomUUID(),version:profile.version,fields:{...profile.fields,unit:`分页待确认单位${crypto.randomUUID().slice(0,8)}`}}});expect(candidate.status()).toBe(200);profile=(await candidate.json()).current;}
    const created=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers:auth(process.env.CQ_E2E_STUDENT_ID!),data:{request_id:crypto.randomUUID(),title:'分页契约模拟项目',summary:'仅用于分页界面的私有项目',direction:'学习研究',stage:'创意',team_status:''}});expect(created.status()).toBe(201);const project=await created.json();
    type Link=components['schemas']['ProjectMentorResponse'];
    // This contract fixture tests list navigation only. Real permission, consent,
    // and 202-row pagination are covered by the PostgreSQL integration suite.
    async function installPages(target:Page,path:string){
      let rows:Link[]=Array.from({length:21},(_,index)=>({id:crypto.randomUUID(),project_id:project.id,mentor_id:profile.id,mentor_name:`分页模拟导师${index+1}`,project_title:`分页模拟项目${index+1}`,project_summary:'分页契约摘要',project_direction:'学习研究',status:'PENDING',version:1,created_at:'2026-10-15T00:00:00Z'}));
      const reads:{limit:number;offset:number}[]=[];const commands:{id:string;kind:string;body:string}[]=[];const receipts=new Map<string,{body:string;result:Link}>();
      await target.route(path,async route=>{const query=new URL(route.request().url()).searchParams;const limit=Number(query.get('limit')??20);const offset=Number(query.get('offset')??0);reads.push({limit,offset});await route.fulfill({json:{items:rows.slice(offset,offset+limit),total:rows.length,limit,offset}});});
      await target.route('**/api/v1/ie/mentor-links/**',async route=>{const parts=new URL(route.request().url()).pathname.split('/');const kind=parts.at(-1)!;const id=parts.at(-2)!;const body=route.request().postData()!;const payload=route.request().postDataJSON();commands.push({id,kind,body});const replay=receipts.get(payload.request_id);if(replay){expect(body).toBe(replay.body);await route.fulfill({json:replay.result});return;}const current=rows.find(row=>row.id===id)!;expect(current).toBeDefined();expect(payload.version).toBe(current.version);const updated:Link={...current,version:current.version+1,status:kind==='accept'?'ACCEPTED':'REVOKED'};rows=[updated,...rows.filter(row=>row.id!==id)];receipts.set(payload.request_id,{body,result:updated});await route.fulfill({status:503,json:{error:{code:'INTERNAL_ERROR',message:'分页操作模拟回执丢失'}}});});
      return {reads,commands,lastId:rows.at(-1)!.id};
    }
    async function verifyPages(target:Page,regionName:string,navName:string,kind:'accept'|'revoke',data:Awaited<ReturnType<typeof installPages>>){
      const region=target.getByRole('region',{name:regionName,exact:true});const nav=region.getByRole('navigation',{name:navName,exact:true});
      await expect(nav).toContainText('第 1 页 · 共 21 项');await expect(nav.getByRole('button',{name:'上一页',exact:true})).toBeDisabled();await expect(region.getByRole('listitem')).toHaveCount(20);
      await nav.getByRole('button',{name:'下一页',exact:true}).click();await expect(nav).toContainText('第 2 页 · 共 21 项');await expect(nav.getByRole('button',{name:'下一页',exact:true})).toBeDisabled();await expect(region.getByRole('listitem')).toHaveCount(1);await expect(region.getByRole('heading',{level:3})).toHaveText(kind==='accept'?'分页模拟项目21':'分页模拟导师21');
      const before=data.reads.filter(read=>read.offset===20).length;await region.getByRole('button',{name:kind==='accept'?'同意此项目挂名':'解除此项目挂名',exact:true}).click();await expect(region.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(nav.getByRole('button',{name:'上一页',exact:true})).toBeDisabled();await nav.getByRole('button',{name:'上一页',exact:true}).click({force:true});await expect(region.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(nav).toContainText('第 2 页 · 共 21 项');
      if(kind==='accept'){const rejectedResponse=target.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname.endsWith('/ie/me/mentor/reject'));await target.getByRole('button',{name:'拒绝候选资料',exact:true}).click();const rejected=await rejectedResponse;expect(rejected.status()).toBe(200);const current=(await rejected.json()).current;expect(current.confirmation_state).toBe('REJECTED');expect(current.version).toBeGreaterThan(profile.version);await expect(target.getByRole('region',{name:'我的导师资料',exact:true})).toContainText('候选资料已拒绝');await expect(nav).toContainText('第 2 页 · 共 21 项');await expect(region.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();}
      if(kind==='revoke'){await target.getByRole('button',{name:'返回草稿列表',exact:true}).click();await expect(target.getByRole('button',{name:'编辑项目：分页契约模拟项目',exact:true})).toBeVisible();await target.getByRole('button',{name:'编辑项目：分页契约模拟项目',exact:true}).click();await expect(region.getByRole('button',{name:'重试原请求',exact:true})).toBeVisible();await expect(nav).toContainText('第 2 页 · 共 21 项');}
      await region.getByRole('button',{name:'重试原请求',exact:true}).click();
      await expect.poll(()=>data.reads.filter(read=>read.offset===20).length).toBeGreaterThan(before);await expect(nav).toContainText('第 2 页 · 共 21 项');await expect(region.getByRole('heading',{level:3})).toHaveText(kind==='accept'?'分页模拟项目20':'分页模拟导师20');await expect(region.getByRole('region',{name:'项目挂名操作结果',exact:true}).getByRole('status',{name:'导师操作结果',exact:true})).toContainText('操作已保存');expect(data.commands.map(({id,kind:action})=>({id,kind:action}))).toEqual([{id:data.lastId,kind},{id:data.lastId,kind}]);expect(data.commands[1].body).toBe(data.commands[0].body);expect(data.reads.every(read=>read.limit===20)).toBe(true);
      await nav.getByRole('button',{name:'上一页',exact:true}).click();await expect(nav).toContainText('第 1 页 · 共 21 项');const processed=region.getByRole('listitem').filter({has:target.getByRole('heading',{name:kind==='accept'?'分页模拟项目21':'分页模拟导师21',exact:true})});await expect(processed).toContainText(kind==='accept'?'导师已同意':'已解除');
    }
    const context=await browser.newContext({ignoreHTTPSErrors:true});const mentor=await context.newPage();
    try{const mentorData=await installPages(mentor,'**/api/v1/ie/me/mentor/project-links*');await mentorLogin(mentor,parseSeededAccount(process.env.CQ_E2E_MENTOR,'CQ_E2E_MENTOR'));await verifyPages(mentor,'导师项目挂名待办','导师项目挂名分页','accept',mentorData);
      const ownerData=await installPages(page,`**/api/v1/ie/me/project-drafts/${project.id}/mentors*`);await page.goto(`${BASE_URL}/profile/project-drafts`);await page.getByRole('button',{name:'编辑项目：分页契约模拟项目',exact:true}).click();await verifyPages(page,'项目导师挂名','项目导师挂名分页','revoke',ownerData);
    }finally{await mentor.unrouteAll({behavior:'wait'});await context.close();await page.unrouteAll({behavior:'wait'});}
  });
});
