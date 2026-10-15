# R5 导师库验证回执

2026-10-15 11:28 UTC，本地门禁全部通过；正在完成分支提交和最终提交审阅。以下是实际结果，不表示远端CI或人工业务验收。

## 隔离与范围

worktree：`C:/Users/111/Documents/CodexWorktrees/campusquest-r5-mentor`；分支 `codex/r5-mentor-library`；基线 `4ace255a7cd25648c8076d835c15fbf1cfbd9612`。UI checkout 与服务未操作。无 R6、SSO、外部确认、全站主题或自动 main 合并。

一次性测试项目 `campusquest-r5`：PG16435、Redis6475、MinIO9105/9106、ClamAV3315、Web/API3305/8305。持久体验项目 `campusquest-r5-dev`：独立 PG16436、Redis6476 DB5、TLSMinIO9107、Web/API3306/8306，独立源码快照、Python/Node依赖和.next。说明见 `infra/r5/{README,DEV}.md`。

`infra/r5/run.ps1` 保留完整 stdout/stderr 至 `.runtime/logs/`，并报告 RUN/LAUNCH/DOCKER_EXEC 三层退出码。容器私有 Git index 仅供扫描当前源文件；原生宿主 Git 负责分支、评审和提交。聊天输出截断不代替原始完整日志。

## 已取得的最新结果

除特别标明外，以下日志均相对 `infra/r5/.runtime/logs/`。

| 检查 | 实际结果 | 日志 |
|---|---|---|
| 独立后端完整unit/workers | 1420 passed，2项既有警告，305.96s，退出0 | `.runtime/final-independent-backend.log`（相对 `infra/r5/`） |
| 独立后端完整integration，无-m、全部smoke旗标 | 1459 passed，29项既有警告，1286.43s，退出0 | 同上 |
| 独立后端branch coverage地板 | 全部通过；innovation 97.8、notifications 95.0；唯一数据库/桶、Redis DB3清理PASS | 同上；源码清单 `.runtime/final-independent-proof/tested-source.json` |
| 后端导师focused | 64 passed，fresh branch coverage；早于上述独立全套 | `20261015T080950-backend-76871.log` |
| 新边界、真实PG挂名/撤回竞态、真实storage | 34 passed | `20261015T080122-backend-75010.log` |
| 原未标integration的补充测试 | 7 passed | `20261015T080230-backend-75117.log` |
| 后端e2e、空库迁移往返 | 44 passed，210.44s；upgrade/check/downgrade/re-upgrade/check PASS，各退出0；该流水线随后因import-order在静态步骤停止 | `20261015T092535-python-148484.log` |
| 最终后端format / lint / mypy、矩阵检查 | 496文件格式通过、lint通过、mypy 221源通过、17矩阵通过；退出0 | `20261015T093851-python-161695.log` |
| audit、OpenAPI/TS新鲜度、env/Git/context/runtime自证 | pip-audit通过；npm既有5项high均有未过期豁免，无未获准high/critical；契约、环境、1138文件私有Git、全新浏览器context、真实PG/Redis/HTTP-TLS存储及CORS均PASS | 同上 |
| 冻结后前端typecheck / lint / CSS / unit / coverage / build | 全部退出0；732 passed、0 skipped，33.16s；lines95.70/branches91.87/functions90.42，未降低95.21/91.22/90.19地板 | `20261015T100035-node-168512.log` |
| 导师完整浏览器7场景 | 7 passed，4.6min，无skip；含长内容、mobile、键盘、axe、双方分页和未知结果重试 | `20261015T085322-visual-135835.log` |
| 最终导师8场景及新3PNG | 8 passed，4.7min，0 skipped；包含同文档导航/Back、父列表卸载、创建恢复、跨标签清理、长内容、键盘/axe/分页，真实接口+明确标记的客户端契约夹具 | `20261015T101640-python-175360.log`；`.runtime/final-mentor-proof/`已原子存档 |
| 旧上传端口/技能参考数据定向复验 | 成果闭环、人才卡片、已上传字节不重复PUT三项全部通过，2.9min、0 skipped，cleanup PASS | `20261015T104247-python-183406.log` |
| 最终完整标准浏览器及no-skip | 156 passed、41明确豁免skip，0 failed/0 flaky，28.2min；Chromium完整功能及Firefox/WebKit冒烟，测试/no-skip/数据库清理均退出0 | `20261015T104649-python-184761.log`；`.runtime/final-standard-proof/report.json`已原子存档 |
| 最后E2E夹具变更后lint | eslint全部通过，RUN/LAUNCH/DOCKER_EXEC均0 | `20261015T104605-frontend-184715.log` |
| 旧视觉受控采集 | 限定场景4 passed；58张旧图中4张更新、54张SHA不变，均人工及独立审阅 | `20261015T111532-python-195639.log`；`.runtime/functional-visual-proof/png-inventory.json` |
| 最终旧5组视觉，无更新参数 | 16基础屏+1审核+1导航+2招募+4人才=24 passed，0 skipped/failed/flaky；五组退出均0，独立库cleanup PASS，完整流水线退出0 | `20261015T111752-python-196670.log`；`.runtime/functional-visual-proof/final-compare-stats.json` |
| 最终矩阵 | checked 17 matrix files OK，三层退出0 | `20261015T112605-python-201504.log` |
| CSS guard子仓库夹具修复 | 原5失败已定向5 passed，退出0 | `20261015T093523-tsx-160442.log` |
| 三张导师新PNG比较 | root已人工查看，无遮挡/无横溢；lifecycle比较1 passed，2.1min | `20261015T094156-visual-162875.log` |

独立后端记录使用单独源码快照、唯一数据库/桶及Redis DB3，避免其他流水线污染测试世界；资源清理成功。该轮后端源码证明位于 `infra/r5/.runtime/final-independent-proof/tested-source.json`，其后后端仅调整 `test_mentor_link_boundaries.py` 的import顺序，后端产品源码未变。前端recovery修复由上述前端和导师8场景另行验证，不在这次后端证明范围内。

最终导师8场景覆盖新页面导航恢复问题；全站标准156项及正式no-skip、旧5组24项无更新参数比较分别取得成功结果。旧图走查保留开发徽标及历史字重差异的观察与边界，见独立视觉记录，不把全部像素差异写成纯内容位移。

## 已定位的回归及处理

- 运营私有详情缺durable读取审计：RED2（`065838-backend-14273`）；GET/PATCH账号锁序逆序的真实PG死锁：RED1（`070017-backend-14300`）。修复后的定向12项通过（`072111-backend-17914`），最终focused64覆盖。
- 关系私有列表静默截断200条：RED2（`071752-backend-16920`）；明确分页后双方202条PG通过。浏览器缺分页RED（`071904-playwright-16947`）、资料操作重建workspace丢未知请求RED后修复；最终7场景验证原body、页码、重试和刷新。
- 已失效导师角色仍可收到私有项目摘要：RED1（`075930-backend-74872`），当前角色guard后后续focused/边界通过。
- 原真实S3 worker夹具写死另一套MinIO、storage smoke写死UI来源3000：首次完整unit 1419/1、integration 1413/1/7deselected。夹具尊重调用方S3，Origin可配置但保留原/CI默认；R5明确3305且拒绝UI来源，10项storage与worker定向通过。
- 前端CSS guard的5个子仓库夹具继承外层私有Git metadata，导致完整unit首轮721通过/5失败（`082330-frontend-79727`）；为子进程移除GIT_DIR/WORK_TREE/INDEX等隔离变量，定向5例GREEN（`093523-tsx-160442`），最终全unit732通过。
- 前一轮完整integration为1451通过/7失败（`082648-backend-81822`），7失败均为通知API 401：collection冻结的_T0在长suite中超过默认15分钟access TTL。独立真实HTTP回归将_T0置为老一小时，稳定RED 401（`.runtime/notification-independent-red-final.log`，测试退出1）；改为执行时fresh clock后，独立流水线通知8例GREEN，并纳入上表1459全套。未改变产品JWT时间或TTL。迟到的旧RED包装器因为仍预期失败而外层退出2，内部实际为1 passed（`093540-backend-160790`），不是新增产品失败。
- 标准全量浏览器首轮147 passed、9 failed、40 skipped（`085816-playwright-137504`）。其中8项因新增具名status与原选择器不符，已修aria命名；另1项R4长流程超过旧超时，诊断实测87023ms通过（`093611-node-160863`），仅该测试改为180s。此诊断不代替fresh full及no-skip；40项skip也须由正式no-skip核对。
- 新P2：页面导航卸载会丢失结果未知的请求。真实纯行为6项RED后6项GREEN（`.runtime/mentor-recovery-{red,green}.log`）；同登录内存恢复与换号清空已接线，独立review未发现新的Critical/Important。扩展8场景首次6通过/2失败（`100404-python-171611`）：邀请模拟使用route.fetch再fulfill发生已结束路由错误，改成直接真实API提交首个相同body后丢回执，重试仍走原浏览器路径；换号测试假设同页不重载，但既有LogoutView明确整页replace清理Router缓存，改为在仍挂载的原页验证跨标签登出/换号。产品代码未因此修改；次轮7通过/1失败只因误用学生Shell登录链接名，按校园Shell真实名称更正后，最终8项全部通过（101640-python-175360）。
- fresh标准运行 `102248-python-177200` 在87通过、2失败时主动中断，另1中断/17跳过/90未执行；Playwright退出130、包装器退出1，数据库清理PASS，没有当作完整通过。成果上传故障夹具固定9002，未拦R5的9106而实际上传成功；改用既有S3配置origin并断言拒绝PUT确实命中一次，人才旧字节检查的同类端口也同步修复，保留“不重复PUT”的断言并核对首次真实PUT的origin。另临时freshDB脚本在迁移后TRUNCATE误删0035自带10项技能参考数据，导致PPT制作缺失；只排除迁移版本表和参考标签表，清理前后核对全部10条、关键名称与启用状态。未改迁移或产品。定向3项全部通过（104247-python-183406），fresh完整156项/no-skip也通过（104649-python-184761）。
- 首次裸pytest收集因基线unit/integration同名test_talent_headline冲突退出2（`070401-backend-15660`）；后续按CI分套，没有为此修改pytest导入机制。

覆盖率保持既有 `greenlet,thread` 和branch配置，独立最终流水线从完整unit/workers开始收集，再追加完整integration；全ratchet已通过，未降低任何地板。此前不完整套件的innovation 96.1仅为历史诊断，最终独立结果为97.8。

G19工件补记：按照既有 `innovation-checkpoint-verification.md` 的限定触域先例，在独立只读挂载、可写临时源码副本中重建原采集路径，260份后端应用/迁移SHA全部匹配；复制同一完整 `.coverage` 仅重新生成报告，没有冒称重新执行后端测试。运行正式 `coverage_ratchet.py --update` 留存18域全部候选，只采纳本R5涉及的identity 90.7→94.0、notifications 94.4→95.0，innovation维持97.8，其余已校准域及epsilon不变；把选定地板放回同一环境后正式compare通过。前端正式 `coverage:update` 产生95.71/91.87/90.42，再正式compare通过。完整日志 `.runtime/coverage-floors.log` 退出0，候选及采纳JSON在 `.runtime/coverage-floor-proof/`；两份生成工件已同步回仓库。

这些新地板是本轮实测候选，CI可重现性仍待最终SHA的CI验证。后端本轮integration无 `-m` 且开启CQ_E2E及全部smoke；CI的integration使用 `-m integration` 和相同smoke旗标，不把两者选择范围写成完全相同。若CI存在差异，先定位采集范围或具体分支漂移，不扩大epsilon、不预先降低地板。

## 独立评审与持久体验

两轮独立审阅冻结TREE `ff157d0da7413ce2b1056372ef1e8361ed1fc77d`、`0b3309d9bd3187ddce6e6b89dd72c3b2ada0584d`，均相对基线。首轮审计和锁序Important已有RED/GREEN；第二轮无新业务阻塞，指出误stage backend/.coverage，已仅移出index并补ignore，保留当前采集数据。完整TREE `137efe49edb0fdf709f1d5ac0a001911ad90adcb`及增量TREE `f157620b12505b5d05699f6227c71cf694aeb7ac`均无新Critical/Important；最终exact-head审阅仍待进行。

独立验收审计指出手工卡片先撤回会阻断后续搜索邀请，且初始环境没有已获资格的项目负责人。文档已补20250003申请、模拟管理员鲜TOTP审批、通过既有招募公开项目及最后撤回的顺序；只读复审确认无新流程阻塞，没有预先授资格或同意挂名。

独立dev最新快照为 `20261015T100115-f78a37`，10:01–10:04 UTC重新Prepare/Start/Verify退出0（`.runtime/dev-logs/20261015T100336-start-3291fb.log`、`20261015T100347-verify-74a658.log`），体验入口为 `https://127.0.0.1:3306`，API为8306。独立只读浏览器容器的运营/导师/浏览者UI登录与刷新3项通过（`dev-logs/login-refresh-final.log`）。Windows Web200；启动后首次readiness503，随后三次均HTTP200且PG/Redis为ok，原2秒探针阈值未改变（`windows-ready-final.log`）。10:11:48 UTC核对574份应用/迁移/前端源与配置文件：当前工作树、冻结清单及dev快照hash完全一致（`source-freeze-final.log`）；后续只改E2E夹具、覆盖率工件与证据文档。

10:57:25 UTC再次核对current/freeze/dev574文件，以及后端独立全套所测app/alembic260文件，SHA全部一致（`dev-logs/source-freeze-precommit.log`）。第一次辅助检查因清单路径前缀过滤错误得到backend0而退出1，保留为`source-freeze-precommit-filter-red.log`；修正为实际`backend/app`、`backend/alembic`前缀后得到260且退出0，没有改产品。11:23 UTC持久dev所有权/status退出0，Windows Web/API再次均200、PG/Redis均ok（`dev-logs/20261015T112332-status-dfb9ee.log`、`readiness-precommit.log`）。同轮只读UI Git核对status为空、HEAD仍4ace255，未修改UI工作目录和服务。

初始化仅账号和运营资格，profile0/consent0；没有预先导师确认或项目同意。dev普通Verify保留体验者暂停/撤权状态，fresh-seed检查初始状态；真实PG六项状态回归通过（`dev-verify-state-green.log`），finally恢复原值。体验步骤和明确标注的模拟账号见 `docs/qa/r5-mentor-acceptance.md`。本地检查不表示远端CI、真实学校身份核验或owner合并批准。
