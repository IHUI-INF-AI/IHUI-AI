/**
 * 邮件相关 API(legacy /public-api/mail/send + /send/html 补开发,2 个端点)
 * 对应后端:apps/api/src/routes/mail.ts(prefix: /api/mail)
 * 公开端点,无鉴权(对齐 Java);未配置 SMTP 时自动降级为 stub
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

// ===================== 类型定义 =====================

/** 纯文本邮件请求 */
export interface SendMailInput {
  to: string
  cc?: string
  bcc?: string
  subject: string
  text: string
  from?: string
  fromName?: string
  replyTo?: string
}

/** HTML 邮件请求 */
export interface SendHtmlMailInput {
  to: string
  cc?: string
  bcc?: string
  subject: string
  html: string
  from?: string
  fromName?: string
  replyTo?: string
}

/** 邮件发送响应 */
export interface SendMailResult {
  accepted: string[]
  stub: boolean
  message: string
}

// ===================== 端点封装 =====================

/** 发送纯文本邮件 — POST /api/mail/send */
export async function sendMail(input: SendMailInput): Promise<ApiResult<SendMailResult>> {
  return fetchApi<SendMailResult>('/api/mail/send', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 发送 HTML 格式邮件 — POST /api/mail/send/html */
export async function sendHtmlMail(input: SendHtmlMailInput): Promise<ApiResult<SendMailResult>> {
  return fetchApi<SendMailResult>('/api/mail/send/html', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
