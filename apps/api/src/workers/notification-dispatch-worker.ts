import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { sql } from 'drizzle-orm'
import {
  createWorker,
  QUEUE_NAMES,
  type TargetedDispatchJobData,
  type Job,
} from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'
import { sendSmsMessage } from '../services/sms.js'
import { db } from '../db/index.js'

/**
 * Notification Dispatch Worker — 定向通知派发队列消费者。
 *
 * send-targeted 端点的 email/sms 异步派发:
 * - 调用 email-service / sms-service 发送
 * - 写入 notification_logs 记录结果
 *
 * in_app 渠道在端点同步处理(WebSocket 实时推送),不经过此队列。
 */
export function startNotificationDispatchWorker(server: FastifyInstance): Worker {
  return createWorker<TargetedDispatchJobData>(
    server,
    QUEUE_NAMES.notificationDispatch,
    async (job: Job<TargetedDispatchJobData>) => {
      const { userId, channel, email, phone, nickname, title, content, msgType } = job.data
      let status = 'sent'
      let errorMessage: string | null = null

      try {
        if (channel === 'email') {
          const result = await sendEmail({
            to: email!,
            subject: title,
            html: `<h2>Hi ${nickname ?? email},</h2><p>${content}</p>`,
            text: content,
          })
          if (result.sent) {
            status = 'sent'
          } else if (result.stub) {
            status = 'stub'
          } else {
            status = 'failed'
            errorMessage = result.error ?? null
          }
        } else {
          const result = await sendSmsMessage(phone!, content)
          if (!result.success) {
            status = 'failed'
            errorMessage = result.error ?? null
          }
        }
      } catch (e) {
        status = 'failed'
        errorMessage = (e as Error).message
      }

      try {
        await db.execute(sql`
          INSERT INTO notification_logs (user_id, type, title, content, channel, status, error_message, created_at)
          VALUES (${userId}::uuid, ${msgType}, ${title}, ${content}, ${channel}, ${status}, ${errorMessage}, NOW())
        `)
      } catch (e) {
        server.log.warn({ err: e, jobId: job.id }, 'notification_dispatch log insert failed')
      }

      server.log.info(
        { jobId: job.id, userId, channel, status },
        'notification dispatch job processed',
      )
      return { userId, channel, status }
    },
  )
}
