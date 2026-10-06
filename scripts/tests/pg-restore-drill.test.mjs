#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * pg-restore-drill 的镜像测试(§22c:测试直接 import 源脚本的 __test__,不复制判据)。
 * 靠"纯函数 + 构造面 + 注入假执行器"证明三件硬约束,不碰真库、不碰真备份目录:
 *  ① 目标库名形状不符必须拒执行(正反例成对);
 *  ② 拿不到 dump 必须判"无法判定",不得伪装成"通过";
 *  ③ check / dry-run / offline-verify / 凭据不足的 apply 一档都不派生连库写命令
 *    (注入假执行器记录每一次调用;并各配"apply 确实会派生写"的阳性对照 —— 否则断言恒真)。
 * 外加:口令哨兵不得出现在任何输出、存在同名库时中止且绝不 CREATE/DROP、runPlan 写闸门,
 * 以及**落点解析三条**(P-落点 1/2/3):接共用出口后真值逐字不变、共用出口真被 consult、
 * 结果与 `process.cwd()` 无关(该出口不接收工作树参数,所以夹具深度这一维**未被修复**,见用例注释)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join, parse, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 共用落点出口:2026-09-30 起本用例直接问它(不再只读它的源码形状)——
// 行为对照才证得了"夹具洞已关",形状锁只能证"签名长这样"。
import { devEnvRoot } from '../seal-c-root-stray.mjs'
import { __test__ as D } from '../pg-restore-drill.mjs'

const YMD = '20260927'
const TARGET = `ihui_restore_drill_${YMD}`
const DUMP_NAME = `ihui_dev_${YMD}_030003.dump`
const TOC_TEXT = [
  ';',
  '; Archive created at 2026-09-27 03:00:03',
  '; TOC Entries: 12',
  '; Format: CUSTOM',
  '; Dumped from database version: 18.6',
  ';',
  '7; 2200 0 TABLE DATA public users ihui',
  '8; 2200 0 TABLE DATA public orders ihui',
].join('\n')
const STATS = `db_size=644617919\nreltuples=923285\ntables=720`
const COUNTS = 'orders|2\nusers|3'

function makeEnv(opts = {}) {
  const dir = mkScratch('pg-drill-test')
  mkdirSync(join(dir, 'pg'), { recursive: true })
  const backupDir = join(dir, 'pg')
  if (opts.withDump !== false) writeFileSync(join(backupDir, DUMP_NAME), Buffer.concat([Buffer.from('PGDMP', 'latin1'), Buffer.alloc(64)]))
  const calls = []
  const run = (step) => {
    const argv = step.argv.map(String)
    const j = argv.join(' ')
    calls.push({ argv, kind: step.kind || 'probe', joined: j })
    if (opts.forbiddenWrites && /CREATE DATABASE|DROP DATABASE/.test(j)) throw new Error(`测试闸门:该档不该派生写命令 → ${j}`)
    if (opts.forbiddenConnectRestore && /pg_restore/.test(j) && argv.includes('-d')) throw new Error(`测试闸门:离线档不得连库还原 → ${j}`)
    if (/pg_restore.* -l/.test(j)) return { rc: 0, stdout: TOC_TEXT, stderr: '' }
    if (/--single-transaction.*-f/.test(j)) return { rc: 0, stdout: '', stderr: '' }
    if (j.includes('rolcreatedb')) return { rc: 0, stdout: opts.role ?? 'beifen|f|f', stderr: '' }
    if (j.includes("datname = '")) return { rc: 0, stdout: opts.existsOutput ?? '', stderr: '' }
    if (j.includes('FROM pg_database ORDER BY 1')) return { rc: 0, stdout: 'ihui_dev\npostgres\ntemplate0\ntemplate1', stderr: '' }
    if (j.includes('db_size=')) return { rc: 0, stdout: STATS, stderr: '' }
    if (j.includes('query_to_xml')) return { rc: 0, stdout: opts.counts ?? COUNTS, stderr: '' }
    if (j.includes('pg_database_size')) return { rc: 0, stdout: '700000000', stderr: '' }
    if (j.includes('CREATE DATABASE') || j.includes('DROP DATABASE')) return { rc: 0, stdout: '', stderr: '' }
    if (/psql.* -c SELECT 1/.test(j)) return { rc: 0, stdout: '1', stderr: '' }
    if (argv.some((a) => a.startsWith('-d'))) return { rc: 0, stdout: '', stderr: '' } // pg_restore 到演练库
    return { rc: 0, stdout: '', stderr: '' }
  }
  const bins = { psql: join(dir, 'psql.exe'), pgRestore: join(dir, 'pg_restore.exe') }
  const cred = { user: 'beifen', password: 'SENTINEL_PW_42', source: 'test-fixture' }
  return {
    dir,
    calls,
    deps: { run, bins, binExists: true, backupDir, cred, ymd: YMD },
    cleanup: () => rmScratch(dir),
  }
}

// ── ① 目标库名形状:正反例成对 ─────────────────────────────────────────────
test('①正例:今天日期生成的库名过形状校验且断言通过', () => {
  assert.equal(D.drillDbName(YMD), TARGET)
  assert.equal(D.isDrillDbName(TARGET), true)
  assert.equal(D.assertDrillTarget(TARGET, 'test'), TARGET)
})

test('①反例:一切近邻形状与外部库名必须拒执行', () => {
  const bad = [
    'ihui_restore_drill_2026092', // 7 位
    'ihui_restore_drill_202609277', // 9 位
    'ihui_restore_drill_20260927_old', // 尾巴
    'ihui_restore_drill_2026-0927', // 非法字符
    'IHUI_RESTORE_DRILL_20260927', // 大小写
    'ihui_dev', // 生产库 —— 最贵的一种
    'postgres',
    '',
    null,
    42,
  ]
  for (const b of bad) {
    assert.equal(D.isDrillDbName(b), false, `isDrillDbName 误放 ${JSON.stringify(b)}`)
    assert.throws(() => D.assertDrillTarget(b, 'test'), /拒执行/, `assertDrillTarget 未拒 ${JSON.stringify(b)}`)
  }
  assert.throws(() => D.drillDbName('2026-09-27'), /拒生成/)
})

test('①计划构造:坏目标名在 buildPlan 即抛;好目标名的写步骤逐字嵌着它', () => {
  const ctx = { bins: { psql: '/x/psql.exe', pgRestore: '/x/pg_restore.exe' }, conn: { host: 'h', port: '5432', user: 'u', prodDb: 'ihui_dev' }, dumpPath: '/x/d.dump', targetDb: 'prod_db' }
  assert.throws(() => D.buildPlan(ctx), /拒执行/)
  const plan = D.buildPlan({ ...ctx, targetDb: TARGET })
  const writes = plan.filter((s) => s.kind === 'write')
  assert.equal(writes.length, 3, '应有 create/restore/drop 三条写步骤(阳性对照:写确实存在)')
  assert.ok(writes.every((s) => s.argv.some((a) => String(a).includes(TARGET))), '每条写都点名演练库')
  assert.ok(writes.every((s) => !s.argv.includes('ihui_dev')), '写步骤一律不得以生产库为目标')
})

// ── ② 拿不到 dump ⇒ 未判定,绝不"通过" ────────────────────────────────────
test('②classifyDump:缺文件/量不到/0字节/magic 坏/TOC 失败/没跑 TOC 各归其位', () => {
  assert.equal(D.classifyDump({ exists: false }).verdict, 'undetermined')
  assert.equal(D.classifyDump(null).verdict, 'undetermined')
  assert.equal(D.classifyDump({ exists: true }).verdict, 'undetermined')
  assert.equal(D.classifyDump({ exists: true, size: 0 }).verdict, 'truncated')
  assert.equal(D.classifyDump({ exists: true, size: 10, magicOk: false }).verdict, 'truncated')
  assert.equal(D.classifyDump({ exists: true, size: 10, magicOk: true, toc: null }).verdict, 'undetermined')
  assert.equal(D.classifyDump({ exists: true, size: 10, magicOk: true, toc: { rc: 1 } }).verdict, 'truncated')
  assert.equal(D.classifyDump({ exists: true, size: 10, magicOk: true, toc: { rc: 0, tocEntries: 12, tableDataCount: 2 } }).verdict, 'complete')
})

test('②空备份目录:--check 判"无法判定"(exit 2),而不是通过', () => {
  const e = makeEnv({ withDump: false })
  try {
    const r = D.main(['--check'], e.deps)
    assert.equal(r.code, 2)
    assert.equal(r.out.dump.verdict, 'undetermined')
    assert.ok(r.out.dump.reasons.length > 0, '未判定必须带原因')
  } finally {
    e.cleanup()
  }
})

// ── ③ 只读档零写派发(假执行器) ───────────────────────────────────────────
test('③--check:四条答案齐、零写、pg_restore 只 -l 不 -d、哨兵口令不进输出', () => {
  const e = makeEnv({ forbiddenWrites: true, forbiddenConnectRestore: true })
  try {
    const r = D.main(['--check'], e.deps)
    assert.equal(r.code, 0)
    assert.equal(r.out.dump.verdict, 'complete')
    assert.equal(r.out.dump.freshToday, true)
    assert.equal(r.out.conn.verdict, 'ok')
    assert.deepEqual(r.out.conn.databases, ['ihui_dev', 'postgres', 'template0', 'template1'])
    assert.equal(r.out.canOnlineDrill.state, 'insufficient')
    const all = e.calls.map((c) => c.joined).join('\n')
    assert.ok(!/CREATE DATABASE|DROP DATABASE/.test(all))
    const human = D.renderHuman(r.out)
    assert.ok(!human.includes('SENTINEL_PW_42') && !JSON.stringify(r.out).includes('SENTINEL_PW_42'), '口令哨兵泄漏到输出')
  } finally {
    e.cleanup()
  }
})

test('③--dry-run:执行器一次都没被调用(零执行),计划仍完整打印含 DROP 说明', () => {
  const e = makeEnv({ forbiddenWrites: true })
  try {
    const r = D.main(['--dry-run'], e.deps)
    assert.equal(e.calls.length, 0, 'dry-run 连只读命令都不许执行')
    assert.equal(r.code, 0)
    assert.equal(r.out.plan.length, 9)
    assert.equal(r.out.cleanup.length, 1)
    assert.ok(D.renderHuman(r.out).includes(TARGET))
  } finally {
    e.cleanup()
  }
})

test('③--offline-verify:只跑 -l 与 --single-transaction -f -,不连库不写', () => {
  const e = makeEnv({ forbiddenWrites: true, forbiddenConnectRestore: true })
  try {
    const r = D.main(['--offline-verify'], e.deps)
    assert.equal(r.code, 0)
    assert.equal(r.out.offlineFull.verdict, 'passed')
    assert.ok(e.calls.every((c) => !c.argv.includes('-d')), 'offline 档任何调用都不得带 -d(不连库)')
  } finally {
    e.cleanup()
  }
})

test('③runPlan 写闸门:allowWrites=false 时写步骤根本到不了执行器', () => {
  const plan = D.buildPlan({ bins: { psql: '/x/psql.exe', pgRestore: '/x/pg_restore.exe' }, conn: { host: 'h', port: '1', user: 'u', prodDb: 'ihui_dev' }, dumpPath: '/x/d.dump', targetDb: TARGET })
  const seen = []
  assert.throws(
    () => D.runPlan(plan, { allowWrites: false, exec: (s) => (seen.push(s.id), { rc: 0, stdout: '', stderr: '' }) }),
    /拒绝执行写步骤\(CREATE DATABASE/,
  )
  assert.ok(!seen.includes('create') && !seen.includes('drop'), '写步骤被派发出去了')
})

test('③--apply(凭据不足):exit 3、零写、离线全量证明已跑、口令不泄漏', () => {
  const e = makeEnv({ role: 'beifen|f|f', forbiddenWrites: true, forbiddenConnectRestore: true })
  try {
    const r = D.main(['--apply'], e.deps)
    assert.equal(r.code, 3)
    assert.match(r.out.verdict, /当前凭据不足以做在线演练/)
    assert.equal(r.out.offlineFull.verdict, 'passed')
    assert.ok(!JSON.stringify(r.out).includes('SENTINEL_PW_42'))
    assert.ok(e.calls.every((c) => !/CREATE DATABASE|DROP DATABASE/.test(c.joined)))
  } finally {
    e.cleanup()
  }
})

test('③--apply(有 CREATEDB 的假角色):CREATE→restore→核对→DROP 全链;写只打演练库', () => {
  const e = makeEnv({ role: 'drill_admin|t|f' })
  try {
    const r = D.main(['--apply'], e.deps)
    assert.equal(r.code, 0, r.out.verdict)
    const writes = e.calls.filter((c) => /CREATE DATABASE|DROP DATABASE/.test(c.joined) || (c.joined.includes('pg_restore') && c.argv.includes('-d')))
    assert.equal(writes.length, 3, '恰好 create + restore + drop 三条写')
    assert.ok(writes.every((c) => c.joined.includes(TARGET)), '写全部只打演练库名')
    assert.ok(!JSON.stringify(r.out).includes('SENTINEL_PW_42'))
    assert.match(r.out.verdict, /在线演练成功/)
  } finally {
    e.cleanup()
  }
})

test('③--apply(存在同名演练库):中止且不 CREATE、更不 DROP 别人的库', () => {
  const e = makeEnv({ role: 'drill_admin|t|f', existsOutput: '1' })
  try {
    const r = D.main(['--apply'], e.deps)
    assert.equal(r.code, 1)
    assert.match(r.out.verdict, /已存在 —— 中止/)
    assert.ok(e.calls.every((c) => !/CREATE DATABASE|DROP DATABASE/.test(c.joined)))
  } finally {
    e.cleanup()
  }
})

test('③--apply(行数不一致):保留演练库不 DROP,并验证生产统计逐字比对生效', () => {
  const e = makeEnv({ role: 'drill_admin|t|f' })
  const inner = e.deps.run
  e.deps.run = (step, o) => {
    const j = step.argv.join(' ')
    if (j.includes('query_to_xml') && step.argv.includes(TARGET)) return { rc: 0, stdout: 'orders|2\nusers|999', stderr: '' }
    return inner(step, o)
  }
  try {
    const r = D.main(['--apply'], e.deps)
    assert.equal(r.code, 1)
    assert.match(r.out.verdict, /行数不一致 1 处 .*不 DROP/)
    assert.ok(e.calls.every((c) => !/DROP DATABASE/.test(c.joined)), '不一致还 DROP = 毁灭证据')
    assert.equal(r.out.prodStatsBefore, r.out.prodStatsAfter)
  } finally {
    e.cleanup()
  }
})

// ── CLI 白名单:外部库名进不来 ─────────────────────────────────────────────
test('CLI:未知开关 / 位置参数(库名) / 多档同给 全部判死 exit 2', () => {
  assert.match(D.parseCliArgs(['--target=evil_db']).error, /未知开关/)
  assert.match(D.parseCliArgs(['evil_db']).error, /不接受位置参数/)
  assert.match(D.parseCliArgs(['--check', '--apply']).error, /互斥/)
  assert.deepEqual(D.parseCliArgs([]), { mode: '--check', json: false })
  const e = makeEnv()
  try {
    assert.equal(D.main(['--apply', 'some_other_db'], e.deps).code, 2)
    assert.equal(D.main(['--target', TARGET + 'x'], e.deps).code, 2)
  } finally {
    e.cleanup()
  }
})

// ── 指纹函数本身的语义 ─────────────────────────────────────────────────────
test('fingerprint:行序/空白归一后逐字对比;CRLF 与 LF 同判(等号语义),数字变化必不等', () => {
  const a = D.fingerprint('db_size=1\r\ntables=2\r\n')
  const b = D.fingerprint('db_size=1\ntables=2\n')
  assert.equal(D.fingerprintsEqual(a, b), true)
  assert.equal(D.fingerprintsEqual(a, D.fingerprint('db_size=3\ntables=2\n')), false)
  assert.equal(D.fingerprint(undefined), null)
})

// 同一行里的两个数必须同口径 —— 生产统计查询只取 nspname='public',所以 dump 侧也必须按 public 数。
// 旧实现把"全模式 TABLE DATA 数"印成 "public 表",与真·public 数并排,凭空造出 2 张假差异
// (真仓实测:722 全模式 / 720 public,差的正是 drizzle 那 2 张;表集合两侧逐张等值)。
test('parseToc:全模式与 public 两档分开,public 那档才配和生产侧对账', () => {
  const mixed = [
    '; TOC Entries: 6',
    '; Format: CUSTOM',
    '; Dumped from database version: 18.6',
    '7; 2200 0 TABLE DATA public users ihui',
    '8; 2200 0 TABLE DATA public orders ihui',
    '9; 2200 0 TABLE DATA drizzle __drizzle_migrations ihui',
    '10; 2200 0 TABLE DATA drizzle __mig_audit_bak ihui',
    '11; 0 0 TABLE DATA - bogus ihui',
  ].join('\n')
  const t = D.parseToc(mixed)
  assert.equal(t.tableDataCount, 4, '全模式:4 张(排除命名空间为 - 的那条)')
  assert.equal(t.publicTableDataCount, 2, 'public 档:2 张 —— 与 STATS_SQL 的 nspname=public 同口径')
  assert.deepEqual(t.tables, ['users', 'orders'], 'tables[] 仍只收 public(其它消费方口径不变)')
})

test('renderHuman:public 数对 public 数;全模式数必须另立并标明口径', () => {
  const text = D.renderHuman({
    mode: '--check',
    ymd: YMD,
    dump: { exists: true, verdict: 'complete', name: DUMP_NAME, size: 10, toc: D.parseToc(TOC_TEXT) },
    rowMagnitude: {
      dumpTableDataTables: 722,
      dumpPublicTableDataTables: 720,
      prodTablesFromStats: 720,
      prodReltuplesEstimate: 938908,
      dumpBytes: 112929970,
    },
  })
  const pairLine = String(text)
    .split(/\r?\n/)
    .find((l) => l.includes('dump 内 public 表'))
  assert.ok(pairLine, '必须有 public 口径的对账行')
  assert.match(pairLine, /dump 内 public 表 720 张/, '对账行左侧取 public 档,不得再印全模式数')
  assert.match(pairLine, /生产库现有 public 表 720 张/, '右侧点名 public,两侧同口径可读)')
  const allLine = String(text).split(/\r?\n/).find((l) => l.includes('全模式 TABLE DATA'))
  assert.ok(allLine && allLine.includes('722'), '全模式数仍在,但单独成行并标明口径')
  assert.equal(/dump 内 public 表 722/.test(String(text)), false, '反向锁:全模式数不得再被冠以 public')
})

// ──────────────── 落点解析(2026-09-28:私有数层推导 → 共用出口 devEnvRoot()) ────────────────
// 背景:本模块曾自己 `join(resolve(repoRoot,'..','..'),'DevEnv')` 并在注释里称"与 gitdir.mjs
// gitArchiveDir 同式"。`971690247` 把 gitdir 改成盘根锚定(`parse(wt).root`)后那句话就反了,
// 所以接线到 §15b 唯一外置根出口(`seal-c-root-stray.mjs` 的 `devEnvRoot()`,与
// `re-home-junctions.mjs` / `check-c-drive-pollution.mjs` 同源)并让文案与实现同形。

const REPO_FROM_TEST = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * 期望值 oracle **刻意不 import 被测出口**(import 它来证明它 = 拿实现给自己发合格证,§22c)。
 * 2026-10-05 按出口现行契约(G-814433 后双形态推导)独立重算:env 覆盖 > 仓内 .DevEnv(存在才选) > 盘根。
 * —— 分支次序按出口文档重写,不引用其实现;老机器(无仓内 .DevEnv)自动落回盘根形态,两代布局都判得动。
 */
const EXPECTED_DEVENV = existsSync(join(REPO_FROM_TEST, '.DevEnv'))
  ? join(REPO_FROM_TEST, '.DevEnv')
  : join(parse(REPO_FROM_TEST).root, 'DevEnv')

test('P-落点1 真值不变:共用出口真值与"双形态 oracle"在真仓逐字同值(优先级按文档独立重算)', () => {
  // 本用例的原断言(2026-09-28):盘根锚定 = 数层式。G-814433(2026-09-30)把 DevEnv 搬入仓内后,
  // 出口升级为双形态;oracle 相应改为按"env > 仓内 > 盘根"独立重算 —— 真值断言的强度不降:
  // 仍然要求 pgBinDir/backupPgDir 与 oracle 逐字同值,且 env 覆盖必须赢过任何推导。
  assert.equal(D.pgBinDir(), join(EXPECTED_DEVENV, 'runtimes', 'pgsql', 'bin'))
  assert.equal(D.backupPgDir(), join(EXPECTED_DEVENV, 'backups', 'pg'))
  // 显式 env 覆盖仍然优先(接线共用出口不得把那条逃生舱挤掉)
  const saved = process.env.IHUI_BACKUP_PG_DIR
  process.env.IHUI_BACKUP_PG_DIR = join(EXPECTED_DEVENV, 'somewhere', 'else')
  try {
    assert.equal(D.backupPgDir(), process.env.IHUI_BACKUP_PG_DIR, 'IHUI_BACKUP_PG_DIR 必须赢过任何推导')
  } finally {
    if (saved === undefined) delete process.env.IHUI_BACKUP_PG_DIR
    else process.env.IHUI_BACKUP_PG_DIR = saved
  }
})

test('P-落点2 共用出口真被 consult:IHUI_DEVENV_ROOT 改写落点,且解析零副作用', () => {
  const dir = mkScratch('pg-drill-devenv-root')
  const saved = process.env.IHUI_DEVENV_ROOT
  process.env.IHUI_DEVENV_ROOT = dir
  try {
    assert.equal(D.backupPgDir(), join(dir, 'backups', 'pg'))
    assert.equal(D.pgBinDir(), join(dir, 'runtimes', 'pgsql', 'bin'))
    // 解析必须是纯问路:只读地算落点不得在被问到的位置长出目录
    // (gitdir.mjs 那次把 mkdir 从解析挪到写出口,同一条规矩)
    assert.equal(existsSync(join(dir, 'backups')), false, '仅问一次落点就把目录建出来了 = 解析带副作用')
    assert.equal(existsSync(join(dir, 'runtimes')), false, '同上:pgBinDir 只该问路,不该建路')
  } finally {
    if (saved === undefined) delete process.env.IHUI_DEVENV_ROOT
    else process.env.IHUI_DEVENV_ROOT = saved
    rmScratch(dir)
  }
})

test('P-落点3 反向对照与边界:落点与 process.cwd() 无关;私有数层实现不得回来', () => {
  const before = { bin: D.pgBinDir(), backup: D.backupPgDir() }
  const dir = mkScratch('pg-drill-cwd-invariant')
  const deep = join(dir, 'L0', 'L1')
  mkdirSync(deep, { recursive: true })
  const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'pg-restore-drill.mjs'), 'utf8')
  const cwd0 = process.cwd()
  process.chdir(deep)
  try {
    assert.deepEqual({ bin: D.pgBinDir(), backup: D.backupPgDir() }, before, '同一进程换 CWD 就换落点 = 按"站在哪儿"推导')
    // 源码级反向锁:私有实现一旦回来,本模块就又多一份推导,而文档里那句"同一出口"变成假话
    assert.equal(/function\s+devEnvRoot\s*\(/.test(src), false, '本模块不得再声明私有 devEnvRoot —— 落点只许有一个出口')
    assert.match(src, /import \{ devEnvRoot \} from '\.\/seal-c-root-stray\.mjs'/, '必须真的 import 共用出口(§22c 装车证明)')
  } finally {
    process.chdir(cwd0)
    rmScratch(dir)
  }
  // 如实登记这一格**已被谁关闭、以及现在锁的是什么**(2026-09-30 改写)。
  // 本用例 2026-09-28 写下时,`devEnvRoot()` 不接收工作树参数(它锚在自己的模块位置),所以
  // "把工作树喂成两层深夹具 ⇒ 落点跟着夹具走"这一维**不能**由当时那票修复,于是用签名锁当绊线
  // 钉住"未关闭"这件事。09-29 枚 `924184043f`/G-345 第④格把它关上了:出口现在按
  // `path.parse(...).root` 取盘根,并对"仓库根本身位于 scratch 夹具内"直接抛错。
  // 签名当时一变本断言就红 —— 那不是缺陷复现,是绊线按设计报警;红线要求的是**改写它**,
  // 而改写只能往"更硬"的方向走:从此锁的是"洞确实关了"的行为,而不是一个函数形状。
  const sealSrc = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'seal-c-root-stray.mjs'), 'utf8')
  assert.match(sealSrc, /export function devEnvRoot\(\s*repoRoot\s*=\s*REPO\s*\)/, '共用出口现在必须接收工作树根(有默认值⇒既有零参调用方逐字不变)')
  assert.match(sealSrc, /countScratchSegments\(repoRoot\)\s*>\s*0/, '夹具闸必须在(没有它,"盘根 + DevEnv"会落进夹具里)')
  // 行为对照,不接受"注释说关了":把一条真夹具路径喂给出口 ⇒ 必须抛错点名,而不是安静返回。
  assert.throws(() => devEnvRoot(deep), /scratch 夹具/, '把工作树喂成夹具内路径时必须拒绝推导 —— 这条就是当年那格未被关闭的判据')
  // 反向对照:真仓根仍要推得出落点 —— 按"env > 仓内 .DevEnv(存在才选) > 盘根"双形态 oracle
  // 独立重算(G-814433 搬迁后本机命中仓内形态;老机器无仓内 .DevEnv 自动落回盘根形态)。
  assert.equal(
    devEnvRoot(resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')),
    EXPECTED_DEVENV,
    '真仓根必须照常推出当前布局的 DevEnv 落点(仓内形态或盘根形态)',
  )
})

// ─────────── 拍板①(2026-10-05)路径 B:--pre-extended 档与活库统计判据 ───────────

test('CLI:--pre-extended 只许与 --apply 同给;给对了才带 preExtended 键(默认档不许多出键)', () => {
  assert.match(D.parseCliArgs(['--pre-extended']).error, /只能与 --apply 同给/)
  assert.match(D.parseCliArgs(['--check', '--pre-extended']).error, /只能与 --apply 同给/)
  assert.deepEqual(D.parseCliArgs(['--apply', '--pre-extended']), { mode: '--apply', json: false, preExtended: true })
  // 反向锁:不带该旗标时,返回对象必须保持两键原形(既有 deepEqual 契约不破)
  assert.deepEqual(D.parseCliArgs(['--apply']), { mode: '--apply', json: false })
})

test('①pre-extended 计划构造:无 create,写只剩 restore/drop;exists 探针直连演练库并查扩展', () => {
  const ctx = { bins: { psql: '/x/psql.exe', pgRestore: '/x/pg_restore.exe' }, conn: { host: 'h', port: '5432', user: 'u', prodDb: 'ihui_dev' }, dumpPath: '/x/d.dump', targetDb: TARGET, preExtended: true }
  const plan = D.buildPlan(ctx)
  assert.equal(plan.length, 8, '普通档 9 条,路径 B 少一条 create')
  assert.equal(plan.some((s) => s.id === 'create'), false, '路径 B 绝不派生 CREATE(建库是人工超管的事)')
  const exists = plan.find((s) => s.id === 'exists')
  assert.ok(exists.argv.includes(TARGET), 'exists 探针必须直连演练库(连不上=库不存在=中止)')
  const existsSql = exists.argv[exists.argv.length - 1]
  assert.match(existsSql, /pg_extension/, '预检必须点名 vector 扩展')
  assert.match(existsSql, /pg_tables/, '预检必须确认空库')
  const writes = plan.filter((s) => s.kind === 'write')
  assert.equal(writes.length, 2, '路径 B 写只剩 restore + drop(阳性对照)')
  assert.ok(writes.every((s) => s.argv.some((a) => String(a).includes(TARGET))), '写全部只打演练库')
})

function makeEnvPreExt(opts = {}) {
  const e = makeEnv({ role: opts.role ?? 'ihui|t|f', ...opts })
  const inner = e.deps.run
  e.deps.run = (step, o) => {
    const j = step.argv.map(String).join(' ')
    if (j.includes('pg_extension')) {
      if (opts.preExtRc !== undefined) return { rc: opts.preExtRc, stdout: '', stderr: opts.preExtErr ?? 'psql: FATAL: database does not exist' }
      return { rc: 0, stdout: opts.preExtProbe ?? '0|1', stderr: '' }
    }
    return inner(step, o)
  }
  return e
}

test('③--apply --pre-extended(预建库干净+有vector):restore→核对→DROP 全链;写恰两条且只打演练库', () => {
  const e = makeEnvPreExt({})
  try {
    const r = D.main(['--apply', '--pre-extended'], e.deps)
    assert.equal(r.code, 0, r.out.verdict)
    const writes = e.calls.filter((c) => /CREATE DATABASE|DROP DATABASE/.test(c.joined) || (c.joined.includes('pg_restore') && c.argv.includes('-d')))
    assert.equal(writes.length, 2, '恰好 restore + drop 两条写(无 CREATE)')
    assert.ok(e.calls.every((c) => !/CREATE DATABASE/.test(c.joined)), '路径 B 不许出现 CREATE DATABASE')
    assert.ok(writes.every((c) => c.joined.includes(TARGET)), '写全部只打演练库名')
    assert.match(r.out.verdict, /在线演练成功/)
  } finally {
    e.cleanup()
  }
})

test('③--apply --pre-extended(扩展缺失 0|0):中止且零写;不替人装扩展', () => {
  const e = makeEnvPreExt({ preExtProbe: '0|0' })
  try {
    const r = D.main(['--apply', '--pre-extended'], e.deps)
    assert.equal(r.code, 1)
    assert.match(r.out.verdict, /0\|1/)
    assert.ok(e.calls.every((c) => !/pg_restore.* -d|DROP DATABASE|CREATE DATABASE/.test(c.joined)), '预检不过,一条写都不许派发')
  } finally {
    e.cleanup()
  }
})

test('③--apply --pre-extended(库非空 3|1):同判中止 —— 复用不干净的库=违反"只动今天那一个"', () => {
  const e = makeEnvPreExt({ preExtProbe: '3|1' })
  try {
    const r = D.main(['--apply', '--pre-extended'], e.deps)
    assert.equal(r.code, 1)
    assert.match(r.out.verdict, /0\|1/)
    assert.ok(e.calls.every((c) => !/pg_restore.* -d|DROP DATABASE/.test(c.joined)))
  } finally {
    e.cleanup()
  }
})

test('③--apply --pre-extended(连不上演练库):中止且零写', () => {
  const e = makeEnvPreExt({ preExtRc: 2 })
  try {
    const r = D.main(['--apply', '--pre-extended'], e.deps)
    assert.equal(r.code, 1)
    assert.match(r.out.verdict, /连不上演练库/)
    assert.ok(e.calls.every((c) => !/pg_restore.* -d|DROP DATABASE/.test(c.joined)))
  } finally {
    e.cleanup()
  }
})

// 活库判据(G-269④ 预留口径):tables/reltuples 硬等;db_size 漂移按活写基线宽容,
// 不可解释缩库(< -1MB)与超尺度异动(> +200MB)才停。
function makeEnvStatsDrift(secondDbSize) {
  const e = makeEnv({ role: 'ihui|t|f' })
  const inner = e.deps.run
  // STATS 在一躺 --apply 里被读三次:第1次是 conn 层探测(prodStats),第2/3次才是计划内
  // pre-stats / post-stats —— 漂移判据比的是计划那一对,桩必须按这次序给数。
  let statsSeen = 0
  e.deps.run = (step, o) => {
    const j = step.argv.map(String).join(' ')
    if (j.includes('db_size=') && j.includes(D.STATS_SQL)) {
      statsSeen++
      const size = statsSeen === 3 ? secondDbSize : 644617919
      return { rc: 0, stdout: `db_size=${size}\nreltuples=923285\ntables=720`, stderr: '' }
    }
    return inner(step, o)
  }
  return e
}

test('活库判据:db_size 漂移 +100KB(活写基线内)不拦路,演练照常成功', () => {
  const e = makeEnvStatsDrift(644617919 + 102400)
  try {
    const r = D.main(['--apply'], e.deps)
    assert.equal(r.code, 0, r.out.verdict)
    assert.equal(r.out.statsCompare.dbSizeDrift, 102400)
    assert.equal(r.out.statsCompare.tablesEqual, true)
  } finally {
    e.cleanup()
  }
})

test('活库判据:db_size 漂移 +300MB(超尺度异动)⇒ 停,不 DROP,保留演练库', () => {
  const e = makeEnvStatsDrift(644617919 + 314572800)
  try {
    const r = D.main(['--apply'], e.deps)
    assert.equal(r.code, 1)
    assert.match(r.out.verdict, /统计比对异常/)
    assert.ok(e.calls.every((c) => !/DROP DATABASE/.test(c.joined)), '判异动还 DROP = 毁灭证据')
    assert.equal(r.out.statsCompare.dbSizeDrift, 314572800)
  } finally {
    e.cleanup()
  }
})

test('活库判据:reltuples 行数估计前后不一致 ⇒ 停(表数 -1 同判)', () => {
  const e = makeEnv({ role: 'ihui|t|f' })
  const inner = e.deps.run
  let statsSeen = 0
  e.deps.run = (step, o) => {
    const j = step.argv.map(String).join(' ')
    if (j.includes('db_size=') && j.includes(D.STATS_SQL)) {
      statsSeen++
      return statsSeen === 3
        ? { rc: 0, stdout: 'db_size=644617919\nreltuples=923285\ntables=719', stderr: '' }
        : { rc: 0, stdout: STATS, stderr: '' }
    }
    return inner(step, o)
  }
  try {
    const r = D.main(['--apply'], e.deps)
    assert.equal(r.code, 1)
    assert.match(r.out.verdict, /统计比对异常/)
    assert.equal(r.out.statsCompare.tablesEqual, false)
  } finally {
    e.cleanup()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
