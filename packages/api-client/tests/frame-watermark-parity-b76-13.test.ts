// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-13 票1:帧水位判据的**双面同形对账**(api-client 零依赖包边界,先例:
// error-serialize / stream-trace-id 判例表模式 —— 本包不得 import @ihui/shared,
// 两份实现靠**同一张判例表**钉住:shared 侧测试(sse-frame-watermark-b76-13.test.ts)
// 与本测试各跑同表,任何一侧改规则而表不同步,该侧就红。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  isFrameGap,
  readFrameWatermark,
  type FrameWatermarkCursor,
} from '../src/frame-watermark'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')

// ⚠️ 本表与 packages/shared/tests/sse-frame-watermark-b76-13.test.ts 的表**逐字同表**
// (不是平行判例):改任何一侧判例必须两侧同改,否则对账降级成自证。
const READ_CASES: Array<{ name: string; frame: unknown; verdict: string }> = [
  { name: 'ok-camel', frame: { subscriptionId: 's', logEpoch: 1, fromSeq: 5, toSeq: 6 }, verdict: 'ok' },
  { name: 'ok-snake', frame: { subscription_id: 's', log_epoch: 1, from_seq: 0, to_seq: 5 }, verdict: 'ok' },
  { name: 'inverted-range', frame: { subscriptionId: 's', logEpoch: 1, fromSeq: 7, toSeq: 3 }, verdict: 'invalid' },
  { name: 'negative-epoch', frame: { subscriptionId: 's', logEpoch: -1, fromSeq: 0, toSeq: 1 }, verdict: 'invalid' },
  { name: 'empty', frame: {}, verdict: 'undetermined' },
  { name: 'partial', frame: { logEpoch: 1, fromSeq: 0, toSeq: 3 }, verdict: 'undetermined' },
  { name: 'null', frame: null, verdict: 'undetermined' },
]

const GAP_CASES: Array<{
  name: string
  cursor: FrameWatermarkCursor
  frame: { subscriptionId: string; logEpoch: number; fromSeq: number; toSeq: number }
  expect: string | null
}> = [
  {
    name: 'continuous',
    cursor: { subscriptionId: 's', logEpoch: 1, seq: 5 },
    frame: { subscriptionId: 's', logEpoch: 1, fromSeq: 5, toSeq: 6 },
    expect: null,
  },
  {
    name: 'generation-change',
    cursor: { subscriptionId: 's', logEpoch: 1, seq: 5 },
    frame: { subscriptionId: 's2', logEpoch: 1, fromSeq: 5, toSeq: 6 },
    expect: 'generation-change',
  },
  {
    name: 'epoch-change',
    cursor: { subscriptionId: 's', logEpoch: 1, seq: 5 },
    frame: { subscriptionId: 's', logEpoch: 2, fromSeq: 5, toSeq: 6 },
    expect: 'epoch-change',
  },
  {
    name: 'seq-discontinuity',
    cursor: { subscriptionId: 's', logEpoch: 1, seq: 5 },
    frame: { subscriptionId: 's', logEpoch: 1, fromSeq: 9, toSeq: 10 },
    expect: 'seq-discontinuity',
  },
]

describe('api-client 侧帧水位判据 = 共享判例表', () => {
  it('判例表非空且正反例都有(空表/全正例 ⇒ 对账空转)', () => {
    expect(READ_CASES.length).toBeGreaterThanOrEqual(6)
    expect(READ_CASES.filter((c) => c.verdict !== 'ok').length).toBeGreaterThanOrEqual(4)
    expect(GAP_CASES.filter((c) => c.expect !== null).length).toBeGreaterThanOrEqual(3)
  })

  for (const c of READ_CASES) {
    it(`read: ${c.name}`, () => {
      expect(readFrameWatermark(c.frame).verdict).toBe(c.verdict)
    })
  }

  for (const c of GAP_CASES) {
    it(`gap: ${c.name}`, () => {
      expect(isFrameGap(c.cursor, c.frame)).toBe(c.expect)
    })
  }

  it('结构同形:shared 唯一出口与本移植的三条件逐字同族(漂移即红)', () => {
    const local = readFileSync(resolve(REPO, 'packages/api-client/src/frame-watermark.ts'), 'utf8')
    const shared = readFileSync(
      resolve(REPO, 'packages/shared/src/sse/agent-events.ts'),
      'utf8',
    )
    for (const marker of [
      "'generation-change'",
      "'epoch-change'",
      "'seq-discontinuity'",
      "verdict: 'undetermined'",
      "verdict: 'invalid'",
    ]) {
      expect(local.includes(marker), `local 缺 ${marker}`).toBe(true)
      expect(shared.includes(marker), `shared 缺 ${marker}`).toBe(true)
    }
  })

  it('通路锁:client.ts 的 SSE 行处理真调水位闸,且真接进共享续传 runner(D138 改形)', () => {
    const src = readFileSync(resolve(REPO, 'packages/api-client/src/client.ts'), 'utf8')
    const calls = src.match(/shouldDropByWatermark/g) ?? []
    // D138 前是 1 定义 + 主循环/尾部残留两处调用;D138 起读环下沉 runResumableSSEStream,
    // 主循环与尾部残留都汇入同一个 processLine 闭包 ⇒ 1 定义 + 1 调用即两路全覆盖。
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(src).toContain("from './frame-watermark.js'")
    // 通路锁补强(意图不变,形状跟随 D138):带水位闸的 processLine 必须真接进
    // runResumableSSEStream 的 onLine —— 摘线(读环绕过水位闸)本用例必红。
    expect(src).toMatch(/onLine: \(line\) => processLine\(line\)/u)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
