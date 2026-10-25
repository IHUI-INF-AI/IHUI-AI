// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `check-db-migration-gaps.mjs` 的镜像测试(§22c:一律 import 源脚本,不复制判据)。
 *
 * 钉四件事:
 *  ① 中间缺口(lateGap)只认「hash 缺 ∧ when 不在账本 ∧ ≤ maxApplied」——这是 drizzle 永不补的一型;
 *  ② 待应用(pending,when > maxApplied)与 hash 漂移(内容后改/水印)都不得被算成 lateGap(不误报);
 *  ③ 空 journal 不静默造红;
 *  ④ DSN 读取只认 env / env 文件的 DATABASE_URL,且 `readDsn` 不回显 DSN。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { __test__ as G } from '../check-db-migration-gaps.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

describe('迁移账本:中间缺口判据', () => {
  const journal = {
    entries: [
      { tag: 'a_applied', when: 100 },
      { tag: 'b_late', when: 200 },
      { tag: 'c_pending', when: 400 },
      { tag: 'd_drift', when: 300 },
    ],
  }
  const applied = [
    { hash: 'h-a', createdAt: 100 },
    { hash: 'h-d-old', createdAt: 300 },
  ]
  const fileHashOf = (e) => ({ a_applied: 'h-a', b_late: 'h-b', c_pending: 'h-c', d_drift: 'h-d-new' })[e.tag]
  const r = G.classifyMigrationGaps({ journal, applied, fileHashOf })

  it('hash 在账本 ⇒ applied', () => {
    assert.deepEqual(r.applied.map((e) => e.tag), ['a_applied'])
  })
  it('hash 缺 ∧ when 不在账本 ∧ ≤ maxApplied ⇒ lateGap(必红)', () => {
    assert.deepEqual(r.lateGap.map((e) => e.tag), ['b_late'])
  })
  it('when > maxApplied ⇒ pending(下轮会补,不算缺口)', () => {
    assert.deepEqual(r.pending.map((e) => e.tag), ['c_pending'])
  })
  it('hash 缺但 when 在账本 ⇒ hashDrift(内容后改/水印,只报数)', () => {
    assert.deepEqual(r.hashDrift.map((e) => e.tag), ['d_drift'])
  })
  it('空 journal ⇒ 四桶全空,不静默造红', () => {
    const e = G.classifyMigrationGaps({ journal: { entries: [] }, applied: [], fileHashOf: () => null })
    assert.equal(e.applied.length + e.lateGap.length + e.pending.length + e.hashDrift.length, 0)
  })
})

describe('journal → SQL 目录', () => {
  it('SQL 在 journal 的上一级(drizzle/),取错会全读成文件缺失', () => {
    const p = path.resolve('/a/b/drizzle/meta/_journal.json')
    assert.equal(G.migrationsDirOf(p), path.resolve('/a/b/drizzle'))
  })
})

describe('DSN 读取纪律', () => {
  it('env 优先;env 文件只认 DATABASE_URL;失败原因点名文件而不是回显内容', () => {
    const dir = mkScratch('mig-gaps')
    try {
      const f = path.join(dir, '.env')
      mkdirSync(path.dirname(f), { recursive: true })
      writeFileSync(f, 'OTHER=1\nDATABASE_URL=postgres://u:p@127.0.0.1:5432/db\n', 'utf8')
      const fromFile = G.readDsn({ envFile: f, env: {} })
      assert.equal(fromFile.ok, true)
      assert.match(fromFile.from, /\.env$/)
      const fromEnv = G.readDsn({ envFile: f, env: { DATABASE_URL: 'postgres://x:y@127.0.0.1:5432/z' } })
      assert.equal(fromEnv.from, 'env')
      writeFileSync(f, 'OTHER=1\n', 'utf8')
      const miss = G.readDsn({ envFile: f, env: {} })
      assert.equal(miss.ok, false)
      assert.match(miss.why, /DATABASE_URL/)
      assert.doesNotMatch(miss.why, /postgres:\/\//)
    } finally {
      rmScratch(dir)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
