/**
 * 通用 upsertByUnique 工具.
 *
 * 用于 seed 系统的幂等导入:
 *   - 已存在 (按 unique 列匹配) → update payload
 *   - 不存在 → insert payload
 *   - 总是返回行 id + 操作类型
 *
 * 用法:
 *   const { id, action } = await upsertByUnique(db, {
 *     table: liveCategories,
 *     uniqueBy: { column: liveCategories.name, value: 'AI 前沿' },
 *     insertValues: { name: 'AI 前沿', sort: 1, status: 1 },
 *     updateValues: { sort: 1 },  // 可选, 不传则不更新
 *   })
 *
 * 设计原则:
 *   - 同一进程内的同 unique key 多次调用, 第一次执行 insert, 后续识别为 updated
 *   - 不在工具内做 schema 验证: 抛错由上层 catch
 *   - 仅支持单字段 unique key; 复合 key 暂不支持 (seed 场景以单字段为主)
 */

import { eq } from 'drizzle-orm'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

export type UpsertResult = {
  id: number | string
  action: 'inserted' | 'updated'
}

export interface UpsertOptions<TInsert extends Record<string, unknown>> {
  /** 目标表 (任意 drizzle pgTable) */
  table: PgTable
  /** 用于查重的列 (单字段) */
  uniqueBy: { column: PgColumn; value: unknown }
  /** insert 时使用的完整 payload */
  insertValues: TInsert
  /** 已存在时更新的字段 (如不传则只复用存在的行) */
  updateValues?: Partial<Omit<TInsert, 'id'>>
  /** insert 后返回 id 的列 (默认使用 uniqueBy.column) */
  idColumn?: PgColumn
}

/**
 * 最小化类型: 接受任何具备 select/insert/update 的 drizzle db 实例.
 * 这里用 structural type 避开 drizzle 复杂类型体操.
 */
interface MinimalDb {
  select: (cols?: Record<string, unknown>) => {
    from: (table: PgTable) => {
      where: (cond: ReturnType<typeof eq>) => {
        limit: (n: number) => Promise<Array<Record<string, unknown>>>
      }
    }
  }
  insert: (table: PgTable) => {
    values: (vals: Record<string, unknown>) => {
      returning: (cols: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>
    }
  }
  update: (table: PgTable) => {
    set: (vals: Record<string, unknown>) => {
      where: (cond: ReturnType<typeof eq>) => Promise<unknown>
    }
  }
}

export async function upsertByUnique<TInsert extends Record<string, unknown>>(
  db: MinimalDb,
  opts: UpsertOptions<TInsert>,
): Promise<UpsertResult> {
  const { table, uniqueBy, insertValues, updateValues, idColumn } = opts
  const idCol = idColumn ?? uniqueBy.column

  // 1. 查重
  const existing = await db
    .select({ id: idCol })
    .from(table)
    .where(eq(uniqueBy.column, uniqueBy.value))
    .limit(1)

  if (existing[0]) {
    // 2. 存在 → 视情况更新
    if (updateValues && Object.keys(updateValues).length > 0) {
      await db.update(table).set(updateValues).where(eq(uniqueBy.column, uniqueBy.value))
    }
    return { id: existing[0].id as number | string, action: 'updated' }
  }

  // 3. 不存在 → insert
  const inserted = await db
    .insert(table)
    .values(insertValues as never)
    .returning({ id: idCol })
  const row = inserted[0]
  if (!row) throw new Error('upsertByUnique: insert returned no row')
  return { id: row.id as number | string, action: 'inserted' }
}
