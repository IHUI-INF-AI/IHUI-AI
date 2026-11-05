// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 二进制取证取词器:从任意原生二进制/打包产物里抽出「像 API 路径」的可打印串,
 * 并对给定关键词逐个数命中(AGENTS.md §0.12 逆向流程第②步的通用器物)。
 *
 * 为什么要有这一件:对照程序的自动面到底覆盖什么,只能从产出物里量;
 * 而「0 命中」和「不存在」是两件事(§0.3)——本器物把扫描面与命中数一并打印,
 * 结论才可复跑。文档里点名的取证方法必须真跑得通(§0.8),所以它进仓不进 tmp。
 *
 * 只读:不写盘、不发网络、不打印任何非路径内容(凭据形态的串不会从路径族里出来)。
 *
 * 用法:
 *   node scripts/inspect-binary-api-paths.mjs <文件> [--needle 串]... [--json] [--min N]
 *   node scripts/inspect-binary-api-paths.mjs --self-test
 *
 * 退出码:0 正常 / 2 用法或输入取不到(未判定)。
 */
import fs from 'node:fs'
import path from 'node:path'
import { isDirectRun } from './lib/direct-run.mjs'

/** 默认只要像服务端路径的串(以 / 开头,含 API 常见首段) */
const DEFAULT_RE =
  /\/(?:api|v\d|activity|auth|user|account|task|growth|billing|oauth|copilot|profile|events)[A-Za-z0-9_./{}:-]{4,140}/g

/**
 * 从字节里抽路径族(纯函数)。
 *
 * @param {string} text 按 latin1 解出的二进制原文(非 ASCII 字节不参与匹配)
 * @param {RegExp} re 取词正则(必须带 g)
 * @returns {Map<string, number>} 串 ⇒ 命中次数
 */
export function extractPathStrings(text, re = DEFAULT_RE) {
  const out = new Map()
  const src = String(text ?? '')
  if (!src) return out
  const rx = re.global ? new RegExp(re.source, re.flags) : new RegExp(re.source, re.flags + 'g')
  let m
  while ((m = rx.exec(src)) !== null) {
    if (m[0] === '') {
      rx.lastIndex += 1
      continue
    }
    out.set(m[0], (out.get(m[0]) ?? 0) + 1)
  }
  return out
}

/**
 * 逐关键词数命中(纯函数)。返回的 `face` 说明扫描面是什么——
 * 「命中 0」只有连着扫描面一起报,才不是把"没找到"说成"不存在"(§0.3)。
 *
 * @param {string} text 二进制原文(latin1)
 * @param {string[]} needles 关键词清单
 */
export function countNeedles(text, needles) {
  const src = String(text ?? '')
  const list = Array.isArray(needles) ? needles : []
  const rows = []
  for (const n of list) {
    const needle = String(n ?? '')
    if (!needle) continue
    let count = 0
    let from = 0
    for (;;) {
      const i = src.indexOf(needle, from)
      if (i === -1) break
      count += 1
      from = i + needle.length
    }
    rows.push({ needle, count })
  }
  return { face: `latin1 原文 ${src.length} 字节内逐字节 indexOf`, rows }
}

/** 解析命令行(纯函数,离线可测) */
export function parseArgs(argv) {
  const opts = { files: [], needles: [], json: false, selfTest: false, min: 6, help: false }
  const arr = Array.isArray(argv) ? argv : []
  for (let i = 0; i < arr.length; i += 1) {
    const a = String(arr[i])
    if (a === '--needle') {
      // 支持 --needle a --needle b 与 --needle a,b 两种给法
      const v = String(arr[i + 1] ?? '')
      if (v) opts.needles.push(...v.split(',').filter(Boolean))
      i += 1
    } else if (a.startsWith('--needle=')) {
      opts.needles.push(...a.slice('--needle='.length).split(',').filter(Boolean))
    } else if (a === '--json') opts.json = true
    else if (a === '--self-test') opts.selfTest = true
    else if (a === '--min') {
      opts.min = Number(arr[i + 1] ?? 6)
      i += 1
    } else if (a === '--help' || a === '-h') opts.help = true
    else if (!a.startsWith('-')) opts.files.push(a)
  }
  if (!Number.isFinite(opts.min) || opts.min < 1) opts.min = 6
  return opts
}

const HELP = `用法:
  node scripts/inspect-binary-api-paths.mjs <文件> [--needle 关键词]... [--json] [--min 6]
      从二进制/打包产物里抽服务端路径族,并对每个关键词报命中数与扫描面
  node scripts/inspect-binary-api-paths.mjs --self-test

说明:命中 0 一定连着扫描面一起报 —— 「没找到」不等于「不存在」(§0.3)。
退出码:0 正常 / 2 用法或输入取不到(未判定)。
`

/** 器物自证:已知构造 ⇒ 已知读数 */
export function selfTest() {
  const cases = []
  const ok = (name, cond, got) => cases.push({ name, pass: !!cond, got })

  const sample =
    'x/activity/growth/tasks/accept_y /v2/billing/meter/daily-checkin\0 obj.get("key") /events/follow-guide/'
  const found = [...extractPathStrings(sample).keys()]
  ok('① 抽到 growth 路径', found.includes('/activity/growth/tasks/accept_y'), found.join('|'))
  ok('① 抽到 v2 路径', found.includes('/v2/billing/meter/daily-checkin'), found.join('|'))
  ok('① 非路径的 get("key") 不进集', !found.some((s) => s.includes('key')), found.join('|'))

  // 反向牙:短于下限的串不该被当路径捞出来
  const short = [...extractPathStrings('/a/b', DEFAULT_RE).keys()]
  ok('② 过短串不立判据', short.length === 0, JSON.stringify(short))

  const n = countNeedles('aaaba', ['a', 'b', 'zz'])
  const byName = Object.fromEntries(n.rows.map((r) => [r.needle, r.count]))
  ok('③ 命中数逐个数', byName.a === 4 && byName.b === 1, JSON.stringify(byName))
  ok('③ 零命中仍回报该键', byName.zz === 0, JSON.stringify(byName))
  ok('③ 扫描面必须随读数一起出', typeof n.face === 'string' && n.face.includes('字节'), n.face)

  // 空输入 ⇒ 路径族空集,但每个 needle 仍要回报(0 也要报,不静默丢键)
  const emptyN = countNeedles('', ['x'])
  ok(
    '④ 空原文 ⇒ 路径族空集且 needle 仍回报 0',
    extractPathStrings('').size === 0 && emptyN.rows.length === 1 && emptyN.rows[0].count === 0,
    JSON.stringify(emptyN.rows),
  )

  let bad = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}  读数=${String(c.got).slice(0, 90)}`)
    if (!c.pass) bad += 1
  }
  console.log(`自证 ${cases.length - bad}/${cases.length} 通过`)
  return bad ? 1 : 0
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.selfTest) return selfTest()
  if (opts.help || !opts.files.length) {
    console.log(HELP)
    return opts.help ? 0 : 2
  }
  const results = []
  for (const f of opts.files) {
    if (!fs.existsSync(f)) {
      console.error(`取不到文件:${f}(未判定)`)
      continue
    }
    const buf = fs.readFileSync(f)
    const text = buf.toString('latin1')
    const paths = [...extractPathStrings(text).keys()].sort()
    const needles = countNeedles(text, opts.needles)
    results.push({
      file: path.basename(f),
      bytes: buf.length,
      pathCount: paths.length,
      paths,
      needles,
    })
    if (!opts.json) {
      console.log(`\n===== ${path.basename(f)}  bytes=${buf.length} 路径族=${paths.length} =====`)
      for (const p of paths) console.log(`  ${p}`)
      console.log(`扫描面:${needles.face}`)
      for (const r of needles.rows) console.log(`  ${r.needle} ⇒ 命中 ${r.count}`)
      if (!needles.rows.length) console.log('  (未给 --needle ⇒ 不做命中判定,只报路径族)')
    }
  }
  if (!results.length) {
    console.error('一个文件都取不到 ⇒ 未判定(既不记绿也不冒红)')
    return 2
  }
  if (opts.json) console.log(JSON.stringify({ results }, null, 2))
  return 0
}

if (isDirectRun(import.meta.url, process.argv[1])) {
  process.exitCode = await main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
