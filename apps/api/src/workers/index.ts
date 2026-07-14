import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { sql } from 'drizzle-orm'
import {
  createWorker,
  QUEUE_NAMES,
  type EmailJobData,
  type NotificationJobData,
  type AICallbackJobData,
  type TargetedDispatchJobData,
  type Job,
} from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'
import { sendSmsMessage } from '../services/sms.js'
import { db } from '../db/index.js'
import { createNotification } from '../db/notification-queries.js'
import { createMessage, updateMessage } from '../db/chat-queries.js'

/**
 * 启动所有 BullMQ Worker（异步任务消费者）。
 *
 * 已注册 Worker（4 个，与队列一一对应，无死代码）：
 * - email: 邮件发送（调用 sendEmail 完成 SMTP）
 * - notification: 通知处理（DB 落库 + WebSocket 推送 + 可选邮件触发）
 * - aiCallback: AI 回调处理（持久化 assistant 消息 + token + WebSocket 推送）
 * - notificationDispatch: 定向通知 email/sms 异步派发（send-targeted 端点入队）
 */
export function startWorkers(server: FastifyInstance): Worker[] {
  const workers: Worker[] = []

  // ===== Email Worker =====
  const emailWorker = createWorker<EmailJobData>(
    server,
    QUEUE_NAMES.email,
    async (job: Job<EmailJobData>) => {
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
    },
  )
  workers.push(emailWorker)

  // ===== Notification Worker =====
  const notificationWorker = createWorker<NotificationJobData>(
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
  workers.push(notificationWorker)

  // ===== AI Callback Worker =====
  // 由 AI service 推理完成后回调 /api/ai/callback 入队
  // 职责:持久化 assistant 消息(或更新占位消息)+ token 用量 + WebSocket 多端推送
  const aiCallbackWorker = createWorker<AICallbackJobData>(
    server,
    QUEUE_NAMES.aiCallback,
    async (job: Job<AICallbackJobData>) => {
      const { conversationId, userId, messageId, content, tokens, metadata } = job.data

      let savedMessage
      if (messageId) {
        // 更新已有的占位 assistant 消息(前端预先创建的场景)
        // 只 catch "消息不存在"的预期错误,DB 错误应 rethrow 触发 BullMQ 重试
        try {
          savedMessage = await updateMessage(messageId, userId, {
            content,
            tokens: tokens,
            metadata,
          })
        } catch (e) {
          // 更新失败(消息不存在或权限不符)时降级创建,其他错误 rethrow 触发重试
          const errMsg = e instanceof Error ? e.message : String(e)
          if (
            errMsg.includes('不存在') ||
            errMsg.includes('not found') ||
            errMsg.includes('undefined')
          ) {
            server.log.warn(
              { jobId: job.id, messageId },
              'updateMessage failed (not found), falling back to createMessage',
            )
          } else {
            throw e
          }
        }
      }

      if (!savedMessage) {
        // 直接创建新的 assistant 消息
        savedMessage = await createMessage({
          conversationId,
          role: 'assistant',
          content,
          tokens: tokens,
          metadata,
        })
      }

      // WebSocket 多端同步推送
      // clientMessageId: 前端占位消息 ID(非 DB ID),前端用它匹配本地占位消息并替换
      try {
        server.pushNotification(userId, {
          type: 'ai_response',
          conversationId,
          clientMessageId: messageId || undefined, // 前端 store UUID
          message: savedMessage, // DB 消息(含真实 DB id)
        })
      } catch {
        /* 推送失败不阻塞 */
      }

      server.log.info(
        { jobId: job.id, conversationId, userId, messageId: savedMessage.id, tokens },
        'ai callback job processed',
      )
      return { messageId: savedMessage.id }
    },
  )
  workers.push(aiCallbackWorker)

  // ===== Notification Dispatch Worker =====
  // send-targeted 端点的 email/sms 异步派发：调用 email-service/sms-service 发送，
  // 并写入 notification_logs 记录结果。in_app 渠道在端点同步处理，不经过此队列。
  const notificationDispatchWorker = createWorker<TargetedDispatchJobData>(
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
  workers.push(notificationDispatchWorker)

  server.log.info(
    {
      workers: workers.length,
      names: [
        QUEUE_NAMES.email,
        QUEUE_NAMES.notification,
        QUEUE_NAMES.aiCallback,
        QUEUE_NAMES.notificationDispatch,
      ],
    },
    'BullMQ workers started (all 4 queues have consumers)',
  )

  return workers
}
