// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Clawdbot Integrations - 集成服务
 *
 * 第三方 API 管理。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { startStopwatch } from '../../utils/elapsed-ms.js'
import { isPrivateOrReservedIp } from '../../utils/ssrf-guard.js'

/**
 * 内网/元数据主机的**字面**黑名单(与 ssrf-guard 的 IP 判据同源部分复用,不另造 IP 规则)。
 * 主机名形态单独列在这里,因为这一档不解析 DNS(见 call() 头注):`localhost` 与云厂商
 * 常用元数据别名在字面层面就该拒,等解析后再判会晚一步。
 */
const BLOCKED_INTEGRATION_HOSTS = new Set<string>([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
])

/**
 * SDB-19:WHATWG URL 对 http(s) 把 `\` 当 `/`,所以 `/\\attacker.example/x` 会解析成
 * `https://attacker.example/x` —— 字符黑名单(`scheme://`、`//`)拦不住。这里先按一次
 * 百分号解码再判,因为 `/%5Cattacker.example/x` 在 URL 层仍是同源,但任何下游代理/上游
 * 解码后就会变成反斜杠形态;解不开的百分号序列同样判不出 ⇒ fail-closed。
 */
function hasBackslashPath(raw: string): boolean {
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return true
  }
  return decoded.includes('\\')
}

export function isBlockedIntegrationHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase().replace(/\.$/, '')
  if (!h) return true
  if (BLOCKED_INTEGRATION_HOSTS.has(h)) return true
  if (h.endsWith('.local') || h.endsWith('.internal')) return true
  if (isPrivateOrReservedIp(h)) return true
  return false
}

export interface IntegrationConfig {
  id: string
  name: string
  type: string
  baseUrl?: string
  apiKey?: string
  authType?: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth'
  headers?: Record<string, string>
  enabled: boolean
  config: Record<string, unknown>
}

export interface IntegrationRequest {
  integrationId: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  query?: Record<string, string>
  headers?: Record<string, string>
}

export interface IntegrationResponse {
  status: number
  data: unknown
  headers: Record<string, string>
  duration: number
  /** 格②(2026-09-26):false = duration 未通过时钟交叉校验,只可观测不可当结论消费 */
  latencyTrusted?: boolean
}

export class IntegrationManager extends EventEmitter {
  /**
   * 内存集成配置存储。
   *
   * 持久化现状(2026-07-22 评估):
   *   - 无对应 DB 表
   *   - 集成配置含 apiKey 等敏感字段,需加密存储
   *   - 现有 userPreferences 表设计为 userId-scoped 偏好,不适用于系统级集成配置
   *
   * 迁移规格(未来需要时):
   *   1. 新建 `clawdbot_integrations` 表:id / name / type / base_url / api_key_encrypted /
   *      auth_type / headers(jsonb) / enabled / config(jsonb) / created_by / created_at / updated_at
   *   2. api_key_encrypted 用 AES-256-GCM + KMS 包封,禁止明文入库
   *   3. register() 时 upsert 到 DB;unregister() 时软删除(enabled=false)
   *   4. list()/get() 优先读 DB,启动时全量加载到内存缓存
   *   5. 增加 rotate-key 接口定期轮换 apiKey
   */
  private integrations = new Map<string, IntegrationConfig>()

  register(config: IntegrationConfig): void {
    this.integrations.set(config.id, config)
    logger.info({ integration: config.id, type: config.type }, '[Integrations] Registered')
    this.emit('registered', config)
  }

  unregister(id: string): boolean {
    return this.integrations.delete(id)
  }

  get(id: string): IntegrationConfig | undefined {
    return this.integrations.get(id)
  }

  list(): IntegrationConfig[] {
    return Array.from(this.integrations.values())
  }

  listEnabled(): IntegrationConfig[] {
    return this.list().filter((i) => i.enabled)
  }

  async call(request: IntegrationRequest): Promise<IntegrationResponse> {
    const integration = this.integrations.get(request.integrationId)
    if (!integration || !integration.enabled) {
      throw new Error(`Integration "${request.integrationId}" not found or disabled`)
    }

    // 2026-11-01 安全强化(两处缺陷,失效方向不同,所以分两档判):
    //  A. 已登记 baseUrl 时,`new URL(absolutePath, base)` 会**丢掉 base** 直接采用 path 的
    //     host ⇒ 调用方自由挑主机+端口,而 applyAuth 之后该集成的 apiKey/Authorization 会
    //     随请求寄到那台主机(凭据外泄)。正解:path 只许相对片段,主机由登记方决定。
    //  B. 未登记 baseUrl 的"自由 URL"型集成:保留设计意图(否则砍断在用能力),但落点必须
    //     http(s) 且不得指向内网/元数据字面主机。
    //  两条通道都关闭跟随重定向:一次 302 就能把已判定的主机换成内网落点(与 ssrf-guard
    //  逐跳复检同一道理)。这里刻意用**字面判据**而非 ensureSafeFetchUrl —— 后者要真实 DNS,
    //  会把离线构建/无解析器环境整片打挂(现网其余 30+ 出网点仍按该守卫的默认口径走)。
    let url: string
    if (integration.baseUrl) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(request.path) || request.path.startsWith('//')) {
        throw new Error(
          `Integration path 必须是相对片段,不接受绝对 URL(否则会改写已登记的落点主机并带走凭据):${request.path.slice(0, 80)}`,
        )
      }
      if (hasBackslashPath(request.path)) {
        throw new Error(
          `Integration path 不得含反斜杠(含 %5c 编码,URL 解析会把它当 / 并改写主机):${request.path.slice(0, 80)}`,
        )
      }
      url = new URL(request.path, integration.baseUrl).toString()
      // 最终兜底:字符判据只是"早拒",真正不能退让的是解析结果本身与登记主机同源。
      // 反斜杠、编码反斜杠之外的任何解析差异(端口/协议/大小写归一)都在这里一次收口。
      const base = new URL(integration.baseUrl)
      const target = new URL(url)
      if (target.origin !== base.origin) {
        throw new Error(
          `Integration path 解析后指向了已登记主机之外的落点(凭据会随之外带):${target.origin}`,
        )
      }
    } else {
      let parsed: URL
      try {
        parsed = new URL(request.path)
      } catch {
        throw new Error(`未登记 baseUrl 的集成要求 path 为绝对 URL:${request.path.slice(0, 80)}`)
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(`集成仅允许 http(s) 落点,收到 ${parsed.protocol}`)
      }
      if (isBlockedIntegrationHost(parsed.hostname)) {
        throw new Error(`集成落点禁止指向内网/元数据主机:${parsed.hostname}`)
      }
      url = parsed.toString()
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...integration.headers,
      ...request.headers,
    }

    this.applyAuth(headers, integration)

    const sw = startStopwatch()
    const queryString = request.query ? '?' + new URLSearchParams(request.query).toString() : ''
    const response = await fetch(`${url}${queryString}`, {
      method: request.method,
      headers,
      // 不跟随重定向:否则一次 302 就能把上面判定过的落点换成内网/元数据主机
      redirect: 'error',
      body: request.body ? JSON.stringify(request.body) : undefined,
    })

    const data = await response.json().catch(() => null)
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    const sample = sw.stop()
    const result: IntegrationResponse = {
      status: response.status,
      data,
      headers: responseHeaders,
      duration: sample.elapsedMs ?? sample.perfMs,
      latencyTrusted: sample.trustworthy,
    }

    logger.debug(
      { integration: request.integrationId, status: response.status, duration: result.duration },
      '[Integrations] Called',
    )
    this.emit('called', { request, result })
    return result
  }

  private applyAuth(headers: Record<string, string>, integration: IntegrationConfig): void {
    switch (integration.authType) {
      case 'api_key':
        if (integration.apiKey) headers['X-API-Key'] = integration.apiKey
        break
      case 'bearer':
        if (integration.apiKey) headers['Authorization'] = `Bearer ${integration.apiKey}`
        break
      case 'basic':
        if (integration.apiKey)
          headers['Authorization'] = `Basic ${Buffer.from(integration.apiKey).toString('base64')}`
        break
    }
  }

  getStats() {
    return {
      total: this.integrations.size,
      enabled: this.listEnabled().length,
    }
  }
}

let instance: IntegrationManager | null = null

export function getIntegrationManager(): IntegrationManager {
  if (!instance) instance = new IntegrationManager()
  return instance
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
