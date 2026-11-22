// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * diff-stat → DiffFile 映射判据(2026-11-23):
 * 状态、增删行数、语言、id 必须一一对上;这是 N+1 子进程收口后的唯一转换点。
 */

import { describe, expect, it } from 'vitest'
import { mapGitDiffStatToDiffFiles } from './ide-workspace'

describe('mapGitDiffStatToDiffFiles', () => {
  it('状态与统计原样落到 DiffFile', () => {
    const files = mapGitDiffStatToDiffFiles([
      {
        path: 'src/a.ts',
        status: 'modified',
        additions: 3,
        deletions: 1,
        staged: true,
        unstaged: false,
      },
      {
        path: 'docs/readme.md',
        status: 'added',
        additions: 10,
        deletions: 0,
        staged: true,
        unstaged: false,
      },
      {
        path: 'old.txt',
        status: 'deleted',
        additions: 0,
        deletions: 8,
        staged: false,
        unstaged: true,
      },
      {
        path: 'renamed.ts',
        status: 'renamed',
        additions: 2,
        deletions: 2,
        staged: false,
        unstaged: true,
      },
    ])
    expect(files.map((f) => [f.filename, f.status, f.additions, f.deletions])).toEqual([
      ['src/a.ts', 'modified', 3, 1],
      ['docs/readme.md', 'added', 10, 0],
      ['old.txt', 'deleted', 0, 8],
      ['renamed.ts', 'renamed', 2, 2],
    ])
  })

  it('id 带 diff- 前缀,语言按扩展名映射,未知扩展名回落 text', () => {
    const [ts, unknown] = mapGitDiffStatToDiffFiles([
      {
        path: 'src/a.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        staged: false,
        unstaged: true,
      },
      {
        path: 'LICENSE',
        status: 'modified',
        additions: 0,
        deletions: 1,
        staged: false,
        unstaged: true,
      },
    ])
    expect(ts?.id).toBe('diff-src/a.ts')
    expect(ts?.language).toBe('typescript')
    expect(unknown?.language).toBe('text')
  })

  it('同一文件 staged/unstaged 两面均为真时原样保留', () => {
    const [file] = mapGitDiffStatToDiffFiles([
      {
        path: 'src/both.ts',
        status: 'modified',
        additions: 4,
        deletions: 2,
        staged: true,
        unstaged: true,
      },
    ])
    expect(file?.staged).toBe(true)
    expect(file?.unstaged).toBe(true)
  })

  it('空清单返回空数组', () => {
    expect(mapGitDiffStatToDiffFiles([])).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
