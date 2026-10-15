# R5 导师库设计

状态：用户于 2026-10-15 选择站内本人确认，并在短方案后回复“推进推进”，批准按该方案实施。下面细化接口与边界；不增加额外业务阶段。

## 目标与边界

运营录入本校导师，导师本人核对具体版本并分别确认公开、联系渠道和运营维护范围；校内用户浏览并自行联系；项目挂名另取同意。首期无外部确认、指导申请、预约、录取、私聊、导师附件上传。学校 SSO 最后；演示身份明确标注，权限与业务状态真实执行。不进入 R6，不合并 main。

独立 worktree `C:/Users/111/Documents/CodexWorktrees/campusquest-r5-mentor`，分支 `codex/r5-mentor-library`，基线 `4ace255a7cd25648c8076d835c15fbf1cfbd9612`。UI checkout 和服务不动；页面复用当前组件/token。

## 身份与角色

新增受限 MENTOR 角色，沿用 User/Session/撤销/封禁机制。`POST /api/v1/auth/mentor/login` 使用已有 LoginRequest/TokenPairResponse；仅 MENTOR 登录此入口，落点 `/innovation/mentors/me`。既有 TEACHER 通过既有 staff 登录，绑定导师档案后按本人对象授权操作。导师不是任务教师，不获领取任务、发任务或管理权限；现有非学生默认职员分支改为显式白名单。运营仍用既有被授予运营权限的学生账号。导师业务通过 active actor + 档案 user_id 检查，不由前端隐藏按钮替代。

## 数据与版本

导师聚合保存私有草稿 `fields`、`version`、`confirmation_state`（PENDING/CONFIRMED/REJECTED）、公开开关 HIDDEN/VISIBLE、独立治理状态 NORMAL/TAKEN_DOWN、`accepting_contact`、`authorized_fields`、公开版本指针。账号唯一绑定一份导师档案，不支持运营重新绑定以冒领既有授权。

草稿字段：name(50)、unit(100)、introduction(2000)、directions(1000)、achievements(3000)、project_types(1000)、contacts(最多4种，复用 ContactInput 校验)。正文允许代表成果文字与安全 http/https 链接（使用文本输入，不自动抓取外部内容）。确认发布要求姓名、单位、简介、方向、项目类型非空；代表成果选填，避免虚构。联系人由导师明确选取可公开渠道；接受联系时至少有一种获准渠道，否则应选择暂停联系。

公开 revision 不可变，content 不包含联系方式，contacts 独立存储。Consent 记录本人、档案、操作时草稿版本、同意范围、时间；公开版本记录对应同意来源。操作审计只保存版本、动作、字段名等必要元数据，不复制联系方式。变更请求含 request_id 和 version；同请求异内容冲突，同请求重试返回当前状态且不得重新施加旧授权。使用真实 PG 约束、稳定锁序和事务，不依靠进程锁。

前端结果未知的原命令按当前用户、auth epoch 和具体工作区保存在内存中。普通 SPA 导航、浏览器同文档返回或项目编辑器卸载后，重新进入仍可重试原 body/request_id；创建导师的本地编辑状态须有可发现的恢复入口。成功或明确失败清除，登出/换号同步清除；恢复范围为当前登录会话与页面生命周期，不承诺浏览器重启后的持久恢复。

## 公开和维护

运营创建/保存初稿后为 PENDING，只有本人和获权运营能查看，普通校内用户不能访问。导师确认页逐项显示资料、联系值和维护范围，默认不勾选同意；确认绑定当前 version。本人可拒绝候选版本，旧已确认公开版本不受影响。

维护范围白名单为 introduction/directions/achievements/project_types，导师逐项授予和撤销。仅当前已确认、公开中的档案且所有变更均在授权范围内，运营保存才能产生新公开版本。任何未确认候选、范围外变更、姓名/单位/联系值变化都保持候选待确认，公众继续看到旧确认版。运营不能自己确认/恢复联系，也不能修改导师绑定或直接赋维护范围。

本人可立即暂停联系、恢复联系、撤销单渠道、修改维护范围和撤回展示。暂停保留公开档案，联系方式接口拒绝且不显示联系按钮；无自动过期。撤回展示同时清空维护授权、停止联系并撤销项目挂名；重新公开须本人确认，不自动恢复旧挂名。所有读取联合检查当前账号有效、公开、未下架；再次确认和编辑都不清除治理下架状态。授权操作与治理状态分离；本轮不扩展 R7 治理后台。

## 项目挂名

本轮仅现有具资格的项目负责人可为自己的项目发起挂名确认。关联记录保存项目、导师、状态 PENDING/ACCEPTED/REJECTED/REVOKED、版本及给导师看的项目标题/简介/方向摘要；不传核实材料。导师本人接受或拒绝，任一方可解除；不授项目管理、成员或证明读取权限。发起者主动将该摘要提供给指定导师，不因此公开项目。

公开关联仅在项目按原有成果/有效招募规则本来可见、导师档案可见且关系 ACCEPTED 时显示。导师同意的是具体项目的挂名，公开展示实时沿用该项目已获准公开的信息；不从私有草稿透出最新内容。导师撤回档案会撤销所有待定/已接受关系，旧请求不能复活。重复发起同项目/导师不会产生重复挂名，重新发起新一轮需重新本人确认。

双方私有挂名列表使用明确分页（limit 默认20、上限100，offset 默认0，返回 total/limit/offset）；页面可逐页访问全部待办和历史，不能静默截断而使旧关系无法接受、拒绝或解除。这是现有动作可达性的实现约束。

## 页面与接口清单

页面：`/innovation/mentors` 列表（关键词、方向、接受联系筛选）；`/innovation/mentors/[id]` 详情；`/innovation/mentors/me` 本人确认/权限/挂名待办；`/innovation/operations/mentors` 运营列表与录入、`/[id]` 维护。既有项目管理页增加挂名确认区，既有公开项目详情增加已同意导师区。共享 UI 只做必要入口及角色分流，不改全站主题。

以下路径相对 `/api/v1`，所有返回 private,no-store：

| 路径 | 输入与输出 |
|---|---|
| GET/POST `/ie/operations/mentors` | 分页维护列表；创建 `{request_id,mentor_username,fields}` → MentorActionResult |
| GET/PATCH `/ie/operations/mentors/{id}` | 私有 MentorProfileResponse；保存 `{request_id,version,fields}` → action result |
| GET `/ie/me/mentor` | `{profile: MentorProfileResponse|null}` |
| POST `/ie/me/mentor/confirm` | `{request_id,version,confirm_profile:true,contact_channels,authorized_fields,accepting_contact}` |
| POST `/ie/me/mentor/reject`、`/withdraw` | `{request_id,version}` |
| POST `/ie/me/mentor/contact-state` | version command + accepting_contact |
| POST `/ie/me/mentor/maintenance-scope` | version command + authorized_fields |
| POST `/ie/me/mentor/revoke-contact` | version command + channel |
| GET `/ie/mentors` | q/direction/accepting_contact/limit/offset → items,total,limit,offset |
| GET `/ie/mentors/{id}` | contact-free PublicMentorResponse |
| POST `/ie/mentors/{id}/contacts` | expected_public_version → `{public_version,contacts}`，同步审计 |
| GET/POST `/ie/me/project-drafts/{id}/mentors` | 负责人关系列表 limit/offset → items,total,limit,offset；`{request_id,mentor_id}` 发起 → ProjectMentorResponse |
| GET `/ie/me/mentor/project-links` | 本人挂名待办/历史列表 limit/offset → items,total,limit,offset |
| POST `/ie/mentor-links/{id}/accept`、`/reject`、`/revoke` | version command → ProjectMentorResponse |
| GET `/ie/projects/{id}/mentors` | 仅该公开项目可见的导师摘要列表 |

MentorProfileResponse 含 id/fields/version/confirmation_state/visibility/moderation_state/accepting_contact/authorized_fields/public_version/public_content(无联系值)/public_contact_channels/updated_at。MentorActionResult 含 action,replayed,applied_version,current。PublicMentorResponse 含 id,content,accepting_contact,contact_channels,public_version,published_at；列表摘要提供 name/unit/introduction/directions/project_types/accepting_contact/public_version。ProjectMentorResponse 含 id,project_id,mentor_id,mentor_name,project_title,project_summary,project_direction,status,version,created_at；仅双方私有读。

## 验收与证据

规则单测：字段/渠道/范围白名单；PG：未确认不可见、本人确认、越权/旧版本/重试、字段内和外更新、撤回/暂停/单渠道撤销、下架不能绕过、账号停用、项目同意/拒绝/解除/公开边界及真实连接并发。至少一条真实路由/依赖组合 smoke，迁移空库到 head。

浏览器：运营→导师→校内浏览者→项目负责人完整旅程，跨账号无数据残留；手机/桌面、加载/空/错误/权限/长文本、键盘焦点与提示。新稳定界面交像素证据。既有视觉基线默认保留；已批准的导师登录/三库入口和项目已同意导师区若产生内容差异，核实新旧PNG及来源后仅更新受影响图片，独立提交走查记录，不调整主题、字体或容差。API 工件、规约矩阵、选择器契约及适用 no-skip/coverage 工件同交付。

独立 PG/Redis/MinIO/worker/浏览器 context；不运行固定旧 compose 的 clean-start/migration 脚本。基础设施参数化变更需全量 e2e/视觉及自身验证。所有通过声明来自本轮完整日志和退出码，不复用 R4 或未经核对的远端结果。
