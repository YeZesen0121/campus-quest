# Private innovation sample restoration

## UI13 final sample refinement

| ID | Requirement | Expected | Evidence | Status |
| --- | --- | --- | --- | --- |
| PM12 | Achievement guidance | Separate link rows below right decision; phone content, proof, status, guidance order; original destinations and unsaved guards. | `frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖；UI13 当前源码对应回归通过；页面49 / 状态16 / 视觉34组均0skip/flaky；原RED保留。 |

Task12 正在重新收口：以下旧批次通过记录是该批次历史证据，不代表当前整站验收；最终证据以 Task12 新日志为准。

Predictions are recorded before product edits. Approved source metrics cover32
frames; R5 project editor takes precedence. Save/publication/review/recovery
ownership and existing inline project/child routes remain authoritative.

| ID | Requirement | Expected | Tests | Status |
| --- | --- | --- | --- | --- |
| PM1 | Private navigation and ownership | Three maintenance links on owner/project list-editor/achievement list/talent editor; none on dedicated achievement editor or recruitment list-editor; ACTIVE student only, no account-crossing state, dirty/busy leave guards | `frontend/e2e/innovation-private-reference-layout.spec.ts`、`frontend/e2e/innovation-navigation.spec.ts` | 已覆盖，已验证：真实身份导航与取消离开保护通过，未迁移编辑器状态所有权。 |
| PM2 | Owner profile and qualification | Saved four-field snapshot separate from qualification,1.35:1 desktop / stacked phone; errors retain input until explicit reconciliation | `frontend/e2e/innovation-owner-profile.spec.ts`、`frontend/e2e/innovation-owner-qualification.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：负责人四字段、资格申请、冲突与四宽度布局通过。 |
| PM3 | Inline project editor | Real IDs, approved field/keyboard order and full-width form; conflict/read-latest/replace and same-request retry retained | `frontend/e2e/innovation-drafts.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：原内联路由、已确认键盘顺序、冲突与未知请求恢复通过。 |
| PM4 | Proof and review grouping | Content/proof left, status right; phone proof before status; real upload/snapshot/review dates and unknown commands unchanged | `frontend/e2e/innovation-achievements.spec.ts`、`frontend/e2e/innovation-review.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：内容及证明左侧、核实状态右侧；手机内容→证明→状态，真实证明及复审通过。 |
| PM5 | Recruitment maintenance | Controlled fields, independent publication and original recovery; real selected-record summary, fresh-read shortcuts, explicit trapped confirmation and zero writes on cancel/stale CLOSED | `frontend/e2e/innovation-recruitment.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：真实维护及旧请求恢复通过；摘要只读、fresh CLOSED拒绝失效快捷操作，取消零写入及焦点通过。 |
| PM6 | Talent maintenance | Unboxed14px source form, paired identity/cooperation/link/contact groups, native44px actions; true save/preview/publication distinction | `frontend/e2e/innovation-talents.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：四宽度表单、2行正文、标签/作品/联系组合及真实保存/预览/公开/撤回通过。 |
| PM7 | Private file authority | READY/selected/public/revoked/removed remain distinct; real publication does not retain a stale private receipt; own upload/download and recovery cannot leak across accounts | `frontend/e2e/innovation-talents.spec.ts`、`frontend/e2e/innovation-review.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：真实READY/选择/公开/撤回/移除及恢复通过；生产本人PDF和PNG下载200且SHA完全相同。 |
| PM8 | Mentor parent container | Exactly once below closed project form; dirty save blocks new invitation but existing解除 stays available; leave/return recovers original command | `frontend/e2e/innovation-mentors.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：专用导师世界lifecycle通过，未保存摘要阻止新邀请而既有解除可用；原挂载与props不变。 |
| PM9 | Current visual/keyboard proof | All named B suites, current F6, private scoped V and natural focused actions at four widths; no masks/tolerance or API substitutes | `frontend/e2e/innovation-private-reference-layout.spec.ts`、`frontend/e2e/accessibility.spec.ts`、`frontend/e2e/innovation-review-visual.spec.ts`、`frontend/e2e/innovation-recruitment-visual.spec.ts`、`frontend/e2e/innovation-talents-visual.spec.ts` | 已覆盖，已验证：当前F6、88项B及1项导师父容器、候选26/比较23项V、8张变更实际走查、生产32对照/24自然动作/4预览通过。 |
| PM10 | Task12 所属项目及安全流程指引 | 招募新建及既有记录读取均显示已加载私有项目标题/私有草稿，位置在 h1 前；不覆盖岗位独立字段；成果指引使用既有本人路由；长岗位标题不挤成竖排状态 | `frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，实际 RED 17 项差异；对应修复后的组合验证进行中，最终整站门禁待执行 |
| PM11 | 成果子页项目导航 | 从成果列表按 Enter 或点击“我的项目”必须进入项目列表；项目内联编辑器已有离开保护和 onCurrent 返回继续生效 | `frontend/e2e/innovation-achievements.spec.ts`、`frontend/e2e/innovation-private-reference-layout.spec.ts` | 已覆盖，已验证：review-fix-red 实际失败后，review-fix-green 对应跳转及取消离开用例通过；该报告37通过/1项后台表头对比度失败，整体仍为失败。后续表头文字颜色外的逻辑未变。 |

## 缺口明细

- G-1：已关闭本批工程缺口。真实身份导航与取消离开保护通过，未迁移编辑器状态所有权。
- G-2：已关闭本批工程缺口。负责人四字段、资格申请、冲突与四宽度布局通过。
- G-3：已关闭本批工程缺口。原内联路由、已确认键盘顺序、冲突与未知请求恢复通过。
- G-4：已关闭本批工程缺口。内容及证明左侧、核实状态右侧；手机内容→证明→状态，真实证明及复审通过。
- G-5：已关闭本批工程缺口。真实维护及旧请求恢复通过；摘要只读、fresh CLOSED拒绝失效快捷操作，取消零写入及焦点通过。
- G-6：已关闭本批工程缺口。四宽度表单、2行正文、标签/作品/联系组合及真实保存/预览/公开/撤回通过。
- G-7：已关闭本批工程缺口。真实READY/选择/公开/撤回/移除及恢复通过；生产本人PDF和PNG下载200且SHA完全相同。
- G-8：已关闭本批工程缺口。专用导师世界lifecycle通过，未保存摘要阻止新邀请而既有解除可用；原挂载与props不变。
- G-9：已关闭本批工程缺口。当前F6、88项B及1项导师父容器、候选26/比较23项V、8张变更实际走查、生产32对照/24自然动作/4预览通过。

当前源与完整回执：`infra/ui/.runtime/t6b/accepted.json`。本批不是整站业主视觉验收、全目录正式no-skip、远端CI或物理macOS/iOS证明。R5导师内部与跨站共有细节继续后续批次。
