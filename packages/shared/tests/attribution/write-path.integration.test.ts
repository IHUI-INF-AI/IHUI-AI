// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端到端(可跑的最小真实路径):真实 `executeWorkspaceTool` 写入 → 归因记录落库 → 人工保存翻转。
 * 用的是内存 FSA 假盘,但走的函数与浏览器端完全相同(executeWorkspaceTool + toolWriteFile + 归因旁路)。
 */

import { describe, expect, it } from 'vitest'
import { executeWorkspaceTool } from '../../src/chat/workspace-tool-executor'
import type { AttributionRange } from '../../src/attribution'

const AT = '2026-11-04T00:00:00.000Z'
const ORIGIN = { at: AT, agentId: 'main', sessionId: 's-1', toolCallId: 'tc-1', model: 'deepseek' }

class FakeFile {
  content: string
  constructor(content = '') {
    this.content = content
  }
  get size(): number {
    return this.content.length
  }
  async text(): Promise<string> {
    return this.content
  }
}

class FakeFileHandle {
  file: FakeFile
  constructor(file: FakeFile) {
    this.file = file
  }
  async getFile(): Promise<FakeFile> {
    return this.file
  }
  async createWritable() {
    const file = this.file
    // FSA createWritable 默认截断原文件,这里如实模拟
    file.content = ''
    return {
      async write(data: string) {
        file.content += data
      },
      async close() {},
    }
  }
}

class FakeDirHandle {
  files = new Map<string, FakeFileHandle>()
  dirs = new Map<string, FakeDirHandle>()
  constructor(seed: Record<string, string> = {}) {
    for (const [name, content] of Object.entries(seed))
      this.files.set(name, new FakeFileHandle(new FakeFile(content)))
  }
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    const existing = this.files.get(name)
    if (existing) return existing
    if (!opts?.create) throw new Error(`NotFoundError: ${name}`)
    const created = new FakeFileHandle(new FakeFile(''))
    this.files.set(name, created)
    return created
  }
  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    const existing = this.dirs.get(name)
    if (existing) return existing
    if (!opts?.create) throw new Error(`NotFoundError: ${name}`)
    const created = new FakeDirHandle()
    this.dirs.set(name, created)
    return created
  }
  read(name: string): string {
    return this.files.get(name)?.file.content ?? ''
  }
}

function sourceOf(ranges: readonly AttributionRange[], line: number): string {
  const hit = ranges.find((r) => r.startLine <= line && line <= r.endLine)
  return hit?.source ?? 'human'
}

describe('AI 写入 → 归因（真实执行器路径）', () => {
  it('write_file 新建文件 → onRecord 拿到全 ai 区间,落盘内容正确', async () => {
    const disk = new FakeDirHandle()
    let recorded: AttributionRange[] = []
    const result = await executeWorkspaceTool(
      'write_file',
      { path: 'a.ts', content: 'l1\nl2\nl3' },
      disk as unknown as FileSystemDirectoryHandle,
      { origin: ORIGIN, records: [], onRecord: (ranges) => (recorded = ranges) },
    )
    expect(result.error).toBeNull()
    expect(disk.read('a.ts')).toBe('l1\nl2\nl3')
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({ startLine: 1, endLine: 3, source: 'ai', filePath: 'a.ts' })
  })

  it('file_edit 只改一行 → 只有该行被标 ai,未改动行保持 human(不是整文件认领)', async () => {
    const disk = new FakeDirHandle({ 'a.ts': 'l1\nl2\nl3\nl4\nl5' })
    let recorded: AttributionRange[] = []
    const result = await executeWorkspaceTool(
      'file_edit',
      { path: 'a.ts', old_string: 'l3', new_string: 'L3' },
      disk as unknown as FileSystemDirectoryHandle,
      { origin: ORIGIN, records: [], onRecord: (ranges) => (recorded = ranges) },
    )
    expect(result.error).toBeNull()
    expect(sourceOf(recorded, 3)).toBe('ai')
    expect(sourceOf(recorded, 1)).toBe('human')
    expect(sourceOf(recorded, 5)).toBe('human')
  })

  it('apply_patch 走 patch 实际结果 → 只标 patch 命中的行', async () => {
    const disk = new FakeDirHandle({ 'a.ts': 'a\nb\nc\nd\ne' })
    let recorded: AttributionRange[] = []
    const patch = ['@@ -2,1 +2,1 @@', '-b', '+B', ''].join('\n')
    const result = await executeWorkspaceTool(
      'apply_patch',
      { path: 'a.ts', patch },
      disk as unknown as FileSystemDirectoryHandle,
      { origin: ORIGIN, records: [], onRecord: (ranges) => (recorded = ranges) },
    )
    expect(result.error).toBeNull()
    expect(disk.read('a.ts')).toBe('a\nB\nc\nd\ne')
    expect(sourceOf(recorded, 2)).toBe('ai')
    expect(sourceOf(recorded, 1)).toBe('human')
  })

  it('反向例①端到端:AI 写后人工保存改一行 → 该行 ai-then-human,其余 AI 行仍 ai', async () => {
    const disk = new FakeDirHandle({ 'a.ts': 'l1\nl2\nl3\nl4' })
    let aiRanges: AttributionRange[] = []
    await executeWorkspaceTool(
      'write_file',
      { path: 'a.ts', content: 'l1\nAI2\nAI3\nl4' },
      disk as unknown as FileSystemDirectoryHandle,
      { origin: ORIGIN, records: [], onRecord: (ranges) => (aiRanges = ranges) },
    )
    expect(sourceOf(aiRanges, 2)).toBe('ai')
    expect(sourceOf(aiRanges, 3)).toBe('ai')

    let humanRanges: AttributionRange[] = []
    await executeWorkspaceTool(
      'write_file',
      { path: 'a.ts', content: 'l1\nAI2\nHUMAN3\nl4' },
      disk as unknown as FileSystemDirectoryHandle,
      {
        origin: { at: AT },
        mode: 'human',
        records: aiRanges,
        onRecord: (ranges) => (humanRanges = ranges),
      },
    )
    expect(sourceOf(humanRanges, 2)).toBe('ai')
    expect(sourceOf(humanRanges, 3)).toBe('ai-then-human')
    expect(sourceOf(humanRanges, 1)).toBe('human')
    expect(disk.read('a.ts')).toBe('l1\nAI2\nHUMAN3\nl4')
  })

  it('人工保存内容未变 → 不产生任何新归属(原 ai 保持 ai)', async () => {
    const disk = new FakeDirHandle({ 'a.ts': 'x\ny' })
    let aiRanges: AttributionRange[] = []
    await executeWorkspaceTool(
      'write_file',
      { path: 'a.ts', content: 'x\nY' },
      disk as unknown as FileSystemDirectoryHandle,
      { origin: ORIGIN, records: [], onRecord: (ranges) => (aiRanges = ranges) },
    )
    let after: AttributionRange[] = []
    await executeWorkspaceTool(
      'write_file',
      { path: 'a.ts', content: 'x\nY' },
      disk as unknown as FileSystemDirectoryHandle,
      {
        origin: { at: AT },
        mode: 'human',
        records: aiRanges,
        onRecord: (ranges) => (after = ranges),
      },
    )
    expect(sourceOf(after, 2)).toBe('ai')
  })

  it('写入失败时不触发归因回调', async () => {
    const disk = new FakeDirHandle()
    let called = 0
    const result = await executeWorkspaceTool(
      'write_file',
      { path: '', content: 'x' },
      disk as unknown as FileSystemDirectoryHandle,
      { origin: ORIGIN, onRecord: () => (called += 1) },
    )
    expect(result.error).toBeTruthy()
    expect(called).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
