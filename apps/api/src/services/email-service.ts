// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { config } from '../config/index.js'
import { logger } from '../utils/logger.js'
import { renderNoticeEmail } from './email-templates.js'
import { emailLogs } from '@ihui/database'
import { db } from '../db/index.js'
import type { FastifyInstance } from 'fastify'
import type { EmailJobData } from '../plugins/queue.js'
import {
  renderVerificationEmail,
  renderWelcomeEmail,
  type VerificationScene,
} from './email-templates.js'

/**
 * 邮箱本地脱敏:user@example.com → u***@example.com
 * 用于 console / 独立 pino 实例打印(绕过 log-sanitizer 插件时的兜底)。
 */
function maskEmail(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email[0]}***${email.slice(at)}`
}

/**
 * 邮件发送服务。
 *
 * 支持的 provider:
 * 1. smtp   — 通用 SMTP(nodemailer),全域名兜底通道(含国内收件人)
 * 2. resend  — Resend REST API(国外邮箱优先)
 * 3. stub    — 无任何 provider 配置时,不发送;logger.warn 点名缺失配置(见 SendEmailResult.reasons)
 *
 * 智能路由(MAIL_PROVIDER=auto):
 * - 收件域名 ∈ DOMESTIC_EMAIL_DOMAINS → smtp(若配置)→ stub
 * - 收件域名国外 → resend(若配置)→ smtp → stub
 *
 * 显式指定 MAIL_PROVIDER=smtp/resend 时跳过智能路由,但仍走 SMTP 兜底。
 */

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  /** 场景:register/login/reset/transaction/marketing/notification/other,用于审计与重发 */
  scene?: string
  /** 关联用户 ID(营销/通知邮件需要,验证码可空) */
  userId?: string
  /** 模板 slug(若使用 message_templates),便于按模板重发 */
  templateSlug?: string
  /** 模板变量(用于重发或回溯) */
  metadata?: Record<string, unknown>
}

/** 邮件发送通道。'stub' = 当前配置下该收件人路由上无任何可用通道(未发送)。 */
export type EmailProvider = 'smtp' | 'resend' | 'stub'

/**
 * provider=stub(未发送)的根因枚举。精确联合而非 string 兜底:
 * 每一项对应一个具体的配置缺失,上层告警与运维工具可按值处置。
 */
export type EmailNotSentReason =
  /** SMTP_ENABLED=false(配置默认值):SMTP 兜底通道整体未开启 — 2026-09-23 全站静默事故根因 */
  | 'smtp_disabled'
  /** SMTP_ENABLED=true 但 SMTP_HOST 为空:兜底通道只配了一半 */
  | 'smtp_host_missing'
  /** 海外收件人路由:RESEND_API_KEY 未配置 */
  | 'resend_api_key_missing'

export interface SendEmailResult {
  sent: boolean
  stub: boolean
  provider: EmailProvider
  error?: string
  /**
   * provider=stub 时:该收件人路由链上全部缺失配置的清单
   * (SMTP 兜底缺口在前、首选通道缺口在后)。纯新增可选字段,
   * 现有调用方语义不变;新调用方据此判定"为什么没发"并决定是否告警。
   */
  reasons?: EmailNotSentReason[]
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
 * 国内主流邮箱域名。用于智能路由判定(国内收件人不走 Resend 海外优先通道)。
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
 * 解析最终使用的 provider 及其路由链上的配置缺口(单一真相源)。
 * 优先级:显式 MAIL_PROVIDER > auto 智能路由 > stub。
 */
interface ProviderResolution {
  provider: EmailProvider
  /** provider='stub' 时非空:该收件人路由链上每一处被跳过的通道缺什么配置 */
  blockers: EmailNotSentReason[]
}

/** SMTP 通道(SMTP_ENABLED && SMTP_HOST)的缺口;null = 可用 */
function smtpBlocker(): EmailNotSentReason | null {
  if (!config.SMTP_ENABLED) return 'smtp_disabled'
  if (!config.SMTP_HOST) return 'smtp_host_missing'
  return null
}

/** Resend 通道(RESEND_API_KEY)的缺口;null = 可用 */
function resendBlocker(): EmailNotSentReason | null {
  return config.RESEND_API_KEY ? null : 'resend_api_key_missing'
}

function resolveProviderWithBlockers(email: string): ProviderResolution {
  const forced = config.MAIL_PROVIDER
  // 显式指定:凭据缺失即 stub(与历史行为逐分支等价,不自动落到其他通道)
  if (forced === 'resend') {
    const b = resendBlocker()
    return b ? { provider: 'stub', blockers: [b] } : { provider: 'resend', blockers: [] }
  }
  if (forced === 'smtp') {
    const b = smtpBlocker()
    return b ? { provider: 'stub', blockers: [b] } : { provider: 'smtp', blockers: [] }
  }

  // auto:按收件域名智能路由
  const smtpB = smtpBlocker()
  if (isDomesticEmail(email)) {
    // 国内收件人:不依赖海外通道,直接走 SMTP 全域名兜底
    if (!smtpB) return { provider: 'smtp', blockers: [] }
    return { provider: 'stub', blockers: [smtpB] }
  }
  const b = resendBlocker()
  if (!b) return { provider: 'resend', blockers: [] }
  if (!smtpB) return { provider: 'smtp', blockers: [] }
  return { provider: 'stub', blockers: [smtpB, b] }
}

export function resolveProvider(email: string): EmailProvider {
  return resolveProviderWithBlockers(email).provider
}

/**
 * 缺口枚举 → 运维可读提示。只写"缺哪个配置键",绝不带键值(防密钥进日志)。
 */
const BLOCKER_HINTS: Record<EmailNotSentReason, string> = {
  smtp_disabled: 'SMTP_ENABLED=false(SMTP 兜底通道未开启)',
  smtp_host_missing: 'SMTP_HOST 未配置(SMTP_ENABLED 已开)',
  resend_api_key_missing: 'RESEND_API_KEY 未配置(海外收件人通道)',
}

function formatBlockerHints(blockers: EmailNotSentReason[]): string {
  return blockers.map((b) => BLOCKER_HINTS[b]).join(' | ')
}

export interface MailTransportDiagnosis {
  providerForDomestic: EmailProvider
  providerForOverseas: EmailProvider
  blockers: EmailNotSentReason[]
}

// 探测用代表地址:resolveProvider 只看域名,不会真的向这两个地址发任何东西
const DIAGNOSTIC_DOMESTIC = 'transport-probe@qq.com'
const DIAGNOSTIC_OVERSEAS = 'transport-probe@gmail.com'

/**
 * 全局邮件通道体检(纯函数、零副作用、任意时刻可调,含单测):
 * 分别探测国内/海外代表域名的最终路由,并汇总两条链路上的配置缺口。
 */
export function diagnoseMailTransport(): MailTransportDiagnosis {
  const domestic = resolveProviderWithBlockers(DIAGNOSTIC_DOMESTIC)
  const overseas = resolveProviderWithBlockers(DIAGNOSTIC_OVERSEAS)
  return {
    providerForDomestic: domestic.provider,
    providerForOverseas: overseas.provider,
    blockers: [...new Set([...domestic.blockers, ...overseas.blockers])],
  }
}

// "两条路都 stub" 是全局性故障,此前只以每封邮件一行静默 stub 的形态存在
// (无人看 console.info)—— 进程加载时响一次。克制原则:非测试环境才跑、
// 只 logger.warn 一行、不抛错、不联网、不读文件(全部判据来自已加载的 config)。
if (config.NODE_ENV !== 'test') {
  const startup = diagnoseMailTransport()
  if (startup.providerForDomestic === 'stub' && startup.providerForOverseas === 'stub') {
    logger.warn(
      `[email-transport] 事务邮件通道全局不可用:国内与海外路由均落到 stub,` +
        `验证码/账单/通知等所有邮件将静默不发送。缺失配置: ${formatBlockerHints(startup.blockers)}`,
    )
  }
}

/**
 * 同步发送邮件(主入口)。
 * 失败时按 provider 链路降级:primary → smtp → stub。
 * 每次发送都会异步写入 email_logs 审计(写日志失败不影响发送结果)。
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resolution = resolveProviderWithBlockers(options.to)
  const primary = resolution.provider

  let result: SendEmailResult
  if (primary === 'stub') {
    // 用 warn 而非 info:静默不发是事务邮件最恶劣的故障形态,日志行必须让
    // 运维一眼看出"缺哪条配置"(如 SMTP_ENABLED=false),而非误诊为"邮件服务商挂了"。
    logger.warn(
      `[email-stub] 邮件未发送(该收件人路由无任何可用通道) To: ${maskEmail(options.to)}, ` +
        `scene: ${options.scene ?? 'unspecified'}, 缺失配置: ${formatBlockerHints(resolution.blockers)}`,
    )
    result = { sent: false, stub: true, provider: 'stub', reasons: resolution.blockers }
  } else {
    result = await dispatch(options, primary)

    // primary 失败 → 尝试 SMTP 兜底(若 SMTP 可用且 primary 不是 SMTP)
    if (!result.sent && primary !== 'smtp' && config.SMTP_ENABLED && config.SMTP_HOST) {
      const fallback = await sendViaSmtp(options)
      if (fallback.sent) {
        logger.warn(
          `[email-fallback] primary=${primary} failed, smtp ok, To: ${maskEmail(options.to)}`,
        )
        result = fallback
      }
    }

    // 最终降级 stub(不抛错,保证调用方不崩)
    if (!result.sent) {
      logger.error(
        `[email-error] provider=${primary} To: ${maskEmail(options.to)} err: ${result.error ?? 'unknown'}`,
      )
    }
  }

  // 异步写审计日志(失败不影响发送结果)
  void recordEmailLog(options, result).catch((e) =>
    logger.warn('[email-log-write-failed]', { err: (e as Error).message }),
  )

  return result
}

/**
 * 按 primary provider 实际发送一次(不降级,降级由 sendEmail 负责)。
 */
async function dispatch(
  options: SendEmailOptions,
  primary: 'resend' | 'smtp',
): Promise<SendEmailResult> {
  if (primary === 'resend') return sendViaResend(options)
  return sendViaSmtp(options)
}

/**
 * 写 email_logs 审计记录。
 * 失败仅 warn,不抛错(邮件主流程已结束,审计失败不应回滚)。
 */
async function recordEmailLog(options: SendEmailOptions, result: SendEmailResult): Promise<void> {
  const status: 'sent' | 'stub' | 'failed' = result.sent ? 'sent' : result.stub ? 'stub' : 'failed'
  await db.insert(emailLogs).values({
    toEmail: options.to,
    subject: options.subject,
    provider: result.provider,
    status,
    error: result.error,
    scene: options.scene ?? null,
    userId: options.userId ?? null,
    templateSlug: options.templateSlug ?? null,
    metadata: options.metadata ?? null,
  })
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
  const from = config.RESEND_FROM || '智汇AI官方 <IHUI-AI@aizhs.top>'
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
 * 发送验证码邮件(场景化)。模板渲染见 email-templates.ts(机械风设计系统)。
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
  scene: EmailCodeScene = 'login',
  nickname?: string,
): Promise<SendEmailResult> {
  const rendered = renderVerificationEmail(code, scene as VerificationScene, nickname)
  const subjectMap: Record<EmailCodeScene, string> = {
    register: '【智汇AI】注册验证码',
    login: '【智汇AI】登录验证码',
    reset: '【智汇AI】重置密码验证码',
  }
  return sendEmail({
    to: email,
    subject: subjectMap[scene],
    html: rendered.html,
    text: rendered.text,
    scene,
    templateSlug: 'verify_code',
    metadata: nickname ? { nickname } : undefined,
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
 * 渲染欢迎邮件并入队(注册成功后调用)。
 * 失败静默降级 — 欢迎信绝不能阻断注册主流程。
 */
export async function queueWelcomeEmail(
  server: FastifyInstance,
  email: string,
  nickname: string,
  maskedId: string,
  initCredits: number,
): Promise<void> {
  const rendered = renderWelcomeEmail({ nickname, maskedId, initCredits })
  await queueEmail(server, {
    to: email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    scene: 'notification',
    templateSlug: 'welcome_account',
  })
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
 * 通知邮件模板表(统一走「智汇通报」品牌版式,内容纯文本自动转义)。
 */
function getNotificationTemplate(
  type: string,
): { subject: string; html: (name: string, data: Record<string, unknown>) => string } | null {
  const render = (title: string, userName: string, content: string): string =>
    renderNoticeEmail({ tag: 'SYSTEM // NOTICE', title, userName, content }).html
  const templates: Record<
    string,
    { subject: string; html: (name: string, data: Record<string, unknown>) => string }
  > = {
    follow: {
      subject: '您有新的关注者',
      html: (name, d) =>
        render(
          '您有新的关注者',
          name,
          `用户 ${String(d.followerName ?? '某人')} 关注了你${d.isMutual ? '(互相关注)' : ''}。`,
        ),
    },
    system: {
      subject: '系统通知',
      html: (name, d) => render('系统通知', name, String(d.content ?? '您有一条新通知')),
    },
    order: {
      subject: '订单状态更新',
      html: (name, d) =>
        render(
          '订单状态更新',
          name,
          `您的订单 ${String(d.orderId ?? '')} 状态已更新为 ${String(d.status ?? '')}。`,
        ),
    },
  }
  return templates[type] ?? templates.system ?? null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
