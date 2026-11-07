// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体控制面快照（存算分离）。行为对照 DeepSeek dsh-superagent 的
 * 「状态持久化 + Router 崩溃后全量恢复」设计；本文件为自写实现。
 * 超越点：版本 fail-closed（不匹配整片拒绝、绝不半恢复）、恢复重放触发幂等
 * （已见过的 id 重新 receive 必判 duplicate，不重开工单）、脏通知在泵消费点显式发声。
 *
 * 零 IO：序列化只碰 plain 数据；读写库由宿主（apps/api）接线。
 */

import type { IncomingTrigger, PanelView, Speech, SuperAgentPolicy, SuperTicket } from './engine'
import type { WorkerAssignment } from './roles'

export const SNAPSHOT_VERSION = 'super-agent-snapshot-v1'

/** 一个登录主体的全部账面。 */
export interface OwnerSlice {
  ticketIds: string[]
  tickets: SuperTicket[]
  triggers: IncomingTrigger[]
  recordedTriggers: { triggerId: string; reason: string }[]
  /** 订阅（线程→工单）结构化存三元组，重建走 host 内同一 threadKey。 */
  subscriptions: { sourceId: string; threadId: string; ticketIds: string[] }[]
  /** 上下文订阅：工单 id + 被订阅线程三元组。 */
  context: { ticketId: string; sourceId: string; threadId: string }[]
  replies: { sourceId: string; threadId: string; speech: Speech[] }[]
}

export interface SuperAgentSnapshot {
  version: string
  takenAt: number
  defaultPolicy: SuperAgentPolicy
  policies: { ownerUserId: string; policy: SuperAgentPolicy }[]
  owners: {
    ownerUserId: string
    slice: OwnerSlice
    counters: { quietDrops: number; recorded: number }
  }[]
  correlations: { triggerId: string; threadIds: string[] }[]
  /** 已占槽还没派出去的工人队列——崩溃恢复不得丢这一格。 */
  pendingStart: WorkerAssignment[]
}

export interface RestoreReport {
  ok: boolean
  rejected: {
    ownerUserId?: string
    reason: 'version_mismatch' | 'shape' | 'owner_mismatch' | 'clock_behind'
  }[]
  panels: Record<string, PanelView>
}

function isPlainString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function ticketShape(t: unknown): t is SuperTicket {
  if (t === null || typeof t !== 'object') return false
  const x = t as Partial<SuperTicket>
  return (
    isPlainString(x.id) &&
    isPlainString(x.ownerUserId) &&
    isPlainString(x.sourceId) &&
    isPlainString(x.threadId) &&
    typeof x.scope === 'string' &&
    (x.assignment === null || typeof x.assignment === 'object') &&
    (x.ended === null || typeof x.ended === 'object') &&
    Array.isArray(x.inputs) &&
    typeof x.execution === 'object' &&
    x.execution !== null
  )
}

function workerShape(w: unknown): w is WorkerAssignment {
  if (w === null || typeof w !== 'object') return false
  const x = w as Partial<WorkerAssignment>
  return (
    isPlainString(x.sessionId) &&
    isPlainString(x.directory) &&
    typeof x.goal === 'string' &&
    x.role === 'worker'
  )
}

// 形状判据 export 给引擎侧的 restore 使用（宿主不得复算，§0.6）。
export const __shape__ = { isPlainString, ticketShape, workerShape }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
