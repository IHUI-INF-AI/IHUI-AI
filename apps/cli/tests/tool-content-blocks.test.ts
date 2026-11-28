// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { mcpContentToToolContent, mcpToolResultToToolResult } from '../src/tools/mcp-runtime.js'
import {
  isMcpToolVisibleToModel,
  mcpToolUiResourceUri,
} from '../src/tools/mcp-runtime.js'
import { materializeToolContent } from '../src/tools/result-envelope/tool-content.js'
import type { ToolContentBlock } from '../src/tools/index.js'

const cleanup: string[] = []
afterEach(() => {
  for (const dir of cleanup.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

function workspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-tool-content-'))
  cleanup.push(dir)
  return dir
}

describe('ToolResult 多段内容', () => {
  it('MCP text/image/resource/resource_link 原样分成四类，不猜未知类型', () => {
    const blocks = mcpContentToToolContent({
      content: [
        { type: 'text', text: 'hello' },
        { type: 'image', data: 'aWmg', mimeType: 'image/png' },
        { type: 'resource', resource: { uri: 'file:///spec.pdf', blob: 'cGRm', mimeType: 'application/pdf' } },
        { type: 'resource', resource: { uri: 'file:///note.txt', text: 'inside text' } },
        { type: 'resource_link', uri: 'https://example.com/doc', name: 'doc', mimeType: 'text/html' },
        { type: 'future_unknown', payload: 'x' },
      ],
    })

    expect(blocks?.map((b) => b.type)).toEqual(['text', 'image', 'document', 'text', 'resource_link'])
    expect(blocks?.[1]).toMatchObject({ type: 'image', mimeType: 'image/png', data: 'aWmg' })
    expect(blocks?.[2]).toMatchObject({ type: 'document', name: 'file:///spec.pdf', mimeType: 'application/pdf' })
  })

  it('只有图片时不再把结果说成完全无输出', () => {
    const result = mcpToolResultToToolResult(
      { content: [{ type: 'image', data: 'aWmg', mimeType: 'image/png' }] },
      'screenshot',
    )
    expect(result.success).toBe(true)
    expect(result.output).toContain('非文本内容')
    expect(result.content?.[0]).toMatchObject({ type: 'image' })
  })

  it('落盘后去掉 base64、保留相对路径与说明', () => {
    const ws = workspace()
    const blocks: ToolContentBlock[] = [
      { type: 'text', text: 'caption' },
      { type: 'image', data: Buffer.from('fake-png').toString('base64'), mimeType: 'image/png' },
      { type: 'document', data: Buffer.from('%PDF-1.4').toString('base64'), mimeType: 'application/pdf', name: 'spec.pdf' },
    ]
    const materialized = materializeToolContent(blocks, {
      workspacePath: ws,
      sessionId: 'sess-1',
      toolName: 'mcp__vision__look',
    })

    expect(materialized.content).toHaveLength(3)
    const image = materialized.content[1] as Extract<ToolContentBlock, { type: 'image' }>
    expect(image.data).toBeUndefined()
    expect(image.path).toMatch(/^\.ihui-agent\/tmp\/tool-artifacts\/sess-1\/mcp__vision__look-[0-9a-f]{8}\.png$/)
    expect(fs.existsSync(path.resolve(ws, image.path!))).toBe(true)
    expect(materialized.notes.join('\n')).toContain('image:')
    expect(materialized.notes.join('\n')).toContain('document:')
    expect(materialized.notes.join('\n')).not.toContain('base64')

    const second = materializeToolContent([{ type: 'image', data: Buffer.from('fake-png').toString('base64'), mimeType: 'image/png' }], {
      workspacePath: ws,
      sessionId: 'sess-1',
      toolName: 'mcp__vision__look',
    })
    expect(second.content[0]).toMatchObject({ type: 'image', path: image.path })
  })

  it('data URL 也能落盘，非 data URL 保留原链接', () => {
    const ws = workspace()
    const materialized = materializeToolContent(
      [
        { type: 'image', url: `data:image/png;base64,${Buffer.from('inline').toString('base64')}` },
        { type: 'document', url: 'https://example.com/a.pdf', mimeType: 'application/pdf' },
      ],
      { workspacePath: ws, toolName: 't' },
    )
    expect((materialized.content[0] as { path?: string }).path).toMatch(/\.png$/)
    expect((materialized.content[1] as { url?: string }).url).toBe('https://example.com/a.pdf')
    expect(materialized.notes.join('\n')).toContain('https://example.com/a.pdf')
  })

  it('MCP Apps：新字段优先、旧字段兼容，app-only 工具不进模型工具面', () => {
    expect(
      mcpToolUiResourceUri({
        name: 'tool',
        inputSchema: { type: 'object' },
        _meta: {
          ui: { resourceUri: 'ui://server/new', visibility: ['model', 'app'] },
          'ui/resourceUri': 'ui://server/legacy',
        },
      }),
    ).toBe('ui://server/new')

    expect(
      mcpToolUiResourceUri({
        name: 'tool',
        inputSchema: { type: 'object' },
        _meta: { 'ui/resourceUri': 'ui://server/legacy' },
      }),
    ).toBe('ui://server/legacy')

    expect(
      isMcpToolVisibleToModel({
        name: 'refresh',
        inputSchema: { type: 'object' },
        _meta: { ui: { visibility: ['app'] } },
      }),
    ).toBe(false)
    expect(
      isMcpToolVisibleToModel({
        name: 'get',
        inputSchema: { type: 'object' },
        _meta: { ui: { visibility: ['model'] } },
      }),
    ).toBe(true)
    expect(
      isMcpToolVisibleToModel({
        name: 'default',
        inputSchema: { type: 'object' },
        _meta: {},
      }),
    ).toBe(true)
  })
})
