# CampusQuest Frontend Design System

> 已确认样张及后续专用配方继续有效。UI13 产品视觉验收与 UI14 代码交付状态见 [交付评审](ui-migration-delivery-review.md)；下文按阶段保留的验证进度不代替当前回执。


> Purpose: give frontend and design agents one stable visual language across Student, Teacher, and Admin surfaces.
>
> Product direction: **academic productivity with restrained gamification**.

## 1. Design intent

CampusQuest should feel credible enough for teachers and administrators, motivating enough for students, and dense enough for real operational work.

The interface should communicate:

- **trust** — academic and administrative actions feel deliberate and auditable;
- **clarity** — task status, deadlines, points, and next actions are obvious;
- **momentum** — progress, ranking, honors, and rarity add energy without turning the product into a game skin;
- **calm density** — dashboards and review queues can show substantial information without visual noise.

The preferred reference family is modern productivity software and well-composed shadcn/Radix dashboards. Do not imitate any reference brand one-for-one.

## 2. Visual personality

Use these adjectives when deciding between two visual treatments:

**calm, precise, compact, optimistic, human, slightly playful**

Avoid:

**flashy, casino-like, neon, glassy, futuristic-AI, overly corporate, cartoon-heavy**

Rarity labels and honors may be playful. Authentication, submission, review, account security, redemption approval, and Admin operations should remain visually serious.

## 3. Token-first implementation

All recurring visual values MUST originate from shared tokens. The
pipeline is settled (plan-14 C0, folded back at C3): `:root` OKLCH
custom properties in `globals.css` are the single source of truth; a
Tailwind v4 utilities-only build (no preflight, no default scales)
sits alongside them, with an `@theme inline` bridge mapping
`--color-*` names to `var(--…)` references only — it re-defines
nothing and emits nothing. New styling has three sanctioned lanes:
theme-bridge color utilities (`bg-surface-1`), plain CSS classes over
tokens (`.btn*`, `.cq-dialog*`), or a new `:root` token. Bracket-form
arbitrary values are guard-banned outside the bridge
(`scripts/check-css-integrity.mjs`); the TS mirror in
`src/lib/designTokens.ts` is pin-tested against the CSS text.

Do not scatter raw hex values or one-off radius and shadow values through feature components.

Recommended token groups:

~~~text
surface:
  background          (approved warm paper, 2026-10-16)
  surface-1
  surface-2
  surface-brand       (the ONE soft brand wash: hero/progress emphasis
                       only — never a page background)
  overlay / overlay-scrim

text:
  foreground
  body-foreground
  muted-foreground
  subtle-foreground
  inverse-foreground

border:
  border              (soft; background contrast carries hierarchy first)
  border-strong
  divider             (independent two-column separator)
  focus-ring

semantic:
  primary
  success
  warning
  danger
  info

rarity:
  rarity-normal
  rarity-rare
  rarity-epic
  rarity-legendary

shape:
  radius-sm
  radius-md
  radius-lg

shadow:
  shadow-xs
  shadow-sm
  shadow-raised        (the one lifted level: dialog/popover/hero objects)

motion:
  duration-fast / duration-slow
  ease-standard
  lift-hover           (the 1–2px hover lift interactive cards may take)
~~~

Prefer OKLCH custom properties in `:root` (the settled pipeline above bridges them into theme utilities).

### Token usage rules

- Primary accent is for the main action and current navigation state, not every icon.
- Semantic colors communicate actual state, not decoration.
- Rarity colors are accents on badge, icon, or keyline. They MUST NOT become full-page backgrounds.
- Border and surface contrast should carry most hierarchy; shadow is secondary.
- One page should not invent a new visual vocabulary.

## 4. Color strategy

Default experience should be light-first, with tokens structured so a complete dark theme remains possible.

**Current visual decision (owner-approved samples, 2026-10-16):** warm paper, light navigation, restrained blue, and Song-style display headings supersede the earlier Plan 11 dark rail. The approved source is the whole-site migration plan and its R5-inclusive sample coverage. Business and permission contracts are unchanged.

| Role | sRGB reference |
| --- | --- |
| Paper / content / secondary and rail | `#f5f3ec` / `#fdfcf8` / `#efeee6` |
| Heading / body | `#262820` / `#45483f` |
| Auxiliary text | `#6c6d62` (minimally darkened from sample `#74756a` to meet AA) |
| Group border / independent section divider | `#deded3` / `#b6bdab` |
| Primary and focus / local brand wash | `#335d99` / `#e9eef5` |

CSS remains the OKLCH source of truth. `--border-strong` retains the divider's hue/chroma with lower lightness for control boundaries; group borders are not control outlines. Muted and subtle text both remain readable on paper, content, secondary and brand surfaces. Semantic and rarity colors retain their meanings.

The approved whole-site source supersedes the earlier workflow badge and
destructive-trigger palette: status labels use its neutral gray-green tag,
with blue only in explicitly represented source contexts. Root alerts, field
errors, and rarity accents retain their semantic colors. The exact source
recipes and exceptions are recorded below; a semantic class name alone does
not select a blue, green, or orange badge.

Recommended behavior for alerts and feedback:

- large page backgrounds: neutral;
- cards and panels: one subtle surface step above background;
- primary action: one clear accent;
- destructive action: semantic danger only;
- success: completed or approved states;
- warning: deadline risk, revision needed, provider failure;
- info: neutral system information.

Rarity mapping should remain recognizable but restrained:

| Rarity | Intended accent |
| --- | --- |
| Normal | neutral or graphite |
| Rare | cool blue |
| Epic | violet |
| Legendary | warm amber or gold |

Do not rely on rarity color alone. Always render the text label.

## 5. Typography

The product is information-heavy. Body typography must prioritize readability over personality.

Use:

- a highly legible sans-serif body and UI font;
- local Song-style display type on brand and page/authentication titles only;
- tabular numbers for points, ranks, dates, counts, and table metrics where alignment matters.

Hierarchy guideline:

- page title: regular Song-style,31px below40rem and38px at/above40rem; section titles and body remain sans-serif. Authentication uses the approved access-page composition:29px below768px and32px otherwise, with a brand header, heading outside the form card,420px desktop card and18px mobile page gutters (`auth-login.html`,2026-10-16). A component gallery or our own regenerated PNG does not establish approved-reference fidelity;
- owner profile title: the approved account sample uses29px below40rem and34px
  otherwise; this is a page-specific exception to the general title scale;
- section title: distinct from card titles;
- body: comfortable line height;
- metadata: muted, never so faint that it harms readability;
- dense table text: compact, but not uncomfortably small.

Avoid giant dashboard headings and oversized KPI numbers that push useful information below the fold.

Production uses local stacks: `Microsoft YaHei, PingFang SC, Noto Sans CJK SC, system-ui, sans-serif` for UI/body and `SimSun, Songti SC, Noto Serif CJK SC, serif` for display. Fonts are not downloaded or redistributed. Metrics and code use the existing system mono stack through `--font-mono`. Linux screenshots pin sans/serif/mono and wait for `document.fonts.ready`; see `ui-migration-fonts.md` for evidence and platform limitations.

## 6. Spacing and density

Use a consistent spacing scale. Prefer fewer spacing values rather than arbitrary per-component tuning.

Desktop:

- main content gutters clearly separate navigation and work area;
- table and review pages use a denser vertical rhythm than auth pages;
- related controls stay visually grouped.

Mobile:

- keep a comfortable page gutter;
- do not compress tappable actions into tiny icon-only clusters;
- stack primary controls before secondary metadata.

A page with operational data should prioritize the work, not empty whitespace.

Reading surfaces cap their content column on a shared view step: 42rem
below the 48rem breakpoint, 56rem at and above it (the `.task-detail`
step — rewards, rankings, community, rating, and notifications all ride
it). A capped detail column never leaves its sibling sections at full
width, and full width is reserved for genuinely wide work (tables,
shelf grids), not reading content.

## 7. Shape and elevation

Recommended character:

- controls: small-to-medium radius;
- cards: medium radius;
- dialogs and drawers: slightly stronger radius;
- pills: only for badges, statuses, and filter chips.

Use elevation sparingly:

- most cards use border plus surface difference;
- dialogs and popovers may use a shadow;
- avoid making every card look like it is floating.

## 8. Page shells

### Navigation shell (Plan 11: three bands)

All authenticated workspaces share one navigation geometry, three
bands by viewport:

- **Wide (≥64rem)**: a visually QUIET sidebar owns the primary
  navigation — the warm light rail (readable dark links, blue active
  state with an inset keyline; exactly one `aria-current="page"` per
  nav landmark); the top bar degrades to a context/actions strip
  (bell, user — no nav, no brand).
- **Medium (40–64rem)**: the horizontal top nav keeps every
  destination.
- **Narrow (<40rem)**: Student gets a fixed 5-slot bottom nav — a
  light frosted bar (translucent `--surface-1` + backdrop blur,
  restrained primary active accent; the warm rail stays on the
  wide sidebar) — with safe-area inset and reserved content
  bottom padding (the fixed bar never covers a primary action);
  Teacher/Admin get a hamburger menu sheet carrying the FULL staff
  list (native dialog semantics: focus trap, Escape, backdrop close).

Routes never change with the band; reachability does not either.

The approved 2026-10-16 shell uses a blue vertical brand keyline and Song-style
“华师令”, a warm paper context bar (69px outer height on desktop), and plain
actions in that bar. The earlier floating rounded action pill is superseded.
Keep the existing rem-based rail defaults, width preference and collapse/resize
behavior; a static sample's200px rail does not replace that interaction contract.
Anonymous workspace gates reuse the auth header, independent heading and card.
Account settings use independent avatar/nickname and phone/email section pairs,
with the parent owning the divider; on phones they stack. Password fields form
their own row, and current URL tabs use an underline rather than a filled pill.

### Student

Primary navigation should make these easy to reach:

- Home
- Tasks
- My Claims (anchored on the dashboard in V1 — no /claims index route)
- Rankings
- Rewards
- Notifications
- Profile

Dashboard priorities:

1. work requiring action;
2. approaching deadlines and revision requests;
3. points and reward progress;
4. ranking and growth;
5. task discovery.

Do not make the Student home a wall of equal-sized metric cards.
Plan 11 realizes this as ONE next-action hero (the single dominant
element, and the only page-level `--surface-brand` consumer): a
teacher-returned revision outranks everything, else the
earliest-deadline open claim, else a discovery CTA. Discovery cards
dedupe against the student's open claims.

### Teacher

Prioritize:

- review queue;
- task management;
- task statistics;
- assignment import;
- community and reports.

Teacher pages may be denser than Student pages.

### Admin

Prioritize operational scanability:

- users and whitelist;
- rewards and redemptions;
- system and notifications;
- audit;
- repair operations.

Admin pages should favor tables, filters, drawers, and explicit confirmations over decorative dashboard cards.

## 9. Component rules

### Buttons

Use a clear hierarchy:

- Primary: one main action in a local context.
- Secondary: normal alternative.
- Ghost: lightweight toolbar action.
- Destructive: destructive intent only.

A button is a button whatever the element: link-styled buttons
(`<Link className="btn">`) never render the anchor underline; inline
prose links (`.link`) keep theirs.

Avoid two adjacent primary buttons competing for attention.

A CTA carries its own availability state: facts about the CATALOG (out
of stock, window closed) render as quiet state text in place of the
action; facts about the USER (insufficient points, ineligible) keep a
disabled control plus the reason. No duplicate state badge beside an
already-expressive CTA.

Icon-only buttons require accessible labels and, where helpful, tooltips.

### Segmented tabs

URL-state tab sets (ranking period, inbox filter, comment sort) render
as ONE segmented control (`.tab-bar.segmented-tabs`): a quiet track
with a hairline keyline, the current segment raised to `--surface-1`
with added weight. The control hugs its segments (the class carries
`justify-self: start`); URLs stay the state — the link IS the state.

### Cards

Cards are grouping containers, not the default layout primitive.

Good uses:

- active Claim summary;
- reward item;
- compact growth summary;
- task card in discovery.

Poor uses:

- wrapping every section inside another card;
- turning every desktop table row into a large card;
- one card per label/value pair.

Plan 11 task cards: the title owns the card; rarity rides the badge
pill + per-tier glyph + a restrained border/wash tint (caps in the
Task rarity section below) — quiet for NORMAL — with its TEXT label
in the metadata row; color never carries rarity
alone. Interactive cards may take the 1px hover lift
(`--lift-hover`, reduced-motion safe).

Discrete shelf/list objects may carry ONE quiet identity chip (a
2.5rem tile with an existing glyph, e.g. `.reward-icon`) as the object
marker — never per-object decorative art.

### Metrics and stat emphasis

When one figure gates the page's primary action (spendable balance,
current rank), it renders as the dominant stat (`.stat-focus`) directly
on the page ground — never as one card in an equal-metric row.
Secondary facts join ONE quiet `·`-separated metadata line
(`.balance-quiet`); conditional alerts (freeze, debt) keep full
sentences as `.progress-note`. An optional goal rail (thin track,
filled progress, endpoint node) may attach to the dominant stat for
progress toward the next threshold.

### Identity vs status (Plan 11 core rule)

Assignment identity (platform / keyword / claim time) is NEVER drawn
in a semantic tone: `.claim-panel` renders on the neutral
`--surface-brand` surface with a neutral border in every state.
Workflow status lives only on the status badge, the five-step
progress strip (领取 → 提交 → 校验 → 审核 → 完成; current strong,
done quiet, future subtle; non-linear terminals render no strip),
and the alerts. When a revision is required, the revision banner
precedes the assignment facts and owns the visual priority.

### Tables

Use tables for Teacher and Admin dense data.

Requirements:

- sticky header when useful;
- sensible loading, empty, and error states;
- server-backed pagination and filters where data can grow;
- consistent row actions;
- destructive actions never hidden behind ambiguous unlabeled icons;
- numeric columns align predictably.

On mobile, use a deliberate compact/list alternative if a table becomes unreadable.

### Status badges

Status always includes text. Color is supplemental.

Use product wording such as:

- 待提交
- 校验中
- 待审核
- 需修改
- 已完成
- 已过期

Do not expose raw enum names such as UNDER_REVIEW.

### Task rarity

Rarity treatment:

- compact badge;
- optional small icon or edge accent;
- never outrank task title;
- no animated glow for Legendary.

Task-card exception (owner ruling 2026-10-03, defect #5.2): the
discovery card may carry a restrained tier border (≤30% mix) +
background wash (≤6%); NORMAL stays neutral — the QA contract
requires tier color on the card's background and outline.

### Forms

- label remains visible after input;
- help text explains consequences, not the obvious field name;
- errors appear close to the field;
- sensitive forms state what happens next;
- use appropriate autocomplete and input mode;
- disabled states remain legible.

### File upload

Upload UI must show:

- allowed formats;
- size policy;
- current file;
- progress;
- upload and finalize failures;
- validation state;
- structured validation result;
- retry or new-version action.

Drag-and-drop is optional enhancement; keyboard-accessible file selection is required.

### Leaderboard

Leaderboard should feel competitive but not humiliating.

Always provide:

- top results;
- around-me section;
- current-user highlight;
- period switch;
- honor display.

Do not use danger styling for low rank.

Plan 13 grammar:

- the period switch is a segmented control (above);
- top-N distinction is restrained: numeric weight plus at most ONE
  subtle keyline on the row — never podium geometry, never animated
  crowns;
- the current-user anchor is ONE consistent grammar wherever a list
  contains the caller: `--surface-brand` row tint + strong keyline +
  inset primary bar + a non-color 我 tag; the identity anchor always
  outranks status accents (identity and status never share a
  treatment — rule order at equal specificity carries this);
- honor rides the nickname line as quiet muted text — identity
  context, not a status chip;
- around-me is panel-wrapped as one object; when the caller is
  outside the top list, ONE quiet neighborhood lead re-states their
  global position so the window reads as a continuous story, and it
  is suppressed when the top list already carries the standing
  (derive from the rollup, never re-compare component-side).

### Comments

Anonymous mode must be explicit before posting.

Comment UI should visually separate:

- author or anonymous label;
- timestamp and edited marker;
- content;
- vote and reaction controls;
- moderation or deleted state.

Deleted parent comments remain as tombstones so child context survives.

Plan 13 thread grammar:

- threads render as hairline-separated groups on the page ground with
  ONE indent rail for children; cards-in-cards are banned under a
  section that already frames input furniture (the composer is the
  thread's only panel);
- shared metadata rows take middot separators from a scoped rule
  (thread vs moderation), never a blanket separator rule;
- engagement is compact and inline-quiet: borderless icon+count
  chips, pressed = quiet primary wash on transparent; counts are
  always tabular and render only when known — never fabricated zeros;
- explicit states on frozen copy (e.g. the anonymous preview) ride
  `data-*` hooks — presentation carries the urgency, copy stays
  unchanged.

### Inbox lists

Read/unread grammar: use a small surface difference, explicit unread text and restrained weight. Keep rows on the same visual level; no large status block or floating unread card. The current-user ranking emphasis remains a separate meaning. Notification rendering migrates in T5; this paragraph records the approved direction.

When a row has both a CATEGORY and a RESULT, use two channels: kind
rides a quiet structural anchor (a 2px left keyline on the glyph tile,
semantic-token mix over `--border`, the base keyline identical across
categories so there is no layout shift, a text label always beside
it); outcome rides the semantic tint. Never merge kind and outcome
into one color.

Long body copy clamps (`-webkit-line-clamp`) to keep lists scannable;
keep `pre-wrap` so server newlines survive the clamp. If content
beyond the clamp has no reachable detail view, record that as a known
product cost.

### Dialogs

`components/ui/dialog` owns every dialog: the shadcn-pattern Radix
primitive styled to the legacy `.dialog` contract (26rem card, 40rem
wide variant, `--overlay-scrim` scrim, no open/close animation). New
code MUST compose `Dialog` / `DialogContent` / `DialogTitle` /
`DialogFooter`; hand-rolled native `<dialog>` + `showModal()` is
forbidden. Title wiring pairs `DialogContent aria-labelledby` with an
explicit `DialogTitle id`; helper copy stays a `.field-hint` paragraph
rather than `DialogDescription` (they size differently). Dialogs close
through their own action rows (`DialogClose` asChild on those
buttons) — there is no chrome close button. StaffMenuSheet's native
menu is the one sanctioned legacy exception. Since the C3 retirement
it is self-contained (`.app-menusheet*` carries the former
`.dialog*` shell values); it stays native `<dialog>` by the plan-14
ledger ruling (transient nav menu, outside the five contract flows).

## 10. Loading, empty, error, and permission states

Every feature page MUST define these states before implementation is considered complete.

### Loading

- use skeletons where shape is stable;
- use inline spinner for isolated actions;
- do not block the whole page for a minor mutation.

### Empty

Explain:

1. what is empty;
2. why it might be empty;
3. what the user can do.

### Error

Show:

- human-readable message;
- retry when safe;
- request ID on unexpected server failure.

Do not expose stack traces.

### Permission denied

Do not render a broken page full of disabled controls. Explain that the user lacks access and provide navigation back.

## 11. Motion

Motion is subordinate to comprehension.

**Motion spec (review round 3 — tokens live in globals.css):**

- entrances: ONE orchestrated rise (opacity + 8px, `--motion-in` 220ms,
  `--ease-out-soft` settle) when a section's data mounts; lists stagger
  `--stagger` 40ms per child, capped at three children so long lists
  never crawl. Nothing animates longer than ~300ms — this is a
  productivity tool, not a showcase;
- only `transform` and `opacity` animate (GPU-composited; never
  width/height/padding/margins);
- skeletons are a LOW-CONTRAST directional sweep (`cq-sweep`,
  transform-only) — never an opacity blink;
- `prefers-reduced-motion` means FEWER and GENTLER animations, not
  zero: entrances become pure fades, movement and sweeps drop, color
  transitions stay.

Use motion for:

- the section/list entrance described above;
- drawer and dialog transitions;
- small list insertion or removal;
- optimistic vote and reaction feedback;
- subtle progress and state changes.

Avoid:

- page-load choreography on operational pages beyond the single
  section entrance;
- parallax;
- decorative looping animation (the skeleton sweep is the only loop);
- flashing rarity effects.

## 12. Accessibility baseline

Target WCAG 2.2 AA behavior for V1.

Requirements:

- semantic HTML first;
- visible keyboard focus;
- keyboard-operable controls;
- dialogs and popovers manage focus correctly;
- icons have accessible names where needed;
- form controls have labels;
- errors are programmatically associated;
- color is never the only state indicator;
- reduced-motion preference is respected;
- pointer and touch targets are comfortably usable, with primary mobile actions around 44px minimum target dimension when feasible;
- contrast is checked in both normal and muted states.

Prefer accessible primitives, for example Radix-backed shadcn components, instead of reimplementing dialogs, menus, popovers, tabs, and focus traps.

## 13. Responsive behavior

Design from workload classes rather than device names.

### Narrow

Student phone use. Prioritize current action and summary. Collapse secondary metadata.

### Medium

Tablet or small laptop. Sidebar may collapse; tables simplify.

### Wide

Teacher and Admin workstation. Use denser tables, split panes, filters, and persistent navigation.

Do not make desktop simply the mobile layout with more whitespace.

## 14. Copy and tone

CampusQuest copy should be concise, calm, and action-oriented.

Prefer:

- 当前可获得 160 积分
- 提交未通过校验，请修正 3 项问题
- 老师已退回修改，奖励档位已保留

Avoid:

- punitive framing such as 你被扣除 40 分;
- game slang in serious review or security flows;
- vague errors such as 操作失败;
- fake urgency.

## 15. Figma workflow

Figma is an optional design workspace, not the runtime source of truth.

Recommended reference frames:

1. Student Dashboard
2. Task Detail and Claim
3. Submission and Validation Report
4. Rankings and Around Me
5. Teacher Review Queue and Review Detail
6. Admin Dense Table and Confirmation Dialog

Figma components and code components should share names where practical.

Design tokens ultimately live in code. If Figma and repository tokens disagree, resolve the intended source deliberately rather than allowing silent drift.

## 16. Visual review checklist

Before frontend work is accepted, inspect at minimum:

- desktop and narrow viewport;
- normal, loading, empty, and error;
- long Chinese nickname and task title;
- long keyword;
- zero and very large point values;
- deadline under 4h;
- revision state;
- keyboard focus order;
- no sensitive identity leakage.

See docs/quality/quality-gates.md for the full gate.

## 17. Approved student-task sample restoration (2026-10-17)

The owner-approved `innovation-round-1` home/tasks/task/active-claim/claim samples
are the presentation authority for this migration. Their quiet typography and
surfaces supersede the older bold hero and timeline treatment above. This is a
restoration of the accepted samples, not a new visual direction. Verification
and remaining limitations live in `ui-migration-verification.md`.

- Student home/discovery/detail use1046px maximum content width; own-claim work
  uses966px. Insets follow the actual sample CSS:42px normally,28px at
  1024–1250,25px below1024,17px below640 and14px below360. Preserve the existing
  adjustable app rail and its gates. The approved default is200px (administrator208px); saved user widths, including232px, remain authoritative. Collapse/drag/keyboard/root-font scaling remain intact.
- Discovery cards use two columns from640px and one below. Titles are normal
  sans19/18/17px across the sample breakpoints, with a quiet rarity glyph and
  text, separate metadata and rating lines. RARE/EPIC use approved border and
  surface tokens; NORMAL stays neutral and the four non-color shapes remain.
  The title's real link covers the full card, with a primary keyboard outline;
  a permanent underline is not the card affordance.
- Page/work h1 retains the display family; card and action h2 remain sans.
  Home uses one subdued next-action surface, an asymmetric wallet/rank band,
  and thin own-claim rows. The phone action fills its container.
- Task description precedes decision facts and the action in both source and
  visual reading order. Decision widths are280px/255px and stack below640px.
  Assignment identifiers appear only after a real allocation.
  The allocated platform/keyword/status use inline facts and quiet dividers,
  rather than three nested boxes inside the decision surface.
- Own work uses five compact top-rule stages, a neutral facts surface, revision
  context first, and the complete server reward verdict. Native file selection,
  upload/finalize recovery, validation reports and status announcements retain
  their actual contracts. Never copy sample numbers, deadlines or status logic.
  Anchor the visually hidden native picker inside its visible control group;
  keyboard focus must scroll its visible label clear of the fixed phone nav.
- Discussion stays on task detail. Identity choices remain native radios with
  an explicit anonymous preview; long text, deleted-parent context, replies,
  counters, reactions and rating keep their accessibility and privacy behavior.
  The existing filled CommentGallery uses the same presentation scope.

## 18. Approved rewards and growth restoration (2026-10-17)

Use the approved `growth.css` followed by its final `compact.css`, rather than
the older59px ranking density. The T5 family shares student content insets and
1046px content width while retaining the existing shell/navigation contracts.

- Growth-family display h1 is37px normally,31px on phone and29px below360px.
  Account-info keeps its already-verified T3 presentation; only the growth tab
  takes the new composition. Existing management and logout destinations remain.
- Wallet data stays spendable/available/earned with explicit frozen/debt facts.
  The46px/43px balance may wrap for extreme values. A next-reward strip uses
  existing server-derived presentation helpers, not a sample balance or target.
- Reward titles are normal18px/17px. Description and conditions span both grid
  columns, then price and action share the final row. Buttons have66/64/60px
  width bands and44px hit height; the shared30px visible frame remains. Native
  list indentation is removed. Unavailable and insufficient states remain true.
- Readonly ranking rows normally35px desktop/36px phone. Long nickname/honor,
  large rank and score values grow naturally. This rule never sizes action rows.
  Reuse DividedSections for the two independent ranking groups, with the divider
  centered in the6:5 gutter, full parent height and hidden in one-column mode.
- Notifications use the approved#f8f6f0 unread surface, explicit unread wording
  and event glyph/type. Preserve full long content,44px mark-read actions and
  inline error recovery. The filter and count share one quiet toolbar; its h2
  remains available to assistive technology. Existing filtering/rollback owns state.
- Growth shows all six server metrics, on-time numerator/denominator and ratio,
  best historical month and readonly owned honors. Keep source null/zero meanings.
  The sample's honor selection control is omitted because no such API exists.

Current verification and remaining manual QA are tracked in the migration record
and `test-matrix/frontend-growth-ui.md`; these rules do not imply owner acceptance.
T5 notification and readonly-honor illustrations reuse the approved local SVG stroke paths and muted tile/medal tokens. Visible event/type text remains authoritative; unknown events keep their generic label and bell illustration. Only `.notif-item .notif-time` receives inbox11px styling; the shared default remains13px, while the approved teacher-review queue explicitly uses12px; neither inherits the11px inbox rule.

## 19. Approved public innovation restoration (2026-10-17)

Use R5 completion for the discovery home, public recruitments and project detail;
the earlier innovation reading samples remain the source for achievements and
talents. `PublicDiscoveryFrame` is presentation only. The campus session gate,
real resource IDs, public snapshots and command/version ownership stay in the
existing feature islands. Private editors and staff forms do not inherit it.

- The six public destinations form one compact navigation row on phone. The
  three-library strip leads to projects, talents and mentors. Home previews use
  at most three results in server order, with real full-directory links.
  The role reading sample retains its direct return link without adding this
  category bar. Directory headers use the overview tab to return to discovery.
- Project search stays visible; its advanced filters expand from a real button,
  start open when the URL contains advanced filters, and retain native GET/Enter
  submission and clear behavior. R5 recruitment retains its full visible filter.
  Talent state/material selects share a phone row; native skill details retain
  the five-tag/all-selected-tags contract and keyboard summary/checkbox order.
- Home has equal achievement/recruitment feeds and a divider spanning the taller
  group. Project detail has recruitment on the left, approved achievements on the
  right and confirmed mentors below both. These groups stack below768px.
- Project, talent and achievement directory cards use two columns from640px,
  one on smaller phones,18px titles on desktop and17px on phone. R5 recruitment
  remains a quiet single list with real44px detail actions and side facts that
  move below the text on phone. Feed titles use their smaller16px scale.
- Preserve the measured heading variants: R5 bridge34/32/29px; project list38/31px;
  achievement/talent37/31/28px; role detail43/37/33px. Insets use36px bridge or42px
  reading desktop, then25/17/14px. Responsive selectors must match the bridge
  selector's specificity so desktop insets cannot override phone rules.
- Talent contact is a compact band above the reading groups, with the existing
  explicit contact action, current-version refresh and session cancellation.
  Public file downloads retain their own current-version/READY checks. The
  material marker is neutral and never claims authenticity or capability checks.
- Role facts precede its long introduction in phone source/reading order, with
  contact after the reading content; desktop places the facts and contact in
  the decision column. There is one mounted contact island in both layouts.
- Same-list project/recruitment context is a whitelist of public filters carried
  by fixed internal detail/return paths. Project child-pagination parameters are
  separate from that return context and remain the only detail API parameters.
  Achievement pagination retains its existing component-owned state.

The public migration matrix and verification record carry current evidence;
these presentation rules do not claim completed verification or owner acceptance.

## Approved private maintenance composition (T6b)

Owner profile and qualification use1.35:1 desktop columns, stacking at850px.
The inline R5 project form stays full width with the original mentor child below
its closed form. Achievement content and private proofs stay left, workflow
status right; phone order is content, proofs, status. Existing state owners and
record/account keys remain authoritative.

Controlled native textareas follow the approved content sizing: CSS bounds of
78–240px, measured after value, width and font changes. The R5 inline project's
later completion stylesheet sets a90px floor with1.5 line-height. Achievement
description starts at105px or103px below640px. Its two native rows and other source-specific
row floors remain presentation details; validation limits and pending/editing
rules remain in their original form owners. Keep native vertical resizing and
all labelled focus targets. Proof files precede upload controls; the heading's
selection count uses actual current selection without claiming verification.

Private list toolbars wrap their caption and intrinsic create action as whole
items on narrow screens. Talent skill choices use13px source typography,16px
native checkboxes and17px column gaps inside44px label targets; field labels
remain14px. The standard-skill caption stays visible. Recruitment authorized
contact values span the form width; talent contact groups retain their separate
paired desktop composition.

### R5导师样张落实（2026-10-17，当前批次待完整验证）

导师名录的姓名使用样张中21px宋体（正文仍Sans）；R5页面标题34/32/29px，14px原生填写字段，90–240px正文框、呈现rows3/2/3/2。独立双列间距28px、2px中线，768px以下改单列并隐藏中线；勾选与按钮维持44px目标。候选、旧公开、展示、联系和代维护保持各自真实版本与授权语义。

### T8教师与成果核实样张落实（2026-10-17，局部工程验证完成）

复用已确认staff源码及最后加载的layout-feedback.css。标题在1440/800/390/320px分别为34/32/29/27px；教师审核为非等宽双列，间距28px、平板20px，2px完整中线。手机选中详情后隐藏队列，原页返回并恢复原行焦点。任务列表为直线分隔，状态表头与数据同轴；手机转为可换行记录。真实新建按钮与任务标题对齐，任务配置、统计、导入、协作和社区仍在原任务详情内。

任务新建/编辑保留既有dialog，原生14px字段分为基本资料、奖励与时限、文件与校验规则。奖励/截止模式在先，真实截止/领取截止在后；所有值、错误、冻结规则及提交归属不变。权限和文件类型恢复原生复选框，44px标签目标；独立授权字段在桌面并排、手机堆叠。操作按钮保持内容宽度。

成果核实保留原路由领取与固定快照：提交项目/成果并排、核实负责人/私密证明并排，决定说明/动作分别归组。公开内容、私密材料与决策使用各自独立中线；手机单列隐藏中线并保留分组横线。队列日期只来自实际队列DTO，不为详情补造没有的时间或版次。

无Radix Trigger的受控弹窗通过useDialogReturnFocus捕获实际打开按钮及当前auth epoch；同一身份关闭时回到仍存在的按钮，已完成操作移除按钮时回到结果或列表区域。匿名身份保持显式读取，管理员揭示身份权限不等于任务治理删除权限。界面样式不能改变这些业务边界。

### Task12 approved source paint and workspace details

The measured R5-inclusive HTML/CSS controls these presentation recipes. CSS `:root` remains the only runtime token owner; all reference sRGB values below are authored as OKLCH there.

| Context | Source recipe |
| --- | --- |
| Workflow status | 11px,400,1.6 line height,3px radius,2px6px padding,no border; ink #5f6855 on #e8e9df |
| Explicit blue status | #355e82 on #e7edf0; public talent LOOKING, published private talent, accepted owner-project mentor link, UPDATE review kind and selected frozen review kind |
| Private talent visibility | Same recipe,12px; private project/recruitment and mentor states remain11px |
| Skill and mentor scope | 11px,400,1.6,3px,1px6px padding,1px #dedfd2 frame,body ink on secondary ground; long labels may wrap |
| Unread label | 10px,500,1.5,3px,transparent ground,#3c6384 ink and1px #b9c6cd frame; phone0px4px,desktop1px5px |
| Ranking self label | 10px,500,1.5,3px,1px5px padding,no border,#244f87 on #d5e0e7 |
| Qualification/whitelist consequence | 14px at phone and desktop,#45483f on #edece3,2px #afbaa4 left rule; phone9px11px/12px margin,desktop10px13px/14px margin |

The available source warning primitive #856231 on #eee6d5 fails4.5:1 (4.46455). This batch does not introduce that primitive or replace root warning alerts. A calculated one-channel alternative is diagnostic evidence only, not a shipped token or an owner visual decision.

Represented destructive triggers use the source quiet body ink/content fill and a visible frame, including hover. Their original explicit confirmation, reasons, consequence text and native targets remain; final dialog confirmation uses primary paint. Field errors and alert semantics remain independent. Staff section-heading refresh actions have frames; ordinary textual logout/back/local anchors keep their existing navigation role. Qualification table row fill is hover, not persistent selection; no selection owner is added.

Expanded rails reuse approved20px navigation SVG geometry (viewBox24,stroke1.6),26px display brand,normal14px/44px rows and compact13px/42px rows. Optional role-shell captions are 管理后台/教师工作台/导师工作区; the student operations-area caption 双创运营 describes the current area without granting capability. Source brand/caption/navigation offsets accommodate the existing40px collapse target. Saved rail width, legacy232px preference, resize and collapsed accessible names remain authoritative. The mentor's three existing destinations follow the source order; no sample-only gallery link is added.

Current route labels include the existing destination in the context bar. Inline editor context and private entity names remain owned by their page; the global header uses public route labels without additional private reads. Desktop identity uses the current session nickname and role, with only the nickname ellipsized. Verification is pending the current focused and whole-site gates; these source recipes do not assert final acceptance.


Task12 source action-ink correction (verification in progress): enabled outlined actions in campus/staff owned pages use body #45483f. Disabled controls keep their existing treatment. The mentor withdrawal trigger is an explicit source exception, #8b4f43 (OKLCH root token); its original confirmation and request owner remain. The recruitment related-project title link follows the approved inline-flex, centered 9px gap and blue 16px arrow; its actual project destination is unchanged.

Stable owned-content visual captures exclude only external fixed top/bottom shell bars. The helper first rejects an owner containing those bars and restores their visibility afterward. All actual content, status and consent controls remain captured. Existing timestamp masks and 0.01 tolerance are preserved. Shell visual cases and natural viewport/native focus checks remain separate requirements; these owned captures do not establish viewport clearance.

Reward catalogue native heading/table rhythm: no inherited section/table gap; heading tail12px at desktop/tablet and0px on phone. Actual pagination and guidance retain their own12px spacing. Source probe binds all four widths; this does not add fictional sample rows or merge the independent audited grant/revoke forms.

Visual QA excludes only external Next development tooling as well as, for owned content captures, external fixed shell bars. Production has no Next development portal. Error-overlay detection remains mandatory before exclusion. Actual natural production viewport checks retain all product navigation and are independent of these captures.


Task12 selected operations-grant field follows approved `admin.css`: `--admin-grant-reason-width:43.75rem` (700px) caps the existing reason field from640px upward; below640px it retains the available form width. The existing multiline reason, version, mandatory explanation, confirmations and command owner remain. The source-derived geometry assertion checks both field and textarea at320/390/800/1440; it first failed at750px and1172px against700px. This is a presentation bound, not a maximum text length change.


### Approved administrator context recipes (UI9)

Use measured source context: users/audit/grants labels12px muted400; users/grants controls13px from640up,14px phone. Audit text inputs and ordinary editors/import/reasons stay14px. Tableheaders9px block/10px inline padding,12px/19.2px text and#eeeee5 background; body13px/20.8px with7px block padding. Source proportions apply only from1024;640–1023 uses equal table/native-setting columns. Phone records use5px rowgap (users3px), source10px blockpadding (users9px).

Existing whitelist preview cap800px; native inline parameter editor760px. Qualification facts cap720px, independent two-column pairs with35px column gap,90px key+12px gap ondesktop; below1024 one column,80px key+10px gap. Child order remains DTO-owned name/student_no/major/grade and no wrapper/handler change. Pair gap11px except10px phone. Existing root guards, consent, read audits, immutable snapshot/version fields and real current/effective facts remain.

UI10 accessibility reconciliation: the measured header wash places the original auxiliary ink at approximately4.498 contrast. Use scoped `--admin-table-head-foreground:oklch(52.8% 0.016815 111.183896)` for administrative table and native-setting headers, approximately4.545 by color calculation (about one sRGB step darker). Keep the approved wash, dimensions and ordinary auxiliary ink unchanged. Actual axe and no-update comparison, rather than the calculation alone, supply the acceptance evidence.
