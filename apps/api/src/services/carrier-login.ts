// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​​‌​​‌​​‌​⁠

/**
 * 运营商一键登录验证网关（可插拔聚合服务）。
 *
 * 主目标：闪验（创蓝 253 · Univerify 一键登录）聚合。
 * 通过 SDK 在客户端取得运营商 token 后，服务端用该 token 向运营商换取真实手机号，
 * 再走统一的"查找/创建用户 → 签发 JWT"登录链路（见 routes/auth-carrier.ts）。
 *
 * 支持的 operator 标识：
 * - flashverify：闪验 Univerify（本模块已实现，见 verifyFlashVerifyToken）
 * - cmcc / cucc / ctcc：中国移动 / 中国联通 / 中国电信 直连（预留，待接入）
 *
 * 闪验配置(.env)：
 * - FLASHVERIFY_APPID       控制台创建应用生成的 APPID
 * - FLASHVERIFY_KEY         应用 APPKEY（HMAC-SHA256 签名 + AES 手机号解密密钥）
 * - FLASHVERIFY_SECRET      应用密钥（可选，若项目仅配置 KEY/SECRET 两者之一，均可作为 appKey）
 * - FLASHVERIFY_API_URL    服务端换号接口地址（可选，默认 wsflash.253.com/open/flashsdk/mobile-query）
 */

import { env } from 'node:process'
import { createHmac, createHash, createDecipheriv } from 'node:crypto'

export type CarrierOperator = 'flashverify' | 'cmcc' | 'cucc' | 'ctcc'

export interface CarrierVerifyOptions {
  /** 运营商标识（flashverify | cmcc | cucc | ctcc），仅 flashverify 当前可用。 */
  operator: string
  /** SDK 一键登录返回的运营商 token，一次有效。 */
  accessToken: string
}

export interface CarrierVerifyResult {
  /** 经运营商校验后的真实手机号（11 位）。 */
  phone: string
}

/** 预定义错误码（跨模块约定），路由层据此返回友好错误、不泄漏网关密钥细节。 */
export const CarrierErrorCode = {
  NOT_CONFIGURED: 'CARRIER_NOT_CONFIGURED',
  UNSUPPORTED: 'CARRIER_UNSUPPORTED',
  GATEWAY_ERROR: 'CARRIER_GATEWAY_ERROR',
  TIMEOUT: 'CARRIER_TIMEOUT',
  INVALID_PHONE: 'CARRIER_INVALID_PHONE',
} as const
export type CarrierErrorCodeValue = (typeof CarrierErrorCode)[keyof typeof CarrierErrorCode]

/** 统一的网关错误类型。 */
export class CarrierLoginError extends Error {
  readonly code: CarrierErrorCodeValue
  readonly status: number
  constructor(message: string, code: CarrierErrorCodeValue, status = 401) {
    super(message)
    this.name = 'CarrierLoginError'
    this.code = code
    this.status = status
  }
}

/** 请求网关超时阈值（ms）。 */
const REQUEST_TIMEOUT_MS = 10000

/** 取值是否已配置闪验凭据。 */
function isFlashVerifyConfigured(): boolean {
  return Boolean(env.FLASHVERIFY_APPID && (env.FLASHVERIFY_KEY || env.FLASHVERIFY_SECRET))
}

/**
 * 主入口：按 operator 分发到对应网关验证 token。
 * @throws CarrierLoginError 当凭据未配置、operator 未实现或网关返回失败时。
 */
export async function verifyCarrierToken(opts: CarrierVerifyOptions): Promise<CarrierVerifyResult> {
  switch (opts.operator) {
    case 'flashverify':
      return verifyFlashVerifyToken(opts.accessToken)
    case 'cmcc':
    case 'cucc':
    case 'ctcc':
      throw new CarrierLoginError(
        `运营商[${opts.operator}]直连网关暂未接入，请使用 flashverify 聚合`,
        CarrierErrorCode.UNSUPPORTED,
        400,
      )
    default:
      throw new CarrierLoginError(`不支持的运营商标识: ${opts.operator}`, CarrierErrorCode.UNSUPPORTED, 400)
  }
}

// ============================================================================
// 闪验（创蓝 253 · Univerify 一键登录）
// ============================================================================

interface FlashVerifyResponse {
  code?: string
  message?: string
  chargeStatus?: number
  data?: {
    tradeNo?: string
    mobileName?: string
  }
}

/**
 * 闪验"置换手机号"接口（Android/iOS/HarmonyOS 一键登录）。
 * - 地址: https://wsflash.253.com/open/flashsdk/mobile-query
 * - 方式: POST, Content-Type: application/x-www-form-urlencoded
 * - 入参: appId / token / sign（sign = hmacSHA256(按字段名正序拼接 key+value, appKey) 大写 hex）
 * - 出参: data.mobileName 为手机号密文，按算法解密后得到真实手机号。
 */
async function verifyFlashVerifyToken(accessToken: string): Promise<CarrierVerifyResult> {
  if (!isFlashVerifyConfigured()) {
    throw new CarrierLoginError(
      '闪验(Univerify)未配置,请设置 FLASHVERIFY_APPID / FLASHVERIFY_KEY / FLASHVERIFY_SECRET',
      CarrierErrorCode.NOT_CONFIGURED,
      501,
    )
  }
  const appId = env.FLASHVERIFY_APPID!
  const appKey = env.FLASHVERIFY_KEY || env.FLASHVERIFY_SECRET!
  const endpoint = env.FLASHVERIFY_API_URL || 'https://wsflash.253.com/open/flashsdk/mobile-query'

  if (!accessToken) {
    throw new CarrierLoginError('运营商 token 不能为空', CarrierErrorCode.GATEWAY_ERROR, 400)
  }

  // 签名：所有传入参数按字段名正序排序后拼接 key+value，再用 appKey 做 hmacSHA256，输出大写 hex。
  const params: Record<string, string> = { appId, token: accessToken }
  const sign = buildHmacSign(params, appKey)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...params, sign }).toString(),
      signal: controller.signal as AbortSignal,
    })
    if (!resp.ok) {
      throw new CarrierLoginError(
        `闪验网关响应异常 HTTP ${resp.status}`,
        CarrierErrorCode.GATEWAY_ERROR,
        // 5xx 视为网关问题返回 502,否则一律按校验失败处理
        resp.status >= 500 ? 502 : 401,
      )
    }
    const data = (await resp.json()) as FlashVerifyResponse
    if (data.code !== '200000') {
      throw new CarrierLoginError(
        `闪验换号失败: ${data.message ?? data.code ?? '未知错误'}`,
        CarrierErrorCode.GATEWAY_ERROR,
        401,
      )
    }
    const cipherText = data.data?.mobileName
    if (!cipherText) {
      throw new CarrierLoginError('闪验响应缺少手机号字段', CarrierErrorCode.GATEWAY_ERROR, 401)
    }

    const phone = decryptMobileName(cipherText, appKey)
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new CarrierLoginError('闪验解码手机号格式异常', CarrierErrorCode.INVALID_PHONE, 401)
    }
    return { phone }
  } catch (e) {
    if (controller.signal.aborted) {
      throw new CarrierLoginError('闪验网关请求超时', CarrierErrorCode.TIMEOUT, 504)
    }
    if (e instanceof CarrierLoginError) throw e
    throw new CarrierLoginError('闪验网关调用失败', CarrierErrorCode.GATEWAY_ERROR, 502)
  } finally {
    clearTimeout(timer)
  }
}

/**
 * HMAC-SHA256 签名：参数按字段名正序排序后拼接 key+value，再以 appKey 签名，输出大写 hex。
 */
function buildHmacSign(params: Record<string, string>, appKey: string): string {
  const str = Object.keys(params)
    .sort()
    .map((k) => `${k}${params[k]}`)
    .join('')
  return createHmac('sha256', appKey).update(str, 'utf8').digest('hex').toUpperCase()
}

/**
 * 闪验手机号解密（默认 AES-CBC）。
 * 按产品文档：以 md5(appKey) 前 16 位字符串作为密钥、后 16 位字符串作为初始向量（AES-128-CBC）。
 * 若控制台创建应用时填写了 RSA 公钥并使用 encryptType=1，则需改为 RSA 私钥解密（当前未实现）。
 */
function decryptMobileName(cipherHex: string, appKey: string): string {
  const md5Hex = createHash('md5').update(appKey, 'utf8').digest('hex') // 32 位 hex
  const keyStr = md5Hex.slice(0, 16) // 密钥(16 字符)
  const ivStr = md5Hex.slice(16, 32) // 初始向量(16 字符)
  const decipher = createDecipheriv('aes-128-cbc', keyStr, ivStr)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()])
  return decrypted.toString('utf8').trim()
}