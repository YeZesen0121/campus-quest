# R5 导师库规约测试矩阵

预期从 2026-10-15-innovation-mentor-design.md 推导。以下列出对应测试；具体运行结果见本轮验证回执，不以历史 R4 通过作证据。

| 编号 | 规约预期 | 验证位置 | 状态 |
|---|---|---|---|
| M01 | MENTOR本人可登录/浏览/确认，不获任务或管理权限 | `tests/integration/identity/test_mentor_identity.py`；`frontend/src/__tests__/workspace-gate.test.ts` | 已覆盖 |
| M02 | 必需字段、明确同意、渠道和授权范围白名单 | `tests/unit/innovation/test_mentor_schemas.py` | 已覆盖 |
| M03 | 未确认私有，本人才可确认，DTO无联系值 | `tests/integration/innovation/test_mentor_lifecycle.py` | 已覆盖 |
| M04 | 授权内更新公开；混合/联系变化整份再确认且保留旧版 | `tests/integration/innovation/test_mentor_lifecycle.py` | 已覆盖 |
| M05 | 旧版本冲突，重试不重施授权，同request异内容拒绝 | `tests/integration/innovation/test_mentor_lifecycle.py`；`tests/integration/innovation/test_mentor_races.py` | 已覆盖 |
| M06 | 暂停、单渠道撤回、展示撤回、维护撤权即时生效 | `tests/integration/innovation/test_mentor_lifecycle.py` | 已覆盖 |
| M07 | 治理下架和账号失效不能被确认绕过 | `tests/integration/innovation/test_mentor_lifecycle.py` | 已覆盖 |
| M08 | 指定导师同意前不展示，双侧解除，不增加项目权限；对方停用不阻止本人解除 | `tests/integration/innovation/test_mentor_links.py` | 已覆盖 |
| M09 | 私有项目不因关联公开，撤回档案不残留/复活挂名 | `tests/integration/innovation/test_mentor_links.py`；`tests/integration/innovation/test_mentor_races.py` | 已覆盖 |
| M10 | 运营/本人/浏览者/负责人端到端且账号切换无泄漏 | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖 |
| M11 | 手机、键盘、空/错误/长内容及新稳定界面像素 | `frontend/e2e/innovation-mentors.spec.ts` | 已覆盖 |
| M12 | 真实路由/会话/数据库/审计组合；审计故障不公开/不返回联系值 | `tests/integration/innovation/test_mentor_races.py` | 已覆盖 |
| M13 | 测试世界只清理本world、跨world拒绝、历史保护恢复 | `tests/integration/innovation/test_mentor_world_cleanup.py` | 已覆盖 |
| M14 | 运营私有详情先持久审计，失败不返回联系值；GET/PATCH同序锁无死锁 | `tests/integration/innovation/test_mentor_operations_reads.py`；`tests/integration/innovation/test_mentor_read_races.py` | 已覆盖 |
| M15 | 双方分页可访问超过200条的旧待定/已接受关系并处理 | `tests/integration/innovation/test_mentor_link_pagination.py`；`frontend/e2e/innovation-mentors.spec.ts` | 已覆盖 |
| M16 | 未知命令跨同会话SPA/Back/项目编辑卸载恢复原body和UUID；用户与auth epoch隔离，换号同步清除 | `frontend/src/__tests__/mentor-recovery.test.ts`；`frontend/e2e/innovation-mentors.spec.ts` | 已覆盖 |

## 缺口明细

- 已关闭 G-1：最终8项R5浏览器场景及三张新PNG无更新参数比较全部通过（101640-python-175360），新旧界面走查见 `../innovation-mentor-visual-walkthrough.md`。
- 已关闭 G-2：双方202条真实PG分页通过，浏览器双方翻页与动作刷新、资料操作期间保留未知请求通过（072111-backend-17914、080451-playwright-75263）。

- 已关闭 G-3：恢复容器6项RED→GREEN；最终8浏览器覆盖运营修改/创建、Shell导航、同文档Back、项目父列表重开、原body/UUID、邀请对象/页码恢复及跨标签登出/换号清理（101640-python-175360）。
