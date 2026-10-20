# Administrator approved UI migration matrix

> R1–R6 集成：以下 UI 历史数字保留其源工作线和阶段，不能视作当前整合版通过。298 路径处置见 ../ui-integration-disposition.md；当前回执见 ../r1-r6-ui-integration-verification.md，最终 H 门禁与远端 CI 分别记账。

## UI13 final sample refinement

| ID | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| AUI14 | Title and actual points share a queue row. Concise audit labels retain accessible names and associated exact-match hints; wrapping must not shift inputs. Whitelist preview retains real decisions and explicit confirmation. | `frontend/e2e/admin.spec.ts` | 已覆盖；UI13 当前源码对应回归通过；页面49 / 状态16 / 视觉34组均0skip/flaky；原RED保留。 |
| AUI15 | Acknowledged real staff login is never resubmitted while its landing route loads; serial administrator navigation keeps exactly one successful login. The original 15-second aggregate wait budget remains. | `frontend/e2e/admin.spec.ts` | 已覆盖；UI13 当前源码对应回归通过；页面49 / 状态16 / 视觉34组均0skip/flaky；原RED保留。 |

Source: approved staff/admin eight families plus Task11 and the V1/R1 administrator contracts. Predictions were recorded in `.superpowers/sdd/2026-10-16-whole-site-ui-migration/t9-predictions.md` before test lookup. This is local migration evidence, not owner acceptance or remote CI.

| ID | Spec / approved expectation | Test evidence | Status |
| --- | --- | --- | --- |
| AUI1 | Accounts: source geometry, phone labelled records, status axis, real filters/paging and mandatory-reason suspend/restore with native return focus | `frontend/e2e/admin.spec.ts` | 已覆盖，已验证：四宽度单一标题、真实筛选控件与账号状态原因确认、手机记录和返回焦点已验证。 |
| AUI2 | Whitelist: real preview then explicit import, labelled entries/decisions and disable reason/focus | `frontend/e2e/admin.spec.ts` | 已覆盖，已验证：原白名单预览→明确确认及停用原因/取消焦点通过，九位测试标记按既有约定清理。 |
| AUI3 | Rewards: existing admin listing, disabled rows after reload, server pagination, editor validation, original field-presence mutation and dialog focus; fixture cleanup removes only rewards created by this world's audited actors, not unrelated edited rewards | `frontend/e2e/admin.spec.ts`, `tests/e2e/test_browser_world_reward_cleanup.py` | 已覆盖，已验证：既有管理GET目录、下架后重读、创建/编辑确认、21项真实分页与旧响应隔离通过；只清理本轮创建的奖励。 |
| AUI4 | Redemptions: asymmetric divided queue/detail, phone single column, correct approve/reject/fulfill consequences and reasons/focus | `frontend/e2e/admin.spec.ts` | 已覆盖，已验证：非等宽中线队列/详情、手机单列和实际批准→发放、拒绝原因及原焦点通过。 |
| AUI5 | Audit: readonly real equality filters and paging, phone records/long JSON and no automatic identity reveal | `frontend/e2e/admin.spec.ts` | 已覆盖，已验证：真实offset翻页、操作/操作者/目标精确匹配、清空重读与只读本地快照展开通过。 |
| AUI6 | System: settings disclosures, independent template/repair divisions, native fields, version confirmation and backdrop/return-focus rules; real template create/edit/toggle and reasoned repair refusals, with creation-owned template cleanup preserving unrelated edited templates | `frontend/e2e/admin.spec.ts`, `tests/e2e/test_browser_world_template_cleanup.py` | 已覆盖，已验证：五个原生参数收起与旧→新确认、原模板创建/内容版本递增/启停版本不变、原修复原因与真实404拒绝保留草稿通过；模板清理区分创建与编辑。 |
| AUI7 | Grants and qualification: actual scoped grant/revoke and explicit submitted snapshot read; original actor/pagination/unknown-command and working focus callbacks preserved | `frontend/e2e/innovation-operations.spec.ts`, `frontend/e2e/innovation-owner-qualification.spec.ts` | 已覆盖，已验证：实际授权/撤回及资格快照显式读取、账号隔离、过期页与丢失确认恢复通过；多行原因/原版本/水平事实和原焦点处理保留。Task12源宽度回归先在800/1440分别复现750/1172px超出批准700px；手机全宽保留，已在全部四宽度通过；定向26项和完整UI8同报告226通过/no-skip0，UI9后台15项再验证通过。 |
| AUI8 | Four-width same-source comparisons, scoped F6/B/V, source hashes, keyboard/long input and sensitive DOM; whole-site fidelity continues Task12 | `frontend/e2e/admin.spec.ts` | 已覆盖，已验证：F6/733unit、matrix25、完整四spec Chromium18项、候选19与独立无更新16、精确3张PNG变化/58张字节不变、生产6项及同构建独立批准→发放1项、40组同尺度对照及93张实际图片走查通过。 |
| AUI9 | Task12 safe source reward fields: Authorized admin read prefills description/instructions on edit; existing PATCH sends changed instructions only, clearing held values sends null and untouched null is absent; existing create-only review policy remains absent from edit; real reread reflects changed/cleared values | `frontend/src/__tests__/admin-view.test.ts`、`frontend/e2e/admin.spec.ts` | 已覆盖，原3项真实RED后修复；当前745项单测全部通过，奖励读取/修改/清空由完整管理员10项验证通过 |
| AUI10 | Task12 source header and state paint: Real reward title/description and original catalogue actions share native source flow:27px below description on phone, centered beside header at800/1440; status tags/quiet destructive hover/framed refresh/whitelist note and true destination/caption/identity match actual source | `frontend/e2e/admin.spec.ts` | 已覆盖：奖励标题流四宽度RED后修复，当前后台15项、核心像素16项、前端9项全部通过；增加640边界，源确认字号/表头/记录密度/响应式列/预览800/编辑器760/资格720均通过独立源码断言 |

| AUI11 | Approved header wash keeps readable small text: table/native-setting headers reach AA without changing source wash, typography, geometry or other auxiliary text | `frontend/e2e/accessibility.spec.ts`、`frontend/e2e/admin.spec.ts` | 已覆盖，已验证：review-fix-green 的实际 axe-admin-users 对比度失败已保留；仅表头文字约加深1个sRGB步后，review-fix-green-2 全16项axe、15项后台、16项无更新核心截图通过，final-ui-10-frontend 全9项命令退出0；61PNG字节不变 |

| AUI12 | 奖励审阅授权使用批准的一张紧凑表单；目标及原因在授予/撤销切换间保留；pending冻结模式；空原因零写入；原POST/DELETE及实际live grant变化；八宽度含639/640边界与850px上限，无卡片底色 | `frontend/e2e/admin.spec.ts` | 已覆盖，已验证：原结构缺口真实RED后，UI11业务17项通过，包含真实授予/撤销及8宽度。原命令体与6个状态初始化精确保留；12组源对照17张图片实际查看。两次观察脚本失败回执保留，未改鉴权规则；这不是C6手工上传验收 |
| AUI13 | 账号筛选区有批准的筛选和清空；清空同时重置角色及状态，从真实服务端重新读取无筛选首页，键盘焦点保留 | `frontend/e2e/admin.spec.ts` | 已覆盖，已验证：缺少清空按钮真实RED后，UI11业务17项通过；仅移除未定义无样式类名后，当前清空1项与账号页无更新像素1项再次通过。账号页定向基线更改已实际看图，其他60PNG字节不变 |

## 缺口明细

- G-1：本批工程缺口已关闭。四宽度单一标题、真实筛选控件与账号状态原因确认、手机记录和返回焦点已验证。
- G-2：本批工程缺口已关闭。原白名单预览→明确确认及停用原因/取消焦点通过，九位测试标记按既有约定清理。
- G-3：本批工程缺口已关闭。既有管理GET目录、下架后重读、创建/编辑确认、21项真实分页与旧响应隔离通过；只清理本轮创建的奖励。
- G-4：本批工程缺口已关闭。非等宽中线队列/详情、手机单列和实际批准→发放、拒绝原因及原焦点通过。
- G-5：本批工程缺口已关闭。真实offset翻页、操作/操作者/目标精确匹配、清空重读与只读本地快照展开通过。
- G-6：本批工程缺口已关闭。五个原生参数收起与旧→新确认、原模板创建/内容版本递增/启停版本不变、原修复原因与真实404拒绝保留草稿通过；模板清理区分创建与编辑。
- G-7：本批工程缺口已关闭。实际授权/撤回及资格快照显式读取、账号隔离、过期页与丢失确认恢复通过；多行原因/原版本/水平事实和原焦点处理保留。Task12源宽度回归先在800/1440分别复现750/1172px超出批准700px；手机全宽保留，已在全部四宽度通过；定向26项和完整UI8同报告226通过/no-skip0，UI9后台15项再验证通过。
- G-8：本批工程缺口已关闭。F6/733unit、matrix25、完整四spec Chromium18项、候选19与独立无更新16、精确3张PNG变化/58张字节不变、生产6项及同构建独立批准→发放1项、40组同尺度对照及93张实际图片走查通过。

当前源与完整回执：`infra/ui/.runtime/t9/accepted.json`。这是本批局部工程证明；共享视觉完整收口、整站正式no-skip/跨浏览器、真实连续旅程、独立评审和业主最终验收仍由Task12完成。
