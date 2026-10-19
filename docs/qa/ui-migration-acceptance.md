# 华师令 UI 迁移验收卡

> R6 合流说明：以下为独立 UI13 工作线在 2026-10-19 的历史验收记录，已按 904 源文件与 61 PNG 的哈希固定后导入。其 build、服务端口、测试数字和忽略目录均属于 UI 线；不是当前 R6 验收证据。R6 的新鲜验证见 `innovation-collaboration-verification.md`，合流回执在 `infra/r6/.runtime/ui-import/ui13/r6-import-receipt.json`。

当前 UI12：已确认样张的分批实施、局部回归与实际上传链已收口，供小叶做最终产品验收；不声称业主已认可或全站逐像素零差异。当前构建 `ZETG8cTvkWRePtWQDM6T7`，独立预览 [localhost:3307](http://localhost:3307/login)，仍使用原模拟预览数据库/Redis2。没有提交、推送或合并。

Chrome 实际完成：CSV 导入预览/确认/发布；错误表头四项问题→正确文件→教师退回→学生修订第3版→教师通过；学生钱包/累计20分、月榜20分、worker通知及已读；成果私密PDF上传→独立运营领取/下载/首次核实通过→校内公开版排除私密证明和负责人学号；人才PDF上传→主动选择/公开预览/确认→另一校内账号下载，含材料筛选1、无材料筛选0。34份观察不等于34项测试；三个实际下载文件的字节数与SHA256均匹配上传原件，下载事件监听的超时保留为观察器失败。

新发现并修正：任务表单示例原使用解析器不支持的 `columns`，现在使用 `required_columns` 的url/title字符串列。真实后端解析器RED退出1→GREEN退出0；仅这一个静态示例字符串改变，逆向替换可精确重建UI11源文件，事件、API、权限、CSS、状态与全部61PNG不变。新生产构建里已实际核对示例并取消，没有创建额外任务。

当前验证：前端源码审计/类型/Lint/CSS/745单测178套件/覆盖率/生产构建/25矩阵八命令退出0；原npm审计脚本另在Windows官方源退出0，仅子进程覆盖registry。覆盖率 95.74 / 91.92 / 90.51，原地板95.71/91.87/90.42未变。904源码/61PNG、47实际page/64场景、218参考原件/副本重新核对；后端513与4契约不变，没有冒称重跑后端全套。完整UI8的226通过/42注册条件skip/no-skip0保留较早精确源码；UI10/11局部行为、axe和像素回执保留各自源码，UI12不把它们改标为本轮整站重跑。

主回执：`infra/ui/.runtime/t10/final-ui-12-current.json`、`manual-ui11-chrome-completed.json`、`manual-cua-chrome-ui11/actual-download-bytes.json`、`ui12-final-preview-live.json`、`manual-cua-chrome-ui12/current-placeholder-check.json`。旧失败报告、Edge/IAB观察与封存日志全部保留。当前Chrome上传成功取代旧Edge权限卡点；无需再次修改扩展权限。

明确限制：最终视觉验收仍由小叶完成；物理Apple/iOS、物理浏览器UI200%和远端CI未验证。历史代理重置原因仍未知。现有后端发布保护只检查schema非空/版本，仍会允许手工填写无效DSL发布；这是此次观察到的既有业务问题，已记录，UI迁移没有擅改后端规则。Docker重启后Beat曾报告本地schedule损坏，原日志保留；随后定时任务和实际通知已运行，不能将整份日志称为无错误。

## 小叶直接查看

- [模拟成果公开详情](http://localhost:3307/innovation/achievements/c9ffb6fd-3558-4012-ac45-554569cb43a2)：作品说明、首次/本版核实时间、所属项目；不包含私密证明。
- [带公开附件的人才档案](http://localhost:3307/innovation/talents/1bdf65cd-6368-4d84-b843-14c655f8208c)：材料标志与实际下载。
- [已完成的上传修订任务](http://localhost:3307/claims/a41d6b8f-d154-43ca-b48e-31913425ba0f)：用负责人模拟账号查看；教师从任务管理查看V2任务。
- 模拟账号及实时TOTP读取方式见本地私有 `infra/ui/.runtime/t10/manual/owner-guide.md`，不进入Git。

验收重点：按批准样张看布局、字号、间距和密度；再检查上述实际状态。发现差异时记录页面/身份/宽度/具体位置即可，不需要重新选视觉参数。

## 验收环境

项目预览：[校园活动信息整理（模拟）](http://localhost:3307/innovation/projects/b9e935f1-0762-4c8e-ad3e-518f84021c44)。当前保留模拟学生／运营会话，换账号从「我的→退出登录→确认退出」进入。专用账号与动态验证码读取方式在本地私有指引 `infra/ui/.runtime/t10/manual/owner-guide.md`；该文件不入Git。

预览使用专用数据库 `campusquest_test_ui_preview_c5476fe7dc37`、租用的空Redis2和独立worker，Next生产构建提供3307。主开发目录和R5目录的原分支/文件状态不变。所有账号、资料、联系值和积分状态均为模拟；不涉及真实奖品或消息发送。

可检查1个模拟项目、1个招募、1个人才档案及1位仍展示且同意挂名的模拟导师。另1位已完成撤回，公开页不可读、关系历史保留。现有1份模拟成果已通过独立核实；人才档案已确认公开1个模拟PDF。成果证明仍是私密材料。电脑或Docker重启后须按所有权清单恢复；不要让自动测试占用预览端口。

## 小叶的检查顺序

先在 1440px 桌面宽度查看整体，再在 390px 和 320px 查看窄屏；800px 检查中间宽度的导航和分栏。逐项比对批准源码中的布局、密度、标题、颜色、字重、状态标签、分隔线及按钮位置。长页分别看完整内容截图和保留顶栏/底栏的真实视口，完整内容截图不能替代操作是否被遮挡的检查。

| 页面族 | 从哪里进入 | 连续检查内容 |
| --- | --- | --- |
| 登录与个人空间 | `/login`、`/mentor/login`、`/staff/login`、`/profile` | 登录、切换身份、退出、个人信息/成长页签、原有 TOTP 流程；慢脚本期间不接收会被水合丢失的输入 |
| 学生任务 | `/tasks` → 任务详情 → 我的提交 | 领取、上传、校验、提交、退回后修订、再次提交；按钮和焦点完整可见 |
| 奖励/排名/通知 | `/rewards`、`/rankings`、`/notifications` | 真实积分与状态、兑换、通知已读/未读及时间；390px 同行、320px 换行遵循已确认源码 |
| 双创公共阅读 | `/innovation` 下项目、招募、成果、人才 | 六个真实入口、筛选及计数、双列中线和单列取消中线；校内显式读取联系与资料权限 |
| 负责人管理 | 个人页的负责人资料、项目、人才入口 | 资格、草稿保存和恢复、项目/招募/成果/材料、人才发布；不虚构父项目或公开数量 |
| 导师 | 导师库、本人的导师页、运营导师管理 | 候选与已确认公开版、本人授权、联系读取、项目邀请/同意/解除；最后再撤回公开授权 |
| 老师与运营 | `/teacher/tasks`、`/teacher/reviews`、`/innovation/reviews` | 实际任务配置、提醒渠道、统计、导入、协作者、退回/通过；运营的受限材料与公开内容区分清楚 |
| 管理员 | `/admin` 下现有入口 | 用户/白名单/资格/运营授权、兑换审核与发放、奖励和系统设置；保留确认、理由及服务端校验 |

每个差异记录「页面地址、身份、视口宽度、实际结果、批准参考、截图」，优先指出具体位置。验收中的真实差异会先复现并定位，再修改；不通过放宽像素容差、增加稳定内容遮罩或自动重试隐藏差异。

## 历史未完成清单（UI12 当前状态已取代以下旧状态）

- 保留整站及当前受影响回执，完成独立评审。
- 每张有意变更基线的旧/新图片、实际查看记录和差异分类；历史保留图片的字节一致证明。
- 补齐受文件选择器阻塞的实际上传/修订/审核及成果材料链；已有CUA记录与AUTO证据分列。
- 独立全量未提交差异评审、逐项裁决及需要修复的验证。
- 完成最终工作树/评审/交接状态记录；当前预览和模拟账号指引已保留。

本地门禁不代表远端 CI、小叶的最终视觉确认或物理设备验收。物理 Apple/iOS 及物理浏览器 UI 200% 放大尚未验证，不能用 CSS 宽度模拟声称通过。


## Current route/source inventory (not runtime acceptance)

47 actual page files (46 product routes plus development gallery) map to64 approved scenes. Inline dialogs, selected detail states and query-selected profile tabs remain on their real routes; no sample-only route is introduced. Source mapping and current page hashes are in `infra/ui/.runtime/t10/route-source-mapping-current.json`. This inventory alone does not prove browser coverage or production404.

| Actual route | Approved scene IDs | Actual page |
| --- | --- | --- |
| `/` | `home` | `frontend/src/app/(student)/page.tsx` |
| `/admin/audit` | `admin-audit` | `frontend/src/app/admin/audit/page.tsx` |
| `/admin/innovation-operations` | `admin-grants`, `admin-grant-detail` | `frontend/src/app/admin/innovation-operations/page.tsx` |
| `/admin/owner-qualifications` | `admin-qualifications`, `admin-qualification-detail` | `frontend/src/app/admin/owner-qualifications/page.tsx` |
| `/admin/redemptions` | `admin-redemptions` | `frontend/src/app/admin/redemptions/page.tsx` |
| `/admin/rewards` | `admin-rewards`, `admin-reward-editor` | `frontend/src/app/admin/rewards/page.tsx` |
| `/admin/system` | `admin-system` | `frontend/src/app/admin/system/page.tsx` |
| `/admin/users` | `admin-users` | `frontend/src/app/admin/users/page.tsx` |
| `/admin/whitelist` | `admin-whitelist`, `admin-whitelist-preview` | `frontend/src/app/admin/whitelist/page.tsx` |
| `/claims/[claimId]` | `submission`, `revision`, `active-claim`, `review-claim` | `frontend/src/app/(student)/claims/[claimId]/page.tsx` |
| `/dev/gallery` | development-only real components; production404 required | `frontend/src/app/dev/gallery/page.tsx` |
| `/forgot-password` | `r5-auth-forgot` | `frontend/src/app/(auth)/forgot-password/page.tsx` |
| `/innovation` | `r5-innovation-home` | `frontend/src/app/(campus)/innovation/page.tsx` |
| `/innovation/achievements` | `achievements` | `frontend/src/app/(campus)/innovation/achievements/page.tsx` |
| `/innovation/achievements/[achievementId]` | `achievement` | `frontend/src/app/(campus)/innovation/achievements/[achievementId]/page.tsx` |
| `/innovation/mentors` | `r5-mentors` | `frontend/src/app/(campus)/innovation/mentors/page.tsx` |
| `/innovation/mentors/[id]` | `r5-mentor` | `frontend/src/app/(campus)/innovation/mentors/[id]/page.tsx` |
| `/innovation/mentors/me` | `r5-mentor-me` | `frontend/src/app/(campus)/innovation/mentors/me/page.tsx` |
| `/innovation/operations/mentors` | `r5-mentor-operations` | `frontend/src/app/(campus)/innovation/operations/mentors/page.tsx` |
| `/innovation/operations/mentors/[id]` | `r5-mentor-maintain` | `frontend/src/app/(campus)/innovation/operations/mentors/[id]/page.tsx` |
| `/innovation/projects` | `projects` | `frontend/src/app/(campus)/innovation/projects/page.tsx` |
| `/innovation/projects/[id]` | `r5-project-mentor`, `project` | `frontend/src/app/(campus)/innovation/projects/[id]/page.tsx` |
| `/innovation/recruitments` | `r5-recruitments` | `frontend/src/app/(campus)/innovation/recruitments/page.tsx` |
| `/innovation/recruitments/[id]` | `role` | `frontend/src/app/(campus)/innovation/recruitments/[id]/page.tsx` |
| `/innovation/reviews` | `operations-reviews`, `operations-review` | `frontend/src/app/(student)/innovation/reviews/page.tsx` |
| `/innovation/talents` | `talents` | `frontend/src/app/(campus)/innovation/talents/page.tsx` |
| `/innovation/talents/[id]` | `talent` | `frontend/src/app/(campus)/innovation/talents/[id]/page.tsx` |
| `/login` | `r5-auth-login` | `frontend/src/app/(auth)/login/page.tsx` |
| `/logout` | `r5-auth-logout` | `frontend/src/app/(auth)/logout/page.tsx` |
| `/mentor/login` | `r5-mentor-login` | `frontend/src/app/(auth)/mentor/login/page.tsx` |
| `/notifications` | `notifications` | `frontend/src/app/(student)/notifications/page.tsx` |
| `/profile` | `r5-account`, `profile` | `frontend/src/app/(student)/profile/page.tsx` |
| `/profile/owner-profile` | `owner` | `frontend/src/app/(student)/profile/owner-profile/page.tsx` |
| `/profile/project-drafts` | `r5-project-mentor-editor`, `my-projects`, `project-editor` | `frontend/src/app/(student)/profile/project-drafts/page.tsx` |
| `/profile/project-drafts/[projectId]/achievements` | `my-achievements`, `achievement-editor` | `frontend/src/app/(student)/profile/project-drafts/[projectId]/achievements/page.tsx` |
| `/profile/project-drafts/[projectId]/recruitments` | `my-recruitments`, `recruitment-editor` | `frontend/src/app/(student)/profile/project-drafts/[projectId]/recruitments/page.tsx` |
| `/profile/talent-profile` | `talent-editor` | `frontend/src/app/(student)/profile/talent-profile/page.tsx` |
| `/rankings` | `rankings` | `frontend/src/app/(student)/rankings/page.tsx` |
| `/register` | `r5-auth-register` | `frontend/src/app/(auth)/register/page.tsx` |
| `/rewards` | `rewards` | `frontend/src/app/(student)/rewards/page.tsx` |
| `/staff/invite/[token]` | `r5-staff-invite`, `r5-staff-security` | `frontend/src/app/(auth)/staff/invite/[token]/page.tsx` |
| `/staff/login` | `r5-staff-login` | `frontend/src/app/(auth)/staff/login/page.tsx` |
| `/tasks` | `tasks` | `frontend/src/app/(student)/tasks/page.tsx` |
| `/tasks/[taskId]` | `task` | `frontend/src/app/(student)/tasks/[taskId]/page.tsx` |
| `/teacher/reviews` | `teacher-reviews`, `teacher-review-detail` | `frontend/src/app/teacher/reviews/page.tsx` |
| `/teacher/tasks` | `teacher-tasks`, `teacher-task-editor` | `frontend/src/app/teacher/tasks/page.tsx` |
| `/teacher/tasks/[taskId]` | `teacher-task`, `teacher-community` | `frontend/src/app/teacher/tasks/[taskId]/page.tsx` |
