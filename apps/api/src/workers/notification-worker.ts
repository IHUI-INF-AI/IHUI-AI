// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker, QUEUE_NAMES, type NotificationJobData, type Job } from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'
import { renderNoticeEmail, renderSystemAlertEmail } from '../services/email-templates.js'
import { createNotification } from '../db/notification-queries.js'
import { flattenUntrustedText, sanitizeAlertMessage } from '../utils/alert-text.js'

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
          // 「智汇通报」品牌模板:预算告警走信号红工程框,其余走通用通知版式
          const alertSeverity =
            data && typeof data === 'object' && 'severity' in data
              ? (data as { severity?: unknown }).severity
              : undefined
          /**
           * 这条通道**不经 `pushAlertWithResult`** —— 它是 `queue.add` 直连的邮件出口,
           * 而 `title` / `content` 来自任意入队方(含 `notifications` 表的自由文本列)。
           * 闸门只装在 pushAlert 那个出口上时,这一支就是裸奔(2026-09-27 独立复核抓到,
           * 且当时的提交信息把它算作"已封" —— 声称与实态分叉比缺口本身更糟)。
           * 只归一化**寄出去的那一份**:库里仍存原文,不因发信而损毁数据。
           */
          const mailTitle = flattenUntrustedText(title)
          const mailContent = sanitizeAlertMessage(content ?? '')
          const rendered =
            type === 'BUDGET_ALERT'
              ? renderSystemAlertEmail({
                  severity:
                    alertSeverity === 'critical' || alertSeverity === 'info'
                      ? alertSeverity
                      : 'warning',
                  source: 'BUDGET_ALERT',
                  time: new Date().toLocaleString('zh-CN', {
                    timeZone: 'Asia/Shanghai',
                    hour12: false,
                  }),
                  title: mailTitle,
                  message: mailContent,
                })
              : renderNoticeEmail({
                  tag: 'SYSTEM // NOTICE',
                  title: mailTitle,
                  userName: flattenUntrustedText(userName ?? ''),
                  content: mailContent,
                })
          await sendEmail({
            to: email,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
