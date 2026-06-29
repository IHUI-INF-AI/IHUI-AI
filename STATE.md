# 目标驱动模式状态记录

## 目标
合并 AI 面板中堆叠的两个标题栏（ai-side-panel-header + dialog-header），按最优建议只保留一个统一标题栏

## 起始时间
2026-06-29 19:10

## 最大迭代轮次
20

## 当前轮次
1

## 目标状态
ACTIVE

## 硬性必达指标
1. ✅ AI 面板（embedded 模式）只渲染一个标题栏，不再堆叠
2. ✅ 单个标题栏包含"AI智能助手"作为左侧前缀
3. ✅ 单个标题栏仍包含：会话列表按钮、模型/模式标签、搜索、更多、关闭按钮
4. ✅ floating 模式不受影响（不显示"AI智能助手"前缀，正常 dialog-header 行为）
5. ✅ 空态（is-empty）行为不变，关闭按钮仍可正常关闭面板
6. ✅ 浏览器验证：截图确认面板顶部只显示一行标题栏，"AI智能助手"前缀在 header-left
7. ✅ 无回归：侧边栏、首页、登录、ChatHistory 等其他页面不受影响
8. ✅ 暗色模式适配保持
9. ✅ vue-tsc / 现有测试无新增错误

## 软性指标
- 代码简洁、复用 ChatHeaderBar 已有结构
- 清理无用样式代码
- 不引入新的全局副作用

## 优先级
- 硬性指标 1-5 优先级最高，先达成
- 6-7 用于验证，7-9 收尾

## 异常处理
- 若 vue-tsc 出现新错误且非本目标相关，记录后跳过
- 浏览器 HMR 失败时手动 reload 验证

## 执行计划
- Round 1: chatheaderbar.vue 增加 panelTitle prop + 渲染逻辑
- Round 2: AIChat.vue 透传 panelTitle prop 给 ChatHeaderBar
- Round 3: App.vue 移除 ai-side-panel-header，给 AIChat 加 :panel-title
- Round 4: 清理 _sidebar-layout.scss 中 ai-side-panel-header 相关样式（保留空态相关）
- Round 5: 浏览器验证截图 + 暗色模式验证
- Round 6: 收尾检查与文档
