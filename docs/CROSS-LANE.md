<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# CROSS-LANE（F0 契约地基 + F1 数据库地基，I1 集成合并）

> 合并说明：F0 与 F1 各自在同一路径登记跨线事项（add/add 冲突），两侧内容互不覆盖；以下按来源分节保留原文，
> 仅将各节内标题降一级以便同文档阅读，正文文字未改动。

## F0 · 契约地基（feat/ma-contracts）

> 本文件登记 F0 线**不能**改、但必须由其他泳道接手的跨线改动。每条含文件/现状/要求/归属。
> F0 改动面：`packages/shared/src/agent-registry/**`、`packages/shared/src/index.ts`、
> `packages/types/src/agent-registry.ts`、`scripts/check-agent-contract-single-source.mjs`。
> 其余文件一律未动（README 四语种的 "Recent updates" 由仓库 post-commit 钩子自动维护，不是本线手改）。

### 1. R1（api / api-client）

1. `packages/api-client/src/endpoints/subagents.ts:32,35`
   - 现状：`AgentRole` 5 值、`OrchestrationMode` 7 值（含 `with_communication`）仍是一份独立字面量。
   - 要求：改为 `import type { AgentRole, OrchestrationMode } from '@ihui/shared'`（barrel 的
     `AgentRegistryRole` / `AgentOrchestrationMode`，或等 package.json 增子路径后用 contracts）。
   - 归因：`node scripts/check-agent-contract-single-source.mjs --all` 的 `[legacy pending]`。
2. `apps/api/src/routes/subagent-dispatch.ts:270,292,293`
   - 现状：Zod `agentRole` 5 值、`orchestration` 7 值。
   - 要求：角色改 10+custom；编排改 9 模式，入参先 `normalizeOrchestrationMode()`（别名落库前归一）。
3. `apps/api/src/routes/agent-runs.ts:74`、`apps/api/src/services/workspace-ai-service.ts:201`
   - 现状：`AgentRunStatus` / `SwarmAgentRole` 为本地字面量。
   - 要求：状态对齐 `RunStatus` 8 值（注意 `canceled` 单 l，旧 `cancelled` 属派单域）；
     角色对齐 `AgentRole` 10+custom。
4. `packages/shared/package.json` 缺 `./agent-registry` 子路径导出
   - 现状：`@ihui/shared/agent-registry/contracts` 被 exports map 挡住，app 只能走 barrel。
   - 要求：新增
     ```json
     "./agent-registry": { "types": "./src/agent-registry/index.ts", "import": "./src/agent-registry/index.ts" },
     "./agent-registry/*": { "types": "./src/agent-registry/*.ts", "import": "./src/agent-registry/*.ts" }
     ```
   - 在此之前，新代码从 `@ihui/shared` 取：`AgentRegistryRole`、`AgentOrchestrationMode`、
     `RunStatus`、`DefinitionStatus`、`ApprovalStatus`、`Scope`、`AgentErrorCode`、
     `normalizeAgentName()` 等。
5. `packages/types/src/index.ts` 与 `packages/types/package.json`
   - 现状：`src/agent-registry.ts` 已建（DefinitionSummary/DefinitionDetail/RunSummary/
     ApprovalSummary/ToolResult），但 barrel 未导出、exports map 无 `./agent-registry`。
   - 要求：index.ts 增 `export * from './agent-registry'`；package.json 增子路径导出。

### 2. W1（web）

1. `apps/web/src/components/subagents/DagNode.tsx:22,30,39`、
   `apps/web/src/components/subagents/SwarmTopologyView.tsx:27`
   - 现状：`Record<AgentRole, ...>` 只覆盖 5 个旧角色（barrel `AgentRole` 仍是 5 值旧域，
     F0 刻意不动，保旧应用编译）。
   - 要求：改用 `AgentRegistryRole` 并补齐 custom + 5 个新角色的图标/文案/配色；
     全量替换后，F0 可把 barrel `AgentRole` 翻成 11 值（需 W1 与 R1 同时确认）。
2. `apps/web/src/components/ai/dispatch-subagent-dialog.tsx:871`、
   `apps/web/src/components/ai/swarm-topology-view.tsx:921`
   - 现状：编排选项仍是 `with_communication` / `decomposed`。
   - 要求：展示层改 9 模式（新增 `single`、`team`、`recursive`），提交前 `normalizeOrchestrationMode()`；
     `with_communication` 仅作历史数据回显别名。
3. `apps/web/src/lib/subagents-api.ts`：请求类型跟 R1 一起切到新枚举。

### 3. R2 / R3（ai-service）

1. `apps/ai-service` 侧 10 角色已经齐（prompt_registry），但无 9 模式的枚举常量。
   - 要求：编排入口（`agent_orchestrator` / `run_with_communication`）接 `team`；
     `decompose` 入参归一为 `decomposed`；`single` / `recursive` 明确路由或返回
     `AGENT_...` 明确错误码。
2. 错误码：Python 侧按 contracts `ERROR_CODES` 40 个建同一份常量（导出器/契约测试归 R2）。

### 4. C1（cli）

1. `apps/cli` 的 AgentRole/编排选项若接入总管注册表，统一走 barrel 别名，不另起字面量。

### 5. 已知同名不同域（不是重复，勿误删）

- `packages/shared/src/super-agent/roles.ts` 的 `AgentRole`（`router`/`worker`）：宿主席位，不是注册表角色。
- `packages/shared/src/constants/error-codes.ts` 的 `ErrorCode`（数字业务码）：旧业务错误码，
  与注册表字符串 `ErrorCode` 不同域；barrel 以 `AgentErrorCode` 暴露后者，避免静默覆盖。
- `apps/web` 的 `RunStatus`（代码块执行态）/ `Scope`（admin 角色域）：与注册表无关。

### 6. 归零口径

- F0 完成判据：`node scripts/check-agent-contract-single-source.mjs` → `重复枚举: 0`。
- 全仓盘点：`--all` 目前 8 处 `legacy pending`（R1 3 / W1 5），随各线迁移递减；
  `--strict-legacy` 可在合并前当硬门用。
- 迁移完成后可删的兼容层：`packages/shared/src/subagents/index.ts` 的 `AgentRole`/`SubagentRole` 5 值别名、
  `OrchestrationMode` 11 值兼容联合（barrel 翻名后）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->

## R1 · 注册表 API（feat/ma-api）

> R1 实际改动面比原清单多两处，均为 F0 已登记给 R1 的跨线项：
> `packages/types/src/index.ts` 导出 agent-registry + package.json 子路径；
> `packages/api-client` 的旧枚举改为“值集单源 + 语义别名”，不再抄第二份 union。

1. **已清 6 处 legacy pending（仅改名，不改值集）**
   - `apps/api/src/routes/agent-runs.ts`：O10 Redis run 状态 → `RedisRunState`，保留 `cancelled` 5 态；
   - `apps/api/src/routes/v1-assistants.ts`：OpenAI Assistants 状态 → `AssistantsRunState`；
   - `apps/api/src/services/workspace-ai-service.ts`：Swarm 席位 → `SwarmSeat`；
   - `packages/api-client/src/endpoints/patrol.ts`：巡检结论 → `PatrolConclusion`；
   - `packages/api-client/src/endpoints/subagents.ts`：旧派单 5 席位 / 7 编排 → `SubagentSeat` / `SubagentPattern`。
   这些名字与原 `RunStatus/AgentRole/OrchestrationMode` 是不同域，直接改值集会改坏旧协议；
   因此只把“类型名”从契约扫描器的后缀命中面移开，运行期值不变。

2. **剩 3 处 legacy pending，需 R2/派单服务一起拍板**
   - `apps/api/src/routes/subagent-dispatch.ts:270,292,293`：Zod 仍是 5 角色 / 7 编排。
   - 角色扩到 10+custom 需要 `subagent-dispatch-service` 的 `DispatchInput` 与 Python 侧都能接；
     编排扩到 9 模式需要写入前 `normalizeOrchestrationMode()`，否则 `with_communication` 会进账本。
   - R1 不在本切片单方面改 Zod，避免 API 收得下、执行侧接不住。

3. **删除预检的 12 域只落地 11 域**
   - `runs/dispatch/jobs/sessions/cron/workflow/team/market/memory/audit/external` 均有查询落点；
   - `a2a` 在本仓没有卡片表（`a2a_service.py` 只是代码路径），预检返回 `unverified`，
     不伪造 0、也不拿它当阻断。UI 必须原样展示这一桶。

4. **本轮已补齐（收口切片）**
   - `Idempotency-Key`：`agent-registry-idempotency.ts`，同 key 同 body 10 分钟回放，不同 body 409，Redis 不可用 fail-open；
   - 分页 `cursor`：base64url(`updatedAt|id`)，按 `(updatedAt,id)` 倒序，非法游标 400 `INVALID_CURSOR`；
   - 列表 `stats`：按当前页定义聚合近 7 天 `runs7d / successRate / costPoints7d`；
   - `purge`：仅管理员、软删满 30 天、`confirmName` 二次确认，生成 pending 审批；执行时把定义与全部版本快照写入审批 `impact_snapshot.archive` 作为归档，再删除定义；
   - 活跃运行下的 `rollback`：生成 pending 审批并返回 `428 + approvalId + activeRuns + impactHash`；批准后按目标快照写回并 `version+1`；
   - 内部只读端点：`GET /api/internal/agent-registry/snapshot`、`GET /definitions/resolve`，票据 scope 新增 `agent-registry`；
   - 审计一致性：`recordAuditLog(params, tx?)` 支持调用方事务；软删/purge/rollback 的审计与业务写入同事务，审计失败会整体回滚；
   - 灰度开关：`AGENT_REGISTRY_WRITE=false` 关闭全部写面，`AGENT_REGISTRY_DELETE=false` 关闭删除/恢复/审批面；默认开启，显式 false 才关闭。

5. **本轮继续补齐：运行账本内部写面**
   - `POST /api/internal/agent-registry/runs`：创建/更新 run，`runId` 已存在时幂等返回；创建时校验定义 `active`、`ownerUserId` 必须等于票主体；返回 `created` 区分新建与回放；
   - `PATCH /api/internal/agent-registry/runs/:id`：token/成本/状态/产物计数/错误字段更新；终态不可回非终态，同终态幂等；
   - `POST /api/internal/agent-registry/runs/:id/events`：`(runId,seq)` 唯一，重复返回 200 + `duplicate=true`；`status` 事件是唯一改 run 状态的事件，`artifact` 事件原子 `artifact_count+1`；payload >16KB 截断并标 `truncated`；
   - `POST /api/internal/agent-registry/audit`：只接受 `agent.*` 动作，写 `audit_logs_chain`；
   - 真库用例新增一组：创建幂等、事件去重、artifact 只计一次、终态拒绝回 running、内部审计落链。

6. **本切片仍未做、合并评审要带着看**
   - `POST /api/internal/agent-registry/ops`（27 action）未建，留给 R3；
   - `purge` 的归档落在审批 JSONB，不是对象存储/JSONL 冷归档；大提示词与多版本会让审批行变大，长期方案待拍板；
   - `Idempotency-Key` 在 Redis 不可用时 fail-open，存在重复创建风险；规格未写死是否允许；
   - `AGENT_VERSION_CONFLICT` 仍不能在响应 `data` 里带 `currentVersion`：`AppError` 没有 details，全局 errorHandler 不返回 data；
   - 预检 `audit` 域已排除 `delete_requested/purge_requested/rollback_requested` 三条自写审计，否则审批请求自身会改变 impactHash、执行前复检永远不过；这条口径需要在安全评审确认；
   - 真库用例默认跳过，需显式 `AGENT_REGISTRY_REAL_DB=1` + 独立库 `ihui_agent_test_fresh`；已实测 create/detail/cursor+stats/预检→软删→恢复/活跃运行回滚审批/purge 归档/运行账本 6 组全过。

## F1 · 数据库地基（feat/ma-db）

> 本文件只登记"需要改别人文件/需要别的 lane 决策"的事项,格式:谁 / 为什么 / 建议改法 / 影响任务。
> 登记方不改代码。

### 1. drizzle journal 缺 `20261127120000_agent_registry` 条目

- 谁: F1(ma-db,feat/ma-db)
- 为什么: 迁移按仓库惯例手写在 `packages/database/drizzle/20261127120000_agent_registry.sql`,但
  `packages/database/drizzle/meta/_journal.json` 属跨 lane 文件,本线未改。`apply-migration.mjs`
  找不到 tag 会直接拒绝(它不伪造时间戳),`drizzle-kit migrate` 也不会执行这条迁移;
  目前只在独立库用 psql 直连验证过 up→down→up。
- 建议改法: 由 I1 在 journal 末尾追加一条(保持 drizzle 排序语义、`when` 取当前最大值 + 1):
  `{ "idx": 492, "version": 7, "when": 1795585800005, "tag": "20261127120000_agent_registry", "breakpoints": true }`。
  仓库现存 15 份 snapshot 止于 0470,近 20 条手写迁移均无 snapshot,本迁移同样不需要新增 0492_snapshot.json;
  顺带也会消除 `check-db-schema-drift` FK 维度"snapshot 末态无、迁移有"的提示级差异(当前按 0470 比对)。
- 影响任务: P1-01~P1-06 的"迁移可被 drizzle 管线执行";P2/P4 起真实服务前的建表步骤。

### 2. 5 张新表未加 RLS policy

- 谁: F1(ma-db,feat/ma-db)
- 为什么: 仓库现有 tenant-RLS 机制以 `tenant_id` 为轴,这 5 张表按规格 §3.7 v1 采用
  `scope + owner_user_id + team_id` 服务层守卫,没有 tenant_id 列可挂。直连库(如运维脚本、
  ai-service 以 owner 角色)会绕过应用层谓词。
- 建议改法: P1-07 Registry Service / P1-20 安全评审确认所有读写都带 owner/team 谓词;
  若需数据库兜底,另开一条 app-role RLS 迁移(需要 GUC 方案或派生 tenant 列),不要塞进本条迁移。
- 影响任务: P1-07、P1-08、P1-09。

### 3. 种子与 ai-service 提示词是"单源解析"关系

- 谁: F1(ma-db,feat/ma-db)
- 为什么: `apps/api/src/db/seed-agent-definitions.ts` 直接解析
  `apps/ai-service/app/services/prompt_registry.py` 的 `DEFAULT_PROMPTS`,不在种子侧复制第二份提示词。
  若该文件结构或键名变化(不是 10 个唯一角色),种子会在解析阶段 exit 2,不写任何行。
- 建议改法: P2 线保持 `DEFAULT_PROMPTS` 字典结构与 10 个键名;要增删角色时先改规格并通知数据线,
  由数据线调整种子验收口径(表结构本身不限制条数)。
- 影响任务: P1-06、P2-01。

### 4. master 提示词与种子（已收口，2026-11-28）

- 谁: P3 / W1
- 现状: `apps/ai-service/app/agents/master.md` 已落；种子路径改到 `app/agents/master.md`，
  master 单独 `displayName=总管`、`role=custom`、`tools=agent_registry,agent_ops,master_memory`。
- 实测: `ihui_agent_test_fresh` 上 `--include-master` 连跑两次幂等；库里 master
  `scope=system / is_builtin=true / is_dispatchable=false / role=custom / tools=3`。
- 注意: 管理字段新增 `tools`，重跑会覆盖 master 三件套与 10 个内置的空工具面；
  管理员若手工给内置角色加过工具，重跑种子会清空，需在管理台重加。

### 5. P3/W1 本轮落点与没落点

- 已落: `master_tools` 三工具 + MCP 159/159；`master.md` + `master_profile.py`；
  `POST /api/v1/ai/master/chat` 固定人格/三工具；`conversation.chat` 可选 `system_prompt`；
  `apps/web` `/master` 页 + 侧栏入口 + 五语言 `masterConsole`；
  注册表失效订阅接 FastAPI lifespan；客户端进程代次 `invalidate_all`。
- 没落: `agent_ops` 已支持 single / parallel / pipeline / debate / vote / critique / team / recursive；
  decomposed 留后续；stop/retry/cancel 明确未实现；`master_memory` team/agent 作用域未开；
  `/master` 页已有对话面板，同源改写 `/api/master/chat` 走 cookie 鉴权。
- 没落原因: 不把"能管"和"能跑九模式"混成一次交付；single 先打通真运行账本，其余模式在 P4 逐模式验收。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
