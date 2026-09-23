#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SSE 帧"多解析器漏接"守门(2026-09-22 立,PROJECT_PLAN.md D106 / G-148 配套)
 *
 * 背景(实测,非推测):同一份 SSE 协议在库内被**两处独立解析** ——
 *   - packages/api-client/src/client.ts(routeLineByType + tryParse*,web / extension / mobile-rn 走这条)
 *   - packages/shared/src/utils/sse-parse.ts(miniapp-taro 走这条)
 * 每加一帧都要在两处各写一遍,再在每端的回调表里注册一次。历史上 `citations`、`steer`
 * 就是"api-client 有、另一处 0 命中"的状态被静默遗忘(实测四端 0 命中),
 * `injection_applied` / `retry_scheduled` 第 42 轮也只补了 api-client 一侧。
 * 本闸把"漏接"从**没人会发现的运行时静默**变成**提交时可见的清单**。
 *
 * 三类判定:
 *  ① 契约自洽:抽不到事件名 = 判据失效,**按失败处理**(不许"解析不出来就当全绿")。
 *  ② 解析覆盖(ratchet):sse-parse 侧覆盖的事件数 **不得低于 baseline**。只挡倒退不挡增长
 *     (否则未接的端一提交就恒红)。新覆盖一帧就把 baseline 上调。
 *  ③ 归属交代(machine-checkable):凡"api-client 已解析、sse-parse 未解析"的帧,必须出现在
 *     `scripts/data/sse-parser-coverage.json` 的 `webOnly` 清单里并写明**为什么只有 web 消费**。
 *     既不许凭空多出没登记的帧,也不许登记了却其实已接(该删的要删)。
 *
 * 刻意**不做**的一条:曾想加"代码里出现契约外事件名"判据,实测被否 ——
 * errorCode / 状态枚举(`content_policy_violation`、`output_ready`、`tool_call` 等)与事件名
 * 形状完全相同,按形状无法区分,拦到的全是误报。宁漏不误报。
 *
 * 用法:
 *   node scripts/check-sse-parser-parity.mjs [--json] [--self-test] [--report]
 *     --report 打印两端覆盖矩阵与待接清单(供逐端补齐时当工单用)
 * 紧急跳过:HUSKY_SKIP_SSE_PARSER_PARITY=1 git commit ...
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONTRACT_FILE = join(ROOT, 'packages', 'shared', 'src', 'sse', 'contract.ts')
const API_CLIENT_FILE = join(ROOT, 'packages', 'api-client', 'src', 'client.ts')
const SSE_PARSE_FILE = join(ROOT, 'packages', 'shared', 'src', 'utils', 'sse-parse.ts')
const DATA_FILE = join(ROOT, 'scripts', 'data', 'sse-parser-coverage.json')
const SKIP_ENV = 'HUSKY_SKIP_SSE_PARSER_PARITY'

/** 从 contract.ts 的 SSE_EVENTS 对象取事件名(值为字符串;含连字符与下划线两种写法) */
export function extractContractEvents(source) {
  const start = source.indexOf('export const SSE_EVENTS')
  if (start === -1) return []
  const block = source.slice(start, source.indexOf('\n}', start) === -1 ? undefined : source.indexOf('\n}', start) + 2)
  const names = new Set()
  const re = /:\s*'([a-z0-9_-]+)'/gu
  let m
  while ((m = re.exec(block)) !== null) names.add(m[1])
  return [...names].sort()
}

/**
 * 判定"这一帧被本解析器接了"= 源码里有**分支守卫**,而不是字符串出现过。
 * 只按"字面量出现"判定会被两处骗过:
 *   - 类型联合声明(`type:` 下一行 `| 'steer'`)——只声明了形状,没写解析分支;
 *   - 产出语句(`return { type: 'steer', … }`)——守卫被删掉/写错时产出语句还在,照样"覆盖"。
 * 故要求同一行内出现守卫形态之一:
 *   ① `type === 'x'` / `type !== 'x'`   —— 分支守卫
 *   ② `case 'x':`                        —— routeLineByType 分派表
 * 唯一例外是**按字段形态识别**的帧(见 FIELD_SHAPE_EVENTS):它们没有 type 字面量守卫,
 * 只以 `type: 'x'` 产出语句为凭。
 */
const GUARD_PATTERNS = [
  /type\s*[!=]==\s*'([a-z][a-z0-9_-]{2,})'/gu,
  /case\s+'([a-z][a-z0-9_-]{2,})'/gu,
]
const PRODUCE_PATTERN = /type:\s*'([a-z][a-z0-9_-]{2,})'/gu
/** 后端不带 type 字段、靠 payload 形状识别的帧(见 sse-parse 的 compaction / usage 分支) */
const FIELD_SHAPE_EVENTS = new Set(['compaction', 'usage'])

export function extractHandledEvents(source, contractEvents) {
  const known = new Set(contractEvents)
  const guarded = new Set()
  const produced = new Set()
  for (const rawLine of source.split('\n')) {
    // 注释里抄的 wire 样例(如 "data: { type:'steer', ... }")不算实现,整行截到 // 之前
    const line = rawLine.includes('//') ? rawLine.slice(0, rawLine.indexOf('//')) : rawLine
    for (const re of [...GUARD_PATTERNS, PRODUCE_PATTERN]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line)) !== null) {
        if (!known.has(m[1])) continue
        ;(re === PRODUCE_PATTERN ? produced : guarded).add(m[1])
      }
    }
  }
  return [...known]
    .filter((e) => guarded.has(e) || (FIELD_SHAPE_EVENTS.has(e) && produced.has(e)))
    .sort()
}

/** 契约外事件名判据已删除(形状与 errorCode 无法区分),见文件头"刻意不做的一条" */
export function readData() {
  return JSON.parse(readFileSync(DATA_FILE, 'utf8'))
}

export function runChecks() {
  const contractEvents = extractContractEvents(readFileSync(CONTRACT_FILE, 'utf8'))
  const clientSrc = readFileSync(API_CLIENT_FILE, 'utf8')
  const parseSrc = readFileSync(SSE_PARSE_FILE, 'utf8')
  const clientHandled = extractHandledEvents(clientSrc, contractEvents)
  const parseHandled = extractHandledEvents(parseSrc, contractEvents)
  const data = readData()
  const declared = new Set((data.webOnly ?? []).map((x) => x.event))
  const baseline = Number(data.parseCoverageBaseline ?? 0)

  const violations = []
  if (contractEvents.length === 0) {
    violations.push({ event: '(contract)', reason: '抽不到契约事件名(判据失效,不许当"全绿")' })
  }
  if (clientHandled.length === 0) {
    violations.push({ event: '(api-client)', reason: '抽不到已解析事件名(判据失效,不许当"全绿")' })
  }

  // ① 契约外事件名判据已删:errorCode / 状态枚举与事件名形状相同,按形状判只会产误报

  // ② ratchet
  if (parseHandled.length < baseline) {
    violations.push({
      event: '(parse-coverage)',
      reason: `sse-parse 覆盖 ${parseHandled.length} < 基线 ${baseline},有帧的解析被删(补回或说明后调基线)`,
    })
  }

  // ③ 归属交代
  const parsed = new Set(parseHandled)
  const unaccounted = []
  for (const ev of clientHandled) {
    if (parsed.has(ev)) continue
    if (!declared.has(ev)) unaccounted.push(ev)
  }
  if (unaccounted.length > 0) {
    violations.push({
      event: unaccounted.join(','),
      reason: 'api-client 已解析但 sse-parse 未解析,且未在 webOnly 登记(小程序端会静默丢帧)',
    })
  }
  const stale = []
  for (const entry of data.webOnly ?? []) {
    if (parsed.has(entry.event)) stale.push(entry.event)
  }
  if (stale.length > 0) {
    violations.push({
      event: stale.join(','),
      reason: 'webOnly 登记项其实已被 sse-parse 解析(应删登记并上调 parseCoverageBaseline)',
    })
  }
  for (const entry of data.webOnly ?? []) {
    if (!entry.why || String(entry.why).trim().length < 8) {
      violations.push({ event: entry.event, reason: 'webOnly 登记必须写清"为什么只有 web 消费"(不能空着)' })
    }
  }

  return {
    contractEvents,
    clientHandled,
    parseHandled,
    missingInParse: contractEvents.filter((e) => !parsed.has(e)),
    baseline,
    violations,
  }
}

function selfTest() {
  const evs = ['alpha_frame', 'beta_frame', 'gamma_frame']
  const cases = [
    [
      '契约名抽取',
      extractContractEvents(
        "export const SSE_EVENTS = {\n  A: 'alpha_frame',\n  B: 'beta_frame',\n}\n",
      ).join(','),
      'alpha_frame,beta_frame',
    ],
    ['分支守卫算覆盖', extractHandledEvents("if (json?.type === 'alpha_frame') return 1", evs).join(','), 'alpha_frame'],
    ['反向守卫算覆盖', extractHandledEvents("if (json?.type !== 'beta_frame') return", evs).join(','), 'beta_frame'],
    ['分派表 case 算覆盖', extractHandledEvents("    case 'gamma_frame':\n      return 'x'", evs).join(','), 'gamma_frame'],
    // 必须**不**算覆盖的反例:只声明类型、或只剩产出语句而守卫被删/写错 —— 都是"看着接了其实没接"
    ['类型联合声明不算覆盖', extractHandledEvents("  type:\n    | 'alpha_frame'\n    | 'beta_frame'\n  text?: string", evs).length, 0],
    [
      '守卫缺失只剩产出语句不算覆盖',
      extractHandledEvents("if (json?.type !== 'alpha_frame') return\nreturn { type: 'beta_frame' }", evs).join(','),
      'alpha_frame',
    ],
    ['注释里的 wire 样例不算覆盖', extractHandledEvents("// 例:type: 'gamma_frame' 只是样例", evs).length, 0],
    ['非契约字面量不参与判定', extractHandledEvents("if (x?.type === 'chunk') return 1", evs).length, 0],
    ['按字段形态识别的帧以产出语句为凭', extractHandledEvents("return { type: 'compaction', compaction }", ['compaction']).join(','), 'compaction'],
  ]
  let bad = 0
  for (const [label, got, expected] of cases) {
    const ok = String(got) === String(expected)
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${JSON.stringify(got)}(期望 ${JSON.stringify(expected)})`)
  }
  const exists = [CONTRACT_FILE, API_CLIENT_FILE, SSE_PARSE_FILE, DATA_FILE].every((f) => existsSync(f))
  if (!exists) bad++
  console.log(`${exists ? '✓' : '✗'} 四个数据源文件都在(缺一个判据就会假绿)`)
  const res = runChecks()
  const noCrash = res.contractEvents.length > 20 && res.clientHandled.length > 0
  if (!noCrash) bad++
  console.log(`${noCrash ? '✓' : '✗'} 真实语料可解析:契约 ${res.contractEvents.length} 帧 / api-client ${res.clientHandled.length} / sse-parse ${res.parseHandled.length}(基线 ${res.baseline})`)
  console.log(`ℹ️  现存违规 ${res.violations.length} 条(新增登记项前必须先降到 0)`)
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(`⚠️  [sse-parser-parity] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`)
    return 0
  }
  const res = runChecks()
  if (argv.includes('--report')) {
    console.log(`契约 ${res.contractEvents.length} 帧;api-client 解析 ${res.clientHandled.length};sse-parse 解析 ${res.parseHandled.length}(基线 ${res.baseline})`)
    console.log(`\nsse-parse 未解析的帧(${res.missingInParse.length}):`)
    console.log(res.missingInParse.map((e) => `  ${e}`).join('\n') || '  (无)')
    console.log('\n逐端补齐工单:上面每删一条登记,就同步上调 parseCoverageBaseline')
    return 0
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res, null, 2))
  }
  if (res.violations.length > 0) {
    console.error(`❌ [sse-parser-parity] ${res.violations.length} 处问题`)
    for (const v of res.violations.slice(0, 20)) {
      console.error(`  ${v.event} ${v.reason}`)
    }
    console.error(
      `\n  💡 同一协议两处解析,漏接是静默的(小程序拿不到帧,界面上像"功能不存在")。\n     看清单:node scripts/check-sse-parser-parity.mjs --report\n     自检:node scripts/check-sse-parser-parity.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
    )
    return 1
  }
  console.log(
    `✅ [sse-parser-parity] 契约 ${res.contractEvents.length} 帧;api-client ${res.clientHandled.length} / sse-parse ${res.parseHandled.length}(基线 ${res.baseline}),未接帧均已交代归属`,
  )
  return 0
}

export const __test__ = {
  extractContractEvents,
  extractHandledEvents,
  runChecks,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
