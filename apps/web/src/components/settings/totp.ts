/**
 * 极简 TOTP（RFC 6238）实现，使用 Web Crypto API 的 HMAC-SHA1。
 * 仅用于前端演示/本地校验，真正的 2FA 验证应由后端完成。
 */

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '').toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = BASE32_CHARS.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** 生成 6 位 TOTP 验证码（默认 30s 步长）。 */
export async function generateTotp(secret: string, period = 30, digits = 6): Promise<string> {
  const key = base32Decode(secret)
  const counter = Math.floor(Date.now() / 1000 / period)
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 0x100000000))
  view.setUint32(4, counter >>> 0)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, buf))

  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f
  const code =
    ((((hmac[offset] ?? 0) & 0x7f) << 24) |
      ((hmac[offset + 1] ?? 0) << 16) |
      ((hmac[offset + 2] ?? 0) << 8) |
      (hmac[offset + 3] ?? 0)) %
    10 ** digits
  return code.toString().padStart(digits, '0')
}
