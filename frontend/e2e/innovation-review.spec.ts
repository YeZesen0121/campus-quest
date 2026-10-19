import AxeBuilder from "@axe-core/playwright";
import { spawnSync } from "node:child_process";
import { BACKEND_DIR, backendEnv } from "./global-setup";
import { readSourceTagPaint, BASE_URL, API_URL, ensureStudentLogin, expect, loginThroughUi, mintToken, parseSeededAccount, staffLogin, test } from "./fixtures";
import type { Page } from "@playwright/test";

test.skip(process.env.CQ_E2E !== "1", "set CQ_E2E=1 with real PG, MinIO and ClamAV");
const panel = (page: Page) => page.getByRole("region", { name: "成果核实与证明" });
async function confirm(page: Page, title: string, label = "确认") { await page.getByRole("dialog", { name: title, exact: true }).getByRole("button", { name: label, exact: true }).click(); }
async function auditAxe(page: Page) {
  // Ignore entrance motion, not accessibility rules; the real content stays rendered.
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const findings = await new AxeBuilder({ page }).analyze();
  expect(findings.violations.map((violation) => ({ id: violation.id, targets: violation.nodes.map((node) => node.target) }))).toEqual([]);
}

// Moderation UI is outside R2. Establish its existing database state only
// for this world's own approved achievement; all review actions still use UI.
function prepareTakenDownAchievement(achievementId: string) {
  const result = spawnSync("uv", ["run", "python", "-c", `
import asyncio, json, os, sys
from pathlib import Path
from uuid import UUID
from tests.e2e.browser_world import _factory, _dispose
from db_guard import require_test_database
from app.core.config import get_settings
from app.modules.innovation.models import AchievementDraft, ProjectDraft
from app.modules.innovation.review_models import AchievementWorkflow, AchievementReviewCase
from sqlalchemy import select
assert os.environ.get("CQ_E2E") == "1"
require_test_database(get_settings().database_url)
world = json.loads(Path(sys.argv[2]).read_text())
async def prepare():
    factory = _factory()
    try:
        async with factory() as db:
            workflow = await db.scalar(select(AchievementWorkflow).join(AchievementDraft, AchievementDraft.id == AchievementWorkflow.achievement_id).join(ProjectDraft, ProjectDraft.id == AchievementDraft.project_id).where(AchievementDraft.id == UUID(sys.argv[1]), ProjectDraft.owner_user_id == UUID(world["author"]["id"])).with_for_update())
            assert workflow is not None and workflow.first_review_state == "APPROVED"
            assert workflow.moderation_state == "NORMAL"
            assert await db.scalar(select(AchievementReviewCase.id).where(AchievementReviewCase.achievement_id == workflow.achievement_id, AchievementReviewCase.status == "SUBMITTED")) is None
            workflow.moderation_state = "TAKEN_DOWN"
            workflow.version += 1
            await db.commit()
    finally:
        await _dispose(factory)
asyncio.run(prepare())
`, achievementId, process.env.CQ_E2E_WORLD_FILE!], { cwd: BACKEND_DIR, env: backendEnv, encoding: "utf-8" });
  expect(result.status, result.stderr).toBe(0);
}

test("achievement review: private proof and every update reviewed across three accounts", async ({ page, browser }, testInfo) => {
  test.setTimeout(300_000);
  await ensureStudentLogin(page);
  const ownerContext = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  const viewerContext = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const owner = await ownerContext.newPage();
    const ownerIdentity = owner.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/me" && response.status() === 200);
    await loginThroughUi(owner, parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT, "CQ_E2E_AUTHOR_STUDENT"));
    const ownerId = (await (await ownerIdentity).json() as { id: string }).id;
    await owner.goto(`${BASE_URL}/profile/owner-profile`);
    const profile = owner.getByRole("region", { name: "负责人资料编辑器" });
    for (const [label, value] of Object.entries({ 姓名: "核实演示负责人", 学号: "00998877", 专业: "示例专业", 年级: "2026级" })) await profile.getByLabel(label, { exact: true }).fill(value);
    await profile.getByRole("button", { name: "保存负责人资料", exact: true }).click();
    await expect(owner.getByRole("status", { name: "负责人资料保存状态" })).toContainText("资料已保存");
    // Qualification/admin-grant UI is covered in its own specs. Use the
    // real APIs with the world's confirmed admin for setup here, rather
    // than cumulatively exhausting the real 10-logins/5-minute limiter.
    const adminHeaders = { Authorization: `Bearer ${mintToken(process.env.CQ_E2E_ADMIN_ID!)}` };
    const qualification = owner.getByRole("status", { name: "负责人资格状态" });
    await expect(qualification).toBeVisible();
    if (!(await qualification.innerText()).includes("已开通")) {
      const applied = owner.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/ie/me/owner-qualification" && response.status() === 200);
      await owner.getByRole("button", { name: "申请负责人资格", exact: true }).click();
      await expect(qualification).toContainText("等待管理员");
      const application = await (await applied).json() as { version: number };
      const approved = await owner.request.post(`${API_URL}/admin/ie/owner-qualifications/${ownerId}/approve`, { headers: adminHeaders, data: { version: application.version } });
      expect(approved.status()).toBe(200);
    }
    async function setOperator(enabled: boolean) {
      const path = `${API_URL}/admin/ie/operations-grants/${process.env.CQ_E2E_STUDENT_ID!}`;
      const current = await owner.request.get(path, { headers: adminHeaders }); expect(current.status()).toBe(200);
      const grant = await current.json() as { version: number; enabled: boolean };
      if (grant.enabled === enabled) return;
      const saved = await owner.request.put(path, { headers: adminHeaders, data: { version: grant.version, enabled, reason: "成果闭环测试准备与恢复" } });
      expect(saved.status()).toBe(200);
    }
    await setOperator(true);
    await owner.goto(`${BASE_URL}/profile/project-drafts`);
    await owner.getByRole("button", { name: "新建项目草稿", exact: true }).click();
    for (const [label, value] of Object.entries({ 项目名称: "真实核实闭环项目", 项目简介: "校园回收调研和可操作原型。", 项目方向: "环境保护", 项目阶段: "原型验证", 团队现状: "两名同学负责设计和调研。" })) await owner.getByLabel(label, { exact: true }).fill(value);
    await owner.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(owner.getByRole("status", { name: "项目草稿保存状态", exact: true })).toHaveText("草稿已保存，仅自己可见。");
    await owner.getByRole("link", { name: "管理成果草稿", exact: true }).click();
    await expect(owner).toHaveURL(/\/project-drafts\/[0-9a-f-]+\/achievements$/);
    const projectId = new URL(owner.url()).pathname.match(/\/project-drafts\/([0-9a-f-]+)\/achievements$/)![1];
    expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
    await owner.getByRole("button", { name: "新建成果草稿", exact: true }).click();
    await owner.getByLabel("成果名称", { exact: true }).fill("校园回收核实原型");
    await owner.getByLabel("作品与阶段成果说明", { exact: true }).fill("首次提交的可操作原型。");
    const created = owner.waitForResponse((response) => response.request().method() === "POST" && /\/achievements$/.test(new URL(response.url()).pathname));
    const reviewReads = ['workflow', 'evidence'].map(suffix => owner.waitForResponse(async response => {
      const path = new URL(response.url()).pathname;
      return response.request().method() === 'GET' && response.status() === 200 &&
        path.startsWith(`/api/v1/ie/me/project-drafts/${projectId}/achievements/`) &&
        path.endsWith(`/${suffix}`) && (await response.finished()) === null;
    }));
    await owner.getByRole("button", { name: "保存成果草稿", exact: true }).click();
    const achievement = await (await created).json() as { id: string };
    await Promise.all(reviewReads);
    await expect(panel(owner)).toContainText("尚未提交首次核实");
    // A failed signed PUT keeps its original retry key, but must not trap the
    // author after the upload intent is explicitly removed.
    const storageOrigin = new URL(backendEnv.S3_ENDPOINT_URL!).origin;
    const storageRequest = (url: URL) => url.origin === storageOrigin;
    let rejectedUploads = 0;
    await owner.route(storageRequest, async (route) => {
      if (route.request().method() === "PUT") { rejectedUploads++; await route.fulfill({ status: 403, body: "upload rejected" }); }
      else await route.continue();
    });
    await owner.getByLabel("上传证明材料", { exact: true }).setInputFiles({ name: "retry.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF\n") });
    await expect(owner.getByRole("button", { name: "重试原文件上传与检查", exact: true })).toBeVisible();
    expect(rejectedUploads).toBe(1);
    await expect(owner.getByLabel("上传证明材料", { exact: true })).toBeDisabled();
    await owner.getByRole("button", { name: "移除证明 1", exact: true }).click();
    await expect(panel(owner)).toContainText("还没有证明材料");
    await expect(owner.getByRole("button", { name: "放弃本次上传重试", exact: true })).toBeVisible();
    await owner.getByRole("button", { name: "放弃本次上传重试", exact: true }).click();
    await expect(owner.getByLabel("上传证明材料", { exact: true })).toBeEnabled();
    await expect(owner.getByRole("button", { name: "重试原文件上传与检查", exact: true })).toHaveCount(0);
    await owner.unroute(storageRequest);
    await owner.getByLabel("上传证明材料", { exact: true }).setInputFiles({ name: "wrong.pdf", mimeType: "application/pdf", buffer: Buffer.from("this is not a PDF") });
    await expect(panel(owner)).toContainText("文件检查未通过");
    await owner.getByRole("button", { name: "移除证明 1", exact: true }).click();
    await expect(panel(owner)).toContainText("还没有证明材料");
    const proofResponse = owner.waitForResponse((response) => response.request().method() === "POST" && /\/evidence\/[^/]+\/complete$/.test(new URL(response.url()).pathname) && response.status() === 200);
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
    await owner.getByLabel("上传证明材料", { exact: true }).setInputFiles({ name: "proof.pdf", mimeType: "application/pdf", buffer: pdf });
    const proof = await (await proofResponse).json() as { id: string };
    await expect(panel(owner).getByRole("checkbox", { name: "选择证明 1" })).toBeEnabled();
    await panel(owner).getByRole("checkbox", { name: "选择证明 1" }).check();
    await owner.getByRole("button", { name: "提交首次核实", exact: true }).focus(); await owner.keyboard.press("Enter");
    await expect(owner.getByRole("dialog", { name: "提交首次核实", exact: true })).toBeVisible();
    await owner.keyboard.press("Escape");
    await expect(owner.getByRole("button", { name: "提交首次核实", exact: true })).toBeFocused();
    const submissions: unknown[] = [];
    let releaseWorkflow!: () => void;
    const rereadGate = new Promise<void>((resolve) => { releaseWorkflow = resolve; });
    await owner.route("**/api/v1/ie/me/project-drafts/*/achievements/*/workflow", async (route) => {
      if (submissions.length === 1) await rereadGate;
      await route.continue();
    });
    await owner.route("**/api/v1/ie/me/project-drafts/*/achievements/*/submit", async (route) => {
      submissions.push(route.request().postDataJSON());
      if (submissions.length === 1) { const committed = await route.fetch(); expect(committed.status()).toBe(200); await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "upstream response lost", request_id: "review-lost-ack" }) }); }
      else await route.continue();
    });
    await owner.keyboard.press("Enter"); await confirm(owner, "提交首次核实");
    await expect(panel(owner).getByRole("button", { name: "确认上次提交结果（沿用原请求）", exact: true })).toBeFocused();
    await expect(owner.getByRole("button", { name: "确认上次提交结果（沿用原请求）", exact: true })).toBeVisible();
    try {
      // Retry must replay the frozen command even while the background read
      // is waiting. A visible, enabled retry must never silently discard a click.
      await owner.getByRole("button", { name: "确认上次提交结果（沿用原请求）", exact: true }).click();
      await expect.poll(() => submissions.length).toBe(2);
      expect(submissions[1]).toEqual(submissions[0]);
    } finally { releaseWorkflow(); }
    await expect(panel(owner)).toContainText("等待首次核实");
    await expect(panel(owner).getByRole("region", { name: "成果核实操作", exact: true })).toBeFocused();
    await owner.unroute("**/api/v1/ie/me/project-drafts/*/achievements/*/workflow");
    await owner.unroute("**/api/v1/ie/me/project-drafts/*/achievements/*/submit");
    await expect(owner.getByLabel("成果名称", { exact: true })).toBeDisabled();
    await owner.getByRole("button", { name: "撤回首次核实", exact: true }).click(); await confirm(owner, "撤回首次核实");
    await expect(panel(owner)).toContainText("尚未提交首次核实");
    await expect(owner.getByLabel("成果名称", { exact: true })).toBeEnabled();
    await owner.getByRole("button", { name: "提交首次核实", exact: true }).click(); await confirm(owner, "提交首次核实");
    await expect(panel(owner)).toContainText("等待首次核实");
    const viewer = await viewerContext.newPage();
    await staffLogin(viewer, process.env.CQ_E2E_TEACHER!, process.env.CQ_E2E_TEACHER_TOTP_SECRET!);
    await viewer.goto(`${BASE_URL}/innovation/achievements`);
    await expect(viewer.getByRole("region", { name: "校内已核实成果" })).not.toContainText("校园回收核实原型");
    const token = mintToken(process.env.CQ_E2E_STAFF_ID ?? process.env.CQ_E2E_TEACHER_ID!);
    const denied = await viewer.request.get(`${API_URL}/ie/me/project-drafts/${projectId}/achievements/${achievement.id}/evidence/${proof.id}/content`, { headers: { Authorization: `Bearer ${token}` } });
    expect(denied.status()).toBe(403);
    await page.goto(`${BASE_URL}/innovation/reviews`);
    const queue = page.getByRole("region", { name: "成果核实待办" });
    await expect(queue).toContainText("校园回收核实原型");
    await expect(queue).not.toContainText("00998877");
    await page.getByRole("button", { name: "领取并核实", exact: true }).click();
    const detail = page.getByRole("region", { name: "成果核实快照" });
    await expect(detail).toContainText("00998877");
    const sibling = await page.context().newPage();
    try {
      await loginThroughUi(sibling, parseSeededAccount(process.env.CQ_E2E_AUTHOR_STUDENT, "CQ_E2E_AUTHOR_STUDENT"));
      await expect(page.getByText("尚未获管理员指定的双创运营授权。", { exact: true })).toBeVisible();
      await expect(detail).toHaveCount(0); await expect(page.locator("body")).not.toContainText("00998877");
      await loginThroughUi(sibling, parseSeededAccount(process.env.CQ_E2E_STUDENT, "CQ_E2E_STUDENT"));
      await expect(queue).toContainText("校园回收核实原型");
      await page.getByRole("button", { name: "查看核实快照", exact: true }).click();
      await expect(detail).toContainText("00998877");
    } finally { await sibling.close(); }
    const download = page.waitForEvent("download"); await page.getByRole("button", { name: "下载核实证明 1", exact: true }).click();
    expect((await download).suggestedFilename()).toBe("evidence.pdf");
    await auditAxe(page); await auditAxe(owner);
    await page.getByLabel("核实备注／退回原因", { exact: true }).fill("请补充原型验证结果。");
    await page.getByRole("button", { name: "退回修改", exact: true }).click(); await confirm(page, "退回成果修改");
    await expect(page.getByRole("region", { name: "核实处理结果" })).toBeFocused();
    await expect(page.getByRole("status")).toContainText("已退回");
    await owner.getByRole("button", { name: "重新读取核实与材料状态", exact: true }).click();
    await expect(panel(owner)).toContainText("退回原因：请补充原型验证结果。");
    await owner.getByLabel("作品与阶段成果说明", { exact: true }).fill("已补充第一次验证结果。");
    await owner.getByRole("button", { name: "保存成果草稿", exact: true }).click();
    await expect(owner.getByRole("status").first()).toContainText("成果草稿已保存");
    await owner.getByRole("button", { name: "提交首次核实", exact: true }).click(); await confirm(owner, "提交首次核实");
    await expect(panel(owner)).toContainText("等待首次核实");
    await page.getByRole("button", { name: "返回核实待办", exact: true }).click();
    await page.getByRole("button", { name: "领取并核实", exact: true }).click();
    await expect(detail).toContainText("已补充第一次验证结果。");
    const decisions: unknown[] = [];
    await page.route("**/api/v1/ie/ops/achievement-reviews/*/decision", async (route) => {
      decisions.push(route.request().postDataJSON());
      if (decisions.length === 1) { const committed = await route.fetch(); expect(committed.status()).toBe(200); await route.abort("failed"); }
      else await route.continue();
    });
    await page.getByRole("button", { name: "通过首次核实", exact: true }).click(); await confirm(page, "通过首次核实");
    await expect(page.getByRole("button", { name: "确认上次决定结果（沿用原请求）", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "确认上次决定结果（沿用原请求）", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("核实通过");
    await expect(page.getByRole("region", { name: "核实处理结果" })).toBeFocused();
    await expect.poll(() => decisions.length).toBe(2); expect(decisions[1]).toEqual(decisions[0]);
    await page.unroute("**/api/v1/ie/ops/achievement-reviews/*/decision");
    await viewer.goto(`${BASE_URL}/innovation/achievements/${achievement.id}`);
    const publicDetail = viewer.getByRole("article", { name: "校内成果详情" });
    await expect(publicDetail).toContainText("已补充第一次验证结果。");
    await expect(publicDetail).not.toContainText("00998877"); await expect(publicDetail).not.toContainText("核实演示负责人");
    await expect(publicDetail.getByRole("button", { name: /证明/ })).toHaveCount(0);
    const originalPublicViewport = viewer.viewportSize()!;
    for (const width of [320, 390, 800, 1440]) {
      await viewer.setViewportSize({ width, height: 900 });
      await viewer.evaluate(() => document.fonts.ready);

      const publicTabs = (await viewer.getByRole('navigation', { name: '双创公共浏览', exact: true }).boundingBox())!;
      expect.soft((await publicDetail.getByRole('heading', { level: 1 }).boundingBox())!.y - publicTabs.y - publicTabs.height).toBeCloseTo(65, 0);
      expect.soft(await publicDetail.locator('time').evaluateAll(nodes => nodes.every(node => /\d{4}年/.test(node.textContent ?? '')))).toBe(true);
      const publication = publicDetail.locator('.campus-publication-dates');
      expect.soft(await publication.count()).toBe(1);
      if (await publication.count()) await expect.soft(publication).toHaveCSS('border-bottom-style', 'solid');
      const award = publicDetail.getByRole("region", { name: "立项或获奖说明", exact: true });
      expect.soft(await award.count()).toBe(1);
      if (await award.count()) {
        expect.soft(await award.evaluate(node => node.parentElement?.classList.contains("campus-achievement-main"))).toBe(true);
        expect.soft(await award.getByRole("heading", { level: 2 }).evaluate(node => getComputedStyle(node).fontWeight)).toBe("600");
      }
      const projectSnapshot = publicDetail.getByRole("region", { name: "公开项目概况", exact: true });
      const snapshotInk = await projectSnapshot.evaluate(node => {
        const canvas = document.createElement("canvas").getContext("2d")!;
        canvas.fillStyle = getComputedStyle(node).backgroundColor; canvas.fillRect(0, 0, 1, 1);
        return [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3).join(",");
      });
      expect.soft(snapshotInk).toBe("253,252,248");
      expect.soft(await projectSnapshot.locator("dl > div").evaluateAll(nodes => nodes.every(node => node.querySelector("dt")!.getBoundingClientRect().right <= node.querySelector("dd")!.getBoundingClientRect().left + 1))).toBe(true);
      expect.soft(await publicDetail.locator("time").count()).toBeGreaterThanOrEqual(2);
      await viewer.screenshot({ path: testInfo.outputPath(`achievement-source-${width}.png`), fullPage: true });
    }
    await viewer.setViewportSize(originalPublicViewport);

    await owner.getByRole("button", { name: "重新读取核实与材料状态", exact: true }).click();
    await expect(panel(owner)).toContainText("首次核实已通过");
    await owner.getByLabel("作品与阶段成果说明", { exact: true }).fill("第二版公开进展。");
    await owner.getByRole("button", { name: "保存成果草稿", exact: true }).click();
    await expect(owner.getByRole("status").first()).toContainText("成果草稿已保存");
    await viewer.reload(); await expect(publicDetail).toContainText("已补充第一次验证结果。"); await expect(publicDetail).not.toContainText("第二版公开进展。");
    const firstApprovedAt = await publicDetail.locator("time").first().getAttribute("datetime");
    const updates: unknown[] = [];
    await owner.route("**/api/v1/ie/me/project-drafts/*/achievements/*/submit-update", async (route) => {
      updates.push(route.request().postDataJSON());
      if (updates.length === 1) {
        const committed = await route.fetch(); expect(committed.status()).toBe(200);
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ code: "SERVICE_UNAVAILABLE", message: "update response lost", request_id: "update-lost-ack" }) });
      } else await route.continue();
    });
    await owner.getByRole("button", { name: "提交更新复审", exact: true }).click(); await confirm(owner, "提交更新复审");
    await expect(owner.getByRole("button", { name: "确认上次提交结果（沿用原请求）", exact: true })).toBeVisible();
    await owner.getByRole("button", { name: "确认上次提交结果（沿用原请求）", exact: true }).click();
    await expect.poll(() => updates.length).toBe(2); expect(updates[1]).toEqual(updates[0]);
    await owner.unroute("**/api/v1/ie/me/project-drafts/*/achievements/*/submit-update");
    await expect(panel(owner)).toContainText("等待更新复审");
    await expect(owner.getByLabel("成果名称", { exact: true })).toBeDisabled();
    async function stillOldPublic() {
      await viewer.reload(); await expect(publicDetail).toContainText("已补充第一次验证结果。");
      await expect(publicDetail).not.toContainText("第二版公开进展。");
      expect(await publicDetail.locator("time").first().getAttribute("datetime")).toBe(firstApprovedAt);
    }
    await stillOldPublic();
    await owner.getByRole("button", { name: "撤回更新复审", exact: true }).click(); await confirm(owner, "撤回更新复审");
    await expect(panel(owner)).toContainText("更新已撤回"); await stillOldPublic();
    await expect(owner.getByLabel("成果名称", { exact: true })).toBeEnabled();
    await owner.getByRole("button", { name: "提交更新复审", exact: true }).click(); await confirm(owner, "提交更新复审");
    await expect(panel(owner)).toContainText("等待更新复审");
    await page.getByRole("button", { name: "返回核实待办", exact: true }).click();
    await expect(queue).toContainText("更新复审");
    await page.getByRole("button", { name: "领取并核实", exact: true }).click();
    await expect(detail).toContainText("第二版公开进展。");
    await expect(detail).toContainText("更新复审：通过后才替换公开版本");
    await page.getByLabel("核实备注／退回原因", { exact: true }).fill("请补充第二版的验证依据。");
    await page.getByRole("button", { name: "退回修改", exact: true }).click(); await confirm(page, "退回成果修改");
    await expect(page.getByRole("status")).toContainText("更新已退回");
    await owner.getByRole("button", { name: "重新读取核实与材料状态", exact: true }).click();
    await expect(panel(owner)).toContainText("退回原因：请补充第二版的验证依据。"); await stillOldPublic();
    await owner.getByRole("button", { name: "提交更新复审", exact: true }).click(); await confirm(owner, "提交更新复审");
    await expect(panel(owner)).toContainText("等待更新复审");
    await page.getByRole("button", { name: "返回核实待办", exact: true }).click();
    await page.getByRole("button", { name: "领取并核实", exact: true }).click();
    await page.getByRole("button", { name: "通过更新复审", exact: true }).click(); await confirm(page, "通过更新复审");
    await expect(page.getByRole("status")).toContainText("核实通过");
    await viewer.reload(); await expect(publicDetail).toContainText("第二版公开进展。");
    await expect(publicDetail).toContainText("当前为更新复审通过的版本。"); await expect(publicDetail).not.toContainText("未逐项复审");
    expect(await publicDetail.locator("time").first().getAttribute("datetime")).toBe(firstApprovedAt);
    await expect(publicDetail).not.toContainText("00998877");
    await owner.getByRole("button", { name: "重新读取核实与材料状态", exact: true }).click();
    await expect(panel(owner)).toContainText("更新复审已通过");
    await page.getByRole("button", { name: "返回核实待办", exact: true }).click(); await expect(queue).toContainText("暂无可领取的成果");
    await auditAxe(viewer);
    expect(await owner.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await owner.screenshot({ path: testInfo.outputPath("achievement-review-owner-mobile.png"), fullPage: true });
    await viewer.screenshot({ path: testInfo.outputPath("achievement-public-desktop.png"), fullPage: true });
    // R3 closing an independently published role must preserve R2's approved
    // achievement and project visibility. Setup uses real APIs; close uses UI.
    const proofUrl = owner.url(); const publicAchievementUrl = viewer.url();
    const ownerHeaders = { Authorization: `Bearer ${mintToken(ownerId)}` };
    const recruitPath = `${API_URL}/ie/me/project-drafts/${projectId}/recruitments`;
    const recruited = await owner.request.post(recruitPath, { headers: ownerHeaders, data: { request_id: crypto.randomUUID(), fields: { project_title: "模拟招募介绍", direction: "模拟方向", stage: "实践", introduction: "模拟资料：继续访谈", idea_stage: false, role_name: "模拟实践伙伴", headcount: 1, duties: "访谈", requirements: "愿意学习", time_commitment: "每周一小时", beginner_friendly: true, contacts: [{ channel: "WECHAT", value: "demo_partner" }] } } });
    expect(recruited.status(), await recruited.text()).toBe(201); const role = await recruited.json();
    expect((await owner.request.post(`${recruitPath}/${role.id}/publish`, { headers: ownerHeaders, data: { version: role.version, request_id: crypto.randomUUID() } })).status()).toBe(200);
    await owner.goto(`${BASE_URL}/profile/project-drafts/${projectId}/recruitments`);
    await owner.getByRole("button", { name: "编辑招募：模拟实践伙伴", exact: true }).click();
    await owner.getByRole("button", { name: "关闭招募", exact: true }).click(); await confirm(owner, "关闭招募", "确认关闭");
    await expect(owner.getByRole("status", { name: "招募操作结果" })).toContainText("已关闭");
    await viewer.goto(`${BASE_URL}/innovation/projects/${projectId}`);
    await expect(viewer.getByRole("region", { name: "项目已核实成果" }).getByRole("link")).toHaveAttribute("href", `/innovation/achievements/${achievement.id}`);
    await expect(viewer.getByRole("region", { name: "项目正在招募" })).toContainText("暂无有效招募");
    await viewer.goto(publicAchievementUrl); await expect(publicDetail).toContainText("第二版公开进展。");
    await owner.goto(proofUrl);
    await owner.getByRole("button", { name: "编辑成果：校园回收核实原型", exact: true }).click();
    await expect(panel(owner)).toBeVisible();
    prepareTakenDownAchievement(achievement.id);
    await owner.getByRole("button", { name: "重新读取核实与材料状态", exact: true }).click();
    await expect(panel(owner)).toContainText("已下架，更新不会恢复公开");
    await viewer.reload(); await expect(publicDetail).toHaveCount(0);
    // Returning to the editor clears its local proof selection; consent is
    // explicit again before resubmission, just as for a real fresh page.
    await owner.getByRole("checkbox", { name: "选择证明 1", exact: true }).check();
    await expect(owner.getByRole("button", { name: "提交更新复审", exact: true })).toBeEnabled();
    await owner.getByRole("button", { name: "提交更新复审", exact: true }).click();
    await confirm(owner, "提交更新复审");
    await expect(panel(owner)).toContainText("等待更新复审");
    await expect.soft(panel(owner).getByRole("status")).toContainText("已下架成果保持下架");
    await expect.soft(panel(owner).getByRole("status")).not.toContainText("继续展示");
    await page.reload(); await expect(queue).toContainText("更新复审");
    await page.getByRole("button", { name: "领取并核实", exact: true }).click();
    await page.getByLabel("核实备注／退回原因", { exact: true }).fill("下架状态仍应保留，请补充依据。");
    await page.getByRole("button", { name: "退回修改", exact: true }).click(); await confirm(page, "退回成果修改");
    await expect(page.getByRole("status")).toContainText("更新已退回");
    await expect.soft(page.getByRole("status")).toContainText("原公开状态保持不变");
    await expect.soft(page.getByRole("status")).not.toContainText("继续公开");
    await owner.getByRole("button", { name: "重新读取核实与材料状态", exact: true }).click();
    await expect(panel(owner)).toContainText("已下架，更新不会恢复公开");
    await viewer.reload(); await expect(publicDetail).toHaveCount(0);
    // Restore the shared student grant so the existing operations suite retains its own starting contract.
    await setOperator(false);
  } finally { await ownerContext.close(); await viewerContext.close(); }
});

test("approved achievement review composition: real frozen snapshot, private panes and decision context", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await ensureStudentLogin(page);
  const ownerId = process.env.CQ_E2E_AUTHOR_SECRETS!.split(",").at(-1)!;
  const operatorId = process.env.CQ_E2E_STUDENT_ID!;
  const headers = { owner: { Authorization: `Bearer ${mintToken(ownerId)}` }, admin: { Authorization: `Bearer ${mintToken(process.env.CQ_E2E_ADMIN_ID!)}` } };
  async function api<T>(actor: keyof typeof headers, method: string, path: string, data?: unknown, status = 200): Promise<T> {
    const response = await page.request.fetch(`${API_URL}${path}`, { method, headers: headers[actor], ...(data === undefined ? {} : { data }) });
    expect(response.status(), await response.text()).toBe(status); return response.json() as Promise<T>;
  }
  const prior = await api<{ profile: { version: number } | null }>("owner", "GET", "/ie/me/owner-profile");
  const profile = await api<{ version: number }>("owner", "PUT", "/ie/me/owner-profile", { version: prior.profile?.version ?? 0, name: "模拟核实布局负责人", student_no: "00886655", major: "模拟信息管理", grade: "2026级" });
  const qualification = await api<{ version: number; status: string }>("owner", "GET", "/ie/me/owner-qualification");
  if (qualification.status !== "APPROVED") {
    const applied = await api<{ version: number }>("owner", "POST", "/ie/me/owner-qualification", { version: qualification.version, profile_version: profile.version });
    await api("admin", "POST", `/admin/ie/owner-qualifications/${ownerId}/approve`, { version: applied.version });
  }
  const grantPath = `/admin/ie/operations-grants/${operatorId}`;
  const grant = await api<{ version: number; enabled: boolean }>("admin", "GET", grantPath);
  if (!grant.enabled) await api("admin", "PUT", grantPath, { version: grant.version, enabled: true, reason: "四种宽度的真实核实布局验证" });
  try {
    const fields = { title: "模拟校园信息整理项目", summary: "提交时的项目概况，须保留在不可变核实快照。", direction: "校园服务", stage: "初步实践", team_status: "模拟两人小组" };
    const project = await api<{ id: string; version: number }>("owner", "POST", "/ie/me/project-drafts", { ...fields, request_id: crypto.randomUUID() }, 201);
    const achievement = await api<{ id: string; version: number }>("owner", "POST", `/ie/me/project-drafts/${project.id}/achievements`, { request_id: crypto.randomUUID(), title: "模拟核实工作样例", description: "完成第一轮访谈与资料来源核对，保留未知信息。", award_text: "模拟立项记录，待核对证明。", work_url: "https://example.invalid/practice" }, 201);
    const base = `/ie/me/project-drafts/${project.id}/achievements/${achievement.id}`;
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");
    const intent = await api<{ upload_url: string; client_headers: Record<string, string>; evidence: { id: string } }>("owner", "POST", `${base}/evidence`, { request_id: crypto.randomUUID(), size: pdf.length, content_type: "application/pdf" }, 201);
    expect((await page.request.put(intent.upload_url, { headers: intent.client_headers, data: pdf })).status()).toBe(200);
    expect((await api<{ state: string }>("owner", "POST", `${base}/evidence/${intent.evidence.id}/complete`)).state).toBe("READY");
    const workflow = await api<{ version: number }>("owner", "GET", `${base}/workflow`);
    await api("owner", "POST", `${base}/submit`, { request_id: crypto.randomUUID(), workflow_version: workflow.version, project_version: project.version, achievement_version: achievement.version, evidence_ids: [intent.evidence.id] });
    await api("owner", "PATCH", `/ie/me/project-drafts/${project.id}`, { ...fields, summary: "T8_PRIVATE_NEWER_PROJECT: 提交后的较新草稿。", version: project.version });
    const failures: string[] = [];
    const check = (condition: boolean, message: string) => { if (!condition) failures.push(message); };
    async function capture(name: string, width: number) {
      await page.addStyleTag({ content: ':root{--font-sans:"Noto Sans CJK SC",sans-serif;--font-display:"Noto Serif CJK SC",serif}' });
      await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getTiming().iterations ?? 1)).map(a => a.finished.catch(() => {}))); if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); window.scrollTo(0, 0); });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${width}: overflow`);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true, animations: "disabled" });
    }
    const queue = page.getByRole("region", { name: "成果核实待办", exact: true });
    const detail = page.getByRole("region", { name: "成果核实快照", exact: true });
    for (const width of [320, 390, 800, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(`${BASE_URL}/innovation/reviews`);
      await expect(queue).toContainText("模拟核实工作样例");
      await expect(queue).not.toContainText("00886655"); await expect(queue).not.toContainText("T8_PRIVATE_NEWER_PROJECT");
      const row = queue.getByRole("listitem").filter({ hasText: "模拟核实工作样例" }); await expect(row).toHaveCount(1);
      expect.soft(await readSourceTagPaint(row.locator('.campus-review-operation')), `operations/${width}: source review-kind tag`).toMatchObject({ ink: '95,104,85,255', ground: '232,233,223,255', border: '0px', padding: '2px 6px', font: '11px', weight: '400', radius: '3px' });
      if (width >= 640) {
        const axis = await row.evaluate(el => { const s = el.querySelector(".campus-review-state"); return s ? getComputedStyle(s).textAlign : null; });
        check(axis === "center", `queue/${width}: short status axis ${axis}`);
      }

      const restriction = queue.locator('.campus-review-restriction');
      check(await restriction.count() === 1, `queue/${width}: restricted-read context band`);
      if (await restriction.count()) {
        const band = (await restriction.boundingBox())!, count = (await queue.locator('.list-count').boundingBox())!;
        check(band.y + band.height <= count.y, `queue/${width}: restriction precedes real counts`);
      }
      check(await page.getByRole('button', { name: '重新读取待办', exact: true }).evaluate(el => el.closest('.campus-review-page-head') !== null), `queue/${width}: reload belongs beside heading`);
      await expect(page.getByRole('link', { name: '导师资料维护', exact: true })).toHaveAttribute('href', '/innovation/operations/mentors');
      await capture("operations-reviews", width);
      check(await queue.getByRole("heading", { name: "待办目录", exact: true }).count() === 0, `queue/${width}: redundant directory heading`);
      await row.getByRole("button", { name: /领取并核实|查看核实快照/ }).click();
      await expect(detail).toContainText("00886655"); await expect(detail).toContainText(fields.summary);
      await expect(detail).not.toContainText("T8_PRIVATE_NEWER_PROJECT");
      await expect(detail.locator('.campus-review-snapshot-meta')).toContainText('待核实');
      expect.soft(await readSourceTagPaint(detail.locator('.campus-review-snapshot-meta .badge-info')), `snapshot/${width}: source blue review-kind tag`).toMatchObject({ ink: '53,94,130,255', ground: '231,237,240,255', border: '0px', padding: '2px 6px', font: '11px', weight: '400', radius: '3px' });
      expect.soft(await detail.locator('.campus-review-snapshot-meta time').count()).toBe(0);
      await expect(detail.locator('.campus-review-snapshot-meta')).not.toContainText(/第.*版|已由你领取/);

      for (const name of ["已提交项目概况", "已提交成果内容", "核实用负责人资料", "提交证明"]) await expect(detail.getByRole("heading", { name, exact: true })).toBeVisible();
      const panes = await detail.evaluate(el => ["campus-review-content", "campus-review-private", "campus-review-decision"].map(name => {
        const node = el.querySelector(`.${name}`); if (!node) return null;
        const s = getComputedStyle(node), p = getComputedStyle(node, "::before");
        return { name, columns: s.gridTemplateColumns, gap: s.gap, dividerDisplay: p.display, dividerWidth: p.width };
      }));
      for (const pane of panes) {
        check(pane !== null, `snapshot/${width}: missing independent group`);
        if (!pane) continue;
        check(width < 640 ? pane.dividerDisplay === "none" : pane.dividerDisplay !== "none" && pane.dividerWidth === "2px", `snapshot/${width}: ${pane.name} rule ${JSON.stringify(pane)}`);
        if (width >= 640) check(pane.columns.split(" ").length === 2, `snapshot/${width}: ${pane.name} columns`);
      }
      check(await detail.getByRole("heading", { name: "核实决定", exact: true }).count() === 1, `snapshot/${width}: decision context heading`);
      await capture("operations-review", width);
      const header = await detail.locator(".page-head").innerText();
      check(header.includes(fields.title), `snapshot/${width}: real project context missing`);
      const backAxis = await detail.evaluate(el => { const back = el.querySelector("button")!, r = back.getBoundingClientRect(), owner = el.getBoundingClientRect(); return { x: r.x, expected: owner.x, width: r.width, available: owner.width }; });
      check(Math.abs(backAxis.x - backAxis.expected) < 1 && backAxis.width < backAxis.available * 0.8, `snapshot/${width}: centered or stretched back action ${JSON.stringify(backAxis)}`);
      check(await detail.locator(".campus-review-proof-list > li").count() === 1, `snapshot/${width}: proof row composition`);
      if (width >= 640) {
        const adjacency = await detail.evaluate(el => { const a = el.querySelector(".campus-review-content")!.getBoundingClientRect(), b = el.querySelector(".campus-review-private")!.getBoundingClientRect(); return b.top - a.bottom; });
        check(Math.abs(adjacency) < 1, `snapshot/${width}: content/private divider gap ${adjacency}`);
      }
      const decision = detail.getByRole("button", { name: "通过首次核实", exact: true }); await decision.focus(); await expect(decision).toBeFocused();
      const target = await decision.boundingBox(); check(Boolean(target && target.width >= 44 && target.height >= 44), `snapshot/${width}: decision target`);
      check(await decision.evaluate(el => { const b = el.getBoundingClientRect(), top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return top === el || el.contains(top); }), `snapshot/${width}: decision covered`);
      await page.screenshot({ path: testInfo.outputPath(`operations-decision-${width}-natural.png`), animations: "disabled" });
      await detail.getByRole("button", { name: "返回核实待办", exact: true }).click(); await expect(queue).toContainText("模拟核实工作样例");
    }
    // Settle the owned case through the existing UI; no abandoned claimed row.
    await queue.getByRole("listitem").filter({ hasText: "模拟核实工作样例" }).getByRole("button", { name: "查看核实快照", exact: true }).click();
    await detail.getByRole("button", { name: "退回修改", exact: true }).click(); await confirm(page, "退回成果修改");
    await expect(detail.getByRole("alert")).toContainText("退回必须填写原因");
    await detail.getByLabel("核实备注／退回原因", { exact: true }).fill("模拟布局检查完成，请补充实践来源。");
    await detail.getByRole("button", { name: "退回修改", exact: true }).click(); await confirm(page, "退回成果修改");
    await expect(page.getByRole("region", { name: "核实处理结果", exact: true })).toBeFocused();
    await expect(page.getByRole("status")).toContainText("已退回");
    expect(failures, failures.join("\n")).toEqual([]);
  } finally {
    if (!grant.enabled) { const current = await api<{ version: number }>("admin", "GET", grantPath); await api("admin", "PUT", grantPath, { version: current.version, enabled: false, reason: "恢复本次布局测试前的运营权限" }); }
  }
});
