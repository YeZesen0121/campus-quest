# R1–R6 与已确认 UI 集成规约对账

预期从已确认集成计划 Task2–Task7 及其上游认证规约推导；发现组合缺口时先验证失败断言，再修复实现。下表的“已覆盖”表示存在相应断言，实际执行、提交绑定和通过范围另见 r1-r6-ui-integration-verification.md；历史 R6/UI 通过数字不用于本轮验收。流程行只描述人工/来源保护步骤，不替代可执行行为断言。

| # | 触发或约束 | 独立预期 | 证据入口 | 状态 |
|---|---|---|---|---|
| I01 | 四棵来源树、R7 与旧库 | 原 HEAD、索引、未提交字节和旧资源保留；只在新树新栈实施 | 外部 source-manifest、还原副本、source guard；最终再次复核 | 流程行 |
| I02 | 错源路径、owner 或资源 | 在连接、清理及运行被测命令前拒绝 | `infra/integration/test-host-isolation.ps1`；`infra/integration/test-isolation.mjs` | 已覆盖 |
| I03 | 连续两次运行与参数转发 | 同一个世界锁内串行；argv 保留空格，子进程非零逐层传播 | `infra/integration/test-runner-lock.mjs`；`infra/integration/probe-exit.mjs` | 已覆盖 |
| I04 | 标准浏览器 battery 与 guard | 同锁执行，保存本次新报告；浏览器或 guard 任一失败均失败，拒绝旧报告 | `infra/integration/test-battery-exit.mjs` | 已覆盖 |
| I05 | 主/E2E 服务及对象存储 | 指向本栈独立服务器、库、bucket、CA；不复用来源服务 | `infra/integration/test-compose.ps1`；`infra/integration/test-playwright-env.ts`；`infra/integration/smoke-runtime.py` | 已覆盖 |
| I06 | Windows worktree 经 WSL 运行 | 私有测试索引只含本树 tracked 清单，原 .git 指针不变 | `infra/integration/test-git-context.mjs` | 已覆盖 |
| I07 | 上游迁移与双创迁移合流 | 单链唯一 head；18 项重命名完整，上游文件及原双创 DDL/操作保持 | `tests/unit/db/test_innovation_migration_graph.py` | 已覆盖 |
| I08 | migration probe 收到非测试/非归属库 | 连接之前拒绝；CI 仅接受显式作业契约 | `tests/unit/db/test_integration_migration_guard.py` | 已覆盖 |
| I09 | M1 新库升级 | 正确版本、表/约束/索引/触发器存在且 metadata 无差异 | `infra/integration/verify-migrations.py`；`infra/integration/migration_probe.py` | 已覆盖 |
| I10 | M2 上游代表数据升级 | 用户、任务、通知、兑换、账本及关系的原始 JSON 不变 | `infra/integration/migration_probe.py` | 已覆盖 |
| I11 | M3 R5 历史数据升级 | 创建身份、导师历史与证明来源正确回填，不可变信息不可篡改 | `infra/integration/migration_fixtures.py`；`infra/integration/migration_probe.py` | 已覆盖 |
| I12 | M4 回退重升 | 上游 catalog 和代表数据精确恢复；base 失败须纯上游同错复现，fresh rebuild 单列 | `infra/integration/migration_probe.py`；`tests/unit/db/test_integration_migration_guard.py` | 已覆盖 |
| I13 | 上游统一认证与 R5 导师并存 | 学生/教师/管理员使用统一挑战；导师保留专属登录；各角色进入自己的工作区 | `frontend/src/__tests__/unified-challenge-api.test.ts`；`frontend/src/__tests__/auth-api.test.ts`；`frontend/src/__tests__/workspace-gate.test.ts` | 已覆盖 |
| I14 | 旧 refresh/换号/跨标签/退出 | 不恢复旧账号令牌，不让迟响应写回私有内容；后台撤销与 CSRF 契约保持 | `frontend/src/__tests__/auth-transition-serialization.test.ts`；`frontend/e2e/auth-cross-tab-fence.spec.ts`；`frontend/e2e/auth-wave-invariant.spec.ts` | 已覆盖 |
| I15 | admin 概览及运营子路由导航 | 根概览只精确匹配；子域继续分段匹配和独立排除，不出现双活动入口 | `frontend/src/__tests__/navigation-match.test.ts` | 已覆盖 |
| I16 | 任务表单与上游默认校验模板 | 通知字段可编辑且遵从原冻结规则；切换类型仅覆盖未修改模板 | `frontend/src/__tests__/teacher-view.test.ts` | 已覆盖 |
| I17 | 统一认证后目标页慢加载 | 成功响应只提交一次；不能因跳转慢重复登录或放宽真实限流 | `frontend/e2e/admin.spec.ts` | 已覆盖 |
| I21 | 新增MENTOR与原三角色验证码/旧设备组合 | 导师专属密码契约保持；员工邮箱/手机挑战不发送导师验证码，旧挑战及旧设备均不能登录当前导师账号 | `tests/integration/identity/test_mentor_identity.py`；`tests/integration/identity/test_unified_challenge.py` | 已覆盖 |
| I22 | 教师免TOTP邀请/登录后进入管理工作区及下载 | 未设或未完成可选TOTP的ACTIVE教师可正常审核；ADMIN仍需已确认TOTP，角色和账号状态拒绝不变 | `tests/integration/identity/test_account_status.py`；`tests/integration/identity/test_invitation_accept_no_totp.py`；`tests/integration/identity/test_identity_api.py` | 已覆盖 |
| I23 | 已保存最近账号的浏览器首次加载统一登录 | SSR与首次hydration一致，无树替换或丢失输入；账号卡仍可预填且仅在本机移除 | `frontend/e2e/recent-logins.spec.ts`；`frontend/src/__tests__/recent-logins.test.ts` | 已覆盖 |
| I24 | 显式开启跨标签与冷启动专门回归 | 宿主FENCE/PROBE布尔开关传入本栈；带专门开关的标准battery须在改写报告和运行浏览器前拒绝 | `infra/integration/test-host-auth-flags.ps1`；`infra/integration/probe-auth-flags.mjs` | 已覆盖 |
| I18 | UI 最终298路径、17脚本与图片来源 | 每条有来源哈希、处置和理由；仅移植确有缺口，保留 R6 行为 | Task4 处置清单和摘要，尚未生成 | 流程行 |
| I19 | 已确认 UI 与新增认证/管理员页面 | 保留真实功能，逐图分类；axe、键盘及390/1440实际旅程验收 | Task5/Task6 门禁和截图记录，尚未完成 | 流程行 |
| I20 | 最终提交 H、独立评审、PR43 | 全量证据绑定 H；正常快进、实际 CI 与评审齐备才解除 Draft | Task6/Task7 最终记录，尚未执行 | 流程行 |

本矩阵不将 I18–I20 视为已通过。跨世界清理、缺失 seed 前提及 UI 新行为的可执行行在 Task4 确认差异后补齐，既有域矩阵继续有效。
