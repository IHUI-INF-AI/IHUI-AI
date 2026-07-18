import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker, QUEUE_NAMES, type EmailJobData, type Job } from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'

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
    return result
  })
}
