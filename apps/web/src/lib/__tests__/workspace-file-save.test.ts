// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  toRelativeWorkspacePath,
  resolveWorkspaceDirectoryHandle,
  saveWorkspaceTextFile,
} from '../workspace-file-save'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useAiPanelStore } from '@/stores/ai-panel'

// getBrowserWorkspaceHandle 依赖 browserHandles Map(模块内私有),mock 整个 loader 模块
const handleMock = { kind: 'directory', name: 'ws' } as unknown as FileSystemDirectoryHandle
vi.mock('@/lib/workspace-context-loader', () => ({
  getBrowserWorkspaceHandle: vi.fn((name: string) =>
    name === 'my-ws' || name === 'G:/WS/my-ws' ? handleMock : null,
  ),
}))
// executeWorkspaceTool mock:write_file 成功返回描述,内容含 'boom' 时抛错
vi.mock('@/lib/workspace-tool-executor', () => ({
  executeWorkspaceTool: vi.fn(async (_tool: string, args: { content?: string }, _h: unknown) => {
    const content = args.content ?? ''
    if (content.includes('boom')) throw new Error('disk full')
    return { result: `已写入(${content.length} 字符)`, error: null }
  }),
}))

import { getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'

describe('toRelativeWorkspacePath', () => {
  it('相对路径原样返回', () => {
    expect(toRelativeWorkspacePath('src/a.ts', 'G:/WS/my-ws')).toBe('src/a.ts')
  })
  it('绝对路径剥离 workspacePath 前缀(正斜杠)', () => {
    expect(toRelativeWorkspacePath('G:/WS/my-ws/src/a.ts', 'G:/WS/my-ws')).toBe('src/a.ts')
  })
  it('反斜杠统一为 / 且剥离前缀', () => {
    expect(toRelativeWorkspacePath('G:\\WS\\my-ws\\src\\a.ts', 'G:\\WS\\my-ws')).toBe('src/a.ts')
  })
  it('workspacePath 尾部斜杠容忍', () => {
    expect(toRelativeWorkspacePath('G:/WS/my-ws/a.ts', 'G:/WS/my-ws/')).toBe('a.ts')
  })
  it('非前缀绝对路径原样(规范化后)', () => {
    expect(toRelativeWorkspacePath('D:/other/a.ts', 'G:/WS/my-ws')).toBe('D:/other/a.ts')
  })
  it('空路径返回空串', () => {
    expect(toRelativeWorkspacePath('', 'G:/WS/my-ws')).toBe('')
  })
})

describe('resolveWorkspaceDirectoryHandle', () => {
  beforeEach(() => {
    useIDEWorkspace.setState({ workspacePath: '' })
    useAiPanelStore.setState({ activeWorkspace: null })
  })

  it('IDE workspacePath 完整路径命中缓存', () => {
    useIDEWorkspace.setState({ workspacePath: 'G:/WS/my-ws' })
    expect(resolveWorkspaceDirectoryHandle()).toBe(handleMock)
    expect(getBrowserWorkspaceHandle).toHaveBeenCalledWith('G:/WS/my-ws')
  })

  it('IDE workspacePath basename 命中缓存', () => {
    useIDEWorkspace.setState({ workspacePath: 'X:/anywhere/my-ws' })
    expect(resolveWorkspaceDirectoryHandle()).toBe(handleMock)
  })

  it('AI 面板工作区名兜底命中', () => {
    useIDEWorkspace.setState({ workspacePath: 'no-cache-path' })
    useAiPanelStore.setState({
      activeWorkspace: { name: 'my-ws', mode: 'rw' } as never,
    })
    expect(resolveWorkspaceDirectoryHandle()).toBe(handleMock)
  })

  it('全部未命中返回 null', () => {
    useIDEWorkspace.setState({ workspacePath: 'unknown' })
    expect(resolveWorkspaceDirectoryHandle()).toBeNull()
  })
})

describe('saveWorkspaceTextFile', () => {
  beforeEach(() => {
    useIDEWorkspace.setState({ workspacePath: 'G:/WS/my-ws' })
    useAiPanelStore.setState({ activeWorkspace: null })
    vi.clearAllMocks()
  })

  it('成功保存返回字节数', async () => {
    const out = await saveWorkspaceTextFile('G:/WS/my-ws/src/a.ts', 'hello')
    expect(out).toEqual({ ok: true, bytes: 5 })
  })

  it('无句柄返回 no-handle', async () => {
    useIDEWorkspace.setState({ workspacePath: 'unknown' })
    const out = await saveWorkspaceTextFile('a.ts', 'x')
    expect(out.ok).toBe(false)
    expect(out.reason).toBe('no-handle')
  })

  it('写入异常返回 write-error', async () => {
    const out = await saveWorkspaceTextFile('src/a.ts', 'trigger boom now')
    expect(out.ok).toBe(false)
    expect(out.reason).toBe('write-error')
    expect(out.message).toContain('disk full')
  })

  it('空路径返回 bad-path', async () => {
    const out = await saveWorkspaceTextFile('', 'x')
    expect(out.ok).toBe(false)
    expect(out.reason).toBe('bad-path')
  })
})
