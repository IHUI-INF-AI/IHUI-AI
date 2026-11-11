// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker, QUEUE_NAMES, type EmailJobData, type Job } from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'

/**
 * 收件人脱敏:只保留前 2 位本地名 + 域名(user@example.com → us***@example.com),
 * 用于错误信息 —— 便于定位账号而不把完整地址/正文写进日志。
 */
function maskRecipient(email: string): string {
  const at = email.indexOf('@')
  if (at < 1) return '***'
  return `${email.slice(0, 2)}***${email.slice(at)}`
}

/**
 * Email Worker — 邮件发送队列消费者。
 *
 * 职责:从 email 队列取出任务,调用 sendEmail 完成 SMTP 发送。
 * 失败由 BullMQ 自动重试 3 次(指数退避),最终失败入 dead-letter。
 */
export function startEmailWorker(server: FastifyInstance): Worker {
  return createWorker<EmailJobData>(server, QUEUE_NAMES.email, async (job: Job<EmailJobData>) => {
    const result = await sendEmail({
      to: job.data.to,
      subject: job.data.subject,
      html: job.data.html,
      text: job.data.text,
    })
    server.log.info(
      {
        jobId: job.id,
        to: job.data.to,
        subject: job.data.subject,
        sent: result.sent,
        stub: result.stub,
      },
      'email job processed',
    )
    // F-36:sendEmail 失败时**不抛错**,只返回 sent:false;worker 若原样返回,BullMQ 会
    // 记 job 成功 ⇒ 文件头声明的 attempts/backoff 重试与 dead-letter 全部失效,邮件静默丢失。
    // stub(该收件人路由无任何可用通道)= 本地/测试未配 SMTP 的预期状态,必须保持成功,
    // 否则本地开发队列会对每封邮件无限重试。
    if (result.sent === false && !result.stub) {
      throw new Error(
        `email send failed: jobId=${job.id ?? 'unknown'} to=${maskRecipient(job.data.to)} ` +
          `provider=${result.provider} error=${result.error ?? 'unknown'}`,
      )
    }
    return result
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
