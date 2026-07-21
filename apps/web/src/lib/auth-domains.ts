/**
 * 分域 SSO 域配置 helper (2026-07-21 立)
 *
 * 架构:
 * - 主域 aizhs.top → 完整应用
 * - 认证子域 bsm.aizhs.top → 只承载登录/OAuth 回调,其余路径 middleware 307 跳回主域
 * - Cookie 域 .aizhs.top → 主域与认证子域共享登录态
 *
 * 跨域 OAuth 流程:
 * 1. 主域用户点 DingTalk → 302 到 bsm.aizhs.top/sso/auth?platform=dingtalk
 * 2. bsm.aizhs.top 薄页自动调用 startLogin → 跳到钉钉授权页(redirect_uri = bsm.aizhs.top/callback)
 * 3. 钉钉回调到 bsm.aizhs.top/callback?code=xxx → 写跨域 Cookie + 307 跳回主域
 * 4. 主域 useAuthBootstrap 读 Cookie → /auth/profile → 自动登录
 *
 * ⚠️ 客户端可见 env(必须 NEXT_PUBLIC_ 前缀),由 Next.js 编译期内联到 chunk。
 */

const ENV_AUTH_SUBDOMAIN = process.env.NEXT_PUBLIC_AUTH_SUBDOMAIN
const ENV_MAIN_DOMAIN = process.env.NEXT_PUBLIC_MAIN_DOMAIN

/**
 * 解析域字符串,返回 origin(协议 + host,不带路径)
 * 兼容用户填 `https://bsm.aizhs.top` 或只填 `bsm.aizhs.top`
 */
function toOrigin(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const trimmed = value.trim().replace(/\/+$/, '')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

/** 认证子域 origin(默认 https://bsm.aizhs.top) */
export function getAuthSubdomainOrigin(): string {
  return toOrigin(ENV_AUTH_SUBDOMAIN, 'https://bsm.aizhs.top')
}

/** 主域 origin(默认 https://aizhs.top) */
export function getMainDomainOrigin(): string {
  return toOrigin(ENV_MAIN_DOMAIN, 'https://aizhs.top')
}

/** 当前浏览器 host(无协议无端口),SSR 时返回空串 */
export function getCurrentHost(): string {
  if (typeof window === 'undefined') return ''
  return window.location.hostname.toLowerCase()
}

/** 解析 host 是否指向认证子域(bsm.aizhs.top / bsm.localhost 等) */
export function isAuthSubdomainHost(host: string = getCurrentHost()): boolean {
  if (!host) return false
  const authHost = extractHost(getAuthSubdomainOrigin())
  if (authHost && host === authHost) return true
  // 兼容 bsm.<mainDomain> 形式
  const mainHost = extractHost(getMainDomainOrigin())
  if (mainHost && host === `bsm.${mainHost}`) return true
  return false
}

/** 解析 host 是否指向主域(aizhs.top / www.aizhs.top) */
export function isMainDomainHost(host: string = getCurrentHost()): boolean {
  if (!host) return false
  const mainHost = extractHost(getMainDomainOrigin())
  if (!mainHost) return false
  if (host === mainHost || host === `www.${mainHost}`) return true
  return false
}

/** 从 origin 字符串中取 host(失败返回空串) */
function extractHost(origin: string): string {
  try {
    return new URL(origin).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * 构造认证子域上的 OAuth 启动 URL
 * @param platform 平台标识
 * @param returnTo 登录成功后的回跳地址(主域上的页面)
 */
export function buildAuthSubdomainStartUrl(platform: string, returnTo?: string): string {
  const url = new URL('/sso/auth', getAuthSubdomainOrigin())
  url.searchParams.set('platform', platform)
  if (returnTo) url.searchParams.set('return_to', returnTo)
  return url.toString()
}

/**
 * 构造主域回跳 URL(默认根路径)
 * @param path 主域上的相对路径或绝对 URL
 */
export function buildMainDomainUrl(path: string = '/'): string {
  // 已经是绝对 URL,直接返回
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${getMainDomainOrigin()}${normalized}`
}
