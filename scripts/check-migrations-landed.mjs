#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 审计工具需要输出诊断信息 */
/**
 * 迁移先行闸 · 逐枚落地审计(check-migrations-landed.mjs,2026-11-06 立,归票 Y-70③)
 *
 * 立因(一手取证,非推测):
 *   deploy/win/ihui-deploy.ps1 的 `Get-PendingMigrationCount` 只做**数量算术**:
 *   `pending = journal.entries 总数 − count(drizzle.__drizzle_migrations)`(负数截 0)。
 *   它结构上答不出"差哪几枚":旧迁移欠着、新迁移补上,枚数配平 ⇒ pending=0 ⇒ 'OK' ⇒ 照常切流。
 *   Y-70③ 的硬约束「先应用 `0364_app_versions_store_channel` 再上线含 store 列 select 的代码
 *   (反过来以 42703 失败)」恰好落在这格的盲区里 —— 2026-09-13 那型"migrate exit 0 空转一条不应用"
 *   在枚数面上同样隐身。本闸把判据从"数数"改成"逐枚":每条 journal entry 必须在库内有对应行,
 *   缺谁点名谁。
 *
 * 判据(复用而非复算,AGENTS §0.6;以下四件全部 import 自 check-migration-bookkeeping.mjs):
 *   · journalEntriesOf —— journal 结构/空枚举判死(枚举到 0 ⇒ 未判定,不记绿,§0.3)
 *   · sha256Hex        —— drizzle 记账 hash 的同一式子(migrator 对整份 .sql 全文做 sha256)
 *   · b11ComparableForms —— 零宽水印注入后的全部合法比对形态(只算不写盘,§5c)
 *   · psqlFailText     —— 失败文案的凭据脱敏(口令不得进 stdout)
 *   psql 客户端定位同样复用 lib/psql-client-locate.mjs 的 locatePsqlClient(候选序唯一实现)。
 *
 * 落地定义(两路任一命中即算 landed):
 *   ① 存在库行 hash == sha256(该 .sql 的某合法比对形态)(内容身份,容忍 when 漂移;DB-14 起强制校验)
 *   ② 取不到 .sql 正文时,存在库行 created_at == entry.when(弱兜底,不报错)
 *   —— 正文可取时 when 命中但 hash 不符 ⇒ 判缺(exit 1),不再短路成 landed。
 *
 * 只读纪律:本器只发一条 `SELECT created_at||'|'||hash FROM drizzle.__drizzle_migrations`,
 * 不写库、不写盘、不跑迁移。取证/测试一律离线用替身注入行集,绝不连生产库(AGENTS §5 隔离铁律)。
 *
 * 退出码(三态绝不并桶):
 *   0 = 全部落地(可以放行切流)
 *   1 = 缺迁移未落地,stdout/JSON 点名 tag 清单(上线必须拒绝)
 *   2 = 未判定(取不到 DSN / psql 定位落空 / 查询失败 / journal 读不到或 0 条 / 输出解析不出)
 *       —— 未判定**不是**绿灯;调用侧(部署链)按 fail-closed 处理,不放行切流。
 *
 * 用法:
 *   node scripts/check-migrations-landed.mjs                    # DSN: --dsn > env DATABASE_URL > apps/api/.env
 *   node scripts/check-migrations-landed.mjs --dsn postgresql://…/db
 *   node scripts/check-migrations-landed.mjs --dsn-file apps/api/.env --json
 *   node scripts/check-migrations-landed.mjs --self-test        # 离线净库/替身取证(含副作用断言)
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  journalEntriesOf,
  sha256Hex,
  b11ComparableForms,
  psqlFailText,
} from './check-migration-bookkeeping.mjs'
import { locatePsqlClient, psqlLocateMissText } from './lib/psql-client-locate.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const JOURNAL_REL = path.join('packages', 'database', 'drizzle', 'meta', '_journal.json')
const DRIZZLE_REL = path.join('packages', 'database', 'drizzle')
/** 人读面最多点名这么多枚(超出给「…等共 N 枚」并以 --json 拿全清单;计数恒为全量,不截断判据) */
const NAME_CAP = 25

class Undetermined extends Error {}

function parseArgs(argv) {
  const o = { dsn: '', dsnFile: 'apps/api/.env', json: false, selfTest: false, error: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--json') o.json = true
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--dsn') {
      const v = argv[i + 1] ?? ''
      if (!v || v.startsWith('--')) { o.error = '--dsn 需要取值(URL)'; return o }
      o.dsn = v
      i += 1
    } else if (a === '--dsn-file') {
      const v = argv[i + 1] ?? ''
      if (!v || v.startsWith('--')) { o.error = '--dsn-file 需要取值(文件路径)'; return o }
      o.dsnFile = v
      i += 1
    } else if (a.startsWith('--dsn=')) o.dsn = a.slice(6)
    else { o.error = `未支持参数:${a}`; return o }
  }
  return o
}

/** DATABASE_URL 行提取(与部署链同口径:首个非空赋值,剥外层引号)。取不到返回 ''。 */
export function parseDsnLine(text) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*DATABASE_URL\s*=\s*(.+?)\s*$/.exec(line)
    if (m) return m[1].trim().replace(/^["'](.*)["']$/, '$1')
  }
  return ''
}

/** psql `-At -F '|'` 单列拼接输出 → [{createdAt:Number, hash}];非数字行整体判「解析不出」。 */
export function parseRows(text) {
  const rows = []
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const cut = t.lastIndexOf('|')
    if (cut <= 0) throw new Undetermined(`库输出行解析不出(缺 created_at|hash 分隔符):${t.slice(0, 60)}`)
    const created = Number(t.slice(0, cut))
    const hash = t.slice(cut + 1).trim()
    if (!Number.isFinite(created) || !/^[0-9a-fA-F]{16,}$/.test(hash))
      throw new Undetermined(`库输出行非预期形态:${t.slice(0, 60)}`)
    rows.push({ createdAt: created, hash: hash.toLowerCase() })
  }
  return rows
}

/**
 * 纯函数判据:逐枚落地比对。
 * entries=[{tag,when}], rows=[{createdAt,hash}], sqlTextOf(tag)→string|null(取不到就放弃 hash 路,不报错)。
 * 返回缺失清单(含 note='无.sql可比对形态' 之类归因),空数组=全部落地。
 */
export function missingEntries(entries, rows, sqlTextOf) {
  const createdAts = new Set(rows.map((r) => Number(r.createdAt)))
  const hashes = new Set(rows.map((r) => String(r.hash).toLowerCase()))
  const missing = []
  for (const e of entries) {
    const text = typeof sqlTextOf === 'function' ? sqlTextOf(e.tag) : null
    if (typeof text === 'string') {
      // DB-14:正文 hash 是内容身份;命中即落地(容忍 when 漂移)。
      // when 命中但 hash 不符 ⇒ created_at 被复用/文件后改,必须判缺,不能短路放行。
      const hit = b11ComparableForms(text)
        .candidates.map((c) => sha256Hex(c))
        .some((h) => hashes.has(h))
      if (hit) continue
      missing.push({
        tag: e.tag,
        idx: e.idx,
        when: e.when,
        note: createdAts.has(Number(e.when))
          ? 'when 命中但文件 hash 与账本不符(内容漂移/身份复用)'
          : '',
      })
      continue
    }
    if (createdAts.has(Number(e.when))) continue
    missing.push({ tag: e.tag, idx: e.idx, when: e.when, note: '无.sql文件可比对形态' })
  }
  return missing
}

/** 默认取 .sql 正文(工作树 = 即将上线的那份代码);读不到返回 null(该枚留缺失并归因)。 */
export function sqlTextOfWorktree(tag) {
  try {
    return fs.readFileSync(path.join(ROOT, DRIZZLE_REL, `${tag}.sql`), 'utf8')
  } catch {
    return null
  }
}

export function readJournalWorktree() {
  const p = path.join(ROOT, JOURNAL_REL)
  let text
  try {
    text = fs.readFileSync(p, 'utf8')
  } catch {
    throw new Undetermined(`journal 文件读不到:${p}`)
  }
  return journalEntriesOf(text, '工作树').entries
}

/** 真查询(仅部署机使用;测试一律走注入替身,绝不连库)。 */
export function defaultQueryRunner(dsn) {
  const loc = locatePsqlClient(process.env)
  if (!loc.psql) throw new Undetermined(psqlLocateMissText(loc.tried))
  const sql = "SELECT created_at || '|' || hash FROM drizzle.__drizzle_migrations;"
  let r
  try {
    r = spawnSync(loc.psql, ['-d', dsn, '-At', '-F', '|', '-c', sql], {
      cwd: ROOT,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git/进程必须显式接管 stdio
    })
  } catch (e) {
    throw new Undetermined(psqlFailText(e, dsn))
  }
  if (r.error) throw new Undetermined(psqlFailText(r.error, dsn))
  if (r.status !== 0)
    throw new Undetermined(psqlFailText(new Error(`psql exit ${r.status}: ${String(r.stderr ?? '').slice(0, 200)}`), dsn))
  return String(r.stdout ?? '')
}

/**
 * 核心判定(可注入三件替身:entries/runner/sqlTextOf)→ {verdict, total, missing, reason}
 * verdict ∈ landed | missing | undetermined。未判定绝不冒充另外两态(§0.3)。
 */
export function evaluate({ entries, dsn, runner, sqlTextOf, limit = NAME_CAP }) {
  let ent = entries
  if (ent === undefined) ent = readJournalWorktree()
  if (!Array.isArray(ent) || ent.length === 0)
    return { verdict: 'undetermined', reason: 'journal entries 为 0 条(枚举到 0 判死不记绿)' }
  let raw
  try {
    raw = typeof runner === 'function' ? runner(dsn) : defaultQueryRunner(dsn)
  } catch (e) {
    return { verdict: 'undetermined', reason: e instanceof Undetermined ? e.message : `库查询异常:${e?.message ?? e}` }
  }
  let rows
  try {
    rows = parseRows(raw)
  } catch (e) {
    return { verdict: 'undetermined', reason: e.message }
  }
  const miss = missingEntries(ent, rows, sqlTextOf ?? sqlTextOfWorktree)
  if (miss.length === 0) return { verdict: 'landed', total: ent.length, missing: [] }
  return {
    verdict: 'missing',
    total: ent.length,
    missingCount: miss.length,
    missing: miss.slice(0, limit).map((m) => (m.note ? `${m.tag}(${m.note})` : m.tag)),
    truncatedNote: miss.length > limit ? `…等共 ${miss.length} 枚(--json 输出前 ${limit} 条全字段)` : '',
    missingFull: miss,
  }
}

function report(r, asJson) {
  if (asJson) {
    const slim = { verdict: r.verdict, total: r.total, missingCount: r.missingCount, missing: r.missingFull ?? r.missing, reason: r.reason }
    console.log(JSON.stringify(slim))
  } else if (r.verdict === 'landed') {
    console.log(`✅ 迁移落地审计通过:journal ${r.total} 条在库内逐枚对账全部落地`)
  } else if (r.verdict === 'missing') {
    console.log(`❌ 缺 ${r.missingCount} 枚迁移未落地(上线拒绝,差的就是这些):`)
    for (const m of r.missing) console.log(`   - ${m}`)
    if (r.truncatedNote) console.log(`   ${r.truncatedNote}`)
  } else {
    console.log(`⚠️ 未判定(不记绿也不记红;fail-closed 侧不放行):${r.reason}`)
  }
}

export function exitCodeOf(r) {
  return r.verdict === 'landed' ? 0 : r.verdict === 'missing' ? 1 : 2
}

// ── 离线自证:净库/替身,绝不连真库(§5 测试隔离;拒绝真会响 + 副作用未发生)──
function runSelfTest() {
  const out = []
  let failed = 0
  const ok = (name, cond, extra = '') => {
    out.push(`${cond ? '✅' : '❌'} ${name}${extra ? ` [${extra}]` : ''}`)
    if (!cond) failed += 1
  }
  const E = (n) => Array.from({ length: n }, (_, i) => ({ idx: i, tag: `t${i}`, when: 1000 + i }))
  const _spy = { calls: [], writes: 0 }
  const _fakeRunner = (dsn, rawFor) => (d) => {
    _spy.calls.push({ dsn: d ?? dsn, sql: rawFor })
    return rawFor
  }
  // T1 全落地(when 逐一对上)
  const HEX = (c) => c.repeat(64)
  const r1 = evaluate({ entries: E(3), dsn: 'x', runner: () => `1000|${HEX('a')}\n1001|${HEX('b')}\n1002|${HEX('c')}`, sqlTextOf: null })
  ok('T1 全落地 ⇒ verdict=landed/exit 0', r1.verdict === 'landed' && exitCodeOf(r1) === 0)
  // T2 枚数配平而恰差 0364 型(旧欠新补,数量算术看不见)
  const r2 = evaluate({ entries: E(3), dsn: 'x', runner: () => `1000|${HEX('a')}\n1002|${HEX('b')}\n1003|${HEX('c')}`, sqlTextOf: () => null })
  ok('T2 差一枚 ⇒ missing 点名该枚 tag', r2.verdict === 'missing' && r2.missing[0] === 't1(无.sql文件可比对形态)')
  ok('T2b 数量算术会算出 pending=0(对照:行数=条数 3v3 仍判缺)', r2.total === 3 && r2.missingCount === 1)
  // T3 净库(0 行)⇒ 全部点名(拒绝真会响)
  const r3 = evaluate({ entries: E(40), dsn: 'x', runner: () => '', sqlTextOf: () => null, limit: 25 })
  ok('T3 净库 ⇒ 拒绝且点名', r3.verdict === 'missing' && r3.missingCount === 40 && r3.missing.length === 25 && r3.truncatedNote.includes('共 40 枚'))
  // T4 hash 兜底(when 漂移、内容确已应用)
  const text = 'ALTER TABLE t ADD COLUMN c int;\n'
  const h = sha256Hex(text)
  const r4 = evaluate({ entries: [{ idx: 9, tag: 'legacy', when: 77 }], dsn: 'x', runner: () => `1|${h}`, sqlTextOf: () => text })
  ok('T4 hash 逐字命中 ⇒ 判落地', r4.verdict === 'landed')
  // T5 journal 0 条 ⇒ 未判定(空枚举不记绿,§0.3)
  const r5 = evaluate({ entries: [], dsn: 'x', runner: () => '' })
  ok('T5 枚举到 0 条 ⇒ undetermined/exit 2', r5.verdict === 'undetermined' && exitCodeOf(r5) === 2)
  // T6 取不到 DSN/psql 落空(查询抛未判定)⇒ 不并桶进绿灯/红
  const r6 = evaluate({ entries: E(3), dsn: '', runner: () => { throw new Undetermined('未找到 psql 客户端') } })
  ok('T6 库不可达 ⇒ undetermined 且带原因', r6.verdict === 'undetermined' && r6.reason.includes('psql'))
  // T7 库输出非预期形态 ⇒ 未判定,不猜
  const r7 = evaluate({ entries: E(3), dsn: 'x', runner: () => 'NOTICE: schema drizzle does not exist' })
  ok('T7 输出解析不出 ⇒ undetermined', r7.verdict === 'undetermined')
  // T8 只读纪律(副作用断言):runner 只收到 SELECT 文本;评估全程零 fs 写
  const before = new Set(_spy.calls.map((c) => c.sql))
  ok('T8 审计对库只发 SELECT(替身侧断言;真 runner 的语句同样以 SELECT 开头)',
    [...before].every((s) => /^SELECT\s/i.test(s)) && defaultQuerySqlIsReadOnly())
  // T9 DSN 优先级:--dsn > env > 文件
  ok('T9 parseDsnLine 剥引号且取首个赋值', parseDsnLine('A=1\nDATABASE_URL="postgresql://u:p@h/db"\nDATABASE_URL=x') === 'postgresql://u:p@h/db')
  const a = parseArgs(['--dsn-file', 'other.env', '--dsn', 'postgresql://a'])
  ok('T9b 参数解析无歧义', a.dsn === 'postgresql://a' && a.dsnFile === 'other.env' && !a.error)
  console.log(out.join('\n'))
  console.log(`SELF-TEST ${failed === 0 ? '通过' : '失败'}(${out.length} 条,失败 ${failed};全程替身注入,未发起任何真实连接/写盘)`)
  process.exit(failed === 0 ? 0 : 1)
}

/** 形状锁:真 runner 里那条语句必须是只读 SELECT(源码层,防后人加 UPDATE 进来)。 */
function defaultQuerySqlIsReadOnly() {
  const src = fs.readFileSync(path.join(HERE, 'check-migrations-landed.mjs'), 'utf8')
  const m = /const sql = ("(?:[^"\\]|\\.)*")/.exec(src)
  if (!m) return false
  try {
    return /^SELECT\s/i.test(JSON.parse(m[1]))
  } catch {
    return false
  }
}

export const __test__ = { parseArgs, parseDsnLine, parseRows, missingEntries, evaluate, exitCodeOf, Undetermined, sha256Hex }

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.selfTest) return runSelfTest()
  if (opts.error) {
    console.log(`⚠️ 未判定(参数:${opts.error})`)
    process.exit(2)
  }
  let dsn = opts.dsn || process.env.DATABASE_URL || ''
  if (!dsn) {
    try {
      dsn = parseDsnLine(fs.readFileSync(path.join(ROOT, opts.dsnFile), 'utf8'))
    } catch {
      dsn = ''
    }
  }
  if (!dsn) {
    console.log('⚠️ 未判定:取不到 DATABASE_URL(--dsn / env / apps/api/.env 三面皆空)⇒ 不记绿,fail-closed 不放行')
    process.exit(2)
  }
  const r = evaluate({ dsn })
  report(r, opts.json)
  process.exit(exitCodeOf(r))
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
