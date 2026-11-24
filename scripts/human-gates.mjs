// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * human-gates — 人工阀清单(O65 P0 · O6504,2026-10-25 立)。
 *
 * 把"AI 能自决"与"必须停机等人"写成机读闭集。判据不是"失败",是**安全停机**:
 * 命中人工阀 ⇒ exit 2(STOP),调用方留响声并停在这里,不重试、不绕行、不冒充失败。
 *
 * 三档退出码:
 *   0 = 自决面(可以干)
 *   2 = 人工阀(停机等人;附 gate id 与"为什么停下")
 *   1 = 未判定(action 不在闭集里 / 配置坏了 ⇒ 不猜、不放行)
 *
 * 用法:
 *   node scripts/human-gates.mjs --check --action api-key-change
 *   node scripts/human-gates.mjs --list [--json]
 *   node scripts/human-gates.mjs --status
 *   node scripts/human-gates.mjs --self-test
 */
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const GATES_PATH = join(ROOT, 'scripts', 'data', 'human-gates.json')

export const EXIT_AUTONOMOUS = 0
export const EXIT_UNKNOWN = 1
export const EXIT_STOP = 2

/** 形状锁:autonomous 与 gates 必须是非空、id 唯一的对象数组;坏形状抛。 */
export function loadHumanGates(rawText) {
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`人工阀清单不是合法 JSON:${e?.message ?? e}`)
  }
  const ok = (arr, name) => {
    if (!Array.isArray(arr) || arr.length === 0)
      throw new Error(`人工阀清单 ${name} 必须是非空数组`)
    for (const it of arr) {
      if (!it || typeof it.id !== 'string' || !it.id.trim())
        throw new Error(`${name} 出现缺 id 的项`)
      if (typeof it.title !== 'string' || !it.title.trim())
        throw new Error(`${name}.${it.id} 缺 title`)
    }
    const ids = arr.map((x) => x.id)
    if (new Set(ids).size !== ids.length) throw new Error(`${name} 出现重复 id`)
  }
  ok(doc?.autonomous, 'autonomous')
  ok(doc?.gates, 'gates')
  const dup = doc.autonomous.filter((a) => doc.gates.some((g) => g.id === a.id))
  if (dup.length) throw new Error(`同一 action 同时出现在两档:${dup.map((x) => x.id).join('/')}`)
  for (const g of doc.gates) {
    if (g.stop !== undefined && g.stop !== 'notify-human')
      throw new Error(`gates.${g.id}.stop 只允许 notify-human(安全停机语义唯一)`)
  }
  return doc
}

/**
 * 判定。未知 action ⇒ 'unknown'(不猜成自决面,也不猜成人工阀)。
 * 返回 { verdict:'autonomous'|'stop'|'unknown', entry }。
 */
export function classify(doc, action) {
  const a = String(action ?? '').trim()
  if (!a) return { verdict: 'unknown', entry: null, why: 'action 为空' }
  const g = doc.gates.find((x) => x.id === a)
  if (g) return { verdict: 'stop', entry: g, why: g.title }
  const au = doc.autonomous.find((x) => x.id === a)
  if (au) return { verdict: 'autonomous', entry: au, why: au.title }
  return { verdict: 'unknown', entry: null, why: `action 不在闭集(${a})` }
}

export function exitCodeOf(verdict) {
  return verdict === 'autonomous' ? EXIT_AUTONOMOUS : verdict === 'stop' ? EXIT_STOP : EXIT_UNKNOWN
}

/** 供调度层读取的最小摘要(不读盘、只接 doc);形状坏由 loadHumanGates 负责。 */
export function summarize(doc) {
  return {
    autonomous: doc.autonomous.map((x) => x.id),
    gates: doc.gates.map((x) => ({ id: x.id, title: x.title })),
    counts: { autonomous: doc.autonomous.length, gates: doc.gates.length },
  }
}

function selfTest() {
  const assert = (c, m) => {
    if (!c) throw new Error(`self-test 失败:${m}`)
  }
  const doc = loadHumanGates(
    JSON.stringify({
      autonomous: [{ id: 'code-change', title: '改代码' }],
      gates: [{ id: 'api-key-change', title: '换密钥', stop: 'notify-human' }],
    }),
  )
  assert(classify(doc, 'code-change').verdict === 'autonomous', '自决面判定')
  assert(classify(doc, 'api-key-change').verdict === 'stop', '人工阀判定')
  assert(classify(doc, 'whatever').verdict === 'unknown', '未知 action 必须 unknown')
  assert(classify(doc, '').verdict === 'unknown', '空 action 必须 unknown')
  assert(
    exitCodeOf('autonomous') === 0 && exitCodeOf('stop') === 2 && exitCodeOf('unknown') === 1,
    '退出码映射',
  )
  const bad = [
    '{}',
    JSON.stringify({ autonomous: [], gates: [] }),
    JSON.stringify({ autonomous: [{ id: 'x', title: 't' }], gates: [{ id: 'x', title: 't' }] }),
    JSON.stringify({
      autonomous: [{ id: 'x', title: 't' }],
      gates: [{ id: 'y', title: 't', stop: 'hard-fail' }],
    }),
  ]
  for (const b of bad) {
    let threw = false
    try {
      loadHumanGates(b)
    } catch {
      threw = true
    }
    assert(threw, `坏形状应抛:${b}`)
  }
  assert(summarize(doc).counts.gates === 1, 'summarize 计数')
  console.log('self-test: 全绿(12 组断言)')
}

function main(argv) {
  const has = (f) => argv.includes(f)
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  }
  if (has('--self-test')) return selfTest()
  let doc
  try {
    doc = loadHumanGates(readFileSync(GATES_PATH, 'utf8'))
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  if (has('--list')) {
    if (has('--json')) console.log(JSON.stringify(summarize(doc), null, 2))
    else {
      console.log(`自决面(${doc.autonomous.length}):`)
      for (const a of doc.autonomous) console.log(`  ✅ ${a.id}  ${a.title}`)
      console.log(`人工阀(${doc.gates.length})——命中即安全停机等人:`)
      for (const g of doc.gates) console.log(`  ⏸ ${g.id}  ${g.title}`)
    }
    return
  }
  if (has('--status')) {
    const s = summarize(doc)
    console.log(`human-gates: 自决 ${s.counts.autonomous} 条 / 人工阀 ${s.counts.gates} 条`)
    return
  }
  if (has('--check')) {
    const action = val('--action', '')
    const res = classify(doc, action)
    if (has('--json')) console.log(JSON.stringify(res, null, 2))
    else if (res.verdict === 'stop') {
      console.error(
        `⏸ 人工阀 ${action}:${res.entry.title}${res.entry.why ? ` —— ${res.entry.why}` : ''} ⇒ 安全停机,等人处置(不重试、不绕行)`,
      )
    } else if (res.verdict === 'unknown') {
      console.error(`❌ 未判定:${res.why} ⇒ 停在原地,不放行也不冒充人工阀`)
    } else {
      console.log(`✅ 自决面 ${action}:${res.entry.title}`)
    }
    process.exitCode = exitCodeOf(res.verdict)
    return
  }
  console.error('用法:--check --action <id> | --list | --status | --self-test')
  process.exitCode = EXIT_UNKNOWN
}

export const __test__ = { loadHumanGates, classify, exitCodeOf, summarize }

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
