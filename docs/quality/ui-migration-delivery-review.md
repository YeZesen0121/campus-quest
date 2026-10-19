# UI14 代码评审与交付收尾

> R6 来源归档：本文记录独立 UI 工作线的历史评审与其本地方案。R6 仅合入四个已核对测试修复及相应规范；未导入 UI 的提交方案/PR 草稿。本文不代替 R6 当前验证或最终独立评审。原完整回执已固定在忽略目录 infra/r6/.runtime/ui-import/ui13/。

本轮按顺序完成未提交差异评审、问题修复与本地交付整理。独立评审覆盖开始时全部287项变更；确认两项P2测试契约问题，验证时另定位一个直接登录等待问题，均已关闭。只修改四份E2E测试及说明文档，产品源码、后端实现、依赖/接口契约和61份PNG未改；原预览继续运行。没有提交、暂存新内容、推送、合并或创建远端PR。

目录：`C:/Users/111/Documents/CodexWorktrees/campusquest-ui-migration`；分支`codex/ui-migration`；HEAD仍为`5813bb4e83ec328229b1b26b2edff1ef40abdef7`。保留原54项已暂存路径；当前未提交内容按文件方案列出，不能将HEAD误当成已包含UI的提交。

## 发现与修复

| 项目 | 实际问题与最终处理 | 证据 |
| --- | --- | --- |
| R1 / 独立评审P2-1 | 延迟导航fixture、跨标签围栏、冷启动仍找旧“我的主页”；同步精确一级标题“首页”，任务页用精确“任务广场”，状态分类读main h1；旧身份/迟到响应/单刷新断言保留 | 实际RED包含三处旧标题失败；最终8项联跑通过 |
| R2 / 独立评审P2-2 | 教师队列已批准12px，隔离测试仍一律断言13px；改为教师12px/管理员用户13px，保留学生收件箱11px隔离，同时同步GR7、设计规范和选择器契约 | 实际RED为Received12px/Expected13px；两个真实角色页面GREEN |
| R3 / 验证中发现 | 跨标签直接登录从点击起只等5s；真实POST已200耗时4624.6ms，后续/me和首页均200但导航越过旧等待。跨标签与冷启动复用现有loginThroughUi，先确认200再等实际导航 | 第一轮8项7过1失败，网络trace保留；最终8项全部通过；无新增重试或全局超时改动 |

四份文件：`frontend/e2e/{fixture-student-navigation,auth-cross-tab-fence,auth-wave-invariant,growth-style-isolation}.spec.ts`。首项与第二项为独立评审发现；R3为执行者的运行诊断。未对修复后版本再冒称一次独立APPROVE。相对评审开始的最小补丁为`infra/ui/.runtime/t14/fix.diff`。

## 本轮新运行

| 检查 | 本轮结果 | 完整回执/日志 |
| --- | --- | --- |
| 定向E2E，5个spec、1worker | 8通过，0skip/flaky/unexpected | `infra/ui/.runtime/t14/review-green-2/{result,report,source}.json`及`browser.log` |
| typecheck / lint / check:css | 各退出0 | `infra/ui/.runtime/t14/fresh-checks/results.json`与对应完整日志 |
| 前端单测 | 745通过，178套件，0失败/跳过 | `infra/ui/.runtime/t14/fresh-checks/test-unit.log` |
| 覆盖率棘轮 | 95.77/91.92/90.51；原地板95.71/91.87/90.42未改 | `infra/ui/.runtime/t14/fresh-checks/coverage-ratchet.log` |
| 真实PostgreSQL奖励/模板world清理 | CQ_E2E=1下2通过、0skip，验证自有创建删除及他人编辑记录保留 | `infra/ui/.runtime/t14/backend-enabled/{result.json,pytest.log}` |

运行环境边界：预览3307/8307及其原数据库/Redis2保持；诊断用3337/8337、UI测试库和Redis1，独立Linux临时源码/.next。前两次快照Turbopack启动分别因依赖软链接根和首次编译180s超时退出，均0用例，不当作RED证据；之后使用同版本Next16.4.0的Webpack开发模式做本轮窄范围语义检查。产品next.config未改，原生产构建是UI13已有产物。没有用Webpack结果冒称当前Turbopack全量门禁。

实际RED `review-red-3` 为1过5失败：三处旧标题、一处字体、一个提前5s导航等待；`review-green`为7过1失败；最终`review-green-2`为8过。所有失败、trace与完整日志保留，未更新PNG、mask、容差、重试策略或覆盖地板。没有把focused报告当正式全量no-skip报告。

后端初次调用虽退出0，完整日志实际为2项条件skip（未设CQ_E2E），不能计入通过；原fresh-checks记录不改写，已另以旗标开启及“2passed且无skip”的严格语义检查重新验证。CSS guard退出0并保留3项既有未引用候选告警（invite-flow/avatar-chip/hero-row），没有宣称零告警或据此进行无用户影响的样式清理。

最终规约矩阵、Git差异/文件归组、源码/PNG和原预览核对回执在`infra/ui/.runtime/t14/final-checks.json`、`final-native.json`和`completion-audit.json`；这些最终回执在交付前实际生成并检查，不能只据本段预告判断通过。

## 延续的UI13证据

[UI13视觉验收](ui13-final-visual-acceptance.md)记录64场景、38类差异、390/1440实际对照及320/800布局边界；49页面场景、16状态场景、六组34无更新像素用例属于UI13当时精确源码。UI14四份测试文件与说明变更单独绑定，不把旧运行改标为本轮重跑。产品源和61PNG字节保持，故沿用原构建`V8JzxuP4maLL5qPrfNrwM`，没有重复重建或清空原模拟预览。相对R5的50张PNG变化与UI13相对UI12的24张更新分别记账，11张历史图保持。

UI8完整电池226过/42注册条件跳过/no-skip0保留为历史；本轮未重跑当前全量E2E、后端全套、远端CI、真实Apple/iOS或浏览器UI200%。代理评审和本地绿色不推断业主认可、远端审查APPROVE或可直接合并。既有手工填写无效DSL仍可能发布的后端风险保留在原验收卡，未通过UI修订擅改发布规则。

## UI/UX与有意保留的边界

复用ui-ux-pro-max及其CampusQuest适配，按焦点遮挡、错误关联、手机表格/长内容、固定栏、安全区、减少动效与React effect清理定向检索；执行者6次、独立评审3次，不生成新设计系统。Web Interface Guidelines参考来自官方`https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`；Next快照根解析诊断参考官方`https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack`。通用原生平台单位、默认16px或dark-mode建议不覆盖已批准Web样张。

独立评审考虑后未列为缺陷的项目逐项核对如下；没有悄悄延期的本轮Minor：

| 项目 | 处理依据 | 判断错误的代价 |
| --- | --- | --- |
| 新首页标题/教师12px | 已确认样张，修测试不退回产品 | 退回会破坏已确认视觉 |
| 生产队列0份 | 已完成单按原规则移出；详情用明确隔离证据 | 为截图造业务状态会误导验收 |
| 画廊极端内容 | 测试实组件，不替代真实数据与权限 | 混同会虚构用户资料/数量 |
| 新邀请与解除条件不同 | 原业务分别拥有，未绕过执行路径 | 合并条件会阻止应可解除的旧关系 |
| 奖励manual-review字段 | 原后端人工履约合同，未扩展策略 | 添加不存在策略会改业务含义 |
| reduced-motion旧位置注释 | 以实际媒体规则和动效行为核对，无确定新违规 | 仅挪注释无法证明可访问性 |
| 24/50张PNG计数 | 前者对UI12、后者对R5，明确比较基线 | 混同会误报更新与覆盖范围 |

完整独立报告及287项文件/SHA256附录：`infra/ui/.runtime/t14/independent-review.md`；开始清单`start-inventory.json`。独立评审覆盖原范围，四个测试修订通过RED/GREEN验证，新增交付文档由执行者检查，不冒称全部最终文件获第二次独立评审。

## 本地交付物与下一步

- 文件级提交方案（仅原 UI 工作树保存）：四组完整路径，互不重复、无遗漏，仅方案，不执行暂存或提交。
- PR标题与正文草稿（仅原 UI 工作树保存）：本地文本，尚无远端PR；先核实R5在目标分支的依赖关系。
- 原隔离工作树、预览和所有完整失败证据保留。后续提交、推送、合并继续等待小叶明确指令；本轮不触发新的审批问卷。
