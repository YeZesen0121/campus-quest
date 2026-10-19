import AxeBuilder from '@axe-core/playwright';
import { API_URL, BASE_URL, captureOwnedVisual, ensureStudentLogin, expect, mintToken, test } from './fixtures';

test.skip(process.env.CQ_E2E!=='1'||process.env.CQ_VISUAL!=='1'||process.env.CQ_E2E_FIXED_LABELS!=='1','CQ_E2E=1 CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1 for pinned Linux pixels');
let projectId:string;
test.beforeAll(async({request})=>{
  // A missing first baseline restarts the worker. Keep that worker's setup
  // idempotent inside this fresh actor's world instead of adding another row.
  const created=await request.post(`${API_URL}/ie/me/project-drafts`,{headers:{Authorization:`Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}`},data:{request_id:'c0870121-4d66-43d1-9c10-6b740e323a68',title:'模拟协作示例项目',summary:'用于核对管理、挂名、证明交接与项目状态的模拟项目。',direction:'校园学习',stage:'调研实践',team_status:'模拟团队，关系须本人分别同意。'}});
  expect([200,201]).toContain(created.status());projectId=(await created.json()).id;
});
for(const width of [390,1440])for(const surface of ['home','workspace'] as const){
  test(`R6 visual: ${surface} at ${width}`,async({page})=>{
    await ensureStudentLogin(page);await page.setViewportSize({width,height:900});
    await page.goto(`${BASE_URL}/profile/collaboration${surface==='workspace'?`/projects/${projectId}`:''}`);
    if(surface==='home'){
      await expect(page.getByRole('region',{name:'我负责的',exact:true})).toContainText('模拟协作示例项目');
      await expect(page.getByRole('region',{name:'本人的协作邀请与同意',exact:true})).toContainText('暂无协作记录');
      await expect(page.getByRole('region',{name:'本人的项目交接',exact:true})).toContainText('暂无交接记录');
    }else{
      await expect(page.getByRole('region',{name:'协作项目文字',exact:true})).toBeVisible();
      await expect(page.getByRole('region',{name:'项目状态与公开介绍',exact:true})).toBeVisible();
      await expect(page.getByRole('region',{name:'项目协作记录',exact:true})).toContainText('暂无协作记录');
      await expect(page.getByRole('region',{name:'发起负责人交接',exact:true})).toContainText('暂无已就绪证明');
      const choices=page.locator('.r6-workflow-group label').filter({has:page.locator('input[type="radio"],input[type="checkbox"]')});
      expect(await choices.count()).toBe(3);
      for(const label of await choices.all())expect(await label.evaluate(element=>element.getBoundingClientRect().height),'native consent choices keep the approved 44px label target').toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole('status',{name:'正在读取协作资料'})).toHaveCount(0);
    await page.addStyleTag({content:':root { --font-sans: "Noto Sans CJK SC", sans-serif; --font-display: "Noto Serif CJK SC", serif; --font-mono: "Liberation Mono", monospace; } * { animation: none !important; transition: none !important; }'});
    await page.evaluate(()=>document.fonts.ready);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    await captureOwnedVisual(page,page.getByRole('main'),`r6-${surface}-${width}.png`);
  });
}
