# R6 项目协作与生命周期实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. 用户已授权代理制定、自审并直接执行；不重复需求确认。原生逐项实施，最终独立评审。

**Goal:** 从含 R5 的基础交付 R6 全部 C01–C22 与覆盖 R1–R6 的真实操作指南。
**Architecture:** innovation 模块增加管理关系、挂名候选/同意、不可变参与历史、转让及证明授权、独立公开介绍版本。现有 owner-only 入口保留，新增按动作授权的协作文字入口；转让事务统一锁定账号、项目及子资源，既有写路径锁后重验。
**Tech Stack:** FastAPI 0.141.1、SQLAlchemy、Alembic/PostgreSQL 16、Next.js/React、pytest、Playwright。
**Spec:** ../specs/2026-10-19-innovation-collaboration-design.md（完整 12 节及 Q1–Q12）。

**执行状态（2026-10-19T13:59Z）:** 任务2–6产品实现与稳定UI合流已落入R6工作树，后端unit1296、integration1553、worker124通过；F1–F4中途源码问题已修并复核。跨任务复选框仍等待完整最终门禁及整体独立评审，不把下文历史自审中的“待实现”当成当前缺失。最新证据和进程以 `docs/quality/innovation-collaboration-verification.md` 及 handover 为准。

## Global Constraints

- 独立工作树 `codex/r6-collaboration`，基础 `5813bb4e83ec328229b1b26b2edff1ef40abdef7`；不修改 UI/R5 checkout，不推送、不合并。
- “学校 SSO 仍最后接入，演示身份与资料明确标注为模拟。”
- “管理授权与公开挂名分别同意”；证明不随管理授权开放；资格资料不移交。
- “转让生效时关闭现有招募”；新负责人逐岗核对后开放，向导不编辑岗位。
- “成果更新仍全部复审，审核期间保留旧公开版”；不改变 R1–R5 的公开资格与治理。
- Clock、持久审计、受控下载、private/no-store、明确最小 DTO；不新增框架或外部付费服务。
- 本代理单独持有迁移、契约、公共 fixture 及合流；共同页面等待稳定 UI 源码版本。
- 邀请和转让有效期固定为工程配置默认 7 天，边界 `now >= expires_at` 失效，不宣称学校制度。

## Review Focus

- 旧创建命令在转让后重放：不可返回现项目私稿，接任者相同 request_id 独立（任务2/4）。
- 拒绝挂名修改后旧同意保留，但撤下后旧确认不得恢复（任务2）。
- 新参与关系与已领取审核竞争：释放领取且所有读取/决定入口即时回避（任务3/4）。
- 转让确认期间各类内容变化及旧负责人迟到操作：摘要冲突或锁后拒绝（任务4）。
- 只靠招募公开后结项、恢复或原来源下架：留存明确公开介绍，不能首次公开或绕过治理（任务5）。

## 文件与接口归属

- `collaboration_models.py`：独立管理邀请、挂名候选/有效同意、参与历史、命令收据。
- `collaboration_schemas.py`：目标解析、分页本人待办、关系命令/结果、文字工作区白名单。
- `collaboration_common.py`：稳定账号/项目锁、当前权限、版本、收据与审计共用边界。
- `collaboration_service.py` / `collaboration_router.py`：定向邀请、分开同意、撤销/退出、本人查询、公共挂名。
- `transfer_models.py` / `transfer_schemas.py` / `transfer_service.py` / `transfer_router.py`：转让摘要、逐份授权、主动查阅、原子生效与最小双方结果。
- `lifecycle_models.py` / `lifecycle_service.py` / `lifecycle_router.py`：结项/恢复、白名单公开版本、预览发布及来源治理检查。
- `models.py` / `service.py`：不可变创建者独立于当前 owner；创建重放最小结果。
- `achievement_service.py` / `recruitment_service.py`：复用文字实现并显式选择 owner 或已接受共管，不共享证明权限。
- `review_operations_service.py` / `mentor_link_service.py` / `review_service.py` / `evidence_service.py`：参与回避、锁后重验、获授权证明范围。
- Alembic `0038_innovation_collaboration.py` 与后续 task migration（不改已交付0037）；`app/db/base.py` 注册全部新表，`app/main.py` 装配真实路由。
- `frontend/src/features/innovation/collaboration/` 与独立本人入口；合流后接项目列表/编辑器/公开详情/审核提示。
- `infra/r6/`：仅 R6 服务、日志、锁、Git gate context；沿用经过验证的 R5 runner 机制，所有资源重命名。

### Task 1：隔离资源与新鲜基础证据

Files: `infra/r6/{compose.yml,stack.ps1,run.ps1,launch.sh,run.sh,prepare-git.py,smoke-runtime.py,smoke-browser.mjs,verify-migrations.py,test-*.mjs,test-playwright-env.ts,README.md,.gitignore}`。
Interfaces: `stack.ps1 Check|Start|Status|Stop`；`run.ps1 backend|python|frontend|node|tsx|playwright|visual ARGS`。PG16438/campusquest_test_r6、Redis6478 DB0/1、HTTP/TLS MinIO9125/9126、Clam3318、Web3308/API8308，全部容器/卷前缀 campusquest-r6。
- [x] 在 Docker/端口实际清单确认无占用；复制机制到 R6 并验证错误目录/错误资源拒绝、参数和退出码保留。
- [x] 创建只属于 R6 的依赖与环境；执行 unit、innovation integration 新鲜基础，记录日志/退出码。
- [x] 真实 PG/Redis/对象存储 smoke、空库迁移及 runner 序列化自证。

### Task 2：协作关系、本人待办与独立挂名

Files: collaboration 三层文件、0038、models/service、`tests/integration/innovation/test_collaboration*.py`、`docs/quality/test-matrix/innovation-collaboration.md`。
Interfaces: `POST /ie/collaboration/targets/resolve {account}` → opaque target_ref/nickname；`GET /ie/me/collaborations?limit&offset`；`GET|POST /ie/me/project-drafts/{id}/collaborators`；`POST /ie/collaborations/{id}/{accept|reject|revoke}`；挂名独立 `/member-consents` 动作。命令均 request_id + version，创建还带 target_ref；服务 `CollaborationService(clock).invite/act/list_mine/list_project`。
- [x] 先从 spec 写 C01–C22 expected 矩阵，绑定实现任务；新增 RED：未接受无权、错人拒绝、分开管理/挂名、姓名候选拒绝保留旧版、到期边界、双侧撤销、重放不复活、本人202条分页。
- [x] 实现独立表、约束、服务事务、最小响应、7天期限、持久审计；单方邀请不入参与历史，接受/有效同意才加入。
- [x] 当前创建者 backfill 与创建唯一键迁移；RED/GREEN 验证转让后最小重放和同键异内容拒绝（生效转让在任务4验证）。
- [x] 真实 PG 关系竞态及约束 GREEN；ruff format/check + mypy。

### Task 3：协作文字、合资格招募及一致回避

Files: collaboration workspace、achievement/recruitment 服务、review_operations/mentor_link 服务、相关 integration tests。
Interfaces: `/ie/collaboration/projects/{id}` 文字读写；`/achievements` 文字草稿入口（复用 DTO，无证明）；`/recruitments` 按动作资格，公开联系只走原授权规则。`require_project_editor(db,actor,project_id)` 在项目锁后验证 owner/ACCEPTED manager；`project_participant_exists(project_id,user_id)` 统一所有回避查询；新增关系原子释放该用户已有领取。
- [x] RED：无资格共管存稿/关闭可用，发布403；合资格共管发布；证明、提审、授权、导师、转让和生命周期仍拒绝；并发保存/提审保留版本。
- [x] 实现按动作授权，不把 owner-only 入口统一放宽；项目和成果保存与提交共享锁序。
- [x] RED：历史负责人/共管/成员/导师/实际查阅者队列、领取、详情、下载、决定拒绝，单方发邀不回避；接受关系后已领取回待分配。
- [x] 服务统一参与判定，真实 PostgreSQL 多连接竞态 GREEN；包含既有 review/mentor/recruitment 回归。

### Task 4：版本化转让、逐份证明与恢复结果

任务3阶段证据：个人分类、公开同意展示、保存/撤销/提审/关闭来源的15项组合通过（`20261019T100450-backend-6147.log`），mypy 233文件通过（`100537-backend-6177.log`）。共用历史回避及既有双创393项在进入任务4前通过。历史负责人、实际查阅人及完整前端证据仍与任务4/6/7合验，不提前关闭跨任务复选框。实际统一谓词名为 `review_conflict_exists`；本人项目列表为 `GET /ie/me/collaboration-projects?role=OWNER|MANAGER|MEMBER`，公开挂名为 `GET /ie/projects/{id}/members`；两个邀请用途共用 `/collaborators` 加明确 `kind`，未引入冗余 `/member-consents` 别名。

Files: transfer 四层文件、单独 Alembic migration、evidence/review/mentor/recruitment 衔接、`test_project_transfer*.py`。
Interfaces: `POST /ie/me/project-drafts/{id}/transfers`（target_ref/evidence_ids/allow_preview/request_id）；`GET /ie/transfers/{id}` 最小摘要 + confirmation_fingerprint；`POST /{id}/{accept|reject|cancel}`（version/request_id/confirmation_fingerprint）；受控 `GET /{id}/evidence/{evidence_id}`；`GET /ie/me/transfers` 分页结果。`TransferService(clock,storage,audit).request/summary/act/read_evidence/list_mine`。
- [x] RED：待审/资格失效阻塞；未选/错误目标/无提前授权拒读；取消、拒绝、期限、材料变更后旧读取失效；主动查阅才写回避和 durable audit，审计失败不返回对象。
- [x] 实现当前摘要指纹覆盖项目/生命周期/公开版本/团队/导师/证明/岗位；版本变化409并返回明确重确认路径。
- [x] RED：两人并发接任最多一次、转让与保存/提审/结项/介绍发布/导师邀请竞争；旧负责人锁后无迟到写入；其他有效关系保留，未确认邀请失效，关闭招募和旧联系，选中证明明确赋权。
- [x] 实现单一事务、数据库约束和收据；原创建者、原指纹和提交者不变；双方失权后仍最小查询/重试，未选证明不能复用。
- [x] 独立 PG 连接重复竞态与证明 MinIO smoke GREEN，补原创建幂等 C14/C15 测试。

当前DTO用 `confirmation_digest` 表达上述确认指纹；提前查阅还必须传请求版本 `?version=`。0041引入不可变上传者/上传owner代、递增owner代和本代逐份授权；交接证明只可读取/复用，不赋予旧上传合同、完成扫描或移除权限。任务4现已实现并有完整专项及真实对象浏览器证据；首轮少量测试不作为完成依据，最终全站门禁仍单独验收。

### Task 5：生命周期与可更正公开档案

实施前自审补充（现已按下述边界实现）：增加 `GET /ie/me/project-drafts/{id}/lifecycle` 输出当前状态、将关闭岗位与公开后果，以及确认digest；complete/resume命令携带该digest和project.version，避免仅校验文字版本却关闭确认后新增的岗位。状态转换和介绍发布都递增project.version，使转让摘要同步失效。档案只保存此前真实发布过的四字段白名单，保留原来源及原revision，正常关闭/到期与明确下架分别处理；不因正常关闭而抹掉“此前公开”的事实，也不从私稿或待审成果首次公开。原来源治理和档案治理持续校验，恢复不清除状态。介绍版本及命令收据不可变，FK绑定来源与项目。已结项岗位可存稿，明确开放需先恢复进行中；成果仍沿用审核流程。任务5已按先RED再实现执行，生命周期与介绍专项及浏览器旅程通过；具体日志见验证账本，最终全站交付仍未完成。

Files: lifecycle 三层文件及 migration、public_project/recruitment 服务与 DTO、`test_project_lifecycle*.py`。
Interfaces: `POST /ie/me/project-drafts/{id}/{complete|resume}`；`POST /{id}/introduction/preview` → version/source/fields/治理解释；`POST /{id}/introduction/publish`（version/request_id/preview_fingerprint）。`LifecycleService(clock).complete/resume/preview/publish`；公开项目 DTO 新增 lifecycle/introduction_source/introduction_revision。
- [x] RED：招募单源结项保留最后已公开介绍，岗位关闭；私稿、未审成果、从未公开项目不能成为公开源；来源下架使档案失效。
- [x] 实现独立不可变白名单介绍版本和来源绑定，结项捕获实际公开源；显示暂无已核实成果，保留成果各自审核事实。
- [x] RED：负责人资格/治理失效拒发布，共管可备稿但不能发布；预览后变化需重确认；恢复后仍可见而岗位/关系/联系不复活。
- [x] 真 PG 并发及回归 GREEN，审核快照不变。

### Task 6：稳定 UI 合流及完整旅程

Files: collaboration 页面/API/命令恢复、现有项目/成果/招募/导师/审核页面最小合流、`innovation-collaboration.spec.ts` 与 unit tests。
Interfaces: 仅消费已生成 schema；恢复命令按 user/authEpoch/workspace 隔离，保留原 request_id、body 和输入；明确4xx清命令，unknown outcome先查结果；换号清除且隔离迟响应。
- [x] 只读核对 UI 线的稳定源码交接和验证范围；在 R6 工作树单人合流，保留来源 commit/hash，不修改 UI 工作树。
- [x] 前端 behavior RED 后接入我的项目分类、受邀独立入口、公开挂名同意、共管权限说明、转让逐份/差异/最小结果/逐岗恢复、结项预览发布及审核协调去向。
- [x] C01–C22 跨账号浏览器旅程；手机、键盘、加载/空/错误/无权限/长内容/网络未知/换号/迟响应；保存冲突保留输入、确认关闭及焦点返回。
- [x] 选择器契约、no-skip 豁免、经走查新功能视觉证据及稳定基线；不重拍旧基线强过。

### Task 7：同版本门禁、独立评审与操作指南

Files: OpenAPI快照/生成类型、test matrix、`docs/quality/innovation-collaboration-verification.md`、`docs/qa/innovation-r1-r6-guide.md`、`docs/handovers/2026-10-19-innovation-r6.md`。
- [x] `run.ps1 backend ruff format --check app tests alembic`、`ruff check app tests alembic`、`mypy`；`pytest tests/unit -q`、`pytest tests/integration -m integration -q`（真实 smoke flags）及 `pytest tests/e2e -q`。
- [x] `run.ps1 python ../infra/r6/verify-migrations.py`；OpenAPI dump/类型生成及新鲜度、全部矩阵 checker、前后端覆盖率棘轮走正式命令。
- [x] frontend `typecheck`、`lint`、`check:css`、`test:unit`、`build`；完整 browser/visual/no-skip/cleanup，记录完整输出和实际退出码，不宣称远端CI。
- [ ] 按 requesting-code-review 对最终源码做独立评审；修复发现并重跑受影响门禁，记录精确 commit 和结论。
- [x] 操作指南覆盖 R1–R6 一页速查及七类角色，含找回邀请、无资格转交、冲突、待审、提前查阅、结果未知、岗位恢复、档案更正及回避协调；步骤和截图在稳定真实 UI 核对，凭据另存。
- [ ] 完整逐项验收审计；仅本地提交，明确未运行的远端 CI/未推送/未合并与源码状态。

## 自审记录（2026-10-19）

- 整体TREE评审F5实施修正记录（已RED后实现并专项GREEN）：转让选择元数据不能沿用要求APPROVED的旧proof list，原owner无需仍具发布资格。增加 `GET /ie/me/project-drafts/{id}/transfer-proofs?limit&offset`，服务锁定当前owner/项目，仅取当前代 `evidence_scope` 中READY且未removed材料，分页响应仅id、achievement_title、content_type、size；新动作不赋予下载、旧上传合同、完成扫描或删除权限。转让request/accept仍重验范围与digest，manager/旧owner不得枚举。以无资格owner已有草稿的浏览器RED及资格失效READY材料/本代/manager/旧owner/移回不复活的真实PG RED起步，再接生成契约/前端。因产品backend会变化，修后重置coverage并重跑完整unit/integration/worker，不能把旧行号覆盖数据追加当最终证据。

- §1–8 业务由任务2–6覆盖，§9技术边界落在各任务接口/锁/收据，§10合流任务6，§11 C01–C22由矩阵逐项绑定，§12指南任务7。
- C05/C12/C14/C21 和上述五类 Review Focus 均有指定先失败测试；不把旧R5门禁当R6证据。
- 主目录没有含R5源码，原生worktree工具返回 Not a git repository；已从核实R5提交使用 Git fallback创建独立树，attach也因非managed拒绝，未改原工作线。
- 实时 Docker 清单发现 UI 占16437/6477/3317，计划改用16438/6478/3318与9125/9126、3308/8308。开栈前再次核对。
- 无需用户重新拍板的业务歧义；7天为工程默认值，只纳入可配置期限及边界测试。共同页面合流须有稳定源码证据，期间继续后端。

## 执行账本

- 2026-10-19：设计复制到R6树，完成实际状态核对及计划自审；以上复选框尚未完成。
- 2026-10-19：任务1资源、基础unit/innovation integration、私有Git/Playwright配置/runner锁和真实依赖smoke已验证；0039前的完整正反迁移通过。证据集中于 `docs/quality/innovation-collaboration-verification.md`，后续新增迁移重新自证。
- 任务2接口选择：`/collaborators` 使用必填 `kind=MANAGER|MEMBER` 明确用途，各候选各自单独确认，不另设同义 `/member-consents`；固定不可变候选绑定具体姓名/分工，新候选不改旧有效同意。0038持有关系表/不可变保护，0039持有创建者与原请求身份。
- 任务3补充明确命令：`CollaborationProjectSaveCommand` / `CollaborationAchievementSaveCommand` 包含request_id+version；0040 `ie_workspace_command_receipts` 持有不可变指纹及 applied_version；项目保存返回 replayed/applied_version，成果保存返回 current/replayed/applied_version。原owner-only入口不扩权限。此补充落实设计§9，并非缩减断网恢复要求。
- 2026-10-19 UI compact wait cursor `3de01b48-8831-48b0-aaf9-74df57c0fbbe:2`，UI仍active、未交接稳定源码，下一次检查用afterCursor；不以此阻止后端任务。
- 转让衔接核对（待实现）：现有 `AchievementEvidence` 没有上传者字段；list/read/remove/complete及ReviewService所选材料均只按项目/成果归属。任务4须增加不可变上传者和上传时 ownership_generation，ProjectDraft每次转让递增ownership_generation，明确证明授权也绑定该代。仅 `uploaded_by == current_owner` 或 `project+user+evidence` 会在同人以后重新接任时复活未选旧授权，不满足C11/C13/C20；必须用当前代过滤清单、读取、finalize、删除及成果复用。移交只授予明确读取/使用范围，旧上传合同/对象key/资格快照不得转交。

- 2026-10-19T17:28Z：按实际证据更新任务3–5及任务6前三项复选框：真实PG权限/竞态、转让证明/摘要/终态、生命周期与十四项R6浏览器均已验证；不是最终全站验收。任务6的完整视觉及任务7继续开放：默认全部projects第三轮255通过/1项R4加载失败/46配置skip，no-skip未执行；新R6回避说明须独立视觉参考并重新无update验证，其余后端/视觉完整链仍进行。
