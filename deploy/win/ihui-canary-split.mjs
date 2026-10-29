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
 *   - 契约缺失/形状坏 ⇒ 比例按 0 处理(全部回 stable),绝不「猜一个比例放量」。
 *
 * 用法:
 *   node deploy/win/ihui-canary-split.mjs --contract <ramp.json> --listen <port>
 */

import http from 'node:http'
import net from 'node:net'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { selectTrafficLane } from '../../scripts/canary-traffic.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DEFAULT_CONTRACT = join(ROOT, '.ihui-agent', 'state', 'canary', 'ramp.json')

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
export function probePort(port, { timeoutMs = PROBE_TIMEOUT_MS } = {}) {
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

/** 起一个分流器实例(测试与生产共用这一条路径)。 */
export function createSplitServer({ contractPath, onLane = null, health = null } = {}) {
  const path = contractPath || DEFAULT_CONTRACT
  const healthCache = health || createHealthCache()
  return http.createServer(async (req, res) => {
    // 契约每次请求现读:部署环改档位后下一枚请求即生效,不需要重启进程。
    const contract = loadContract(path)
    // 灰度实例在位与否:不健康 ⇒ 命中灰度的流量回落 stable(绝不打到空端口)。
    let canaryUp = true
    if (contract && contract.percent > 0) {
      canaryUp = await healthCache.isUp(contract.canaryPort)
    }
    const { lane, percent, forced, bucket, fallback } = laneFor({
      contract,
      headers: req.headers,
      remoteAddress: req.socket?.remoteAddress ?? '',
      canaryUp,
    })
    const port = lane === 'canary' ? contract.canaryPort : contract.stablePort
    if (onLane) onLane({ lane, percent, forced, bucket, fallback, path: req.url })

    const headers = { ...req.headers }
    for (const h of Object.keys(headers)) {
      if (HOP_HEADERS.has(h.toLowerCase())) delete headers[h]
    }
    headers.host = `127.0.0.1:${port}`
    // 分流证据:下游能从响应头看出这枚请求走了哪条车道(排障用,不参与任何判据)。
    headers['x-ihui-canary-lane'] = lane
    headers['x-ihui-canary-percent'] = String(percent)
    if (fallback) headers['x-ihui-canary-fallback'] = '1'

    const upstream = http.request(
      { host: '127.0.0.1', port, method: req.method, path: req.url, headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, {
          ...up.headers,
          'x-ihui-canary-lane': lane,
          'x-ihui-canary-percent': String(percent),
          ...(fallback ? { 'x-ihui-canary-fallback': '1' } : {}),
        })
        up.pipe(res)
      },
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' })
      res.end('canary-split upstream error')
    })
    req.pipe(upstream)
  })
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
    console.log('ok  分流器自检通过')
    return
  }
  const contractPath = args.contract || DEFAULT_CONTRACT
  const listen = Number(args.listen || process.env.IHUI_CANARY_SPLIT_PORT || 8846)
  const server = createSplitServer({ contractPath })
  server.listen(listen, '127.0.0.1', () => {
    const c = loadContract(contractPath)
    console.log(
      `[canary-split] 监听 127.0.0.1:${listen} 契约=${contractPath} 比例=${c ? c.percent : 0}%` +
      `${c ? '' : '(契约缺失 ⇒ 全部回 stable)'}`,
    )
  })
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
// ⁠‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌‌‍‍‌**‌‎⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
