// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { renderNoticeEmail } from '../services/email-templates.js'
import { sendEmail } from '../services/email-service.js'
import { checkAuthOrInternalService } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 邮件(legacy /public-api/mail/send + /public-api/mail/send/html 补开发,2 个端点)
// 业务逻辑参考 D 盘 MailController + MailServiceImpl
// 复用现有 email-service.ts(sendEmail,SMTP 配置缺失时自动降级为 stub)
// =============================================================================

// 鉴权口径(2026-09-24 owner 拍板收口):两端点原样保持 Java 公开无鉴权行为,
// 等于对外开放邮件中继 + 任意 HTML 注入面。现挂 checkAuthOrInternalService:
// 人侧 JWT 优先、内部服务 X-Internal-Service-Token 兜底,匿名请求一律 401。
// 仓内 grep 零调用方(对外仅 Java 旧系统兼容),加鉴权无已知破坏面。

// 限流档位为何取 max 10/min/IP(2026-09-23):
// - 公开无鉴权的邮件发送是滥用代价最高的面(SMTP 配额 + 发信域名信誉),必须比
//   全局兜底(生产 100/min/IP,见 server.ts rateLimit 注册)更严;
// - 仓内同族公开写端点档位:登录/验证码 3-5/min 是"终端用户交互"节奏,
//   而本端点调用方是业务系统(表单通知/单事件 fan-out),单 IP 正常不会超 10 封/分钟;
//   再低(如 5)会卡死批量回调,再高(如 20+)失去对倒库 spam 的拦截意义;
// - @fastify/rate-limit 按"路由×IP"独立计数,两端的桶互不挤占。
const MAIL_SEND_RATE_LIMIT = { max: 10, timeWindow: '1 minute' }

const emailSchema = z.object({
  to: z.string().min(1, '收件人不能为空').max(2000, '收件人列表过长'),
  cc: z.transform(emptyToUndefined).pipe(z.string().max(2000).optional()),
  bcc: z.transform(emptyToUndefined).pipe(z.string().max(2000).optional()),
  subject: z.string().min(1, '主题不能为空').max(500, '主题过长'),
  text: z.string().min(1, '邮件内容不能为空').max(100_000, '邮件内容过长'),
  from: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
  fromName: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
  replyTo: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const emailHtmlSchema = z.object({
  to: z.string().min(1, '收件人不能为空').max(2000, '收件人列表过长'),
  cc: z.transform(emptyToUndefined).pipe(z.string().max(2000).optional()),
  bcc: z.transform(emptyToUndefined).pipe(z.string().max(2000).optional()),
  subject: z.string().min(1, '主题不能为空').max(500, '主题过长'),
  html: z.string().min(1, 'HTML 内容不能为空').max(500_000, 'HTML 内容过长'),
  from: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
  fromName: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
  replyTo: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const mailRoutes: FastifyPluginAsync = async (server) => {
  // POST /send — 发送纯文本邮件(Java: POST /public-api/mail/send)
  server.post(
    '/send',
    { preHandler: checkAuthOrInternalService, config: { rateLimit: MAIL_SEND_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = emailSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { to, cc, bcc, subject, text, from, fromName, replyTo } = parsed.data
      // 拼接完整收件人(to + cc + bcc),email-service 单 to 字段处理
      const fullTo = [to, cc, bcc].filter(Boolean).join(',')
      // 品牌版式唯一真相源 renderNoticeEmail:其内部已 escapeHtml(勿二次转义),
      // subject/text 语义与旧手搓版一致,仅把无样式 <br/> HTML 升级为机械风通报;
      // 纯文本字段保留模板返回的 text,保证纯文本客户端可读
      const mail = renderNoticeEmail({ tag: 'SYSTEM // NOTICE', title: subject, content: text })
      const result = await sendEmail({
        to: fullTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
      // 记录扩展字段(from/fromName/replyTo)到日志:email-service 当前忽略,后续可扩展
      if (from || fromName || replyTo) {
        request.log.info(
          { from, fromName, replyTo, to: fullTo, subject },
          'mail/send 扩展字段(当前未应用)',
        )
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
    },
  )

  // POST /send/html — 发送 HTML 格式邮件(Java: POST /public-api/mail/send/html)
  // 接受调用方自带 HTML 是本端点存在的理由(对外契约),但它因此成为品牌版式之外
  // 的有意保留的第二份真相 —— 显式 warn 记录,防止后来者误判为"漏接模板层"并回退
  server.post(
    '/send/html',
    { preHandler: checkAuthOrInternalService, config: { rateLimit: MAIL_SEND_RATE_LIMIT } },
    async (request, reply) => {
      const parsed = emailHtmlSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { to, cc, bcc, subject, html, from, fromName, replyTo } = parsed.data
      request.log.warn(
        { to, subject },
        'mail/send/html 客户自带 HTML,不经品牌模板层(有意保留的第二份真相,勿当作漏改回退)',
      )
      const fullTo = [to, cc, bcc].filter(Boolean).join(',')
      const result = await sendEmail({
        to: fullTo,
        subject,
        html,
        text: html.replace(/<[^>]*>/g, ''),
      })
      if (from || fromName || replyTo) {
        request.log.info(
          { from, fromName, replyTo, to: fullTo, subject },
          'mail/send/html 扩展字段(当前未应用)',
        )
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
    },
  )
}

export default mailRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
