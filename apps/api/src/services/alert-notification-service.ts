/**
 * 告警推送服务 -- 多渠道告警通知。
 * 迁移自旧架构 alert_service.py + alert_pagerduty.py + alert_webhook.py。
 *
 * 支持渠道:
 *   - 钉钉 (webhook + HmacSHA256 加签)
 *   - 企业微信 (webhook)
 *   - 飞书 (webhook)
 *   - 邮件 (SMTP via nodemailer)
 *   - PagerDuty (Events API v2: trigger / acknowledge / resolve)
 *   - Slack (incoming webhook)
 *   - Microsoft Teams (incoming webhook)
 *   - 自定义 Webhook (支持 auth header)
 *
 * 设计要点:
 *   - 每个渠道独立, 失败不影响其他渠道
 *   - 每个渠道 5s 超时, 失败重试 1 次
 *   - 多渠道并行推送 (Promise.allSettled)
 *   - 配置全部从环境变量读取
 */

import { createHmac } from 'node:crypto'
import nodemailer from 'nodemailer'
import { pino, type Logger } from 'pino'

const logger: Logger = pino({
  name: 'alert-notification-service',
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
})

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const HTTP_TIMEOUT_MS = 5_000
const SMTP_TIMEOUT_MS = 10_000
const PUSH_RETRY = 1
const PAGERDUTY_API_URL_DEFAULT = 'https://events.pagerduty.com/v2/enqueue'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface AlertNotification {
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  source: string
  metadata?: Record<string, unknown>
}

export interface AlertPushResult {
  dingtalk: boolean
  wechat: boolean
  feishu: boolean
  email: boolean
  pagerduty: boolean
  slack: boolean
  teams: boolean
  generic: boolean
}

type PagerDutyEventAction = 'trigger' | 'acknowledge' | 'resolve'

type ChannelKey = keyof AlertPushResult

// ---------------------------------------------------------------------------
// 配置加载
// ---------------------------------------------------------------------------

interface AlertConfig {
  dingtalk: { webhook: string; secret: string }
  wechatWork: { webhook: string }
  feishu: { webhook: string }
  email: { host: string; port: number; user: string; password: string; to: string[] }
  pagerduty: { routingKey: string; apiUrl: string }
  slack: { webhook: string }
  teams: { webhook: string }
  generic: { url: string; authHeader: string }
}

function loadConfig(): AlertConfig {
  const emailTo = (process.env.ALERT_EMAIL_TO ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    dingtalk: {
      webhook: process.env.DINGTALK_WEBHOOK ?? '',
      secret: process.env.DINGTALK_SECRET ?? '',
    },
    wechatWork: { webhook: process.env.WECHAT_WORK_WEBHOOK ?? '' },
    feishu: { webhook: process.env.FEISHU_WEBHOOK ?? '' },
    email: {
      host: process.env.SMTP_HOST ?? '',
      port: Number.parseInt(process.env.SMTP_PORT ?? '465', 10) || 465,
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASS ?? '',
      to: emailTo,
    },
    pagerduty: {
      routingKey: process.env.PAGERDUTY_ROUTING_KEY ?? '',
      apiUrl: process.env.PAGERDUTY_API_URL ?? PAGERDUTY_API_URL_DEFAULT,
    },
    slack: { webhook: process.env.SLACK_WEBHOOK ?? '' },
    teams: { webhook: process.env.TEAMS_WEBHOOK ?? '' },
    generic: {
      url: process.env.GENERIC_WEBHOOK_URL ?? '',
      authHeader: process.env.GENERIC_WEBHOOK_AUTH_HEADER ?? '',
    },
  }
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * 统一 POST + 重试封装。
 * 每个请求 5s 超时, 失败重试 1 次 (间隔 300ms * attempt)。
 * successCheck 接收 (statusCode, responseText), 返回是否成功。
 */
async function postWithRetry(
  url: string,
  body: unknown,
  successCheck: (status: number, text: string) => boolean,
  headers?: Record<string, string>,
): Promise<boolean> {
  let lastErr = ''

  for (let attempt = 0; attempt <= PUSH_RETRY; attempt++) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      })
      const text = await resp.text()
      if (resp.status >= 200 && resp.status < 300 && successCheck(resp.status, text)) {
        return true
      }
      lastErr = `http=${resp.status} body=${text.slice(0, 200)}`
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
    }
    if (attempt < PUSH_RETRY) {
      await sleep(300 * (attempt + 1))
    }
  }

  logger.warn({ url, err: lastErr }, 'push failed')
  return false
}

// ---------------------------------------------------------------------------
// 钉钉 (webhook + 加签)
// ---------------------------------------------------------------------------

/**
 * 生成钉钉加签。
 * 算法: HmacSHA256(secret, "${timestamp}\n${secret}") -> base64 -> URL-encode
 */
function signDingTalk(secret: string): { timestamp: string; sign: string } {
  const timestamp = String(Date.now())
  const stringToSign = `${timestamp}\n${secret}`
  const hmac = createHmac('sha256', secret).update(stringToSign, 'utf8')
  const sign = encodeURIComponent(hmac.digest('base64'))
  return { timestamp, sign }
}

async function pushDingTalk(
  webhook: string,
  title: string,
  message: string,
  secret: string,
): Promise<boolean> {
  const body: Record<string, unknown> = {
    msgtype: 'markdown',
    markdown: {
      title,
      text: `### ${title}\n\n${message}\n\n---\n[IHUI Platform 告警]`,
    },
  }

  if (secret) {
    const { timestamp, sign } = signDingTalk(secret)
    body.timestamp = timestamp
    body.sign = sign
  }

  return postWithRetry(webhook, body, (_status, text) => {
    const j = parseJsonSafe(text)
    return j?.errcode === 0
  })
}

// ---------------------------------------------------------------------------
// 企业微信 (webhook)
// ---------------------------------------------------------------------------

async function pushWeChatWork(webhook: string, title: string, message: string): Promise<boolean> {
  const body = {
    msgtype: 'markdown',
    markdown: {
      content: `### ${title}\n${message}\n>[IHUI Platform 告警]`,
    },
  }

  return postWithRetry(webhook, body, (_status, text) => {
    const j = parseJsonSafe(text)
    return j?.errcode === 0
  })
}

// ---------------------------------------------------------------------------
// 飞书 (webhook)
// ---------------------------------------------------------------------------

async function pushFeishu(webhook: string, title: string, message: string): Promise<boolean> {
  const body = {
    msg_type: 'interactive',
    card: {
      header: { title: { tag: 'plain_text', content: title } },
      elements: [{ tag: 'markdown', content: `${message}\n\n[IHUI Platform 告警]` }],
    },
  }

  return postWithRetry(webhook, body, (_status, text) => {
    const j = parseJsonSafe(text)
    // 飞书响应: {"StatusCode": 0, "StatusMessage": "success", ...}
    // 兼容历史: {"code": 0, "msg": "ok"}
    return j?.StatusCode === 0 || j?.code === 0
  })
}

// ---------------------------------------------------------------------------
// Slack (incoming webhook)
// ---------------------------------------------------------------------------

async function pushSlack(
  webhook: string,
  title: string,
  message: string,
  severity: string,
): Promise<boolean> {
  const emojiMap: Record<string, string> = {
    critical: ':rotating_light:',
    warning: ':warning:',
    info: ':information_source:',
  }
  const emoji = emojiMap[severity] ?? ':bell:'
  const body = {
    text: `${emoji} *${title}*\n${message}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `${emoji} *${title}*\n${message}` },
      },
    ],
  }

  return postWithRetry(webhook, body, (_status, text) => {
    // Slack 成功响应: 纯文本 "ok"; 兼容自定义端点 {"ok": true}
    const lower = text.trim().toLowerCase()
    if (lower === 'ok') return true
    const j = parseJsonSafe(text)
    return j?.ok === true || j?.success === true
  })
}

// ---------------------------------------------------------------------------
// Microsoft Teams (incoming webhook)
// ---------------------------------------------------------------------------

async function pushTeams(
  webhook: string,
  title: string,
  message: string,
  severity: string,
): Promise<boolean> {
  const colorMap: Record<string, string> = {
    critical: 'FF0000',
    warning: 'FFA500',
    info: '0078D7',
  }
  const body = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: colorMap[severity] ?? 'FFA500',
    summary: title,
    title,
    text: message,
  }

  return postWithRetry(webhook, body, (_status, text) => {
    // Teams 成功响应: 纯文本 "1"; 兼容 {"ok": true}
    const lower = text.trim().toLowerCase()
    if (lower === '1' || lower === 'ok') return true
    const j = parseJsonSafe(text)
    return j?.ok === true || j?.success === true
  })
}

// ---------------------------------------------------------------------------
// 自定义 Webhook (支持 auth header)
// ---------------------------------------------------------------------------

async function pushGenericWebhook(
  url: string,
  title: string,
  message: string,
  severity: string,
  source: string,
  authHeader: string,
): Promise<boolean> {
  const body = { title, message, severity, source, status: 'ok' }
  const headers: Record<string, string> = {}
  if (authHeader) {
    headers.Authorization = authHeader
  }

  return postWithRetry(
    url,
    body,
    (_status, text) => {
      // 2xx 即视为成功; 但排除响应体中明确的 error/fail
      const j = parseJsonSafe(text)
      if (j?.ok === false || j?.success === false) return false
      const lower = text.trim().toLowerCase()
      if (lower.includes('error') || lower.includes('fail')) return false
      return true
    },
    headers,
  )
}

// ---------------------------------------------------------------------------
// PagerDuty Events API v2 (trigger / acknowledge / resolve)
// ---------------------------------------------------------------------------

function mapPagerDutySeverity(severity: string): string {
  const map: Record<string, string> = {
    critical: 'critical',
    warning: 'warning',
    info: 'info',
  }
  return map[severity] ?? 'warning'
}

function makeDedupKey(source: string, title: string): string {
  const parts = [source, title].filter(Boolean)
  return parts.join('/') || 'ihui/unknown'
}

interface PagerDutyEventParams {
  routingKey: string
  title: string
  message: string
  severity: string
  source: string
  dedupKey?: string
  customDetails?: Record<string, unknown>
  eventAction?: PagerDutyEventAction
  apiUrl?: string
}

/**
 * 推送 PagerDuty Events API v2 事件。
 * 支持 trigger / acknowledge / resolve 三种 event_action。
 */
export async function pushPagerDutyEvent(params: PagerDutyEventParams): Promise<boolean> {
  const {
    routingKey,
    title,
    message,
    severity,
    source,
    dedupKey,
    customDetails,
    eventAction = 'trigger',
    apiUrl,
  } = params

  if (!routingKey) {
    logger.warn('PagerDuty routing_key 未配置, 跳过推送')
    return false
  }

  const url = apiUrl ?? PAGERDUTY_API_URL_DEFAULT
  const details: Record<string, unknown> = { ...customDetails, message }
  const body = {
    routing_key: routingKey,
    event_action: eventAction,
    dedup_key: dedupKey ?? makeDedupKey(source, title),
    payload: {
      summary: title,
      source,
      severity: mapPagerDutySeverity(severity),
      timestamp: new Date().toISOString(),
      custom_details: details,
    },
  }

  return postWithRetry(url, body, (_status, text) => {
    const j = parseJsonSafe(text)
    // PagerDuty v2 成功: {"status": "success", ...}; 兼容 mock: {"ok": true}
    return j?.status === 'success' || j?.ok === true || j?.received === true
  })
}

// ---------------------------------------------------------------------------
// 邮件 (SMTP via nodemailer)
// ---------------------------------------------------------------------------

async function pushEmail(
  cfg: AlertConfig['email'],
  title: string,
  message: string,
  severity: string,
): Promise<boolean> {
  if (!cfg.host || !cfg.user || cfg.to.length === 0) {
    return false
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.password ? { user: cfg.user, pass: cfg.password } : undefined,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  })

  let lastErr = ''

  try {
    for (let attempt = 0; attempt <= PUSH_RETRY; attempt++) {
      try {
        await transporter.sendMail({
          from: cfg.user,
          to: cfg.to.join(','),
          subject: `[${severity.toUpperCase()}] ${title}`,
          html: `<h2>${title}</h2><pre>${message}</pre>`,
        })
        return true
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e)
      }
      if (attempt < PUSH_RETRY) {
        await sleep(300 * (attempt + 1))
      }
    }
  } finally {
    transporter.close()
  }

  logger.warn({ err: lastErr }, 'email push failed')
  return false
}

// ---------------------------------------------------------------------------
// 统一入口
// ---------------------------------------------------------------------------

/**
 * 推送告警到所有已配置的渠道 (并行)。
 * 任一渠道失败不影响其他渠道; 返回 void。
 *
 * 如需获取每个渠道的成功状态, 使用 pushAlertWithResult。
 */
export async function pushAlert(notification: AlertNotification): Promise<void> {
  await pushAlertWithResult(notification)
}

/**
 * 推送告警到所有已配置的渠道 (并行), 返回每个渠道的成功状态。
 */
export async function pushAlertWithResult(
  notification: AlertNotification,
): Promise<AlertPushResult> {
  const cfg = loadConfig()
  const { title, message, severity, source, metadata } = notification

  const tasks: Array<[ChannelKey, Promise<boolean>]> = []

  if (cfg.dingtalk.webhook) {
    tasks.push([
      'dingtalk',
      pushDingTalk(cfg.dingtalk.webhook, title, message, cfg.dingtalk.secret),
    ])
  }
  if (cfg.wechatWork.webhook) {
    tasks.push(['wechat', pushWeChatWork(cfg.wechatWork.webhook, title, message)])
  }
  if (cfg.feishu.webhook) {
    tasks.push(['feishu', pushFeishu(cfg.feishu.webhook, title, message)])
  }
  if (cfg.email.host && cfg.email.user && cfg.email.to.length > 0) {
    tasks.push(['email', pushEmail(cfg.email, title, message, severity)])
  }
  if (cfg.pagerduty.routingKey) {
    tasks.push([
      'pagerduty',
      pushPagerDutyEvent({
        routingKey: cfg.pagerduty.routingKey,
        apiUrl: cfg.pagerduty.apiUrl,
        title,
        message,
        severity,
        source,
        customDetails: metadata,
      }),
    ])
  }
  if (cfg.slack.webhook) {
    tasks.push(['slack', pushSlack(cfg.slack.webhook, title, message, severity)])
  }
  if (cfg.teams.webhook) {
    tasks.push(['teams', pushTeams(cfg.teams.webhook, title, message, severity)])
  }
  if (cfg.generic.url) {
    tasks.push([
      'generic',
      pushGenericWebhook(cfg.generic.url, title, message, severity, source, cfg.generic.authHeader),
    ])
  }

  const result: AlertPushResult = {
    dingtalk: false,
    wechat: false,
    feishu: false,
    email: false,
    pagerduty: false,
    slack: false,
    teams: false,
    generic: false,
  }

  if (tasks.length === 0) {
    logger.warn('no alert channel configured, skip push')
    return result
  }

  // 并行推送所有渠道, 任一失败不阻塞其他渠道
  const settled = await Promise.allSettled(tasks.map(([, p]) => p))

  for (let i = 0; i < tasks.length; i++) {
    const [channel] = tasks[i]!
    const s = settled[i]!
    if (s.status === 'fulfilled' && s.value === true) {
      result[channel] = true
    }
  }

  const succeeded = Object.values(result).filter(Boolean).length
  logger.info({ succeeded, total: tasks.length, severity }, 'alert push completed')

  return result
}
