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
  DEFAULT_MIN_CONFIDENCE,
  DEFAULT_SLOW_PATH_RULES,
  MAX_SLOW_JUDGE_ATTEMPTS,
  classifyDecisions,
  isSlowDecision,
  type SlowDecision,
  type SlowJudgeCall,
  type SlowJudgeInput,
  type SlowUnjudgedReason,
} from './slow-path'
import {
  SNAPSHOT_VERSION,
  __shape__,
  type OwnerSlice,
  type RestoreReport,
  type SuperAgentSnapshot,
} from './persist'

const { isPlainString, ticketShape, workerShape, ownerSliceShape } = __shape__

export type AcceptMode = 'record' | 'auto'
export type Strength = 'explicit' | 'inferred'
/** 观察档位：off＝暂停、observe＝只记录不自动开工、auto＝推断规则命中可开工。 */
export type ObservationTier = 'off' | 'observe' | 'auto'
/** 授权经过的路：显式点名 / 准入矩阵（非慢路径规则）/ follow-up 推断 / bot。 */
export type MandateRoute = 'explicit' | 'admission' | 'follow-up' | 'bot'
export type ReportState = 'progress' | 'waiting' | 'ready' | 'blocked' | 'failed' | 'dropped'
export type AssignmentState = 'pending' | 'running' | 'ended'
export type SpeakPurpose = 'acknowledgement' | 'result' | 'attention'

export type TicketStage =
  | { stage: 'person'; action: 'delivery' | 'answer' | 'review' | 'blocked' | 'failed' }
  | { stage: 'working'; action?: 'queued' }
  | { stage: 'idle' }
  | { stage: 'ended' }

/** 准入规则台账的一格。规则被禁用或 revision 变化都会触发在跑工单重验。 */
export interface SuperAgentRule {
  id: string
  enabled: boolean
  /** 规则定义的版本/指纹；缺省时只判启用状态，不做改写判定。 */
  revision?: string
}

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
  /** 显式授权来源的允许名单（actorId）。缺省＝沿用 sessionIsAllowlist 语义。 */
  allowedActors?: string[]
  /** 准入规则台账。缺省＝旧策略没有台账，规则变更不参与重验。 */
  rules?: SuperAgentRule[]
}

/** 当时的观察档位。old acceptMode='record' 对应 observe，paused 对应 off。 */
export function observationTier(policy: SuperAgentPolicy): ObservationTier {
  if (policy.paused) return 'off'
  return policy.acceptMode === 'auto' ? 'auto' : 'observe'
}

/** 一张工单被授权时的依据。缺字段的旧快照按「当时未知」处理。 */
export interface MandateBasis {
  actorId: string
  sourceId: string
  scope: string
  strength: Strength
  route: MandateRoute
  /** 推断路径命中的规则 id；显式/机器人路径为 null。 */
  ruleId: string | null
  /** 命中规则的定义指纹；旧快照或未带 revision 的规则为 null。 */
  ruleRevision: string | null
  tier: ObservationTier
  policyVersion: string
}

export type PolicyEventKind = 'policyRevoked' | 'policyDowngraded' | 'policy-changed'

export interface PolicyEvent {
  at: number
  kind: PolicyEventKind
  policyVersion: string
  detail: string
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
  /** 建单时刻（epoch ms）。RP-43：面板「创建时间」列的唯一来源；旧快照无此字段时为 null。 */
  createdAt?: number
  scope: string
  strength: Strength
  policyVersion: string
  mandateWithdrawn: boolean
  /** 授权依据。undefined＝旧快照未记录（当时未知），不得按未授权处理。 */
  mandate?: MandateBasis
  /** 策略重验留痕。undefined＝旧快照未记录。 */
  policyEvents?: PolicyEvent[]
  /** 占槽时的租约截止（epoch ms）。仅租约档（workerLeaseMs>0）的 running 写入；到期由 tickLeases 回收。 */
  assignment: { id: string; state: AssignmentState; leaseExpiresAt?: number } | null
  report: { state: ReportState; text: string } | null
  attention: string | null
  deliveryError: string | null
  ended: { by: 'person' | 'executor' | 'policy'; outcome: string } | null
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

/**
 * 面板工单行（RP-43）。
 *
 * `needsPerson` 只收「要人处理」的单；本字段是本主体的**全部**工单投影，
 * 供 web 工单面板列出状态/领域/创建时间/所属主体/进度与详情。判据仍在引擎，
 * 这里只做原样投影，不在端内复算阶段。
 */
export interface PanelTicket {
  ticketId: string
  /** 来源/领域（触发进来的那个来源）。 */
  sourceId: string
  scope: string
  strength: Strength
  /** 建单时刻（epoch ms）；旧快照缺该字段时为 null，端上按「未记录」渲染。 */
  createdAt: number | null
  ownerUserId: string
  stage: TicketStage
  sessionId: string
  directory: string
  assignment: { id: string; state: AssignmentState; leaseExpiresAt?: number } | null
  report: { state: ReportState; text: string } | null
  attention: string | null
  deliveryError: string | null
  ended: { by: 'person' | 'executor' | 'policy'; outcome: string } | null
  /** 触发这张单的原始请求（含后续扇入的并单内容）。 */
  inputs: { triggerId: string; text: string; fromPerson: boolean }[]
  leaseLostAt: number | null
  lostLeaseCount: number
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
  /** 本主体全部工单（含 working/idle/ended），按建单先后稳定排列。 */
  tickets: PanelTicket[]
  quietDrops: number
  recorded: number
  pendingRecords: {
    id: string
    text: string
    reason: string
    /** 已尝试判定的次数（首判 + 重排）；到 MAX_SLOW_JUDGE_ATTEMPTS 后停发并记 unavailable。 */
    judgeAttempts: number
    decision?: SlowDecision
  }[]
  /** 命中规则被禁用/改写的工单，面板据此标出 policy-changed。 */
  policyChanged: {
    ticketId: string
    scope: string
    at: number
    policyVersion: string
    detail: string
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
  /** 每条积压的判定尝试次数：首判 + 最多 2 次重排，第 3 次未果记 unavailable（不再烧 token）。 */
  private readonly judgeAttempts = new Map<string, number>()
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

    return this.accept(trigger, ownerUserId, 'explicit', 'explicit', null)
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
    // 慢路径规则＝follow-up 推断；其余规则命中＝准入矩阵。
    const route: MandateRoute = ruleId.trim() === 'model-slow-path' ? 'follow-up' : 'admission'
    return this.accept(trigger, ownerUserId, 'inferred', route, ruleId.trim())
  }

  /** 记模型判定注记（record 档与 auto 档都能记）；已不在簿的条目不落（幂等）。 */
  noteSlowDecisions(
    ownerUserId: string,
    rows: { triggerId: string; decision: SlowDecision }[],
  ): { noted: number; skippedNotRecorded: number } {
    let noted = 0
    let skippedNotRecorded = 0
    for (const { triggerId, decision } of rows) {
      if (!isSlowDecision(decision)) {
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
   * 慢路径批判定：取本主体推断积压，交注入通道判定并回写注记。
   * auto 档 ∧ decision=accept ∧ direction 已定 ∧ 至少一条启用规则命中 ∧ intentEvidence 非空
   * ⇒ 才走与人工同一条 acceptRecorded 语义通道开工；未达标只落 wouldAccept 提案。
   * 暂停 ⇒ 顺延不判；通道异常/漏回 ⇒ 未判定保留，首判 + 2 次重排后记 unavailable 停发。
   */
  async judgeRecorded(
    ownerUserId: string,
    judge: SlowJudgeCall,
    options: {
      limit?: number
      now?: number
      /** 置信度门槛（< 阈值即 fail-closed）；默认 DEFAULT_MIN_CONFIDENCE。 */
      minConfidence?: number
      /** 启用规则清单（每条恰一个 ruleAssessment）；默认内置慢路径规则。 */
      rules?: readonly string[]
    } = {},
  ): Promise<{
    judged: number
    unjudged: number
    /** fail-closed 分档计数：每一档都点名，读不到 ≠ 不存在。 */
    unjudgedReasons: Partial<Record<SlowUnjudgedReason, number>>
    autoAccepted: (ReceiveResult & { triggerId: string })[]
    error?: string
  }> {
    const limit = Math.max(1, options.limit ?? 20)
    const now = options.now ?? this.clock.now()
    const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE
    const enabledRules = options.rules ?? DEFAULT_SLOW_PATH_RULES
    // 暂停时顺延：不判、不推进 attempt、不烧 token（恢复后从原积压继续）。
    if (this.policyFor(ownerUserId).paused) {
      return { judged: 0, unjudged: 0, unjudgedReasons: {}, autoAccepted: [] }
    }
    const entries: {
      triggerId: string
      trigger: IncomingTrigger
      input: SlowJudgeInput
    }[] = []
    const exhausted: string[] = []
    for (const [triggerId, saved] of this.recordedTriggers) {
      if (saved.trigger.actorId !== ownerUserId) continue
      // 已有落账判定（含模型 unavailable）不再重复烧 token。
      if (saved.decision) continue
      // 重排次数用尽：停发，按 unavailable 记，避免故障期间无限重试放大成本。
      if ((this.judgeAttempts.get(triggerId) ?? 0) >= MAX_SLOW_JUDGE_ATTEMPTS) {
        exhausted.push(triggerId)
        continue
      }
      entries.push({
        triggerId,
        trigger: saved.trigger,
        input: {
          id: triggerId,
          text: saved.trigger.text,
          observedAt: now,
          requesters: [ownerUserId],
          enabledRules: [...enabledRules],
          companions: [],
          relatedTickets: [],
          threadWindow: [],
        },
      })
      if (entries.length >= limit) break
    }
    // 输入要带上下文：批内同伴、相关工单、有界线程窗口（各限量，避免 prompt 无界膨胀）。
    for (const entry of entries) {
      entry.input.companions = entries
        .filter((e) => e.triggerId !== entry.triggerId)
        .slice(0, 10)
        .map((e) => ({ id: e.triggerId, text: e.trigger.text }))
      entry.input.relatedTickets = [...this.tickets.values()]
        .filter((t) => t.ownerUserId === ownerUserId && !t.ended && !t.mandateWithdrawn)
        .slice(-5)
        .map((t) => ({
          id: t.id,
          title: t.scope,
          scope: t.scope,
          strength: t.strength,
          stage: ticketStage(t).stage,
        }))
      entry.input.threadWindow = [...this.triggers.values()]
        .filter(
          (t) => t.sourceId === entry.trigger.sourceId && t.threadId === entry.trigger.threadId,
        )
        .slice(-10)
        .map((t) => ({
          actorId: t.actorId,
          fromBot: t.fromBot,
          addressed: t.addressed,
          text: t.text,
        }))
    }
    const exhaustedCount = exhausted.length
    if (entries.length === 0) {
      return {
        judged: 0,
        unjudged: exhaustedCount,
        unjudgedReasons: exhaustedCount > 0 ? { unavailable: exhaustedCount } : {},
        autoAccepted: [],
      }
    }
    // 发判前先记 attempt：通道抛错也算用掉一次，故障期不无限重试。
    for (const e of entries) {
      this.judgeAttempts.set(e.triggerId, (this.judgeAttempts.get(e.triggerId) ?? 0) + 1)
    }
    let raw: Partial<Record<string, SlowDecision>>
    try {
      raw = await judge(entries.map((e) => e.input))
    } catch (e) {
      // 通道不可用/超时：未判定不记绿、不动账（§0.3）；积压原地保留。
      return {
        judged: 0,
        unjudged: entries.length + exhaustedCount,
        unjudgedReasons: {
          channel_error: entries.length,
          ...(exhaustedCount > 0 ? { unavailable: exhaustedCount } : {}),
        },
        autoAccepted: [],
        error: e instanceof Error ? e.message : String(e),
      }
    }
    const ids = entries.map((e) => e.triggerId)
    const { decided, unjudged } = classifyDecisions(raw, ids, {
      minConfidence,
      enabledRules,
    })
    this.noteSlowDecisions(
      ownerUserId,
      decided.map((r) => ({ triggerId: r.id, decision: r.decision })),
    )
    // 拿到形状合法判定的条目销账 attempt；漏回/形状非法继续累计，到上限转 unavailable。
    for (const r of decided) this.judgeAttempts.delete(r.id)
    const unjudgedReasons: Partial<Record<SlowUnjudgedReason, number>> = {}
    if (exhaustedCount > 0) unjudgedReasons.unavailable = exhaustedCount
    for (const u of unjudged) {
      const reason: SlowUnjudgedReason =
        (this.judgeAttempts.get(u.id) ?? 0) >= MAX_SLOW_JUDGE_ATTEMPTS ? 'unavailable' : u.reason
      unjudgedReasons[reason] = (unjudgedReasons[reason] ?? 0) + 1
    }
    const passRows = decided.filter((r) => r.decision.gate === 'pass')
    const autoAccepted: (ReceiveResult & { triggerId: string })[] = []
    if (this.policyFor(ownerUserId).acceptMode === 'auto') {
      for (const r of passRows) {
        const saved = this.recordedTriggers.get(r.id)
        if (!saved || saved.trigger.fromBot) continue
        if (r.decision.decision !== 'accept') continue
        const matched = r.decision.ruleAssessments.find((a) => a.matched)
        if (!matched) continue
        const res = this.acceptRecorded(ownerUserId, r.id, matched.ruleId)
        if (res.disposition === 'accepted') autoAccepted.push({ ...res, triggerId: r.id })
      }
    }
    return {
      judged: passRows.length,
      unjudged: unjudged.length + exhaustedCount,
      unjudgedReasons,
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

  /**
   * 策略变更逐张重验在跑工单的授权依据（不再只通知）：
   * - 显式来源被移出 allowed ⇒ 结束工单、记 policyRevoked 并出声告知；
   * - 推断授权且档位由 auto 降 observe/off ⇒ 停新活、退回 recorded；
   * - 命中规则被禁用/改写 ⇒ 停新活并记 policy-changed，面板可见。
   * 撤权只停新动作：已完成报告与产出不回滚，已失效授权不再沿用。
   * 旧快照缺 mandate 的工单按「当时未知」处理，不按未授权砍单。
   */
  applyPolicy(ownerUserId: string, next: SuperAgentPolicy): string[] {
    this.ownerPolicy.set(ownerUserId, next)
    const notified: string[] = []
    for (const ticket of this.tickets.values()) {
      if (ticket.ownerUserId !== ownerUserId || ticket.ended || ticket.mandateWithdrawn) continue
      notified.push(ticket.id)
      const basis = ticket.mandate
      if (!basis) {
        // 当时未知：只补版本通知，不把缺字段当成未授权。
        if (ticket.policyVersion !== next.version) this.notePolicyVersion(ticket, next)
        continue
      }
      const outcome = this.revalidateTicket(ticket, basis, next)
      if (outcome === 'revoked' || outcome === 'downgraded' || outcome === 'rule-changed') continue
      if (ticket.policyVersion !== next.version) this.notePolicyVersion(ticket, next)
    }
    this.markDirty()
    return notified
  }

  /** 重验一张工单；返回处置结果。旧依据缺失时由调用方先行跳过。 */
  private revalidateTicket(
    ticket: SuperTicket,
    basis: MandateBasis,
    next: SuperAgentPolicy,
  ): 'ok' | 'revoked' | 'downgraded' | 'rule-changed' {
    // 1) 显式授权来源必须仍在 allowed 里。
    if (basis.route === 'explicit' && !this.actorAllowed(next, ticket.ownerUserId, basis.actorId)) {
      this.withdrawMandate(ticket)
      ticket.ended = { by: 'policy', outcome: 'policyRevoked' }
      this.recordPolicyEvent(
        ticket,
        'policyRevoked',
        next.version,
        `显式来源 ${basis.actorId} 已不在允许名单`,
      )
      this.speak(
        ticket,
        'attention',
        `策略 ${next.version} 撤回了这张工单的授权：来源 ${basis.actorId} 已不在允许名单。已完成的部分保留，新的动作不会开始。`,
      )
      return 'revoked'
    }

    // 2) 推断授权在 auto 档降级时停止接新活，原触发退回记录簿。
    if (basis.strength === 'inferred') {
      const nextTier = observationTier(next)
      if (basis.tier === 'auto' && nextTier !== 'auto') {
        this.withdrawMandate(ticket)
        this.returnToRecorded(ticket, `policy_downgraded:${next.version}`)
        ticket.ended = { by: 'policy', outcome: 'policyDowngraded' }
        this.recordPolicyEvent(
          ticket,
          'policyDowngraded',
          next.version,
          `观察档位 ${basis.tier} → ${nextTier}`,
        )
        return 'downgraded'
      }
      // 3) 命中的规则被禁用或改写。
      const issue = this.ruleIssue(basis, next)
      if (issue) {
        this.withdrawMandate(ticket)
        ticket.ended = { by: 'policy', outcome: 'policy-changed' }
        this.recordPolicyEvent(ticket, 'policy-changed', next.version, issue)
        return 'rule-changed'
      }
    }
    return 'ok'
  }

  /** 撤权只停新动作：结束执行槽，并清掉尚未派出的那一格。 */
  private withdrawMandate(ticket: SuperTicket): void {
    ticket.mandateWithdrawn = true
    this.endAssignment(ticket)
    this.pendingStart = this.pendingStart.filter((w) => w.sessionId !== ticket.execution.sessionId)
  }

  /** 推断授权降级：原触发回到 recorded 簿，供以后重新评估，不静默开工。 */
  private returnToRecorded(ticket: SuperTicket, reason: string): void {
    const triggerId = ticket.inputs[0]?.triggerId
    if (!triggerId || this.recordedTriggers.has(triggerId)) return
    const trigger = this.triggers.get(triggerId)
    if (!trigger) return
    this.bumpRecorded(ticket.ownerUserId)
    this.recordedTriggers.set(triggerId, { trigger, reason })
  }

  /** 命中规则的失效判据：移除、禁用或 revision 改写。旧策略无台账时不下判定。 */
  private ruleIssue(basis: MandateBasis, next: SuperAgentPolicy): string | null {
    if (basis.route !== 'admission' && basis.route !== 'follow-up') return null
    if (basis.ruleId === null || !next.rules) return null
    const rule = next.rules.find((row) => row.id === basis.ruleId)
    if (!rule) return `规则 ${basis.ruleId} 已从策略中移除`
    if (!rule.enabled) return `规则 ${basis.ruleId} 已禁用`
    if (basis.ruleRevision && rule.revision && rule.revision !== basis.ruleRevision) {
      return `规则 ${basis.ruleId} 已改写（${basis.ruleRevision} → ${rule.revision}）`
    }
    return null
  }

  /** 显式来源判定：有名单读名单；否则沿用「登录主体即允许名单」的既有语义。 */
  private actorAllowed(policy: SuperAgentPolicy, ownerUserId: string, actorId: string): boolean {
    if (policy.allowedActors) return policy.allowedActors.includes(actorId)
    if (policy.sessionIsAllowlist) return actorId === ownerUserId
    return true
  }

  private recordPolicyEvent(
    ticket: SuperTicket,
    kind: PolicyEventKind,
    policyVersion: string,
    detail: string,
  ): void {
    const events = ticket.policyEvents ?? []
    events.push({ at: this.clock.now(), kind, policyVersion, detail })
    ticket.policyEvents = events
  }

  /** 同一版本不重复刷通知；版本变了才记一笔给人看的输入。 */
  private notePolicyVersion(ticket: SuperTicket, next: SuperAgentPolicy): void {
    const triggerId = `policy-${next.version}`
    if (ticket.inputs.some((row) => row.triggerId === triggerId)) return
    ticket.inputs.push({ triggerId, text: `策略变为 ${next.version}`, fromPerson: false })
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
    const tickets: PanelTicket[] = [...this.tickets.values()]
      .filter((ticket) => ticket.ownerUserId === ownerUserId)
      .map((ticket) => ({
        ticketId: ticket.id,
        sourceId: ticket.sourceId,
        scope: ticket.scope,
        strength: ticket.strength,
        createdAt: typeof ticket.createdAt === 'number' ? ticket.createdAt : null,
        ownerUserId: ticket.ownerUserId,
        stage: ticketStage(ticket),
        sessionId: ticket.execution.sessionId,
        directory: ticket.execution.directory,
        assignment: ticket.assignment
          ? {
              id: ticket.assignment.id,
              state: ticket.assignment.state,
              ...(ticket.assignment.leaseExpiresAt !== undefined
                ? { leaseExpiresAt: ticket.assignment.leaseExpiresAt }
                : {}),
            }
          : null,
        report: ticket.report ? { state: ticket.report.state, text: ticket.report.text } : null,
        attention: ticket.attention,
        deliveryError: ticket.deliveryError,
        ended: ticket.ended ? { by: ticket.ended.by, outcome: ticket.ended.outcome } : null,
        inputs: ticket.inputs.map((input) => ({ ...input })),
        leaseLostAt: ticket.leaseLostAt,
        lostLeaseCount: ticket.lostLeaseCount,
      }))
    const needsPerson = tickets
      .filter((ticket) => ticket.stage.stage === 'person')
      .map((ticket) => ({
        ticketId: ticket.ticketId,
        stage: ticket.stage,
        attention: ticket.attention,
        scope: ticket.scope,
        sessionId: ticket.sessionId,
        directory: ticket.directory,
      }))
    const pendingRecords = [...this.recordedTriggers.values()]
      .filter((row) => row.trigger.actorId === ownerUserId)
      .map((row) => ({
        id: row.trigger.id,
        text: row.trigger.text,
        reason: row.reason,
        judgeAttempts: this.judgeAttempts.get(row.trigger.id) ?? 0,
        ...(row.decision ? { decision: row.decision } : {}),
      }))
    const policyChanged = [...this.tickets.values()]
      .filter((ticket) => ticket.ownerUserId === ownerUserId)
      .flatMap((ticket) =>
        (ticket.policyEvents ?? [])
          .filter((event) => event.kind === 'policy-changed')
          .map((event) => ({
            ticketId: ticket.id,
            scope: ticket.scope,
            at: event.at,
            policyVersion: event.policyVersion,
            detail: event.detail,
          })),
      )
    return {
      tickets,
      needsPerson,
      quietDrops: this.quietDrops,
      recorded: this.recorded,
      pendingRecords,
      policyChanged,
    }
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

  private accept(
    trigger: IncomingTrigger,
    ownerUserId: string,
    strength: Strength,
    route: MandateRoute,
    ruleId: string | null,
  ): ReceiveResult {
    const id = this.clock.id('ticket')
    const policy = this.policyFor(ownerUserId)
    const basis: MandateBasis = {
      actorId: trigger.actorId,
      sourceId: trigger.sourceId,
      scope: trigger.text,
      strength,
      route,
      ruleId,
      ruleRevision: ruleId
        ? (policy.rules?.find((row) => row.id === ruleId)?.revision ?? null)
        : null,
      tier: observationTier(policy),
      policyVersion: policy.version,
    }
    const ticket: SuperTicket = {
      id,
      ownerUserId,
      sourceId: trigger.sourceId,
      threadId: trigger.threadId,
      createdAt: this.clock.now(),
      scope: trigger.text,
      strength,
      policyVersion: policy.version,
      mandateWithdrawn: false,
      mandate: basis,
      policyEvents: [],
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
   * 该主体当前生效的执行槽上限。
   *
   * 单一真相源：本方法是 maxWorkers 的唯一对外读数出口，宿主把派单交给下游编排服务前
   * 用它注册租户并发闸（见 apps/api super-agent-pump-service）。接收/开工判据在本文件内
   * 也走 policyFor().maxWorkers，因此「引擎认为有槽」与「下游认为没超限」读的是同一个数，
   * 不再各自维护一套默认值。
   */
  maxWorkersFor(ownerUserId: string): number {
    return this.policyFor(ownerUserId).maxWorkers
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
            return { sourceId: sourceId ?? '', threadId: threadId ?? '', ticketIds: [...ids] }
          }),
        context: [...this.contextOf.entries()]
          .flatMap(([ticketId, keys]) =>
            [...keys]
              .filter((k) => k.split('\u0000')[0] === ownerUserId)
              .sort()
              .map((k) => {
                // threadKey 构造保证三段;split 结果 per TS 可能 undefined,兜回 string 不猜
                const [, sourceId, threadId] = k.split('\u0000')
                return { ticketId, sourceId: sourceId ?? '', threadId: threadId ?? '' }
              }),
          )
          .filter((r) => this.tickets.get(r.ticketId)?.ownerUserId === ownerUserId),
        replies: [...this.outbox.entries()]
          .filter(([key]) => key.split('\u0000')[0] === ownerUserId)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, rows]) => {
            const [, sourceId, threadId] = key.split('\u0000')
            return {
              sourceId: sourceId ?? '',
              threadId: threadId ?? '',
              speech: structuredClone(rows),
            }
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
    // 顶层逐字段形状守卫：缺任何一格都可能造"半恢复"，先验再灌（fail-closed）。
    if (
      typeof s.takenAt !== 'number' ||
      !s.defaultPolicy ||
      typeof s.defaultPolicy !== 'object' ||
      !Array.isArray(s.owners) ||
      !Array.isArray(s.policies) ||
      !Array.isArray(s.correlations) ||
      !Array.isArray(s.pendingStart)
    ) {
      return { ok: false, rejected: [{ reason: 'shape' }], panels: {} }
    }
    for (const owner of s.owners) {
      if (
        !owner ||
        !isPlainString(owner.ownerUserId) ||
        !owner.counters ||
        !ownerSliceShape(owner.slice)
      ) {
        rejected.push({ ownerUserId: owner?.ownerUserId, reason: 'shape' })
        continue
      }
      for (const t of owner.slice.tickets) {
        if (!ticketShape(t) || t.ownerUserId !== owner.ownerUserId) {
          rejected.push({ ownerUserId: owner.ownerUserId, reason: 'owner_mismatch' })
        }
      }
    }
    if (rejected.length > 0) {
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
            ...(r.decision && isSlowDecision(r.decision) ? { decision: r.decision } : {}),
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
    this.rebuildCounters(s.owners)
    // 快照时刻比本机当前时钟还新 ⇒ 机器时钟倒退，不谎称干净恢复：拒绝读数进 rejected 点名。
    if (typeof s.takenAt === 'number' && this.clock.now() < s.takenAt) {
      return { ok: true, rejected: [{ reason: 'clock_behind' }], panels }
    }
    return { ok: true, rejected: [], panels }
  }

  /** 恢复后全局面（非按主体）累计计数 = 各主体之和，面板读数以主体面为准。 */
  private rebuildCounters(owners: SuperAgentSnapshot['owners']): void {
    let q = 0
    let r = 0
    for (const owner of owners) {
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
