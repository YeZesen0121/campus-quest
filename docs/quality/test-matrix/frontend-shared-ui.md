# 共享视觉基础规约对账

> R1–R6 集成：以下 UI 历史数字保留其源工作线和阶段，不能视作当前整合版通过。298 路径处置见 ../ui-integration-disposition.md；当前回执见 ../r1-r6-ui-integration-verification.md，最终 H 门禁与远端 CI 分别记账。

Task12 正在重新收口：以下旧批次通过记录是该批次历史证据，不代表当前整站验收；最终证据以 Task12 新日志为准。

依据：`2026-10-16-whole-site-ui-migration.md` T1/T2及第1/3节。预期已在批准计划和Task3 brief中先于测试记录；本表对账实际证据。仅呈现层，不改身份、API或业务状态。

| # | 规则引用 | 预期行为 | 测试位置 | 状态 |
| --- | --- | --- | --- | --- |
| UI1 | T1 token真源 | CSS/TS镜像一致，PWA主色和纸底精确回转#335d99/#f5f3ec | `frontend/src/__tests__/pwa-manifest.test.ts` | 已覆盖，实际RED9/1→GREEN10/10 |
| UI2 | T1字体 | 生产本地字体栈；Linux像素固定sans/serif/mono，Windows/Linux样本、罕见字与长姓名可用 | `frontend/e2e/visual-regression.spec.ts`；字体诊断见ui-migration-fonts.md | 流程行，两平台实际样本已走查，macOS/iOS未实测 |
| UI3 | T2独立双列 | 320/390/639单列无线，640/800/1440双列；中线由父级决定，覆盖较高列；普通字段对无线 | `frontend/e2e/ui-migration-layout.spec.ts` real controls and unequal sections | 已覆盖，六断点RED→GREEN |
| UI4 | T2表单 | label/input14px，关联错误与提示不丢失，长内容不横向溢出 | `frontend/e2e/ui-migration-layout.spec.ts` field associations / real controls | 已覆盖，实际布局与关联检查通过 |
| UI5 | T2按钮 | 可见框约30px，元素本身≥44px，邻居不重叠；透明边缘仍可点，长标签自然增高 | `frontend/e2e/ui-migration-layout.spec.ts` compact frame / real controls | 已覆盖，8项首次GREEN含触区边缘与长标签 |
| UI6 | T2Dialog | 真正Radix触发/关闭，Escape返回原触发器且焦点可见；原组件接口保留 | `frontend/e2e/ui-migration-layout.spec.ts` keyboard dialog focus | 已覆盖，键盘保留检查已通过 |
| UI7 | reduced-motion | 新按钮伪元素也关闭过渡，沿用唯一的减少动效媒体块 | `frontend/e2e/ui-migration-layout.spec.ts` reduced motion | 已覆盖，定向RED→25项联跑GREEN |
| UI8 | production画廊边界 | 新画廊只能开发可见；生产产物实际HTTP404 | `frontend/src/__tests__/dev-gallery.test.ts` | 已覆盖，本轮build产物实际HTTP404且无画廊内容，exit0 |
| UI9 | 可访问性双向棘轮 | 无新增违规，已解决的低对比度例外必须删除，不能增加豁免 | `frontend/e2e/accessibility.spec.ts` | 已覆盖，T1单独16/16，T2联跑25/25含同16项；仅保留原任务heading-order例外 |
| UI10 | 像素证据 | 61旧PNG留存；50活动截图六个独立world生成候选、逐图走查、同源码无更新比较；11历史文件不计运行覆盖 | `frontend/e2e/visual-regression.spec.ts`；其余五组见verification记录 | 已覆盖，G-7闭合；T3实际50图走查、61PNG绑定及明确来源的五组成功比较加新完整导师8；原失败保留，无新增mask/容差 |
| UI11 | 标准电池无隐藏跳过 | 新layout文件在CQ_E2E=1标准电池必跑；不新增no-skip豁免，正式完整报告再执行guard | `frontend/e2e/ui-migration-layout.spec.ts` | 已覆盖，G-8闭合；T3完整228项为187pass/41既有合法skip/0fail/0flaky，同报告正式no-skip0，未新增豁免 |
| UI12 | 样张还原不能由自有PNG代替 | 学生登录390/1440保留样张顶部品牌、独立标题、420px桌面卡/18px手机边距、29/32px标题、小按钮及卡外入口；不移植演示按钮 | `frontend/e2e/auth-reference-layout.spec.ts` | 已覆盖，登录RED/GREEN后同环境参照走查；T3本地验证完成，用户仅认可接近样张方向，非全站视觉验收 |
| UI13 | T3身份入口样张 | 注册/找回/员工登录/邀请/导师登录/退出均有卡外标题和紧凑主动作；找回/邀请步骤条随真实步骤；手机号与发码动作手机仍并排 | `frontend/e2e/auth-reference-layout.spec.ts` | 已覆盖，入口14项当前完整电池通过；320/390/800/1440实页面与样张并排走查完成，真实流程保留 |
| UI14 | T3账号样张 | 头像/昵称与手机/邮箱各自独立两列，手机单列；密码三字段一组；表单不套重卡、短提交；邮箱字段满列宽，URL标签为下划线 | `frontend/e2e/workspace-reference-layout.spec.ts` | 已覆盖，独立两列与满列邮箱RED/GREEN；四断点账号生产对照及自然底部操作均已走查，无溢出/遮挡 |
| UI15 | T3导航不变量 | 390/639/640/800/1023/1024/1440可达且仅一个当前项，手机五槽与完整菜单、Escape焦点返回；保留可调侧栏 | `frontend/e2e/workspace-reference-layout.spec.ts`；`sidebar-collapse.spec.ts` | 已覆盖，七断点及侧栏原回归在当前完整电池通过，手机五槽/完整菜单保留；历史等待传输原因未宣称修复 |
| UI16 | T3安全流程保持 | 员工邀请真实密码→TOTP确认→8个恢复代码仅一次→确认后移除；MENTOR不挂载学生/管理工作区；退出失败不假成功 | `frontend/e2e/staff-auth.spec.ts`；`frontend/e2e/innovation-mentors.spec.ts`；`innovation-navigation.spec.ts` | 已覆盖，当前完整电池staff与退出失败场景通过，独立导师8全通过，受限子树0读取；真实TOTP/8码/确认移除保留 |
| UI17 | 员工登录辅助函数 | 已接受的认证遇慢跳转不得重复提交；只有明确认证拒绝才重新计算动态验证码；不增加重试次数或放宽超时 | `frontend/e2e/fixture-staff-navigation.spec.ts` | 已覆盖，受控RSC延迟RED→GREEN，当前完整电池两项通过，审计/no-skip0；只有明确401才重算验证码 |
| UI18 | 数据就绪前置条件 | 导航完成及本次自身读取结束后才检查业务状态；人才新建不等待不存在的文件请求，已有档案等待文件读取；保留原有断言与全局超时 | `frontend/e2e/fixture-talent-readiness.spec.ts`；`frontend/e2e/innovation-review.spec.ts`；`frontend/e2e/innovation-recruitment.spec.ts`；`frontend/e2e/cross-browser-smoke.spec.ts` | 已覆盖，真实自身读取和荣誉区就绪前置条件RED→GREEN，当前完整电池及全部8跨浏览器通过；原断言/全局超时不变 |
| UI19 | 学生登录辅助函数 | 已接受的认证等待真实导航，不因5秒URL断言提前失败；只提交一次，不新增全局超时/重试/no-skip豁免 | `frontend/e2e/fixture-student-navigation.spec.ts` | 已覆盖，真实POST200+6500ms落点延迟RED→GREEN，当前完整228及同报告guard通过，只提交一次，未新增全局超时/重试/豁免 |
| UI20 | 跨标签退出后测试就绪 | 完整新文档加载后才填写换号表单；字段持续存在，真实POST200和主页面身份/私密清理断言保留 | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖，真实脚本延迟RED证明初始化前填写会丢学号，正确等待完整导航后GREEN；新完整导师8通过，原主文档身份/隐私断言保留，产品初始化行为未改 |
| UI21 | Task12 慢脚本真实表单就绪 | 学生、导师与员工 SSR 登录框在客户端事件就绪前禁用输入与提交；受控 6500ms 脚本延迟后邮箱/账号、密码及员工二次验证值保留；原登录接口、会话和身份分流不变 | `frontend/e2e/auth-reference-layout.spec.ts` | 已覆盖：学生/导师与员工实际输入丢失 RED；final-closure-green 三类表单及原员工慢导航/一次拒绝重算验证通过，完整最终门禁待执行 |
| UI22 | Task12 actual approved tag/action paint | Ordinary workflow variants share neutral11/400/3/2x6/no-border paint; represented danger triggers stay quiet on hover with44px targets; explicit blue contexts and unread/self/skill/privateTalent exceptions use their actual source recipes | `frontend/e2e/ui-migration-layout.spec.ts`; `frontend/e2e/growth-reference-layout.spec.ts`; `frontend/e2e/innovation-private-reference-layout.spec.ts`; `frontend/e2e/innovation-public-reference-layout.spec.ts`; `frontend/e2e/innovation-review.spec.ts`; `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖（回归已编写并复现 RED）；修复后 fresh focused GREEN 进行中，整站最终门禁尚未完成 |

| UI23 | Cross-browser staff queue readiness | Real unified password login plus TOTP only if challenged; accepted landing's own GET200; named workspace with response-matched empty state or exact rows; no second navigation or timeout/retry relaxation | `frontend/e2e/cross-browser-smoke.spec.ts` | 流程行：Task4两引擎8项通过、零skip/flaky，实际均itemsCount=1；空态分支及最终H完整电池待Task6，不借用UI16旧结果 |

## 缺口明细

- G-1已闭合：伪元素媒体规则遗漏的定向RED后，25项联跑全部通过。
- G-2已闭合：本工作树生产产物实际HTTP404，未暴露画廊内容，完整日志保留。
- G-3已闭合：包含新画廊/控件的fresh axe及布局9项联跑25/25通过。
- G-4已闭合：六组候选与正式无更新比较均exit0；50活动图实际走查、61库存哈希绑定通过，无新增遮罩或容差变化；11历史文件不计运行覆盖。
- G-5已闭合：最终完整206项报告165pass/41合法skip，9项layout全通过；正式no-skip对同一完整报告exit0，无新增豁免。
- G-6已闭合：新建/已有档案延迟回归及四项原失败场景共6项定向通过，原断言保留；当前源码全套收尾仍见G-8。
- G-7已闭合：实际50活动图走查/61库存绑定，五未受影响成功world加新完整导师8的显式来源比较通过；四断点32并排图与4底部视口图已走查，旧失败与取景局限保留。
- G-8已闭合：当前完整228项187pass/41既有合法skip/0fail/0flaky，同一完整报告正式no-skip0；见t3/accepted.json。旧代理500原因仍未知，不把通过归因于未实施的传输修复。
