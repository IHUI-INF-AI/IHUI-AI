// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
/**
 * #16/#9 流式平滑批处理测试(三端单一真相源)。
 *
 * D1(代理对边界):切点经 alignSliceToCodePointBoundary 推到码点边界,代理对永不劈开。
 * D1b(字素簇边界,2026-11-14):只防代理对不够 —— ZWJ emoji 序列(👍🏽/👨‍👩‍👧/🏳️‍🌈)由
 *   多码点 + ZWJ(U+200D)/FE0F/肤色修饰符连接,切批落在连接符之后会把一枚 emoji 拆成
 *   两拍渲染(第一拍显示半成品 emoji,下一拍才拼回)。判据与 truncate.ts「BUG-52 按字素
 *   簇截断」同源:切点必须落在字素簇边界。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  createSmoothDeltaBatcher,
  alignSliceToCodePointBoundary,
  __test__,
} from '../smooth-delta-batcher'

/** 收集所有提交帧(append 回调) */
function collect() {
  const frames: string[] = []
  const append = (s: string) => {
    if (s !== '') frames.push(s)
  }
  return { frames, append }
}

/** 用假定时器把 batcher 的 setTimeout 兜底档驱动到「无更多帧」为止(有界防死循环) */
function drain(b: ReturnType<typeof createSmoothDeltaBatcher>, maxTicks = 500): void {
  for (let i = 0; i < maxTicks; i += 1) {
    vi.advanceTimersByTime(20) // > FALLBACK_TICK_MS(16)
  }
  b.flush()
}

beforeEach(() => {
  vi.useFakeTimers()
  // 屏蔽宿主 rAF ⇒ batcher 落到 setTimeout 兜底档,可用 vi.advanceTimersByTime 确定性驱动
  ;(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = undefined
  ;(globalThis as { cancelAnimationFrame?: unknown }).cancelAnimationFrame = undefined
})
afterEach(() => {
  vi.useRealTimers()
})

describe('alignSliceToCodePointBoundary · D1 代理对边界', () => {
  const HI = '\uD83D' // 高代理
  const LO = '\uDC4D' // 低代理

  it('切点落高代理之后 ⇒ 回退到代理对之前', () => {
    const s = `a${HI}${LO}`
    expect(alignSliceToCodePointBoundary(s, 2)).toBe(1)
  })

  it('候选切点已在码点边界 ⇒ 原样返回', () => {
    const s = `ab${HI}${LO}`
    expect(alignSliceToCodePointBoundary(s, 2)).toBe(2)
  })

  it('末尾孤立高代理(cut-1>0)⇒ 回退一格丢掉孤立高代理', () => {
    // s='a'+HI, end=2: cut=2, prev=HI(高代理), cut-1=1>0 ⇒ 回退到 1
    const s = `a${HI}`
    expect(alignSliceToCodePointBoundary(s, 2)).toBe(1)
  })

  it('room=1 高代理后有低代理⇒ 向后带上低代理', () => {
    // s=HI+LO, end=1: cut=1, prev=HI, cut-1=0(不>0) ⇒ 向后带 LO=2
    const s = `${HI}${LO}`
    expect(alignSliceToCodePointBoundary(s, 1)).toBe(2)
  })

  it('room=1 高代理且无低代理(流尾残缺)⇒ 放弃本帧返回 0', () => {
    // s=HI, end=1: cut=1, prev=HI, cut-1=0, cut+1=2>s.length=1 ⇒ 0
    const s = HI
    expect(alignSliceToCodePointBoundary(s, 1)).toBe(0)
  })
})

describe('createSmoothDeltaBatcher · 基本节拍', () => {
  it('flush 吐尽剩余 buffer,不丢尾', () => {
    const { frames, append } = collect()
    const b = createSmoothDeltaBatcher(append)
    b.batch('完整内容abc')
    b.flush()
    expect(frames.join('')).toBe('完整内容abc')
  })

  it('大段内容分多帧,最终拼接完整(不丢字/不重复)', () => {
    const { frames, append } = collect()
    const b = createSmoothDeltaBatcher(append)
    const long = '流'.repeat(600)
    b.batch(long)
    drain(b)
    expect(frames.join('')).toBe(long)
    expect(frames.length).toBeGreaterThan(1)
  })
})

describe('D1b · 字素簇边界(切批不拆一枚 emoji)', () => {
  // 肤色 emoji:👍🏽 = U+1F44D + U+1F3FD(两码点一枚字素)
  const THUMBS_SKIN = '\u{1F44D}\u{1F3FD}'
  // ZWJ 家庭:👨‍👩‍👧
  const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'
  // 旗帜:🏳️‍🌈 = 🏳 FE0F ZWJ 🌈
  const FLAG = '\u{1F3F3}\uFE0F\u200D\u{1F308}'

  it('alignSlice:切点落在肤色 emoji 中间 ⇒ 回退到 emoji 之前', () => {
    const s = `a${THUMBS_SKIN}b`
    // 候选切点=2(切在 👍 之后、肤色修饰符之前)⇒ 应回退到 1
    expect(alignSliceToCodePointBoundary(s, 2)).toBe(1)
  })

  it('alignSlice:切点落在 ZWJ 之后 ⇒ 回退到整簇之前', () => {
    const s = `x${FAMILY}y`
    // 候选切点落在第一个 ZWJ 之后(位置 3:x👨 = 1+2, ZWJ 在 index 3)
    expect(alignSliceToCodePointBoundary(s, 3)).toBe(1)
  })

  it('alignSlice:切点在字素簇边界 ⇒ 原样返回', () => {
    const s = `ab${THUMBS_SKIN}`
    expect(alignSliceToCodePointBoundary(s, 2)).toBe(2)
  })

  // 关键:让 emoji 恰好跨越 MAX_CHARS_PER_COMMIT(120) 切批边界,强制切点落在 emoji 中间。
  // flush 绕过 alignSlice,故这些用例必须靠「真实多帧切批」而非 flush 兜底 —— 否则是假绿。
  // 首帧切到 120:emoji 起点=120 ⇒ 切点落 emoji 首码点之后/连接符之前 ⇒ 必须回退。
  function textWithEmojiAtBoundary(emoji: string): string {
    return 'a'.repeat(120) + emoji + 'b'.repeat(260)
  }

  function expectNoHalfEmojiFrame(frames: string[], emoji: string): void {
    // 每一帧都不能「切开 emoji」:枚举 emoji 内部所有真前缀(去掉完整 emoji),
    // 任何帧以其中之一结尾 = emoji 被拆到下一帧 = 缺陷。
    const prefixes: string[] = []
    for (let end = 1; end < Array.from(emoji).length; end += 1) {
      // 按码元构造真前缀(含连接符结尾、肤色首码结尾等所有中间态)
      const codeUnits = Array.from(emoji)
      const partial = codeUnits.slice(0, end).join('')
      if (partial.length < emoji.length) prefixes.push(partial)
    }
    for (const f of frames) {
      for (const p of prefixes) {
        expect(f.endsWith(p)).toBe(false)
      }
    }
  }

  it('肤色 emoji 跨切批边界 ⇒ 不被拆成「裸 👍」+「肤色」两帧', () => {
    const { frames, append } = collect()
    const b = createSmoothDeltaBatcher(append)
    b.batch(textWithEmojiAtBoundary(THUMBS_SKIN))
    drain(b)
    expect(frames.length).toBeGreaterThan(1) // 确认真的多帧切批发生
    expect(frames.join('')).toBe(textWithEmojiAtBoundary(THUMBS_SKIN))
    expectNoHalfEmojiFrame(frames, THUMBS_SKIN)
  })

  it('ZWJ 家庭 emoji 跨切批边界 ⇒ 不产生切开连接符的帧', () => {
    const { frames, append } = collect()
    const b = createSmoothDeltaBatcher(append)
    b.batch(textWithEmojiAtBoundary(FAMILY))
    drain(b)
    expect(frames.length).toBeGreaterThan(1)
    expect(frames.join('')).toBe(textWithEmojiAtBoundary(FAMILY))
    expectNoHalfEmojiFrame(frames, FAMILY)
  })

  it('旗帜 emoji(FE0F+ZWJ)跨切批边界 ⇒ 不被拆散', () => {
    const { frames, append } = collect()
    const b = createSmoothDeltaBatcher(append)
    b.batch(textWithEmojiAtBoundary(FLAG))
    drain(b)
    expect(frames.length).toBeGreaterThan(1)
    expect(frames.join('')).toBe(textWithEmojiAtBoundary(FLAG))
    expectNoHalfEmojiFrame(frames, FLAG)
  })

  it('混排长文本多 emoji 分布在多个切批边界:拼接完整 + 无半枚 emoji + 无丢字', () => {
    const { frames, append } = collect()
    const b = createSmoothDeltaBatcher(append)
    // 每个 emoji 都落在 120 的整数倍边界附近,逼多帧切批都撞上 emoji
    const parts: string[] = []
    const EMOJIS = [THUMBS_SKIN, FAMILY, FLAG] as const
    for (let i = 0; i < 4; i += 1) {
      parts.push('x'.repeat(115))
      parts.push(EMOJIS[i % EMOJIS.length]!)
    }
    const text = parts.join('')
    b.batch(text)
    drain(b)
    expect(frames.join('')).toBe(text)
    for (const emoji of [THUMBS_SKIN, FAMILY, FLAG]) {
      expectNoHalfEmojiFrame(frames, emoji)
    }
  })
})

// __test__ 导出守卫(§0.6:测试 import 源脚本 __test__,不复制判据)
describe('__test__ 导出', () => {
  it('暴露 alignSliceToCodePointBoundary / resolveScheduler 供测试', () => {
    expect(typeof __test__.alignSliceToCodePointBoundary).toBe('function')
    expect(typeof __test__.resolveScheduler).toBe('function')
  })
})
