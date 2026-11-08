// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 夹具(2026-11-06):三个索引曾"库里有、迁移无"。
 * 立因:agent_meta_lessons 的 2 个索引与 withdrawal_flows 的部分唯一索引在
 * TS schema 有定义、ihui_dev 库里存在,但迁移链无出处(手工 ALTER / drizzle-kit push),
 * 空库部署会缺索引。本夹具钉住:迁移链有出处 + IF NOT EXISTS + journal 已登记 + idx 唯一。
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DRIZZLE_DIR = join(__dirname, '..', '..', 'packages', 'database', 'drizzle')
const TAG = '20261106213000_agent_meta_lessons_indexes'
const FILE = `${TAG}.sql`
const INDEXES = [
  'agent_meta_lessons_user_type_idx',
  'idx_agent_meta_lessons_type_title',
  'withdrawal_flows_partner_trade_no_uq',
]

function readAllSql() {
  return readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(DRIZZLE_DIR, f), 'utf8'))
    .join('\n')
    .toLowerCase()
}

test('三个索引在迁移链中都有出处', () => {
  const sql = readAllSql()
  for (const idx of INDEXES) {
    assert.ok(sql.includes(idx.toLowerCase()), `迁移链缺少索引 ${idx} 的建索引语句`)
  }
})

test('补建迁移件幂等且已在 journal 登记', () => {
  const path = join(DRIZZLE_DIR, FILE)
  assert.ok(existsSync(path), `缺迁移件 ${FILE}`)
  const sql = readFileSync(path, 'utf8').toLowerCase()
  const creates = sql.match(/create\s+(unique\s+)?index\s+if\s+not\s+exists/g) ?? []
  assert.equal(creates.length, INDEXES.length, '每个索引都必须用 CREATE [UNIQUE] INDEX IF NOT EXISTS')
  for (const idx of INDEXES) {
    assert.ok(new RegExp(`create\\s+(unique\\s+)?index\\s+if\\s+not\\s+exists\\s+"${idx}"`).test(sql), `索引 ${idx} 缺 IF NOT EXISTS`)
  }
  assert.doesNotMatch(sql, /drop\s+index|drop\s+table|drop\s+column|alter\s+table/, '补建件不得含删/改语句')

  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8'))
  const entries = [...journal.entries].sort((a, b) => a.when - b.when)
  const entry = entries.find((e) => e.tag === TAG)
  assert.ok(entry, `journal 未登记 ${TAG}`)
  assert.equal(typeof entry.when, 'number', 'journal 条目必须有数值 when')
  assert.equal(journal.entries.filter((e) => e.idx === entry.idx).length, 1, `journal idx 必须唯一(实得 ${entry.idx} 重复)`)
  const pos = entries.indexOf(entry)
  // 2026-11-08 合并波次:原断言要求"本迁移必须是 when 最大的一条",但 main 后续已落入
  // 20261107/20261108 的前向迁移 ⇒ 该断言锚定的是会随时间前进的量,合并后恒假。
  // 本夹具头注声明的不变量是"出处 + IF NOT EXISTS + journal 已登记 + idx 唯一",
  // 故保留真正的不变量:与相邻前一条严格递增(时间序无并列),不要求恒为末条。
  assert.ok(pos > 0 && entry.when > entries[pos - 1].when, 'when 必须严格大于前一条')
})

