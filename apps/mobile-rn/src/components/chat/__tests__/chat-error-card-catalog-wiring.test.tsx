// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ChatMessageItem 错误卡目录化「接线」测试(D-AI-3,2026-11-13)。
 *
 * 判据本体由 shared `stream-error-view.test.ts` 钉死;本套件钉的是接线链一环:
 *   mobile-rn ChatMessageItem(item.errorCode)→ buildStreamErrorLabelSet(tStream/tCatalog)
 *   → buildStreamErrorView → 上屏 testID 锚点(卡片/标题/建议行)。
 *
 * 三条判据:
 *  ① 收录码(item.errorCode='102')⇒ 标题来自目录表(非 fallback 通用文案)+ 建议行渲染;
 *  ② 未收录码(errorCode='__NO_SUCH_CODE__')⇒ 回落 chatAlert.errorTitle + 无建议行;
 *  ③ errorCode 缺失(item.error=true 但无码)⇒ 同②,不喷键名、不臆造标题。
 */
import { describe, expect, it, vi } from 'vitest'
// __DEV__ stub 已移到 tests/setup.ts(globalThis 直接赋值),此处不再重复。
import { render } from '@testing-library/react'
import type { MutableRefObject } from 'react'
import { type View } from 'react-native'
import sharedZhCN from '@ihui/i18n/messages/shared/zh-CN.json'
import { translate } from '@ihui/i18n/loader'
import type { Messages } from '@ihui/i18n/types'
import { ChatMessageItem } from '../ChatMessageList'
import type { ChatScreenMessage } from '@ihui/rn-app'

const sharedMessages = sharedZhCN as Messages
const t = (key: string, params?: Record<string, string | number>): string =>
  translate(sharedMessages, key, { params })

/** 测试 item 工厂:构造最小 ChatScreenMessage + error 字段 */
function makeFailedItem(errorCode?: string): ChatScreenMessage {
  return {
    id: 'test-msg-1',
    role: 'assistant',
    content: '请求失败:服务不可用',
    error: true,
    ...(errorCode !== undefined ? { errorCode } : {}),
  } as ChatScreenMessage
}

/** 最小 props 集合(所有必填 props 均给 no-op 或空容器) */
function makeProps(item: ChatScreenMessage) {
  const emptySet = new Set<string>()
  return {
    item,
    messages: [item],
    isStreaming: false,
    expandedCodeBlocks: emptySet,
    setExpandedCodeBlocks: vi.fn(),
    expandedThinking: emptySet,
    setExpandedThinking: vi.fn(),
    executionVizById: {},
    maybeTriggerFirstShareReward: vi.fn(),
    showToast: vi.fn(),
    onLongPressMessage: vi.fn(),
    rateMessage: vi.fn().mockResolvedValue(undefined),
    retryLastTurn: vi.fn(),
    toggleMessageFlag: vi.fn().mockResolvedValue(undefined),
    t,
    conversationId: null,
    messageRefs: { current: new Map() } as unknown as MutableRefObject<Map<View | null, unknown>>,
    setPreviewImageUrl: vi.fn(),
    workspaceTier: null,
  }
}

/** testID 锚点(与组件里 testID={`message-error-*-item.id`} 对齐) */
const cardTestId = 'message-error-card-test-msg-1'
const titleTestId = 'message-error-title-test-msg-1'
const nextStepTestId = 'message-error-nextstep-test-msg-1'

describe('mobile-rn ChatMessageItem 错误卡目录化接线(D-AI-3)', () => {
  it('① 收录码:标题来自目录表、建议行渲染', () => {
    const catalog = (sharedMessages as Record<string, never>).ai as never as {
      pane: { errorCatalog: Record<string, { title: string; action: string }> }
    }
    const code = '102'
    const expected = catalog.pane.errorCatalog[code]
    expect(expected).toBeDefined()
    const props = makeProps(makeFailedItem(code))
    const { queryByTestId } = render(<ChatMessageItem {...props} />)
    // 标题 = 目录表 title(非 chatAlert.errorTitle fallback)
    const titleEl = queryByTestId(titleTestId)
    expect(titleEl).toBeTruthy()
    expect(titleEl?.textContent).toContain(expected.title)
    // 建议行 = 目录表 action(具体建议)
    const nextEl = queryByTestId(nextStepTestId)
    expect(nextEl).toBeTruthy()
    expect(nextEl?.textContent).toContain(expected.action)
    // 卡片容器存在
    expect(queryByTestId(cardTestId)).toBeTruthy()
  })

  it('② 未收录码:回落通用文案、无建议行、不喷键名', () => {
    const props = makeProps(makeFailedItem('__NO_SUCH_CODE__'))
    const { queryByTestId } = render(<ChatMessageItem {...props} />)
    const titleEl = queryByTestId(titleTestId)
    expect(titleEl).toBeTruthy()
    const fallbackTitle = t('chatAlert.errorTitle')
    expect(titleEl?.textContent).toContain(fallbackTitle)
    // 不喷键名
    expect(titleEl?.textContent).not.toContain('ai.pane.errorCatalog')
    expect(titleEl?.textContent).not.toContain('streamErrors')
    // 无建议行
    expect(queryByTestId(nextStepTestId)).toBeNull()
  })

  it('③ errorCode 缺失(error=true 但无码):同②,不臆造标题', () => {
    const props = makeProps(makeFailedItem())
    const { queryByTestId } = render(<ChatMessageItem {...props} />)
    const titleEl = queryByTestId(titleTestId)
    expect(titleEl).toBeTruthy()
    expect(titleEl?.textContent).toContain(t('chatAlert.errorTitle'))
    expect(queryByTestId(nextStepTestId)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
