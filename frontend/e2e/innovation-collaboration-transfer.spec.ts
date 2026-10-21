import { API_URL, BASE_URL, expect, ensureStudentLogin, loginThroughUi, mintToken, parseSeededAccount } from './fixtures';
import { test } from './collaboration-fixtures';
import type { Page } from '@playwright/test';
import { prepare, fillRole, publish } from './recruitment-helpers';
import { captureR6Evidence } from './collaboration-screenshots';

test.skip(process.env.CQ_E2E!=='1','CQ_E2E=1 with owned PostgreSQL, MinIO and ClamAV');
test.use({actionTimeout:15_000});
const auth=(id:string)=>({Authorization:`Bearer ${mintToken(id)}`});
async function qualify(page:Page,userId:string) {
  const headers=auth(userId),path=`${API_URL}/ie/me/owner-qualification`;
  const state=await(await page.request.get(path,{headers})).json();if(state.status==='APPROVED')return;
  let version=state.version;
  if(state.status!=='PENDING'){
    const profile=await(await page.request.get(`${API_URL}/ie/me/owner-profile`,{headers})).json();
    const saved=await page.request.put(`${API_URL}/ie/me/owner-profile`,{headers,data:{version:profile.profile?.version??0,name:'R6模拟接任人',student_no:'00998877',major:'模拟专业',grade:'2026级'}});expect(saved.status()).toBe(200);
    const applied=await page.request.post(path,{headers,data:{version,profile_version:(await saved.json()).version}});expect(applied.status()).toBe(200);version=(await applied.json()).version;
  }
  expect((await page.request.post(`${API_URL}/admin/ie/owner-qualifications/${userId}/approve`,{headers:auth(process.env.CQ_E2E_ADMIN_ID!),data:{version}})).status()).toBe(200);
}
async function proof(page:Page,projectId:string,title:string) {
  const headers=auth(process.env.CQ_E2E_STUDENT_ID!),root=`${API_URL}/ie/me/project-drafts/${projectId}/achievements`;
  const created=await page.request.post(root,{headers,data:{request_id:crypto.randomUUID(),title,description:'R6模拟交接成果说明',work_url:'',award_text:''}});expect(created.status()).toBe(201);const achievement=await created.json();
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
  const intent=await page.request.post(`${root}/${achievement.id}/evidence`,{headers,data:{request_id:crypto.randomUUID(),content_type:'application/pdf',size:pdf.length}});expect(intent.status()).toBe(201);const upload=await intent.json();
  expect((await page.request.put(upload.upload_url,{headers:upload.client_headers,data:pdf})).status()).toBe(200);
  const completed=await page.request.post(`${root}/${achievement.id}/evidence/${upload.evidence.id}/complete`,{headers});expect(completed.status()).toBe(200);expect((await completed.json()).state).toBe('READY');
  return {achievement,evidence:upload.evidence,root:`${root}/${achievement.id}`};
}
async function pickSuccessor(page:Page,projectId:string) {
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${projectId}`);
  const form=page.getByRole('region',{name:'发起负责人交接',exact:true});
  await form.getByLabel('对方账号',{exact:true}).fill(parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT').username);
  await form.getByRole('button',{name:'核对对象',exact:true}).click();await expect(form.getByRole('status').first()).toContainText('已核对昵称');return form;
}
async function openTransfer(page:Page) {
  await page.getByRole('region',{name:'发起负责人交接',exact:true}).getByRole('button',{name:'核对并发起交接',exact:true}).click();
  await page.getByRole('dialog',{name:'发起项目交接',exact:true}).getByRole('button',{name:'确认发起交接',exact:true}).click();
}

test('R6 an unqualified owner can hand over an existing achievement draft without proof access',async({page},info)=>{
  await ensureStudentLogin(page);
  await page.setViewportSize({width:390,height:844});
  const ownerHeaders=auth(process.env.CQ_E2E_STUDENT_ID!);
  const qualification=await page.request.get(`${API_URL}/ie/me/owner-qualification`,{headers:ownerHeaders});
  expect((await qualification.json()).status).toBe('NOT_APPLIED');
  const created=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers:ownerHeaders,data:{request_id:crypto.randomUUID(),title:'模拟无资格原负责人交接',summary:'原负责人未申请发布资格，仍可维护文字并交接。',direction:'学习',stage:'调研',team_status:'模拟小组'}});
  expect(created.status()).toBe(201);const projectId=(await created.json()).id;
  const achievement=await page.request.post(`${API_URL}/ie/me/project-drafts/${projectId}/achievements`,{headers:ownerHeaders,data:{request_id:crypto.randomUUID(),title:'已有模拟成果文字'}});
  expect(achievement.status()).toBe(201);const achievementId=(await achievement.json()).id;
  expect((await page.request.get(`${API_URL}/ie/me/project-drafts/${projectId}/achievements/${achievementId}/evidence`,{headers:ownerHeaders})).status()).toBe(403);
  await qualify(page,process.env.CQ_E2E_AUTHOR_STUDENT_ID!);
  const form=await pickSuccessor(page,projectId);
  await expect(form.getByText('暂无已就绪证明，可不选证明发起交接。',{exact:true})).toBeVisible();
  await expect(form.getByRole('button',{name:'核对并发起交接',exact:true})).toBeEnabled();
  await captureR6Evidence(page,form,info.outputPath('r6-unqualified-owner-transfer-390.png'));
  await openTransfer(page);await expect(form.getByRole('link',{name:'查看本次交接',exact:true})).toBeVisible();
});

test('R6 selected proof preview, revocation, stale confirmation, lost receipt and per-job reopening across owners',async({page,browser},info)=>{
  test.setTimeout(360_000);
  await prepare(page);
  const originalCreate={request_id:crypto.randomUUID(),title:'R6模拟交接项目',summary:'模拟公开前项目概况',direction:'学习',stage:'实践',team_status:'模拟两人小组'};
  const created=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers:auth(process.env.CQ_E2E_STUDENT_ID!),data:originalCreate});expect(created.status()).toBe(201);const projectId=(await created.json()).id as string;
  await page.goto(`${BASE_URL}/profile/project-drafts/${projectId}/recruitments`);
  const job=await fillRole(page);await job.getByRole('button',{name:'保存招募草稿',exact:true}).click();await expect(job.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');await publish(page);
  const chosen=await proof(page,projectId,'交接选中成果'),unselected=await proof(page,projectId,'不交接的成果');
  await qualify(page,process.env.CQ_E2E_AUTHOR_STUDENT_ID!);
  const ownerAuth=auth(process.env.CQ_E2E_STUDENT_ID!),targetAuth=auth(process.env.CQ_E2E_AUTHOR_STUDENT_ID!);
  const wf=await(await page.request.get(`${chosen.root}/workflow`,{headers:ownerAuth})).json();
  const currentProject=await(await page.request.get(`${API_URL}/ie/me/project-drafts/${projectId}`,{headers:ownerAuth})).json();
  const submitted=await page.request.post(`${chosen.root}/submit`,{headers:ownerAuth,data:{request_id:crypto.randomUUID(),workflow_version:wf.version,project_version:currentProject.version,achievement_version:chosen.achievement.version,evidence_ids:[chosen.evidence.id]}});expect(submitted.status()).toBe(200);
  let form=await pickSuccessor(page,projectId);await form.getByRole('checkbox',{name:/交接选中成果/}).check();await form.getByRole('checkbox',{name:/另行授权接任人/}).check();await openTransfer(page);
  await expect(page.getByRole('dialog')).toContainText('待核实');await page.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
  const pending=await(await page.request.get(`${chosen.root}/workflow`,{headers:ownerAuth})).json();
  expect((await page.request.post(`${chosen.root}/withdraw`,{headers:ownerAuth,data:{workflow_version:pending.version,case_id:pending.review_case.id,case_version:pending.review_case.version}})).status()).toBe(200);
  // Refresh clears the rejected command, while the server rechecks the same project.
  form=await pickSuccessor(page,projectId);await form.getByRole('checkbox',{name:/交接选中成果/}).check();await form.getByRole('checkbox',{name:/另行授权接任人/}).check();await openTransfer(page);
  await Promise.all([page.waitForURL(/\/profile\/collaboration\/transfers\/[^/]+$/, {timeout:15_000}),form.getByRole('link',{name:'查看本次交接',exact:true}).click()]);await expect(page).toHaveURL(/\/profile\/collaboration\/transfers\/[^/]+$/);const firstId=new URL(page.url()).pathname.split('/').at(-1)!;
  const targetContext=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});const target=await targetContext.newPage();
  try{
    await loginThroughUi(target,parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT'));
    const targetSummary=await target.request.get(`${API_URL}/ie/transfers/${firstId}`,{headers:targetAuth});
    expect(targetSummary.status()).toBe(200);expect((await targetSummary.json()).is_target).toBe(true);
    const browserSummary=target.waitForResponse(response=>new URL(response.url()).pathname===`/api/v1/ie/transfers/${firstId}`&&response.request().method()==='GET');
    await target.goto(`${BASE_URL}/profile/collaboration/transfers/${firstId}`);
    const loadedSummary=await browserSummary;expect(loadedSummary.status()).toBe(200);const loaded=await loadedSummary.json();expect(loaded.is_target).toBe(true);expect(loaded.allow_preview).toBe(true);
    await expect(target.getByRole('region',{name:'交接摘要与结果',exact:true})).toBeVisible();
    await expect(target.getByRole('button',{name:/主动查阅证明/})).toHaveCount(1);
    await target.getByRole('button',{name:'主动查阅证明 1',exact:true}).click();
    const download=target.waitForEvent('download');await target.getByRole('dialog',{name:'主动查阅交接证明',exact:true}).getByRole('button',{name:'确认并读取这份证明',exact:true}).click();expect(await(await download).failure()).toBeNull();
    const first=await(await page.request.get(`${API_URL}/ie/transfers/${firstId}`,{headers:ownerAuth})).json();
    expect((await target.request.get(`${API_URL}/ie/transfers/${firstId}/evidence/${unselected.evidence.id}?version=${first.version}`,{headers:targetAuth})).status()).toBe(404);
    await page.getByRole('button',{name:'取消交接',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认取消交接',exact:true}).click();await expect(page.getByRole('region',{name:'交接摘要与结果'})).toContainText('发起人已取消');
    expect([403,404,409]).toContain((await target.request.get(`${API_URL}/ie/transfers/${firstId}/evidence/${chosen.evidence.id}?version=${first.version}`,{headers:targetAuth})).status());
    form=await pickSuccessor(page,projectId);await form.getByRole('checkbox',{name:/交接选中成果/}).check();await openTransfer(page);await Promise.all([page.waitForURL(/\/profile\/collaboration\/transfers\/[^/]+$/, {timeout:15_000}),form.getByRole('link',{name:'查看本次交接',exact:true}).click()]);await expect(page).toHaveURL(/\/profile\/collaboration\/transfers\/[^/]+$/);const transferId=new URL(page.url()).pathname.split('/').at(-1)!;
    await target.goto(`${BASE_URL}/profile/collaboration/transfers/${transferId}`);await expect(target.getByRole('button',{name:/主动查阅证明/})).toHaveCount(0);
    await expect(target.getByRole('region',{name:'交接摘要与结果',exact:true})).toContainText('模拟公开前项目概况');
    await expect(target.getByRole('button',{name:'确认接任项目',exact:true})).toBeEnabled();
    const ownerDraft=await(await page.request.get(`${API_URL}/ie/me/project-drafts/${projectId}`,{headers:ownerAuth})).json();
    expect((await page.request.patch(`${API_URL}/ie/collaboration/projects/${projectId}`,{headers:ownerAuth,data:{request_id:crypto.randomUUID(),version:ownerDraft.version,title:ownerDraft.title,summary:'发起后变更的模拟概况',direction:ownerDraft.direction,stage:ownerDraft.stage,team_status:ownerDraft.team_status}})).status()).toBe(200);
    const staleAccept=target.waitForResponse(response=>new URL(response.url()).pathname===`/api/v1/ie/transfers/${transferId}/accept`&&response.request().method()==='POST');
    await target.getByRole('button',{name:'确认接任项目',exact:true}).click();await target.getByRole('dialog').getByRole('button',{name:'确认接任并关闭现有岗位',exact:true}).click();expect((await staleAccept).status()).toBe(409);await expect(target.getByRole('dialog').getByRole('alert')).toContainText('已变化');await target.getByRole('dialog').getByRole('button',{name:'取消',exact:true}).click();
    await target.getByRole('button',{name:'读取最新交接摘要',exact:true}).click();await expect(target.getByRole('region',{name:'交接摘要与结果'})).toContainText('发起后资料已有变化');
    await captureR6Evidence(target,target.getByRole('main'),info.outputPath('r6-transfer-current-mobile.png'));
    let accepts=0;await target.route(`**/api/v1/ie/transfers/${transferId}/accept`,async route=>{accepts++;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed');});
    await target.getByRole('button',{name:'确认接任项目',exact:true}).click();await target.getByRole('dialog').getByRole('button',{name:'确认接任并关闭现有岗位',exact:true}).click();
    await target.getByRole('button',{name:'核对原操作结果',exact:true}).click();await expect(target.getByRole('region',{name:'交接摘要与结果'})).toContainText('交接已生效');expect(accepts).toBe(1);await target.unrouteAll({behavior:'wait'});
    const oldReplay=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers:ownerAuth,data:originalCreate});expect(oldReplay.status()).toBe(200);expect(await oldReplay.json()).toEqual({id:projectId,ownership:'TRANSFERRED'});
    expect((await page.request.get(`${API_URL}/ie/me/project-drafts/${projectId}`,{headers:ownerAuth})).status()).toBe(404);
    const inherited=await target.request.get(`${API_URL}/ie/me/project-drafts/${projectId}/achievements/${chosen.achievement.id}/evidence`,{headers:targetAuth});expect((await inherited.json()).items.map((item:{id:string})=>item.id)).toEqual([chosen.evidence.id]);
    const notInherited=await target.request.get(`${API_URL}/ie/me/project-drafts/${projectId}/achievements/${unselected.achievement.id}/evidence`,{headers:targetAuth});expect(notInherited.status()).toBe(200);expect((await notInherited.json()).items).toEqual([]);
    const duplicateKey=await target.request.post(`${API_URL}/ie/me/project-drafts`,{headers:targetAuth,data:originalCreate});expect(duplicateKey.status()).toBe(201);expect((await duplicateKey.json()).id).not.toBe(projectId);
    await target.getByRole('link',{name:'逐岗核对招募与新联系授权',exact:true}).click();await target.getByRole('button',{name:'编辑草稿',exact:true}).click();
    const editor=target.getByRole('region',{name:'招募岗位编辑器',exact:true});await expect(editor).toContainText('已关闭');await expect(editor.getByRole('checkbox',{name:'授权微信',exact:true})).not.toBeChecked();await editor.getByRole('checkbox',{name:'授权微信',exact:true}).check();await editor.getByLabel('微信',{exact:true}).fill('r6_next_owner');
    await editor.getByRole('button',{name:'保存招募草稿',exact:true}).click();await expect(editor.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');await editor.getByRole('button',{name:'重新开放招募',exact:true}).click();await target.getByRole('dialog').getByRole('button',{name:'确认重新开放',exact:true}).click();await expect(editor.getByRole('status',{name:'招募操作结果'})).toContainText('正在招募');
  }finally{await targetContext.close();}
});

test('R6 recruitment-only completion retains a clear archive, explicit corrections and resume never reopen jobs',async({page},info)=>{
  test.setTimeout(240_000);const projectId=await prepare(page,{title:'R6模拟结项项目'});
  const job=await fillRole(page);await job.getByRole('button',{name:'保存招募草稿',exact:true}).click();await expect(job.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');await publish(page);
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${projectId}`);const lifecycle=page.getByRole('region',{name:'项目状态与公开介绍',exact:true});
  await lifecycle.getByRole('button',{name:'预览结项后果',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('关闭 1 个开放岗位');await page.getByRole('dialog').getByRole('button',{name:'确认结项并关闭岗位',exact:true}).click();await expect(lifecycle.getByRole('status').first()).toContainText('已结项');
  await page.goto(`${BASE_URL}/innovation/projects/${projectId}`);await expect(page.getByRole('article')).toContainText('已结项');await expect(page.getByRole('article')).toContainText('免审');await expect(page.getByText('暂无已核实成果',{exact:true})).toBeVisible();
  for(const width of [390,1440]){await page.setViewportSize({width,height:900});await captureR6Evidence(page,page.getByRole('main'),info.outputPath(`r6-archive-${width}.png`));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${projectId}`);await lifecycle.getByLabel('介绍标题',{exact:true}).fill('更正后的模拟项目介绍');await lifecycle.getByLabel('介绍正文',{exact:true}).fill('明确发布的更正说明，不是已核实成果。');await lifecycle.getByRole('button',{name:'生成介绍预览',exact:true}).click();
  await lifecycle.getByRole('button',{name:'核对并发布此介绍',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认发布此介绍',exact:true}).click();await expect(lifecycle.getByRole('status').first()).toContainText('第 2 版');
  await lifecycle.getByRole('button',{name:'恢复为进行中',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('不会自动恢复');await page.getByRole('dialog').getByRole('button',{name:'确认恢复',exact:true}).click();await expect(lifecycle.getByRole('status').first()).toContainText('进行中');
  await page.goto(`${BASE_URL}/innovation/projects/${projectId}`);await expect(page.getByRole('heading',{name:'更正后的模拟项目介绍',exact:true})).toBeVisible();await expect(page.getByText('暂无有效招募',{exact:true})).toBeVisible();
});
