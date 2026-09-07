// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​‌​​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌‌‌‌‌‍‍​‌‌​‌‌‌​‌​‍‍​‌‌‌​‌‌‌‍‍​‌‌‌​‌‌​‌‍‍​‌​​​‌‌‌‍‍​‌‌‌‌‌​‌‍‍​‌‌‌‌‌​‌‍‍‌​‌‌‌‌​‌‌‍‍​‌‌‌‌‌‌‍‍​‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌‍‍‌‌‌‌‌‌‌⁠

/**
 * workspace-context-loader 测试(2026-09-07 立)
 *
 * 覆盖两项"读取不全"残留缺陷修复:
 *   1. 根目录优先文件(README.md 等)超 50KB:截断保留而非静默丢弃
 *   2. totalSize 按截断后大小累加(单文件超限时预算不再虚高)
 *
 * FileSystemDirectoryHandle 用内存 stub 模拟(仅实现 loader 用到的
 * getFileHandle / values / getFile / slice / text)。
 */
import { describe, expect, it } from 'vitest'
import { loadWorkspaceContext } from '../workspace-context-loader'

const MAX_FILE_SIZE = 50 * 1024

interface DirEntry {
  kind: 'file' | 'directory'
  name: string
  value?: string
  children?: DirEntry[]
}

/** 构造最小可用 FileSystemDirectoryHandle stub(带真实 size 计算) */
function dir(entries: DirEntry[], name = 'ws'): FileSystemDirectoryHandle {
  const fileBlob = (content: string) => ({
    name: 'f',
    size: content.length,
    lastModified: 1,
    slice: (start: number) => ({ text: async () => content.slice(start) }),
    text: async () => content,
  })
  const obj: Record<string, unknown> = {
    name,
    kind: 'directory',
    async getFileHandle(fileName: string) {
      const hit = entries.find((e) => e.kind === 'file' && e.name === fileName)
      if (!hit) throw new Error('NotFound')
      return {
        name: fileName,
        kind: 'file',
        getFile: async () => fileBlob(hit.value ?? ''),
      }
    },
    values() {
      return (async function* gen() {
        for (const e of entries) {
          if (e.kind === 'file') {
            yield {
              kind: 'file',
              name: e.name,
              getFile: async () => fileBlob(e.value ?? ''),
            }
          } else {
            yield dir(e.children ?? [], e.name)
          }
        }
      })()
    },
  }
  return obj as unknown as FileSystemDirectoryHandle
}

describe('loadWorkspaceContext', () => {
  it('超 50KB 的根目录优先文件(README.md)截断保留而非静默丢弃', async () => {
    const bigReadme = 'R'.repeat(MAX_FILE_SIZE + 10_000)
    const handle = dir([
      { kind: 'file', name: 'README.md', value: bigReadme },
      { kind: 'file', name: 'notes.txt', value: 'hello' },
    ])
    const result = await loadWorkspaceContext(handle)
    expect(result.text).toContain('### README.md')
    expect(result.text).toContain('文件超过 50KB,已截断')
    expect(result.stats.fileCount).toBeGreaterThanOrEqual(1)
  })

  it('单文件超限时 totalSize 按截断后大小累加(预算不虚高)', async () => {
    const big = 'A'.repeat(MAX_FILE_SIZE + 5_000)
    const handle = dir([
      { kind: 'file', name: 'README.md', value: big },
      { kind: 'file', name: 'b.txt', value: 'x'.repeat(100) },
    ])
    const result = await loadWorkspaceContext(handle)
    // README 计 50KB + b.txt 计 100B,远小于按原始 size 累加的虚高值
    expect(result.stats.totalSize).toBeLessThanOrEqual(MAX_FILE_SIZE + 200)
  })

  it('正常小文件全量加载且含目录结构', async () => {
    const handle = dir([
      { kind: 'file', name: 'README.md', value: '# hi' },
      {
        kind: 'directory',
        name: 'src',
        children: [{ kind: 'file', name: 'a.ts', value: 'export const a = 1' }],
      },
    ])
    const result = await loadWorkspaceContext(handle)
    expect(result.text).toContain('<workspace_files')
    expect(result.text).toContain('## 目录结构')
    expect(result.text).toContain('src/a.ts')
    expect(result.text).toContain('### src/a.ts')
    expect(result.text).toContain('export const a = 1')
    expect(result.stats.truncated).toBe(false)
  })

  it('agent 规则文件优先排序在最前', async () => {
    const handle = dir([
      { kind: 'file', name: 'README.md', value: 'readme' },
      {
        kind: 'directory',
        name: 'sub',
        children: [{ kind: 'file', name: 'CLAUDE.md', value: 'rules' }],
      },
    ])
    const result = await loadWorkspaceContext(handle)
    const claudeIdx = result.text.indexOf('### sub/CLAUDE.md')
    const readmeIdx = result.text.indexOf('### README.md')
    expect(claudeIdx).toBeGreaterThan(-1)
    expect(readmeIdx).toBeGreaterThan(-1)
    expect(claudeIdx).toBeLessThan(readmeIdx)
  })
})
