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
 * 进程内已发信标记。
 * notifications 表无幂等键(也没有去重表),故只能覆盖"同进程内同一 job 重投";
 * 跨进程重投的站内信/邮件去重属 F-512(需确定性 jobId + 唯一约束),此处不越界建表。
 */
const sentEmailKeys = new Set<string>()
const SENT_EMAIL_KEYS_MAX = 5000

/** 幂等键:优先 job.id(BullMQ 重试时保持不变),缺省时退回业务三元组。 */
function emailDedupeKey(
  jobId: string | undefined,
  userId: string,
  type: string,
  title: string,
): string {
  return jobId ? `job:${jobId}` : `${userId}:${type}:${title}`
}

/** 记录已发信;超上限时按插入顺序淘汰最旧一条,防止长期运行无界增长。 */
function rememberSentEmail(key: string): void {
  if (sentEmailKeys.size >= SENT_EMAIL_KEYS_MAX) {
    const oldest = sentEmailKeys.values().next().value
    if (oldest !== undefined) sentEmailKeys.delete(oldest)
  }
  sentEmailKeys.add(key)
}

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
        // F-511:出口失败不再吞掉 —— 发送失败/抛错 ⇒ 结构化 error + 抛出,交 BullMQ 记 failed 并重试。
        const dedupeKey = emailDedupeKey(job.id, userId, type, title)
        if (sentEmailKeys.has(dedupeKey)) {
          // 同一 job 重投(重试/重放)且上次已发成功 ⇒ 跳过,避免重复打扰收件人
          server.log.info(
            { jobId: job.id, notificationId: notification.id, userId, channel: 'email' },
            'notification email already sent, skip',
          )
          server.log.info({ jobId: job.id, userId, type, title }, 'notification job processed')
          return { notificationId: notification.id }
        }
        let result: Awaited<ReturnType<typeof sendEmail>>
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
          result = await sendEmail({
            to: email,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          })
        } catch (e) {
          const reason = (e as Error)?.message ?? String(e)
          server.log.error(
            {
              err: e,
              channel: 'email',
              notificationId: notification.id,
              userId,
              jobId: job.id,
              reason,
            },
            'notification email failed',
          )
          throw new Error(
            `notification email failed: channel=email notificationId=${notification.id} ` +
              `jobId=${job.id ?? 'unknown'} reason=${reason}`,
          )
        }
        // stub = 该收件人路由无可用通道(配置缺失),重试不会变好;与 F-36/F-91 同口径不重试。
        if (!result.sent && !result.stub) {
          const reason = result.error ?? 'sendEmail returned sent=false'
          server.log.error(
            {
              channel: 'email',
              notificationId: notification.id,
              userId,
              jobId: job.id,
              provider: result.provider,
              reason,
            },
            'notification email failed',
          )
          throw new Error(
            `notification email failed: channel=email notificationId=${notification.id} ` +
              `jobId=${job.id ?? 'unknown'} reason=${reason}`,
          )
        }
        if (result.sent) rememberSentEmail(dedupeKey)
      }
      server.log.info({ jobId: job.id, userId, type, title }, 'notification job processed')
      return { notificationId: notification.id }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
