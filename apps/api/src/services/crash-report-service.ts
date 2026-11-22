// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 崩溃上报服务 — 2026-08-06 新增(打通崩溃率链路)。
 *
 * recordCrash:写入 crash_reports 表(静默失败,不阻断业务)。
 * 各端全局错误捕获(web ErrorBoundary / miniapp App.onError / RN ErrorUtils)调用上报端点,
 * admin mobile-stats 聚合出真实崩溃率。
 */

import { db } from '../db/index.js'
import { crashReports } from '@ihui/database'
import { redactCrashText } from '@ihui/shared/utils/redact'
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
 * 静默失败:落库失败只记日志,不抛错——崩溃上报绝不能阻断业务主流程。
 *
 * **落库前脱敏(2026-09-27 立,权威防线)**:`errorMessage` / `stack` / `route` 一律先过共享层
 * 唯一出口 `redactCrashText`(`@ihui/shared/utils/redact`)。为什么落在这一处而不是路由里:
 *  - `POST /crash-reports` 是**匿名可写**端点(见 `routes/crash-reports.ts` 的设计注释),
 *    客户端自觉与否结构上不可信任 —— 任何人都能带着别人的 key 朝这个端点打一发;
 *  - 本函数是 `crash_reports` 的**唯一落库口**,写在这里 ⇒ 以后新增任何发射端点或后台补录
 *    都自动被覆盖;写在某个路由里 ⇒ 第二个调用方就是绕过口。
 * 顺序是**先脱敏、再截断**:反过来(先截断)会把凭据切成半截,正则的形状就不再成立 ⇒ 漏盖。
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
        errorMessage: redactCrashText(input.errorMessage ?? 'unknown').slice(0, 4000),
        stack: input.stack ? redactCrashText(input.stack).slice(0, 20000) : null,
        route: input.route ? redactCrashText(input.route).slice(0, 512) : null,
      })
      .returning({ id: crashReports.id })
    return { id: row?.id ?? '' }
  } catch (err) {
    logger.warn(`[crash-report] recordCrash 失败(不阻塞): ${String(err)}`)
    return { id: '' }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
