// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全量广播邮件服务 — 更新推送(更新日志/新品上线)群发通道。
 *
 * 设计要点:
 * - 收件人 = 状态正常(status=1)且有邮箱的用户;单封失败不影响其他;
 * - 分批并发(BROADCAST_CONCURRENCY)防止 SMTP 连接被打满;
 * - 渲染一律走 email-templates(智汇通报版式),本服务只负责"查人 + 发送 + 统计"。
 */

import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '@ihui/database'
import type { DispatchEmail } from './email-templates.js'

export interface EmailRecipient {
  id: string
  email: string | null
  nickname: string | null
}

/** 全量可推送收件人:正常状态且邮箱非空的用户。 */
export async function listEmailRecipients(): Promise<EmailRecipient[]> {
  return db
    .select({ id: users.id, email: users.email, nickname: users.nickname })
    .from(users)
    .where(and(eq(users.status, 1), isNotNull(users.email), ne(users.email, '')))
}

/** 广播并发批次大小(SMTP 友好)。 */
export const BROADCAST_CONCURRENCY = 10

/**
 * 群发 Dispatch 邮件(分批并发,单封失败计入 failed 不中断)。
 * 调用方自行决定同步等待统计还是 fire-and-forget。
 *
 * 计数口径(2026-09-23 修正):只有 result.sent === true 才算 sent。
 * sendEmail 对 stub/失败不 throw,按 allSettled 的 fulfilled 计数的旧口径
 * 会把"通道未开、一封没发"报告成"全部送达"(群发报告失真的根因)。
 */
export async function broadcastDispatchEmail(
  mail: DispatchEmail,
  recipients: EmailRecipient[],
): Promise<{ total: number; sent: number; failed: number; stubbed?: number }> {
  const { sendEmail } = await import('./email-service.js')
  const targets = recipients.filter((r) => r.email)
  let sent = 0
  let failed = 0
  let stubbed = 0
  for (let i = 0; i < targets.length; i += BROADCAST_CONCURRENCY) {
    const batch = targets.slice(i, i + BROADCAST_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map((r) =>
        sendEmail({
          to: r.email as string,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          scene: 'notification',
          userId: r.id,
        }),
      ),
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.sent) {
        sent++
      } else {
        failed++
        // stub(配置缺失导致未发送)单独计数:与"通道故障"区分,运维按 stubbed>0 查配置
        if (r.status === 'fulfilled' && r.value.stub) stubbed++
      }
    }
  }
  return { total: targets.length, sent, failed, stubbed }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
