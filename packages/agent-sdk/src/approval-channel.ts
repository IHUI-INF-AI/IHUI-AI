// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 审批反向通道的三队列协议(L03/RP-7,2026-11-26)。
 *
 * 对标要求的三条判据,这里逐条落成可执行语义:
 *  - **三队列**:`approval` / `backup` / `restore` 三族各自独立,互不吞并;
 *  - **断线不丢**:连接断开期间仍可入队,条目不会因为"当下没人收"而消失;
 *  - **重连按序补发**:重连时按 `seq` 升序吐回全部未决条目,连续重连只吐同一份未决快照
 *    (补发是读操作,不改状态 —— 否则重放一次就丢一次)。
 *
 * 为什么 `seq` 是全局单调而不是每队列各自计数:三队列共享一条命名管道,重连补发要按**到达顺序**
 * 还原,分队列计数会让三族之间无法排序,读的人只能靠时间戳猜先后 —— 那是第二种真相源。
 *
 * 管道 ACL(限当前用户)不在这里:那是 Windows 侧 `ipc_channel_acl.rs` 的事,本模块只做协议形态。
 * 本模块也不落盘:持久化由调用方决定(审批中心在 api 侧有 `tool-approval-audit`),这里只管内存态
 * 与重放语义,不假装自己是一份数据库。
 */

export const APPROVAL_QUEUE_KINDS = ['approval', 'backup', 'restore'] as const
export type ApprovalQueueKind = (typeof APPROVAL_QUEUE_KINDS)[number]

export type ApprovalDecisionKind = 'allowed' | 'denied'

export interface ApprovalRequestInput {
  readonly kind: ApprovalQueueKind
  /** 请求归属会话:补发与审计都靠它回溯"这条是谁的"。必填,不接受空串。 */
  readonly sessionId: string
  /** 请求幂等键:同一 requestId 重复入队必须拒绝,否则重连补发会造成双份审批。 */
  readonly requestId: string
  readonly payload?: Readonly<Record<string, unknown>>
}

export interface ApprovalEnvelope {
  /** 全局单调序号,从 1 起。重连补发按它升序。 */
  readonly seq: number
  readonly kind: ApprovalQueueKind
  readonly sessionId: string
  readonly requestId: string
  readonly payload: Readonly<Record<string, unknown>>
  readonly enqueuedAt: number
  readonly state: 'pending' | 'allowed' | 'denied'
  /** 决策备注(允许/拒绝理由),未决为空。 */
  readonly note?: string
  readonly decidedAt?: number
}

export type ApprovalChannelErrorCode =
  | 'bad-kind'
  | 'missing-session'
  | 'missing-request'
  | 'duplicate-request'
  | 'unknown-seq'
  | 'already-decided'
  | 'bad-decision'

export class ApprovalChannelError extends Error {
  readonly code: ApprovalChannelErrorCode

  constructor(code: ApprovalChannelErrorCode, message: string) {
    super(message)
    this.name = 'ApprovalChannelError'
    this.code = code
  }
}

export interface ApprovalChannelStats {
  readonly connected: boolean
  readonly total: number
  readonly pending: number
  readonly byKind: Readonly<Record<ApprovalQueueKind, number>>
}

/**
 * 内存态审批通道。调用方持有一份(桌面侧连管道、api 侧连审批中心),两侧用同一份协议。
 */
export class ApprovalChannel {
  private readonly items: ApprovalEnvelope[] = []
  private readonly seenRequestIds = new Set<string>()
  private connected = true
  private nextSeq = 1
  private readonly now: () => number

  constructor(options: { now?: () => number } = {}) {
    this.now = options.now ?? Date.now
  }

  get isConnected(): boolean {
    return this.connected
  }

  /**
   * 入队。**断线期间照常可用** —— 这正是"断线不丢"的实现位置:
   * 丢不丢取决于调用方有没有入队,不取决于当下连没连上。
   */
  enqueue(input: ApprovalRequestInput): ApprovalEnvelope {
    if (!APPROVAL_QUEUE_KINDS.includes(input.kind)) {
      throw new ApprovalChannelError('bad-kind', `未知队列:${String(input.kind)}`)
    }
    const sessionId = String(input.sessionId ?? '').trim()
    if (!sessionId) throw new ApprovalChannelError('missing-session', 'sessionId 不能为空')
    const requestId = String(input.requestId ?? '').trim()
    if (!requestId) throw new ApprovalChannelError('missing-request', 'requestId 不能为空')
    if (this.seenRequestIds.has(requestId)) {
      throw new ApprovalChannelError('duplicate-request', `requestId 重复:${requestId}`)
    }
    const envelope: ApprovalEnvelope = {
      seq: this.nextSeq++,
      kind: input.kind,
      sessionId,
      requestId,
      payload: input.payload ?? {},
      enqueuedAt: this.now(),
      state: 'pending',
    }
    this.seenRequestIds.add(requestId)
    this.items.push(envelope)
    return envelope
  }

  /** 决策回填。已决条目再判一次必须拒绝 —— 重复决策是审计里最坏的一种"静默改口"。 */
  decide(seq: number, decision: ApprovalDecisionKind, note?: string): ApprovalEnvelope {
    if (decision !== 'allowed' && decision !== 'denied') {
      throw new ApprovalChannelError('bad-decision', `未知决策:${String(decision)}`)
    }
    const target = this.items.find((item) => item.seq === seq)
    if (!target) throw new ApprovalChannelError('unknown-seq', `没有 seq=${seq} 的请求`)
    if (target.state !== 'pending') {
      throw new ApprovalChannelError('already-decided', `seq=${seq} 已决(${target.state})`)
    }
    const decided: ApprovalEnvelope = {
      ...target,
      state: decision,
      note: note?.trim() || undefined,
      decidedAt: this.now(),
    }
    const index = this.items.findIndex((item) => item.seq === seq)
    this.items[index] = decided
    return decided
  }

  /** 断线。只改连接态,不动队列:任何"断线时清空待办"的做法都等于丢审批。 */
  disconnect(): void {
    this.connected = false
  }

  /**
   * 重连并按序补发:返回**全部未决**条目,按 `seq` 升序,跨三队列统一排序。
   * 这是纯读操作 —— 连调两次拿到的必须是同一份快照(未决条目没变的前提下)。
   */
  reconnect(): readonly ApprovalEnvelope[] {
    this.connected = true
    return this.replay()
  }

  /** 未决条目的有序快照(补发与巡检共用同一份排序,避免两处各排一套)。 */
  replay(): readonly ApprovalEnvelope[] {
    return this.items
      .filter((item) => item.state === 'pending')
      .slice()
      .sort((a, b) => a.seq - b.seq)
  }

  /** 按队列族取未决条目(三队列互不串味)。 */
  pending(kind?: ApprovalQueueKind): readonly ApprovalEnvelope[] {
    const all = this.replay()
    return kind ? all.filter((item) => item.kind === kind) : all
  }

  /** 按会话回溯:审计侧"这条请求属于哪个会话"的直接入口。 */
  bySession(sessionId: string): readonly ApprovalEnvelope[] {
    const wanted = String(sessionId ?? '').trim()
    if (!wanted) return []
    return this.items.filter((item) => item.sessionId === wanted)
  }

  /** 全量台账(含已决),供审计导出。 */
  history(): readonly ApprovalEnvelope[] {
    return this.items.slice()
  }

  stats(): ApprovalChannelStats {
    const byKind: Record<ApprovalQueueKind, number> = { approval: 0, backup: 0, restore: 0 }
    let pending = 0
    for (const item of this.items) {
      byKind[item.kind] += 1
      if (item.state === 'pending') pending += 1
    }
    return { connected: this.connected, total: this.items.length, pending, byKind }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
