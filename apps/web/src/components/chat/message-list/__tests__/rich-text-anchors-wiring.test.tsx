// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D04 消息串内富文本动作锚点 · 接线取证(2026-10-24 立)。
// 组件单测(chat/__tests__/rich-anchor-text.test.tsx)只证明"表能渲染";本文件证明的是
// **assistant 正文真走这条路** —— 模型输出里的白名单锚点若继续交给 MarkdownStream,
// 会被 react-markdown 当裸 HTML 丢弃(整段消失)。故这里锁三件:
//   ① 白名单 link 内文是安全 URL 时产出可点击元素(断 role/href,不接受"样式像链接");
//   ② 安全反例 <script>/<img onerror> 不产生节点、不执行;
//   ③ 语序变体(ja:detail 在前、action 在后)按真实 DOM 顺序渲染。

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh-CN',
}))

// 只保留"走没走 markdown"这一格信号:锚点正文必须绕过 markdown,否则锚点会被吞掉。
vi.mock('@/components/ai/markdown-stream', () => ({
  MarkdownStream: ({ content }: { content: string }) => (
    <div data-testid="markdown-rendered">{content}</div>
  ),
}))

import { useChatStore, type ChatMessage } from '@/stores/chat'
import { TooltipProvider } from '@/components/feedback'
import { MessageItem } from '../MessageItem'

const NOW = Date.UTC(2026, 9, 24, 10, 0, 0)
const ID = 'm-rich-anchors'

function renderAssistant(content: string): HTMLElement {
  const message: ChatMessage = { id: ID, role: 'assistant', content, createdAt: NOW }
  useChatStore.setState({ messages: [message] })
  render(
    <TooltipProvider>
      <MessageItem message={message} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
  return screen.getByTestId(`message-rich-anchors-${ID}`)
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true } as unknown as Response)))
})

afterEach(() => {
  cleanup()
  useChatStore.setState({ messages: [] })
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('D04 assistant 正文走白名单锚点渲染器', () => {
  it('link 锚点渲染成可点击元素(role=link + href),且正文不再交给 MarkdownStream', () => {
    const body = renderAssistant('<link>https://ihui.ai/docs</link>')

    const link = screen.getByRole('link', { name: 'https://ihui.ai/docs' })
    expect(link.getAttribute('href')).toBe('https://ihui.ai/docs')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(body.contains(link)).toBe(true)

    // 接线证据:含锚点时正文绕过 markdown(否则 react-markdown 会把 <link> 整段丢弃)
    expect(screen.queryByTestId('markdown-rendered')).toBeNull()
  })

  it('action/detail 保留语义分层与文本', () => {
    const body = renderAssistant('<action>正在读取</action><detail>src/a.ts</detail>')
    expect(body.textContent).toBe('正在读取src/a.ts')
    expect(body.querySelector('.font-medium.text-foreground')?.textContent).toBe('正在读取')
    expect(body.querySelector('.text-muted-foreground')?.textContent).toBe('src/a.ts')
  })

  it('非 URL 的 link 内文不产出 <a>,也不放行 javascript:', () => {
    const body = renderAssistant('<link>javascript:alert(1)</link>')
    expect(body.querySelector('a')).toBeNull()
    expect(body.textContent).toBe('javascript:alert(1)')
  })
})

describe('D04 安全反例:模型输出里的非法标签', () => {
  const XSS = '<script>window.__xss=1</script><img src=x onerror="window.__xss=2">'

  it('不产生 script/img 节点,原文以转义文本可见,副作用不触发', () => {
    const body = renderAssistant(`${XSS}<action>跑</action>`)

    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined()

    // 只解释白名单:危险串按字面文本透出(可见、不执行)
    expect(body.textContent).toContain('<script>window.__xss=1</script>')
    expect(body.innerHTML).not.toContain('<script')
    expect(body.innerHTML).not.toContain('<img')
    expect(body.querySelector('.font-medium.text-foreground')?.textContent).toBe('跑')
  })
})

describe('D04 语序变体(读 ja 的真实语序形态)', () => {
  it('detail 在前的 ja 语序按 DOM 顺序渲染,文本不被重排', () => {
    const body = renderAssistant('<detail>{target}</detail>を<action>注入中</action>')

    expect(body.textContent).toBe('{target}を注入中')
    const detail = body.querySelector('.text-muted-foreground')
    const action = body.querySelector('.font-medium.text-foreground')
    expect(detail?.textContent).toBe('{target}')
    expect(action?.textContent).toBe('注入中')
    // Node.DOCUMENT_POSITION_FOLLOWING:action 在 detail 之后 —— 语序由词包决定,渲染器不重排
    expect(
      detail !== null &&
        action !== null &&
        (detail.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
