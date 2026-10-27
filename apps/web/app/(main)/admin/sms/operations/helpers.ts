// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { apiOrThrow } from '@/lib/api'
import type { SmsCategory, SmsReviewStatus } from './types'

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

export const TEMPLATE_LABELS: Record<string, string> = {
  'binding-success': '手机绑定成功',
  'new-device': '新设备登录提醒',
  'password-changed': '密码修改提醒',
  maintenance: '系统维护通知',
  'account-cancel': '账号注销确认',
  'membership-expiry': '会员到期提醒',
  'payment-success': '支付成功通知',
  'content-reject': '内容审核驳回',
  'security-limit': '安全风控限制',
  'service-restore': '服务恢复通知',
  'new-feature': '新功能上线',
  promo: '优惠活动',
}

/** 腾讯云审核状态 → 徽标文案与色调。null(未回填模板 ID)单独走"未回填"。 */
export const REVIEW_LABELS: Record<
  SmsReviewStatus,
  { label: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  approved: { label: '已生效', tone: 'default' },
  pending: { label: '审核中', tone: 'secondary' },
  rejected: { label: '未通过', tone: 'destructive' },
  unknown: { label: '状态未知', tone: 'outline' },
}

export function reviewLabel(status: SmsReviewStatus | null): {
  label: string
  tone: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  return status ? REVIEW_LABELS[status] : { label: '未回填', tone: 'outline' }
}

export const CATEGORY_LABELS: Record<SmsCategory, string> = {
  notice: '通知类',
  marketing: '营销类',
}

export function templateLabel(key: string): string {
  return TEMPLATE_LABELS[key] ?? key
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as SmsCategory] ?? category
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

/** 台账状态 → 中文与徽标色。未知状态原样显示为 outline。 */
export const LOG_STATUS: Record<
  string,
  { label: string; tone: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  accepted: { label: '已提交', tone: 'secondary' },
  delivered: { label: '已送达', tone: 'default' },
  delivery_failed: { label: '投递失败', tone: 'destructive' },
  failed: { label: '发送失败', tone: 'destructive' },
  suppressed: { label: '已拦截', tone: 'outline' },
}

export function logStatus(status: string): {
  label: string
  tone: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  return LOG_STATUS[status] ?? { label: status, tone: 'outline' }
}

export const PROVIDER_LABELS: Record<string, string> = {
  tencent: '腾讯云',
  aliyun: '阿里云',
  proxy: '自建代理',
  none: '无可用通道',
}

export function providerLabel(p: string): string {
  return PROVIDER_LABELS[p] ?? p
}

/** 失败原因码 → 可读说明。后端只回错误码或配置键名,不夹带云侧原文。 */
export const ERROR_LABELS: Record<string, string> = {
  rate_limited: '单号频控命中',
  suppressed_unsubscribed: '已退订/拒收',
  unsubscribe_check_unavailable: '退订黑名单查询失败(营销 fail-closed)',
  no_channel: '无可用通道(配置缺失)',
  not_configured: '模板或通道未配置',
  outside_marketing_window: '不在营销发送时段(08:00–21:00)',
  marketing_window_closed: '不在营销发送时段(08:00–21:00)',
  global_daily_cap: '营销全局日上限已满',
  marketing_daily_cap_reached: '营销全局日上限已满',
  sdk_unavailable: '云 SDK 不可用',
  aliyun_sdk_unavailable: '阿里云 SDK 不可用',
  aliyun_response_unparsable: '阿里云响应无法解析',
  proxy_call_failed: '自建代理调用失败',
  invalid_template: '模板 key 不合法',
  marketing_disabled: '营销总开关已关闭(SMS_MARKETING_ENABLED=0)',
  duplicate: '同一业务事件已发送(幂等拦截)',
}

export function errorLabel(code: string | undefined): string {
  if (!code) return '-'
  return ERROR_LABELS[code] ?? code
}

/** dryRun 的返回是 `dry_run: <channel>`,不是失败;面板需按预演展示。 */
export function parseDryRun(error: string | undefined): { dryRun: true; channel: string } | null {
  if (!error || !error.startsWith('dry_run:')) return null
  return { dryRun: true, channel: error.slice('dry_run:'.length).trim() || 'not_configured' }
}

export function api<T>(url: string, init?: RequestInit): Promise<T> {
  return apiOrThrow<T>(url, init)
}
