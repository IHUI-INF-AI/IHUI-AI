// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * canary-verdict — 金丝雀发布观察窗的采样、比对与裁决(O65 第 2 期 · 2026-10-26 立)。
 *
 * 补的那一格:部署环此前只有「健康门禁」(三项全绿的瞬时证明)。门禁答不出两个问题:
 *   ① 新版本相对**上一版**有没有回归(错误率抬了、P95 延迟慢了);
 *   ② 切流之后持续几十秒里还稳不稳(门禁是逐轮探测,末轮全绿即放行)。
 * 本模块把这两件事做成可复核的判据:同一批源站端点先采基线(上一版)、再采候选(新版),
 * 按 scripts/data/canary-policy.json 的阈值出 `pass/fail/unknown` 三态,并由调用方
 * (deploy/win/ihui-deploy-loop.ps1)在 fail 时自动回滚、写 deploy-decision 台账。
 *
 * 判据纪律(违反任何一条 = 观察窗变成误报机器):
 *  - **只有 kind=origin 的端点参与裁决**:127.0.0.1 直探不经 Cloudflare,量得出真错误率/延迟;
 *    kind=public 只记录、只报告 —— 隧道抖一下就把好构建判成坏,等于给发布链加一道恒红门(§12e)。
 *  - **未知不算失败**:fetch 超时/传输不可达/HTTP 429 记 unknown,不计入错误率分母;
 *    未知占比过高 ⇒ 该端点判 unknown ⇒ 整轮 unknown(不据此回滚,也不冒充通过)。
 *  - **拿不到基线不是罪**:首次运行没有上一版样本 ⇒ 只按绝对阈值判;有基线才启用相对阈值,
 *    且基线样本数不足 minSamples 时不启用相对判据 —— 不拿 1 个样本的 P95 当基准。
 *  - 阈值只在 scripts/data/canary-policy.json,本文件不内置第二份数值;形状坏 ⇒ 抛
 *    CanaryShapeError,CLI exit 2(未判定),绝不回落默认值放行(§0.3)。
 *  - 裁决与台账写入分开:台账写失败只喊一声,**不改**裁决退出码(记账不改变落地成败,
 *    与 commit-attestation 同一条边界)。
 *
 * 退出码:
 *   0 — pass(放量完成)
 *   3 — fail(观察窗异常 ⇒ 调用方自动回滚)
 *   2 — unknown / 输入或策略形状坏(不判过、不回滚,如实喊)
 *
 * 用法:
 *   node scripts/canary-verdict.mjs --sample --stage candidate --out <候选.jsonl>
 *   node scripts/canary-verdict.mjs --decide --candidate <候选.jsonl> [--baseline <基线.jsonl>] --json
 *   node scripts/canary-verdict.mjs --decide --candidate <c> --baseline <b> --record-decision \
 *        --deploy-sha <sha> --ledger <deploy-decisions.jsonl>
 *   node scripts/canary-verdict.mjs --self-test
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { appendDecision, buildDecision, formatDecisionLine } from './deploy-decision.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const POLICY_PATH = join(ROOT, 'scripts', 'data', 'canary-policy.json')

export const EXIT_PASS = 0
export const EXIT_UNKNOWN = 2
export const EXIT_FAIL = 3

const VERDICTS = ['pass', 'fail', 'unknown']
const KINDS = ['origin', 'public']
const MAX_TEXT = 400

export class CanaryShapeError extends Error {}

const asText = (v) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)).trim()
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isPosInt = (v) => Number.isInteger(v) && v > 0
const pct = (n) => `${(n * 100).toFixed(1)}%`

/**
 * 策略加载 + 形状锁。任何一处不合规都抛 CanaryShapeError ⇒ CLI exit 2「未判定」。
 * 端点集必须至少有一条 origin 腿 —— 只有 public 腿的策略无法出可回滚的结论。
 */
export function loadPolicy(rawText) {
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch (e) {
    throw new CanaryShapeError(`金丝雀策略不是合法 JSON:${e?.message ?? e}`)
  }
  if (!isPlainObject(doc)) throw new CanaryShapeError('金丝雀策略必须是 JSON 对象')
  if (!isPosInt(doc.version)) throw new CanaryShapeError('策略形状坏:version 必须是正整数')

  const win = doc.window
  if (!isPlainObject(win)) throw new CanaryShapeError('策略形状坏:缺 window 对象')
  for (const k of ['ticks', 'gapMs', 'timeoutMs']) {
    if (!isPosInt(win[k])) throw new CanaryShapeError(`策略形状坏:window.${k} 必须是正整数`)
  }

  const th = doc.thresholds
  if (!isPlainObject(th)) throw new CanaryShapeError('策略形状坏:缺 thresholds 对象')
  for (const k of ['minSamples', 'maxP95Ms', 'maxP95DeltaMs', 'minBaselineP95Ms']) {
    if (!isPosInt(th[k])) throw new CanaryShapeError(`策略形状坏:thresholds.${k} 必须是正整数`)
  }
  for (const k of ['maxErrorRate', 'maxErrorRateDelta', 'maxUnknownRatio']) {
    if (!Number.isFinite(th[k]) || th[k] < 0 || th[k] > 1) {
      throw new CanaryShapeError(`策略形状坏:thresholds.${k} 必须是 0..1 的数`)
    }
  }
  if (!Number.isFinite(th.maxP95Ratio) || th.maxP95Ratio < 1) {
    throw new CanaryShapeError('策略形状坏:thresholds.maxP95Ratio 必须 >= 1')
  }
  if (th.minSamples < 2) throw new CanaryShapeError('策略形状坏:minSamples 至少为 2(单样本算不出错误率)')

  const eps = doc.endpoints
  if (!Array.isArray(eps) || eps.length === 0) throw new CanaryShapeError('策略形状坏:endpoints 必须是非空数组')
  const seen = new Set()
  const out = []
  for (let i = 0; i < eps.length; i += 1) {
    const ep = eps[i]
    if (!isPlainObject(ep)) throw new CanaryShapeError(`端点[${i}] 不是对象`)
    const id = asText(ep.id)
    if (!id) throw new CanaryShapeError(`端点[${i}] 缺 id`)
    if (seen.has(id)) throw new CanaryShapeError(`端点 id 重复:${id}`)
    seen.add(id)
    if (!KINDS.includes(ep.kind)) throw new CanaryShapeError(`端点 ${id} 的 kind 必须是 ${KINDS.join('/')}`)
    let u
    try {
      u = new URL(asText(ep.url))
    } catch {
      throw new CanaryShapeError(`端点 ${id} 的 url 不是合法绝对 URL`)
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new CanaryShapeError(`端点 ${id} 的 url 必须是 http(s)`)
    }
    if (ep.contains !== undefined && typeof ep.contains !== 'string') {
      throw new CanaryShapeError(`端点 ${id} 的 contains 必须是字符串`)
    }
    out.push({ id, kind: ep.kind, url: u.toString(), contains: ep.contains ?? '' })
  }
  if (!out.some((e) => e.kind === 'origin')) {
    throw new CanaryShapeError('策略形状坏:至少要有一条 kind=origin 的端点(否则无法出可回滚的结论)')
  }
  return { ...doc, window: { ...win }, thresholds: { ...th }, endpoints: out }
}

/**
 * 单条样本形状锁。采样器写盘、判定器读盘共用这一份 —— 两侧各写一遍必然漂移。
 * 未知行(半截/坏 JSON/缺键)不参与统计,但由调用方如实计数,不得当成"没有样本"。
 */
export function normalizeSample(raw, where = 'sample') {
  if (!isPlainObject(raw)) throw new CanaryShapeError(`${where} 不是对象`)
  const endpoint = asText(raw.endpoint)
  if (!endpoint) throw new CanaryShapeError(`${where} 缺 endpoint`)
  const kind = asText(raw.kind) || 'origin'
  if (!KINDS.includes(kind)) throw new CanaryShapeError(`${where} 的 kind 非法:${kind}`)
  const verdict = asText(raw.verdict)
  if (!VERDICTS.includes(verdict)) throw new CanaryShapeError(`${where} 的 verdict 非法:${verdict}`)
  const ms = Number(raw.ms)
  if (!Number.isFinite(ms) || ms < 0) throw new CanaryShapeError(`${where} 的 ms 必须是非负数`)
  const status = Number.isInteger(raw.status) ? raw.status : 0
  return { endpoint, kind, verdict, ms, status, stage: asText(raw.stage) || 'candidate', ts: asText(raw.ts) }
}

/** 解析 JSONL:返回 {records, badLines}。坏行不静默丢弃 —— 由调用方决定怎么喊。 */
export function parseSampleLines(text, where = 'samples') {
  const records = []
  const badLines = []
  const lines = String(text ?? '').split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim()
    if (!t) continue
    let obj
    try {
      obj = JSON.parse(t)
    } catch {
      badLines.push({ line: i + 1, why: 'JSON 解析失败' })
      continue
    }
    try {
      records.push(normalizeSample(obj, `${where}:${i + 1}`))
    } catch (e) {
      badLines.push({ line: i + 1, why: e?.message ?? String(e) })
    }
  }
  return { records, badLines }
}

/** 最近秩法的 P95:排序后取 ceil(0.95n) 那一个(n=1 时就是它自己)。 */
export function percentile95(values) {
  const arr = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (arr.length === 0) return null
  const idx = Math.max(0, Math.ceil(arr.length * 0.95) - 1)
  return arr[idx]
}

/**
 * 按端点汇总。measured = pass + fail(unknown 不进分母 —— 拿不到答案的探测不是答案);
 * errorRate = fail/measured;P95 只取 pass 样本的耗时(失败响应的耗时没有延迟语义)。
 */
export function summarizeSamples(records) {
  const byId = new Map()
  for (const r of records) {
    if (!byId.has(r.endpoint)) {
      byId.set(r.endpoint, { id: r.endpoint, kind: r.kind, pass: [], fail: 0, unknown: 0 })
    }
    const s = byId.get(r.endpoint)
    if (r.verdict === 'pass') s.pass.push(r.ms)
    else if (r.verdict === 'fail') s.fail += 1
    else s.unknown += 1
  }
  const out = new Map()
  for (const [id, s] of byId) {
    const total = s.pass.length + s.fail + s.unknown
    const measured = s.pass.length + s.fail
    out.set(id, {
      id,
      kind: s.kind,
      total,
      pass: s.pass.length,
      fail: s.fail,
      unknown: s.unknown,
      measured,
      errorRate: measured > 0 ? s.fail / measured : 0,
      p95Ms: percentile95(s.pass),
    })
  }
  return out
}

function judgeEndpoint({ id, kind, cand, base, th }) {
  if (!cand) {
    return { id, kind, verdict: 'unknown', reason: `${id}:候选无样本(未判定)` }
  }
  if (cand.total === 0) return { id, kind, verdict: 'unknown', reason: `${id}:零样本(未判定)` }
  if (cand.unknown / cand.total > th.maxUnknownRatio) {
    return {
      id,
      kind,
      verdict: 'unknown',
      reason: `${id}:未知占比 ${pct(cand.unknown / cand.total)} > ${pct(th.maxUnknownRatio)}(拿不到答案,不判过也不判坏)`,
    }
  }
  if (cand.measured < th.minSamples) {
    return {
      id,
      kind,
      verdict: 'unknown',
      reason: `${id}:有效样本 ${cand.measured} < ${th.minSamples}(样本不足,不出结论)`,
    }
  }
  if (cand.errorRate > th.maxErrorRate) {
    return {
      id,
      kind,
      verdict: 'fail',
      reason: `${id}:错误率 ${pct(cand.errorRate)} > 阈值 ${pct(th.maxErrorRate)}`,
    }
  }
  if (cand.p95Ms !== null && cand.p95Ms > th.maxP95Ms) {
    return {
      id,
      kind,
      verdict: 'fail',
      reason: `${id}:P95 ${Math.round(cand.p95Ms)}ms > 绝对阈值 ${th.maxP95Ms}ms`,
    }
  }
  const baseUsable = base && base.measured >= th.minSamples
  if (baseUsable && cand.errorRate - base.errorRate > th.maxErrorRateDelta) {
    return {
      id,
      kind,
      verdict: 'fail',
      reason: `${id}:错误率较基线抬升 ${pct(cand.errorRate - base.errorRate)} > ${pct(th.maxErrorRateDelta)}(基线 ${pct(base.errorRate)})`,
    }
  }
  if (
    baseUsable &&
    base.p95Ms !== null &&
    base.p95Ms >= th.minBaselineP95Ms &&
    cand.p95Ms !== null &&
    cand.p95Ms / base.p95Ms > th.maxP95Ratio &&
    cand.p95Ms - base.p95Ms > th.maxP95DeltaMs
  ) {
    return {
      id,
      kind,
      verdict: 'fail',
      reason: `${id}:P95 ${Math.round(cand.p95Ms)}ms 较基线 ${Math.round(base.p95Ms)}ms 放大 > ${th.maxP95Ratio}x 且增量 > ${th.maxP95DeltaMs}ms`,
    }
  }
  return {
    id,
    kind,
    verdict: 'pass',
    reason: `${id}:错误率 ${pct(cand.errorRate)} / P95 ${cand.p95Ms === null ? 'n/a' : Math.round(cand.p95Ms) + 'ms'}(基线 ${baseUsable ? pct(base.errorRate) + ' / ' + (base.p95Ms === null ? 'n/a' : Math.round(base.p95Ms) + 'ms') : '无可用基线'})`,
  }
}

/**
 * 裁决本体(纯函数)。只让 origin 端点决定 verdict;public 端点逐条进 details 供人读,
 * 不进 reasons 的失败判据 —— 这是本模块头注那条纪律的唯一实现处。
 */
export function decideCanary({ baseline = [], candidate = [], policy, baselineBadLines = 0, candidateBadLines = 0 } = {}) {
  if (!policy) throw new CanaryShapeError('decideCanary 缺 policy')
  if (candidate.length === 0) throw new CanaryShapeError('候选样本为空 ⇒ 未判定(空数组不记绿)')
  const baseStats = summarizeSamples(baseline)
  const candStats = summarizeSamples(candidate)
  const originIds = policy.endpoints.filter((e) => e.kind === 'origin').map((e) => e.id)
  const publicIds = policy.endpoints.filter((e) => e.kind === 'public').map((e) => e.id)

  const details = []
  for (const id of originIds) {
    details.push(judgeEndpoint({ id, kind: 'origin', cand: candStats.get(id), base: baseStats.get(id), th: policy.thresholds }))
  }
  for (const id of publicIds) {
    const c = candStats.get(id)
    const b = baseStats.get(id)
    details.push({
      id,
      kind: 'public',
      verdict: !c || c.total === 0
        ? 'unknown'
        : c.unknown / c.total > policy.thresholds.maxUnknownRatio
          ? 'unknown'
          : c.errorRate > policy.thresholds.maxErrorRate
            ? 'fail'
            : 'pass',
      reason: c
        ? `${id}:错误率 ${pct(c.errorRate)} / P95 ${c.p95Ms === null ? 'n/a' : Math.round(c.p95Ms) + 'ms'}(公网腿,仅记录、不参与回滚判据${b ? '' : ';无基线'})`
        : `${id}:候选无样本(公网腿,仅记录)`,
    })
  }

  const origin = details.filter((d) => d.kind === 'origin')
  const failing = origin.filter((d) => d.verdict === 'fail')
  const unknown = origin.filter((d) => d.verdict === 'unknown')
  let verdict = 'pass'
  if (failing.length > 0) verdict = 'fail'
  else if (unknown.length > 0) verdict = 'unknown'

  const reasons = []
  if (failing.length) reasons.push(...failing.map((d) => d.reason))
  if (unknown.length) reasons.push(...unknown.map((d) => d.reason))
  if (verdict === 'pass') reasons.push(...origin.map((d) => d.reason))
  if (candidateBadLines > 0) reasons.push(`候选样本含 ${candidateBadLines} 条坏行(已忽略,但样本面不完整)`)
  if (baselineBadLines > 0) reasons.push(`基线样本含 ${baselineBadLines} 条坏行(相对判据可能不完整)`)

  return {
    verdict,
    exitCode: verdict === 'pass' ? EXIT_PASS : verdict === 'fail' ? EXIT_FAIL : EXIT_UNKNOWN,
    comparedWithBaseline: baseStats.size > 0,
    dims: failing.length ? failing.map((d) => d.id) : unknown.map((d) => d.id),
    details,
    reasons,
    baseline: Object.fromEntries([...baseStats].map(([k, v]) => [k, v])),
    candidate: Object.fromEntries([...candStats].map(([k, v]) => [k, v])),
  }
}

/** 单次探测:pass = 状态码 2xx/3xx 且(如有)正文命中;429/网络错误 = unknown;其余 = fail。 */
async function probeEndpoint(ep, timeoutMs, fetchImpl) {
  const started = performance.now()
  try {
    const res = await fetchImpl(ep.url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'ihui-canary/1' },
    })
    const body = await res.text()
    const ms = performance.now() - started
    if (res.status === 429) return { verdict: 'unknown', status: res.status, ms }
    if (res.status >= 200 && res.status < 400) {
      if (ep.contains && !body.includes(ep.contains)) return { verdict: 'fail', status: res.status, ms }
      return { verdict: 'pass', status: res.status, ms }
    }
    return { verdict: 'fail', status: res.status, ms }
  } catch {
    return { verdict: 'unknown', status: 0, ms: performance.now() - started }
  }
}

/** 采样窗口:每 tick 把全部端点各打一次,共 ticks 轮;逐条落 JSONL。 */
export async function runSampling({ policy, stage, out, fetchImpl = globalThis.fetch, now = () => new Date(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!policy) throw new CanaryShapeError('runSampling 缺 policy')
  if (!out) throw new CanaryShapeError('runSampling 缺 out 路径')
  const records = []
  for (let tick = 0; tick < policy.window.ticks; tick += 1) {
    for (const ep of policy.endpoints) {
      const r = await probeEndpoint(ep, policy.window.timeoutMs, fetchImpl)
      records.push({
        v: 1,
        ts: now().toISOString(),
        stage,
        endpoint: ep.id,
        kind: ep.kind,
        verdict: r.verdict,
        status: r.status,
        ms: Math.round(r.ms * 1000) / 1000,
      })
    }
    if (tick < policy.window.ticks - 1) await sleep(policy.window.gapMs)
  }
  mkdirSync(dirname(resolve(out)), { recursive: true })
  writeFileSync(out, `${records.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8')
  return { out, count: records.length, records }
}

function readIfExists(p) {
  if (!p || !existsSync(p)) return null
  return readFileSync(p, 'utf8')
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      out._.push(a)
      continue
    }
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

/** 决策出口:复用 deploy-decision 的唯一构造/追加实现,本文件不另拼一份台账格式。 */
export function recordCanaryDecision({ verdict, dims, reasons, sha, ledger, now }) {
  const action = verdict === 'pass' ? 'canary-pass' : verdict === 'fail' ? 'canary-rollback' : 'canary-unproven'
  const gateVerdict = verdict === 'pass' ? 'pass' : verdict === 'fail' ? 'fail' : 'unknown'
  const text = reasons.join(';')
  const decision = buildDecision(
    {
      action,
      sha,
      gateVerdict,
      failDims: dims,
      reason: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text,
    },
    now ? { now } : {},
  )
  appendDecision(ledger, decision)
  return decision
}

function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const th = { minSamples: 3, maxErrorRate: 0.2, maxErrorRateDelta: 0.1, maxP95Ms: 500, maxP95Ratio: 2, maxP95DeltaMs: 100, minBaselineP95Ms: 10, maxUnknownRatio: 0.5 }
  const policy = { window: { ticks: 1, gapMs: 1, timeoutMs: 1 }, thresholds: th, endpoints: [
    { id: 'a', kind: 'origin', url: 'http://127.0.0.1:1/', contains: '' },
    { id: 'p', kind: 'public', url: 'http://127.0.0.1:2/', contains: '' },
  ] }
  const rec = (endpoint, verdict, ms, kind = 'origin') => ({ endpoint, kind, verdict, ms, status: verdict === 'pass' ? 200 : 500, stage: 'candidate', ts: '' })

  t('全绿 ⇒ pass', () => {
    const r = decideCanary({ policy, candidate: [rec('a', 'pass', 10), rec('a', 'pass', 12), rec('a', 'pass', 11)] })
    if (r.verdict !== 'pass' || r.exitCode !== 0) throw new Error(`实得 ${r.verdict}/${r.exitCode}`)
  })
  t('错误率超绝对阈值 ⇒ fail', () => {
    const c = [rec('a', 'fail', 10), rec('a', 'fail', 10), rec('a', 'pass', 10)]
    const r = decideCanary({ policy, candidate: c })
    if (r.verdict !== 'fail' || r.exitCode !== 3) throw new Error(`实得 ${r.verdict}/${r.exitCode}`)
  })
  t('P95 超绝对阈值 ⇒ fail', () => {
    const c = [rec('a', 'pass', 600), rec('a', 'pass', 700), rec('a', 'pass', 800)]
    const r = decideCanary({ policy, candidate: c })
    if (r.verdict !== 'fail') throw new Error(`实得 ${r.verdict}`)
  })
  t('相对基线错误率抬升 ⇒ fail', () => {
    const base = [rec('a', 'pass', 10), rec('a', 'pass', 10), rec('a', 'pass', 10)]
    const cand = [rec('a', 'fail', 10), rec('a', 'pass', 10), rec('a', 'pass', 10)]
    const r = decideCanary({ policy, baseline: base, candidate: cand })
    if (r.verdict !== 'fail') throw new Error(`实得 ${r.verdict}`)
  })
  t('未知占比过高 ⇒ unknown,不判 fail', () => {
    const c = [rec('a', 'unknown', 10), rec('a', 'unknown', 10), rec('a', 'pass', 10)]
    const r = decideCanary({ policy, candidate: c })
    if (r.verdict !== 'unknown' || r.exitCode !== 2) throw new Error(`实得 ${r.verdict}/${r.exitCode}`)
  })
  t('样本不足 ⇒ unknown', () => {
    const c = [rec('a', 'pass', 10), rec('a', 'pass', 10)]
    const r = decideCanary({ policy, candidate: c })
    if (r.verdict !== 'unknown') throw new Error(`实得 ${r.verdict}`)
  })
  t('public 腿坏不触发回滚', () => {
    const c = [rec('a', 'pass', 10), rec('a', 'pass', 10), rec('a', 'pass', 10), rec('p', 'fail', 10, 'public'), rec('p', 'fail', 10, 'public'), rec('p', 'fail', 10, 'public')]
    const r = decideCanary({ policy, candidate: c })
    if (r.verdict !== 'pass') throw new Error(`实得 ${r.verdict}`)
  })
  t('候选为空必须抛(空数组不记绿)', () => {
    let hit = false
    try {
      decideCanary({ policy, candidate: [] })
    } catch (e) {
      hit = e instanceof CanaryShapeError
    }
    if (!hit) throw new Error('未抛 CanaryShapeError')
  })
  t('策略缺 origin 腿必须拒', () => {
    let hit = false
    try {
      loadPolicy(JSON.stringify({ version: 1, window: { ticks: 1, gapMs: 1, timeoutMs: 1 }, thresholds: th, endpoints: [{ id: 'p', kind: 'public', url: 'http://127.0.0.1:1/' }] }))
    } catch (e) {
      hit = e instanceof CanaryShapeError
    }
    if (!hit) throw new Error('未拒')
  })
  t('P95 最近秩法', () => {
    const v = percentile95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    if (v !== 10) throw new Error(`实得 ${v}`)
    if (percentile95([]) !== null) throw new Error('空集应为 null')
  })
  t('坏行被计数但不污染样本', () => {
    const { records, badLines } = parseSampleLines(`${JSON.stringify(rec('a', 'pass', 10))}\nhalf-line\n`)
    if (records.length !== 1 || badLines.length !== 1) throw new Error(`records=${records.length} bad=${badLines.length}`)
  })
  t('决策出口写到正确 action', () => {
    const dir = join(ROOT, '.ihui-agent', 'tmp')
    mkdirSync(dir, { recursive: true })
    const ledger = join(dir, `canary-selftest-${process.pid}.jsonl`)
    try {
      const d = recordCanaryDecision({ verdict: 'fail', dims: ['a'], reasons: ['x'], sha: 'c05ca0d5', ledger })
      if (d.action !== 'canary-rollback' || d.gateVerdict !== 'fail') throw new Error(`action=${d.action}`)
      const line = readFileSync(ledger, 'utf8').trim().split(/\r?\n/).pop()
      if (JSON.parse(line).action !== 'canary-rollback') throw new Error('台账行 action 不符')
    } finally {
      try { unlinkSync(ledger) } catch {}
    }
  })

  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  console.log(`\n通过 ${checks.length - failed.length} / 失败 ${failed.length}`)
  if (failed.length) process.exitCode = 1
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args['self-test']) return selfTest()

  const policyPath = args.policy || POLICY_PATH
  let policy
  try {
    policy = loadPolicy(readFileSync(policyPath, 'utf8'))
  } catch (e) {
    console.error(`金丝雀策略未判定(${policyPath}):${e?.message ?? e}`)
    process.exit(EXIT_UNKNOWN)
  }

  if (args.sample) {
    const out = args.out
    if (!out) {
      console.error('--sample 必须给 --out <jsonl>')
      process.exit(EXIT_UNKNOWN)
    }
    const stage = args.stage || 'candidate'
    const r = await runSampling({ policy, stage, out })
    const s = summarizeSamples(r.records)
    for (const [id, v] of s) {
      console.log(`CANARY-SAMPLE ${id} total=${v.total} pass=${v.pass} fail=${v.fail} unknown=${v.unknown} err=${pct(v.errorRate)} p95=${v.p95Ms === null ? 'n/a' : Math.round(v.p95Ms) + 'ms'}`)
    }
    console.log(`CANARY-SAMPLE-OUT ${out} lines=${r.count}`)
    return
  }

  if (args.decide || args.candidate) {
    if (!args.candidate) {
      console.error('--decide 必须给 --candidate <jsonl>')
      process.exit(EXIT_UNKNOWN)
    }
    let candidateText
    try {
      candidateText = readFileSync(args.candidate, 'utf8')
    } catch (e) {
      console.error(`候选样本读不到(${args.candidate}):${e?.message ?? e}`)
      process.exit(EXIT_UNKNOWN)
    }
    const cand = parseSampleLines(candidateText, 'candidate')
    let base = { records: [], badLines: [] }
    if (args.baseline) {
      const baseText = readIfExists(args.baseline)
      if (baseText === null) {
        console.log(`CANARY-BASELINE 缺失(${args.baseline})⇒ 只按绝对阈值判`)
      } else {
        base = parseSampleLines(baseText, 'baseline')
      }
    }
    let result
    try {
      result = decideCanary({
        policy,
        baseline: base.records,
        candidate: cand.records,
        baselineBadLines: base.badLines.length,
        candidateBadLines: cand.badLines.length,
      })
    } catch (e) {
      console.error(`金丝雀判定未判定:${e?.message ?? e}`)
      process.exit(EXIT_UNKNOWN)
    }
    const payload = { verdict: result.verdict, comparedWithBaseline: result.comparedWithBaseline, dims: result.dims, reasons: result.reasons, details: result.details }
    if (args.json) console.log(JSON.stringify(payload))
    else {
      console.log(`CANARY-VERDICT ${result.verdict}${result.comparedWithBaseline ? ' (含基线对照)' : ' (无基线,仅绝对阈值)'}`)
      for (const d of result.details) console.log(`  ${d.kind === 'origin' ? '[判据]' : '[记录]'} ${d.reason}`)
    }
    if (args['record-decision']) {
      const ledger = args.ledger || join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
      try {
        const d = recordCanaryDecision({ verdict: result.verdict, dims: result.dims, reasons: result.reasons, sha: args['deploy-sha'] ?? '', ledger })
        console.log(formatDecisionLine(d))
      } catch (e) {
        // 记账失败不改变裁决退出码(与 commit-attestation 同一条边界):只喊,不冒充记成了。
        console.error(`DECISION 未记录(action=canary-${result.verdict}):${e?.message ?? e}`)
      }
    }
    process.exit(result.exitCode)
  }

  console.error('用法:--sample --stage <s> --out <jsonl> | --decide --candidate <jsonl> [--baseline <jsonl>] [--json] | --self-test')
  process.exit(EXIT_UNKNOWN)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
