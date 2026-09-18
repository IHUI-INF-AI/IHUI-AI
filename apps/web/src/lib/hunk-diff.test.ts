// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect } from 'vitest'
import {
  buildPartialContent,
  computeHunkDiff,
  detectEol,
  isUnchangedPartial,
  joinLines,
  splitLinesWithEol,
} from './hunk-diff'

/**
 * hunk-diff 纯函数单测(2026-09-18 立,W5 hunk 级接受/拒绝)。
 *
 * 锁定四类不变量:
 *  1. hunk 切分确定性(被 equal 行隔开 → 多个 hunk;相邻改动合并为一个)
 *  2. 部分应用重组正确(接受 A 拒绝 B → 只落 A)
 *  3. 行尾符保持(CRLF 文件不因重组变成 LF;结尾无换行不被凭空补上)
 *  4. 全拒绝 → 输出与原文逐字节一致(调用方据此跳过写盘,不写出空文件)
 */

describe('splitLinesWithEol', () => {
  it('保留各种行尾符且不产生幽灵空行', () => {
    expect(splitLinesWithEol('a\nb\n')).toEqual([
      { text: 'a', eol: '\n' },
      { text: 'b', eol: '\n' },
    ])
    expect(splitLinesWithEol('a\r\nb')).toEqual([
      { text: 'a', eol: '\r\n' },
      { text: 'b', eol: '' },
    ])
    expect(splitLinesWithEol('a\rb')).toEqual([
      { text: 'a', eol: '\r' },
      { text: 'b', eol: '' },
    ])
  })

  it('空文本视为 0 行', () => {
    expect(splitLinesWithEol('')).toEqual([])
    // 单个换行符 = 一行空内容 + 换行(而非两行)
    expect(splitLinesWithEol('\n')).toEqual([{ text: '', eol: '\n' }])
  })
})

describe('detectEol / joinLines', () => {
  it('主流行尾符判定', () => {
    expect(detectEol('a\r\nb\r\nc\r\n')).toBe('\r\n')
    expect(detectEol('a\nb\nc\n')).toBe('\n')
    expect(detectEol('a\r\nb\nc\n')).toBe('\n')
    expect(detectEol('no-newline')).toBe('\n')
  })

  it('非末行缺行尾符时补 fallback,末行保留', () => {
    expect(
      joinLines(
        [
          { text: 'a', eol: '\r\n' },
          { text: 'b', eol: '' },
          { text: 'c', eol: '' },
        ],
        '\r\n',
      ),
    ).toBe('a\r\nb\r\nc')
  })
})

describe('computeHunkDiff 切分', () => {
  it('被 equal 行隔开的改动 → 两个 hunk', () => {
    const oldText = ['a', 'b', 'c', 'd', 'e'].join('\n')
    const newText = ['a', 'B', 'c', 'D', 'e'].join('\n')
    const diff = computeHunkDiff(oldText, newText)
    expect(diff.hunks).toHaveLength(2)
    expect(diff.hunks[0]!.removed).toBe(1)
    expect(diff.hunks[0]!.added).toBe(1)
    expect(diff.hunks[1]!.added).toBe(1)
    // 渲染序列行数 = equal(3) + 改动(2 组 × 2 行)
    expect(diff.rows).toHaveLength(7)
    // hunkIdByRow 与 rows 等长且 equal 行为 null
    expect(diff.hunkIdByRow).toHaveLength(diff.rows.length)
    expect(diff.hunkIdByRow.filter((v) => v === null)).toHaveLength(3)
  })

  it('相邻的删除+插入合并为同一个 hunk', () => {
    const diff = computeHunkDiff('x\ny\nz', 'x\nY1\nY2\nz')
    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]!.removed).toBe(1)
    expect(diff.hunks[0]!.added).toBe(2)
  })

  it('纯新增文件(原文为空):单 hunk 且 oldStart === oldEnd === 0', () => {
    const diff = computeHunkDiff('', 'a\nb\n')
    expect(diff.hunks).toHaveLength(1)
    const hunk = diff.hunks[0]!
    expect(hunk.oldStart).toBe(0)
    expect(hunk.oldEnd).toBe(0)
    expect(hunk.added).toBe(2)
    expect(hunk.removed).toBe(0)
  })

  it('文件末尾追加行:插入点定位在 EOF', () => {
    const diff = computeHunkDiff('a\nb\n', 'a\nb\nc\n')
    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]!.oldStart).toBe(2)
    expect(diff.hunks[0]!.oldEnd).toBe(2)
    expect(diff.hunks[0]!.newStartLine).toBe(3)
  })
})

describe('buildPartialContent 部分应用', () => {
  const oldText = ['a', 'b', 'c', 'd', 'e'].join('\n') + '\n'
  const newText = ['a', 'B', 'c', 'D', 'e'].join('\n') + '\n'

  it('接受第 1 个、拒绝第 2 个 → 只落第 1 个改动', () => {
    const diff = computeHunkDiff(oldText, newText)
    const partial = buildPartialContent(oldText, diff.hunks, new Set([0]))
    expect(partial).toBe(['a', 'B', 'c', 'd', 'e'].join('\n') + '\n')
  })

  it('接受全部 → 等同 newContent', () => {
    const diff = computeHunkDiff(oldText, newText)
    const partial = buildPartialContent(oldText, diff.hunks, new Set([0, 1]))
    expect(partial).toBe(newText)
  })

  it('全拒绝 → 与原文逐字节一致(据此跳过写盘)', () => {
    const diff = computeHunkDiff(oldText, newText)
    const partial = buildPartialContent(oldText, diff.hunks, new Set())
    expect(partial).toBe(oldText)
    expect(isUnchangedPartial(oldText, partial)).toBe(true)
  })

  it('接受顺序无关(乱序传入 hunk 结果一致)', () => {
    const diff = computeHunkDiff(oldText, newText)
    const reversed = [...diff.hunks].reverse()
    expect(buildPartialContent(oldText, reversed, new Set([1]))).toBe(
      buildPartialContent(oldText, diff.hunks, new Set([1])),
    )
  })
})

describe('行尾符与结尾换行保持', () => {
  it('CRLF 文件重组后仍为 CRLF', () => {
    const oldText = 'a\r\nb\r\nc\r\n'
    const newText = 'a\r\nB\r\nc\r\n'
    const diff = computeHunkDiff(oldText, newText)
    const partial = buildPartialContent(oldText, diff.hunks, new Set([0]))
    expect(partial).toBe('a\r\nB\r\nc\r\n')
    expect(partial.includes('\n\n')).toBe(false)
  })

  it('原文结尾无换行且改动不在末尾 → 结尾仍无换行', () => {
    const oldText = 'a\nb\nc'
    const newText = 'a\nB\nc'
    const diff = computeHunkDiff(oldText, newText)
    const partial = buildPartialContent(oldText, diff.hunks, new Set([0]))
    expect(partial).toBe('a\nB\nc')
    expect(partial.endsWith('\n')).toBe(false)
  })

  it('新内容为 LF 而旧文件为 CRLF → 新行按旧文件风格写入,不污染换行', () => {
    const oldText = 'a\r\nb\r\nc\r\n'
    const newText = 'a\nB\nc\n'
    const diff = computeHunkDiff(oldText, newText)
    const partial = buildPartialContent(oldText, diff.hunks, new Set([0]))
    expect(partial).toBe('a\r\nB\r\nc\r\n')
  })

  it('纯新增文件:接受后内容与模板一致', () => {
    const diff = computeHunkDiff('', 'x\ny\n')
    expect(buildPartialContent('', diff.hunks, new Set([0]))).toBe('x\ny\n')
    expect(buildPartialContent('', diff.hunks, new Set())).toBe('')
  })

  it('EOF 追加行被接受 → 补上结尾换行;被拒绝 → 原文不变', () => {
    const oldText = 'a\nb'
    const newText = 'a\nb\nc\n'
    const diff = computeHunkDiff(oldText, newText)
    expect(buildPartialContent(oldText, diff.hunks, new Set([0]))).toBe('a\nb\nc\n')
    expect(buildPartialContent(oldText, diff.hunks, new Set())).toBe('a\nb')
  })
})

describe('超大文件降级', () => {
  it('超过 LCS 格子上限时退化为单个 hunk,部分应用仍正确', () => {
    // 2500 × 2500 = 625 万 > 400 万上限
    const oldLines = Array.from({ length: 2500 }, (_, i) => `old-${i}`)
    const newLines = Array.from({ length: 2500 }, (_, i) => `new-${i}`)
    const oldText = oldLines.join('\n') + '\n'
    const newText = newLines.join('\n') + '\n'
    const diff = computeHunkDiff(oldText, newText)
    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]!.removed).toBe(2500)
    expect(diff.hunks[0]!.added).toBe(2500)
    expect(buildPartialContent(oldText, diff.hunks, new Set())).toBe(oldText)
    expect(buildPartialContent(oldText, diff.hunks, new Set([0]))).toBe(newText)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
