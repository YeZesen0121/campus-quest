# UI migration verification record

> R6 合流说明：以下为独立 UI13 工作线在 2026-10-19 的历史验收记录，已按 904 源文件与 61 PNG 的哈希固定后导入。其 build、服务端口、测试数字和忽略目录均属于 UI 线；不是当前 R6 验收证据。R6 的新鲜验证见 `innovation-collaboration-verification.md`，合流回执在 `infra/r6/.runtime/ui-import/ui13/r6-import-receipt.json`。

## UI13 当前视觉验收状态 — 2026-10-19

本轮已逐页对照 64 个已确认场景并修复 38 类差异，代理视觉验收完成。当前本地生产构建 `V8JzxuP4maLL5qPrfNrwM`，预览 [localhost:3307](http://localhost:3307/login)，沿用原模拟数据库与 Redis2。没有提交、推送或合并；不推断小叶已认可最终效果，也不声称全站逐像素零差异。

当前同一份 904 文件源码：前端六命令退出0，745单测/178套件/0skip；覆盖率95.76/91.92/90.51，高于原门槛95.71/91.87/90.42。页面组49、状态组16、视觉六组34用例均通过，0skip/flaky。25矩阵通过，595受保护文件/57纯函数/548原有JSX回调审计通过。后端保持原字节，没有重跑后端全套或远端CI。

截图以立即前序 UI12 的61份基线为起点，仅更新其中 24 份已逐张查看新旧图、全部分段及差异图的活动基线；11份历史基线字节不变。随后六组34用例在不更新基线的情况下重新通过，原容差、掩码、字体和重试策略未放宽。旧失败报告完整保留。

保留已确认的生产适配：真实数据、空态与权限条件；44px触达与较强输入边框；真实披露及校内隐私边界；已确认的内嵌教师社区和原生弹窗映射。静态演示填充按钮、虚构计数、样张脚注不进入生产。Chrome生产检查已完成，加载骨架截图已剔除并用加载完成的390px档案页替换。原运营生产队列为0份，已完成单按规则移出待办；生产仅记录真实空态。领取详情及负责人资料标题已在本轮同源码隔离场景的桌面/手机自然滚动截图中实看，不改标为生产实看。物理Apple/iOS和浏览器UI200%未验证。

首次最终预览重建遗漏了本地 API 代理参数，前端 API 返回404而后端返回正常未登录401。只修正忽略目录中的构建参数，产品源码、已通过回归和原数据库均未改。首次构建、诊断、错误页截图及日志保留；最终构建已断言代理重写，运行检查增加同源API状态核对。

主回执：`infra/ui/.runtime/t13/final-current.json`；逐场景人工观察保留在 `review-ledger.json`，新旧像素检查在 `pixel-actual-review.json`，生产观察在 `production-final-check.json`。这些回执各自保留真实源码绑定，不把历史截图改标为当前构建。


## 历史 UI12 工程收口 — 2026-10-19

当前 UI12：已确认样张的分批实施、局部回归与实际上传链已收口，供小叶做最终产品验收；不声称业主已认可或全站逐像素零差异。当前构建 `ZETG8cTvkWRePtWQDM6T7`，独立预览 [localhost:3307](http://localhost:3307/login)，仍使用原模拟预览数据库/Redis2。没有提交、推送或合并。

Chrome 实际完成：CSV 导入预览/确认/发布；错误表头四项问题→正确文件→教师退回→学生修订第3版→教师通过；学生钱包/累计20分、月榜20分、worker通知及已读；成果私密PDF上传→独立运营领取/下载/首次核实通过→校内公开版排除私密证明和负责人学号；人才PDF上传→主动选择/公开预览/确认→另一校内账号下载，含材料筛选1、无材料筛选0。34份观察不等于34项测试；三个实际下载文件的字节数与SHA256均匹配上传原件，下载事件监听的超时保留为观察器失败。

新发现并修正：任务表单示例原使用解析器不支持的 `columns`，现在使用 `required_columns` 的url/title字符串列。真实后端解析器RED退出1→GREEN退出0；仅这一个静态示例字符串改变，逆向替换可精确重建UI11源文件，事件、API、权限、CSS、状态与全部61PNG不变。新生产构建里已实际核对示例并取消，没有创建额外任务。

当前验证：前端源码审计/类型/Lint/CSS/745单测178套件/覆盖率/生产构建/25矩阵八命令退出0；原npm审计脚本另在Windows官方源退出0，仅子进程覆盖registry。覆盖率 95.74 / 91.92 / 90.51，原地板95.71/91.87/90.42未变。904源码/61PNG、47实际page/64场景、218参考原件/副本重新核对；后端513与4契约不变，没有冒称重跑后端全套。完整UI8的226通过/42注册条件skip/no-skip0保留较早精确源码；UI10/11局部行为、axe和像素回执保留各自源码，UI12不把它们改标为本轮整站重跑。

主回执：`infra/ui/.runtime/t10/final-ui-12-current.json`、`manual-ui11-chrome-completed.json`、`manual-cua-chrome-ui11/actual-download-bytes.json`、`ui12-final-preview-live.json`、`manual-cua-chrome-ui12/current-placeholder-check.json`。旧失败报告、Edge/IAB观察与封存日志全部保留。当前Chrome上传成功取代旧Edge权限卡点；无需再次修改扩展权限。

明确限制：最终视觉验收仍由小叶完成；物理Apple/iOS、物理浏览器UI200%和远端CI未验证。历史代理重置原因仍未知。现有后端发布保护只检查schema非空/版本，仍会允许手工填写无效DSL发布；这是此次观察到的既有业务问题，已记录，UI迁移没有擅改后端规则。Docker重启后Beat曾报告本地schedule损坏，原日志保留；随后定时任务和实际通知已运行，不能将整份日志称为无错误。

## Previous UI11 — isolated preview restored; actual uploads remain open

Source904/PNG61 are bound in `infra/ui/.runtime/t10/final-ui-11-current.json`; production build `NpreXjh6x0WO2_-0lLJbR` is running on the same owned preview DB/Redis2. UI11 restores the approved single reward authorization form, account-filter clear, eight original subtitles and compact truthful notes. Original GrantForm command body and six original state initializer lines were compared exactly; backend513 and four frontend API/dependency contracts remain byte-identical to accepted evidence.

Scoped business17 and axe16 passed on the explicitly recorded pre-marker-removal source. Core first15PASS/1FAIL onlyadmin-users remains a failed report. After actual old/actual/diff review, only that approved source change updated one PNG; other60 including11 historical unchanged; fresh no-update core16 passed. Subsequent source delta is exactly one undefined unstyled class token removed from AdminUserAccounts, reconstructed byte-for-byte. Fresh current account clear1 and account pixel1 passed with no baseline change.12 source/current pairs17strips were actually viewed; those AUTO images retain their original source binding and external DEV badge, not C6 production acceptance.

Current frontend first8 commands passed: source audit, type, lint, CSS,745unit/178suites/0fail/skip, coverage95.76/91.92/90.51 above unchanged floors, build and matrix25. Current E2E typecheck0. Final npm audit failed because the official registry did not complete; same-source retry also failed. Diagnostic IPv4 TCP443 timed out/IPv6 unavailable. The container audit reports remain failed. Subsequently, the unchanged original gate passed0 on Windows against official registry.npmjs.org, with a per-process registry override because the native user default is npmmirror; persistent configuration is unchanged. Source904/PNG61 are identical. `ui11-native-audit-supplement.json` binds this result. First8 frontend commands plus this same-source native audit cover all nine checks; this does not relabel the earlier failed report or imply release approval. Receipts: `final-ui-11-frontend-2`, `ui11-audit-recheck`, `ui11-registry-probe.json`. Prior failed CSS and observer reports are retained.

Actual Edge UI11 production reload succeeded on original simulated task087094d6-36db-405e-9ddb-e2746d53a466. After the owner confirmed file URL permission enabled, chooser opened but setFiles still rejected by extension guard. Current connected Edge profile is 用户配置1; no file selected or uploaded, task remains DRAFT/0units. Receipt `ui11-edge-file-connection-diagnostic.json`, new one-entry `manual-cua-edge-ui11` ledger. After Chrome setup guidance, the owner explicitly chose to continue using Edge and requested detailed manual steps. Refresh file URL permission and connection in the connected Edge 用户配置1, without recreating task/world. C6/Task12 remain OPEN. No commit/push/merge or CI/owner acceptance implied.

## Previous UI10 — corrected and verified on its recorded source

Isolated `codex/ui-migration`, HEAD `5813bb4e83ec328229b1b26b2edff1ef40abdef7`; implementation remains uncommitted. No commit, push, merge, deployment, remote CI or owner visual acceptance is implied.

| Evidence | Result | Receipt under `infra/ui/.runtime/t10/` |
| --- | --- | --- |
| Independent dirty-tree review | CLI0.163/gpt-6-astra/high completed0; all1203 bound files unchanged; two Important/P2 findings, corrected in one pass; no APPROVE verdict inferred | `final-review-binding/cli-result-0-163.json` |
| Review regressions | Both actual RED failures fixed: achievement project link navigates by keyboard/pointer; mobile review entry moves focus to visible return, desktop keeps queue focus | `review-fix-red/results.json`, `review-fix-green/results.json` |
| Preserved failed broader check |37PASS/1FAIL; only axe-admin-users header contrast failed. This report remains failed. Subsequent source delta is header-color CSS only | `review-fix-green/results.json` |
| Current color/affected verification | All16axe/admin15/core16 PASS,0skip/flaky;61PNG byte-identical, no baseline/tolerance/mask/retry changes | `review-fix-green-2/results.json` |
| Current frontend |9commands0;745unit/178suites/0fail/skip; coverage95.76/91.92/90.51 above unchanged95.71/91.87/90.42;25matrices, build and audit0; E2E typecheck0 | `final-ui-10-frontend/results.json`, `review-fix-e2e-typecheck.log` |
| Current preservation/build |595protected files/57pure functions/451original callbacks;904source/61PNG; five-file delta from UI9, seven from fullUI8; current build0 with buildID/routes manifest | `final-ui-10-current.json`, `final-ui-10-full-report-supplement.json`, `final-ui-10-production-build/result.json` |
| Backend identity |513backend+4contracts byte-identical; original1296unit/124workers/1459real-PG/46E2E/18ratchets/migrations remain their exact-source receipts, not reruns | `backend-current-final-ui-10.json`, `backend-accepted.json` |
| Earlier whole report | UI8:226PASS/42registered existing conditional skips/0fail/flaky; formal no-skip0 on the same report. It does not execute current seven-file delta | `final-ui-8-browser/results.json` |
| Reference/isolation |218original+copy entries rehashed; original tracked state unchanged with2existing untracked plans; R5clean; UI dirty274; native diff-check0 | `final-ui-10-reference-recheck.json`, `native-isolation-ui10-pre-manual.json` |

Header accessibility: the approved wash puts ordinary auxiliary ink at calculated4.498 contrast. Only administrative table/native-setting header ink deepens about one sRGB step (calculated4.545); wash, geometry, font and other auxiliary text remain. Actual all16axe pass and fresh16core no-update compare verify the correction. One current1440 admin DEV image was actually viewed; its external Next badge is explicitly not production proof (`review-header-actually-viewed.json`). Earlier UI9 source QA40pairs/63generated strips/19actually viewed and earlier C5 six-group33 comparisons retain their own source scope.

C7 review/correction is complete locally. The reviewer omitted the requested exhaustive declined-to-judge list; the explicit implementation-owner limits and disposition are preserved in `.superpowers/sdd/2026-10-16-whole-site-ui-migration/final-review-disposition.md`. No second review loop or implicit owner approval.

C6 is still incomplete. Initial52 IAB observations remain sealed on UI9 (not52passed tests); actual-view addendum identifies screenshots45/48 as lagging earlier states, not post-action visual proof. Their semantic outcomes and later checks remain separate. Exact sealed prefixes of all3 old production logs and full logs are preserved in `manual-ui9-before-ui10` before resume.

The same owned preview DB `campusquest_test_ui_preview_c5476fe7dc37`, Redis2 and UI3307/API8307 now run the UI10 production build. Edge actual teacher login and new task creation succeeded. Task `087094d6-36db-405e-9ddb-e2746d53a466` is an explicitly simulated CSV url/title task, relative1440minutes, all reminders/channels off, still DRAFT with0units. Existing seeded teacher queue has1submission; it is not a manually uploaded submission. Edge filechooser opens, but `setFiles` explicitly refuses until the ChatGPT extension's Allow access to file URLs permission is enabled. The browser URL policy also rejects agent access to edge:// settings; no workaround was attempted. User was asked to enable it manually. Three Edge observations are saved separately in `manual-cua-edge`; screenshot03 was actually viewed and shows an unselected input.

Still unverified as actual journeys: CSV validation/submission/return/revision/approval; achievement proof upload/independent operations verification/authorized download; talent files. No hidden API upload, DOM mutation or direct jobs substitute. C2 historical unknown socket/proxy reset causes remain unknown; passing current journeys do not prove a root fix. Physical Apple/iOS, physical browser UI200% and remote CI remain untested. Task12 remains OPEN. C8 partial-acceptance handoff is complete at `.superpowers/sdd/2026-10-16-whole-site-ui-migration/ui10-current-handoff.md`; `manual-ui10-partial.json` seals current build/artifacts/log prefixes and independent HTTPgallery404 without claiming actual upload.

The UI9 and earlier records below are historical. Their former current/pending wording is superseded by this section, with original raw failures retained.

## Historical UI9 status — superseded by the UI10 section above

Isolated branch `codex/ui-migration`, HEAD `5813bb4e83ec328229b1b26b2edff1ef40abdef7`; all implementation remains uncommitted. No commit, push, merge, publication or remote CI claim.

| Current evidence | Result | Receipt under `infra/ui/.runtime/t10/` |
| --- | --- | --- |
| Full standard UI8 |226PASS/42existing conditional skips/0fail/flaky; formal no-skip reads SAME report and exits0 | `final-ui-8-browser/results.json` |
| Current UI9 frontend |9commands0;745unit/0skip; coverage95.77/91.92/90.51 against unchanged95.71/91.87/90.42;25matrices; audit/build0 | `final-ui-9-frontend/results.json` |
| Current source preservation |595protected files/57pure functions/451original callbacks | `final-ui-9-frontend/source-audit.log` |
| UI9 affected CSS closure |admin10+operations2+qualification3 all15PASS, then16fresh no-update core pixels | `admin-filter-green-2/results.json`, `admin-users-ui9-candidate-2/results.json` |
| Exact source supplement |904source/61PNG;3-file delta from fullUI8; full report does NOT execute current CSS | `final-ui-9-current.json` |
| Backend identity/gates |513backend+4contracts unchanged;1296unit/124workers/1459real-PG/46E2E/18ratchets plus migrations/contracts | `backend-current-final-ui-9.json`, `backend-accepted.json` |
| C5 visual chain |earlier six-group33no-update pass;50active images reviewed65strips; UI9 only1reviewed admin-users PNG update, other60including11historical unchanged; fresh core16 pass | `final-ui-7-c5-accepted.json`, `admin-users-ui9-baseline-review/review.json` |
| Final production build |exit0; buildID/routes manifest and all current904source/61PNG rechecked before/after owned preview actions | `final-ui-9-production-build/result.json`, `manual-current.json` |
| Actual CUA production |52observations, not52passed tests; completed mock role/qualification/reward/notification/recruitment/talent/mentor/maintenance flows listed separately; actual page+HTTP gallery404 | `manual-current.json`, `manual-cua/observations.json` |
| Reference/coverage |47pages/46product routes/64scenes;218reference entries originals+copies rehashed | `route-source-mapping-current.json`, `manual-current.json` |

UI9 uses measured admin context typography/density, responsive table/native-setting columns, preview800/editor760 and qualification720 recipes. Audit inputs remain14px; users/grants13desktop14phone and labels12px muted400. A legacy four-width title observer fell through at new640; exact single-expression correction follows7approved source titles32px, retaining all original values/meaningful RED assertions. Source-derived RED2 failed3 before CSS. First scoped core15PASS/1FAIL had only intended user-page typography/header2px drift; exact one-file candidate and fresh16no-update passed, without tolerance/mask/retry/skip changes. Current source QA40pairs/63strips generated;19 key strips actually viewed, not every generated strip.

C6 remains incomplete: documented CUA filechooser attempts timed out, including exact input, native AX and visible foreground. Input stayed unselected; cause unproven. Actual CSV upload/validation/submission→teacher return→student revision→teacher approval and achievement proof→operations verification→proof download, plus talent files, have NOT passed manual acceptance. No hidden API uploads/DOM mutation/direct jobs substitute. Existing automatic journeys remain their own proof. Four observations are explicitly intermediate/transient16/25/31/51, superseded by17/26/32/52; final image52 was actually viewed after DOM opacity1 verification.

Independent preview uses owned DB `campusquest_test_ui_preview_c5476fe7dc37`, initially empty leasedRedis2 and UI3307/API8307; real local worker/beat, logging external adapters. Mock mentor withdrawal was LAST after actual invite/accept/revoke; another explicitly simulated mentor remains publicly confirmed/accepted for review. Guide: `infra/ui/.runtime/t10/manual/owner-guide.md` (private/ignored, no credentials in tracked docs). Current API/web/worker log scan contains no reset/error marker at sealing time; this does not resolve C2 historical unknown transport failures.

Historical UI7 full221PASS/42conditional skips/5typed-login observer failures remains failed; no-skip was not run. UI8 corrects observer enabled-wait/OTP replacement and passes the fresh whole report. No old failure is relabeled. PhysicalApple/iOS and physical browserUI200% remain untested. Independent complete-dirty-diff review C7 and final partial-acceptance handoff C8 remain. Task12 stays open because C6 is incomplete.

Earlier preparation prose and raw failures remain in the append-only Task12 ledger and local `infra/ui/.runtime/t10/status-docs-before-final-cleanup/`. The batch records below are historical evidence for their own source snapshots.

Owner rejected the earlier gallery's fidelity, then accepted the closer real
login direction and authorized continuous page-family restoration. Whole-site
owner visual acceptance is still not granted. Each batch uses approved-source
reference comparisons as well as product regression screenshots; earlier
receipts apply only to their recorded frozen source.

Date: 2026-10-16 (Asia/Shanghai). T0–T2 implementation and local shared-foundation
acceptance are complete. macOS/iOS and physical browser UI200% remain untested,
as explicitly recorded below. Evidence is fresh local UI-runner
output, not remote CI or reused R5 receipts. The baseline table below describes
the earlier unchanged-style T0 run, not the current final UI.

## Historical T8 teacher status (local engineering complete)

2026-10-18: `infra/ui/.runtime/t8/accepted.json` binds the current frontend/backend source including the new DOM-only focus hook and all61 PNGs. Fresh F6/matrix24 and all four required Chromium specs passed22 cases with0 skipped/flaky/unexpected. Earlier RED, selector-only mistakes and pre-refinement logs remain preserved. The pre-refinement gate passed all six frontend checks but failed the newly added matrix's missing gap-section heading; it is not substituted for the final gate.

Teacher review now uses approved asymmetric panes and a phone queue return, actual totals and retained original fields. Task lists use plain records and aligned states; native task forms keep existing dialogs, original values/validation/frozen rules and source field order. Configuration, statistics, CSV preview/confirm, collaborator grants and governance stay within the actual task. Achievement review keeps original claim/frozen-snapshot/conflict/actor/unknown-command behavior while separating submitted public content, restricted owner/proof and the decision. Existing66 function statement sequences,155 handler expressions and22 stateful child props remain;878 other source files are unchanged. Exactly11 new UI ref/hook declarations restore focus for7 controlled dialogs lacking a Radix Trigger. The generic hook fences its DOM opener by live auth epoch. One redundant React autoFocus prop was removed because it captured the confirm button before Radix's open callback; Radix's normal first-control focus remains.

Real regression checks cover teacher lifecycle, required reasons, audited identity reveal and correct403 for reveal-admin deletion without task governance authorization. A task-owning teacher separately deletes an anonymous fixture and sees original staff history plus a deleted badge; the public tombstone is a different contract. No backend permissions or request semantics were changed. Inaccurate close/cutoff copy was corrected against existing server rules.

Candidate visual verification passed19 cases (two targeted updates then core16/review1 no-update); a fresh independent no-update run passed17. Exactly teacher-reviews and achievement-operator-empty-queue changed;59 of61 PNGs remained byte-identical. Every changed old/new image was inspected. No tolerance, retry or stable-field mask was relaxed. A fresh Next production build, owned Next start/API processes and one disposable world passed the same3 four-width UI contracts. All32 approved-source/product pairs and all117 comparison, natural-action, dialog and field-section images were actually viewed. The approved full-page task editor is adapted to the required existing dialog; community comparison uses only its actual inline columns. These scope differences are explicit. Actual data is synthetic fixture data, never copied sample identities or fake counts. Owned servers/world cleaned and218 approved originals/copies plus native R5 isolation were freshly verified.

This closes Task10 local engineering. Whole-site owner fidelity acceptance, final current no-skip/catalog/cross-browser/infra checks and one fresh independent whole-branch review remain. Mandatory Task12 shared shell, colors/badges/link treatment and prior source-reconciliation findings remain open. No native commit, push or merge or remote CI/hardware claim is inferred.

## Historical T7 mentor status (local engineering complete)

2026-10-17: `infra/ui/.runtime/t7/accepted.json` binds the working source and all61 PNGs. Current F6/matrix23 passed with732 unit tests and unchanged coverage floors. Dedicated mentor-world Chromium9 and standard navigation/draft/recruitment Chromium35 passed with0 skipped/unexpected/flaky; these scoped reports do not establish the whole current catalog. Earlier RED and intermediate results remain diagnosis evidence.

Approved R5 composition now covers the real directory, top-contact detail, candidate/consent and current authorization, operations candidate/read-only old public version, both sides of project links, and the approved public-project mentor region. Existing36 behavior-function prefixes,73 event expressions and6 stateful child openings remain structurally identical;891 other frontend/backend source files are byte-identical to Task8. Mixed authorized text/contact changes remain PENDING while old public DTO/version and contact values stay available; expired consent resets, dirty invitation guards, existing revocation, account isolation, unknown-command recovery and21-row browser pagination passed. The original202-row PostgreSQL contract is unchanged and remains for fresh final Task12 integration verification. Native14px fields, bounded textarea growth,44px touch targets, source columns and dividers passed four widths. Actual visual inspection of62 provisional comparison/focus images found and corrected list columns, candidate heading wrapping, contact gaps and section weight before the final gates.

Both candidate visual and fresh no-update comparison runs passed27 cases (mentor9, recruitment2 and core16); exactly4 approved PNGs changed and57 stayed byte-identical. Every changed old/new pair and strip was actually inspected. Existing0.01 tolerance and zero visual retries remain; only newly displayed volatile native time text is narrowly masked after exact business-zone text assertions, with actual API timestamp provenance checked and all stable fields unmasked. Source/product QA is entirely unmasked. The current tall mentor content-locator PNG also captures the external sticky bottom navigation; this capture artifact is explicitly a mandatory Task12 correction, with fresh final visual/infra evidence required. A fresh production build and one dedicated mentor world produced28 source/actual pairs and16 naturally focused action views; every image was inspected. Four actual unbound-mentor views were inspected before profile creation. Production native UI executed consent, invitation, acceptance, mixed candidate save, explicit old-confirmed contact reads at all4 widths, relationship revoke and withdrawal last; the public profile then returned404. All action targets were44px and unobscured. The exact owned preview/world cleaned up, and185 approved originals/copies plus native R5 isolation were freshly verified.

This closes Task9 local engineering only. Mandatory Task12 source reconciliation still includes the shared/mentor shell, role-safe navigation, approved public local tabs, source link/button treatment, real section count placement and operation header/list adjacency, plus all prior required fidelity findings. Full current catalog/no-skip/cross-browser checks and one fresh whole-branch review remain. No native commit, push or merge, remote CI, physical macOS/iOS or browser UI200% claim is inferred.

## Historical T6b private innovation status (local engineering complete)

2026-10-17: `infra/ui/.runtime/t6b/accepted.json` binds current working-source and61 PNG hashes. The native isolated branch remains codex/ui-migration at R5 5813bb4 with uncommitted changes; no commit, push or merge. Fresh F6 and matrix22 passed; the full scoped Chromium report has88 passed with0 skips/unexpected/flaky plus the dedicated mentor-world parent lifecycle1 passed. Earlier interrupted and failed runs remain as diagnosis evidence and are not acceptance reports.

Eight approved private screens now share the source composition at320/390/800/1440: owner profile/qualification, project list and inline editor, achievement list and editor, recruitment list and editor, and talent editor. R5 controls the project editor, including the original mentor child below the closed form. Existing mutation/reconciliation methods, pending-request stores and account/record ownership remain;552 protected backend/API/form/state files are byte-identical to Task7 and41 audited method/child entries passed (39 byte-identical; two READY receipt literals changed only to neutral feedback). New private navigation uses existing dirty/busy guards. Recruitment summary renders the real private DTO; its shortcuts freshly read the record and enter the existing explicit confirmation without a write on mount. Stale CLOSED rejection, trapped dialog focus, cancel fallback and zero writes passed.

All26 actual candidate visual cases passed, including core16 without updates, but the original update wrapper exited1 because its exact filename guard found one unrelated public-approved image rewrite. Exact pixel diagnosis found only5 changed pixels at existing datetime-mask edges; native HEAD blob proof confirmed the mask and public view were unchanged. The unexpected image was preserved and only that out-of-scope baseline was restored to its original SHA under the bounded retention audit. A fresh no-update comparison then passed23, including core16, with all61 baseline bytes stable. Exactly8 named private PNGs changed and53 others stayed byte-identical. Every changed same-scale/top-aligned old/new image and long strip was actually inspected; no added masks, blanket retries or tolerance changes. A fresh production build and one owned production world produced32 source/actual pairs,24 naturally focused action views and4 talent confirmation previews; all images were inspected. Targets were44px and unobscured, Escape restored the opener, and real private PDF/PNG downloads returned200 with exact fixture SHA values. The owned preview and world cleaned up, and185 approved originals/copies and native R5 isolation were freshly verified.

This closes local Task8 engineering, not whole-site owner acceptance or exact full-site pixels. The R5 mentor internals belong to Task9. Shared shell and public-page fidelity items explicitly recorded in the mandatory Task12 notes still require closure, along with the final complete browser catalog, formal no-skip, cross-browser checks and one fresh whole-branch review. Physical macOS/iOS, browser UI200% and remote CI are not inferred from Linux Chromium.

## Historical T6a public innovation status (local engineering complete)

2026-10-17: `infra/ui/.runtime/t6a/accepted.json` binds the frozen working source and61 PNG hashes. Native branch remains codex/ui-migration at R5 5813bb4 with uncommitted changes; no commit, push or merge. Fresh F6 all0,732 unit tests, coverage95.72/91.87/90.42 with unchanged floors, matrix21 all0. Complete scoped Chromium report:75 passed,0 skipped/unexpected/flaky,26.2m. This includes all16 accessibility checks, staff timestamp isolation, current review snapshot journey, real contact/revocation/upload/recovery behavior and six new approved-layout cases at320/390/800/1440.

Public landing, project/recruitment/achievement/talent lists and details reuse the confirmed samples; R5 takes precedence for the landing, role rows and project page. Three libraries, equal divided feeds, two-column discovery, compact native filters, role facts before the mobile body, talent contact top band and actual whitelisted return links were verified. Backend511 files and critical API/form/state contracts remain unchanged from T5; only two existing test helper import/export lines were corrected after a preserved failed run.

Four separate public visual worlds plus core16 all passed24 actual cases; the original inventory guard then rejected24 changed images against21 allowed. Actual old/new/source diagnosis reconciled exactly two historical images: the already accepted T5 growth profile and a private achievement full-page fixed-bar capture offset (form pixels unchanged). One3849-pixel Latin text variation retained its original PNG. The original failed guard and all regenerated images remain. Final candidate changes21 public plus2 named historical images;38 other PNGs remain byte-identical. All23 old/new pairs and six long detail strips were actually viewed. A fresh complete24-case no-update comparison passed without PNG changes, masks, retry or tolerance adjustments. This does not accept the not-yet-restored Task8 private UI or prove physical obstruction from full-page artifacts.

Fresh production build passed. One owned world produced36 matching-font approved/actual comparisons across nine routes and four widths, plus12 natural focused action viewports; every image was actually inspected. All tested pages fit, all12 action centers were unobscured with44px targets; real role/talent contact reads returned200, and the downloaded PNG returned200 with the exact fixture SHA. Private parent edits and student numbers stayed out of public DOM; contact values were absent before explicit action. The owned preview/world cleaned up, the engine remained;185 approved originals and copies and native R5 isolation were freshly checked.

Required Task12 density/shared-header/empty-state polish remains in `.superpowers/sdd/2026-10-16-whole-site-ui-migration/future-capture-followups.md`. This is local batch engineering acceptance, not exact whole-site pixel reproduction, whole-catalog/no-skip, remote CI, physical macOS/iOS/browser UI200%, or whole-site owner acceptance. Continue Task8/T6b serially under existing authorization.

## Historical T5 implementation status (local engineering complete; visual details remain)

2026-10-17 05:07: source-bound `infra/ui/.runtime/t5/accepted.json`, task-done47928 / wrapper210705-python109726 exited0. Native R5 HEAD5813bb4 and codex/ui-migration remain uncommitted. F6 all0 with732 unit tests, coverage95.71/91.87/90.42 and unchanged floors; matrix20 files0. Final complete scoped42 has40 passed,2 existing conditional skips,0 unexpected/flaky; all16 axe checks0. New layout/interaction assertions cover320/390/800/1440, stroke notices/honor medals, extreme/zero/debt/frozen/long content, dialog width/autofocus/Escape and shared staff timestamp isolation.

Final core16 candidate changes only gallery/rewards/rankings/notifications. Every old/new pair and final Gallery16 state region was actually inspected; fresh16 no-update comparison passed and all61 image hashes stayed unchanged vs candidate. Shared staff timestamp regression was first rejected by the strict inventory guard and fixed after actual13-vs11px RED; original teacher/admin PNGs were retained.

Fresh production build0. Initial production QA preserved24 matching-font reference pairs but stopped when notification remained PENDING because this owned preview starts no worker. Existing DeliveryService then sent ONLY this own exact redemption's IN_APP delivery once, using verified16437/6477 configuration; no external channels/global worker/manual SENT update. Continuation0 resumed notifications and second redemption without replaying successful commands; the initial failure remains1 in its original record. Combined28 pairs,12 natural action viewports and2 transition images ALL actually viewed, all tested layouts fit and action centers were unobscured. Two real201 redemptions, approve200/fulfill200, own read200, unread-filter exclusion and spendable0/disabled/stable-shelf focus were verified. This closes those two real behavior branches outside the conditional skips, not a new no-skip report. Own preview/world cleaned0; engine retained.

Required Task12 visual followups remain: notification timestamp/badge geometry and shared header/empty-state/profile-entry fidelity. Current receipt is local engineering acceptance, not exact pixel reproduction, whole-site owner acceptance, remote CI, or physical iOS/macOS/browser UI200% validation. Evidence and failed attempts stay under ignored `.runtime/t5` and `.runtime/foundation/t5`; no commit, push or merge.

## Historical T4 implementation status (local verification complete)

2026-10-17 03:24: source-bound acceptance passed at
`infra/ui/.runtime/t4/accepted.json`, wrapper192324-python77681 / task-done0.
Native HEAD remains R5 `5813bb4…`, branch `codex/ui-migration`,151 dirty entries;
the helper's empty commit range reflects the explicit no-commit ruling. This
receipt binds working source hashes, not an implementation commit or remote CI.

Home, task discovery/detail, own claim/progress/upload and inline community now
reuse the approved student samples. F6 passed with732 unit tests and coverage
95.71/91.87/90.42 against unchanged floors. The fresh complete scoped51 browser
report passed49 with two existing conditional skips, zero unexpected/flaky;
all16 axe checks passed with no waivers. The real same-claim journey exercised
invalid upload, valid replacement, review, returned revision, another version,
completion,100-point server verdict and wallet/rank reads, retaining four
storage wire proofs. This is a scoped report, not a whole-catalog no-skip claim.

Final no-update core comparison passed16/16. All61 PNGs stayed byte-identical
to the T4 candidate; the already-viewed16 old/new pairs are carried by exact
image hashes. The20 real submission state images and four filled community
images were actually inspected in the recorded earlier T4 walk, not relabelled
as a fresh final-source walk. Failed reports and the original61 T3 images remain.

Fresh production QA at320/390/800/1440 produced20 approved/actual pairs and12
natural action viewports, all32 images actually viewed. No page overflows;
all12 action centers are unobscured. The first production attempt exposed the
native file input's keyboard focus behind the phone nav; a valid regression
failed first, then passed at all four widths after scoped scroll/anchor CSS.
Allocated facts likewise changed from nested boxes to approved inline rows.
Both owned production previews stopped and cleaned their own worlds. All51
approved original reference files and copies were freshly reverified.

Existing232px rail/tablet navigation, server-derived copy and necessary upload
conditions remain. Sample-filled comments/notifications are not fabricated on
empty real accounts. Physical macOS/iOS and browser UI200%, historical transport
root causes and whole-site owner visual acceptance remain unverified. T5 onward
continues under the same authorization, with no automatic commit, push or merge.

## T3 implementation status (local verification complete)

2026-10-17 00:57: final source-bound acceptance exited0 at
`infra/ui/.runtime/t3/accepted.json` (wrapper165632-python31561).
Fresh frontend6/static3 gates passed, with732 unit tests and coverage
95.73/91.87/90.42 against unchanged floors. The actual228-case whole catalog
finished187 passed/41 existing conditional skips/0 unexpected/0 flaky in35.9m;
the formal no-skip check read the same complete report and exited0. The fresh
dedicated mentor world passed all8, including controlled slow-script relogin.

All50 active baseline pairs were actually reviewed, and11 legacy PNGs retained.
The final comparison records explicit provenance: five unaffected successful
independent worlds plus the fresh complete mentor8. Only mentor recovery case6
changed; exact bytes outside that case, all product/shared-helper/participating
spec bytes and all61 PNG hashes were verified. Earlier failures remain intact;
this is not represented as six new runs or a new manual50-image inspection.

Production reference QA covers320/390/800/1440:32 paired approved/actual frames
and4 natural account-bottom viewports were actually viewed. All32 pages have
no horizontal overflow and all4 footer hit checks are unobscured. Both production
previews stopped and cleaned their own worlds. The31 original approved source
files and copies were reverified. Real unbound-email state, existing navigation
bands/controls, explicit cancel destination and necessary operational copy are
preserved; demo-fill controls and static-sample notices are omitted.

Native branch remains `codex/ui-migration` at R5 `5813bb4…`; work is uncommitted,
unpushed and unmerged. This closes the local T3 batch, not the remaining page
families or whole-site owner acceptance. macOS/iOS and physical browser200%
remain unverified. Slow-script user input before initialization was not changed
by the test handoff correction; assess it in the final review as recorded in
`final-review-followups.md`. Historical transport/proxy500 causes remain unknown.

The following dated paragraphs are retained historical investigation records.

Latest23:59: the next comparison passed all five unaffected groups, but the
mentor cross-tab relogin again lost the first input. A controlled6500ms delay
of real client scripts reproduced it with trace and state observations: the
URL-only assertion returned at document `interactive`; the filled username
was cleared by the time document loading completed. The test now waits for
the full navigation (`waitForURL`, `load`) before filling, then observes its
own POST200 and actual landing navigation. Controlled GREEN passed with30
held scripts and the username retained throughout. Product login logic,
global timeouts, retries and the original document-identity/private-data
clearing assertions are unchanged.

Only that single mentor test case differs from the previous comparison;
exact bytes outside it were verified against a recovered prior source blob
whose SHA matches the recorded manifest. The five successful independent
groups remain valid for identical product/shared-helper/own-test bytes and
unchanged PNGs. Fresh complete8-case mentor comparison, fresh F6/static gates
and explicit provenance composition are in progress. This is not six new
runs or a new manual50-image review. Final production proof and a complete
228-case standard report with its own no-skip guard remain pending.

Latest23:30 correction: independent six-group comparison stopped with five
groups passing and the first mentor login failing its5-second URL assertion;
the seven later mentor scenarios passed. No successful comparison receipt was
issued. A new controlled real-login test first reproduced exactly one POST200
while its landing navigation was deliberately held6500ms. The student helper
now observes its own login response and waits for actual navigation using the
existing navigation/test budget, without resubmitting credentials or changing
global timeouts. Controlled GREEN and fresh gates are pending; no product auth
fix is claimed for the earlier intermittent failures whose causes remain unknown.
Docker had stopped between sessions; the already authorized engine was restarted
in persistent session86557, and UI-only ownership Check/Start exited0.

Revalidation ruling: only `e2e/fixtures.ts` and the new mandatory
`fixture-student-navigation.spec.ts` may differ from the reviewed candidate.
If every product byte, screenshot assertion/mask/font/tolerance and all61 PNG
hashes remain identical, retain the actual50-image manual review by exact SHA,
preserve its original receipt, and explicitly link its provenance to a new
test-helper revalidation record. This is not a new manual walk or screenshot
generation. Fresh F6/matrix/audit, actual whole228 catalog collection, all six
independent no-update pixel groups, final production proof and the complete
standard report with its own no-skip guard remain required before T3 closes.

Pixel update22:58: the unchanged full8-case mentor confirmation passed,
including the earlier relogin failure; its exact cause remains unknown and no
authentication fix is claimed. Source and all61 PNG hashes stayed identical.
The candidate at `foundation/t3/update-confirmed-20261016T144828` explicitly
links the five original successful independent-world reports to that fresh
complete mentor report; the original failed run is retained, never relabeled.
All50 active old/current image pairs were actually inspected through12 contact
sheets and10 long-page detail strips;11 legacy files are unchanged and are not
runtime coverage. `qa/receipt.json` binds the reviewed PNG hashes. Fixed chrome
crossing long/element capture frames is disclosed, including the recruiting
owner-form top crop; these frames do not grant reference-fidelity acceptance to
feature bodies scheduled for T4-T9. Natural production viewport/account-footer
hit tests remain required. A fresh independent whole-six-group no-update
comparison is now running at `compare-20261016T145629`; it has no acceptance
result yet. Current product/test source is unchanged from the passing static
gates and9-case targeted verification.

Verification update22:07: `readiness-full/` finished227 cases as184 passed,
41 skipped and2 failed,38.4 minutes; all six frontend gates, matrix and audit
exited0. No formal no-skip check ran on this failing report. The earlier dated
mobile navigation, initial review readiness and talent readiness cases passed.
The two new failures are retained with full traces: the first approved public
achievement detail received a Next-local proxy500/ECONNRESET (root cause still
unknown), and Firefox clicked the profile footer while growth data expanded
between pointer-down and pointer-up, moving the link away and producing no
logout navigation. The actual extracted frames were inspected. The cross-browser
scenario now waits for the real ready-only `获得的荣誉` region before clicking;
its original logout/back-fence assertions, timeouts and retries are unchanged.
`navigation-readiness-target/` finished with typecheck/lint exit0, the unchanged
full review journey1/1 and all8 Firefox/WebKit smoke cases passing. The observed
Firefox RED becomes GREEN with the single real-data readiness checkpoint. The
proxy reset did not recur here; its root cause is still unknown. No product
source changed for these findings. Fresh `navigation-static/` finished all six frontend gates, matrix and audit
with exit0;732 unit cases pass and coverage remains95.73/91.87/90.42 with
unchanged floors. The new six-group candidate run is in progress at
`foundation/t3/update-20261016T141816` (core/review exit0 so far). A new whole227-case
report and its formal no-skip check remain required after pixel/reference verification.

The owner accepted the closer login direction and authorized continuous serial
restoration without per-page approval. The current implementation extends that
composition through registration, password recovery, staff and mentor entry,
invitation/TOTP/recovery codes, logout, workspace shells and owner account
settings. It preserves the existing authentication, role and mutation paths.
The earlier login-only record below is historical.

Fresh current-source evidence is under `infra/ui/.runtime/t3/`:

- `f-before-copy-row/results.json`: the preceding complete frontend run had
  all six gates exit0,732 unit tests, coverage95.73/91.87/90.42 with unchanged
  floors and build exit0. After the TOTP/recovery presentation corrections,
  fresh `f-before-result-width/results.json` again records all six gates exit0
  with732 unit tests, the same coverage figures and production build exit0.
  After the scoped completion-panel width correction,
  `f-before-fixture-fix/results.json` again
  records all six gates exit0 with the same732 unit tests and coverage figures.
  This is not whole-batch acceptance.
- `browser/results.json`: the subsequent main batch finished85 passed,1 existing
  notification skip,0 failed; all8 Firefox/WebKit smoke cases passed. Its
  mentor long-content case passed, while the lifecycle stopped at a new overly
  broad alert locator matching Next's route announcer alongside the correct
  mentor guidance. The locator now scopes to main; the fresh separate mentor
  world under `result-width/` passes both the full lifecycle and long-content
  cases. No product permission logic was changed for this test defect.
- `browser-first-attempt/results.json`: typecheck and lint exit0. That batch has
  84 passed,1 existing conditional skip and1 failed navigation case out of86.
  The dedicated mentor stage has not run because the pipeline stops on failure.
- All14 approved-auth layout cases and all3 workspace/account layout cases
  passed in that batch. Actual TOTP and one-time recovery screens were captured
  during the passing real invitation lifecycle, using synthetic test data.
- The failed desktop innovation navigation issued its route request, which had
  no response before the existing5-second heading assertion expired. Its direct
  cause remains under investigation; no authentication fix or timeout/retry
  workaround is claimed. Full trace is preserved in
  `browser-first-attempt/main-artifacts/`. An unchanged focused diagnostic
  repeated the case three times: the first failed earlier during login with a
  pending response, then two passed; this does not establish a fix.
- `totp-row-green/` and `recovery-layout-green/`: real invitation lifecycle
  passes after observed layout RED. Copy actions and recovery actions share
  rows at390/1440; the recovery and completion states have reference headings.
  Both code-list screenshots were actually reviewed. Eight codes, clipboard
  feedback, confirmation removal and the real staff-login link remain verified.
- `result-width-red/`: the real completion state measured272px against the
  approved354px mobile panel. The correction adds only `width:100%` within the
  existing35rem maximum. `verify-result-width.py` verifies that sole product
  CSS delta, unchanged React/API sources and the preceding passing main batch,
  then runs fresh frontend gates, staff/TOTP cases and a separate mentor world.
  It exited0: all frontend gates,4 staff/TOTP cases and2 mentor cases pass;
  source hashes remain unchanged through that run. Current completion images
  at390/1440 were actually viewed, with354/560px panels. It does not claim a
  new whole standard battery after the scoped change.

Approved-reference identity/account pairs and security states were actually
reviewed before starting the six-group pixel candidate run. Pixel acceptance
and final production comparison remain pending for this source. Earlier
own-baseline PASS is not current approved-reference acceptance.
No current production preview is running while verification owns the UI runner.
No commit, push or merge has been performed.

The first T3 pixel candidate stopped in core:15 passed,1 failed before capture
because `staffLogin` retried an already accepted login after its short URL
assertion expired. The retained controlled regression trace shows three login
POSTs, all200, during deliberately delayed RSC navigation. The shared test
helper now waits for its own response and actual navigation; it retries only
typed401 `AUTHENTICATION_REQUIRED`, keeping the existing maximum of three.
Product authentication and all timeout/retry limits remain unchanged.
`staff-navigation-green/` records2/2 passing controlled regressions.

Because this changes shared test infrastructure, the project matrix requires
full verification. `test-infra-final/` retains the first fresh full attempt:
six frontend gates and audit exit0;225 browser cases finished180 passed,
41 skipped and4 failed. Its no-skip command did not run because that battery
failed. The four failures cover three missing readiness boundaries: completed
project navigation/data, initial workflow/evidence reads, and initial talent
editor reads (the latter affected two cases). All relevant traces were read.
No product source was changed for these corrections.

`readiness-target/` then passes typecheck/lint and all6 actual browser scenarios:
two new controlled-delay talent initialization branches plus the four original
failed journeys, retaining their business assertions. New fault-injection cases
have a separate120-second setup/cleanup budget; existing5-second assertions,
global timeouts and retry limits are unchanged. The fresh complete verification
is now running under `readiness-full/`: frontend gates, matrix, audit, the whole
227-case catalog and no-skip against that exact full report. It is not yet
accepted; filtered targeted results are not substituted for the full guard.
Pixel source/PNG acceptance is still pending; the failed
candidate is not accepted, and its original61 images remain preserved.

## Earlier T3 login fidelity correction (partial batch)

The actual `/login` now uses the approved top brand header, title outside the
form card, compact submit/forgot-password row, and three entries outside the
card. New presentation-only `AuthPage` owns that composition; all seven existing
auth routes explicitly retain their cards after the common layout change.
`LoginForm` only gains an optional ReactNode secondary-action slot; validation,
requests, session ownership and redirects are unchanged. Other auth routes use
the frame but are not claimed fully migrated to their respective samples.

Fresh evidence under `infra/ui/.runtime/auth-fidelity/`:

- `f/results.json`: typecheck, lint, CSS,732 unit tests, coverage ratchet and
  build all exit0. Coverage95.72/91.87/90.42; existing floors unchanged. A later
  desktop-only CSS spacing correction was rechecked by CSS and build below.
- Initial reference-layout run RED2/2 (missing brand); desktop precision test
  subsequently RED1/2 against the actual reference's132.5px heading Y. Final
  `final/results.json`: reference-layout2/2, CSS and production build all exit0.
- `paired/`: untouched reference assets are SHA-recorded in the adjacent
  `approved-auth-reference/manifest.json`; same Linux fonts, DPR1,390/1440
  viewports. Both side-by-side PNGs actually inspected. Card x/y/width match:
  mobile18/198.09375/354; desktop510/228.1875/420. Product card is44px shorter
  because it omits the sample-only demo-fill row. Static sample footer is also
  omitted; return-to-sample becomes the real return-home link. These are
  disclosed content differences, not a claim of byte-identical full screenshots.
- Focused49-case browser batch:44 pass/4 existing opt-in skips/1 fail, caused
  by an incorrect test heading expectation for the still-unmigrated anonymous
  StudentShell. That test edit was restored; no net notification-spec change.
  A standalone repeat then had a first-login navigation timeout; direct cause
  remains unknown. `notifications-repeat/` with trace on and repeat-each2:
  8 pass/2 existing fixture skips, unexpected0/flaky0, exit0. No auth fix,
  relogin, extra retry, timeout increase or new skip exemption is claimed.

The focused batch included passing auth, staff invitation/TOTP, navigation,
16 axe cases and Firefox/WebKit smoke. It is not a fresh full standard/no-skip
or six-group pixel run on current T3 source. Earlier foundation source/PNG
bindings below are historical, not current-source acceptance. T3 shell, role
navigation and account work remain pending; owner visual acceptance is pending.

Current manual preview: production Next HTTP3307 + dedicated UI API8307,
`http://localhost:3307/login`; Windows page GET200 and anonymous `/api/v1/me`
401 confirmed. Owned process metadata is `manual-auth-preview-process.json`,
wrapper `logs/20261016T084933-tsx-151459.log`, exec session39683. It holds the UI
runner lock; stop only its verified parent before further tests/builds, allowing
its child cleanup and synthetic-world teardown. Keep shared dockerd26834.

## Shared-foundation progress

- T1 PWA expected colors: observed old-color RED, then10/10 GREEN. Root tokens,
  warm rail, display31/38 and local font stacks are applied; full T1 F passed.
- Six actual Windows/Linux font specimens inspected, including rare Chinese,
  emoji, long names, inputs and asserted viewport/DPR. See `ui-migration-fonts.md`.
- Fresh axe proved six old contrast-exception entries stale; only those were
  removed. T1 rerun16/16 passed; existing task heading-order debt remains.
- T2 real gallery uses existing Button/Dialog/AuthField/SectionStates and a
  presentation-only DividedSections. Layout RED6fail/2pass became8/8 GREEN.
  Extra reduced-motion RED caught the new pseudo-element's missing media rule;
  fixed in the existing consolidated rule, then layout+axe25/25 passed.
- Approved talent-editor prototype was inspected locally at390/1440:44px
  targets,30px visible action frames,14px inputs,4px controls and8px dialog.
  Root sizing/shape reuse those values; no business state machine was ported.
- T2 focused primitive tests13/13,18 matrices, typecheck/lint/CSS/unit/coverage
  passed. Production build and actual gallery HTTP404 passed. Final standard
  battery165 passed/41 legal skipped (34.0min), and its exact full-report no-skip
  guard exited0. Candidate walkthrough and independent code review passed;
  final six-group no-update comparison passed with unchanged candidate PNGs.
- T1/T2 code was implemented serially. Their six-group pixel acceptance will
  bind the same final foundation source; local acceptance is complete. Later
  page-family migrations and the stated platform gaps remain outside this claim.

Logs/statuses: `.runtime/foundation/t1-results.json`, `t2-results.json`,
`t2-layout-red/`, `t2-reduced-red/`, `t2-layout-a11y-green-report.json` and wrapper
logs. Candidate generation completed all six groups, exit0 (update-20261016T061842). Inventory61 = 50 active PNGs regenerated + 11 unused legacy core PNGs retained byte-identically. All50 active old/new candidates were inspected and61 inventory hashes validated. Final no-update comparison passed all six groups.

Final shared-source bindings (SHA256, hashes of the manifest files themselves):

- `foundation/t2/update-20261016T061842/source.json` (880 frontend/backend
  non-PNG files): `e719bf790e92146afb1dd47e5126d3911128c0c484c7326fdde7e991149b88f0`.
- Same run's `snapshots.json` (61-file inventory):
  `9d82f1fc15fd330ba8a23448e51b68e10938124a5d9f079dfc850ae972adda17`.
- `foundation/t2/walkthrough.json` (QA indices checked against candidate):
  `0faaf9785c4442b788c8249c585382fb9542f29df831849d17cd9c56f4064ce9`.
- Original and strengthened-test T0 manifests remain in `baseline/`; the final
  candidate's source manifest, not unchanged HEAD, owns the current UI evidence.

Final standard run: `foundation/t2/standard-20261016T063754/`, wrapper
`logs/20261016T063742-python-120351.log`. Both stage exits and all wrapper layers
were0; report unexpected0/flaky0. It includes the9 required new layout cases,
and Chromium plus existing Firefox/WebKit smoke. The formerly failing selected
material/contact withdrawal scenario passed50.1sec within this full run.
This is current shared-source evidence, distinct from the earlier T0 table.

Final no-update run: `foundation/t2/compare-20261016T071609/`, wrapper
`logs/20261016T071558-python-131482.log`. Core16/review1/navigation1/
recruitment2/talents4/mentor8 all passed in separate worlds, exit0. No update
flag, new mask or tolerance change. Actual captures passed existing comparison
rules; this does not assert every actual capture byte is identical.

Final acceptance binder: `foundation/t2/accepted.json`, wrapper
`logs/20261016T073036-python-138100.log`, all layers exit0. It checked880
source-file hashes across candidate/standard/comparison and current bytes,
all61 candidate PNG hashes unchanged,50 active walkthrough entries,11 unchanged
historical entries, six successful update and six successful no-update group
commands, exact standard/no-skip report identity, and all9 required layout tests
actually passed. Full standard report SHA256:
`2b2034c57c606472df1d015425f39142195225c8617625c17da26229755a1cc1`.

## Source and isolation

- Worktree: `C:/Users/111/Documents/CodexWorktrees/campusquest-ui-migration`.
- Branch: `codex/ui-migration`; base/HEAD
  `5813bb4e83ec328229b1b26b2edff1ef40abdef7` (R5).
- Native app worktree creation could not resolve the outer non-repository
  workspace. Native Git created this external linked worktree instead; the app
  does not manage it. Preserve it until explicitly cleaned up.
- UI project, containers, source mount, node_modules/.next, certificates,
  database, Redis, storage and test lock are independent. Ports: web3307,
  API8307, PG16437, Redis6477, storage9115/9116, scanner3317.
- The user explicitly approved starting Docker. This distro has no docker init
  service; `/usr/bin/dockerd` runs in the persistent engine session. Restart
  policies restored existing containers; no direct operation was performed on
  another project's containers or original source.
- Runtime image `campusquest-r3-runtime:20261011`, actual image ID
  `sha256:9094828854d514c010862ba08be363c79eac7aa0e0f9f9e9f254f13f14266999`.
- No branch commit, push, merge or deployment. Local commits remain deferred
  under the accepted plan. Independent read-only review of this local diff
  passed with no Critical/Important/Minor findings; see foundation review record.

## Environment evidence

Full output is retained under ignored `infra/ui/.runtime/`.

| Check | Fresh result |
| --- | --- |
| Actual Compose parser | 2 expected RED assertions before adaptation; same2 GREEN afterward |
| PowerShell/Bash parsing | PASS |
| Wrong-source invocation | Actual wrapper refused before running a command |
| Runner lock | Cross-mode mutual exclusion PASS |
| Exact exit/argv fixture | Arguments/stderr preserved; run/launcher/docker-exec all returned7 |
| Stack ownership and absolute mount | Check/Start exited0 |
| Real PG/Redis/HTTP+TLS storage | Connectivity and write/read/delete PASS |
| Storage CORS | UI origins allowed; old UI/R5/R5-dev origins rejected |
| Browser context, private Git inventory, server/world env | PASS; tracked inventory1164 |
| Alembic | Independent temporary database upgrade/check/downgrade/re-upgrade/check PASS |
| OpenAPI and generated TypeScript | Fresh generators match committed contracts; only CRLF normalization |

Command/status registries: `baseline/results.json`, `baseline/resume-results.json`,
`baseline/visual-results.json`. The first registry retains the original browser
failure; it has not been rewritten as a passing attempt.

## Product baseline gates

| Gate | Result |
| --- | --- |
| Windows typecheck/lint/CSS/unit | All exit0; unit732 passed,0 skipped |
| Linux backend format/lint/mypy | All exit0; mypy221 source files |
| Test matrices | 17 files checked, exit0 |
| Backend unit/workers | 1420 passed,2 warnings,366.36s |
| Real PG integration | 1459 passed,29 warnings,1403.26s |
| Backend coverage | All18 ratchets held; fresh collection uses greenlet,thread |
| Backend E2E | 44 passed,201.45s |
| Python audit | Exit0, no known vulnerabilities reported |
| Linux frontend typecheck/lint/CSS/unit/coverage/build | All exit0; unit732 passed,0 skipped; coverage95.73/91.87/90.42 |
| Frontend audit | Exit0 with existing documented dev-chain exemptions; no new exemption |
| Fresh full browser battery | 156 passed,41 legitimate skipped,33.6min; Chromium and Firefox/WebKit smoke |
| Formal no-skip guard | Exit0 against that exact full report |
| Core visual group | 16 passed |
| Achievement-review / navigation / recruitment visual | 1 / 1 / 2 passed |
| Talent visual group | 4 passed |
| Dedicated mentor world, including pixels | 8 passed |

The six visual groups used separate disposable worlds and50 active PNGs (61 files inventoried, including11 unused legacy core PNGs),
without snapshot updates, new masks or tolerance changes. Final source check
printed `UI_SEPARATE_WORLD_VISUAL_BASELINE=PASS`; wrapper, launcher and
docker-exec all exited0 at13:22 local time.

## Initial browser failure and test correction

The first full battery was155 passed/41 skipped/1 failed. The selected-material
talent scenario reached its final reload after contact withdrawal, then showed
an anonymous shell. That original failure had no network trace. An unchanged
focused repeat with traces passed3/3; this does not prove an authentication fix.

A controlled diagnostic proved the earlier negative privacy assertion could
pass while no talent detail article existed: a loading shell also lacks private
draft text. Holding a refresh response at the browser boundary did not reproduce
the logout, so its direct mechanism remains unconfirmed.

The test now requires the real detail article before checking private text
absence and navigating again. No auth code, relogin, retry, timeout, skip or
final withdrawal assertion changed. The fresh full battery then passed,
including that scenario in50.9s.

Evidence: `baseline/failures/r4-selected-material/`, original/focused/full logs,
`baseline/baseline-test-delta.json`. The original source manifest and
`source-sha256-after-test-wait.json` distinguish the one test-only delta; all
other files in the1164 inventory remained frozen through the final baseline.

## Fonts and remaining work

Linux packages: `fonts-noto-cjk`1:20230817+repack1-3 and
`fonts-liberation`1:2.1.5-3. Actual families: Noto Sans/Serif CJK SC,
Liberation Mono and Noto Color Emoji. Character maps cover the chosen rare
Chinese samples. Metadata/hashes: `baseline/linux-fonts.json` and
`baseline/windows-fonts.json`.

Windows/Linux font rendering is now verified as described above; macOS/iOS
hardware remains unavailable; physical browser UI200% is also untested.
Approved candidate walkthrough, fresh comparison, final behavior/no-skip and
independent code review are complete; see the linked walkthrough/review records.
The original task-card heading-order exception remains for its later page task.
This phase is the shared foundation, not completion of T3–T10 page migrations.
