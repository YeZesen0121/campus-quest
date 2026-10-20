# Rewards, ranking, notifications and growth sample restoration

> R1–R6 集成：以下 UI 历史数字保留其源工作线和阶段，不能视作当前整合版通过。298 路径处置见 ../ui-integration-disposition.md；当前回执见 ../r1-r6-ui-integration-verification.md，最终 H 门禁与远端 CI 分别记账。

> 当前：UI13 逐页视觉验收已完成；以下各批次回执保留原来源，旧缺口/待验描述按其历史阶段解读。UI14 当前代码评审与定向回归见 [交付评审](../ui-migration-delivery-review.md)，不把历史全量结果改标为当前全量通过。


Expected presentation derives from the approved innovation-round-1 growth.css
and final compact.css, measured in16 reference-only browser frames. Existing
wallet/reward/period/notification/growth APIs retain ownership. T5 local engineering passed;
the first four-width regression failed on actual15px reward titles before the
approved17px/18px composition. No static demo state machine is copied.

| ID | Requirement | Expected | Tests | Status |
| --- | --- | --- | --- | --- |
| GR1 | Wallet authority and extremes | Spendable, available, earned, debt and frozen remain distinct; zero and large values wrap without clipping | `frontend/e2e/rewards-ranking.spec.ts`、`frontend/e2e/growth-reference-layout.spec.ts` | 已覆盖，真实钱包及四断点零值/极大/透支/冻结组件通过 |
| GR2 | Reward shelf density and states | Quiet17/18px titles, price/action share a row; disabled shortfall and unavailable states preserve meaning; action target44px | `frontend/e2e/growth-reference-layout.spec.ts`、`frontend/e2e/rewards-ranking.spec.ts` | 已覆盖，四断点布局及真实余额不足、不可用状态通过 |
| GR3 | Redemption journey | Confirm/cancel/focus return, authoritative freeze/stock refetch and typed failures retain existing contracts | `frontend/e2e/rewards-ranking.spec.ts` | 已覆盖，真实201冻结、200审批发放、取消和重取后稳定焦点通过 |
| GR4 | Readonly ranking and URL | Normal rows35desktop/36phone, nickname/honor inline, long rows grow; real period URL and own-row cues remain | `frontend/e2e/growth-reference-layout.spec.ts`、`frontend/e2e/rewards-ranking.spec.ts` | 已覆盖，周期URL/本人行及紧凑和长内容四断点通过 |
| GR5 | Notification semantics and recovery | Quiet unread surface plus text/glyph; full long body,44px mark-read, paging/filter/rollback and real links unchanged | `frontend/e2e/growth-reference-layout.spec.ts`、`frontend/e2e/notifications.spec.ts` | 已覆盖，原通知流程及真实投递后200已读、筛选和长正文通过 |
| GR6 | Growth and account separation | Six server metrics, best month and readonly honors; zero/no-honor states; account-info fields stay on the info tab | `frontend/e2e/growth-reference-layout.spec.ts`、`frontend/e2e/profile-tabs.spec.ts` | 已覆盖，成长六指标/荣誉及两种profile tab通过 |
| GR7 | Visual and accessibility fidelity | Four matching-font320/390/800/1440 comparisons; rank-only density never shrinks actions; approved notification stroke tiles and readonly honor medals; approved teacher-review timestamps12px / administrator user timestamps13px, both isolated from the11px inbox; pixels reviewed before promotion | `frontend/e2e/visual-regression.spec.ts`、`frontend/e2e/accessibility.spec.ts`、`frontend/e2e/growth-style-isolation.spec.ts` | 已覆盖，本批F6/完整42/axe16/core16无更新比较及生产42图实看通过；细节收口见GR8 |

| GR8 | Final whole-site fidelity details | Restore scoped inline phone timestamp and small rectangular unread badge; reconcile shared header/empty-state and profile entry placement against approved samples | `frontend/e2e/growth-reference-layout.spec.ts`、`frontend/e2e/workspace-reference-layout.spec.ts`；UI13逐页走查 | 已覆盖，UI13关闭：64场景实际对照与38类差异收口，见ui13-final-visual-acceptance.md；不推断业主认可或逐像素零差异 |

| GR9 | Independent unread and zero-balance prerequisites | Fresh completed IN_APP delivery and independent zero-wallet actor; exact POST200/read_at/reload and owned reward shortfall; preserve unrelated actors during cleanup | `frontend/e2e/notifications.spec.ts`、`frontend/e2e/rewards-ranking.spec.ts`、`tests/e2e/test_browser_world_edge_cases.py` | 已覆盖：Task4真实PG12项、Chromium33项及三前提各三次9项通过，零skip/flaky；各次回执在集成verification，最终H仍须Task6，未借用UI源数字 |

## 缺口明细

- G-1：当前钱包真实读取、零值/极大值/透支/冻结边界回归。 已关闭，本批接受工件 infra/ui/.runtime/t5/accepted.json。
- G-2：当前奖励同行排布、44px动作和不足/不可用状态回归。 已关闭，本批接受工件 infra/ui/.runtime/t5/accepted.json。
- G-3：真实兑换确认、取消、焦点返回与服务端重取回归。 已关闭，本批接受工件 infra/ui/.runtime/t5/accepted.json。
- G-4：当前榜单周期、本人行、附近及紧凑/长内容布局回归。 已关闭，本批接受工件 infra/ui/.runtime/t5/accepted.json。
- G-5：当前通知真实读未读、回滚、分页与长正文回归。 已关闭，本批接受工件 infra/ui/.runtime/t5/accepted.json。
- G-6：当前成长六指标/荣誉及两种profile tab回归。 已关闭，本批接受工件 infra/ui/.runtime/t5/accepted.json。
- G-7：实际候选旧新图走查、无更新比较及生产样张/自然操作视口核对；不更改容差或掩码来隐藏差异。 已关闭，本批接受工件 infra/ui/.runtime/t5/accepted.json。
- G-8：历史待办已由UI13代理视觉验收关闭；本批历史工程验证不改标为业主认可。UI14教师12px/管理员13px定向RED→GREEN，8项联跑通过。
