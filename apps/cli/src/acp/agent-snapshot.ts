// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 运行态快照 —— W4-02 的净室复现层。
 *
 * Qoder 的 `agentSnapshot` 带 `revision`/`model`/`permissionMode`/`skillRefs` 等字段,
 * 由主进程组装后发给 UI。IHUI 此前没有同源快照:UI 的"模式/权限/上下文占用"
 * 分别从不同入口推导,刷新时序错开时会出现"显示 A、执行 B"。
 *
 * 本模块只做一件事:把**已确定的运行态输入**投影成一份只读快照,并给内容寻址
 * 的 `revision`。它不读文件、不查网络、不改任何状态 —— 因此不可能成为第二套
 * 状态源。调用方(ACP `x.ai/session/snapshot`)负责从会话事实取输入。
 *
 * 超越点(对照源产品):
 *   - `revision` 不是自增计数器,而是**快照内容**的 SHA-256 前 16 位:
 *     内容没变 revision 就不变,UI 可以据此拒绝过期快照,也可用 `ifRevision`
 *     做零成本轮询;源产品的 revision 是运行时内部序号,跨进程不保证可比。
 *   - 上下文占用显式标注 `estimate: 'heuristic'`,并带 `overLimit` 布尔,
 *     不把估算值伪装成账单值。
 */

import { createHash } from 'node:crypto'

export type AgentSnapshotMode = 'plan' | 'build' | 'review' | 'unknown'
export type AgentSnapshotPermissionMode = 'default' | 'allow-dangerous'

export interface AgentSnapshotInput {
  /** 生成时刻(ms);缺省取 Date.now()。只影响 generatedAt,不进 revision。 */
  readonly now?: number
  readonly sessionId: string
  readonly agent: {
    readonly id: string
    readonly name: string
    readonly model: string
  }
  readonly runtime: {
    readonly mode: AgentSnapshotMode
    readonly permissionMode: AgentSnapshotPermissionMode
    readonly planFirst: boolean
    readonly autoApprovePlan: boolean
    readonly planApproved: boolean
    readonly maxIterations: number
  }
  readonly context: {
    readonly historyMessages: number
    readonly usedTokens: number
    readonly limitTokens: number
    /** 历史中压缩摘要消息条数(由调用方按 SUMMARY_MARKER 统计) */
    readonly summaryMessages: number
  }
  readonly capabilities: {
    readonly mcpEnabled: boolean
    readonly skills?: readonly string[]
    readonly plugins?: readonly string[]
    readonly mcpServers?: readonly string[]
  }
}

export interface AgentSnapshot {
  readonly version: 1
  readonly revision: string
  readonly generatedAt: string
  readonly sessionId: string
  readonly agent: AgentSnapshotInput['agent']
  readonly runtime: AgentSnapshotInput['runtime']
  readonly context: {
    readonly historyMessages: number
    readonly usedTokens: number
    readonly limitTokens: number
    readonly remainingTokens: number
    readonly overLimit: boolean
    readonly summaryMessages: number
    readonly estimate: 'heuristic'
  }
  readonly capabilities: {
    readonly mcpEnabled: boolean
    readonly skills: readonly string[]
    readonly plugins: readonly string[]
    readonly mcpServers: readonly string[]
  }
}

/** 非空字符串;空白不算"有值"。 */
function requireNonEmpty(value: string, field: string): string {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (trimmed.length === 0) throw new Error(`${field} 必须是非空字符串`)
  return trimmed
}

/** 有限非负数;NaN/Infinity/负数一律拒,不静默取 0。 */
function requireNonNegative(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} 必须是非负有限数,收到 ${String(value)}`)
  }
  return value
}

/** 有限正整数;0 也不接受(上下文窗口为 0 等于没有容量)。 */
function requirePositive(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} 必须是正有限数,收到 ${String(value)}`)
  }
  return value
}

/** 去重、去空白、按字典序排序 —— 保证同一集合换顺序时 revision 不变。 */
function normalizeNames(values: readonly string[] | undefined, field: string): string[] {
  if (values === undefined) return []
  const seen = new Set<string>()
  for (const value of values) seen.add(requireNonEmpty(value, field))
  return [...seen].sort()
}

const AGENT_SNAPSHOT_MODES: readonly string[] = ['plan', 'build', 'review', 'unknown']
const AGENT_SNAPSHOT_PERMISSION_MODES: readonly string[] = ['default', 'allow-dangerous']

/**
 * 把运行态输入投影成只读快照。
 *
 * 非法输入直接抛错,不产出"差不多"的快照 —— 快照是 UI 的执行依据,
 * 错一位就会让显示与执行分叉。
 */
export function buildAgentSnapshot(input: AgentSnapshotInput): AgentSnapshot {
  if (!AGENT_SNAPSHOT_MODES.includes(input.runtime.mode)) {
    throw new Error(`runtime.mode 非法: ${String(input.runtime.mode)}`)
  }
  if (!AGENT_SNAPSHOT_PERMISSION_MODES.includes(input.runtime.permissionMode)) {
    throw new Error(`runtime.permissionMode 非法: ${String(input.runtime.permissionMode)}`)
  }
  const sessionId = requireNonEmpty(input.sessionId, 'sessionId')
  const agent = {
    id: requireNonEmpty(input.agent.id, 'agent.id'),
    name: requireNonEmpty(input.agent.name, 'agent.name'),
    model: requireNonEmpty(input.agent.model, 'agent.model'),
  }
  const historyMessages = requireNonNegative(input.context.historyMessages, 'context.historyMessages')
  const usedTokens = requireNonNegative(input.context.usedTokens, 'context.usedTokens')
  const limitTokens = requirePositive(input.context.limitTokens, 'context.limitTokens')
  const summaryMessages = requireNonNegative(input.context.summaryMessages, 'context.summaryMessages')
  if (summaryMessages > historyMessages) {
    throw new Error('context.summaryMessages 不得大于 context.historyMessages')
  }
  const maxIterations = requirePositive(input.runtime.maxIterations, 'runtime.maxIterations')

  const runtime = {
    mode: input.runtime.mode,
    permissionMode: input.runtime.permissionMode,
    planFirst: input.runtime.planFirst,
    autoApprovePlan: input.runtime.autoApprovePlan,
    planApproved: input.runtime.planApproved,
    maxIterations,
  }
  const capabilities = {
    mcpEnabled: input.capabilities.mcpEnabled,
    skills: normalizeNames(input.capabilities.skills, 'capabilities.skills'),
    plugins: normalizeNames(input.capabilities.plugins, 'capabilities.plugins'),
    mcpServers: normalizeNames(input.capabilities.mcpServers, 'capabilities.mcpServers'),
  }
  const remainingTokens = Math.max(0, limitTokens - usedTokens)
  const overLimit = usedTokens > limitTokens

  // revision 只覆盖"可比较的执行态";generatedAt 刻意不参与 ——
  // 同一份状态在不同毫秒生成,不应被 UI 当成新版本。
  const body = {
    version: 1 as const,
    sessionId,
    agent,
    runtime,
    context: {
      historyMessages,
      usedTokens,
      limitTokens,
      remainingTokens,
      overLimit,
      summaryMessages,
      estimate: 'heuristic' as const,
    },
    capabilities,
  }
  const revision = 'sha256:' + createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16)
  const now = input.now ?? Date.now()
  if (!Number.isFinite(now)) throw new Error(`now 必须是有限数,收到 ${String(input.now)}`)

  return {
    ...body,
    revision,
    generatedAt: new Date(now).toISOString(),
  }
}

/**
 * 快照是否已过期:调用方拿到的是旧 revision,当前事实已换新 revision。
 *
 * 只比内容,不比时间 —— 时间倒退/时钟漂移不会把同一份状态误判成新版本。
 */
export function isAgentSnapshotStale(snapshot: AgentSnapshot, currentRevision: string): boolean {
  return snapshot.revision !== currentRevision
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
