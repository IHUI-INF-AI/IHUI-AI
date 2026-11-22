#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-tmp-bloat.mjs — `.ihui-agent/tmp` 体积只读哨兵(运维尺子,不进提交链)。
 *
 * ## 立项目标
 *
 * `.ihui-agent/tmp/` 是 gitignored 的运行时落盘面(临时夹具 / CRX 缓存 / 提炼候选稿 /
 * 日志切片等都往这里堆),提交链上的 stagedTriggers 结构上永远扫不到它 —— 只靠人工
 * 偶尔清理,大枚依赖件(SODA.dll、tflite 模型、CRX 缓存)会长期留在盘上无人察觉。
 * 本器每轮只读枚举该目录,给出三读数(总枚数 / 总体积 / 最大单枚),并按两档阈值
 * 逐条点名越阈单枚(路径 + 字节)。
 *
 * ## 阈值(可被环境变量覆写,改档只改这里)
 *
 * - `ALARM`:单枚 > `ALARM_MB`(默认 50MB)⇒ alarm 档,必须点名;
 * - `WATCH`:单枚 > `WATCH_MB`(默认 20MB)且 ≤ ALARM ⇒ watch 档点名。
 *
 * 目标包络:tmp 内单枚 ≤ 20MB;>50MB 属于明显失控。阈值边界按严格大于判定,
 * 恰好等于阈值不越阈。
 *
 * ## 三态纪律(§0.3)
 *
 * 取目录 / 枚列举失败一律 `undetermined`(exit 2),不记绿也不冒红;空目录判 ok
 * (files=0),不冒充有越阈件。判据只量机器运行时状态,不读任何仓库内容。
 *
 * ## 结论行(机读唯一口径,guardian 派发腿只认这一行)
 *
 *   `TMP-BLOAT files=<n> total=<MB> max=<MB> over50=<n> over20=<n> state=<ok|watch|alarm|undetermined>`
 *
 * 状态落机读快照到 `.ihui-agent/state/tmp-bloat-last.json`(与 api-liveness /
 * tunnel-leg-health 巡检腿同族运行时状态位,gitignored,不进仓)。
 *
 * ## 「有意保留」登记面(2026-11-21 立,第 92 项)
 *
 * 立因:一次 recon 产物(157MB 的 `recon/qoder-graph.json`)把 50MB 阈值变成**恒态告警** ——
 * 本器只报不处置,盘上也没有任何一格能说"这枚我知道、它该在这儿"。于是同一条事实每 5 分钟
 * 报一次(§12e 恒红门禁令的反面:多喊一次没错,但一条不会变的读数反复喊就淹掉真的越阈件)。
 * 登记面 `scripts/data/tmp-bloat-keep.json`:命中(精确 rel 或 `/` 结尾前缀)∧ 带 reason ∧
 * reviewBy 未到期 ⇒ 该枚进 `kept`(照旧点名,但不算 over50/over20,故不抬 alarm)。
 * 台账读不到 / JSON 坏 / 条目缺件 / 已到期 ⇒ **一条都不豁免**,并逐条把原因打出来
 * (失效方向恒为多喊一次,§0.10)。`rel` 必须在 tmp 根之下,跑出根外的一律不认。
 *
 * 用法:
 *   node scripts/check-tmp-bloat.mjs              # 只读巡检
 *   node scripts/check-tmp-bloat.mjs --json        # 机器可读快照
 *   node scripts/check-tmp-bloat.mjs --self-test   # 判据自检(不碰磁盘枚举)
 *
 * 退出码:0 = 已判定且未越阈 / 1 = 已判定且越阈(watch 或 alarm)/ 2 = 未判定或用法错。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WORKTREE = path.resolve(HERE, '..')
const TMP_DIR = path.join(WORKTREE, '.ihui-agent', 'tmp')
const STATE_DIR = path.join(WORKTREE, '.ihui-agent', 'state')
const STATE_FILE = path.join(STATE_DIR, 'tmp-bloat-last.json')

const MB = 1024 * 1024
const ALARM_MB = Number(process.env.IHUI_TMP_BLOAT_ALARM_MB ?? 50)
const WATCH_MB = Number(process.env.IHUI_TMP_BLOAT_WATCH_MB ?? 20)
const ALARM_BYTES = ALARM_MB * MB
const WATCH_BYTES = WATCH_MB * MB

const SELF_TEST = process.argv.includes('--self-test')
const AS_JSON = process.argv.includes('--json')
const KEEP_LEDGER = process.env.IHUI_TMP_BLOAT_KEEP_JSON
  ? path.resolve(process.env.IHUI_TMP_BLOAT_KEEP_JSON)
  : path.join(WORKTREE, 'scripts', 'data', 'tmp-bloat-keep.json')

function log(line) {
  process.stdout.write(`${line}\n`)
}

/** 纯判据:把一组枚记录归两档。不碰磁盘,供自检与镜像测试 import(§22c 单一实现)。 */
export function classify(entries) {
  const over50 = []
  const over20 = []
  let totalBytes = 0
  let maxBytes = 0
  let maxFile = ''
  for (const e of entries || []) {
    const bytes = Number(e.bytes) || 0
    totalBytes += bytes
    if (bytes > maxBytes) {
      maxBytes = bytes
      maxFile = e.rel
    }
    if (bytes > ALARM_BYTES) over50.push({ rel: e.rel, bytes })
    else if (bytes > WATCH_BYTES) over20.push({ rel: e.rel, bytes })
  }
  const state = over50.length > 0 ? 'alarm' : over20.length > 0 ? 'watch' : 'ok'
  return {
    files: (entries || []).length,
    totalBytes,
    maxBytes,
    maxFile,
    over50,
    over20,
    state,
  }
}

/**
 * 纯判据:解析「有意保留」台账文本。零 IO、零副作用,供自检与镜像测试 import(§22c)。
 * 形状坏 / 缺件 / rel 跑出 tmp 根 ⇒ 逐条进 problems(该条**不豁免**);不抛错,不影响主判定。
 */
export function parseKeepLedger(rawText) {
  const problems = []
  const entries = []
  let parsed
  try {
    parsed = JSON.parse(String(rawText ?? ''))
  } catch (e) {
    return { entries: [], problems: [`台账不是合法 JSON(${String(e?.message ?? e).slice(0, 60)})⇒ 本轮一条都不豁免`] }
  }
  const list = Array.isArray(parsed?.entries) ? parsed.entries : []
  if (!Array.isArray(parsed?.entries)) problems.push('台账缺 entries 数组 ⇒ 本轮一条都不豁免')
  for (const e of list) {
    const rel = typeof e?.rel === 'string' ? e.rel.trim().replace(/\\/g, '/') : ''
    const reason = typeof e?.reason === 'string' ? e.reason.trim() : ''
    const reviewBy = typeof e?.reviewBy === 'string' ? e.reviewBy.trim() : ''
    if (!rel) {
      problems.push('有一条缺 rel ⇒ 该条不豁免')
      continue
    }
    // 登记面只能指向 tmp 根之内:绝对路径 / `..` 一律不认(否则一条台账能把盘上任意大文件"豁免"掉)
    if (rel.startsWith('/') || rel.includes('..') || /^[a-zA-Z]:/.test(rel)) {
      problems.push(`「${rel}」跑出 .ihui-agent/tmp 根外 ⇒ 该条不豁免`)
      continue
    }
    if (!reason) {
      problems.push(`「${rel}」缺 reason ⇒ 该条不豁免`)
      continue
    }
    const at = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reviewBy)
    const stamp = at ? Date.parse(`${reviewBy}T23:59:59Z`) : NaN
    if (!at || Number.isNaN(stamp)) {
      problems.push(`「${rel}」缺可解析 reviewBy(YYYY-MM-DD)⇒ 该条不豁免`)
      continue
    }
    entries.push({ rel, reason, reviewBy, expiresAt: stamp, prefix: rel.endsWith('/') })
  }
  return { entries, problems }
}

/** 纯判据:把越阈单枚按台账分流成越阈/保留两栏。零 IO。 */
export function applyKeep(result, entries, nowMs = Date.now()) {
  const all = [...(result?.over50 || []), ...(result?.over20 || [])]
  const kept = []
  const expired = []
  const over50 = []
  const over20 = []
  const list = Array.isArray(entries) ? entries : []
  for (const x of all) {
    const bytes = Number(x.bytes) || 0
    const hit = list.find((e) => (e.prefix ? x.rel.startsWith(e.rel) : x.rel === e.rel))
    if (hit && hit.expiresAt <= nowMs) {
      // 到期 = 不豁免:**仍算越阈**(否则"登记了就不再喊"会变成永久静音,正好是 §12e 那型)
      expired.push({ rel: x.rel, bytes, reviewBy: hit.reviewBy })
      if (bytes > ALARM_BYTES) over50.push(x)
      else over20.push(x)
    } else if (hit) {
      kept.push({ rel: x.rel, bytes, reason: hit.reason, reviewBy: hit.reviewBy })
    } else if (bytes > ALARM_BYTES) over50.push(x)
    else over20.push(x)
  }
  const state = over50.length > 0 ? 'alarm' : over20.length > 0 ? 'watch' : 'ok'
  return { over50, over20, kept, expired, state }
}

/** 递归枚举目录下普通文件(跳过符号链接防环),返回 {rel, bytes}[]。读不到抛错由 main 兜。 */export function scanDir(dir) {
  const out = []
  const walk = (abs, relBase) => {
    let entries
    try {
      entries = readdirSync(abs, { withFileTypes: true })
    } catch (e) {
      throw new Error(`读目录失败 ${relBase || '.'}: ${String(e?.message ?? e).slice(0, 80)}`)
    }
    for (const ent of entries) {
      if (ent.isSymbolicLink()) continue
      const childAbs = path.join(abs, ent.name)
      const childRel = relBase ? `${relBase}/${ent.name}` : ent.name
      if (ent.isDirectory()) walk(childAbs, childRel)
      else if (ent.isFile()) {
        let bytes = 0
        try {
          bytes = readFileSync(childAbs).length
        } catch {
          bytes = 0
        }
        out.push({ rel: childRel, bytes })
      }
    }
  }
  walk(dir, '')
  return out
}

function fmtMb(bytes) {
  return (Number(bytes || 0) / MB).toFixed(2)
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return null
  }
}

function writeState(snap) {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(snap, null, 2), 'utf8')
  } catch (e) {
    log(`⚠️ 状态快照写入失败(${String(e?.message ?? e).slice(0, 90)})——不影响本轮判定`)
  }
}

/** 自检:阈值分档 + 边界严格大于 + 空目录 ok,负向用例证明超阈会进对应档。 */
function selfTest() {
  const cases = [
    { name: '60MB 单枚进 alarm 档', entries: [{ rel: 'a/SODA.dll', bytes: 60 * MB }], want: 'alarm', over50: 1, over20: 0 },
    { name: '25MB 单枚进 watch 档', entries: [{ rel: 'b/model.tflite', bytes: 25 * MB }], want: 'watch', over50: 0, over20: 1 },
    { name: '全部 <20MB 判 ok', entries: [{ rel: 'c/a.log', bytes: 100 * MB / 100 }, { rel: 'c/b.json', bytes: 5 * MB }], want: 'ok', over50: 0, over20: 0 },
    { name: '空目录判 ok(不冒充越阈)', entries: [], want: 'ok', over50: 0, over20: 0 },
    { name: '恰好 50MB 不算 >50(边界严格大于)', entries: [{ rel: 'd/x', bytes: ALARM_BYTES }], want: 'watch', over50: 0, over20: 1 },
    { name: '恰好 20MB 不算 >20', entries: [{ rel: 'e/y', bytes: WATCH_BYTES }], want: 'ok', over50: 0, over20: 0 },
    // 第 92 项:登记面的四条牙 —— 命中就降档、到期就失效、跑出根就作废、坏 JSON 一条都不豁免。
    {
      name: '登记命中 ⇒ 该枚进 kept,不抬 alarm',
      keep: [{ rel: 'r/qoder-graph.json', reason: '取证产物', reviewBy: '2099-01-31', expiresAt: Date.parse('2099-01-31T23:59:59Z') }],
      entries: [{ rel: 'r/qoder-graph.json', bytes: 160 * MB }],
      want: 'ok', over50: 0, over20: 0, kept: 1,
    },
    {
      name: '登记已到期 ⇒ 仍算越阈(且不静默)',
      keep: [{ rel: 'r/qoder-graph.json', reason: '取证产物', reviewBy: '2000-01-01', expiresAt: Date.parse('2000-01-01T23:59:59Z') }],
      entries: [{ rel: 'r/qoder-graph.json', bytes: 160 * MB }],
      want: 'alarm', over50: 1, over20: 0, kept: 0, expired: 1,
    },
    {
      name: '前缀登记只吃该目录,别的越阈件照旧 alarm',
      keep: [{ rel: 'r/', reason: '目录级保留', reviewBy: '2099-01-31', expiresAt: Date.parse('2099-01-31T23:59:59Z'), prefix: true }],
      entries: [{ rel: 'r/a.bin', bytes: 60 * MB }, { rel: 'other/b.bin', bytes: 60 * MB }],
      want: 'alarm', over50: 1, over20: 0, kept: 1,
    },
    {
      name: '保留后另一枚 watch 仍在 ⇒ 落 watch 档,不被登记整体压平',
      keep: [{ rel: 'r/big.json', reason: '取证产物', reviewBy: '2099-01-31', expiresAt: Date.parse('2099-01-31T23:59:59Z') }],
      entries: [{ rel: 'r/big.json', bytes: 160 * MB }, { rel: 'w/mid.bin', bytes: 25 * MB }],
      want: 'watch', over50: 0, over20: 1, kept: 1,
    },
  ]
  let failed = 0
  for (const c of cases) {
    const base = classify(c.entries)
    const r = c.keep ? { ...base, ...applyKeep(base, c.keep, Date.parse('2026-11-21T00:00:00Z')) } : base
    const ok =
      r.state === c.want &&
      r.over50.length === c.over50 &&
      r.over20.length === c.over20 &&
      (c.kept === undefined || (r.kept || []).length === c.kept) &&
      (c.expired === undefined || (r.expired || []).length === c.expired)
    log(`${ok ? '✅' : '❌'} self-test:${c.name}`)
    if (!ok) failed += 1
  }
  log(failed === 0 ? 'SELF-TEST state=pass' : `SELF-TEST state=fail failed=${failed}`)
  return failed === 0 ? 0 : 1
}

function conclusionLine(r) {
  return `TMP-BLOAT files=${r.files} total=${fmtMb(r.totalBytes)} MB max=${fmtMb(r.maxBytes)} MB ` +
    `over50=${r.over50.length} over20=${r.over20.length} kept=${(r.kept || []).length} state=${r.state}`
}

/** 台账读不到 / 坏 ⇒ 不豁免(方向是多喊一次),但要把原因带进读数,不许静默。 */
function loadKeep() {
  let raw
  try {
    raw = readFileSync(KEEP_LEDGER, 'utf8')
  } catch (e) {
    return {
      entries: [],
      problems: [`台账读不到(${path.relative(WORKTREE, KEEP_LEDGER)}: ${String(e?.code ?? e?.message ?? e)})⇒ 本轮一条都不豁免`],
    }
  }
  return parseKeepLedger(raw)
}

async function main() {
  if (SELF_TEST) {
    process.exitCode = selfTest()
    return
  }
  if (!existsSync(TMP_DIR)) {
    log(`TMP-BLOAT files=0 total=0.00 MB max=0.00 MB over50=0 over20=0 state=undetermined`)
    log(`  原因: ${path.relative(WORKTREE, TMP_DIR)} 不存在 —— 不记绿也不冒红`)
    process.exitCode = 2
    return
  }

  let entries
  try {
    entries = scanDir(TMP_DIR)
  } catch (e) {
    log(`TMP-BLOAT files=0 total=0.00 MB max=0.00 MB over50=0 over20=0 state=undetermined`)
    log(`  原因: ${String(e?.message ?? e)}`)
    process.exitCode = 2
    return
  }

  const r = classify(entries)
  const keep = loadKeep()
  const split = applyKeep(r, keep.entries)
  const snap = {
    checkedAt: new Date().toISOString(),
    files: r.files,
    totalBytes: r.totalBytes,
    totalMb: Number(fmtMb(r.totalBytes)),
    maxBytes: r.maxBytes,
    maxFile: r.maxFile,
    over50: split.over50,
    over20: split.over20,
    kept: split.kept,
    expired: split.expired,
    keepProblems: keep.problems,
    state: split.state,
    alarmMb: ALARM_MB,
    watchMb: WATCH_MB,
  }
  writeState(snap)

  if (AS_JSON) {
    log(JSON.stringify({ tool: 'check-tmp-bloat', ...snap }))
  } else {
    log(conclusionLine(snap))
    for (const x of snap.over50) log(`  🚨 alarm(>${ALARM_MB}MB): ${x.rel} — ${fmtMb(x.bytes)} MB`)
    for (const x of snap.over20) log(`  ⚠️ watch(>${WATCH_MB}MB): ${x.rel} — ${fmtMb(x.bytes)} MB`)
    // 保留的大件**也要点名**(只报数不等于静音):否则下一个人看不出盘上那 157MB 是谁的、到哪天该续期。
    for (const x of snap.kept)
      log(`  📌 已登记保留(不算越阈,reviewBy ${x.reviewBy}): ${x.rel} — ${fmtMb(x.bytes)} MB`)
    for (const x of snap.expired)
      log(`  ⌛ 登记已到期(该条不豁免,仍算越阈): ${x.rel} — reviewBy ${x.reviewBy} 已过`)
    for (const p of snap.keepProblems) log(`  ℹ️ 台账:${p}`)
    if (snap.state === 'ok') log(`  全部单枚 ≤ ${WATCH_MB}MB(已扣除登记保留件)`)
  }

  if (snap.state === 'undetermined') process.exitCode = 2
  else if (snap.state === 'ok') process.exitCode = 0
  else process.exitCode = 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}

export const __test__ = { classify, parseKeepLedger, applyKeep, scanDir, ALARM_BYTES, WATCH_BYTES, TMP_DIR, STATE_FILE, KEEP_LEDGER }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
