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

/** 递归枚举目录下普通文件(跳过符号链接防环),返回 {rel, bytes}[]。读不到抛错由 main 兜。 */
export function scanDir(dir) {
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
  ]
  let failed = 0
  for (const c of cases) {
    const r = classify(c.entries)
    const ok =
      r.state === c.want && r.over50.length === c.over50 && r.over20.length === c.over20
    log(`${ok ? '✅' : '❌'} self-test:${c.name}`)
    if (!ok) failed += 1
  }
  log(failed === 0 ? 'SELF-TEST state=pass' : `SELF-TEST state=fail failed=${failed}`)
  return failed === 0 ? 0 : 1
}

function conclusionLine(r) {
  return `TMP-BLOAT files=${r.files} total=${fmtMb(r.totalBytes)} MB max=${fmtMb(r.maxBytes)} MB ` +
    `over50=${r.over50.length} over20=${r.over20.length} state=${r.state}`
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
  const snap = {
    checkedAt: new Date().toISOString(),
    files: r.files,
    totalBytes: r.totalBytes,
    totalMb: Number(fmtMb(r.totalBytes)),
    maxBytes: r.maxBytes,
    maxFile: r.maxFile,
    over50: r.over50,
    over20: r.over20,
    state: r.state,
    alarmMb: ALARM_MB,
    watchMb: WATCH_MB,
  }
  writeState(snap)

  if (AS_JSON) {
    log(JSON.stringify({ tool: 'check-tmp-bloat', ...snap }))
  } else {
    log(conclusionLine(r))
    for (const x of r.over50) log(`  🚨 alarm(>${ALARM_MB}MB): ${x.rel} — ${fmtMb(x.bytes)} MB`)
    for (const x of r.over20) log(`  ⚠️ watch(>${WATCH_MB}MB): ${x.rel} — ${fmtMb(x.bytes)} MB`)
    if (r.state === 'ok') log(`  全部单枚 ≤ ${WATCH_MB}MB`)
  }

  if (r.state === 'undetermined') process.exitCode = 2
  else if (r.state === 'ok') process.exitCode = 0
  else process.exitCode = 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(2)
  })
}

export const __test__ = { classify, scanDir, ALARM_BYTES, WATCH_BYTES, TMP_DIR, STATE_FILE }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
