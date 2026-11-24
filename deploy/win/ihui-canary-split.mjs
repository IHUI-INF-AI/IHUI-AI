#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ihui-canary-split — 源站侧灰度分流器(O65 第 2 期「灰度分流」· 2026-10-27 立)。
 *
 * 它回答的是 canary-traffic 回答不了的那一半:canary-traffic 判「这个请求该不该进灰度」,
 * 本进程真把请求**送到**对应槽位。两者分工:
 *   canary-traffic.mjs  —— 纯函数:车道选择 + 档位推进 + 契约生成(唯一判据,可单测)
 *   ihui-canary-split.mjs —— 本文件:读契约 → 按契约比例把流量切给 stable / canary 槽位
 *
 * 为什么分流器在**源站本地**而不是 Cloudflare 边缘:
 *   现行生产入口是 Cloudflare Tunnel,ingress 规则在 **Cloudflare 控制台**(仓外),
 *   改它须三处同步(本机服务改绑 / 控制台 ingress / 仓内文档),本机改不动。
 *   但「先小流量」这件事本身必须有一个**仓内可实现**的执行点,否则这一格永远是空的
 *   (2026-10-27 复核:「灰度分流」在代码面 0 命中)。
 *   本文件就是那个执行点:一个只绑 127.0.0.1 的反向代理,按契约比例分流。
 *
 * 契约(ramp contract)由 scripts/canary-traffic.mjs --advance 生成,落在
 * .ihui-agent/state/canary/ramp.json。契约里写清:比例、两个槽位端口、路由键头、
 * 强制头、桶口径。**分流器不猜任何一样**,只按契约执行。
 *
 * 安全边界:
 *   - 只绑 127.0.0.1(公网仍只经 Cloudflare Tunnel 回源,源站物理不可达);
 *   - 路由键优先取契约指定的请求头(缺省则取客户端 IP),不取任何凭据正文;
 *   - 契约缺失/形状坏 ⇒ 比例按 0 处理(全部回 stable),绝不「猜一个比例放量」;
 *     回 stable 需要现网端口,故进程从策略 traffic.slots.stable.port 取一次作为回调端口
 *     (`--stable-port` 可覆盖)。**端口也取不到时明确 503 并点名**,绝不抛异常 ——
 *     2026-10-29 实测:旧实现在契约缺失时读 `contract.stablePort` 抛 TypeError,
 *     未捕获 ⇒ 分流器进程整只退出,线上由「灰度过半」直接掉成「全站不可达」。
 *
 * 用法:
 *   node deploy/win/ihui-canary-split.mjs --contract <ramp.json> --listen <port> [--stats <split-stats.json>]
 */

import http from 'node:http'
import net from 'node:net'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadTrafficPolicy, selectTrafficLane } from '../../scripts/canary-traffic.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEFAULT_CONTRACT = join(ROOT, '.ihui-agent', 'state', 'canary', 'ramp.json')
/** 车道计数落盘的唯一默认落点(观测面;与契约同目录)。 */
const DEFAULT_STATS_PATH = join(ROOT, '.ihui-agent', 'state', 'canary', 'split-stats.json')

// 灰度槽位探活:契约写着比例、但承载新构建的实例还没起(或已挂)时,那一部分流量会打到
// 空端口 —— 5% 的 502 比"没放量"坏得多。故探活不通过 ⇒ 该部分流量回落 stable(老版本在线)。
// 探活按 TTL 缓存:每枚请求都探一次会把本机 TCP 栈打满,而"实例起没起"是秒级事实。
const HEALTH_TTL_MS = 1000
const PROBE_TIMEOUT_MS = 300

const HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/**
 * 契约读取 + 形状锁(纯函数,可测)。
 * 契约缺失/坏 ⇒ null(⇒ 比例 0,全部走 stable)。绝不回落默认值放量。
 */
export function readContract(rawText) {
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch {
    return null
  }
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return null
  const pct = Number(doc.percent)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null
  const slots = doc.slots
  if (!slots || typeof slots !== 'object') return null
  const stable = Number(slots.stable?.port)
  const canary = Number(slots.canary?.port)
  if (!Number.isInteger(stable) || !Number.isInteger(canary) || stable <= 0 || canary <= 0) return null
  if (stable === canary) return null
  const granularity = Number(doc.bucketGranularity)
  if (!Number.isInteger(granularity) || granularity <= 0) return null
  const salt = typeof doc.bucketSalt === 'string' ? doc.bucketSalt : ''
  if (!salt) return null
  const routingKeyHeader = typeof doc.routingKeyHeader === 'string' && doc.routingKeyHeader ? doc.routingKeyHeader : 'x-ihui-canary-key'
  const tagHeader = typeof doc.tagHeader === 'string' && doc.tagHeader ? doc.tagHeader : 'x-canary-tag'
  return {
    stage: typeof doc.stage === 'string' ? doc.stage : 'off',
    percent: pct,
    stablePort: stable,
    canaryPort: canary,
    granularity,
    salt,
    routingKeyHeader: routingKeyHeader.toLowerCase(),
    tagHeader: tagHeader.toLowerCase(),
  }
}

/**
 * 路由键:优先用契约指定的请求头(缺省回落客户端 IP)。
 * 取不到(既无头也无 IP)⇒ 空串 —— 空串仍然是一个稳定的 key(哈希照样定车道),
 * 但**不**用它来携带任何身份信息。
 */
export function routingKeyOf(headers, remoteAddress, routingKeyHeader) {
  const h = headers?.[routingKeyHeader]
  const first = Array.isArray(h) ? h[0] : h
  const key = typeof first === 'string' ? first.trim() : ''
  if (key) return key
  const ip = typeof remoteAddress === 'string' ? remoteAddress.trim() : ''
  return ip
}

/**
 * 车道判定(纯函数,委托给唯一判据 canary-traffic,不另写一份哈希口径)。
 * 契约缺失 ⇒ 比例 0 ⇒ 恒 stable。
 * canaryUp=false ⇒ 灰度实例不健康 ⇒ 即使哈希命中也回落 stable(老版本在线),
 * 绝不把流量打到不存在的槽位上(5% 的 502 比没放量坏得多)。
 */
export function laneFor({ contract, headers, remoteAddress, canaryUp = true }) {
  if (!contract) return { lane: 'stable', percent: 0, forced: false, bucket: null, fallback: false }
  const key = routingKeyOf(headers, remoteAddress, contract.routingKeyHeader)
  const tag = headers?.[contract.tagHeader]
  const tagText = Array.isArray(tag) ? tag[0] : tag
  const r = selectTrafficLane(key, {
    percent: contract.percent,
    tag: typeof tagText === 'string' ? tagText : '',
    granularity: contract.granularity,
    salt: contract.salt,
  })
  const fallback = r.lane === 'canary' && !canaryUp
  return {
    lane: fallback ? 'stable' : r.lane,
    percent: contract.percent,
    forced: r.forced,
    bucket: r.bucket,
    fallback,
  }
}

/** TCP 探活(纯本机,不发业务请求):端口能连上即视为"实例在位"。 */
function probePort(port, { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
  return new Promise((resolvePromise) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    let settled = false
    const done = (ok) => {
      if (settled) return
      settled = true
      try { socket.destroy() } catch { /* 已断开 */ }
      resolvePromise(ok)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

/** 带 TTL 缓存的槽位健康缓存(同一次进程内共享)。 */
export function createHealthCache({ ttlMs = HEALTH_TTL_MS, probe = probePort } = {}) {
  const state = new Map()
  return {
    async isUp(port, now = Date.now()) {
      const hit = state.get(port)
      if (hit && now - hit.at < ttlMs) return hit.ok
      const ok = await probe(port)
      state.set(port, { ok, at: now })
      return ok
    },
  }
}

/**
 * 车道计数落盘出口(2026-11-01 立,治"灰度期到底放过多少量无人知道")。
 *
 * 立因:响应头 `x-ihui-canary-lane` 只是单枚请求的排障线索,进程整轮只在 listen 时 print 一行;
 * 契约文件 ramp.json 记的是**期望比例**,deploy-decisions.jsonl 记的是**判定结论** ——
 * 两者都证明不了"实际放过多少量"。演练里的 22/400 只在夹具内由客户端算出,生产面没有产物。
 *
 * 纪律(缺一即本层不成立):
 *  - **只作观测面**:计数绝不回流进任何回滚阈值/档位判据(那会新增一条会抖的判据,§5e-3 同源);
 *  - 契约取不到也计数(`contractMissing`),让"契约坏 ⇒ 全回 stable"这条承诺留下证据;
 *  - 写失败**绝不影响转发**:handler 里的任何异常都会把分流器打死(2026-10-29 实测过这个形态),
 *    所以这里吞异常、只在 stderr 点名一次,不 throw 也不冒绿;
 *  - 落盘是"分流器进程自己的累计",不是"本轮增量" —— 消费方(gray.ps1 复用已在位的分流器进程),
 *    读数措辞必须如实(§0.3)。
 */
const STATS_FLUSH_INTERVAL_MS = 5000
const STATS_FLUSH_EVERY = 100

/** 落盘形态(纯函数,可测;只含观测字段,不含任何判据输入)。 */
function laneStatsShape(counters, { contractPercent = null, updatedAt }) {
  return {
    updatedAt,
    contractPercent,
    lanes: { stable: counters.stable, canary: counters.canary },
    fallback: counters.fallback,
    contractMissing: counters.contractMissing,
  }
}

export function createLaneStatsWriter({
  statsPath = DEFAULT_STATS_PATH,
  throttleMs = STATS_FLUSH_INTERVAL_MS,
  everyN = STATS_FLUSH_EVERY,
  now = () => Date.now(),
  writeFileSync: writeFn = writeFileSync,
  mkdirSync: mkdirFn = mkdirSync,
  renameSync: renameFn = renameSync,
  onError = null,
} = {}) {
  const counters = { stable: 0, canary: 0, fallback: 0, contractMissing: 0 }
  let contractPercent = null
  let sinceWrite = 0
  let lastWriteAt = now()
  let writeFailures = 0
  const onWriteError =
    onError ??
    ((e, count) => {
      if (count === 1)
        console.error(
          `[canary-split] 车道计数落盘失败(仅观测面,不影响转发):${statsPath} — ${e?.message ?? e}`,
        )
    })
  const flush = () => {
    const stamp = new Date(now()).toISOString()
    const payload = laneStatsShape(counters, { contractPercent, updatedAt: stamp })
    sinceWrite = 0
    lastWriteAt = now()
    try {
      mkdirFn(dirname(statsPath), { recursive: true })
      // 先写临时名再改名:读侧(部署环)不该看到半截 JSON。
      const tmp = `${statsPath}.writing`
      writeFn(tmp, JSON.stringify(payload), 'utf8')
      renameFn(tmp, statsPath)
    } catch (e) {
      writeFailures += 1
      onWriteError(e, writeFailures)
    }
    return payload
  }
  const observe = (evt) => {
    if (evt?.lane === 'canary') counters.canary += 1
    else if (evt?.lane === 'stable') counters.stable += 1
    if (evt?.fallback) counters.fallback += 1
    if (evt?.contractMissing) {
      counters.contractMissing += 1
      contractPercent = null
    } else if (Number.isFinite(evt?.percent)) {
      contractPercent = evt.percent
    }
    sinceWrite += 1
    const t = now()
    if (sinceWrite >= everyN || t - lastWriteAt >= throttleMs) flush()
  }
  return {
    observe,
    flush,
    counters: () => ({ ...counters }),
    failures: () => writeFailures,
  }
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
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

function loadContract(path) {
  try {
    return readContract(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** 起一个分流器实例(测试与生产共用这一条路径)。
 *
 * `stablePortFallback`:契约缺失/形状坏时的现网端口(由调用方从策略 slots.stable.port 给出)。
 * 没有它就无法「全部回 stable」—— 此时明确 503 并带 `x-ihui-canary-contract: missing`,
 * **不 throw**:handler 里抛异常会打穿到进程层,分流器一死,线上就全不可达。
 */
export function createSplitServer({ contractPath, onLane = null, health = null, stablePortFallback = 0 } = {}) {
  const path = contractPath || DEFAULT_CONTRACT
  const healthCache = health || createHealthCache()
  const handler = async (req, res) => {
    // 契约每次请求现读:部署环改档位后下一枚请求即生效,不需要重启进程。
    const contract = loadContract(path)
    const fallbackPort = Number(stablePortFallback) > 0 ? Number(stablePortFallback) : 0
    let lane = 'stable'
    let percent = 0
    let forced = false
    let bucket = null
    let fellBack = false
    let port = fallbackPort
    const extraHeaders = {}
    if (contract) {
      // 灰度实例在位与否:不健康 ⇒ 命中灰度的流量回落 stable(绝不打到空端口)。
      let canaryUp = true
      if (contract.percent > 0) canaryUp = await healthCache.isUp(contract.canaryPort)
      const picked = laneFor({
        contract,
        headers: req.headers,
        remoteAddress: req.socket?.remoteAddress ?? '',
        canaryUp,
      })
      lane = picked.lane
      percent = picked.percent
      forced = picked.forced
      bucket = picked.bucket
      fellBack = picked.fallback
      port = lane === 'canary' ? contract.canaryPort : contract.stablePort
    } else {
      // 契约缺失 ⇒ 比例 0、全走 stable(文档承诺的那一侧);证据头点名,排障时不必猜。
      extraHeaders['x-ihui-canary-contract'] = 'missing'
    }
    if (onLane) {
      onLane({ lane, percent, forced, bucket, fallback: fellBack, path: req.url, contractMissing: !contract })
    }
    if (!port) {
      res.writeHead(503, {
        'content-type': 'text/plain; charset=utf-8',
        'x-ihui-canary-lane': 'none',
        'x-ihui-canary-contract': 'missing',
      })
      res.end('canary-split: 契约缺失且无现网端口可回(拒绝盲转发)')
      return
    }

    const headers = { ...req.headers }
    for (const h of Object.keys(headers)) {
      if (HOP_HEADERS.has(h.toLowerCase())) delete headers[h]
    }
    headers.host = `127.0.0.1:${port}`
    // 分流证据:下游能从响应头看出这枚请求走了哪条车道(排障用,不参与任何判据)。
    headers['x-ihui-canary-lane'] = lane
    headers['x-ihui-canary-percent'] = String(percent)
    if (fellBack) headers['x-ihui-canary-fallback'] = '1'
    Object.assign(headers, extraHeaders)

    const upstream = http.request(
      { host: '127.0.0.1', port, method: req.method, path: req.url, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, {
          ...up.headers,
          'x-ihui-canary-lane': lane,
          'x-ihui-canary-percent': String(percent),
          ...(fellBack ? { 'x-ihui-canary-fallback': '1' } : {}),
          ...extraHeaders,
        })
        up.pipe(res)
      },
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
      res.end('canary-split upstream error')
    })
    req.pipe(upstream)
  }
  // handler 抛异常不得带走整只进程(契约缺失就是这么把分流器打死的):兜成 502 并留证据。
  return http.createServer((req, res) => {
    handler(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
      res.end('canary-split handler error')
    })
  })
}

/**
 * 现网端口(契约缺失时的回调端口):只从策略单一真相源取;取不到 ⇒ 0(⇒ 503,不猜端口)。
 * 这一枚数字不写死在本文件 —— 与档位/比例同一条纪律(§0.6)。
 */
function policyStablePort() {
  const p = process.env.IHUI_CANARY_POLICY || join(ROOT, 'scripts', 'data', 'canary-policy.json')
  try {
    return loadTrafficPolicy(readFileSync(p, 'utf8')).slots.stable.port
  } catch {
    return 0
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args['self-test']) {
    const c = readContract(JSON.stringify({ percent: 5, slots: { stable: { port: 8801 }, canary: { port: 8845 } }, bucketGranularity: 10000, bucketSalt: 'ihui-deploy-canary' }))
    if (!c) throw new Error('契约解析自检失败')
    if (laneFor({ contract: c, headers: { 'x-canary-tag': 'canary' }, remoteAddress: '' }).lane !== 'canary') {
      throw new Error('强制灰度自检失败')
    }
    if (laneFor({ contract: null, headers: {}, remoteAddress: '1.1.1.1' }).lane !== 'stable') {
      throw new Error('缺契约必须恒 stable')
    }
    // 灰度实例不在位 ⇒ 命中灰度的流量必须回落 stable(绝不打到空端口)
    const fb = laneFor({ contract: c, headers: { 'x-canary-tag': 'canary' }, remoteAddress: '', canaryUp: false })
    if (fb.lane !== 'stable' || !fb.fallback) throw new Error('灰度实例不健康时未回落 stable')
    // 车道计数落盘出口(2026-11-01 立):节流形态 + 契约缺失也计数 + 写失败不吞转发
    {
      const writes = []
      let clock = 0
      const w = createLaneStatsWriter({
        statsPath: 'X:/nowhere/split-stats.json',
        throttleMs: 5000,
        everyN: 4,
        now: () => clock,
        writeFileSync: (_p, text) => writes.push(['.writing', JSON.parse(text)]),
        mkdirSync: () => {},
        renameSync: (_from, to) => writes.push([to, writes.pop()[1]]),
      })
      w.observe({ lane: 'stable', percent: 5, fallback: false, contractMissing: false })
      w.observe({ lane: 'canary', percent: 5, fallback: false, contractMissing: false })
      if (writes.length !== 0) throw new Error('未到节流点就落盘(会把每枚请求变成一次磁盘写)')
      w.observe({ lane: 'stable', percent: 5, fallback: true, contractMissing: false })
      w.observe({ lane: 'stable', percent: 0, fallback: false, contractMissing: true })
      if (writes.length === 0) throw new Error('满 everyN 未落盘 ⇒ 计数出口是摆设')
      if (writes[writes.length - 1][0] !== 'X:/nowhere/split-stats.json')
        throw new Error('落盘没有走改名(读侧会看到半截 JSON)')
      const last = writes[writes.length - 1][1]
      if (last.lanes.stable !== 3 || last.lanes.canary !== 1)
        throw new Error(`车道计数不对:${JSON.stringify(last.lanes)}`)
      if (last.fallback !== 1 || last.contractMissing !== 1)
        throw new Error(`回落/契约缺失未计数:${JSON.stringify(last)}`)
      if (last.contractPercent !== null)
        throw new Error('契约缺失后的那枚必须把比例读点判为取不到(不得留着上一枚的 5 冒充)')
      if (typeof last.updatedAt !== 'string' || !last.updatedAt)
        throw new Error('落盘缺 updatedAt(读侧无法判读数账龄)')
      // 时间维节流:计数未到 everyN,但账龄过了 ⇒ 必须落(否则慢流量整轮没有读数)
      clock += 6000
      w.observe({ lane: 'canary', percent: 5, fallback: false, contractMissing: false })
      const byTime = writes[writes.length - 1][1]
      if (byTime.lanes.canary !== 2) throw new Error('时间维节流未触发落盘')
      // 写不进去 ⇒ 吞住并计数,绝不抛穿到转发路径(抛穿 = 分流器整只死)
      const errs = []
      const boom = createLaneStatsWriter({
        statsPath: 'X:/nowhere/split-stats.json',
        everyN: 1,
        onError: (e, n) => errs.push(`${e?.message}:${n}`),
        writeFileSync: () => {
          throw new Error('磁盘坏了')
        },
        mkdirSync: () => {},
        renameSync: () => {},
      })
      for (let i = 0; i < 5; i += 1)
        boom.observe({ lane: 'stable', percent: 0, fallback: false, contractMissing: false })
      if (boom.failures() !== 5) throw new Error('写失败未被吞住计数(会抛穿转发路径 ⇒ 分流器整只死)')
      if (errs.length !== 5) throw new Error('写失败一条都没点名(哑掉的观测出口等于没有出口)')
      // flush() 必须无条件落一次(演练/退出收尾用,不能只靠节流)
      const once = []
      const fw = createLaneStatsWriter({
        statsPath: 'X:/a/split-stats.json',
        everyN: 9999,
        throttleMs: 9999,
        writeFileSync: (_p, text) => once.push(JSON.parse(text)),
        mkdirSync: () => {},
        renameSync: () => {},
      })
      fw.observe({ lane: 'canary', percent: 10, fallback: false, contractMissing: false })
      if (once.length !== 0) throw new Error('flush 前不应有落盘')
      fw.flush()
      if (once.length !== 1 || once[0].lanes.canary !== 1 || once[0].contractPercent !== 10)
        throw new Error(`flush 收尾没落全:${JSON.stringify(once)}`)
    }
    console.log('ok  分流器自检通过')
    return
  }
  const contractPath = args.contract || DEFAULT_CONTRACT
  const listen = Number(args.listen || process.env.IHUI_CANARY_SPLIT_PORT || 8846)
  const stablePortFallback = Number(args['stable-port']) > 0 ? Number(args['stable-port']) : policyStablePort()
  if (!stablePortFallback) {
    console.error('[canary-split] 现网端口取不到(策略 traffic.slots.stable.port 读不出)⇒ 契约缺失时只能 503,不回退猜端口')
  }
  // 车道计数落盘(2026-11-01 立):CLI 形态必须自带观测出口 —— gray.ps1 起的正是这一条路径,
  // 而它把 stdout 重定向进日志;只 print 一行的话灰度期结束后"放过多少量"就无任何持久产物。
  const statsPath =
    typeof args.stats === 'string' && args.stats ? resolve(String(args.stats)) : DEFAULT_STATS_PATH
  const stats = createLaneStatsWriter({ statsPath })
  const server = createSplitServer({ contractPath, stablePortFallback, onLane: stats.observe })
  server.listen(listen, '127.0.0.1', () => {
    const c = loadContract(contractPath)
    console.log(
      `[canary-split] 监听 127.0.0.1:${listen} 契约=${contractPath} 比例=${c ? c.percent : 0}%` +
      `${c ? '' : `(契约缺失 ⇒ 全部回 stable:${stablePortFallback || '端口不可知 ⇒ 503'})`}` +
      ` 现网回调端口=${stablePortFallback || 'n/a'}` +
      ` 车道计数=${statsPath}`,
    )
    // 落一次初值:即使一枚请求都没进来,也要留下"分流器起过、计数为 0"的证据,
    // 而不是让读侧对着一个不存在的文件猜(§0.3:取不到 ⇒ 未判定,不是 0)。
    stats.flush()
  })
  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      stats.flush()
      process.exit(0)
    })
  }
  process.on('exit', () => stats.flush())
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
// ⁠‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌**‌‎⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
