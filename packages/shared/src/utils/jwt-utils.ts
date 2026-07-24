interface JWTPayload {
  exp?: number
  iat?: number
}

/**
 * base64url → UTF-8 字符串。
 * 仅使用 Web API（atob / TextDecoder），兼容 Edge / browser / extension / miniapp 运行时，不依赖 Node Buffer。
 */
export function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = s + '='.repeat((4 - (s.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * 从 JWT 中读取 exp 字段（Unix 秒）。
 * 返回 null 表示 token 格式无效或 payload 无法解析。
 */
export function readExp(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const payloadPart = parts[1]
  if (!payloadPart) return null
  try {
    const decoded = JSON.parse(base64UrlDecode(payloadPart)) as JWTPayload
    return typeof decoded.exp === 'number' ? decoded.exp : null
  } catch {
    return null
  }
}
