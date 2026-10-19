# UI13 全站样张最终视觉验收

> R6 合流说明：以下为独立 UI13 工作线在 2026-10-19 的历史验收记录，已按 904 源文件与 61 PNG 的哈希固定后导入。其 build、服务端口、测试数字和忽略目录均属于 UI 线；不是当前 R6 验收证据。R6 的新鲜验证见 `innovation-collaboration-verification.md`，合流回执在 `infra/r6/.runtime/ui-import/ui13/r6-import-receipt.json`。

本轮已逐页对照 64 个已确认场景并修复 38 类差异，代理视觉验收完成。当前本地生产构建 `V8JzxuP4maLL5qPrfNrwM`，预览 [localhost:3307](http://localhost:3307/login)，沿用原模拟数据库与 Redis2。没有提交、推送或合并；不推断小叶已认可最终效果，也不声称全站逐像素零差异。

当前同一份 904 文件源码：前端六命令退出0，745单测/178套件/0skip；覆盖率95.76/91.92/90.51，高于原门槛95.71/91.87/90.42。页面组49、状态组16、视觉六组34用例均通过，0skip/flaky。25矩阵通过，595受保护文件/57纯函数/548原有JSX回调审计通过。后端保持原字节，没有重跑后端全套或远端CI。

截图以立即前序 UI12 的61份基线为起点，仅更新其中 24 份已逐张查看新旧图、全部分段及差异图的活动基线；11份历史基线字节不变。随后六组34用例在不更新基线的情况下重新通过，原容差、掩码、字体和重试策略未放宽。旧失败报告完整保留。

保留已确认的生产适配：真实数据、空态与权限条件；44px触达与较强输入边框；真实披露及校内隐私边界；已确认的内嵌教师社区和原生弹窗映射。静态演示填充按钮、虚构计数、样张脚注不进入生产。Chrome生产检查已完成，加载骨架截图已剔除并用加载完成的390px档案页替换。原运营生产队列为0份，已完成单按规则移出待办；生产仅记录真实空态。领取详情及负责人资料标题已在本轮同源码隔离场景的桌面/手机自然滚动截图中实看，不改标为生产实看。物理Apple/iOS和浏览器UI200%未验证。

首次最终预览重建遗漏了本地 API 代理参数，前端 API 返回404而后端返回正常未登录401。只修正忽略目录中的构建参数，产品源码、已通过回归和原数据库均未改。首次构建、诊断、错误页截图及日志保留；最终构建已断言代理重写，运行检查增加同源API状态核对。

主回执：`infra/ui/.runtime/t13/final-current.json`；逐场景人工观察保留在 `review-ledger.json`，新旧像素检查在 `pixel-actual-review.json`，生产观察在 `production-final-check.json`。这些回执各自保留真实源码绑定，不把历史截图改标为当前构建。

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
