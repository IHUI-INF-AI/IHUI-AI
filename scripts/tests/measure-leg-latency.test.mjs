#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * measure-leg-latency 的镜像测试(Y-12)。
 *
 * 存在的理由不是"多一层覆盖",而是这把尺子有四格**真机跑不出来**的性质:
 *  ① "没量到"与"零延迟"必须不同形 —— 阶段缺事件只能落 null,分位分母必须如实报 0;
 *  ② 首样本不许污染分位 —— keepalive 档第 1 条必然带握手,tcp/tls 占比会算成 200%;
 *  ③ 外部正证拿不到时必须**点名缺哪把凭据**,而不是一句 HTTP 401 或者静默当"没问题";
 *  ④ 结论必须落到量级 —— 主导维度要按绝对毫秒挑,不能按"占总数比例"挑(总体都慢时会洗掉主导项)。
 * 这四条都在纯函数面上,所以用构造输入钉住,不联网。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../measure-leg-latency.mjs')
const mod = await import(pathToFileURL(SRC).href)
const T = mod.__test__
const src = fs.readFileSync(SRC, 'utf8')

test('分位:空样本给 null,不给 0(没量到 ≠ 零延迟)', () => {
  assert.equal(T.percentile([], 0.5), null)
  assert.equal(T.percentile([1, 2, 3], 0.5), 2)
  assert.equal(T.percentile([1, 2, 3, 4], 0.95), 4)
  assert.equal(T.percentile([5], 0.95), 5)
})

test('阶段切分:缺事件 ⇒ 该阶段 null,不拿 0 补齐', () => {
  const p = T.derivePhases({ startAt: 100, lookupAt: 110, connectAt: 150, secureAt: 200, responseAt: 350, endAt: 360 })
  assert.equal(p.dnsMs, 10)
  assert.equal(p.tcpMs, 40)
  assert.equal(p.tlsMs, 50)
  assert.equal(p.originMs, 150)
  assert.equal(p.totalMs, 260)

  // 复用连接:没有 lookup/connect/secure 事件
  const reused = T.derivePhases({ startAt: 0, responseAt: 120, endAt: 130 })
  assert.equal(reused.dnsMs, null)
  assert.equal(reused.tcpMs, null)
  assert.equal(reused.tlsMs, null)
  assert.equal(reused.originMs, 120, '锚点回落到最近可得阶段,而不是 0')
})

test('describeSeries:全 null 时 n=0 且各分位 null(分母如实)', () => {
  const s = T.describeSeries([null, null])
  assert.equal(s.n, 0)
  assert.equal(s.p50, null)
  assert.equal(s.p95, null)
  const ok = T.describeSeries([100, 200, 300, 400])
  assert.equal(ok.n, 4)
  assert.equal(ok.p50, 200)
  assert.ok(ok.cv > 0)
})

test('形态:冷启动 / 均匀排队 / 长尾 / 判不出,四档不硬套', () => {
  const cold = T.classifyShape([3000, 200, 210, 205, 215, 200, 208])
  assert.equal(cold.shape, 'coldStart')

  const uniform = T.classifyShape([1200, 1210, 1195, 1205, 1202, 1198, 1201])
  assert.equal(uniform.shape, 'uniformQueue')

  const tail = T.classifyShape([300, 310, 320, 900, 1500, 310, 330])
  assert.equal(tail.shape, 'longTail')

  const few = T.classifyShape([1, 2, 3])
  assert.equal(few.shape, 'unclassified', '样本不足不得给档名')
})

test('主导维度按绝对毫秒挑,不被占比洗掉', () => {
  const d = T.dominantPhase({ dnsMs: 4, tcpMs: 420, tlsMs: 350, originMs: 430 })
  assert.equal(d.phase, 'originMs')
  const partial = T.dominantPhase({ originMs: 220 })
  assert.equal(partial.phase, 'originMs')
  assert.match(String(partial.reason), /1\/4/, '缺段时必须写明只按可得段判')
  assert.equal(T.dominantPhase({}).phase, null)
})

test('投递读数:数组/包装/字符串都能读,缺 duration 判 undetermined', () => {
  const rows = [
    { duration: 690, delivered_at: '2026-10-29T03:03:46Z', status_code: 200 },
    { duration: 8340, delivered_at: '2026-10-29T03:06:03Z', status_code: 200 },
    { duration: '1200', delivered_at: '2026-10-29T03:05:00Z', status_code: 500 },
  ]
  const sum = T.summarizeDeliveries({ deliveries: rows })
  assert.equal(sum.ok, true)
  assert.equal(sum.n, 3)
  assert.equal(sum.max, 8340)
  assert.equal(sum.success, 2)
  assert.equal(sum.failure, 1)
  assert.equal(sum.over2000, 1)
  assert.equal(sum.window.from, '2026-10-29T03:03:46Z')

  const bad = T.summarizeDeliveries({ deliveries: [{ status: 'ok' }] })
  assert.equal(bad.ok, false)
  assert.match(bad.reason, /未判定/)

  assert.equal(T.summarizeDeliveries(null).ok, false)
})

test('gh 失败必须点名缺哪把凭据(App JWT),不是一句 401', () => {
  const r = T.explainGhFailure('gh: Not Found (HTTP 404)', 1)
  assert.match(r, /GITHUB_APP_ID/)
  assert.match(r, /GITHUB_APP_PRIVATE_KEY/)
  assert.match(T.explainGhFailure('A JSON web token could not be decoded', 1), /App JWT/)
  assert.match(T.explainGhFailure('gh: command not found', 127), /PATH/)
})

test('配对必须同路径才算;跨腿差值可复算', () => {
  const pairs = T.buildPairs([
    { id: 'api-appver', url: 'https://api.aizhs.top/api/app-version/latest?platform=android', verdict: 'measured', phases: { totalMs: { p50: 1333 }, originMs: { p50: 288 } } },
    { id: 'www-appver', url: 'https://www.aizhs.top/api/app-version/latest?platform=android', verdict: 'measured', phases: { totalMs: { p50: 307 }, originMs: { p50: 193 } } },
    { id: 'api-health', url: 'https://api.aizhs.top/api/health', verdict: 'measured', phases: { totalMs: { p50: 975 }, originMs: { p50: 278 } } },
  ])
  assert.equal(pairs.length, 1)
  assert.equal(pairs[0].deltaP50, 1026)
  assert.equal(pairs[0].deltaOriginP50, 95)
  assert.equal(pairs[0].ratio, 4.34)
})

test('colo 解析:取不到自报体 ⇒ undetermined,不猜机房', () => {
  const none = T.extractColo([{ id: 'api-trace', bodyHead: null }])
  assert.equal(none.status, 'undetermined')
  const ok = T.extractColo([{ id: 'api-trace', bodyHead: 'fl=abc\nh=api.aizhs.top\ncolo=AMS\nloc=CN\ntls=TLSv1.3\n' }])
  assert.equal(ok.colo, 'AMS')
  assert.equal(ok.clientLoc, 'CN')
  const noColo = T.extractColo([{ id: 'api-trace', bodyHead: 'hello\n' }])
  assert.equal(noColo.status, 'undetermined')
})

test('CLI:参数错要退回用法错,target 必须 id=url', () => {
  assert.equal(T.parseArgs(['--samples', '0']).error !== undefined, true)
  assert.equal(T.parseArgs(['--target', 'nourl']).error !== undefined, true)
  assert.equal(T.parseArgs(['--nope']).error !== undefined, true)
  const ok = T.parseArgs(['--samples', '5', '--keepalive', '--target', 'x=https://example.com/'])
  assert.equal(ok.samples, 5)
  assert.equal(ok.keepalive, true)
  assert.equal(ok.targets[0].id, 'x')
})

test('形状锁:默认档必须显式 keepAlive:false(Node 19+ globalAgent 会偷偷复用)', () => {
  assert.match(src, /keepAlive: keepalive/)
  assert.match(src, /built|Node 19\+/, '注释里必须写明为什么显式传,防止被"简化"回去')
})

test('形状锁:外部正证缺失不得阻断本机读数,但必须写进结论', () => {
  assert.match(src, /externalEvidence/)
  assert.match(src, /不得据此判"腿坏"/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
