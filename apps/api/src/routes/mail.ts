import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sendEmail } from '../services/email-service.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 邮件(legacy /public-api/mail/send + /public-api/mail/send/html 补开发,2 个端点)
// 业务逻辑参考 D 盘 MailController + MailServiceImpl
// 复用现有 email-service.ts(sendEmail,SMTP 配置缺失时自动降级为 stub)
// =============================================================================

const emailSchema = z.object({
  to: z.string().min(1, '收件人不能为空').max(2000, '收件人列表过长'),
  cc: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  bcc: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  subject: z.string().min(1, '主题不能为空').max(500, '主题过长'),
  text: z.string().min(1, '邮件内容不能为空').max(100_000, '邮件内容过长'),
  from: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  fromName: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  replyTo: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const emailHtmlSchema = z.object({
  to: z.string().min(1, '收件人不能为空').max(2000, '收件人列表过长'),
  cc: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  bcc: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  subject: z.string().min(1, '主题不能为空').max(500, '主题过长'),
  html: z.string().min(1, 'HTML 内容不能为空').max(500_000, 'HTML 内容过长'),
  from: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  fromName: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  replyTo: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const mailRoutes: FastifyPluginAsync = async (server) => {
  // POST /send — 发送纯文本邮件(Java: POST /public-api/mail/send)
  // 公开端点(Java 无鉴权),但写入操作建议登录;此处保持 Java 原行为,不强制鉴权
  server.post('/send', async (request, reply) => {
    const parsed = emailSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { to, cc, bcc, subject, text, from, fromName, replyTo } = parsed.data
    // 拼接完整收件人(to + cc + bcc),email-service 单 to 字段处理
    const fullTo = [to, cc, bcc].filter(Boolean).join(',')
    const result = await sendEmail({
      to: fullTo,
      subject,
      text,
      html: text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>'),
    })
    // 记录扩展字段(from/fromName/replyTo)到日志:email-service 当前忽略,后续可扩展
    if (from || fromName || replyTo) {
      request.log.info({ from, fromName, replyTo, to: fullTo, subject }, 'mail/send 扩展字段(当前未应用)')
    }
    if (!result.sent && !result.stub) {
      return reply.status(500).send(error(500, result.error ?? '邮件发送失败'))
    }
    return reply.status(202).send(
      success({
        accepted: [to],
        stub: result.stub,
        message: result.stub ? '邮件发送降级为 stub(未配置 SMTP)' : '邮件已发送',
      }),
    )
  })

  // POST /send/html — 发送 HTML 格式邮件(Java: POST /public-api/mail/send/html)
  server.post('/send/html', async (request, reply) => {
    const parsed = emailHtmlSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { to, cc, bcc, subject, html, from, fromName, replyTo } = parsed.data
    const fullTo = [to, cc, bcc].filter(Boolean).join(',')
    const result = await sendEmail({
      to: fullTo,
      subject,
      html,
      text: html.replace(/<[^>]*>/g, ''),
    })
    if (from || fromName || replyTo) {
      request.log.info({ from, fromName, replyTo, to: fullTo, subject }, 'mail/send/html 扩展字段(当前未应用)')
    }
    if (!result.sent && !result.stub) {
      return reply.status(500).send(error(500, result.error ?? '邮件发送失败'))
    }
    return reply.status(202).send(
      success({
        accepted: [to],
        stub: result.stub,
        message: result.stub ? '邮件发送降级为 stub(未配置 SMTP)' : 'HTML 邮件已发送',
      }),
    )
  })
}

export default mailRoutes
