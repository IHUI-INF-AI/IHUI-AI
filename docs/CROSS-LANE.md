<!--
  © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
  Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
  [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
-->

# CROSS-LANE · F0 契约地基（feat/ma-contracts）

> 本文件登记 F0 线**不能**改、但必须由其他泳道接手的跨线改动。每条含文件/现状/要求/归属。
> F0 改动面：`packages/shared/src/agent-registry/**`、`packages/shared/src/index.ts`、
> `packages/types/src/agent-registry.ts`、`scripts/check-agent-contract-single-source.mjs`。
> 其余文件一律未动（README 四语种的 "Recent updates" 由仓库 post-commit 钩子自动维护，不是本线手改）。

## 1. R1（api / api-client）

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

## 2. W1（web）

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

## 3. R2 / R3（ai-service）

1. `apps/ai-service` 侧 10 角色已经齐（prompt_registry），但无 9 模式的枚举常量。
   - 要求：编排入口（`agent_orchestrator` / `run_with_communication`）接 `team`；
     `decompose` 入参归一为 `decomposed`；`single` / `recursive` 明确路由或返回
     `AGENT_...` 明确错误码。
2. 错误码：Python 侧按 contracts `ERROR_CODES` 40 个建同一份常量（导出器/契约测试归 R2）。

## 4. C1（cli）

1. `apps/cli` 的 AgentRole/编排选项若接入总管注册表，统一走 barrel 别名，不另起字面量。

## 5. 已知同名不同域（不是重复，勿误删）

- `packages/shared/src/super-agent/roles.ts` 的 `AgentRole`（`router`/`worker`）：宿主席位，不是注册表角色。
- `packages/shared/src/constants/error-codes.ts` 的 `ErrorCode`（数字业务码）：旧业务错误码，
  与注册表字符串 `ErrorCode` 不同域；barrel 以 `AgentErrorCode` 暴露后者，避免静默覆盖。
- `apps/web` 的 `RunStatus`（代码块执行态）/ `Scope`（admin 角色域）：与注册表无关。

## 6. 归零口径

- F0 完成判据：`node scripts/check-agent-contract-single-source.mjs` → `重复枚举: 0`。
- 全仓盘点：`--all` 目前 14 处 `legacy pending`（R1 9 / W1 5），随各线迁移递减；
  `--strict-legacy` 可在合并前当硬门用。
- 迁移完成后可删的兼容层：`packages/shared/src/subagents/index.ts` 的 `AgentRole`/`SubagentRole` 5 值别名、
  `OrchestrationMode` 11 值兼容联合（barrel 翻名后）。
<!-- ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠ -->
