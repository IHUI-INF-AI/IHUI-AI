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
import type {
  SmsDeliveryResult,
  SmsMarketingTemplateKey,
  SmsNoticeTemplateKey,
  SmsScene,
} from './sms-types.js'

const HOST = 'sms.tencentcloudapi.com'
const SERVICE = 'sms'
const VERSION = '2021-01-11'
const DEFAULT_REGION = 'ap-guangzhou'
const REQUEST_TIMEOUT_MS = 10_000

const tc3 = new TencentTc3AuthStrategy()

/** 场景 → 该场景模板 ID 的 env 键。
 * @public 仅测试钉住(判据先行族,G-1200042):生产面暂无消费方,单测直接 import;若日后有生产消费方应删本标注
 */
export const TENCENT_SCENE_TEMPLATE_ENV_KEYS: Record<SmsScene, string> = {
  register: 'TENCENT_SMS_TEMPLATE_CODE_REGISTER',
  login: 'TENCENT_SMS_TEMPLATE_CODE_LOGIN',
  reset: 'TENCENT_SMS_TEMPLATE_CODE_RESET',
  'phone-binding': 'TENCENT_SMS_TEMPLATE_CODE_PHONE_BINDING',
}

/** 通知类模板(控制台已报审,编号见下) → env 键。
 *  腾讯云自 2026-10 起通知模板不允许任何变量,文案只能固定 —— 因此这里按「用途 key」
 *  寻址,不再像验证码那样传 code/TemplateParamSet。 */
export const TENCENT_NOTICE_TEMPLATE_ENV_KEYS: Record<SmsNoticeTemplateKey, string> = {
  // 2759147 绑定成功
  'binding-success': 'TENCENT_SMS_TEMPLATE_NOTICE_BINDING_SUCCESS',
  // 2759148 新设备登录
  'new-device': 'TENCENT_SMS_TEMPLATE_NOTICE_NEW_DEVICE',
  // 2759149 密码已修改
  'password-changed': 'TENCENT_SMS_TEMPLATE_NOTICE_PASSWORD_CHANGED',
  // 2759150 系统维护
  maintenance: 'TENCENT_SMS_TEMPLATE_NOTICE_MAINTENANCE',
  // 2759151 账号注销
  'account-cancel': 'TENCENT_SMS_TEMPLATE_NOTICE_ACCOUNT_CANCEL',
  // 2759156 会员到期
  'membership-expiry': 'TENCENT_SMS_TEMPLATE_NOTICE_MEMBERSHIP_EXPIRY',
  // 2759157 支付成功
  'payment-success': 'TENCENT_SMS_TEMPLATE_NOTICE_PAYMENT_SUCCESS',
  // 2759158 内容审核未通过
  'content-reject': 'TENCENT_SMS_TEMPLATE_NOTICE_CONTENT_REJECT',
  // 2759159 账号安全限制
  'security-limit': 'TENCENT_SMS_TEMPLATE_NOTICE_SECURITY_LIMIT',
  // 2759160 服务恢复
  'service-restore': 'TENCENT_SMS_TEMPLATE_NOTICE_SERVICE_RESTORE',
}

/** 营销类模板 → env 键(文案结尾均已带「拒收请回复R」,发送前还要过退订黑名单)。
 *  原「邀请有礼」2759161 被运营商判为推广拉新、永久不予接入,已从可选集移除。 */
export const TENCENT_MARKETING_TEMPLATE_ENV_KEYS: Record<SmsMarketingTemplateKey, string> = {
  // 2759152 新功能上线
  'new-feature': 'TENCENT_SMS_TEMPLATE_MARKETING_NEW_FEATURE',
  // 2759162 限时优惠
  promo: 'TENCENT_SMS_TEMPLATE_MARKETING_PROMO',
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

/** 通知类模板:必须按 key 精确命中,不回落验证码主模板 —— 文案完全不同,
 *  拿验证码模板发「支付成功」等于给用户发一条要他输验证码的短信。 */
export function pickTencentNoticeTemplateId(key: SmsNoticeTemplateKey): string | undefined {
  const v = env[TENCENT_NOTICE_TEMPLATE_ENV_KEYS[key]]
  return v || undefined
}

/** 营销类模板:同上,空串按未配置处理。 */
export function pickTencentMarketingTemplateId(key: SmsMarketingTemplateKey): string | undefined {
  const v = env[TENCENT_MARKETING_TEMPLATE_ENV_KEYS[key]]
  return v || undefined
}

/** 从响应里取对账字段。只取 ID,不取任何自由文本。 */
function extractTencentMeta(raw: unknown): { requestId?: string; serialNo?: string } {
  const resp = (raw as { Response?: Record<string, unknown> } | null | undefined)?.Response
  const requestId = typeof resp?.RequestId === 'string' ? resp.RequestId : undefined
  const set = resp?.SendStatusSet
  const first = Array.isArray(set) ? (set[0] as { SerialNo?: unknown } | undefined) : undefined
  const serialNo = typeof first?.SerialNo === 'string' ? first.SerialNo : undefined
  return { requestId, serialNo }
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

/** 腾讯云配置缺项的人话说明。四处缺一样就发不出去。 */
function tencentMissingConfig(): string | null {
  if (!env.TENCENT_SMS_SECRET_ID || !env.TENCENT_SMS_SECRET_KEY) return 'TENCENT_SMS_SECRET_ID/KEY'
  if (!env.TENCENT_SMS_SDK_APP_ID)
    return 'TENCENT_SMS_SDK_APP_ID(控制台「应用管理」创建,未创建就没有这个 ID)'
  if (!env.TENCENT_SMS_SIGN_NAME) return 'TENCENT_SMS_SIGN_NAME'
  return null
}

/** 通用 SendSms:模板与变量由调用方给。变量为空时**不传** TemplateParamSet ——
 *  通知/营销模板不允许任何变量,传空数组在部分接口版本会被判成参数不合法。 */
export async function sendViaTencentTemplate(
  phone: string,
  templateId: string,
  params: string[] = [],
): Promise<SmsDeliveryResult> {
  const missing = tencentMissingConfig()
  if (missing) {
    logger.warn('腾讯云短信未配置 ⇒ 判未配置,不记为已发送', {
      phone: maskPhone(phone),
      reason: `not_configured: ${missing}`,
    })
    return { sent: false, reason: `not_configured: ${missing}` }
  }

  const payload: Record<string, unknown> = {
    PhoneNumberSet: [toTencentPhone(phone)],
    SmsSdkAppId: env.TENCENT_SMS_SDK_APP_ID,
    SignName: env.TENCENT_SMS_SIGN_NAME,
    TemplateId: templateId,
  }
  // 腾讯云模板变量按顺序传纯文本数组,不是阿里云那种 JSON 字符串
  if (params.length > 0) payload.TemplateParamSet = params

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
    const raw = await res.json().catch(() => null)
    const verdict = judgeTencentSendResponse(raw)
    if (!verdict.sent) {
      logger.warn('腾讯云短信未发出', { phone: maskPhone(phone), reason: verdict.reason })
    }
    return { ...verdict, ...extractTencentMeta(raw), templateId }
  } catch (e) {
    const reason = `tencent_call_failed:${providerErrorCode(e)}`
    logger.warn('腾讯云短信调用异常', { phone: maskPhone(phone), reason })
    return { sent: false, reason, templateId }
  }
}

/** 经腾讯云 SendSms 投递一枚验证码。*/
export async function sendViaTencent(
  phone: string,
  code: string,
  scene?: SmsScene,
): Promise<SmsDeliveryResult> {
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
  return sendViaTencentTemplate(phone, templateId, [code])
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
