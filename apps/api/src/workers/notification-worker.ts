// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { createWorker, QUEUE_NAMES, type NotificationJobData, type Job } from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'
import { renderNoticeEmail, renderSystemAlertEmail } from '../services/email-templates.js'
import {
  claimNotificationEmail,
  createNotification,
  createNotificationIdempotent,
  markNotificationEmailSent,
  releaseNotificationEmailClaim,
} from '../db/notification-queries.js'
import { flattenUntrustedText, sanitizeAlertMessage } from '../utils/alert-text.js'

/**
 * F-512:投递幂等键 —— 队列是**至少一次**语义,BullMQ 重投时 `job.id` 不变,
 * 因此以 job 身份作幂等键,配合 `notifications (user_id, idempotency_key)` 唯一索引,
 * 同一条 job 重投只会落一行站内信。
 *
 * 旧实现是进程内 `Set` 记"已发信":只覆盖同进程重投,跨进程/重启即失效,而落库本身
 * 连进程内幂等都没有 —— 崩溃重投就是"两条站内信 + 第二封邮件"(F-512)。
 * 现在状态全在库里:落库去重靠唯一索引,发信去重靠 email_sent_at / email_claimed_at。
 */
function notificationIdempotencyKey(jobId: string | undefined): string | null {
  if (!jobId) return null
  return `job:${jobId}`.slice(0, 128)
}

/**
 * Notification Worker — 通知处理队列消费者。
 *
 * 职责:
 * 1. DB 落库 createNotification(带幂等键:重投不重复落库)
 * 2. WebSocket 实时推送 server.pushNotification(推送失败不阻塞;仅首投推送)
 * 3. 可选邮件触发(email 字段非空时异步发送;发送权经 DB 条件更新抢占,跨实例只发一次)
 */
export function startNotificationWorker(server: FastifyInstance): Worker {
  return createWorker<NotificationJobData>(
    server,
    QUEUE_NAMES.notification,
    async (job: Job<NotificationJobData>) => {
      const { userId, type, title, content, data, email, userName } = job.data
      // F-512:落库幂等。created=false ⇒ 同一条 job 的重投,行已存在,不再新增也不重复推送。
      const idempotencyKey = notificationIdempotencyKey(job.id)
      const inserted = idempotencyKey
        ? await createNotificationIdempotent({
            userId,
            type,
            title,
            content: content ?? '',
            data,
            idempotencyKey,
          })
        : {
            notification: await createNotification({
              userId,
              type,
              title,
              content: content ?? '',
              data,
            }),
            created: true,
          }
      const notification = inserted.notification
      if (inserted.created) {
        try {
          server.pushNotification(userId, notification)
        } catch {
          /* 推送失败不阻塞 */
        }
      } else {
        server.log.info(
          { jobId: job.id, notificationId: notification.id, userId },
          'notification already persisted (idempotent replay), skip push',
        )
      }
      if (email) {
        // F-511:出口失败不再吞掉 —— 发送失败/抛错 ⇒ 结构化 error + 抛出,交 BullMQ 记 failed 并重试。
        // F-512:发送权先经 DB 条件更新抢占(未送达 且 claim 空/过期才命中),
        // 跨进程重投、多实例并发投递时只有一个能发信,不会重复打扰收件人。
        const claimed = await claimNotificationEmail(notification.id)
        if (!claimed) {
          server.log.info(
            { jobId: job.id, notificationId: notification.id, userId, channel: 'email' },
            'notification email already sent or in flight, skip',
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
          // 释放本次抢占:这次没发出去,重投必须还能再抢,不能白等 claim 过期窗口
          await releaseNotificationEmailClaim(notification.id).catch(() => {})
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
          await releaseNotificationEmailClaim(notification.id).catch(() => {})
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
        if (result.sent) {
          // 落"已送达":此后任何重投都只补站内信、不再发信
          await markNotificationEmailSent(notification.id)
        } else {
          // stub:无通道可发 ⇒ 不留已送达痕迹,也不占着 claim 让后续判断失真
          await releaseNotificationEmailClaim(notification.id).catch(() => {})
        }
      }
      server.log.info({ jobId: job.id, userId, type, title }, 'notification job processed')
      return { notificationId: notification.id }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
