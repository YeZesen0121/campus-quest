import { API_URL, BASE_URL, expect, ensureStudentLogin, mintToken } from './fixtures';
import { test } from './collaboration-fixtures';
import { prepare, fillRole, publish } from './recruitment-helpers';

test.skip(process.env.CQ_E2E!=='1','CQ_E2E=1 with actual save receipts and later versions');
test.use({actionTimeout:15_000});

test('R6 recruitment save replay preserves original inputs when a later writer has changed the draft',async({page})=>{
  test.setTimeout(180_000);const projectId=await prepare(page);
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${projectId}/recruitments`);
  const editor=await fillRole(page);
  const created=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/api/v1/ie/collaboration/projects/${projectId}/recruitments`);
  await editor.getByRole('button',{name:'保存招募草稿',exact:true}).click();const initial=await(await created).json();
  await expect(editor.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');
  const headers={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`};let lose=true;const commands:unknown[]=[];
  await page.route(`**/api/v1/ie/collaboration/projects/${projectId}/recruitments/${initial.id}`,async route=>{
    if(route.request().method()!=='PATCH')return route.continue();commands.push(route.request().postDataJSON());
    if(!lose)return route.continue();lose=false;
    const response=await route.fetch();expect(response.status()).toBe(200);const saved=await response.json();
    const changed=await page.request.patch(`${API_URL}/ie/collaboration/projects/${projectId}/recruitments/${initial.id}`,{headers,data:{request_id:crypto.randomUUID(),version:saved.version,fields:{...saved.fields,role_name:'另一编辑者后来保存的岗位'}}});expect(changed.status()).toBe(200);
    await route.abort('failed');
  });
  await editor.getByLabel('岗位名称',{exact:true}).fill('原请求中必须保留的岗位');await editor.getByRole('button',{name:'保存招募草稿',exact:true}).click();
  await editor.getByRole('button',{name:'重试原请求',exact:true}).click();
  await expect(editor.getByLabel('岗位名称',{exact:true})).toHaveValue('原请求中必须保留的岗位');
  await expect(editor.getByRole('region',{name:'最新招募版本',exact:true})).toContainText('另一编辑者后来保存的岗位');
  expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);
  await page.getByRole('link',{name:'我的',exact:true}).click();await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole('link',{name:'协作与交接',exact:true}).click();await page.locator(`a[href="/profile/collaboration/projects/${projectId}"]`).click();
  await page.getByRole('link',{name:'协作招募管理',exact:true}).click();
  await expect(editor.getByRole('region',{name:'最新招募版本',exact:true})).toContainText('另一编辑者后来保存的岗位');
  await expect(editor.getByLabel('岗位名称',{exact:true})).toHaveValue('原请求中必须保留的岗位');
  await expect(editor.getByRole('button',{name:'保存招募草稿',exact:true})).toBeDisabled();
  await editor.getByRole('button',{name:'载入最新版本',exact:true}).click();await expect(editor.getByLabel('岗位名称',{exact:true})).toHaveValue('另一编辑者后来保存的岗位');
});

test('R6 achievement create replay keeps the submitted input and offers the later version without navigating away',async({page})=>{
  await ensureStudentLogin(page);const headers={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`};
  const created=await page.request.post(`${API_URL}/ie/me/project-drafts`,{headers,data:{request_id:crypto.randomUUID(),title:'模拟成果创建恢复',summary:'模拟说明',direction:'',stage:'',team_status:''}});expect(created.status()).toBe(201);const project=await created.json();
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${project.id}/achievements`);await page.getByRole('button',{name:'新建成果文字',exact:true}).click();
  const editor=page.getByRole('region',{name:'成果文字编辑器',exact:true});let lose=true;const commands:unknown[]=[];
  await page.route(`**/api/v1/ie/collaboration/projects/${project.id}/achievements`,async route=>{
    if(route.request().method()!=='POST')return route.continue();commands.push(route.request().postDataJSON());if(!lose)return route.continue();lose=false;
    const response=await route.fetch();expect(response.status()).toBe(201);const saved=await response.json();
    const changed=await page.request.patch(`${API_URL}/ie/collaboration/projects/${project.id}/achievements/${saved.id}`,{headers,data:{request_id:crypto.randomUUID(),version:saved.version,title:'后来编辑的成果名称',description:saved.description,award_text:saved.award_text,work_url:saved.work_url}});expect(changed.status()).toBe(200);await route.abort('failed');
  });
  await editor.getByLabel('成果名称',{exact:true}).fill('原创建请求中的成果');await editor.getByRole('button',{name:'保存成果文字',exact:true}).click();
  await editor.getByRole('button',{name:'核对原操作结果',exact:true}).click();
  await expect(editor.getByRole('region',{name:'最新成果文字',exact:true})).toContainText('后来编辑的成果名称');
  await expect(editor.getByLabel('成果名称',{exact:true})).toHaveValue('原创建请求中的成果');expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);
  await editor.getByRole('button',{name:'载入最新成果文字',exact:true}).click();await expect(editor.getByLabel('成果名称',{exact:true})).toHaveValue('后来编辑的成果名称');
});

test('R6 an unknown introduction publication restores its frozen custom inputs after leaving and returning',async({page})=>{
  test.setTimeout(180_000);const projectId=await prepare(page);const job=await fillRole(page);await job.getByRole('button',{name:'保存招募草稿',exact:true}).click();await expect(job.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');await publish(page);
  await page.goto(`${BASE_URL}/profile/collaboration/projects/${projectId}`);const life=page.getByRole('region',{name:'项目状态与公开介绍',exact:true});
  await life.getByRole('button',{name:'预览结项后果',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认结项并关闭岗位',exact:true}).click();await expect(life.getByRole('status').first()).toContainText('已结项');
  await life.getByLabel('介绍标题',{exact:true}).fill('原发布请求的自定义介绍');await life.getByLabel('介绍正文',{exact:true}).fill('必须在返回后保留的模拟介绍正文');await life.getByRole('button',{name:'生成介绍预览',exact:true}).click();
  let publications=0;await page.route(`**/api/v1/ie/me/project-drafts/${projectId}/introduction/publish`,async route=>{publications++;const response=await route.fetch();expect(response.status()).toBe(200);await route.abort('failed');});
  await life.getByRole('button',{name:'核对并发布此介绍',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认发布此介绍',exact:true}).click();await expect(life.getByRole('button',{name:'核对原操作结果',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'返回协作与交接',exact:true}).click();await expect(page).toHaveURL(/\/profile\/collaboration$/);
  await page.locator(`a[href="/profile/collaboration/projects/${projectId}"]`).click();await expect(page).toHaveURL(new RegExp(`/profile/collaboration/projects/${projectId}$`));
  await expect(life.getByLabel('介绍标题',{exact:true})).toHaveValue('原发布请求的自定义介绍');
  await expect(life.getByLabel('介绍正文',{exact:true})).toHaveValue('必须在返回后保留的模拟介绍正文');
  await page.unrouteAll({behavior:'wait'});await life.getByRole('button',{name:'核对原操作结果',exact:true}).click();await expect(life.getByRole('status').first()).toContainText('第 2 版');expect(publications).toBe(1);
});

for(const operation of ['publish','reopen'] as const)test(`R6 ${operation} receipt replay preserves the confirmed form when current fields have later edits`,async({page})=>{
  test.setTimeout(180_000);const projectId=await prepare(page);const editor=await fillRole(page);
  await editor.getByLabel('岗位名称',{exact:true}).fill('确认时的原岗位');
  const created=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/api/v1/ie/me/project-drafts/${projectId}/recruitments`);
  await editor.getByRole('button',{name:'保存招募草稿',exact:true}).click();const record=await(await created).json();await expect(editor.getByRole('status',{name:'招募操作结果'})).toContainText('已保存');
  if(operation==='reopen'){
    await publish(page);await editor.getByRole('button',{name:'关闭招募',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认关闭',exact:true}).click();await expect(editor.getByRole('status',{name:'招募操作结果'})).toContainText('已关闭');
  }
  const headers={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`};let lose=true;const commands:unknown[]=[];
  await page.route(`**/api/v1/ie/me/project-drafts/${projectId}/recruitments/${record.id}/${operation}`,async route=>{
    commands.push(route.request().postDataJSON());if(!lose)return route.continue();lose=false;
    const response=await route.fetch();expect(response.status()).toBe(200);const receipt=await response.json();
    const updated=await page.request.patch(`${API_URL}/ie/me/project-drafts/${projectId}/recruitments/${record.id}`,{headers,data:{version:receipt.current.version,request_id:crypto.randomUUID(),fields:{...receipt.current.fields,role_name:'确认之后的另一份岗位文字'}}});expect(updated.status()).toBe(200);await route.abort('failed');
  });
  await editor.getByRole('button',{name:operation==='publish'?'预览发布招募':'重新开放招募',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:operation==='publish'?'确认发布':'确认重新开放',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'重试原请求',exact:true}).click();await expect(page.getByRole('dialog')).toBeHidden();
  await expect(editor.getByRole('region',{name:'最新招募版本',exact:true})).toContainText('确认之后的另一份岗位文字');await expect(editor.getByLabel('岗位名称',{exact:true})).toHaveValue('确认时的原岗位');
  expect(commands).toHaveLength(2);expect(commands[0]).toEqual(commands[1]);
});
