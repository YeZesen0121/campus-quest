import { API_URL, BASE_URL, ensureStudentLogin, expect, mintToken } from "./fixtures";
import type { Page } from "@playwright/test";

export async function waitForRecruitmentList(page: Page) {
  const create = page.getByRole("button", { name: "新建招募岗位", exact: true });
  const retry = page.getByRole("alert").filter({ hasText: "服务暂时不可用，请稍后重试" }).getByRole("button", { name: "重试", exact: true });
  await expect.poll(async () => await create.isVisible() || await retry.isVisible(), { timeout: 15_000, message: "Recruitment setup reaches a usable list or its explicit service-error recovery" }).toBe(true);
  // One user-visible retry of a failed read, never a bypass of owner permissions
  // or a blanket test retry. Persistent service failure still fails below.
  if (await retry.isVisible()) await retry.click();
  await expect(create).toBeVisible({ timeout: 15_000 });
}

export async function prepare(page: Page, projectFields?: { title?: string; summary?: string; direction?: string; stage?: string; team_status?: string }) {
  await ensureStudentLogin(page);
  await page.goto(`${BASE_URL}/profile/owner-profile`);
  const editor = page.getByRole("region", { name: "负责人资料编辑器" });
  for (const [label, value] of Object.entries({ 姓名: "模拟招募负责人", 学号: "00123456", 专业: "模拟专业", 年级: "2026级" })) await editor.getByLabel(label, { exact: true }).fill(value);
  await editor.getByRole("button", { name: "保存负责人资料", exact: true }).click();
  await expect(editor.getByRole("status", { name: "负责人资料保存状态" })).toContainText("资料已保存");
  const state = page.getByRole("status", { name: "负责人资格状态" });
  await expect(state).toBeVisible();
  const qualification = await state.innerText();
  if (!qualification.includes("已开通")) {
    const adminHeaders = { Authorization: `Bearer ${mintToken(process.env.CQ_E2E_ADMIN_ID!)}` };
    const applicationPath = `${API_URL}/admin/ie/owner-qualifications/${process.env.CQ_E2E_STUDENT_ID}`;
    let applicationVersion: number;
    if (qualification.includes("等待管理员")) {
      // A preceding interrupted journey may already have submitted a snapshot.
      // Read that actual pending version; the UI correctly offers no second apply.
      const pending = await page.request.get(applicationPath, { headers: adminHeaders });
      expect(pending.status()).toBe(200);
      applicationVersion = (await pending.json()).version;
    } else {
      const applied = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/v1/ie/me/owner-qualification" && r.status() === 200);
      await page.getByRole("button", { name: "申请负责人资格", exact: true }).click();
      applicationVersion = (await (await applied).json()).version;
    }
    const approval = await page.request.post(`${applicationPath}/approve`, { headers: adminHeaders, data: { version: applicationVersion } });
    expect(approval.status()).toBe(200);
  }
  const project = await page.request.post(`${API_URL}/ie/me/project-drafts`, { headers: { Authorization: `Bearer ${mintToken(process.env.CQ_E2E_STUDENT_ID!)}` }, data: { request_id: crypto.randomUUID(), title: `模拟招募项目 ${Date.now()}`, summary: "PRIVATE_PARENT_SENTINEL", direction: "", stage: "", team_status: "", ...projectFields } });
  expect(project.status()).toBe(201);
  const parent = await project.json();
  await page.goto(`${BASE_URL}/profile/project-drafts/${parent.id}/recruitments`);
  await waitForRecruitmentList(page);
  return parent.id as string;
}
export async function fillRole(page: Page) {
  await page.getByRole("button", { name: "新建招募岗位", exact: true }).click();
  const editor = page.getByRole("region", { name: "招募岗位编辑器" });
  await editor.getByLabel("项目阶段", { exact: true }).selectOption("true");
  for (const [label, value] of Object.entries({ "项目名称": "模拟学习实验", "项目方向": "学习", "项目介绍": "模拟资料：访谈项目", "阶段目标": "验证学习方法", "初步方案": "先做访谈", "岗位名称": "研究伙伴", "招募人数": "1", "主要职责": "参与访谈", "能力要求": "愿意学习", "时间投入": "每周两小时" })) await editor.getByLabel(label, { exact: true }).fill(value);
  await editor.getByLabel("零基础友好", { exact: true }).selectOption("true");
  await editor.getByLabel("授权微信", { exact: true }).check();
  await editor.getByLabel("微信", { exact: true }).fill("demo_partner");
  return editor;
}
export async function publish(page: Page) {
  await page.getByRole("button", { name: "预览发布招募", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "发布招募", exact: true });
  await expect(dialog).toContainText("独立免审");
  await dialog.getByRole("button", { name: "确认发布", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("status", { name: "招募操作结果" })).toContainText("正在招募");
}
