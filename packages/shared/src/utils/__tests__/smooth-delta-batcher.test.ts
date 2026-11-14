// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * D1c(2026-11-15 立):align 的分段代价必须随**切点**、不随 pending 全长。
 *
 * 旧实现 `for (const seg of splitGraphemes(s))` 里 splitGraphemes 是 `Array.from(全串分段)`,
 * 缓冲一积压(后台页 rAF 停拍攒下整段正文 / 断点续传一次性回放 / 产速高出每帧 120 字的消化上限)
 * 就每帧重扫整个缓冲:与 HEAD 原文同轮实测 pending=50k 单次 3.65ms vs 0.064ms、
 * 排空 50k 累计 732ms vs 16.1ms —— align 挤掉近半边 8ms 帧预算,表现是"后段一坨一坨蹦"。
 *
 * 本尺子不靠计时(flaky)而是**数引擎被消费的字素簇个数**:
 * 早停正确 ⇒ 消费 ≈ 切点前簇数;回退成急切展开 ⇒ 消费 = 整串簇数(必炸此断言)。
 * 行为等价另有 53074 组随机+定向逐点比对(临时脚手架对照 HEAD 原文,差异 0 组)钉住,
 * 日常回归由上面的 D1/D1b 既有用例守。
 */
describe('D1c · align 分段代价随切点不随 pending 全长(簇消费计数)', () => {
  type Segment = { segment: string }
  type SegmenterLike = { segment(input: string): Iterable<Segment> }
  type SegmenterCtorLike = new (locales?: unknown, options?: unknown) => SegmenterLike

  /**
   * 记录"被真正吐出的簇数"的包装 Segmenter,内层委托真 Intl.Segmenter(不复制分段判据)。
   * `reset()` 必须有 —— 同一把尺子内若先跑过对照样本(它们会吃满整串),不清基线就把
   * 累计值当成被测那一轮的读数(实测 640 假阴,2026-11-15 首轮就踩在这里)。
   */
  function installCountingSegmenter(): {
    read: () => number
    reset: () => void
    restore: () => void
  } {
    let consumed = 0
    const Real = (Intl as unknown as { Segmenter: SegmenterCtorLike }).Segmenter
    class CountingSegmenter implements SegmenterLike {
      readonly #inner: SegmenterLike = new Real(undefined, { granularity: 'grapheme' })
      segment(input: string): Iterable<Segment> {
        const it = this.#inner.segment(input)
        return {
          [Symbol.iterator]: function* (): Generator<Segment> {
            for (const seg of it) {
              consumed += 1
              yield seg
            }
          },
        }
      }
    }
    const desc = Object.getOwnPropertyDescriptor(Intl, 'Segmenter')
    if (!desc) throw new Error('本机 Intl.Segmenter 描述符缺失,尺子失去输入(不猜结论)')
    Object.defineProperty(Intl, 'Segmenter', {
      ...desc,
      value: CountingSegmenter as unknown as SegmenterCtorLike,
      configurable: true,
      writable: true,
    })
    return {
      read: () => consumed,
      reset: () => {
        consumed = 0
      },
      restore: () => {
        Object.defineProperty(Intl, 'Segmenter', desc)
      },
    }
  }

  /** 全新模块实例(分段器缓存未建)—— 否则 truncate 的模块级缓存早已绑定真 Segmenter */
  async function freshAlign(): Promise<(s: string, end: number) => number> {
    vi.resetModules()
    const mod = await import('../smooth-delta-batcher')
    return mod.alignSliceToCodePointBoundary
  }

  it('50k 积压、切点 120:吐出簇数 ≈ 切点前簇数,不是整串', async () => {
    const counter = installCountingSegmenter()
    try {
      const align = await freshAlign()
      const pending = '中'.repeat(50000)
      expect(align(pending, 120)).toBe(120)
      // 纯 BMP 中文每枚自成簇 ⇒ 早停的理论上界 = 覆盖到切点所需的 120 簇(+ 极小余量)
      expect(counter.read()).toBeLessThanOrEqual(121)
    } finally {
      counter.restore()
    }
  })

  it('整段排空(每帧 120 字):累计簇消费有界线性,不是 O(N²/120)', async () => {
    const counter = installCountingSegmenter()
    try {
      const align = await freshAlign()
      const total = 50000
      let pending = '中'.repeat(total)
      let frames = 0
      while (pending.length > 0 && frames < 500) {
        const cut = align(pending, 120)
        expect(cut).toBeGreaterThan(0) // 0 会自旋,顺带钉住"不空转"
        pending = pending.slice(cut)
        frames += 1
      }
      expect(pending).toBe('')
      // 旧急切写法:Σ 每帧剩余长度 ≈ total²/240 ≈ 1041 万;新写法 ≈ total(每簇至多被走两次)
      expect(frames).toBeGreaterThan(400) // 确认确实发生了多帧切批,不是假绿
      expect(counter.read()).toBeLessThanOrEqual(total * 2)
    } finally {
      counter.restore()
    }
  })

  it('积压很长且切点落在 emoji 簇中间:既不劈字、也不重扫全串', async () => {
    const counter = installCountingSegmenter()
    try {
      const align = await freshAlign()
      const FAMILY = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}' // 👨‍👩‍👧 多码点单簇
      const pending = `${'x'.repeat(119)}${FAMILY}${'y'.repeat(50000)}`
      const cut = align(pending, 120) // 候选切点正落在家庭 emoji 簇中间
      expect(cut).toBe(119) // 回退到簇起点(语义与 D1b 完全一致)
      expect(pending.slice(0, cut)).toBe('x'.repeat(119))
      expect(counter.read()).toBeLessThanOrEqual(122) // 只走到该簇为止,没扫 50k 尾巴
    } finally {
      counter.restore()
    }
  })

  it('惰性迭代器与急切数组逐字同源,且"惰性"是真的(内部不得偷偷 Array.from)', async () => {
    const counter = installCountingSegmenter()
    try {
      vi.resetModules()
      const mod = await import('../truncate')
      const samples = ['ab😀cd', '答案𠀀x👨‍👩‍👧🇨🇳', 'aĭb', '', '\uD83D', 'x'.repeat(300)]
      for (const s of samples) {
        expect(Array.from(mod.graphemeSegments(s))).toEqual(mod.splitGraphemes(s))
      }
      // 上面那轮对照本身会把整串吃满 ⇒ 必须先归零再测被测那一轮(640 假阴就是这么来的)
      counter.reset()
      // 消费侧只取前 10 簇 ⇒ 引擎至多被吐 10 次。若有人把 graphemeSegments 写成
      // "对 Array.from(全串) 再 yield"的假惰性,这里当场炸(实测口径与 align 同型)。
      const long = '中'.repeat(10000)
      let visited = 0
      for (const _seg of mod.graphemeSegments(long)) {
        visited += 1
        if (visited >= 10) break
      }
      expect(visited).toBe(10)
      expect(counter.read()).toBeLessThanOrEqual(11)
    } finally {
      counter.restore()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
