// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractColumnProvenanceFromSql } from '../check-db-schema-drift.mjs'

/**
 * BUG-50 补记夹具(2026-11-06):`chat_conversations.share_token_expires_at` 曾"库里有、迁移无"。
 *
 * 立因:ihui_dev 里该列由一份未入库的临时迁移件于 2026-11-05 08:01(+08)同事务建出
 * (账本 hash 44ef71cb757e…),既不在任何分支、journal 也无条目;而 origin/main 的
 * TS schema 与 apps/api/src/db/chat-queries.ts 已读写该列 ⇒ 空库部署必 500。
 * 本夹具把"该列在迁移链里有出处 + 迁移件幂等 + journal 已登记"钉住,防止再漂。
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DRIZZLE_DIR = join(__dirname, '..', '..', 'packages', 'database', 'drizzle')
const TAG = '20261106180000_share_token_expires_at'
const FILE = `${TAG}.sql`

test('迁移链对 chat_conversations.share_token_expires_at 有出处', () => {
  const prov = new Map()
  for (const f of readdirSync(DRIZZLE_DIR).filter((x) => x.endsWith('.sql'))) {
    const sql = readFileSync(join(DRIZZLE_DIR, f), 'utf8')
    for (const [t, cols] of extractColumnProvenanceFromSql(sql)) {
      const s = prov.get(t) ?? new Set()
      for (const c of cols) s.add(c)
      prov.set(t, s)
    }
  }
  const cols = prov.get('chat_conversations')
  assert.ok(cols, '迁移链里应能找到 chat_conversations 的建表/加列语句')
  assert.ok(
    cols.has('share_token_expires_at'),
    '整条迁移链必须出现 share_token_expires_at 的出处(否则新环境建不出该列)',
  )
})

test('补建迁移件幂等且已在 journal 登记', () => {
  const path = join(DRIZZLE_DIR, FILE)
  assert.ok(existsSync(path), `缺迁移件 ${FILE}`)
  const sql = readFileSync(path, 'utf8').toLowerCase()
  assert.match(
    sql,
    /add\s+column\s+if\s+not\s+exists\s+"share_token_expires_at"/,
    '必须用 ADD COLUMN IF NOT EXISTS(已建过该列的库重复执行不得报 duplicate_column)',
  )
  assert.doesNotMatch(sql, /drop\s+column|drop\s+table|alter\s+column/, '补建件不得含删列/改列语句')

  const journal = JSON.parse(readFileSync(join(DRIZZLE_DIR, 'meta', '_journal.json'), 'utf8'))
  const entry = journal.entries.find((e) => e.tag === TAG)
  assert.ok(entry, `journal 未登记 ${TAG}(drizzle-kit migrate 不会执行未登记迁移)`)
  assert.equal(typeof entry.when, 'number', 'journal 条目必须有数值 when')
  assert.ok(
    journal.entries.filter((e) => e.idx === entry.idx).length === 1,
    `journal idx 必须唯一(实得 ${entry.idx} 重复)`,
  )
})

