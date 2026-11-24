// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体控制面端点封装（RP-43，web 工单面板的唯一数据入口）。
 *
 * 契约对齐 apps/api/src/routes/super-agent.ts（prefix /api）与
 * packages/shared/src/super-agent/engine.ts 的 PanelView：
 *   GET  /api/super-agent/panel                    → SuperAgentPanelView
 *   POST /api/super-agent/tickets/:id/stop         → SuperAgentStopResult
 *   POST /api/super-agent/recorded/:id/accept      → SuperAgentAcceptRecordedResult
 *   GET  /api/super-agent/tickets/:id/assignment   → SuperAgentWorkerAssignment | null
 *   GET  /api/super-agent/tickets/:id/lease        → SuperAgentTicketLease
 *
 * 本包只封装**面板真正用到的能力**；报工/心跳/派单是 worker 侧通道，面板不造按钮。
 * 失败统一抛 ApiError（带 status/errorCode），端上用 status 区分「未登录/无权限」与
 * 「读失败」，禁止按 message 文本分支。
 */
import { ApiError } from '../api-error.js'
import { fetchApi } from '../client.js'

export type SuperAgentStrength = 'explicit' | 'inferred'
export type SuperAgentReportState =
  'progress' | 'waiting' | 'ready' | 'blocked' | 'failed' | 'dropped'
export type SuperAgentAssignmentState = 'pending' | 'running' | 'ended'
export type SuperAgentTicketStage =
  | { stage: 'person'; action: 'delivery' | 'answer' | 'review' | 'blocked' | 'failed' }
  | { stage: 'working'; action?: 'queued' }
  | { stage: 'idle' }
  | { stage: 'ended' }

/** 面板工单行（与 shared PanelTicket 同形）。 */
export interface SuperAgentPanelTicket {
  ticketId: string
  sourceId: string
  scope: string
  strength: SuperAgentStrength
  /** 建单时刻（epoch ms）；旧快照缺该字段时为 null。 */
  createdAt: number | null
  ownerUserId: string
  stage: SuperAgentTicketStage
  sessionId: string
  directory: string
  assignment: { id: string; state: SuperAgentAssignmentState; leaseExpiresAt?: number } | null
  report: { state: SuperAgentReportState; text: string } | null
  attention: string | null
  deliveryError: string | null
  ended: { by: 'person' | 'executor'; outcome: string } | null
  inputs: { triggerId: string; text: string; fromPerson: boolean }[]
  leaseLostAt: number | null
  lostLeaseCount: number
}

export type SuperAgentSlowVerdict = 'act' | 'ignore' | 'unclear'

export interface SuperAgentPendingRecord {
  id: string
  text: string
  reason: string
  /** 慢路径判定注记（与 shared slow-path.ts SlowDecision 同形）。 */
  decision?: { verdict: SuperAgentSlowVerdict; reason: string; at: number }
}

export interface SuperAgentPanelView {
  needsPerson: {
    ticketId: string
    stage: SuperAgentTicketStage
    attention: string | null
    scope: string
    sessionId: string
    directory: string
  }[]
  tickets: SuperAgentPanelTicket[]
  quietDrops: number
  recorded: number
  pendingRecords: SuperAgentPendingRecord[]
}

/** 与 shared roles.ts WorkerAssignment 同形（workerAssignment() 的返回）。 */
export interface SuperAgentWorkerAssignment {
  sessionId: string
  directory: string
  goal: string
  constraints: string
  deliverables: string
  role: 'worker'
  ownerUserId?: string
}

export interface SuperAgentTicketLease {
  remainingMs: number
  lostLeaseCount: number
  leaseLostAt: number | null
}

/** ReceiveResult 投影（stop/accept 共用）。 */
export interface SuperAgentTicketActionResult {
  disposition: string
  ticketId?: string
  stage?: SuperAgentTicketStage
  reason?: string
  dispatched?: { sessionId: string; dispatchId?: string; error?: string }[]
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetchApi<T>(url, options)
  if (!res.success) throw new ApiError(res.error || '请求失败', res.status, res.errorCode)
  return res.data
}

function ticketPath(id: string, suffix: string): string {
  return `/api/super-agent/tickets/${encodeURIComponent(id)}/${suffix}`
}

/** 读本登录主体的工单面板（GET /api/super-agent/panel）。 */
export function getSuperAgentPanel(): Promise<SuperAgentPanelView> {
  return api<SuperAgentPanelView>('/api/super-agent/panel')
}

/** 停止一张工单（POST /api/super-agent/tickets/:id/stop）。 */
export function stopSuperAgentTicket(
  ticketId: string,
  reason?: string,
): Promise<SuperAgentTicketActionResult> {
  return api<SuperAgentTicketActionResult>(ticketPath(ticketId, 'stop'), {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  })
}

/** 人工确认一条已记账的推断请求，转成工单（POST /api/super-agent/recorded/:id/accept）。 */
export function acceptSuperAgentRecorded(
  triggerId: string,
  ruleId: string,
  routerNotes?: string,
): Promise<SuperAgentTicketActionResult> {
  return api<SuperAgentTicketActionResult>(
    `/api/super-agent/recorded/${encodeURIComponent(triggerId)}/accept`,
    {
      method: 'POST',
      body: JSON.stringify({ ruleId, ...(routerNotes ? { routerNotes } : {}) }),
    },
  )
}

/** 读工单派工信息（GET /api/super-agent/tickets/:id/assignment）。 */
export function getSuperAgentTicketAssignment(
  ticketId: string,
): Promise<SuperAgentWorkerAssignment | null> {
  return api<SuperAgentWorkerAssignment | null>(ticketPath(ticketId, 'assignment'))
}

/** 读工单租约读数（GET /api/super-agent/tickets/:id/lease）。 */
export function getSuperAgentTicketLease(ticketId: string): Promise<SuperAgentTicketLease> {
  return api<SuperAgentTicketLease>(ticketPath(ticketId, 'lease'))
}
