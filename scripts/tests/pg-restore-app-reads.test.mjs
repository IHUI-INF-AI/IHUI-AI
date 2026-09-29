// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/pg-restore-app-reads.mjs` 的镜像测试(AGENTS.md §22c)。
 *
 * 这个工具存在的理由是"表数/行数全等"根本没回答**应用能不能查这份数据**。它自己也可能
 * 变成另一种"看着在跑、其实没结论"的尺子,所以四条判据各自成对钉住:
 *   ① 只读闸门真的会拒(而不是"看起来像只读就放行");
 *   ② 三态不并桶 —— **还原库报错** 与 "两侧都没跑出来" 绝不允许读成同一个结论;
 *   ③ 语句必须走 `-f` 文件而不是 `-c` 参数(实测 `-c` 过一层 GBK 代码页,带中文的查询
 *     在生产侧就先报错 ⇒ 该条永远落"未判定",判据对整族静默失明)。
 *   ④ 「演练库不存在」与「还原库跑不住这条查询」也不得并桶(2026-09-30 补):旧写法把前者
 *     全计成 drill-error 并 exit 1,读起来像"备份还原出来是坏的"。R8 与 R9 是成对的两支 ——
 *     一支证明"库不在 ⇒ 未判定且不白打生产",另一支证明"库在而语句失败 ⇒ 仍然判红",
 *     只留前者就是拿放宽判据换安静(R9 即那条变异对照:摘掉前置探询、或把它写成文案分类器,R9 翻红)。
 * ③ 用源码形状锁 + 一条注入式端到端各钉一遍:只有形状锁会退化成"改了写法就看不见",
 *    只有端到端则看不见别人把它换回 `-c`。
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { assertReadOnlySql, decideQuery, shouldFail, isAllowedProdDb, main } from '../pg-restore-app-reads.mjs'
import { maskComments } from '../lib/code-mask.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const TOOL = join(here, '..', 'pg-restore-app-reads.mjs')
const FIXTURE = join(here, '..', 'data', 'restore-read-queries.json')

/** 与日历无关的合法演练库名(形状由工具自己的 /^ihui_restore_drill_\d{8}$/ 焊死) */
const DRILL = 'ihui_restore_drill_20260101'

/** 端到端用例要看结论行,而 main 走 console —— 临时接管,取完必还原(不还原会污染同轮其它用例) */
function runCaptured(argv, deps) {
  const out = []
  const origLog = console.log
  const origErr = console.error
  console.log = (...a) => out.push(a.join(' '))
  console.error = (...a) => out.push(a.join(' '))
  try {
    return { code: main(argv, deps), out }
  } finally {
    console.log = origLog
    console.error = origErr
  }
}

test('R1 只读闸门:写/DDL/会话级一律拒,正当只读一律放行(成对)', () => {
  const bad = [
    'SELECT 1; DELETE FROM users',
    'INSERT INTO t VALUES (1)',
    'DROP TABLE users',
    'SET search_path = public',
    'COPY users TO stdout',
    'DO $$ BEGIN END $$',
    '\\conn evil_db',
    'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x',
  ]
  for (const sql of bad) {
    assert.equal(assertReadOnlySql(sql).ok, false, `必须拒:${sql.slice(0, 40)}`)
  }
  const good = [
    'SELECT id FROM users LIMIT 5',
    'SELECT count(*)::int FROM orders WHERE status = \'paid\' GROUP BY user_id',
    'SELECT * FROM t WHERE v <-> ARRAY[1,2]::vector < 0.5 ORDER BY v LIMIT 3',
    "SELECT date_trunc('day', created_at) FROM x AT TIME ZONE 'Asia/Shanghai'",
  ]
  for (const sql of good) {
    assert.equal(assertReadOnlySql(sql).ok, true, `不得误伤正当只读:${sql.slice(0, 40)}`)
  }
})

test('R2 三态不得并桶:还原库报错 / 两侧都没结论 / 行数漂移,是三件事', () => {
  const drillBroken = decideQuery({ prodOk: true, drillOk: false, prodCols: 4, drillCols: null, prodRows: 3, drillRows: -1 })
  assert.equal(drillBroken.state, 'drill-error', '这一态就是本工具的全部存在理由')
  const neither = decideQuery({ prodOk: false, drillOk: false, prodCols: null, drillCols: null, prodRows: -1, drillRows: -1 })
  assert.equal(neither.state, 'undetermined', '基准侧没跑出来时不得把"还原库也错"当成结论')
  const prodOnly = decideQuery({ prodOk: false, drillOk: true, prodCols: null, drillCols: 2, prodRows: -1, drillRows: 2 })
  assert.equal(prodOnly.state, 'undetermined', '只有还原侧成功而无对照 ⇒ 不得记绿')
  const drift = decideQuery({ prodOk: true, drillOk: true, prodCols: 2, drillCols: 2, prodRows: 5, drillRows: 7 })
  assert.equal(drift.state, 'drift', '活库行数差是常态,必须与"报错"分开计')
  const shape = decideQuery({ prodOk: true, drillOk: true, prodCols: 2, drillCols: 3, prodRows: 5, drillRows: 5 })
  assert.equal(shape.state, 'shape-drift', '列数不等是还原缺陷,不得混进 drift')
})

test('R3 退出码判据:未判定不放行、drift 只在 --strict 才红、drill-error 永远红', () => {
  const base = { pass: 50, drift: 0, 'shape-drift': 0, 'drill-error': 0, refused: 0, undetermined: 0 }
  assert.equal(shouldFail({ ...base }, { strict: false }), false, '全绿不得判红(否则就是一台恒红门)')
  assert.equal(shouldFail({ ...base, 'drill-error': 1 }, { strict: false }), true, '还原库报错必须红')
  assert.equal(shouldFail({ ...base, undetermined: 3 }, { strict: false }), true, '"没判"不得被算成"判过且没问题"')
  assert.equal(shouldFail({ ...base, drift: 3 }, { strict: false }), false, '活库行数差不该拦默认档')
  assert.equal(shouldFail({ ...base, drift: 3 }, { strict: true }), true, '--strict 才把漂移也算红')
  assert.equal(shouldFail({ ...base, 'shape-drift': 1 }, { strict: false }), true)
})

test('R4 目标库白名单:演练库名与生产库名都必须是已知形状,不接受任意目标', () => {
  assert.equal(isAllowedProdDb('ihui_dev'), true)
  assert.equal(isAllowedProdDb('postgres'), false, '连错库不得静默通过')
  assert.equal(isAllowedProdDb('any_other'), false)
  // 未知开关必须判死,而不是忽略后照跑
  assert.equal(main(['node', 'x', '--db', 'anything']), 2, '不接受外部指定任意库/任意 SQL')
})

test('R5 夹具本身:非空、id 唯一、每条都过只读闸门、标识符不得凭空出现', () => {
  const d = JSON.parse(readFileSync(FIXTURE, 'utf8'))
  assert.ok(Array.isArray(d.queries) && d.queries.length >= 40, `夹具太薄(${d?.queries?.length})不足以称回放`)
  const ids = new Set(d.queries.map((q) => q.id))
  assert.equal(ids.size, d.queries.length, 'id 重复 ⇒ 有一条永远不会被单独问责')
  for (const q of d.queries) {
    assert.equal(assertReadOnlySql(q.sql).ok, true, `夹具里混进非只读语句:${q.id}`)
    assert.ok(q.source && q.source.includes(':'), `${q.id} 缺调用点出处`)
    assert.ok(Array.isArray(q.tables) && q.tables.length > 0, `${q.id} 未声明覆盖表`)
  }
})

test('R6 形状锁:语句必须走 -f 文件(走 -c 会被 Windows ANSI 代码页改写中文字面量)', () => {
  const src = readFileSync(TOOL, 'utf8')
  assert.match(src, /'-f', file/, '没有 -f 就说明它已退回命令行参数 —— 那一形对含中文的查询恒无结论')
  assert.doesNotMatch(src, /'-c', sql/, `'-c', sql` + ' 不得再出现在执行路径里')
  assert.match(src, /ON_ERROR_STOP=1/, '没有 ON_ERROR_STOP,报错可能被 psql 吞成 exit 0')
  assert.match(src, /default_transaction_read_only=on/, '服务端兜底只读必须在(判据不得只靠客户端自觉)')
  assert.match(src, /statement_timeout=/, '无超时的一条坏查询能把整轮回放挂死')
})

test('R7 端到端(注入假执行器,不真连库):一条还原侧报错必须落 drill-error 并判红', () => {
  const calls = []
  // 库名显式给定,**不靠日历** —— 旧写法让假执行器去匹配"写下那天"的默认库名,
  // 于是 2026-09-28 起这条恒红(红的不是仓库,是尺子给自己设了个日期闹钟)。
  const fake = (db, sql) => {
    calls.push({ db, probe: sql === 'SELECT 1' })
    // 这一支的前提是"库在、但这条语句在还原库上跑不通" —— 所以探询必须放行,
    // 只在逐条回放时报错(探询也报错的那一支是 R8,两条各自对应一种完全不同的事实)。
    const fail = db === DRILL && sql !== 'SELECT 1'
    return {
      ok: !fail,
      stdout: fail ? '' : '1|a\n2|b\n',
      stderr: fail ? 'ERROR:  column "search_vector" does not exist' : '1\n',
      rc: fail ? 1 : 0,
    }
  }
  const code = main(['node', 'x', '--limit', '3', '--drill-db', DRILL, '--fixture', FIXTURE], { spawnPsql: fake })
  assert.equal(code, 1, '还原侧报错必须 exit 1')
  // 1 次前置探询 + 3 条 × 两侧
  assert.equal(calls.length, 7, '每条两侧各一次(同轮对照,不是先跑完生产再隔天跑还原),外加一次探询')
  assert.equal(calls.filter((c) => c.db === 'ihui_dev').length, 3)
  assert.equal(calls.filter((c) => c.probe).length, 1, '探询恰好一次,且在逐条之前')
})

test('R8 演练库不可达 ⇒ 整轮未判定 + exit 2,一条生产查询都不许白打(2026-09-30 补的缺陷)', () => {
  const calls = []
  const fake = (db, sql) => {
    calls.push({ db, sql })
    if (db !== DRILL) return { ok: true, stdout: '1|a\n', stderr: '', rc: 0 }
    if (sql === 'SELECT 1')
      return { ok: false, stdout: '', stderr: `psql: error: FATAL:  database "${DRILL}" does not exist`, rc: 2 }
    return { ok: false, stdout: '', stderr: 'ERROR:  should never be reached', rc: 1 }
  }
  const { code, out } = runCaptured(['node', 'x', '--limit', '3', '--drill-db', DRILL, '--fixture', FIXTURE], {
    spawnPsql: fake,
  })
  assert.equal(code, 2, '缺库是"无法判定",不是判红也不是判绿')
  assert.equal(
    calls.filter((c) => c.db === 'ihui_dev').length,
    0,
    '演练库连不上时不得把 60 条查询打到生产(既无对照意义,又白加读压)',
  )
  assert.match(out.join('\n'), /未判定:演练库不可达/, '读数必须直说是"库不在"')
  assert.doesNotMatch(out.join('\n'), /drill-error/, '绝不把"连不上库"计成还原库报错 —— 那正是本工具违背自身头注的那一型')
})

test('R9 反向对照(防"为消红而放宽"):库在位、而某条语句在还原库超时(FATAL)必须仍判 drill-error', () => {
  const fake = (db, sql) => {
    const drill = db === DRILL
    if (drill && sql === 'SELECT 1') return { ok: true, stdout: '1\n', stderr: '', rc: 0 }
    if (drill)
      return { ok: false, stdout: '', stderr: 'FATAL:  terminating connection due to statement timeout', rc: 1 }
    return { ok: true, stdout: '1|a\n2|b\n', stderr: '', rc: 0 }
  }
  const code = main(['node', 'x', '--limit', '2', '--drill-db', DRILL, '--fixture', FIXTURE], { spawnPsql: fake })
  assert.equal(code, 1, '探询通过之后,还原侧任何失败(含 FATAL 超时)仍须红 —— 前置探询不是把 FATAL 洗成未判定的文案分类器')
})

test('R10 装车锁:前置探询必须真在逐条循环之前(顺序就是这条判据的全部意义)', () => {
  const src = readFileSync(TOOL, 'utf8')
  const probeAt = src.indexOf("runOne(o.drillDb, 'SELECT 1')")
  const loopAt = src.indexOf('for (const q of list)')
  assert.ok(probeAt > 0, '前置探询不得被摘掉 —— 摘掉后"缺库"又会混进 drill-error')
  assert.ok(loopAt > probeAt, '探询必须排在逐条之前;排在之后就等于没有')
})

// ─────────── 落点反向锁(§15b):盘根只许有一个出口,本模块不得再自己推导 ───────────
// 与 `pg-backup-cadence-audit.test.mjs` 末条、`sync-prometheus-live-config.test.mjs` T11 同一条
// 锁的三个站点。判据对象是**真实源文件的形态**(§22c):把 `resolve(REPO,'..','..','DevEnv')`
// 放回去即红。遮噪只遮注释、保留字符串 —— 被禁的那一型活在字符串里。
test("落点反向锁:私有 DEVENV_ROOT 推导不得回来,必须真的 import 共用出口 devEnvRoot()", () => {
  const src = readFileSync(TOOL, 'utf8')
  const code = maskComments(src)
  assert.doesNotMatch(code, /['"]\.\.['"]\s*,\s*['"]\.\.['"]/, '不得再出现"仓根上跳两级"那一份盘根推导(工作树落在夹具里时它会把落点带进夹具)')
  assert.doesNotMatch(code, /['"]\\{0,2}DevEnv['"]/, '不得再出现 DevEnv 字面量档位 —— 它住在共用出口里')
  assert.doesNotMatch(code, /slice\(\s*0\s*,\s*1\s*\)/, '不得再用截盘符首字符那一份实现(同一件事不得有两个答案)')
  assert.doesNotMatch(code, /DEVENV_ROOT\s*=/, '模块级私有 DEVENV_ROOT 常量不得回来(它正是那份重复推导的名字)')
  assert.match(
    code,
    /import\s*\{[^}]*\bdevEnvRoot\b[^}]*\}\s*from\s*'\.\/seal-c-root-stray\.mjs'/,
    '必须真的 import 共用出口(§22c 装车证明:只写注释不接线,等于这句话是假的)',
  )
  assert.match(code, /process\.env\.IHUI_PG_BIN_DIR\s*\|\|/, 'IHUI_PG_BIN_DIR 必须仍优先于任何推导(接线共用出口不得挤掉这条既有覆盖名)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
