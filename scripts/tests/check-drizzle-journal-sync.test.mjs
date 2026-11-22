// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:check-drizzle-journal-sync.mjs(drizzle 迁移链「文件 ↔ journal」双向对账尺)。
 *
 * §22c 单一真相源:本文件**不复制任何判据**,全部动作 import 源脚本的 `__test__`
 * (judgeJournalSync / readMigrationState / formatStateLine / selfTest)。
 * 立因(2026-11-04 现算):journal entries=364 而目录 .sql=366,两枚孤儿
 * (0364_app_versions_store_channel、20261104120000_agent_team_collab)不会被
 * migrate() 应用 ⇒ 按链新建的库缺表且无人知;本锁把"孤儿必被点名""空集必判死不记绿"
 * "重号/断档必被检出"钉成机器判据。
 * 夹具唯一落点 = mkScratch(§15b/§26,禁 os.tmpdir、禁仓库树内造夹具)。
 */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { mkScratch } from '../lib/scratch-dir.mjs'
import { __test__ as GATE_SRC } from '../check-drizzle-journal-sync.mjs'

const { judgeJournalSync, readMigrationState, formatStateLine, selfTest, Unjudged } = GATE_SRC

/** 源脚本 §22c/§22d 形状锁:判据必须由源提供、必须有 pathToFileURL 直执行守卫,测试侧零复制。 */
test('T0 形状锁:__test__ 符号齐备且源脚本带 isDirectRun/pathToFileURL 守卫', () => {
  for (const key of ['judgeJournalSync', 'readMigrationState', 'formatStateLine', 'selfTest', 'Unjudged']) {
    assert.ok(GATE_SRC[key], `__test__ 缺符号 ${key}`)
  }
})

test('T1 孤儿存在 ⇒ drift 且逐枚点名(超越轴:文件有/journal 无一侧)', () => {
  const entries = [
    { idx: 1, tag: '0000_alpha', version: '7' },
    { idx: 2, tag: '0001_beta', version: '7' },
  ]
  const r = judgeJournalSync({ entries, sqlTags: ['0000_alpha', '0001_beta', '0364_orphan'] })
  assert.equal(r.state, 'drift')
  assert.ok(r.problems.some((p) => p.includes('0364_orphan.sql') && p.includes('文件有/journal 无')))
  assert.equal(r.counts.fileOnly, 1)
})

test('T2 journal 悬空条目(journal 有/文件无)⇒ drift 且点名 tag(另一向差集)', () => {
  const entries = [{ idx: 1, tag: 'ghost_migration', version: '7' }]
  const r = judgeJournalSync({ entries, sqlTags: ['real_one'] })
  assert.equal(r.state, 'drift')
  assert.ok(r.problems.some((p) => p.includes('ghost_migration') && p.includes('journal 有/文件无')))
})

test('T3 journal tag 重号 ⇒ drift 且给出出现次数', () => {
  const entries = [
    { idx: 1, tag: 'dup_tag', version: '7' },
    { idx: 2, tag: 'dup_tag', version: '7' },
  ]
  const r = judgeJournalSync({ entries, sqlTags: ['dup_tag'] })
  assert.equal(r.state, 'drift')
  assert.ok(r.problems.some((p) => p.includes('tag 重号') && p.includes('dup_tag') && p.includes('出现 2 次')))
})

test('T4 journal idx 断档 ⇒ drift 且点名缺号', () => {
  const entries = [
    { idx: 1, tag: 'a', version: '7' },
    { idx: 3, tag: 'c', version: '7' },
  ]
  const r = judgeJournalSync({ entries, sqlTags: ['a', 'c'] })
  assert.equal(r.state, 'drift')
  assert.ok(r.problems.some((p) => p.includes('idx 断档') && p.includes('idx=2')))
})

test('T5 journal 空 entries ⇒ unjudged,绝不记绿(§0.3 枚举到 0 判死)', () => {
  const r = judgeJournalSync({ entries: [], sqlTags: ['a'] })
  assert.equal(r.state, 'unjudged')
  assert.equal(r.problems.length, 0)
  assert.ok(r.unjudgedReasons.some((u) => /0 条/.test(u)))
})

test('T6 .sql 枚举到 0 ⇒ unjudged,不用 0 冒充"没有"', () => {
  const r = judgeJournalSync({ entries: [{ idx: 1, tag: 'a', version: '7' }], sqlTags: [] })
  assert.equal(r.state, 'unjudged')
  assert.ok(r.unjudgedReasons.some((u) => /0 个/.test(u)))
})

test('T7 两面全对齐 ⇒ ok 且结论行单行可解析', () => {
  const entries = [
    { idx: 1, tag: 'a', version: '7' },
    { idx: 2, tag: 'b', version: '7' },
  ]
  const r = judgeJournalSync({ entries, sqlTags: ['a', 'b'] })
  assert.equal(r.state, 'ok')
  const line = formatStateLine(r)
  assert.ok(!/[\r\n]/.test(line), '结论行必须单行(读数不得断行)')
  assert.ok(line.startsWith('DRIZZLE-JOURNAL state=ok'))
})

/** 构造盘面夹具:mkScratch 内 <prefix>/drizzle/{meta/_journal.json, *.sql},用完即删。 */
function fixtureDir(build) {
  const dir = mkScratch('djs-test-')
  const base = join(dir, 'drizzle')
  mkdirSync(join(base, 'meta'), { recursive: true })
  build(base)
  return dir
}

test('T8 盘面 IO:journal 缺失/坏 JSON ⇒ Unjudged 点名原因,不冒红', () => {
  const missing = fixtureDir(() => {
    /* 只留目录,不放 journal */
  })
  try {
    assert.throws(() => readMigrationState({ repoRoot: missing, dirRel: 'drizzle' }), (e) => e instanceof Unjudged && /journal 读不到/.test(e.message))
  } finally {
    rmSync(missing, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
  const broken = fixtureDir((base) => {
    writeFileSync(join(base, 'meta', '_journal.json'), '{not-json', 'utf8')
    writeFileSync(join(base, 'a.sql'), '--\n', 'utf8')
  })
  try {
    assert.throws(() => readMigrationState({ repoRoot: broken, dirRel: 'drizzle' }), (e) => e instanceof Unjudged && /JSON/.test(e.message))
  } finally {
    rmSync(broken, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

test('T9 盘面 IO:真实差集在夹具目录上被读出并判 drift', () => {
  const dir = fixtureDir((base) => {
    const entries = [{ idx: 1, tag: 'a', version: '7', when: 1, breakpoints: true }]
    writeFileSync(join(base, 'meta', '_journal.json'), JSON.stringify({ version: '7', dialect: 'postgresql', entries }), 'utf8')
    writeFileSync(join(base, 'a.sql'), '--\n', 'utf8')
    writeFileSync(join(base, '20261104120000_orphan.sql'), '--\n', 'utf8')
  })
  try {
    const r = judgeJournalSync(readMigrationState({ repoRoot: dir, dirRel: 'drizzle' }))
    assert.equal(r.state, 'drift')
    assert.ok(r.problems.some((p) => p.includes('20261104120000_orphan.sql')))
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

test('T10 源脚本 selfTest 全绿(镜像只调用,不复制判据)', () => {
  const rows = selfTest()
  assert.ok(rows.length >= 5, `自检例数应 ≥5,实得 ${rows.length}`)
  const failed = rows.filter((x) => !x.ok)
  assert.deepEqual(failed.map((x) => `${x.name} — ${x.got}`), [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
