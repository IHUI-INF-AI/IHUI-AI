/**
 * AI 厂商鉴权策略（R4 重构产物）。
 *
 * 背景：原 ai-vendors.ts 中不同厂商的鉴权方式散落在独立函数中
 * （buildTencentHeaders / volcengineSign / authHeader 闭包），难以测试和扩展。
 *
 * 设计：通过统一的 AuthStrategy 接口封装鉴权逻辑，新增厂商只需实现该接口
 * 并通过 AuthStrategyFactory 注册，无需修改 routes 路由文件。
 *
 * 鉴权类型（与 ai_vendor_configs.authType 字段对应）：
 * - bearer         大多数厂商（Dashscope/Doubao/Suno/Sora2/Coze/Bailian/N8N）
 * - tencent_tc3    腾讯云 TC3-HMAC-SHA256 签名（Tencent 混元 / ARC）
 * - volcengine_v4  火山引擎 HMAC-SHA256 V4 签名（即梦 / 字节豆包企业版）
 *
 * Gemini/即梦/腾讯：使用 API Key 注入到自定义 header，不需要复杂签名，
 * 仍归类为 bearer 策略，buildHeaders 直接返回对应的 header 即可。
 */
import { createHmac, createHash } from 'node:crypto'

export interface VendorCredentials {
  key?: string
  secret?: string
}

export interface AuthRequestContext {
  method: string
  url: string
  body?: unknown
  queryParams?: Record<string, string>
  /** 厂商级配置覆盖（来自 ai_vendor_configs.configJson） */
  config?: Record<string, unknown>
}

/** 简单 header 鉴权返回 */
export interface SimpleAuthResult {
  url?: string
  headers: Record<string, string>
  body?: string
}

/**
 * 鉴权策略接口。
 * - buildHeaders: 根据凭据和请求上下文生成鉴权所需 header（部分签名策略会同时改写 url/body）
 * - validateCredentials: 验证凭据是否完整（缺凭据时由 caller service 返回 503）
 */
export interface AuthStrategy {
  readonly authType: string
  buildHeaders(credentials: VendorCredentials, ctx: AuthRequestContext): SimpleAuthResult
  validateCredentials(credentials: VendorCredentials): boolean
}

/**
 * Bearer Token 鉴权策略。
 * 适用于：Dashscope / Doubao / Suno / Sora2 / Coze / Bailian / N8N
 * 特殊变体（Gemini 用 x-goog-api-key header）由 buildHeaders 通过 ctx.config 区分。
 */
export class BearerAuthStrategy implements AuthStrategy {
  readonly authType = 'bearer'

  buildHeaders(credentials: VendorCredentials, ctx: AuthRequestContext): SimpleAuthResult {
    if (!credentials.key) {
      throw new Error('API Key is required for Bearer authentication')
    }
    // Gemini 使用 x-goog-api-key 而非 Authorization
    if (ctx.config?.headerName === 'x-goog-api-key') {
      return { headers: { 'x-goog-api-key': credentials.key } }
    }
    // N8N 使用 X-N8N-API-KEY
    if (ctx.config?.headerName === 'X-N8N-API-KEY') {
      return { headers: { 'X-N8N-API-KEY': credentials.key } }
    }
    return { headers: { Authorization: `Bearer ${credentials.key}` } }
  }

  validateCredentials(credentials: VendorCredentials): boolean {
    return !!credentials.key
  }
}

/**
 * 腾讯云 TC3-HMAC-SHA256 签名策略。
 * 适用于：Tencent（混元 / ARC）。
 *
 * 算法参考：https://cloud.tencent.com/document/api/1729/101843
 */
export class TencentTc3AuthStrategy implements AuthStrategy {
  readonly authType = 'tencent_tc3'

  buildHeaders(credentials: VendorCredentials, ctx: AuthRequestContext): SimpleAuthResult {
    if (!credentials.key || !credentials.secret) {
      throw new Error('Secret ID and Secret Key are required for Tencent authentication')
    }
    const service = (ctx.config?.service as string) ?? 'ai3d'
    const host = (ctx.config?.host as string) ?? 'ai3d.tencentcloudapi.com'
    const version = (ctx.config?.version as string) ?? '2025-05-13'
    const region = (ctx.config?.region as string) ?? 'ap-guangzhou'
    const action = this.extractAction(ctx)

    const payloadStr = typeof ctx.body === 'string' ? ctx.body : JSON.stringify(ctx.body ?? {})
    const algorithm = 'TC3-HMAC-SHA256'
    const timestamp = Math.floor(Date.now() / 1000)
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
    const contentType = 'application/json; charset=utf-8'

    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
    const signedHeaders = 'content-type;host;x-tc-action'
    const hashedPayload = createHash('sha256').update(payloadStr).digest('hex')
    const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`
    const credentialScope = `${date}/${service}/tc3_request`
    const hashedRequest = createHash('sha256').update(canonicalRequest).digest('hex')
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedRequest}`
    const secretDate = createHmac('sha256', `TC3${credentials.secret}`).update(date).digest()
    const secretService = createHmac('sha256', secretDate).update(service).digest()
    const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest()
    const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
    const authorization = `${algorithm} Credential=${credentials.key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    return {
      headers: {
        'Content-Type': contentType,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': region,
        Authorization: authorization,
      },
      body: payloadStr,
    }
  }

  validateCredentials(credentials: VendorCredentials): boolean {
    return !!(credentials.key && credentials.secret)
  }

  private extractAction(ctx: AuthRequestContext): string {
    // 优先使用 ctx.config.action 显式指定
    if (typeof ctx.config?.action === 'string') return ctx.config.action
    // 否则从 URL 末段推断（例如 /ai3d -> AI3D）
    const match = ctx.url.match(/\/([a-z0-9_-]+)$/i)
    return match?.[1] ? match[1].toUpperCase() : 'DEFAULT'
  }
}

/**
 * 火山引擎 HMAC-SHA256 V4 签名策略。
 * 适用于：Volcengine（即梦 / 字节豆包企业版 / Jimeng4 异步轮询）。
 *
 * 算法参考：https://www.volcengine.com/docs/6369/68677
 * 与 TC3 不同：V4 使用 signed_headers 列表排序 + 独立 region + 独立 service。
 */
export class VolcengineV4AuthStrategy implements AuthStrategy {
  readonly authType = 'volcengine_v4'

  buildHeaders(credentials: VendorCredentials, ctx: AuthRequestContext): SimpleAuthResult {
    if (!credentials.key || !credentials.secret) {
      throw new Error('Access Key and Secret Key are required for Volcengine authentication')
    }
    const host = (ctx.config?.host as string) ?? 'visual.volcengineapi.com'
    const region = (ctx.config?.region as string) ?? 'cn-north-1'
    const service = (ctx.config?.service as string) ?? 'cv'

    const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
    const datestamp = ts.slice(0, 8)
    const payloadStr = JSON.stringify(ctx.body ?? {})
    const payloadHash = createHash('sha256').update(payloadStr).digest('hex')
    const queryParams = ctx.queryParams ?? {}
    const canonicalQs = Object.keys(queryParams)
      .sort()
      .map((k) => `${k}=${queryParams[k]}`)
      .join('&')
    const signedHeaders = 'content-type;host;x-content-sha256;x-date'
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${payloadHash}\nx-date:${ts}\n`
    const canonicalRequest = `POST\n/\n${canonicalQs}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
    const algorithm = 'HMAC-SHA256'
    const credentialScope = `${datestamp}/${region}/${service}/request`
    const stringToSign =
      `${algorithm}\n${ts}\n${credentialScope}\n` +
      createHash('sha256').update(canonicalRequest).digest('hex')
    const kDate = createHmac('sha256', credentials.secret).update(datestamp).digest()
    const kRegion = createHmac('sha256', kDate).update(region).digest()
    const kService = createHmac('sha256', kRegion).update(service).digest()
    const kSigning = createHmac('sha256', kService).update('request').digest()
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')
    const authorization = `${algorithm} Credential=${credentials.key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

    return {
      url: `https://${host}${canonicalQs ? '?' + canonicalQs : ''}`,
      headers: {
        'X-Date': ts,
        Authorization: authorization,
        'X-Content-Sha256': payloadHash,
        'Content-Type': 'application/json',
      },
      body: payloadStr,
    }
  }

  validateCredentials(credentials: VendorCredentials): boolean {
    return !!(credentials.key && credentials.secret)
  }
}

/**
 * 鉴权策略工厂。
 * 提供策略注册与查询能力，新增厂商时只需 registerStrategy(authType, instance) 即可。
 */
export class AuthStrategyFactory {
  private readonly strategies = new Map<string, AuthStrategy>()

  constructor() {
    this.registerStrategy(new BearerAuthStrategy())
    this.registerStrategy(new TencentTc3AuthStrategy())
    this.registerStrategy(new VolcengineV4AuthStrategy())
  }

  registerStrategy(strategy: AuthStrategy): void {
    this.strategies.set(strategy.authType, strategy)
  }

  getStrategy(authType: string): AuthStrategy {
    const strategy = this.strategies.get(authType)
    if (!strategy) {
      throw new Error(`Unsupported auth type: ${authType}`)
    }
    return strategy
  }

  hasStrategy(authType: string): boolean {
    return this.strategies.has(authType)
  }
}

export const authStrategyFactory = new AuthStrategyFactory()
