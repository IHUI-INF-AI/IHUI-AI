// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  compressAttribution,
  recordAiAttribution,
  type AttributionRange,
} from '../../src/attribution'

const AT = '2026-11-04T00:00:00.000Z'
const ORIGIN = { at: AT, agentId: 'main', sessionId: 's-1', toolCallId: 'tc-1', model: 'deepseek' }
const FILE = 'src/a.ts'

function sourceOf(ranges: readonly AttributionRange[], line: number): string {
  const hit = ranges.find((r) => r.startLine <= line && line <= r.endLine)
  return hit?.source ?? 'human'
}

function textOf(...lines: string[]): string {
  return lines.join('\n')
}

describe('recordAiAttribution — 以真实 diff 为准', () => {
  it('空文件 → 新写入的每一行都是 ai', () => {
    const result = recordAiAttribution([], '', textOf('a', 'b', 'c'), ORIGIN, { filePath: FILE })
    expect(result.map((r) => [r.startLine, r.endLine, r.source])).toEqual([[1, 3, 'ai']])
  })

  it('10 行文件只改第 4 行 → 仅第 4 行 ai,其余保持 human', () => {
    const before = textOf('l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10')
    const after = textOf('l1', 'l2', 'l3', 'L4-new', 'l5', 'l6', 'l7', 'l8', 'l9', 'l10')
    const result = recordAiAttribution([], before, after, ORIGIN, { filePath: FILE })
    expect(sourceOf(result, 4)).toBe('ai')
    for (const line of [1, 2, 3, 5, 6, 7, 8, 9, 10]) expect(sourceOf(result, line)).toBe('human')
  })

  it('多 hunk:第 2 行与第 11 行都标 ai', () => {
    const before = textOf(...Array.from({ length: 12 }, (_, i) => `l${i + 1}`))
    const after = textOf(
      ...Array.from({ length: 12 }, (_, i) => (i === 1 ? 'X2' : i === 10 ? 'X11' : `l${i + 1}`)),
    )
    const result = recordAiAttribution([], before, after, ORIGIN, { filePath: FILE })
    expect(sourceOf(result, 2)).toBe('ai')
    expect(sourceOf(result, 11)).toBe('ai')
    expect(sourceOf(result, 3)).toBe('human')
  })

  it('全文件重写 → 所有新行 ai', () => {
    const before = textOf('a', 'b', 'c', 'd', 'e')
    const after = textOf('A', 'B', 'C', 'D', 'E')
    const result = recordAiAttribution([], before, after, ORIGIN, { filePath: FILE })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ startLine: 1, endLine: 5, source: 'ai' })
  })

  it('空 diff(after 与 before 相同)→ 原记录压缩后原样返回', () => {
    const old: AttributionRange[] = [
      { filePath: FILE, startLine: 2, endLine: 3, source: 'ai', origin: ORIGIN, revision: 1 },
      {
        filePath: FILE,
        startLine: 4,
        endLine: 4,
        source: 'ai-then-human',
        origin: { at: AT },
        revision: 1,
      },
    ]
    const same = textOf('a', 'b', 'c', 'd', 'e')
    const result = recordAiAttribution(old, same, same, ORIGIN, { filePath: FILE })
    expect(result).toEqual(compressAttribution(old, { filePath: FILE }))
  })

  it('AI 在文件头插入 2 行 → 新行 ai,原行顺延且归属不变', () => {
    const before = textOf('a', 'b', 'c')
    const after = textOf('new1', 'new2', 'a', 'b', 'c')
    const result = recordAiAttribution([], before, after, ORIGIN, { filePath: FILE })
    expect(sourceOf(result, 1)).toBe('ai')
    expect(sourceOf(result, 2)).toBe('ai')
    expect(sourceOf(result, 3)).toBe('human')
  })

  it('AI 删除第 2 行 → 不留 ai 归属,后续行上移', () => {
    const before = textOf('a', 'b', 'c', 'd')
    const after = textOf('a', 'c', 'd')
    const result = recordAiAttribution([], before, after, ORIGIN, { filePath: FILE })
    for (const line of [1, 2, 3]) expect(sourceOf(result, line)).toBe('human')
  })

  it('AI 移动一行(2 → 4)→ 新位置为 ai,原位置不残留', () => {
    const before = textOf('a', 'b', 'c', 'd', 'e')
    const after = textOf('a', 'c', 'b', 'e', 'd')
    const result = recordAiAttribution([], before, after, ORIGIN, { filePath: FILE })
    expect(sourceOf(result, 3)).toBe('ai')
    expect(sourceOf(result, 1)).toBe('human')
  })

  it('保留旧的人工翻转状态:未改动行仍是 ai-then-human', () => {
    const before = textOf('a', 'b', 'c', 'd')
    const old: AttributionRange[] = [
      {
        filePath: FILE,
        startLine: 2,
        endLine: 2,
        source: 'ai-then-human',
        origin: { at: AT },
        revision: 1,
      },
    ]
    const after = textOf('a', 'b', 'c', 'D-new')
    const result = recordAiAttribution(old, before, after, ORIGIN, { filePath: FILE })
    expect(sourceOf(result, 2)).toBe('ai-then-human')
    expect(sourceOf(result, 4)).toBe('ai')
  })

  it('revision 递增且 origin 完整落盘', () => {
    const before = textOf('a', 'b')
    const old: AttributionRange[] = [
      { filePath: FILE, startLine: 1, endLine: 1, source: 'ai', origin: ORIGIN, revision: 3 },
    ]
    const result = recordAiAttribution(old, before, textOf('a', 'B'), ORIGIN, { filePath: FILE })
    expect(result.every((r) => r.revision === 4)).toBe(true)
    const aiRange = result.find((r) => r.source === 'ai')
    expect(aiRange?.origin).toMatchObject({
      agentId: 'main',
      sessionId: 's-1',
      toolCallId: 'tc-1',
      model: 'deepseek',
    })
  })

  it('相邻同源行压缩为单条区间', () => {
    const result = recordAiAttribution([], '', textOf('a', 'b', 'c'), ORIGIN, { filePath: FILE })
    expect(result).toHaveLength(1)
    expect(result[0]?.endLine).toBe(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
