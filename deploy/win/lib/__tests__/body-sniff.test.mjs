// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { SNIFF_POLICY, shouldSniff, sniffBody, createRollingScanner } from '../body-sniff.mjs'
import { inspectBody } from '../waf-signatures.mjs'

/** 假请求流:`unshift` 与原 Readable 一致,用来验证"读完能不能放回去"。 */
class FakeReq extends Readable {
  constructor(chunks, { end = true } = {}) {
    super()
    this.pending = [...chunks]
    this.willEnd = end
    this.resumed = false
  }

  _read() {
    const next = this.pending.shift()
    if (next) {
      this.push(next)
      return
    }
    if (this.willEnd) this.push(null)
  }

  resume() {
    this.resumed = true
    return super.resume()
  }
}

/** 把流读干,用于验证 unshift 回去的字节是否完整。pause 过的流必须显式 resume。 */
function drain(req, timeoutMs = 800) {
  return new Promise((resolve, reject) => {
    const out = []
    const t = setTimeout(() => reject(new Error('drain timeout')), timeoutMs)
    req.on('data', (c) => out.push(c))
    req.on('end', () => {
      clearTimeout(t)
      resolve(Buffer.concat(out))
    })
    req.on('error', (e) => {
      clearTimeout(t)
      reject(e)
    })
    req.resume()
  })
}

const H = (over = {}) => ({ 'content-length': '0', ...over })

test('无 content-length 不嗅探(长度未知就不能保证放得回去)', () => {
  assert.equal(shouldSniff({}).why, 'no-length')
})

test('8192 以上不再是"不嗅探",而是改走流式', () => {
  const r = shouldSniff(H({ 'content-length': String(SNIFF_POLICY.limitBytes + 1) }))
  assert.equal(r.sniff, true)
  assert.equal(r.stream, true)
})

test('multipart 小体嗅、大 body 不嗅', () => {
  assert.equal(shouldSniff(H({ 'content-length': '300', 'content-type': 'multipart/form-data; boundary=x' })).sniff, true)
  assert.equal(shouldSniff(H({ 'content-length': '4000', 'content-type': 'multipart/form-data; boundary=x' })).why, 'multipart')
})

test('正常 JSON 体嗅探并给出 expected', () => {
  const r = shouldSniff(H({ 'content-length': '120', 'content-type': 'application/json' }))
  assert.equal(r.sniff, true)
  assert.equal(r.expected, 120)
})

test('chunked 也要嗅探,且走流式(带 content-length 时以 chunked 为准)', () => {
  const r = shouldSniff(H({ 'transfer-encoding': 'chunked', 'content-length': '100' }))
  assert.equal(r.sniff, true)
  assert.equal(r.why, 'chunked')
  assert.equal(r.stream, true)
  assert.equal(r.expected, SNIFF_POLICY.streamLimitBytes)
})

test('chunked 小体:没读够就 end ⇒ 文本仍可判定,且带回整段用于重放', async () => {
  const payload = Buffer.from('{"q":"1 union select 1,2 from users"}')
  const req = new FakeReq([payload])
  const r = await sniffBody(req, { expected: SNIFF_POLICY.limitBytes })
  assert.equal(r.why, 'end')
  assert.equal(r.text, payload.toString('utf8'))
  assert.equal(r.restored, false)
  assert.equal(r.merged.toString('utf8'), payload.toString('utf8'))
})

test('chunked 大体:读够 limit 即停,unshift 有效且剩余字节仍在流里', async () => {
  const head = Buffer.from('x'.repeat(SNIFF_POLICY.limitBytes))
  const tail = Buffer.from('TAIL-DATA')
  const req = new FakeReq([head, tail])
  const r = await sniffBody(req, { expected: SNIFF_POLICY.limitBytes })
  assert.equal(r.why, 'full')
  assert.equal(r.restored, true)
  const again = await drain(req)
  assert.equal(again.length, head.length + tail.length)
  assert.equal(again.toString('utf8'), 'x'.repeat(SNIFF_POLICY.limitBytes) + 'TAIL-DATA')
})

test('读完 100 字节:why=full 且文本正确', async () => {
  const payload = Buffer.from('a'.repeat(100))
  const req = new FakeReq([payload])
  const r = await sniffBody(req, { expected: 100 })
  assert.equal(r.why, 'full')
  assert.equal(r.bytes, 100)
  assert.equal(r.text, 'a'.repeat(100))
  assert.equal(r.restored, true)
})

test('最关键的一条:unshift 之后上游还能读到完整的 100 字节(不多不少)', async () => {
  const payload = Buffer.from(JSON.stringify({ q: 'select * from t' }))
  const req = new FakeReq([payload])
  const r = await sniffBody(req, { expected: payload.length })
  assert.equal(r.why, 'full')
  const again = await drain(req)
  assert.equal(again.length, payload.length)
  assert.equal(again.toString('utf8'), payload.toString('utf8'))
})

test('分多个 chunk 到达也能拼完整并放回', async () => {
  const parts = [Buffer.from('abc'), Buffer.from('defg'), Buffer.from('hij')]
  const req = new FakeReq(parts)
  const r = await sniffBody(req, { expected: 10 })
  assert.equal(r.why, 'full')
  assert.equal(r.text, 'abcdefghij')
  const again = await drain(req)
  assert.equal(again.toString('utf8'), 'abcdefghij')
})

test('body 比声明短(end 先到):整段仍然可判定,并带回 merged 供转发层重放', async () => {
  const req = new FakeReq([Buffer.from('short')])
  const r = await sniffBody(req, { expected: 100 })
  assert.equal(r.why, 'end')
  // 以前这里判 text=null(等于对"谎报长度的请求"完全不扫);
  // 现在 end 已代表"整段都拿到了",扫它才是正确方向 —— 谎报短恰恰是绕过手法之一。
  assert.equal(r.text, 'short')
  assert.equal(r.restored, false)
  assert.equal(r.merged.toString('utf8'), 'short')
})

test('超时:放弃判定,已读字节仍放回', async () => {
  const req = new FakeReq([Buffer.from('half')], { end: false })
  const r = await sniffBody(req, { expected: 10, deadlineMs: 60 })
  assert.equal(r.why, 'timeout')
  assert.equal(r.text, null)
  assert.equal(r.restored, true)
})

test('溢出保护:远超 limit 立刻放弃(不吃内存)', async () => {
  const big = Buffer.from('x'.repeat(SNIFF_POLICY.limitBytes * 3))
  const req = new FakeReq([big])
  const r = await sniffBody(req, { expected: SNIFF_POLICY.limitBytes })
  assert.equal(r.why, 'overflow')
  assert.equal(r.text, null)
})

// ── 流式滚动扫描(2026-11-25 补:大体不再整段缓冲) ─────────────────────
// 这一组把 8192 那个上限抬掉了 —— 以前"9000 字节填充在前 + 载荷在后"是公开的绕过配方。

test('大体改走流式:超过一次读上限、未超流式上限 ⇒ stream', () => {
  const r = shouldSniff({ 'content-length': String(SNIFF_POLICY.limitBytes + 5000) })
  assert.equal(r.sniff, true)
  assert.equal(r.stream, true)
  assert.equal(r.why, 'stream-large')
})

test('超过流式上限(256KB)才放弃 —— 这是有意画出的边界', () => {
  const r = shouldSniff({ 'content-length': String(SNIFF_POLICY.streamLimitBytes + 1) })
  assert.equal(r.sniff, false)
  assert.equal(r.why, 'too-large')
})

test('chunked 走流式(不消费原流,因此没有回放问题)', () => {
  const r = shouldSniff({ 'transfer-encoding': 'chunked' })
  assert.equal(r.sniff, true)
  assert.equal(r.stream, true)
})

test('流式:载荷被切在两个 chunk 之间也能拼上(窗口存在的理由)', () => {
  const payload = '{"pad":"' + 'a'.repeat(300) + '","q":"1 union select 1,2 from users"}'
  const cut = payload.indexOf('union') + 3
  const scanner = createRollingScanner({ inspect: inspectBody })
  assert.equal(scanner.push(Buffer.from(payload.slice(0, cut))), null)
  const hits = scanner.push(Buffer.from(payload.slice(cut)))
  assert.ok(hits && hits.some((h) => h.id === 'sqli-union-select-body'))
  assert.equal(scanner.stopReason, 'hit')
})

test('流式:载荷藏在大体尾部(9000B 填充在前)也能扫到 —— 拔掉旧绕过配方', () => {
  const payload = '{"pad":"' + 'x'.repeat(9000) + '","q":"1 union select 1,2 from users"}'
  const scanner = createRollingScanner({ inspect: inspectBody })
  let hit = null
  for (let i = 0; i < payload.length && !hit; i += 1024) {
    hit = scanner.push(Buffer.from(payload.slice(i, i + 1024)))
  }
  assert.ok(hit && hit.some((h) => h.id === 'sqli-union-select-body'))
})

test('流式:同样体积的正常体不误伤', () => {
  const payload = '{"pad":"' + 'x'.repeat(9000) + '","note":"hello world"}'
  const scanner = createRollingScanner({ inspect: inspectBody })
  let hit = null
  for (let i = 0; i < payload.length; i += 1024) hit = scanner.push(Buffer.from(payload.slice(i, i + 1024)))
  assert.equal(hit, null)
  assert.equal(scanner.stopReason, null)
})

test('流式:超过上限立刻停,之后不再判(边界而非漏判)', () => {
  const scanner = createRollingScanner({ inspect: inspectBody, limit: 2048 })
  assert.equal(scanner.push(Buffer.from('x'.repeat(4096))), null)
  assert.equal(scanner.stopReason, 'limit')
  assert.equal(scanner.push(Buffer.from('{"q":"1 union select 1,2 from users"}')), null)
})

test('流式:inspect 缺失立刻报错(不能静默退化成"永不命中")', () => {
  assert.throws(() => createRollingScanner({}), /inspect/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
