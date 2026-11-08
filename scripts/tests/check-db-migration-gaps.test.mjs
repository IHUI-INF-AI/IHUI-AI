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

describe('DB-13 空账本 / 空 journal 必然是未判定', () => {
  const journal = { entries: [{ tag: 'a_applied', when: 100 }] }

  it('账本 0 行 ⇒ state=undetermined / exit 2，并输出 rows=0', () => {
    const r = G.evaluateGapReport({ journal, applied: [], fileHashOf: () => 'h' })
    assert.equal(r.state, 'undetermined')
    assert.equal(r.exitCode, 2)
    assert.equal(r.rows, 0)
    assert.match(r.reason, /账本 0 行|空账本/)
  })

  it('journal 非数组 / 空数组 / 缺 tag / when 非数字 ⇒ exit 2', () => {
    const bad = [
      {},
      { entries: [] },
      { entries: 'nope' },
      { entries: [{ when: 100 }] },
      { entries: [{ tag: 'a', when: 'abc' }] },
    ]
    for (const j of bad) {
      const r = G.evaluateGapReport({
        journal: j,
        applied: [{ hash: 'h', createdAt: 100 }],
        fileHashOf: () => 'h',
      })
      assert.equal(r.exitCode, 2, JSON.stringify(j))
      assert.equal(r.state, 'undetermined', JSON.stringify(j))
    }
  })
})

describe('DB-14 身份归属：hashDrift 必须阻塞', () => {
  it('when 命中但文件 sha256 与账本 hash 不一致 ⇒ hashDrift 且 exit 1', () => {
    const r = G.evaluateGapReport({
      journal: { entries: [{ tag: 'd_drift', when: 300 }] },
      applied: [{ hash: 'ledger-old', createdAt: 300 }],
      fileHashOf: () => 'file-new',
    })
    assert.deepEqual(
      r.gaps.hashDrift.map((e) => e.tag),
      ['d_drift'],
    )
    assert.equal(r.state, 'red')
    assert.equal(r.exitCode, 1)
  })

  it('账本行带 tag 时按 tag+hash 归属：同 when 不同 tag 不算 applied', () => {
    const r = G.evaluateGapReport({
      journal: { entries: [{ tag: 'new_tag', when: 300 }] },
      applied: [{ hash: 'same-hash', createdAt: 300, tag: 'old_tag' }],
      fileHashOf: () => 'same-hash',
    })
    assert.ok(!r.gaps.applied.some((e) => e.tag === 'new_tag'))
    assert.equal(r.exitCode, 1)
  })
})

describe('DB-15 账本行桶与幂等写入', () => {
  it('输出 rows / dupHashes / dupWhens', () => {
    const r = G.evaluateGapReport({
      journal: { entries: [{ tag: 'a_applied', when: 100 }] },
      applied: [
        { hash: 'h1', createdAt: 100 },
        { hash: 'h1', createdAt: 100 },
        { hash: 'h2', createdAt: 100 },
      ],
      fileHashOf: () => 'h1',
    })
    assert.equal(r.rows, 3)
    assert.equal(r.gaps.dupHashes, 1)
    assert.equal(r.gaps.dupWhens, 1)
  })

  it('补账本插入必须是 WHERE NOT EXISTS（不依赖不存在的 UNIQUE）', () => {
    const sql = G.buildIdempotentLedgerInsertSql('abc', 100)
    assert.match(sql, /where\s+not\s+exists/i)
    assert.match(sql, /hash\s*=\s*'abc'/)
    assert.doesNotMatch(sql, /on\s+conflict/i)
  })
})

describe('DB-12 repair 高危通道默认安全', () => {
  it('默认 dry-run：不带 --apply 不得进入写路径', () => {
    assert.deepEqual(G.resolveRepairMode(['--repair']), { repair: true, apply: false, yes: false })
    assert.deepEqual(G.resolveRepairMode(['--repair', '--apply', '--yes']), {
      repair: true,
      apply: true,
      yes: true,
    })
  })

  it('--journal 必须 realpath 且在 drizzle/meta 内', () => {
    const dir = mkScratch('gaps-repair-path')
    try {
      const meta = path.join(dir, 'packages', 'database', 'drizzle', 'meta')
      mkdirSync(meta, { recursive: true })
      const inside = path.join(meta, '_journal.json')
      writeFileSync(inside, '{}', 'utf8')
      const outside = path.join(dir, 'other.json')
      writeFileSync(outside, '{}', 'utf8')
      assert.equal(G.validateRepairJournalPath({ journalPath: inside, metaDir: meta }).ok, true)
      const bad = G.validateRepairJournalPath({ journalPath: outside, metaDir: meta })
      assert.equal(bad.ok, false)
      assert.match(bad.why, /meta/)
    } finally {
      rmScratch(dir, { bestEffort: true })
    }
  })

  it('tag 必须是 14 位时间戳且对应 .sql 存在', () => {
    assert.equal(
      G.validateRepairTag('20261107150000_shared_to_ops_flag', { fileExists: true }).ok,
      true,
    )
    assert.equal(
      G.validateRepairTag('0000_naive_barracuda', { fileExists: true }).ok,
      false,
    )
    const missing = G.validateRepairTag('20261107150000_shared_to_ops_flag', { fileExists: false })
    assert.equal(missing.ok, false)
    assert.match(missing.why, /不存在/)
  })

  it('SQL 应用与账本写入在同一个 psql -1 会话（一次派生的 -f 与 -c）', () => {
    const args = G.buildRepairPsqlArgs({
      file: 'x.sql',
      hash: 'abc',
      when: 100,
    })
    assert.ok(args.includes('-1'))
    assert.ok(args.includes('-f') && args.includes('x.sql'))
    assert.ok(args.includes('-c'))
    const cIdx = args.indexOf('-c')
    assert.match(args[cIdx + 1], /insert\s+into\s+drizzle/i)
    assert.match(args[cIdx + 1], /where\s+not\s+exists/i)
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
