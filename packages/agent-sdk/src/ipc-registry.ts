// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-8 (L05/P1) 动态 IPC 注册表：call/listen/subscribe 命名通道 RPC。
 *
 * 判定边界（诚实纪律）：
 *   本模块实现**与传输无关的通道注册表与分派语义**——通道闭集、注册/注销、
 *   call/listen/subscribe 三类命名通道 RPC、未注册通道运行期 fail-closed + 审计打点。
 *   裸 ipcMain/ipcRenderer 的替代由宿主把本注册表接到其 RPC 传输层；真实 web↔desktop
 *   通道连通、运行期打点入库需实机联调，本模块**不**宣称"真实 IPC 已加固"。
 *   本模块不重造 RP-3 的 ihuiIpc 单一命名空间预算，也不重造 RP-7 的管道 ACL。
 *
 * 不变量：
 *   1. 通道名闭集：只有 register 过的通道可被 call/listen/subscribe，其余一律拒绝
 *   2. 拒绝即打点：未注册/已注销/种类不符的每次调用都产生 IpcAuditEvent（不含入参原文）
 *   3. sessionId 可追溯：审计事件带 sessionId（若调用方提供）
 *   4. 重复注册 fail-closed；注销后再注册允许（重新启用）
 *   5. 快照隔离：list() 返回副本，外部无法改内部注册表
 *   6. 打点失败不阻断：audit sink 抛错只忽略，不放大为调用失败（与审计口径一致）
 */

/** 通道种类：请求-响应 / 单向监听 / 订阅（两者都返回取消函数）。 */
export type IpcChannelKind = 'call' | 'listen' | 'subscribe'

/** 审计打点区分拒绝的根因。 */
export type IpcAuditReason = 'unregistered' | 'revoked' | 'kind-mismatch' | 'duplicate'

/** 通道定义：name 来自闭集注册表，owner/purpose 满足命名空间可追溯。 */
export interface IpcChannelDefinition {
  name: string
  kind: IpcChannelKind
  owner: string
  purpose: string
  handler?: (payload: unknown, ctx?: IpcCallContext) => unknown | Promise<unknown>
}

/** 调用上下文：只带可追溯字段，不带入参原文。 */
export interface IpcCallContext {
  sessionId?: string
}

/** 审计事件：只记通道标识与拒绝根因，绝不记 payload 原文。 */
export interface IpcAuditEvent {
  channel: string
  kind: IpcChannelKind
  reason: IpcAuditReason
  sessionId?: string
  at: number
}

/** 审计出口：由宿主接到 recordAuditLog（api 侧），本模块只发事件。 */
export type IpcAuditSink = (event: IpcAuditEvent) => void

/** 审计日志参数映射：给 api 侧透传 recordAuditLog 的纯函数（不含 payload）。 */
export interface IpcAuditLogParams {
  action: 'ipc.channel'
  resourceType: 'ipc_channel'
  resourceId: string
  result: 'denied'
  metadata: {
    channel: string
    kind: IpcChannelKind
    reason: IpcAuditReason
    sessionId?: string
    at: number
  }
}

export class IpcRegistryError extends Error {
  readonly reason: IpcAuditReason

  constructor(message: string, reason: IpcAuditReason) {
    super(message)
    this.name = 'IpcRegistryError'
    this.reason = reason
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/** 把审计事件映射为 api recordAuditLog 参数；不含 payload 原文。 */
export function toAuditLogParams(event: IpcAuditEvent): IpcAuditLogParams {
  return {
    action: 'ipc.channel',
    resourceType: 'ipc_channel',
    resourceId: event.channel,
    result: 'denied',
    metadata: {
      channel: event.channel,
      kind: event.kind,
      reason: event.reason,
      ...(isNonEmptyString(event.sessionId) ? { sessionId: event.sessionId } : {}),
      at: event.at,
    },
  }
}

/**
 * 动态 IPC 注册表：宿主用它替代裸 ipcMain 的直接分发。
 * 任何通道调用先经 resolve() 查闭集，未命中即 fail-closed 并打点。
 */
export class IpcRegistry {
  private readonly channels = new Map<string, IpcChannelDefinition>()
  private readonly revoked = new Set<string>()
  private readonly listeners = new Map<string, Set<(payload: unknown) => void>>()

  constructor(private readonly auditSink?: IpcAuditSink) {}

  private emit(
    channel: string,
    kind: IpcChannelKind,
    reason: IpcAuditReason,
    ctx?: IpcCallContext,
  ): void {
    if (!this.auditSink) return
    const event: IpcAuditEvent = {
      channel,
      kind,
      reason,
      ...(ctx && isNonEmptyString(ctx.sessionId) ? { sessionId: ctx.sessionId } : {}),
      at: Date.now(),
    }
    try {
      this.auditSink(event)
    } catch {
      // 打点失败只忽略、不阻断 fail-closed 决策；审计写失败不放大为调用失败。
    }
  }

  /** 注册通道：重复注册 fail-closed；name/owner/purpose 非法 fail-closed。 */
  register(def: IpcChannelDefinition): void {
    if (!def || !isNonEmptyString(def.name))
      throw new IpcRegistryError('通道 name 不得为空', 'unregistered')
    if (def.kind !== 'call' && def.kind !== 'listen' && def.kind !== 'subscribe')
      throw new IpcRegistryError(`通道 kind 非法: ${String(def.kind)}`, 'kind-mismatch')
    if (!isNonEmptyString(def.owner) || !isNonEmptyString(def.purpose))
      throw new IpcRegistryError('通道 owner 与 purpose 不得为空', 'unregistered')
    if (this.channels.has(def.name)) {
      this.emit(def.name, def.kind, 'duplicate')
      throw new IpcRegistryError(`通道已注册: ${def.name}`, 'duplicate')
    }
    this.channels.set(def.name, { ...def })
    this.revoked.delete(def.name)
  }

  /** 注销通道：清 handler 与该通道的监听器，登记为已撤销。 */
  unregister(name: string): boolean {
    if (!isNonEmptyString(name)) return false
    const existed = this.channels.delete(name)
    if (existed) this.revoked.add(name)
    this.listeners.delete(name)
    return existed
  }

  /** 是否已注册（只读）。 */
  has(name: string): boolean {
    return this.channels.has(name)
  }

  /** 已注册通道快照：返回副本，外部改不到内部注册表。 */
  list(): ReadonlyArray<Readonly<IpcChannelDefinition>> {
    return [...this.channels.values()].map((def) => ({ ...def }))
  }

  /** 查闭集：未注册/已撤销/种类不符都拒绝并打点。 */
  private resolve(name: string, kind: IpcChannelKind, ctx?: IpcCallContext): IpcChannelDefinition {
    if (!isNonEmptyString(name)) {
      this.emit(name, kind, 'unregistered', ctx)
      throw new IpcRegistryError('通道名不得为空', 'unregistered')
    }
    const def = this.channels.get(name)
    if (!def) {
      const reason: IpcAuditReason = this.revoked.has(name) ? 'revoked' : 'unregistered'
      this.emit(name, kind, reason, ctx)
      throw new IpcRegistryError(`未注册通道: ${name}`, reason)
    }
    // call 独占请求-响应；listen 与 subscribe 都是事件通道，共享监听表、互通。
    const isEventKind = (k: IpcChannelKind): boolean => k === 'listen' || k === 'subscribe'
    const kindMatches = def.kind === kind || (isEventKind(def.kind) && isEventKind(kind))
    if (!kindMatches) {
      this.emit(name, kind, 'kind-mismatch', ctx)
      throw new IpcRegistryError(
        `通道种类不符: ${name} 期望 ${kind} 实为 ${def.kind}`,
        'kind-mismatch',
      )
    }
    return def
  }

  /** 请求-响应通道：调已注册 call handler。 */
  async call(name: string, payload: unknown, ctx?: IpcCallContext): Promise<unknown> {
    const def = this.resolve(name, 'call', ctx)
    if (typeof def.handler !== 'function') {
      this.emit(name, 'call', 'unregistered', ctx)
      throw new IpcRegistryError(`通道无 handler: ${name}`, 'unregistered')
    }
    return def.handler(payload, ctx)
  }

  /** 注册监听，返回取消函数（幂等，重复取消无副作用）。 */
  listen(name: string, handler: (payload: unknown) => void, ctx?: IpcCallContext): () => void {
    this.resolve(name, 'listen', ctx)
    return this.addListener(name, handler)
  }

  /** 订阅，返回取消函数（与 listen 共享监听表，语义区分在文档）。 */
  subscribe(name: string, handler: (payload: unknown) => void, ctx?: IpcCallContext): () => void {
    this.resolve(name, 'subscribe', ctx)
    return this.addListener(name, handler)
  }

  private addListener(name: string, handler: (payload: unknown) => void): () => void {
    if (typeof handler !== 'function')
      throw new IpcRegistryError('监听 handler 必须为函数', 'unregistered')
    let bucket = this.listeners.get(name)
    if (!bucket) {
      bucket = new Set()
      this.listeners.set(name, bucket)
    }
    const target = bucket
    target.add(handler)
    let active = true
    return () => {
      if (!active) return
      active = false
      target.delete(handler)
      if (target.size === 0) this.listeners.delete(name)
    }
  }

  /** 向已注册通道的监听器广播；返回本次投递的监听器数。 */
  emitTo(name: string, payload: unknown): number {
    const bucket = this.listeners.get(name)
    if (!bucket || bucket.size === 0) return 0
    for (const handler of [...bucket]) handler(payload)
    return bucket.size
  }

  /** 监听器数量（诊断用）。 */
  listenerCount(name: string): number {
    return this.listeners.get(name)?.size ?? 0
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
