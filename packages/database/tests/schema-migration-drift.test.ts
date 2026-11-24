// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-16 / DB-17 / DB-18 / DB-19 / DB-37 回归夹具（纯静态，不连库）。
 *
 * 只读取 drizzle 目录下的 .sql、drizzle/meta/_journal.json 与 src/schema 下的 .ts 文本，
 * 断言「迁移 SQL（既成事实）↔ TS schema ↔ journal」三方一致，以及每条修复所需的
 * 迁移 DDL 确实落地。不依赖 drizzle-kit generate（无库环境无法产出快照）。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const pkgDir = fileURLToPath(new URL('..', import.meta.url))
const drizzleDir = join(pkgDir, 'drizzle')
const schemaDir = join(pkgDir, 'src', 'schema')

const sqlFiles = readdirSync(drizzleDir).filter((f) => /^\d+_.*\.sql$/.test(f))
const readDrizzle = (file: string) => readFileSync(join(drizzleDir, file), 'utf-8')
const readSchema = (file: string) => readFileSync(join(schemaDir, file), 'utf-8')
const allSql = sqlFiles.map(readDrizzle).join('\n')

/** 把连续空白折叠成单空格，便于跨行对齐断言 */
const flat = (s: string) => s.replace(/\s+/g, ' ').trim()

/** 找到同名迁移文件（按文件名排序取第一个出现该表的文件） */
function findCreateTableFiles(table: string): string[] {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+"?${table}"?\\s*\\(`, 'i')
  return sqlFiles.filter((f) => re.test(readDrizzle(f)))
}

/** 抽取某个 CREATE TABLE 的完整括号块（朴素括号配平，足以覆盖本仓 DDL） */
function extractCreateTable(sql: string, table: string): string {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS\\s+"?${table}"?\\s*\\(`, 'i')
  const m = re.exec(sql)
  if (!m) throw new Error(`找不到表 ${table} 的 CREATE TABLE 定义`)
  let depth = 1
  let i = m.index + m[0].length
  for (; i < sql.length; i++) {
    if (sql[i] === '(') depth += 1
    else if (sql[i] === ')') {
      depth -= 1
      if (depth === 0) {
        i += 1
        break
      }
    }
  }
  return sql.slice(m.index, i)
}

/** 取列定义所在行（忽略大小写与标识符引号） */
function columnLine(block: string, column: string): string {
  const re = new RegExp(`^\\s*"?${column}"?\\s+`, 'i')
  return block.split('\n').find((line) => re.test(line)) ?? ''
}

const DB16_TAG = '20261108120000_relay_conversations_not_null'
const DB37_TAG = '20261108130000_named_unique_constraints'
const DB16_FILE = `${DB16_TAG}.sql`
const DB37_FILE = `${DB37_TAG}.sql`

// =============================================================================
// DB-16 / DB-18：relay_conversations / relay_messages 重复建表「首定义胜出」
// =============================================================================

describe('DB-16 / DB-18 relay 表 NOT NULL 漂移修复', () => {
  const conversationNotNull = [
    'message_count',
    'total_tokens',
    'total_cost_cents',
    'last_message_at',
    'created_at',
    'updated_at',
  ]
  const messageNotNull = [
    'prompt_tokens',
    'completion_tokens',
    'total_tokens',
    'cost_cents',
    'status',
    'created_at',
  ]

  it('重复建表实例存在：先建表的 010070 与后定义的 020000 各出现一次（DB-18 证据）', () => {
    expect(findCreateTableFiles('relay_conversations')).toEqual([
      '20260801010070_add_relay_conversations_table.sql',
      '20260801020000_add_missing_20_tables.sql',
    ])
    expect(findCreateTableFiles('relay_messages')).toEqual([
      '20260801010070_add_relay_conversations_table.sql',
      '20260801020000_add_missing_20_tables.sql',
    ])
  })

  it('010070 首定义仍是可空（漂移原文），020000 的后定义确实声明 NOT NULL', () => {
    const first = extractCreateTable(
      readDrizzle('20260801010070_add_relay_conversations_table.sql'),
      'relay_conversations',
    )
    const later = extractCreateTable(
      readDrizzle('20260801020000_add_missing_20_tables.sql'),
      'relay_conversations',
    )
    for (const col of conversationNotNull) {
      expect(columnLine(first, col), `${col} 首定义应可空`).not.toMatch(/NOT NULL/i)
      expect(columnLine(later, col), `${col} 后定义应声明 NOT NULL`).toMatch(/NOT NULL/i)
    }

    const firstMsg = extractCreateTable(
      readDrizzle('20260801010070_add_relay_conversations_table.sql'),
      'relay_messages',
    )
    for (const col of messageNotNull) {
      expect(columnLine(firstMsg, col), `${col} 首定义应可空`).not.toMatch(/NOT NULL/i)
    }
  })

  it('修复迁移已落地：先回填 NULL，再逐列 SET NOT NULL（DB-16 修正后）', () => {
    expect(existsSync(join(drizzleDir, DB16_FILE)), `${DB16_FILE} 必须存在`).toBe(true)
    const sql = flat(readDrizzle(DB16_FILE))

    for (const col of conversationNotNull) {
      const backfill =
        col === 'last_message_at' || col === 'created_at' || col === 'updated_at'
          ? `UPDATE relay_conversations SET ${col} = NOW() WHERE ${col} IS NULL`
          : `UPDATE relay_conversations SET ${col} = 0 WHERE ${col} IS NULL`
      expect(sql, `${col} 回填`).toContain(backfill)
      expect(sql, `${col} SET NOT NULL`).toContain(
        `ALTER TABLE relay_conversations ALTER COLUMN ${col} SET NOT NULL`,
      )
    }
    for (const col of messageNotNull) {
      const value = col === 'status' ? "'success'" : col === 'created_at' ? 'NOW()' : '0'
      expect(sql, `${col} 回填`).toContain(
        `UPDATE relay_messages SET ${col} = ${value} WHERE ${col} IS NULL`,
      )
      expect(sql, `${col} SET NOT NULL`).toContain(
        `ALTER TABLE relay_messages ALTER COLUMN ${col} SET NOT NULL`,
      )
    }
  })

  it('DB-18 CI 门禁：重复建表表名集合不得再扩大（冻结当前 165 张）', () => {
    const re = /CREATE TABLE IF NOT EXISTS\s+"?([a-zA-Z0-9_]+)"?\s*\(/gi
    const owners = new Map<string, string[]>()
    for (const file of sqlFiles) {
      const sql = readDrizzle(file)
      let m: RegExpExecArray | null
      while ((m = re.exec(sql)) !== null) {
        const table = m[1].toLowerCase()
        const list = owners.get(table) ?? []
        list.push(file)
        owners.set(table, list)
      }
    }
    const duplicated = [...owners.entries()].filter(([, files]) => files.length > 1)
    expect(
      duplicated.length,
      '禁止新增「对既有表再发 CREATE TABLE IF NOT EXISTS」',
    ).toBeLessThanOrEqual(165)
  })
})

// =============================================================================
// DB-17：ab_tests 宽度 / 默认值 / 非空对齐（以迁移 SQL 为既成事实）
// =============================================================================

describe('DB-17 ab_tests 定义对齐', () => {
  const sqlBlock = () => extractCreateTable(readDrizzle('0043_neat_the_spike.sql'), 'ab_tests')

  it('迁移 SQL 既成事实：varchar(200) / varchar(32) default draft / traffic 100 / target_metric NOT NULL(100) / config NOT NULL', () => {
    const block = flat(sqlBlock())
    expect(block).toContain('"name" varchar(200) NOT NULL')
    expect(block).toContain('"status" varchar(32) DEFAULT \'draft\' NOT NULL')
    expect(block).toContain('"traffic_percent" integer DEFAULT 100 NOT NULL')
    expect(block).toContain('"target_metric" varchar(100) NOT NULL')
    expect(block).toContain('"config" jsonb DEFAULT \'{}\'::jsonb NOT NULL')
  })

  it('TS schema 已按迁移 SQL 对齐（漂移点 255→200 / 64→32+draft / 0→100 / 128 可空→100 非空 / config 可空→非空+默认）', () => {
    const ts = flat(readSchema('ab-tests.ts'))
    expect(ts).toContain("varchar('name', { length: 200 }).notNull()")
    expect(ts).toContain("varchar('status', { length: 32 }).default('draft').notNull()")
    expect(ts).toContain("integer('traffic_percent').default(100).notNull()")
    expect(ts).toContain("varchar('target_metric', { length: 100 }).notNull()")
    expect(ts).toContain("jsonb('config').default({}).notNull()")
  })
})

// =============================================================================
// DB-19：api_key_group_members api_key 唯一索引语义
// =============================================================================

describe('DB-19 api_key_group_members 唯一索引语义', () => {
  it('迁移链是 UNIQUE（01009），020000 的普通同名索引因 IF NOT EXISTS 被静默忽略', () => {
    expect(flat(readDrizzle('20260801010009_api_key_groups.sql'))).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS api_key_group_members_api_key_unique ON api_key_group_members(api_key_id)',
    )
    expect(flat(readDrizzle('20260801020000_add_missing_20_tables.sql'))).toContain(
      'CREATE INDEX IF NOT EXISTS "api_key_group_members_api_key_unique" ON "api_key_group_members"("api_key_id")',
    )
  })

  it('TS schema 声明为 uniqueIndex（与 DB 唯一语义一致）', () => {
    const ts = flat(readSchema('api-key-groups.ts'))
    expect(ts).toContain("uniqueIndex('api_key_group_members_api_key_unique').on(t.apiKeyId)")
    expect(ts).not.toContain("index('api_key_group_members_api_key_unique')")
  })
})

// =============================================================================
// DB-37：两处内联 UNIQUE 的约定名约束
// =============================================================================

describe('DB-37 未命名 UNIQUE 约束按约定名重建', () => {
  it('迁移 SQL 原文仍是内联 UNIQUE（漂移点）', () => {
    expect(flat(readDrizzle('20260801010050_add_channel_quota_fields.sql'))).toContain(
      'UNIQUE(key_pool_id, usage_date)',
    )
    expect(flat(readDrizzle('20260801010060_add_api_key_tpm_tags.sql'))).toContain(
      'UNIQUE(api_key_id, usage_minute)',
    )
  })

  it('TS schema 约定的约束名与修复迁移一致', () => {
    const ts = flat(readSchema('relay-usage.ts'))
    expect(ts).toContain("unique('ai_relay_channel_daily_usage_key_pool_id_usage_date_unique')")
    expect(ts).toContain("unique('api_key_minute_usage_api_key_id_usage_minute_unique')")
  })

  it('修复迁移已落地：删除 PG 自动命名约束 + 按约定名 ADD CONSTRAINT', () => {
    expect(existsSync(join(drizzleDir, DB37_FILE)), `${DB37_FILE} 必须存在`).toBe(true)
    const sql = flat(readDrizzle(DB37_FILE))
    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS "ai_relay_channel_daily_usage_key_pool_id_usage_date_key"',
    )
    expect(sql).toContain(
      'ADD CONSTRAINT "ai_relay_channel_daily_usage_key_pool_id_usage_date_unique" UNIQUE ("key_pool_id", "usage_date")',
    )
    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS "api_key_minute_usage_api_key_id_usage_minute_key"',
    )
    expect(sql).toContain(
      'ADD CONSTRAINT "api_key_minute_usage_api_key_id_usage_minute_unique" UNIQUE ("api_key_id", "usage_minute")',
    )
  })
})

// =============================================================================
// journal ↔ SQL ↔ TS：手写迁移必须登记，when 严格递增
// =============================================================================

describe('journal ↔ SQL 一致性（DB-16 / DB-37）', () => {
  it('两条修复迁移均已登记进 journal，when 严格递增且晚于当前最后一条', () => {
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf-8'),
    ) as {
      entries: Array<{
        idx: number
        when: number
        tag: string
        version: string
        breakpoints: boolean
      }>
    }
    expect(allSql.length).toBeGreaterThan(0)
    const lastBefore = journal.entries.find(
      (e) => e.tag === '20261108110000_usdt_pending_amount_uniq',
    )
    expect(lastBefore, '基线最后一条迁移').toBeDefined()

    const db16 = journal.entries.find((e) => e.tag === DB16_TAG)
    const db37 = journal.entries.find((e) => e.tag === DB37_TAG)
    expect(db16, `${DB16_TAG} 必须登记进 journal`).toBeDefined()
    expect(db37, `${DB37_TAG} 必须登记进 journal`).toBeDefined()
    expect(db16!.version).toBe('7')
    expect(db37!.version).toBe('7')
    expect(db16!.breakpoints).toBe(true)
    expect(db37!.breakpoints).toBe(true)
    expect(db16!.when).toBeGreaterThan(lastBefore!.when)
    expect(db37!.when).toBeGreaterThan(db16!.when)
    expect(db16!.idx).toBeGreaterThan(lastBefore!.idx)
    expect(db37!.idx).toBeGreaterThan(db16!.idx)

    for (const tag of [DB16_TAG, DB37_TAG]) {
      expect(existsSync(join(drizzleDir, `${tag}.sql`)), `${tag}.sql 必须存在`).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
