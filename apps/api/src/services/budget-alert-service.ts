/**
 * 预算告警扫描服务（backing service for budget-alert-check 定时任务，P0-3e）。
 *
 * 每 30 分钟扫描所有 scope='user' 的 aiBudgets 配置,
 * 聚合用户今日 token 用量 + 本月成本, 与 dailyTokenLimit / monthlyCostLimit
 * 对比, 命中阈值（80% warning / 100% critical）时通过 notificationQueue
 * 推站内信 + sendEmail 发邮件, 6 小时 cooldown 防重复告警。
 *
 * 设计要点:
 * 1. 全 SQL 聚合: 单次 SQL 同时拉出 userId + dailyTokens + monthlyCost(用 CTE / 子查询),
 *    避免在 Node 端再做 N 次 SELECT。schema 字段: aiCostRecords.totalTokens / cost。
 * 2. 6h cooldown: 复用 notifications 表(type='BUDGET_ALERT'), 不另建新表,
 *    减少 schema 漂移; 命中 cooldown 则 skip, 避免 30 分钟内重复轰炸。
 * 3. 失败隔离: 单个 budget 循环内 try/catch, DB / 邮件 / 队列失败
 *    不应中断整个扫描。
 * 4. 邮件模板: i18n 5 语言 budgetAlert 命名空间
 *    (packages/i18n/messages/api/{zh-CN,en,ja,ko,zh-TW}.json),
 *    API 当前不直接加载 i18n 包, 默认 fallback 到中文模板。
 *    5 语言文件作为翻译单一来源 (source of truth) 保留,
 *    供前端展示 + 未来 i18n-loader 接入。
 */

import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { aiBudgets, aiCostRecords, notifications, users } from '@ihui/database';
import { sendEmail } from './email-service.js';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 告警阈值: 80% warning / 100% critical */
const WARNING_THRESHOLD = 0.8;
const CRITICAL_THRESHOLD = 1.0;

/** cooldown 时长: 同一 user + severity 6 小时内不重复告警 */
const COOLDOWN_MS = 6 * 60 * 60 * 1000;

/** notification.type 标识 */
const ALERT_TYPE = 'BUDGET_ALERT';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type AlertSeverity = 'warning' | 'critical';

export interface BudgetAlertCheckResult {
  scanned: number;
  warningCount: number;
  criticalCount: number;
  errors: string[];
}

interface BudgetAggregate {
  budgetId: string;
  userId: string;
  scopeKey: string;
  dailyTokenLimit: number;
  monthlyCostLimit: string; // numeric → string (drizzle 默认)
  dailyTokens: number;
  monthlyCost: string;
}

interface AlertPayload {
  severity: AlertSeverity;
  userId: string;
  budgetId: string;
  dailyPercent: number;
  monthlyPercent: number;
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
  email: string | null;
  nickname: string | null;
}

// ---------------------------------------------------------------------------
// i18n 模板(默认 zh-CN; 其他 4 语言由 packages/i18n/messages/api/* 维护)
// ---------------------------------------------------------------------------

interface AlertTemplates {
  subject: (severity: AlertSeverity) => string;
  body: (vars: {
    dailyPercent: number;
    monthlyPercent: number;
    dailyUsed: number;
    dailyLimit: number;
    monthlyUsed: number;
    monthlyLimit: number;
  }) => string;
}

/**
 * 5 语言预算告警模板 (source of truth: packages/i18n/messages/api/*.json)。
 *
 * 此处内联默认中文模板, 确保 API 进程不依赖 i18n-loader 即可工作;
 * 未来如需多语言切换, 优先从 i18n 包读取, 此处仅作 fallback。
 */
const TEMPLATES_ZH_CN: AlertTemplates = {
  subject: (severity) =>
    severity === 'critical' ? '【严重】AI 预算已超额' : '【警告】AI 预算接近上限',
  body: ({ dailyPercent, monthlyPercent, dailyUsed, dailyLimit, monthlyUsed, monthlyLimit }) =>
    `您的 AI 用量已达预算上限:\n` +
    `• 今日 Token: ${dailyUsed} / ${dailyLimit} (${(dailyPercent * 100).toFixed(1)}%)\n` +
    `• 本月成本: $${monthlyUsed} / $${monthlyLimit} (${(monthlyPercent * 100).toFixed(1)}%)\n` +
    `请及时调整用量或联系管理员提升额度。`,
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return Number.isFinite(n) ? n : 0;
}

function severityFor(percent: number): AlertSeverity | null {
  if (percent >= CRITICAL_THRESHOLD) return 'critical';
  if (percent >= WARNING_THRESHOLD) return 'warning';
  return null;
}

function pickMaxPercent(daily: number, monthly: number): number {
  return Math.max(daily, monthly);
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 扫描所有 scope='user' 的 aiBudgets, 触发超额告警。
 *
 * 返回:
 *   scanned       - 本次扫描的 budget 行数
 *   warningCount  - 新发出的 warning 告警数
 *   criticalCount - 新发出的 critical 告警数
 *   errors        - 单 budget 循环失败错误信息列表(整体不中断)
 */
export async function checkBudgetAlerts(
  server: FastifyInstance,
): Promise<BudgetAlertCheckResult> {
  const result: BudgetAlertCheckResult = {
    scanned: 0,
    warningCount: 0,
    criticalCount: 0,
    errors: [],
  };

  // 1. 拉取所有 user 维度预算
  const budgets = await db
    .select()
    .from(aiBudgets)
    .where(eq(aiBudgets.scope, 'user'));

  if (budgets.length === 0) {
    return result;
  }
  result.scanned = budgets.length;

  // 2. 一次性聚合所有相关 user 的今日 token / 本月成本
  const aggregates = await aggregateUsageForUsers(budgets.map((b) => b.scopeKey));
  const aggregateMap = new Map(aggregates.map((a) => [a.userId, a]));

  // 3. 逐个 budget 判断是否需要告警 + cooldown
  for (const budget of budgets) {
    try {
      const agg = aggregateMap.get(budget.scopeKey);
      if (!agg) continue;

      const dailyTokens = toNumber(agg.dailyTokens);
      const monthlyCost = toNumber(agg.monthlyCost);
      const dailyLimit = budget.dailyTokenLimit;
      const monthlyLimit = toNumber(budget.monthlyCostLimit);

      // 防止除零: limit 为 0 直接跳过
      if (dailyLimit <= 0 && monthlyLimit <= 0) continue;

      const dailyPercent = dailyLimit > 0 ? dailyTokens / dailyLimit : 0;
      const monthlyPercent = monthlyLimit > 0 ? monthlyCost / monthlyLimit : 0;
      const maxPercent = pickMaxPercent(dailyPercent, monthlyPercent);

      const severity = severityFor(maxPercent);
      if (!severity) continue;

      // 6h cooldown 检查(同 user + 同 severity 跳过)
      const inCooldown = await isInCooldown(budget.scopeKey, severity);
      if (inCooldown) continue;

      // 取用户联系信息(简化分两次查, 避免和上面 LEFT JOIN 复杂化)
      const user = await db
        .select({ email: users.email, nickname: users.nickname })
        .from(users)
        .where(eq(users.id, budget.scopeKey))
        .limit(1);

      const email = user[0]?.email ?? null;
      const nickname = user[0]?.nickname ?? null;

      const payload: AlertPayload = {
        severity,
        userId: budget.scopeKey,
        budgetId: budget.id,
        dailyPercent,
        monthlyPercent,
        dailyUsed: dailyTokens,
        dailyLimit,
        monthlyUsed: Number.parseFloat(monthlyCost.toFixed(2)),
        monthlyLimit,
        email,
        nickname,
      };

      await dispatchAlert(server, payload);
      if (severity === 'critical') result.criticalCount += 1;
      else result.warningCount += 1;
    } catch (err) {
      result.errors.push(
        `budget=${budget.id} user=${budget.scopeKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
      // 单 budget 失败不影响整体
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 内部: 聚合查询
// ---------------------------------------------------------------------------

/**
 * 一次性聚合给定 users 的今日 token 用量 + 本月成本。
 * 使用 SQL 子查询替代 N+1, 性能: O(1) round trip。
 */
async function aggregateUsageForUsers(
  userIds: string[],
): Promise<BudgetAggregate[]> {
  if (userIds.length === 0) return [];

  const todayStart = startOfToday();
  const monthStart = startOfMonth();

  // 单次 SQL 同时拉出 daily_tokens / monthly_cost
  // 字段来源: aiCostRecords.totalTokens (integer) + cost (numeric)
  const rows = await db
    .select({
      userId: aiCostRecords.userId,
      dailyTokens: sql<number>`COALESCE(SUM(CASE WHEN ${aiCostRecords.createdAt} >= ${todayStart}::timestamptz THEN ${aiCostRecords.totalTokens} ELSE 0 END), 0)::int`,
      monthlyCost: sql<string>`COALESCE(SUM(CASE WHEN ${aiCostRecords.createdAt} >= ${monthStart}::timestamptz THEN ${aiCostRecords.cost} ELSE 0 END), 0)::text`,
    })
    .from(aiCostRecords)
    .where(inArrayUserIds(userIds))
    .groupBy(aiCostRecords.userId);

  return rows.map((r) => ({
    budgetId: '',
    userId: r.userId ?? '',
    scopeKey: r.userId ?? '',
    dailyTokenLimit: 0,
    monthlyCostLimit: '0',
    dailyTokens: r.dailyTokens,
    monthlyCost: r.monthlyCost,
  }));
}

/**
 * 构造 userId IN (...) 条件。userId 字段 nullable, 用 IS NOT NULL 避免 NULL 误匹配。
 */
function inArrayUserIds(userIds: string[]) {
  return and(
    sql`${aiCostRecords.userId} IS NOT NULL`,
    sql`${aiCostRecords.userId} IN (${sql.join(userIds.map((u) => sql`${u}`), sql`, `)})`,
  );
}

// ---------------------------------------------------------------------------
// 内部: cooldown 查询
// ---------------------------------------------------------------------------

/**
 * 检查同一 user + severity 在 6h 内是否已发过告警。
 * 复用 notifications 表: type='BUDGET_ALERT' + createdAt >= now - 6h
 * + 通过 data->>'severity' 字段判定(简化: 也用 title 关键字匹配)。
 *
 * 简化: 因 notifications.data 为 jsonb 且 worker 写入时会把 severity 放在 data 里,
 * 这里直接用 jsonb 路径匹配; 如 schema 漂移可降级用 title 模糊匹配。
 */
async function isInCooldown(userId: string, severity: AlertSeverity): Promise<boolean> {
  const cutoff = new Date(Date.now() - COOLDOWN_MS);
  try {
    const recent = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.type, ALERT_TYPE),
          gte(notifications.createdAt, cutoff),
          sql`${notifications.data}->>'severity' = ${severity}`,
        ),
      );
    return (recent[0]?.count ?? 0) > 0;
  } catch {
    // 降级: 不阻塞告警, 默认不在 cooldown
    return false;
  }
}

// ---------------------------------------------------------------------------
// 内部: 告警派发
// ---------------------------------------------------------------------------

/**
 * 派发告警: notificationQueue 入站 + 邮件发送。
 * notificationQueue worker 会自动完成 DB 落库 + WebSocket 推送,
 * 这里只需把 email 字段填好即可让 worker 触发 sendEmail。
 */
async function dispatchAlert(server: FastifyInstance, payload: AlertPayload): Promise<void> {
  const tpl = TEMPLATES_ZH_CN;
  const title = tpl.subject(payload.severity);
  const content = tpl.body({
    dailyPercent: payload.dailyPercent,
    monthlyPercent: payload.monthlyPercent,
    dailyUsed: payload.dailyUsed,
    dailyLimit: payload.dailyLimit,
    monthlyUsed: payload.monthlyUsed,
    monthlyLimit: payload.monthlyLimit,
  });

  // 1. notificationQueue 入队(worker 自动 DB 落库 + WebSocket + 邮件)
  //    若队列不可用, 降级为同步 createNotification + sendEmail
  const queue = (
    server as unknown as {
      notificationQueue?: {
        add: (name: string, data: unknown) => Promise<unknown>
      }
    }
  ).notificationQueue;

  if (queue) {
    await queue.add('notification', {
      userId: payload.userId,
      type: ALERT_TYPE,
      title,
      content,
      data: {
        severity: payload.severity,
        dailyPercent: Number.parseFloat(payload.dailyPercent.toFixed(4)),
        monthlyPercent: Number.parseFloat(payload.monthlyPercent.toFixed(4)),
        dailyUsed: payload.dailyUsed,
        dailyLimit: payload.dailyLimit,
        monthlyUsed: payload.monthlyUsed,
        monthlyLimit: payload.monthlyLimit,
      },
      email: payload.email ?? undefined,
      userName: payload.nickname ?? payload.email ?? '',
    });
  } else {
    // 降级: 同步插入 + 邮件
    await db.insert(notifications).values({
      userId: payload.userId,
      type: ALERT_TYPE,
      title,
      content,
      data: {
        severity: payload.severity,
        dailyPercent: payload.dailyPercent,
        monthlyPercent: payload.monthlyPercent,
      },
    });
    if (payload.email) {
      try {
        await sendEmail({
          to: payload.email,
          subject: title,
          html: `<h2>${title}</h2><pre>${content}</pre>`,
          text: content,
        });
      } catch (err) {
        server.log.warn(
          { err, userId: payload.userId },
          'budget alert email fallback failed',
        );
      }
    }
  }

  server.log.info(
    {
      userId: payload.userId,
      severity: payload.severity,
      dailyPercent: payload.dailyPercent,
      monthlyPercent: payload.monthlyPercent,
    },
    'budget alert dispatched',
  );
}
