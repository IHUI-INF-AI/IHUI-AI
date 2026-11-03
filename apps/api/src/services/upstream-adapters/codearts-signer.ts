// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 华为云 CodeArts(码道)上游签名纯函数集(2026-10-22 立)。
 *
 * SDK-HMAC-SHA256 签名逐字对齐 @huaweicloud/huaweicloud-sdk-core 的 JS signer,
 * 金标准向量取自 https://github.com/2951461586/CodeArts2API internal/codearts/signer_test.go
 * (期望值由独立 Python 复刻算出,任何一处 canonical 拼装改动都会让测试失败)。
 *
 * 两处与官方文档不同、不照做必 403 APIG.0301 的坑:
 * 1. CanonicalURI 每段单独编码后**强制补尾斜杠**(/api/v2/chat/completions → /api/v2/chat/completions/)
 * 2. CanonicalHeaders 每行自带尾 \n,拼装 CanonicalRequest 时又补一个 \n
 *    → SignedHeaders 之前多一个空行
 *
 * 本文件零副作用、零网络、零平台耦合,便于单测直接对金标准向量。
 */
import {
  createHash,
  createHmac,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  randomBytes,
  sign as ecSign,
  verify as ecVerify,
} from 'node:crypto'

const SDK_SIGNING_ALGORITHM = 'SDK-HMAC-SHA256'

// =============================================================================
// URL 编码与 canonical 构件
// =============================================================================

/**
 * 复刻华为云 JS signer 的 urlEncode:仅保留 RFC3986 unreserved 字符(A-Za-z0-9-._~),
 * 其余按 UTF-8 字节一律 %XX **大写**。
 *
 * 不能用 encodeURIComponent —— 它会放过 !'() 等字符,导致签名与上游不一致。
 */
export function jsURLEncode(s: string): string {
  const bytes = Buffer.from(s, 'utf8')
  let out = ''
  for (const byte of bytes) {
    const ch = String.fromCharCode(byte)
    if (
      (byte >= 0x41 && byte <= 0x5a) || // A-Z
      (byte >= 0x61 && byte <= 0x7a) || // a-z
      (byte >= 0x30 && byte <= 0x39) || // 0-9
      ch === '-' ||
      ch === '.' ||
      ch === '_' ||
      ch === '~'
    ) {
      out += ch
    } else {
      out += '%' + byte.toString(16).toUpperCase().padStart(2, '0')
    }
  }
  return out
}

/** sha256 十六进制摘要(空串 = e3b0c442…,与 Go 参考实现一致)。 */
export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * CanonicalURI:逐段 jsURLEncode 后**强制补尾斜杠**(坑 1)。
 * pathname 已由 URL 解析做过一次百分号编码,先 decode 回原文再按 JS 规则重编码;
 * decode 失败(非法 % 序列)则按已编码原文直接重编码(对齐 Go PathUnescape 失败分支)。
 */
export function canonicalURI(u: URL): string {
  let path = u.pathname
  if (!path) path = '/'
  const encoded = path
    .split('/')
    .map((seg) => {
      let decoded = seg
      try {
        decoded = decodeURIComponent(seg)
      } catch {
        /* 非法百分号转义:保持原样再编码 */
      }
      return jsURLEncode(decoded)
    })
    .join('/')
  return encoded.endsWith('/') ? encoded : encoded + '/'
}

/** CanonicalQuery:键、值各自排序后再 jsURLEncode,以 & 连接。 */
export function canonicalQuery(u: URL): string {
  if (!u.search) return ''
  const keys = [...new Set([...u.searchParams.keys()])].sort()
  const parts: string[] = []
  for (const k of keys) {
    const vals = u.searchParams.getAll(k).slice().sort()
    for (const v of vals) parts.push(`${jsURLEncode(k)}=${jsURLEncode(v)}`)
  }
  return parts.join('&')
}

/** X-Sdk-Date 格式:YYYYMMDDTHHMMSSZ(UTC)。 */
function sdkDate(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  )
}

// =============================================================================
// 请求签名
// =============================================================================

export interface CodeArtsSignInput {
  accessKeyId: string
  secretAccessKey: string
  /** STS 临时凭据 security_token;空 = 不注入 x-security-token */
  securityToken?: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  /** 请求体原文(仅 PUT/PATCH/POST 参与签名,其余按空 body) */
  body?: string | null
  /** 参与签名的请求头(键大小写不限,签名时统一小写;只 trim 值、不 trim 名) */
  headers: Record<string, string>
  /** 显式 X-Sdk-Date(测试用,保证签名完全确定);缺省取当前 UTC */
  date?: string
}

/**
 * 生成完整签名请求头(对齐 Go 参考实现 signRequest)。
 *
 * 返回的新 map 含:入参头(键小写化)+ host + x-sdk-date + x-security-token(非空时)
 * + Authorization。入参 headers 不被就地修改。
 */
export function signRequest(input: CodeArtsSignInput): Record<string, string> {
  const u = new URL(input.url)
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.headers)) out[k.toLowerCase()] = v
  out['host'] = u.host
  if (!out['x-sdk-date']) out['x-sdk-date'] = input.date ?? sdkDate()
  if (input.securityToken) out['x-security-token'] = input.securityToken

  // 非 PUT/PATCH/POST 一律按空 body 参与签名(与 JS signer 一致)
  const bodyParticipates =
    input.method === 'PUT' || input.method === 'PATCH' || input.method === 'POST'
  const payloadHash = sha256Hex(bodyParticipates ? (input.body ?? '') : '')

  const names = Object.keys(out).sort()
  // 坑 2:每行 "k:trim(v)\n" 自带尾 \n,join 时又补一个 \n → SignedHeaders 前多一个空行
  const canonicalHeaders = names.map((k) => `${k}:${(out[k] ?? '').trim()}\n`).join('')
  const signedHeaders = names.join(';')
  const canonicalRequest = [
    input.method,
    canonicalURI(u),
    canonicalQuery(u),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')
  const stringToSign = [SDK_SIGNING_ALGORITHM, out['x-sdk-date'], sha256Hex(canonicalRequest)].join(
    '\n',
  )
  const signature = createHmac('sha256', input.secretAccessKey).update(stringToSign).digest('hex')

  out['Authorization'] =
    `${SDK_SIGNING_ALGORITHM} Access=${input.accessKeyId}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return out
}

// =============================================================================
// DPoP 证明(RFC 9449,ES256 JWS)
// =============================================================================

/** 生成 n 字节随机十六进制串(jti/trace id 用)。 */
export function randomHex(byteLen: number): string {
  return randomBytes(byteLen).toString('hex')
}

/** 测试辅助:生成一把 P-256 DPoP 私钥 JWK(含 x/y/d)。 */
export function generateDpopKeyJwk(): Record<string, unknown> {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  return privateKey.export({ format: 'jwk' }) as Record<string, unknown>
}

const b64url = (b: Buffer | string): string => Buffer.from(b).toString('base64url')

/**
 * 生成 DPoP 证明(ES256 紧凑 JWS),对齐 Go 参考实现 dpopProof:
 * header {"alg":"ES256","typ":"dpop+jwt","jwk":<公钥>} —— 服务端按 jkt 校验,必须带登录时绑定的公钥;
 * payload {"htm","htu","iat","jti"};签名 = 裸 r||s(64B),非 DER(ieee-p1363 编码)。
 *
 * iat/jti 可注入,便于单测完全确定。私钥 JWK 必须含 x/y/d(两种导出格式均满足)。
 */
export function buildDpopProof(
  privateJwk: Record<string, unknown>,
  opts: { htm: string; htu: string; iat?: number; jti?: string },
): string {
  if (privateJwk['kty'] !== 'EC' || privateJwk['crv'] !== 'P-256') {
    throw new Error(
      `DPoP 私钥类型不支持: kty=${String(privateJwk['kty'])} crv=${String(privateJwk['crv'])}`,
    )
  }
  if (typeof privateJwk['x'] !== 'string' || typeof privateJwk['y'] !== 'string') {
    throw new Error('DPoP 私钥 JWK 缺少公钥分量 x/y,无法签名')
  }
  const key = createPrivateKey({ key: privateJwk, format: 'jwk' } as unknown as Parameters<
    typeof createPrivateKey
  >[0])
  const header = {
    alg: 'ES256',
    typ: 'dpop+jwt',
    jwk: { kty: 'EC', crv: 'P-256', x: privateJwk['x'], y: privateJwk['y'] },
  }
  const payload = {
    htm: opts.htm,
    htu: opts.htu,
    iat: opts.iat ?? Math.floor(Date.now() / 1000),
    jti: opts.jti ?? randomHex(32),
  }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = ecSign('sha256', Buffer.from(signingInput, 'utf8'), {
    key,
    dsaEncoding: 'ieee-p1363',
  })
  return `${signingInput}.${b64url(sig)}`
}

/** 验签 DPoP 证明(测试用;生产路径由上游校验)。 */
export function verifyDpopProof(proof: string, publicJwk: Record<string, unknown>): boolean {
  const [h, p, s] = proof.split('.')
  if (!h || !p || !s) return false
  const key = createPublicKey({ key: publicJwk, format: 'jwk' } as unknown as Parameters<
    typeof createPublicKey
  >[0])
  return ecVerify(
    'sha256',
    Buffer.from(`${h}.${p}`, 'utf8'),
    { key, dsaEncoding: 'ieee-p1363' },
    Buffer.from(s, 'base64url'),
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
