// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  renderMaintenanceNoticeEmail,
  type MaintenanceNoticeInput,
} from '../services/email-templates.js'
import { listEmailRecipients, broadcastDispatchEmail } from '../services/broadcast-email-service.js'

/**
 * O29「智汇通报」维护公告邮件 — admin 发信入口(把 renderMaintenanceNoticeEmail 装车)。
 *
 * 契约:
 * - 鉴权面统一 requireAdmin(roleId >= 1,只认人用 JWT,internal token 链路开不了本面);
 * - 收件人一律服务端取"状态正常且有邮箱的用户"(listEmailRecipients),
 *   **不接受请求侧传邮箱列表**(公开中继 mail.ts 的滥用面不得在此复刻);
 * - dryRun=true 只报收件人数不发送;limit 控制首批发送量(缺省全量);
 * - 发送只走 broadcastDispatchEmail → sendEmail(渲染一律经 email-templates,路由零拼 HTML);
 * - 与 content.ts 的 email-push fire-and-forget 不同,本端点 **await 发送并回真统计**
 *   (2026-09-23 计数口径:stats 按 result.sent 真计),运维需小批量先 dryRun + limit。
 */

const sendSchema = z.object({
  window: z.string().trim().min(1, '维护窗口不能为空').max(64),
  scope: z.string().trim().min(1, '影响范围不能为空').max(200),
  downtime: z.string().trim().min(1, '预计停机时长不能为空').max(64),
  dryRun: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(5000).optional(),
})

/** 发送结果(dryRun 只回 pool/total;实发回 broadcast 真统计) */
export interface MaintenanceNoticeSendData {
  dryRun: boolean
  /** 本次实际纳入发送范围的收件人数 */
  total: number
  /** 全量可推送收件人数(未截断前的池子大小) */
  pool: number
  /** 实发统计(dryRun 时缺省) */
  stats?: {
    sent: number
    failed: number
    stubbed: number
  }
  /** 邮件主题(供前端结果回执展示) */
  subject: string
}

export const adminMaintenanceNoticeRoutes: FastifyPluginAsync = async (server) => {
  // 统一管理员鉴权(与 admin-sensitive-words 同形态)
  server.addHook('preHandler', requireAdmin)

  // POST /maintenance-notice/email — 群发维护公告邮件
  server.post('/maintenance-notice/email', async (request, reply) => {
    const parsed = sendSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { window, scope, downtime, dryRun, limit } = parsed.data

    const recipients = await listEmailRecipients()
    const targets = typeof limit === 'number' ? recipients.slice(0, limit) : recipients

    const input: MaintenanceNoticeInput = { window, scope, downtime }
    const mail = renderMaintenanceNoticeEmail(input)

    if (dryRun) {
      const data: MaintenanceNoticeSendData = {
        dryRun: true,
        total: targets.length,
        pool: recipients.length,
        subject: mail.subject,
      }
      return reply.send(success(data))
    }

    const stats = await broadcastDispatchEmail(mail, targets)
    request.log.info(
      {
        total: stats.total,
        sent: stats.sent,
        failed: stats.failed,
        stubbed: stats.stubbed,
        operator: request.userId,
      },
      '维护公告邮件群发完成',
    )
    const data: MaintenanceNoticeSendData = {
      dryRun: false,
      total: stats.total,
      pool: recipients.length,
      stats: { sent: stats.sent, failed: stats.failed, stubbed: stats.stubbed ?? 0 },
      subject: mail.subject,
    }
    return reply.send(success(data))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
