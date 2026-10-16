#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * record-tunnel-metrics.mjs — 隧道指标落台账(只读;补"事后无法回放"这个盲区)
 *
 * ## 为什么立这一把尺子(2026-10-16 立案,全是当天实测出来的缺口)
 *
 * - cloudflared 服务 ImagePath 是裸 `tunnel run`,**没有 --logfile** ⇒ 隧道侧运行期错误
 *   一个字都不落盘(已知结构性盲区,补它要改注册表 ImagePath,沙箱拦 sc.exe/reg.exe)。
 * - `monitoring/prometheus` 里**没有任何 cloudflared job**(全仓 grep 零命中)⇒ 指标也没有
 *   历史曲线。今天定位"公网入口慢"时只能**当场临时抓一次 metrics**,回答不了最要命的那句
 *   "什么时候开始劣化的、落点什么时候换的、错误率怎么走的"。
 * - 而 metrics 端点就在本机回环上(LISTENING),**端口每次启动会变** ⇒ Prometheus 那种写死
 *   target 的静态配置天然会漂,只有"按 pid 现读端口 + 自己落盘"这条形态才稳。
 *
 * 本尺子每轮做三件事:按 pid 现读端口 → 抓一次 metrics → 抽白名单指标**追加一行**到
 * `.workbuddy/tunnel-metrics.jsonl`,并给出与上一轮的差分(新增请求 / 新增错误 / 进程是否
 * 重启过 / 落点 PoP 是否换过)。它不判红、不寄信,只负责把时间轴留下来。
 *
 * ## 三态纪律(§0.3)
 *
 * 取不到进程、枚举不到端口、HTTP 失败、文本里抽不出任何白名单指标 ⇒ 一律 exit 3 并**点名
 * 原因**,不落一行、不记绿,也不把"没量到"折成"一切正常"。
 *
 * ## 取材面(守门 118 口径声明)
 *
 * 判的是**机器运行时状态**(tasklist / netstat / 本机 HTTP),不读任何仓库内容 ⇒ 没有
 * HEAD/索引/--staged 档。解析一律复用 `check-tunnel-leg-health.mjs` 的已验证出口(§22c:
 * 同一判据全仓只许一份,第二份必然漂移),本文件不重写端口/落点解析。
 *
 * ## 退出码
 *
 * 0 = 已落一行 / 2 = 用法错或本器自身异常 / 3 = 未取到(未判定)。
 */
import { execFile } from 'node:child_process'
import { mkdirSync, appendFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseTasklistPids, parseMetricsListenPort, parseServerLocations } from './check-tunnel-leg-health.mjs'

const TASKLIST = 'C:/Windows/System32/tasklist.exe'
const SPAWN_TIMEOUT_MS = 15_000
const HTTP_TIMEOUT_MS = 5_000

/** 只落真正会被回看的指标;全量落会把 225 行里的 Go 运行时噪声也带进来,事后没法读。 */
const SCALAR_KEYS = [
  'cloudflared_tunnel_ha_connections',
  'cloudflared_tunnel_total_requests',
  'cloudflared_tunnel_request_errors',
  'cloudflared_tunnel_concurrent_requests_per_tunnel',
  'cloudflared_proxy_connect_latency_sum',
  'cloudflared_proxy_connect_latency_count',
  'cloudflared_rpc_client_failures',
  'process_start_time_seconds',
]

function runCapture(cmd, args, timeoutMs = SPAWN_TIMEOUT_MS) {
  return new Promise((resolve) => {
    execFile(cmd, args, { windowsHide: true, encoding: 'buffer', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      resolve({ ok: !err, stdout: Buffer.isBuffer(stdout) ? stdout.toString('utf8') : String(stdout || '') })
    })
  })
}

/**
 * metrics 文本 → 结构化读数。只认白名单标量 + `response_by_code` 分档 + 当前落点。
 * 一行都抽不出 ⇒ 返回 null(上层判"不可测",绝不折成全 0)。
 */
export function parseMetrics(text) {
  const scalars = {}
  const byCode = {}
  let matched = 0
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = /^([a-zA-Z_][a-zA-Z0-9_]*)(\{[^}]*\})?\s+(-?[\d.eE+]+)$/.exec(line)
    if (!m) continue
    const [, name, labels, value] = m
    if (SCALAR_KEYS.includes(name)) {
      const v = Number(value)
      if (Number.isFinite(v)) {
        scalars[name] = v
        matched += 1
      }
      continue
    }
    if (name === 'cloudflared_tunnel_response_by_code') {
      const code = /status_code="(\d+)"/.exec(String(labels || ''))?.[1]
      const v = Number(value)
      if (code && Number.isFinite(v)) {
        byCode[code] = v
        matched += 1
      }
    }
  }
  const locs = parseServerLocations(text)
  if (matched === 0 && locs.current.length === 0) return null
  const sum = scalars.cloudflared_proxy_connect_latency_sum
  const cnt = scalars.cloudflared_proxy_connect_latency_count
  return {
    haConnections: scalars.cloudflared_tunnel_ha_connections ?? null,
    totalRequests: scalars.cloudflared_tunnel_total_requests ?? null,
    requestErrors: scalars.cloudflared_tunnel_request_errors ?? null,
    concurrent: scalars.cloudflared_tunnel_concurrent_requests_per_tunnel ?? null,
    rpcFailures: scalars.cloudflared_rpc_client_failures ?? null,
    originConnectAvgMs: Number.isFinite(sum) && Number.isFinite(cnt) && cnt > 0 ? Math.round((sum / cnt) * 100) / 100 : null,
    processStartSeconds: scalars.process_start_time_seconds ?? null,
    pops: locs.current,
    previousPops: locs.previousPops ?? locs.previous,
    responseByCode: byCode,
  }
}

/**
 * 与上一轮的差分。**进程重启过 ⇒ 计数器归零重来**,此时的差分为 null(不能拿两个不同
 * 进程的累计值相减,那会得出负数或天量,是最经典的台账污染)。
 */
export function diffRounds(prev, cur) {
  if (!prev || !cur) return { requestsDelta: null, errorsDelta: null, restarted: null, popChanged: null, note: '缺少上一轮读数 ⇒ 差分不判定' }
  const restarted =
    Number.isFinite(prev.processStartSeconds) && Number.isFinite(cur.processStartSeconds)
      ? prev.processStartSeconds !== cur.processStartSeconds
      : null
  const delta = (a, b) => {
    if (restarted === true) return null
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    if (b < a) return null
    return b - a
  }
  const prevPops = Array.isArray(prev.pops) ? prev.pops.slice().sort() : []
  const curPops = Array.isArray(cur.pops) ? cur.pops.slice().sort() : []
  return {
    requestsDelta: delta(prev.totalRequests, cur.totalRequests),
    errorsDelta: delta(prev.requestErrors, cur.requestErrors),
    restarted,
    popChanged: prevPops.length > 0 || curPops.length > 0 ? prevPops.join(',') !== curPops.join(',') : null,
  }
}

/** 台账最后一行(追加写之前读)。文件不存在 / 末行坏 JSON ⇒ null(不折成空账)。 */
export function readLastRound(file) {
  try {
    if (!existsSync(file)) return null
    const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim())
    if (lines.length === 0) return null
    const last = JSON.parse(lines[lines.length - 1])
    return last && typeof last === 'object' ? last : null
  } catch {
    return null
  }
}

async function collect() {
  const ps = await runCapture(TASKLIST, ['/NH', '/FO', 'CSV', '/FI', 'IMAGENAME eq cloudflared.exe'], 10_000)
  if (!ps.ok) return { ok: false, reason: 'tasklist 取 cloudflared pid 失败' }
  const pids = parseTasklistPids(ps.stdout)
  if (pids.length === 0) return { ok: false, reason: 'cloudflared 进程不在(不是"指标为 0")' }
  const ns = await runCapture('netstat', ['-ano'])
  if (!ns.ok) return { ok: false, reason: 'netstat 采集失败,metrics 端口不可测' }
  const port = parseMetricsListenPort(ns.stdout, pids)
  if (port === null) return { ok: false, reason: `netstat 里没枚举到本 pid(${pids.join(',')})的回环 LISTENING 端口 ⇒ metrics 端点不可达` }
  let text = ''
  try {
    const res = await fetch(`http://127.0.0.1:${port}/metrics`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
    text = await res.text()
  } catch {
    return { ok: false, reason: `metrics HTTP 失败或超时(端点 127.0.0.1:${port})` }
  }
  const reading = parseMetrics(text)
  if (!reading) return { ok: false, reason: 'metrics 文本里抽不出任何白名单指标 ⇒ 本轮不判定' }
  return { ok: true, port, pids, reading, evidenceAt: new Date().toISOString() }
}

function selfTest() {
  let pass = 0
  let total = 0
  const t = (name, fn) => {
    total += 1
    try {
      fn()
      pass += 1
    } catch (e) {
      console.log(`  ✗ ${name}: ${e && e.message}`)
    }
  }
  const eq = (a, b, msg) => {
    if (a !== b) throw new Error(`${msg || ''} 期望 ${b} 实得 ${a}`)
  }
  const sample = [
    '# HELP x y',
    'cloudflared_tunnel_ha_connections 4',
    'cloudflared_tunnel_total_requests 19211',
    'cloudflared_tunnel_request_errors 103',
    'cloudflared_tunnel_concurrent_requests_per_tunnel 0',
    'cloudflared_proxy_connect_latency_sum 1112',
    'cloudflared_proxy_connect_latency_count 166',
    'cloudflared_tunnel_response_by_code{status_code="200"} 9961',
    'cloudflared_tunnel_response_by_code{status_code="503"} 16',
    'cloudflared_tunnel_server_locations{connection_id="0",edge_location="lax09"} 1',
    'cloudflared_tunnel_server_locations{connection_id="0",edge_location="lax12"} 0',
    'process_start_time_seconds 1.79213658e+09',
    'go_goroutines 60',
  ].join('\n')
  t('解析:白名单抽全,噪声(go_*)不进,落点只收 value=1', () => {
    const r = parseMetrics(sample)
    eq(r.haConnections, 4, '腿数')
    eq(r.totalRequests, 19211, '累计请求')
    eq(r.requestErrors, 103, '回源错误')
    eq(r.responseByCode['503'], 16, '503 计数')
    eq(r.pops.join(), 'lax09', '当前落点')
    eq(r.originConnectAvgMs, 6.7, 'origin 连接均值(1112/166)')
    eq(r.processStartSeconds, 1792136580, '进程启动时刻')
  })
  t('解析失败形态:空文本 / 全是噪声 / 只有注释 ⇒ null(不折成全 0)', () => {
    eq(parseMetrics(''), null, '空')
    eq(parseMetrics('# only comments\n'), null, '纯注释')
    eq(parseMetrics('go_goroutines 60\ngo_threads 32'), null, '噪声')
  })
  t('差分:同进程累计相减;进程重启过 ⇒ 差分一律 null(不同进程的累计值不许相减)', () => {
    const prev = { totalRequests: 19000, requestErrors: 100, processStartSeconds: 1000, pops: ['lax09'] }
    const cur = { totalRequests: 19211, requestErrors: 103, processStartSeconds: 1000, pops: ['lax09'] }
    const d = diffRounds(prev, cur)
    eq(d.requestsDelta, 211, '请求增量')
    eq(d.errorsDelta, 3, '错误增量')
    eq(d.restarted, false, '未重启')
    eq(d.popChanged, false, '落点未变')
    const rst = diffRounds(prev, { ...cur, totalRequests: 500, processStartSeconds: 2000 })
    eq(rst.restarted, true, '重启识别')
    eq(rst.requestsDelta, null, '重启后差分必须 null')
    eq(rst.errorsDelta, null, '错误差分同样 null')
  })
  t('差分:落点换过要报;缺上一轮 ⇒ 不判定', () => {
    const d = diffRounds({ pops: ['lax12'], processStartSeconds: 1, totalRequests: 1, requestErrors: 0 }, { pops: ['lax09'], processStartSeconds: 1, totalRequests: 2, requestErrors: 0 })
    eq(d.popChanged, true, '落点变化')
    eq(diffRounds(null, { pops: ['lax09'] }).requestsDelta, null, '无上一轮 ⇒ null')
  })
  console.log(`${pass}/${total} 通过`)
  process.exitCode = pass === total ? 0 : 1
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const known = ['--json', '--ledger']
  const unknown = argv.filter((a) => a.startsWith('-') && !known.includes(a) && a !== '--ledger')
  if (unknown.length > 0) {
    console.error(`用法错:未识别参数 ${unknown.join(' ')}(可用:--json / --ledger <路径> / --self-test)`)
    process.exitCode = 2
    return
  }
  const ledgerArg = argv[argv.indexOf('--ledger') + 1]
  const ledger = typeof ledgerArg === 'string' && !ledgerArg.startsWith('-') ? ledgerArg : '.workbuddy/tunnel-metrics.jsonl'
  let c
  try {
    c = await collect()
  } catch (e) {
    console.error(`本器自身异常: ${e && e.message}`)
    process.exitCode = 2
    return
  }
  if (!c.ok) {
    if (argv.includes('--json')) console.log(JSON.stringify({ tool: 'record-tunnel-metrics', exitCode: 3, ok: false, reason: c.reason, at: new Date().toISOString() }))
    else console.error(`未取到隧道指标(不落台账):${c.reason}`)
    process.exitCode = 3
    return
  }
  const prev = readLastRound(ledger)
  const diff = diffRounds(prev, c.reading)
  const round = { at: c.evidenceAt, port: c.port, pids: c.pids, ...c.reading, diff }
  try {
    mkdirSync(dirname(ledger), { recursive: true })
    appendFileSync(ledger, `${JSON.stringify(round)}\n`, 'utf8')
  } catch (e) {
    console.error(`台账写失败: ${e && e.message}`)
    process.exitCode = 2
    return
  }
  if (argv.includes('--json')) console.log(JSON.stringify({ tool: 'record-tunnel-metrics', exitCode: 0, ok: true, ledger, ...round }))
  else console.log(`隧道指标已落台账 ${ledger}:腿 ${round.haConnections} 条,落点 ${(round.pops || []).join('/') || '(未读)'},累计请求 ${round.totalRequests ?? '(未读)'},回源错误 ${round.requestErrors ?? '(未读)'}`)
  process.exitCode = 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { parseMetrics, diffRounds, readLastRound, SCALAR_KEYS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
