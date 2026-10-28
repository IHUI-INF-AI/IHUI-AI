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
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
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
  // B12(G-1058522)同名 .sql 跨目录并存 —— 判据**直接 import 源脚本那一份**,
  // §22c 红线:测试里不得再抄第二份分组/点名字串逻辑。
  sqlUniverseListArgs,
  sqlPathsFromListing,
  sqlDupAcrossDirs,
  b12FindingLine,
  b12Outcome,
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

// ════════════════════════════════════════════════════════════════════════════
// X1–X6 = B12「同一份 .sql 跨目录并存」(G-1058522,2026-10-09 立)。
// 四条成对用例按票面要求逐条落地面:① 两目录同名 ⇒ 必红且点名两处(X1)② 只有一处 ⇒ 必绿(X2)
// ③ 同目录内多份不同名 ⇒ 必绿(X3)④ 面取不到 ⇒ 未判定且不得 exit 0 冒充通过(X4)。
// 夹具与 spawn 仍**委托源脚本导出的那一份实现**(§22c),本文件只写断言,不写第二份判据。
// ════════════════════════════════════════════════════════════════════════════

/** 权威面那一侧的目录(票面那对路径的右侧:manual-sql 是权威面,drizzle 里那枚才是多出来的副本)。 */
const MANUAL_SQL_DIR = 'packages/database/scripts/manual-sql'

/**
 * 复刻票面事故形态:一份已登记在 `drizzle/` 的迁移,在 `scripts/manual-sql/` 又长出一份同名件。
 * `variant`:
 *   - `dup`(缺省)⇒ 两份**同名**,应判红
 *   - `unique`    ⇒ manual-sql 那一份换了别的名字(只有一处含该 basename),应判绿
 *   - `samedir`   ⇒ manual-sql 目录里放**两枚不同名**的 .sql,应判绿(不判同目录的正常文件)
 */
function mkB12Repo(prefix, variant = 'dup') {
  const dir = mkFixtureRepo(prefix, 2)
  const j = JSON.parse(readFileSync(join(dir, JOURNAL_REL), 'utf8'))
  const tag = j.entries[0].tag
  const side = join(dir, MANUAL_SQL_DIR)
  mkdirSync(side, { recursive: true })
  if (variant === 'dup') writeFileSync(join(side, `${tag}.sql`), 'SELECT 1;\n')
  else if (variant === 'unique') writeFileSync(join(side, 'standalone_manual.sql'), 'SELECT 1;\n')
  else {
    writeFileSync(join(side, 'one.sql'), 'SELECT 1;\n')
    writeFileSync(join(side, 'two.sql'), 'SELECT 2;\n')
  }
  gitIn(dir, ['add', '-A'])
  gitIn(dir, ['commit', '-q', '--no-verify', '-m', `B12 fixture: ${variant}`])
  return { dir, tag }
}

test('X1 ①两目录同名 .sql ⇒ 判红并逐条点名两处路径(端到面 + 纯判据层成对)', () => {
  const { dir, tag } = mkB12Repo('gate49-x1')
  try {
    const r = runGate(dir)
    assert.equal(r.code, 1, `双份同名必须判红,实得 ${r.code}:\n${r.out}${r.err}`)
    const all = r.out + r.err
    assert.match(all, /B12 同一份 \.sql 跨目录并存/)
    // 两处路径**都要**点名 —— 只点一处就等于让人去猜哪一份是多的那一份。
    assert.ok(all.includes(`${MIG_DIR_REL}/${tag}.sql`), '缺 drizzle/ 那一份的路径')
    assert.ok(all.includes(`${MANUAL_SQL_DIR}/${tag}.sql`), '缺 manual-sql/ 那一份的路径')
    assert.match(all, /字节数差 [^\n]*B/)
    // --staged 档(索引面)必须同样看得见这一型,否则提交链上会漏。
    const s = runGate(dir, ['--staged'])
    assert.equal(s.code, 1, `索引面同样必须判红,实得 ${s.code}`)
    assert.ok((s.out + s.err).includes(`${MANUAL_SQL_DIR}/${tag}.sql`))

    // 纯判据层与端到面**同一份实现**:构造面证明分组与点名字串的口径。
    const groups = sqlDupAcrossDirs([`${MIG_DIR_REL}/${tag}.sql`, `${MANUAL_SQL_DIR}/${tag}.sql`])
    assert.equal(groups.length, 1)
    assert.deepEqual(groups[0].dirs, [`${MANUAL_SQL_DIR}`, MIG_DIR_REL].sort())
    assert.equal(b12Outcome({ paths: sqlPathsFromListing(`${MIG_DIR_REL}/${tag}.sql\0${MANUAL_SQL_DIR}/${tag}.sql\0`), error: '' }).state, 'dup')
    assert.match(b12FindingLine(groups[0], () => 10), /字节数差 0 B/)
    assert.match(b12FindingLine(groups[0], () => null), /字节数差 未取到\(不影响判红\)/)
  } finally {
    rmScratch(dir)
  }
})

test('X2 ②只有 manual-sql 一处 ⇒ 必绿(权威面那一份不是错)', () => {
  const dir = mkB12Repo('gate49-x2', 'unique').dir
  try {
    const r = runGate(dir)
    assert.equal(r.code, 0, `只有一处含该 basename 不得判红,实得 ${r.code}:\n${r.out}${r.err}`)
    assert.match(r.out, /✓ B12 无同名 \.sql 跨目录并存/)
    assert.match(r.out, /B12 已判\(扫 \d+ 个 \.sql,无跨目录同名\)/)
    assert.ok(!/B12 未判定|B12 \*\*未判定\*\*/.test(r.out), '判净不得被写成未判定')
    // 纯判据层同一口径:单目录 ⇒ 0 组
    assert.deepEqual(sqlDupAcrossDirs([`${MANUAL_SQL_DIR}/only.sql`]), [])
  } finally {
    rmScratch(dir)
  }
})

test('X3 ③同目录内多份不同名 ⇒ 必绿(本维只数目录,不数文件)', () => {
  const dir = mkB12Repo('gate49-x3', 'samedir').dir
  try {
    const r = runGate(dir)
    assert.equal(r.code, 0, `同目录两枚不同名不得判红,实得 ${r.code}:\n${r.out}${r.err}`)
    assert.match(r.out, /✓ B12 无同名 \.sql 跨目录并存/)
    assert.equal(sqlDupAcrossDirs(['d/a.sql', 'd/b.sql']).length, 0)
    // 同目录**同名**在 git 里不可能存在;被喂重复项也只算 1 个目录 ⇒ 仍不判红(宁窄不误伤)。
    assert.equal(sqlDupAcrossDirs(['d/a.sql', 'd/a.sql']).length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('X4 ④面取不到 ⇒ 未判定,且绝不 exit 0 冒充通过(也不出现 B12 的绿结论)', () => {
  const dir = mkScratch('gate49-x4')
  try {
    writeGateFixture(dir, 2) // 刻意不 git init ⇒ HEAD/索引两面都问不到
    const h = runGate(dir)
    const s = runGate(dir, ['--staged'])
    for (const [name, r] of [['head', h], ['staged', s]]) {
      assert.notEqual(r.code, 0, `${name} 档面取不到却 exit 0 = 把没判写成判过了`)
      assert.ok(!/✓ B12/.test(r.out), `${name} 档不得出现 B12 的绿结论`)
      assert.ok(!/全部通过/.test(r.out + r.err), `${name} 档判死不得被读成通过`)
    }
    assert.equal(h.code, 2, `既有口径:面取不到 ⇒ exit 2(本门不回落磁盘面),实得 ${h.code}`)
    // 纯判据层:error 与空枚举都落未判定,且结论行自带"不代表已判"。
    const u = b12Outcome({ paths: null, error: 'git 问不到' })
    assert.equal(u.state, 'undetermined')
    assert.match(u.line, /未判定/)
    assert.match(u.line, /不代表/)
    assert.equal(b12Outcome({ paths: [], error: '' }).state, 'undetermined', '空枚举不得记绿')
  } finally {
    rmScratch(dir)
  }
})

test('X5 取材面纪律形状锁:三面各取哪一份互不相同,而 worktree 档必须是 null(本维不读工作树)', () => {
  assert.deepEqual(sqlUniverseListArgs('head'), ['ls-tree', '-r', '--name-only', '-z', 'HEAD'])
  assert.deepEqual(sqlUniverseListArgs('staged'), ['ls-files', '-z'])
  // 全仓枚举在磁盘档**没有安全的清单可取**(递归扫盘要逐条判重解析点,§26)⇒ 只能是 null,
  // 由调用方落未判定。若有人把它改成"顺手 readdirSync 全仓",这条先红 —— 那正是 B12 立项要防的混面。
  assert.equal(sqlUniverseListArgs('worktree'), null)
  // 与 B1 的枚举面刻意**不同**:B1 只有 drizzle/ 恰好一层,而本维问的是"有没有第二处"。
  // 两条命令必须各自仍在位,谁被"统一"成一条就等于把 B12 做瞎(立因正是 B1 看不见第二处)。
  assert.notDeepEqual(sqlUniverseListArgs('head'), faceSqlListArgs('head'))
  const dir = mkB12Repo('gate49-x5').dir
  try {
    const w = runGate(dir, ['--worktree'])
    assert.match(w.out, /B12 未判定/)
    assert.ok(!/✓ B12|B12 已判/.test(w.out), '未判定不得被写成通过')
    assert.match(w.out, /B12 \*\*未判定\*\*[^\n]*不代表/)
  } finally {
    rmScratch(dir)
  }
})

test('X6 反向锁:新增这一维不得改动 B1–B5 的任何结论行(改弱既有判据必须被看见)', () => {
  const clean = mkCleanRepo('gate49-x6a')
  const dup = mkB12Repo('gate49-x6b').dir
  try {
    const a = b15Lines(runGate(clean).out)
    const b = b15Lines(runGate(dup).out)
    assert.ok(a.length >= 5, `夹具的 B1-B5 结论行不足 5 条,判据失效:${a}`)
    assert.deepEqual(b, a, 'B12 的红不得顺手改动 B1-B5;两份的 B1-B5 结论必须逐字一致')
    // 而 B12 的红确实只来自新维:失败项恰好 1 条,且**只有一个违规站点**
    // (末尾那条 `   - B12 …` 是同一结论的汇总复述,不带 ✗ 前缀,所以按前缀计数)。
    const r = runGate(dup)
    assert.match(r.err, /✗ 1 项失败/)
    assert.equal((r.out.match(/✗ B12 同一份 \.sql 跨目录并存/g) || []).length, 1)
    assert.ok(/✓ B1 双向一一对应/.test(r.out), 'B1 必须仍然绿(副本没破坏 journal↔drizzle 的配对)')
  } finally {
    rmScratch(clean)
    rmScratch(dup)
  }
})

test('X7 §22c 身份锁:B12 的判据在测试里只有 import 的那一份(不得抄第二份分组逻辑)', () => {
  assert.equal(GATE49.sqlDupAcrossDirs, sqlDupAcrossDirs)
  assert.equal(GATE49.b12Outcome, b12Outcome)
  assert.equal(GATE49.b12FindingLine, b12FindingLine)
  assert.equal(GATE49.sqlUniverseListArgs, sqlUniverseListArgs)
  assert.equal(GATE49.sqlPathsFromListing, sqlPathsFromListing)
  // 本文件内不得再出现"自己算目录数"的实现 —— 有第二份就早晚漂开。
  const src = readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const own = src.split(/\r?\n/).filter(
    (l) => /dirs\.length\s*>=\s*2/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('*'),
  )
  assert.deepEqual(own, [], `镜像测试里出现了第二份红条件:${own}`)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
