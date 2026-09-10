// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import type { FileNode } from '@ihui/types'
import {
  flattenFiles,
  getRenamedPath,
  isPathInWorkspace,
  normalizePath,
  parseOutline,
  validateFileName,
} from '../file-explorer/model'

const tree: FileNode[] = [
  {
    id: 'src',
    name: 'src',
    path: 'src',
    type: 'folder',
    children: [
      { id: 'a', name: 'alpha.ts', path: 'src/alpha.ts', type: 'file', children: undefined },
      { id: 'b', name: 'Beta.tsx', path: 'src/Beta.tsx', type: 'file', children: undefined },
    ],
  },
  { id: 'r', name: 'readme.md', path: 'readme.md', type: 'file', children: undefined },
]

describe('file-explorer-model', () => {
  it('parses top-level outline declarations', () => {
    const nodes = parseOutline(
      [
        'export function build() {}',
        'export const value = 1',
        'const callback = async () => 1',
        'export interface Result {}',
        'type Alias = string',
        '// ignored',
      ].join('\n'),
    )
    expect(nodes.map((node) => [node.type, node.label, node.line])).toEqual([
      ['function', 'build', 1],
      ['variable', 'value', 2],
      ['function', 'callback', 3],
      ['interface', 'Result', 4],
      ['type', 'Alias', 5],
    ])
  })

  it('flattens matching files recursively', () => {
    expect(flattenFiles(tree, 'beta')).toEqual([tree[0]?.children?.[1]])
    expect(flattenFiles(tree, 'ts')).toHaveLength(2)
    expect(flattenFiles(tree, '')).toHaveLength(3)
  })

  it('renames the final path segment and keeps separators normalized', () => {
    expect(getRenamedPath('src/old.ts', 'new.ts')).toBe('src/new.ts')
    expect(getRenamedPath('src\\old.ts', 'new.ts')).toBe('src/new.ts')
    expect(getRenamedPath('old.ts', 'new.ts')).toBe('new.ts')
  })

  it('blocks unsafe filenames and path escapes', () => {
    expect(validateFileName('valid.ts')).toBeNull()
    expect(validateFileName('')).toBe('文件名不能为空')
    expect(validateFileName('a..b')).toBe('文件名不能包含 ..')
    expect(validateFileName('a`;rm.ts')).toBe('文件名包含非法字符')
  })

  it('contains normalized paths within the workspace', () => {
    expect(normalizePath('G:\\repo\\src\\')).toBe('G:/repo/src')
    expect(isPathInWorkspace('G:/repo/src/a.ts', 'G:\\repo')).toBe(true)
    expect(isPathInWorkspace('G:/repo', 'G:/repo')).toBe(true)
    expect(isPathInWorkspace('G:/outside/a.ts', 'G:/repo')).toBe(false)
    expect(isPathInWorkspace('G:/repo/../outside/a.ts', 'G:/repo')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
