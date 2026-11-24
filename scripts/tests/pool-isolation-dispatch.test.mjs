// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池隔离体检腿的节流冷却锁(2026-11-05 立)。
 *
 * 立因:这条腿的头注写着「失败只冷却 1 小时(成功才按 6 小时窗口)」,但它落笔的失败态有
 * 两个名字 —— 器物自己报的 `undetermined`,和结论行根本没取到的 `no-result-line`;窗口判据
 * 原先只认前者,于是派发超时那一类轮次一律等满 6 小时。同族的永久保活腿已由
 * scripts/tests/keepalive-forever-dispatch.test.mjs 的 T9 钉住同一格,而这条腿此前**一条派发
 * 测试都没有**(它只在 daemon-audit-fanout 的清单里出现过名字),所以那句承诺空转了多久无人可查。
 *
 * 判据一律 import 生产端(__test__ 出口),测试内零复算(§22c);零真库、零真尺子派生。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as guardian } from '../git-guardian.mjs'

const { sweepPoolIsolation } = guardian

const HOUR = 60 * 60 * 1000
const NOW = Date.parse('2026-11-01T00:00:00Z')

function harness(t, out) {
  const dir = mkScratch('pool-isolation-dispatch')
  t.after(() => rmScratch(dir))
  const calls = []
  const logs = []
  const mails = []
  const opts = {
    now: NOW,
    tickFile: join(dir, 'tick.json'),
    logger: (m) => logs.push(String(m)),
    notify: (title, body, o) => mails.push({ title, body, dedupKey: o?.dedupKey ?? '' }),
    runner: () => {
      calls.push({ tickWritten: existsSync(join(dir, 'tick.json')) })
      return { ok: true, out, status: 0 }
    },
  }
  return { dir, calls, logs, mails, opts }
}

test('P0 出口在位:没被 __test__ 导出的腿根本测不到,承诺就只能空转', () => {
  assert.equal(typeof sweepPoolIsolation, 'function')
})

test('P1 上一轮结论行取不到(no-result-line)⇒ 2 小时后必须重试,不等满 6 小时', (t) => {
  const h = harness(t, '这里没有 POOL-ISOLATION 结论行,只有一句人读日志')
  const first = sweepPoolIsolation(h.opts)
  assert.equal(first.ran, true)
  assert.equal(first.state, 'no-result-line', '落笔形态必须是这个名字,否则 P1 测的不是这一格')
  h.opts.now = NOW + 2 * HOUR
  assert.equal(sweepPoolIsolation(h.opts).ran, true, '尺子哑了就按 1 小时冷却(头注原话)')
})

test('P2 反向牙:breach 是有效判定,仍按 6 小时窗口(不许压成每小时重撞)', (t) => {
  const h = harness(t, 'POOL-ISOLATION state=breach total=4')
  const first = sweepPoolIsolation(h.opts)
  assert.equal(first.state, 'breach')
  h.opts.now = NOW + 2 * HOUR
  assert.equal(sweepPoolIsolation(h.opts).ran, false, 'breach 已喊过人,每小时重撞就是噪声')
  h.opts.now = NOW + 7 * HOUR
  assert.equal(sweepPoolIsolation(h.opts).ran, true, '满 6 小时窗口仍要给下一次机会')
})

test('P3 undetermined 维持既有 1 小时冷却(这次改动不许把已经对的那格改错)', (t) => {
  const h = harness(t, 'POOL-ISOLATION state=undetermined total=?')
  const first = sweepPoolIsolation(h.opts)
  assert.equal(first.state, 'undetermined')
  h.opts.now = NOW + 2 * HOUR
  assert.equal(sweepPoolIsolation(h.opts).ran, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
