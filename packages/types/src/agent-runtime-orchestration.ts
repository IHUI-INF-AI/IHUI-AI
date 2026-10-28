// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 多 Agent 任务编排域跨端契约:任务分解/子任务依赖/黑板/Scheduling/重试/Failover。
// 自 agent-runtime.ts 拆出(2026-10-08,C2 契约文件行上限 2000 收口;拆分前该文件 2164 行)。
// 内容按行段逐字节搬移,经 agent-runtime.ts 的 export * 链路再导出,公开导出面与拆分前
// 逐名等值 —— @ihui/types 主入口、api-contracts、mobile-rn mock 的消费面均不受影响。
// 守门静态锚定的词汇域(权限模式词表 / AGENT_INSTANCE_STATES / AGENT_TASK_STATUSES /
// AGENT_TURN_STOP_REASONS / AgentSSEEvent / CONNECTION_CAPABILITY_FIELDS)仍实体留在 agent-runtime.ts。
// ============================================================================
// 调度系统深度层契约(P3-3,2026-07-22 立)
// 对标 Hermes Agent:任务自动分解 + agent 通信 + 调度算法 + 失败重试
// ============================================================================

/** 任务分解策略 */
export type TaskDecompositionStrategy =
  | 'sequential' // 顺序分解(简单流水线)
  | 'parallel' // 并行分解(独立子任务)
  | 'dag' // DAG 分解(有依赖关系的子任务图)
  | 'recursive' // 递归分解(复杂任务层层拆解)

/** 子任务依赖关系 */
export interface SubTaskDependency {
  /** 依赖的子任务 ID */
  dependsOn: string
  /** 依赖类型 */
  type:
    | 'output' // 需要前置任务的输出
    | 'completion' // 仅需前置任务完成
    | 'resource' // 共享资源锁
}

/** 分解出的子任务 */
export interface SubTask {
  /** 子任务 ID */
  id: string
  /** 任务描述 */
  description: string
  /** 推荐的 agent 类型(基于能力匹配) */
  recommendedAgentType: string
  /** 期望的 agent 能力 */
  requiredCapabilities: string[]
  /** 依赖的其他子任务 */
  dependencies: SubTaskDependency[]
  /** 优先级(1-10,10 最高) */
  priority: number
  /** 预估耗时(秒) */
  estimatedDurationSeconds?: number
  /** 是否可重试(默认 true) */
  retryable?: boolean
  /** 最大重试次数(默认 3) */
  maxRetries?: number
}

/** 任务分解请求 */
export interface TaskDecompositionRequest {
  /** 原始任务描述 */
  task: string
  /** 可用的 agent 列表(含能力描述) */
  availableAgents: Array<{ name: string; capabilities: string[] }>
  /** 分解策略(默认 dag) */
  strategy?: TaskDecompositionStrategy
  /** 最大子任务数(默认 10) */
  maxSubTasks?: number
}

/** 任务分解结果 */
export interface TaskDecompositionResult {
  /** 分解出的子任务列表 */
  subTasks: SubTask[]
  /** 执行顺序(拓扑排序后的 ID 列表) */
  executionOrder: string[]
  /** 并行批次(同一批可并行执行) */
  parallelBatches: string[][]
  /** 分解策略 */
  strategy: TaskDecompositionStrategy
  /** 总预估耗时(秒) */
  totalEstimatedDurationSeconds?: number
}

/** 共享黑板条目(agent 间共享上下文) */
export interface BlackboardEntry {
  /** 条目 ID */
  id: string
  /** 键(如 "current_design" / "shared_context") */
  key: string
  /** 值 */
  value: string
  /** 写入的 agent 名 */
  writtenBy: string
  /** 关联的子任务 ID */
  subTaskId?: string
  /** 时间戳(ISO) */
  timestamp: string
  /** 读取过的 agent 列表 */
  readBy: string[]
}

/** 调度决策 */
export interface ScheduleDecision {
  /** 子任务 ID */
  subTaskId: string
  /** 分配的 agent 名 */
  assignedAgent: string
  /** 分配理由 */
  reason: string
  /** 分配分数(0-1,能力匹配度) */
  matchScore: number
  /** 预计开始时间(ISO) */
  estimatedStartTime: string
  /** 调度策略 */
  strategy: 'capability_match' | 'load_balance' | 'priority' | 'round_robin'
}

/** 调度结果 */
export interface SchedulingResult {
  decisions: ScheduleDecision[]
  /** 并发度(同时执行的 agent 数) */
  concurrency: number
  /** 预计总耗时(秒) */
  estimatedTotalDurationSeconds: number
  /** 调度策略 */
  strategy: 'capability_match' | 'load_balance' | 'priority' | 'round_robin'
}

/** 失败重试策略 */
export interface RetryPolicy {
  /** 最大重试次数 */
  maxRetries: number
  /** 退避策略 */
  backoff: 'fixed' | 'linear' | 'exponential'
  /** 初始延迟(ms) */
  initialDelayMs: number
  /** 最大延迟(ms) */
  maxDelayMs: number
  /** 可重试的错误类型 */
  retryableErrors: Array<'timeout' | 'rate_limited' | 'overloaded' | 'network' | 'unknown'>
}

/** 故障转移配置 */
export interface FailoverConfig {
  /** 主 agent */
  primary: string
  /** 备用 agent 列表 */
  fallbacks: string[]
  /** 触发转移的条件 */
  triggerOn: Array<'failure' | 'timeout' | 'low_quality'>
  /** 质量阈值(triggerOn 含 low_quality 时) */
  qualityThreshold?: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
