// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { expandContextTokens } from '../context-token-expander'
import { useAiPanelStore } from '@/stores/ai-panel'

// FileSystemDirectoryHandle 在浏览器由用户授权得到,测试中用轻量 fake 实现
type FakeEntry = {
  name: string
  kind: 'file' | 'directory'
  children?: FakeEntry[]
  content?: string
}

function makeHandle(structure: { name: string; entries: FakeEntry[] }): FileSystemDirectoryHandle {
  const build = (name: string, entries: FakeEntry[]): FileSystemDirectoryHandle => {
    const values = async function* () {
      for (const e of entries) yield e as unknown as FileSystemHandle
    }
    return {
      kind: 'directory',
      name,
      values,
      getDirectoryHandle: async (seg: string) => {
        const child = entries.find((x) => x.name === seg && x.kind === 'directory')
        if (!child) throw new Error('no such dir')
        return build(child.name, child.children ?? [])
      },
      getFileHandle: async (seg: string) => {
        const f = entries.find((x) => x.name === seg && x.kind === 'file')
        if (!f) throw new Error('no such file')
        return {
          kind: 'file',
          name: seg,
          getFile: async () => ({
            text: async () => f.content ?? '',
            size: (f.content ?? '').length,
          }),
        } as unknown as FileSystemFileHandle
      },
    } as unknown as FileSystemDirectoryHandle
  }
  return build(structure.name, structure.entries)
}

const handleRef = vi.hoisted(() => ({ current: null as FileSystemDirectoryHandle | null }))

vi.mock('@/lib/workspace-context-loader', () => ({
  getBrowserWorkspaceHandle: vi.fn((name: string) => (name === 'ws' ? handleRef.current : null)),
}))

beforeEach(() => {
  handleRef.current = null
  useAiPanelStore.setState({ activeWorkspace: null })
  vi.clearAllMocks()
})

describe('expandContextTokens — token 识别(大小写变体)', () => {
  it('展开 #Codebase 大小写不敏感且不残留', async () => {
    handleRef.current = makeHandle({
      name: 'ws',
      entries: [
        { name: 'src', kind: 'directory', children: [{ name: 'a.ts', kind: 'file' }] },
        { name: 'README.md', kind: 'file' },
      ],
    })
    useAiPanelStore.setState({ activeWorkspace: { name: 'ws', path: '/ws' } as never })
    const out = await expandContextTokens('看下 #codebase 与 #CODEBASE 和 #Codebase')
    expect(out).toContain('<context_codebase>')
    expect(out).toContain('src/')
    expect(out).not.toMatch(/#codebase/i)
  })

  it('#Terminal 始终降级注入(暂无终端输出)', async () => {
    const out = await expandContextTokens('执行后看 #terminal 输出')
    expect(out).toContain('<context_terminal>')
    expect(out).toContain('(暂无终端输出)')
    expect(out).not.toMatch(/#terminal/i)
  })

  it('#Docs 读取根 CLAUDE.md/AGENTS.md/README.md,缺失跳过', async () => {
    handleRef.current = makeHandle({
      name: 'ws',
      entries: [
        { name: 'CLAUDE.md', kind: 'file', content: 'claude body' },
        { name: 'AGENTS.md', kind: 'file', content: 'agents body' },
        { name: 'README.md', kind: 'file', content: 'readme body' },
      ],
    })
    useAiPanelStore.setState({ activeWorkspace: { name: 'ws', path: '/ws' } as never })
    const out = await expandContextTokens('#docs')
    expect(out).toContain('<context_docs>')
    expect(out).toContain('claude body')
    expect(out).toContain('agents body')
    expect(out).toContain('readme body')
  })
})

describe('expandContextTokens — @目录 解析', () => {
  it('展开 @目录:<路径> 为目录树摘要', async () => {
    handleRef.current = makeHandle({
      name: 'ws',
      entries: [{ name: 'src', kind: 'directory', children: [{ name: 'x.ts', kind: 'file' }] }],
    })
    useAiPanelStore.setState({ activeWorkspace: { name: 'ws', path: '/ws' } as never })
    const out = await expandContextTokens('参考 @目录:src 实现')
    expect(out).toContain('<context_directory path="src">')
    expect(out).toContain('x.ts')
    expect(out).not.toContain('@目录:src')
  })

  it('路径含反引号(提及插入)时不吞掉尾引号', async () => {
    handleRef.current = makeHandle({
      name: 'ws',
      entries: [{ name: 'src', kind: 'directory', children: [{ name: 'x.ts', kind: 'file' }] }],
    })
    useAiPanelStore.setState({ activeWorkspace: { name: 'ws', path: '/ws' } as never })
    const out = await expandContextTokens('参考 `@目录:src` 实现')
    expect(out).toContain('<context_directory path="src">')
    expect(out).not.toContain('src`')
  })

  it('目录不存在时降级(目录不存在)', async () => {
    handleRef.current = makeHandle({ name: 'ws', entries: [] })
    useAiPanelStore.setState({ activeWorkspace: { name: 'ws', path: '/ws' } as never })
    const out = await expandContextTokens('@目录:missing')
    expect(out).toContain('(目录不存在)')
  })
})

describe('expandContextTokens — 截断逻辑', () => {
  it('目录树超过 8000 字符截断标注', async () => {
    const entries: FakeEntry[] = Array.from({ length: 40 }, (_, i) => ({
      name: `longfilename${i}`.padEnd(300, 'x'),
      kind: 'file',
    }))
    handleRef.current = makeHandle({ name: 'ws', entries })
    useAiPanelStore.setState({ activeWorkspace: { name: 'ws', path: '/ws' } as never })
    const out = await expandContextTokens('#codebase')
    expect(out).toContain('…(已截断)')
  })

  it('#Docs 单文件超过 4000 字符截断标注', async () => {
    handleRef.current = makeHandle({
      name: 'ws',
      entries: [{ name: 'CLAUDE.md', kind: 'file', content: 'y'.repeat(5000) }],
    })
    useAiPanelStore.setState({ activeWorkspace: { name: 'ws', path: '/ws' } as never })
    const out = await expandContextTokens('#docs')
    expect(out).toContain('…(已截断)')
  })
})

describe('expandContextTokens — 无工作区', () => {
  it('token 在无活跃工作区时降级(无活跃工作区)', async () => {
    const out = await expandContextTokens('#codebase @目录:src #docs')
    expect(out).toContain('(无活跃工作区)')
  })

  it('无 token 时原样返回', async () => {
    const out = await expandContextTokens('普通的提问,没有引用')
    expect(out).toBe('普通的提问,没有引用')
  })
})
