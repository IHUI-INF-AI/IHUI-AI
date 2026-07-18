import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker, QUEUE_NAMES, type NotificationJobData, type Job } from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'
import { createNotification } from '../db/notification-queries.js'

/**
 * Notification Worker — 通知处理队列消费者。
 *
 * 职责:
 * 1. DB 落库 createNotification
 * 2. WebSocket 实时推送 server.pushNotification(推送失败不阻塞)
 * 3. 可选邮件触发(email 字段非空时异步发送)
 */
export function startNotificationWorker(server: FastifyInstance): Worker {
  return createWorker<NotificationJobData>(
    server,
    QUEUE_NAMES.notification,
    async (job: Job<NotificationJobData>) => {
      const { userId, type, title, content, data, email, userName } = job.data
      const notification = await createNotification({
        userId,
        type,
        title,
        content: content ?? '',
        data,
      })
      try {
        server.pushNotification(userId, notification)
      } catch {
        /* 推送失败不阻塞 */
      }
      if (email) {
        try {
          await sendEmail({
            to: email,
            subject: title,
            html: `<h2>Hi ${userName ?? ''},</h2><p>${content ?? ''}</p>`,
          })
        } catch (e) {
          server.log.warn({ err: e, jobId: job.id }, 'notification email failed')
        }
      }
      server.log.info({ jobId: job.id, userId, type, title }, 'notification job processed')
      return { notificationId: notification.id }
    },
  )
}
