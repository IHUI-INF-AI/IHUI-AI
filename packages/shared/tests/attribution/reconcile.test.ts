// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  applyHumanEdit,
  compressAttribution,
  parseUnifiedDiff,
  reconcileAttribution,
  splitLines,
  type AttributionRange,
} from '../../src/attribution'

const AT = '2026-11-04T00:00:00.000Z'
const AI_ORIGIN = {
  at: AT,
  agentId: 'main',
  sessionId: 's-1',
  toolCallId: 'tc-1',
  model: 'deepseek',
}
const FILE = 'src/a.ts'

function sourceOf(ranges: readonly AttributionRange[], line: number): string {
  const hit = ranges.find((r) => r.startLine <= line && line <= r.endLine)
  return hit?.source ?? 'human'
}

/** 构造「第 from..to 行是 AI 写的」的旧记录(其余行不落记录 = 默认 human)。 */
function aiBlock(from: number, to: number): AttributionRange[] {
  return [
    { filePath: FILE, startLine: from, endLine: to, source: 'ai', origin: AI_ORIGIN, revision: 1 },
  ]
}

describe('reconcileAttribution — 人工编辑后的归属翻转', () => {
  it('反向例①:一次 AI 编辑后手工改一行 → 该行 ai-then-human,其余 AI 行仍是 ai', () => {
    const old = aiBlock(2, 4)
    const diff = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,5 +1,5 @@',
      ' l1',
      ' l2',
      '-l3',
      '+L3-edited',
      ' l4',
      ' l5',
      '',
    ].join('\n')
    const result = reconcileAttribution(old, diff, { at: AT, filePath: FILE })
    expect(sourceOf(result, 2)).toBe('ai')
    expect(sourceOf(result, 3)).toBe('ai-then-human')
    expect(sourceOf(result, 4)).toBe('ai')
    expect(sourceOf(result, 1)).toBe('human')
  })

  it('反向例②:删除 AI 行后再插入同内容行 → 不能自动算回 ai', () => {
    const old = aiBlock(3, 4) // 第 3 行 foo、第 4 行 bar 都是 AI 写的
    const diff = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -3,1 +2,0 @@',
      '-foo',
      '@@ -7,0 +7,1 @@',
      '+foo',
      '',
    ].join('\n')
    const result = reconcileAttribution(old, diff, { at: AT, filePath: FILE, beforeLineCount: 7 })
    // 删除后 bar 上移为第 3 行,仍是 ai
    expect(sourceOf(result, 3)).toBe('ai')
    // 末尾重新插入的 foo 只能是 human —— 内容相同不构成认领依据
    const inserted = result.find((r) => r.endLine === 7 && r.startLine === 7)
    expect(inserted?.source).toBe('human')
    expect(result.some((r) => r.source === 'ai' && r.startLine === 7)).toBe(false)
  })

  it('跨两个 hunk 的人工编辑各自翻转', () => {
    const old = aiBlock(1, 12)
    const diff = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,5 +1,5 @@',
      ' l1',
      '-l2',
      '+L2',
      ' l3',
      ' l4',
      ' l5',
      '@@ -9,5 +9,5 @@',
      ' l9',
      '-l10',
      '+L10',
      ' l11',
      ' l12',
      '',
    ].join('\n')
    const result = reconcileAttribution(old, diff, { at: AT, filePath: FILE })
    expect(sourceOf(result, 2)).toBe('ai-then-human')
    expect(sourceOf(result, 10)).toBe('ai-then-human')
    expect(sourceOf(result, 1)).toBe('ai')
    expect(sourceOf(result, 11)).toBe('ai')
  })

  it('空 diff → 原记录压缩后逐条等值', () => {
    const old = aiBlock(2, 5)
    const result = reconcileAttribution(old, '', { at: AT, filePath: FILE })
    expect(result).toEqual(compressAttribution(old, { filePath: FILE }))
  })

  it('纯人工插入(旧区间无 AI)→ 新行 human,原 AI 行顺延保持 ai', () => {
    const old = aiBlock(3, 4)
    const diff = ['--- a/src/a.ts', '+++ b/src/a.ts', '@@ -0,0 +1,2 @@', '+n1', '+n2', ''].join(
      '\n',
    )
    const result = reconcileAttribution(old, diff, { at: AT, filePath: FILE })
    expect(sourceOf(result, 1)).toBe('human')
    expect(sourceOf(result, 2)).toBe('human')
    expect(sourceOf(result, 5)).toBe('ai')
    expect(sourceOf(result, 6)).toBe('ai')
  })

  it('全文件重写 → 所有 AI 行翻成 ai-then-human', () => {
    const old = aiBlock(1, 6)
    const diff = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,6 +1,6 @@',
      '-a',
      '-b',
      '-c',
      '-d',
      '-e',
      '-f',
      '+A',
      '+B',
      '+C',
      '+D',
      '+E',
      '+F',
      '',
    ].join('\n')
    const result = reconcileAttribution(old, diff, { at: AT, filePath: FILE })
    expect(result.every((r) => r.source !== 'ai')).toBe(true)
    expect(sourceOf(result, 1)).toBe('ai-then-human')
    expect(sourceOf(result, 6)).toBe('ai-then-human')
  })

  it('纯人类编辑(无 AI 记录)→ 结果全是 human', () => {
    const diff = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,3 +1,3 @@',
      ' a',
      '-b',
      '+B',
      ' c',
      '',
    ].join('\n')
    const result = reconcileAttribution([], diff, { at: AT, filePath: FILE })
    expect(result.every((r) => r.source === 'human')).toBe(true)
  })

  it('删除整段 AI 块 → 记录里不再有 ai', () => {
    const old = aiBlock(2, 4)
    const diff = ['--- a/src/a.ts', '+++ b/src/a.ts', '@@ -2,3 +1,0 @@', '-x', '-y', '-z', ''].join(
      '\n',
    )
    const result = reconcileAttribution(old, diff, { at: AT, filePath: FILE })
    expect(result.some((r) => r.source === 'ai')).toBe(false)
  })

  it('revision 递增(以旧记录最大版本 +1 为基准)', () => {
    const old = aiBlock(2, 3)
    const result = reconcileAttribution(old, '', { at: AT, filePath: FILE })
    expect(result.every((r) => r.revision === 1)).toBe(true)
  })

  it('applyHumanEdit 与 reconcileAttribution 对同一变更口径一致', () => {
    const before = ['l1', 'l2', 'l3', 'l4', 'l5']
    const after = ['l1', 'L2', 'l3', 'l4', 'l5']
    const old = aiBlock(2, 4)
    const viaText = applyHumanEdit(old, before.join('\n'), after.join('\n'), {
      at: AT,
      filePath: FILE,
    })
    const diff = [
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1,5 +1,5 @@',
      ' l1',
      '-l2',
      '+L2',
      ' l3',
      ' l4',
      ' l5',
      '',
    ].join('\n')
    const viaDiff = reconcileAttribution(old, diff, { at: AT, filePath: FILE })
    expect(viaText).toEqual(viaDiff)
  })
})

describe('unified diff 解析/生成', () => {
  it('无 count 的 header 按默认 1 解析', () => {
    const hunks = parseUnifiedDiff('@@ -5 +5 @@\n-a\n+b\n')
    expect(hunks).toHaveLength(1)
    expect(hunks[0]).toMatchObject({ oldStart: 5, oldCount: 1, newStart: 5, newCount: 1 })
  })

  it('hunk 内的空上下文行不被误判为块结束', () => {
    const hunks = parseUnifiedDiff(['@@ -1,3 +1,3 @@', ' a', ' ', '-c', '+C', ''].join('\n'))
    expect(hunks[0]?.lines.map((l) => l.kind)).toEqual(['context', 'context', 'del', 'add'])
  })

  it('多个 hunk 全部解析', () => {
    const diff = [
      '@@ -1,2 +1,2 @@',
      '-a',
      '+A',
      ' b',
      '@@ -8,2 +8,2 @@',
      '-h',
      '+H',
      ' i',
      '',
    ].join('\n')
    expect(parseUnifiedDiff(diff)).toHaveLength(2)
  })

  it('splitLines 末尾换行不产生多余空行', () => {
    expect(splitLines('a\nb\n')).toHaveLength(2)
    expect(splitLines('')).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
