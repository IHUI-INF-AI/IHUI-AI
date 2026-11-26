// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L05 动态通道注册表(2026-11-26)。
 *
 * 现状:通道名是裸字符串 —— 发送方和接收方各自写一个字面量,谁也不查表。
 * 于是"改名"必然产生一条永远没人收的通道(不报错、不丢数据,只是静默不生效),
 * 而"未注册通道"在运行期没有任何人拦。对标的做法是把通道名收进一张**注册表**:
 * 注册时必须交代 owner 与用途,派发时必须先查表,查不到即拒并计数、留审计行。
 *
 * 本文件只做机制,不做接线:
 *  - `ChannelRegistry`:name/kind/owner/purpose 的唯一真相源;名字形态与重复登记都在这里拒;
 *  - `ChannelDispatcher`:真派发口。未注册 ⇒ `ChannelRejected`(code=`unregistered-channel`),
 *    同时把拒绝按通道名计数、写一条审计记录(审计不落原文载荷,只留名字/种类/结果)。
 *
 * 边界(诚实):桌面 preload、api websocket 侧的"全部通道改从本表取名"是第二步,
 * 本次先把机制与判据立住;谁还没接表,由后续棘轮按文件点名,不在这里假装已闭环。
 */

export const CHANNEL_KINDS = ['call', 'listen', 'subscribe'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

/** 2–4 段、小写、段内连字符:如 `terminal.session.create`、`mcp.tool.call`。 */
export const CHANNEL_NAME_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){1,3}$/

export interface ChannelSpec {
  readonly name: string
  readonly kind: ChannelKind
  /** 该通道的负责模块(写模块路径或席位名,不写个人)。 */
  readonly owner: string
  /** 一句话用途;空串视为未填。 */
  readonly purpose: string
}

export type ChannelRegistryErrorCode =
  'bad-name' | 'bad-kind' | 'missing-owner' | 'missing-purpose' | 'duplicate-channel'

export class ChannelRegistryError extends Error {
  readonly code: ChannelRegistryErrorCode
  constructor(code: ChannelRegistryErrorCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'ChannelRegistryError'
    this.code = code
  }
}

const keyOf = (name: string, kind: ChannelKind): string => `${kind}:${name}`

export class ChannelRegistry {
  private readonly specs = new Map<string, ChannelSpec>()

  register(spec: ChannelSpec): void {
    const name = spec.name.trim()
    if (!CHANNEL_NAME_PATTERN.test(name)) {
      throw new ChannelRegistryError('bad-name', `通道名不合法: ${JSON.stringify(spec.name)}`)
    }
    if (!(CHANNEL_KINDS as readonly string[]).includes(spec.kind)) {
      throw new ChannelRegistryError('bad-kind', `未知种类: ${String(spec.kind)}`)
    }
    if (!spec.owner.trim()) throw new ChannelRegistryError('missing-owner', name)
    if (!spec.purpose.trim()) throw new ChannelRegistryError('missing-purpose', name)
    const key = keyOf(name, spec.kind)
    if (this.specs.has(key)) {
      throw new ChannelRegistryError('duplicate-channel', `${spec.kind}:${name} 已登记`)
    }
    this.specs.set(key, Object.freeze({ ...spec, name }))
  }

  registerMany(specs: readonly ChannelSpec[]): void {
    for (const spec of specs) this.register(spec)
  }

  has(name: string, kind: ChannelKind): boolean {
    return this.specs.has(keyOf(name, kind))
  }

  resolve(name: string, kind: ChannelKind): ChannelSpec | null {
    return this.specs.get(keyOf(name, kind)) ?? null
  }

  /** 稳定快照:按 kind+name 排序,供棘轮与文档对账。 */
  snapshot(): readonly ChannelSpec[] {
    return [...this.specs.values()].sort((a, b) =>
      keyOf(a.name, a.kind).localeCompare(keyOf(b.name, b.kind)),
    )
  }

  get size(): number {
    return this.specs.size
  }
}

export class ChannelRejected extends Error {
  readonly code = 'unregistered-channel'
  readonly channel: string
  readonly kind: ChannelKind
  constructor(channel: string, kind: ChannelKind) {
    super(`未注册通道被拒: ${kind}:${channel}`)
    this.name = 'ChannelRejected'
    this.channel = channel
    this.kind = kind
  }
}

export interface ChannelAuditRecord {
  at: string
  channel: string
  kind: ChannelKind
  outcome: 'allowed' | 'rejected'
  owner: string | null
}

export interface ChannelDispatcherOptions {
  /** 审计出口(默认只留内存环)。调用方接日志/DB 时注入。 */
  onAudit?: (record: ChannelAuditRecord) => void
  /** 环形缓冲上限,默认 200。 */
  auditCapacity?: number
  now?: () => string
}

export class ChannelDispatcher {
  private readonly registry: ChannelRegistry
  private readonly opts: ChannelDispatcherOptions
  private readonly records: ChannelAuditRecord[] = []
  private readonly rejectionCounts = new Map<string, number>()
  private allowedCount = 0

  constructor(registry: ChannelRegistry, opts: ChannelDispatcherOptions = {}) {
    this.registry = registry
    this.opts = opts
  }

  private audit(record: ChannelAuditRecord): void {
    this.records.push(record)
    const cap = this.opts.auditCapacity ?? 200
    while (this.records.length > cap) this.records.shift()
    this.opts.onAudit?.(record)
  }

  /** 只查表不执行:未注册即拒(计数 + 审计)。给"先判合法性、再自己跑逻辑"的调用方用。 */
  guard(name: string, kind: ChannelKind): ChannelSpec {
    const spec = this.registry.resolve(name, kind)
    if (!spec) {
      const k = keyOf(name, kind)
      this.rejectionCounts.set(k, (this.rejectionCounts.get(k) ?? 0) + 1)
      this.audit({
        at: this.opts.now?.() ?? new Date().toISOString(),
        channel: name,
        kind,
        outcome: 'rejected',
        owner: null,
      })
      throw new ChannelRejected(name, kind)
    }
    return spec
  }

  /** 真派发口:先查表,未注册即拒(计数 + 审计),绝不"按名字硬发"。 */
  dispatch<T>(name: string, kind: ChannelKind, fn: (spec: ChannelSpec) => T): T {
    const spec = this.guard(name, kind)
    this.allowedCount += 1
    this.audit({
      at: this.opts.now?.() ?? new Date().toISOString(),
      channel: name,
      kind,
      outcome: 'allowed',
      owner: spec.owner,
    })
    return fn(spec)
  }

  /** 按通道名的拒绝次数快照(`kind:name` → 次数)。 */
  rejections(): ReadonlyMap<string, number> {
    return new Map(this.rejectionCounts)
  }

  get allowed(): number {
    return this.allowedCount
  }

  auditTrail(): readonly ChannelAuditRecord[] {
    return [...this.records]
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
