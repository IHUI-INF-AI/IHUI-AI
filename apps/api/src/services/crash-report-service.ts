/**
 * 崩溃上报服务 — 2026-08-06 新增(打通崩溃率链路)。
 *
 * recordCrash:写入 crash_reports 表(静默失败,不阻断业务)。
 * 各端全局错误捕获(web ErrorBoundary / miniapp App.onError / RN ErrorUtils)调用上报端点,
 * admin mobile-stats 聚合出真实崩溃率。
 */

import { db } from '../db/index.js'
import { crashReports } from '@ihui/database'
import { logger } from '../utils/logger.js'

/** 崩溃上报入参 */
export interface CrashReportInput {
  userId?: string | null
  platform: string
  version?: string | null
  errorMessage: string
  stack?: string | null
  route?: string | null
}

/**
 * 写入一条崩溃记录。
 * 静默失败:上报落库失败只记日志,不抛错——崩溃上报绝不能阻断业务主流程。
 * 字段截断防滥用:errorMessage ≤ 4000 字符、stack ≤ 20000 字符、route ≤ 512 字符。
 */
export async function recordCrash(input: CrashReportInput): Promise<{ id: string }> {
  try {
    const [row] = await db
      .insert(crashReports)
      .values({
        platform: input.platform,
        version: input.version ?? null,
        userId: input.userId ?? null,
        errorMessage: (input.errorMessage ?? 'unknown').slice(0, 4000),
        stack: input.stack ? input.stack.slice(0, 20000) : null,
        route: input.route ? input.route.slice(0, 512) : null,
      })
      .returning({ id: crashReports.id })
    return { id: row?.id ?? '' }
  } catch (err) {
    logger.warn(`[crash-report] recordCrash 失败(不阻塞): ${String(err)}`)
    return { id: '' }
  }
}
