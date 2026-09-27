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
 * 外加:口令哨兵不得出现在任何输出、存在同名库时中止且绝不 CREATE/DROP、runPlan 写闸门。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
