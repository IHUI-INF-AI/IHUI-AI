// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全屏 TUI —— 布局与滚动单测(纯函数层,零 IO)。
 *
 * 钉的是"全屏"这个词的可判定含义:
 *  ① 帧的行数恒等于 rows、每行恒占满 cols —— 少一行露残影,多一行顶出滚动区;
 *  ② 中文按显示宽度排,不按 UTF-16 长度 —— 按字符数算就是"中文界面永远差半格"的成因;
 *  ③ 折行不吞字、不重复字;
 *  ④ 滚动位置在"新内容到达"时的语义(用户在读历史时不得被顶走);
 *  ⑤ 尺寸不足必须判"不可用",不得硬画一个挤成一团的假界面。
 */
import { describe, expect, it } from 'vitest'

import {
  MIN_COLS,
  MIN_ROWS,
  computeBoxes,
  cutText,
  fitLine,
  plainLine,
  textWidth,
  wrapAll,
  wrapLine,
  type FrameLine,
} from '../src/tui/fullscreen/geometry.js'
import {
  afterContentGrew,
  followLabel,
  scrollBottom,
  scrollBy,
  scrollIndicator,
  scrollInitial,
  scrollTop,
  visibleWindow,
} from '../src/tui/fullscreen/scroll.js'
// composeFrame 不在这里直接调:整屏那条链是 snapshotFrame → composeFrame,
// 用例要判的"两条腿折行一致"必须走生产路径,自己再拼一遍 FrameInput 等于测另一份实现。
import { inputCaretColumn, renderHeader, wrapTranscript } from '../src/tui/fullscreen/frame.js'
import { snapshotFrame } from '../src/tui/fullscreen/app.js'
import { createInputBuffer } from '../src/tui/fullscreen/actions.js'
import { blocksToLines, createTranscript, foldEvent } from '../src/tui/fullscreen/transcript.js'

const HEADER = { model: 'test-model', workspace: 'repo', session: '', permissionMode: 'default' }

function appState(overrides: Partial<Parameters<typeof snapshotFrame>[0]> = {}) {
  return {
    transcript: createTranscript(),
    scroll: scrollInitial(),
    input: createInputBuffer(),
    verbose: false,
    running: false,
    toast: '',
    activity: '',
    ...overrides,
  }
}

function frameOf(rows: number, cols: number, transcript = createTranscript()): string[] {
  const out = snapshotFrame(
    appState({ transcript }),
    null,
    HEADER,
    { rows, cols },
    false,
  )
  return out.lines
}

describe('computeBoxes —— 区域分配', () => {
  it('够大时四个区都在,且行号不重叠、总行数等于 rows', () => {
    const boxes = computeBoxes({ cols: 100, rows: 30 })
    expect(boxes).not.toBeNull()
    if (!boxes) return
    expect(boxes.header).toBe(0)
    expect(boxes.transcriptTop).toBe(boxes.header + 1)
    expect(boxes.status).toBe(boxes.transcriptTop + boxes.transcriptRows)
    expect(boxes.input).toBe(boxes.status + 1)
    expect(boxes.hints).toBe(boxes.input + boxes.inputRows)
    expect(boxes.hints).toBeLessThan(30)
    expect(boxes.transcriptRows).toBeGreaterThan(0)
  })

  it('低于最小尺寸判不可用(null),而不是硬分配出 0 行消息区', () => {
    expect(computeBoxes({ cols: MIN_COLS - 1, rows: 40 })).toBeNull()
    expect(computeBoxes({ cols: 200, rows: MIN_ROWS - 1 })).toBeNull()
    // NaN / Infinity 也是不可用,不得当成"很大的尺寸"画出去
    expect(computeBoxes({ cols: Number.NaN, rows: 20 })).toBeNull()
    expect(computeBoxes({ cols: 100, rows: Number.POSITIVE_INFINITY })).toBeNull()
  })
})

describe('宽度判据 —— 中文按列不算字符', () => {
  it('CJK 记 2 列、ASCII 记 1 列', () => {
    expect(textWidth('abc')).toBe(3)
    expect(textWidth('中文字')).toBe(6)
    expect(textWidth('a中b')).toBe(4)
  })

  it('cutText 在列宽中间遇到宽字符时不把它劈开', () => {
    const { text, rest } = cutText('中文字', 3)
    expect(textWidth(text)).toBeLessThanOrEqual(3)
    expect(text).toBe('中')
    // rest 是**字符串剩余**(按 JS 下标切),不是"剩余列数"——'中' 占 1 个码位
    expect(rest).toBe('文字')
    expect(textWidth(rest)).toBe(4)
  })

  it('cutText 带省略号时结果恰好占满 width 列', () => {
    const { text } = cutText('abcdefghij', 5, true)
    expect(text).toBe('abcd…')
    expect(textWidth(text)).toBe(5)
  })
})

describe('wrapLine —— 折行', () => {
  it('不吞字也不重复字:折出来的文本拼回去与原文一致', () => {
    const src = 'x'.repeat(97)
    const wrapped = wrapLine(plainLine(src), 30)
    expect(wrapped.map((l) => l.segs.map((s) => s.text).join('')).join('')).toBe(src)
    for (const l of wrapped) expect(textWidth(l.segs.map((s) => s.text).join(''))).toBeLessThanOrEqual(30)
  })

  it('单个宽字符比整行还宽时不死循环(宁可溢出也不能挂住)', () => {
    // width=1 + '中'(宽 2 列)是 cutText 返回空串的形态 —— 没有进展保护就是无限循环
    const wrapped = wrapLine(plainLine('中中中'), 1)
    expect(wrapped.length).toBeGreaterThan(0)
    expect(wrapped.length).toBeLessThanOrEqual(4)
  })

  it('段内 \\n 硬换行会起新行,后续段不会挤到上一行', () => {
    const line: FrameLine = { segs: [{ text: 'a\nb', tone: 'plain' }, { text: 'c', tone: 'dim' }] }
    const wrapped = wrapLine(line, 10)
    const texts = wrapped.map((l) => l.segs.map((s) => s.text).join(''))
    expect(texts).toEqual(['a', 'bc'])
  })

  it('折行保留着色档:同一段被拆开时不会丢 tone', () => {
    const wrapped = wrapLine({ segs: [{ text: 'kkkk', tone: 'accent' }, { text: 'dddd', tone: 'bad' }] }, 3)
    expect(wrapped[0]?.segs.map((s) => s.tone)).toEqual(['accent'])
    expect(wrapped[1]?.segs.map((s) => s.tone)).toEqual(['accent', 'bad'])
  })
})

describe('fitLine —— 补齐与裁切', () => {
  it('短行补空格到恰好 width,长行裁到 width', () => {
    expect(textWidth(fitLine(plainLine('abc'), 10).segs.map((s) => s.text).join(''))).toBe(10)
    expect(textWidth(fitLine(plainLine('一二三四五六七八九十'), 6).segs.map((s) => s.text).join(''))).toBe(6)
  })
})

describe('滚动 —— 位置语义', () => {
  it('贴底时 follow=true,往上滚一行即取消跟随', () => {
    const start = scrollInitial()
    expect(start.follow).toBe(true)
    const up = scrollBy(start, -1, 50)
    expect(up.follow).toBe(false)
    expect(up.offsetFromBottom).toBe(1)
    expect(followLabel(up)).toBe('SCROLL')
    expect(followLabel(scrollBottom())).toBe('LIVE')
  })

  it('用户在读历史时新内容到达,不得把视野顶走', () => {
    const reading = { offsetFromBottom: 5, follow: false }
    const grew = afterContentGrew(reading, 3)
    expect(grew.offsetFromBottom).toBe(8)
    expect(grew.follow).toBe(false)
    // 真正的不变量:新内容一律追加在**下方**,所以读着的那一段的绝对行区间不能动。
    const before = visibleWindow(20, 6, reading)
    const after = visibleWindow(23, 6, grew)
    expect(after.start).toBe(before.start)
    expect(after.end).toBe(before.end)
  })

  it('跟随态在新内容到达时保持贴底', () => {
    const grew = afterContentGrew({ offsetFromBottom: 0, follow: true }, 4)
    expect(grew).toEqual({ offsetFromBottom: 0, follow: true })
  })

  it('滚动越界被 clamp,不会算出负下标或超出总高的窗口', () => {
    const way = scrollBy(scrollInitial(), -9999, 10)
    const win = visibleWindow(10, 4, way)
    expect(win.start).toBeGreaterThanOrEqual(0)
    expect(win.end).toBeLessThanOrEqual(10)
    // 滚到最顶:窗口贴在开头,下面还有 6 行没显示
    expect(win.start).toBe(0)
    expect(win.below).toBe(6)
    const top = scrollTop(10)
    const winTop = visibleWindow(10, 4, top)
    expect(winTop.start).toBe(0)
    expect(winTop.end).toBe(4)
    expect(winTop.below).toBe(6)
  })

  it('内容比视口短时,窗口就是全部内容,交代串说清楚"全都在屏上"', () => {
    const win = visibleWindow(3, 10, scrollInitial())
    expect(win.start).toBe(0)
    expect(win.end).toBe(3)
    expect(scrollIndicator(win, 3)).toBe('3/3')
    expect(scrollIndicator(win, 0)).toBe('')
  })
})

describe('composeFrame —— 整屏不变量', () => {
  const sizes = [
    { rows: 12, cols: 40 },
    { rows: 24, cols: 80 },
    { rows: 30, cols: 121 },
    { rows: 14, cols: 41 },
  ]

  for (const size of sizes) {
    it(`${size.cols}x${size.rows}: 帧行数恒等于 rows、每行恒占满 cols`, () => {
      const lines = frameOf(size.rows, size.cols)
      expect(lines).toHaveLength(size.rows)
      for (const l of lines) expect(textWidth(l)).toBe(size.cols)
    })
  }

  it('内容再长也不把帧撑高:500 行转录仍只有 rows 行', () => {
    let tr = createTranscript()
    for (let i = 0; i < 120; i++) tr = foldEvent(tr, { type: 'token', text: `line ${i}\n` })
    const lines = frameOf(20, 60, tr)
    expect(lines).toHaveLength(20)
    for (const l of lines) expect(textWidth(l)).toBe(60)
  })

  it('中文内容不会把行撑破列宽', () => {
    let tr = createTranscript()
    tr = foldEvent(tr, { type: 'token', text: '这是一段中文回复,用来验证按显示宽度折行。' })
    const lines = frameOf(16, 44, tr)
    for (const l of lines) expect(textWidth(l)).toBe(44)
  })

  it('尺寸撑不起布局时:帧仍是 rows x cols(不抛),但 caret=null 表示"别写这一帧"', () => {
    // 抛在渲染循环里等于把终端留在 alt-screen;写一屏空白又等于擦掉用户在读的内容。
    // 所以判据分两半:布局层照常产出满尺寸的空帧,编排层用 caret=null 决定整帧不写。
    const out = snapshotFrame(appState(), null, HEADER, { rows: 3, cols: 10 }, false)
    expect(out.caret).toBeNull()
    expect(out.lines).toHaveLength(3)
    for (const l of out.lines) expect(textWidth(l)).toBe(10)
  })

  it('尺寸够大时 caret 一定落在输入区那一行上(不是 null)', () => {
    const out = snapshotFrame(appState(), null, HEADER, { rows: 20, cols: 60 }, false)
    expect(out.caret).not.toBeNull()
    const boxes = computeBoxes({ rows: 20, cols: 60 })
    expect(out.caret?.row).toBe(boxes?.input)
  })

  it('wrapTranscript 与 composeFrame 用同一份折行:帧里可见行数不会与窗口算法不一致', () => {
    let tr = createTranscript()
    tr = foldEvent(tr, { type: 'token', text: 'a'.repeat(300) })
    const wrapped = wrapTranscript(blocksToLines(tr, { verbose: false }), 80)
    // 同一份输入再走整屏那条链(snapshotFrame → composeFrame)。三件事必须同时成立:
    // ① 内容一字不丢不重(折行只做切分);② 没有超出 cols 的行(超宽=折行根本没生效);
    // ③ **带内容的行数**与折行算法给出的行数逐字相等 —— 这一条才是标题承诺的东西。
    // 只量 wrapTranscript 的那一版用例把 composeFrame 引进来却一次都没调它 ⇒ 承诺无人判,
    // 两处各写一遍折行也不会红(本仓"看起来有、其实没判"那一型)。
    const boxes = computeBoxes({ rows: 30, cols: 80 })
    expect(boxes).not.toBeNull()
    // 只在**消息区那几行**上量:整屏还包含 header/hints,里面的英文单词会污染计数。
    const region = frameOf(30, 80, tr).slice(boxes!.transcriptTop, boxes!.transcriptTop + boxes!.transcriptRows)
    expect(region.join('').replaceAll(/[^a]/g, '').length).toBe(300)
    expect(region.every((l) => l.length <= 80)).toBe(true)
    const contentRows = wrapped.filter((l) => l.segs.some((s) => s.text.includes('a'))).length
    expect(contentRows).toBeGreaterThan(1) // 确实折了(没折的话 300 字符会占满一行)
    expect(region.filter((l) => l.includes('a')).length).toBe(contentRows)
    expect(scrollIndicator(visibleWindow(wrapped.length, 3, scrollInitial()), wrapped.length)).not.toBe('')
  })

  it('顶栏左右两段都在,且仍占满列宽', () => {
    const line = renderHeader({ model: 'm1', workspace: 'ws', session: 'abc123', permissionMode: 'plan' }, 60)
    const text = line.segs.map((s) => s.text).join('')
    expect(text).toContain('m1')
    expect(text).toContain('plan')
    expect(textWidth(text)).toBe(60)
  })
})

describe('输入光标列 —— 按显示宽度', () => {
  it('中文草稿里的光标位置按列算,不按码位数', () => {
    const info = { text: '中文字', caret: 2, placeholder: '' }
    // 前缀 '❯ ' 占 2 列 + 两个汉字占 4 列
    expect(inputCaretColumn(info)).toBe(6)
    expect(inputCaretColumn({ text: 'abc', caret: 3, placeholder: '' })).toBe(5)
  })

  it('caret 越界不会算出负列', () => {
    expect(inputCaretColumn({ text: 'ab', caret: 99, placeholder: '' })).toBe(4)
    expect(inputCaretColumn({ text: 'ab', caret: -3, placeholder: '' })).toBe(2)
  })
})

describe('wrapAll', () => {
  it('空输入给空数组而不是崩', () => {
    expect(wrapAll([], 40)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
