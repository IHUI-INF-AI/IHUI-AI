// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  normalizePathSegments,
  queryAttribution,
  resolveWorkspaceRelativePath,
  type LineAttribution,
} from '../../src/attribution'

const AT = '2026-11-04T00:00:00.000Z'
const AI_ORIGIN = { at: AT, agentId: 'main', sessionId: 's-1', toolCallId: 'tc-1' }

function record(filePath: string, startLine: number, endLine: number): LineAttribution {
  return { filePath, startLine, endLine, source: 'ai', origin: AI_ORIGIN, revision: 1 }
}

describe('归属查询 → 工作区越权判据', () => {
  it('工作区内相对路径 → 命中并压缩', () => {
    const records = [record('src/a.ts', 2, 3), record('src/a.ts', 4, 4)]
    const outcome = queryAttribution({ workspacePath: 'G:/WS/main', file: 'src/a.ts', records })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.file).toBe('src/a.ts')
      const ai = outcome.ranges.filter((r) => r.source === 'ai')
      expect(ai).toHaveLength(1)
      expect(ai[0]).toMatchObject({ startLine: 2, endLine: 4, source: 'ai' })
    }
  })

  it('工作区内绝对路径(Windows 反斜杠)→ 命中', () => {
    const records = [record('src/a.ts', 1, 2)]
    const outcome = queryAttribution({
      workspacePath: 'G:\\WS\\main',
      file: 'G:\\WS\\main\\src\\a.ts',
      records,
    })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.file).toBe('src/a.ts')
  })

  it('反向例③:指向另一个 workspace 的绝对路径 → 403', () => {
    const records = [record('src/a.ts', 1, 1)]
    const outcome = queryAttribution({
      workspacePath: 'G:/WS/main',
      file: 'G:/WS/other/src/a.ts',
      records,
    })
    expect(outcome).toMatchObject({ ok: false, status: 403, reason: 'outside_workspace' })
  })

  it('反向例③:相对路径用 .. 逃逸出工作区 → 403', () => {
    const records = [record('src/a.ts', 1, 1)]
    const outcome = queryAttribution({
      workspacePath: 'G:/WS/main',
      file: '../other/src/a.ts',
      records,
    })
    expect(outcome).toMatchObject({ ok: false, status: 403 })
  })

  it('工作区内但无该文件归属 → 404(不回显其它文件记录)', () => {
    const records = [record('src/a.ts', 1, 1)]
    const outcome = queryAttribution({
      workspacePath: 'G:/WS/main',
      file: 'src/secret.ts',
      records,
    })
    expect(outcome).toMatchObject({ ok: false, status: 404, reason: 'attribution_not_found' })
  })

  it('空路径 → 403', () => {
    const outcome = queryAttribution({
      workspacePath: 'G:/WS/main',
      file: '',
      records: [record('a.ts', 1, 1)],
    })
    expect(outcome).toMatchObject({ ok: false, status: 403 })
  })

  it('记录里的 filePath 用反斜杠也能与查询路径归一匹配', () => {
    const records = [record('src\\a.ts', 1, 2)]
    const outcome = queryAttribution({ workspacePath: 'G:/WS/main', file: 'src/a.ts', records })
    expect(outcome.ok).toBe(true)
  })

  it('normalizePathSegments 折叠 . 与 ..', () => {
    expect(normalizePathSegments('a/./b/../c')).toBe('a/c')
    expect(normalizePathSegments('G:\\WS\\main\\src')).toBe('/G:/WS/main/src')
  })

  it('resolveWorkspaceRelativePath 拒绝同前缀但非子目录的路径', () => {
    expect(resolveWorkspaceRelativePath('G:/WS/main', 'G:/WS/main-other/a.ts')).toBeNull()
    expect(resolveWorkspaceRelativePath('G:/WS/main', 'G:/WS/main/a.ts')).toBe('a.ts')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
