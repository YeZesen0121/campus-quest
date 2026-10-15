# R5 导师库实施计划

> **For agentic workers:** Use executing-plans / subagent-driven-development with TDD. 用户已明确批准方案并要求推进；本会话按文件所有权并行执行，集成后独立评审，不追加重复授权。

**Goal:** 交付运营录入、导师本人授权、校内浏览联系和独立项目挂名闭环。
**Architecture:** 在 innovation 内新增独立导师模型/DTO/服务/路由；身份沿用现有会话增加 MENTOR；公开内容只从已确认 snapshot 读取。根代理单线持有数据库迁移和 OpenAPI，身份、界面与隔离环境按文件所有权分工。
**Tech Stack:** FastAPI、SQLAlchemy、PostgreSQL/Alembic、Next.js/React、pytest/Playwright。
**Spec:** ../specs/2026-10-15-innovation-mentor-design.md

## Global Constraints

- 独立 worktree/分支与开发测试资源，禁止改 UI checkout/占用其服务。
- SSO 最后；演示身份明确标注；无 R6、无自动合并 main。
- 沿用组件/token、Clock、真实 PG、稳定 BusinessError、durable audit；不新增框架依赖。
- 根代理拥有迁移、models 注册、路由装配与生成契约；子代理不提交共享工作树。

## Review Focus

- 确认页打开后运营更新：过期版本不得确认新内容（任务2）。
- 撤回后重放旧确认或授权内保存：不得恢复展示/挂名（任务2/3）。
- 新 MENTOR 被非学生分支当教师/管理员：拒绝任务/管理入口（任务1）。
- 混合授权字段与越权字段一次保存：整份候选保持待确认（任务2）。
- 私有项目关联成功：关系不得使项目草稿或证明公开（任务3）。

### Task 1：隔离运行环境与受限导师身份

Files: identity enums/models/session/staff/router、auth workspace/api/forms、login页面和三类 Shell；infra/r5/、Playwright/global setup；身份单测/集成与测试配置自证。
Interfaces: `POST /api/v1/auth/mentor/login` → 现有 TokenPairResponse；MENTOR 落点 `/innovation/mentors/me`；R5 runner 提供可重复的 pytest、uv、npm 与独立服务。
- [x] 为 MENTOR 登录成功、其他入口拒绝、任务/管理门禁新增失败测试并记录 RED。
- [x] 最小身份扩展并执行 GREEN；迁移 CHECK 由任务2集中创建。
- [x] 独立环境只连接 R5 资源；验证端口、数据库、Redis、MinIO、测试删除目标与浏览器隔离。

### Task 2：档案、本人确认、授权维护与联系

Files: new mentor_models.py / mentor_schemas.py / mentor_service.py / mentor_common.py / public_mentor_service.py / mentor_router.py；backend/app/db/base.py、app/main.py、0037_innovation_mentors.py；unit/integration/innovation/test_mentor_*.py。
Interfaces: 上述 spec 所有导师档案接口；MentorService(clock,audit) 持有事务、版本、审计；PublicMentorService 公开读与按需联系；数据库约束与业务锁共同防并发。
- [x] 从 spec 先写规约矩阵 expected 列；字段/确认/授权/联系和状态竞态测试先 RED。
- [x] 实现明确 DTO、不可变 revision/consent、request receipt、权限锁与服务事务，返回当前状态防迟到回执。
- [x] 实现公开查询和单独审计联系端点；验证旧确认版保留、暂停/撤回/下架拒绝访问。
- [x] 迁移空库到 head，定向测试 GREEN；ruff/mypy；生成 OpenAPI 与 frontend 类型供任务4。

### Task 3：项目挂名单独同意

Files: new mentor_link_service.py、mentor_link_router.py；任务2共用 schema/model/migration；integration/innovation/test_mentor_links.py。
Interfaces: spec 的 project links API；公共关系读取沿用 PublicProjectService 的可见性，不改变项目公开资格。
- [x] RED：未同意不挂名、错误导师拒绝、双侧解除、私有项目不公开、撤回档案撤销关系、并发/重复发起。
- [x] 实现关系版本和双方权限、项目摘要快照、唯一约束和审计；不添加 R6 权限。
- [x] GREEN：独立 PG 连接竞态、真实路由组合与原项目可见性回归。

### Task 4：导师页面与完整旅程

Files: frontend/src/features/innovation/mentors/；app/(campus)/innovation/mentors/、运营导师页；双创/运营入口、项目管理与公开详情的最小挂名区；前端单测、e2e/innovation-mentors.spec.ts。
Interfaces: 只消费生成 API schema；使用任务1登录和 spec 页面路径；操作都带版本/request_id，冲突保留输入并重新读取。
- [x] 表单/展示/状态与API适配行为测试 RED，再实现正常、空、错误、权限和长内容态。
- [x] 运营录入维护、本人确认/授权/暂停/撤回、校内筛选详情/授权联系、项目同意/解除页面与入口全部连通。
- [x] 浏览器跨账号闭环、手机/桌面与键盘 GREEN；新稳定页视觉证据与选择器契约。

### Task 5：集成门禁、独立评审与交付

Files: test-matrix/innovation-mentor.md、验证/视觉记录、demo与handover、API生成物和必要测试工件。
- [x] 运行完整后端/前端静态、单测、真实 PG/组合/迁移、e2e/no-skip、视觉及基础设施自证，保存完整日志/退出码。
- [x] 独立审阅最终 diff；针对发现补回归并修复，再跑受影响门禁。
- [x] 只在 R5 分支提交；交付明确标注的体验账号/地址及验收卡，记录精确 head、测试证据和未做事项。不自动合并或改共享分支。
