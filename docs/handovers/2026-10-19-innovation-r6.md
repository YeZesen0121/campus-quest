# R6 本地交付与后续验收

## 当前目标与结果

本阶段交付C01–C22、稳定UI合流、R1–R6七角色操作指南、真实截图、适用本地门禁和独立评审，仅本地提交。实现、门禁和指南均已完成；独立整体及前端/指南专项评审对实施commit **9f5c03e3e8812b291c54e15e6153ef889144c2ba**、TREE **65d3427dcf3b5830a6123a55136a2eb35baf8ed0**给出 **APPROVE**，F1–F6全闭合，无未解决问题。

随后只做文档收口；最终文档HEAD的精确评审见本会话最终回复及本机忽略目录的`infra/r6/.runtime/browser/final-head-review.json`。不能用实施commit的批准推定任意未来HEAD已批准。交付时工作树干净；继续前必须实际核对，不把本记录套给后续改动。

## 目录、分支与隔离

- 工作目录：`C:/Users/111/Documents/CodexWorktrees/campusquest-r6-collaboration`。
- 分支：`codex/r6-collaboration`；基础R5：`5813bb4e83ec328229b1b26b2edff1ef40abdef7`。最终HEAD用native Git核对，文档收口不改应用、测试、契约、基线或runner。
- 聊天默认cwd可能仍是`C:/Users/111/Desktop/华师令`父目录，不是该Git仓库。fallback worktree已存在，不重建/reset；UI和R5工作树、服务保持隔离。
- WSL `CampusQuest-Dev`，`campusquest-r6-runner`；PG16438/campusquest_test_r6、Redis6478 DB0/1、MinIO9125/9126、Clam3318、Web3308/API8308。基础容器留在R6隔离栈，无仍在排队的本轮测试命令。
- 需要新验证时全部用`infra/r6/run.ps1`共用flock；新文件先native Git add进入runner清单。日志、world凭据和临时工件在`.runtime/`忽略目录，不提交。不要借UI栈、重置库或扩大清理范围。

## 已确认决定与被推翻假设

- 共同管理与本人公开姓名/分工分别邀请和同意，退出也分别处理；共管不隐式获得证明、提审、团队授权、导师管理、转让或生命周期权限。
- 原负责人无需仍具发布资格便可发起交接；接任人资格有效。证明仅按当前owner代逐份交接，主动查阅先持久审计并进入回避历史；资料变化后重新确认，旧联系与岗位不自动恢复。
- 结项只留存此前真正公开的合规介绍；私稿不借结项首次公开，治理不被恢复或更正绕过。四字段介绍先预览再明确发布，成果核实快照不改写。
- 7天只是当前工程期限配置。学校SSO最后接入；演示身份和资料均模拟，没有真实校内身份接入或使用收益验证的结论。
- 已否定沿用旧proof list供无资格owner选择交接材料：现有专用owner-only安全元数据API，旧证明权限未放宽。清理先完整DB图检查提交，再处理对象/外部设置；跨世界拒绝和中途失败可重试已有真实证据。
- 不重拍旧参考强过：61张旧PNG字节不变；R6四张新屏，加回避说明、公开成员空态两张独立参考，总67张。两个被替代的旧断言不声称通过。
- 导师矩形90−1/16384精度差已由独立Chrome受控实验验证；只换DOMRect或offsetHeight不足。最终测试严格检查CSS used/min/offset均>=90、border-box及无缩放，只允许平移。正常focused复测未复现原失帧，不把实验说成产品旅程或产品缺陷修复。

## 文件与有效证据

- [设计](../superpowers/specs/2026-10-19-innovation-collaboration-design.md)、[已完成计划](../superpowers/plans/2026-10-19-innovation-collaboration-plan.md)、[C01–C22矩阵](../quality/test-matrix/innovation-collaboration.md)。
- [操作指南](../qa/innovation-r1-r6-guide.md)：一页速查、七角色、异常恢复；20张逐图查看的原始PNG，manifest保留尺寸/SHA/真实来源和模拟范围，32个本地链接核验通过。凭据另行交付，不能照抄截图昵称登录。
- [验证账本](../quality/innovation-collaboration-verification.md)、[独立评审](../quality/innovation-collaboration-review.md)保存完整范围及历史失败。旧本文件的运行检查点可从实施commit读取，不再按旧句柄启动任务。
- 后端：1296 unit、1599 integration（另7 deselected，S3/扫描/组合smoke开启）、124 worker、51 e2e；原coverage棘轮、格式/Ruff/mypy、0042临时库正反迁移与旧数据、OpenAPI/types新鲜度及依赖审计全部退出0。
- 前端：771单测、原覆盖率95.85/92.01/90.77、typecheck/lint/CSS/build退出0。CSS三项既有deadCSS提示、npm五项既有开发链豁免保留，未声称全零告警/全零advisory。
- full4：`20261019T180659-node-245524.log`，302 collected、256 passed、46具名配置豁免、0 unexpected/0 flaky；Chromium248及Firefox/WebKit8 smoke。新鲜report保存后同锁原no-skip及外层退出0，不是全浏览器完整矩阵或零skip。
- 完整专用视觉：core16、成果核实、导航、R3招募2、R4人才4、R6四屏及mentor10均无update通过。导师最终`194132-visual-285935`为10 passed/零skip/9.7m/0；最新type`195129`、lint`195159`、26矩阵`195345`均0。
- full4后产品、backend和runner仍等于冻结TREE `6f8f28148c521f555b348f0272382c08246d13fd`；仅两份默认具名skip的专用视觉case及一张新参考变化，已完整重跑相应world及静态。native最终源码审计TREE与实施commit一致；未用focused报告替代默认no-skip。

## 未完成、边界与下一步

本阶段没有未完成实现、指南缺图、待修测试或用户待确认问题。没有push、merge、PR、远端CI或部署；owner对合并后main的产品验收属于后续阶段，不把本地通过当作其结果。非目标SSO、完整治理工作台、可选wave/fence诊断未借本轮扩大范围。

新对话首先在上述独立工作树执行native `git status --short`、`git branch --show-current`、`git log -3 --oneline`和`git rev-parse HEAD`；再读验证账本、评审和指南，核对实际源码及最终HEAD批准。若有新改动，不把旧门禁当新改动通过。后续阶段由小叶的新指令决定，不自动推送或合并。

## 可直接粘贴的启动提示

```text
继续华师令R6后续工作，先读：
C:/Users/111/Documents/CodexWorktrees/campusquest-r6-collaboration/docs/handovers/2026-10-19-innovation-r6.md
本阶段已完成本地实现、完整适用门禁、七角色20图指南及独立评审；先实际核对工作目录、分支、HEAD和未提交改动，再读验证与评审记录，报告当前可验证状态，等我指定下一阶段。复用已确认设计，不重新Grill-me，不重做已完成实现，不动UI/R5工作线，不自动推送、创建PR或合并。不要把旧日志、模拟账号或本地通过说成远端CI、学校SSO或真实使用结果。
```
