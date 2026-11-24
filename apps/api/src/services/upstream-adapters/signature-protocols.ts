// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 标准签名协议层(2026-11-18 立)。
 *
 * 立因:上游接入最常卡在「对方要一个签名头、我们只会 Bearer」。
 * 本层把**公开标准协议**做成纯函数适配器,接任意自建/第三方上游时不必再手写一遍:
 *   - `hmac-sha256`:自定义签名头(把 canonical string 用共享密钥 HMAC);
 *   - `aws-sigv4`:AWS 系(含 MinIO / 兼容实现)的标准四步派生;
 *   - `oauth1a`:RFC 5849 单腿签名(HMAC-SHA1 base string);
 *   - `jwt-hs256`:服务账号/机器身份的 JWT 断言。
 *
 * **边界写死**:本层只实现公开算法,不内置任何私有算法的复刻,也不接受
 * 「照某个客户端抓包里的签名头反推」这类输入 —— 私有协议的签名不在本层射程。
 * 全部为纯函数(输入 → 输出字节一致),不发网络请求、不读环境、不写盘。
 */
import { createHash, createHmac } from 'node:crypto'

export type SignatureProtocol = 'hmac-sha256' | 'aws-sigv4' | 'oauth1a' | 'jwt-hs256'

export const SIGNATURE_PROTOCOLS: readonly SignatureProtocol[] = [
  'hmac-sha256',
  'aws-sigv4',
  'oauth1a',
  'jwt-hs256',
]

function hexLower(buf: Buffer): string {
  return buf.toString('hex')
}

/** RFC 3986 编码(与 AWS / OAuth 共用:空格 %20,不编码 ~) */
export function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * 自定义 HMAC-SHA256 签名头。
 * canonicalString 由调用方按对方文档拼(本层不猜对方格式)。
 */
export function signHmacSha256(input: {
  secret: string
  canonicalString: string
  algorithm?: 'sha256' | 'sha1'
}): { headerValue: string; hex: string } {
  const algo = input.algorithm ?? 'sha256'
  const mac = createHmac(algo, input.secret).update(input.canonicalString, 'utf8').digest()
  return { headerValue: `hmac-${algo}=${hexLower(mac)}`, hex: hexLower(mac) }
}

// ============================================================================
// AWS SigV4(公开标准,四步派生)
// ============================================================================

export interface SigV4Input {
  accessKeyId: string
  secretAccessKey: string
  region: string
  service: string
  method: string
  /** 已编码的规范 URI,如 /bucket/key */
  canonicalUri: string
  /** 已编码的规范查询串,无则空串 */
  canonicalQueryString?: string
  /** 参与签名(已小写)的头,host 至少要有 */
  headers: Record<string, string>
  /** yyyymmdd'T'hhmmss'Z' */
  timestamp: string
  /** 请求体 sha256 hex;无体用空串的哈希 */
  payloadHash?: string
  /** 无体默认 sha256('') */
  signedPayloadEmptyHash?: boolean
}

export interface SigV4Result {
  authorization: string
  canonicalRequest: string
  stringToSign: string
  signature: string
}

const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export function signAwsSigV4(input: SigV4Input): SigV4Result {
  const payloadHash = input.payloadHash ?? EMPTY_SHA256
  const headerNames = Object.keys(input.headers)
    .map((h) => h.toLowerCase())
    .sort()
  const canonicalHeaders = headerNames
    .map((h) => {
      const raw = Object.entries(input.headers).find(([k]) => k.toLowerCase() === h)?.[1] ?? ''
      return `${h}:${raw.trim().replace(/\s+/g, ' ')}\n`
    })
    .join('')
  const canonicalRequest = [
    input.method.toUpperCase(),
    input.canonicalUri || '/',
    input.canonicalQueryString ?? '',
    canonicalHeaders,
    headerNames.join(';'),
    payloadHash,
  ].join('\n')

  const dateStamp = input.timestamp.slice(0, 8)
  const scope = `${dateStamp}/${input.region}/${input.service}/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', input.timestamp, scope, hexLower(createHash('sha256').update(canonicalRequest).digest())].join('\n')

  const kDate = createHmac('sha256', `AWS4${input.secretAccessKey}`).update(dateStamp).digest()
  const kRegion = createHmac('sha256', kDate).update(input.region).digest()
  const kService = createHmac('sha256', kRegion).update(input.service).digest()
  const kSigning = createHmac('sha256', kService).update('aws4_request').digest()
  const signature = hexLower(createHmac('sha256', kSigning).update(stringToSign).digest())

  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${headerNames.join(';')}, Signature=${signature}`
  return { authorization, canonicalRequest, stringToSign, signature }
}

// ============================================================================
// OAuth 1.0a(RFC 5849)
// ============================================================================

export interface OAuth1aInput {
  method: string
  url: string
  consumerKey: string
  consumerSecret: string
  token?: string
  tokenSecret?: string
  /** 额外参与签名的参数(不含 oauth_* 由本函数补) */
  params?: Record<string, string>
  /** nonce / timestamp 可注入以便测试确定性 */
  nonce?: string
  timestamp?: string
}

export interface OAuth1aResult {
  header: string
  signatureBase: string
  signature: string
}

export function signOAuth1a(input: OAuth1aInput): OAuth1aResult {
  const u = new URL(input.url)
  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`
  const nonce = input.nonce ?? createHash('sha1').update(`${Date.now()}${Math.random()}`).digest('hex').slice(0, 16)
  const timestamp = input.timestamp ?? String(Math.floor(Date.now() / 1000))

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: input.consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
  }
  if (input.token) oauthParams.oauth_token = input.token

  const all: Array<[string, string]> = [
    ...Object.entries(input.params ?? {}),
    ...Object.entries(oauthParams),
    ...Array.from(u.searchParams.entries()),
  ]
  const norm = all
    .map(([k, v]) => [rfc3986(k), rfc3986(v)] as [string, string])
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const signatureBase = [input.method.toUpperCase(), rfc3986(baseUrl), rfc3986(norm)].join('&')
  const key = `${rfc3986(input.consumerSecret)}&${rfc3986(input.tokenSecret ?? '')}`
  const signature = createHmac('sha1', key).update(signatureBase, 'utf8').digest('base64')

  const headerParams = { ...oauthParams, oauth_signature: signature }
  const header =
    'OAuth ' +
    Object.entries(headerParams)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${rfc3986(k)}="${rfc3986(v)}"`)
      .join(', ')

  return { header, signatureBase, signature }
}

// ============================================================================
// JWT(HS256)
// ============================================================================

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function signJwtHs256(input: {
  secret: string
  /** 业务断言(如 issuer/sub/aud/exp);iat 不自动补,由调用方给定以便可测 */
  payload: Record<string, unknown>
  /** 固定 typ/alg,额外头可由调用方给 */
  header?: Record<string, unknown>
  expiresInSec?: number
  now?: number
}): string {
  const header = { alg: 'HS256', typ: 'JWT', ...(input.header ?? {}) }
  const payload: Record<string, unknown> = { ...input.payload }
  if (typeof input.expiresInSec === 'number') {
    payload.exp = (input.now ?? Math.floor(Date.now() / 1000)) + input.expiresInSec
  }
  const seg = `${b64url(Buffer.from(JSON.stringify(header)))}.${b64url(Buffer.from(JSON.stringify(payload)))}`
  const sig = b64url(createHmac('sha256', input.secret).update(seg, 'utf8').digest())
  return `${seg}.${sig}`
}

/** 能力自述:给 admin 面看的"支持哪些公开协议" */
export function describeSignatureProtocols(): { protocols: SignatureProtocol[]; note: string } {
  return {
    protocols: [...SIGNATURE_PROTOCOLS],
    note:
      '只实现公开标准协议(HMAC-SHA256 / AWS SigV4 / OAuth1a / JWT-HS256);私有协议的签名复刻不在本层射程,也不接受抓包反推',
  }
}

export const __test__ = { EMPTY_SHA256 }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
