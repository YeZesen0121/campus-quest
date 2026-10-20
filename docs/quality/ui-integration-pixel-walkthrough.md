# 集成界面像素走查

本文件只记录本次集成的实际无更新差异及处置。旧UI通过数量不作为当前覆盖；I3/I4、最终H和远端CI分开记账。

## I3/I4开发验收结果

I3为`c0f89358816206e0ee781a558bf1a30887eac6cd`，不含PNG；I4为`f9a1b2d66ae2fdb6f1be120566f16e942c09cb5c`，仅含12张已走查的主组PNG，其余51张原字节不变。I4干净提交上23像素＋23axe无更新复跑46/46通过、零skip/flaky（`20261020T181609194348Z`，4.2分钟，报告SHA256 `f9c2ad06530a7d07fd871b32ff40348f3c5a074e4b5ab1222bf842ec446ee0d7`，working diff为空）。最终H仍须重跑全部七组，不借用此开发检查点。

以下初轮及I3前记录保留历史状态，不能把其中“未更新PNG”理解为I4之后的当前状态。

## 历史：I3前首轮

首轮 `20261020T151533842829Z`：23axe全部通过，23主像素10通过/13失败，零skip/flaky；报告SHA256 `f2c835d5137e71a2e6dfef123f3e69a6dc7a8051779125791a1d9698758d87fe`。基准为I2及当时工作差异；完整报告、PNG、源码patch和逐图SHA位于ignored `.runtime/focused-browser/task5-main-pixels-no-update-20261020T151534-c64d13da/`、`.runtime/pixels/task5-main-initial.json`。尚未更新PNG。

失败先分类和修复；不是13张均获准直接更新。无新增mask、像素容差、重试或截图等待放宽。

| 主像素名称 | 首轮比较 | 分类与处置 |
| --- | --- | --- |
| admin-owner-qualifications | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| admin-innovation-operations | unexpected | intentional upstream structure: New admin destinations retained; existing approved paper/sidebar/action tokens. First image pair reviewed; breadcrumb/label-specific regressions handled separately. |
| student-owner-profile-form | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| student-project-draft-form | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| student-achievement-draft-form | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| auth-login | unexpected | intentional plus adaptation defect: Unified default-code and revised entry links retained; compact send and native-looking weak-toggle need source-system adaptation before a candidate. |
| auth-reset-password | unexpected | adaptation defect: New upstream public token route still bypasses AuthPage/card; preserve real one-time reset semantics and adapt composition first. |
| not-found | unexpected | adaptation defect: New paper tokens applied to older shell; use existing brand/auth composition and compact real home link before candidate. |
| dev-gallery | unexpected | intentional upstream behavior: Actual TaskCard now renders depleted text for fourth fixed fixture (assignments_available=0), adding a badge row; retain upstream explicit depleted cue. Pair inspected scaled; full-size strips still pending. |
| student-dashboard | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| student-tasks | unexpected | fixture contract drift: Real own world now seeds A/B/C/D/DOC/R, six cards. Existing hardcoded5 prevents capture; pin6 from actual upstream seeding, then first pixel candidate. |
| student-task-detail | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| student-claim | unexpected | intentional upstream behavior: Current platform display name, task-specific CSV formats and real download-template link retained. Expected/actual pair reviewed; same existing volatile masks. |
| student-rankings | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| student-rewards | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| student-notifications | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| teacher-reviews | expected | unchanged comparison passes: Existing baseline bytes retained; actual no-update assertion passes at unchanged original1% threshold. Full accepted matrix review remains pending. |
| admin-users | unexpected | intentional plus adaptation defect: Keep upstream real bulk selection/detail links; previous nth-child CSS now styles wrong columns. Fix selection target/column bounds and semantic user-ID ellipsis before candidate. |
| admin-invitations | unexpected | intentional upstream screen: Upstream old dark shell baseline -> approved paper/sidebar/local actions; no functional loss. Pair reviewed; route context mismatch separately tested. |
| admin-platforms | unexpected | intentional plus stale baseline data: Upstream old dark baseline had four old e2e-pf residue rows. Current seven registry seeds are actual clean world, not UI hiding. Pair reviewed; route context separately tested. |
| admin-approvals | unexpected | intentional upstream screen: Retain real pending-approval semantics and empty state while using shared paper/sidebar/action/status tokens. Pair reviewed; route context separately tested. |
| admin-dashboard | unexpected | intentional plus adaptation defect: Keep real server census counts and approved paper; /admin context wrongly defaults to student home. Regression and minimal label mapping before candidate. |
| admin-user-detail | unexpected | intentional upstream screen: Real self-view and account actions retained, existing paper/sidebar/table/action tokens; exact role-aware route context. Pair reviewed. |

以上为首轮历史停点；后续七组实际覆盖、I4逐图字节及提交后无更新结果见下文。

## 干净验收库七组首次比较

本节是当前开发回归，覆盖63张活动Linux基线；旧UI的50张变更图/61张来源库存不计作当前覆盖。真实注册清理前缀修复后，先校验私有数据库备份，再重建本次独立验收库至ie_0042，排除9条旧fixture残留。原开发库和来源树未操作。

覆盖更正保留：早期统计曾把导师两项布局误算为3张正式像素，彼时实际只比较60张（48通过、12差异），导师3张未执行。原错误库存已另存副本；本节的导师来源改为完整10项文件，生命周期内实际执行三次stableShot后才计入当前覆盖。首轮完整导师8过2败的失败证据也保留，不能以三图通过冒称整模块通过。

当前七份实际报告：主组23项axe通过、11张像素通过及12张差异；其余六组全部退出0、零skip/flaky，导师组为完整10项（含生命周期内3次stableShot）。51张通过的原PNG保持字节；12张有意变化已逐图核对。邀请和概览另外以语义/聚合修正后的最新无更新图原尺寸核对，2项axe通过、2项旧PNG差异，报告SHA256 `cc17255f8546c71232c0aacf86bd40ba82f036087263cfcc9354ca3e3ea9a94b`。当前未更新PNG。完整报告SHA、逐图前后字节来源及开发源码patch绑定见ignored `infra/integration/.runtime/pixels/task5-seven-groups-first.json`。

| 组 | 活动图数 | 首次报告SHA256 |
| --- | ---: | --- |
| visual-regression | 23 | `c5e2e77a849de539f45c2034a76ffb5fdd630c87945db9b998eba0baf24ac2d1` |
| innovation-navigation-visual | 4 | `8a33adcebcffea7fe350d7b578c293e6d6319d00f7485ec2a5d11426594e0e45` |
| innovation-review-visual | 6 | `48c638fb681b452a869d1ecf969322c9f7a373520a4231c3e80e330d73d5929d` |
| innovation-recruitment-visual | 9 | `9e8e495aa170e95bdc140b05771f7a564c57b4ec21ce2435c701ab358967e684` |
| innovation-talents-visual | 14 | `01ab999ff40e64e9427260763be291f6c05a8ff1acc9fc4c4baeb3fe9cef2f3d` |
| innovation-collaboration-visual | 4 | `0030b987a391363c504e139c3f02ee6c7d92a7e3a9c0bc9de9c9330c0f3f07d1` |
| innovation-mentors | 3 | `0cf0d3956aacc7e0dda13daa91b00ccad9085a96017f6f02e400461f26c882b4` |

逐图处置如下；主组12张当前实际图均已原尺寸走查，旧基准对照保留。组件画廊当前actual与首轮actual的SHA256完全一致，其30px变化已查看完整大小关键区域；文字主色两边均为RGB38,40,32。

| 基线文件 | 当前处置 | 原PNG SHA256（前12位） |
| --- | --- | --- |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-approvals-linux.png` | 批准体系与真实空列表；已修清理前缀，不把九项旧注册残留写入基线。 | `818a61f8e2eb` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-dashboard-linux.png` | 最新无更新图已原尺寸核对：四角色、五账户状态及五任务状态完整计数，复用共享中文标签。 | `b8eabc5fed57` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-innovation-operations-linux.png` | 保留新增后台导航；批准的纸色、侧栏、字体及动作层级。 | `3c126627febb` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-invitations-linux.png` | 最新无更新图已原尺寸核对：学生自行注册待审，管理员需绑定TOTP；复用批准体系。 | `ac9dfc4cf55c` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-owner-qualifications-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `be5a819fece9` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-platforms-linux.png` | 原先深色旧壳改为批准体系；七项实际迁移平台，不收录旧测试残留。 | `6cbd149cfb52` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-user-detail-linux.png` | 批准纸色/侧栏/类型与动作层级，保留真实受限后台概览与命令。 | `7b447a77a7a9` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-users-linux.png` | 真实批量选择及详情；保留八字段，语义列宽/44px选择目标和干净十行world。 | `970d67fa5715` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/auth-login-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `44b656d6aca2` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/auth-reset-password-linux.png` | 真实一次性重置表单复用AuthPage卡片及紧凑按钮，保留令牌与查询预填。 | `ca7f71ff1ad3` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/dev-gallery-linux.png` | 上游明确耗尽标记及退隐边框增加30px；固定模拟数据和原字体保留。 | `430c9e6f7f22` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/not-found-linux.png` | 复用产品品牌、AuthPage及紧凑真实首页链接。 | `1aefac1a762a` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-achievement-draft-form-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `0c3a45445784` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-claim-linux.png` | 真实平台显示名、任务允许CSV及真实模板下载；原有波动掩码保留。 | `e9a60c408668` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-dashboard-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `95c328cf561c` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-notifications-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `e117ea9285d6` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-owner-profile-form-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `3e05514b36ff` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-project-draft-form-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `9b62f30a2d3b` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-rankings-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `a081a045b6f5` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-rewards-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `07a52aee600b` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-task-detail-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `7c009faa1060` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-tasks-linux.png` | 真实world的六个任务及耗尽状态，不隐藏新增任务以配旧五项样张。 | `062b8ab5e145` |
| `frontend/e2e/visual-regression.spec.ts-snapshots/teacher-reviews-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `efccb5ecd433` |
| `frontend/e2e/innovation-navigation-visual.spec.ts-snapshots/innovation-campus-landing-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `88a4ef380e8d` |
| `frontend/e2e/innovation-navigation-visual.spec.ts-snapshots/innovation-logout-confirmation-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `c4c548ca5f8e` |
| `frontend/e2e/innovation-navigation-visual.spec.ts-snapshots/innovation-mobile-full-menu-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `568870c65391` |
| `frontend/e2e/innovation-navigation-visual.spec.ts-snapshots/innovation-profile-bottom-logout-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `1b73dd813434` |
| `frontend/e2e/innovation-review-visual.spec.ts-snapshots/achievement-campus-empty-list-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `f5b53016c643` |
| `frontend/e2e/innovation-review-visual.spec.ts-snapshots/achievement-operator-empty-queue-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `39da13fc9f79` |
| `frontend/e2e/innovation-review-visual.spec.ts-snapshots/achievement-operator-participation-queue-r6-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `6af685ca759b` |
| `frontend/e2e/innovation-review-visual.spec.ts-snapshots/achievement-owner-proof-workspace-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `53585b1cfa09` |
| `frontend/e2e/innovation-review-visual.spec.ts-snapshots/achievement-update-approved-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `93e881657b0f` |
| `frontend/e2e/innovation-review-visual.spec.ts-snapshots/achievement-update-pending-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `0fcb86038247` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-authorized-contact-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `39e03bf5f940` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-closed-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `87c756dd7bbf` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-consent-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `7454ed8c624c` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-detail-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `7f75ab0160f6` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-empty-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `7d6190be7d93` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-unavailable-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `87c756dd7bbf` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-owner-form-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `223a080ae1d4` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-project-detail-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `4efed832fc63` |
| `frontend/e2e/innovation-recruitment-visual.spec.ts-snapshots/recruitment-project-detail-r6-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `eb191f57f672` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-contacts-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `55ad013df16c` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-detail-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `d96bfee491b6` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-empty-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `10bbaed0a781` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-error-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `00648df55634` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-list-desktop-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `d329b3b2e18a` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-list-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `b1d6cd657c44` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-loading-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `74ce9d8409f2` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-long-detail-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `10b63f3fbd34` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-long-form-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `6a9b64fa2944` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-materials-detail-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `479e0573a0ff` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-materials-list-desktop-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `35d4c805677f` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-owner-desktop-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `337e6963c0b0` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-preview-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `3107735efd04` |
| `frontend/e2e/innovation-talents-visual.spec.ts-snapshots/talent-unavailable-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `221f7b8646cf` |
| `frontend/e2e/innovation-collaboration-visual.spec.ts-snapshots/r6-home-1440-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `04d14907a7b8` |
| `frontend/e2e/innovation-collaboration-visual.spec.ts-snapshots/r6-home-390-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `bbe2ce95d573` |
| `frontend/e2e/innovation-collaboration-visual.spec.ts-snapshots/r6-workspace-1440-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `72a16a59ce5b` |
| `frontend/e2e/innovation-collaboration-visual.spec.ts-snapshots/r6-workspace-390-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `22d30de4e3cc` |
| `frontend/e2e/innovation-mentors.spec.ts-snapshots/mentor-confirmation-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `9568e0e2e4a2` |
| `frontend/e2e/innovation-mentors.spec.ts-snapshots/mentor-operations-form-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `618c4fe28493` |
| `frontend/e2e/innovation-mentors.spec.ts-snapshots/mentor-public-mobile-linux.png` | 原基线字节保留；当前独立world无更新比较通过。 | `d699216e6637` |

## I4逐图字节核对

候选生成23/23通过（`20261020T181052257551Z`，报告SHA256 `227f18dac009bc39b8f5cefb9dcd3d2704e77c352f6876d16247590c28b4533a`）。精确12条允许路径改变，51张保持原SHA；没有代码、阈值、mask、重试或字体修改。11张候选与此前原尺寸走查actual字节相同。概览另作原尺寸双图复核：有效会话用户数1→3，完整主组先登录三种角色而聚焦两图仅登录管理员；原服务端distinct有效UserSession计数保留，其余枚举/内容/布局不变。

| PNG | I3前SHA256（前12位） | I4 SHA256（前12位） | 核对 |
| --- | --- | --- | --- |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-approvals-linux.png` | `818a61f8e2eb` | `811c21fb0890` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-dashboard-linux.png` | `b8eabc5fed57` | `78521fcb0ce4` | 原尺寸双图及会话计数来源已复核 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-innovation-operations-linux.png` | `3c126627febb` | `faa9c43180c1` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-invitations-linux.png` | `ac9dfc4cf55c` | `c99e155bcec4` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-platforms-linux.png` | `6cbd149cfb52` | `a3b495dac890` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-user-detail-linux.png` | `7b447a77a7a9` | `83671f70d10b` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/admin-users-linux.png` | `970d67fa5715` | `86f8def10433` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/auth-reset-password-linux.png` | `ca7f71ff1ad3` | `1a72c55ef388` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/dev-gallery-linux.png` | `430c9e6f7f22` | `4b9a802312ab` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/not-found-linux.png` | `1aefac1a762a` | `6e6c56fbf05d` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-claim-linux.png` | `e9a60c408668` | `aa75d1b01300` | 与已走查actual字节一致 |
| `frontend/e2e/visual-regression.spec.ts-snapshots/student-tasks-linux.png` | `062b8ab5e145` | `54a1a774fc27` | 与已走查actual字节一致 |
