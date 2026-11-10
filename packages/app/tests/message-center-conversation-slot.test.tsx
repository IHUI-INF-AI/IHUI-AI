// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// MessageCenterScreen 会话行行为契约锁(2026-11-06 跨端行为 prop 对齐)。
//
// ① 阳:会话行真消费 conversations / onPressConversation / onDeleteConversation /
//    renderConversationActions —— 点击行回调拿到该行、删除按钮拿到该行、注入槽位渲染并可触发;
// ② 阴:不传 onDeleteConversation / renderConversationActions ⇒ 对应按钮与动作块不渲染
//    (摘掉小程序端接线时,①同一断言必红);
// ③ 「会话行有内容」时不再叠「暂无消息」空态。

import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { MessageCenterScreen } from '../src/features/message-center/MessageCenterScreen'
import type { MessageConversationItem } from '../src/types'

afterEach(cleanup)

const t = (key: string) => key

const conversations: MessageConversationItem[] = [
  { id: 'c1', name: '会话A', lastMessage: 'hi', unread: 2 },
]

function baseProps() {
  return {
    t,
    items: [],
    activeTab: 'all',
    onSelectTab: () => {},
    loading: false,
    refreshing: false,
    error: '',
    onRefresh: () => {},
    onBack: () => {},
    onToast: (message: string) => {
      void message.length
    },
    conversationsTab: 'all',
  }
}

describe('MessageCenterScreen 会话行行为契约', () => {
  it('阳:点击行/删除按钮/注入动作都拿到真实会话行', () => {
    const onPressConversation = vi.fn()
    const onDeleteConversation = vi.fn()
    const onInjectedAction = vi.fn()
    const { getByText, getByLabelText, getByTestId } = render(
      createElement(MessageCenterScreen, {
        ...baseProps(),
        conversations,
        onPressConversation,
        onDeleteConversation,
        renderConversationActions: (conv: MessageConversationItem) =>
          createElement(
            'button',
            { 'data-testid': 'mark-read', onClick: () => onInjectedAction(conv) },
            'mark',
          ),
      }),
    )

    fireEvent.click(getByText('会话A'))
    expect(onPressConversation).toHaveBeenCalledWith(conversations[0])

    fireEvent.click(getByLabelText('messageCenter.deleteConv'))
    expect(onDeleteConversation).toHaveBeenCalledWith(conversations[0])

    fireEvent.click(getByTestId('mark-read'))
    expect(onInjectedAction).toHaveBeenCalledWith(conversations[0])
  })

  it('阴:不传删除回调与注入槽位时,对应 UI 不存在;不传点击回调时行不可点', () => {
    const { queryByLabelText, queryByTestId, getByText, container } = render(
      createElement(MessageCenterScreen, {
        ...baseProps(),
        conversations,
      }),
    )
    expect(queryByLabelText('messageCenter.deleteConv')).toBeNull()
    expect(queryByTestId('mark-read')).toBeNull()
    // 会话行仍渲染(数据已给),但无可点按钮语义 ⇒ 不出现「看起来能点但无反应」
    expect(getByText('会话A')).toBeTruthy()
    expect(container.querySelector('[role="button"]')).toBeNull()
  })

  it('阴:会话行有内容时不再叠「暂无消息」空态', () => {
    const { queryByText } = render(
      createElement(MessageCenterScreen, {
        ...baseProps(),
        conversations,
      }),
    )
    expect(queryByText('messageCenter.empty')).toBeNull()
  })

  it('阴:无会话且无消息时才显示空态', () => {
    const { queryByText } = render(
      createElement(MessageCenterScreen, { ...baseProps(), conversations: [] }),
    )
    expect(queryByText('messageCenter.empty')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
