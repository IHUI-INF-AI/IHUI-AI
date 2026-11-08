// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-21 / DB-22 / DB-23 回归夹具（纯静态，不连库）。
 *
 * 断言两件事：
 *  1. TS schema 已声明高频查询所需索引（否则下次 db:generate 与库态继续漂移）；
 *  2. 索引的建库脚本落在 scripts/manual-sql/*_CONCURRENTLY.sql（大表不得进迁移事务）。
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const pkgDir = fileURLToPath(new URL('..', import.meta.url))
const schemaDir = join(pkgDir, 'src', 'schema')
const manualDir = join(pkgDir, 'scripts', 'manual-sql')

const readSchema = (file: string) => readFileSync(join(schemaDir, file), 'utf-8')
const flat = (s: string) => s.replace(/\s+/g, ' ').trim()
const readManual = (file: string) => readFileSync(join(manualDir, file), 'utf-8')

const DB21_SQL = '20261108093000_chat_messages_conv_created_CONCURRENTLY.sql'
const DB22_SQL = '20261108093500_analytics_events_created_at_CONCURRENTLY.sql'
const DB23_SQL = '20261108094000_edu_orders_created_at_CONCURRENTLY.sql'

describe('DB-21 chat_messages 复合索引', () => {
  it('schema 声明 (conversation_id, created_at, id)', () => {
    expect(flat(readSchema('chat.ts'))).toContain(
      "index('ix_chat_messages_conv_created').on(t.conversationId, t.createdAt, t.id)",
    )
  })

  it('建库脚本存在且走 CONCURRENTLY', () => {
    expect(existsSync(join(manualDir, DB21_SQL))).toBe(true)
    const sql = readManual(DB21_SQL)
    expect(sql).toContain('CREATE INDEX CONCURRENTLY')
    expect(sql).toContain('ix_chat_messages_conv_created')
  })
})

describe('DB-22 analytics_events 时间/事件索引', () => {
  it('schema 声明 (created_at) 与 (event, created_at)', () => {
    const src = flat(readSchema('analytics-events.ts'))
    expect(src).toContain(
      "createdIdx: index('analytics_events_created_at_idx').on(t.createdAt)",
    )
    expect(src).toContain(
      "eventCreatedIdx: index('analytics_events_event_created_at_idx').on(t.event, t.createdAt)",
    )
  })

  it('建库脚本存在且走 CONCURRENTLY', () => {
    expect(existsSync(join(manualDir, DB22_SQL))).toBe(true)
    const sql = readManual(DB22_SQL)
    expect(sql).toContain('CREATE INDEX CONCURRENTLY')
    expect(sql).toContain('analytics_events_created_at_idx')
    expect(sql).toContain('analytics_events_event_created_at_idx')
  })
})

describe('DB-23 edu_orders 时间序索引', () => {
  it('schema 声明 (user_id, created_at) 与 (created_at)', () => {
    const src = flat(readSchema('order.ts'))
    expect(src).toContain(
      "userCreatedIdx: index('edu_orders_user_created_at_idx').on(t.userId, t.createdAt)",
    )
    expect(src).toContain(
      "createdIdx: index('edu_orders_created_at_idx').on(t.createdAt)",
    )
  })

  it('建库脚本存在且走 CONCURRENTLY', () => {
    expect(existsSync(join(manualDir, DB23_SQL))).toBe(true)
    const sql = readManual(DB23_SQL)
    expect(sql).toContain('CREATE INDEX CONCURRENTLY')
    expect(sql).toContain('edu_orders_user_created_at_idx')
    expect(sql).toContain('edu_orders_created_at_idx')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
