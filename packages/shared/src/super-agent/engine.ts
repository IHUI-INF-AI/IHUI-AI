// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体控制面。
 *
 * 行为对照 DeepSeek dsh-superagent（MIT，2026-10-31 公开原型）的领域规则：
 * 来源事件只记一次；允许的人点名才开工；推断请求在 record 档只记账；
 * 工单自己的状态不跟着执行器会话走；进度不出声，只有要人处理或能用的结果才出声。
 *
 * 本文件是自写实现。超越点：按登录主体隔离工单与工人槽，
 * 并累计被压掉的进度出声（quietDrops），健康工单不进面板。
 */

import { executionFor, scopeFromRequest, workerAssignment, type WorkerAssignment } from './roles'
import {
  isSlowVerdict,
  pickDecisions,
  type SlowDecision,
  type SlowJudgeCall,
  type SlowJudgeInput,
} from './slow-path'
import {
  SNAPSHOT_VERSION,
  __shape__,
  type OwnerSlice,
  type RestoreReport,
  type SuperAgentSnapshot,
} from './persist'

const { isPlainString, ticketShape, workerShape } = __shape__

export type AcceptMode = 'record' | 'auto'
export type Strength = 'explicit' | 'inferred'
export type ReportState = 'progress' | 'waiting' | 'ready' | 'blocked' | 'failed' | 'dropped'
export type AssignmentState = 'pending' | 'running' | 'ended'
export type SpeakPurpose = 'acknowledgement' | 'result' | 'attention'

export type TicketStage =
  | { stage: 'person'; action: 'delivery' | 'answer' | 'review' | 'blocked' | 'failed' }
  | { stage: 'working'; action?: 'queued' }
  | { stage: 'idle' }
  | { stage: 'ended' }

export interface SuperAgentPolicy {
  version: string
  paused: boolean
  acceptMode: AcceptMode
  /** 每个登录主体同时占用的执行槽。排队不占槽。 */
  maxWorkers: number
  /** 登录主体就是该来源的允许名单，不把别的来源账号映射过来。 */
  sessionIsAllowlist: boolean
  /** 工人心跳租约（毫秒）。0＝不设租约（默认，保持既有行为）；>0＝到点未心跳由 tickLeases 回收重派。 */
  workerLeaseMs?: number
}

export const DEFAULT_SUPER_AGENT_POLICY: SuperAgentPolicy = {
  version: 'session-v1',
  paused: false,
  acceptMode: 'record',
  maxWorkers: 3,
  sessionIsAllowlist: true,
}

export interface IncomingTrigger {
  id: string
  sourceId: string
  threadId: string
  actorId: string
  addressed: boolean
  fromBot: boolean
  text: string
}

export interface Speech {
  purpose: SpeakPurpose
  ticketId: string
  text: string
}

export type Disposition =
  'duplicate' | 'paused' | 'filtered' | 'fanout' | 'accepted' | 'recorded' | 'ignored' | 'context'

export interface SuperTicket {
  id: string
  ownerUserId: string
  sourceId: string
  threadId: string
  scope: string
  strength: Strength
  policyVersion: string
  mandateWithdrawn: boolean
  /** 占槽时的租约截止（epoch ms）。仅租约档（workerLeaseMs>0）的 running 写入；到期由 tickLeases 回收。 */
  assignment: { id: string; state: AssignmentState; leaseExpiresAt?: number } | null
  report: { state: ReportState; text: string } | null
  attention: string | null
  deliveryError: string | null
  ended: { by: 'person' | 'executor'; outcome: string } | null
  acked: boolean
  spokenResult: boolean
  spokenAttention: string | null
  reportAt: number
  humanAt: number
  inputs: { triggerId: string; text: string; fromPerson: boolean }[]
  execution: { sessionId: string; directory: string }
  /** 上一次租约到点被回收的时刻（epoch ms）；null＝没丢过或已续上。 */
  leaseLostAt: number | null
  /** 累计被看门狗回收几次（告警读数用，非身份键）。 */
  lostLeaseCount: number
}

export interface ReceiveResult {
  disposition: Disposition
  reason?: string
  ticketId?: string
  speech: Speech | null
  stage?: TicketStage
  work?: WorkerAssignment
}

export interface PanelView {
  needsPerson: {
    ticketId: string
    stage: TicketStage
    attention: string | null
    scope: string
    sessionId: string
    directory: string
  }[]
  quietDrops: number
  recorded: number
  pendingRecords: {
    id: string
    text: string
    reason: string
    decision?: SlowDecision
  }[]
}

interface Clock {
  now(): number
  id(prefix: string): string
}

function defaultClock(): Clock {
  let n = 0
  return {
    now: () => Date.now(),
    id: (prefix) => {
      n += 1
      return `${prefix}_${n.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    },
  }
}

export function waitsForPerson(ticket: SuperTicket): boolean {
  const state = ticket.report?.state
  if (state !== 'blocked' && state !== 'failed') return false
  return ticket.humanAt < ticket.reportAt
}

/** 阶段表：自上而下，先命中的一行生效。 */
export function ticketStage(ticket: SuperTicket): TicketStage {
  if (ticket.ended) return { stage: 'ended' }
  if (ticket.deliveryError) return { stage: 'person', action: 'delivery' }
  if (ticket.attention) return { stage: 'person', action: 'answer' }
  const report = ticket.report?.state
  if (report === 'ready') return { stage: 'person', action: 'review' }
  if ((report === 'blocked' || report === 'failed') && waitsForPerson(ticket)) {
    return { stage: 'person', action: report }
  }
  if (!ticket.assignment || ticket.assignment.state === 'pending') {
    return { stage: 'working', action: 'queued' }
  }
  if (report === 'waiting' || ticket.assignment.state === 'ended') return { stage: 'idle' }
  return { stage: 'working' }
}

export function canRetry(ticket: SuperTicket): boolean {
  return !ticket.ended && (waitsForPerson(ticket) || ticket.deliveryError !== null)
}

function threadKey(ownerUserId: string, sourceId: string, threadId: string): string {
  return `${ownerUserId}\u0000${sourceId}\u0000${threadId}`
}

export class SuperAgentHost {
  private readonly triggers = new Map<string, IncomingTrigger>()
  private readonly recordedTriggers = new Map<
    string,
    { trigger: IncomingTrigger; reason: string; decision?: SlowDecision }
  >()
  private readonly tickets = new Map<string, SuperTicket>()
  private readonly byThread = new Map<string, string[]>()
  private readonly contextOf = new Map<string, Set<string>>()
  private readonly outbox = new Map<string, Speech[]>()
  private readonly correlations = new Map<string, string[]>()
  private quietDrops = 0
  private recorded = 0
  /** 按主体分账（快照按 owner 切片持久化）；全局字段保持既有读数口径不变。 */
  private readonly perOwnerQuietDrops = new Map<string, number>()
  private readonly perOwnerRecorded = new Map<string, number>()
  private pendingStart: WorkerAssignment[] = []
  private readonly ownerPolicy = new Map<string, SuperAgentPolicy>()
  private readonly onDirty?: () => void

  constructor(
    private policy: SuperAgentPolicy = DEFAULT_SUPER_AGENT_POLICY,
    private readonly clock: Clock = defaultClock(),
    options: { onDirty?: () => void } = {},
  ) {
    this.onDirty = options.onDirty
  }

  /** 账面变更的唯一发声点（快照腿去抖由宿主决定，本层每次变更都喊）。 */
  private markDirty(): void {
    this.onDirty?.()
  }

  receive(trigger: IncomingTrigger, ownerUserId: string): ReceiveResult {
    if (this.triggers.has(trigger.id)) {
      return { disposition: 'duplicate', speech: null }
    }
    this.triggers.set(trigger.id, trigger)
    this.markDirty()

    if (this.policyFor(ownerUserId).paused) {
      return { disposition: 'paused', speech: null }
    }
    if (this.policyFor(ownerUserId).sessionIsAllowlist && trigger.actorId !== ownerUserId) {
      return { disposition: 'filtered', reason: 'actor_mismatch', speech: null }
    }

    const subscribed = this.subscribed(ownerUserId, trigger.sourceId, trigger.threadId)
    const fromPerson = !trigger.fromBot
    if (subscribed.length > 0 && fromPerson) return this.fanOut(trigger, subscribed)
    if (subscribed.length > 0) return this.deliverQuiet(trigger, subscribed)
    const contextHits = this.contextTickets(ownerUserId, trigger.sourceId, trigger.threadId)
    if (contextHits.length > 0) return this.deliverQuiet(trigger, contextHits)

    if (trigger.fromBot || !trigger.addressed) {
      const reason = trigger.fromBot ? 'bot' : 'inferred'
      this.bumpRecorded(ownerUserId)
      this.recordedTriggers.set(trigger.id, { trigger, reason })
      return { disposition: 'recorded', reason, speech: null }
    }

    return this.accept(trigger, ownerUserId, 'explicit')
  }

  report(
    ticketId: string,
    ownerUserId: string,
    body: { state: ReportState; text: string; question?: string },
  ): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket) this.markDirty()
    if (ticket) this.markDirty()
    if (!ticket || ticket.ended || ticket.mandateWithdrawn) {
      return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    }
    const now = this.clock.now()
    ticket.report = { state: body.state, text: body.text }
    ticket.reportAt = now
    ticket.deliveryError = null
    this.touchLease(ticket)
    if (body.question && body.question.trim().length > 0) {
      ticket.attention = body.question.trim()
    }

    if (body.state === 'progress') {
      this.dropQuiet(ticket)
      return this.quiet(ticket)
    }
    if (body.state === 'waiting') {
      this.dropQuiet(ticket)
      this.endAssignment(ticket)
      return this.quiet(ticket)
    }
    if (body.state === 'dropped') {
      this.endAssignment(ticket)
      ticket.ended = { by: 'executor', outcome: 'dropped' }
      return {
        disposition: 'fanout',
        ticketId: ticket.id,
        speech: null,
        stage: ticketStage(ticket),
      }
    }
    if (body.state === 'ready') {
      this.endAssignment(ticket)
      const speech = this.speak(ticket, 'result', body.text)
      return { disposition: 'accepted', ticketId: ticket.id, speech, stage: ticketStage(ticket) }
    }

    this.endAssignment(ticket)
    const speech = ticket.attention
      ? this.speak(ticket, 'attention', ticket.attention)
      : this.speak(ticket, 'attention', body.text)
    return { disposition: 'accepted', ticketId: ticket.id, speech, stage: ticketStage(ticket) }
  }

  stop(ticketId: string, ownerUserId: string, reason: string): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket) this.markDirty()
    if (ticket) this.markDirty()
    if (!ticket || ticket.ended) {
      return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    }
    ticket.mandateWithdrawn = true
    ticket.attention = null
    this.endAssignment(ticket)
    ticket.ended = { by: 'person', outcome: reason || 'stopped' }
    return { disposition: 'ignored', ticketId: ticket.id, speech: null, stage: ticketStage(ticket) }
  }

  /** 推断请求只有在 auto 档且点名了一条规则时才开工。范围仍是原始请求。 */
  acceptRecorded(
    ownerUserId: string,
    triggerId: string,
    ruleId: string,
    routerNotes = '',
  ): ReceiveResult {
    const saved = this.recordedTriggers.get(triggerId)
    if (!saved || saved.trigger.actorId !== ownerUserId) {
      return { disposition: 'filtered', reason: 'no_trigger', speech: null }
    }
    // 人点名优先的既有语义保持：判定只是"建议"，是否开工的门只在自动腿里判（见 judgeRecorded）。
    // 慢路径通道不替机器人开工。
    if (saved.trigger.fromBot && ruleId === 'model-slow-path') {
      return { disposition: 'recorded', reason: 'bot_never_auto', speech: null }
    }
    if (this.policyFor(ownerUserId).acceptMode !== 'auto' || ruleId.trim().length === 0) {
      return { disposition: 'recorded', reason: 'record_only', speech: null }
    }
    this.recordedTriggers.delete(triggerId)
    const trigger = { ...saved.trigger, text: scopeFromRequest(saved.trigger.text, routerNotes) }
    return this.accept(trigger, ownerUserId, 'inferred')
  }

  /** 记模型判定注记（record 档与 auto 档都能记）；已不在簿的条目不落（幂等）。 */
  noteSlowDecisions(
    ownerUserId: string,
    rows: { triggerId: string; decision: SlowDecision }[],
  ): { noted: number; skippedNotRecorded: number } {
    let noted = 0
    let skippedNotRecorded = 0
    for (const { triggerId, decision } of rows) {
      if (!isSlowVerdict(decision.verdict)) {
        skippedNotRecorded += 1
        continue
      }
      const saved = this.recordedTriggers.get(triggerId)
      if (!saved || saved.trigger.actorId !== ownerUserId) {
        skippedNotRecorded += 1
        continue
      }
      // 已判定且已人工开工的条目不在簿；已开工但判定迟到的 ⇒ 不回滚已发授权（语义与原语一致）。
      this.recordedTriggers.set(triggerId, { ...saved, decision })
      noted += 1
    }
    if (noted > 0) this.markDirty()
    return { noted, skippedNotRecorded }
  }

  /**
   * 慢路径批判定：取本主体推断积压（可按 verdict 过滤重判），交注入通道判定并回写注记。
   * auto 档 ∧ act ∧ inferred ⇒ 走与人工同一条 acceptRecorded('model-slow-path') 语义通道开工；
   * 通道异常 ⇒ 未判定不记绿，积压保留下轮可重试。
   */
  async judgeRecorded(
    ownerUserId: string,
    judge: SlowJudgeCall,
    options: { limit?: number; now?: number } = {},
  ): Promise<{
    judged: number
    unjudged: number
    autoAccepted: (ReceiveResult & { triggerId: string })[]
    error?: string
  }> {
    const limit = Math.max(1, options.limit ?? 20)
    const now = options.now ?? this.clock.now()
    const entries: { triggerId: string; input: SlowJudgeInput }[] = []
    for (const [triggerId, saved] of this.recordedTriggers) {
      if (saved.trigger.actorId !== ownerUserId) continue
      if (saved.decision && saved.decision.verdict !== 'unclear') continue
      entries.push({
        triggerId,
        input: {
          id: triggerId,
          text: saved.trigger.text,
          observedAt: now,
          requesters: [ownerUserId],
        },
      })
      if (entries.length >= limit) break
    }
    if (entries.length === 0) return { judged: 0, unjudged: 0, autoAccepted: [] }
    let raw: Partial<Record<string, SlowDecision>>
    try {
      raw = await judge(entries.map((e) => e.input))
    } catch (e) {
      // 未判定：不记绿、不动账（§0.3）；积压原地保留。
      return {
        judged: 0,
        unjudged: entries.length,
        autoAccepted: [],
        error: e instanceof Error ? e.message : String(e),
      }
    }
    const picked = pickDecisions(
      raw,
      entries.map((e) => e.triggerId),
    )
    this.noteSlowDecisions(
      ownerUserId,
      picked.map((r) => ({ triggerId: r.id, decision: r.decision })),
    )
    const autoAccepted: (ReceiveResult & { triggerId: string })[] = []
    if (this.policyFor(ownerUserId).acceptMode === 'auto') {
      for (const r of picked) {
        const saved = this.recordedTriggers.get(r.id)
        if (!saved || saved.trigger.fromBot) continue
        if (r.decision.verdict !== 'act') continue
        const res = this.acceptRecorded(ownerUserId, r.id, 'model-slow-path')
        if (res.disposition === 'accepted') autoAccepted.push({ ...res, triggerId: r.id })
      }
    }
    return {
      judged: picked.length,
      unjudged: entries.length - picked.length,
      autoAccepted,
    }
  }

  /** 把一条新触发并到已有工单。不新开授权。 */
  attach(ownerUserId: string, ticketId: string, trigger: IncomingTrigger): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket) this.markDirty()
    if (!ticket || ticket.mandateWithdrawn || ticket.ended?.by === 'person') {
      return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    }
    if (this.triggers.has(trigger.id)) return { disposition: 'duplicate', speech: null }
    this.triggers.set(trigger.id, trigger)
    this.bindThread(ticket, trigger.sourceId, trigger.threadId)
    return this.fanOut(trigger, [ticket.id])
  }

  /** 相关线程只提供上下文，不恢复工单，也不给新的授权。 */
  followForContext(
    ownerUserId: string,
    ticketId: string,
    sourceId: string,
    threadId: string,
  ): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket) this.markDirty()
    if (!ticket || ticket.ended?.by === 'person') {
      return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    }
    if (ticket.sourceId === sourceId && ticket.threadId === threadId) {
      return { disposition: 'filtered', reason: 'own_thread', speech: null }
    }
    const set = this.contextOf.get(ticket.id) ?? new Set<string>()
    set.add(threadKey(ownerUserId, sourceId, threadId))
    this.contextOf.set(ticket.id, set)
    return { disposition: 'context', ticketId: ticket.id, speech: null, stage: ticketStage(ticket) }
  }

  /** 关联只记上下文，不能拿来路由。 */
  correlate(triggerId: string, threadIds: string[]): void {
    this.correlations.set(triggerId, [...threadIds])
  }

  routeByCorrelation(triggerId: string): null {
    void this.correlations.get(triggerId)
    return null
  }

  /** 工人把触发交还。订阅还在，授权不变，触发重新进入记账。 */
  handback(
    ownerUserId: string,
    ticketId: string,
    triggerId: string,
    reason: string,
  ): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket) this.markDirty()
    const trigger = this.triggers.get(triggerId)
    if (!ticket || !trigger) return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    this.triggers.delete(triggerId)
    this.bumpRecorded(ownerUserId)
    this.recordedTriggers.set(triggerId, { trigger, reason })
    return {
      disposition: 'recorded',
      ticketId: ticket.id,
      reason,
      speech: null,
      stage: ticketStage(ticket),
    }
  }

  deliveryFailed(ownerUserId: string, ticketId: string, error: string): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket) this.markDirty()
    if (!ticket || ticket.ended) {
      return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    }
    ticket.deliveryError = error
    const speech = this.speak(ticket, 'attention', error)
    return { disposition: 'accepted', ticketId: ticket.id, speech, stage: ticketStage(ticket) }
  }

  /** 策略变了只通知在做的工单，不收回已经发出的授权。 */
  applyPolicy(ownerUserId: string, next: SuperAgentPolicy): string[] {
    this.ownerPolicy.set(ownerUserId, next)
    this.markDirty()
    const notified: string[] = []
    for (const ticket of this.tickets.values()) {
      if (ticket.ownerUserId !== ownerUserId || ticket.ended || ticket.mandateWithdrawn) continue
      ticket.inputs.push({
        triggerId: `policy-${next.version}`,
        text: `策略变为 ${next.version}`,
        fromPerson: false,
      })
      notified.push(ticket.id)
    }
    return notified
  }

  /** 扩大范围必须新开一张工单。旧授权的原文不动。 */
  widenScope(ownerUserId: string, ticketId: string): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (!ticket) return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    return { disposition: 'recorded', ticketId: ticket.id, reason: 'new_ticket', speech: null }
  }

  replies(ownerUserId: string, sourceId: string, threadId: string): Speech[] {
    return [...(this.outbox.get(threadKey(ownerUserId, sourceId, threadId)) ?? [])]
  }

  panel(ownerUserId: string): PanelView {
    const needsPerson = [...this.tickets.values()]
      .filter((ticket) => ticket.ownerUserId === ownerUserId)
      .map((ticket) => ({ ticket, stage: ticketStage(ticket) }))
      .filter((row) => row.stage.stage === 'person')
      .map((row) => ({
        ticketId: row.ticket.id,
        stage: row.stage,
        attention: row.ticket.attention,
        scope: row.ticket.scope,
        sessionId: row.ticket.execution.sessionId,
        directory: row.ticket.execution.directory,
      }))
    const pendingRecords = [...this.recordedTriggers.values()]
      .filter((row) => row.trigger.actorId === ownerUserId)
      .map((row) => ({
        id: row.trigger.id,
        text: row.trigger.text,
        reason: row.reason,
        ...(row.decision ? { decision: row.decision } : {}),
      }))
    return { needsPerson, quietDrops: this.quietDrops, recorded: this.recorded, pendingRecords }
  }

  getTicket(ticketId: string, ownerUserId: string): SuperTicket | null {
    return this.owned(ticketId, ownerUserId)
  }

  /** 工人活着就出声：report 之外的心跳通道。只在 running 且租约档才续。 */
  renewLease(ownerUserId: string, ticketId: string): { ok: boolean; reason?: string } {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket) this.markDirty()
    if (!ticket || ticket.ended || ticket.mandateWithdrawn) {
      return { ok: false, reason: 'no_ticket' }
    }
    if (ticket.assignment?.state !== 'running') return { ok: false, reason: 'not_running' }
    const leaseMs = this.policyFor(ownerUserId).workerLeaseMs ?? 0
    if (leaseMs <= 0) return { ok: false, reason: 'no_lease' }
    if (ticket.leaseLostAt !== null) {
      // 回收后补到心跳：恢复租约重派（幂等——重复心跳只刷新截止时间）。
      ticket.leaseLostAt = null
    }
    ticket.assignment = { ...ticket.assignment, ...this.leaseStamp(ticket, 'running') }
    return { ok: true }
  }

  /** 剩余租约（毫秒）；未设租约或不在 running 返回 null。纯读，不发声。 */
  leaseRemaining(ticketId: string, ownerUserId: string): number | null {
    const ticket = this.owned(ticketId, ownerUserId)
    if (ticket?.assignment?.state !== 'running' || ticket.assignment.leaseExpiresAt === undefined) {
      return null
    }
    return ticket.assignment.leaseExpiresAt - this.clock.now()
  }

  /**
   * Watchdog 巡检：到点未心跳的 running（本主体）→ 交还执行槽重新排队，
   * 并记 lostLeases 供告警读数。只碰本主体的单；不撤授权、不改工单状态机其它面。
   */
  tickLeases(ownerUserId: string): { reclaimed: string[] } {
    const reclaimed: string[] = []
    for (const ticket of this.tickets.values()) {
      if (ticket.ownerUserId !== ownerUserId) continue
      if (ticket.ended || ticket.mandateWithdrawn) continue
      const assignment = ticket.assignment
      if (assignment?.state !== 'running' || assignment.leaseExpiresAt === undefined) continue
      if (assignment.leaseExpiresAt > this.clock.now()) continue
      ticket.leaseLostAt = this.clock.now()
      ticket.lostLeaseCount += 1
      ticket.assignment = { ...assignment, state: 'pending' }
      reclaimed.push(ticket.id)
    }
    if (reclaimed.length > 0) {
      this.markDirty()
      this.promote(ownerUserId)
    }
    return { reclaimed }
  }

  private touchLease(ticket: SuperTicket): void {
    if (ticket.assignment?.state !== 'running') return
    const leaseMs = this.policyFor(ticket.ownerUserId).workerLeaseMs ?? 0
    if (leaseMs <= 0) return
    ticket.leaseLostAt = null
    ticket.assignment = { ...ticket.assignment, ...this.leaseStamp(ticket, 'running') }
  }

  private accept(trigger: IncomingTrigger, ownerUserId: string, strength: Strength): ReceiveResult {
    const id = this.clock.id('ticket')
    const ticket: SuperTicket = {
      id,
      ownerUserId,
      sourceId: trigger.sourceId,
      threadId: trigger.threadId,
      scope: trigger.text,
      strength,
      policyVersion: this.policyFor(ownerUserId).version,
      mandateWithdrawn: false,
      assignment: null,
      report: null,
      attention: null,
      deliveryError: null,
      ended: null,
      acked: false,
      spokenResult: false,
      spokenAttention: null,
      reportAt: 0,
      humanAt: 0,
      inputs: [{ triggerId: trigger.id, text: trigger.text, fromPerson: true }],
      execution: executionFor(id, ownerUserId),
      leaseLostAt: null,
      lostLeaseCount: 0,
    }
    this.tickets.set(ticket.id, ticket)
    this.bind(ticket)
    this.launch(ticket, false)
    const speech = this.speak(ticket, 'acknowledgement', trigger.text)
    return {
      disposition: 'accepted',
      ticketId: ticket.id,
      speech,
      stage: ticketStage(ticket),
      work: workerAssignment(ticket),
    }
  }

  private fanOut(trigger: IncomingTrigger, ticketIds: string[]): ReceiveResult {
    const known = ticketIds
      .map((id) => this.tickets.get(id))
      .filter((ticket): ticket is SuperTicket => ticket !== undefined)
    const stopped = known.filter(
      (ticket) => ticket.ended?.by === 'person' || ticket.mandateWithdrawn,
    )
    const live = known.filter((ticket) => ticket.ended?.by !== 'person' && !ticket.mandateWithdrawn)
    if (live.length === 0) {
      return {
        disposition: 'filtered',
        reason: stopped.length > 0 ? 'stopped' : 'no_ticket',
        speech: null,
      }
    }
    const now = this.clock.now()
    let extraUsed = false
    let last: SuperTicket | undefined
    for (const ticket of live) {
      if (ticket.ended && ticket.ended.by !== 'person') {
        ticket.ended = null
        ticket.report = null
        ticket.attention = null
      }
      ticket.inputs.push({ triggerId: trigger.id, text: trigger.text, fromPerson: true })
      ticket.humanAt = now
      ticket.attention = null
      if (!ticket.assignment || ticket.assignment.state !== 'running') {
        const running = this.runningCount(ticket.ownerUserId)
        this.launch(ticket, !extraUsed)
        if (
          !extraUsed &&
          running >= this.policyFor(ticket.ownerUserId).maxWorkers &&
          ticket.assignment?.state === 'running'
        ) {
          extraUsed = true
        }
      }
      last = ticket
    }
    if (!last) return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    return { disposition: 'fanout', ticketId: last.id, speech: null, stage: ticketStage(last) }
  }

  private launch(ticket: SuperTicket, humanWake: boolean): void {
    const running = this.runningCount(ticket.ownerUserId)
    const limit = this.policyFor(ticket.ownerUserId).maxWorkers + (humanWake ? 1 : 0)
    const state: AssignmentState = running < limit ? 'running' : 'pending'
    ticket.assignment = { id: this.clock.id('asg'), state, ...this.leaseStamp(ticket, state) }
    if (state === 'running') this.pendingStart.push(workerAssignment(ticket))
  }

  /** 租约只随 running 写；pending 不占时钟。返回空对象让调用处展开即"不写该键"。 */
  private leaseStamp(ticket: SuperTicket, state: AssignmentState): { leaseExpiresAt?: number } {
    const leaseMs = this.policyFor(ticket.ownerUserId).workerLeaseMs ?? 0
    if (state !== 'running' || leaseMs <= 0) return {}
    return { leaseExpiresAt: this.clock.now() + leaseMs }
  }

  private endAssignment(ticket: SuperTicket): void {
    if (ticket.assignment && ticket.assignment.state === 'running') {
      ticket.assignment = { ...ticket.assignment, state: 'ended' }
    }
    this.promote(ticket.ownerUserId)
  }

  /** 槽位空出来时，把本主体最早排队的工单拉起来。人的额外那一槽不给自动拉起用。 */
  private promote(ownerUserId: string): void {
    for (const candidate of this.tickets.values()) {
      if (this.runningCount(ownerUserId) >= this.policyFor(ownerUserId).maxWorkers) return
      if (candidate.ownerUserId !== ownerUserId || candidate.ended || candidate.mandateWithdrawn) {
        continue
      }
      if (candidate.assignment?.state !== 'pending') continue
      if (ticketStage(candidate).stage === 'person') continue
      candidate.assignment = {
        id: candidate.assignment.id,
        state: 'running',
        ...this.leaseStamp(candidate, 'running'),
      }
      this.pendingStart.push(workerAssignment(candidate))
    }
  }

  /** 本轮新占上执行槽的工人。路由读完即清，避免下一轮重复派发。 */
  takeStarted(): WorkerAssignment[] {
    const rows = this.pendingStart
    if (rows.length > 0) {
      this.pendingStart = []
      this.markDirty()
    }
    return rows
  }

  /**
   * 账面全量快照（深拷贝，宿主拿去写库）。含 pendingStart 未消费队列——
   * 崩溃恢复不得丢"已占槽还没派出去"的工人。
   */
  snapshot(): SuperAgentSnapshot {
    const ownerIds = new Set<string>()
    for (const t of this.tickets.values()) ownerIds.add(t.ownerUserId)
    for (const { trigger } of this.recordedTriggers.values()) ownerIds.add(trigger.actorId)
    for (const id of this.ownerPolicy.keys()) ownerIds.add(id)
    const owners: SuperAgentSnapshot['owners'] = []
    for (const ownerUserId of [...ownerIds].sort()) {
      const tickets = [...this.tickets.values()]
        .filter((t) => t.ownerUserId === ownerUserId)
        .sort((a, b) => a.id.localeCompare(b.id))
      const slice: OwnerSlice = {
        ticketIds: tickets.map((t) => t.id),
        tickets: structuredClone(tickets),
        triggers: [...this.triggers.values()]
          .filter((t) => t.actorId === ownerUserId)
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((t) => structuredClone(t)),
        recordedTriggers: [...this.recordedTriggers.entries()]
          .filter(([, r]) => r.trigger.actorId === ownerUserId)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([triggerId, r]) => ({
            triggerId,
            reason: r.reason,
            ...(r.decision ? { decision: r.decision } : {}),
          })),
        subscriptions: [...this.byThread.entries()]
          .filter(([key]) => key.split('\u0000')[0] === ownerUserId)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, ids]) => {
            const [, sourceId, threadId] = key.split('\u0000')
            return { sourceId, threadId, ticketIds: [...ids] }
          }),
        context: [...this.contextOf.entries()]
          .flatMap(([ticketId, keys]) =>
            [...keys]
              .filter((k) => k.split('\u0000')[0] === ownerUserId)
              .sort()
              .map((k) => {
                const [, sourceId, threadId] = k.split('\u0000')
                return { ticketId, sourceId, threadId }
              }),
          )
          .filter((r) => this.tickets.get(r.ticketId)?.ownerUserId === ownerUserId),
        replies: [...this.outbox.entries()]
          .filter(([key]) => key.split('\u0000')[0] === ownerUserId)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, rows]) => {
            const [, sourceId, threadId] = key.split('\u0000')
            return { sourceId, threadId, speech: structuredClone(rows) }
          }),
      }
      owners.push({
        ownerUserId,
        slice,
        counters: {
          quietDrops: this.perOwnerQuietDrops.get(ownerUserId) ?? 0,
          recorded: this.perOwnerRecorded.get(ownerUserId) ?? 0,
        },
      })
    }
    return {
      version: SNAPSHOT_VERSION,
      takenAt: this.clock.now(),
      defaultPolicy: structuredClone(this.policy),
      policies: [...this.ownerPolicy.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ownerUserId, policy]) => ({ ownerUserId, policy: structuredClone(policy) })),
      owners,
      correlations: [...this.correlations.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([triggerId, threadIds]) => ({ triggerId, threadIds: [...threadIds] })),
      pendingStart: structuredClone(this.pendingStart),
    }
  }

  /**
   * 全量恢复（先清后灌）。版本/形状 fail-closed —— 任何一片不匹配 ⇒ 整场拒绝、
   * 账面回到恢复前形态（宁可不恢复，绝不半恢复）。返回逐片读数供宿主告警。
   */
  restore(snap: unknown): RestoreReport {
    const rejected: RestoreReport['rejected'] = []
    const s = snap as Partial<SuperAgentSnapshot> | null
    if (!s || typeof s !== 'object') {
      return { ok: false, rejected: [{ reason: 'shape' }], panels: {} }
    }
    if (s.version !== SNAPSHOT_VERSION) {
      return { ok: false, rejected: [{ reason: 'version_mismatch' }], panels: {} }
    }
    for (const owner of Array.isArray(s.owners) ? s.owners : []) {
      if (!isPlainString(owner?.ownerUserId) || !owner.slice || !owner.counters) {
        rejected.push({ ownerUserId: owner?.ownerUserId, reason: 'shape' })
      }
      for (const t of owner.slice?.tickets ?? []) {
        if (!ticketShape(t) || t.ownerUserId !== owner.ownerUserId) {
          rejected.push({ ownerUserId: owner.ownerUserId, reason: 'owner_mismatch' })
        }
      }
    }
    if (!Array.isArray(s.owners) || rejected.length > 0) {
      return { ok: false, rejected, panels: {} }
    }
    // —— 通过后整场替换 ——
    this.triggers.clear()
    this.recordedTriggers.clear()
    this.tickets.clear()
    this.byThread.clear()
    this.contextOf.clear()
    this.outbox.clear()
    this.correlations.clear()
    this.ownerPolicy.clear()
    this.pendingStart = []
    this.quietDrops = 0
    this.recorded = 0
    this.perOwnerQuietDrops.clear()
    this.perOwnerRecorded.clear()
    this.policy = structuredClone(s.defaultPolicy)
    for (const { ownerUserId, policy } of s.policies ?? []) {
      this.ownerPolicy.set(ownerUserId, structuredClone(policy))
    }
    for (const owner of s.owners) {
      const slice = owner.slice
      for (const trigger of slice.triggers) this.triggers.set(trigger.id, structuredClone(trigger))
      for (const t of slice.tickets) this.tickets.set(t.id, structuredClone(t))
      for (const r of slice.recordedTriggers) {
        const trigger = this.triggers.get(r.triggerId)
        if (trigger) {
          this.recordedTriggers.set(r.triggerId, {
            trigger,
            reason: r.reason,
            ...(r.decision && isSlowVerdict(r.decision.verdict) ? { decision: r.decision } : {}),
          })
        }
      }
      for (const sub of slice.subscriptions) {
        const key = threadKey(owner.ownerUserId, sub.sourceId, sub.threadId)
        const list = this.byThread.get(key) ?? []
        for (const id of sub.ticketIds) if (!list.includes(id)) list.push(id)
        this.byThread.set(key, list)
      }
      for (const ctx of slice.context) {
        const set = this.contextOf.get(ctx.ticketId) ?? new Set<string>()
        set.add(threadKey(owner.ownerUserId, ctx.sourceId, ctx.threadId))
        this.contextOf.set(ctx.ticketId, set)
      }
      for (const rp of slice.replies) {
        const key = threadKey(owner.ownerUserId, rp.sourceId, rp.threadId)
        this.outbox.set(key, structuredClone(rp.speech))
      }
      this.perOwnerQuietDrops.set(owner.ownerUserId, owner.counters.quietDrops)
      this.perOwnerRecorded.set(owner.ownerUserId, owner.counters.recorded)
    }
    for (const { triggerId, threadIds } of s.correlations ?? []) {
      this.correlations.set(triggerId, [...threadIds])
    }
    this.pendingStart = (s.pendingStart ?? []).filter(workerShape).map((w) => structuredClone(w))
    const panels: Record<string, PanelView> = {}
    for (const owner of s.owners) panels[owner.ownerUserId] = this.panel(owner.ownerUserId)
    this.rebuildCounters(s)
    // 快照时刻比本机当前时钟还新 ⇒ 机器时钟倒退，不谎称干净恢复：拒绝读数进 rejected 点名。
    if (typeof s.takenAt === 'number' && this.clock.now() < s.takenAt) {
      return { ok: true, rejected: [{ reason: 'clock_behind' }], panels }
    }
    return { ok: true, rejected: [], panels }
  }

  /** 恢复后全局面（非按主体）累计计数 = 各主体之和，面板读数以主体面为准。 */
  private rebuildCounters(s: SuperAgentSnapshot): void {
    let q = 0
    let r = 0
    for (const owner of s.owners) {
      q += owner.counters.quietDrops
      r += owner.counters.recorded
    }
    this.quietDrops = q
    this.recorded = r
  }

  private runningCount(ownerUserId: string): number {
    let n = 0
    for (const ticket of this.tickets.values()) {
      if (
        ticket.ownerUserId === ownerUserId &&
        ticket.assignment?.state === 'running' &&
        !ticket.ended
      ) {
        n += 1
      }
    }
    return n
  }

  private speak(ticket: SuperTicket, purpose: SpeakPurpose, text: string): Speech | null {
    if (purpose === 'acknowledgement') {
      if (ticket.acked) return null
      ticket.acked = true
      return this.remember(ticket, { purpose, ticketId: ticket.id, text })
    }
    if (purpose === 'result') {
      if (ticket.spokenResult) return null
      ticket.spokenResult = true
      return this.remember(ticket, { purpose, ticketId: ticket.id, text })
    }
    if (ticket.spokenAttention === text) return null
    ticket.spokenAttention = text
    return this.remember(ticket, { purpose, ticketId: ticket.id, text })
  }

  private remember(ticket: SuperTicket, speech: Speech): Speech {
    const key = threadKey(ticket.ownerUserId, ticket.sourceId, ticket.threadId)
    const list = this.outbox.get(key) ?? []
    list.push(speech)
    this.outbox.set(key, list)
    return speech
  }

  private quiet(ticket: SuperTicket): ReceiveResult {
    return { disposition: 'fanout', ticketId: ticket.id, speech: null, stage: ticketStage(ticket) }
  }

  private dropQuiet(ticket: SuperTicket): void {
    this.quietDrops += 1
    this.perOwnerQuietDrops.set(
      ticket.ownerUserId,
      (this.perOwnerQuietDrops.get(ticket.ownerUserId) ?? 0) + 1,
    )
  }

  private bumpRecorded(ownerUserId: string): void {
    this.recorded += 1
    this.perOwnerRecorded.set(ownerUserId, (this.perOwnerRecorded.get(ownerUserId) ?? 0) + 1)
  }

  private policyFor(ownerUserId: string): SuperAgentPolicy {
    return this.ownerPolicy.get(ownerUserId) ?? this.policy
  }

  private owned(ticketId: string, ownerUserId: string): SuperTicket | null {
    const ticket = this.tickets.get(ticketId)
    if (!ticket || ticket.ownerUserId !== ownerUserId) return null
    return ticket
  }

  private subscribed(ownerUserId: string, sourceId: string, threadId: string): string[] {
    return this.byThread.get(threadKey(ownerUserId, sourceId, threadId)) ?? []
  }

  private deliverQuiet(trigger: IncomingTrigger, ticketIds: string[]): ReceiveResult {
    const live = ticketIds
      .map((id) => this.tickets.get(id))
      .filter((ticket): ticket is SuperTicket => ticket !== undefined)
      .filter((ticket) => ticket.ended?.by !== 'person' && !ticket.mandateWithdrawn)
    if (live.length === 0) return { disposition: 'filtered', reason: 'stopped', speech: null }
    for (const ticket of live) {
      ticket.inputs.push({ triggerId: trigger.id, text: trigger.text, fromPerson: false })
    }
    const last = live.at(-1)
    if (!last) return { disposition: 'filtered', reason: 'stopped', speech: null }
    return { disposition: 'context', ticketId: last.id, speech: null, stage: ticketStage(last) }
  }

  private contextTickets(ownerUserId: string, sourceId: string, threadId: string): string[] {
    const key = threadKey(ownerUserId, sourceId, threadId)
    const hits: string[] = []
    for (const [ticketId, threads] of this.contextOf) {
      if (threads.has(key)) hits.push(ticketId)
    }
    return hits
  }

  private bindThread(ticket: SuperTicket, sourceId: string, threadId: string): void {
    const key = threadKey(ticket.ownerUserId, sourceId, threadId)
    const list = this.byThread.get(key) ?? []
    if (!list.includes(ticket.id)) list.push(ticket.id)
    this.byThread.set(key, list)
  }

  private bind(ticket: SuperTicket): void {
    const key = threadKey(ticket.ownerUserId, ticket.sourceId, ticket.threadId)
    const list = this.byThread.get(key) ?? []
    list.push(ticket.id)
    this.byThread.set(key, list)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
