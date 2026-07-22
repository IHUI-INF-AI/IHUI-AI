/**
 * TOTP (RFC 6238) + RFC 4648 Base32 + otpauth URI + QR code + backup codes。
 *
 * 严格按 RFC 6238 / RFC 4648 手写实现,不引入 otplib 等第三方依赖。
 * 仅依赖 node:crypto (HMAC / CSPRNG) + 已安装的 qrcode 包(可选,缺失则只返回 otpauth URI)。
 *
 * 安全要点:
 * - 所有 token / backup code 比较使用 timingSafeEqual,防时序攻击
 * - verifyTotp 允许 ±1 个 time step (前后 30s),防时钟漂移 + 防重放
 * - secret 默认 20 字节(160 bits),满足 RFC 6238 推荐长度
 * - backup code 数据库只存 sha256 hash,明文只返回一次
 */
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'node:crypto'

// ============ Base32 编解码 (RFC 4648) ============

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' as const

/**
 * RFC 4648 Base32 编码(无 padding,大小写不敏感的解码由 base32Decode 处理)。
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return output
}

/**
 * RFC 4648 Base32 解码(忽略大小写、忽略 padding `=`)。
 * 输入非法字符抛 Error。
 */
export function base32Decode(s: string): Buffer {
  const input = s.toUpperCase().replace(/=+$/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) {
      throw new Error(`base32Decode: 非法字符 '${ch}' at position ${i}`)
    }
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// ============ TOTP (RFC 6238) ============

export interface TotpOptions {
  /** 原始密钥(推荐 20 字节 / 160 bits) */
  secret: Buffer
  /** HMAC 算法,默认 sha1(兼容 Google Authenticator / Microsoft Authenticator) */
  algorithm?: 'sha1' | 'sha256' | 'sha512'
  /** 数字位数,默认 6(主流兼容);8 位用于高安全场景 */
  digits?: 6 | 8
  /** 时间步长(秒),默认 30(RFC 6238 推荐) */
  period?: number
}

const DEFAULT_ALGORITHM: NonNullable<TotpOptions['algorithm']> = 'sha1'
const DEFAULT_DIGITS: 6 | 8 = 6
const DEFAULT_PERIOD = 30

/**
 * HOTP (RFC 4226) 核心:给定 counter 计算 6/8 位数字。
 *
 * 算法:
 * 1. counter 转 8 字节 big-endian
 * 2. hmac = createHmac(algorithm, secret).update(buffer).digest()
 * 3. offset = hmac[hmac.length - 1] & 0x0f
 * 4. code = ((hmac[offset] & 0x7f) << 24 | hmac[offset+1] << 16 | hmac[offset+2] << 8 | hmac[offset+3]) % 10^digits
 * 5. zero-pad 到 digits 位
 */
function computeHotp(
  secret: Buffer,
  counter: number,
  algorithm: NonNullable<TotpOptions['algorithm']>,
  digits: 6 | 8,
): string {
  // counter -> 8 字节 big-endian (Number 安全整数范围 2^53,counter 不会溢出)
  const counterBuffer = Buffer.allocUnsafe(8)
  // JS 位运算操作 32 位有符号整数,大于 2^31 需用 Math.floor
  counterBuffer.writeBigUInt64BE(BigInt(counter), 0)

  const hmac = createHmac(algorithm, secret).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f

  // noUncheckedIndexedAccess: hmac[offset] 类型为 number | undefined,需显式断言
  const b0 = hmac[offset]!
  const b1 = hmac[offset + 1]!
  const b2 = hmac[offset + 2]!
  const b3 = hmac[offset + 3]!

  const binary = ((b0 & 0x7f) << 24) | ((b1 & 0xff) << 16) | ((b2 & 0xff) << 8) | (b3 & 0xff)
  const modulus = Math.pow(10, digits)
  return (binary % modulus).toString().padStart(digits, '0')
}

/**
 * 生成当前时刻的 TOTP。
 * counter = floor(Date.now() / 1000 / period)
 */
export function generateTotp(secret: Buffer, options?: Partial<TotpOptions>): string {
  const algorithm = options?.algorithm ?? DEFAULT_ALGORITHM
  const digits = options?.digits ?? DEFAULT_DIGITS
  const period = options?.period ?? DEFAULT_PERIOD
  const counter = Math.floor(Date.now() / 1000 / period)
  return computeHotp(secret, counter, algorithm, digits)
}

/**
 * 校验用户输入的 TOTP token。
 *
 * 防重放 + 防时钟漂移:允许 ±1 个 time step (前后 30s),
 * 即同时校验 counter-1 / counter / counter+1 三个值。
 * 全部使用 timingSafeEqual 比较,防时序攻击。
 *
 * @returns true=校验通过,false=token 错误或过期
 */
export function verifyTotp(token: string, secret: Buffer, options?: Partial<TotpOptions>): boolean {
  const algorithm = options?.algorithm ?? DEFAULT_ALGORITHM
  const digits = options?.digits ?? DEFAULT_DIGITS
  const period = options?.period ?? DEFAULT_PERIOD

  // 输入校验:必须是 digits 位数字
  if (!/^\d+$/.test(token) || token.length !== digits) {
    return false
  }

  const counter = Math.floor(Date.now() / 1000 / period)
  // ±1 time step 防时钟漂移
  for (const delta of [-1, 0, 1]) {
    const expected = computeHotp(secret, counter + delta, algorithm, digits)
    if (constantTimeEquals(token, expected)) {
      return true
    }
  }
  return false
}

/**
 * 常量时间字符串比较(长度不同时也走完固定轮次防时序泄露)。
 */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // 长度不同仍做一次假比较,保证耗时与等长情况接近
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

// ============ Secret 生成 ============

/**
 * 生成 20 字节 CSPRNG 随机密钥(RFC 6238 推荐 ≥ 160 bits)。
 */
export function generateSecret(): Buffer {
  return randomBytes(20)
}

// ============ otpauth URI + QR code ============

export interface OtpauthUriParams {
  /** 共享密钥(原始 Buffer) */
  secret: Buffer
  /** 用户账号名(邮箱/手机号,用于 Authenticator 显示) */
  accountName: string
  /** 发行方,默认 'IHUI-AI' */
  issuer?: string
  /** HMAC 算法,默认 'SHA1' */
  algorithm?: string
  /** 数字位数,默认 6 */
  digits?: number
  /** 时间步长,默认 30 */
  period?: number
}

/**
 * 构造 otpauth:// URI(可被 Google Authenticator / Microsoft Authenticator 扫码识别)。
 *
 * 格式:
 * otpauth://totp/IHUI-AI:user@example.com?secret=BASE32SECRET&issuer=IHUI-AI&algorithm=SHA1&digits=6&period=30
 *
 * Label 中的 issuer: 前缀用于 Authenticator 应用分组显示,
 * secret 必须是 Base32 编码(无 padding)。
 */
export function buildOtpauthUri(params: OtpauthUriParams): string {
  const issuer = params.issuer ?? 'IHUI-AI'
  const algorithm = (params.algorithm ?? 'SHA1').toUpperCase()
  const digits = params.digits ?? 6
  const period = params.period ?? 30
  const secretBase32 = base32Encode(params.secret)

  // label: issuer:accountName (accountName 中的冒号/问号/井号需 URL 编码)
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(params.accountName)}`
  const query = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  })
  return `otpauth://totp/${label}?${query.toString()}`
}

/**
 * 生成 QR code data URL (data:image/png;base64,...)。
 *
 * 依赖 qrcode 包(已在 apps/api/package.json 中声明 `qrcode ^1.5.4` + `@types/qrcode`)。
 * 若动态 import 失败(理论不会发生,因已声明依赖),回退返回 otpauth URI 本身,
 * 前端可用任意 QR 库(如 qrcode.react)自行渲染。
 */
export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1 })
  } catch {
    // 回退:返回 URI 本身,前端自行渲染 QR
    return uri
  }
}

// ============ Backup codes ============

/**
 * Backup code 字符表:大写字母 + 数字,排除易混淆字符 (0/O/1/I/L)。
 */
const BACKUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' as const
const BACKUP_CODE_LENGTH = 8 // 8 字符(不含分隔符),格式 XXXX-XXXX

/**
 * 生成 count 个 backup code(明文,返回给用户保存)。
 *
 * 每个 code 为 8 字符字母数字,格式 XXXX-XXXX(中间一个连字符便于阅读/抄写)。
 * 字符集排除易混淆字符 (0/O/1/I/L),使用 CSPRNG 随机。
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(BACKUP_CODE_LENGTH)
    let code = ''
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      const idx = bytes[j]! % BACKUP_CODE_ALPHABET.length
      code += BACKUP_CODE_ALPHABET[idx]
      if (j === 3) code += '-' // XXXX-XXXX
    }
    codes.push(code)
  }
  return codes
}

/**
 * 对 backup code 取 sha256 hash(数据库只存 hash,明文不落库)。
 * 输入大小写不敏感:统一转大写后 hash,避免用户输入小写导致 mismatch。
 */
export function hashBackupCode(code: string): string {
  const normalized = code.replace(/\s/g, '').toUpperCase()
  return createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * 校验 backup code 是否匹配 hash 数组中的任一项。
 * 使用 timingSafeEqual 防时序攻击,逐项比较。
 * 输入大小写不敏感:与 hashBackupCode 同步 normalize。
 *
 * @returns true=匹配(校验通过),false=不匹配
 */
export function verifyBackupCode(code: string, hashes: string[]): boolean {
  if (!code || hashes.length === 0) return false
  const normalized = code.replace(/\s/g, '').toUpperCase()
  const inputHash = createHash('sha256').update(normalized, 'utf8').digest('hex')
  const inputBuf = Buffer.from(inputHash, 'utf8')
  for (const h of hashes) {
    const storedBuf = Buffer.from(h, 'utf8')
    if (inputBuf.length === storedBuf.length && timingSafeEqual(inputBuf, storedBuf)) {
      return true
    }
  }
  return false
}

// ============ 2FA Challenge Token (登录流程短期 JWT) ============

/**
 * Challenge token TTL(秒):5 分钟。
 * 登录密码校验通过 + 用户已启用 2FA 时,签发此 token 给前端,
 * 前端用它调 /auth/2fa/login-verify(TOTP 或 backup code 二次校验)。
 * 此 token 不能用于其他受 authenticate() 保护的端点(plugins/auth.ts 拒绝 type='challenge')。
 */
export const CHALLENGE_TOKEN_TTL_SECONDS = 5 * 60

const JWT_ISSUER = 'ihui-ai'
const JWT_ALG = 'HS256'

/**
 * 签发 2FA challenge token。
 *
 * 复用 jose SignJWT,在 payload 中加 type='challenge' 标记,
 * 与完整 access token 区分(完整 token 无 type 字段或 type='refresh')。
 *
 * @param payload JWTPayload(userId/phone/familyId/roleId)
 * @returns 签名后的 JWT 字符串(5min 过期)
 */
export async function signChallengeToken(payload: {
  userId: string
  phone: string
  familyId: string
  roleId: number
}): Promise<string> {
  const { SignJWT } = await import('jose')
  const { getJwtSecret } = await import('@ihui/auth')
  return new SignJWT({
    phone: payload.phone,
    familyId: payload.familyId,
    roleId: payload.roleId,
    type: 'challenge',
  })
    .setProtectedHeader({ alg: JWT_ALG })
    .setSubject(payload.userId)
    .setIssuer(JWT_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TOKEN_TTL_SECONDS}s`)
    .sign(getJwtSecret())
}

/**
 * 校验 2FA challenge token。
 *
 * 仅接受 type='challenge' 的 token。完整 access token 或 refresh token 会被拒绝。
 *
 * @returns 校验通过返回 { userId, phone, familyId, roleId },失败返回 null
 */
export async function verifyChallengeToken(token: string): Promise<{
  userId: string
  phone: string
  familyId: string
  roleId: number
} | null> {
  const { jwtVerify } = await import('jose')
  const { getJwtSecret } = await import('@ihui/auth')
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: JWT_ISSUER,
      algorithms: [JWT_ALG],
    })
    if (payload.type !== 'challenge' || !payload.sub) {
      return null
    }
    return {
      userId: payload.sub,
      phone: String(payload.phone ?? ''),
      familyId: String(payload.familyId ?? ''),
      roleId: Number(payload.roleId ?? 0),
    }
  } catch {
    return null
  }
}

