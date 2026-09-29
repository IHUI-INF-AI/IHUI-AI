// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-825 · 消息级 markdown 错误边界的**接线**取证(2026-09-29 立)。
// 纯函数那把尺子(markdown-render-guard.test.ts)只证明"键算得对";本文件证明的是
// "边界真长在 MessageItem 上、复位真按消息内容走、warn 真不带正文" —— 少这一环就是
// 本仓记过最多次的"造好没装车"。与同目录 message-item-thinking-refs.test.tsx 同纪律:
// 喂真 store + 真 MessageItem,只 mock 抛错的渲染件。
import { cleanup, render, screen, type RenderResult } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 取词回显键名即可:本文件判的是降级形态与复位行为,不是译文
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

/** 可控的"坏 markdown 渲染件":throwOn=true 时抛错,用来区分"边界复位了"与"子树本来就没抛"。 */
const mdState = vi.hoisted(() => ({ throwOn: false }))
vi.mock('@/components/ai/markdown-stream', () => ({
  MarkdownStream: ({ content }: { content: string }) => {
    if (mdState.throwOn) throw new Error('markdown-render-boom')
    return <div data-testid="markdown-rendered">{content}</div>
  },
}))

import { useChatStore, type ChatMessage } from '@/stores/chat'
import { TooltipProvider } from '@/components/feedback'
import { MARKDOWN_RENDER_FAILURE_EVENT } from '../markdown-render-guard'
import { MessageItem } from '../MessageItem'

const NOW = Date.UTC(2026, 8, 29, 10, 0, 0)
const ID = 'm-md-boundary'
const BODY = '机密正文-marker-should-not-appear-in-logs'

function assistantMessage(content: string, over: Partial<ChatMessage> = {}): ChatMessage {
  return { id: ID, role: 'assistant', content, createdAt: NOW, ...over }
}

function renderItem(
  message: ChatMessage,
  opts: { isStreaming?: boolean; isLast?: boolean; codeCollapseLines?: number } = {},
): RenderResult {
  useChatStore.setState({ messages: [message] })
  return render(
    <TooltipProvider>
      <MessageItem
        message={message}
        isLast={opts.isLast ?? false}
        isStreaming={opts.isStreaming ?? false}
        assistantLabel="AI"
        codeCollapseLines={opts.codeCollapseLines}
      />
    </TooltipProvider>,
  )
}

/** 只数本票那一族 warn —— MessageItem 别处也可能 warn,混计会把"没复位"读成"复位了"。 */
function guardWarns(): unknown[][] {
  return vi
    .mocked(console.warn)
    .mock.calls.filter((call) => call[0] === MARKDOWN_RENDER_FAILURE_EVENT)
}

const fallbackEl = () => screen.queryByTestId(`message-markdown-fallback-${ID}`)
const renderedEl = () => screen.queryByTestId('markdown-rendered')

beforeEach(() => {
  mdState.throwOn = false
  // 边界捕获时 React 必打整段组件栈,与本判据无关:降噪
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  // componentDidCatch 会裸 fetch 上报崩溃,桩掉不真发请求
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
  )
})

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('G-825 消息级 markdown 边界', () => {
  it('渲染抛错 → 降级成 pre-wrap 纯文本(内容还在),且没有整页 error', () => {
    mdState.throwOn = true
    renderItem(assistantMessage(BODY))
    const fb = fallbackEl()
    expect(fb).not.toBeNull()
    // 逐字相等:降级形态必须把原文完整留住,不是截断、不是空壳
    expect(fb?.textContent).toBe(BODY)
    expect(fb?.className).toContain('whitespace-pre-wrap')
    // 没有落到路由级/全局错误页文案(整页挂掉的指纹)
    expect(screen.queryByText('页面出错了')).toBeNull()
    expect(screen.queryByText('应用发生了错误,请刷新页面重试')).toBeNull()
  })

  it('不抛错时边界完全透明:走 MarkdownStream 正常渲染、无降级节点', () => {
    renderItem(assistantMessage(BODY))
    expect(renderedEl()?.textContent).toBe(BODY)
    expect(fallbackEl()).toBeNull()
    expect(guardWarns()).toHaveLength(0)
  })

  it('错误发生后换一个 resetKey(内容变了)→ 边界复位、重新渲染 children', () => {
    mdState.throwOn = true
    const { rerender } = renderItem(assistantMessage('正文甲'))
    expect(fallbackEl()?.textContent).toBe('正文甲')

    mdState.throwOn = false
    rerender(
      <TooltipProvider>
        <MessageItem
          message={assistantMessage('正文乙')}
          isLast={false}
          isStreaming={false}
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )
    expect(renderedEl()?.textContent).toBe('正文乙')
    expect(fallbackEl()).toBeNull()
  })

  it('同一 key 重复渲染 → 绝不自动清错(这条是"仅 resetKey 变化才清"的唯一判据)', () => {
    mdState.throwOn = true
    const { rerender } = renderItem(assistantMessage('正文甲'))
    expect(fallbackEl()?.textContent).toBe('正文甲')
    expect(guardWarns()).toHaveLength(1)

    // 子树已经不坏了,但键没变 ⇒ 边界必须仍停在降级形态 ⇒ 若实现成"每次都清"这条必红
    mdState.throwOn = false
    rerender(
      <TooltipProvider>
        <MessageItem
          message={assistantMessage('正文甲')}
          isLast={false}
          isStreaming={false}
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )
    expect(fallbackEl()?.textContent).toBe('正文甲')
    expect(renderedEl()).toBeNull()
    expect(guardWarns()).toHaveLength(1)
  })

  it('流式中逐 token 重渲染 → 复位键恒定,边界不每次都重挂(计数器不涨;完成态才掺内容键)', () => {
    mdState.throwOn = true
    const { rerender } = renderItem(assistantMessage('tok1'), { isStreaming: true, isLast: true })
    expect(fallbackEl()).not.toBeNull()
    expect(guardWarns()).toHaveLength(1)

    // 仍在流式:内容每 token 都在长,键必须不变 ⇒ 不会"清错→重挂→再抛→再清"
    for (const grown of ['tok1 tok2', 'tok1 tok2 tok3']) {
      rerender(
        <TooltipProvider>
          <MessageItem message={assistantMessage(grown)} isLast isStreaming assistantLabel="AI" />
        </TooltipProvider>,
      )
    }
    expect(guardWarns()).toHaveLength(1)

    // 转完成态:键掺入内容 ⇒ 复位并把最终正文交给真实渲染件
    mdState.throwOn = false
    rerender(
      <TooltipProvider>
        <MessageItem
          message={assistantMessage('tok1 tok2 tok3')}
          isLast={false}
          isStreaming={false}
          assistantLabel="AI"
        />
      </TooltipProvider>,
    )
    expect(renderedEl()?.textContent).toBe('tok1 tok2 tok3')
    expect(fallbackEl()).toBeNull()
  })

  it('结构化 warn 带 markdownLength/mode/renderStreaming,且载荷里没有正文', () => {
    mdState.throwOn = true
    renderItem(assistantMessage(BODY), { codeCollapseLines: 5 })
    const warns = guardWarns()
    expect(warns).toHaveLength(1)
    const [event, facts] = warns[0] as [string, Record<string, unknown>]
    expect(event).toBe(MARKDOWN_RENDER_FAILURE_EVENT)
    expect(facts).toEqual({
      event: MARKDOWN_RENDER_FAILURE_EVENT,
      markdownLength: BODY.length,
      mode: 'code-collapsible',
      renderStreaming: false,
    })
    // 整条 warn(两个实参)序列化后都不得含正文子串
    expect(JSON.stringify(warns[0])).not.toContain('marker-should-not-appear')
  })

  it('用户消息路径逐字未变:正文仍是 <p> 纯文本,不经过 markdown 边界(负例防越界改动)', () => {
    // 事实来源:MessageItem 的用户支走 <p className="whitespace-pre-wrap">(不渲染 MarkdownStream),
    // 所以本票的边界只加在 assistant 内容区 —— 这条钉住"没把边界顺手搬到用户气泡上"。
    mdState.throwOn = true
    renderItem(assistantMessage(BODY, { role: 'user' }))
    expect(fallbackEl()).toBeNull()
    expect(renderedEl()).toBeNull()
    expect(screen.getByText(BODY).tagName).toBe('P')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
