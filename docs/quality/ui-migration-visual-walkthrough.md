# Task12 visual walkthrough

## UI13 逐页最终视觉验收 — 2026-10-19

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

## Previous UI10 supplement

UI10 changes no PNG baseline: all61 hashes remain the UI9 accepted bytes. Fresh16core no-update comparisons, all16axe and15administrator cases pass; final-ui-10-frontend all9commands0 and production build0 bind904source/61PNG. Two final-review DOM/navigation defects are verified by actual RED/GREEN; later CSS only deepens administrative header ink by about one sRGB step to meet contrast, retaining wash/geometry. The37passing cases in the earlier mixed report keep their exact source; its one contrast failure remains recorded as a failure, superseded by the fresh scoped checks. Receipts: final-ui-10-current.json and review-fix-green-2/results.json.

One current1440 admin DEV screenshot was actually viewed; an external Next badge is visible and disqualifies it as production proof. Edge production screenshot03 was actually viewed and clearly shows the still-unselected import field; three saved Edge observations are not three passed journeys. The separate UI9 IAB image-review addendum preserves lagging45/48 images without treating them as final-state proof. C6 upload remains blocked by disabled extension local-file permission; no hidden upload substitute. Source QA19actual strips and earlier fullC5 all65actual strips retain their earlier precise scope. Owner fidelity, physical Apple/iOS and physical browser UI200% remain unaccepted/untested.

## Earlier C5 full visual chain (final-ui-7)

The earlier `final-ui-7-visual-candidate` completed33 cases in six groups with0 failures, skips or flakes. All50 active PNG paths were compared against the Task12 starting baseline in65 side-by-side strips. Every strip is backed by an actual image view or exact image-byte reuse of a registered prior view; no generated image is assumed viewed. The source and all PNG hashes are bound in `infra/ui/.runtime/t10/visual-candidate.json` and `visual-actual-review.json`. Eleven historical PNGs retain their original bytes and are excluded from runtime coverage.

| Group | Cases | Active PNGs | Reviewed strips |
| --- | ---: | ---: | ---: |
| Shared/core |16|16|20|
| Navigation |1|4|4|
| Recruitment |2|8|9|
| Achievement review |1|5|5|
| Talent |4|14|23|
| Mentor |9|3|4|

This refresh corrects presentation against the approved R5-inclusive source and removes capture artifacts from external shell bars/development tooling. Stable fields, original timestamp masks and0.01 tolerance remain. The official Next error-overlay guard must pass before tooling is excluded. Full-shell pictures retain all real product navigation; owned-content pictures exclude only external decoration. Newly captured long talent forms expose the original proof instructions and add-link controls previously concealed in older images.

The refresh intentionally writes all50 active captures once because changed-only updates can retain small old artifacts under the comparison tolerance. Actual image review and all33 fresh no-update cases passed. Source904 and all61 PNG bytes match the candidate exactly; local C5 receipt is `infra/ui/.runtime/t10/final-ui-7-c5-accepted.json`. This is local visual acceptance only. Natural production viewport/actions remain a separate C6 requirement. The Task12 starting baseline already includes Tasks1–11; the earlier T1/T2 original-image walkthrough below provides the preceding image chain. Local visual proof is not remote CI, hardware validation or owner acceptance. No commit/push/merge.

Earlier walkthroughs below are historical and do not override the current status.

# Shared-foundation visual walkthrough

2026-10-16; T1/T2 combined source, serial implementation. This is an actual
old/new image walkthrough, not approval inferred from snapshot regeneration.
All50 active candidates were viewed in side-by-side overview sheets; tall
current gallery/recruitment/talent pages also received top/bottom detail views.
No new clipping or missing necessary action was observed. Eleven unused legacy
core images are retained unchanged and are excluded from runtime acceptance.

Candidate run: `infra/ui/.runtime/foundation/t2/update-20261016T061842/`.
Source binding: its `source.json`; PNG binding: `snapshots.json` and phase
`candidate.json`. Old originals: phase `old/`, checked against T0 manifest
`baseline/source-sha256-after-test-wait.json`. Full old/new SHA256 and dimensions
are in each `qa/<group>/index.json`; this document's generation validated every
entry against candidate and current PNG bytes. The50 active paths were extracted
from actual regeneration logs and deduplicated, not guessed from filenames.

No new masks, tolerance changes or meaningful-content suppression were added.
Resized/cropped QA sheets supplement original PNGs; they are not pixel baselines.
Fresh complete standard/no-skip and same-source six-group no-update comparison
remain separate gates; see `ui-migration-verification.md` for current status.

## Interpretation and limits

Warm paper/light rail, Song-style titles,14px form text,4/6/8px corners and
30px visible action frames with44px targets follow the approved design.
Admin action rows become taller to preserve touch targets. Feature-specific
heading/layout work remains due in later page-family tasks; this record does
not claim completion of T3–T10. Login heading wraps within its narrow card
without clipping; shell/brand composition remains a later task.

Stored PNGs predate some existing R5 content: operator mentor link, profile
talent link and project mentor section can appear in current candidates although
absent from old images. Task fixture count also differs (old4/current5). These
are explicitly not attributed to styling: feature/API/backend source is
unchanged; functional gates and the fresh same-source comparison supply the
separate evidence. Existing sticky mobile navigation appears within long
full-page shots in both versions. Font specimens verify Windows/Linux;
macOS/iOS and physical browser UI200% zoom remain untested (documented
720CSSpx/DPR2 layout-equivalent checks are not physical UI zoom).

## Reviewed groups

### core

Viewed overview01–09 (27 inventory entries) and current dev-gallery-linux top/bottom detail strips. All16 active candidates reviewed.11 legacy project-suffixed images remain identical and are excluded from runtime acceptance. Historical gallery detail strips are not needed for current acceptance.

Warm light rail/paper, serif display, compact frames and4/6/8corners match the foundation. Admin account table grows vertically because each action keeps44px targets; all rows/filters/actions remain. Login heading wraps naturally in narrow card, with complete heading/actions. Form fields14px slightly shorten pages. Gallery growth is the explicitly added real shared-fixture matrix, separately inspected at390/1440. No new clipping/missing action observed. Claim/task-detail feature-specific headings retain their existing hierarchy; their page-family migration is futureT4.

Old stored product snapshots are not guaranteed to represent all current R5 data: e.g. current tasks has5seeded entries versus old4. Snapshot generation is not proof that these content deltas are CSS changes; source diff, full business battery and final same-source no-update run must support them.

### mentor

Viewed overview01; all3active pairs. Confirmation includes existing candidate fields, per-channel choices, authorization descriptions and submit/reload controls; operations form retains all fields and actions; public mobile contact trigger/read QQ remains. Fields and titles follow foundation without new clipping; confirmation/candidate/version semantics are unchanged. No new masking or tolerance was introduced.

### navigation

Viewed overview01–02; all4active pairs. Landing resource links and empty groups remain; mobile full menu, bottom navigation, profile logout and confirmation actions remain visible. Profile current talent link predates this source diff although absent from stored oldPNG. No shell logic changed; full shell migration is futureT3.

### recruitment

Viewed overview01–03 and owner-form top/bottom detail strips; all8active pairs. Authorized-contact trigger, unavailable/closed/empty states, confirmation content and both actions remain.14pxform labels/inputs and compact frames follow foundation; no content clipped in examined screens. Desktop project now displays existing R5 mentor section missing from historicalPNG; no project source change in foundation diff.

### review

Viewed both overview01–02; all5active old/new pairs. Owner proof workspace and public approved/pending versions keep content, private-proof section, downloads, withdrawal and refresh actions. Changed typography/14pxfields/compactframes match foundation; no new clipping. Current operator page has mentor workflow link absent from historical PNG; product feature sources are unchanged from R5, not a new UI feature.

### talents

Viewed overview01–05 plus all6 top/bottom detail strips (long public detail, long mobile form, owner desktop form). All14active candidates reviewed. Long unspaced name/link and Chinese copy wrap without horizontal clipping; fields/counters/help remain; selected material marker, download action, contact/read states and public confirmation remain. Checkbox tag rows reflow more densely with14pxlabels; no tags lost. Form pages shorten with14pxfields, controls retain compact frames. Existing sticky header/footer appear within full-page shots in both old/new captures; shell positioning logic is unchanged, with further shell work dueT3. Existing visual consent capture is a scrolled dialog region in both old/new and does not by itself prove end-of-dialog interaction; business/keyboard suites cover actions separately. No new clipping/missing actions found.

## Image inventory

All paths below are relative to `frontend/e2e/`. Full source/archive paths and
hashes are in the manifests above. `Reviewed` means an actual active old/new
pair was viewed. `Historical` means unchanged bytes only, no runtime claim.

| Group/file | Old size | New size | Disposition |
| --- | --- | --- | --- |
| `visual-regression.spec.ts-snapshots/admin-innovation-operations-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `visual-regression.spec.ts-snapshots/admin-owner-qualifications-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `visual-regression.spec.ts-snapshots/admin-users-chromium-linux.png` | 1440×1356 | 1440×1356 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/admin-users-linux.png` | 1440×1378 | 1440×1622 | Reviewed |
| `visual-regression.spec.ts-snapshots/auth-login-chromium-linux.png` | 1440×900 | 1440×900 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/auth-login-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `visual-regression.spec.ts-snapshots/dev-gallery-chromium-linux.png` | 1440×6226 | 1440×6226 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/dev-gallery-linux.png` | 1440×6226 | 1440×7627 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-achievement-draft-form-linux.png` | 1440×1200 | 1440×1156 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-claim-chromium-linux.png` | 1440×928 | 1440×928 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/student-claim-linux.png` | 1440×928 | 1440×926 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-dashboard-chromium-linux.png` | 1440×1105 | 1440×1105 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/student-dashboard-linux.png` | 1440×1105 | 1440×1111 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-notifications-chromium-linux.png` | 1440×900 | 1440×900 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/student-notifications-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-owner-profile-form-linux.png` | 1440×1128 | 1440×1127 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-project-draft-form-linux.png` | 1440×1201 | 1440×1160 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-rankings-chromium-linux.png` | 1440×900 | 1440×900 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/student-rankings-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-rewards-chromium-linux.png` | 1440×900 | 1440×900 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/student-rewards-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-task-detail-chromium-linux.png` | 1440×1218 | 1440×1218 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/student-task-detail-linux.png` | 1440×1218 | 1440×1216 | Reviewed |
| `visual-regression.spec.ts-snapshots/student-tasks-chromium-linux.png` | 1440×900 | 1440×900 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/student-tasks-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `visual-regression.spec.ts-snapshots/teacher-reviews-chromium-linux.png` | 1440×900 | 1440×900 | Historical; unchanged |
| `visual-regression.spec.ts-snapshots/teacher-reviews-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `innovation-mentors.spec.ts-snapshots/mentor-confirmation-linux.png` | 864×1412 | 864×1384 | Reviewed |
| `innovation-mentors.spec.ts-snapshots/mentor-operations-form-linux.png` | 896×1746 | 896×1661 | Reviewed |
| `innovation-mentors.spec.ts-snapshots/mentor-public-mobile-linux.png` | 366×658 | 366×647 | Reviewed |
| `innovation-navigation-visual.spec.ts-snapshots/innovation-campus-landing-linux.png` | 1440×941 | 1440×947 | Reviewed |
| `innovation-navigation-visual.spec.ts-snapshots/innovation-logout-confirmation-linux.png` | 390×844 | 390×844 | Reviewed |
| `innovation-navigation-visual.spec.ts-snapshots/innovation-mobile-full-menu-linux.png` | 390×1006 | 390×1003 | Reviewed |
| `innovation-navigation-visual.spec.ts-snapshots/innovation-profile-bottom-logout-linux.png` | 390×844 | 390×844 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-authorized-contact-linux.png` | 366×257 | 366×255 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-closed-linux.png` | 390×844 | 390×844 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-consent-linux.png` | 358×800 | 358×800 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-detail-linux.png` | 390×1154 | 390×1146 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-empty-linux.png` | 390×848 | 390×844 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-mobile-unavailable-linux.png` | 390×844 | 390×844 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-owner-form-linux.png` | 992×2416 | 992×2306 | Reviewed |
| `innovation-recruitment-visual.spec.ts-snapshots/recruitment-project-detail-linux.png` | 1440×1009 | 1440×1015 | Reviewed |
| `innovation-review-visual.spec.ts-snapshots/achievement-campus-empty-list-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `innovation-review-visual.spec.ts-snapshots/achievement-operator-empty-queue-linux.png` | 1440×900 | 1440×900 | Reviewed |
| `innovation-review-visual.spec.ts-snapshots/achievement-owner-proof-workspace-linux.png` | 1440×1728 | 1440×1677 | Reviewed |
| `innovation-review-visual.spec.ts-snapshots/achievement-update-approved-linux.png` | 992×561 | 992×559 | Reviewed |
| `innovation-review-visual.spec.ts-snapshots/achievement-update-pending-linux.png` | 992×504 | 992×498 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-contacts-mobile-linux.png` | 366×237 | 366×236 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-detail-mobile-linux.png` | 390×1205 | 390×1197 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-empty-mobile-linux.png` | 390×1282 | 390×1221 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-error-mobile-linux.png` | 390×844 | 390×844 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-list-desktop-linux.png` | 1440×956 | 1440×958 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-list-mobile-linux.png` | 390×1322 | 390×1261 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-loading-mobile-linux.png` | 390×844 | 390×844 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-long-detail-mobile-linux.png` | 390×2870 | 390×2895 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-long-form-mobile-linux.png` | 366×3973 | 366×3814 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-materials-detail-mobile-linux.png` | 390×1306 | 390×1299 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-materials-list-desktop-linux.png` | 1440×986 | 1440×989 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-owner-desktop-linux.png` | 896×3101 | 896×3000 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-preview-mobile-linux.png` | 358×812 | 358×812 | Reviewed |
| `innovation-talents-visual.spec.ts-snapshots/talent-unavailable-mobile-linux.png` | 390×844 | 390×844 | Reviewed |


## UI9 administrator source-context supplement — 2026-10-19

The immutable earlier C5 six-group comparison remains33PASS for its exact source. UI9 changes only administrator CSS plus two existing E2E assertion files;15 affected administrator/operations/qualification cases pass at320/390/640/800/1440 where applicable. Approved computed sources, not image guessing, determine context typography, table/phone density, responsive columns, existing caps and qualification pairs.

Initial current-core comparison is preserved as15PASS/1FAIL: only admin-users differs,27076pixels and2px height. Exact one-file candidate update passes1, then fresh no-update core comparison passes16/0skip/flaky. Other60PNG including11historical paths retain prior bytes. No tolerance, mask, timeout or retry relaxation. See `infra/ui/.runtime/t10/admin-users-ui9-candidate-2/results.json` and `admin-users-ui9-baseline-review/review.json`. The before/after pair was actually viewed: typography/sourceheader layout only; stable fixture text/rows/actions unchanged; existing time/UUID masks unchanged. The first candidate command matched no tests and changed no baseline; its failure is retained separately.

Fresh source QA generates40approved/current pairs/63strips;19 key strips actually viewed and registered at `final-ui-9-live-admin-source-qa/actually-viewed.json`. These AUTO development captures may contain external Next tooling/full-page shell artifacts and are distinct from actual production model-driven C6 actions. Generated counts do not imply every strip was viewed. UI9 current frontend/build binding remains pending until its explicit receipt exists.

### UI13 场景对账

人工对照宽度390/1440；自动布局边界另覆盖320/800。每项的历史观察、真实数据差异和当前门禁绑定均在ledger内保留。

| 场景 | 实际入口 | 已确认样张 | 本轮修复项 |
| --- | --- | --- | --- |
| r5-mentors | `/innovation/mentors` | `r5-completion-round-1/mentors.html` | VM001, VM002, VM006 |
| r5-mentor | `/innovation/mentors/[id]` | `r5-completion-round-1/mentor.html` | VM003, VM006 |
| r5-mentor-me | `/innovation/mentors/me` | `r5-completion-round-1/mentor-me.html` | VM015 |
| r5-mentor-login | `/mentor/login` | `r5-completion-round-1/mentor-login.html` | 已对照，无新增修复 |
| r5-mentor-operations | `/innovation/operations/mentors，内联录入` | `r5-completion-round-1/mentor-operations.html` | VM004 |
| r5-mentor-maintain | `/innovation/operations/mentors/[id]` | `r5-completion-round-1/mentor-maintain.html` | VM005 |
| r5-project-mentor-editor | `/profile/project-drafts，内联编辑/挂名` | `r5-completion-round-1/project-mentor-editor.html` | 已对照，无新增修复 |
| r5-project-mentor | `/innovation/projects/[id]` | `r5-completion-round-1/project-mentor.html` | VM010 |
| r5-innovation-home | `/innovation` | `r5-completion-round-1/innovation-home.html` | VM007 |
| r5-recruitments | `/innovation/recruitments` | `r5-completion-round-1/recruitments.html` | VM008, VM016 |
| r5-auth-login | `/login` | `r5-completion-round-1/auth-login.html` | 已对照，无新增修复 |
| r5-auth-register | `/register` | `r5-completion-round-1/auth-register.html` | 已对照，无新增修复 |
| r5-auth-forgot | `/forgot-password，两步` | `r5-completion-round-1/auth-forgot.html` | 已对照，无新增修复 |
| r5-auth-logout | `/logout` | `r5-completion-round-1/auth-logout.html` | 已对照，无新增修复 |
| r5-staff-login | `/staff/login` | `r5-completion-round-1/staff-login.html` | 已对照，无新增修复 |
| r5-staff-invite | `/staff/invite/[token]` | `r5-completion-round-1/staff-invite.html` | 已对照，无新增修复 |
| r5-staff-security | `/staff/invite/[token] 的 TOTP/恢复代码步骤` | `r5-completion-round-1/staff-security.html` | VM033 |
| r5-account | `/profile?tab=info（按实际profileTabs修正静态facts的personal）` | `r5-completion-round-1/account.html` | 已对照，无新增修复 |
| home | `/` | `innovation-round-1/home.html` | VM017 |
| tasks | `/tasks` | `innovation-round-1/tasks.html` | 已对照，无新增修复 |
| task | `/tasks/[taskId]` | `innovation-round-1/task.html` | VM018 |
| submission | `/claims/[claimId]，领取后提交` | `innovation-round-1/task-claim.html` | VM035, VM039 |
| revision | `/claims/[claimId]，退回修改` | `innovation-round-1/claim.html` | 已对照，无新增修复 |
| rewards | `/rewards` | `innovation-round-1/rewards.html` | VM019 |
| rankings | `/rankings` | `innovation-round-1/rankings.html` | VM020 |
| notifications | `/notifications` | `innovation-round-1/notifications.html` | 已对照，无新增修复 |
| profile | `/profile（growth tab）` | `innovation-round-1/profile.html` | VM021 |
| projects | `/innovation/projects` | `innovation-round-1/projects.html` | VM009 |
| project | `/innovation/projects/[id]，复用含R5样张` | `r5-completion-round-1/project-mentor.html` | VM010 |
| role | `/innovation/recruitments/[id]` | `innovation-round-1/role.html` | 已对照，无新增修复 |
| achievements | `/innovation/achievements` | `innovation-round-1/achievements.html` | VM011 |
| achievement | `/innovation/achievements/[achievementId]` | `innovation-round-1/achievement.html` | VM012 |
| talents | `/innovation/talents` | `innovation-round-1/talents.html` | VM013 |
| talent | `/innovation/talents/[id]` | `innovation-round-1/talent.html` | VM014 |
| my-projects | `/profile/project-drafts，列表` | `innovation-round-1/my-projects.html` | VM025 |
| project-editor | `/profile/project-drafts，含R5内联编辑` | `r5-completion-round-1/project-mentor-editor.html` | VM024 |
| my-achievements | `/profile/project-drafts/[projectId]/achievements，列表` | `innovation-round-1/my-achievements.html` | 已对照，无新增修复 |
| achievement-editor | `/profile/project-drafts/[projectId]/achievements，内联编辑` | `innovation-round-1/achievement-editor.html` | VM022 |
| talent-editor | `/profile/talent-profile` | `innovation-round-1/talent-editor.html` | VM023 |
| owner | `/profile/owner-profile` | `innovation-round-1/owner.html` | 已对照，无新增修复 |
| my-recruitments | `/profile/project-drafts/[projectId]/recruitments，列表` | `innovation-round-1/my-recruitments.html` | 已对照，无新增修复 |
| recruitment-editor | `/profile/project-drafts/[projectId]/recruitments，内联编辑` | `innovation-round-1/editor.html` | 已对照，无新增修复 |
| teacher-reviews | `/teacher/reviews，队列` | `staff-round-1/teacher-reviews.html` | VM030 |
| teacher-review-detail | `/teacher/reviews，选中详情` | `staff-round-1/teacher-reviews.html?view=detail` | VM031 |
| teacher-tasks | `/teacher/tasks` | `staff-round-1/teacher-tasks.html` | VM032 |
| teacher-task | `/teacher/tasks/[taskId]` | `staff-round-1/teacher-task.html` | 已对照，无新增修复 |
| teacher-task-editor | `/teacher/tasks 新建Dialog / [taskId]编辑Dialog` | `staff-round-1/teacher-task-editor.html` | 已对照，无新增修复 |
| teacher-community | `/teacher/tasks/[taskId] 的社区治理` | `staff-round-1/teacher-community.html` | VM034 |
| operations-reviews | `/innovation/reviews，核实队列` | `staff-round-1/operations-reviews.html` | VM036 |
| operations-review | `/innovation/reviews，领取后详情` | `staff-round-1/operations-review.html` | 已对照，无新增修复 |
| admin-users | `/admin/users` | `staff-round-1/admin-users.html` | 已对照，无新增修复 |
| admin-grants | `/admin/innovation-operations` | `staff-round-1/admin-grants.html` | 已对照，无新增修复 |
| admin-grant-detail | `/admin/innovation-operations，显式读取详情` | `staff-round-1/admin-grants.html` | 已对照，无新增修复 |
| admin-qualifications | `/admin/owner-qualifications` | `staff-round-1/admin-qualifications.html` | 已对照，无新增修复 |
| admin-qualification-detail | `/admin/owner-qualifications，显式读取申请快照` | `staff-round-1/admin-qualifications.html` | 已对照，无新增修复 |
| admin-whitelist | `/admin/whitelist` | `staff-round-1/admin-whitelist.html` | 已对照，无新增修复 |
| admin-whitelist-preview | `/admin/whitelist，导入预览` | `staff-round-1/admin-whitelist.html` | VM037 |
| admin-rewards | `/admin/rewards` | `staff-round-1/admin-rewards.html` | 已对照，无新增修复 |
| admin-reward-editor | `/admin/rewards，编辑Dialog` | `staff-round-1/admin-rewards.html` | 已对照，无新增修复 |
| admin-redemptions | `/admin/redemptions` | `staff-round-1/admin-redemptions.html` | VM026 |
| admin-audit | `/admin/audit` | `staff-round-1/admin-audit.html` | VM027, VM038 |
| admin-system | `/admin/system` | `staff-round-1/admin-system.html` | VM028 |
| active-claim | `/claims/[claimId]，进行中` | `innovation-round-1/active-claim.html` | 已对照，无新增修复 |
| review-claim | `/claims/[claimId]，待审核` | `innovation-round-1/review-claim.html?state=review` | 已对照，无新增修复 |
