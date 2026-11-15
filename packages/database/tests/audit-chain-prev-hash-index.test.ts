// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-14 API 周期性卡死事故的防回归锁。
 *
 * 事故根因:audit_logs_chain 缺 prev_hash 索引,链尾"取叶"反连接在
 * pg_advisory_xact_lock 内全表扫,写队列吃满连接池。
 * 本测试只做静态断言:迁移/运维脚本/账本登记三者缺一不可。
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const databaseDir = process.cwd()
const repoRoot = join(databaseDir, '../..')
const drizzleDir = join(repoRoot, 'packages/database/drizzle')
const manualDir = join(repoRoot, 'packages/database/scripts/manual-sql')

const MIGRATION_SQL = '20261114191000_audit_logs_chain_prev_hash_idx.sql'
const MANUAL_SQL = '20261114190500_audit_logs_chain_prev_hash_idx_CONCURRENTLY.sql'
const TAG = '20261114191000_audit_logs_chain_prev_hash_idx'
const SEQ_MIGRATION_SQL = '20261114091500_audit_logs_chain_seq.sql'
const SEQ_TAG = '20261114091500_audit_logs_chain_seq'
const INDEX_NAME = 'idx_audit_chain_prev_hash'

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

describe('audit_logs_chain 链尾查询索引防回归', () => {
  it('drizzle 迁移为 (prev_hash) 建索引', () => {
    const path = join(drizzleDir, MIGRATION_SQL)
    expect(existsSync(path)).toBe(true)
    const sql = readFileSync(path, 'utf-8')
    expect(sql).toContain('audit_logs_chain')
    expect(sql).toContain('("prev_hash")')
    expect(sql).toContain(INDEX_NAME)
  })

  it('迁移已登记进 journal 且 idx/when 单调', () => {
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf-8'),
    ) as { entries: JournalEntry[] }
    const at = journal.entries.findIndex((e) => e.tag === TAG)
    expect(at, `${TAG} 必须登记进 journal`).toBeGreaterThan(0)
    expect(journal.entries[at].idx).toBeGreaterThan(journal.entries[at - 1].idx)
    expect(journal.entries[at].when).toBeGreaterThan(journal.entries[at - 1].when)
  })

  it('manual-sql 的 CONCURRENTLY 建法存在(大表不阻塞写入)', () => {
    const path = join(manualDir, MANUAL_SQL)
    expect(existsSync(path)).toBe(true)
    const sql = readFileSync(path, 'utf-8')
    expect(sql).toContain('CREATE INDEX CONCURRENTLY')
    expect(sql).toContain(INDEX_NAME)
  })

  it('链序 seq 迁移也已登记(缺它链尾/校验排序会失效)', () => {
    expect(existsSync(join(drizzleDir, SEQ_MIGRATION_SQL))).toBe(true)
    const journal = JSON.parse(
      readFileSync(join(drizzleDir, 'meta', '_journal.json'), 'utf-8'),
    ) as { entries: JournalEntry[] }
    const at = journal.entries.findIndex((e) => e.tag === SEQ_TAG)
    expect(at, `${SEQ_TAG} 必须登记进 journal`).toBeGreaterThan(0)
    expect(journal.entries[at].when).toBeGreaterThan(journal.entries[at - 1].when)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
