// @vitest-environment jsdom
// D33 fallback 交代行 · MessageItem 渲染位接线用例(2026-09-23 立):
// 落库与 api-client 契约本轮已补,水合已把 metadata.fallback 换算为 message.fallback ——
// 这里咬的是"消息上挂了 fallback,失败交代行就必须在气泡里出现",并且
// quota_equivalent 走配额话术、普通降级走切换话术(取词全部是 chat ns 既有键,零新键)。
// 与 message-item-draft-preserved.test.tsx 同纪律:喂真 store + 真 MessageItem,不 mock 组件本体。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// next-intl mock 保留插值参数:话术切换用例要断"取的是哪个键、带没带 primary/backup"
const takeWordCalls: Array<{ key: string; values?: Record<string, string> }> = []
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>): string => {
    takeWordCalls.push({ key, values })
    return `[${key}]`
  },
  useLocale: () => 'zh-CN',
}))

import { MessageItem } from '@/components/chat/message-list/MessageItem'
import { TooltipProvider } from '@/components/feedback'
import { FALLBACK_REASON_QUOTA_EQUIVALENT } from '@ihui/api-client'
import { useChatStore, type ChatMessage } from '@/stores/chat'

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0)
const ID = 'a-fallback'

function assistantWithFallback(reason: string): ChatMessage {
  return {
    id: ID,
    role: 'assistant',
    content: '正常完成的回答',
    createdAt: NOW,
    fallback: { primaryModel: 'gpt-a', backupModel: 'gpt-b', reason },
  }
}

function renderMessage(m: ChatMessage) {
  render(
    <TooltipProvider>
      <MessageItem message={m} isLast={false} isStreaming={false} assistantLabel="AI" />
    </TooltipProvider>,
  )
}

afterEach(() => {
  cleanup()
  takeWordCalls.length = 0
  useChatStore.setState({ messages: [] })
})

describe('MessageItem fallback 交代行(D33 渲染位)', () => {
  it('消息带 fallback → 交代行出现,走 chat.fallbackNotice 既有键并带 primary/backup 插值', () => {
    renderMessage(assistantWithFallback('timeout'))
    const line = screen.getByTestId(`message-fallback-${ID}`)
    expect(line.textContent).toBe('[fallbackNotice]')
    const call = takeWordCalls.find((c) => c.key === 'fallbackNotice')
    expect(call?.values).toEqual({ primary: 'gpt-a', backup: 'gpt-b' })
  })

  it('reason=quota_equivalent → 切配额话术 fallbackNoticeQuota(两键必不同,硬编码必红)', () => {
    renderMessage(assistantWithFallback(FALLBACK_REASON_QUOTA_EQUIVALENT))
    const line = screen.getByTestId(`message-fallback-${ID}`)
    expect(line.textContent).toBe('[fallbackNoticeQuota]')
  })

  it('无 fallback 的普通消息 → 交代行缺席(负例防假阳性)', () => {
    renderMessage({ id: 'a-plain', role: 'assistant', content: '普通回答', createdAt: NOW })
    expect(screen.queryByTestId('message-fallback-a-plain')).toBeNull()
  })
})
