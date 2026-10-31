// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D35 metadata 懒取 + 失败降级 · MessageItem 渲染位用例(2026-10-31):
// 列表读面的 metadata 只带九类摘要信封 ⇒ 展开 Code 面板必须按消息懒取全文;
// 请求失败只渲染一行占位(不抛、不白屏、不把"没取到"说成"没有")。
// 与 message-item-fallback-line.test.tsx 同纪律:喂真 store + 真 MessageItem,
// 只 mock next-intl 取词与 api-client 的懒取出口。
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => `[${key}]`,
  useLocale: () => 'zh-CN',
}))

const getMessageMetadataMock = vi.fn()
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getMessageMetadata: (conversationId: string, messageId: string) =>
      getMessageMetadataMock(conversationId, messageId),
  }
})

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const CONVERSATION_ID = 'conv-d35-lazy'
const ID = 'a-d35-lazy-metadata'

/** 列表读面下发的消息:metadata 只剩九类摘要信封(工具类 2 条) */
function assistantWithSummaryMetadata(): ChatMessage {
  return {
    id: ID,
    role: 'assistant',
    content: '带过程信息的回答',
    createdAt: Date.UTC(2026, 9, 31, 8, 0, 0),
    metadata: {
      permissionMode: 'default',
      toolCalls: { summary: true, count: 2, bytes: 128 },
      fallback: { summary: true, bytes: 64 },
    },
  }
}

function renderMessage(m: ChatMessage) {
  render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useChatStore.setState({ conversationId: CONVERSATION_ID, messages: [] })
})

afterEach(() => {
  cleanup()
  useChatStore.setState({ conversationId: null, messages: [] })
  getMessageMetadataMock.mockReset()
})

describe('MessageItem metadata 懒取(D35)', () => {
  it('摘要行也有 Code 入口;展开即按 (conversationId,messageId) 懒取全文并逐类渲染', async () => {
    getMessageMetadataMock.mockResolvedValue({
      success: true,
      data: {
        messageId: ID,
        metadata: {
          toolCalls: [{ id: 't1' }, { id: 't2' }],
          fallback: { primary_model: 'a', backup_model: 'b', reason: 'timeout' },
        },
      },
    })
    renderMessage(assistantWithSummaryMetadata())

    // 摘要形态本地没有 usage,但按钮必须在(否则懒取结构上点不到)
    fireEvent.click(screen.getByTestId(`message-metadata-${ID}`))
    // 请求未结算时先给加载占位
    expect(screen.getByTestId(`message-metadata-lazy-loading-${ID}`)).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByTestId(`message-metadata-kind-toolCalls-${ID}`).textContent).toContain('2')
    })
    expect(getMessageMetadataMock).toHaveBeenCalledTimes(1)
    expect(getMessageMetadataMock).toHaveBeenCalledWith(CONVERSATION_ID, ID)
    // 九类逐类一行(缺失的类给 "—",不制造假计数)
    expect(screen.getByTestId(`message-metadata-kind-planSteps-${ID}`).textContent).toContain('—')
  })

  it('请求 reject ⇒ 渲染占位而非白屏/抛错(面板仍在)', async () => {
    getMessageMetadataMock.mockRejectedValue(new Error('network down'))
    renderMessage(assistantWithSummaryMetadata())

    fireEvent.click(screen.getByTestId(`message-metadata-${ID}`))

    await waitFor(() => {
      expect(screen.getByTestId(`message-metadata-lazy-failed-${ID}`)).toBeTruthy()
    })
    expect(screen.getByTestId(`message-metadata-lazy-failed-${ID}`).textContent).toBe(
      '[message.metadataUnavailable]',
    )
    // 面板本体还在:失败只降级一行,不整块消失(不白屏)
    expect(screen.getByTestId(`message-metadata-panel-${ID}`)).toBeTruthy()
  })

  it('ApiResult success=false 与网络错误同档降级(不误判成 ready)', async () => {
    getMessageMetadataMock.mockResolvedValue({ success: false, error: { message: 'forbidden' } })
    renderMessage(assistantWithSummaryMetadata())

    fireEvent.click(screen.getByTestId(`message-metadata-${ID}`))

    await waitFor(() => {
      expect(screen.getByTestId(`message-metadata-lazy-failed-${ID}`)).toBeTruthy()
    })
    expect(screen.queryByTestId(`message-metadata-kind-toolCalls-${ID}`)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
