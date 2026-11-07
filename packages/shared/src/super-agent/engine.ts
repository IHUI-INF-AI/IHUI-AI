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
  'duplicate' | 'paused' | 'filtered' | 'fanout' | 'accepted' | 'recorded' | 'ignored'

export interface SuperTicket {
  id: string
  ownerUserId: string
  sourceId: string
  threadId: string
  scope: string
  strength: Strength
  policyVersion: string
  mandateWithdrawn: boolean
  assignment: { id: string; state: AssignmentState } | null
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
}

export interface ReceiveResult {
  disposition: Disposition
  reason?: string
  ticketId?: string
  speech: Speech | null
  stage?: TicketStage
}

export interface PanelView {
  needsPerson: { ticketId: string; stage: TicketStage; attention: string | null; scope: string }[]
  quietDrops: number
  recorded: number
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
  private readonly triggers = new Set<string>()
  private readonly tickets = new Map<string, SuperTicket>()
  private readonly byThread = new Map<string, string[]>()
  private quietDrops = 0
  private recorded = 0

  constructor(
    private policy: SuperAgentPolicy = DEFAULT_SUPER_AGENT_POLICY,
    private readonly clock: Clock = defaultClock(),
  ) {}

  receive(trigger: IncomingTrigger, ownerUserId: string): ReceiveResult {
    if (this.triggers.has(trigger.id)) {
      return { disposition: 'duplicate', speech: null }
    }
    this.triggers.add(trigger.id)

    if (this.policy.paused) {
      return { disposition: 'paused', speech: null }
    }
    if (this.policy.sessionIsAllowlist && trigger.actorId !== ownerUserId) {
      return { disposition: 'filtered', reason: 'actor_mismatch', speech: null }
    }

    const subscribed = this.subscribed(ownerUserId, trigger.sourceId, trigger.threadId)
    const fromPerson = !trigger.fromBot
    if (fromPerson && subscribed.length > 0) {
      return this.fanOut(trigger, subscribed)
    }

    if (trigger.fromBot || !trigger.addressed) {
      this.recorded += 1
      return { disposition: 'recorded', reason: trigger.fromBot ? 'bot' : 'inferred', speech: null }
    }

    return this.accept(trigger, ownerUserId)
  }

  report(
    ticketId: string,
    ownerUserId: string,
    body: { state: ReportState; text: string; question?: string },
  ): ReceiveResult {
    const ticket = this.owned(ticketId, ownerUserId)
    if (!ticket || ticket.ended || ticket.mandateWithdrawn) {
      return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    }
    const now = this.clock.now()
    ticket.report = { state: body.state, text: body.text }
    ticket.reportAt = now
    ticket.deliveryError = null
    if (body.question && body.question.trim().length > 0) {
      ticket.attention = body.question.trim()
    }

    if (body.state === 'progress') {
      this.quietDrops += 1
      return this.quiet(ticket)
    }
    if (body.state === 'waiting') {
      this.quietDrops += 1
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
    if (!ticket || ticket.ended) {
      return { disposition: 'filtered', reason: 'no_ticket', speech: null }
    }
    ticket.mandateWithdrawn = true
    ticket.attention = null
    this.endAssignment(ticket)
    ticket.ended = { by: 'person', outcome: reason || 'stopped' }
    return { disposition: 'ignored', ticketId: ticket.id, speech: null, stage: ticketStage(ticket) }
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
      }))
    return { needsPerson, quietDrops: this.quietDrops, recorded: this.recorded }
  }

  getTicket(ticketId: string, ownerUserId: string): SuperTicket | null {
    return this.owned(ticketId, ownerUserId)
  }

  private accept(trigger: IncomingTrigger, ownerUserId: string): ReceiveResult {
    const ticket: SuperTicket = {
      id: this.clock.id('ticket'),
      ownerUserId,
      sourceId: trigger.sourceId,
      threadId: trigger.threadId,
      scope: trigger.text,
      strength: 'explicit',
      policyVersion: this.policy.version,
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
    }
    this.tickets.set(ticket.id, ticket)
    this.bind(ticket)
    this.launch(ticket, false)
    const speech = this.speak(ticket, 'acknowledgement', trigger.text)
    return { disposition: 'accepted', ticketId: ticket.id, speech, stage: ticketStage(ticket) }
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
    let last = live[live.length - 1]!
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
          running >= this.policy.maxWorkers &&
          ticket.assignment?.state === 'running'
        ) {
          extraUsed = true
        }
      }
      last = ticket
    }
    return { disposition: 'fanout', ticketId: last.id, speech: null, stage: ticketStage(last) }
  }

  private launch(ticket: SuperTicket, humanWake: boolean): void {
    const running = this.runningCount(ticket.ownerUserId)
    const limit = this.policy.maxWorkers + (humanWake ? 1 : 0)
    const state: AssignmentState = running < limit ? 'running' : 'pending'
    ticket.assignment = { id: this.clock.id('asg'), state }
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
      if (this.runningCount(ownerUserId) >= this.policy.maxWorkers) return
      if (candidate.ownerUserId !== ownerUserId || candidate.ended || candidate.mandateWithdrawn) {
        continue
      }
      if (candidate.assignment?.state !== 'pending') continue
      if (ticketStage(candidate).stage === 'person') continue
      candidate.assignment = { id: candidate.assignment.id, state: 'running' }
    }
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
      return { purpose, ticketId: ticket.id, text }
    }
    if (purpose === 'result') {
      if (ticket.spokenResult) return null
      ticket.spokenResult = true
      return { purpose, ticketId: ticket.id, text }
    }
    if (ticket.spokenAttention === text) return null
    ticket.spokenAttention = text
    return { purpose, ticketId: ticket.id, text }
  }

  private quiet(ticket: SuperTicket): ReceiveResult {
    return { disposition: 'fanout', ticketId: ticket.id, speech: null, stage: ticketStage(ticket) }
  }

  private owned(ticketId: string, ownerUserId: string): SuperTicket | null {
    const ticket = this.tickets.get(ticketId)
    if (!ticket || ticket.ownerUserId !== ownerUserId) return null
    return ticket
  }

  private subscribed(ownerUserId: string, sourceId: string, threadId: string): string[] {
    return this.byThread.get(threadKey(ownerUserId, sourceId, threadId)) ?? []
  }

  private bind(ticket: SuperTicket): void {
    const key = threadKey(ticket.ownerUserId, ticket.sourceId, ticket.threadId)
    const list = this.byThread.get(key) ?? []
    list.push(ticket.id)
    this.byThread.set(key, list)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
