// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { SmsCategory, SmsReviewStatus } from './types'

/** 组件侧 `useTranslations()` 返回的取值函数;本模块只做「码 → 文案」的查表展示,
 *  不自己持有命名空间(命名空间由调用它的组件决定)。 */
type Translate = (key: string, values?: Record<string, string | number>) => string

/** 徽标色调;与 REVIEW_LABELS / LOG_STATUS 共用。 */
export type BadgeTone = 'default' | 'secondary' | 'destructive' | 'outline'

export const BASE = '/api/admin/sms'

/** 校验用的**归一后**形态:11 位大陆手机号。输入先过 normalizePhoneInput,
 *  与后端 utils/phone.ts 的 PHONE_CN_RE 保持同一条判据。 */
export const PHONE_RE = /^1[3-9]\d{9}$/

/** 去空格/连字符与 +86 / 0086 / 86 前缀。仅做归一,不做合法性判断(交给 PHONE_RE)。
 *  后台表单此前认 `+86`、公开取码端点却不认,同一个号码两处结论相反;
 *  收口后统一成「先归一,再按 11 位校验」。 */
export function normalizePhoneInput(raw: string): string {
  let t = raw.trim().replace(/[\s-]/g, '')
  if (t.startsWith('+86')) t = t.slice(3)
  else if (t.startsWith('0086')) t = t.slice(4)
  else if (t.startsWith('86') && t.length === 13) t = t.slice(2)
  return t
}

/** 与后端 SMS_NOTICE_TEMPLATE_KEYS / SMS_MARKETING_TEMPLATE_KEYS 顺序一致。 */
export const TEMPLATE_KEYS: Record<SmsCategory, string[]> = {
  notice: [
    'binding-success',
    'new-device',
    'password-changed',
    'maintenance',
    'account-cancel',
    'membership-expiry',
    'payment-success',
    'content-reject',
    'security-limit',
    'service-restore',
  ],
  // 「邀请好友」被运营商判为推广拉新、永久不予接入，已从可选集移除
  marketing: ['new-feature', 'promo'],
}

/** 模板码 → i18n 键(命名空间 `admin.smsOperations`,键由组件侧的 `t()` 解析)。 */
export const TEMPLATE_LABEL_KEYS: Record<string, string> = {
  'binding-success': 'template.bindingSuccess',
  'new-device': 'template.newDevice',
  'password-changed': 'template.passwordChanged',
  maintenance: 'template.maintenance',
  'account-cancel': 'template.accountCancel',
  'membership-expiry': 'template.membershipExpiry',
  'payment-success': 'template.paymentSuccess',
  'content-reject': 'template.contentReject',
  'security-limit': 'template.securityLimit',
  'service-restore': 'template.serviceRestore',
  'new-feature': 'template.newFeature',
  promo: 'template.promo',
}

/** 腾讯云审核状态 → i18n 键与徽标色调。null(未回填模板 ID)单独走"未回填"。 */
export const REVIEW_LABELS: Record<SmsReviewStatus, { key: string; tone: BadgeTone }> = {
  approved: { key: 'review.approved', tone: 'default' },
  pending: { key: 'review.pending', tone: 'secondary' },
  rejected: { key: 'review.rejected', tone: 'destructive' },
  unknown: { key: 'review.unknown', tone: 'outline' },
}

export function reviewLabel(status: SmsReviewStatus | null): { key: string; tone: BadgeTone } {
  return status ? REVIEW_LABELS[status] : { key: 'status.notBackfilled', tone: 'outline' }
}

export const CATEGORY_LABEL_KEYS: Record<SmsCategory, string> = {
  notice: 'category.notice',
  marketing: 'category.marketing',
}

/** 码 → 可读文案:命中查表取译文,未命中原样回显该码(空码回显 '-')。
 *  与后端可能新增的码保持向后兼容,不把「没判」显示成空白。
 *  形参泛型化是为了让 `Record<SmsCategory, string>` 这类穷举表也能直接传入。 */
export function codeLabel<K extends string>(
  keys: Record<K, string>,
  code: string | null | undefined,
  t: Translate,
): string {
  if (!code) return '-'
  const key: string | undefined = (keys as Partial<Record<string, string>>)[code]
  return key ? t(key) : code
}

/** PostgreSQL timestamptz → 本地可读时间(浏览器时区)。 */
export function fmtTime(v: unknown): string {
  if (!v) return '-'
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString('zh-CN', { hour12: false })
}

export function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

/** 台账状态 → i18n 键与徽标色。未知状态原样显示为 outline。 */
export const LOG_STATUS: Record<string, { key: string; tone: BadgeTone }> = {
  accepted: { key: 'log.statusAccepted', tone: 'secondary' },
  delivered: { key: 'log.statusDelivered', tone: 'default' },
  delivery_failed: { key: 'log.statusDeliveryFailed', tone: 'destructive' },
  failed: { key: 'log.statusFailed', tone: 'destructive' },
  suppressed: { key: 'log.statusSuppressed', tone: 'outline' },
}

export function logStatus(status: string): {
  key: string
  tone: BadgeTone
  values?: Record<string, string>
} {
  const hit = LOG_STATUS[status]
  return hit
    ? { key: hit.key, tone: hit.tone }
    : { key: 'log.rawCode', tone: 'outline', values: { code: status } }
}

export const PROVIDER_LABEL_KEYS: Record<string, string> = {
  tencent: 'provider.tencent',
  aliyun: 'provider.aliyun',
  proxy: 'provider.proxy',
  none: 'provider.none',
}

/** 失败原因码 → i18n 键。后端只回错误码或配置键名,不夹带云侧原文。
 *  两个同义的旧码(`outside_marketing_window` / `marketing_window_closed` 与
 *  `global_daily_cap` / `marketing_daily_cap_reached`)共用同一条文案,不留第二份。 */
export const ERROR_LABEL_KEYS: Record<string, string> = {
  rate_limited: 'error.rateLimited',
  suppressed_unsubscribed: 'error.suppressedUnsubscribed',
  unsubscribe_check_unavailable: 'error.unsubscribeCheckUnavailable',
  no_channel: 'error.noChannel',
  not_configured: 'error.notConfigured',
  outside_marketing_window: 'error.notInMarketingWindow',
  marketing_window_closed: 'error.notInMarketingWindow',
  global_daily_cap: 'error.globalDailyCapReached',
  marketing_daily_cap_reached: 'error.globalDailyCapReached',
  sdk_unavailable: 'error.sdkUnavailable',
  aliyun_sdk_unavailable: 'error.aliyunSdkUnavailable',
  aliyun_response_unparsable: 'error.aliyunResponseUnparsable',
  proxy_call_failed: 'error.proxyCallFailed',
  invalid_template: 'error.invalidTemplate',
  marketing_disabled: 'error.marketingDisabled',
  duplicate: 'error.duplicate',
}

/** dryRun 的返回是 `dry_run: <channel>`,不是失败;面板需按预演展示。 */
export function parseDryRun(error: string | undefined): { dryRun: true; channel: string } | null {
  if (!error || !error.startsWith('dry_run:')) return null
  return { dryRun: true, channel: error.slice('dry_run:'.length).trim() || 'not_configured' }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
