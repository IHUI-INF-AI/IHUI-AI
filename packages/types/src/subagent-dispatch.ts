/**
 * Subagent 派单 + Swarm 拓扑可视化跨端契约(2026-07-22 立)。
 *
 * 落地 AGENTS.md §11 多 Subagent 并行开发强制规则的派单格式,
 * 对接 apps/ai-service/app/services/agent_orchestrator.py 7 编排模式 + 5 默认 agent。
 *
 * 跨端:
 * - apps/api/src/routes/subagent-dispatch.ts — Fastify 路由
 * - apps/api/src/services/subagent-dispatch-service.ts — 调 ai-service
 * - apps/web/src/stores/subagent-dispatch.ts — zustand store
 * - apps/web/src/hooks/use-subagent-dispatch.ts — react-query hooks
 * - apps/web/src/components/ai/dispatch-subagent-dialog.tsx — 派单对话框
 * - apps/web/src/components/ai/swarm-topology-view.tsx — 拓扑可视化
 */

/** 5 默认 agent 角色(对齐 agent_orchestrator.AgentRegistry._register_defaults) */
export type SubagentRole = 'researcher' | 'coder' | 'reviewer' | 'architect' | 'debugger'

/** 7 编排模式(对齐 agent_orchestrator.AgentOrchestrator.run_*) */
export type OrchestrationMode =
  | 'pipeline'
  | 'parallel'
  | 'debate'
  | 'vote'
  | 'critique'
  | 'decomposed'
  | 'with_communication'

/** 派单状态机:pending → running → completed/failed/cancelled */
export type DispatchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * 派单输入(创建派单时的请求体)。
 *
 * 字段对齐 AGENTS.md §11 强制派单格式:
 *   ## 任务目标 / 受影响文件 / 禁止修改 / 验证命令 / 约束边界 / 交付物
 */
export interface DispatchInput {
  /** 一句话任务目标(对应 §11 "任务目标") */
  goal: string
  /** 受影响文件绝对路径清单(对应 §11 "受影响文件") */
  affectedFiles: string[]
  /** 禁止修改清单,可空(对应 §11 "禁止修改",默认"任何不在上述清单的文件") */
  forbidden?: string[]
  /** 验证命令清单(对应 §11 "验证命令") */
  verifyCommands: string[]
  /** 约束边界(对应 §11 "约束边界":API 契约 / 类型 / 样式 / 行为约束) */
  constraints: string
  /** 交付物描述(对应 §11 "交付物") */
  deliverables: string
  /** 主 agent 角色,默认 coder */
  agentRole?: SubagentRole
  /** 编排模式,默认 parallel */
  orchestration?: OrchestrationMode
}

/**
 * 派单单例(创建后由服务端维护,前端只读)。
 */
export interface SubagentDispatch extends DispatchInput {
  /** 派单 ID(dispatch-<timestamp>-<rand>) */
  id: string
  /** 当前状态 */
  status: DispatchStatus
  /** 完成时返回(ai-service OrchestrationResult.final_output 或错误信息) */
  result?: string
  /** 创建时间(ISO 字符串) */
  createdAt: string
  /** 更新时间(ISO 字符串) */
  updatedAt: string
}

/** 拓扑节点状态(独立于 DispatchStatus,描述 agent 级实时状态) */
export type TopologyNodeStatus = 'idle' | 'running' | 'waiting' | 'completed' | 'failed'

/** 拓扑节点(agent 实例) */
export interface TopologyNode {
  /** 节点 ID(通常 = agent name 或 dispatch id + role) */
  id: string
  /** 显示名(agent name) */
  label: string
  /** 角色(SubagentRole 或自定义 agent name) */
  role: string
  /** 实时状态 */
  status: TopologyNodeStatus
  /** 可选预设坐标(否则由前端 force-directed 自动布局) */
  x?: number
  y?: number
}

/** 拓扑边关系类型(对齐 OrchestrationMode 子集 + communication) */
export type TopologyEdgeType =
  | 'pipeline'
  | 'parallel'
  | 'debate'
  | 'vote'
  | 'critique'
  | 'communication'

/** 拓扑边(agent 间关系) */
export interface TopologyEdge {
  /** 起点节点 ID */
  from: string
  /** 终点节点 ID */
  to: string
  /** 关系描述(如 "传递结果" / "投票" / "批判") */
  label?: string
  /** 边类型(决定渲染颜色 + 线型) */
  type: TopologyEdgeType
}

/** Swarm 拓扑图数据 */
export interface SwarmTopology {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

// ---------------------------------------------------------------------------
// API 响应类型(对齐 apps/api/src/utils/response.ts 的 { code, message, data })
// ---------------------------------------------------------------------------

export interface DispatchResponse {
  dispatch: SubagentDispatch
}

export interface ActiveDispatchesResponse {
  dispatches: SubagentDispatch[]
}

export interface CancelDispatchResponse {
  cancelled: boolean
}

export interface TopologyResponse {
  topology: SwarmTopology
}
