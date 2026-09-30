// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 49(check-migration-bookkeeping.mjs)的镜像测试。
 *   T1–T6 = B10「journal 登记表空闲性」(2026-09-25 立)
 *   M1–M8 = B1「journal ↔ drizzle/*.sql 双射」的**判定面 / 归属**(2026-09-27 立)
 *   W1–W4 = 取材面收口到本仓现行口径(2026-09-28 立):默认档判 **HEAD blob**,`--staged` 判索引,
 *           `--worktree` 降为人工逃生舱;两面旗同给判死;任一面取不到 ⇒ exit 2 且不回落。
 *
 * 取证分两层(AGENTS.md §22c/§22d):
 *   · 判据函数与夹具**直接 import** 源脚本的导出,不抄第二份 —— 源脚本带 isDirectRun 守卫,
 *     import 它不再有副作用;
 *   · 端到端(退出码、逐字输出)仍要 spawn CLI,因为那正是守门对外的形状。
 *
 * ⚠️ 全部 spawn 都必须带 `--root <夹具>`:源脚本的 ROOT 由 import.meta.url 推导(§15),
 *    不再看 process.cwd()。靠 cwd 定位夹具的老写法会在"账面绿"的前提下跑去审真仓 ——
 *    守门 70 的镜像测试 13/14 恒红就是这一型被发现的,本文件的 runGate() 已把该通道封死。
 *
 * ⚠️ 2026-09-28 的口径变更让 T4/T5/M3–M7 的**期望值**整体翻转(默认档不再判磁盘):
 *    旧断言写的是"默认档必须看得见盘上未跟踪的迁移",那是把"默认=磁盘"当规格。
 *    现规格里那一格由 `--worktree` 承接,并且每条都配**同一夹具上的三档对照**,
 *    否则"改了判据"与"改了期望"在账面上分不清(§22c:测试从防线变成掩体)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 遮噪的唯一实现(与守门 131/135 同一份):测试里不得再写第二个剥注释器。
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'
import {
  __test__ as GATE49,
  sqlBasenamesFromListing,
  diffJournalVsSql,
  faceFromArgv,
  faceJournalSpec,
  faceSqlListArgs,
  worktreeOnlyDirtyPaths,
  parsePorcelainZ,
  writeGateFixture,
  mkFixtureRepo,
  runGateAt,
  gitIn,
  fixtureTagOf,
  FIXTURE_WATCH_OTHERS,
  // B11(2026-09-28 立):判据三出口 + 账本快照夹具,一律**直接 import 源脚本那一份**(§22c)
  migrationSqlHash,
  faceSqlBlobSpec,
  parseLedgerRows,
  compareAppliedHashes,
  readSqlBodies,
  ledgerFileFromArgv,
  ledgerSnapshotOf,
  writeLedgerSnapshot,
  readAuditFace,
  MIGRATION_IMMUTABLE_HINT,
  FIXTURE_SQL,
  FIXTURE_SQL_TAMPERED,
} from '../check-migration-bookkeeping.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-migration-bookkeeping.mjs')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const JOURNAL_REL = 'packages/database/drizzle/meta/_journal.json'
const MIG_DIR_REL = 'packages/database/drizzle'

/** B10_WATCH 的五路径(journal + 另外四个,与源脚本的 B10_WATCH 同源;改动两处一起改) */
const WATCH = [JOURNAL_REL, ...FIXTURE_WATCH_OTHERS]

/**
 * 夹具与 spawn 一律**委托源脚本导出的那一份实现**(§22c:不得在测试里抄第二份夹具)。
 * 本文件只保留薄包装:runGate 加 `--root`、mkCleanRepo 换前缀。
 */
function gitAt(cwd, a) {
  return gitIn(cwd, a)
}

/** 建一个"干净已提交"的 scratch 仓(五路径全 tracked + 无未跟踪 .sql) */
function mkCleanRepo(prefix) {
  return mkFixtureRepo(prefix, 2)
}

function runGate(cwd, extra = []) {
  // `--root <夹具>` 是**强制**的:源脚本 ROOT 由 import.meta.url 推导,不看 cwd(§15)。
  return runGateAt(cwd, extra)
}

/** B1-B5 的结论行(排除 B10 段里带"B1-B5"字样的自述行) */
const b15Lines = (out) =>
  out.split(/\r?\n/).filter((l) => /[✓✗!] B[1-5] /.test(l) && !l.includes('不参与 B1-B5'))

/**
 * 让 journal **只在工作树**变脏而结构不变(追加一个尾部换行)。
 * 反例存档:第一版这里写的是"整份覆盖成 entries:[]",那会让 B5 提前判死,
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

test('T4 只有未跟踪 .sql 时:HEAD/索引两档 B1-B5 仍绿,B10 判在飞并点名,磁盘档判红', () => {
  const dir = mkCleanRepo('gate49-idle-t4')
  try {
    // 只在盘上丢一枚未跟踪 .sql,journal 三个面都不动 —— 这才是"别人在飞的迁移"的本相。
    // (旧写法是"提交 journal 第 3 条 + .sql 留未跟踪":在 2026-09-28 的口径下 HEAD 档
    //  本就该判红(journal 在册而 .sql 不在 HEAD),那不再是"在飞噪声",而是真缺东西。)
    writeFileSync(join(dir, MIG_DIR_REL, `${fixtureTagOf(2)}.sql`), 'SELECT 9;\n')
    const d = runGate(dir)
    assert.equal(d.code, 0, `HEAD 档不该为未跟踪文件背红:\n${d.out}${d.err}`)
    assert.match(d.out, /B1 双向一一对应\(2 ↔ 2\)/, 'B1 必须绿,否则本例没证到"只有未跟踪 .sql"')
    assert.match(d.out, /_gate49_fixture_2\.sql 未跟踪的迁移文件\(在飞\)/)
    assert.match(d.out, /B10 未判定,有人在飞/)
    assert.equal(runGate(dir, ['--require-idle']).code, 1)
    // 配对:同一夹具的磁盘档必须看得见它(那一格没丢,只是不再默认)
    assert.equal(runGate(dir, ['--worktree']).code, 1, '磁盘档必须仍判红,否则逃生舱名不副实')
  } finally {
    rmScratch(dir)
  }
})

test('T5 取不到 git 状态:判「未判定」并给原因,绝不得记为空闲', () => {
  const dir = mkScratch('gate49-idle-t5')
  try {
    writeGateFixture(dir, 2) // 不 git init:整目录不在任何工作树内
    // 2026-09-28 口径:默认档判 HEAD ⇒ 非 git 目录**取不到面**,必须 exit 2(不得记绿),
    // 也不得再像旧版那样静默退化成"按磁盘判所以 exit 0"。
    const d = runGate(dir)
    assert.equal(d.code, 2, `非 git 目录的默认档必须判死,实得 ${d.code}:\n${d.out}${d.err}`)
    assert.match(d.err, /无法判定\(exit 2\)/)
    // 逃生档仍能判(它本来就是磁盘面),且 B10 必须报"未判定(无法取证)"而不是"空闲"
    const w = runGate(dir, ['--worktree'])
    assert.equal(w.code, 0, '磁盘面不依赖 git,B1-B5 应照常判:\n' + w.out + w.err)
    assert.match(w.out, /B10 未判定\(无法取证\):/)
    assert.ok(!/B10 空闲/.test(w.out), '取不到证据时记为空闲 = 把"没查"当成"查过且干净"')
    assert.equal(
      runGate(dir, ['--worktree', '--require-idle']).code,
      1,
      '未判定在问责档下不等于通过',
    )
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

test('M3 F 型(立项缺陷本身):别人的未跟踪 .sql 不得让 --staged / HEAD 档判红,磁盘档必须判红', () => {
  const dir = mkCleanRepo('gate49-b1-m3')
  try {
    addDiskSql(dir, '20260927099999_foreign_inflight')
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 0, `索引面里没有那枚未跟踪 .sql ⇒ 本枚提交不该为它背红:\n${s.out}${s.err}`)
    assert.match(s.out, /B1 双向一一对应\(2 ↔ 2\)/)
    assert.match(s.out, /B1 判定面=索引 blob.*\(2 个 \.sql 在册\)/)
    assert.match(s.out, /另有 1 枚未跟踪 \.sql/, '"没算进来"与"盘上没有"必须可分')
    // 2026-09-28:默认档改判 HEAD —— 那枚未跟踪文件同样不在 HEAD 里,所以默认档也必须绿。
    const d = runGate(dir)
    assert.equal(d.code, 0, `HEAD 档里没有它:\n${d.out}${d.err}`)
    assert.match(d.out, /B1 判定面=HEAD blob/)
    // 配对:磁盘档(逃生舱)必须仍看得见它,否则"收口"就把这一格弄丢了
    const w = runGate(dir, ['--worktree'])
    assert.equal(w.code, 1, '磁盘档必须仍判红(旧默认档的可见性由 --worktree 承接)')
    assert.match(w.out, /B1 \.sql 存在但 journal 未登记\(1\)/)
  } finally {
    rmScratch(dir)
  }
})

test('M4 C 型(反向:旧版在这一型是假绿):journal 在册而 .sql 未入索引 ⇒ --staged 必须判红', () => {
  const dir = mkCleanRepo('gate49-b1-m4')
  try {
    writeGateFixture(dir, 3) // journal 追加第 3 条 + 盘上写第 3 枚 .sql
    gitAt(dir, ['add', '--', WATCH[0]]) // **只**把 journal 推进索引(第 3 枚 .sql 留在未跟踪面)
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 1, '索引里有 journal 条目而对应 .sql 不在索引 ⇒ 本枚提交真的缺东西,必须红')
    assert.match(s.out, /B1 journal 有条目但缺 \.sql\(1\)/)
    assert.match(s.out, /另有 1 枚未跟踪 \.sql/)
    const d = runGate(dir)
    assert.equal(d.code, 0, '默认档判 HEAD:HEAD 里 journal 仍是 2 条 ⇒ 不为本枚在飞的改动背红')
    assert.equal(runGate(dir, ['--worktree']).code, 0, '磁盘面盘上 3 ↔ 3 ⇒ 绿')
  } finally {
    rmScratch(dir)
  }
})

test('M5 真实拦截力未削弱:.sql 已入索引而 journal 未登记 ⇒ 索引档与磁盘档都判红并点名', () => {
  const dir = mkCleanRepo('gate49-b1-m5')
  try {
    addDiskSql(dir, '20260927088888_staged_but_unlisted')
    gitAt(dir, ['add', '--', MIG_DIR_REL])
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 1, '把违规 staged 进来之后归属就是本枚 ⇒ 不得因"改造只讲归属"而放过')
    assert.match(s.out, /B1 \.sql 存在但 journal 未登记\(1\): 20260927088888_staged_but_unlisted/)
    assert.match(s.out, /B1 判定面=索引 blob.*\(3 个 \.sql 在册\)/)
    assert.equal(runGate(dir, ['--worktree']).code, 1, '磁盘档同样必须红')
    // HEAD 档:那枚文件从未入库 ⇒ HEAD 自身合法,不背这一格(归属判据,不是放宽判据)
    assert.equal(runGate(dir).code, 0)
  } finally {
    rmScratch(dir)
  }
})

test('M6 默认档不得是磁盘档:必须点名 HEAD blob,且结论行形状保持既有', () => {
  const dir = mkCleanRepo('gate49-b1-m6')
  try {
    const clean = runGate(dir)
    assert.equal(clean.code, 0)
    assert.match(clean.out, /判定面 = HEAD blob/, '默认档必须自报它判的是 HEAD')
    assert.match(clean.out, /B1 双向一一对应\(2 ↔ 2\)/, 'B1 结论行的形状不得因收口而变')
    // 反向锁:默认档不得出现"工作树(磁盘)"字样
    assert.ok(!/判定面 = 工作树/.test(clean.out), '默认档又退回磁盘面了(本票要消灭的那一型)')
  } finally {
    rmScratch(dir)
  }
})

test('M6b 三面同面时结论一致:索引==HEAD==盘上(干净仓)⇒ 三档给同一结论', () => {
  const dir = mkCleanRepo('gate49-b1-m6b')
  try {
    const d = runGate(dir)
    const s = runGate(dir, ['--staged'])
    const w = runGate(dir, ['--worktree'])
    assert.equal(d.code, 0)
    assert.equal(s.code, 0, '面重合时不得无中生有(否则本门在提交链上恒红)')
    assert.equal(w.code, 0)
    const b1 = (o) => (o.match(/✓ B1 [^\n]*/) ?? ['<无>'])[0]
    assert.equal(b1(s.out), b1(d.out), '两档的 B1 结论必须逐字相同')
    assert.equal(b1(w.out), b1(d.out), '磁盘档同理')
  } finally {
    rmScratch(dir)
  }
})

test('M7 索引面取不到:exit 2「无法判定」,既不冒红也绝不记绿,也不回落到磁盘面', () => {
  const dir = mkScratch('gate49-b1-m7')
  try {
    writeGateFixture(dir, 2) // 不 git init:整目录不在任何工作树内 ⇒ 索引面无从取证
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 2, `取不到判定面必须 exit 2,实得 ${s.code}:\n${s.out}${s.err}`)
    assert.match(s.err, /无法判定\(exit 2\)/)
    assert.ok(
      !/B1 双向一一对应/.test(s.out),
      '没判过就不许出现 B1 的绿结论(把没判写成判过了 = 最高成本)',
    )
    // 关键新增:取不到索引面**不得回落**到磁盘面 —— 回落就是把"没判"写成"判过了"
    assert.ok(
      !/全部通过/.test(s.out + s.err),
      '索引面取不到却打出通过结论 = 静默回落(守门 93/124 同型)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('M8 反向锁:本枚在册的红不得被"另有未判定"洗掉(严重度优先级不可逆)', () => {
  const dir = mkCleanRepo('gate49-b1-m8')
  try {
    writeGateFixture(dir, 3)
    gitAt(dir, ['add', '--', WATCH[0]]) // 本枚自己的红:journal 在册、.sql 不在册
    addDiskSql(dir, '20260927066666_foreign_second') // 同时别人还在飞一枚
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 1, '既有本枚的红又有未判定项 ⇒ 必须按本枚的红判,不得整体降档')
    assert.match(s.out, /B1 journal 有条目但缺 \.sql\(1\)/)
    assert.match(s.out, /另有 2 枚未跟踪 \.sql/, '未判定那一格仍要点名报数,不得静默')
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// W 族:2026-09-28 取材面收口的**装车证明 + 反向锁**
//
// W1 = 只读地核 runner 注册项(本门确实在提交链上、确实是 blocking、跳过变量确实在位);
// W2 = 源码级反向锁:不得再出现"默认判磁盘"的写法(判据不得 readFileSync 被审正文);
// W3 = 三面取材的构造面证明(HEAD / 索引 / 磁盘各取哪一份规格互不相同);
// W4 = 两面旗同给 ⇒ exit 2(端到面,不只是纯函数层)。
// W1/W2 都是本仓"门存在、判据对、无人调度"与"文档写了跑不通的出路"两型的防线。
// ═══════════════════════════════════════════════════════════════════════════

test('W1 装车证明:runner 里这条门注册为 blocking,跳过变量与脚本自读同名(只读断言)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const i = runner.indexOf("script: 'check-migration-bookkeeping.mjs'")
  assert.ok(i > 0, 'runner 里没有这条门的 script 行 —— 门被摘线了')
  // 取该 script 行所在的注册块(向前找 id:、向后找下一个 id:)
  const head = runner.lastIndexOf('id:', i)
  const next = runner.indexOf('\n    id:', i)
  const block = runner.slice(head, next > 0 ? next : i + 1200)
  assert.match(block, /id: '49'/, '注册项的 id 必须是 49')
  assert.match(block, /mode: 'blocking'/, '本门必须是 blocking(降成 warn 等于没人被打断)')
  assert.ok(
    !/mode: 'warn'/.test(block),
    `同一注册块里出现 warn 说明定级被改:\n${block.slice(0, 400)}`,
  )
  // 跳过变量的**成对性**:runner 声明了 skipEnv ⇒ 脚本必须读它;脚本读它 ⇒ 两侧名字必须同。
  const declared = /skipEnv: '([A-Z0-9_]+)'/.exec(block)
  const src = readFileSync(GATE, 'utf8')
  const read = /process\.env\.(HUSKY_SKIP_[A-Z0-9_]+)/.exec(src)
  assert.ok(read, '脚本里没有应急跳过出口 —— 恒红时唯一出路会退化成 --no-verify')
  if (declared)
    assert.equal(
      declared[1],
      read[1],
      `runner 声明的 skipEnv(${declared[1]})与脚本自读的(${read[1]})不同名 —— 假逃生舱`,
    )
})

test('W2 反向锁:被审正文不得再由 readFileSync 从磁盘取(默认档必须是 HEAD)', () => {
  const src = readFileSync(GATE, 'utf8')
  // ① 旧的"默认判磁盘"写法不得回来:判据里不得出现按绝对路径读 journal 的调用
  for (const banned of ['readFileSync(JOURNAL', 'readFileSync(join(ROOT', 'readFileSync(DIR'])
    assert.ok(
      !src.includes(banned),
      `源码里又出现 ${banned} —— 那就是按磁盘判被审正文(本票要消灭的形态)`,
    )
  // ② 三面取材必须走统一层
  assert.ok(/catBatch\(/.test(src), '正文取材必须走 face-reader 的 catBatch')
  assert.ok(/readWorktreeFile\(/.test(src), '磁盘逃生舱必须走 face-reader 的 readWorktreeFile')
  assert.ok(/selectFace\(/.test(src), '面旗选择必须走 face-reader 的 selectFace(三门共用一条)')
  // ③ **运行时**证明默认面不是 worktree(正则会被注释绕过,函数不会)
  assert.equal(faceFromArgv([]).face, 'head', '默认档退回磁盘 = 本票的立项缺陷复活')
  assert.equal(faceJournalSpec('head'), `HEAD:${JOURNAL_REL}`)
  assert.equal(faceJournalSpec('staged'), `:${JOURNAL_REL}`)
  assert.deepEqual(faceSqlListArgs('head'), [
    'ls-tree',
    '-r',
    '--name-only',
    '-z',
    'HEAD',
    '--',
    MIG_DIR_REL,
  ])
})

test('W3 仅工作树脏的判序:M␠/ MM / ?? 都不得被算进来(正反成对)', () => {
  const rows = parsePorcelainZ(
    [
      ' M packages/database/drizzle/meta/_journal.json',
      'M  packages/database/drizzle/a.sql',
      'MM packages/database/drizzle/b.sql',
      '?? packages/database/drizzle/c.sql',
    ].join('\0'),
  )
  assert.deepEqual(worktreeOnlyDirtyPaths(rows), ['packages/database/drizzle/meta/_journal.json'])
  assert.deepEqual(worktreeOnlyDirtyPaths([]), [])
  assert.deepEqual(worktreeOnlyDirtyPaths(null), [])
})

test('W4 两面旗同给 ⇒ exit 2(端到面,不只是纯函数层)', () => {
  const dir = mkCleanRepo('gate49-w4')
  try {
    const r = runGate(dir, ['--staged', '--worktree'])
    assert.equal(r.code, 2, `两个互斥面同时给必须判死,实得 ${r.code}:\n${r.out}${r.err}`)
    assert.match(r.err, /不得同用/)
    assert.ok(!/全部通过/.test(r.out + r.err), '判死不得被读成通过')
  } finally {
    rmScratch(dir)
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// H 族:B11「已应用迁移的内容 ↔ 账本 hash 对账」(2026-09-28 立)
//
// 立项凭据(实测,不是推测):`drizzle-orm/pg-core/dialect.js:44-71` 的 migrate() 只问
//   `Number(lastDbMigration.created_at) < migration.folderMillis`,**从不读回 hash**;
//   hash 只在插入时写一次(`drizzle-orm/migrator.js:15,23`)。
// ⇒ 改一枚**已应用** .sql 的一个字符 = **静默分叉**(P1:既不重跑也不报错),运行时永远发现不了,
//   这一格此前**没有任何尺子**(B9 只验库内 hash 的形状与唯一性,从不读 .sql 正文)。
//
// H1 = 配方锁:本门的 hash 必须逐字等于 drizzle 写账本时用的那一把(用真仓 HEAD 的 blob 验);
// H2 = 端到端正反成对(票面要求的 ①②③):分叉必点名 / 未应用不红 / 离线不记绿;
// H3 = 反向锁:**没账本可比时默认档绝不判红**(提交链不带 --db ⇒ 不得新增恒红门,§12e);
// H4 = 两个账本来源同给判死 + `--db-ledger` 用法缺失判死(不猜路径);
// H5 = 装车锁:B11 判据必须真挂在 CLI 主流程上(守门 70/76/81 同型:"函数在、自检过、没人调");
// H6 = 禁止的处置不得被实现进来(重算并覆盖账本 hash = 给分叉发通行证);
// H7 = 三态不并桶的纯判据层(取不到正文 ≠ 分叉 ≠ 通过)。
// ═══════════════════════════════════════════════════════════════════════════

/** 夹具仓 + 账本快照:一步到位(快照落在 drizzle/ 之外,不进 B1 的枚举面)。 */
function mkLedgerRepo(prefix, n = 2, opts = {}) {
  const dir = mkFixtureRepo(prefix, n)
  const entries = JSON.parse(readFileSync(join(dir, JOURNAL_REL), 'utf8')).entries
  const rel = writeLedgerSnapshot(dir, ledgerSnapshotOf(entries, opts))
  return { dir, entries, rel }
}

test('H1 配方锁:hash 逐字等于 drizzle 写账本那一把(真仓 HEAD blob + 同把独立现算)', () => {
  // 判据的对象是"某个真实文件的形态"⇒ 至少一条用例的输入必须逐字取自那个真实文件(§22c)。
  // 这里取真仓 HEAD 里**真的一枚迁移 .sql**,而不是自造夹具。
  const audit = readAuditFace(REPO, 'head')
  const tag = audit.sqls[0]
  assert.ok(tag, '真仓 HEAD 里一枚 .sql 都枚举不到 —— 本例无从取证(不是"没问题")')
  const bodies = readSqlBodies(REPO, 'head', [tag])
  const text = bodies.get(tag)
  assert.equal(typeof text, 'string', `HEAD blob 取不到 ${tag}`)
  // ① 与 Node crypto 现算逐字同形(用同一份原文,不预先 trim)
  assert.equal(
    migrationSqlHash(text),
    createHash('sha256').update(text, 'utf8').digest('hex'),
    'hash 配方必须与 drizzle-orm/migrator.js:23 一致',
  )
  // ② 真仓迁移正文**带着溯源横幅**(零宽载荷那一族)⇒ 现算的 hash 必然把横幅算进去。
  //    这正是 2026-09-13 旧通道"0 命中"的成因,所以它是本判据必须覆盖的形态,而不是要绕开的噪声。
  assert.match(text.slice(0, 200), /© \d{4} IHUI AI/, '夹具外的真实形态:正文开头应有版权横幅')
  // ③ 反向锁:一个字符之差必须换掉整把 hash(判据有牙的最低要求)
  assert.notEqual(migrationSqlHash(text), migrationSqlHash(`${text} `), '尾随一个空格必须改变 hash(= 不得 trim)')
  assert.equal(
    [faceSqlBlobSpec('head', tag), faceSqlBlobSpec('staged', tag), faceSqlBlobSpec('worktree', tag)]
      .map((v) => v ?? 'null')
      .join('|'),
    `HEAD:${MIG_DIR_REL}/${tag}.sql|:${MIG_DIR_REL}/${tag}.sql|null`,
    '三面各取哪一份 .sql 必须互不相同(不混面)',
  )
})

test('H2 端到端①:已应用迁移被改一个字符 ⇒ exit 1 并点名 tag + 唯一修法', () => {
  const { dir, rel } = mkLedgerRepo('gate49-b11-h2')
  try {
    const before = runGate(dir, ['--db-ledger', rel])
    assert.equal(before.code, 0, `改动前必须绿(否则下面的红可能是夹具坏了):\n${before.out}`)
    assert.match(
      before.out,
      /✓ B11 2 枚已应用迁移的内容与账本 hash 逐枚相符\(2 枚等值\)/,
      before.out.match(/B11 [^\n]*/g)?.join(' | '),
    )

    writeFileSync(join(dir, MIG_DIR_REL, `${fixtureTagOf(1)}.sql`), FIXTURE_SQL_TAMPERED)
    gitIn(dir, ['add', '-A', '--', MIG_DIR_REL])
    gitIn(dir, ['commit', '-q', '--no-verify', '-m', 'edit an APPLIED migration in place'])
    const r = runGate(dir, ['--db-ledger', rel])
    assert.equal(r.code, 1, `改一枚已应用迁移必须判红,实得 ${r.code}:\n${r.out}${r.err}`)
    assert.match(r.out, /B11 有 1 枚\*\*已应用\*\*迁移的内容与账本 hash 不符:/)
    assert.ok(r.out.includes(fixtureTagOf(1)), '必须点名那一枚被改的 tag')
    assert.ok(!r.out.includes(`${fixtureTagOf(0)} when=`), '未被动过的那一枚不得被牵连计账')
    assert.match(r.out + r.err, new RegExp(MIGRATION_IMMUTABLE_HINT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  } finally {
    rmScratch(dir)
  }
})

test('H2b 端到端②:同一枚内容被改,但它尚未应用 ⇒ 不红(且必须报名,不是静默)', () => {
  const { dir, rel } = mkLedgerRepo('gate49-b11-h2b', 2, { notApplied: [fixtureTagOf(1)] })
  try {
    writeFileSync(join(dir, MIG_DIR_REL, `${fixtureTagOf(1)}.sql`), FIXTURE_SQL_TAMPERED)
    gitIn(dir, ['add', '-A', '--', MIG_DIR_REL])
    gitIn(dir, ['commit', '-q', '--no-verify', '-m', 'edit a NOT-YET-APPLIED migration'])
    const r = runGate(dir, ['--db-ledger', rel])
    assert.equal(r.code, 0, `未应用的迁移内容可以改:\n${r.out}${r.err}`)
    assert.match(
      r.out,
      /账本里没有其 when 的 journal 条目 1 条\(未应用的新迁移:/,
      r.out.match(/账本里没有其 when[^\n]*/)?.[0],
    )
    assert.ok(r.out.includes(fixtureTagOf(1)), '"报数不报名"会让下一个人不知道是哪一条')
    assert.ok(!/不符/.test(r.out), '未应用的那一枚不得出现在分叉清单里')
  } finally {
    rmScratch(dir)
  }
})

test('H3 反向锁③:离线档没账本 ⇒ "未判定" + 不改退出码(不得新增恒红门)', () => {
  const { dir } = mkLedgerRepo('gate49-b11-h3')
  try {
    // 故意造一条**真实分叉**(改了已应用的 .sql)而此刻没有账本可比:
    // 提交链(runner id 49 的 args: [])走的正是这一档 ⇒ 判红会把每台每次提交逼成 --no-verify。
    writeFileSync(join(dir, MIG_DIR_REL, `${fixtureTagOf(1)}.sql`), FIXTURE_SQL_TAMPERED)
    gitIn(dir, ['add', '-A', '--', MIG_DIR_REL])
    gitIn(dir, ['commit', '-q', '--no-verify', '-m', 'applied migration edited, no ledger here'])
    const r = runGate(dir)
    assert.equal(r.code, 0, `离线档必须不判红(实得 ${r.code}):\n${r.out}${r.err}`)
    assert.match(r.out, /B11 \*\*未判定\*\* —— 原因:离线档/)
    assert.ok(!/已比对/.test(r.out), '没判过就不许出现"已比对 N 枚"(把没判写成判过了)')
    assert.match(r.out, /全部通过[^\n]*B11 未判定/, '汇总行必须带着这一维,不得读起来像全绿')
    // 问责档才拒绝出合格证
    const s = runGate(dir, ['--strict'])
    assert.equal(s.code, 1, '--strict 下"未判定"必须判死,实得 ' + s.code)
    assert.match(s.err, /B11 --strict/)
    // --db 连不上库(本机无 PG,且取证一律不碰 8810)⇒ 同样"未判定 + 不改退出码"
    const d = runGateAt(dir, ['--db'], { DATABASE_URL: '' })
    assert.equal(d.code, 0, `--db 无库时既有语义一字未动:\n${d.out}${d.err}`)
    assert.match(d.out, /B11 \*\*未判定\*\* —— 原因:没有 DATABASE_URL/)
  } finally {
    rmScratch(dir)
  }
})

test('H4 两个账本来源同给 / --db-ledger 缺参数 ⇒ exit 2(判死不猜)', () => {
  const { dir, rel } = mkLedgerRepo('gate49-b11-h4')
  try {
    const both = runGate(dir, ['--db', '--db-ledger', rel])
    assert.equal(both.code, 2, `实时库与落盘快照互斥:\n${both.out}${both.err}`)
    assert.match(both.err, /不得同用/)
    const miss = runGate(dir, ['--db-ledger'])
    assert.equal(miss.code, 2, '--db-ledger 后面没给文件必须判死,不得拿 undefined 当路径')
    assert.match(miss.err, /--db-ledger 需要一个文件参数/)
    assert.deepEqual(ledgerFileFromArgv(['--db-ledger=x.txt']), { file: 'x.txt', error: null })
  } finally {
    rmScratch(dir)
  }
})

test('H5 装车锁:B11 判据必须真挂在 CLI 主流程上(不是"函数在、自检过、没人调")', () => {
  const src = readFileSync(GATE, 'utf8')
  const at = src.indexOf('if (isDirectRun) {')
  assert.ok(at > 0, '源脚本必须有 isDirectRun 守卫(§22d)')
  const cli = src.slice(at)
  for (const needed of ['compareAppliedHashes(', 'readSqlBodies(', 'parseLedgerRows(']) {
    assert.ok(cli.includes(needed), `CLI 主流程里没有出现 ${needed} —— 门对该形态全盲(守门 70/76/81 同型)`)
  }
  // 唯一实现:hash 与账本解析都只许有一处定义。sha256 的**生产调用点**在 `runSelfTest` 之前必须恰好一处
  // (自检里再算一遍是**独立 oracle**,故意允许 —— 它不参与判定,只用来证明判据没算错)。
  const prodPart = src.slice(0, src.indexOf('export function runSelfTest'))
  assert.ok(src.includes('export function runSelfTest'), '自检入口必须还在(否则下面这条锁是空的)')
  const defs = prodPart.match(/function migrationSqlHash\(/g) || []
  assert.equal(defs.length, 1, 'migrationSqlHash 在生产面出现第二份定义 = 两处算同一件事必漂移')
  assert.equal((prodPart.match(/function parseLedgerRows\(/g) || []).length, 1)
  assert.equal(
    // 数的是**代码面上的调用点**:遮掉注释与字符串之后必须恰好一处。按裸文本数会把头注里两处
    // **引用 drizzle 原文**的说明文字也算成调用点 ⇒ 一条对合法代码恒红的锁(说明性文字带执行性
    // 字符,本仓记过同型:守门 127 的 stripJsonc、门 103 的 T12b)。遮噪只用 `lib/code-mask.mjs`
    // 那一份实现 —— 测试里再写一个剥注释器就是第二份真相(§22c)。
    (maskCommentsAndStrings(prodPart).match(/createHash\(/g) || []).length,
    1,
    '生产面 sha256 的调用点必须只有一处(否则改一处忘另一处,hash 配方与 drizzle 分叉)',
  )
  // 自检里再算一遍是**独立 oracle**(故意允许:它不参与判定,只用来证明判据没算错)。
  // 这条同时把"自检只是在复读判据"那一型挡住 —— 若独立现算被删,P7g 就退化成同义反复。
  assert.ok(
    /createHash\(/.test(src.slice(src.indexOf('export function runSelfTest'))),
    '自检必须自带一份独立现算,否则 P7g 只是在复读判据自己',
  )
})

test('H6 禁止的处置不得被实现进来:重算并覆盖账本 hash 是给分叉发通行证', () => {
  const src = readFileSync(GATE, 'utf8')
  for (const banned of [
    /update\s+drizzle\.__drizzle_migrations/i,
    /UPDATE\s+"?\w*\.?__drizzle_migrations/i,
    /--(update-hash|rehash|fix-ledger)/i,
  ]) {
    assert.ok(!banned.test(src), `本门不得写库/不得"重算并覆盖账本 hash":${banned}`)
  }
})

test('H7 三态不并桶(纯判据层):分叉 / 未应用 / 取不到正文 各归各,都不算通过', () => {
  const entries = [
    { tag: 'a', when: 10 },
    { tag: 'b', when: 20 },
    { tag: 'c', when: 30 },
  ]
  const bodies = new Map([
    ['a', FIXTURE_SQL],
    ['b', FIXTURE_SQL_TAMPERED],
    ['c', null], // 该面取不到正文
  ])
  const rows = [
    { createdAt: 10, hash: migrationSqlHash(FIXTURE_SQL) }, // 相符
    { createdAt: 20, hash: migrationSqlHash(FIXTURE_SQL) }, // 被改 ⇒ 分叉
    { createdAt: 30, hash: migrationSqlHash(FIXTURE_SQL) }, // 正文取不到 ⇒ 未判定
  ]
  const r = compareAppliedHashes(entries, bodies, rows)
  assert.deepEqual(
    r.mismatch.map((m) => m.tag),
    ['b'],
    '只有真被改的那一枚进分叉桶',
  )
  assert.deepEqual(r.unreadable, ['c'], '取不到正文的落未判定桶,既不是分叉也不是通过')
  assert.deepEqual(r.notApplied, [], '账本里有行的都不算未应用')
  assert.equal(r.compared, 2, 'compared 只算真比过的(2 = 相符 + 分叉),不得把未判定混进分母')
  // 未应用的独立成桶
  const r2 = compareAppliedHashes(entries, bodies, rows.slice(0, 2).concat([{ createdAt: 999, hash: 'x' }]))
  assert.deepEqual(r2.notApplied, ['c'], '账本里的行对不上任何 when ⇒ 该条目算未应用')
  assert.equal(r2.mismatch.length, 1)
  // 空账本:一条都不算 applied(不得读成"全对")
  const r3 = compareAppliedHashes(entries, bodies, [])
  assert.equal(r3.applied, 0)
  assert.equal(r3.compared, 0)
  // 坏行(无 | 的 psql 输出)不得被静默当成一行有效账本
  const bad = parseLedgerRows('not-a-row\n')
  assert.equal(bad.length, 1, '原样交给 Number() ⇒ NaN,由调用方按"非有限值"滤掉(不静默丢行)')
  assert.ok(!Number.isFinite(bad[0].createdAt))
  assert.equal(parseLedgerRows('').length, 0)
  assert.equal(parseLedgerRows(null).length, 0)
})

test('H9 §22c 身份锁:测试 import 的 B11 判据就是源脚本那一份(不得抄第二份)', () => {
  assert.equal(GATE49.migrationSqlHash, migrationSqlHash)
  assert.equal(GATE49.compareAppliedHashes, compareAppliedHashes)
  assert.equal(GATE49.parseLedgerRows, parseLedgerRows)
  assert.equal(GATE49.readSqlBodies, readSqlBodies)
  assert.equal(GATE49.faceSqlBlobSpec, faceSqlBlobSpec)
  assert.equal(GATE49.ledgerFileFromArgv, ledgerFileFromArgv)
  assert.equal(GATE49.ledgerSnapshotOf, ledgerSnapshotOf)
  assert.equal(GATE49.MIGRATION_IMMUTABLE_HINT, MIGRATION_IMMUTABLE_HINT)
  // 夹具的两份正文必须与门自己写盘的那一份同值 —— 否则"账本相符"的绿是在比两份不同的夹具文本
  assert.equal(GATE49.FIXTURE_SQL, FIXTURE_SQL)
  assert.notEqual(FIXTURE_SQL, FIXTURE_SQL_TAMPERED, '篡改档必须真的与被篡改前不同')
})

test('H8 eolOnly 是诊断位而不是豁免通道:仅换行不同照样计分叉', () => {
  const entries = [{ tag: 'a', when: 1 }]
  const crlf = 'SELECT 1;\r\n'
  const bodies = new Map([['a', crlf]])
  const rows = [{ createdAt: 1, hash: migrationSqlHash('SELECT 1;\n') }]
  const r = compareAppliedHashes(entries, bodies, rows)
  assert.equal(r.mismatch.length, 1, '归一后同值也必须计分叉(账本是对当时字节算的)')
  assert.equal(r.mismatch[0].eolOnly, true, '但必须标出"差异看起来只出在行尾",免得下一个人去查 SQL')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
