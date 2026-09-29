// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { eq, and, sql } from 'drizzle-orm'
import { db } from './index.js'
import { idMapping, type IdMapping } from '@ihui/database'
import { backfillWhere } from '../utils/backfill-baseline.js'

// =============================================================================
// ID 映射查询 — Java Long 自增 ID ↔ TS uuid 随机 ID
// =============================================================================

/** 查正向映射(legacy_id → new_id),返回 newId 或 null。 */
export async function getNewId(legacyTable: string, legacyId: number): Promise<string | null> {
  const rows = await db
    .select({ newId: idMapping.newId })
    .from(idMapping)
    .where(and(eq(idMapping.legacyTable, legacyTable), eq(idMapping.legacyId, legacyId)))
    .limit(1)
  return rows[0]?.newId ?? null
}

/** 查反向映射(new_id → legacy_id),返回 legacyId 或 null。 */
export async function getLegacyId(legacyTable: string, newId: string): Promise<number | null> {
  const rows = await db
    .select({ legacyId: idMapping.legacyId })
    .from(idMapping)
    .where(and(eq(idMapping.legacyTable, legacyTable), eq(idMapping.newId, newId)))
    .limit(1)
  return rows[0]?.legacyId ?? null
}

/**
 * 创建映射(幂等)。
 * 同 legacy_table + legacy_id 重复调用不报错,onConflictDoUpdate 更新 newId/migrationBatch。
 */
export async function createMapping(
  legacyTable: string,
  legacyId: number,
  newId: string,
  migrationBatch: string,
): Promise<IdMapping> {
  const rows = await db
    .insert(idMapping)
    .values({ legacyTable, legacyId, newId, migrationBatch })
    .onConflictDoUpdate({
      target: [idMapping.legacyTable, idMapping.legacyId],
      set: { newId, migrationBatch },
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('创建 ID 映射失败')
  return row
}

export interface BulkMappingInput {
  legacyTable: string
  legacyId: number
  newId: string
  migrationBatch: string
}

/** 批量创建映射(幂等,同 legacy_table + legacy_id 冲突时更新)。空数组直接返回。 */
export async function bulkCreateMappings(mappings: BulkMappingInput[]): Promise<IdMapping[]> {
  if (mappings.length === 0) return []
  const rows = await db
    .insert(idMapping)
    .values(mappings)
    .onConflictDoUpdate({
      target: [idMapping.legacyTable, idMapping.legacyId],
      set: {
        newId: sql`excluded.new_id`,
        migrationBatch: sql`excluded.migration_batch`,
      },
    })
    .returning()
  return rows
}

/** 检查某条 legacy 记录是否已迁移(用于断点续传,跳过已完成)。 */
export async function hasBeenMigrated(legacyTable: string, legacyId: number): Promise<boolean> {
  const rows = await db
    .select({ id: idMapping.id })
    .from(idMapping)
    .where(and(eq(idMapping.legacyTable, legacyTable), eq(idMapping.legacyId, legacyId)))
    .limit(1)
  return rows.length > 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * G-815953 首个落点:按基线时刻划线的回填出口示例。
 * 只碰 baselineTime 之前创建(此后无人动过)的行 —— 批量改 migrationBatch 时不得
 * 把用户在两次迁移之间写入的映射当旧数据覆盖。上界谓词唯一来自 backfill-baseline.ts,
 * 本文件不得自拼 and(...) 绕过它。
 */
export async function backfillMigrationBatch(options: {
  fromBatch: string
  toBatch: string
  baselineTime: Date | string
}): Promise<number> {
  const rows = await db
    .update(idMapping)
    .set({ migrationBatch: options.toBatch })
    .where(
      backfillWhere({
        column: idMapping.createdAt,
        baselineTime: options.baselineTime,
        conditions: [eq(idMapping.migrationBatch, options.fromBatch)],
      }),
    )
    .returning({ id: idMapping.id })
  return rows.length
}
