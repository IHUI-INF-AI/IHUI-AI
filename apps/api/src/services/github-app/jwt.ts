// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GitHub App 身份凭据:RS256 JWT 生成 + installation token 换取(D15 / G-20)。
 *
 * 链路:私钥签出 App JWT(≤10 分钟) → `POST /app/installations/{id}/access_tokens`
 *       → 得到按安装维度的短时 token,后续对仓库的读写都带它。
 *
 * 可测性硬约束(AGENTS §5 + 本票约束 5):**所有** GitHub API 调用都经注入的
 * `GithubTransport`,模块自身不发起网络请求;测试注入假 transport 即可零网络。
 */
import { createPrivateKey } from 'node:crypto'
import { SignJWT, decodeJwt, importPKCS8 } from 'jose'
import { z } from 'zod'

/** GitHub REST 根地址(可注入覆盖,便于自托管 GitHub Enterprise) */
export const GITHUB_API_BASE = 'https://api.github.com'
export const GITHUB_API_USER_AGENT = 'IHUI-AI-GitHubApp/1.0'

/** App JWT 生命周期:GitHub 允许的最长值(600 秒) */
export const APP_JWT_LIFETIME_SECONDS = 570
/** installation token 距过期不足该秒数时提前换新(留出请求往返余量) */
export const TOKEN_REFRESH_SKEW_SECONDS = 300

// ---------------------------------------------------------------------------
// 注入式 transport
// ---------------------------------------------------------------------------

export type GithubHttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface GithubApiRequest {
  method: GithubHttpMethod
  /** 以 `/` 开头的路径,如 `/repos/owner/repo/pulls/1/files` */
  path: string
  headers: Record<string, string>
  body?: unknown
}

export interface GithubApiResponse {
  status: number
  /** 已解析的 JSON;非 JSON / 空体统一为 null */
  body: unknown
}

export type GithubTransport = (request: GithubApiRequest) => Promise<GithubApiResponse>

export interface GithubTransportOptions {
  baseUrl?: string
  fetchImpl?: typeof globalThis.fetch
  userAgent?: string
  timeoutMs?: number
}

/** 解析响应体:GitHub 对 204 / 代理错误页会给出非 JSON,统一降级为 null 而不是抛 */
async function readJsonBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

/**
 * 默认 transport:基于 fetch 的实现。
 * 只有运行期需要真调用 GitHub 时才被使用;测试一律注入自己的假实现。
 */
export function createGithubTransport(options: GithubTransportOptions = {}): GithubTransport {
  const baseUrl = (options.baseUrl ?? GITHUB_API_BASE).replace(/\/$/, '')
  const userAgent = options.userAgent ?? GITHUB_API_USER_AGENT
  const timeoutMs = options.timeoutMs ?? 15_000

  return async (request) => {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': userAgent,
      'X-GitHub-Api-Version': '2022-11-28',
      ...request.headers,
    }
    const init: RequestInit = { method: request.method, headers }
    if (request.body !== undefined) {
      init.headers = { ...headers, 'Content-Type': 'application/json' }
      init.body = JSON.stringify(request.body)
    }
    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      init.signal = AbortSignal.timeout(timeoutMs)
    }
    const response = await fetchImpl(`${baseUrl}${request.path}`, init)
    return { status: response.status, body: await readJsonBody(response) }
  }
}

// ---------------------------------------------------------------------------
// 错误类型
// ---------------------------------------------------------------------------

export type GithubApiFailure =
  | 'app_credentials_not_configured'
  | 'installation_token_rejected'
  | 'invalid_private_key'
  | 'malformed_token_response'

/**
 * GitHub App 身份链路的错误。
 *
 * 注意:message **只**携带状态码与固定文案,绝不拼接上游响应体 ——
 * 上游 body 会进 error message,而 packages/auth 的 response-sanitizer 只覆盖 2xx,
 * 非 2xx 的 body 直接外泄即构成凭据泄露面(AGENTS 守门 67 同族)。
 */
export class GithubAppError extends Error {
  readonly failure: GithubApiFailure
  readonly status: number | null

  constructor(failure: GithubApiFailure, message: string, status: number | null = null) {
    super(message)
    this.name = 'GithubAppError'
    this.failure = failure
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// 私钥归一 + App JWT
// ---------------------------------------------------------------------------

const ENV_KEY_NEWLINE_PATTERN = /\\n/g

/**
 * 把环境里的私钥还原成可解析 PEM。
 *
 * `.env` 无法直接写多行,GitHub 下载的私钥落到 env 后通常是字面量 `\n`,
 * 不还原的话 `createPrivateKey` 必失败,表现为"配了密钥仍报未配置"的静默降级。
 */
export function normalizePrivateKeyPem(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.includes('\n')) return trimmed
  return trimmed.replace(ENV_KEY_NEWLINE_PATTERN, '\n')
}

/**
 * 私钥统一成 PKCS#8 PEM。
 * GitHub App 控制台下载的是 PKCS#1(`BEGIN RSA PRIVATE KEY`),
 * WebCrypto 的 importPKCS8 只吃 PKCS#8,故先经 node:crypto 转一次。
 */
function toPkcs8Pem(pem: string): string {
  try {
    const key = createPrivateKey({ key: pem, format: 'pem' })
    return String(key.export({ type: 'pkcs8', format: 'pem' }))
  } catch {
    throw new GithubAppError(
      'invalid_private_key',
      'GitHub App 私钥无法解析(需 PKCS#1 或 PKCS#8 PEM)',
    )
  }
}

export interface GithubAppIdentity {
  /** GitHub App 的数值 ID(作为 JWT 的 iss) */
  appId: string
  privateKeyPem: string
}

export interface AppJwtOptions {
  lifetimeSeconds?: number
  /** 注入时钟,便于测试固定 iat/exp */
  now?: Date
}

/** 生成 App 身份 JWT(alg=RS256,iss=appId,exp-iat ≤ 600s) */
export async function createAppJwt(
  identity: GithubAppIdentity,
  options: AppJwtOptions = {},
): Promise<string> {
  const appId = identity.appId.trim()
  const privateKeyPem = normalizePrivateKeyPem(identity.privateKeyPem)
  if (!appId || !privateKeyPem) {
    throw new GithubAppError(
      'app_credentials_not_configured',
      'GitHub App 凭据未配置(GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY)',
    )
  }
  const lifetime = Math.min(Math.max(options.lifetimeSeconds ?? APP_JWT_LIFETIME_SECONDS, 1), 600)
  const issuedAt = Math.floor((options.now ?? new Date()).getTime() / 1000)
  const key = await importPKCS8(toPkcs8Pem(privateKeyPem), 'RS256')

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(appId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + lifetime)
    .sign(key)
}

// ---------------------------------------------------------------------------
// installation token
// ---------------------------------------------------------------------------

const tokenExchangeResponseSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
})

export interface InstallationToken {
  token: string
  /** Unix 秒 */
  expiresAt: number
  installationId: number
}

export interface ExchangeInstallationTokenInput extends GithubAppIdentity {
  installationId: number
  transport: GithubTransport
  /** 收窄权限集;不传则沿用 App 已申请的权限 */
  permissions?: Record<string, 'read' | 'write' | 'admin'>
  now?: Date
}

/**
 * 用 App JWT 换取某个 installation 的短期 token。
 * 非 2xx 一律抛 GithubAppError(不回显上游响应体)。
 */
export async function exchangeInstallationToken(
  input: ExchangeInstallationTokenInput,
): Promise<InstallationToken> {
  const jwt = await createAppJwt(
    { appId: input.appId, privateKeyPem: input.privateKeyPem },
    { now: input.now },
  )

  const response = await input.transport({
    method: 'POST',
    path: `/app/installations/${input.installationId}/access_tokens`,
    headers: { Authorization: `Bearer ${jwt}` },
    body: input.permissions === undefined ? undefined : { permissions: input.permissions },
  })

  if (response.status < 200 || response.status >= 300) {
    throw new GithubAppError(
      'installation_token_rejected',
      `换取 installation token 被拒(status=${response.status})`,
      response.status,
    )
  }

  const parsed = tokenExchangeResponseSchema.safeParse(response.body)
  if (!parsed.success) {
    throw new GithubAppError('malformed_token_response', 'installation token 响应缺少字段')
  }
  const expiresAt = Math.floor(Date.parse(parsed.data.expires_at) / 1000)
  if (!Number.isFinite(expiresAt)) {
    throw new GithubAppError('malformed_token_response', 'installation token 过期时间无法解析')
  }

  return { token: parsed.data.token, expiresAt, installationId: input.installationId }
}

export interface InstallationTokenProvider {
  /** 命中缓存则直接返回,否则换新 token */
  get(installationId: number): Promise<InstallationToken>
  /** 只读取当前缓存(测试 / 诊断用) */
  peek(installationId: number): InstallationToken | null
  invalidate(installationId?: number): void
}

/**
 * 带内存缓存的 token 提供器。
 *
 * 缓存理由:一次 PR review 至少 3 个 GitHub 调用,而 App JWT 每次都要做一次 RSA 签名;
 * installation token 有效期 1 小时,按剩余 <300s 提前换新即可覆盖边界。
 * 已知边界:多实例各持一份缓存(不共享),代价是每实例多换一次 token,无正确性影响。
 */
export function createInstallationTokenProvider(
  identity: GithubAppIdentity,
  transport: GithubTransport,
): InstallationTokenProvider {
  const cache = new Map<number, InstallationToken>()

  return {
    async get(installationId: number): Promise<InstallationToken> {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const cached = cache.get(installationId)
      if (cached && cached.expiresAt - nowSeconds > TOKEN_REFRESH_SKEW_SECONDS) {
        return cached
      }
      const next = await exchangeInstallationToken({ ...identity, installationId, transport })
      cache.set(installationId, next)
      return next
    },
    peek(installationId: number): InstallationToken | null {
      return cache.get(installationId) ?? null
    },
    invalidate(installationId?: number): void {
      if (installationId === undefined) cache.clear()
      else cache.delete(installationId)
    },
  }
}

// ---------------------------------------------------------------------------
// env 读取(显式列举键名,不做模式匹配)
// ---------------------------------------------------------------------------

export const GITHUB_APP_ID_ENV_KEY = 'GITHUB_APP_ID'
export const GITHUB_APP_PRIVATE_KEY_ENV_KEY = 'GITHUB_APP_PRIVATE_KEY'

export interface GithubAppEnvConfig {
  appId: string | null
  privateKeyPem: string | null
  /** 两项齐备才算 configured;缺任一 ⇒ 调用方必须跳过而不是硬撑 */
  configured: boolean
}

export function readGithubAppEnv(env: NodeJS.ProcessEnv = process.env): GithubAppEnvConfig {
  const appId = env[GITHUB_APP_ID_ENV_KEY]?.trim() || null
  const rawKey = env[GITHUB_APP_PRIVATE_KEY_ENV_KEY]
  const privateKeyPem = rawKey ? normalizePrivateKeyPem(rawKey) : null
  return {
    appId,
    privateKeyPem: privateKeyPem || null,
    configured: Boolean(appId && privateKeyPem),
  }
}

/** 从 env 组装身份;未配置返回 null(调用方按 fail-closed 跳过并给出原因) */
export function readGithubAppIdentity(
  env: NodeJS.ProcessEnv = process.env,
): GithubAppIdentity | null {
  const { appId, privateKeyPem, configured } = readGithubAppEnv(env)
  if (!configured || !appId || !privateKeyPem) return null
  return { appId, privateKeyPem }
}

/** 供测试 / 诊断:解出 JWT 声明(不验签,只看 iss/exp/iat) */
export function decodeAppJwt(token: string): {
  iss: string | null
  iat: number | null
  exp: number | null
} {
  const payload = decodeJwt(token)
  return {
    iss: typeof payload['iss'] === 'string' ? payload['iss'] : null,
    iat: typeof payload['iat'] === 'number' ? payload['iat'] : null,
    exp: typeof payload['exp'] === 'number' ? payload['exp'] : null,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
