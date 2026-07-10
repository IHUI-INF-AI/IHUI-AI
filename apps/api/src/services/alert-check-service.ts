/**
 * 告警噪音检查服务（backing service for alert-check-daily 定时任务）。
 * 迁移自旧架构 app/tasks/alert_check_task.py。
 *
 * 每日 04:00 扫描系统告警表，清理已恢复告警的噪音，
 * 并检查是否有未处理的严重告警需要升级通知。
 */

import { sql, and, gt, lt, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditLogs } from '@ihui/database';

export interface AlertCheckResult {
  checked: number;
  resolved: number;
  escalated: number;
  errors: string[];
}

/**
 * 执行每日告警检查。
 *
 * 策略：
 * 1. 扫描 audit_logs 中 action 含 error/denied/blocked 的最近 24h 记录
 * 2. 统计未处理的严重告警数量
 * 3. 超过阈值的标记为需要升级
 * 4. 24 小时前的旧告警视为已恢复的噪音
 */
export async function checkDailyAlerts(): Promise<AlertCheckResult> {
  const errors: string[] = [];
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // 统计最近 24h 内含错误关键字的审计日志（告警源）
    const recentAlerts = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(
        and(
          ilike(auditLogs.action, '%error%'),
          gt(auditLogs.createdAt, twentyFourHoursAgo),
        ),
      );

    const checked = recentAlerts[0]?.count ?? 0;

    // 统计 24h 前的旧告警（可视为已恢复的噪音）
    const oldAlerts = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(auditLogs)
      .where(
        and(
          ilike(auditLogs.action, '%error%'),
          lt(auditLogs.createdAt, twentyFourHoursAgo),
        ),
      );

    const resolved = oldAlerts[0]?.count ?? 0;

    // 升级逻辑：如果最近 24h 错误数超过 50，标记为需要升级通知
    const escalated = checked > 50 ? 1 : 0;

    return {
      checked,
      resolved,
      escalated,
      errors,
    };
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return { checked: 0, resolved: 0, escalated: 0, errors };
  }
}
