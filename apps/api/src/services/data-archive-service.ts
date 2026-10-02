// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 历史数据归档服务（backing service for data-archive-daily 定时任务）。
 * 迁移自旧架构 app/tasks/data_archive_task.py。
 *
 * 每日 04:30 将超过保留期的历史数据从热表迁移到归档表，
 * 减小热表体积，保持查询性能。
 *
 * 归档策略：
 * 1. audit_logs: 保留 90 天，超期记录删除（已有审计快照在 ELK/OTel）
 * 2. chat_messages: 保留 180 天，超期记录删除
 * 3. 通知消息: 保留 30 天，超期已读消息删除
 */

import { and, lt, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { auditLogs, messages, notifications, relayMessages } from '@ihui/database'

export interface ArchiveResult {
  auditLogsArchived: number
  messagesArchived: number
  notificationsArchived: number
  /**
   * relay_messages 归档行数(2026-10-03 数据出域合规整改新增)。
   *
   * 为什么它归到 180 天这一档而不是 llm_call_logs 的 30 天:
   * relay_messages 是**用户可见的会话历史**(web 端会话列表读的就是它),
   * 与 llm_call_logs 里"只为排障存在的原文副本"性质不同 —— 后者按 30 天清原文
   * 不影响任何用户可见功能,前者按 30 天删等于砸掉聊天记录。
   * 所以它与 IM messages 同档(180 天),而不是被塞进原文档那一档。
   */
  relayMessagesArchived: number
  errors: string[]
}

/**
 * 执行每日数据归档。
 * 使用 DELETE ... WHERE created_at < threshold 语义清理过期热数据。
 * 归档前数据已被 OTel/ELK/Grafana 消费，无需单独归档表。
 */
export async function archiveDailyData(): Promise<ArchiveResult> {
  const errors: string[] = []
  const now = new Date()

  // 阈值计算
  const auditThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) // 90 天前
  const messageThreshold = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000) // 180 天前
  const notifThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 天前

  let auditLogsArchived = 0
  let messagesArchived = 0
  let notificationsArchived = 0
  let relayMessagesArchived = 0

  try {
    // 归档 audit_logs（90 天前）
    const auditResult = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, auditThreshold))
      .returning({ id: auditLogs.id })
    auditLogsArchived = auditResult.length
  } catch (err) {
    errors.push(`audit_logs archive failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    // 归档 IM 消息（180 天前）。
    //
    // 注释订正(2026-10-03):原文写的是"归档 chat messages",但这里删的是
    // `messages`(IM 表),**不是** chat_messages(AI 对话表)。这个错名有实际
    // 代价:读代码的人会以为"AI 对话记录已有 180 天清理",而它其实一张都没清 ——
    // 于是 chat_messages 成了全仓留存面里最容易被误判为"已治理"的那张表。
    const msgResult = await db
      .delete(messages)
      .where(lt(messages.createdAt, messageThreshold))
      .returning({ id: messages.id })
    messagesArchived = msgResult.length
  } catch (err) {
    errors.push(`messages archive failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    // relay_messages:用户可见的 LLM 会话历史(180 天前,同 IM messages 档)。
    //
    // 2026-10-03 新增。此前这张表**没有任何清理路径** —— 而它存的是完整对话
    // 正文(`content` NOT NULL),且 logId 外键是 onDelete:'set null',意味着
    // llm_call_logs 那边把原文purge 掉之后,**同一份原文在这里依然完整存在**,
    // 30 天原文档治理等于被这个外键绕开。堵上这个口是本次整改的一部分。
    const relayResult = await db
      .delete(relayMessages)
      .where(lt(relayMessages.createdAt, messageThreshold))
      .returning({ id: relayMessages.id })
    relayMessagesArchived = relayResult.length
  } catch (err) {
    errors.push(
      `relay_messages archive failed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  try {
    // 归档已读通知（30 天前，仅删除已读的）
    const notifResult = await db
      .delete(notifications)
      .where(and(lt(notifications.createdAt, notifThreshold), eq(notifications.isRead, true)))
      .returning({ id: notifications.id })
    notificationsArchived = notifResult.length
  } catch (err) {
    errors.push(`notifications archive failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  return {
    auditLogsArchived,
    messagesArchived,
    notificationsArchived,
    relayMessagesArchived,
    errors,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
