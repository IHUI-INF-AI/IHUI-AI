// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L05 动态通道注册表 + L12 通道域隔离(2026-11-26)。
 *
 * 现状:通道名是裸字符串 —— 发送方和接收方各自写一个字面量,谁也不查表。
 * 于是"改名"必然产生一条永远没人收的通道(不报错、不丢数据,只是静默不生效),
 * 而"未注册通道"在运行期没有任何人拦。对标的做法是把通道名收进一张**注册表**:
 * 注册时必须交代 owner 与用途,派发时必须先查表,查不到即拒并计数、留审计行。
 *
 * L12 在同一张表上再切三域(agent / ui / remote-session):
 *  - 每个域有独立版本号、ACL(allow/deny)与健康检查;
 *  - 同一个通道名**不许跨域复用**(跨域同名直接登记失败,避免"两个域抢同一个收件箱");
 *  - 审计记录带 domain,`auditByDomain()` 可按域分表。
 *
 * 说明:domain 默认 `agent`,既有调用点不用改;新域必须显式传。
 */

export const CHANNEL_KINDS = ['call', 'listen', 'subscribe'] as const
export type ChannelKind = (typeof CHANNEL_KINDS)[number]

/** L12 三域:代理执行面 / 界面面 / 远程会话面。 */
export const CHANNEL_DOMAINS = ['agent', 'ui', 'remote-session'] as const
export type ChannelDomain = (typeof CHANNEL_DOMAINS)[number]

/** 2–4 段、小写、段内连字符:如 `terminal.session.create`、`mcp.tool.call`。 */
export const CHANNEL_NAME_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){1,3}$/

export interface ChannelSpec {
  readonly name: string
  readonly kind: ChannelKind
  /** 所属域;省略时按 agent(兼容既有调用点)。 */
  readonly domain?: ChannelDomain
  /** 该通道的负责模块(写模块路径或席位名,不写个人)。 */
  readonly owner: string
  /** 一句话用途;空串视为未填。 */
  readonly purpose: string
}

/** L12 每域独立策略:版本号 + ACL。allow 为空表示"不额外限制",deny 优先。 */
export interface ChannelDomainPolicy {
  readonly version: string
  readonly acl?: {
    readonly allow?: readonly string[]
    readonly deny?: readonly string[]
  }
}

export interface ChannelDomainHealth {
  readonly domain: ChannelDomain
  readonly version: string
  readonly channels: number
  readonly rejected: number
  readonly healthy: boolean
}

export type ChannelRegistryErrorCode =
  | 'bad-name'
  | 'bad-kind'
  | 'bad-domain'
  | 'missing-owner'
  | 'missing-purpose'
  | 'duplicate-channel'
  | 'cross-domain-name'

export class ChannelRegistryError extends Error {
  readonly code: ChannelRegistryErrorCode
  constructor(code: ChannelRegistryErrorCode, detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'ChannelRegistryError'
    this.code = code
  }
}

const keyOf = (name: string, kind: ChannelKind, domain: ChannelDomain = 'agent'): string =>
  `${domain}:${kind}:${name}`

export class ChannelRegistry {
  private readonly specs = new Map<string, ChannelSpec & { domain: ChannelDomain }>()
  /** 通道名 → 首次登记它的域;用于 L12 "跨域不复用名字"判据。 */
  private readonly nameOwners = new Map<string, ChannelDomain>()
  private readonly policies = new Map<ChannelDomain, ChannelDomainPolicy>()

  register(spec: ChannelSpec): void {
    const name = spec.name.trim()
    const domain = spec.domain ?? 'agent'
    if (!CHANNEL_NAME_PATTERN.test(name)) {
      throw new ChannelRegistryError('bad-name', `通道名不合法: ${JSON.stringify(spec.name)}`)
    }
    if (!(CHANNEL_KINDS as readonly string[]).includes(spec.kind)) {
      throw new ChannelRegistryError('bad-kind', `未知种类: ${String(spec.kind)}`)
    }
    if (!(CHANNEL_DOMAINS as readonly string[]).includes(domain)) {
      throw new ChannelRegistryError('bad-domain', `未知域: ${String(domain)}`)
    }
    if (!spec.owner.trim()) throw new ChannelRegistryError('missing-owner', name)
    if (!spec.purpose.trim()) throw new ChannelRegistryError('missing-purpose', name)
    const ownerDomain = this.nameOwners.get(name)
    if (ownerDomain !== undefined && ownerDomain !== domain) {
      throw new ChannelRegistryError(
        'cross-domain-name',
        `${name} 已属 ${ownerDomain},不允许在 ${domain} 复用`,
      )
    }
    const key = keyOf(name, spec.kind, domain)
    if (this.specs.has(key)) {
      throw new ChannelRegistryError('duplicate-channel', `${domain}:${spec.kind}:${name} 已登记`)
    }
    this.specs.set(key, Object.freeze({ ...spec, name, domain }))
    this.nameOwners.set(name, domain)
  }

  registerMany(specs: readonly ChannelSpec[]): void {
    for (const spec of specs) this.register(spec)
  }

  /** 登记/更新某域策略(版本号 + ACL)。域必须是三域之一,版本号不得为空。 */
  registerDomain(domain: ChannelDomain, policy: ChannelDomainPolicy): void {
    if (!(CHANNEL_DOMAINS as readonly string[]).includes(domain)) {
      throw new ChannelRegistryError('bad-domain', `未知域: ${String(domain)}`)
    }
    if (!policy.version.trim()) {
      throw new ChannelRegistryError('bad-domain', `${domain} 缺版本号`)
    }
    this.policies.set(
      domain,
      Object.freeze({
        version: policy.version,
        acl: {
          allow: [...(policy.acl?.allow ?? [])],
          deny: [...(policy.acl?.deny ?? [])],
        },
      }),
    )
  }

  domainPolicy(domain: ChannelDomain): ChannelDomainPolicy | null {
    return this.policies.get(domain) ?? null
  }

  /** 该域 ACL 是否放行;未登记策略的域视为未上锁(兼容旧行为)。 */
  isDomainAllowed(domain: ChannelDomain, name: string, kind: ChannelKind): boolean {
    const policy = this.policies.get(domain)
    if (!policy) return true
    const deny = policy.acl?.deny ?? []
    if (deny.includes(name) || deny.includes(`${kind}:${name}`)) return false
    const allow = policy.acl?.allow ?? []
    if (allow.length === 0) return true
    return allow.includes(name) || allow.includes(`${kind}:${name}`)
  }

  /** 健康检查:策略在 + 版本号在 + 至少一条通道;拒绝数由派发器维度补。 */
  domainHealth(domain: ChannelDomain, rejected = 0): ChannelDomainHealth {
    const policy = this.policies.get(domain) ?? null
    const channels = [...this.specs.values()].filter((s) => s.domain === domain).length
    return {
      domain,
      version: policy?.version ?? '',
      channels,
      rejected,
      healthy: policy !== null && policy.version.length > 0 && channels > 0,
    }
  }

  has(name: string, kind: ChannelKind, domain: ChannelDomain = 'agent'): boolean {
    return this.specs.has(keyOf(name, kind, domain))
  }

  resolve(name: string, kind: ChannelKind, domain: ChannelDomain = 'agent'): ChannelSpec | null {
    return this.specs.get(keyOf(name, kind, domain)) ?? null
  }

  /** 稳定快照:按 domain+kind+name 排序,供棘轮与文档对账。 */
  snapshot(): readonly ChannelSpec[] {
    return [...this.specs.values()].sort((a, b) =>
      keyOf(a.name, a.kind, a.domain).localeCompare(keyOf(b.name, b.kind, b.domain)),
    )
  }

  get size(): number {
    return this.specs.size
  }
}

export class ChannelRejected extends Error {
  readonly code: 'unregistered-channel' | 'acl-denied'
  readonly channel: string
  readonly kind: ChannelKind
  readonly domain: ChannelDomain
  constructor(
    channel: string,
    kind: ChannelKind,
    domain: ChannelDomain = 'agent',
    code: 'unregistered-channel' | 'acl-denied' = 'unregistered-channel',
  ) {
    super(
      `${code === 'acl-denied' ? '域 ACL 拒绝' : '未注册通道被拒'}: ${domain}:${kind}:${channel}`,
    )
    this.name = 'ChannelRejected'
    this.channel = channel
    this.kind = kind
    this.domain = domain
    this.code = code
  }
}

export interface ChannelAuditRecord {
  at: string
  domain: ChannelDomain
  channel: string
  kind: ChannelKind
  outcome: 'allowed' | 'rejected'
  owner: string | null
  code?: 'unregistered-channel' | 'acl-denied'
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

  /** 只查表不执行:未注册/ACL 拒绝即拒(计数 + 审计)。 */
  guard(name: string, kind: ChannelKind, domain: ChannelDomain = 'agent'): ChannelSpec {
    const spec = this.registry.resolve(name, kind, domain)
    if (!spec) {
      this.recordRejected(name, kind, domain, 'unregistered-channel')
      throw new ChannelRejected(name, kind, domain, 'unregistered-channel')
    }
    if (!this.registry.isDomainAllowed(domain, name, kind)) {
      this.recordRejected(name, kind, domain, 'acl-denied')
      throw new ChannelRejected(name, kind, domain, 'acl-denied')
    }
    return spec
  }

  private recordRejected(
    name: string,
    kind: ChannelKind,
    domain: ChannelDomain,
    code: 'unregistered-channel' | 'acl-denied',
  ): void {
    const k = `${kind}:${name}`
    this.rejectionCounts.set(k, (this.rejectionCounts.get(k) ?? 0) + 1)
    this.audit({
      at: this.opts.now?.() ?? new Date().toISOString(),
      domain,
      channel: name,
      kind,
      outcome: 'rejected',
      owner: null,
      code,
    })
  }

  /** 真派发口:先查表,未注册即拒(计数 + 审计),绝不"按名字硬发"。 */
  dispatch<T>(
    name: string,
    kind: ChannelKind,
    fn: (spec: ChannelSpec) => T,
    domain: ChannelDomain = 'agent',
  ): T {
    const spec = this.guard(name, kind, domain)
    this.allowedCount += 1
    this.audit({
      at: this.opts.now?.() ?? new Date().toISOString(),
      domain,
      channel: name,
      kind,
      outcome: 'allowed',
      owner: spec.owner,
    })
    return fn(spec)
  }

  /** 按通道名的拒绝次数快照(`kind:name` → 次数;通道名跨域唯一,故不带 domain)。 */
  rejections(): ReadonlyMap<string, number> {
    return new Map(this.rejectionCounts)
  }

  get allowed(): number {
    return this.allowedCount
  }

  auditTrail(): readonly ChannelAuditRecord[] {
    return [...this.records]
  }

  /** L12:按域取审计,方便分别落表。 */
  auditByDomain(domain: ChannelDomain): readonly ChannelAuditRecord[] {
    return this.records.filter((record) => record.domain === domain)
  }

  /** 某域被拒次数(健康检查用)。 */
  rejectedCount(domain: ChannelDomain): number {
    return this.records.filter(
      (record) => record.domain === domain && record.outcome === 'rejected',
    ).length
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
