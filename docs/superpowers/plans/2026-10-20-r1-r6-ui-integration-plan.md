# R1–R6＋统一 UI 首轮集成执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. 小叶已选择本人串行集成、完成后独立评审，不启用按任务并行实施。步骤使用复选框记录实际进展。
>
> **执行状态（2026-10-20，Asia/Shanghai）：小叶已在后续对话明确授权从 Task 1 串行推进，完成后独立评审并延续 PR43。** Task 1 来源保护与 Task 2 独立环境已完成；Task 3 已合流、解决冲突并完成本阶段兼容验收；I1 保留两个父提交。Task 4–7 尚待执行。源计划原件保留在主工作树和外部快照，本文是经按字节核对复制后更新的执行副本。新 Web 端口为3311，避开已有ClamAV占用的3310。完整证据入口见本树专属执行账本与 ignored runtime；未完成项仍未勾选。

**Goal:** 将 R1–R6、已确认统一 UI 及上游既有功能组合成经过新鲜验证的版本，延续 PR43，交付可评审 PR。

**Architecture:** 保留已有提交，以 R6 收尾 `e20bf06` 为集成起点；在独立工作树和专属验证栈串行合流锁定的上游 main，再逐项对账 UI 后续增量。上游迁移历史原样保留，尚未合入上游的双创迁移命名空间化后接到上游末端；最终只保留一个迁移 head。

**Tech Stack:** 现有 Next.js/React、FastAPI、SQLAlchemy、Alembic、PostgreSQL、Redis、MinIO、Celery、pytest、Playwright；遵从合流后锁文件，不引入 Supabase 服务或新的业务框架。规划核对时 Alembic 为 1.20.0。

**Spec:** 当前对话 Q1–Q10 已确认决定优先；业务依据 `docs/superpowers/specs/2026-09-19-campusquest-design.md`、R1–R6 已确认规格和 UI 样张。R6 规格为 R6 源工作树中的 `docs/superpowers/specs/2026-10-19-innovation-collaboration-design.md`；UI 真源为 UI 源工作树中的 `docs/quality/frontend-design-system.md`、`ui-migration-delivery-review.md`、`ui16-edge-preconditions-acceptance.md`。执行时从对应源码版本读取，不使用主目录中较旧的同名文件覆盖。

R1–R6 对账入口均在 R6 checkpoint 的 `docs/superpowers/specs/`：`2026-10-10-innovation-navigation-design.md`、`2026-10-09-innovation-achievement-review-design.md`、`2026-10-11-innovation-recruitment-design.md`、`2026-10-12-innovation-talent-design.md`（含 `2026-10-13-innovation-talent-card-design.md` 后续补充）、`2026-10-15-innovation-mentor-design.md`、`2026-10-19-innovation-collaboration-design.md`。既有各阶段计划及矩阵继续有效，本文只规划集成，不重做这些已完成实现。

## 1. 已确认决定与授权边界

- Q1–Q3：首轮完整整合 R1–R6＋统一 UI；完成点是推送分支并形成可评审 PR；保留 R7 全部进度，R8 后置。
- Q4=A：扩展现有 [PR43](https://github.com/Penghuige/campus-quest/pull/43)，作为唯一整合 PR。
- Q5=A：上游新增页面沿用已确认视觉体系适配；保持上游业务、认证、权限与会话语义。重大交互或业务冲突再提出，不重开全站视觉选择。
- Q6：没有硬截止；不以赶时间降低首轮范围或门禁。
- Q7=A：保留已有 8 个后续提交，只对新增集成改动分组；不 rebase、squash 或拆写既有提交。
- Q8=A：保留旧双创库，以独立新库验收；旧库原地升级和搬运旧数据不在本轮范围。
- Q9：同意迁移、提交与验收方案定稿，包括对本 PR 尚未合入上游的双创迁移调整身份，并保留原提交、源工作树和旧库。
- Q10=A：本代理串行集成，结束后安排独立评审；不在迁移、共享 fixture、契约和 CSS 上并行实施。
- 不自动合并 main、部署、接入学校 SSO，或带入 R7/R8；上游已经实现的统一登录必须保留，不能与学校 SSO 混为一谈。
- 原始交接：`C:/Users/111/AppData/Local/Temp/campusquest-r1-r6-ui-integration-planning-handoff-2026-10-20-1705.md`。其中“R6 与 UI 各自通过”的粗略描述已被本轮文件对账细化：R6 已吸收 UI13/14，不能再整包覆盖 UI。

## 2. 规划时核实的事实（执行前重新读取）

| 来源 | 目录、分支及 HEAD | 本轮核对的状态 |
| --- | --- | --- |
| 主工作树 | `C:/Users/111/Desktop/华师令/campus-quest`；`codex/innovation-platform`；`4ace255a7cd25648c8076d835c15fbf1cfbd9612` | tracked clean，原有 3 份未跟踪文档；本文将成为新增的第 4 份 |
| R5 | `C:/Users/111/Documents/CodexWorktrees/campusquest-r5-mentor`；`codex/r5-mentor-library`；`5813bb4e83ec328229b1b26b2edff1ef40abdef7` | clean |
| UI | `C:/Users/111/Documents/CodexWorktrees/campusquest-ui-migration`；`codex/ui-migration`；同一 R5 HEAD | 298 条未提交路径，原暂存 54 项 |
| R6/R7 | `C:/Users/111/Documents/CodexWorktrees/campusquest-r6-collaboration`；`codex/r6-collaboration`；`4f7b7afc57e909108ac834b1430231fb1b1efeab` | tip 已含 R7，16 条未提交路径；不得作为首轮来源 tip |

- 首轮精确 R6 检查点：`e20bf06f95b0dcfec6d24a8a9e4d8abbc0a61285`。PR43 的旧 head `b3adf14199e4a1074c9d01f719ff06cafd465390` 是其祖先，native Git 检查退出 0。
- GitHub API 查到 main：`55cc27ed64ce8c5273648175a0f84775bf1ac718`。PR43 返回的 `baseRefOid=f9286301...` 与目标分支 tip 不同，不能作为当前集成基线；本地尚无上述 main 对象。
- PR43：OPEN、Draft、GitHub 标记 CONFLICTING；当时仅见 GitGuardian 成功，未见完整本 PR CI 通过证据；已提交 reviews 列表为空。均为快照，不是交付结论。
- origin：`https://github.com/Penghuige/campus-quest.git`；fork：`https://github.com/YeZesen0121/campus-quest.git`。
- UI 298 条路径与 R6 检查点按 Git 过滤后的 blob 对账：232 相同、40 不同、26 在 R6 不存在。后两类共 66 条：产品 8、测试 20、文档 21、验证环境 17。66 是对账范围，不是待覆盖文件包；本次对账不证明任意差异方向正确。
- 产品差异包括个人页“协作与交接”入口、项目编辑入口及转让后旧创建请求处理；整包覆盖 UI 会丢失 R6 行为。
- 上游 PR124/125 涉及统一登录、最近登录、全局 CSS、认证和共享测试；未合并 PR90 还与管理员壳、任务/提交界面交叉。PR90 不自动纳入；执行时若其已进入 main，作为上游既有功能处理。
- 迁移共同历史为 0001–0024；五份文件存在说明文字差异。两条链在 0024 后分叉，已核实 0025–0030 的 revision ID 重复；双创链延续至 0042。

## 3. Global Constraints

- PostgreSQL 是事实源；真实 PG 独立事务验证锁、唯一约束、幂等及回避，不以 SQLite/mock 替代。
- 业务时间使用项目可注入 Clock；UTC 存储与既有 BUSINESS_TIMEZONE 契约保持。
- 负责人、共同管理、公开挂名、导师本人授权、联系授权、证明权限、公开快照分别保留，不因 UI 或认证合流扩大权限。
- 受限 DTO 最小披露；证明每次鉴权、先持久审计再返回；不跨用户缓存受限资料，不输出原始对象 key。
- 使用 `AGENTS.md`、`docs/quality/quality-gates.md`（含 G1/G2/G3/G17/G18/G19）、`agent-tooling.md` 及实际任务需要的前后端质量文档。外部技能不改变业务真源。
- 修改前端时读取安装版本配套 Next.js 文档、既有组件和设计规范；不重新选择字体、颜色和全站样式。
- 合流版本的 API 变化携带同一 PR 的 OpenAPI snapshot、生成 types、矩阵、选择器与 no-skip 契约。不得通过降低覆盖率、增加 skip、放宽像素容差或更新图片隐藏失败。
- 源工作树、其索引、已有服务、数据库、对象和凭据保持原状；新验证使用独立命名空间、端口、卷、缓存及浏览器会话。
- 禁止 `git add .`、强推、源树 stash/reset、未检查目标的递归清理；提交逐路径审阅。私有 `.runtime`、账号和原始数据库/上传资料不进 Git。
- 每项命令记录 cwd、参数、退出码与完整日志；功能通过、独立评审、远端 CI、owner 合并验收分别记账。

## 4. Review Focus

1. 同一 revision ID 指向不同 DDL、旧检查点引用残留：任务 3 的图检查和三条 PG 迁移路径验证。
2. 新统一登录/换号与旧 UI 登录入口、私有请求竞态：任务 3、5 的认证回归、真实换号和迟响应检查。
3. UI 较旧文件覆盖 R6 协作/交接、历史回避或原命令恢复：任务 4 的 298 路径处置表及 R6 C01–C22 回归。
4. runner 或清理逻辑误触旧库、错误世界、源索引或另一棵工作树：任务 1、2 的前后哈希、拒绝测试和归属自证。
5. 旧分支通过、旧 baseline 或旧 CI 被写成整合版通过：任务 6、7 的最终提交/产品树绑定、独立复核和远端 run 检查。

## 5. 文件职责及提交组织

相对路径均指未来 `INTEGRATION_ROOT`；本文先保存在主工作树，只是规划文档，执行时须按字节核对后复制进入集成树。

| 文件/目录 | 职责 |
| --- | --- |
| `infra/integration/` | 由现有 R6/UI runner 最小适配的专属栈；沿用已验证模式，不另造通用测试平台 |
| `infra/integration/resources.json` | 非敏感资源映射：容器/库/bucket/端口/工作树归属；凭据另存 ignored runtime |
| `infra/integration/migration-targets.json` | 锁定 main SHA、上游迁移 head、18 项 revision 映射、R5/R6/最终目标；供验证脚本读取 |
| `infra/integration/verify-migrations.py` | 三条独立数据库路径、降级/重升与数据断言；只操作本次创建的临时库 |
| `infra/integration/test-isolation.mjs`、`test-runner-lock.mjs` | 错误归属拒绝、参数/退出码透传、并发串行化自证 |
| `infra/integration/.runtime/` | ignored：日志、快照索引、私有测试身份、源差异处置表、最终证据 manifest |
| `backend/alembic/versions/ie_0025_*.py` … `ie_0042_*.py` | 本 PR 双创迁移身份调整；原函数体原则上逐份保持 |
| `backend/tests/unit/db/test_innovation_migration_graph.py` | revision 唯一、单 head、前驱和映射完整性、迁移操作体比较 |
| `backend/app/`、`backend/tests/`、`frontend/src/`、`frontend/e2e/` | 仅处理实际兼容、UI 增量及相应回归，不预设必改每份来源文件 |
| `frontend/openapi.snapshot.json`、`frontend/src/lib/api/schema.d.ts` | 合流后真实组合生成的契约 |
| `docs/quality/r1-r6-ui-integration-verification.md` | 验证方法、范围、历史与新证据入口、未执行项，不预填成功数字 |
| `docs/quality/r1-r6-ui-integration-review.md` | 最终独立评审范围、head/tree 和问题闭合记录 |
| `docs/quality/test-matrix/innovation-integration.md` | 集成新增预期/测试对账；与原各域矩阵一起通过 checker |
| `docs/qa/innovation-r1-r6-guide.md` | 对齐真实整合入口和七角色旅程；模拟说明与私有凭据分开 |

**已有历史原样保留：**

| 阅读组 | PR43 后续提交 |
| --- | --- |
| 人才补充 | `5919620`、`3080f95`、`4ace255` |
| R5 | `536543a`、`563d1fb`、`5813bb4` |
| R6＋已吸收 UI | `9f5c03e`、`e20bf06` |

**新增提交边界：**

| 组/建议标题 | 包含 | 提交前的最小证据 |
| --- | --- | --- |
| I1 `fix(integration): reconcile upstream auth, migrations and contracts` | main 合流和必要兼容；专属环境；迁移图/验证；对应回归；真实契约；CI 组合接线 | 隔离自证、迁移三路径、静态、契约新鲜度及受影响认证/组合回归 |
| I2 `test(ui): reconcile final UI fixtures and regression contracts` | UI15/16 确实缺失的种子前提、清理、测试、选择器/no-skip/矩阵；必要环境行为迁入 integration | 原始失败回归、共享清理/前提测试、前端静态、runner 对应自证 |
| I3 `feat(ui): adapt approved presentation to integrated workflows` | 上游新增界面适配；真实组件/CSS；交互、布局、焦点与无障碍回归 | 对应语义/布局测试、键盘及手机/桌面走查 |
| I4 `test(visual): record reviewed integration baselines` | 仅确有意图变化的新 PNG、差异走查；无变化则省略 | 逐图审阅后无 update 像素复跑；基线不用于掩盖语义失败 |
| I5 `docs(integration): prepare R1-R6 and UI review package` | 本计划、指南、迁移映射说明、验证及评审导航；提交冻结前整理 | 文档链接、截图来源、凭据/工件泄漏检查 |

I1 在合流未提交状态完成必要修复后才提交，不先生成已知迁移图损坏的 merge commit。Git 合流若无冲突仍用 `--no-commit --no-ff` 保留修复窗口。产品行为及对应测试同提交；批准的像素更新单列 I4。某组若无实际差异则省略，修复按实际追加提交，不为凑分组拆文件。中间提交不宣称全量像素或整套门禁已绿。

## 6. Task 1：重新核对并保护来源

**Files:** 源树只读；执行后本地快照写入仓库外 `C:/Users/111/Documents/CampusQuestIntegrationSnapshots/<run-id>/`。

**Interfaces:** Produces `source-manifest.json`：四棵树的绝对路径/branch/HEAD/index SHA256/状态、dirty/untracked 文件字节哈希和快照位置、R6 checkpoint、PR43 head/repo、main API SHA。私有补丁和身份信息不向 GitHub 输出。

- [x] 读取本文、各源树 AGENTS/质量规则及精确版本设计/回执；执行 native Git `status --porcelain=v1 -z`、`rev-parse HEAD`、`branch --show-current`、`worktree list --porcelain`。不凭工作树名或聊天标题认定线程已停止。
- [x] 用只读 PR API 确认 PR43 仍开放、head 仓库/分支正确；记录 main 当前 SHA、相关已合入变更及 review/CI 状态。若 PR43 已被关闭或来源分支出现不明新工作，先说明外部变化，不覆盖。
- [x] 保存 UI/R7 原索引字节、staged/unstaged binary diff、dirty 文件和未跟踪文件的精确副本。使用 NUL 清单处理文件名，不能仅靠 diff 遗漏新文件。ignored 服务数据保留原位置并登记，不批量复制整个 `.runtime` 或删除原资料。
- [x] 快照前后重读 index/HEAD/状态和文件哈希，要求一致；若来源在变，最多重试 3 次，仍不稳定则说明需协调的具体来源，不自行暂停线程或提交来源代码。
- [x] 核实 `b3adf14` 是 R6 checkpoint 祖先、R5 也是祖先；记录 PR43 当前 head 的祖先关系，不把缓存 fork 引用当作实时 head。

**Acceptance:** 快照可重建 staged/unstaged/untracked 三种状态；源索引及文件字节未改；没有 stash、reset、源树 commit 或线程控制。取得真实执行授权后才能执行本任务。

## 7. Task 2：建立独立集成工作树及验证栈

**Files:** Create `infra/integration/{.gitignore,README.md,resources.json,compose.yml,stack.ps1,run.ps1,launch.sh,run.sh,run-battery.sh,prepare-git.py,probe-exit.mjs,smoke-runtime.py,smoke-browser.mjs,test-isolation.mjs,test-runner-lock.mjs,test-battery-exit.mjs}`；按继承 runner 的实际需要保留额外辅助文件，不删除源脚本。

**Interfaces:** Produces `INTEGRATION_ROOT`（工作树工具实际返回路径）、分支 `codex/r1-r6-ui-integration` 和 runner `infra/integration/run.ps1 MODE ARGS...`；mode 为 `backend/python/frontend/node/tsx/playwright/visual`，与既有 R6 语义一致，另增 `battery` 原子运行单元。所有后续命令从 `INTEGRATION_ROOT` 运行。

- [x] 按 using-git-worktrees 流程先查 attached worktrees；仅复用本任务可确认归属的集成树，否则从完整 R6 checkpoint 创建。不得默认从 remote main 或 R7 tip 创建。分支名若已存在，核对归属和内容，不 reset。
- [x] 在新树执行 `git fetch origin main`、`git fetch fork codex/innovation-platform`，记录实际抓到的 SHA。API 与 fetch 若遇到 main 前进，重读后锁定一个实际提交；不追逐“永远最新”。验证抓到的 PR head 是集成树可 fast-forward 延续的祖先。
- [x] 从源 snapshot 按字节复制本文进入新树。建立 exclusive `campusquest-integration` Compose project、runner、PG/Redis/MinIO/ClamAV/卷/bucket，单独 `.next`、依赖和浏览器 profile。
- [x] 候选资源：PG16440/Redis6480/MinIO9135与9136/Clam3320/Web3310/API8310，库 `campusquest_test_integration`。这些端口尚未验证空闲；先只读盘点占用，冲突时选择空闲端口并一次性同步 resources/Compose/guard/CORS/Playwright；不借用或停止已有服务。
- [x] 先补隔离失败用例：错工作树挂载、错数据库/资源归属必须在连接/清理前拒绝；exit-7 probe 必须原样返回 7；两个 wrapper 子进程不能重叠。仅在新树实现最小适配后复测。
- [x] wrapper 必须保留真实退出码、完整日志、参数、共用 flock、子进程锁释放和 Git context 隔离。锁自证在 wrapper 外发起，避免自锁；新文件清单仅在新树索引处理。
- [x] 在任务 2 就实现 `battery`：同一外层 flock 中依次跑完整 `npm run test:e2e`、保存本次 report、`node scripts/assert-e2e-no-skips.mjs`；分别记录两个退出码，任一个非零则外层非零。`test-battery-exit.mjs` 自证两个成功→0、浏览器失败/guard成功→非零、浏览器成功/guard失败→非零，以及运行单元之间 report 不串用；不等最终冻结后再修改 wrapper。
- [x] 依锁文件准备独立依赖和字体，跑实际 PG/Redis、HTTP/TLS MinIO、CORS 允许本栈且拒绝非本栈 origin、扫描与浏览器 smoke；API/前端组合挂载均核对新树。

**Acceptance:** 错误归属拒绝自证、exit-7、锁和真实 smoke 均有记录；UI/R7 服务与源树前后清单一致。尚未合流时 smoke 仅证明当前检查点和环境，不证明最终版本通过。

## 8. Task 3：合流上游、迁移兼容及契约（I1）

**Files:** 上游实际改动及冲突文件；18 份双创 migration；`backend/tests/unit/db/test_innovation_migration_graph.py`；`infra/integration/{migration-targets.json,verify-migrations.py}`；真实契约和 `.github/workflows/ci.yml`。

**Interfaces:** `migration-targets.json` 包含 `upstream_sha`、`upstream_head`、`innovation_start=ie_0025`、`innovation_r5=ie_0037`、`innovation_r6=ie_0042`、`final_head=ie_0042`、18 项 `revision_map`。验证脚本从该文件读取目标，不散落旧编号。若真实 DDL 冲突要求追加兼容迁移，在实施记录明确原因及最终 head，并更新图测试，禁止带入 R7 的 0043+。

- [x] 在新树合入锁定 SHA：`git merge --no-commit --no-ff <upstream_sha>`；保留正常冲突状态逐项解决，不以 ours/theirs 整包选取业务文件。
- [x] 合流后若锁文件变化，仅在新栈按新锁重新准备依赖，更新运行时/浏览器/字体记录和版本匹配文档；不得继续把旧 runner 缓存当作新版本安装证据。
- [x] 先写图回归：`test_revision_ids_unique`（AST 读取 assign/annassign）；`test_single_final_head`；`test_innovation_parent_chain`；`test_revision_map_covers_18_sources`；`test_upstream_migration_files_unchanged`；`test_innovation_migration_operation_bodies_preserved`。合流原始图应先暴露重复/断链，不把环境错误当作有效 RED。
- [x] 上游迁移逐份采用锁定 main blob。双创文件加 `ie_` 前缀，revision 0025–0042 映射至 ie_0025–ie_0042；首份前驱设为实际 `upstream_head`，其余依次相接。更新 docstring 和脚本引用，upgrade/downgrade 函数体按 AST 对照原 e20bf06；任何额外 DDL 差异必须有原因和 PG 回归。
- [x] 在独立 PG 的不同临时库验证以下路径。每个库命名由本次 run-id 唯一生成，核对服务器/库名/所有权，清理只针对本次创建的库；不调用指向原 Compose 的 `scripts/verify-migrations.sh`。

| 路径 | 准备与动作 | 必须断言 |
| --- | --- | --- |
| M1 空库 | 新库 → 整合 head → `check` | 唯一正确版本；上游及双创表、约束、索引、触发器存在，metadata 无差异 |
| M2 上游旧数据 | 新临时库升级至锁定上游 head → 插入符合上游约束的用户/任务/通知/兑换代表数据 → 整合 head | 原主键/业务字段/计数/关键关系保持，新增双创结构有效；不是只跑空表迁移 |
| M3 新链 R5→R6 | 另一新库 → ie_0037 → 原 R6 legacy fixture 按上游必填项适配 → head | 创建者/导师历史回填、不可变创建指纹、证明上传者与代次约束均有效 |
| M4 回退重升 | 临时库 head → 锁定 upstream_head → head；另测 base 降级/重升 | 停在上游时其结构/代表数据仍有效；重升通过；base 降级若上游不支持，记录原限制及失败并验证 fresh rebuild，不将重建冒称降级成功 |

- [x] 命令入口：`& ./infra/integration/run.ps1 backend pytest tests/unit/db/test_innovation_migration_graph.py -v`；`& ./infra/integration/run.ps1 python ../infra/integration/verify-migrations.py`。脚本逐步输出路径、目标和退出码，任一数据断言失败使外层非零；重复运行不复用失败库伪造通过。
- [x] 处理 app/db/base、main composition、配置、依赖锁文件和旧认证路由与上游统一登录冲突；保留挑战、2FA、注册审批、最近登录、CSRF、会话撤销及私有迟响应围栏。先复现具体回归，再做必要修复。
- [x] 从合流真实 app 生成契约：`& ./infra/integration/run.ps1 python scripts/dump_openapi.py ../frontend/openapi.snapshot.json`，随后 `& ./infra/integration/run.ps1 frontend run api:types:snapshot`。审阅 DTO/路径；暂存新树预期结果后再次生成并用 `git diff --exit-code -- frontend/openapi.snapshot.json frontend/src/lib/api/schema.d.ts` 验证无再变化。
- [x] 合流 CI 保留上游检查并覆盖新增组合/迁移路径。纯图测试随 backend unit 执行；三路径 migration probe 在 backend job 专用临时 PG 中执行。脚本 URL 取显式测试环境，不能硬编码本机端口；先有拒绝非测试库测试，不能删除 guard 来迁就 CI。（已接线与本地拒绝回归；远端执行结果仍待Task7。）
- [x] 跑受影响静态、后端真实依赖/认证测试和前端统一登录、登出、换号回归后审阅 I1 全部暂存路径。确认未解决冲突为零，再提交 I1；若用 merge commit，其提交信息说明主要兼容内容。

**Acceptance:** 上游迁移 blob 完整、18 项映射一致；M1–M4 结果如实记账；契约新鲜；上游功能没有回退；I1 不包含 R7、旧库转换或无关 refactor。无 DDL 差异时不新增空壳兼容迁移。

## 9. Task 4：逐项对账 UI 最终增量（I2）

**Files:** UI 298 路径清单所覆盖的实际缺口；重点为 `backend/tests/e2e/browser_edge_world.py`、`browser_world.py`、两份 cleanup 回归、`frontend/e2e/{fixtures.ts,cross-browser-smoke.spec.ts,notifications.spec.ts,rewards-ranking.spec.ts,task-claim.spec.ts,noskip-exemptions.mjs}`、矩阵及选择器契约。

**Interfaces:** Produces `infra/integration/.runtime/ui-disposition.json`：每条来源路径拥有 source SHA256、R6 blob、合流前后 blob、`already-present/port/retain-integrated/superseded` 之一、原因与覆盖证据；发布可审阅的非敏感摘要，原私有清单留本机。

- [x] 从稳定 UI snapshot、固定 e20bf06 与当前集成树做三方对账，不从正在变化的源文件盲拷。原 C1–C4 22/212/50/14 清单只作来源索引。
- [x] 232 相同路径先确认合流后是否仍等价；66 差异逐一判明方向，特别是 8 个产品文件：profile、globals.css、AchievementReviewPanel、AchievementReviewsView、PrivateWorkspace、ProjectDraftsView、PublicProjectsView、RecruitmentEditor。
- [x] 保留 R6 的协作入口、关系权限、项目转让、逐份证明、恢复命令和生命周期状态。对 UI15/16 的未读通知、积分不足、任务耗尽等前提补丁先证明当前确有缺口；不把 R6 或上游更强的 cleanup 换回旧实现。
- [x] 17 份 UI 验证脚本逐项记录处置，必要隔离/seed 行为迁入 integration runner；无需为保留路径而再建重复运行栈。源 UI 栈、历史回执和 61 PNG 原件继续保留。
- [x] 对确有行为变化的共享清理/世界准备先 RED 后 GREEN；验证跨世界拒绝、中途失败可重试、actor 账号存续，以及测试顺序不消耗他例前提。
- [ ] no-skip 豁免逐项绑定真实专项证据，不能复制旧通过数字（按 Task6 在最终 H 执行；本阶段只移除已关闭的前提豁免并验证原 guard，不预填最终专项通过）。
- [x] 维护各域矩阵与 selector 契约；运行对应后端 E2E、前端静态、shared fixture 回归后逐路径提交 I2。仅文档历史复制不能标成新验收。

**Acceptance:** 298 条全部有处置；没有 R6 行为退回、UI 源索引变化、无理由 skip 或整包覆盖；确需补入的测试前提在新组合通过。

## 10. Task 5：新增界面视觉适配及像素走查（I3/I4）

**Files:** 实际上游新增界面（重点 `frontend/src/features/auth/UnifiedLoginPanel.tsx`、`recentLogins.ts`、`frontend/src/app/globals.css` 和认证路由）、受影响管理员/学生/双创页面；对应现有 auth/recent-logins/参考布局/E2E/视觉测试及必要新回归。

**Interfaces:** Produces I3 产品/语义/布局差异，必要 I4 基线，以及逐图分类记录。复用已批准 token、字体与真实 feature 组件，不将 gallery 的静态状态当作业务状态。

- [x] 读取合流后设计系统、patterns、ui-ux-pro-max 的 CampusQuest 参考及实际 Next.js 随包文档。对新增结构按已确认体系适配，不重做已批准页面。
- [x] 对统一登录、注册审批、员工挑战/2FA、最近登录切换、忘记密码和真实登出逐项核对语义；上游存在而旧样张没有的功能保留。
- [x] 先补能暴露实际缺陷的交互/布局断言，再最小修复；不因参考布局冲突关闭权限检查、放宽会话围栏或依靠前端隐藏数据。
- [x] 在桌面 1440 与窄屏 390、手机长内容、键盘/焦点返回、loading/empty/error/denied、真实换号迟响应下走查变化页面；记录自动 axe 与人工键盘结果（代理驱动浏览器，未作真人物理设备验收；HTTP401资源消息的未归因边界见验证记录）。
- [ ] I3 包含对应语义和布局回归。先跑无 update 像素，区分有意适配、字体/环境漂移、错误数据和产品回退；后两类修根因。仅对批准体系内的有意变化建立 I4，逐图核对后无 update 复跑；重大新视觉/交互取舍另说明，不静默采用。

**Acceptance:** 新功能可用、视觉沿既定体系、各角色流程可达；既有基线无理由字节变化为零；像素更新有来源和解释，未放宽阈值/mask/重试。

## 11. Task 6：完整验收与冻结证据

**Files:** 新树内门禁及验证账本；日志、JSON/report、screenshots、source hashes 保存在 integration ignored runtime，非敏感证据通过 PR/CI artifact 提供持久评审入口。

**Interfaces:** `final-evidence.json` 包含 `head`、`upstream_sha`、完整 tracked tree 与产品/测试树哈希、资源归属、锁文件/字体/运行时、每命令 cwd/args/start/end/exit/log SHA、测试结果/skip 原因、专项覆盖、未执行事项。不得保存 token/口令。

- [ ] 先将 I5 的计划、指南、验证方法及历史范围整理提交，再冻结最终 head H。本文所有实施复选框仍须按真实动作更新，不能预填。最终门禁开始后不编辑受验证文件。
- [ ] 按合流后的 Makefile、CI 和 campusquest-test-process 对账完整 release-gate 能力，逐入口映射到独立 runner。禁止裸跑会指向旧 Compose/15432 的 `make release-gate` 或原迁移脚本；runner 的同等覆盖逐项列明，不用 focused 结果代替整套。
- [ ] 以下命令逐条裸跑，保留外层退出码和完整日志；仅在 INTEGRATION_ROOT 使用新 runner。API 和 browser flags 随运行单元配置，不复用之前世界。

| 门禁 | 新 runner 下的命令/范围 | 通过标准 |
| --- | --- | --- |
| 后端静态 | `backend ruff format --check app tests alembic`；`backend ruff check app tests alembic`；`backend mypy` | 每条退出 0 |
| 后端完整 | unit、integration（`-m integration`）、workers、E2E；分别运行 pytest，不截日志 | 全套零失败；真实 PG/Redis/对象存储/扫描/组合 smoke flag 开启 |
| 后端覆盖 | 清理仅新栈自身覆盖产物后，unit/integration/workers 按既有 CI `--cov=app --cov-branch --cov-append` 收集；`python scripts/coverage_ratchet.py` | 配置含 greenlet/thread，整套同配置；原地板通过 |
| 迁移 | 图测试＋`python ../infra/integration/verify-migrations.py` | M1–M4 数据与结构断言，降级限制单列 |
| 契约 | dump OpenAPI、`frontend run api:types:snapshot`、预期文件的零差异检查 | schema 与实际组合一致，无 R7 路由/类型 |
| 规约矩阵 | `python scripts/check_test_matrix.py` | 全部现有及新增矩阵通过；不得删除行消除缺口 |
| 前端静态/构建 | `frontend run typecheck`、`lint`、`check:css`、`test:unit`、`coverage:ratchet`、`build`；E2E tsconfig 依合流 CI 的现有命令检查 | 每条退出 0；既有告警有来源和范围 |
| 依赖审计 | `python scripts/pip_audit_gate.py`、`frontend run audit:gate` | 审计实际完成；仅既有有效豁免可记录，网络失败不是零漏洞 |
| 标准浏览器 | `& ./infra/integration/run.ps1 battery`，无 spec 过滤，完整默认配置电池 | 全套零 failed/flaky；Chromium 全功能与实际配置的 Firefox/WebKit smoke 分开报告 |
| no-skip | 上述 battery 内标准 report 保存后，同一锁和运行单元运行 `node scripts/assert-e2e-no-skips.mjs` | 0 unexpected skip/缺失 spec；每项注册豁免可追到当前专项 |
| 专用 world | mentor、collaboration、auth、参考布局、fixture edge 等所有默认豁免集合，按实际合流配置开启 | 逐项覆盖全部豁免，不照抄旧 39/46 数量 |
| 像素 | core、成果审核、导航、招募、人才、R6、mentor 及新增认证参考，按各自 world 无 update 跑 | 零失败；记录字体/浏览器版本与逐图来源 |
| 无障碍/人工旅程 | 变化页面 axe、键盘、390/1440 走查，R1–R6 七角色指南逐步核对 | 无阻塞问题；入口、结果及异常恢复真实可达 |

- [ ] smoke flags 为 `CQ_S3_SMOKE=1`、`CQ_COMPOSITION_SMOKE=1`、`CQ_EVIDENCE_SCAN_SMOKE=1`，E2E 使用 `CQ_E2E=1`；mentor 专项启用 `CQ_E2E_MENTOR_WORLD=1`，像素用 `CQ_VISUAL=1`/`CQ_E2E_FIXED_LABELS=1`。每个单元显式设置/清理，wrapper 转发这些旗标并核对实际收集数。
- [ ] 使用任务 2 已自证的原子 battery→保存 report→guard 入口；核对完整 report 的 head/world/run-id 与 guard 一致。不得改为两次独立 wrapper 调用冒称“同锁”，也不在冻结后增加该入口。
- [ ] 最少完整旅程：R1 导航/登出；R2 成果更新复审保留旧公开版；R3 招募与显式联系；R4 人才材料/确认；R5 导师本人授权与项目独立挂名；R6 C01–C22（含无资格旧 owner 转交、逐份证明审计、并发、unknown outcome、结项与恢复、历史回避）；以及上游任务领取→上传→审核→积分/兑换代表闭环。
- [ ] 任何失败先保留完整证据，按 systematic-debugging/TDD 修复。修复形成新 head 后刷新受影响与适用完整最终门禁；不得用之前 H 的通过覆盖新产品/测试改动。
- [ ] 冻结后新通过数字先写 H 绑定 runtime/CI artifact 和 PR 正文，避免为填数字反复改变 H。若必须修改仓库内账本/图片/代码，再冻结新 head 并按仓库同 head 要求取得最终证据；文档历史与最终 run 分别标清。

**Acceptance:** 所有适用门禁有完整结果；未跑/阻塞项明确为未完成；标准 skip 与专项覆盖对上；没有数字借用、秘密/运行工件入 diff 或源树变化。此时尚不等于远端 CI/owner 合并验收。

## 12. Task 7：独立评审、推送及 PR43 交付

**Files:** 评审材料和 PR 正文；现有分支 `fork:codex/innovation-platform` 仅 fast-forward 更新，主工作树本地同名分支不 checkout/reset。

**Interfaces:** Produces 最终 H、PR43 URL、独立 APPROVE 的精确 head/tree、H 及 GitHub PR 测试组合的 CI run/check URL、未解决线程数和交付说明。

- [ ] 按 requesting-code-review 安排一位独立评审者，只读检查最终 head、锁定 base、完整差异、证据及上述 Review Focus；用户已选串行实施＋独立评审，实施阶段不另开并行实现。评审不被旧 9f5c03e 的 APPROVE 替代。
- [ ] 评审若有实质问题，按 receiving-code-review 核实、修复、追加提交并补适用证据，再让评审绑定新 head；无未解决问题才能称完成。独立评审若未自行跑测试，应明确其核对日志与源码的实际范围。
- [ ] 再读 PR43 head 和 main。若 main 与锁定基线相比又前进，记录变化及 GitHub 当前测试组合；不静默扩大来源或强推。若新 main 引入冲突/使 CI 失效，追加合流、兼容和必要验证；若无冲突且组合 CI 绿，报告实际锁定本地基线与远端 base 差异。
- [ ] 审查最终 diff：8 个原提交仍为祖先；无 R7 额外迁移/路由/生成 schema/执行治理工作台；R6 自身治理状态字段不因名字相似误删；无 R8、SSO、凭据、日志或私有数据。检查所有 source guard。
- [ ] `git push fork HEAD:refs/heads/codex/innovation-platform`；只允许正常 fast-forward。若被拒绝，重查远端变化，不使用 `--force` 或 `--force-with-lease` 替代来源判断。
- [ ] 正文先写成精确 UTF-8 临时文件，以 `gh pr edit 43 --repo Penghuige/campus-quest --title ... --body-file <path>` 更新。标题建议 `feat(innovation): integrate R1-R6 workflows and approved whole-site UI`；正文先写用户可见结果，再提供提交阅读组、迁移兼容、验证范围/链接、模拟边界和待 owner 检查项。
- [ ] 通过 attach_artifact 将正在更新的 PR43 关联本聊天；不发送外部消息给学姐或其他人。
- [ ] 等实际 PR 事件触发 backend/frontend/visual 等合流后应有 CI；核对 check 对应 H，若 GitHub 测试的是 merge SHA，核对其 head parent 为 H 并记录 base。仅 GitGuardian 绿不算完整 CI；缺失 job、权限/网络/依赖失败都不能写成通过。
- [ ] 本地验收、独立评审及所需远端 CI 齐备后解除 Draft。正文说明源码 head、真实测试范围及未执行的生产部署/物理设备等，不扩张结论。

**Acceptance:** PR43 唯一评审入口，head 为最终 H；范围完整且无 R7/R8；可复核 CI 和评审证据齐全。没有自动 merge、deploy、外发通知。若外部 CI 无法完成，则诚实交付当前 Draft/阻塞状态，不宣称达到“可评审完成”。

## 13. 停点与恢复

- 规划时停点（历史）：本文当时仅获准撰写和自审。后续已明确授权执行；当前状态以上方执行状态、复选框和执行账本为准。
- 后续明确授权执行后，第一动作是 Task 1 重新核对真实状态；已确认 Q1–Q10 不重问。
- 来源或权限不明、快照不稳定、真实业务冲突、必须修改上游已交付迁移历史、PR43 被其他工作改变时，说明具体变化后再决定；常规端口分配、技术兼容和回归修复由本代理按已定范围处理。
- 每阶段留存来源/基线/提交/验证状态；阶段结束或约 15 轮检查交接需求。若交接，给出 cwd、分支、未提交状态、已确认与被推翻决定、精确证据、未完成项和首个具体动作。

## 14. 计划自审记录（仅审计划，未执行门禁）

2026-10-20，作者自审；不是独立代码评审，也不是集成完成回执。

| 项目 | 自审结论与修正 |
| --- | --- |
| 已确认决定覆盖 | Q1–Q10 均进入 §1；没有重新选择范围、PR 数量、视觉、旧库升级或实施模式 |
| 源码边界 | 起点精确到 e20bf06，排除 R7 tip；记录 UI 已被 R6 吸收及 298 条处置要求 |
| 迁移路径 | 补齐重复 ID、上游 blob 保留、18 项映射、旧 0037 引用、上游数据升级、新链 R5 回填及回退重升；旧库不动 |
| 跨任务接口 | Task 1 产生 source manifest；Task 2 产生 ROOT/runner/resources；Task 3 产生 migration targets；Task 4 产生处置表；Task 6 产生 H 绑定证据；Task 7 使用这些产物 |
| 执行隔离 | 明确候选端口不是已验证空闲；补 mount/URL/ownership 拒绝、exit-7、flock、自有 cleanup；禁止借栈或直接运行原破坏性入口 |
| 提交完整性 | 原 8 个提交保留；I1 修好迁移图再 commit；API 与契约/测试同组；像素单列；无变化组可省略 |
| no-skip 风险 | 修正为任务 2 先实现并自证 battery 原子入口，任务 6 只使用；不能分两次 wrapper 冒称同锁，也不在冻结 H 后再改 runner |
| 最终证据递归 | I5 先整理再冻结 H；最终数字进入 H 绑定工件/PR；如再改仓库内容则新 head 新证据，避免旧回执套新 head |
| 规则与降级 | 没有把 fresh rebuild 冒称成功 downgrade；历史已发布上游迁移保持；本 PR 双创身份调整是已确认的特定集成方案 |
| 验收与未完成 | 完整前后端、真实依赖/并发、契约、浏览器、像素、无障碍、独立评审、CI 分层；所有实施复选框未勾选，没有测试通过声明 |
| 交付授权 | 本轮只写本文；未来 push/PR ready 属于执行阶段，不能因本文已自审就开始 Task 1 |

**自审结果：计划完整，可作为后续执行入口。** 动态事实（最新 main、资源占用、PR head、实际合流冲突和 CI 可用性）均有明确核对步骤，不是需要小叶重复选择的静默假设。

**下一步启动提示：**

```text
读取 C:/Users/111/Desktop/华师令/campus-quest/docs/superpowers/plans/2026-10-20-r1-r6-ui-integration-plan.md。
该计划已完成自审，Q1–Q10 已确认：首轮 R1–R6＋UI、延续 PR43、保留历史提交与旧库、新库验收、本人串行实施后独立评审。
先核对实际 Git/工作树/PR 状态，再从 Task 1 继续；R6 边界为 e20bf06，不能拿已进入 R7 的 tip 当来源。
执行仍需以我随后发出的明确指令为准；没有执行指令时只读，不把本段文字当成执行授权。
```
