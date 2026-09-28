<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# D6 多 agent 栈收敛 — 终项确认审计(2026-09-27)

> 本文由本会话派出的只读审计代理产出(未改任何代码),主会话逐条复核后入库。
> 取证方式:file:line 级引用,不采信"看起来已经收敛"。
> 台账出处:PROJECT_PLAN.md 的 D6 行(按编号锚点引用,不写行号 —— 本仓 F3 判据禁止行号指针)。

# D6 终项确认 — 多 agent 栈收敛审计 verdict

- 审计日期:2026-09-27 · 只读取证,未改任何代码
- 票面:D6 多 agent 栈收敛(agents-kanban / swarm / orchestration / tasks 四套 → AgentLoopV2 单一事实源)方案评审并启动(G-22)。⏳(2026-09-19)"四面板实现在库,终项确认待并行批次恢复后给出"
- **结论:② 部分收敛**(收敛的"判定层"已入库且诚实,收敛的"执行层"一行都不存在;四套栈各自仍可独立执行,前端四面板打到 ≥3 个互不相同的后端事实源)

---

## 1. 实现面清单(每套是独立循环还是 AgentLoopV2 的薄适配器)

| 模块 | 定性 | 判据(file:line) |
| --- | --- | --- |
| `app/services/agent_loop_v2.py`(5690 行) | **单一事实源候选本体**:完整 ReAct 循环 | 头注 5-46;权限词汇全部从 `core/permission_mode.py` 单点 import(63-89);审批 `_request_approval`(4305,调用点 4543/5092);工具执行 `_execute_tools`(4640);doom-loop 阈值 import 不重抄(108-112) |
| `app/services/agent_orchestrator.py`(1649 行) | **独立执行循环,非适配器** | `_run_agent` 自带整圈循环:`for it in range(agent.max_iterations)`(1499)+ 自带 tool_calls 解析(1514-1545)+ 自带工具派发 `mcp_server.call_tool`(1547)+ 自带 `_filter_tools` 白名单(1599-1617)+ 自带 memory_store 记忆(1483-1493)。全文件不 import `agent_loop_v2`,不 import `permission_mode`(grep `permission_mode|READONLY_TOOLS|allowed_tool_names` 于 orchestrator/hub/teams 三文件 = **0 命中**) |
| `app/services/orchestration_hub.py`(1179 行) | **不是 agent 循环**,是事件总线+playbook 决策引擎;其"执行"= HTTP 调支柱 API | 后台消费循环 `while self._running`(1006)只消费 Redis stream,不跑 LLM;`_call_pillar_action`(695-770)按 `_PILLAR_API_PATHS`(114-120)发 HTTP,且源码 108-113 自我登记:**6 条支柱路径在 apps/api 侧一条都不存在**,任何联动的真实结果必然是 404/degraded |
| `app/routers/orchestration.py`(504 行) | ai-service 中枢的 HTTP 面(事件/预算/遥测 21 端点) | 头注 5-36;emit 处接收敛开关 guard(263) |
| `app/routers/team_orchestration.py`(122 行) | swarm 的 HTTP 面,委托 `services/agent_teams.py` | round 端点 guard(84);`agent_teams.py:37,301` 的默认 fan-out runner = `agent_orchestrator.invoke_parallel` → **团队/swarm 骑在上面第二套旧循环上** |
| `app/services/agent_teams.py` | 聚合器(纯函数)+ 派发编排,**无自己的 LLM 循环** | 聚合 `ResultAggregator.aggregate`(182);派发全权委托 invoke_parallel(289-301) |
| `app/core/agents_md.py` / `agents_md_state.py` | **不属四套栈**:AGENTS.md 项目指令发现/模型可见状态渲染(Codex 移植),是引擎的提示装配层 | agents_md.py 头注 6-22;agents_md_state.py 头注「独立纯函数模块…仅对标 Codex 渲染与状态机」 |
| (连带)`app/services/dag_scheduler.py` + `task_executors.py` | "tasks" 在 ai-service 侧的第三执行面:WorkerPool 循环 + 6 类 task_type 注册表 | dag_scheduler `_default_executor`(536-551)→ `task_executors.execute_for_kanban`;task_executors 亦不 import agent_loop_v2/orchestrator(grep 0 命中) |

**收敛开关的实况(D6① 已入库部分)**:`app/core/executor_switch.py` 头注 5-31 白纸黑字 ——「本模块只做**判定**,不做**切换**;所有现网路径默认档 = legacy」,且命中 `loop_v2` 时 `guard_loop_v2_pilot`(124-135)**显式抛 `AGENT_LOOP_V2_PILOT_NOT_WIRED`**(52,61-65:「向 agent_loop_v2 收敛的适配层尚未承载执行」)。即:**把四套栈"接到" v2 的那个执行器从未存在**,开关只是把"未来往哪收"钉成一处可读事实。

## 2. 单一事实源是否成立 — 不成立(同一件事的多处实现清单)

1. **工具白名单两份真相**:v2 走 `core/permission_mode.allowed_tool_names`(agent_loop_v2:69-71);orchestrator 走注册表里硬编码的 `AgentDefinition.tools` 名单(`agent_orchestrator.py:104-160` 默认 10 agent + `_filter_tools` 1599-1617),**完全不经过 permission_mode** —— `plan` 模式(严禁副作用)对这条循环结构上无效。唯一兜底是 mcp_server 注册表侧的 `_consume_exec_approval`/`_ADMIN_ONLY_TOOLS`(`mcp_server.py:1960-2130,10104`),与引擎侧审批流(`agent_loop_v2.py:4305` `_request_approval`)是**两套互不感知的审批机制**(v2:1555/4975 注释承认引擎内置工具不经注册表角色矩阵,靠 `engine_tool_bridge.capability_equivalent` 手工对账)。
2. **子代理派发三条通道**:orchestrator `invoke_parallel`(1339-1435,活,走旧循环)/ hub playbook `subagent.dispatched`(716-717,活但 HTTP 到不存在端点)/ apps/api 侧 workspace swarm/subagent-dispatch(见 §3)。三条没有一个落到 AgentLoopV2。
3. **任务状态词汇 ≥3 个空间**:唯一 canonical 在 `packages/types/src/agent-runtime.ts:1197`(`triage|todo|ready|in_progress|blocked|done` + ALLOWED_TRANSITIONS 1205 + STATUS_VARIANTS 1230),apps/api 侧收口合格(`services/agent-task-status.ts` 是纯 re-export,头注 6-8「单一来源已上移至 @ihui/types」);但仍有两处字面复制:**`apps/ai-service/app/services/dag_scheduler.py:351`** Python 侧重抄 6 态 Literal(无任何 parity 门覆盖:`check-background-task-type-parity.mjs` 只管 executor 接线,`check-agent-event-parity.mjs` 只管 SSE 事件名,grep `triage` 于全部 check-*.mjs = 0),**`apps/web/src/components/agents/KanbanBoard.tsx:45`** `COLUMN_STATUSES` 前端再抄一遍列序(api 已在 `agents-kanban.ts:50` 用 canonical 类型定义 `KANBAN_COLUMNS`)。另有**第四套**:`agent-tasks-panel.tsx:24-37` 的 `status: string` 自由串 + 本地 `STATUS_CLASS`(running/completed/failed/canceled),与 kanban 六态**不同域不同名,无映射**。
4. 正面记录:orchestrator/hub/team 三入口确实共用了**同一把**判定出口 `guard_loop_v2_pilot`(4 站点:agent_orchestrator:1467、orchestration_hub:717、routers/orchestration:263、team router:84),且 hub 的 degraded 三态、orchestrator 的 legacy 等价性都有注释级自我约束 —— 这部分"收敛前的纪律"是做到了的。

## 3. 前端四面板接线(全部经 `@ihui/api-client`,无裸 fetch 违规;但**打的是三套后端事实源**)

出口形态:四者都走 `apps/web/src/lib/api.ts` 的 `fetchApi`/`fetchAiServiceJson`(`@/lib/api` 是 `@ihui/api-client` 的 re-export+adapter,§3 允许形态;URL 组合在 `packages/api-client/src/client.ts:404-415` `normalizeUrl`,裸 `/orchestration/...` 会自动补成 `/api/orchestration/...`,故无"缺前缀 404"问题——已逐层核到底)。

| 面板 | 组件/页 | 数据端点 | 落点后端 → 最终引擎 |
| --- | --- | --- | --- |
| agents-kanban | `app/(main)/agent-kanban/page.tsx` + `components/agents/KanbanBoard.tsx` | `src/lib/agent-kanban-api.ts:15` BASE=`/api/agents/kanban`(+`/api/task-messages` :210,`/api/teams` :142) | **apps/api** `routes/agents-kanban.ts`(DB `agentTasks` 六态状态机 + SSE) |
| swarm | `components/ai/agent-swarm-monitor.tsx`(纯视图,props 喂 `swarmData`:18-19) | 消费方①`app/(main)/agents/[id]/PageClient.tsx:351`(runtime.swarmData,来自会话 SSE);②`components/ai/ai-side-panel-tools.tsx:263,355` ← `hooks/use-subagent-dispatch.ts:50` `/api/subagents/topology` | **apps/api** `subagents-extended-routes.ts` / `workspace-ai.ts` 的 swarm 注册表(`workspace-ai.ts:886` 一带)。ai-service 的 `/api/orchestration/teams/*` 三端点在 web/api-client/apps/api **全仓零调用方**(git grep 仅命中其自身定义) |
| orchestration | `app/(main)/orchestration/page.tsx:170,183` + `components/ai/orchestration-hub-panel.tsx:303,477-502,660-666,878-880` | `/api/orchestration/dashboard|events|decisions|playbooks|budget/*|telemetry/*` | **apps/api** `routes/orchestration.ts`(JWT 转发层,头注:「全部转发到 ai-service」)→ **ai-service** `orchestration_hub`(其下游 6 支柱端点不存在,§1) |
| tasks | `components/ai/agent-tasks-panel.tsx:52,75` + `components/agents/UnifiedTaskDashboard.tsx:200,214` | `/api/workspace/agent/tasks`(+/inject)、`/api/cloud-runs`、kanban api、`/api/subagents/active` | **apps/api** `routes/workspace-ai.ts`(进程内 agent 任务注册表)与 kanban 的 DB 任务是**两套账** |

即:**四面板没有一个的数据源是 AgentLoopV2 的任务面**;kanban(DB 六态)、workspace tasks(内存自由串)、subagent topology(apps/api swarm)、orchestration hub(ai-service 事件账)各说各话。

## 4. 结论与剩余缺口最小集(②)

已收敛的部分(可结清的事实):①主聊天引擎默认 v2(executor_switch 头注 29-30 自证 `AGENT_EXECUTOR`「缺省即 v2」);②v2 自身的权限/审批/doom-loop/压缩分母全走共享出口;③kanban 六态在 TS 侧(apps/api+web 组件经 @ihui/types)已单源;④收敛判定层(executor_switch)成套入库、默认 legacy、开新档必炸不静默 —— "启动"二字兑现了,"收敛"没有。

### 剩余缺口(每条 = 一张实现票的粒度)

**G1|收敛执行器本体:让 `loop_v2` 档真的能跑**
现状:`ORCHESTRATION_CONVERGENCE_EXECUTOR=loop_v2` 时 4 个接线点全部抛 `AGENT_LOOP_V2_PILOT_NOT_WIRED`(executor_switch.py:52,60-65)。
动作:实现 orchestrator→AgentLoopV2 的投影适配器(`AgentDefinition{name,system_prompt,tools,model,max_iterations}` → v2 构造 + run),替换 `_run_agent` 的 loop_v2 分支;hub 的 `subagent.dispatched` 分支同一提交改走该适配器。
受影响文件:`apps/ai-service/app/core/executor_switch.py`、`apps/ai-service/app/services/agent_orchestrator.py`(1447-1617)、`apps/ai-service/app/services/orchestration_hub.py`(695-733 + playbook 表)、`apps/ai-service/app/services/agent_loop_v2.py`(入口签名)、`apps/ai-service/app/routers/team_orchestration.py`(96-106 multi-round 补同 surface 粒度的 guard 标注)。
验收:设 env 后 `/orchestration/teams/round` 真产 v2 trace(checkpoint/iteration 字段),不设 env 行为逐字节不变。

**G2|旧循环的权限并轨(在 G1 之前的止血项)**
现状:`agent_orchestrator._run_agent` 完全不过 permission_mode(plan 档拦不住它),审批只剩 mcp_server 注册表侧一条腿。
动作:`_run_agent` 每轮工具执行前调 `core/permission_mode.tool_allowed_by_policy` + `allowed_tool_names`,`_filter_tools` 的名单与 READONLY_TOOLS 的交集计算改从 permission_mode 单点取;或最小做法——orchestrator 入口强制 `permission_mode` 参数并 fail-fast。
受影响文件:`apps/ai-service/app/services/agent_orchestrator.py`(1447,1496,1547,1599)、`apps/ai-service/app/core/permission_mode.py`(只读引用)、`apps/ai-service/app/routers/agents.py`(58,1884-1892 debate/vote/critique 同族入口)。
验收:一条 permission_mode=plan 的用例经 orchestrator 跑写类工具被拒且**不发审批请求**(断言待决表为空,§5"归属条件落在被发出的那条调用上"同口径)。

**G3|任务状态词汇的跨语言/跨端副本收口**
动作 A:`dag_scheduler.py:351` 的六态 Literal 与 `packages/types/agent-runtime.ts:1197` 建 parity(照 139 号门模式:Python 字面量表 vs TS 契约表逐项等值,扩 `scripts/check-background-task-type-parity.mjs` 或新维),或改为由 types→Python 的生成物。
动作 B:`KanbanBoard.tsx:45` 删本地列序,列由 api 响应(`KANBAN_COLUMNS` 六列,agents-kanban.ts:50)推导。
动作 C:`agent-tasks-panel.tsx:24-37` 的 `status: string` 要么映射到 `AgentTaskStatus`(mapStatus),要么在 types 里正式登记 workspace-任务与 kanban-任务为**两个域**(禁止第三处 STATUS_CLASS 表继续靠 fallback 顶)。
受影响文件:`apps/ai-service/app/services/dag_scheduler.py`、`packages/types/src/agent-runtime.ts`、`apps/web/src/components/agents/KanbanBoard.tsx`、`apps/web/src/components/ai/agent-tasks-panel.tsx`、`scripts/check-background-task-type-parity.mjs`(+镜像测试)。

**G4|四面板并轨到单一任务事实源(产品面收口,可最后做)**
现状:四面板 = 三套账(见 §3);ai-service team 端点零消费方;`ai-side-panel-tools.tsx:608` 注释自认「完整归并目标:把 AgentSwarmMonitor + SwarmTopologyView 并入 OrchestrationHubPanel」未完成。
动作:先裁"谁是被弃账"——若 G1 落地,swarm/tasks 面板改读 kanban 的 `/api/agents/kanban`+`/api/task-messages` 单一视图(UnifiedTaskDashboard 已是这个方向的雏形,:200-214);team_orchestration 三端点或接消费者或按 §7 删除安全走"有承接实现才删"。
受影响文件:`apps/web/src/components/ai/ai-side-panel-tools.tsx`、`apps/web/src/components/ai/agent-swarm-monitor.tsx`、`apps/web/src/components/ai/agent-tasks-panel.tsx`、`apps/web/src/components/agents/UnifiedTaskDashboard.tsx`、`apps/ai-service/app/routers/team_orchestration.py`、`apps/api/src/routes/workspace-ai.ts`。

## 5. 路上撞见、不属本票(只登记,未修)

1. `orchestration_hub._PILLAR_API_PATHS` 6 条支柱端点在 apps/api 不存在(源码 108-113 已自登记;第九轮定性"不实现",门 127 未匹配清单在账)——本票只复核它仍然成立。
2. ai-service `/api/orchestration/teams/*` 全仓 TS 面零调用方(已注册 main.py:843、无人消费)= "造好没装车"又一实例。
3. `team_orchestration.py:11` 头注错别字「一呃团队」(应为「一轮」)——文档级小疵。
4. `apps/ai-service/app/services/agent_loop.py`(v1,头注自述第一轮就 break 的半成品)仍在库且 orchestrator 头注仍称与其"互补"(agent_orchestrator.py:14)——v1 的存续性/摘线不在 D6 四套清单内,但收敛票落地时应一并定性。
5. `dag_scheduler.py` 的 KanbanTask 数据类(386 行 status 默认 'triage')在 ai-service 侧**自带一份 kanban 任务模型**(字段面与 apps/api DB 是否同构未逐字段核)——与 G3A 同根,核字段映射属实现票动作。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
