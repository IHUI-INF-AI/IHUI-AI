// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 三端共用的流式平滑批处理(唯一实现 = @ihui/shared/utils/smooth-delta-batcher)
//
// 本文件钉的是 **D1 代理对边界** 与 **不死锁** 这两件曾经真出过的缺陷:
//  - 旧实现按 UTF-16 码元硬切,切在代理对中间 ⇒ 半个字符先入正文,渲染成一枚 U+FFFD;
//  - 2026-11-12 早版"向后多带一个码元"只堵住了"切点后还有低代理"这一半:SSE 帧本可以在
//    代理对中间断开(JSON 解码后字符串以孤立高代理结尾),那时 `end === s.length`,旧判据
//    开头的 `end >= s.length` 直接放行,半个字符照样漏;而且 `room === 1` 时会 append('')
//    且 pending 不减 ⇒ **自旋死循环**(不是"慢一拍")。
//
// rAF 用受控队列替身 + 可注入时钟,逐帧拨针,全部确定性断言。
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  alignSliceToCodePointBoundary,
  createSmoothDeltaBatcher,
} from '@ihui/shared/utils/smooth-delta-batcher'

type FrameCb = (ts: number) => void

function installRaf() {
  const frames: FrameCb[] = []
  let nextId = 0
  const cancelSpy = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameCb): number => {
    frames.push(cb)
    return ++nextId
  })
  vi.stubGlobal('cancelAnimationFrame', (): void => {
    cancelSpy()
  })
  return {
    frames,
    cancelSpy,
    /** 按固定帧率推进 ms 毫秒,每帧派发当前队列快照 */
    pump(ms: number, clock: { now: number }, fps = 60): void {
      const step = 1000 / fps
      let elapsed = 0
      while (elapsed < ms - 1e-9) {
        const dt = Math.min(step, ms - elapsed)
        clock.now += dt
        elapsed += dt
        const snapshot = frames.splice(0, frames.length)
        for (const cb of snapshot) cb(clock.now)
      }
    },
    /** 当前排着多少枚待派发帧 —— 死锁判据用(空转会把帧无限排下去) */
    pendingFrames(): number {
      return frames.length
    },
  }
}

describe('alignSliceToCodePointBoundary', () => {
  const EMOJI = '😀' // U+1F600 = D83D DE00
  const RARE = '𠀀' // U+20000 = D840 DC00(增补平面汉字)

  it('切点落在代理对中间 ⇒ 回退一格,绝不劈开', () => {
    const s = `ab${EMOJI}cd`
    // EMOJI 占 index 2..3;切点 3 会把高代理留在前半
    const cut = alignSliceToCodePointBoundary(s, 3)
    expect(cut).toBe(2)
    expect(s.slice(0, cut)).toBe('ab')
  })

  it('切点落在码点边界 ⇒ 原样返回', () => {
    const s = `ab${EMOJI}cd`
    expect(alignSliceToCodePointBoundary(s, 2)).toBe(2)
    expect(alignSliceToCodePointBoundary(s, 4)).toBe(4)
  })

  it('切点落在末尾孤立高代理上 ⇒ 回退到它之前,本片不含半个字', () => {
    const s = `ab\uD83D`
    // 高代理在 index 2;切点 3(= s.length)会把半个字符留在前半,故回退到 2
    expect(alignSliceToCodePointBoundary(s, s.length)).toBe(2)
    // 整个可见前缀就只有这枚孤立高代理时,无从产出
    expect(alignSliceToCodePointBoundary('\uD83D', 1)).toBe(0)
  })

  it('room=1 且当前是完整代理对 ⇒ 带走两个码元(有界超预算,换不死锁)', () => {
    const s = `${EMOJI}x`
    expect(alignSliceToCodePointBoundary(s, 1)).toBe(2)
  })

  it('room=1 且只有一枚孤立高代理 ⇒ 返回 0(等下一批,不吐半个字)', () => {
    expect(alignSliceToCodePointBoundary('\uD83D', 1)).toBe(0)
  })

  it('增补平面汉字同样受保护', () => {
    const s = `x${RARE}y`
    expect(alignSliceToCodePointBoundary(s, 2)).toBe(1)
  })

  it('end<=0 返回 0;end 超长按长度收敛', () => {
    expect(alignSliceToCodePointBoundary('abc', 0)).toBe(0)
    expect(alignSliceToCodePointBoundary('abc', -5)).toBe(0)
    expect(alignSliceToCodePointBoundary('abc', 99)).toBe(3)
  })

  it('纯 ASCII 任意切点原样返回', () => {
    for (let i = 1; i <= 5; i++) expect(alignSliceToCodePointBoundary('abcde', i)).toBe(i)
  })
})

describe('createSmoothDeltaBatcher · 对外契约', () => {
  let raf: ReturnType<typeof installRaf>
  let clock: { now: number }
  const FRAME = 1000 / 60

  beforeEach(() => {
    clock = { now: 1_000_000 }
    raf = installRaf()
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  const make = (out: string[]) => createSmoothDeltaBatcher((d) => out.push(d))

  it('深缓冲:按窗口产速匀速推进,不一次性喷完', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('x'.repeat(2000))
    clock.now += 400
    raf.pump(FRAME, clock)
    const first = out.join('').length
    expect(first).toBeGreaterThan(10)
    expect(first).toBeLessThan(2000)
  })

  it('停产兜底:样本老化后残留缓冲继续打完,不冻屏', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('z'.repeat(100))
    raf.pump(5000, clock)
    expect(out.join('')).toBe('z'.repeat(100))
  })

  it('flush 立即清空剩余并停帧', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('abc')
    b.flush()
    expect(out.join('')).toBe('abc')
    raf.pump(100, clock)
    expect(out.join('')).toBe('abc')
    expect(raf.cancelSpy).toHaveBeenCalled()
  })

  it('cancel 丢弃缓冲,后续帧零追加', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('abc')
    b.cancel()
    raf.pump(100, clock)
    expect(out.join('')).toBe('')
  })

  it('onProgress 报告累计收到字符数(非已显示数)', () => {
    const out: string[] = []
    const seen: number[] = []
    const b = createSmoothDeltaBatcher((d) => out.push(d), { onProgress: (n) => seen.push(n) })
    b.batch('hello')
    raf.pump(500, clock)
    expect(seen).toContain(5)
    expect(out.join('')).toBe('hello')
  })

  it('空 delta 不入泵、不排帧', () => {
    const out: string[] = []
    const b = make(out)
    b.batch('')
    expect(raf.pendingFrames()).toBe(0)
    expect(out).toEqual([])
  })
})

describe('createSmoothDeltaBatcher · D1 代理对不劈(端到端)', () => {
  let raf: ReturnType<typeof installRaf>
  let clock: { now: number }

  beforeEach(() => {
    clock = { now: 1_000_000 }
    raf = installRaf()
    vi.spyOn(performance, 'now').mockImplementation(() => clock.now)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('大量 emoji 流式:每一片都是完整字符串,拼接结果逐字等于原文', () => {
    const out: string[] = []
    const b = createSmoothDeltaBatcher((d) => out.push(d))
    const source = '😀🇨🇳👨‍👩‍👧𠀀'.repeat(40)
    // 逐码元喂入(最恶劣的到达形态:每帧只来半个代理对)
    for (const ch of source.match(/[\s\S]{1,3}/g) ?? []) b.batch(ch)
    raf.pump(3000, clock)
    expect(out.join('')).toBe(source)
    // 每一片自身不得以孤立高代理结尾(那就是"半个字符先上屏")
    for (const piece of out) {
      const last = piece.charCodeAt(piece.length - 1)
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false)
      // 也不得以孤立低代理开头
      const first = piece.charCodeAt(0)
      expect(first >= 0xdc00 && first <= 0xdfff).toBe(false)
    }
  })

  it('缓冲以孤立高代理结尾时不产出半个字、也不死循环,补上低代理后照常接上', () => {
    const out: string[] = []
    const b = createSmoothDeltaBatcher((d) => out.push(d))
    b.batch('答案😀'.slice(0, 3)) // '答案' + 高代理,低代理还没到
    clock.now += 100
    raf.pump(200, clock)
    // 关键:不得吐出任何含孤立高代理的片,且帧必须停下来(不自旋)
    for (const piece of out) {
      const last = piece.charCodeAt(piece.length - 1)
      expect(last >= 0xd800 && last <= 0xdbff).toBe(false)
    }
    expect(raf.pendingFrames()).toBe(0)

    b.batch('\uDE00') // 补上低代理:高代理 D83D + DE00 = 😀
    clock.now += 100
    raf.pump(1000, clock)
    expect(out.join('')).toBe('答案😀')
  })

  it('room=1 的窄窗口不会把跨帧代理对卡死', () => {
    const out: string[] = []
    const b = createSmoothDeltaBatcher((d) => out.push(d))
    // 造 121 个 ASCII 让下一片只剩 1 个码元的额度,再跟一枚 emoji
    b.batch(`${'a'.repeat(121)}😀`)
    clock.now += 400
    raf.pump(5000, clock)
    expect(out.join('')).toBe(`${'a'.repeat(121)}😀`)
    expect(raf.pendingFrames()).toBe(0)
  })
})
