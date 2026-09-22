// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSO 共享核心(纯逻辑,零平台依赖)
 *
 * 仅依赖 fetch + URL(RN/taro/web 均有 polyfill),不 import expo/@tarojs/window。
 * 各端薄封装注入 apiBase / clientId,平台独占逻辑留在各端。
 */

export interface SsoUser {
  id: string
  phone: string
  email: string
  nickname: string
  avatar: string
  roleId: number
  status: number
}

export interface SsoTokenData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  user: SsoUser
}

export interface SsoValidateResponse {
  valid: boolean
  user: SsoUser
}

export const SSO_ENDPOINTS = {
  code: '/api/auth/sso/code',
  exchange: '/api/auth/sso/exchange',
  logout: '/api/auth/sso/logout',
  validate: '/api/auth/sso/validate',
} as const

/** 用 code 换 token(apiBase 为完整 API 基础地址,不含 /api/auth/sso 路径段) */
export async function exchangeSsoCode(
  apiBase: string,
  code: string,
  clientId: string,
): Promise<SsoTokenData | null> {
  try {
    const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.exchange}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, clientId }),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { code: number; data: SsoTokenData }
    // API 统一响应格式 success() = { code: 0, message, data }
    // 2026-08-01 修复:原 code !== 200 永远返回 null,导致 SSO 端到端失效
    if (data.code !== 0 || !data.data) return null
    return data.data
  } catch {
    return null
  }
}

/** 校验 token */
export async function validateToken(
  apiBase: string,
  token: string,
): Promise<SsoValidateResponse | null> {
  try {
    const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.validate}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { code: number; data: SsoValidateResponse }
    // 2026-08-01 修复:原 code !== 200 永远返回 null
    if (data.code !== 0 || !data.data) return null
    return data.data
  } catch {
    return null
  }
}

/** 登出 */
export async function ssoLogout(apiBase: string, token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.logout}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return resp.ok
  } catch {
    return false
  }
}

/** 从 URL 提取 sso_code(RN deep link / web query 共用) */
export function extractSsoCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('sso_code')
  } catch {
    return null
  }
}

/** 构建 SSO 登录中心 URL(RN/taro 共用) */
export function buildSsoLoginUrl(webBase: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    redirect: redirectUri,
    client_id: clientId,
  })
  return `${webBase}/sso/login?${params.toString()}`
}

/**
 * 把一次性 sso_code 附加到 redirectUri 上,生成 SSO 回调 URL。
 *
 * 2026-09-22 立(修复 SSO 授权死循环留下的脏参数膨胀):
 * 登录守卫(web 端 proxy.ts / 生产 nginx)把未通过校验的访问 307 打回
 * `/sso/login?redirect=<原目标>` 时,原目标可能已经带过 sso_code;各调用点原先
 * 手写 `${redirectUri}?sso_code=` 再拼一次 → `?sso_code=A&sso_code=B&sso_code=C`
 * (桌面端 WebView2 历史记录实测递归到 4 层,并把 redirect 参数本身拼坏)。
 * 本函数先剥离已有 sso_code 再附加,保证重入幂等。
 *
 * 支持三种形态:相对路径(`/edu/x?y=1`)、绝对 URL(`https://sub/a?b=1`)、
 * 自定义协议深链(`ihui://sso`)。解析异常时退回最小拼接,不因解析失败丢掉 code。
 */
export function buildSsoRedirectUrl(redirectUri: string, ssoCode: string): string {
  if (!redirectUri) return redirectUri
  // 相对路径需借占位 origin 交给 URL 解析,解析后必须还原为相对形态(不能带 origin)
  const isRelative = redirectUri.startsWith('/') && !redirectUri.startsWith('//')
  try {
    const parsed = new URL(redirectUri, isRelative ? 'https://sso.invalid' : undefined)
    parsed.searchParams.delete('sso_code')
    parsed.searchParams.append('sso_code', ssoCode)
    return isRelative ? `${parsed.pathname}${parsed.search}${parsed.hash}` : parsed.toString()
  } catch {
    const separator = redirectUri.includes('?') ? '&' : '?'
    return `${redirectUri}${separator}sso_code=${encodeURIComponent(ssoCode)}`
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
