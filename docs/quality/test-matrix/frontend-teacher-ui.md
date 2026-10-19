# Teacher and achievement-review approved UI migration

## UI13 final sample refinement

| ID | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| TUI12 | Equal state labels appear once; differing states remain distinct. Rarity belongs with title; points retain their cell. Comment actions sit beside author/time with original privacy, reason and history. | `frontend/e2e/teacher.spec.ts` | 已覆盖；UI13 当前源码对应回归通过；页面49 / 状态16 / 视觉34组均0skip/flaky；原RED保留。 |

Predictions derive from the approved migration Task10, staff sample source with final layout feedback, and V1 review/privacy rules. No backend permission, deadline or decision command changes are authorized. Evidence remains pending until the current complete gates run.

| ID | Requirement and predicted behavior | Evidence | Status |
| --- | --- | --- | --- |
| TUI1 | Review queue and selected submission remain on /teacher/reviews; desktop/tablet independent panes have a full 2px rule and 28/20px gutter. Phone selects detail, hides queue and returns by keyboard to the original queue row. | `frontend/e2e/teacher.spec.ts` | 已覆盖，已验证：四宽度队列/详情中线、非等宽布局、手机原行返回与焦点通过。 |
| TUI2 | Queue retains platform/keyword, immutable version, validation, timestamp and locked reward. No student identity is introduced; decisions retain explicit confirmation and required notes. | `frontend/e2e/teacher.spec.ts` | 已覆盖，已验证：原队列/版本/校验/奖励字段和批准、退回、判无效确认与备注契约通过。 |
| TUI3 | Task list uses actual server pagination, same lifecycle verdicts, short state/header on one axis and phone readable metadata/actions. No fake filters, totals or KPI. | `frontend/e2e/teacher.spec.ts` | 已覆盖，已验证：真实服务端计数、列表状态轴、手机直线记录、标题新建动作及发布/暂停/恢复/关闭/归档通过。 |
| TUI4 | Task configuration, actual statistics, CSV precheck/explicit confirm, collaborators and community remain in the real task detail. Source context navigation uses native existing-page anchors. | `frontend/e2e/teacher.spec.ts` | 已覆盖，已验证：真实详情配置、统计、原CSV预览确认、协作者原生选择与权限、社区上下文和原页锚点通过。 |
| TUI5 | Create/edit remain existing dialogs, native 14px fields grouped by purpose, original validation/frozen fields/submission intact. Cutoff is before FIXED deadline, never after publication; CLOSED stops new claims but original claims follow their frozen deadline. | `frontend/e2e/teacher.spec.ts` | 已覆盖，已验证：原dialog、14px原生分组、样张截止顺序、冻结和验证、真实截止/已领取语义及取消焦点通过。 |
| TUI6 | Comments and reports form independent panes, phone single column. Teachers see aliases only; admin reveal requires explicit reason and original high-permission request. Deletion requires reason and preserves history. | `frontend/e2e/community.spec.ts` | 已覆盖，已验证：评论/举报独立双列、手机单列、44px目标、显式原因/唯一身份读取、揭示权限与删除权限分离及教师删除历史/列表焦点通过。 |
| TUI7 | Achievement queue shows only approved queue DTO; claiming precedes restricted snapshot/proof reads. Submitted project/achievement, owner facts and evidence remain separate; decision reason belongs to its action. Existing immutable versions/conflict/unknown command/focus/actor isolation are preserved. | `frontend/e2e/innovation-review.spec.ts` 、`frontend/e2e/innovation-operations.spec.ts` | 已覆盖，已验证：真实领取后固定快照、提交项目/成果与受限负责人/证明分组、利益冲突、未知命令重试/身份隔离和决定说明/返回焦点通过。 |
| TUI8 | Source-pinned comparison, all natural 44px focused actions, intended PNG changes only, fresh no-update comparison and production build bind the exact final source. | `frontend/e2e/teacher.spec.ts` | 已覆盖，已验证：当前F6/matrix24、完整四spec Chromium22项、候选19项与独立无更新比较17项、精确2张PNG变更/59张字节不变、生产3项与32组同尺度对照和117张实际走查通过。 |

## 缺口明细

- G-1：本批工程缺口已关闭。四宽度队列/详情中线、非等宽布局、手机原行返回与焦点通过。
- G-2：本批工程缺口已关闭。原队列/版本/校验/奖励字段和批准、退回、判无效确认与备注契约通过。
- G-3：本批工程缺口已关闭。真实服务端计数、列表状态轴、手机直线记录、标题新建动作及发布/暂停/恢复/关闭/归档通过。
- G-4：本批工程缺口已关闭。真实详情配置、统计、原CSV预览确认、协作者原生选择与权限、社区上下文和原页锚点通过。
- G-5：本批工程缺口已关闭。原dialog、14px原生分组、样张截止顺序、冻结和验证、真实截止/已领取语义及取消焦点通过。
- G-6：本批工程缺口已关闭。评论/举报独立双列、手机单列、44px目标、显式原因/唯一身份读取、揭示权限与删除权限分离及教师删除历史/列表焦点通过。
- G-7：本批工程缺口已关闭。真实领取后固定快照、提交项目/成果与受限负责人/证明分组、利益冲突、未知命令重试/身份隔离和决定说明/返回焦点通过。
- G-8：本批工程缺口已关闭。当前F6/matrix24、完整四spec Chromium22项、候选19项与独立无更新比较17项、精确2张PNG变更/59张字节不变、生产3项与32组同尺度对照和117张实际走查通过。


当前源与完整回执：`infra/ui/.runtime/t8/accepted.json`。本批是局部工程验证；整站正式no-skip、跨浏览器、共享视觉收口、独立评审和业主最终验收仍由Task12完成。不是远端CI或物理设备证明。


## Task12 reminder policy reconciliation (current evidence pending)

Prediction from the approved teacher-task-editor sample and existing task API: create retains true/true and SMS/EMAIL/IN_APP defaults; explicit false and [] survive the request. Edit initializes from the server DTO, sends only changed policy fields, and permits reminder/channel changes on DRAFT, PUBLISHED and PAUSED without resending frozen contract fields. Reordering identical channels is not a change. Read-only task configuration shows actual stored policy. No new permission, API or sending rule is introduced.

| ID | Requirement and predicted behavior | Evidence | Status |
| --- | --- | --- | --- |
| TUI9 | Reminder defaults, false/empty transport, copied DTO channel array, diff-only mutable policy after publication; no changed frozen fields | `frontend/src/__tests__/teacher-view.test.ts` and `frontend/e2e/teacher.spec.ts` | 已覆盖：Five unit regressions RED to GREEN; 45 scoped unit cases. common-source-green-2 and staff-source-closure-green real browser journeys verify create201 false/[], draft PATCH200 EMAIL, published PATCH200 false/[], reload and read-only facts; current whole-site final gates remain pending. |
| TUI10 | Task12 compact source and keyboard clearance: existing schema/version is a native collapsed disclosure; 320px three13px decisions share a row; Tab focus keeps complete44px target and ring clear of fixed bars; actual stats retain source ruled band and21/20px values | `frontend/e2e/teacher.spec.ts` | 已覆盖：staff source closure RED to GREEN includes actual API lifecycle, native keyboard and four-width composition; rarity closure and whole-site final gates remain pending. |
| TUI11 | 手机键盘进入审核详情 | 320/390px 从队列按 Enter 打开详情，焦点进入可见的返回队列按钮；800/1440px 保留可见队列焦点；手机返回仍回到原队列项，决定弹窗取消仍回到原动作 | `frontend/e2e/teacher.spec.ts` | 已覆盖，已验证：review-fix-red 实际失败后，review-fix-green 四宽度键盘进入/返回/弹窗回焦点通过；该报告37通过/1项后台表头对比度失败，整体仍为失败。后续表头文字颜色外的逻辑未变。 |
