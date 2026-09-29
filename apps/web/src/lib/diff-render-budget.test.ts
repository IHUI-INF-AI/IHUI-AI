// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  MAX_DIFF_LCS_CELLS,
  buildBudgetedDiff,
  buildBudgetedDiffPatch,
} from './diff-render-budget'

function rangeLines(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`)
}

describe('buildBudgetedDiff 基础正确性', () => {
  it('小 diff:hunk 行号/计数/行序符合 unified 语义', () => {
    const diff = buildBudgetedDiff('a\nb\nc', 'a\nx\nc', { contextLines: 2 })
    expect(diff.hunks).toHaveLength(1)
    const hunk = diff.hunks[0]!
    expect(hunk.oldStart).toBe(1)
    expect(hunk.newStart).toBe(1)
    expect(hunk.oldCount).toBe(3)
    expect(hunk.newCount).toBe(3)
    expect(hunk.rows.map((row) => `${row.op}:${row.text}`)).toEqual([
      'equal:a',
      'delete:b',
      'insert:x',
      'equal:c',
    ])
    expect(diff.usedAnchorFallback).toBe(false)
    expect(diff.usedWholeBlockFallback).toBe(false)
  })

  it('内容一致 → 无 hunk;patch 出口返回 null', () => {
    const diff = buildBudgetedDiff('a\nb', 'a\nb')
    expect(diff.hunks).toEqual([])
    expect(buildBudgetedDiffPatch('a\nb', 'a\nb', 'f.txt')).toBeNull()
  })

  it('未限制 context 时整个差异区并为一个 hunk;context=0 时按改动切分', () => {
    const before = 'a\nb\nc\nd\ne'
    const after = 'A\nb\nC\nd\nE'
    expect(buildBudgetedDiff(before, after).hunks).toHaveLength(1)
    const zeroContext = buildBudgetedDiff(before, after, { contextLines: 0 })
    expect(zeroContext.hunks).toHaveLength(3)
    expect(zeroContext.hunks[0]!.rows.map((row) => row.op)).toEqual(['delete', 'insert'])
  })

  it('纯插入/纯删除行号符合 unified 语义', () => {
    const insertAtHead = buildBudgetedDiff('', 'x\ny\nz')
    expect(insertAtHead.hunks[0]!.oldStart).toBe(0)
    expect(insertAtHead.hunks[0]!.newStart).toBe(1)

    // context=0:头部公共行虽被裁掉,游标仍须计入——尾部纯插入 hunk
    // 的 oldStart = 插入点前一行(旧行 2 之后),newStart = 3
    const appendAtTail = buildBudgetedDiff('a\nb', 'a\nb\nc', { contextLines: 0 })
    expect(appendAtTail.hunks).toHaveLength(1)
    expect(appendAtTail.hunks[0]!.rows.every((row) => row.op === 'insert')).toBe(true)
    expect(appendAtTail.hunks[0]!.oldStart).toBe(2)
    expect(appendAtTail.hunks[0]!.newStart).toBe(3)
  })
})

describe('唯一行锚点拆段(超 60k cell 降级)', () => {
  it('前后各改 3 行、中间隔 5000 行不变区:锚点拆段不产生整段红绿大块', () => {
    const shared = rangeLines('shared', 5000)
    const before = [...rangeLines('head', 3), ...shared, ...rangeLines('tail', 3)]
    const after = [...rangeLines('HEAD', 3), ...shared, ...rangeLines('TAIL', 3)]
    const diff = buildBudgetedDiff(before.join('\n'), after.join('\n'), { contextLines: 3 })

    expect(diff.usedAnchorFallback).toBe(true)
    expect(diff.usedWholeBlockFallback).toBe(false)
    expect(diff.hunks.length).toBeGreaterThan(1)

    const changeRowCount = diff.hunks.reduce(
      (total, hunk) =>
        total + hunk.rows.filter((row) => row.op !== 'equal').length,
      0,
    )
    // 只有真实的 3+3+3+3 行参与红绿,夹在中间的 5000 行未被拖入
    expect(changeRowCount).toBe(12)
  })

  it('锚点全无(整文件重写)才退化为整段全删全增', () => {
    const before = rangeLines('old', 300).join('\n')
    const after = rangeLines('new', 300).join('\n')
    const diff = buildBudgetedDiff(before, after)

    // 两侧无任何共同行 → 找不到锚点,usedAnchorFallback 为 false,直接整段全删全增
    expect(diff.usedAnchorFallback).toBe(false)
    expect(diff.usedWholeBlockFallback).toBe(true)
    expect(diff.hunks).toHaveLength(1)
    expect(diff.hunks[0]!.rows.every((row) => row.op !== 'equal')).toBe(true)
  })

  it('LCS 预算常量为 60000 cell', () => {
    expect(MAX_DIFF_LCS_CELLS).toBe(60_000)
  })
})

describe('context 预裁剪拼串预算', () => {
  it('大文件 context=3 时 patch 字节数有上界,公共区深处不进 patch', () => {
    const before = [...rangeLines('shared', 2000), 'const target = 1', ...rangeLines('shared', 2000)]
    const after = [...before.slice(0, 2000), 'const target = 2', ...before.slice(2001)]
    const patch = buildBudgetedDiffPatch(before.join('\n'), after.join('\n'), 'big-file.ts', {
      contextLines: 3,
    })

    expect(patch).not.toBeNull()
    // 上界:头部 3 行 + @@ + 改动 2 行 + 上下文 6 行 ≪ 整份 4001 行文件
    expect(patch!.length).toBeLessThan(2_000)
    expect(patch).not.toContain('shared-1000')
    expect(patch).toContain('const target = 1')
    expect(patch).toContain('+const target = 2')
  })
})

describe('手拼 unified patch 头部边界', () => {
  it('删除 SQL 注释正文生成 `--- ` 形态行,补 diff --git 头后不误判第二文件', () => {
    const before = 'SELECT 1\n-- legacy comment\nSELECT 2'
    const after = 'SELECT 1\nSELECT 2'
    const patch = buildBudgetedDiffPatch(before, after, 'query.sql')!

    // 边界头在最前,正文里的 `--- legacy comment`(删除行 `-` + `-- ...` 恰好三连杠,
    // 与文件头同形态)只能出现在 @@ hunk 体内,不能落在文件头区
    expect(patch.startsWith('diff --git a/query.sql b/query.sql\n')).toBe(true)
    expect(patch.split('\n').filter((line) => line.startsWith('diff --git '))).toHaveLength(1)
    const lines = patch.split('\n')
    const hunkHeaderIndex = lines.findIndex((line) => line.startsWith('@@'))
    const bodyLineIndex = lines.indexOf('--- legacy comment')
    expect(bodyLineIndex).toBeGreaterThan(hunkHeaderIndex)
    expect(lines[1]).toBe('--- a/query.sql')
  })

  it('新建文件用 /dev/null 表示不存在的一侧', () => {
    const patch = buildBudgetedDiffPatch('', 'hello\nworld', 'created.txt')!
    expect(patch.startsWith('diff --git a/created.txt b/created.txt\n')).toBe(true)
    expect(patch).toContain('\n--- /dev/null\n')
    expect(patch).toContain('\n+++ b/created.txt\n')
  })

  it('删除文件用 /dev/null 表示不存在的一侧', () => {
    const patch = buildBudgetedDiffPatch('hello\nworld', '', 'deleted.txt')!
    expect(patch).toContain('\n--- a/deleted.txt\n')
    expect(patch).toContain('\n+++ /dev/null\n')
  })

  it('patch 的 @@ 计数与 hunk 行数一致(可被标准解析器消费)', () => {
    const patch = buildBudgetedDiffPatch('a\nb\nc', 'a\nx\nc', 'f.txt', { contextLines: 2 })!
    const hunkLine = patch.split('\n').find((line) => line.startsWith('@@'))!
    expect(hunkLine).toBe('@@ -1,3 +1,3 @@')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
