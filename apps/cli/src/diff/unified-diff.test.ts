/**
 * Unified Diff 模块单元测试。
 * 对标 xai-hunk-tracker/src/diff.rs::tests 的核心场景。
 */

import { describe, it, expect } from 'vitest'
import {
  computeHunks,
  generateUnifiedPatch,
  generateHunkPatch,
  formatUnifiedDiff,
  patchLines,
  type Hunk,
} from './unified-diff.js'

describe('computeHunks', () => {
  it('no changes returns empty array', () => {
    const content = 'line 1\nline 2\nline 3\n'
    const hunks = computeHunks('test.ts', content, content)
    expect(hunks).toHaveLength(0)
  })

  it('single line modification produces 1 hunk', () => {
    const baseline = 'line 1\nline 2\nline 3\n'
    const current = 'line 1\nmodified\nline 3\n'
    const hunks = computeHunks('test.ts', baseline, current)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.lineInfo.oldStart).toBe(2)
    expect(hunks[0]!.lineInfo.newStart).toBe(2)
    expect(hunks[0]!.oldText).toBe('line 2\n')
    expect(hunks[0]!.newText).toBe('modified\n')
  })

  it('pure insertion: oldCount=0, oldText=null', () => {
    const baseline = 'line 1\nline 2\n'
    const current = 'line 1\ninserted\nline 2\n'
    const hunks = computeHunks('test.ts', baseline, current)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.oldText).toBeNull()
    expect(hunks[0]!.newText).toBe('inserted\n')
    expect(hunks[0]!.lineInfo.oldCount).toBe(0)
    expect(hunks[0]!.lineInfo.newCount).toBe(1)
  })

  it('pure deletion: newCount=0, newText=""', () => {
    const baseline = 'line 1\nline 2\nline 3\n'
    const current = 'line 1\nline 3\n'
    const hunks = computeHunks('test.ts', baseline, current)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.oldText).toBe('line 2\n')
    expect(hunks[0]!.newText).toBe('')
    expect(hunks[0]!.lineInfo.oldCount).toBe(1)
    expect(hunks[0]!.lineInfo.newCount).toBe(0)
  })

  it('multiple non-contiguous changes produce multiple hunks', () => {
    const baseline = 'line 1\nline 2\nline 3\nline 4\nline 5\n'
    const current = 'modified 1\nline 2\nline 3\nline 4\nmodified 5\n'
    const hunks = computeHunks('test.ts', baseline, current)
    expect(hunks.length).toBeGreaterThanOrEqual(2)
    expect(hunks[0]!.lineInfo.oldStart).toBe(1)
    // 最后一个 hunk 应包含 line 5 的修改
    const lastHunk = hunks[hunks.length - 1]!
    expect(lastHunk.lineInfo.oldStart).toBe(5)
  })

  it('completely replaced content', () => {
    const baseline = 'a\nb\nc\n'
    const current = 'x\ny\nz\n'
    const hunks = computeHunks('test.ts', baseline, current)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.oldText).toBe('a\nb\nc\n')
    expect(hunks[0]!.newText).toBe('x\ny\nz\n')
  })

  it('appended content (insert at end)', () => {
    const baseline = 'a\nb\n'
    const current = 'a\nb\nc\nd\n'
    const hunks = computeHunks('test.ts', baseline, current)
    expect(hunks).toHaveLength(1)
    expect(hunks[0]!.oldText).toBeNull()
    expect(hunks[0]!.newText).toBe('c\nd\n')
    expect(hunks[0]!.lineInfo.newStart).toBe(3)
  })
})

describe('generateUnifiedPatch', () => {
  it('returns null when content identical', () => {
    const content = 'same\n'
    expect(generateUnifiedPatch('test.ts', content, content)).toBeNull()
  })

  it('returns null for empty inputs', () => {
    expect(generateUnifiedPatch('test.ts', '', '')).toBeNull()
  })

  it('produces standard unified diff format with file headers', () => {
    const baseline = 'a\nb\nc\n'
    const current = 'a\nB\nc\n'
    const patch = generateUnifiedPatch('src/foo.ts', baseline, current)!
    expect(patch).toContain('--- a/src/foo.ts')
    expect(patch).toContain('+++ b/src/foo.ts')
    expect(patch).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/m)
    expect(patch).toContain('-b')
    expect(patch).toContain('+B')
  })

  it('multi-hunk patch contains multiple @@ headers', () => {
    const baseline = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n'
    const current = '1\n2\n3\n4\nX\n6\n7\n8\n9\nY\n'
    const patch = generateUnifiedPatch('test.ts', baseline, current)
    expect(patch).not.toBeNull()
    const matches = patch!.match(/^@@ /gm)
    expect(matches!.length).toBeGreaterThanOrEqual(2)
  })

  it('pure insert patch', () => {
    const baseline = 'a\nb\nc\n'
    const current = 'a\nb\nx\nc\n'
    const patch = generateUnifiedPatch('test.ts', baseline, current)!
    expect(patch).toContain('+x')
  })

  it('pure delete patch', () => {
    const baseline = 'a\nb\nc\n'
    const current = 'a\nc\n'
    const patch = generateUnifiedPatch('test.ts', baseline, current)!
    expect(patch).toContain('-b')
  })
})

describe('formatUnifiedDiff (single hunk)', () => {
  it('formats hunk with file headers', () => {
    const hunk: Hunk = {
      id: 'h1',
      path: 'test.ts',
      lineInfo: { oldStart: 2, oldCount: 1, newStart: 2, newCount: 1 },
      oldText: 'old line\n',
      newText: 'new line\n',
      patch: null,
    }
    const out = formatUnifiedDiff(hunk)
    expect(out).toContain('--- a/test.ts')
    expect(out).toContain('+++ b/test.ts')
    expect(out).toContain('-old line')
    expect(out).toContain('+new line')
  })
})

describe('patchLines', () => {
  it('basic replace', () => {
    const content = 'line 1\nline 2\nline 3\nline 4\nline 5\n'
    const patched = patchLines(content, 2, 1, 'CHANGED\n')
    expect(patched).toBe('line 1\nCHANGED\nline 3\nline 4\nline 5\n')
  })

  it('pure insert (removeCount=0)', () => {
    const content = 'line 1\nline 2\nline 3\n'
    const patched = patchLines(content, 2, 0, 'INSERTED\n')
    expect(patched).toBe('line 1\nINSERTED\nline 2\nline 3\n')
  })

  it('pure delete (insertText empty)', () => {
    const content = 'line 1\nline 2\nline 3\n'
    const patched = patchLines(content, 2, 1, '')
    expect(patched).toBe('line 1\nline 3\n')
  })

  it('preserves trailing newline of original', () => {
    const content = 'a\nb\n'
    const patched = patchLines(content, 1, 1, 'A\n')
    expect(patched).toBe('A\nb\n')
  })

  it('handles removeCount > available lines (clamp)', () => {
    const content = 'a\nb\n'
    const patched = patchLines(content, 1, 10, 'X\n')
    expect(patched).toBe('X\n')
  })
})

describe('generateHunkPatch (with context)', () => {
  it('includes context lines and correct header', () => {
    const baseline = '1\n2\n3\n4\n5\n'
    const current = '1\n2\nchanged 3\n4\n5\n'
    const hunks = computeHunks('test.ts', baseline, current)
    expect(hunks).toHaveLength(1)
    const patch = generateHunkPatch(baseline, current, hunks[0]!)
    expect(patch).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/)
    expect(patch).toContain(' 1')
    expect(patch).toContain(' 2')
    expect(patch).toContain('-3')
    expect(patch).toContain('+changed 3')
    expect(patch).toContain(' 4')
    expect(patch).toContain(' 5')
  })
})

describe('size / timeout guards', () => {
  it('returns empty for over-size input', () => {
    const huge = 'x'.repeat(1024 * 1024 + 10)
    const hunks = computeHunks('test.ts', huge, huge + 'y')
    expect(hunks).toHaveLength(0)
  })

  it('returns null patch for over-size input', () => {
    const huge = 'x'.repeat(1024 * 1024 + 10)
    const patch = generateUnifiedPatch('test.ts', huge, huge + 'y')
    expect(patch).toBeNull()
  })
})
