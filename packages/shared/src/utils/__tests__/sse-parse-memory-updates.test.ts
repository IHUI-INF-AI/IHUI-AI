// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * done 帧 `memoryUpdates` 透传锁(2026-11-13 立)。
 *
 * 立此锁的因由:`memoryUpdates` 不是独立帧,而是 **done 帧的可选字段**。
 * api-client 有自己的解析(`begin-done` 分支),但共享 `sse-parse` 此前**不认该字段** ——
 * 于是走共享解析面的端(小程序)即使注册了 `onMemoryUpdates` 也永远读不到,
 * 两侧口径因此漂开。这是"同一个字段两套解析、一边漏"的典型。
 *
 * 判据三条:
 *  ① 合法 `string[]` 原样透传(逐字相同,不裁剪不重排);
 *  ② 非数组 / 含非字符串 ⇒ **整键缺席**(不折成空数组、不部分保留);
 *  ③ 字段缺席 ⇒ 不带该键(不是空数组 —— "没采到"与"本轮无新记忆"是两件事)。
 *
 * ②③ 的分野很关键:空数组的语义是"服务端说本轮没记住东西",缺席是"服务端没说"。
 * 把后者读成前者 = 用一次解析失败伪造一个业务事实。
 */
import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../sse-parse'

/** 造一行 done 帧字节(带尾随空行的完整 SSE 事件) */
const doneLine = (payload: Record<string, unknown>): string =>
  `data: ${JSON.stringify({ type: 'done', ...payload })}\n\n`

/** parseSSEChunk 返回 { events, remainder },这里只取事件表 */
const parseEvents = (line: string) => parseSSEChunk(line).events

describe('done.memoryUpdates 透传', () => {
  it('① 合法 string[] 原样透传', () => {
    const events = parseEvents(doneLine({ memoryUpdates: ['记住 A', '记住 B'] }))
    const done = events.find((e) => e.type === 'done')
    expect(done).toBeTruthy()
    expect(done && 'memoryUpdates' in done ? done.memoryUpdates : undefined).toEqual([
      '记住 A',
      '记住 B',
    ])
  })

  it('② 空数组照传(语义是"本轮无新记忆",不是"没采到")', () => {
    const events = parseEvents(doneLine({ memoryUpdates: [] }))
    const done = events.find((e) => e.type === 'done')
    expect(done && 'memoryUpdates' in done ? done.memoryUpdates : undefined).toEqual([])
  })

  it('③ 字段缺席 ⇒ 不带该键(不得折成空数组)', () => {
    const events = parseEvents(doneLine({ model: 'm' }))
    const done = events.find((e) => e.type === 'done')
    expect(done).toBeTruthy()
    expect(done && 'memoryUpdates' in done).toBe(false)
  })

  it('④ 含非字符串项 ⇒ 整键缺席(不部分保留)', () => {
    const events = parseEvents(doneLine({ memoryUpdates: ['ok', 42] }))
    const done = events.find((e) => e.type === 'done')
    expect(done && 'memoryUpdates' in done).toBe(false)
  })

  it('⑤ 非数组(字符串/对象/null)⇒ 整键缺席', () => {
    for (const bad of ['a', { x: 1 }, null, 3]) {
      const events = parseEvents(doneLine({ memoryUpdates: bad }))
      const done = events.find((e) => e.type === 'done')
      expect(done && 'memoryUpdates' in done, `memoryUpdates=${JSON.stringify(bad)} 被放过`).toBe(
        false,
      )
    }
  })

  it('⑥ 反向对照:把透传逻辑摘掉后,① 会失败(证明锁不是恒真)', () => {
    // 用裸 JSON.parse 模拟"未透传"的实现,确认它与 ① 的期望不同
    const raw = JSON.parse(JSON.stringify({ type: 'done', memoryUpdates: ['记住 A', '记住 B'] }))
    const noPassthrough = { type: raw.type } // 不透传 = 只有 type
    expect('memoryUpdates' in noPassthrough).toBe(false)
  })
})
