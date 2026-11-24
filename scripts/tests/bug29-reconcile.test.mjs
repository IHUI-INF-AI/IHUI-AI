// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// BUG-29 四格对账判据的反向测试（node:test，不连库）。
// 钉两件事：
//   ① 反向（改前绿 / 改后红）：同一输入——schema 声明索引齐全(旧判据 auditIndexes 只查格3 ⇒ 绿)，
//      但 FK 列无索引(新判据 reconcileGrid1 查格1 ⇒ 红)。证明新判据确实补上了旧判据漏掉的一格。
//   ② 正向（补齐后转绿）：给同一 FK 列补索引后，新判据由红转绿。
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { indexCovers, reconcileGrid1 } from '../bug29-reconcile.mjs'
import { auditIndexes } from '../audit-missing-indexes.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('indexCovers', () => {
  it('同表且列集含目标列 ⇒ 覆盖；否则不覆盖', () => {
    const migrated = new Map([
      ['ix_orders_user_id', { table: 'orders', cols: new Set(['user_id']), file: 'a.sql' }],
      ['ix_orders_user_created', { table: 'orders', cols: new Set(['user_id', 'created_at']), file: 'a.sql' }],
    ])
    assert.equal(indexCovers(migrated, 'orders', 'user_id'), true)
    assert.equal(indexCovers(migrated, 'orders', 'status'), false)
    assert.equal(indexCovers(migrated, 'users', 'user_id'), false)
  })
})

describe('reconcileGrid1', () => {
  it('基线两对：只补了其中一列 ⇒ 已补1 / 未补1', () => {
    const pairs = [
      { table: 't', column: 'a' },
      { table: 't', column: 'b' },
    ]
    const migrated = new Map([
      ['ix_t_a', { table: 't', cols: new Set(['a']), file: 'x.sql' }],
    ])
    const { done, todo } = reconcileGrid1(pairs, migrated)
    assert.equal(done.length, 1)
    assert.equal(todo.length, 1)
    assert.equal(todo[0].column, 'b')
  })
})

describe('BUG-29 反向测试：判据改前绿 / 改后红', () => {
  it('同一输入：旧判据(格3索引对账)报绿，新判据(格1 FK列索引)报红；补索引后转绿', () => {
    // 输入：orders 的 schema 声明索引 idx_orders_created_at 在迁移链有同名 DDL(格3齐)；
    //       但 orders.status 是 FK 列，schema 未声明索引、迁移链也无索引(格1缺)。
    const declared = new Map([
      ['idx_orders_created_at', { table: 'orders', cols: new Set(['created_at']), file: 'orders.ts' }],
    ])
    const migratedBefore = new Map([
      ['idx_orders_created_at', { table: 'orders', cols: new Set(['created_at']), file: '0001.sql' }],
    ])

    // 改前：旧判据只看格3 schema 声明索引 ⇒ 全齐 ⇒ 绿
    const old = auditIndexes(declared, migratedBefore)
    assert.equal(old.missing.length, 0, '旧判据应放行（它看不到格1 FK 列无索引）')

    // 改后：新判据看格1 FK 列 status 无索引 ⇒ 红
    const pairs = [{ table: 'orders', column: 'status' }]
    const red = reconcileGrid1(pairs, migratedBefore)
    assert.equal(red.todo.length, 1, '新判据应检出 orders.status 无索引')
    assert.equal(red.todo[0].column, 'status')

    // 正向：给 status 补索引后 ⇒ 新判据转绿
    const migratedAfter = new Map(migratedBefore)
    migratedAfter.set('ix_orders_status_fk', { table: 'orders', cols: new Set(['status']), file: '0002.sql' })
    const green = reconcileGrid1(pairs, migratedAfter)
    assert.equal(green.todo.length, 0, '补索引后新判据应放行')
    assert.equal(green.done.length, 1)
  })
})

describe('BUG-29 入链切片2 与缺口清单一致', () => {
  it('新迁移的 15 条索引名 = drift JSON 的 15 处缺口，且全局唯一', () => {
    const drift = JSON.parse(
      readFileSync(resolve(REPO, 'packages/database/drizzle-pending-review/BUG29-sec2-drift-20261120.json'), 'utf-8'),
    )
    const expect = new Set(drift.gaps.map((g) => `ix_${g.table}_${g.col}`))
    const sql = readFileSync(resolve(REPO, 'packages/database/drizzle/20261120110000_bug29_indexes_slice2.sql'), 'utf-8')
    const actual = [...sql.matchAll(/^CREATE INDEX IF NOT EXISTS "([^"]+)"/gm)].map((m) => m[1])
    assert.equal(actual.length, 15)
    assert.equal(new Set(actual).size, 15, '索引名不得重复')
    for (const e of expect) assert.ok(actual.includes(e), `缺索引 ${e}`)
    for (const a of actual) assert.ok(expect.has(a), `多出非清单索引 ${a}`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
