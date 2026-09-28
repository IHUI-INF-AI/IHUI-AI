// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// V3 #62(2026-09-27 立)—— useChatSearch 的判据用例。
//
// 本票接线时这个 hook 有两处必须被钉住的语义:
//  ① 匹配规则**委托**给 @ihui/shared 的 searchMessages(唯一出口),不在此重写第二套
//     —— 委托后行为可测:正则元字符不得被当量词(旧自带实现用 toLowerCase().includes,
//     元字符天然安全,换成共享出口后这条必须由用例接手,否则"复用"就是降级);
//  ② 面向用户的文案不得硬编码中文(§19 / 守门 70):「未找到该消息」只走调用方注入。
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { useChatSearch } from '@/hooks/use-chat-search'

const MESSAGES = [
  { id: 'm1', content: '如何部署 API 网关', createdAt: 1_760_000_000_000 },
  { id: 'm2', content: 'Deploy the gateway again', createdAt: 1_760_000_100_000 },
  { id: 'm3', content: '无关的一条', createdAt: 1_760_000_200_000 },
]

function containerWith(...ids: string[]) {
  const root = document.createElement('div')
  for (const id of ids) {
    const node = document.createElement('div')
    node.setAttribute('data-message-id', id)
    node.scrollIntoView = vi.fn()
    root.appendChild(node)
  }
  return { root, ref: { current: root } }
}

describe('V3 #62 useChatSearch / 命中投影', () => {
  it('大小写不敏感命中,并带出摘要与时间', () => {
    const { ref } = containerWith('m1', 'm2')
    const { result } = renderHook(() =>
      useChatSearch({ messages: MESSAGES, messagesContainerRef: ref }),
    )
    act(() => result.current.handleSearch('gateway'))
    expect(result.current.searchResults.map((r) => r.id)).toEqual(['m2'])
    expect(result.current.searchResults[0]?.preview).toContain('gateway')
    expect(result.current.searchResults[0]?.createTime).toBe('1760000100000')
  })

  it('中文查询同样命中(共享规则按原文匹配,不做分词)', () => {
    const { ref } = containerWith('m1')
    const { result } = renderHook(() =>
      useChatSearch({ messages: MESSAGES, messagesContainerRef: ref }),
    )
    act(() => result.current.handleSearch('部署'))
    expect(result.current.searchResults.map((r) => r.id)).toEqual(['m1'])
  })

  it('正则元字符按字面量处理(委托共享出口后必须由本用例守住这条)', () => {
    const { ref } = containerWith('m1')
    const { result } = renderHook(() =>
      useChatSearch({ messages: MESSAGES, messagesContainerRef: ref }),
    )
    // "a+" 若被当正则量词,会命中 "API" 里的 "A" 序列;共享出口有 escapeRegExp
    act(() => result.current.handleSearch('a+'))
    expect(result.current.searchResults).toEqual([])
  })

  it('空查询 ⇒ 空列表(不给一屏"全部结果")', () => {
    const { ref } = containerWith('m1')
    const { result } = renderHook(() =>
      useChatSearch({ messages: MESSAGES, messagesContainerRef: ref }),
    )
    act(() => result.current.handleSearch('部署'))
    act(() => result.current.handleSearch('   '))
    expect(result.current.searchResults).toEqual([])
  })
})

describe('V3 #62 useChatSearch / 点选定位与文案注入', () => {
  it('点选 ⇒ 滚动到那条消息 + 置选中态(定位按 [data-message-id],不要求外部维护 Map)', () => {
    const { root, ref } = containerWith('m1', 'm2')
    const { result } = renderHook(() =>
      useChatSearch({ messages: MESSAGES, messagesContainerRef: ref }),
    )
    act(() => result.current.scrollToMessage('m2'))
    const target = root.querySelector<HTMLElement>('[data-message-id="m2"]')
    expect(target?.scrollIntoView).toHaveBeenCalled()
    expect(result.current.selectedMessageId).toBe('m2')
  })

  it('目标不在 DOM(虚拟滚动窗口外/已被压缩)⇒ 提示调用方注入的本地化文案', () => {
    const { ref } = containerWith('m1')
    const showWarning = vi.fn()
    const { result } = renderHook(() =>
      useChatSearch({
        messages: MESSAGES,
        messagesContainerRef: ref,
        notFoundMessage: 'NOT_FOUND_I18N',
        showWarning,
      }),
    )
    act(() => result.current.scrollToMessage('ghost'))
    expect(showWarning).toHaveBeenCalledWith('NOT_FOUND_I18N')
    expect(result.current.selectedMessageId).toBeNull()
  })

  it('未注入文案时不提示,且提示面永不出现硬编码中文(§19 反向锁)', () => {
    const { ref } = containerWith('m1')
    const showWarning = vi.fn()
    const { result } = renderHook(() =>
      useChatSearch({ messages: MESSAGES, messagesContainerRef: ref, showWarning }),
    )
    act(() => result.current.scrollToMessage('ghost'))
    expect(showWarning).not.toHaveBeenCalled()
  })

  it('外来 id 含选择器元字符 ⇒ 按"定位不到"处理,不把脏串拼进 querySelector(会抛)', () => {
    const { ref } = containerWith('m1')
    const showWarning = vi.fn()
    const { result } = renderHook(() =>
      useChatSearch({
        messages: MESSAGES,
        messagesContainerRef: ref,
        notFoundMessage: 'NOT_FOUND_I18N',
        showWarning,
      }),
    )
    // 若直拼选择器,`"]` 会让 querySelector 抛 SyntaxError ⇒ 点击即崩
    act(() => result.current.scrollToMessage('x"][data-admin="1'))
    expect(showWarning).toHaveBeenCalledWith('NOT_FOUND_I18N')
    expect(result.current.selectedMessageId).toBeNull()
  })

  it('clearSearch ⇒ 关键词/命中/选中三态一起收(只收一份就是第二个真相源)', () => {
    const { ref } = containerWith('m1', 'm2')
    const { result } = renderHook(() =>
      useChatSearch({ messages: MESSAGES, messagesContainerRef: ref }),
    )
    act(() => result.current.handleSearch('gateway'))
    act(() => result.current.scrollToMessage('m2'))
    act(() => result.current.clearSearch())
    expect(result.current.searchResults).toEqual([])
    expect(result.current.selectedMessageId).toBeNull()
    expect(result.current.searchQuery).toBe('')
  })
})
