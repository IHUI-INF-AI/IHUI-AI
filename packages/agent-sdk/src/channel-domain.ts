// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * L12 通道域隔离(2026-11-26)。
 *
 * 坑:agent(工具调用)、ui(界面事件)、remote-session(远端会话)三类通道此前共用
 * 一张名字空间与一套 ACL。后果有两个:一是同名通道在两域各发一份,订阅方收到
 * 不该看的消息;二是某个域的 ACL 放宽(如 remote-session 为远程调用放开)会顺带
 * 放宽同名的 ui 通道。对标豆包 Agent Tool 管道 / Neotix ShellAPI / PIP 三族管道
 * 用途分离,本模块把"分域"做成可测判据。
 *
 * 三条纪律:
 * - **域名前缀绑定**:每个域独占一个通道名前缀,跨域同名登记即拒;
 * - **三独立**:每域独立 ACL(allowedPrincipals)、版本号、健康状态;
 * - **审计分表**:按域各自留审计环,不混在一张表里,检索不会串域。
 *
 * 复用 L05 的 ChannelRegistry/ChannelSpec 类型,不重复造注册表;本模块只加域层。
 * 边界(诚实):桌面 preload、api websocket 真正按域分表落库属宿主接线,本票立判据。
 */

import { ChannelRegistry, type ChannelKind, type ChannelSpec } from './channel-registry.js'

export const CHANNEL_DOMAINS = ['agent', 'ui', 'remote-session'] as const
export type ChannelDomain = (typeof CHANNEL_DOMAINS)[number]

/** 每域独占的通道名前缀;跨域不得复用同一通道名。 */
export const DOMAIN_PREFIXES: Readonly<Record<ChannelDomain, string>> = Object.freeze({
  agent: 'agent.',
  ui: 'ui.',
  'remote-session': 'remote-session.',
})

export interface DomainConfig {
  readonly version: string
  /** 允许调用本域通道的主体集合;空集=无人可用(fail-closed)。 */
  readonly allowedPrincipals: readonly string[]
  /** 域健康状态,默认 true。 */
  readonly healthy?: boolean
}

export interface DomainAuditRecord {
  readonly at: string
  readonly domain: ChannelDomain
  readonly principal: string
  readonly channel: string
  readonly kind: ChannelKind
  readonly outcome: 'allowed' | 'rejected'
  readonly reason: string | null
}

export type DomainRejectReason =
  | 'unknown-domain'
  | 'domain-unhealthy'
  | 'principal-not-allowed'
  | 'wrong-domain-prefix'
  | 'unregistered-channel'

export class DomainRejected extends Error {
  readonly code: DomainRejectReason
  readonly domain: string
  readonly channel: string
  constructor(code: DomainRejectReason, domain: string, channel: string) {
    super(`域通道被拒(${code}): ${domain}:${channel}`)
    this.name = 'DomainRejected'
    this.code = code
    this.domain = domain
    this.channel = channel
  }
}

interface DomainState {
  readonly version: string
  readonly principals: Set<string>
  healthy: boolean
  readonly registry: ChannelRegistry
  readonly audit: DomainAuditRecord[]
  rejections: number
}

const AUDIT_CAP = 200

export class DomainChannelRouter {
  private readonly domains = new Map<ChannelDomain, DomainState>()
  /** 全局通道名 → 所属域,防跨域复用。 */
  private readonly nameOwner = new Map<string, ChannelDomain>()
  private readonly now: () => string

  constructor(now: () => string = () => new Date().toISOString()) {
    this.now = now
  }

  defineDomain(domain: ChannelDomain, config: DomainConfig): void {
    if (!(CHANNEL_DOMAINS as readonly string[]).includes(domain)) {
      throw new DomainRejected('unknown-domain', String(domain), '')
    }
    if (!config.version.trim()) throw new Error(`域 ${domain} 版本号为空`)
    this.domains.set(domain, {
      version: config.version.trim(),
      principals: new Set(config.allowedPrincipals),
      healthy: config.healthy !== false,
      registry: new ChannelRegistry(),
      audit: [],
      rejections: 0,
    })
  }

  /** 在域内登记通道;名字必须带本域前缀且全局未被他域占用。 */
  register(domain: ChannelDomain, spec: ChannelSpec): void {
    const state = this.requireDomain(domain)
    const prefix = DOMAIN_PREFIXES[domain]
    if (!spec.name.startsWith(prefix)) {
      throw new DomainRejected('wrong-domain-prefix', domain, spec.name)
    }
    const owner = this.nameOwner.get(spec.name)
    if (owner && owner !== domain) {
      throw new DomainRejected('wrong-domain-prefix', domain, spec.name)
    }
    state.registry.register(spec)
    this.nameOwner.set(spec.name, domain)
  }

  /** 真派发口:域健康 + 主体在 ACL + 通道在本域注册表,三者全过才发。 */
  dispatch<T>(
    domain: ChannelDomain,
    principal: string,
    name: string,
    kind: ChannelKind,
    fn: (spec: ChannelSpec) => T,
  ): T {
    const state = this.domains.get(domain)
    if (!state) throw this.reject(null, domain, principal, name, kind, 'unknown-domain')
    if (!state.healthy) throw this.reject(state, domain, principal, name, kind, 'domain-unhealthy')
    if (!state.principals.has(principal)) {
      throw this.reject(state, domain, principal, name, kind, 'principal-not-allowed')
    }
    if (!name.startsWith(DOMAIN_PREFIXES[domain])) {
      throw this.reject(state, domain, principal, name, kind, 'wrong-domain-prefix')
    }
    const spec = state.registry.resolve(name, kind)
    if (!spec) {
      throw this.reject(state, domain, principal, name, kind, 'unregistered-channel')
    }
    this.record(state, domain, principal, name, kind, 'allowed', null)
    return fn(spec)
  }

  private reject(
    state: DomainState | null,
    domain: ChannelDomain,
    principal: string,
    name: string,
    kind: ChannelKind,
    reason: DomainRejectReason,
  ): DomainRejected {
    if (state) {
      state.rejections += 1
      this.record(state, domain, principal, name, kind, 'rejected', reason)
    }
    return new DomainRejected(reason, domain, name)
  }

  private record(
    state: DomainState,
    domain: ChannelDomain,
    principal: string,
    name: string,
    kind: ChannelKind,
    outcome: 'allowed' | 'rejected',
    reason: string | null,
  ): void {
    state.audit.push({
      at: this.now(),
      domain,
      principal,
      channel: name,
      kind,
      outcome,
      reason,
    })
    while (state.audit.length > AUDIT_CAP) state.audit.shift()
  }

  private requireDomain(domain: ChannelDomain): DomainState {
    const state = this.domains.get(domain)
    if (!state) throw new DomainRejected('unknown-domain', String(domain), '')
    return state
  }

  setHealthy(domain: ChannelDomain, healthy: boolean): void {
    this.requireDomain(domain).healthy = healthy
  }

  version(domain: ChannelDomain): string {
    return this.requireDomain(domain).version
  }

  rejections(domain: ChannelDomain): number {
    return this.requireDomain(domain).rejections
  }

  /** 审计按域分表:只返回该域记录,不串域。 */
  auditFor(domain: ChannelDomain): readonly DomainAuditRecord[] {
    return [...this.requireDomain(domain).audit]
  }
}
