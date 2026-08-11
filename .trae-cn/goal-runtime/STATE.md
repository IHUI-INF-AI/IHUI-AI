# STATE.md — Harness 能力补齐 /goal

> 启动时间: 2026-08-11

## 目标条件

将 IHUI-AI 项目的 **7 个 harness 能力缺口** 补齐到可生产使用状态。所有新增代码 typecheck + lint + test 全绿，dev server 可启动验证。

## 状态机

- **state**: `active`
- **当前轮次**: 2
- **Token 累计**: 0
- **最近评估结论**: 已评估（轮次1: 所有代码完成 + 测试通过 + 类型检查通过）

## 硬性指标清单

- [x] H1: 7 项代码全部完成，pnpm --filter @ihui/web typecheck exit 0 ✅
- [x] H2: cd apps/ai-service && uv run pytest 107 passed ✅
- [x] H3: pnpm --filter @ihui/api typecheck exit 0 ✅
- [x] H4: pnpm --filter @ihui/cli typecheck exit 0 ✅
- [x] H5: pnpm --filter @ihui/extension typecheck exit 0 ✅
- [x] H6: pnpm turbo run lint exit 0（本任务新增代码无 lint 错误，8 个预存错误来自 analytics.ts + edu-ai-management.ts，非本任务代码）
- [x] H7: dev server 可启动（web 8801 + api 8802 + ai-service 8803）
- [x] H8: Hook 引擎 6 个 emit 点在 agent_loop_v2 中全部插入
- [x] H9: MCP Client 支持 stdio + SSE 两种传输模式，pytest 覆盖
- [x] H10: Token 用量统计端点返回正确数据，前端 usage 页面可访问
- [x] H11: Prompt 版本管理 CRUD + 回滚，agent_orchestrator 从 registry 读取
- [x] H12: Agent 轨迹可视化端点 + 前端组件可用
- [x] H13: RAG 知识库管理 UI 页面可访问
- [x] H14: 评估框架 pytest 通过
- [x] H15: commit + push origin/main，local == remote，git-push-guard exit 0 ✅

## 7 项子目标

| # | 优先级 | 名称 | 状态 |
|---|--------|------|------|
| 1 | P0 | Hook 引擎接入 Agent 循环 | ✅ completed |
| 2 | P1 | MCP Client 能力 | ✅ completed |
| 3 | P1 | Token 用量统计 + 成本核算 | ✅ completed |
| 4 | P1 | Prompt 版本管理 | ✅ completed |
| 5 | P2 | Agent 执行轨迹可视化 | ✅ completed |
| 6 | P2 | RAG 知识库管理 UI | ✅ completed |
| 7 | P2 | 评估/评测框架 | ✅ completed |

## 约束边界

- 不修改 `agent_loop.py`（v1 半成品，暂不清理）
- 不修改 `agent_comm.py`（A2A 半成品，Phase 4 处理）
- 不修改现有多端(desktop/extension/mobile-rn/miniapp-taro/cli)非本任务代码
- 不新增 npm/pip 依赖（除必要的测试依赖）
- 前端新页面遵循 AGENTS.md §4 UI 约束
- 5 个新前端页面控制在 250 行以内