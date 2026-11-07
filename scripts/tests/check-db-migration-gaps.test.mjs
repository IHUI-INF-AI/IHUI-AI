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

  it('本 tag 的 when 行 hash == 本 tag 当前文件 hash ⇒ applied', () => {
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

describe('迁移账本:逐行身份与疑似位移边界', () => {
  it('binding-next 全局命中不发绿,本行红且标 offset +1', () => {
    const journal = { entries: [{ tag: 'x', when: 100 }, { tag: 'y', when: 200 }] }
    const applied = [{ hash: 'h-y', createdAt: 100 }, { hash: 'h-x-old', createdAt: 200 }]
    const r = G.classifyMigrationGaps({
      journal,
      applied,
      fileHashOf: (e) => ({ x: 'h-x', y: 'h-y' })[e.tag],
    })
    assert.deepEqual(r.applied.map((e) => e.tag), [])
    assert.deepEqual(r.hashDrift.map((e) => e.tag), ['x', 'y'])
    assert.equal(r.hashDrift[0].suspectedShift.offset, 1)
    assert.equal(r.hashDrift[0].suspectedShift.toTag, 'y')
  })

  it('两个不同 tag 恰好同字节:hash 不唯一,不作位移证据但仍判红', () => {
    const journal = { entries: [{ tag: 'a', when: 100 }, { tag: 'b', when: 200 }, { tag: 'c', when: 300 }] }
    const applied = [{ hash: 'h-dup', createdAt: 100 }, { hash: 'h-b-own', createdAt: 200 }]
    const r = G.classifyMigrationGaps({
      journal,
      applied,
      fileHashOf: (e) => ({ a: 'h-a', b: 'h-dup', c: 'h-dup' })[e.tag],
    })
    assert.ok(r.hashDrift.some((e) => e.tag === 'a'))
    assert.equal(r.hashDrift.find((e) => e.tag === 'a').suspectedShift, undefined)
  })

  it('两 tag 同字节且各自账本行都自证 ⇒ 两条都绿', () => {
    const journal = { entries: [{ tag: 'p', when: 100 }, { tag: 'q', when: 200 }] }
    const applied = [{ hash: 'h-same', createdAt: 100 }, { hash: 'h-same', createdAt: 200 }]
    const r = G.classifyMigrationGaps({ journal, applied, fileHashOf: () => 'h-same' })
    assert.deepEqual(r.applied.map((e) => e.tag), ['p', 'q'])
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

// 夹具:豁免到期即到期 —— 判据源是 scripts/check-db-migration-gaps.mjs 的
// exemptExpired()/partitionHashDrift(),这里只钉它的可观测出口,不复制判据(§22c)。
describe('迁移账本:豁免到期即到期', () => {
  const exempt = {
    byTag: new Map([
      ['expired_pending', { tag: 'expired_pending', state: 'pending', dueAt: '2026-11-06' }],
      ['live_pending', { tag: 'live_pending', state: 'pending', dueAt: '2026-12-07' }],
      ['verified', { tag: 'verified', state: 'rewrite-verified' }],
    ]),
  }
  const today = new Date('2026-11-07T00:00:00+08:00')

  it('dueAt 已过期 ⇒ 进 expired、从 exempted 消失、并计入 unexplained', () => {
    const r = G.partitionHashDrift(['expired_pending', 'live_pending', 'verified', 'no_entry'], exempt, today)
    assert.deepEqual(r.expired, [{ tag: 'expired_pending', dueAt: '2026-11-06' }])
    assert.deepEqual(r.exempted.map((e) => e.tag), ['live_pending', 'verified'])
    assert.deepEqual(r.unexplained, ['expired_pending', 'no_entry'])
    assert.equal(r.counts.pending, 1)
  })

  it('到期边界:dueAt 当天 23:59:59 才算到期,当天 00:00 仍豁免', () => {
    const r = G.partitionHashDrift(['live_pending'], exempt, new Date('2026-12-07T00:00:00+08:00'))
    assert.deepEqual(r.exempted, [{ tag: 'live_pending', state: 'pending' }])
    assert.deepEqual(r.expired, [])
  })

  it('非 pending 条目即使带 dueAt 也永不到期退场', () => {
    const e2 = new Map([['v', { tag: 'v', state: 'rewrite-verified', dueAt: '2020-01-01' }]])
    const r = G.partitionHashDrift(['v'], { byTag: e2 }, today)
    assert.deepEqual(r.exempted, [{ tag: 'v', state: 'rewrite-verified' }])
    assert.deepEqual(r.expired, [])
    assert.deepEqual(r.unexplained, [])
  })
})

// 夹具:lateGap 覆盖注记(裁定二)—— 只换标签,不删除、不进 applied。
// 判据源是 scripts/check-db-migration-gaps.mjs 的 partitionLateGap()/loadLateGapSuperseded()。
describe('迁移账本:lateGap 覆盖注记', () => {
  const journal = { entries: [{ tag: 'late_old', when: 100 }, { tag: 'cover_new', when: 500 }] }
  const raw = {
    entries: [{ tag: 'late_old', coveredBy: 'cover_new', effectiveAt: '2026-11-07', reason: '效果已由后续迁移逐条同文重建' }],
  }

  it('合法注记 ⇒ 条目留在 lateGap 计数里,另立一桶并带 coveredBy/effectiveAt', () => {
    const sup = G.loadLateGapSuperseded(raw, journal.entries)
    assert.equal(sup.ok, true)
    const lateGap = [{ tag: 'late_old', when: 100 }, { tag: 'late_other', when: 200 }]
    const r = G.partitionLateGap(lateGap, sup)
    assert.equal(r.counts.superseded, 1)
    assert.equal(r.counts.unresolved, 1)
    // 总数守恒:被覆盖的条目没有从 lateGap 消失
    assert.equal(r.counts.superseded + r.counts.unresolved, lateGap.length)
    assert.deepEqual(r.superseded[0], {
      tag: 'late_old',
      when: 100,
      coveredBy: 'cover_new',
      effectiveAt: '2026-11-07',
      reason: '效果已由后续迁移逐条同文重建',
    })
    assert.deepEqual(r.unresolved, ['late_other'])
  })

  it('无注记 ⇒ 仍进 unresolved(不静默放水)', () => {
    const r = G.partitionLateGap([{ tag: 'late_other', when: 200 }], { byTag: new Map() })
    assert.deepEqual(r.unresolved, ['late_other'])
    assert.deepEqual(r.superseded, [])
  })

  it('coveredBy 不在 journal / when 不大于本条目 / 日期非法 / 重复 ⇒ 逐条报问题', () => {
    const bad = G.loadLateGapSuperseded(
      {
        entries: [
          { tag: 'late_old', coveredBy: 'missing_tag', effectiveAt: '2026-11-07', reason: 'x' },
          { tag: 'late_old', coveredBy: 'cover_new', effectiveAt: 'not-a-date', reason: 'x' },
          { tag: 'late_old', coveredBy: 'late_old', effectiveAt: '2026-11-07', reason: 'x' },
        ],
      },
      journal.entries,
    )
    assert.equal(bad.ok, false)
    assert.ok(bad.problems.some((p) => /coveredBy 不在 journal/.test(p)))
    assert.ok(bad.problems.some((p) => /when 必须大于/.test(p)))
    assert.ok(bad.problems.some((p) => /effectiveAt 非法/.test(p)))
    assert.ok(bad.problems.some((p) => /重复条目/.test(p)))
  })

  it('classifyMigrationGaps 结构不变:被覆盖条目仍不在 applied', () => {
    const r = G.classifyMigrationGaps({
      journal,
      applied: [{ hash: 'h-new', createdAt: 500 }],
      fileHashOf: (e) => ({ late_old: 'h-old', cover_new: 'h-new' })[e.tag],
    })
    assert.deepEqual(r.applied.map((e) => e.tag), ['cover_new'])
    assert.deepEqual(r.lateGap.map((e) => e.tag), ['late_old'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
