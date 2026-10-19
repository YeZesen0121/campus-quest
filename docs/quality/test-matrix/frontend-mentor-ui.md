# R5 mentor approved UI migration

Task12 正在重新收口：以下旧批次通过记录是该批次历史证据，不代表当前整站验收；最终证据以 Task12 新日志为准。

Predictions follow the approved R5 design and the Task9 read-only preflight
recorded during Task8, before product edits. Static sample state is never a
substitute for backend consent, versioning or project visibility. Source computed
metrics cover28 frames at320/390/800/1440; independent columns begin at768px.

| ID | Requirement | Expected | Tests | Status |
| --- | --- | --- | --- | --- |
| MUI1 | Public directory | Real confirmed summaries and counts; compact search/direction/contact filters; two columns and center divider on desktop, one column without divider on phone | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，已验证：真实筛选/计数、桌面双列中线及手机单列无中线通过。 |
| MUI2 | Confirmed public detail | Compact top contact band; only explicit version-bound contact read; intro/directions then project-types/achievements in independent columns; real public version/date | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，已验证：顶部授权联系横条、真实版本/日期、显式联系读取及独立正文双列通过。 |
| MUI3 | Candidate and old public data | Candidate and consent side by side; separately labelled old confirmed content; mixed permitted-text/contact changes remain PENDING and preserve the entire old public DTO/contact set | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，已验证：候选/本人选择并排、旧公开版独立披露、混合联系修改保留原公开DTO及旧联系通过。 |
| MUI4 | Expired selections | Confirm, reject, contact pause/resume/revocation, scope change, withdrawal and conflict replacement clear every stale consent choice by original version keys; no authorization inferred from layout | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，已验证：原version键保持，确认/拒绝/暂停恢复/渠道撤销/代维护变更/撤回/冲突载入后过期选择清空通过。 |
| MUI5 | Native editor |14px label/input, equal name/unit pair and full-width body fields; presentation rows3/2/3/2 with90px floor and240px bounded growth; original form constants/validation/field ownership unchanged | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，已验证：14px原生字段、姓名单位双列、呈现rows3/2/3/2与90–240px增高、原验证/状态不变通过。 |
| MUI6 | Operations context | Real candidate editing separate from read-only authorized scope and old public data; clear account binding, conflict keep/replace and unknown same-body recovery | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，已验证：运营候选与只读授权/旧公开版分离、桌面状态与表头同轴、手机布局、冲突及原未知请求恢复通过。 |
| MUI7 | Project links | Owner search/invitation separate from history; mentor pending/history/paging reachable; dirty project blocks new invitation while existing revoke remains available; original offset/body/request recovery retained | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，已验证：双方挂名、21条浏览器分页/原命令与页码恢复、未保存阻止邀请而既有解除可用通过；原202条真实PG契约未改，本批未重跑，Task12最终集成验证仍必跑。 |
| MUI8 | Privacy and role isolation | Public project mentor section consumes approved project data only; no private invitation summary/candidate text/contact values before authorized read; MENTOR never mounts teacher/admin/task data islands | `frontend/e2e/innovation-mentors.spec.ts`、`frontend/e2e/innovation-navigation.spec.ts` | 已覆盖，已验证：原角色/authEpoch隔离与导航、候选/私有摘要/未读取联系不进入公开DOM通过。 |
| MUI9 | Current acceptance | F6, full dedicated mentor world plus role navigation, approved PNG changes only and fresh no-update compare, four-width real source/product QA,44px unobscured actions, original references and native isolation verified | `frontend/e2e/innovation-mentors.spec.ts`、`frontend/e2e/innovation-navigation.spec.ts` | 已覆盖，已验证：当前F6/matrix23、专用导师9项、导航及父项目35项、候选/比较各27项V、4张变更走查及生产28对照/16自然动作/4真实联系读取通过。 |
| MUI10 | Task12 原样张收口 | 非学生导师工作区保持 source 宽度与角色隔离；公共目录/详情共用真实六项局部导航；运营返回位于 h1 前且记录用 h2；公开挂名只取已确认方向/单位/实际数量，轮廓按钮及手机正文横向边界 | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，前置断言已落地；定向 RED、实现及最终整站验证待完成 |

The existing version keys, mutation closures, recovery stores and API/form/query
modules are the behavioral baseline. Reuse the presentation-only DividedSections
primitive, whose divider uses ::before; source ::after is a styling mechanism,
not a product behavior. No current pass or whole-site owner acceptance is claimed.

## 缺口明细

- G-1：已关闭本批工程缺口。真实筛选/计数、桌面双列中线及手机单列无中线通过。

- G-2：已关闭本批工程缺口。顶部授权联系横条、真实版本/日期、显式联系读取及独立正文双列通过。

- G-3：已关闭本批工程缺口。候选/本人选择并排、旧公开版独立披露、混合联系修改保留原公开DTO及旧联系通过。

- G-4：已关闭本批工程缺口。原version键保持，确认/拒绝/暂停恢复/渠道撤销/代维护变更/撤回/冲突载入后过期选择清空通过。

- G-5：已关闭本批工程缺口。14px原生字段、姓名单位双列、呈现rows3/2/3/2与90–240px增高、原验证/状态不变通过。

- G-6：已关闭本批工程缺口。运营候选与只读授权/旧公开版分离、桌面状态与表头同轴、手机布局、冲突及原未知请求恢复通过。

- G-7：已关闭本批工程缺口。双方挂名、21条浏览器分页/原命令与页码恢复、未保存阻止邀请而既有解除可用通过；原202条真实PG契约未改，本批未重跑，Task12最终集成验证仍必跑。

- G-8：已关闭本批工程缺口。原角色/authEpoch隔离与导航、候选/私有摘要/未读取联系不进入公开DOM通过。

- G-9：已关闭本批工程缺口。当前F6/matrix23、专用导师9项、导航及父项目35项、候选/比较各27项V、4张变更走查及生产28对照/16自然动作/4真实联系读取通过。

当前源与完整回执：`infra/ui/.runtime/t7/accepted.json`。本批是导师局部工程证明，不是整站业主视觉验收、全目录正式no-skip、远端CI或物理macOS/iOS证明。Task12已记录的R5外壳、上下文及全族保真项仍必须完成。


UI13 测试隔离补充：本人资料标题、状态、授权范围说明及未勾选断言并入既有真实授权与四宽度 composition 用例；避免独立视觉用例提前绑定唯一模拟导师，破坏随后首次录入的初始条件。保留全部断言，未新增身份、未跳过生命周期。完整导师 10 项在 mentor-isolation-green 回执退出 0；最终像素比较另行记录。
