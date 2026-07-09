import { config } from '../config/index.js'
import type { FastifyInstance } from 'fastify'
import type { EmailJobData } from '../plugins/queue.js'

/**
 * 邮件发送服务。
 * 无 SMTP 配置时降级为 stub（只记录日志，不发送）。
 *
 * 支持两种模式：
 * 1. 同步发送（sendEmail）：直接调用 SMTP，适合测试或低频场景
 * 2. 异步队列（queueEmail）：通过 BullMQ 入队，由 Worker 异步处理
 *    生产环境推荐使用队列模式，避免请求阻塞与 SMTP 超时级联
 */

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

// nodemailer 的最小类型描摹（避免未安装时类型解析失败）
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
 * 同步发送邮件（实际 SMTP 调用）。
 * 由 BullMQ Worker 调用，或在测试 / 降级场景直接使用。
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ sent: boolean; stub: boolean; error?: string }> {
  if (!config.SMTP_ENABLED || !config.SMTP_HOST) {
    // stub 模式
    console.info(`[email-stub] To: ${options.to}, Subject: ${options.subject}`)
    return { sent: false, stub: true }
  }

  try {
    // 动态导入 nodemailer（避免未安装时崩溃）；使用变量名避免 TS 模块解析失败
    const moduleName: string = 'nodemailer'
    const mod = (await import(moduleName).catch(() => null)) as NodemailerModule | null
    if (!mod) {
      console.info(`[email-stub] nodemailer 未安装, To: ${options.to}`)
      return { sent: false, stub: true, error: 'nodemailer not installed' }
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

    return { sent: true, stub: false }
  } catch (e) {
    console.error(`[email-error] ${options.to}:`, (e as Error).message)
    return { sent: false, stub: false, error: (e as Error).message }
  }
}

/**
 * 异步发送邮件（入队）。
 * 调用方传入 FastifyInstance 以访问 emailQueue 装饰器。
 * 若队列不可用则降级为同步发送。
 */
export async function queueEmail(
  server: FastifyInstance,
  options: SendEmailOptions,
): Promise<{ queued: boolean; jobId?: string; fallback?: boolean; error?: string }> {
  try {
    const queue = (server as unknown as { emailQueue?: { add(name: string, data: EmailJobData): Promise<{ id?: string }> } }).emailQueue
    if (!queue) {
      // 队列未注册，降级为同步发送
      await sendEmail(options)
      return { queued: false, fallback: true }
    }
    const job = await queue.add('send', options)
    return { queued: true, jobId: job.id }
  } catch (e) {
    // 队列异常（如 Redis 不可用），降级为同步发送
    try {
      await sendEmail(options)
      return { queued: false, fallback: true, error: (e as Error).message }
    } catch (e2) {
      return { queued: false, error: (e2 as Error).message }
    }
  }
}

/**
 * 发送通知邮件（根据通知类型选择模板）。
 * 同步版本：直接调用 sendEmail。
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
 * 异步发送通知邮件（入队）。
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
