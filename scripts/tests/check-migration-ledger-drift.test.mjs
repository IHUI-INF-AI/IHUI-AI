// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// §22c:直接 import 源脚本导出的 __test__,不维护任何"镜像常量",杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
import { __test__ as src } from '../check-migration-ledger-drift.mjs'

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const JOURNAL_REL = 'packages/database/drizzle/meta/_journal.json'

test('导入源模块不得触发 main() 副作用(§22d isDirectRun)', () => {
  for (const key of ['parseJournal', 'compareLedger', 'maskDsn', 'resolveDsn', 'parseLedgerTable', 'loadPostgresDriver']) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
  assert.equal(typeof src.loadPostgresDriver, 'function', 'loadPostgresDriver 是函数(测试不调用,避免真实 import 副作用)')
})

test('parseJournal: idx/tag/when 提取,刻意丢弃 hash 字段(判据边界)', () => {
  const sample = JSON.stringify({
    version: '7',
    dialect: 'postgresql',
    entries: [
      { idx: 1, version: '7', when: 1700000000000, tag: '0000_naive_barracuda', breakpoints: true },
      { idx: 2, version: '7', when: 1700086400000, tag: '0001_mature_captain_america', breakpoints: true },
      { idx: 3, version: '7', when: 1700172800000, tag: '0002_lucky_hiroim', breakpoints: true },
    ],
  })
  const parsed = src.parseJournal(sample)
  assert.equal(parsed.entries.length, 3)
  assert.equal(parsed.entries[2].tag, '0002_lucky_hiroim')
  assert.equal(parsed.entries[0].idx, 1)
  assert.ok(!('hash' in parsed.entries[0]), 'parseJournal: 不消费 hash 字段(按序号界定不按 hash)')
})

test('parseJournal: entries 非数组抛错(损坏容错)', () => {
  assert.throws(() => src.parseJournal('{"entries":"not-array"}'))
  assert.throws(() => src.parseJournal('{}'))
})

test('compareLedger: R1 缺行 M<N → 缺其后序号', () => {
  const entries = [
    { idx: 1, tag: 't1', when: 1 },
    { idx: 2, tag: 't2', when: 2 },
    { idx: 3, tag: 't3', when: 3 },
  ]
  const cmp = src.compareLedger(entries, [{ hash: 'x', createdAt: '2026-01-01' }])
  assert.equal(cmp.expected, 3)
  assert.equal(cmp.actual, 1)
  assert.equal(cmp.missing.length, 2)
  assert.equal(cmp.missing[0].idx, 2)
  assert.equal(cmp.missing[1].idx, 3)
  assert.equal(cmp.surplus, 0)
})

test('compareLedger: R2 多余行 M>N → surplus', () => {
  const entries = [
    { idx: 1, tag: 't1', when: 1 },
    { idx: 2, tag: 't2', when: 2 },
    { idx: 3, tag: 't3', when: 3 },
  ]
  const cmp = src.compareLedger(entries, Array.from({ length: 5 }, (_, i) => ({ hash: `h${i}`, createdAt: i })))
  assert.equal(cmp.surplus, 2)
  assert.equal(cmp.missing.length, 0)
})

test('compareLedger: 全对齐 M=N → 无告警', () => {
  const entries = [
    { idx: 1, tag: 't1', when: 1 },
    { idx: 2, tag: 't2', when: 2 },
    { idx: 3, tag: 't3', when: 3 },
  ]
  const cmp = src.compareLedger(entries, [
    { hash: 'a', createdAt: 1 },
    { hash: 'b', createdAt: 2 },
    { hash: 'c', createdAt: 3 },
  ])
  assert.equal(cmp.missing.length, 0)
  assert.equal(cmp.surplus, 0)
})

test('maskDsn: 密码位脱敏,其他部分保留', () => {
  assert.equal(
    src.maskDsn('postgres://user:secretpw@db.host:5432/ihui'),
    'postgres://user:***@db.host:5432/ihui',
  )
})

test('maskDsn: 无凭据原样输出', () => {
  assert.equal(src.maskDsn('postgres://db.host:5432/ihui'), 'postgres://db.host:5432/ihui')
})

test('maskDsn: 空值/非法形态不崩', () => {
  assert.equal(src.maskDsn(''), '(空)')
  assert.equal(src.maskDsn(null), '(空)')
  assert.equal(src.maskDsn('not-a-url'), 'not-a-url')
})

test('resolveDsn: --dsn > IHUI_LEDGER_DSN > DATABASE_URL 优先级', () => {
  assert.equal(src.resolveDsn([], {}), null)
  assert.equal(src.resolveDsn(['--dsn', 'flag://a'], {}), 'flag://a')
  assert.equal(
    src.resolveDsn([], { IHUI_LEDGER_DSN: 'env1://a', DATABASE_URL: 'env2://a' }),
    'env1://a',
  )
  assert.equal(src.resolveDsn([], { DATABASE_URL: 'env2://a' }), 'env2://a')
})

test('parseLedgerTable: 标识符两段通过,非标识符拒绝(防注入)', () => {
  assert.equal(src.parseLedgerTable('drizzle.__drizzle_migrations')?.table, '__drizzle_migrations')
  assert.equal(src.parseLedgerTable('drizzle.__drizzle_migrations')?.schema, 'drizzle')
  assert.equal(src.parseLedgerTable('evil; drop'), null)
  assert.equal(src.parseLedgerTable('nodot'), null)
  assert.equal(src.parseLedgerTable("a'; DROP TABLE--"), null)
})

test('真实 journal 冒烟: 可解析且条目数与生产水位口径同量级', () => {
  const real = src.parseJournal(readFileSync(join(ROOT, JOURNAL_REL), 'utf8'))
  assert.ok(real.entries.length >= 200, `真实 journal 条目数 ${real.entries.length} ≥ 200`)
  assert.ok(!('hash' in real.entries[0]), '真实 journal: 不消费 hash 字段')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
