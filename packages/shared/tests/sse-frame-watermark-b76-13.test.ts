// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-13 票1:帧水位与纪元 —— 唯一出口(readFrameWatermark / isFrameGap)判例钉子。
// 断言打在 packages/shared/src/sse/agent-events.ts 的生产出口上。
import { describe, expect, it } from 'vitest'

import {
  isFrameGap,
  readFrameWatermark,
  type FrameWatermarkCursor,
} from '../src/sse/agent-events'

const CURSOR: FrameWatermarkCursor = { subscriptionId: 'sub-1', logEpoch: 1, seq: 5 }

describe('b76-13 帧水位与纪元', () => {
  it('epoch 与手上不同 ⇒ gap=epoch-change(读端契约:整结果丢弃,不得读成已应用)', () => {
    const wm = { subscriptionId: 'sub-1', logEpoch: 2, fromSeq: 5, toSeq: 6 }
    expect(readFrameWatermark(wm)).toEqual({ verdict: 'ok', watermark: wm })
    expect(isFrameGap(CURSOR, wm)).toBe('epoch-change')
  })

  it('toSeq < fromSeq ⇒ 判死(invalid),任何情况下不得应用', () => {
    const read = readFrameWatermark({ subscriptionId: 'sub-1', logEpoch: 1, fromSeq: 7, toSeq: 3 })
    expect(read.verdict).toBe('invalid')
  })

  it('cursor.seq !== frame.fromSeq ⇒ seq-discontinuity(报 gap 并要求 resync)', () => {
    const wm = { subscriptionId: 'sub-1', logEpoch: 1, fromSeq: 9, toSeq: 10 }
    expect(isFrameGap(CURSOR, wm)).toBe('seq-discontinuity')
  })

  it('换代(subscriptionId 不同)⇒ generation-change,三条件取或的第一条', () => {
    const wm = { subscriptionId: 'sub-2', logEpoch: 2, fromSeq: 99, toSeq: 100 }
    expect(isFrameGap(CURSOR, wm)).toBe('generation-change')
  })

  it('逐条连续帧 ⇒ gap 为 null,可 apply', () => {
    let cursor = CURSOR
    for (const seq of [5, 6, 7, 8]) {
      const wm = { subscriptionId: 'sub-1', logEpoch: 1, fromSeq: seq, toSeq: seq + 1 }
      expect(isFrameGap(cursor, wm)).toBeNull()
      cursor = { ...cursor, seq: wm.toSeq }
    }
    expect(cursor.seq).toBe(9)
  })

  it('字段读不出 ⇒ 判"未判定",绝不返回 {}(部分字段也不得猜)', () => {
    expect(readFrameWatermark(null).verdict).toBe('undetermined')
    expect(readFrameWatermark('x').verdict).toBe('undetermined')
    expect(readFrameWatermark({}).verdict).toBe('undetermined')
    expect(readFrameWatermark({ subscriptionId: 'sub-1', logEpoch: 1 }).verdict).toBe(
      'undetermined',
    )
    // 部分在场不算 ok:absence ≠ 合法零值
    const partial = readFrameWatermark({ logEpoch: 1, fromSeq: 0, toSeq: 3 })
    expect(partial.verdict).toBe('undetermined')
  })

  it('snake_case 线格式键同收;snapshot 帧 fromSeq 恒 0 合法', () => {
    const read = readFrameWatermark({
      subscription_id: 'sub-1',
      log_epoch: 1,
      from_seq: 0,
      to_seq: 5,
    })
    expect(read.verdict).toBe('ok')
    if (read.verdict === 'ok') {
      expect(read.watermark.fromSeq).toBe(0)
      expect(isFrameGap({ subscriptionId: 'sub-1', logEpoch: 1, seq: 0 }, read.watermark)).toBeNull()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
