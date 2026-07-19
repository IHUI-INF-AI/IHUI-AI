/**
 * upsertByUnique 单元测试。
 *
 * 设计:用 stub db 验证 4 个核心行为
 *   1. 存在 + 有 updateValues → update + 返回 updated
 *   2. 存在 + 无 updateValues → 不发 update + 返回 updated
 *   3. 不存在 + 有 insertValues → insert + 返回 inserted
 *   4. insert 返回空数组 → 抛错
 *
 * 不连真实 DB(用最小化的 stub),保证零网络依赖 + 毫秒级执行。
 */

import { describe, expect, it } from 'vitest'
import { upsertByUnique } from './upsert-by-unique.js'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'

// ==================== Stub DB ====================

/**
 * 最小 stub db:用数组存"行",按 uniqueBy 模拟查询/更新/插入。
 * 类型用 unknown 避开 drizzle 复杂类型,因为 upsertByUnique 接受 MinimalDb 接口。
 */
type Row = { id: number; name: string; sort?: number; status?: number }

function createStubDb(initial: Row[] = []): {
  db: Parameters<typeof upsertByUnique>[0]
  rows: Row[]
  calls: { op: 'select' | 'update' | 'insert'; payload?: unknown }[]
} {
  const rows = [...initial]
  const calls: { op: 'select' | 'update' | 'insert'; payload?: unknown }[] = []

  // 极简 drizzle 类型桩,只覆盖 upsertByUnique 用到的链式调用
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            calls.push({ op: 'select' })
            return Promise.resolve([{ id: rows[0]?.id }])
          },
        }),
      }),
    }),
    update: (_table: PgTable) => ({
      set: (vals: Record<string, unknown>) => {
        calls.push({ op: 'update', payload: vals })
        const target = rows[0]
        if (target) Object.assign(target, vals)
        return { where: () => Promise.resolve() }
      },
    }),
    insert: (_table: PgTable) => ({
      values: (vals: Record<string, unknown>) => {
        calls.push({ op: 'insert', payload: vals })
        return {
          returning: () => {
            const id = rows.length + 1
            rows.push({ id, ...(vals as Row) })
            return Promise.resolve([{ id }])
          },
        }
      },
    }),
  }
  return { db: db as unknown as Parameters<typeof upsertByUnique>[0], rows, calls }
}

// 极简表/列桩:upsertByUnique 只用作 lookup key,不实际校验 schema
const fakeTable = {} as PgTable
const nameCol = {} as PgColumn
const idCol = {} as PgColumn

// ==================== 测试用例 ====================

describe('upsertByUnique: insert path (不存在)', () => {
  it('不存在 → insert + 返回 inserted + id 是新行的 id', async () => {
    const { db, rows, calls } = createStubDb([])
    const result = await upsertByUnique(db, {
      table: fakeTable,
      uniqueBy: { column: nameCol, value: 'foo' },
      insertValues: { name: 'foo', sort: 1, status: 1 },
      idColumn: idCol,
    })
    expect(result).toEqual({ id: 1, action: 'inserted' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: 1, name: 'foo', sort: 1, status: 1 })
    // 关键:不应触发 update
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })
})

describe('upsertByUnique: update path (存在 + updateValues)', () => {
  it('存在 + 有 updateValues → update + 返回 updated', async () => {
    const { db, rows, calls } = createStubDb([{ id: 7, name: 'foo', sort: 0, status: 0 }])
    const result = await upsertByUnique(db, {
      table: fakeTable,
      uniqueBy: { column: nameCol, value: 'foo' },
      insertValues: { name: 'foo', sort: 1, status: 1 },
      updateValues: { sort: 99, status: 1 },
      idColumn: idCol,
    })
    expect(result).toEqual({ id: 7, action: 'updated' })
    expect(rows).toHaveLength(1) // 不新增
    expect(rows[0]).toMatchObject({ id: 7, name: 'foo', sort: 99, status: 1 })
    const updateCall = calls.find((c) => c.op === 'update')
    expect(updateCall?.payload).toEqual({ sort: 99, status: 1 })
  })
})

describe('upsertByUnique: skip-update path (存在 + 无 updateValues)', () => {
  it('存在 + 不传 updateValues → 不发 update SQL,只返回 updated', async () => {
    const { db, rows, calls } = createStubDb([{ id: 7, name: 'foo', sort: 0, status: 0 }])
    const result = await upsertByUnique(db, {
      table: fakeTable,
      uniqueBy: { column: nameCol, value: 'foo' },
      insertValues: { name: 'foo', sort: 1, status: 1 },
      // 故意不传 updateValues
      idColumn: idCol,
    })
    expect(result).toEqual({ id: 7, action: 'updated' })
    expect(rows[0]).toMatchObject({ id: 7, sort: 0, status: 0 }) // 数据未变
    expect(calls.some((c) => c.op === 'update')).toBe(false) // 关键:不发 update
    expect(calls.some((c) => c.op === 'insert')).toBe(false) // 也不 insert
  })
})

describe('upsertByUnique: skip-update path (存在 + updateValues 空对象)', () => {
  it('存在 + updateValues 是空对象 → 也不发 update(等价于不传)', async () => {
    const { db, calls } = createStubDb([{ id: 7, name: 'foo' }])
    await upsertByUnique(db, {
      table: fakeTable,
      uniqueBy: { column: nameCol, value: 'foo' },
      insertValues: { name: 'foo' },
      updateValues: {}, // 空对象
      idColumn: idCol,
    })
    expect(calls.some((c) => c.op === 'update')).toBe(false)
  })
})

describe('upsertByUnique: error path', () => {
  it('insert 返回空数组 → 抛错(防止脏数据)', async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
      }),
      insert: () => ({
        values: () => ({ returning: () => Promise.resolve([]) }),
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    } as unknown as Parameters<typeof upsertByUnique>[0]
    await expect(
      upsertByUnique(db, {
        table: fakeTable,
        uniqueBy: { column: nameCol, value: 'bar' },
        insertValues: { name: 'bar' },
        idColumn: idCol,
      }),
    ).rejects.toThrow(/upsertByUnique.*insert returned no row/)
  })
})

describe('upsertByUnique: 默认 idColumn = uniqueBy.column', () => {
  it('不传 idColumn 时,insert 用 uniqueBy.column 作为 returning 列', async () => {
    const { db, calls } = createStubDb([])
    await upsertByUnique(db, {
      table: fakeTable,
      uniqueBy: { column: nameCol, value: 'baz' },
      insertValues: { name: 'baz' },
      // 不传 idColumn
    })
    // 应有 1 个 select(查重)+ 1 个 insert
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1)
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1)
  })
})
