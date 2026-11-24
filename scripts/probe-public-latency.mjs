#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * RP-7 公网腿延迟分维度测量（只测量，不下腿坏结论）。
 *
 * 背景:api.aizhs.top 走 Cloudflare Tunnel 回源本机(127.0.0.1:8802)。
 * GitHub App 最近 100 条回调投递 p95=8.34s ⇒ 手机用户体感"转圈"。
 * 本脚本把耗时拆成三段独立量:
 *   模式 A 本机直击源站        — 源站处理耗时基线
 *   模式 B 经公网 CF 入口      — 源站处理 + 跨境回源总耗时
 *   模式 C 模式 B + CF timing — 尽力解析 server-timing / cf-ray 头
 *
 * 硬约束(票 RP-7):判"腿坏"必须用外部正证(GitHub webhook 投递成功率),
 * 本脚本只出测量数据,绝不下腿坏结论;结论仅供机器持有者参考。
 *
 * 用法: node scripts/probe-public-latency.mjs [--runs N] [--json]
 *   --runs N   每模式跑几次,默认 5
 *   --json     输出 JSON 而非人类可读
 * 退出码:0 正常(即使目标不可达) / 1 参数错
 */
import { performance } from 'node:perf_hooks'

const LOCAL_BASE = 'http://127.0.0.1:8802'
const PUBLIC_BASE = 'https://api.aizhs.top'
const HEALTH_PATH = '/api/health'

/** 跑一次 fetch 并计时,失败时 graceful 返回 */
async function timedFetch(url, signal) {
  const start = performance.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal,
      redirect: 'follow',
    })
    const elapsed = performance.now() - start
    // 读掉 body 才算完整(否则 CF 可能还没回完就计时结束)
    await res.arrayBuffer().catch(() => {})
    return {
      ok: true,
      status: res.status,
      elapsedMs: elapsed,
      headers: Object.fromEntries(res.headers.entries()),
    }
  } catch (e) {
    const elapsed = performance.now() - start
    const reason = e?.name === 'AbortError' ? 'timeout' : (e?.cause?.code ?? e?.code ?? e?.name ?? 'error')
    return {
      ok: false,
      reason,
      elapsedMs: elapsed,
    }
  }
}

/** 跑 N 次并收集耗时数组(仅 ok 的算进统计) */
async function probeN(url, runs) {
  const results = []
  for (let i = 0; i < runs; i++) {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 20_000)
    const r = await timedFetch(url, ac.signal)
    clearTimeout(t)
    results.push(r)
  }
  return results
}

/** p50/p95/max,基于 ok 结果 */
function summarize(results) {
  const times = results.filter((r) => r.ok).map((r) => r.elapsedMs).sort((a, b) => a - b)
  if (times.length === 0) return { okCount: 0, failCount: results.length, unreachable: true }
  const p = (q) => {
    const idx = Math.min(times.length - 1, Math.ceil(q * times.length) - 1)
    return Math.round(times[idx])
  }
  return {
    okCount: times.length,
    failCount: results.length - times.length,
    p50: p(0.5),
    p95: p(0.95),
    max: Math.round(times[times.length - 1]),
    min: Math.round(times[0]),
    times: times.map((t) => Math.round(t)),
    unreachable: false,
  }
}

/** 提取 CF 分阶段计时头(server-timing 若有) */
function extractCfTiming(headers) {
  if (!headers) return null
  const st = headers['server-timing']
  const cfRay = headers['cf-ray']
  const cfCache = headers['cf-cache-status']
  return {
    cfRay: cfRay ?? null,
    cfCacheStatus: cfCache ?? null,
    serverTiming: st ?? null,
    note: st ? 'CF 暴露 server-timing' : 'CF 未暴露分阶段计时,仅得总耗时',
  }
}

async function main() {
  const args = process.argv.slice(2)
  const jsonMode = args.includes('--json')
  const runsIdx = args.indexOf('--runs')
  const runs = runsIdx >= 0 && Number.isInteger(Number(args[runsIdx + 1])) && Number(args[runsIdx + 1]) > 0
    ? Number(args[runsIdx + 1])
    : 5

  if (jsonMode) {
    // JSON 模式:静默跑,最后一次性输出
  } else {
    console.log(`# RP-7 公网腿延迟分维度测量(每模式 ${runs} 次;只测量,不下腿坏结论)`)
    console.log(`# 模式 A 本机源站 ${LOCAL_BASE}${HEALTH_PATH}`)
    console.log(`# 模式 B 公网入口 ${PUBLIC_BASE}${HEALTH_PATH}`)
    console.log(`# 模式 C = 模式 B + 解析 CF timing 头`)
  }

  // 模式 A
  if (!jsonMode) console.log(`\n[模式 A] 本机直击源站 ${LOCAL_BASE}${HEALTH_PATH}`)
  const aResults = await probeN(`${LOCAL_BASE}${HEALTH_PATH}`, runs)
  const a = summarize(aResults)
  if (!jsonMode) {
    if (a.unreachable) console.log(`  ✗ 全部失败(${a.failCount} 次) — 源站可能没在跑`)
    else {
      console.log(`  ✓ 成功 ${a.okCount}/${runs}  p50=${a.p50}ms  p95=${a.p95}ms  max=${a.max}ms`)
      console.log(`  逐次: ${a.times.join(', ')} ms`)
    }
  }

  // 模式 B
  if (!jsonMode) console.log(`\n[模式 B] 经公网 CF 入口 ${PUBLIC_BASE}${HEALTH_PATH}`)
  const bResults = await probeN(`${PUBLIC_BASE}${HEALTH_PATH}`, runs)
  const b = summarize(bResults)
  if (!jsonMode) {
    if (b.unreachable) console.log(`  ✗ 全部失败(${b.failCount} 次) — 公网入口可能不可达`)
    else {
      console.log(`  ✓ 成功 ${b.okCount}/${runs}  p50=${b.p50}ms  p95=${b.p95}ms  max=${b.max}ms`)
      console.log(`  逐次: ${b.times.join(', ')} ms`)
    }
  }

  // 模式 C:重跑一次模式 B 拿 headers
  if (!jsonMode) console.log(`\n[模式 C] 模式 B + CF timing 头解析`)
  const cProbe = await probeN(`${PUBLIC_BASE}${HEALTH_PATH}`, 1)
  const cTiming = extractCfTiming(cProbe[0]?.headers)
  if (!jsonMode) {
    if (cTiming) {
      console.log(`  cf-ray: ${cTiming.cfRay ?? '∅'}`)
      console.log(`  cf-cache-status: ${cTiming.cfCacheStatus ?? '∅'}`)
      console.log(`  server-timing: ${cTiming.serverTiming ?? '∅'}`)
      console.log(`  note: ${cTiming.note}`)
    } else {
      console.log(`  ✗ 未取到 headers(目标不可达或全部失败)`)
    }
  }

  // bottleneckHint:仅算术对比
  let bottleneckHint = null
  if (!a.unreachable && !b.unreachable) {
    const overhead = b.p95 - a.p95
    const pct = b.p95 > 0 ? Math.round((overhead / b.p95) * 100) : 0
    bottleneckHint = {
      modeAP95: a.p95,
      modeBP95: b.p95,
      overheadMs: overhead,
      overheadPct: pct,
      text: `回源开销约 ${overhead} ms,占公网 p95 的 ${pct}%`,
    }
    if (!jsonMode) console.log(`\n[对比] ${bottleneckHint.text}`)
  } else if (!jsonMode) {
    console.log(`\n[对比] 跳过 — A 或 B 全部失败,无法算回源开销`)
  }

  if (jsonMode) {
    console.log(JSON.stringify({
      probe: 'RP-7 public-latency',
      runs,
      modeA: a,
      modeB: b,
      modeC: { timing: cTiming, sampleStatus: cProbe[0]?.status ?? null },
      bottleneckHint,
      caveat: '本脚本只出测量数据;腿坏判定须 GitHub webhook 投递成功率(外部正证),见票 RP-7',
    }, null, 2))
  }

  process.exit(0)
}

// §22d 入口守卫:CLI 直跑 + 被 import 双形态
import { pathToFileURL } from 'node:url'
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
}
