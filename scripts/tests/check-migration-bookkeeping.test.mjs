// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 守门 49(check-migration-bookkeeping.mjs)的镜像测试。
 *   T1–T6 = B10「journal 登记表空闲性」(2026-09-25 立)
 *   M1–M8 = B1「journal ↔ drizzle/*.sql 双射」的**判定面 / 归属**改造(2026-09-27 立)
 *
 * 取证分两层(AGENTS.md §22c/§22d):
 *   · 判据函数(sqlBasenamesFromListing / diffJournalVsSql)**直接 import** 源脚本的导出,
 *     不抄第二份 —— 源脚本自 2026-09-27 起带 isDirectRun 守卫,import 它不再有副作用;
 *   · 端到端(退出码、逐字输出)仍要 spawn CLI,因为那正是守门对外的形状。
 *
 * ⚠️ 全部 spawn 都必须带 `--root <夹具>`:源脚本的 ROOT 由 import.meta.url 推导(§15),
 *    不再看 process.cwd()。靠 cwd 定位夹具的老写法会在"账面绿"的前提下跑去审真仓 ——
 *    守门 70 的镜像测试 13/14 恒红就是这一型被发现的,本文件的 runGate() 已把该通道封死。
 *
 * T1–T6 钉死 B10(空闲/在飞两态、既有退出码语义一字不动、未判定不得记为空闲);
 * M 族钉死 B1 的四件事:
 *   M1/M2 纯判据的正反两向(集合运算与"恰好一层"的枚举口径)
 *   M3 F 型:别人的未跟踪 .sql 不得让 `--staged` 判红(立项缺陷本身)
 *   M4 C 型:journal 在册而 .sql 只在盘上 ⇒ `--staged` 必须判红(旧版在这一型是**假绿**)
 *   M5 真实拦截力未削弱:.sql 已入索引而 journal 未登记 ⇒ 两档都仍判红
 *   M6 全量档逐字不变:同一夹具下默认档照旧按磁盘判红,且不出现任何索引面字样
 *   M7 索引面取不到 ⇒ exit 2,既不冒红也绝不记绿
 *   M8 反向锁:不得用"跳过/放宽"来消除 false red(判据函数必须仍被两档共用)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import {
  __test__ as GATE49,
  sqlBasenamesFromListing,
  diffJournalVsSql,
} from '../check-migration-bookkeeping.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-migration-bookkeeping.mjs')
const GIT = resolveGitBin()

const ANSI = /\x1b\[[0-9;]*m/g
const strip = (s) => (s ?? '').replace(ANSI, '')

/** B10_WATCH 的五路径(与源脚本同源;改动时两处一起改) */
const WATCH = [
  'packages/database/drizzle/meta/_journal.json',
  'packages/database/src/schema/chat.ts',
  'packages/database/src/schema/relation-tables.ts',
  'apps/api/src/routes/chat.ts',
  'apps/api/src/db/chat-queries.ts',
]

const tagOf = (i) => `2026092500000${i}_mirror_fixture_${i}`

/** 造一份 B1-B5 全绿的最小记账夹具(n 条迁移) */
function writeFixture(root, n) {
  const drizzle = join(root, 'packages/database/drizzle')
  mkdirSync(join(drizzle, 'meta'), { recursive: true })
  const entries = Array.from({ length: n }, (_, i) => ({
    idx: i,
    tag: tagOf(i),
    when: 1760000000000 + i * 1000,
  }))
  writeFileSync(
    join(drizzle, 'meta/_journal.json'),
    `${JSON.stringify({ version: 7, dialect: 'postgresql', entries }, null, 2)}\n`,
  )
  for (const e of entries) writeFileSync(join(drizzle, `${e.tag}.sql`), 'SELECT 1;\n')
  for (const p of WATCH.slice(1)) {
    mkdirSync(dirname(join(root, p)), { recursive: true })
    writeFileSync(join(root, p), 'export {}\n')
  }
}

function gitAt(cwd, args) {
  const r = spawnSync(
    GIT,
    ['-c', 'safe.directory=*', '-c', 'user.name=f', '-c', 'user.email=f@l', '-C', cwd, ...args],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
    },
  )
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败: ${r.stderr}`)
  return r.stdout
}

/** 建一个"干净已提交"的 scratch 仓(五路径全 tracked + 无未跟踪 .sql) */
function mkCleanRepo(prefix) {
  const dir = mkScratch(prefix)
  writeFixture(dir, 2)
  gitAt(dir, ['init', '-q'])
  gitAt(dir, ['add', '-A'])
  gitAt(dir, ['commit', '-q', '--no-verify', '-m', 'fixture'])
  return dir
}

function runGate(cwd, extra = []) {
  // `--root <夹具>` 是**强制**的:源脚本 ROOT 由 import.meta.url 推导,不看 cwd(§15)。
  const r = spawnSync(process.execPath, [GATE, ...extra, '--root', cwd], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  return { code: r.status, out: strip(r.stdout), err: strip(r.stderr) }
}

/** B1-B5 的结论行(排除 B10 段里带"B1-B5"字样的自述行) */
const b15Lines = (out) =>
  out.split(/\r?\n/).filter((l) => /[✓✗!] B[1-5] /.test(l) && !l.includes('不参与 B1-B5'))

/**
 * 让 journal **只在工作树**变脏而结构不变(追加一个尾部换行)。
 * 反例存档:第一版这里写的是"整份覆盖成 entries:[]",那会让 B5 提前 process.exit(1),
 * 于是"在飞态"根本没跑到 B1-B5,T3 拿到空数组 —— 测的成了夹具而不是判据。
 */
function dirtyJournalInWorktree(dir) {
  const p = join(dir, WATCH[0])
  writeFileSync(p, `${readFileSync(p, 'utf8')}\n`)
}

test('T1 空闲态:默认档 exit 0 且 B10 报空闲', () => {
  const dir = mkCleanRepo('gate49-idle-t1')
  try {
    const r = runGate(dir)
    assert.equal(r.code, 0, r.out + r.err)
    assert.match(r.out, /B10 空闲:五路径全干净/)
    assert.ok(!/有人在飞|未判定\(无法取证\)/.test(r.out), '空闲态不得报在飞/未判定')
  } finally {
    rmScratch(dir)
  }
})

test('T2 在飞态:默认档仍 exit 0(不改变既有退出码),--require-idle 才判红', () => {
  const dir = mkCleanRepo('gate49-idle-t2')
  try {
    // 只动工作树(不 add)—— 正是"别人在飞"的形态
    dirtyJournalInWorktree(dir)
    const d = runGate(dir)
    assert.equal(d.code, 0, `B10 warn 级不得改默认退出码:\n${d.out}${d.err}`)
    assert.match(d.out, /B10 未判定,有人在飞/)
    assert.match(d.out, /_journal\.json 仅工作树脏/)
    const ri = runGate(dir, ['--require-idle'])
    assert.equal(ri.code, 1, '--require-idle 必须把在飞升成判红')
    assert.match(ri.err, /B10 --require-idle:journal 登记表非空闲 —— 有人在飞/)
  } finally {
    rmScratch(dir)
  }
})

test('T3 B1-B5 结论行在空闲/在飞两态逐字一致', () => {
  const clean = mkCleanRepo('gate49-idle-t3a')
  const dirty = mkCleanRepo('gate49-idle-t3b')
  try {
    const a = b15Lines(runGate(clean).out)
    dirtyJournalInWorktree(dirty)
    const b = b15Lines(runGate(dirty).out)
    assert.ok(a.length >= 5, `夹具的 B1-B5 结论行不足 5 条,判据失效:${a}`)
    assert.deepEqual(b, a, '在飞态不得改动 B1-B5 的任何结论行')
  } finally {
    rmScratch(clean)
    rmScratch(dirty)
  }
})

test('T4 只有未跟踪 .sql 时:B1-B5 仍绿但 B10 判在飞并点名', () => {
  const dir = mkCleanRepo('gate49-idle-t4')
  try {
    // 追加第 3 条:journal 提交落地(干净),.sql 留在未跟踪面 —— B1 靠磁盘文件仍绿
    writeFixture(dir, 3)
    gitAt(dir, ['add', '--', WATCH[0]])
    gitAt(dir, ['commit', '-q', '--no-verify', '-m', 'journal only'])
    const d = runGate(dir)
    assert.equal(d.code, 0)
    assert.match(d.out, /B1 双向一一对应\(3 ↔ 3\)/, 'B1 必须是绿的,否则本例没证到"只有未跟踪 .sql"')
    assert.match(d.out, /mirror_fixture_2\.sql 未跟踪的迁移文件\(在飞\)/)
    assert.match(d.out, /B10 未判定,有人在飞/)
    assert.equal(runGate(dir, ['--require-idle']).code, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T5 取不到 git 状态:判「未判定」并给原因,绝不得记为空闲', () => {
  const dir = mkScratch('gate49-idle-t5')
  try {
    writeFixture(dir, 2) // 不 git init:整目录不在任何工作树内
    const d = runGate(dir)
    assert.equal(d.code, 0, '未判定同样不得改默认退出码')
    assert.match(d.out, /B10 未判定\(无法取证\):/)
    assert.ok(!/B10 空闲/.test(d.out), '取不到证据时记为空闲 = 把"没查"当成"查过且干净"')
    assert.equal(runGate(dir, ['--require-idle']).code, 1, '未判定在问责档下不等于通过')
  } finally {
    rmScratch(dir)
  }
})

test('T6 B10 不得占用 B1-B4 的「N 条告警」计数器(汇总行是既有语义)', () => {
  const dir = mkCleanRepo('gate49-idle-t6')
  try {
    const clean = runGate(dir)
    writeFileSync(join(dir, WATCH[1]), 'export { inFlight }\n')
    const busy = runGate(dir)
    const countLine = (o) => (o.match(/\[迁移记账\] \d+ 条告警\(非阻塞\)/) ?? ['<无>'])[0]
    assert.equal(countLine(busy.out), countLine(clean.out), 'B10 在飞不得把汇总告警计数从 0 抬上去')
    assert.ok(!/\d+ 条告警/.test(clean.out), '夹具本身应零告警,否则 T6 的前提出错')
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// M 族:B1 的判定面 / 归属改造(2026-09-27,G-268 同型)
//
// 立项缺陷:并行会话在 packages/database/drizzle/ 里留一枚**未跟踪** .sql,
// 本门 `--staged` 因为按 readdirSync(磁盘)枚举而判红,而基线面(干净检出,没有未跟踪文件)
// 判绿 ⇒ 归因层据差分喊"这枚提交把跑绿的东西改红了",唯一"修法"是删别人的文件(§12 事故)。
// 实测代价:2026-09-27 的 92 分钟内 12 次因此拒跳门,终态是脱账的手工 --no-verify。
//
// 每条 M 都配正例 + 反例;M6/M8 是"这次修复**不得**做的事"那一类。
// ═══════════════════════════════════════════════════════════════════════════

const drizzleOf = (dir) => join(dir, 'packages/database/drizzle')
const sqlPathOf = (dir, tag) => join(drizzleOf(dir), `${tag}.sql`)

/** 只在盘上加一枚 .sql(不动 journal)——"别人在飞的迁移"形态 */
function addDiskSql(dir, tag) {
  writeFileSync(sqlPathOf(dir, tag), 'SELECT 9;\n')
}

test('M1 纯判据 sqlBasenamesFromListing:只认 drizzle/ 下恰好一层的 .sql(正反两向)', () => {
  const z = [
    'packages/database/drizzle/20260927000000_a.sql', // 收
    'packages\\database\\drizzle\\20260927000001_b.sql', // 收(Windows 反斜杠形态)
    'packages/database/drizzle/meta/20260927000002_c.sql', // 不收(meta/ 下一层不算)
    'packages/database/drizzle/notes.txt', // 不收(非 .sql)
    'packages/database/other/x.sql', // 不收(不在被审目录)
    'apps/api/drizzle/y.sql', // 不收(前缀不同)
    'drizzle/z.sql', // 不收(缺 packages/database/ 前缀)
    '', // 不收(尾随 NUL 产生的空行)
  ].join('\0')
  assert.deepEqual(
    [...sqlBasenamesFromListing(z)].sort(),
    ['20260927000000_a', '20260927000001_b'],
    '枚举口径必须与默认档的 readdirSync(DIR)(不递归 meta/)同形,否则两档判的不是同一件事',
  )
  // 反例:空清单不得被读成"有一枚空名迁移"
  assert.deepEqual([...sqlBasenamesFromListing('')], [])
  assert.deepEqual([...sqlBasenamesFromListing(null)], [])
})

test('M2 纯判据 diffJournalVsSql:双向差集各自独立(正反两向)', () => {
  assert.deepEqual(diffJournalVsSql(['a', 'b'], ['b', 'c']), {
    journalNoSql: ['a'],
    sqlNoJournal: ['c'],
  })
  const ok = diffJournalVsSql(['a', 'b'], ['b', 'a'])
  assert.deepEqual([ok.journalNoSql, ok.sqlNoJournal], [[], []], '同集合必须两向都空')
  const oneSide = diffJournalVsSql(['a'], [])
  assert.deepEqual([oneSide.journalNoSql, oneSide.sqlNoJournal], [['a'], []])
})

test('M2b §22c 身份锁:测试 import 的就是源脚本那两份判据(不得抄第二份)', () => {
  assert.equal(GATE49.diffJournalVsSql, diffJournalVsSql, '__test__ 里的那一份必须是同一函数对象')
  assert.equal(GATE49.sqlBasenamesFromListing, sqlBasenamesFromListing)
  assert.equal(typeof GATE49.resolveRoot, 'function')
  assert.equal(GATE49.MIG_DIR_REL, 'packages/database/drizzle')
})

test('M3 F 型(立项缺陷本身):别人的未跟踪 .sql 不得让 --staged 判红,但默认档必须仍判红', () => {
  const dir = mkCleanRepo('gate49-b1-m3')
  try {
    addDiskSql(dir, '20260927099999_foreign_inflight')
    const d = runGate(dir)
    assert.equal(d.code, 1, '全量档(磁盘面)是本票的问责面,一行都不许松')
    assert.match(d.out, /B1 \.sql 存在但 journal 未登记\(1\)/)
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 0, `索引面里没有那枚未跟踪 .sql ⇒ 本枚提交不该为它背红:\n${s.out}${s.err}`)
    assert.match(s.out, /B1 双向一一对应\(2 ↔ 2\)/)
    assert.match(s.out, /B1 判定面=索引\(2 个 \.sql 在册\)/)
    assert.match(s.out, /盘上另有 1 枚未跟踪 \.sql 不计入本面/, '"没算进来"与"盘上没有"必须可分')
  } finally {
    rmScratch(dir)
  }
})

test('M4 C 型(反向:旧版在这一型是假绿):journal 在册而 .sql 未入索引 ⇒ --staged 必须判红', () => {
  const dir = mkCleanRepo('gate49-b1-m4')
  try {
    writeFixture(dir, 3) // journal 追加第 3 条 + 盘上写第 3 枚 .sql
    gitAt(dir, ['add', '--', WATCH[0]]) // **只**把 journal 推进索引(第 3 枚 .sql 留在未跟踪面)
    const d = runGate(dir)
    assert.equal(d.code, 0, '默认档按磁盘读:盘上 3 ↔ 3 ⇒ 绿(这正是旧版 --staged 的假绿来源)')
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 1, '索引里有 journal 条目而对应 .sql 不在索引 ⇒ 本枚提交真的缺东西,必须红')
    assert.match(s.out, /B1 journal 有条目但缺 \.sql\(1\)/)
    assert.match(s.out, /盘上另有 1 枚未跟踪 \.sql 不计入本面/)
  } finally {
    rmScratch(dir)
  }
})

test('M5 真实拦截力未削弱:.sql 已入索引而 journal 未登记 ⇒ 两档都仍判红并点名', () => {
  const dir = mkCleanRepo('gate49-b1-m5')
  try {
    addDiskSql(dir, '20260927088888_staged_but_unlisted')
    gitAt(dir, ['add', '--', 'packages/database/drizzle'])
    const d = runGate(dir)
    assert.equal(d.code, 1)
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 1, '把违规 staged 进来之后归属就是本枚 ⇒ 不得因"改造只讲归属"而放过')
    assert.match(s.out, /B1 \.sql 存在但 journal 未登记\(1\): 20260927088888_staged_but_unlisted/)
    assert.match(s.out, /B1 判定面=索引\(3 个 \.sql 在册\)/)
  } finally {
    rmScratch(dir)
  }
})

test('M6 全量档逐字不变:默认档不得出现任何索引面字样,结论行保持既有形状', () => {
  const dir = mkCleanRepo('gate49-b1-m6')
  try {
    const clean = runGate(dir)
    assert.equal(clean.code, 0)
    for (const banned of ['判定面=索引', '不计入本面', '[索引面]', '索引清单取不到'])
      assert.ok(
        !clean.out.includes(banned) && !clean.err.includes(banned),
        `默认档出现了 ${banned}`,
      )
    assert.match(clean.out, /B1 双向一一对应\(2 ↔ 2\)/, '默认档的 B1 结论行必须是改动前那一条')
    addDiskSql(dir, '20260927077777_only_on_disk')
    const dirty = runGate(dir)
    assert.match(
      dirty.out,
      /B1 \.sql 存在但 journal 未登记\(1\)/,
      '默认档必须仍看得见盘上未跟踪的迁移',
    )
  } finally {
    rmScratch(dir)
  }
})

test('M6b 两档同面时结论一致:索引==HEAD==盘上(干净仓)⇒ B1 两档给同一结论', () => {
  const dir = mkCleanRepo('gate49-b1-m6b')
  try {
    const d = runGate(dir)
    const s = runGate(dir, ['--staged'])
    assert.equal(d.code, 0)
    assert.equal(s.code, 0, '面重合时不得无中生有(否则本门在提交链上恒红)')
    const b1 = (o) => (o.match(/B1 [^\n]*/) ?? ['<无>'])[0]
    assert.equal(b1(s.out), b1(d.out), '两档的 B1 结论必须逐字相同')
  } finally {
    rmScratch(dir)
  }
})

test('M7 索引面取不到:exit 2「无法判定」,既不冒红也绝不记绿', () => {
  const dir = mkScratch('gate49-b1-m7')
  try {
    writeFixture(dir, 2) // 不 git init:整目录不在任何工作树内 ⇒ 索引面无从取证
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 2, `取不到判定面必须 exit 2,实得 ${s.code}:\n${s.out}${s.err}`)
    assert.match(s.err, /无法判定\(exit 2\)/)
    assert.ok(
      !/B1 双向一一对应/.test(s.out),
      '没判过就不许出现 B1 的绿结论(把没判写成判过了 = 最高成本)',
    )
    assert.equal(runGate(dir).code, 0, '默认档按磁盘判,不受索引面影响(逐字不变)')
  } finally {
    rmScratch(dir)
  }
})

test('M8 反向锁:本枚在册的红不得被"另有未判定"洗掉(严重度优先级不可逆)', () => {
  const dir = mkCleanRepo('gate49-b1-m8')
  try {
    writeFixture(dir, 3)
    gitAt(dir, ['add', '--', WATCH[0]]) // 本枚自己的红:journal 在册、.sql 不在册
    addDiskSql(dir, '20260927066666_foreign_second') // 同时别人还在飞一枚
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 1, '既有本枚的红又有未判定项 ⇒ 必须按本枚的红判,不得整体降档')
    assert.match(s.out, /B1 journal 有条目但缺 \.sql\(1\)/)
    assert.match(s.out, /盘上另有 2 枚未跟踪 \.sql 不计入本面/, '未判定那一格仍要点名报数,不得静默')
  } finally {
    rmScratch(dir)
  }
})
