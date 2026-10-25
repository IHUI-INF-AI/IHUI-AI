// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 腾讯云短信通道(SendSms,API 版本 2021-01-11)。
 *
 * 定位:阿里云那条腿的**第二通道**,不是替换。签名/模板报审要 7~10 个工作日
 * (运营商侧报备),所以这条通道在报审完成前必然处于"未配置"状态 —— 那是正确状态,
 * 不是缺陷。缺配置时本模块一律如实报 `not_configured`,绝不记成"已发送"。
 *
 * TC3-HMAC-SHA256 签名一律复用 services/vendor-auth-strategies.ts 的 TencentTc3AuthStrategy。
 * 本文件不得再抄一份签名算法 —— 全仓只许有一份(§0.6)。
 *
 * 请求字段名按 2026-10-22 对真 API 实测确认:必填是
 *   PhoneNumberSet / SmsSdkAppId / TemplateId(+ SignName)
 * 注意是 `SmsSdkAppId` 而**不是** `SdkAppId`(凭印象写会一直撞 MissingParameter)。
 * 国内号码必须带 `+86` 前缀。
 */
import { env } from 'node:process'
import { TencentTc3AuthStrategy } from './vendor-auth-strategies.js'
import { logger } from '../utils/logger.js'
import type { SmsDeliveryResult, SmsScene } from './sms-types.js'

const HOST = 'sms.tencentcloudapi.com'
const SERVICE = 'sms'
const VERSION = '2021-01-11'
const DEFAULT_REGION = 'ap-guangzhou'
const REQUEST_TIMEOUT_MS = 10_000

const tc3 = new TencentTc3AuthStrategy()

/** 场景 → 该场景模板 ID 的 env 键。 */
export const TENCENT_SCENE_TEMPLATE_ENV_KEYS: Record<SmsScene, string> = {
  register: 'TENCENT_SMS_TEMPLATE_CODE_REGISTER',
  login: 'TENCENT_SMS_TEMPLATE_CODE_LOGIN',
  reset: 'TENCENT_SMS_TEMPLATE_CODE_RESET',
  'phone-binding': 'TENCENT_SMS_TEMPLATE_CODE_PHONE_BINDING',
}

/** 国内号码补 `+86`。已有 `+` 的原样保留(国际号码由调用方负责);
 *  `0086` 是国际字冠写法,只剥前面的 `00`、保留 `86` —— 连国家码一起削会发成一个不存在的号码。 */
function toTencentPhone(phone: string): string {
  const t = phone.trim()
  if (t.startsWith('+')) return t
  if (t.startsWith('0086')) return `+${t.slice(2)}`
  return `+86${t}`
}

/** 四件齐备才算这条通道可用:凭据 + 应用 ID + 签名。模板 ID 单独判(见 pickTencentTemplateId)。 */
export function isTencentSmsConfigured(): boolean {
  return Boolean(
    env.TENCENT_SMS_SECRET_ID &&
    env.TENCENT_SMS_SECRET_KEY &&
    env.TENCENT_SMS_SDK_APP_ID &&
    env.TENCENT_SMS_SIGN_NAME,
  )
}

/** 按场景取模板 ID;该场景没单独配 ⇒ 回落主模板。空串按未配处理。 */
function pickTencentTemplateId(scene?: SmsScene): string | undefined {
  const scoped = scene ? env[TENCENT_SCENE_TEMPLATE_ENV_KEYS[scene]] : undefined
  return scoped || env.TENCENT_SMS_TEMPLATE_CODE
}

/** 腾讯云 SendSms 的响应判定 —— 与阿里云同型的陷阱,不能再踩一次。
 *  HTTP 200 有两种"没发出去":① `Response.Error`(整单被拒);② 没有 Error 但
 *  `Response.SendStatusSet[].Code !== 'Ok'`(单号级失败,如号码在黑名单 / 模板变量不合法 /
 *  超频)。只有 `Code === 'Ok'` 才表示进了发送队列。
 *  判不出来(缺字段 / 空数组 / Code 非字符串)一律算**没发出去** —— 不许默认成功。 */
function judgeTencentSendResponse(raw: unknown): SmsDeliveryResult {
  const resp = (raw as { Response?: Record<string, unknown> } | null | undefined)?.Response
  if (!resp || typeof resp !== 'object')
    return { sent: false, reason: 'tencent_response_unparsable' }

  const err = resp.Error as { Code?: unknown } | undefined
  const errCode = typeof err?.Code === 'string' ? err.Code : ''
  if (errCode) return { sent: false, reason: `tencent_rejected:${errCode}` }

  const set = resp.SendStatusSet
  if (!Array.isArray(set) || set.length === 0) {
    return { sent: false, reason: 'tencent_response_unparsable' }
  }
  const first = set[0] as { Code?: unknown } | undefined
  const code = typeof first?.Code === 'string' ? first.Code : ''
  if (!code) return { sent: false, reason: 'tencent_response_unparsable' }
  return code === 'Ok' ? { sent: true } : { sent: false, reason: `tencent_rejected:${code}` }
}

function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

/** 只取机器可读的错误码,丢弃自由文本正文(守门 67)。 */
function providerErrorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code
  if (typeof code === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(code)) return code
  const name = (e as Error)?.name
  return typeof name === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(name) ? name : 'unknown'
}

/** 经腾讯云 SendSms 投递一枚验证码。*/
export async function sendViaTencent(
  phone: string,
  code: string,
  scene?: SmsScene,
): Promise<SmsDeliveryResult> {
  if (!isTencentSmsConfigured()) {
    const missing =
      !env.TENCENT_SMS_SECRET_ID || !env.TENCENT_SMS_SECRET_KEY
        ? 'TENCENT_SMS_SECRET_ID/KEY'
        : !env.TENCENT_SMS_SDK_APP_ID
          ? 'TENCENT_SMS_SDK_APP_ID(控制台「应用管理」创建,未创建就没有这个 ID)'
          : 'TENCENT_SMS_SIGN_NAME'
    logger.warn('腾讯云短信未配置 ⇒ 判未配置,不记为已发送', {
      phone: maskPhone(phone),
      reason: `not_configured: ${missing}`,
    })
    return { sent: false, reason: `not_configured: ${missing}` }
  }
  const templateId = pickTencentTemplateId(scene)
  if (!templateId) {
    const key = scene
      ? `${TENCENT_SCENE_TEMPLATE_ENV_KEYS[scene]} / TENCENT_SMS_TEMPLATE_CODE`
      : 'TENCENT_SMS_TEMPLATE_CODE'
    logger.warn('腾讯云短信没有可用模板 ID ⇒ 判未配置,不记为已发送', {
      phone: maskPhone(phone),
      reason: `not_configured: ${key}`,
    })
    return { sent: false, reason: `not_configured: ${key}` }
  }

  const payload = {
    PhoneNumberSet: [toTencentPhone(phone)],
    SmsSdkAppId: env.TENCENT_SMS_SDK_APP_ID,
    SignName: env.TENCENT_SMS_SIGN_NAME,
    TemplateId: templateId,
    // 腾讯云验证码模板的变量按顺序传纯文本数组,不是阿里云那种 JSON 字符串
    TemplateParamSet: [code],
  }

  try {
    const signed = tc3.buildHeaders(
      { key: env.TENCENT_SMS_SECRET_ID, secret: env.TENCENT_SMS_SECRET_KEY },
      {
        method: 'POST',
        url: `https://${HOST}/`,
        body: payload,
        config: {
          service: SERVICE,
          host: HOST,
          version: VERSION,
          region: env.TENCENT_SMS_REGION || DEFAULT_REGION,
          action: 'SendSms',
        },
      },
    )
    const res = await fetch(`https://${HOST}/`, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    const verdict = judgeTencentSendResponse(await res.json().catch(() => null))
    if (!verdict.sent) {
      logger.warn('腾讯云短信未发出', { phone: maskPhone(phone), reason: verdict.reason })
    }
    return verdict
  } catch (e) {
    const reason = `tencent_call_failed:${providerErrorCode(e)}`
    logger.warn('腾讯云短信调用异常', { phone: maskPhone(phone), reason })
    return { sent: false, reason }
  }
}

/** 测试出口(§22c):镜像测试直接用生产判据,不得在测试里复制一份。 */
export const __test__ = {
  toTencentPhone,
  judgeTencentSendResponse,
  pickTencentTemplateId,
  isTencentSmsConfigured,
  TENCENT_SCENE_TEMPLATE_ENV_KEYS,
  providerErrorCode,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
