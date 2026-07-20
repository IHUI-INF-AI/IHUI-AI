import { createHmac, createHash } from 'node:crypto'
import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import type { FastifyInstance } from 'fastify'
import type { EmailJobData } from '../plugins/queue.js'

/**
 * 邮件发送服务。
 *
 * 支持的 provider:
 * 1. smtp   — 通用 SMTP(nodemailer),兜底通道
 * 2. resend  — Resend REST API(国外邮箱优先)
 * 3. tencent — 腾讯云 SES V3 签名(国内邮箱优先)
 * 4. stub    — 无任何 provider 配置时,只记录日志(开发环境)
 *
 * 智能路由(MAIL_PROVIDER=auto):
 * - 收件域名 ∈ DOMESTIC_EMAIL_DOMAINS → tencent(若配置)→ smtp → stub
 * - 收件域名国外 → resend(若配置)→ smtp → stub
 *
 * 显式指定 MAIL_PROVIDER=smtp/resend/tencent 时跳过智能路由,但仍走 SMTP 兜底。
 */

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface SendEmailResult {
  sent: boolean
  stub: boolean
  provider: 'smtp' | 'resend' | 'tencent' | 'stub'
  error?: string
}

export type EmailCodeScene = 'register' | 'login' | 'reset'

// nodemailer 的最小类型描摹(避免未安装时类型解析失败)
interface NodemailerTransporter {
  sendMail(opts: {
    from: string
    to: string
    subject: string
    html: string
    text?: string
  }): Promise<unknown>
}

interface NodemailerModule {
  createTransport(opts: {
    host: string
    port: number
    secure: boolean
    auth?: { user: string; pass: string }
  }): NodemailerTransporter
}

/**
 * 国内主流邮箱域名。命中则优先走腾讯云 SES(国内送达率更高)。
 */
const DOMESTIC_EMAIL_DOMAINS = new Set<string>([
  'qq.com',
  'foxmail.com',
  '163.com',
  '126.com',
  'yeah.net',
  'sina.com',
  'sina.cn',
  'sohu.com',
  '139.com',
  'aliyun.com',
  'mail.aliyun.com',
  '189.cn',
  'wo.cn',
  'vip.qq.com',
  'vip.163.com',
  '263.net',
])

/**
 * 判断邮箱是否为国内主流邮箱。
 */
export function isDomesticEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return DOMESTIC_EMAIL_DOMAINS.has(domain)
}

/**
 * 解析最终使用的 provider。
 * 优先级:显式 MAIL_PROVIDER > auto 智能路由 > stub。
 */
export function resolveProvider(email: string): 'resend' | 'tencent' | 'smtp' | 'stub' {
  const forced = config.MAIL_PROVIDER
  if (forced === 'resend' && config.RESEND_API_KEY) return 'resend'
  if (forced === 'tencent' && config.TENCENT_SES_SECRET_ID && config.TENCENT_SES_SECRET_KEY) return 'tencent'
  if (forced === 'smtp' && config.SMTP_ENABLED && config.SMTP_HOST) return 'smtp'

  // auto:按收件域名智能路由
  if (forced === 'auto') {
    if (isDomesticEmail(email)) {
      if (config.TENCENT_SES_SECRET_ID && config.TENCENT_SES_SECRET_KEY) return 'tencent'
      if (config.SMTP_ENABLED && config.SMTP_HOST) return 'smtp'
    } else {
      if (config.RESEND_API_KEY) return 'resend'
      if (config.SMTP_ENABLED && config.SMTP_HOST) return 'smtp'
    }
  }
  return 'stub'
}

/**
 * 同步发送邮件(主入口)。
 * 失败时按 provider 链路降级:primary → smtp → stub。
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const primary = resolveProvider(options.to)

  if (primary === 'stub') {
    console.info(`[email-stub] To: ${options.to}, Subject: ${options.subject}`)
    return { sent: false, stub: true, provider: 'stub' }
  }

  let result: SendEmailResult | null = null
  if (primary === 'resend') result = await sendViaResend(options)
  else if (primary === 'tencent') result = await sendViaTencentSes(options)
  else if (primary === 'smtp') result = await sendViaSmtp(options)

  if (result?.sent) return result

  // primary 失败 → 尝试 SMTP 兜底(若 SMTP 可用且 primary 不是 SMTP)
  if (result && !result.sent && primary !== 'smtp' && config.SMTP_ENABLED && config.SMTP_HOST) {
    const fallback = await sendViaSmtp(options)
    if (fallback.sent) {
      logger.warn(`[email-fallback] primary=${primary} failed, smtp ok, To: ${options.to}`)
      return fallback
    }
  }

  // 最终降级 stub(不抛错,保证调用方不崩)
  if (result && !result.sent) {
    logger.error(
      `[email-error] provider=${primary} To: ${options.to} err: ${result.error ?? 'unknown'}`,
    )
  }
  return (
    result ?? {
      sent: false,
      stub: true,
      provider: 'stub',
      error: 'no provider resolved',
    }
  )
}

/**
 * SMTP 通道(nodemailer)。
 */
async function sendViaSmtp(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!config.SMTP_ENABLED || !config.SMTP_HOST) {
    return { sent: false, stub: false, provider: 'smtp', error: 'smtp not configured' }
  }
  try {
    const moduleName: string = 'nodemailer'
    const mod = (await import(moduleName).catch(() => null)) as NodemailerModule | null
    if (!mod) {
      return { sent: false, stub: false, provider: 'smtp', error: 'nodemailer not installed' }
    }
    const transporter = mod.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined,
    })
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })
    return { sent: true, stub: false, provider: 'smtp' }
  } catch (e) {
    return { sent: false, stub: false, provider: 'smtp', error: (e as Error).message }
  }
}

/**
 * Resend 通道(REST API,无需 SDK)。
 */
async function sendViaResend(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!config.RESEND_API_KEY) {
    return { sent: false, stub: false, provider: 'resend', error: 'resend not configured' }
  }
  const from = config.RESEND_FROM || 'IHUI AI <noreply@ihui.ai>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return {
        sent: false,
        stub: false,
        provider: 'resend',
        error: `resend ${res.status}: ${errText.slice(0, 200)}`,
      }
    }
    return { sent: true, stub: false, provider: 'resend' }
  } catch (e) {
    return { sent: false, stub: false, provider: 'resend', error: (e as Error).message }
  }
}

/**
 * 腾讯云 SES 通道(SubmitSignUrl 风格的 V3 签名 + SendEmail API)。
 * 文档:https://cloud.tencent.com/document/product/1288/51034
 */
async function sendViaTencentSes(options: SendEmailOptions): Promise<SendEmailResult> {
  if (!config.TENCENT_SES_SECRET_ID || !config.TENCENT_SES_SECRET_KEY) {
    return { sent: false, stub: false, provider: 'tencent', error: 'tencent ses not configured' }
  }
  const from = config.TENCENT_SES_FROM || 'noreply@ihui.ai'
  const region = config.TENCENT_SES_REGION || 'ap-hongkong'
  const host = `ses.${region}.tencentcloudapi.com`
  const endpoint = `https://${host}`

  try {
    const payload = JSON.stringify({
      FromEmailAddress: from,
      Destination: [options.to],
      Subject: options.subject,
      Template: undefined,
      Simple: {
        Html: options.html,
        Text: options.text ?? '',
      },
    })

    const { SignedHeaders, Authorization } = await buildTencentV3Signature({
      secretId: config.TENCENT_SES_SECRET_ID,
      secretKey: config.TENCENT_SES_SECRET_KEY,
      host,
      payload,
      region,
      service: 'ses',
    })

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Host: host,
        'X-TC-Action': 'SendEmail',
        'X-TC-Version': '2020-10-02',
        'X-TC-Region': region,
        'X-TC-Timestamp': String(Math.floor(Date.now() / 1000)),
        Authorization,
        'Content-Type': 'application/json',
        'X-TC-SignedHeaders': SignedHeaders,
      },
      body: payload,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return {
        sent: false,
        stub: false,
        provider: 'tencent',
        error: `tencent ${res.status}: ${errText.slice(0, 200)}`,
      }
    }
    const json = (await res.json().catch(() => ({}))) as { Response?: { Error?: { Message?: string } } }
    if (json.Response?.Error?.Message) {
      return {
        sent: false,
        stub: false,
        provider: 'tencent',
        error: json.Response.Error.Message,
      }
    }
    return { sent: true, stub: false, provider: 'tencent' }
  } catch (e) {
    return { sent: false, stub: false, provider: 'tencent', error: (e as Error).message }
  }
}

/**
 * 构造腾讯云 V3 签名(TC3-HMAC-SHA256)。
 * 参考文档:https://cloud.tencent.com/document/api/213/30654
 */
async function buildTencentV3Signature(params: {
  secretId: string
  secretKey: string
  host: string
  payload: string
  region: string
  service: string
}): Promise<{ SignedHeaders: string; Authorization: string }> {
  const algorithm = 'TC3-HMAC-SHA256'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)

  // Step 1: 拼接规范请求串
  const httpRequestMethod = 'POST'
  const canonicalUri = '/'
  const canonicalQueryString = ''
  const canonicalHeaders = `content-type:application/json\nhost:${params.host}\nx-tc-action:sendemail\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedRequestPayload = sha256Hex(params.payload)
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`

  // Step 2: 拼接签名串
  const credentialScope = `${date}/${params.service}/tc3_request`
  const hashedCanonicalRequest = sha256Hex(canonicalRequest)
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`

  // Step 3: 计算签名
  const secretDate = hmacSha256Raw(`TC3${params.secretKey}`, date)
  const secretService = hmacSha256Raw(secretDate, params.service)
  const secretSigning = hmacSha256Raw(secretService, 'tc3_request')
  const signature = hmacSha256Hex(secretSigning, stringToSign)

  // Step 4: 拼接 Authorization
  const authorization =
    `${algorithm} ` +
    `Credential=${params.secretId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, ` +
    `Signature=${signature}`

  return { SignedHeaders: signedHeaders, Authorization: authorization }
}

function sha256Hex(str: string): string {
  return createHash('sha256').update(str, 'utf8').digest('hex')
}

function hmacSha256Raw(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function hmacSha256Hex(key: string | Buffer, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('hex')
}

/**
 * 渲染验证码邮件 HTML 模板。
 */
function renderVerificationEmailHtml(
  code: string,
  scene: EmailCodeScene,
  nickname?: string,
): string {
  const sceneText =
    scene === 'register' ? '注册账号' : scene === 'reset' ? '重置密码' : '登录账号'
  const greeting = nickname ? `Hi ${nickname},` : 'Hi,'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f7f9;padding:24px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">${greeting}</h2>
    <p style="margin:0 0 8px;color:#475569;font-size:14px;">您的${sceneText}验证码是:</p>
    <div style="margin:16px 0;text-align:center;">
      <span style="display:inline-block;padding:12px 32px;background:#f1f5f9;border-radius:6px;font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;">${code}</span>
    </div>
    <p style="margin:0 0 8px;color:#475569;font-size:13px;">验证码 5 分钟内有效,请勿告知他人。</p>
    <p style="margin:0 0 24px;color:#475569;font-size:13px;">如非本人操作,请忽略此邮件。</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="margin:0;color:#94a3b8;font-size:12px;">IHUI AI 团队</p>
  </div>
</body>
</html>`
}

/**
 * 发送验证码邮件(场景化)。
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  scene: EmailCodeScene = 'login',
  nickname?: string,
): Promise<SendEmailResult> {
  const subjectMap: Record<EmailCodeScene, string> = {
    register: '【IHUI AI】注册验证码',
    login: '【IHUI AI】登录验证码',
    reset: '【IHUI AI】重置密码验证码',
  }
  const html = renderVerificationEmailHtml(code, scene, nickname)
  return sendEmail({
    to: email,
    subject: subjectMap[scene],
    html,
    text: `您的验证码是 ${code},5 分钟内有效。`,
  })
}

/**
 * 异步发送邮件(入队)。
 * 调用方传入 FastifyInstance 以访问 emailQueue 装饰器。
 * 若队列不可用则降级为同步发送。
 */
export async function queueEmail(
  server: FastifyInstance,
  options: SendEmailOptions,
): Promise<{ queued: boolean; jobId?: string; fallback?: boolean; error?: string }> {
  try {
    const queue = (
      server as unknown as {
        emailQueue?: { add(name: string, data: EmailJobData): Promise<{ id?: string }> }
      }
    ).emailQueue
    if (!queue) {
      await sendEmail(options)
      return { queued: false, fallback: true }
    }
    const job = await queue.add('send', options)
    return { queued: true, jobId: job.id }
  } catch (e) {
    try {
      await sendEmail(options)
      return { queued: false, fallback: true, error: (e as Error).message }
    } catch (e2) {
      return { queued: false, error: (e2 as Error).message }
    }
  }
}

/**
 * 发送通知邮件(根据通知类型选择模板)。
 */
export async function sendNotificationEmail(
  userEmail: string,
  userName: string,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const template = getNotificationTemplate(type)
  if (!template) return
  await sendEmail({
    to: userEmail,
    subject: template.subject,
    html: template.html(userName, data),
  })
}

/**
 * 异步发送通知邮件(入队)。
 */
export async function queueNotificationEmail(
  server: FastifyInstance,
  userEmail: string,
  userName: string,
  type: string,
  data: Record<string, unknown>,
): Promise<void> {
  const template = getNotificationTemplate(type)
  if (!template) return
  await queueEmail(server, {
    to: userEmail,
    subject: template.subject,
    html: template.html(userName, data),
  })
}

/**
 * 通知邮件模板表。
 */
function getNotificationTemplate(
  type: string,
): { subject: string; html: (name: string, data: Record<string, unknown>) => string } | null {
  const templates: Record<
    string,
    { subject: string; html: (name: string, data: Record<string, unknown>) => string }
  > = {
    follow: {
      subject: '您有新的关注者',
      html: (name, d) =>
        `<h2>Hi ${name},</h2><p>用户 ${d.followerName ?? '某人'} 关注了你${d.isMutual ? '(互相关注)' : ''}。</p>`,
    },
    system: {
      subject: '系统通知',
      html: (name, d) => `<h2>Hi ${name},</h2><p>${d.content ?? '您有一条新通知'}</p>`,
    },
    order: {
      subject: '订单状态更新',
      html: (name, d) =>
        `<h2>Hi ${name},</h2><p>您的订单 ${d.orderId ?? ''} 状态已更新为 ${d.status ?? ''}。</p>`,
    },
  }
  return templates[type] ?? templates.system ?? null
}
