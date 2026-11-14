// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 最近一次运行状态持久化(2026-11-13 立)。
 *
 * job 跑完把汇总写进 system_configs KV(schema 零改动),键名:
 *   sync:attendance:last-run
 * value 为 JSON,运维查表即可确认每日同步是否正常(何时跑的、扫了几个用户、
 * 产了几个批次、多少跳过、有无报错),无需翻日志。
 *
 * 复用 sync-cursor.ts 的 system_configs upsert 范式(category='hr_sync')。
 * 仅记录「最近一次」用于运维巡检,不是审计流水 —— 需要历史可查日志。
 */

import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { systemConfigs } from '@ihui/database'
import type { AttendanceSyncJobResult } from '../attendance-sync-job.js'

export const LAST_RUN_KEY = 'sync:attendance:last-run'

/** 最近一次同步运行的运维快照(比 AttendanceSyncJobResult 多一个 finishedAt) */
export interface SyncLastRunStatus extends AttendanceSyncJobResult {
  finishedAt: string
}

/** 读最近一次运行状态;从未跑过 → null */
export async function readLastRunStatus(): Promise<SyncLastRunStatus | null> {
  const [row] = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, LAST_RUN_KEY))
    .limit(1)
  if (!row?.value) return null
  try {
    const parsed = JSON.parse(row.value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as SyncLastRunStatus
    }
  } catch {
    // 状态 JSON 非法 → 视为无记录(诊断由调用方记日志),不静默崩溃
    return null
  }
  return null
}

/** 覆盖写最近一次运行状态(upsert:key 唯一;仅保留最近一次) */
export async function writeLastRunStatus(result: AttendanceSyncJobResult): Promise<void> {
  const status: SyncLastRunStatus = { ...result, finishedAt: new Date().toISOString() }
  const value = JSON.stringify(status)

  const [existing] = await db
    .select({ id: systemConfigs.id })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, LAST_RUN_KEY))
    .limit(1)

  if (existing) {
    await db
      .update(systemConfigs)
      .set({ value, updatedAt: new Date() })
      .where(eq(systemConfigs.id, existing.id))
  } else {
    await db.insert(systemConfigs).values({
      key: LAST_RUN_KEY,
      value,
      type: 'json',
      category: 'hr_sync',
      description: '考勤同步器最近一次运行状态(运维巡检)',
      isPublic: false,
    })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
