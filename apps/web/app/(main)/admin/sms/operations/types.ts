// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** /api/admin/sms 运营面板类型,与 apps/api/src/routes/admin-sms.ts 的响应逐字段对齐。 */

export type SmsCategory = 'notice' | 'marketing'

/** 腾讯云审核状态。unknown = 查询失败或云侧给了未知状态码。 */
export type SmsReviewStatus = 'approved' | 'pending' | 'rejected' | 'unknown'

export interface SmsReviewInfo {
  status: SmsReviewStatus
  reply?: string
  updatedAt?: string
}

export interface SmsTemplateRow {
  category: SmsCategory
  key: string
  envKey: string
  templateId: string | null
  ready: boolean
  /** 没有模板 ID 时为 null(尚未提交审核)。 */
  reviewStatus: SmsReviewStatus | null
  reviewReply: string | null
  reviewedAt: string | null
}

export interface SmsStatus {
  provider: string
  tencent: {
    configured: boolean
    signName: string | null
    signId: string | null
    signReview: SmsReviewInfo | null
    sdkAppId: string | null
    region: string
    codeTemplates: Record<string, string | null>
  }
  aliyun: {
    configured: boolean
    signName: string | null
    codeTemplate: string | null
    notifyTemplate: string | null
  }
  proxy: { configured: boolean }
  callback: {
    tokenConfigured: boolean
    ipAllowlistConfigured: boolean
    path: string
  }
  compliance: {
    unsubscribeFailClosed: boolean
    unsubscribeCount: number
    marketingEnabled: boolean
    marketingMonthlyCap: number
    marketingDailyCap: number
    marketingGlobalDailyCap: number
    marketingSendWindow: string
    noticeHourlyCap: number
    noticeDailyCap: number
  }
  templates: SmsTemplateRow[]
  review: {
    available: boolean
    checkedAt: string | null
    errorCode: string | null
    signAvailable: boolean | null
  }
  broadcastLimit: number
  broadcastExcludeRecentDays: number
}

export interface SmsSendResponse {
  sent: boolean
  success?: boolean
  error?: string
  provider?: string
  requestId?: string
  templateId?: string
  /** 同一 bizType+bizId 已发过时后端回 true(业务上视为已达成,不重复发) */
  deduplicated?: boolean
}

export interface SmsBroadcastFailure {
  userId?: string
  phone?: string
  success?: boolean
  error?: string
  provider?: string
  requestId?: string
  templateId?: string
}

export interface SmsBroadcastResponse {
  dryRun?: boolean
  runId?: string
  total: number
  sent?: number
  failed?: number
  suppressed?: number
  /** 群发范围内的号码总数(排除近期已收者之前)。 */
  scopeTotal?: number
  /** 排除近期已收者后、本次可发的号码数。 */
  eligible?: number
  /** 因近 N 天已成功收到同模板而被跳过的号码数。 */
  excludedRecent?: number
  excludeRecentDays?: number
  /** 目标批次游标(跳过前 N 个符合条件的目标)。 */
  targetOffset?: number
  /** 未携带 requestId 时的提示:超时重试可能重复发送。 */
  idempotentHint?: string | null
  channel?: string
  templateId?: string | null
  envKey?: string
  samplePhones?: string[]
  failures?: SmsBroadcastFailure[]
}

export interface SmsDeliveryLog {
  id: string
  provider: string
  category: string
  template_key: string | null
  template_id: string | null
  phone: string
  status: string
  reason: string | null
  request_id: string | null
  serial_no: string | null
  biz_type: string | null
  biz_id: string | null
  created_at: string
  updated_at: string
}

export interface SmsUnsubscribe {
  phone: string
  reason: string | null
  source: string | null
  raw_content: string | null
  created_at: string
  updated_at: string
}

export interface SmsLogsResponse {
  items: SmsDeliveryLog[]
  /** 当前过滤条件下的总条数(不只是本页)。 */
  total: number
  /** 当前过滤条件下各状态计数。 */
  counts: Record<string, number>
  limit: number
  offset: number
}

export interface SmsUnsubscribesResponse {
  items: SmsUnsubscribe[]
  total: number
  limit: number
  offset: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
