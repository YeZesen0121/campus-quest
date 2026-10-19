import { API_URL, BASE_URL, expect, test, loginThroughUi, mintToken, parseSeededAccount } from './fixtures';
import { prepare } from './recruitment-helpers';
import { withCollaborationWorld } from './collaboration-world';
import { captureR6Evidence } from './collaboration-screenshots';

test.skip(process.env.CQ_E2E!=='1','CQ_E2E=1 with real participant and review transactions');
test.use({actionTimeout:15_000});

test('R6 a newly accepted participant loses a claimed review and has an explicit coordination path',async({page,browser},info)=>{
  test.setTimeout(240_000);
  await withCollaborationWorld(page,async()=>{
    const projectId=await prepare(page,{title:'模拟参与回避项目',summary:'模拟项目概况用于固定审核版本',direction:'学习实践',stage:'调研',team_status:'模拟两人协作，挂名分别确认'});
    const owner={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`};
    const target={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_AUTHOR_STUDENT_ID!)}`};
    const admin={Authorization:`Bearer ${mintToken(process.env.CQ_E2E_ADMIN_ID!)}`};
    const grants=`${API_URL}/admin/ie/operations-grants/${process.env.CQ_E2E_AUTHOR_STUDENT_ID}`;
    const grant=await(await page.request.get(grants,{headers:admin})).json();
    expect((await page.request.put(grants,{headers:admin,data:{version:grant.version,enabled:true,reason:'模拟参与关系回避旅程'}})).status()).toBe(200);
    const root=`${API_URL}/ie/me/project-drafts/${projectId}/achievements`;
    const created=await page.request.post(root,{headers:owner,data:{request_id:crypto.randomUUID(),title:'模拟需回避的成果',description:'真实测试接口的模拟说明',award_text:'',work_url:''}});
    expect(created.status()).toBe(201);const achievement=await created.json();const path=`${root}/${achievement.id}`;
    const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
    const intent=await page.request.post(`${path}/evidence`,{headers:owner,data:{request_id:crypto.randomUUID(),content_type:'application/pdf',size:pdf.length}});
    expect(intent.status()).toBe(201);const upload=await intent.json();
    expect((await page.request.put(upload.upload_url,{headers:upload.client_headers,data:pdf})).status()).toBe(200);
    expect((await page.request.post(`${path}/evidence/${upload.evidence.id}/complete`,{headers:owner})).status()).toBe(200);
    const workflow=await(await page.request.get(`${path}/workflow`,{headers:owner})).json();
    const project=await(await page.request.get(`${API_URL}/ie/me/project-drafts/${projectId}`,{headers:owner})).json();
    const submitted=await page.request.post(`${path}/submit`,{headers:owner,data:{request_id:crypto.randomUUID(),workflow_version:workflow.version,project_version:project.version,achievement_version:achievement.version,evidence_ids:[upload.evidence.id]}});
    expect(submitted.status(),await submitted.text()).toBe(200);const review=(await submitted.json()).review_case;
    const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
    const operator=await context.newPage();
    try{
      await loginThroughUi(operator,parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT'));
      await operator.goto(`${BASE_URL}/innovation/reviews`);
      const row=operator.getByRole('listitem').filter({hasText:'模拟需回避的成果'});
      await row.getByRole('button',{name:'领取并核实',exact:true}).click();
      await expect(operator.getByRole('region',{name:'成果核实快照',exact:true})).toBeVisible();
      const resolved=await page.request.post(`${API_URL}/ie/collaboration/targets/resolve`,{headers:owner,data:{account:parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT,'CQ_E2E_AUTHOR_STUDENT').username}});
      expect(resolved.status()).toBe(200);
      const invitation=await page.request.post(`${API_URL}/ie/me/project-drafts/${projectId}/collaborators`,{headers:owner,data:{request_id:crypto.randomUUID(),target_ref:(await resolved.json()).target_ref,kind:'MANAGER'}});
      expect(invitation.status()).toBe(200);const relation=await invitation.json();
      expect((await operator.request.post(`${API_URL}/ie/collaborations/${relation.id}/accept`,{headers:target,data:{version:relation.version,request_id:crypto.randomUUID()}})).status()).toBe(200);
      const forbidden=await operator.request.get(`${API_URL}/ie/ops/achievement-reviews/${review.id}`,{headers:target});expect(forbidden.status()).toBe(403);
      expect((await operator.request.get(`${API_URL}/ie/ops/achievement-reviews/${review.id}/evidence/${upload.evidence.id}/content`,{headers:target})).status()).toBe(403);
      await operator.getByRole('button',{name:'重新读取核实快照',exact:true}).click();
      await expect(operator.getByRole('main').getByRole('alert')).toBeVisible();
      await expect(operator.getByRole('main')).toContainText('其他无冲突运营处理');
      await expect(operator.getByRole('main')).toContainText('联系管理员安排');
      await expect(operator.getByRole('region',{name:'核实用负责人资料',exact:true})).toHaveCount(0);
      await operator.getByRole('button',{name:'返回核实待办',exact:true}).click();
      await expect(operator.getByRole('listitem').filter({hasText:'模拟需回避的成果'})).toHaveCount(0);
      await expect(operator.getByRole('region',{name:'成果核实待办',exact:true})).toContainText('新增参与关系会释放原领取');
      await captureR6Evidence(operator,operator.getByRole('main'),info.outputPath('r6-review-conflict-coordination.png'));
    }finally{await context.close();}
  });
});
