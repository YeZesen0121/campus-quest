# R4.1 白卡与一句话介绍视觉走查

2026-10-13。用户确认独立人物、项目条目白卡，以及以新的一句话介绍替换列表的长介绍/优势。使用既有surface-1、间距、圆角、边框token；未改变字体、截图容忍度0.01或其他界面的基线。

旧图取自修改前受版本管理的基线，另保留在工作区 `.local-dev/r41-card-visual-before/`。更新只涉及人才和岗位/项目发现样式，由真实测试发布的具名模拟资料生成；没有修改用户开发资料。

| 图片 | 变更与走查 |
| --- | --- |
| talent-list-desktop / talent-materials-list-desktop | 白卡内边距与完整宽度标题/状态；只显示本人一句话，减少优势和长介绍，材料标志保持中性 |
| talent-list-mobile（新增） | 390px宽，白卡与背景分离，标题/标签/一句话可读，无水平溢出；固定底栏沿用既有行为 |
| talent-owner-desktop / talent-long-form-mobile | 一句话输入、40字符计数、柔和提示及保存必填说明；原长介绍/优势仍可编辑 |
| talent-preview-mobile | 新句加入本人预览，原完整资料仍可检查；滚动/取消/明确公开交互保持 |
| talent-detail-mobile / talent-long-detail-mobile / talent-materials-detail-mobile | 新句作为摘要，完整介绍/优势、材料和合作意向保留，长内容不溢出 |
| talent-contacts-mobile | 联系文案和内容未改变；详情新增段落使元素截取高度从238变237px（布局位置变化后的像素取整），未删除授权内容或放宽容差 |
| recruitment-project-detail | 项目“正在招募”的岗位条目改白卡；项目事实、岗位内容、免审说明保持，页面整体高度940变941px |
| 人才empty / error / loading / unavailable | 四张PNG字节一致 |
| 岗位其他7张 | PNG字节一致，编辑表单、同意预览、联系授权和关闭/空/不可用详情保持 |

对比清单 `.local-dev/logs/r41-card-visual-comparison.json`：22张中10张修改、1张新增、11张字节一致。已查看手机列表、人才详情/预览、项目岗位卡片及新旧并排图。更新后的独立回归及完整浏览器结果见本轮验证回执；更新过程本身不是回归通过的替代。
