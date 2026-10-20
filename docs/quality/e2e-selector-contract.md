# E2E Selector Contract — Plan 11 visual refresh

> Status: **normative for the visual refresh workstream** (plan Task 1b).
>
> Inventory of every Plan 10 Playwright locator/assertion on screens the
> refresh touches, classified per the plan's rule:
>
> - **A — behavior/accessibility contract**: preserved AS-IS by the
>   visual work. These pin roles, accessible names, labels, dialog
>   semantics, and asserted business copy. Changing one is a product
>   change, not a restyle.
> - **B — pure structural locator**: may move with the new DOM only when
>   replaced by an **equally strong** locator/assertion in the same
>   spec. Never delete or weaken the underlying assertion.
>
> Reviewers diff visual PRs against this table. When a B locator moves,
> the PR must show the equal-strength replacement next to the DOM
> change. The zero-skip Playwright run gates every surface batch
> (plan Task 1b cadence).

Sources: `frontend/e2e/*.spec.ts` (auth, community, notifications,
rewards-ranking, staff-auth, staff-totp-race, submission, task-claim,
teacher, admin, visual-capture) — the original Task 1b inventory. Specs
added since are not re-listed here; each lands its own entries per the
AGENTS.md test-artifacts manifest, and the A/B tables are the
authoritative record.

## A. Behavior / accessibility contracts

### Form labels (`getByLabel`)

| Label | Surface |
|---|---|
| 账号 / 验证码 | the unified login's code form (the band rides the PLACEHOLDER: 请输入手机号或邮箱 — the 2026-10-20 refinement) |
| 账号 / 密码 | the unified login's password expansion (placeholder 请输入手机号、邮箱、学号 — three-state incl 学号) |
| 动态验证码 | the unified login's TOTP leg (layer 2a, testid `unified-login-totp-leg`) |
| 设置密码 / 确认密码 / 设置密码并继续 | register, staff invite activation |
| 昵称 / 手机号 | register, profile binding |
| 受邀人邮箱 / 角色 / 创建邀请 / 复制邀请链接 | admin staff invitations (`/admin/invitations`; the one-time issuance surface) |
| 正在前往工作台… / 前往员工登录 | the staff-on-student-route redirect placeholder + its /me-failure exit (staff-root-redirect.spec pins the frame sequence; copy is the locator) |
| 页面不存在 / 返回首页 | the custom 404 (not-found.spec + the not-found SHOTS face) |
| 平台代码（创建后不可改） / 显示名 / 排序值 / 新建平台 / 创建平台 / 编辑 / 保存修改 | admin platform registry (`/admin/platforms`; platform-registry.spec pins the CRUD chain and the client-refusal zero-POST) |
| 任务评论 / 发布评论 / 发布回复 / 回复 | task-detail comment thread |
| 通知收件箱 / 标为已读 | notifications |
| 积分余额 (`getByLabel` + `[aria-label='积分余额']`) | student shell points readout |
| 我的附近 | rankings around-me |
| 操作原因 / 基础奖励积分 / 任务评分 | teacher task form, admin/moderation dialogs |
| 选择星级 (radiogroup) / 发布身份 (radiogroup) | review dialog, comment compose |
| 项目名称 / 项目简介 / 项目方向 / 项目阶段 / 团队现状 | private innovation draft editor |

### Roles + accessible names

Buttons: 登录 · 注册 · 领取任务 · 开始上传 · 上传重试相关 · 兑换 · 确认兑换 ·
发布评论 · 发布回复 · 回复 · 赞 · 表情 🔥 · 举报 · 提交举报 · 标为已读 ·
完成 · 取消 · 创建草稿 · 保存修改 · 预览导入 · 重新上传文件 · 通过并发放奖励 ·
通过并扣减积分 · 退回修改 · 确认停用 · 确认绑定 · 确认揭示身份 ·
一键继续 (the unified login's conditional fast-login banner — layer 0,
owner feedback ③ 2026-10-17: the remembered-device probe's one-click leg,
now on /auth/challenge/remembered + the empty-body verify) ·
获取验证码 (the unified login's FIRST send — the code row with its
重新发送 cooldown appears only after it, layer 2's condition) ·
使用密码登录 / 使用验证码登录 (the unified login's weak link — the
password expansion's disclosure control, aria-expanded) ·
完成登录 (the unified login's TOTP leg, layer 2a) ·
发送验证码 / 绑定手机号 / 更换手机号 (the staff phone-binding flow,
PhoneBindSection) ·
代重置密码 / 踢出全部会话 / 提升为管理员 / 降级为教师 / 批量停用 / 批量恢复 /
确认执行 / 撤销 / 确认撤销 / 重发 (Wave 2a's admin power-pack: the user-detail
actions, the batch verbs, and the invitation lifecycle panel)

Checkboxes: 30 天内免登录 (the code form, the 2026-10-20 owner copy) · 记住此设备 30 天 — the password/totp seats

Buttons (batch 2): 切换到 <mask> / 从本机移除 <mask> (the recent-logins
cards' pick and device-local removal verbs — the aria-labels carry the
G11 mask, never the full address) (the
code form's copy is audience-neutral; the password expansion's notes the
totp audience; the TOTP leg is where the meaning LIVES — the 2026-10-15
terminal ruling: the flag is sent whenever checked and the backend
routes it by audience, STUDENT verify honoring it, staff arms ignoring
it, the ADMIN totp leg issuing the cookie).

Links: 未读 · 热门 · 最新 · 全部 · 总榜 · 今日榜 · 本月榜 · 去登录 ·
前往员工登录 · 返回教师工作台 · 返回任务管理

Headings (`getByRole("heading")`): 登录 CampusQuest · 通知 · 确认兑换 ·
兑换申请已提交 · 审核提交 · 举报已提交

List: 恢复代码 (staff TOTP recovery codes)

### Dialog semantics (`aria-labelledby`)

Dialog surfaces whose title ids the specs address directly (native
`<dialog>` before plan-14; the Radix-backed `components/ui/dialog`
primitive since — role=dialog + labelledby preserved byte-identical):
`create-task-title` · `edit-task-title` · `import` preview surfaces ·
`lifecycle-confirm-title` · `redemption-approve-title` ·
`redemption-reject-title` · `redemption-fulfill-title` ·
`reveal-identity-title` · `setting-confirm-title` · `account-status-title`.

The refresh may restyle dialogs freely but must keep: the `dialog`
role (native element or equivalent), the labelledby wiring, and the
focus-trap/Escape behavior the app already implements.

### Asserted business copy (`getByText`, selection)

Error/validation copy: 退回说明不能为空 · 判无效原因不能为空 · 追溯原因必填
（将记入审计日志） · 操作原因必填（将记入审计日志） · 拒绝原因必填（将通过
通知送达申请者） · 评论内容不能为空 · 请选择举报类别 · 长度不合法 · 全角数字 ·
基础奖励积分必须大于 0 · 提交未通过校验，请修正 · 文件内重复（的 platform +
keyword 组合） · 第 2 行

Status/confirmation copy: 已提交，等待老师审核 · 重试完成提交 · 任务已完成，
积分已发放。 · 注册成功，请使用学号登录。 (RETIRED with ④ going live — #100
made the register envelope the login, nothing routes to /login after
registration; removed in the post-merge cleanup) · 继续以 … 登录 (the
fast-login banner's masked-phone offer, owner feedback ③) · 该设备尚未记住
或已过期，请使用下方短信验证码登录。 (the banner's stale-click honest
fallback) · 手机号已绑定。 (the staff phone-binding success note, item ①) ·
恢复代码只显示这一次 · 已复制 · 动态口令绑定完成，员工账号已激活。 ·
已成功导入 1 个任务单元 · 已发布 · 草稿 · 已批准 · 待发放 · 已发放 · 已停用 ·
启用 · 正常 · 累计获得 · 可花费/当前可花费/消耗积分 · 匿名用户 · 暂无通知 ·
暂无附近排名 · 判无效会取消锁定的奖励与积分，学生需重新提交。审计记录不可删除。

Access-denied copy (RBAC proofs): 教师工作台仅对教师与管理员开放 ·
管理后台仅对管理员开放，当前账号是教师账号 · 任务不存在，或您不是该任务的
所有者 / 协作者，无法访问。

These strings are asserted business semantics (they ARE the privacy /
RBAC / state-machine proofs). Copy may only change with an explicit,
owner-approved product decision — never "to fit the new DOM".

### data-testid

`totp-secret` · `totp-uri` (staff TOTP setup).

## B. Structural locators (equal-strength replacement allowed)

| Locator | Surface | Notes |
|---|---|---|
| `.page-head` | page header anchor (specs + visual-capture) | capture spec already falls back to `main`; if renamed, update all spec uses to the equivalent header locator |
| `.cq-divided-sections` and its `::before` | shared UI gallery; `ui-migration-layout.spec.ts` | presentation-only container; tests assert actual column positions, unequal heights, centered full-height divider and single-column absence at320/390/639/640/800/1440; any structural replacement must preserve those geometry checks |
| `.cq-status-cell` | shared dense tables | apply explicitly to the matching status header/cell; actual computed alignment is checked via table/cell roles, other columns remain uncentered |
| `.auth-card` | approved authentication page composition; `auth-reference-layout.spec.ts` | form card is separate from the heading and entry navigation;390/1440 geometry derives from approved auth-login.html, not a self-generated image. Replacements must retain same banner/heading/card/entry roles and reference alignment |
| list `找回密码步骤` / `账号激活步骤`, `aria-current="step"` | authentication recovery and invitation | exactly two descriptive steps; current item follows the existing form state, not a demo transition; the pending invitation token remains absent from UI text |
| brand link `华师令`; context `校内空间 / 个人信息` | authenticated shells | one visible brand across the three navigation bands; desktop context reads actual path/query below its own Suspense boundary; existing nav, profile and permission contracts remain |
| `.task-card` | tasks list | review-comment seed hook; SHOTS `student-tasks` preparation waits for the first card to be visible, then awaits `finished` for finite animations before sampling |
| `.claim-panel` · `.upload-panel` | task detail claim/upload | submission flow anchors |
| `.deadline-line` | task/claim deadline row | SHOTS `student-claim` preparation first waits for the exact named region `分配给你的任务单元` to be visible, so capture/axe observes loaded claim content |
| `.validation-report` · `.report-errors` | submission validation report | |
| `.comment` · `.comment-list` · `.comment-author` · `.comment-depth-3` · `.reaction-count` | community thread | depth-3 asserts nesting |
| `.board-rows` · `.board-row` · `.board-rank` · `.board-me-tag` · `.board-honor` | rankings | me-tag asserts around-me anchoring; board-honor is the honor chip (renamed from `.honor-chip` in plan-13 with no spec uses) |
| `.reward-card` · `.balance-quiet` · `.reward-cta-note` | rewards list | balance-quiet is the wallet's 累计获得 value (re-anchored from a parent-hop locator in plan-13); reward-cta-note is the spend-state note under the CTA |
| `.notif-item` · `.notif-item[data-read='false']` · `.notif-title` | notifications | data-read asserts unread state |
| `.review-item` · `.review-pair` · `.review-tier` | teacher review queue; admin redemption queue | pair/tier assert VALIDATED tier pairing; the admin queue row is located by the run-derived item name (端到端奖励卡 + RUN[:6]) — NEVER by queue position (.first() would pick a residue world's oldest request) |
| `.import-preview` · `.moderation-key` · `.mono` | teacher import / moderation | |
| `dialog.dialog` | generic dialog scoping | retired at C3; the `getByRole("dialog")` replacement landed |
| `#submission-file` · `#assignment-import-file` | file inputs | keep as file-upload ids or replace with `getByLabel` of equal strength |
| `#task-schema` · `#task-schema-version` · `input[name='assignment_id']` | task form fields | |
| `[data-assignments-list]` · `[data-user-id]` | teacher assignments list, admin user rows | |
| `.ie-draft-list` · `.ie-draft-row` · `.ie-draft-form` | private innovation drafts | list/form boundaries; functional tests prefer named regions and labels |
| region `本人人才档案编辑器` · status `人才档案操作结果` · region `最新人才版本` | private talent profile | exact labeled fields; 保存人才草稿 / 预览开启校内展示 / 预览更新公开档案; original request retry preserves later edits; conflict resolution is explicit |
| group `作品与证明文件（选填）` · status `人才文件操作结果` · `#talent-upload` | private checked talent uploads | functional specs use label 选择作品或证明文件 and checkbox 公开 {name}; cancellation preserves original File and request; removal/revocation requires confirmation; 清除已移除的文件选择 only clears selections absent from the authoritative list and preserves text |
| region `校内人才库` · form `人才筛选` · nav `人才分页` · article `校内人才详情` | campus talent directory | URL carries keyword, all-match tags, cooperation state and offset; 返回人才列表 keeps filters; no private identity or contact values in ordinary browsing |
| region `人才授权联系` · status `人才联系读取结果` · region `公开作品文件` | deliberate sensitive talent reads | 查看授权联系方式 / 下载 {name} trigger current-version authorized requests; live status never reads contact values aloud; unavailable states contain neutral messages |
| region `负责人资料编辑器` · region `最新负责人资料` | private owner profile | fields use exact labels 姓名/学号/专业/年级; current account only; owner-profile API is not opened to ADMIN |
| status `负责人资料保存状态` | private owner profile save announcement | exact role/name scopes save assertions now that the page also contains qualification status; preserve the save success/error behavior |
| region `负责人资格` · status `负责人资格状态` · status `资格操作结果` | student owner qualification | qualification state and mutation result are independently named; no user ID, approver identity or another student's PII in the student DOM |
| region `负责人资格申请队列` · table `负责人资格申请列表` · nav `资格申请分页` | ADMIN owner qualification queue | paginated pending queue contains account references/state/time only; snapshot PII is not fetched or rendered before explicit 查看申请 |
| region `负责人资格申请详情` · status `申请开通状态` · status `管理员资格操作结果` | ADMIN application snapshot | four submitted snapshot fields are available only through an ADMIN-authorized, audited detail read; never infer this access from operations_enabled |
| dialog `开通负责人资格` · title id `owner-qualification-confirm-title` | ADMIN qualification confirmation | use getByRole("dialog", { name: "开通负责人资格" }); keep title wiring, focus trap, Escape and explicit 确认开通/取消 actions |
| region `成果草稿列表` · region `成果草稿编辑器` · region `最新已保存成果` · region `私有成果预览` | private project achievements | exact labels 成果名称/作品与阶段成果说明/作品链接/立项或获奖说明; no internal IDs in visible copy |

| `.app-shell[data-shell]` | student shell state marker | shell-refresh spec pins the chrome verdict per state (loading/workspace/anonymous/error/gate); the optimistic frame reuses the existing `.app-sidebar`/`.app-nav`/`.app-bottomnav` structural locators |
| `.task-card[data-depleted='true']` | depleted square card marker | same verdict as the 已被领完 badge (defect #20 / batch ④); the recede treatment assertions (dashed border, dimmed content) key on it |
| `[data-testid='invitation-link']` | admin one-time invitation link box | admin-invitations.spec pins the link text shape (origin + `/staff/invite/<urlsafe-token>`) and follows it to the accept page; CopyButton beside it is label-anchored (A-table) |
| `.meta-deadline` · `.reward-window` | zero-weight mask anchors | visual-suite mask hooks (shot-surfaces): the task card's clock-derived deadline line and the reward card's window line; the classes carry no styles by design |
| `.login-fast-hint` · `.login-fast-stale` | login fast-login banner (owner feedback ③) | the two-state pin's structural zero-element anchor (auth-extension-2: no cookie → count 0); the banner's own text/button assertions are the A-class pair |
| `[data-testid='mobile-login-totp-leg']` | staff mobile-code login's ADMIN second leg (item ①) | mirrors `email-login-totp-leg`; the leg's presence/absence is the TEACHER-vs-ADMIN branch pin |

Private innovation draft behavior contracts (R1 navigation rename): link `我的项目`; regions `项目草稿列表` / `项目草稿编辑器` / `最新已保存版本`; buttons `新建项目草稿` / `保存草稿` / `返回草稿列表` / `编辑项目：{title}` / `读取最新版本（保留当前输入）` / `载入此版本（替换当前输入）`; saved status `草稿已保存，仅自己可见。`; stale-save copy `你的未保存内容已保留`.

Private owner profile contracts (R1 navigation rename): link `负责人资料与资格`; buttons `保存负责人资料` / `读取最新资料（保留当前输入）` / `载入此资料（替换当前输入）`; status name `负责人资料保存状态`, saved copy `资料已保存；保存资料不会自动开通负责人资格。`; conflicts preserve inputs until explicit reconciliation. The student number is allowed in this owner's private form by the 2026-10-09 human-supplied innovation requirements. Scheme A adds the narrow exception that ADMIN may explicitly read a submitted qualification snapshot through its separate audited detail endpoint; the original owner-profile endpoint remains owner-only.

Owner qualification contracts (2026-10-09 confirmed scheme A): student region `负责人资格`; named statuses `负责人资格状态` / `资格操作结果`; buttons `申请负责人资格` / `更新资格申请` / `重新读取资格状态`. Unsaved profile changes are not submitted with an application. PENDING uses the submitted saved-profile snapshot; a newer saved profile can explicitly update it. APPROVED cannot be overwritten by another application and does not approve achievements. Conflict or unknown write outcomes block another mutation until a successful reread; rereading a newer owner profile preserves inputs until explicit loading in `最新负责人资料`.

ADMIN qualification contracts: route `/admin/owner-qualifications`, navigation link `负责人资格`; regions `负责人资格申请队列` / `负责人资格申请详情`; table `负责人资格申请列表`; buttons `刷新申请队列` / `上一页申请` / `下一页申请` / `查看申请` / `开通负责人资格` / `重新读取申请详情`. Dialog `开通负责人资格` carries `确认开通` and `取消`. Cancelling or pressing Escape restores focus to `开通负责人资格`; after success or an unknown outcome disables that action, closing restores focus to `重新读取申请详情`. Busy submission guards closing through onOpenChange. Role/name locators must retain these behavior/accessibility assertions; this document does not claim they have passed a browser run.

Innovation operations contracts: regions `双创运营授权管理` / `当前账号运营授权`; labels `授权对象` / `操作原因`; buttons `授予运营身份` / `撤回运营身份` / `重新读取授权状态`; dialog `撤回双创运营身份` with `确认撤回` and `取消`. These are role/label selectors; no UUID text, CSS ancestry or fixed account nickname is required. Unknown write outcomes and 409 block further mutation until a successful reread.

## Rules for the visual workstream

Achievement-review additions (2026-10-09): A-contract regions `成果核实与证明`, `成果核实待办`, `成果核实快照`, article `校内成果详情`, and `校内已核实成果`; labels `上传证明材料`, `核实备注／退回原因`, checkbox `选择证明 {n}`. Preserve confirmation dialogs `提交首次核实`, `撤回首次核实`, `退回成果修改`, `通过首次核实`, `发布更新`, with exact `确认`/`取消`, Escape and opener focus restoration. Preserve actions `确认上次提交结果（沿用原请求）` and `确认上次决定结果（沿用原请求）`; the functional spec compares actual replay bodies after a real server commit with a lost response. Upload recovery preserves `重试原文件上传与检查` and `放弃本次上传重试`; explicit abandonment clears only the local file/key and never deletes server evidence. B-contract: reuse `.ie-draft-list`, `.ie-draft-row`, `.ie-draft-actions` for owner and queue structure; `.ie-review-prose` preserves literal multiline public content. These classes are presentation hooks, while role/label assertions remain authoritative. The campus shell accepts all active roles; R1 reuses the student shell for ACTIVE students and retains explicit staff workspace return links. Pixel assertions anchor the public region and wait for capability navigation.

Private achievement contracts: project editor link `管理成果草稿`; buttons `新建成果草稿` / `保存成果草稿` / `返回成果列表` / `编辑成果：{title}` / `读取最新版本（保留当前输入）` / `载入此版本（替换当前输入）` / `重试这次新建（不会重复创建）` / `查看私有预览`; status `成果草稿已保存，仅自己可见。`. Unknown create outcomes freeze the original payload and retry key. Unknown edits and conflicts require explicit reconciliation. Preview renders literal text and never fetches work URLs.

1. Class-A entries are frozen. A visual PR that changes one is out of
   scope until the owner rules it a product change.
2. A Class-B move ships in the same commit as the equal-strength spec
   update — never a "tests will be fixed later" state, and never a
   weakened assertion (e.g. replacing `.review-tier` with a loose
   text match that would also pass on the wrong tier).
3. The upload/download, review-decision, redemption, reveal, and
   lifecycle dialogs keep their confirmation-copy assertions even when
   their DOM is rebuilt.
4. New UI primitives that replace a B-class region must expose an
   equally specific hook (test id, class, or aria contract) at the
   same granularity.

R1 navigation/logout contracts (2026-10-10 owner-authorized product change): primary link `创新创业` (/innovation); nav `本人双创管理` with `我的项目` / `负责人资料与资格`; permission-scoped `双创运营工作台` (/innovation/reviews); mobile five destinations plus button/dialog/nav `全部导航`. Three-library region `双创三库` identifies unopened talent/mentor libraries. Following the owner's placement adjustment, students reach the single `退出登录` link in region `退出当前账号` at the bottom of /profile, after either growth or personal-information content; the student banner has no logout link. Staff account areas retain their exit links. All exits lead to the independent confirmation page; heading/region `退出当前账号`, actions `确认退出登录` / `重试退出登录`, alert `退出结果`. Real 503/transport failures remain on /logout; the logout endpoint's exact 401 AUTHENTICATION_REQUIRED verdict means no refresh credential remains. Student proof and operator decision dialogs fall back to the stable result section or original-request retry button when the opener disappeared; no focus restore across auth epochs.
R1 review fixes: 15-second bounded logout failure permits retry without racing a pending refresh; native full-document login respects CQ_BASE_PATH (independent of API mount). Successful original-command retries also focus the stable proof/result section after render, within the same auth epoch.

R1 owner-requested visual simplification: the profile's `退出当前账号` region keeps its accessible name but displays only the `退出登录` link, without a visible heading or explanatory paragraph. Student banner link `我的账户` retains its accessible name, title and /profile destination; its decorative glyph reuses the shared UserIcon line portrait rather than a nickname initial. Sidebar nickname display is unaffected; no selector or API contract changes.

R2 update review contracts (2026-10-10 owner-authorized product change): reuse region `成果核实与证明`, draft button `编辑成果：{title}` and public article `校内成果详情`. Owner actions `提交更新复审` / `撤回更新复审` and operator action `通过更新复审` distinguish the active UPDATE case from first approval. Pending, returned and withdrawn copies explicitly preserve the old approved version; taken-down copies preserve takedown. Public `本版核实` derives from the current revision's approved case; a legacy unreviewed update says `历史更新内容，未逐项复审。`. Original confirmation, retry payload, auth-epoch and focus assertions remain. Two new region screenshots cover update-pending and update-approved states; only runtime `<time>` values are masked on the approved view, with functional tests checking both timestamps.

R3 recruitment contracts (2026-10-11 approved design, 2026-10-12 owner-authorized UX revision): management regions `招募岗位列表` / `招募岗位编辑器` / `最新招募版本`, status `招募操作结果`; actions `新建招募岗位` / `保存招募草稿` / `预览发布招募` / `发布招募更新` / `关闭招募` / `重新开放招募` / `确认继续招募` / `撤销联系授权：{渠道}`. Preserve `重试原请求` with the original payload/request key and explicit `读取最新版本（保留当前输入）` / `载入最新版本`. Confirmation dialogs retain `取消`, Escape/opener focus and success focus on the stable result status; primary buttons now name the action: `确认发布` / `确认关闭` / `确认重新开放` / `确认继续招募` / `确认撤销授权` / `撤销并关闭招募`. The recruitment editor's `项目阶段` is one select; `具体阶段` appears for other stages, with no separate `创意起步` boolean control. Private project drafts retain their existing text `项目阶段` field. Public regions/articles `校内项目列表` / `校内项目详情` / `校内招募岗位` / `校内招募详情` / `项目已核实成果` / `项目正在招募` / `授权联系方式`; `查看联系方式` is the only deliberate contact read trigger. B-contract uses `.ie-recruitment-fields` / `.ie-recruitment-confirm` / `.ie-recruitment-public` for layout only; role/name/label behavior remains authoritative. Filtering is the named GET form `校内浏览筛选`; `仅看正在招募` is present in the project library and absent from the already active-only recruitment list. Local URL parameters and specific pagination names remain.

Recruitment contact correction (2026-10-12): missing channels focuses the 授权微信 checkbox; malformed selected values focus the matching `contact-{channel}` input. Each invalid input has `aria-invalid=true` and its own associated `contact-{channel}-error`; unselected-channel checkbox errors refer to `recruit-contacts-error`.

Recruitment acceptance fixes (2026-10-12): same-tab route recovery returns directly to the unsaved editor without automatic saves; explicit local 返回招募列表 discards only after confirmation when dirty. New/edit headings 新建招募岗位 / 编辑招募岗位 are focusable on entry, and returning restores the create/edit action. A workspace 404 says 项目不存在或不可访问, preserving its neutral privacy meaning and 返回我的项目; temporary errors retain 重试. Idea-only 阶段目标 / 初步方案 are absent outside idea stage, except an invalid preserved field temporarily reappears for correction. Contact fields retain their individual error associations and add channel format hints/input semantics. Persistent status 联系读取结果 announces 联系方式已读取，请查看下方已授权渠道。 without containing contact values. Public beginner false says 不接受零基础. Only normal, open, undated roles show 下次提醒.
# R4.1 人才材料与阅读分组（2026-10-13）

R4.1 卡片反馈追加：label/name `一句话介绍` / `talent-headline` 为保存草稿也必填，提示关联 `talent-headline-hint` / `talent-headline-error`，40字符计数沿用码点契约。校内发现条目使用 `.ie-discovery-list > .ie-draft-row` 白卡，`.ie-talent-headline` 为人才卡片唯一自述摘要；原标题链接、列表详情返回、筛选和完整阅读区域保持。字段为空保存聚焦该输入，旧公开档案显示 `暂未填写一句话介绍`。

| B 契约 | 范围 | 行为 |
| --- | --- | --- |
| label `作品/证明材料筛选` | form `人才筛选` | 原生 select，空值全部、true有材料、false无材料；提交重置offset，详情返回/分页保留URL |
| list `技能标签` | public list/detail and private preview | 每标签独立li，中性样式，长标签换行；不替代编辑器原有checkbox标签 |
| text `含作品/证明材料` | list/detail/preview | 中性附件图形，无认证勾/盾牌；列表使用服务端事实，详情来自可读文件；附本人提供与未核实说明 |
| region `个人与优势` / `合作意向` / `实践经历` | public detail and private preview | 标題和字段定义列表；保持literal换行及长内容可读；本人编辑原字段label/name/错误关联保持 |

## R5 导师资料与单独挂名（2026-10-15）

| B 契约 | 范围 | 保留的行为与验收 |
| --- | --- | --- |
| region `校内导师库` / form `导师筛选` / article `校内导师详情` | 导师发现与详情 | `搜索导师`、`指导方向筛选`、`接受联系筛选` 保留 URL 状态；普通浏览无联系值，手机无横向溢出 |
| region `导师运营列表` / `导师运营编辑器` / `最新导师版本` | 授权运营资料维护 | `录入导师`、`保存导师资料`、具名字段；冲突保留输入，明确选择保留输入或载入服务器内容；未知结果以原请求重试；返回列表先确认未保存输入，请求结果未知时保留重试入口 |
| link `登录校内账号` | 未登录的校内浏览 Shell | 跨标签真实登出后卸载私有编辑器；仍挂载的原页面提供校内登录入口，不显示前账号的输入或待重试请求 |
| region `我的导师资料` / form `导师本人确认` / `修改代维护授权` | 本人授权 | 展示、逐项联系、代维护范围默认不勾选；版本变化重新核对，不能自动接受新资料；`导师操作结果` 不朗读联系值 |
| region `导师授权联系` | 按需敏感读取 | `查看授权联系方式` 按当前公开版本请求；暂停无按钮，联系错误提供刷新；渠道值只在明确读取后展示 |
| dialog `撤回导师展示` | 即时撤回 | `确认撤回展示` 与 `取消`、Escape/触发按钮焦点恢复；请求结果未知可原请求重试；成功聚焦稳定结果容器 |
| status `项目草稿保存状态` | 既有项目草稿编辑器 | 保存、读取及未保存输入的结果提示具名；与新增挂名提示并存时，测试按名称定位，各状态保持独立 |
| region `项目导师挂名` / `导师项目挂名待办` / `项目已同意导师` | 双方独立挂名 | 负责人选择导师；未保存、保存/读取中或保存错误时禁止新邀请；导师查看已保存的私有摘要并同意/拒绝；任一方解除，项目未保存不阻止解除已有挂名；公开项目只读本来可见项目与当前有效关系 |
| nav `导师项目挂名分页` / `项目导师挂名分页`，region `项目挂名操作结果` | 本人待办与项目关系列表 | 每页 20 项，`上一页` / `下一页` 保持当前账号内的 offset，显示当前页及总量；处理后重新读取当前页，原请求及反馈保存在列表外；请求处理中或结果未知时禁止翻页及其他行操作，原 UUID 重试后仍停留当前页 |

R5 的未决命令在当前用户与auth epoch内跨站内导航、同文档Back和项目列表卸载恢复；录入恢复原账号与字段，邀请恢复可读的导师对象，关系恢复offset。成功或明确拒绝清除，跨标签登出/换号同步清除。整页刷新/关闭有未决操作警告，不承诺关闭浏览器后的恢复。

R5 新像素证据使用 `innovation-mentors.spec.ts` 的实际组件，专属导师身份世界 `CQ_E2E_MENTOR_WORLD=1`，开启 `CQ_VISUAL=1 CQ_E2E_FIXED_LABELS=1` 时固定 Noto Sans CJK SC，截图覆盖运营表单、本人确认与手机公开详情。原全站基线默认保持；导师登录/双创首页入口及项目导师区是已批准的功能内容变化，按 `innovation-mentor-visual-walkthrough.md` 单独核对差异及必要图片更新。

## UI 还原验证中的定位与登录辅助（2026-10-16）

- 角色拒绝提示限定在 `main` 内的 `alert`，继续断言实际角色文案与返回入口；Next 页面播报节点位于主内容外，不可用裸 `getByRole('alert')` 混定位。
- 员工登录辅助按自己的 `POST /api/v1/auth/staff/login` 响应判断认证结果。200后等待真正跳转，只有明确401 `AUTHENTICATION_REQUIRED` 才重算验证码；导航慢不触发再次登录。
- 新 `fixture-staff-navigation.spec.ts` 沿用既有邮箱/密码/动态验证码标签和审核队列h1，不添加产品test-id。CQ_E2E=1时必须实跑，缺少员工世界契约直接失败，不新增no-skip豁免。
- 数据准备辅助先观察自身已完成的读取，再保留原UI断言：人才tags/profile初读后，只有已存在档案才等待files；成果新建后等待自身workflow/evidence；招募项目链接先完成真实URL导航与该公开项目读取，再断言article。没有全局networkidle等待，也不重试读取或放宽原断言。
- `fixture-talent-readiness.spec.ts` 两种初始化分支在CQ_E2E=1必须实跑；只延迟真实GET响应，不伪造档案、标签、文件或身份。新故障注入文件独立120秒预算用于真实准备/延迟/清理，既有业务断言和全局超时保持。

- 跨浏览器R1退出场景先等待真实region `获得的荣誉`（GrowthBody就绪时才渲染），再点击页底退出链接。此检查只避免成长区骨架变为真实内容时移动按钮；仍验证真实/logout确认、退出及浏览器返回门禁，不增加请求、等待时间或重试。

- 学生 `loginThroughUi` 观察自己触发的 `POST /api/v1/auth/login`，要求200后等待真实URL离开登录页；使用既有导航及用例预算，不新增重试或全局超时。`fixture-student-navigation.spec.ts` 仅延迟真实落点请求，验证一次成功提交及真正到达主页；CQ_E2E=1必须实跑，缺少学生账号直接失败，不新增no-skip豁免。

- 导师跨标签换号用例中的退出会执行完整文档替换；URL断言本身不证明新文档脚本已加载。确认退出前注册 `waitForURL(/login$/, {waitUntil:'load'})`，新文档完成后才填写登录字段。用例保留真实脚本6500ms延迟、字段值持续性、重新登录POST200与主页面document marker/私密输入清除断言；不改变产品认证、全局超时或重试。

## T4 学生任务样张还原（2026-10-17）

| B 定位 / 呈现 | 保留的断言 |
| --- | --- |
| `.student-task-page`、`.student-task-view`、`.student-claim-view` | 只限定学生页族；不改变 CampusShell 和教师既有 `.task-detail`，四断点无横向溢出 |
| `.task-card-title` 的 discovery h2 / dashboard h3 | 页面标题层级正确；整张卡片的真实 href 可点击，主色键盘焦点和四种形状仍保留 |
| `.task-decision .fact-row` 与领取按钮 | 实际几何验证事实先于动作，手机动作中心点不被底栏覆盖；既有隐私、201及冲突断言不变 |
| `#submission-file` 与可见的 `label[for="submission-file"]` | 仍为原生文件输入，中文可访问标签、accept、busy禁用及所有上传回调保持；不依赖浏览器英文按钮文案 |
| `.assignment-grid .assignment-item .assignment-value` | 含平台/关键词/领取时间的原定位保留，字段改用dl/dt/dd；像素时间遮罩仍必须实际命中 |
| `region 奖励状态` | 组合到分配面板中；完整服务端奖励文字及状态宣布保持，不从样张复制数字 |

新版已确认样张的安静卡片不要求标题常驻下划线；旧纯视觉断言改由整卡右下角真实导航覆盖，未删除链接、焦点或稀有度验证。任务列表h2消除了旧heading-order豁免，fresh axe先证明过期后仅删除该项。

四断点原生文件输入获得键盘焦点后，检查关联可见label中心实际命中，防止焦点藏在手机固定底栏后。真实领取201后的平台/关键词使用同一行的标签与值，保留服务端值和继续提交地址。画廊先等待现有“确认操作”示例dialog真正出现，再Escape关闭；这只是填充态截图的就绪边界，不删除对话框或业务断言。

## T5 奖励、排行、通知与成长（2026-10-17）

| B 定位 / 呈现 | 保留的断言 |
| --- | --- |
| `.student-growth-page` | 只限定奖励/排行榜/通知/成长tab；info tab继续T3布局，四断点无溢出 |
| `.reward-price`、`.reward-card-action` | 价格/真实兑换按钮同排，44px触区；不足提示与不可用状态保持，ul不带原生左缩进 |
| `.board-nick-name`、`.board-honor`、`.rank-layout` | 正常只读35/36px、荣誉同行、长行增高；既有data-me/data-top3和公开字段不变；中线跟随父级高度并在中缝 |
| `#ranking-around`、真实`/profile`链接 | 本人名次可定位到我的附近，再到成长页；周期URL与真实数据来源不变 |
| `.inbox-toolbar`、`.notif-item[data-read]`、`.notif-body` | 筛选/计数同行、h2语义保留；未读文字与glyph、长正文全文、44px已读操作和回滚逻辑保持 |
| `.growth-primary`、`.completion-metrics`、`.honor-copy` | 六项服务端指标、按时比例/分子分母、最佳月榜和荣誉类型/周期/日期保留；不添加无API的荣誉选择器 |
| `GrowthGallery`开发边界 | 同一WalletSection/GrowthBody/BoardRow呈现零值、透支/冻结、大数和长昵称荣誉；固定示例不读写真实业务数据 |

新增四断点用例复用真实角色世界，画廊先等现有dialog出现再关闭。实际奖励页只打开/取消确认框并检查焦点返回，不消耗共享奖励；真实兑换/钱包重取由既有rewards-ranking用例独立拥有。
`growth-style-isolation.spec.ts` reuses actual teacher/admin shots and their `main .notif-time`: the approved teacher-review metadata is12px and administrator user dates remain13px; only timestamps inside `.notif-item` receive the11px approved inbox density. It creates no synthetic product DOM or mask.
T5 filled gallery checks `.notif-icon svg`, the1px illustration tile, and `.growth-honor-icon svg` at320/390/800/1440; the glyphs are aria-hidden and do not replace visible event, unread, honor-name or type text.

### T6a public sample restoration selectors (2026-10-17)

| Surface | Stable selector or accessible contract | Purpose |
| --- | --- | --- |
| Public discovery | `.campus-discovery-page[data-variant]`, navigation `双创公共浏览`, region `双创三库` | Approved page-family geometry; role detail uses its direct return without this navigation |
| Independent feeds | Regions `校内已核实成果`, `校内招募岗位`, `项目正在招募`, `项目已核实成果`, `项目已同意导师` | Equal discovery columns; project recruitment left/achievement right and mentors below |
| Project filters | Form `校内浏览筛选`, labelled search `搜索`, button `筛选` with `aria-expanded`/`aria-controls="campus-project-filter-options"`, submit `应用筛选` | Native Enter search; expand advanced filters and retain URL context |
| Talent filters | Form `人才筛选`, `.campus-talent-filter-tags > summary`, existing labelled state/material selects and tag checkboxes | Tab reaches summary, Enter opens, next Tab reaches first standard tag; no selector weakens value/filter assertions |
| Role reading | `.campus-role-facts`, region `招募项目介绍`, existing region `授权联系方式` | Facts before phone reading; contact remains one explicit-action island |
| Same-list returns | Links `返回项目库`, `返回招募列表`, `返回人才列表` | Fixed internal paths preserve whitelisted filters; no arbitrary redirect parameter |

Geometry tests wait for real finite entrance animations and font readiness;
they keep the existing coordinate precision and do not alter product motion.

### T6b private maintenance restoration selectors (2026-10-17)

| Surface | Stable selector or accessible contract | Purpose |
| --- | --- | --- |
| Private family | `.campus-management-page`, navigation `本人双创管理` | Three ACTIVE-student maintenance links only on owner/project list-editor/achievement list/talent editor; no such nav on dedicated achievement editor or recruitment list-editor |
| Existing state owners | Regions `负责人资料编辑器`, `项目草稿编辑器`, `成果草稿编辑器`, `招募岗位编辑器`, `本人人才档案编辑器` | Keep account/record keys, controlled inputs, conflict reconciliation and request recovery; project editor remains inline |
| Source composition | `.campus-owner-layout`, `.campus-project-fields`, `.campus-achievement-layout`, `.campus-recruitment-grid` | Approved owner1.35:1 / full project / proof-left-status-right / recruitment direction-stage pair; phone stacks in DOM order |
| Proof and workflow | Region `成果核实与证明`, nested physical region `成果核实操作` | Stateful review panel stays once after a saved record; physical focus fallback and whole existing editor screenshot include form/proof/pending status |
| Draft controls | Form `form.ie-draft-form`, existing labelled native fields and buttons | Distinguish own draft from the independent tag-suggestion form; single-line identity uses inputs without changing validation |
| Error and native focus | Real unavailable-project404 plus existing return link; natural focused save/upload controls | Retain heading/return without mounting editors early; static capture resets prior focus before its top scroll, natural actions never manually scroll |
| Recruitment summary | Region `当前招募摘要`, buttons `查看岗位摘要：<岗位名>` with `aria-pressed` | Render the real selected private DTO; shortcut opens the existing editor after a fresh read, never executes a command on mount; stale CLOSED data rejects a close confirmation |
| Native textarea sizing | Existing labelled `textarea` controls, including `name="summary"`, `name="description"`, `name="introduction"`, `name="talent-introduction"` | Controlled native leaf expands after real edits within CSS bounds; keep original form state, validation, input value, native resize and focus identity |
| Narrow private toolbars and choices | Existing `新建成果草稿` action, `标准技能标签` caption and `.ie-talent-choices > label` | Complete create label stays on one line while toolbar items wrap; compact13px skill labels retain44px targets and three first-row choices at320px; authorized recruitment contact input spans its form |

No masks, pixel thresholds, blanket retries or permissions were relaxed. Save and
preview remain separate commands; visibility and authorization have their own
visible groups. Natural saves use intrinsic width except the approved full-width
phone recruitment save/preview group. Other private phone buttons keep compact
visible frames inside their44px targets. All inspected native controls must be44px
and pass actual hit testing.

### T7 mentor restoration selectors (2026-10-17; verification in progress)

| Surface | Stable selector or accessible contract | Purpose |
| --- | --- | --- |
| Confirmed directory | `.campus-mentor-directory-list`, form `导师筛选` | Real totals, native filters, two columns/2px divider above768px and single-column phone |
| Confirmed detail | `.campus-mentor-public-body`, region `导师授权联系` | Contact band before prose; explicit version-bound read; intro/direction then project-types/achievements |
| Personal consent | Region `候选导师资料`, `.campus-mentor-candidate-grid`, form `导师本人确认` | Candidate/consent equal columns and separate old-public disclosure; original `key={record.version}` |
| Existing authorization | Region `当前导师授权`, `.campus-mentor-current-grid`, form `修改代维护授权` | Pause/channel rows/withdraw separate from scope; all expired selections reset |
| Operations | `.campus-mentor-maintain-grid`, region `导师当前授权与已确认版本` | Editable candidate and read-only scope/old public version; no operator confirmation |
| Project links | `.campus-mentor-links-grid`, regions `查找并邀请导师`/`挂名关系与历史` | Independent owner search/history; existing LinksWorkspace continues owning command/offset above keyed rows |
| Date provenance | Native `time[datetime]`, public `data-time-format="date"` | Exact timestamp is bound to the real public/private response. V checks business-zone text before masking only newly displayed volatile time text; stable fields and unmasked source/product QA remain visible |

Mentor form presentation rows3/2/3/2 and90–240px bounds do not alter original
MENTOR_FIELDS constants4/3/4/3, validation, request bodies or recovery ownership.
Consent checkboxes and native actions keep44px targets. The existing0.01 visual
threshold and zero visual retries remain. This adds narrow volatile-date masks;
the historical T6b no-new-mask statement applies to that completed batch.

R5 operations list uses .campus-mentor-operations-columns / .campus-mentor-operations-state for the same desktop state axis, a native named mentor link plus secondary maintenance link, and original offset20 server pagination. Phone state follows identity while maintenance spans both rows. Candidate heading stays whole while real metadata wraps; contact choices preserve44px targets with no added row gap. Geometry of paired inputs is read atomically to avoid the existing220ms page entrance transform advancing between reads; tolerance stays unchanged.

R5 page2 record assertions scope heading level3 to the current named workspace listitem. Separate search/history section headings are not page records; retain exact expected row names, count, offset, same request-body retry and page-fallback assertions.

### T8 teacher and achievement review selectors (2026-10-17; local engineering verified)

| Surface | Accessible or structural contract | Purpose |
| --- | --- | --- |
| Submission review | `.campus-teacher-review`, `.review-layout`, button `返回待审核队列` | Original selectedId controls phone queue visibility; keyboard entry focuses the visible phone return button, desktop keeps its visible queue focus; returning focuses the exact original row |
| Decision result | Region `任务审核处理结果` | A completed decision removes its opener; the original result becomes the focus destination |
| Task list | Region `任务管理列表`, `.campus-teacher-table tbody` | Phone header is visually hidden; select actual body rows rather than assuming an accessible header count |
| Task detail | Navigation `任务管理章节` and original section IDs | Same-page context anchors; no new detail or governance routes |
| Native task form | `.campus-task-dialog`, `.campus-task-fields` | Existing create/edit dialog, original labels and disabled state; source form groups and deadline field order |
| Moderation | Region `评论管理列表`, listitem `data-deleted=true`, original anonymous author and moderation key | Staff history keeps original content with `已删除`; the public tombstone uses `该评论已删除` separately |
| Identity reveal | Dialog `揭示匿名身份`, original reason and explicit confirmation | No identity prefetch; reveal permission does not grant comment deletion permission |
| Achievement review | `.campus-achievement-review-queue`, `.campus-achievement-review-editor` | Same-route claimed snapshot; public submitted content, restricted owner/proofs and decision sections remain distinct |

Controlled staff dialogs without a Radix Trigger now capture their actual DOM opener
and current auth epoch. Escape/cancel restores that connected opener only for the
same actor; completed review/deletion uses its existing result/list region when the
opener was removed. Existing request handlers and Radix focus trapping remain.
All natural action screenshots assert44px and a visible, unobscured focused target.

### T9 administrator composition selectors (2026-10-18; local engineering verified)

| Surface | Accessible or structural contract | Purpose |
| --- | --- | --- |
| Authorized admin shell | `.campus-admin-main` | Apply approved administrative density only after original role/account gate |
| Admin labelled records | Original table names and `td[data-label]`, `.cq-status-cell` | Source phone alternatives and desktop status/header axis; original row data and actions remain |
| Controlled admin dialogs | `.campus-admin-dialog`, `[data-admin-return]` | Capture actual opener and auth epoch; only the same actor can regain connected opener or named local fallback |
| System parameters | `.campus-admin-setting-editor`, native summary named `修改` plus exact parameter title | Five initially collapsed editors; native keyboard opening, original controlled drafts/version confirmation |
| System navigation | Navigation `系统分区`, original `#admin-settings`, `#admin-templates`, `#admin-failures`, `#admin-repairs` | Same-page source section links, no new routes |
| Audit filters | Original `audit-filter-action`, `audit-filter-actor`, `audit-filter-target` and buttons `检索` / `清空条件` | Exact equality filters and original offset pagination; snapshots are readonly native disclosures |
| Reward catalogue | Region `奖励目录`, original name/point/reason dialog labels, `.list-footer` and `加载更多` | Existing administrative GET catalogue, including disabled rows; reread server order after mutation and discard old pagination responses |
| Reward review authorization | Region `审阅授权管理`, native select `授权操作` (`grant` / `revoke`), original `教师用户 ID` / `操作原因`, button `确认操作` | One source form retains target/reason across modes; pending/done disables mode; original POST/DELETE command body, mandatory reason and reset remain |
| Account filter reset | Original selects `角色筛选` / `状态筛选`, buttons `筛选` / `清空` | Clear resets both controlled selectors and reloads the original unfiltered server page at offset0; keyboard focus stays on the reset control |

The original working focus handlers for operations grants and owner qualification
remain unchanged. Selected detail screenshots follow real account selection or
explicit audited snapshot reads; fixtures never insert private profile data into
the queue. Full IDs remain in the protected admin DOM; visual ellipsis retains
the real ID in its native title. No public disclosure contract is broadened.

T9 selected grant details use the original controlled reason, validation and
same-actor focus ref through a native multiline textarea. The ref's TypeScript
element type changes, while its emitted `useRef(null)` remains identical.
The displayed version is the existing server `record.version`. Qualification
facts retain all four explicitly read snapshot fields; CSS pairs their labels
and values without adding those fields to queue rows.

Template maintenance exercises the existing content-version and enable/disable
semantics; toggles preserve the content version. Repair forms keep their original
reason-mandatory explicit confirmation buttons and typed server refusals. Test
world cleanup recognizes a template's audited creation by a null prior snapshot;
a later edit by this world's actor does not confer ownership of another template.

T9 phone readability regression measures `.campus-admin-setting-row` title,
current-value facts and `.campus-admin-setting-hint`: at320/390 the title spans
the row and both fact/description columns remain at least40% of its width.
This catches intrinsic grid tracks collapsing even when document overflow is0.
The selected real redemption retains the original actions and adds their
truthful consequence in `.campus-admin-redemption-policy[role="note"]` below
that detail's action row. Assertions compare actual element geometry and text;
no fixture values or backend transition rules are substituted.


Task12 teacher reminder form: the existing 新建任务 / 编辑任务 dialogs expose native checkbox labels 截止前 24 小时 / 截止前 4 小时 under 提醒时间, and 站内 / 短信 / 已验证邮箱 under 通知渠道. These are presentation bindings to the existing notify_24h, notify_4h and notification_channels fields. The existing 任务配置 region retains read-only 截止提醒 / 通知渠道 facts from the actual DTO. Business success is verified through real request/response and reread, not through checkbox paint alone.

Task12 private source context uses `.campus-private-context` before the editor h1 and the existing loaded private parent DTO, never public recruitment fields. 成果流程指引 is a navigation landmark with existing 我的项目 / 负责人资料与资格 links. The existing inline-editor case checks both new and fresh loaded recruitment editors and preserves the independently saved project-name field. Long-title recruitment summaries keep `.campus-private-state` intrinsic and on one line. Login readiness tests hold actual client-script routes 6500ms, inspect server-rendered native disabled controls, then release scripts and verify controlled values remain. No timeout, retry, endpoint or identity fixture is weakened.

Task12 staff closure: `details.campus-task-schema` retains the actual saved version and complete parseable JSON in a native keyboard disclosure. Teacher natural actions use a real Shift+Tab / Tab round trip and check all four edge midpoints and four curvature-aware corner points plus the full44px bounding box and focus-ring bounds against visible fixed bars; screenshots keep those bars. `campus-review-restriction` precedes actual queue counts, while the existing 重新读取待办 action stays owned by the queue and appears beside its heading. Review details use actual case.status; their DTO provides no timestamp, claim ownership or revision ordinal to invent. Reward edit uses existing 描述（选填） / 发放说明（选填，学生兑换后可见） labels, existing reason and PATCH, with real reread and explicit-null verification.

Task12 final closure: staff h1 on `/teacher/reviews` is the approved `提交审核` (sidebar destination remains `审核队列`); fixture login checks keep real POST counts and6500ms navigation stimulus. Personal navigation uses bottom nav at<=640px, complete `全部导航` dialog nav at641–1023px, and rail `个人` nav at>=1024px; each actual destination surface contains exactly one current `我的` item. All existing destinations, five bottom slots, Escape return and overflow checks remain. Staff SSR login now shares the student/mentor readiness contract: email/password/second-factor/submit are disabled until handlers exist; current backend parser, login body, 2FA, session and redirect are unchanged. Talent management remains the same ACTIVE-STUDENT-only link, aligned to its own header top0 with44px target.

Task12 source paint: `.ie-talent-state[data-cooperation-state]`, `.campus-private-state[data-visible]`, `.campus-mentor-state[data-link-status]` and `.campus-review-operation[data-operation]` project existing DTO state for presentation only. The blue variant is context-specific; generic `.badge-info` remains neutral except the actual frozen-review kind inside `.campus-review-snapshot-meta`. `.campus-source-note` is the original qualification consequence paragraph or the permanent whitelist consequence `[role="note"][aria-label="白名单停用影响"]`; it does not change confirmation or mutation ownership. `.app-sidebar-workspace` is a role-shell caption, and `.app-user-name` is the only ellipsized identity part. Paint assertions read RGBA, padding, border and typography; section-heading frame assertions require an opaque actual border, not just `border-style:solid`. Mentor source focus checks retain the full native ring/44px hit contract; root scroll-padding reserves existing fixed bars without manual focus scrolling.

Task12 reward heading: the server page passes its unchanged `.page-head` title/description as a ReactNode slot to the existing catalogue island. `.campus-admin-rewards-heading` owns native wrapping and the existing `.row-actions` callbacks; no second command or loading owner is introduced. The source-bound admin case checks27px/left alignment below the description at320/390, and header/action center agreement within1px at800/1440 (actual source delta0.5px). The earlier absolute cross-sibling placement and hidden duplicate h2 are removed. State labels within `.campus-mentor-person-head` explicitly keep the11px source recipe despite the surrounding12px metadata; plain directory accepting-contact copy remains12px.


Task12 capture ownership: `captureOwnedVisual(page, owned, name, masks)` is limited to existing recruitment, talent and review content captures. Whole-content owners use the real main landmark; nested editor/dialog/contact owners retain their original landmark. The captured owner must contain no `.app-topbar,.app-bottomnav`; only these external shell bars are hidden temporarily and their prior visibility must be restored. No stable business field is newly masked. Existing reviewed time masks and screenshot names/tolerances remain. Natural viewport and full shell capture obligations remain independent.

The authenticated mentor destination assertion uses visible nav 导师工作区 → 本人档案与授权, href `/innovation/mentors/me`, and current-page state. A transient header 返回工作台 link before authentication resolves is not the authenticated desktop navigation owner.


Capture-only development tooling: the installed Next development UI mounts outside product owners in `nextjs-portal`. Visual captures exclude this external portal. The official `[data-nextjs-dialog-overlay]` error surface must have zero matches before exclusion, including hidden matches; capture cleanup cannot conceal a runtime error. Full-shell captures retain all actual product navigation. Owned captures additionally assert external decoration is hidden during capture and restore its prior visibility. One forced refresh of all50 active PNGs removes stale artifact remnants under the unchanged1% comparison tolerance;11 historical PNGs remain immutable and every changed pair requires actual inspection before fresh no-update comparison.


Task12 selected grant uses the existing `#operations-reason` textarea and its existing `.field`/form ancestors for approved-width geometry: min(700px,available form width) at>=640px, full available width on phone. No new selector/state/API is introduced. Cross-browser keyboard login must wait for enabled native controls and assert complete values; typing alone does not perform an enabled actionability check. Staff OTP attempts replace the prior value and only an actual uniform authentication rejection may recompute a code; successful/transport/navigation responses cannot trigger another login.

UI13 final comparison keeps existing accessible audit/account filter names while visible labels match the approved samples; exact-match hints use aria-describedby. Existing .review-item-title/.review-tier geometry, title-cell .rarity-badge, .secret-box .secret-label order and 成果流程指引 remain presentation contracts. The guide displays 校对项目概况 with accessible name 校对项目概况（我的项目） so the visible label is included for voice control; its original href and unsaved guard remain. Native #submission-file remains; 开始上传 is present and disabled before selection and uses the original handler afterward. No new API, sensitive selector, mask, tolerance, retry or skip condition is introduced.
Teacher review keeps the 校验报告 region while naming its visible heading 机器校验报告. Staff queue metadata timestamps remain inline, and notification-only phone wrapping stays scoped to .notif-item.

### UI14 已批准首页标题与认证就绪契约

- 首页以 `getByRole("heading", { name: "首页", level: 1, exact: true })` 确认；元数据标题“我的主页”不作为正文定位。冷启动任务页同样使用精确一级标题“任务广场”，不匹配上下文栏副本。
- 跨标签页与冷启动继续走真实表单、200登录响应和实际导航，复用已有 `loginThroughUi`。保留旧身份清除、迟响应围栏和单刷新不变量，不增加重试或调整全局超时。
- UI14 独立诊断联跑8项通过；运行环境和未覆盖范围见交付评审，不据此声称当前全量电池通过。

### Integration UI16 preparation contracts

- `prepare-unread`, `prepare-poor-student`, and `prepare-empty-task` require `CQ_E2E=1` and the owned disposable `CQ_E2E_WORLD_FILE`; missing prerequisites fail instead of skipping. All created actors/tasks enter the retained R6 cleanup graph.
- Notifications retain `.notif-item` and use the new unique title; verify the actual POST200, returned ID/read_at and persisted read state after reload.
- Rewards use the owned reward heading and the rewards document's wallet GET200; zero available/spendable points produce the exact shortfall and disabled CTA. Keep the upstream divergent-balance presentation.
- Exhausted task detail uses a separate zero-claim requester and occupied task. The upstream availability-driven `名额已满` CTA remains disabled, with no assignment panel. The older UI snapshot's pressable exhausted CTA is superseded; `NO_ASSIGNMENT_AVAILABLE` remains the concurrent-race fallback.
- Cross-browser staff review uses region `任务审核工作区`, h1 `提交审核`, and `审核队列为空`; the accepted unified login's own queue GET200 determines the empty state or exact `.review-item` count. A generic `.section` is not readiness.
- Cross-browser student login waits for the actual `/me` identity, the resolved `我的账户` link and the `首页` h1. The upstream optimistic loading shell also contains sidebar links and its toggle; those alone cannot establish authenticated readiness.
- The approved task sample uses start-aligned, natural-height cards. After fonts and finite entrance animations settle, cards fill their own list-item width, share its top and keep the next row clear. The older equal-height recipe is superseded by the approved `innovation-round-1/student.css` source.
- No new product selectors, masks, pixel tolerance, retries or timeout changes are introduced. See `ui-integration-disposition.md` for the 298-path source review; final-H evidence is recorded separately.

### R6 协作、交接及生命周期（行为与结构契约）

以下只约束 R6 新增/衔接入口，不把 opaque 引用当可见身份文本。API setup 中的编号不进入公开文案；受控下载不暴露存储地址。

| 分类 | 真实可访问定位 | 行为/等强度要求 |
| --- | --- | --- |
| A | `我的项目分类` 导航及 `我负责的 / 我共管的 / 我参与的` region | URL role 与分类一致；本人分类20项分页，新页就绪后给键盘明确位置 |
| A | `正在读取协作资料` status | 有读屏提示；视觉骨架本身仍隐藏于可访问树 |
| A | `本人的协作邀请与同意`、`项目协作记录` region | 管理和挂名分别确认、拒绝、退出；姓名/分工为不可变候选 |
| A | `同意共同管理 / 同意公开挂名 / 拒绝公开挂名 / 撤下公开挂名 / 退出共同管理` button | 每次对具体用途明确确认，成功后对应权限或公开展示即时失效 |
| A | `邀请协作`、`发起负责人交接` region内的 `对方账号`、`核对对象` | 核对后只显示昵称，账号输入清空；两个表单不能混淆对象 |
| A | `协作项目文字`、`成果文字编辑器` region | 无证明/提审隐式授权；保存冲突及重放保留原输入，载入服务器文字须明确选择 |
| A | `协作招募岗位`、`招募岗位编辑器` region | 共管走专用transport；资格不足仍可存稿，发布动作明确说明条件 |
| A | `交接摘要与结果` region；`读取最新交接摘要` | 页面和真实 GET就绪后再确认；项目文字、关系、岗位、材料或公开状态变化要求重新核对 |
| A | `当前关系与将关闭岗位清单`、`发起时已记录的清单` region | 显示安全关系与范围、具体岗位；旧快照未记录不能伪作空名单 |
| A | `本次逐份交接的证明`；`主动查阅证明 N` | 仅指定目标且明确提前授权出现按钮；主动读取先确认持久审计与回避后果 |
| A | `确认接任项目` dialog与`确认接任并关闭现有岗位` | 发送当前冻结摘要/版本。未知结果退出modal，提供原结果核对入口；终态不再返回私稿清单 |
| A | `逐岗核对招募与新联系授权` link | 进入当前新负责人的真实岗位管理；旧联系不默认继承，须逐岗明确开放 |
| A | `项目状态与公开介绍`；`待发布介绍预览` region | 结项前列后果与具体岗位；四字段介绍先预览再明确发布；恢复不自动开放岗位 |
| A | `核对原操作结果` button及错误alert | 使用原request_id/body/版本；先查结果；换号清除并隔离迟响应，不另发一份新命令 |
| A | `本人同意公开的项目成员` region | 只显示当前接受的姓名和分工；不展示候选、账号、私稿或完整身份验证暗示 |
| A | 运营详情错误后的“其他无冲突运营处理 / 联系管理员安排” | 新参与释放原领取，材料与决定同时拒权；提供后续协调路径 |
| B | `ie-draft-list / ie-draft-row / r6-summary / r6-workflow-group` | 延用项目token、列表与表单层级；替换DOM时须保留以上region/标签/焦点/业务断言 |
| B | 本人分类中 `a[href="/profile/collaboration/projects/<opaque reference>"]` | 只用于精确找回测试所建项目的SPA入口；仍检查可访问名称与实际目标路由，不读取旧页面地址代替导航完成 |

功能旅程：`innovation-collaboration.spec.ts`、`innovation-collaboration-transfer.spec.ts`、`innovation-collaboration-states.spec.ts`、`innovation-collaboration-review.spec.ts`、`innovation-collaboration-recovery.spec.ts`。独立像素：`innovation-collaboration-visual.spec.ts`，Linux固定字体，390/1440，无新增mask或容差/重试放宽；四个新基线须逐张走查后另行无更新重跑。
