// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 全屏 TUI —— 转录上限与可视窗口单测(F-092)。
 *
 * 钉的是两件事:
 *  ① 长会话下转录长度受控(块数 + 总字符两条预算),丢的是最旧的块,最新内容仍在;
 *  ② 每帧交给合成层的行数恒等于视口行数,与转录总行数无关;
 *     内容没变的重复帧命中折行缓存,不再重排全文。
 */
import { describe, expect, it } from 'vitest'

import type { AgentEvent } from '../src/server/agent-core.js'
import { createInputBuffer } from '../src/tui/fullscreen/actions.js'
import { selectTranscriptView, snapshotFrame, transcriptWrapped } from '../src/tui/fullscreen/app.js'
import { computeBoxes } from '../src/tui/fullscreen/geometry.js'
import { scrollBottom, scrollInitial } from '../src/tui/fullscreen/scroll.js'
import {
  MAX_BLOCKS,
  MAX_TEXT_CHARS,
  blocksToLines,
  createTranscript,
  foldEvent,
  trimBlocks,
  type Transcript,
} from '../src/tui/fullscreen/transcript.js'

const HEADER = { model: 'test-model', workspace: 'repo', session: '', permissionMode: 'default' }

const USAGE = { promptTokens: 1, completionTokens: 1, totalTokens: 2, estimatedCostUsd: 0 }

function turn(tr: Transcript, text: string): Transcript {
  const withToken = foldEvent(tr, { type: 'token', text })
  return foldEvent(withToken, {
    type: 'done',
    stopReason: 'end_turn',
    iterations: 1,
    usage: USAGE,
    sessionId: 's1',
  } as AgentEvent)
}

function appState(transcript: Transcript) {
  return {
    transcript,
    scroll: scrollInitial(),
    input: createInputBuffer(),
    verbose: false,
    running: false,
    toast: '',
    activity: '',
  }
}

function regionOf(transcript: Transcript, rows: number, cols: number): string[] {
  const out = snapshotFrame(appState(transcript), null, HEADER, { rows, cols }, false)
  const boxes = computeBoxes({ rows, cols })
  if (!boxes) throw new Error('测试尺寸必须撑得起布局')
  return out.lines.slice(boxes.transcriptTop, boxes.transcriptTop + boxes.transcriptRows)
}

describe('transcript —— 块数上限', () => {
  it(`超过 ${MAX_BLOCKS} 块后长度受控,且丢的是最旧的块、最新内容仍在`, () => {
    let tr = createTranscript()
    for (let i = 0; i < MAX_BLOCKS + 100; i++) tr = turn(tr, `msg-${i} `)
    expect(tr.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS)
    const all = blocksToLines(tr, { verbose: false })
      .map((l) => l.segs.map((s) => s.text).join(''))
      .join('\n')
    expect(all).toContain(`msg-${MAX_BLOCKS + 99}`)
    expect(all).not.toContain('msg-0 ')
  })

  it('裁剪不改入参,且转录其余字段(iteration)照旧保留', () => {
    const blocks = Array.from({ length: MAX_BLOCKS + 10 }, (_, i) => ({ kind: 'notice' as const, tone: 'dim' as const, text: `n${i}` }))
    const trimmed = trimBlocks(blocks)
    expect(blocks).toHaveLength(MAX_BLOCKS + 10)
    expect(trimmed).toHaveLength(MAX_BLOCKS)
    expect(trimmed[trimmed.length - 1]).toEqual(blocks[blocks.length - 1])

    let tr = foldEvent(createTranscript(), { type: 'iteration', count: 3, max: 9 })
    for (let i = 0; i < MAX_BLOCKS + 5; i++) tr = turn(tr, 'x')
    expect(tr.iteration).toBe(3)
    expect(tr.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS)
  })
})

describe('transcript —— 字符预算', () => {
  it('单块正文超预算时保留尾部并留省略标记,总量不超预算', () => {
    const text = 'a'.repeat(MAX_TEXT_CHARS + 50_000)
    const tr = foldEvent(createTranscript(), { type: 'token', text })
    const assistant = tr.blocks[0]
    if (!assistant || assistant.kind !== 'assistant') throw new Error('应折成一条 assistant')
    expect(assistant.text.length).toBeLessThanOrEqual(MAX_TEXT_CHARS)
    expect(assistant.text).toContain('已省略')
    expect(assistant.text.endsWith('a')).toBe(true)
  })

  it('总字符超预算时照样裁到块内预算以内', () => {
    let tr = createTranscript()
    const chunk = 'b'.repeat(4_000)
    for (let i = 0; i < 60; i++) {
      tr = foldEvent(tr, { type: 'token', text: chunk })
      tr = foldEvent(tr, { type: 'done', stopReason: 'end_turn', iterations: 1, usage: USAGE, sessionId: 's1' } as AgentEvent)
    }
    const chars = tr.blocks.reduce((n, b) => n + (b.kind === 'tool' ? b.preview.length : b.kind === 'turn' ? 0 : b.text.length), 0)
    expect(chars).toBeLessThanOrEqual(MAX_TEXT_CHARS)
    expect(tr.blocks.length).toBeLessThanOrEqual(MAX_BLOCKS)
  })
})

describe('app —— 渲染只投影可视窗口', () => {
  it('交给合成层的行数恒等于视口行数,与转录总行数无关', () => {
    let tr = createTranscript()
    for (let i = 0; i < 200; i++) tr = turn(tr, `NEWS-${i} `)
    const total = transcriptWrapped(tr, false, 60).length
    expect(total).toBeGreaterThan(100)
    const view = selectTranscriptView(tr, false, 60, 15, scrollBottom())
    expect(view.total).toBe(total)
    expect(view.view).toHaveLength(15)
    expect(view.view.length).toBe(view.win.end - view.win.start)
    expect(view.win.end).toBeLessThanOrEqual(total)
  })

  it('滚到顶时同样只取一屏,且首行是转录最开头', () => {
    let tr = createTranscript()
    for (let i = 0; i < 200; i++) tr = turn(tr, `NEWS-${i} `)
    const view = selectTranscriptView(tr, false, 60, 10, { offsetFromBottom: 10_000, follow: false })
    expect(view.view).toHaveLength(10)
    expect(view.win.start).toBe(0)
    const text = view.view.map((l) => l.segs.map((s) => s.text).join('')).join('\n')
    expect(text).toContain('NEWS-0 ')
  })

  it('整帧消息区只出现最新的内容,老内容不会因为全量重排漏进来', () => {
    let tr = createTranscript()
    for (let i = 0; i < 200; i++) tr = turn(tr, `NEWS-${i} `)
    const region = regionOf(tr, 20, 60).join('\n')
    expect(region).toContain('NEWS-199 ')
    expect(region).not.toContain('NEWS-0 ')
  })

  it('内容没变的重复帧命中折行缓存(不重排全文),内容一变就重算', () => {
    const tr = turn(createTranscript(), 'cached ')
    const a = transcriptWrapped(tr, false, 60)
    expect(transcriptWrapped(tr, false, 60)).toBe(a)
    // 列宽/verbose 变了必须重算:同一转录不同投影不能用同一份缓存
    expect(transcriptWrapped(tr, false, 40)).not.toBe(a)
    expect(transcriptWrapped(tr, true, 60)).not.toBe(a)
    // 新转录对象(foldEvent 的产物)一定重新折行
    const next = turn(tr, 'more ')
    expect(transcriptWrapped(next, false, 60)).not.toBe(a)
  })
})
