#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `deploy/win/ihui-canary-split.mjs` 的镜像测试(§22c:判据 import 源脚本,本文件不复制判据)。
 *
 * 钉「金丝雀发布」票面的第一格 —— 灰度分流的**执行体**行为:
 *  ① 契约面:坏契约 ⇒ null ⇒ 比例 0(绝不回落默认值放量)。
 *  ② 车道面:同 key 稳定、强制头覆盖、缺契约恒 stable。
 *  ③ 健康面:灰度实例不在位 ⇒ 命中灰度的流量**回落 stable**(绝不打到空端口)。
 *  ④ 端到端:真起分流器 + 两个假上游,验比例切流与强制头确实落到不同上游。
 *
 * 本文件不连生产、不连真实部署环:上游是两个只回显自身端口的本地假服务。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../../scripts/lib/scratch-dir.mjs'
import { readContract, routingKeyOf, laneFor, createHealthCache, createSplitServer } from '../win/ihui-canary-split.mjs'

const CONTRACT_JSON = (percent, extra = {}) => JSON.stringify({
  v: 1,
  stage: percent > 0 ? 'ramp-1' : 'off',
  percent,
  routingKeyHeader: 'x-ihui-canary-key',
  tagHeader: 'x-canary-tag',
  bucketGranularity: 10000,
  bucketSalt: 'ihui-deploy-canary',
  slots: { stable: { port: 8801 }, canary: { port: 8845 } },
  ...extra,
})

const listen = (server) => new Promise((res) => server.listen(0, '127.0.0.1', () => res(server.address().port)))

/** 只回显自身端口的假上游(扮演 stable / canary 两个槽位)。 */
async function startEchoUpstream() {
  const srv = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end(`upstream:${srv.address().port}`)
  })
  const port = await listen(srv)
  return { srv, port }
}

// 临时夹具落点 = scripts/lib/scratch-dir.mjs 唯一出口(§15b;不得用 os.tmpdir():
// 进程 TEMP 可能仍钉在 C 盘 ⇒ 门 155 的名单型判据)。
let scratchDir = null
function contractFile(content) {
  if (!scratchDir) scratchDir = mkScratch('canary-split-')
  const p = join(scratchDir, `ramp-${process.pid}-${Math.random().toString(36).slice(2)}.json`)
  writeFileSync(p, content, 'utf8')
  return p
}

test.after(() => {
  if (scratchDir) {
    try {
      rmScratch(scratchDir)
    } catch { /* 清理失败只由 §26 的每日 Temp 体检兜,不在这里改判据结论 */ }
    scratchDir = null
  }
})

test('T1 契约面:形状坏 ⇒ null(⇒ 比例 0,绝不回落默认放量)', () => {
  assert.equal(readContract('{ not json'), null)
  assert.equal(readContract('null'), null)
  assert.equal(readContract('[]'), null)
  assert.equal(readContract(JSON.stringify({ percent: 5 })), null, '缺 slots ⇒ null')
  assert.equal(readContract(JSON.stringify({ percent: 'abc', slots: { stable: { port: 1 }, canary: { port: 2 } } })), null)
  assert.equal(readContract(JSON.stringify({ percent: -1, slots: { stable: { port: 1 }, canary: { port: 2 } } })), null)
  assert.equal(readContract(JSON.stringify({ percent: 101, slots: { stable: { port: 1 }, canary: { port: 2 } } })), null)
  assert.equal(readContract(JSON.stringify({ percent: 5, slots: { stable: { port: 8801 }, canary: { port: 8801 } } })), null, '同端口 ⇒ null')
  assert.equal(readContract(JSON.stringify({ percent: 5, slots: { stable: { port: 8801 }, canary: { port: 0 } } })), null)
  assert.equal(readContract(JSON.stringify({ percent: 5, slots: { stable: { port: 8801 }, canary: { port: 8845 } } })), null, '缺桶粒度 ⇒ null')
  assert.equal(readContract(JSON.stringify({ percent: 5, slots: { stable: { port: 8801 }, canary: { port: 8845 } }, bucketGranularity: 10000 })), null, '缺 salt ⇒ null')
})

test('T2 契约面:合法契约 ⇒ 解析出比例/槽位/桶口径,头名小写归一', () => {
  const c = readContract(CONTRACT_JSON(5))
  assert.ok(c)
  assert.equal(c.percent, 5)
  assert.equal(c.stage, 'ramp-1')
  assert.equal(c.stablePort, 8801)
  assert.equal(c.canaryPort, 8845)
  assert.equal(c.granularity, 10000)
  assert.equal(c.salt, 'ihui-deploy-canary')
  assert.equal(c.routingKeyHeader, 'x-ihui-canary-key')
  assert.equal(c.tagHeader, 'x-canary-tag')
})

test('T3 路由键:优先取契约指定的请求头,缺省回落客户端 IP', () => {
  assert.equal(routingKeyOf({ 'x-ihui-canary-key': 'u-1' }, '10.0.0.1', 'x-ihui-canary-key'), 'u-1')
  assert.equal(routingKeyOf({ 'x-ihui-canary-key': '  u-2  ' }, '10.0.0.1', 'x-ihui-canary-key'), 'u-2')
  assert.equal(routingKeyOf({}, '10.0.0.1', 'x-ihui-canary-key'), '10.0.0.1')
  assert.equal(routingKeyOf({}, '', 'x-ihui-canary-key'), '', '取不到 key ⇒ 空串(不携带身份信息)')
  assert.equal(routingKeyOf({ 'x-ihui-canary-key': ['u-3', 'u-4'] }, '', 'x-ihui-canary-key'), 'u-3', '数组头取第一个')
})

test('T4 车道面:缺契约 ⇒ 恒 stable(比例 0)', () => {
  const r = laneFor({ contract: null, headers: {}, remoteAddress: '1.1.1.1' })
  assert.equal(r.lane, 'stable')
  assert.equal(r.percent, 0)
  assert.equal(r.fallback, false)
})

test('T5 车道面:同 key 稳定、强制头覆盖、比例边界', () => {
  const c = readContract(CONTRACT_JSON(5))
  const a = laneFor({ contract: c, headers: { 'x-ihui-canary-key': 'u-1' }, remoteAddress: '' })
  const b = laneFor({ contract: c, headers: { 'x-ihui-canary-key': 'u-1' }, remoteAddress: '' })
  assert.equal(a.lane, b.lane, '同一 key 必须恒定')
  assert.equal(a.bucket, b.bucket)

  const forced = laneFor({ contract: c, headers: { 'x-canary-tag': 'canary' }, remoteAddress: '' })
  assert.equal(forced.lane, 'canary')
  assert.equal(forced.forced, true)

  const pinned = laneFor({ contract: c, headers: { 'x-canary-tag': 'stable' }, remoteAddress: '' })
  assert.equal(pinned.lane, 'stable')
  assert.equal(pinned.forced, true)

  // 比例 0 ⇒ 恒 stable;比例 100 ⇒ 恒 canary
  const zero = readContract(CONTRACT_JSON(0))
  assert.equal(laneFor({ contract: zero, headers: {}, remoteAddress: '1.1.1.1' }).lane, 'stable')
  const full = readContract(CONTRACT_JSON(100))
  assert.equal(laneFor({ contract: full, headers: {}, remoteAddress: '1.1.1.1' }).lane, 'canary')
})

test('T6 健康面:灰度实例不在位 ⇒ 命中灰度的流量回落 stable(绝不打到空端口)', () => {
  const c = readContract(CONTRACT_JSON(5))
  const fb = laneFor({ contract: c, headers: { 'x-canary-tag': 'canary' }, remoteAddress: '', canaryUp: false })
  assert.equal(fb.lane, 'stable', '灰度实例不健康 ⇒ 必须回落现网')
  assert.equal(fb.fallback, true, '回落要留证据')
  assert.equal(fb.forced, true, '强制头也回落(运维探针打空端口 ⇒ 502 比回现网坏)')

  // 正常时同一请求不回落
  const ok = laneFor({ contract: c, headers: { 'x-canary-tag': 'canary' }, remoteAddress: '', canaryUp: true })
  assert.equal(ok.lane, 'canary')
  assert.equal(ok.fallback, false)
})

test('T7 健康缓存:TTL 内复用结果,过期后重探', async () => {
  let probes = 0
  const cache = createHealthCache({ ttlMs: 1000, probe: async () => { probes += 1; return true } })
  assert.equal(await cache.isUp(8845, 1000), true)
  assert.equal(await cache.isUp(8845, 1500), true)
  assert.equal(probes, 1, 'TTL 内不得重复探(每枚请求都探会把本机 TCP 栈打满)')
  assert.equal(await cache.isUp(8845, 2500), true)
  assert.equal(probes, 2, 'TTL 过期后必须重探')
})

test('T8 端到端:分流器按比例把请求切给两个上游,并留下车道证据头', async () => {
  const stable = await startEchoUpstream()
  const canary = await startEchoUpstream()
  const path = contractFile(CONTRACT_JSON(100, {
    slots: { stable: { port: stable.port }, canary: { port: canary.port } },
  }))
  const split = createSplitServer({ contractPath: path, health: { isUp: async () => true } })
  const splitPort = await listen(split)
  try {
    const res = await fetch(`http://127.0.0.1:${splitPort}/probe`, { headers: { 'x-ihui-canary-key': 'u-1' } })
    const body = await res.text()
    assert.equal(res.status, 200)
    assert.equal(body, `upstream:${canary.port}`, '比例 100 ⇒ 全切 canary 上游')
    assert.equal(res.headers.get('x-ihui-canary-lane'), 'canary')
    assert.equal(res.headers.get('x-ihui-canary-percent'), '100')

    // 强制头 stable ⇒ 落到 stable 上游
    const res2 = await fetch(`http://127.0.0.1:${splitPort}/probe`, { headers: { 'x-canary-tag': 'stable' } })
    assert.equal(await res2.text(), `upstream:${stable.port}`)
    assert.equal(res2.headers.get('x-ihui-canary-lane'), 'stable')
  } finally {
    split.close()
    stable.srv.close()
    canary.srv.close()
  }
})

test('T9 端到端:比例 0 ⇒ 全部走 stable;缺契约 ⇒ 也全部走 stable', async () => {
  const stable = await startEchoUpstream()
  const canary = await startEchoUpstream()
  const zeroPath = contractFile(CONTRACT_JSON(0, {
    slots: { stable: { port: stable.port }, canary: { port: canary.port } },
  }))
  const split = createSplitServer({ contractPath: zeroPath, health: { isUp: async () => true } })
  const splitPort = await listen(split)
  try {
    const res = await fetch(`http://127.0.0.1:${splitPort}/probe`, { headers: { 'x-ihui-canary-key': 'u-1' } })
    assert.equal(await res.text(), `upstream:${stable.port}`, '比例 0 ⇒ 恒现网')
    assert.equal(res.headers.get('x-ihui-canary-percent'), '0')
  } finally {
    split.close()
    stable.srv.close()
    canary.srv.close()
  }
})

test('T10 端到端:灰度上游不在位 ⇒ 请求不得打到空端口(回落 stable 且带 fallback 证据)', async () => {
  const stable = await startEchoUpstream()
  // canary 端口指向一个没人监听的端口 ⇒ 模拟"灰度实例还没起"
  const deadPort = await (async () => {
    const s = createServer(() => {})
    const p = await listen(s)
    await new Promise((r) => s.close(r))
    return p
  })()
  const path = contractFile(CONTRACT_JSON(100, {
    slots: { stable: { port: stable.port }, canary: { port: deadPort } },
  }))
  const split = createSplitServer({
    contractPath: path,
    health: { isUp: async (port) => port === stable.port },
  })
  const splitPort = await listen(split)
  try {
    const res = await fetch(`http://127.0.0.1:${splitPort}/probe`, { headers: { 'x-ihui-canary-key': 'u-1' } })
    assert.equal(res.status, 200, '不得 502(打空端口)')
    assert.equal(await res.text(), `upstream:${stable.port}`, '灰度实例不在位 ⇒ 回落现网')
    assert.equal(res.headers.get('x-ihui-canary-lane'), 'stable')
    assert.equal(res.headers.get('x-ihui-canary-fallback'), '1')
  } finally {
    split.close()
    stable.srv.close()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
