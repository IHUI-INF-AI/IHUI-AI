// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

import {
  createSseFrameAccumulator,
  summarizeSseTailAccount,
  type SseTailAccount,
} from '../sse-frame-accumulator'

/**
 * G-815939 尾帧账目:三态不并桶的成对证明。
 *
 * 最关键的是第一组"有尾帧 ⇒ 计数 > 0 且被点名"与第二组"无尾帧 ⇒ 计数 0" ——
 * 只留前者会鼓励把任何尾段都记成丢弃(判据过宽),只留后者做不出实现来:
 * 一个"什么都不报"的尺子恰好满足第二组。两组的差别必须由 outcome 字段本身承担。
 */

describe('完整帧的切分(账目基线)', () => {
  it('两帧都以空行收尾 ⇒ complete=2 且尾段三态全为 0(这是结论,不是没判)', () => {
    const seen: string[] = []
    const acc = createSseFrameAccumulator({ onFrame: (f) => seen.push(f) })
    acc.push('event: a\ndata: {"x":1}\n\nevent: b\ndata: {"y":2}\n\n')
    const account = acc.close()

    expect(seen).toEqual(['event: a\ndata: {"x":1}', 'event: b\ndata: {"y":2}'])
    expect(account.completeFrames).toBe(2)
    expect(account.discarded).toHaveLength(0)
    expect(account.drained).toHaveLength(0)
    expect(account.undetermined).toHaveLength(0)
    expect(account.closed).toBe(true)
    // 摘要在"确实没有尾帧"时返回 null —— 免打噪音,但绝不让调用方把"没判"读成"没有"。
    expect(summarizeSseTailAccount(account)).toBeNull()
  })

  it('跨 chunk 拼帧:分隔符被切成两半也必须只出一帧', () => {
    const seen: string[] = []
    const acc = createSseFrameAccumulator({ onFrame: (f) => seen.push(f) })
    acc.push('data: {"a":1}\n')
    acc.push('\ndata: {"b":2}\n\n')
    expect(seen).toEqual(['data: {"a":1}', 'data: {"b":2}'])
    expect(acc.close().completeFrames).toBe(2)
  })
})

describe('残帧已丢弃:可数且可点名', () => {
  it('喂一条没有结尾空行的残帧 ⇒ discarded 计数 > 0 且点名内容与长度', () => {
    const seen: string[] = []
    const acc = createSseFrameAccumulator({ onFrame: (f) => seen.push(f) })
    acc.push('data: {"a":1}\n\ndata: {"trunc')
    const account = acc.close()

    expect(seen).toEqual(['data: {"a":1}'])
    expect(account.discarded.length).toBeGreaterThan(0)
    expect(account.discarded[0]?.chars).toBe('data: {"trunc'.length)
    expect(account.discarded[0]?.preview).toContain('data: {"trunc')
    expect(account.discarded[0]?.reason).toBe('no-salvage-channel')
    // 摘要必须把三态各自报出来 —— 只报"丢了 N"会让人觉得其余都干净。
    const summary = summarizeSseTailAccount(account)
    expect(summary).toContain('discarded=1')
    expect(summary).toContain('undetermined=0')
    expect(summary).toContain('drained=0')
  })

  it('排空通道判不可用(返回 false)⇒ 仍计 discarded,而不是折进 drained', () => {
    const acc = createSseFrameAccumulator({
      onFrame: () => {},
      salvage: () => false,
    })
    acc.push('data: {"half":')
    const account = acc.close()
    expect(account.discarded).toHaveLength(1)
    expect(account.drained).toHaveLength(0)
    expect(account.discarded[0]?.reason).toBe('salvage-returned-false')
  })
})

describe('排空成功:与丢弃分家立账', () => {
  it('salvage 认领尾段 ⇒ drained=1 且 discarded=0(两态不得互相顶账)', () => {
    const salvaged: string[] = []
    const acc = createSseFrameAccumulator({
      onFrame: () => {},
      salvage: (tail) => {
        salvaged.push(tail)
        return true
      },
    })
    acc.push('data: {"tail":true}\n')
    const account = acc.close()

    expect(salvaged).toEqual(['data: {"tail":true}\n'])
    expect(account.drained).toHaveLength(1)
    expect(account.discarded).toHaveLength(0)
    expect(account.undetermined).toHaveLength(0)
  })
})

describe('未判定:不冒红也不记绿', () => {
  it('salvage 自己抛错 ⇒ 落 undetermined 且不重复计 discarded(故障不是裁决)', () => {
    const acc = createSseFrameAccumulator({
      onFrame: () => {},
      salvage: () => {
        throw new Error('解析器崩了')
      },
    })
    acc.push('data: {"x":1}\n')
    const account = acc.close()

    expect(account.undetermined).toHaveLength(1)
    expect(account.discarded).toHaveLength(0)
    expect(account.drained).toHaveLength(0)
    expect(account.undetermined[0]?.reason).toContain('salvage-threw')
    expect(account.undetermined[0]?.reason).toContain('解析器崩了')
  })

  it('close() 从未调用 ⇒ peek() 报未判定,绝不给出"没有尾帧"的假结论', () => {
    const acc = createSseFrameAccumulator({ onFrame: () => {} })
    acc.push('data: {"a":1}\n\ndata: {"tail":')
    const account = acc.peek()

    expect(account.closed).toBe(false)
    expect(account.undetermined).toHaveLength(1)
    expect(account.undetermined[0]?.reason).toBe('close-not-called')
    expect(account.discarded).toHaveLength(0)
  })

  it('缓冲区为空但也没 close ⇒ 同样是未判定(chars=0 不等于"已确认没有")', () => {
    const acc = createSseFrameAccumulator({ onFrame: () => {} })
    acc.push('data: {"a":1}\n\n')
    const account = acc.peek()
    expect(account.closed).toBe(false)
    expect(account.undetermined).toHaveLength(1)
    expect(account.undetermined[0]?.chars).toBe(0)
    expect(summarizeSseTailAccount(account)).toContain('closed=no')
  })

  it('账目整个取不到(null)⇒ 摘要明写"收口从未发生",不返回 null 冒充干净', () => {
    const summary = summarizeSseTailAccount(null)
    expect(summary).not.toBeNull()
    expect(summary).toContain('undetermined=1')
  })
})

describe('幂等与时序', () => {
  it('close() 调两次返回同一份账 ⇒ 不会把一次丢弃记成两次', () => {
    const acc = createSseFrameAccumulator({ onFrame: () => {} })
    acc.push('data: {"a":1}\n\n残')
    const first: SseTailAccount = acc.close()
    const second = acc.close()
    expect(second).toBe(first)
    expect(second.discarded).toHaveLength(1)
  })

  it('close() 之后再 push ⇒ 当场抛(账已结,再喂就是静默丢帧)', () => {
    const acc = createSseFrameAccumulator({ onFrame: () => {} })
    acc.close()
    expect(() => acc.push('data: {"late":1}\n\n')).toThrow(/close/)
  })

  it('结尾多发的裸换行不构成尾段(那是结论,不是漏账)', () => {
    const acc = createSseFrameAccumulator({ onFrame: () => {} })
    acc.push('data: {"a":1}\n\n\n')
    const account = acc.close()
    expect(account.discarded).toHaveLength(0)
    expect(account.undetermined).toHaveLength(0)
  })

  it('onFrame 被调用的次数与 complete 计数一致(账目对得上动作)', () => {
    const onFrame = vi.fn()
    const acc = createSseFrameAccumulator({ onFrame })
    acc.push('a\n\nb\n\nc')
    const account = acc.close()
    expect(onFrame).toHaveBeenCalledTimes(3 - 1)
    expect(account.completeFrames).toBe(onFrame.mock.calls.length)
    expect(account.discarded).toHaveLength(1)
  })
})

// 第二组对照的"取空"版本:证明"计数 0"这一读数只在真的没有尾段时出现。
describe('无尾帧 ⇒ 计数 0(与第一组同判据的另一臂)', () => {
  it('干净收尾的流 ⇒ discarded=0 且 drained=0 且 undetermined=0 且 closed=true', () => {
    const acc = createSseFrameAccumulator({ onFrame: () => {}, salvage: () => true })
    acc.push('event: done\ndata: {}\n\n')
    const account = acc.close()
    expect({
      d: account.discarded.length,
      r: account.drained.length,
      u: account.undetermined.length,
    }).toEqual({ d: 0, r: 0, u: 0 })
    expect(summarizeSseTailAccount(account)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
