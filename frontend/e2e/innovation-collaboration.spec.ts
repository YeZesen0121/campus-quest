import { API_URL, BASE_URL, expect, test, ensureStudentLogin, mintToken, loginThroughUi, parseSeededAccount } from './fixtures';
import type { Page } from '@playwright/test';
import { prepare, fillRole, publish } from './recruitment-helpers';
import { withCollaborationWorld } from './collaboration-world';
import { captureR6Evidence } from './collaboration-screenshots';

test.skip(process.env.CQ_E2E!=='1','CQ_E2E=1 with the owned real database');
test.use({actionTimeout:15_000});

test('R6 collaboration achievement editor saves text without exposing proof or submission controls',async({page})=>{
  await ensureStudentLogin(page);
  const response=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers:{Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`},data:{request_id:crypto.randomUUID(),title:'R6模拟文字协作项目',summary:'真实接口测试用模拟资料',direction:'学习',stage:'调研',team_status:''}});
  expect(response.status()).toBe(201);const project=await response.json();
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${project.id}/achievements`);
  await page.getByRole('button',{name:'新建成果文字',exact:true}).click();
  await page.getByLabel('成果名称',{exact:true}).fill('R6模拟调研成果');
  await page.getByLabel('作品与阶段成果说明',{exact:true}).fill('只保存文字，不包含任何证明授权。');
  await page.getByRole('button',{name:'保存成果文字',exact:true}).click();
  await expect(page.getByRole('region',{name:'成果文字编辑器'}).getByRole('status')).toContainText('文字已保存');
  await expect(page.getByRole('button',{name:/上传证明|提交首次核实|提交更新复审/})).toHaveCount(0);
});

const headers=(userId:string)=>({Authorization:`Bearer ${mintToken(userId)}`});
async function sendInvite(page:Page,projectId:string,kind:'MANAGER'|'MEMBER',name='模拟共学成员',division='访谈整理') {
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${projectId}`);
  const invite=page.getByRole('region',{name:'邀请协作',exact:true});
  await invite.getByRole('radio',{name:kind==='MANAGER'?'共同管理文字与招募':'公开姓名与分工',exact:true}).check();
  await invite.getByLabel('对方账号',{exact:true}).fill(parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT').username);
  await invite.getByRole('button',{name:'核对对象',exact:true}).click();
  await expect(invite.getByRole('status').first()).toContainText('已核对昵称');
  if(kind==='MEMBER'){await invite.getByLabel('候选公开姓名',{exact:true}).fill(name);await invite.getByLabel('候选分工',{exact:true}).fill(division);}
  const posted=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname.endsWith('/collaborators'));
  await invite.getByRole('button',{name:kind==='MANAGER'?'发送共同管理邀请':'发送公开挂名候选',exact:true}).click();
  expect((await posted).status()).toBe(200);
}
async function actInvitation(page:Page,label:string) {
  const inbox=page.getByRole('region',{name:'本人的协作邀请与同意',exact:true});
  await inbox.getByRole('button',{name:label,exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:label,exact:true}).click();await expect(dialog).toBeHidden();
  // The trigger ends with the relation, so completion focuses its durable result.
  await expect(inbox.getByRole('status').and(page.locator(':focus'))).toContainText(label.startsWith('同意')?'本人已同意':label.startsWith('拒绝')?'本人已拒绝':'已撤销或退出');
}
test('R6 management and public membership have separate consent, editable text and immediate independent exit',async({page,browser},info)=>{
  test.setTimeout(240_000);
  await withCollaborationWorld(page,async()=>{
  const projectId=await prepare(page,{title:'R6模拟分开同意项目'});
  const recruitment=await fillRole(page);await recruitment.getByRole('button',{name:'保存招募草稿',exact:true}).click();
  await expect(recruitment.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');await publish(page);
  await sendInvite(page,projectId,'MANAGER');await sendInvite(page,projectId,'MEMBER');
  const targetContext=await browser.newContext({ignoreHTTPSErrors:true});const target=await targetContext.newPage();
  const targetAuth=headers(process.env.CQ_E2E_AUTHOR_STUDENT_ID!);
  try{
    await loginThroughUi(target,parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT'));
    expect((await target.request.get(`${API_URL}/ie/collaboration/projects/${projectId}`,{headers:targetAuth})).status()).toBe(404);
    await target.goto(`${BASE_URL}/profile/collaboration`);await actInvitation(target,'同意共同管理');
    let members=await target.request.get(`${API_URL}/ie/projects/${projectId}/members`,{headers:targetAuth});expect(members.status()).toBe(200);expect((await members.json()).items).toEqual([]);
    const privateReads:string[]=[];target.on('request',request=>{if(/\/evidence(?:\/|\?)|\/submit(?:-|$)/.test(new URL(request.url()).pathname))privateReads.push(request.url());});
    await target.goto(`${BASE_URL}/profile/collaboration?role=MANAGER`);await target.getByRole('link',{name:'协作工作区',exact:true}).click();
    const form=target.getByRole('region',{name:'协作项目文字',exact:true});await form.getByLabel('项目简介',{exact:true}).fill('共管保存的模拟私稿');
    await form.getByRole('button',{name:'保存项目文字',exact:true}).click();await expect(form.getByRole('status').last()).toContainText('与当前读取版本一致');
    await expect(target.getByRole('region',{name:'发起负责人交接',exact:true})).toHaveCount(0);
    await expect(target.getByRole('link',{name:'负责人证明与成果提审',exact:true})).toHaveCount(0);expect(privateReads).toEqual([]);
    const originalViewport=target.viewportSize()!;
    await target.setViewportSize({width:390,height:900});
    await captureR6Evidence(target,target.getByRole('main'),info.outputPath('r6-manager-workspace-390.png'));
    await target.setViewportSize(originalViewport);
    await form.getByLabel('项目简介',{exact:true}).fill('冲突时保留的共管输入');
    const ownerAuth=headers(process.env.CQ_E2E_STUDENT_ID!);
    const latest=await page.request.get(`${API_URL}/ie/collaboration/projects/${projectId}`,{headers:ownerAuth});const workspace=await latest.json();
    const {title,direction,stage,team_status,version}=workspace.draft;
    expect((await page.request.patch(`${API_URL}/ie/collaboration/projects/${projectId}`,{headers:ownerAuth,data:{title,summary:'负责人另一页面已保存',direction,stage,team_status,version,request_id:crypto.randomUUID()}})).status()).toBe(200);
    await form.getByRole('button',{name:'保存项目文字',exact:true}).click();await expect(form.getByRole('alert')).toContainText('当前输入仍保留');
    await expect(form.getByLabel('项目简介',{exact:true})).toHaveValue('冲突时保留的共管输入');
    await form.getByRole('button',{name:'读取最新文字（保留输入）',exact:true}).click();
    await expect(target.getByRole('region',{name:'最新项目文字',exact:true})).toContainText('负责人另一页面已保存');await expect(form.getByLabel('项目简介',{exact:true})).toHaveValue('冲突时保留的共管输入');
    await target.getByRole('button',{name:'载入最新文字',exact:true}).click();
    const savedBodies:unknown[]=[];let lose=true;
    await target.route(`**/api/v1/ie/collaboration/projects/${projectId}`,async route=>{if(route.request().method()!=='PATCH')return route.continue();savedBodies.push(route.request().postDataJSON());if(lose){lose=false;await route.fetch();return route.abort('failed');}return route.continue();});
    await form.getByLabel('项目简介',{exact:true}).fill('响应丢失后仍保留的共管输入');await form.getByRole('button',{name:'保存项目文字',exact:true}).click();
    await expect(form.getByRole('button',{name:'核对原操作结果',exact:true})).toBeVisible();await expect(form.getByLabel('项目简介',{exact:true})).toHaveValue('响应丢失后仍保留的共管输入');
    await form.getByRole('button',{name:'核对原操作结果',exact:true}).click();await expect(form.getByRole('status').last()).toContainText('与当前读取版本一致');
    expect(savedBodies).toHaveLength(2);expect(savedBodies[0]).toEqual(savedBodies[1]);await target.unrouteAll({behavior:'wait'});
    await target.getByRole('link',{name:'协作招募管理',exact:true}).click();await target.getByRole('button',{name:'新建招募岗位',exact:true}).click();
    const sharedRecruitment=target.getByRole('region',{name:'招募岗位编辑器',exact:true});await sharedRecruitment.getByLabel('岗位名称',{exact:true}).fill('无资格共管准备的岗位');await sharedRecruitment.getByRole('button',{name:'保存招募草稿',exact:true}).click();
    await expect(sharedRecruitment.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');await expect(sharedRecruitment.getByRole('button',{name:'预览发布招募',exact:true})).toBeDisabled();
    await target.setViewportSize({width:390,height:900});
    await captureR6Evidence(target,sharedRecruitment,info.outputPath('r6-manager-unqualified-recruitment-390.png'));
    await target.goto(`${BASE_URL}/profile/collaboration`);
    await expect(target.getByRole('button',{name:'同意公开挂名',exact:true})).toBeVisible();
    await captureR6Evidence(target,target.getByRole('region',{name:'本人的协作邀请与同意',exact:true}),info.outputPath('r6-member-pending-consent-390.png'));
    await target.setViewportSize(originalViewport);
    await actInvitation(target,'同意公开挂名');
    await target.goto(`${BASE_URL}/innovation/projects/${projectId}`);
    const publicMembers=target.getByRole('region',{name:'本人同意公开的项目成员',exact:true});await expect(publicMembers).toContainText('模拟共学成员');await expect(publicMembers).toContainText('访谈整理');
    await captureR6Evidence(target,publicMembers,info.outputPath('r6-member-consent-public.png'));
    await expect(target.getByRole('main')).not.toContainText('响应丢失后仍保留的共管输入');
    await sendInvite(page,projectId,'MEMBER','尚未确认的新姓名','尚未确认的新分工');
    await target.goto(`${BASE_URL}/profile/collaboration`);await actInvitation(target,'拒绝公开挂名');
    members=await target.request.get(`${API_URL}/ie/projects/${projectId}/members`,{headers:targetAuth});expect((await members.json()).items).toEqual([{public_name:'模拟共学成员',division:'访谈整理'}]);
    await target.goto(`${BASE_URL}/profile/collaboration`);await actInvitation(target,'撤下公开挂名');
    members=await target.request.get(`${API_URL}/ie/projects/${projectId}/members`,{headers:targetAuth});expect((await members.json()).items).toEqual([]);
    expect((await target.request.get(`${API_URL}/ie/collaboration/projects/${projectId}`,{headers:targetAuth})).status()).toBe(200);
    await target.goto(`${BASE_URL}/profile/collaboration`);await actInvitation(target,'退出共同管理');
    expect((await target.request.get(`${API_URL}/ie/collaboration/projects/${projectId}`,{headers:targetAuth})).status()).toBe(404);
  }finally{await targetContext.close();}
  });
});
