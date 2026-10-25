// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cost-breaker — 成本熔断器(O65 P0 · O6502,2026-10-25 立)。
 *
 * 部署环 / 调度层共用一把尺子量三类账:部署次数、部署机上墙钟分钟、起会话次数。
 * 判据 = 滚动窗口(近 60 分钟 / 近 24 小时)内累计量是否越过 caps;越过 ⇒ exit 3「停转」。
 *
 * 纪律:
 *  - 「停转」是软停机(exit 3):调用方停的是本轮动作并留响声,**不是**把整个环判成故障;
 *    配置读不到 / 形状坏 ⇒ exit 2「未判定」,不回落默认放行(§0.3)。
 *  - 台账是 append-only JSONL,只加不改;窗口按时间戳现算,不依赖日历日切分。
 *  - 记账失败不得吞:--charge 写不进去就 exit 2,宁可让调用方少跑一轮也不虚构额度。
 *
 * 用法:
 *   node scripts/cost-breaker.mjs --check --kind deploy      # 0 放行 / 3 停转 / 2 未判定
 *   node scripts/cost-breaker.mjs --charge --kind deploy --minutes 3 --note "deploy-loop run"
 *   node scripts/cost-breaker.mjs --status [--json]
 *   node scripts/cost-breaker.mjs --self-test
 */
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const CAPS_PATH = join(ROOT, 'scripts', 'data', 'cost-caps.json')
export const LEDGER_PATH = join(ROOT, '.ihui-agent', 'state', 'cost-ledger.jsonl')

export const EXIT_ALLOW = 0
export const EXIT_UNKNOWN = 2
export const EXIT_DENY = 3
const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS
const CAP_KEYS = ['perHour', 'perDay', 'minutesPerDay']

/** 配置形状锁:每个 kind 至少一条 cap,数值必须是正数;坏形状抛。 */
export function loadCaps(rawText) {
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`成本上限配置不是合法 JSON:${e?.message ?? e}`)
  }
  const kinds = doc?.kinds
  if (!kinds || typeof kinds !== 'object' || Array.isArray(kinds))
    throw new Error('成本上限配置缺 kinds 对象')
  const ids = Object.keys(kinds)
  if (ids.length === 0) throw new Error('成本上限 kinds 不能为空')
  for (const id of ids) {
    const k = kinds[id]
    if (!k || typeof k !== 'object') throw new Error(`kinds.${id} 不是对象`)
    const keys = Object.keys(k).filter((x) => CAP_KEYS.includes(x))
    if (keys.length === 0) throw new Error(`kinds.${id} 缺任一上限(可用:${CAP_KEYS.join('/')})`)
    for (const key of keys) {
      if (!Number.isFinite(k[key]) || k[key] <= 0) throw new Error(`kinds.${id}.${key} 必须是正数`)
    }
  }
  return doc
}

/** 台账行解析:坏行跳过(不是判过,只是不进统计);返回 { ts:number, kind, minutes }[]。 */
export function parseLedger(rawText) {
  const out = []
  for (const line of String(rawText ?? '').split('\n')) {
    if (!line.trim()) continue
    let e
    try {
      e = JSON.parse(line)
    } catch {
      continue
    }
    const ts = Date.parse(e?.ts)
    if (!Number.isFinite(ts)) continue
    if (typeof e.kind !== 'string') continue
    const minutes = Number.isFinite(e.minutes) ? e.minutes : 0
    out.push({ ts, kind: e.kind, minutes, note: typeof e.note === 'string' ? e.note : '' })
  }
  return out
}

/**
 * 滚动窗口汇总 + 判定。返回 { allowed, kind, used:{hour,day,minutesDay}, caps, breaches:[...] }。
 * 未知 kind ⇒ 抛(E6502 的闭集:没配的类别不许用)。
 */
export function evaluate({ caps, events, kind, now = Date.now() }) {
  const k = caps.kinds?.[kind]
  if (!k)
    throw new Error(`未配置的成本类别:${kind}(现有:${Object.keys(caps.kinds ?? {}).join('/')})`)
  let hour = 0
  let day = 0
  let minutesDay = 0
  for (const e of events) {
    if (e.kind !== kind) continue
    const age = now - e.ts
    if (age < 0) continue
    if (age < HOUR_MS) hour += 1
    if (age < DAY_MS) {
      day += 1
      minutesDay += e.minutes ?? 0
    }
  }
  const breaches = []
  if (Number.isFinite(k.perHour) && hour >= k.perHour)
    breaches.push(`近 60 分钟 ${hour} 次 ≥ 上限 ${k.perHour}`)
  if (Number.isFinite(k.perDay) && day >= k.perDay)
    breaches.push(`近 24 小时 ${day} 次 ≥ 上限 ${k.perDay}`)
  if (Number.isFinite(k.minutesPerDay) && minutesDay >= k.minutesPerDay) {
    breaches.push(`近 24 小时 ${minutesDay.toFixed(1)} 分钟 ≥ 上限 ${k.minutesPerDay}`)
  }
  return {
    allowed: breaches.length === 0,
    kind,
    used: { hour, day, minutesDay },
    caps: k,
    breaches,
  }
}

export function chargeLine({ kind, minutes = 0, note = '', now = Date.now() }) {
  if (typeof kind !== 'string' || !kind.trim()) throw new Error('--kind 必填')
  if (!Number.isFinite(minutes) || minutes < 0) throw new Error('--minutes 必须是非负数')
  return `${JSON.stringify({ ts: new Date(now).toISOString(), kind: kind.trim(), minutes, note: String(note).slice(0, 200) })}\n`
}

export function exitCodeOf(res) {
  return res.allowed ? EXIT_ALLOW : EXIT_DENY
}

function selfTest() {
  const assert = (c, m) => {
    if (!c) throw new Error(`self-test 失败:${m}`)
  }
  const caps = loadCaps(
    JSON.stringify({
      kinds: { deploy: { perHour: 2, perDay: 5, minutesPerDay: 30 }, session: { perHour: 1 } },
    }),
  )
  const now = Date.parse('2026-10-25T12:00:00.000Z')
  const mk = (minAgo, kind = 'deploy', minutes = 5) => ({
    ts: now - minAgo * 60_000,
    kind,
    minutes,
    note: '',
  })
  let r = evaluate({ caps, events: [mk(10), mk(120)], kind: 'deploy', now })
  assert(
    r.used.hour === 1 && r.used.day === 2,
    '窗口切分:10 分钟前进小时/24 小时,120 分钟前只进 24 小时',
  )
  assert(r.allowed, '未越限应放行')
  r = evaluate({ caps, events: [mk(1), mk(2)], kind: 'deploy', now })
  assert(!r.allowed && /60 分钟/.test(r.breaches[0]), '小时上限应触发')
  r = evaluate({ caps, events: [mk(1, 'session')], kind: 'deploy', now })
  assert(r.allowed && r.used.day === 0, '别的类别不串账')
  r = evaluate({ caps, events: [mk(1, 'deploy', 20), mk(2, 'deploy', 15)], kind: 'deploy', now })
  assert(!r.allowed && r.breaches.some((b) => /分钟/.test(b)), '墙钟分钟上限应触发')
  const parsed = parseLedger(
    ['{"ts":"2026-10-25T11:00:00Z","kind":"deploy","minutes":3}', 'not-json', '{"kind":"x"}'].join(
      '\n',
    ),
  )
  assert(parsed.length === 1 && parsed[0].minutes === 3, '坏行跳过、好行保留')
  let threw = false
  try {
    evaluate({ caps, events: [], kind: 'nope', now })
  } catch {
    threw = true
  }
  assert(threw, '未知类别必须抛而不是当成 0 次放行')
  threw = false
  try {
    loadCaps('{"kinds":{}}')
  } catch {
    threw = true
  }
  assert(threw, '空 kinds 判错')
  assert(
    exitCodeOf({ allowed: true }) === 0 && exitCodeOf({ allowed: false }) === 3,
    '退出码:放行 0 / 停转 3',
  )
  console.log('self-test: 全绿(9 组断言)')
}

function main(argv) {
  const has = (f) => argv.includes(f)
  const val = (f, d = null) => {
    const i = argv.indexOf(f)
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d
  }
  if (has('--self-test')) return selfTest()
  const capsPath = val('--caps', CAPS_PATH)
  const ledgerPath = val('--ledger', LEDGER_PATH)
  let caps
  try {
    caps = loadCaps(readFileSync(capsPath, 'utf8'))
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  const events = existsSync(ledgerPath) ? parseLedger(readFileSync(ledgerPath, 'utf8')) : []
  if (has('--charge')) {
    try {
      const line = chargeLine({
        kind: val('--kind', ''),
        minutes: Number(val('--minutes', '0')),
        note: val('--note', ''),
      })
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendFileSync(ledgerPath, line, 'utf8')
      console.log(`✅ 已记账:${line.trim()}`)
    } catch (e) {
      console.error(`❌ 记账失败:${e.message}`)
      process.exitCode = EXIT_UNKNOWN
    }
    return
  }
  const kind = val('--kind', '')
  if (has('--check')) {
    let res
    try {
      res = evaluate({ caps, events, kind })
    } catch (e) {
      console.error(`❌ 未判定:${e.message}`)
      process.exitCode = EXIT_UNKNOWN
      return
    }
    if (has('--json')) console.log(JSON.stringify(res, null, 2))
    else {
      const u = res.used
      console.log(
        `cost-breaker(${res.kind}):近1h ${u.hour}/${res.caps.perHour ?? '-'} 次,近24h ${u.day}/${res.caps.perDay ?? '-'} 次,墙钟 ${u.minutesDay.toFixed(1)}/${res.caps.minutesPerDay ?? '-'} 分钟 ⇒ ${res.allowed ? '放行' : '停转'}`,
      )
      for (const b of res.breaches) console.error(`⛔ ${b}`)
    }
    process.exitCode = exitCodeOf(res)
    return
  }
  // --status:逐类别打印
  const rows = []
  for (const id of Object.keys(caps.kinds)) {
    try {
      rows.push(evaluate({ caps, events, kind: id }))
    } catch {
      /* 形状锁已在 loadCaps 拦过 */
    }
  }
  if (has('--json')) console.log(JSON.stringify(rows, null, 2))
  else
    for (const r of rows)
      console.log(
        `${r.allowed ? '✅' : '⛔'} ${r.kind}: 1h=${r.used.hour} 24h=${r.used.day} min24h=${r.used.minutesDay.toFixed(1)} caps=${JSON.stringify(r.caps)}`,
      )
}

export const __test__ = { loadCaps, parseLedger, evaluate, chargeLine, exitCodeOf }

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
