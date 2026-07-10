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

import { and, lt, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs, messages, notifications } from '@ihui/database';

export interface ArchiveResult {
  auditLogsArchived: number;
  messagesArchived: number;
  notificationsArchived: number;
  errors: string[];
}

/**
 * 执行每日数据归档。
 * 使用 DELETE ... WHERE created_at < threshold 语义清理过期热数据。
 * 归档前数据已被 OTel/ELK/Grafana 消费，无需单独归档表。
 */
export async function archiveDailyData(): Promise<ArchiveResult> {
  const errors: string[] = [];
  const now = new Date();

  // 阈值计算
  const auditThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 天前
  const messageThreshold = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000); // 180 天前
  const notifThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 天前

  let auditLogsArchived = 0;
  let messagesArchived = 0;
  let notificationsArchived = 0;

  try {
    // 归档 audit_logs（90 天前）
    const auditResult = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, auditThreshold))
      .returning({ id: auditLogs.id });
    auditLogsArchived = auditResult.length;
  } catch (err) {
    errors.push(`audit_logs archive failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    // 归档 chat messages（180 天前）
    const msgResult = await db
      .delete(messages)
      .where(lt(messages.createdAt, messageThreshold))
      .returning({ id: messages.id });
    messagesArchived = msgResult.length;
  } catch (err) {
    errors.push(`messages archive failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    // 归档已读通知（30 天前，仅删除已读的）
    const notifResult = await db
      .delete(notifications)
      .where(
        and(
          lt(notifications.createdAt, notifThreshold),
          eq(notifications.isRead, true),
        ),
      )
      .returning({ id: notifications.id });
    notificationsArchived = notifResult.length;
  } catch (err) {
    errors.push(`notifications archive failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    auditLogsArchived,
    messagesArchived,
    notificationsArchived,
    errors,
  };
}
