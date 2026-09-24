// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 上下文占用归因分解在环上的落地测试。
// 锁四条:① 分解确实按构成来源给出可展开明细(不是只有一个总数);
// ② 本端不可观测的段必须显式交代"为什么看不见",而不是静默 0;
// ③ 缓存读数不可得时显示"不可得",不得显示 0% 命中(那是另一个结论);
// ④ 浮层内边距档位仍是 p-3(§4 弹层四档,禁止自创中间值)。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', async () => {
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const node = resolve(ns)
        const raw = node?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

const chatState = vi.hoisted(() => ({
  messages: [] as unknown[],
  usageByMessageId: {} as Record<string, unknown>,
  conversationId: null as string | null,
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (s: unknown) => unknown) => selector(chatState),
}))

vi.mock('@ihui/api-client', () => ({
  compressConversation: vi.fn(async () => ({ success: true, data: {} })),
  // 组件从 @/lib/model-context-capacity 转导 api-client 的这个函数取 maxTokens;
  // mock 工厂必须把它一并导出,否则整个组件渲染期抛 "not a function"。
  getModelContextCapacity: () => 200_000,
}))

// 生产侧 TooltipProvider 由 app/layout.tsx 全局挂上,本单测直接 render 组件、不经根布局,
// 故按仓内既有惯例(见 markdown-stream.test.tsx)透传 mock。content 一并渲染,
// 因为下面有用例断言环上悬浮文案。
vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children, content }: { children: React.ReactNode; content?: React.ReactNode }) => (
    <>
      {content}
      {children}
    </>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import ContextUsageRing from '../context-usage-ring'

const CJK = '中'.repeat(900)

function userMsg(content: string, id = 'u1') {
  return { id, role: 'user', content, createdAt: 1 }
}
function assistantMsg(content: string, id = 'a1') {
  return { id, role: 'assistant', content, createdAt: 2 }
}

afterEach(() => {
  cleanup()
  chatState.messages = []
  chatState.usageByMessageId = {}
  chatState.conversationId = null
})

function openPanel() {
  render(<ContextUsageRing model="gpt-test" />)
  fireEvent.click(screen.getByTestId('context-usage-trigger'))
}

describe('归因分解落环', () => {
  it('展开某档能看到逐条明细与各自 token', () => {
    chatState.messages = [
      userMsg(`${CJK} 第一条提问`, 'u1'),
      assistantMsg('短回答', 'a1'),
    ]
    openPanel()
    const bar = screen.getByTestId('context-usage-attribution')
    expect(bar).toBeTruthy()
    const userRow = screen.getByTestId('context-usage-attribution-row-roleUser')
    expect(screen.queryByTestId('context-usage-attribution-details-roleUser')).toBe(null)
    fireEvent.click(userRow.querySelector('button') as HTMLElement)
    const details = screen.getByTestId('context-usage-attribution-details-roleUser')
    expect(details.textContent).toContain('第一条提问')
    expect(userRow.textContent).toContain('用户消息')
  })

  it('工具调用与工具结果分属两档,失败结果也算占用', () => {
    chatState.messages = [
      {
        id: 'a2',
        role: 'assistant',
        content: '',
        createdAt: 3,
        toolCalls: [
          { id: 'c1', toolName: 'run_command', args: { cmd: 'ls' }, error: `${CJK} 命令失败` },
        ],
      },
    ]
    openPanel()
    expect(screen.getByTestId('context-usage-attribution-row-roleToolCall').textContent).toContain(
      '工具调用参数',
    )
    expect(screen.getByTestId('context-usage-attribution-row-roleToolResult').textContent).toContain(
      '命令失败',
    )
  })

  it('本端不可见的三档(系统/工具定义/技能)如实标注,不静默记 0', () => {
    chatState.messages = [userMsg('hi')]
    openPanel()
    for (const key of ['system', 'toolSchema', 'skill'] as const) {
      const row = screen.getByTestId(`context-usage-attribution-row-${key}`)
      expect(row.textContent).toContain('—')
    }
    expect(
      screen.getByTestId('context-usage-attribution-row-toolSchema').parentElement?.textContent,
    ).toContain('服务端')
  })

  it('缓存读数缺失时显示"不可得",而不是 0% 命中', () => {
    chatState.messages = [userMsg('hi'), assistantMsg('yo', 'a9')]
    chatState.usageByMessageId = {
      a9: {
        totalTokens: 5000,
        promptTokens: 4200,
        completionTokens: 800,
        reasoningTokens: null,
        firstTokenMs: 100,
        durationMs: 900,
        model: 'gpt-test',
        costUsd: null,
      },
    }
    openPanel()
    const cache = screen.getByTestId('context-usage-cache')
    expect(cache.getAttribute('data-testid')).toBe('context-usage-cache')
    expect(screen.getByTestId('context-usage-cache-unavailable').textContent).toContain(
      '无法判断命中与否',
    )
    // provider 真值只校准总量:环上显示的是 4.2K 而不是本地归因和
    const ring = screen.getByTestId('context-usage-trigger')
    expect(ring.textContent).toContain('中') // 中心百分比是数字,外层有 sr-only
    // 未归类差额如实交代(真值 4200 > 归因和)
    expect(screen.getByTestId('context-usage-residual').textContent).toContain('协议包装')
  })

  it('弹层容器内边距保持 p-3(§4 内容面板档)', () => {
    chatState.messages = [userMsg('hi')]
    openPanel()
    const panel = screen.getByRole('dialog')
    expect(panel.className).toContain('p-3')
    expect(panel.className).toMatch(/position|fixed|top/)
  })
})

describe('静态卫生', () => {
  it('源文件不再残留被废的旧四档词键', () => {
    const src = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'context-usage-ring.tsx'),
      'utf8',
    )
    for (const dead of ['categorySystem', 'categoryHistory', 'categoryTools', 'categoryFiles']) {
      expect(src).not.toContain(dead)
    }
    expect(src).not.toContain('computeTokenBreakdown')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
