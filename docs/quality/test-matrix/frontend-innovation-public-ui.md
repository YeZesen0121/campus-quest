# Public innovation UI sample migration

> R1–R6 集成：以下 UI 历史数字保留其源工作线和阶段，不能视作当前整合版通过。298 路径处置见 ../ui-integration-disposition.md；当前回执见 ../r1-r6-ui-integration-verification.md，最终 H 门禁与远端 CI 分别记账。

T6a predictions derive from the exact R1/R2-update/R3/R4.1/R5 contracts and approved source. New layout expectations are recorded in the task ledger before product edits. Existing behaviors are implemented; current engineering checks passed; the remaining Task12 fidelity gap is explicit below. R5 landing/recruitment/project override older visual samples. No new contact or publication API is introduced.

| ID | Requirement | Expected | Tests | Status |
| --- | --- | --- | --- | --- |
| PB1 | Campus reader and role boundary | Active authorized campus readers retain real navigation; anonymous/inactive/foreign-owner errors stay gated | `frontend/e2e/innovation-navigation.spec.ts`、`frontend/e2e/innovation-recruitment.spec.ts`、`frontend/e2e/innovation-talents.spec.ts` | 已覆盖，已验证：当前75项包含真实身份/导航/访问边界回归。 |
| PB2 | Snapshot-only public content | Approved achievement or explicitly marked recruitment snapshot; no private latest parent/owner/evidence/mentor candidate; review dates retain meaning | `frontend/e2e/innovation-achievements.spec.ts`、`frontend/e2e/innovation-review.spec.ts`、`frontend/e2e/innovation-recruitment.spec.ts`、`frontend/e2e/innovation-public-reference-layout.spec.ts` | 已覆盖，已验证：真实成果核实、公共snapshot与长内容；私人父项目修改未进入公开DOM。 |
| PB3 | Recruitment and explicit contact | Valid OPEN/owner eligibility/deadline gate; contact only after action and current authorization; closed/expired/revoked refresh preserved | `frontend/e2e/innovation-recruitment.spec.ts` | 已覆盖，已验证：当前真实招募联系、截止/关闭/撤回及迟响应清理。 |
| PB4 | Talent discovery semantics | Only confirmed public snapshot, headline-only summary, URL filters/offset/returns, neutral READY materials marker and no certification | `frontend/e2e/innovation-talents.spec.ts`、`frontend/e2e/innovation-public-reference-layout.spec.ts` | 已覆盖，已验证：公开句、URL筛选、中性READY材料标记与四断点长姓名。 |
| PB5 | Authorized talent reads | Current-version explicit contact/file download,404/409 recovery and auth epoch clearing; no private contact values before action | `frontend/e2e/innovation-talents.spec.ts` | 已覆盖，已验证：真实联系/下载、404/409/授权撤回与账号切换恢复。 |
| PB6 | Real resource links and context | Projects and roles use their real IDs and preserve whitelisted same-list query/offset on return; detail child paging remains separate | `frontend/e2e/innovation-public-reference-layout.spec.ts`、`frontend/e2e/innovation-recruitment.spec.ts` | 已覆盖，已验证：真实项目/岗位ID及白名单列表上下文返回，RED→GREEN。 |
| PB7 | Approved layout and long content | Three library entries and divided equal feeds, project/talent two-column discovery, quiet R5 recruitment rows, responsive details/full text and44px actions | `frontend/e2e/innovation-public-reference-layout.spec.ts` | 已覆盖，已验证：四断点布局/筛选/事实顺序/长内容；36生产对照与12自然动作视口。Task12继续已记录密度精修。 |
| PB8 | Current visual and accessibility proof | F6, five business suites, four scoped visual groups, actual approved comparisons and keyboard/focus without new masks/tolerance | `frontend/e2e/innovation-navigation-visual.spec.ts`、`frontend/e2e/innovation-recruitment-visual.spec.ts`、`frontend/e2e/innovation-talents-visual.spec.ts`、`frontend/e2e/innovation-review-visual.spec.ts` | 已覆盖，已验证：F6、75项B、四组V加基础16无更新比较、23张实际走查、生产联系200及同SHA文件下载200。两张历史截图调和单列记录；非整站业主视觉验收。 |

| PB9 | Final whole-site public fidelity | Close the actual same-scale review checklist: dividers, headings/links/counts/filters, role decisions, talent reading/files and achievement award grouping | Task12 current-source layout regressions and full visual walk | 缺口G-9，已列入Task12必做，详见同批计划与 t6a-final-fidelity.md；本批不声称精确复刻 |
| PB10 | Task12 source hierarchy and dates | Native source header/back flow, actual adjacent counts, full-height list rules, source role/talent metadata and materials; publication dates include business-zone year while deadline format stays unchanged | `frontend/e2e/innovation-public-reference-layout.spec.ts`、`frontend/e2e/innovation-review.spec.ts`、`frontend/src/__tests__/innovation-review.test.ts` | 已覆盖，分组实际 RED→GREEN（source public query 定位修正已通过）；最终整站门禁待完成 |
| PB11 | Talent management action follows approved header ownership | Only ACTIVE STUDENT retains the existing profile destination; source top0 belongs to its own relative heading at320/390/800/1440, with44px target and reserved title width | `frontend/e2e/innovation-public-reference-layout.spec.ts` | 已覆盖：完整浏览器检出4/6px真实回归，批准源四宽度计算delta0；原严格断言 RED to GREEN，最终完整门禁待执行 |

## 缺口明细

- G-1：已关闭本批工程缺口。已验证：当前75项包含真实身份/导航/访问边界回归。
- G-2：已关闭本批工程缺口。已验证：真实成果核实、公共snapshot与长内容；私人父项目修改未进入公开DOM。
- G-3：已关闭本批工程缺口。已验证：当前真实招募联系、截止/关闭/撤回及迟响应清理。
- G-4：已关闭本批工程缺口。已验证：公开句、URL筛选、中性READY材料标记与四断点长姓名。
- G-5：已关闭本批工程缺口。已验证：真实联系/下载、404/409/授权撤回与账号切换恢复。
- G-6：已关闭本批工程缺口。已验证：真实项目/岗位ID及白名单列表上下文返回，RED→GREEN。
- G-7：已关闭本批工程缺口。已验证：四断点布局/筛选/事实顺序/长内容；36生产对照与12自然动作视口。Task12继续已记录密度精修。
- G-8：已关闭本批工程缺口。已验证：F6、75项B、四组V加基础16无更新比较、23张实际走查、生产联系200及同SHA文件下载200。两张历史截图调和单列记录；非整站业主视觉验收。

当前源与完整回执：`infra/ui/.runtime/t6a/accepted.json`。75项无跳过/重试通过；全目录、正式no-skip、远端CI、物理macOS/iOS与整站业主验收不由本批声称。

- G-9：整站最终样张细节收口，见 `.superpowers/sdd/2026-10-16-whole-site-ui-migration/t6a-final-fidelity.md`；必须在Task12关闭，不能以工程门禁通过代替。
