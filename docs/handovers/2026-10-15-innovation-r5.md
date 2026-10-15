# R5 导师库交接

## 目标与确认边界

小叶已确认站内本人确认方案，并明确推进实施。R5包含运营录入、导师本人核对与逐项授权、授权内维护、校内查询与按需联系、暂停/撤回，以及项目负责人邀请和导师单独同意挂名。学校SSO最后处理；当前身份明确标记模拟。页面复用既有组件，整体视觉由UI规划对话收敛。没有R6、外部确认或自动合并main。

导师的姓名、单位、联系值和混合范围外变更必须作为新候选确认；待确认不替换旧公开版。暂停联系保留档案，恢复由本人执行。撤回清除维护/联系授权并撤销待定及已接受挂名，旧请求重放不能恢复。挂名不给项目编辑或证明材料权限；私有项目仍私有，公开关系沿用既有项目公开规则。

## 工作区与来源

- R5：`C:/Users/111/Documents/CodexWorktrees/campusquest-r5-mentor`，分支`codex/r5-mentor-library`，基础提交`4ace255a7cd25648c8076d835c15fbf1cfbd9612`。
- UI：`C:/Users/111/Desktop/华师令/campus-quest`，分支`codex/innovation-platform`，仅只读核对，没有修改其文件或控制服务。2026-10-15 10:46 UTC核对status为空，HEAD仍为上述基础提交。
- 产品源码10:00 UTC冻结；574份应用/迁移/前端源码与配置和dev快照`20261015T100115-f78a37`一致。其后仅修改测试夹具、覆盖率地板、证据文档及必要功能截图。
- 最新标准全站浏览器156通过/41明确豁免跳过、no-skip与cleanup退出0（104649-python-184761）；导师独立8场景/新3PNG、后端1420/1459/44、前端732单测及静态/覆盖率/构建均已通过。旧5组24项无更新参数比较全部通过（111752-python-196670），17矩阵最终复查通过（112605-python-201504）。当前只待分支提交和精确提交审阅收口。

## 入口与证据

- 设计/计划：`docs/superpowers/specs/2026-10-15-innovation-mentor-design.md`、`docs/superpowers/plans/2026-10-15-innovation-mentor-plan.md`。
- 具体验收路径、模拟身份及负责人/管理员准备：`docs/qa/r5-mentor-acceptance.md`。
- 最终门禁、失败根因及限制：`docs/quality/innovation-mentor-verification.md`。
- 新旧截图走查：`docs/quality/innovation-mentor-visual-walkthrough.md`。
- 规约矩阵：`docs/quality/test-matrix/innovation-mentor.md`，M01–M16已覆盖。
- 完整原始日志：`infra/r5/.runtime/`，该目录忽略且不提交；退出码与源文件SHA清单必须结合验证回执阅读。

持久体验环境：`https://127.0.0.1:3306`，API8306，PG16436、Redis6476 DB5、TLSMinIO9107；独立容器、源码、依赖及`.next`。测试环境另用3305/8305、PG16435、Redis6475、MinIO9105/9106及Clam3315，禁止借用UI服务。体验环境不预造导师资料、本人同意、负责人资格或项目关系。没有后台worker/Beat/ClamAV，导师同步流程可体验，其他附件/后台流程须另行配置。

## 实现与验证注意

关系私有列表显式limit/offset/total，双方202条真实PG测试验证没有静默截断。所有敏感读取使用持久审计；版本、幂等收据、当前权限和稳定锁序在服务层处理，关键不变量有PostgreSQL约束及竞态测试。

未知结果恢复仅保存在当前用户/authEpoch/workspace的页面内存，保留原body、UUID、原始输入、可读邀请对象和页码，站内导航/Back/父编辑器卸载可恢复。明确成功或4xx后清除；换号同步清空并隔离迟响应。整页刷新/关闭会警告，不能承诺关闭浏览器后恢复。

覆盖率新地板来自正式update路径，仅更新本轮相关域；CI复现仍待最终SHA，不能把本地结果写成远端CI。没有降低地板或扩大epsilon。

## 接续首先核对

1. 读取上述设计、计划、验收卡与验证回执，并读取仓库AGENTS及其质量文档。
2. 在R5目录执行`git status --short`、`git log -4 --oneline`、`git worktree list`，核对实际分支、提交、未提交变化。使用`infra/r5/dev.ps1 Status`检查体验服务，不操作UI工作目录或服务。
3. 已确认业务无需重复询问。若要承接UI整合或发布，先获得该阶段的明确授权；当前范围只交付R5，不自动进入R6或合并main。

可直接粘贴的接续提示：

```text
继续华师令R5导师库。先读取
C:/Users/111/Documents/CodexWorktrees/campusquest-r5-mentor/docs/handovers/2026-10-15-innovation-r5.md，
再核对该worktree的AGENTS、实际Git、计划和最终验证回执。
已确认站内本人确认及R5业务边界，不重复澄清；使用codex/r5-mentor-library及其独立开发/测试资源，
不改UI当前工作目录或占用其服务。已有全站视觉规划保持由UI对话收敛。
先报告当前真实状态及尚需处理的验收反馈；不自动进入R6、推送/合并main或扩展业务范围。
```
