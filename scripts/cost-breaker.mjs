// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * cost-breaker — 成本熔断器(O65 P0 · O6502,2026-10-25 立)。
 *
 * 部署环 / 调度层共用一把尺子量账:部署次数、部署机上墙钟分钟、起会话次数,
 * 自第 3 期④起加 token 双闸(单会话 token 上限 + 近 24 小时累计 token 上限)。
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
 *   node scripts/cost-breaker.mjs --charge --kind deploy --minutes 15 --outcome fail --note "rc=1"
 *   node scripts/cost-breaker.mjs --charge --kind session --minutes 2.5 --tokens 812345
 *   node scripts/cost-breaker.mjs --status [--json]
 *   node scripts/cost-breaker.mjs --self-test
 *
 * 记账口径(2026-11-01 立,与配额是两件事):`--charge` 收 `--outcome ok|fail|unknown`。
 * 失败轮(本轮没产出可用构建)的墙钟按 kinds.<kind>.failChargeCapMinutes 封顶进账,实墙钟逐字
 * 留在 minutesWall、口径记在 outcome/chargeCapped;成功轮与未给 --outcome 的旧调用方保持旧口径。
 * perDay / perHour / minutesPerDay 这些**数值一个字没改** —— 连败照样撞次数闸,红了有得整改(§5e-1)。
 */
import { readFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs'
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
const CAP_KEYS = [
  'perHour',
  'perDay',
  'minutesPerDay',
  'tokensPerHour',
  'tokensPerDay',
  'tokensPerSession',
]
/**
 * 失败轮记账封顶(2026-11-01 立,不是配额):一轮没产出可用构建的部署仍然吃墙钟,
 * 但**不该按整轮墙钟全额记账** —— 实测 2026-11-01:近 24h 38 条账里 rc=1 占 31 次 / 472 分钟(76%),
 * 熔断读到的「墙钟 621.3/480」几乎全是失败轮,一次编译错误就把生产发布黑成一整天。
 * 这一档只改**失败轮怎么记**,不动 perDay / minutesPerDay 那两条配额(上调额度归机主侧人工阀)。
 * 形状锁见 loadCaps:必须 < minutesPerDay(否则等于没封顶,借"记账口径"把额度悄悄翻倍)。
 */
const FAILURE_CAP_KEY = 'failChargeCapMinutes'
export const CHARGE_OUTCOMES = ['ok', 'fail', 'unknown']

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
    // 失败轮记账封顶的形状锁(见 FAILURE_CAP_KEY 头注):坏值/越界一律抛,不静默当"没配"。
    if (FAILURE_CAP_KEY in k) {
      const cap = k[FAILURE_CAP_KEY]
      if (!Number.isFinite(cap) || cap <= 0)
        throw new Error(`kinds.${id}.${FAILURE_CAP_KEY} 必须是正数(失败轮封顶分钟)`)
      if (Number.isFinite(k.minutesPerDay) && cap >= k.minutesPerDay)
        throw new Error(
          `kinds.${id}.${FAILURE_CAP_KEY}(${cap}) 必须 < minutesPerDay(${k.minutesPerDay}) —— 封顶不小于日额等于借"记账口径"把额度悄悄上调,配额是人工阀,不归本器`,
        )
    }
  }
  return doc
}

/** 该类别的失败轮记账封顶;没配 ⇒ null(旧口径:失败轮也按整轮墙钟全额记账)。 */
export function failureChargeCap(caps, kind) {
  const k = caps?.kinds?.[kind]
  if (!k) throw new Error(`未配置的成本类别:${kind}`)
  const cap = k[FAILURE_CAP_KEY]
  return Number.isFinite(cap) && cap > 0 ? cap : null
}

/** 台账行解析:坏行跳过(不是判过,只是不进统计);返回 { ts:number, kind, minutes, tokens }[]。 */
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
    // 缺 tokens 字段(升级前的旧行 / 量不到 token 的轮)= 0,不冒充量到;
    // 计量覆盖与否由调用方在 auto-evolve 台账里单记 tokensMeasured。
    const tokens = Number.isFinite(e.tokens) && e.tokens > 0 ? e.tokens : 0
    out.push({
      ts,
      kind: e.kind,
      minutes,
      tokens,
      note: typeof e.note === 'string' ? e.note : '',
      // 记账口径(2026-11-01 立):旧行没有这个字段 ⇒ 'unknown',不冒充"成功轮"也不冒充"失败轮"。
      outcome: typeof e.outcome === 'string' && CHARGE_OUTCOMES.includes(e.outcome) ? e.outcome : 'unknown',
    })
  }
  return out
}

/**
 * 滚动窗口汇总 + 判定。返回 { allowed, kind, used:{hour,day,minutesDay,tokensHour,tokensDay,maxTokens}, caps, breaches:[...] }。
 * 未知 kind ⇒ 抛(E6502 的闭集:没配的类别不许用)。
 */
export function evaluate({ caps, events, kind, now = Date.now() }) {
  const k = caps.kinds?.[kind]
  if (!k)
    throw new Error(`未配置的成本类别:${kind}(现有:${Object.keys(caps.kinds ?? {}).join('/')})`)
  let hour = 0
  let day = 0
  let minutesDay = 0
  let tokensHour = 0
  let tokensDay = 0
  let maxTokens = 0
  let failDay = 0
  for (const e of events) {
    if (e.kind !== kind) continue
    const age = now - e.ts
    if (age < 0) continue
    if (age < HOUR_MS) {
      hour += 1
      tokensHour += e.tokens ?? 0
    }
    if (age < DAY_MS) {
      day += 1
      minutesDay += e.minutes ?? 0
      tokensDay += e.tokens ?? 0
      if (e.outcome === 'fail') failDay += 1
      maxTokens = Math.max(maxTokens, e.tokens ?? 0)
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
  // token 双闸:单会话闸判「任何一轮自己就越线」(含本轮),日闸判 24 小时累计。
  if (Number.isFinite(k.tokensPerSession) && maxTokens >= k.tokensPerSession) {
    breaches.push(`单会话 ${maxTokens} tokens ≥ 上限 ${k.tokensPerSession}`)
  }
  if (Number.isFinite(k.tokensPerHour) && tokensHour >= k.tokensPerHour) {
    breaches.push(`近 60 分钟 ${tokensHour} tokens ≥ 上限 ${k.tokensPerHour}`)
  }
  if (Number.isFinite(k.tokensPerDay) && tokensDay >= k.tokensPerDay) {
    breaches.push(`近 24 小时 ${tokensDay} tokens ≥ 上限 ${k.tokensPerDay}`)
  }
  return {
    allowed: breaches.length === 0,
    kind,
    used: { hour, day, minutesDay, tokensHour, tokensDay, maxTokens, failDay },
    caps: k,
    breaches,
  }
}

export function chargeLine({
  kind,
  minutes = 0,
  tokens,
  note = '',
  now = Date.now(),
  outcome = 'unknown',
  failureCapMinutes = null,
}) {
  if (typeof kind !== 'string' || !kind.trim()) throw new Error('--kind 必填')
  if (!Number.isFinite(minutes) || minutes < 0) throw new Error('--minutes 必须是非负数')
  if (!CHARGE_OUTCOMES.includes(outcome))
    throw new Error(`--outcome 非法:「${outcome}」(闭集:${CHARGE_OUTCOMES.join('/')})`)
  if (failureCapMinutes !== null && (!Number.isFinite(failureCapMinutes) || failureCapMinutes <= 0))
    throw new Error('失败轮封顶分钟必须是正数或 null')
  // tokens 可缺省:缺省 = 本轮没量到(旧调用方 / 计时轮),不写 0 冒充量到。
  if (tokens !== undefined && (!Number.isFinite(tokens) || tokens < 0))
    throw new Error('--tokens 必须是非负数')
  // 失败轮的墙钟按封顶记账(2026-11-01 立):实墙钟仍然逐字留在 minutesWall 里 ——
  // 诚实记账 ≠ 少记,是把"没产出可用构建的那段时间"不再按整轮全额吃配额。
  const charged =
    outcome === 'fail' && failureCapMinutes !== null && minutes > failureCapMinutes
      ? failureCapMinutes
      : minutes
  const row = {
    ts: new Date(now).toISOString(),
    kind: kind.trim(),
    minutes: charged,
    outcome,
    note: String(note).slice(0, 200),
  }
  if (charged !== minutes) {
    row.minutesWall = minutes
    row.chargeCapped = FAILURE_CAP_KEY
  }
  if (tokens !== undefined) row.tokens = Math.floor(tokens)
  return `${JSON.stringify(row)}\n`
}

export function exitCodeOf(res) {
  return res.allowed ? EXIT_ALLOW : EXIT_DENY
}

function selfTest() {
  let assertionCount = 0
  const assert = (c, m) => {
    assertionCount += 1
    if (!c) throw new Error(`self-test 失败:${m}`)
  }
  const caps = loadCaps(
    JSON.stringify({
      kinds: { deploy: { perHour: 2, perDay: 5, minutesPerDay: 30 }, session: { perHour: 1 } },
    }),
  )
  const now = Date.parse('2026-10-25T12:00:00.000Z')
  const mk = (minAgo, kind = 'deploy', minutes = 5, tokens = 0) => ({
    ts: now - minAgo * 60_000,
    kind,
    minutes,
    tokens,
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
  // token 双闸(第 3 期④):单会话闸按「单条越线」判,日闸按 24 小时累计,小时窗只算近 60 分钟
  const tokCaps = loadCaps(
    JSON.stringify({ kinds: { session: { tokensPerSession: 1000, tokensPerDay: 2500 } } }),
  )
  r = evaluate({ caps: tokCaps, events: [mk(1, 'session', 1, 1500)], kind: 'session', now })
  assert(!r.allowed && r.breaches.some((b) => /单会话/.test(b)), '单会话 token 上限应触发')
  r = evaluate({
    caps: tokCaps,
    events: [mk(5, 'session', 1, 900), mk(60, 'session', 1, 900), mk(90, 'session', 1, 800)],
    kind: 'session',
    now,
  })
  assert(
    !r.allowed &&
      r.breaches.some((b) => /24 小时.*tokens/.test(b)) &&
      r.used.tokensHour === 900 &&
      r.used.tokensDay === 2600,
    '日 token 上限应触发,且小时窗只累计近 60 分钟',
  )
  const parsed = parseLedger(
    ['{"ts":"2026-10-25T11:00:00Z","kind":"deploy","minutes":3}', 'not-json', '{"kind":"x"}'].join(
      '\n',
    ),
  )
  assert(parsed.length === 1 && parsed[0].minutes === 3, '坏行跳过、好行保留')
  const charged = JSON.parse(chargeLine({ kind: 'session', minutes: 1, tokens: 1234.7, now }))
  assert(charged.tokens === 1234, '带 token 记账落整数 tokens')
  const notMeasured = JSON.parse(chargeLine({ kind: 'session', minutes: 1, now }))
  assert(!('tokens' in notMeasured), '没量到 token 的轮不得写 0 冒充量到')
  // ── 失败轮记账口径(2026-11-01 立;新旧行为差异必须被下面这几条钉住)──────────
  // 旧口径:失败轮按整轮墙钟全额记账 ⇒ 实测近 24h 31 枚 rc=1 吃掉 472 分钟,熔断把发布黑一整天。
  // 新口径:失败轮按封顶记账,实墙钟逐字留在 minutesWall(诚实),成功轮完全不变,未给 outcome 一律旧口径。
  const capFail = JSON.parse(
    chargeLine({ kind: 'deploy', minutes: 15.2, note: 'rc=1', now, outcome: 'fail', failureCapMinutes: 5 }),
  )
  assert(capFail.minutes === 5, `失败轮必须按封顶记账(实得 ${capFail.minutes})`)
  assert(capFail.minutesWall === 15.2, '实墙钟必须留在账上(封顶 ≠ 免单,更不是谎报耗时)')
  assert(capFail.outcome === 'fail' && capFail.chargeCapped, '口径必须可追溯(读侧能认出这是封顶点)')
  const capOk = JSON.parse(
    chargeLine({ kind: 'deploy', minutes: 15.2, note: 'rc=0', now, outcome: 'ok', failureCapMinutes: 5 }),
  )
  assert(capOk.minutes === 15.2 && !('chargeCapped' in capOk), '成功轮口径一个字不许动(否则把真实耗时洗掉)')
  const capLegacy = JSON.parse(chargeLine({ kind: 'deploy', minutes: 15.2, note: '旧调用方', now }))
  assert(
    capLegacy.minutes === 15.2 && capLegacy.outcome === 'unknown',
    '没给 --outcome 的旧调用方 ⇒ 原样全额记账(静默改语义 = 把额度悄悄上调,配额是人工阀)',
  )
  const capNoCfg = JSON.parse(
    chargeLine({ kind: 'deploy', minutes: 15.2, now, outcome: 'fail', failureCapMinutes: null }),
  )
  assert(capNoCfg.minutes === 15.2, '该类没配封顶 ⇒ 保持旧口径(不得凭空造一个数)')
  let capThrew = false
  try {
    chargeLine({ kind: 'deploy', minutes: 1, now, outcome: 'boom' })
  } catch {
    capThrew = true
  }
  assert(capThrew, '非法 --outcome 必须抛(记账器不替调用方猜这一轮成没成)')
  assert(failureChargeCap(caps, 'deploy') === null, '未配置该键 ⇒ null(旧口径,不是 0)')
  const capped = loadCaps(
    JSON.stringify({ kinds: { deploy: { perDay: 5, minutesPerDay: 30, failChargeCapMinutes: 5 } } }),
  )
  assert(failureChargeCap(capped, 'deploy') === 5, '配置了封顶就要读得出封顶')
  let escThrew = false
  try {
    loadCaps(
      JSON.stringify({ kinds: { deploy: { perDay: 5, minutesPerDay: 30, failChargeCapMinutes: 30 } } }),
    )
  } catch {
    escThrew = true
  }
  assert(escThrew, '封顶 ≥ minutesPerDay 等于借"记账口径"把日额翻倍 ⇒ 必须抛(配额是人工阀)')
  const rFail = evaluate({
    caps: capped,
    events: [
      { ...mk(10, 'deploy', 5), outcome: 'fail' },
      { ...mk(20, 'deploy', 5), outcome: 'ok' },
    ],
    kind: 'deploy',
    now,
  })
  assert(rFail.used.failDay === 1 && rFail.used.minutesDay === 10, '失败轮要数得出来(可整改性判据的输入)')
  let legacyOutcome = false
  try {
    const parsedLegacy = parseLedger('{"ts":"2026-11-01T11:00:00Z","kind":"deploy","minutes":3}')
    legacyOutcome = parsedLegacy.length === 1 && parsedLegacy[0].outcome === 'unknown'
  } catch {
    legacyOutcome = false
  }
  assert(legacyOutcome, '升级前的旧账行必须读成 unknown(既不冒充成功也不冒充失败)')
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
  console.log(`self-test: 全绿(${assertionCount} 组断言)`)
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
      const tokensRaw = val('--tokens')
      const kindForCharge = val('--kind', '')
      const cap = failureChargeCap(caps, kindForCharge.trim())
      const line = chargeLine({
        kind: kindForCharge,
        minutes: Number(val('--minutes', '0')),
        tokens: tokensRaw === null ? undefined : Number(tokensRaw),
        note: val('--note', ''),
        outcome: val('--outcome', 'unknown'),
        failureCapMinutes: cap,
      })
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendFileSync(ledgerPath, line, 'utf8')
      const row = JSON.parse(line)
      console.log(`✅ 已记账:${line.trim()}`)
      if (row.chargeCapped)
        console.log(
          `   记账口径=失败轮封顶 ${row.minutes} 分钟(实墙钟 ${row.minutesWall} 分钟,封顶键 ${row.chargeCapped};封顶≠免单:次数与失败轮数照记,整改出口见 --check 那一行)`,
        )
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
        `cost-breaker(${res.kind}):近1h ${u.hour}/${res.caps.perHour ?? '-'} 次,近24h ${u.day}/${res.caps.perDay ?? '-'} 次,墙钟 ${u.minutesDay.toFixed(1)}/${res.caps.minutesPerDay ?? '-'} 分钟,失败轮 ${u.failDay} 次(按封顶记账,实墙钟逐条留在 minutesWall),tokens 近1h ${u.tokensHour}/${res.caps.tokensPerHour ?? '-'} 近24h ${u.tokensDay}/${res.caps.tokensPerDay ?? '-'} 单会话峰值 ${u.maxTokens}/${res.caps.tokensPerSession ?? '-'} ⇒ ${res.allowed ? '放行' : '停转'}`,
      )
      for (const b of res.breaches) console.error(`⛔ ${b}`)
      if (!res.allowed && u.failDay > 0)
        console.error(
          `   可整改方向:近 24 小时里有 ${u.failDay} 枚失败轮 —— 先修失败的那一段(构建/门禁/健康门禁),失败轮的次数与墙钟都还在账上,不是免单;上调 perDay/minutesPerDay 属机主侧人工阀,本器不动`,
        )
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
        `${r.allowed ? '✅' : '⛔'} ${r.kind}: 1h=${r.used.hour} 24h=${r.used.day} min24h=${r.used.minutesDay.toFixed(1)} tokens1h=${r.used.tokensHour} tokens24h=${r.used.tokensDay} tokensMax=${r.used.maxTokens} caps=${JSON.stringify(r.caps)}`,
      )
}

export const __test__ = {
  loadCaps,
  parseLedger,
  evaluate,
  chargeLine,
  exitCodeOf,
  failureChargeCap,
  CHARGE_OUTCOMES,
  FAILURE_CAP_KEY,
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main(process.argv.slice(2))
}
