# Student task UI reference migration

> R1–R6 集成：以下 UI 历史数字保留其源工作线和阶段，不能视作当前整合版通过。298 路径处置见 ../ui-integration-disposition.md；当前回执见 ../r1-r6-ui-integration-verification.md，最终 H 门禁与远端 CI 分别记账。

## UI13 final sample refinement

| ID | Requirement | Expected | Tests | Status |
| --- | --- | --- | --- | --- |
| ST9 | Initial upload affordance | Disabled 开始上传 before selection; the original handler after valid selection; real upload, revision and storage proof retained. | `frontend/e2e/submission.spec.ts` | 已覆盖；UI13 当前源码对应回归通过；页面49 / 状态16 / 视觉34组均0skip/flaky；原RED保留。 |
| ST10 | Student hierarchy | Approved headings/subtitles, back arrow, empty rating stars and home/ranking action arrows at four widths; growth monthly-ranking link retains the existing period URL and is followed at 390px. | `frontend/e2e/student-task-reference-layout.spec.ts` | 已覆盖；UI13 当前源码对应回归通过；页面49 / 状态16 / 视觉34组均0skip/flaky；原RED保留。 |

Expected behavior derives from the approved `innovation-round-1` task samples
and the existing task/submission contracts. Static demo data/state machines are
not implementation sources. T4's final F6 and complete scoped51 browser run
passed locally (49 passed, two existing conditional skips). Final core16
no-update comparison and production reference QA passed. Source-bound acceptance
is `infra/ui/.runtime/t4/accepted.json`; earlier receipts retain their own source.

| ID | Requirement | Expected | Tests | Status |
| --- | --- | --- | --- | --- |
| ST1 | Discovery hierarchy and density | Route h1 followed by task h2; two columns from640px, one below; quiet normal-weight titles and separate rating line | `frontend/e2e/student-task-reference-layout.spec.ts` | 已覆盖，当前完整相关51项中四断点GREEN |
| ST2 | Task decision layout | Description precedes facts and CTA in source; desktop decision280px/255px at medium, stacked on phone; no horizontal overflow | `frontend/e2e/student-task-reference-layout.spec.ts` | 已覆盖，CTA实际顺序RED→GREEN及四断点无溢出 |
| ST3 | Allocation and continuation | No assignment data before201; only server-returned own assignment afterward; continue link uses returned claim_id and reaches that own submission | `frontend/e2e/task-claim.spec.ts` | 已覆盖，真实201、本人分配、紧凑同行和真实继续提交地址GREEN |
| ST4 | Own progress and upload | Five real status-derived steps expose the current step; keep own assignment, server reward/deadline and native accepted file types | `frontend/e2e/student-task-reference-layout.spec.ts` | 已覆盖，五步骤及原生文件语义通过，焦点底栏遮挡RED→四断点GREEN |
| ST5 | Submission recovery | Valid upload, validation report/failure, retry finalize/re-upload and review states preserve real protocol and recovery behavior | `frontend/e2e/submission.spec.ts` | 已覆盖，同一领取失败重传、退回后新版本、完成及四存储证明GREEN；mock存储分支按原条件跳过 |
| ST6 | Community privacy and input | Explicit anonymous preview, deleted parent context, counters, reactions, rating eligibility and keyboard behavior survive recomposition | `frontend/e2e/community.spec.ts` | 已覆盖，当前14项真实社区流程通过，四断点填充画廊已实看 |
| ST7 | Review and role boundaries | Claim payload ownership, teacher decisions and reward/deadline authority stay on the server | `frontend/e2e/teacher.spec.ts` | 已覆盖，当前教师3项及连续领取旅程的真实决策通过 |
| ST8 | Responsive fidelity | Actual approved/product comparison at matching fonts andDPR;320/390/800/1440 usable, mobile primary actions unobscured; approved visual changes reviewed before PNG promotion | `frontend/e2e/visual-regression.spec.ts`、`frontend/e2e/student-task-reference-layout.spec.ts` | 已覆盖，最终16项无更新比较通过、61PNG不变；生产20组对照与12自然视口均实看、无溢出且动作无遮挡 |

| ST11 | Exhausted task with independent requester | Another student holds the only unit; fresh zero-claim requester sees assignments_available=0 and disabled 名额已满, no allocated panel; retain concurrent-race error mapping | `frontend/e2e/task-claim.spec.ts`、`tests/e2e/test_browser_world_edge_cases.py`、`frontend/src/__tests__/claim-errors.test.ts` | 已覆盖：Task4真实PG满配额隔离、实际DTO/禁用CTA与三次独立申请人通过；保留上游规则，不恢复旧可点击409按钮；最终H仍须Task6 |

## 缺口明细

- G-1–G-5已由`infra/ui/.runtime/t4/polish-final`当前完整相关51项报告关闭：49通过、2原条件跳过、0意外、0不稳定；不代表全站完整目录或正式no-skip。
- G-6已关闭：最终16项无更新比较通过，原实际走查按相同PNG哈希保留；生产20组对照及12自然视口均实看。51份批准原文件与副本哈希复核、隔离预览关闭并清理本人测试世界。无新mask/容差或重拍基线。
