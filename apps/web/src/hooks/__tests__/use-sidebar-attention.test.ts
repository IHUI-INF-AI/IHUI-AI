// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import {
  buildBatchAttentionSummary,
  formatUnreadCount,
  isWaitingForConversation,
  resolveConversationAttention,
} from '../use-sidebar'

/**
 * D53 会话注意力态派生逻辑(G-64)守门测试。
 *
 * 四态各一用例:idle(无态)/waiting(等待你处理)/unread(有未读更新)/waiting-unread(两者并存),
 * 其中 waiting 态经 isWaitingForConversation 与 store pendingQuestion 联动(见下组)。
 * 纯函数,不碰 stores/chat.ts(D60 在改它),计数走 props/组件 local state。
 */
describe('resolveConversationAttention 四态', () => {
  it('idle:无挂起且无未读', () => {
    expect(
      resolveConversationAttention({ hasPendingQuestion: false, unreadCount: 0 }),
    ).toBe('idle')
  })

  it('waiting:pendingQuestion 挂起 → 等待你处理', () => {
    expect(
      resolveConversationAttention({ hasPendingQuestion: true, unreadCount: 0 }),
    ).toBe('waiting')
  })

  it('unread:有未读更新', () => {
    expect(
      resolveConversationAttention({ hasPendingQuestion: false, unreadCount: 3 }),
    ).toBe('unread')
  })

  it('waiting-unread:挂起与未读并存(两徽章并排,不互相吞)', () => {
    expect(
      resolveConversationAttention({ hasPendingQuestion: true, unreadCount: 2 }),
    ).toBe('waiting-unread')
  })

  it('未读为负数/NaN 按无未读处理', () => {
    expect(
      resolveConversationAttention({ hasPendingQuestion: false, unreadCount: -1 }),
    ).toBe('idle')
    expect(
      resolveConversationAttention({ hasPendingQuestion: false, unreadCount: Number.NaN }),
    ).toBe('idle')
  })
})

describe('isWaitingForConversation pendingQuestion 联动', () => {
  const base = {
    currentConversationId: 'c1',
    hasPendingQuestion: true,
  }

  it('挂起提问归属当前会话 → 当前行进入等待态', () => {
    expect(isWaitingForConversation({ ...base, conversationId: 'c1' })).toBe(true)
  })

  it('挂起提问不归属其他行 → 其他行不等待(pendingQuestion 是全局单例,只属于当前会话)', () => {
    expect(isWaitingForConversation({ ...base, conversationId: 'c2' })).toBe(false)
  })

  it('无挂起 → 不等待', () => {
    expect(
      isWaitingForConversation({
        conversationId: 'c1',
        currentConversationId: 'c1',
        hasPendingQuestion: false,
      }),
    ).toBe(false)
  })

  it('显式 waiting 优先:非当前会话也能等待(attentionById/行数据通道)', () => {
    expect(
      isWaitingForConversation({ ...base, conversationId: 'c9', explicitWaiting: true }),
    ).toBe(true)
  })

  it('无当前会话(current 为 null)时挂起不联动任何行', () => {
    expect(
      isWaitingForConversation({
        conversationId: 'c1',
        currentConversationId: null,
        hasPendingQuestion: true,
      }),
    ).toBe(false)
  })
})

describe('formatUnreadCount 徽章文案', () => {
  it('0/负数/NaN 归零', () => {
    expect(formatUnreadCount(0)).toBe('0')
    expect(formatUnreadCount(-5)).toBe('0')
    expect(formatUnreadCount(Number.NaN)).toBe('0')
  })

  it('99 以内原样', () => {
    expect(formatUnreadCount(5)).toBe('5')
  })

  it('超 99 封顶 99+', () => {
    expect(formatUnreadCount(120)).toBe('99+')
  })
})

describe('buildBatchAttentionSummary 多选条汇总', () => {
  it('空选中 → 全零(批量条零占位)', () => {
    expect(
      buildBatchAttentionSummary({
        selectedIds: new Set<string>(),
        isWaiting: () => true,
        unreadOf: () => 9,
      }),
    ).toEqual({ selectedCount: 0, waitingCount: 0, unreadCount: 0 })
  })

  it('选中 3 行:1 等待 + 2 未读 → 计数文案断言输入', () => {
    const waiting = new Set(['c1'])
    const unread: Record<string, number> = { c2: 2, c3: 5 }
    expect(
      buildBatchAttentionSummary({
        selectedIds: new Set(['c1', 'c2', 'c3']),
        isWaiting: (id) => waiting.has(id),
        unreadOf: (id) => unread[id] ?? 0,
      }),
    ).toEqual({ selectedCount: 3, waitingCount: 1, unreadCount: 2 })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
