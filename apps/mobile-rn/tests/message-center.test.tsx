// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MessageCenterScreen 消息中心测试
 *
 * 覆盖(对齐 Uniapp pagesA/message/index.vue):
 * - 通知列表加载(/api/messages?type=)
 * - 会话列表区块(listConversations 并行加载)
 * - 无会话时不渲染会话区块
 * - 点击会话 → MessageChat(peerId/name)
 *
 * 等待口径(2026-10-25 收口,同 e4989cbb9e 先例):每条异步链只等终点一次,前序各步降级为带理由
 * 的同步断言;存活 waitFor 的预算显式写死且合计 < vitest.config 的 testTimeout 10s(RTL 每段默认
 * 预算量的是机器负载:本机并发 200+ 道守门时 fireEvent→首跳实测 1201ms > 默认 1000ms ⇒ 假红)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import type * as BottomPopsModule from '../src/components/BottomPops'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    fetchApi: vi.fn(),
    listConversations: vi.fn(),
    setConversationPinned: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    alert: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
  listConversations: apiMocks.listConversations,
  setConversationPinned: apiMocks.setConversationPinned,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: apiMocks.navigate, goBack: apiMocks.goBack }),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// features 共享层 MessageCenterScreen 骨架(渲染 header/tab/列表/会话区块)
vi.mock('@ihui/rn-app', async () => {
  const { createElement: h } = await import('react')
  return {
    SearchInput: ({
      value,
      onChangeText,
    }: {
      value?: string
      onChangeText?: (value: string) => void
    }) =>
      h('input', {
        value,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      }),
    MessageCenterScreen: ({
      conversations,
      onPressConversation,
      onTogglePin,
      items,
    }: {
      conversations?: { id: string; name: string; lastMessage?: string; time?: string }[]
      onPressConversation?: (c: { id: string; name: string }) => void
      onTogglePin?: (c: { id: string; name: string }) => void
      items?: { id: string; title: string }[]
    }) =>
      h('div', { 'data-testid': 'message-center-root' }, [
        h(
          'div',
          { 'data-testid': 'conversations' },
          (conversations ?? []).map((c) =>
            h(
              'button',
              { key: c.id, onClick: () => onPressConversation?.(c) },
              c.name + (c.lastMessage ? ':' + c.lastMessage : ''),
            ),
          ),
        ),
        // 置顶入口替身:替真实共享屏那颗按钮,行为断言打在 wrapper 注入的 onTogglePin 上
        h(
          'div',
          { 'data-testid': 'pin-actions' },
          (conversations ?? []).map((c) =>
            h(
              'button',
              {
                key: `pin-${c.id}`,
                'data-pin-id': c.id,
                onClick: () => onTogglePin?.(c),
              },
              `pin:${c.id}`,
            ),
          ),
        ),
        h(
          'div',
          { 'data-testid': 'messages' },
          (items ?? []).map((i) => h('span', { key: i.id }, i.title)),
        ),
      ]),
  }
})

// MessageCenterScreen 置顶失败反馈改走共享 appAlert(见 components/BottomPops);
// importOriginal 保底其余导出,只把 appAlert 替成 spy,断言失败出口喊的是 appAlert。
vi.mock('../src/components/BottomPops', async (importOriginal) => {
  const mod = await importOriginal<typeof BottomPopsModule>()
  return { ...mod, appAlert: apiMocks.alert }
})

import { MessageCenterScreen } from '../src/screens/MessageCenterScreen'

const mockMessage = {
  id: 'm1',
  type: 'system',
  title: '系统通知',
  content: '内容',
  read: false,
  createdAt: '2026-08-19T10:00:00Z',
}

/** 列表区文本(取不到时返回空串,让断言正常失败而不是抛 TypeError 冒充"链没跑完") */
function textOfBlock(container: HTMLElement, testId: string): string {
  return container.querySelector(`[data-testid="${testId}"]`)?.textContent ?? ''
}
const messagesOf = (container: HTMLElement): string => textOfBlock(container, 'messages')
const conversationsOf = (container: HTMLElement): string => textOfBlock(container, 'conversations')

describe('MessageCenterScreen 消息中心', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: { list: [mockMessage], total: 1 } })
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: {
        conversations: [{ id: 'c1', title: 'AI客服', lastMessageAt: '2026-08-19T10:00:00Z' }],
        total: 1,
      },
    })
  })

  it('加载通知列表与会话列表', async () => {
    const { container } = render(<MessageCenterScreen />)

    // 链只有一条:load 里 fetchApi/listConversations 走 Promise.all,两者就绪后在**同一个同步块**
    // 里 setItems + setConversations ⇒ React 一次提交把两份列表一起画出来。终点就是"两块都落 DOM",
    // 只等这一次(原先串三段 waitFor,每段各带一份预算,在本机并发 200+ 道守门时会被事件循环饿死
    // 打成假红 —— 2026-10-24 实测同步占死 1200ms ⇒ fireEvent 到首跳 1201ms > 默认 1000ms)。
    await waitFor(
      () => {
        expect(messagesOf(container)).toContain('系统通知')
        expect(conversationsOf(container)).toContain('AI客服')
      },
      { timeout: 8_000 },
    )
    // 前序各步降级为同步断言:终点发生即证明它们都发生过;不这么断就看不出"列表是网络来的"
    expect(apiMocks.fetchApi, '通知列表没走 /api/messages 就是从别处冒出来的').toHaveBeenCalled()
    expect(apiMocks.listConversations, '会话区没调 listConversations 就是假数据').toHaveBeenCalled()
  })

  it('无会话时不渲染会话区块', async () => {
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: { conversations: [], total: 0 },
    })
    const { container } = render(<MessageCenterScreen />)

    // 空会话区在 load 落地**之前**也是空的 —— 拿"空"当等待对象等于没等(假绿方向)。
    // 终点改取 load 真跑完的那一格(通知列表落 DOM),再同步断会话区仍为空。
    await waitFor(() => expect(messagesOf(container)).toContain('系统通知'), { timeout: 8_000 })
    expect(conversationsOf(container), 'listConversations 返回空却渲染出了会话行').toBe('')
  })

  it('点击会话跳 MessageChat(peerId/name)', async () => {
    const { container } = render(<MessageCenterScreen />)

    // 唯一一条链 = 加载链,终点 = 会话行出现(它同时是"点得到"的前提)
    await waitFor(() => expect(conversationsOf(container)).toContain('AI客服'), {
      timeout: 8_000,
    })
    const conversations = container.querySelectorAll('[data-testid="conversations"]')
    fireEvent.click(conversations[0]!.querySelector('button') as HTMLButtonElement)

    // 点击 → onPressConversation → navigation.navigate 全程同步(不经任何 await),
    // 为它再开一段 waitFor 只会多付一份预算、不会多证明任何东西 ⇒ 同步断言。
    expect(apiMocks.navigate, '点会话没跳 MessageChat 或参数不对').toHaveBeenCalledWith(
      'MessageChat',
      { peerId: 'c1', name: 'AI客服' },
    )
  })

  // ── D20 会话置顶(G-11)端内接线:调了哪个方法 / 参数对不对 / 顺序变没变 / 失败喊没喊 ──

  it('点置顶 → setConversationPinned(id,true) 且列表按置顶优先重排', async () => {
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: {
        conversations: [
          { id: 'c1', title: '第一' },
          { id: 'c2', title: '第二' },
        ],
        total: 2,
      },
    })
    const { container } = render(<MessageCenterScreen />)
    await waitFor(() => expect(container.querySelectorAll('[data-pin-id="c2"]').length).toBe(1), {
      timeout: 4_000,
    })

    fireEvent.click(container.querySelector('[data-pin-id="c2"]') as HTMLButtonElement)

    // 两条链各等一次终点:① 加载链(置顶入口出现,它是"点得动"的前提)② 置顶链(列表重排)。
    // 重排在 `await setConversationPinned` 之后才发生 ⇒ 列表顺序变了即证明网络调用已经发生,
    // 所以原先那段"等调用发生"的 waitFor 降级成同步断言(预算 4s + 5s = 9s < testTimeout 10s)。
    await waitFor(
      () => {
        const convButtons = container
          .querySelector('[data-testid="conversations"]')!
          .querySelectorAll('button')
        expect(convButtons[0]?.textContent).toContain('第二')
        expect(convButtons[1]?.textContent).toContain('第一')
      },
      { timeout: 5_000 },
    )
    expect(apiMocks.setConversationPinned, '没走网络出口的"置顶"是本地幻觉').toHaveBeenCalledWith(
      'c2',
      true,
    )
  })

  it('置顶失败 → Alert 喊出(不得静默),列表顺序原样', async () => {
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: {
        conversations: [
          { id: 'c1', title: '第一' },
          { id: 'c2', title: '第二' },
        ],
        total: 2,
      },
    })
    apiMocks.setConversationPinned.mockRejectedValueOnce(new Error('403'))
    const { container } = render(<MessageCenterScreen />)
    await waitFor(() => expect(container.querySelectorAll('[data-pin-id="c1"]').length).toBe(1), {
      timeout: 4_000,
    })

    fireEvent.click(container.querySelector('[data-pin-id="c1"]') as HTMLButtonElement)

    // 终点 = 失败喊出(appAlert 排在 await 之后);调用参数是同一次调用的既有事实,同步断即可
    await waitFor(() => expect(apiMocks.alert).toHaveBeenCalled(), { timeout: 5_000 })
    expect(apiMocks.setConversationPinned, 'Alert 喊了但根本没发过请求').toHaveBeenCalledWith(
      'c1',
      true,
    )
    const convButtons = container
      .querySelector('[data-testid="conversations"]')!
      .querySelectorAll('button')
    expect(convButtons[0]?.textContent).toContain('第一')
    expect(convButtons[1]?.textContent).toContain('第二')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
