#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 还原后**应用语义**回放器(2026-09-27,G-270 的下一格)。
 *
 * 它回答的是那句一直没人证过的问题:**"还原出来的库,应用自己的查询跑不跑得住"**。
 * 行数全等、表数全等、扩展在位 —— 这些都是**元数据**层面的证据。一次 `pg_restore`
 * 完全可以把 720 张表原样摆好,而应用一查就报错:缺手写迁移建的 `search_vector` 列、
 * 自定义 enum 类型没随库走、RLS 会话变量没设 ⇒ 返回 0 行(不报错!)、序列落后于
 * `max(id)`(读得到、写不进)。这些形态没有一个会移动"表数/行数"那两把尺子。
 *
 * 做法:把 `scripts/data/restore-read-queries.json` 里那 60 条**从真实调用点逐字导出**的
 * 只读查询,同一轮里分别打到生产库与演练库,逐条比"能不能跑 + 列形是否一致 + 行数差多少"。
 * 两侧同面同轮取数(本仓老教训:一次取数跨两个时刻,产出的是一条自洽却错位的尺子)。
 *
 * 三态绝不并桶:
 *   pass        两侧都跑通且列形一致(行数差值另报,生产是活的)
 *   drill-error 生产跑通、**还原库报错** ⇒ 这就是本工具存在的唯一理由,必判红
 *   drift       跑通但行数不等 ⇒ 只报数并给差值(生产有在跑流量,这是常态不是事故)
 *   undetermined 任一侧没跑出结论(缺凭据/缺库/超时/解析不出) ⇒ 绝不记为通过
 *
 * 「缺库」这一格 2026-09-30 起由**前置探询**判,不再混进 drill-error:演练库当天不存在时,
 * 还原侧每条都以 `FATAL: database ... does not exist` 失败,旧写法把它们全计成
 * `drill-error` 并 exit 1 —— 而 `drill-error` 在这个工具里的语义是「还原出来的库跑不住
 * 应用的查询」。两种完全不同的事实在报告上长得一模一样,谁按这份读数寄 `db-restore-not-app-usable`
 * 就是往机主手机上寄一封假 P0。判法不靠猜错误文案:先用**同一条只读通道**打一次 `SELECT 1`,
 * 探不通 ⇒ 整轮落未判定并 exit 2(且不浪费 60 次生产查询);探得通而某条语句报错,那才是
 * drill-error —— 连"库在、但这条语句在还原库上超时(FATAL)"这一型也照旧判红,前置探询
 * 不是把 FATAL 一律洗成未判定的文字分类器。
 *
 * CLI:
 *   node scripts/pg-restore-app-reads.mjs [--drill-db <名字>] [--prod-db ihui_dev]
 *                                         [--fixture <path>] [--strict] [--json] [--limit N]
 *   默认 --drill-db = 今日演练库名(按 drill 工具同一条 ^ihui_restore_drill_\d{8}$ 校验)。
 *
 * 安全边界(写进判据,不是口号):
 *   · 全程只读:每条语句先过 `assertReadOnlySql`(关键字 + 多语句 + 反斜杠元命令三重),
 *     不合格的直接拒跑;两侧都用 `PGOPTIONS=-c default_transaction_read_only=on
 *     -c statement_timeout=15000` 让服务端再兜一层(判据不许只靠客户端自觉)。
 *   · 只连**两个**库:生产(读)+ 演练库;库名不合形状 ⇒ exit 2,不猜、不改连别处。
 *   · 口令走子进程 env(与 pg-restore-drill 共用同一份 resolveCredential 实现,不留第二份),
 *     永不打印;取不到就判"无法判定"。
 *   · 派生一律绝对路径 + timeout + windowsHide(§5b)。
 *   · 本工具**不在提交链上**(它判的是库的实时状态,提交者结构上满足不了 —— 挂 blocking
 *     就是每台每次被逼 --no-verify 的恒红门,§12e 同型)。问责入口见 README 与月度演练清单。
 *
 * 退出码:0=无 drill-error 且无未判定;1=有 drill-error(--strict 下也包含 drift);
 *        2=无法判定(缺凭据/缺夹具/库名不合法/演练库不可达/一个都没跑成)。
 */
/* eslint-disable no-console -- 本工具是 CLI 回放器,诊断结论必须走 console(与 pg-restore-drill.mjs 同形) */
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { DRILL_NAME_RE, resolveCredential, todayYmd } from './pg-restore-drill.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'
// §15b 外置根唯一出口 —— 与 pg-restore-drill / seal-c-root-stray 同源,不再自己数层推盘根。
import { devEnvRoot } from './seal-c-root-stray.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const DEFAULT_FIXTURE = join(REPO, 'scripts', 'data', 'restore-read-queries.json')
const PG_BIN = process.env.IHUI_PG_BIN_DIR || join(devEnvRoot(), 'runtimes', 'pgsql', 'bin')

// 只读判据:命中即**拒跑该条**(不是"警告后照跑")。宁可漏判成未判定,绝不为跑通而放宽。
const FORBIDDEN_RE =
  /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|COPY|VACUUM|ANALYZE|REINDEX|REFRESH|CALL|DO|PREPARE|LISTEN|NOTIFY|SET|RESET|DISCARD)\b/i

/**
 * 纯函数:一条语句能不能被本工具执行。
 * @returns {{ok:true}|{ok:false,why:string}}
 */
export function assertReadOnlySql(sql) {
  const s = String(sql || '').trim()
  if (!s) return { ok: false, why: '空语句' }
  if (/[\\]/.test(s)) return { ok: false, why: '含反斜杠元命令(psql 客户端指令)' }
  const stripped = s.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
  const m = FORBIDDEN_RE.exec(stripped)
  if (m) return { ok: false, why: `含写/DDL/会话级关键字 ${m[1].toUpperCase()}` }
  const body = stripped.replace(/;\s*$/, '')
  if (body.includes(';')) return { ok: false, why: '多语句(分号分隔)—— 无法保证整串都是只读' }
  return { ok: true }
}

/** 三态判定:两侧都跑通且列形一致 = pass;生产通而演练错 = drill-error(本工具唯一要抓的那一型) */
export function decideQuery({ prodOk, drillOk, prodCols, drillCols, prodRows, drillRows }) {
  if (!prodOk && !drillOk) return { state: 'undetermined', why: '两侧都没跑出结论' }
  if (!prodOk) return { state: 'undetermined', why: `生产侧未跑出结论(基准缺失,无从对照)` }
  if (!drillOk) return { state: 'drill-error', why: '生产跑通而还原库报错' }
  if (prodCols !== null && drillCols !== null && prodCols !== drillCols)
    return { state: 'shape-drift', why: `列数不等 生产=${prodCols} 还原=${drillCols}` }
  if (prodRows !== drillRows) return { state: 'drift', why: `行数差 ${drillRows - prodRows}(生产为活库)` }
  return { state: 'pass', why: '' }
}

/** --strict 判红集合:drill-error 恒红;shape-drift/未判定也红;drift 仅在 --strict 下红 */
export function shouldFail(states, { strict }) {
  if (states['drill-error'] > 0 || states['shape-drift'] > 0) return true
  if (states['undetermined'] > 0) return true
  if (strict && states['drift'] > 0) return true
  return false
}

function parseCliArgs(argv) {
  const o = { drillDb: null, prodDb: 'ihui_dev', fixture: DEFAULT_FIXTURE, strict: false, json: false, limit: 0 }
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--strict') o.strict = true
    else if (a === '--json') o.json = true
    else if (a === '--drill-db') o.drillDb = argv[++i]
    else if (a === '--prod-db') o.prodDb = argv[++i]
    else if (a === '--fixture') o.fixture = resolve(argv[++i])
    else if (a === '--limit') o.limit = Number(argv[++i]) || 0
    else return { error: `未知开关:${a}(本工具不接受任何其他目标,尤其不接受任意 SQL)` }
  }
  if (!o.drillDb) o.drillDb = `ihui_restore_drill_${todayYmd()}`
  return o
}

/** 生产库名同样钉死在已知集合内 —— 只读工具也不接受"随便连个库读读" */
export function isAllowedProdDb(name) {
  return name === 'ihui_dev' || name === 'ihui_ci_test' || name === 'ihui_e2e'
}

export function main(argv = process.argv, deps = {}) {
  const o = parseCliArgs(argv)
  if (o.error) {
    console.error(`❌ ${o.error}`)
    return 2
  }
  if (!DRILL_NAME_RE.test(o.drillDb)) {
    console.error(`❌ 演练库名不合法:${JSON.stringify(o.drillDb)} —— 只接受 ihui_restore_drill_+8位日期`)
    return 2
  }
  if (!isAllowedProdDb(o.prodDb)) {
    console.error(`❌ 生产库名不在允许集合(ihui_dev/ihui_ci_test/ihui_e2e):${JSON.stringify(o.prodDb)}`)
    return 2
  }
  const cred = resolveCredential()
  if (!cred || cred.null) {
    console.error(`❌ 无法判定:凭据取不到 —— ${cred && cred.reason ? cred.reason : '无出口'}`)
    return 2
  }
  let fixture
  try {
    fixture = JSON.parse(readFileSync(o.fixture, 'utf8'))
  } catch (e) {
    console.error(`❌ 无法判定:夹具读不到 ${o.fixture} —— ${e.message}`)
    return 2
  }
  const qs = Array.isArray(fixture.queries) ? fixture.queries : []
  if (qs.length === 0) {
    console.error('❌ 无法判定:夹具里一条查询都没有(枚举到 0 条不得记为通过)')
    return 2
  }
  const psql = join(PG_BIN, 'psql.exe')
  if (!existsSync(psql)) {
    console.error(`❌ 无法判定:psql 不在位 ${psql}`)
    return 2
  }
  const env = { ...process.env, PGPASSWORD: cred.password, PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=15000' }
  /**
   * 语句一律走 **`-f` 临时 UTF-8 文件**,不走 `-c` 命令行参数。
   * 这不是风格选择:实测 `-c "SELECT '助'"` 在**带不带 PGCLIENTENCODING=UTF8 两种情况下都报**
   *   `ERROR: invalid byte sequence for encoding "UTF8": 0xd6 0xfa`
   * —— node 把参数交给 Windows 时过了一层 ANSI(GBK)代码页,中文被改写;而同一句写成
   *   UTF-8 文件用 `-f` 送进去则原样返回 `助`。
   * 后果如果不知道:任何带中文字面量的查询都会**在生产侧先报错**,被本工具记成"未判定",
   * 而还原侧根本没被问过 —— 判据看起来在跑,实际对这一族永远没有结论。
   * (AGENTS.md §5e 对邮件正文、§26 对回读路径各记过一次同一个码页陷阱,这是第三次。)
   */
  const tmpDir = mkScratch('pg-app-reads')
  let querySeq = 0
  const runOne =
    deps.spawnPsql ||
    ((db, sql) => {
      const file = join(tmpDir, `q-${(querySeq += 1)}.sql`)
      writeFileSync(file, `${sql}\n`, { encoding: 'utf8' })
      const r = spawnPsql(
        psql,
        ['-w', '-h', 'localhost', '-p', '8810', '-U', cred.user, '-d', db, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-f', file],
        env,
      )
      rmSync(file, { force: true })
      return r
    })

  const rows = []
  const states = { pass: 0, drift: 0, 'shape-drift': 0, 'drill-error': 0, refused: 0, undetermined: 0 }
  const list = o.limit > 0 ? qs.slice(0, o.limit) : qs

  /**
   * 前置探询:演练库到底在不在。这一问必须在循环**之前** —— 库里没有这座库时,逐条问
   * 到的都只是"连不上",而它们会被计成 drill-error(见头注那一格)。用同一条只读通道、
   * 同一个 runOne 打 `SELECT 1`,不解析错误文案来分类:连通性本身就是判据。
   */
  const probe = runOne(o.drillDb, 'SELECT 1')
  if (!probe.ok) {
    const firstErr = String(probe.stderr || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l !== '')
    const why = `演练库不可达(本工具只在当天真跑过在线还原演练之后有结论)${firstErr ? ' —— ' + firstErr.slice(0, 200) : ''}`
    for (const q of list) rows.push({ id: q.id, state: 'undetermined', why })
    states.undetermined = list.length
    rmScratch(tmpDir)
    if (o.json) {
      console.log(
        JSON.stringify({
          fixture: o.fixture,
          count: list.length,
          fixtureTotal: qs.length,
          prodDb: o.prodDb,
          drillDb: o.drillDb,
          drillProbe: { ok: false, why: firstErr || '无错误输出' },
          verdict: 'undetermined',
          states,
          rows,
        }),
      )
    } else {
      console.log(`\n还原库应用语义回放:夹具 ${qs.length} 条 / 本轮 ${list.length} 条 / 生产=${o.prodDb} / 还原库=${o.drillDb}`)
      console.log(`(口令来源 ${cred.source};本轮一条都没有下发 —— 两侧各 0 次查询)\n`)
      console.log(`❌ 未判定:${why}`)
      console.log('   这份读数**不是**"还原出来的库跑不住应用的查询":那条结论只能来自真还原过的库。')
      console.log(`   出路(按序):node scripts/pg-restore-drill.mjs --check 判 rc=0;`)
      console.log(
        `   再由持超管口令者按机主授权建当日演练库 ihui_restore_drill_${todayYmd()} 并还原,然后复跑本工具。`,
      )
      console.log('   非演练日拿到 exit 2 是**预期结果**,不得据此寄 db-restore-not-app-usable。')
    }
    return 2
  }

  for (const q of list) {
    const guard = assertReadOnlySql(q.sql)
    if (!guard.ok) {
      states.refused++
      rows.push({ id: q.id, state: 'refused', why: guard.why })
      continue
    }
    const a = runOne(o.prodDb, q.sql)
    const b = runOne(o.drillDb, q.sql)
    const cols = (r) => {
      if (!r.ok) return null
      const first = String(r.stdout || '').split(/\r?\n/).find((l) => l !== '')
      return first === undefined ? null : first.split('|').length
    }
    const rowCount = (r) => (r.ok ? String(r.stdout || '').split(/\r?\n/).filter((l) => l !== '').length : -1)
    const d = decideQuery({
      prodOk: a.ok,
      drillOk: b.ok,
      prodCols: cols(a),
      drillCols: cols(b),
      prodRows: rowCount(a),
      drillRows: rowCount(b),
    })
    states[d.state] = (states[d.state] || 0) + 1
    rows.push({
      id: q.id,
      state: d.state,
      why: d.why,
      prodErr: a.ok ? '' : (a.stderr || '').split(/\r?\n/)[0].slice(0, 160),
      drillErr: b.ok ? '' : (b.stderr || '').split(/\r?\n/)[0].slice(0, 160),
    })
  }

  rmScratch(tmpDir)
  const failed = shouldFail(states, { strict: o.strict })
  if (o.json) {
    console.log(JSON.stringify({ fixture: o.fixture, count: list.length, prodDb: o.prodDb, drillDb: o.drillDb, states, rows }))
  } else {
    console.log(`\n还原库应用语义回放:夹具 ${list.length} 条 / 生产=${o.prodDb} / 还原库=${o.drillDb}`)
    console.log(`(两侧均带 default_transaction_read_only=on 与 statement_timeout=15s;口令来源 ${cred.source})`)
    console.log(`(演练库可达性前置探询通过 ⇒ 下面的 drill-error 是真"还原库跑不住这条查询",不是连不上库)\n`)
    for (const r of rows) {
      if (r.state === 'pass') continue
      const extra = r.drillErr || r.prodErr || r.why || ''
      console.log(`  ${r.state === 'drill-error' ? '🔴' : r.state === 'refused' ? '⛔' : r.state === 'shape-drift' ? '🟠' : '·'} ${r.id.padEnd(42)} ${r.state}  ${extra}`)
    }
    const passed = rows.filter((r) => r.state === 'pass').length
    console.log(
      `\n汇总: pass=${states.pass} drift=${states.drift} shape-drift=${states['shape-drift']} ` +
        `还原库报错=${states['drill-error']} 拒跑=${states.refused} 未判定=${states.undetermined} ` +
        `(逐条跑通且列形一致 ${passed}/${list.length})`,
    )
    console.log('覆盖边界: 只判"应用的读法在还原库上成不成立";不判写路径(序列/identity 落后属写侧,另计)。')
  }
  return failed ? 1 : 0
}

/**
 * 一次 psql 只读调用。判"跑通"不只看退出码:`ON_ERROR_STOP=1` 下 psql 会非零退出,
 * 但 `-t -A` 组合在某些错误路径上仍返回 0 而把 ERROR 打在 stderr —— 所以 stderr 里有
 * ERROR: 也算没跑通。(只看 rc 会把"报错但有输出"读成通过,那是本工具最不该犯的错。)
 */
export function spawnPsql(exe, args, env) {
  const r = spawnSync(exe, args, {
    encoding: 'utf8',
    timeout: 40_000,
    windowsHide: true,
    env,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const stderr = String(r.stderr || '')
  const ok = r.status === 0 && !/ERROR:/i.test(stderr)
  return { ok, stdout: String(r.stdout || ''), stderr, rc: r.status ?? -1 }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exitCode = main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
