# R6 协作与生命周期规约对账矩阵

预期列于查找/编写新测试前从已确认设计 §11 推导。C01–C22已有实际覆盖，C09/F5经API及浏览器真实RED后修并GREEN；完整本地默认浏览器、原no-skip、真实后端全域及专用视觉均已通过，最终实际提交独立评审另记，不代表远端CI或owner合并验收。真实日志范围见 innovation-collaboration-verification.md。C08 的202条本人历史可达由真实PG验证，浏览器验证本人入口与处理；C22另用路由模拟21条及超长内容检查分页、焦点与手机边界，不将其冒充真实业务数据。

| # | 场景 | 独立预期 | 测试证据 | 状态 |
|---|---|---|---|---|
| C01 | 目标尚未接受共同管理邀请 | 无编辑权；其他账号不能代接受 | `tests/integration/innovation/test_collaboration.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C02 | 共同管理与公开挂名分别确认 | 可只接受管理或只同意挂名；无隐式捆绑 | `tests/integration/innovation/test_collaboration.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C03 | 无资格或有资格的共管准备招募 | 前者可存稿并交负责人发布；后者满足本人资格、已接受管理权及项目公开条件后可发布，不被误判为必须是 owner | `tests/integration/innovation/test_collaboration_workspace.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C04 | 共管尝试证明、提审、授权、导师管理或转让 | 对应私有字段不返回，未授权动作被后端拒绝 | `tests/integration/innovation/test_collaboration_workspace.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C05 | 多人修改与负责人提交竞争 | 只提交已保存一致版本；失败不覆盖新稿，本地输入保留 | `tests/integration/innovation/test_collaboration_write_races.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C06 | 姓名或分工改候选，目标拒绝或尚未确认 | 旧有效公开版保留；未同意新内容不展示 | `tests/integration/innovation/test_collaboration_queries.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C07 | 任一方结束挂名或撤回管理 | 对应展示或权限即时失效，另一种关系独立；旧请求不恢复关系 | `tests/integration/innovation/test_collaboration.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C08 | 目标从本人入口查待办、历史和退出操作 | 无需项目编辑权即可处理本人的事项；分页可达 | `tests/integration/innovation/test_collaboration_queries.py`；`frontend/e2e/innovation-collaboration.spec.ts`（独立world完整管理/挂名旅程） | 已覆盖 |
| C09 | 原负责人无资格、存在待审或接任资格失效 | 原负责人不要求仍有发布资格，能逐份选择当前有权交接的证明；待审或接任资格无效时阻止生效并指出处理路径 | `tests/integration/innovation/test_project_transfer_consequences.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`；`tests/integration/innovation/test_transfer_proof_choices.py`（资格失效READY分页、本代及移回不复活、旧proof仍拒） | 已覆盖 |
| C10 | 接任前明确授权提前查阅 | 仅指定目标、选中证明、有效期限与版本可读；资格资料与未选证明不可读；主动查阅触发回避，单方面发邀不触发 | `tests/integration/innovation/test_project_transfer_evidence.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（实际提前查阅/取消/旧摘要409/丢失接任回执/逐岗恢复） | 已覆盖 |
| C11 | 取消、拒绝、过期、换目标或改材料后重放 | 旧查阅与旧确认失效，原审核证明和历史不被改写 | `tests/integration/innovation/test_project_transfer_evidence.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（实际提前查阅/取消/旧摘要409/丢失接任回执/逐岗恢复） | 已覆盖 |
| C12 | 并发转让及转让与保存、结项恢复、介绍发布、导师邀请、提审竞争 | 最多一次转让成功；内容或生命周期变化需重新确认，锁后重验当前权限，不发生旧负责人迟到写入 | `tests/integration/innovation/test_project_transfer_races.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（实际提前查阅/取消/旧摘要409/丢失接任回执/逐岗恢复） | 已覆盖 |
| C13 | 转让完成 | 原负责人失去管理；选中证明按范围交接；其他已接受关系保留；未确认邀请失效；招募关闭 | `tests/integration/innovation/test_project_transfer_consequences.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（实际提前查阅/取消/旧摘要409/丢失接任回执/逐岗恢复） | 已覆盖 |
| C14 | 原负责人重试旧创建请求或接任者请求键相同 | 不额外创建、不误用接任者的创建收据、不改变原创建指纹；原负责人不得取得现项目私稿、证明或联系方式 | `tests/integration/innovation/test_project_transfer_consequences.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（实际提前查阅/取消/旧摘要409/丢失接任回执/逐岗恢复） | 已覆盖 |
| C15 | 接任成功回执丢失或换页返回 | 双方可查询自己的最小结果并安全重试；原负责人仅看结果，新负责人有岗位恢复入口，不恢复旧管理权或泄露现项目私稿 | `tests/integration/innovation/test_project_transfer.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（实际提前查阅/取消/旧摘要409/丢失接任回执/逐岗恢复） | 已覆盖 |
| C16 | 新负责人恢复招募 | 核对当前内容、未来截止时间及联系授权后明确开放，旧联系不默认继承 | `tests/integration/innovation/test_project_transfer_consequences.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（实际提前查阅/取消/旧摘要409/丢失接任回执/逐岗恢复） | 已覆盖 |
| C17 | 仅招募公开的项目结项 | 招募关闭，最后公开介绍保留；显示无已核实成果，不出现私稿或虚假核实标记 | `tests/integration/innovation/test_project_lifecycle.py`、`tests/integration/innovation/test_lifecycle_races.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（结项→更正→恢复） | 已覆盖 |
| C18 | 从未公开项目结项或原来源被下架 | 不借结项首次公开，不通过留档或恢复绕过下架 | `tests/integration/innovation/test_project_lifecycle.py`、`tests/integration/innovation/test_lifecycle_races.py`；`frontend/e2e/innovation-collaboration-states.spec.ts`（私有结项） | 已覆盖 |
| C19 | 更正结项介绍与继续补充成果 | 介绍由资格有效的当前负责人先预览再发布并保留版本；治理限制不被绕过，成果仍按原流程核实，旧审核快照不变 | `tests/integration/innovation/test_project_lifecycle.py`、`tests/integration/innovation/test_lifecycle_races.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（结项→更正→恢复） | 已覆盖 |
| C20 | 恢复进行中 | 档案介绍仍可见，岗位仍关闭，未重新同意的关系或联系不复活 | `tests/integration/innovation/test_project_lifecycle.py`、`tests/integration/innovation/test_lifecycle_races.py`；`frontend/e2e/innovation-collaboration-transfer.spec.ts`（结项→更正→恢复） | 已覆盖 |
| C21 | 历史参与人或新加入关系触发运营回避 | 队列、领取、详情、下载、决定一致拒绝；已领取事项回待分配并有后续协调去向 | `tests/integration/innovation/test_participant_review.py`；`frontend/e2e/innovation-collaboration-review.spec.ts`（真实领取后接受参与关系、详情/证明403、协调及队列排除） | 已覆盖 |
| C22 | 手机、键盘、错误、断网、换号和迟响应 | 操作可达，输入与原命令按范围恢复，私有数据不跨账号残留，确认与返回焦点明确 | `tests/integration/innovation/test_collaboration_workspace.py`；`frontend/e2e/innovation-collaboration-states.spec.ts`、`frontend/e2e/innovation-collaboration-recovery.spec.ts`、`frontend/e2e/innovation-collaboration.spec.ts`、`frontend/e2e/innovation-collaboration-visual.spec.ts`（真实切号迟响应、原命令与跨页恢复、分页键盘/四宽/axe、确认关闭结果焦点、44px原生标签） | 已覆盖 |

## 缺口明细

- 测试世界清理补充：`tests/e2e/test_browser_world_graph_cleanup.py`真实MinIO验证跨世界图拒绝时对象/白名单/设置/审计保持，以及DB图提交后对象中途删除失败仍可按持久清单重试；与奖励/模板/动态用户恢复及招募清理组合8项通过`161318-backend-159947`。这是测试隔离边界，不替代C01–C22产品旅程或最终完整门禁。

- C21前置五项概况修正后，真实浏览器专项通过；完整full4的C21再次通过，原no-skip退出0。后端参与历史、释放领取及全部读取/下载/决定由1599项全域集成覆盖。
- C22的F2跨页恢复、F3/F4、确认结果焦点和44px标签均已实际GREEN。早期加载/503及私有结项素材来自首轮整体失败中的已通过场景，该轮仍保留238通过/9失败/46跳过，不冒充整体通过。修后full4完整256通过/46具名豁免/零失败及原no-skip0，含R6十四功能；R6四视觉、核心16、成果核实、导航、招募、人才及导师完整专用world均已无update通过。61张旧PNG字节不变；两个被独立R6新状态参考替代的旧断言，不声称其旧参考本身通过。最终精确提交评审另记。

## 不匹配明细

- 当前C01–C22无未关闭的不匹配。C09/F5历史问题：旧proof list要求APPROVED，使无资格owner已有成果时连零材料也无法发起。专用owner-only、本代scope、READY且未remove的四字段分页查询已真实RED后实现；5项PG及27项混合浏览器通过，完整full4中的无资格owner旅程再通过。旧proof操作权限未放宽，原整体评审者源码复核关闭。第三轮R4详情加载失败经受控6秒响应RED→同步修正GREEN，并在完整full4通过；导师矩形精度问题为专用测试测量修正，完整10项通过，保留原失败及诊断证据，不用专项覆盖掩盖全站失败。
