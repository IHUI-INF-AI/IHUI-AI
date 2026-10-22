// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 票60 步序六(片 A,2026-10-21):会话切换缓存的"窗格 + 会话"二元身份取证。
// 成对设计:正向钉"两窗格各一只桶、互不顶掉";反证把窗格这一维摘掉(两席按同一档归档),
// 必须当场复现"非根拿到根的陈旧快照 / 根的快照被非根顶掉"—— 只有窗格维是唯一变量,
// 用例才算有牙;否则把 paneId 从键里删掉也照样绿,规矩就成了摆设。

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'

import { ROOT_PANE_ID } from '@ihui/shared/chat/multi-pane'
import {
  CONVERSATION_CACHE_LIMIT,
  CONVERSATION_PANE_CACHE_PERSIST_KEY,
  conversationCacheKey,
  readConversationCache,
  resetConversationCache,
  useConversationPaneCache,
  writeConversationCache,
} from '@/hooks/use-conversation-pane-cache'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import type { ChatMessage } from '@/stores/chat'

const CONVERSATION_ID = '1234567890'
const PANE_ID = 'pane-b'

function message(content: string): ChatMessage {
  return { id: content, role: 'user', content, createdAt: 1730000000000 }
}

/** 根窗格(不挂 Provider = 单例场景)与指定窗格各起一个 hook 实例 */
function mountRootCache() {
  return renderHook(() => useConversationPaneCache())
}

function mountPaneCache(paneId: string) {
  return renderHook(() => useConversationPaneCache(), {
    wrapper: ({ children }) => <ChatPaneProvider paneId={paneId}>{children}</ChatPaneProvider>,
  })
}

beforeEach(() => {
  resetConversationCache()
})

afterEach(() => {
  resetConversationCache()
})

describe('会话缓存按窗格隔离(片 A 正向)', () => {
  it('根与非根承载同一会话时互不顶掉:非根读不到根的陈旧快照,根的快照也不被非根改写', () => {
    const root = mountRootCache()
    const pane = mountPaneCache(PANE_ID)

    root.result.current.write(CONVERSATION_ID, {
      messages: [message('root-stale')],
      hasMore: false,
      oldestCursor: 'cursor-root',
    })

    // 非根窗格读同一条会话 ⇒ 必须是未命中(自己去拉),而不是拿根那份陈旧快照
    expect(pane.result.current.read(CONVERSATION_ID)).toBeNull()

    pane.result.current.write(CONVERSATION_ID, {
      messages: [message('pane-fresh')],
      hasMore: true,
      oldestCursor: 'cursor-pane',
    })

    // 根窗格切回时仍然是自己那份(不被非根顶掉)
    const rootEntry = root.result.current.read(CONVERSATION_ID)
    expect(rootEntry?.messages[0]?.content).toBe('root-stale')
    expect(rootEntry?.hasMore).toBe(false)
    expect(rootEntry?.oldestCursor).toBe('cursor-root')

    const paneEntry = pane.result.current.read(CONVERSATION_ID)
    expect(paneEntry?.messages[0]?.content).toBe('pane-fresh')
    expect(paneEntry?.hasMore).toBe(true)
    expect(paneEntry?.oldestCursor).toBe('cursor-pane')
  })

  it('翻页状态各走各的:根窗格的 hasMore/游标不渗到非根窗格', () => {
    const root = mountRootCache()
    const pane = mountPaneCache(PANE_ID)

    act(() => {
      root.result.current.resetPager('cursor-root', true)
    })
    expect(root.result.current.hasMoreHistory).toBe(true)
    expect(root.result.current.oldestCursorRef.current).toBe('cursor-root')
    // 非根窗格此刻仍在"没有更早"的初值上 —— 根的翻页不会把它一起点亮
    expect(pane.result.current.hasMoreHistory).toBe(false)
    expect(pane.result.current.oldestCursorRef.current).toBeNull()

    act(() => {
      pane.result.current.resetPager('cursor-pane', false)
    })
    expect(root.result.current.hasMoreHistory).toBe(true)
    expect(root.result.current.oldestCursorRef.current).toBe('cursor-root')
  })

  it('回写只落自己窗格那一只桶:patch 改写根的快照不影响非根', () => {
    const root = mountRootCache()
    const pane = mountPaneCache(PANE_ID)
    root.result.current.write(CONVERSATION_ID, {
      messages: [message('root-1')],
      hasMore: true,
      oldestCursor: 'cursor-root',
    })
    pane.result.current.write(CONVERSATION_ID, {
      messages: [message('pane-1')],
      hasMore: false,
      oldestCursor: null,
    })

    act(() => {
      root.result.current.setHasMoreHistory(false)
      root.result.current.oldestCursorRef.current = 'cursor-root-advanced'
    })
    root.result.current.patch(CONVERSATION_ID, [message('root-2')])

    const rootEntry = root.result.current.read(CONVERSATION_ID)
    expect(rootEntry?.messages[0]?.content).toBe('root-2')
    expect(rootEntry?.hasMore).toBe(false)
    expect(rootEntry?.oldestCursor).toBe('cursor-root-advanced')

    const paneEntry = pane.result.current.read(CONVERSATION_ID)
    expect(paneEntry?.messages[0]?.content).toBe('pane-1')
    expect(paneEntry?.hasMore).toBe(false)
    expect(paneEntry?.oldestCursor).toBeNull()
  })

  it('LRU 上限按窗格各计:根窗格翻满 6 条会话不会挤掉非根窗格的快照', () => {
    const root = mountRootCache()
    const pane = mountPaneCache(PANE_ID)
    pane.result.current.write(CONVERSATION_ID, {
      messages: [message('pane-keep')],
      hasMore: false,
      oldestCursor: null,
    })

    for (let i = 0; i < CONVERSATION_CACHE_LIMIT + 1; i += 1) {
      root.result.current.write(`conv-${i}`, {
        messages: [message(`root-${i}`)],
        hasMore: false,
        oldestCursor: null,
      })
    }

    expect(root.result.current.size()).toBe(CONVERSATION_CACHE_LIMIT)
    expect(pane.result.current.read(CONVERSATION_ID)?.messages[0]?.content).toBe('pane-keep')
    // 被挤掉的必须是根窗格自己最早那一条(不是跨窗格乱删)
    expect(root.result.current.read('conv-0')).toBeNull()
    expect(root.result.current.read(`conv-${CONVERSATION_CACHE_LIMIT}`)).not.toBeNull()
  })

  it('根窗格行为零变化:无 Provider 时按 ROOT_PANE_ID 归档,反复读写落在同一只桶', () => {
    const root = mountRootCache()
    expect(root.result.current.paneId).toBeNull()
    expect(root.result.current.cacheKeyOf(CONVERSATION_ID)).toBe(
      `${ROOT_PANE_ID}::${CONVERSATION_ID}`,
    )
    expect(conversationCacheKey(null, CONVERSATION_ID)).toBe(
      conversationCacheKey(root.result.current.paneId, CONVERSATION_ID),
    )

    root.result.current.write(CONVERSATION_ID, {
      messages: [message('root-only')],
      hasMore: true,
      oldestCursor: 'c1',
    })
    expect(root.result.current.read(CONVERSATION_ID)?.messages[0]?.content).toBe('root-only')
    expect(root.result.current.size()).toBe(1)
  })
})

describe('会话缓存按窗格隔离(片 A 反证)', () => {
  it('反证:窗格身份不参与键(两席按同一档归档)⇒ 非根拿到根的陈旧快照', () => {
    const rootSeat = mountPaneCache(PANE_ID)
    const paneSeat = mountPaneCache(PANE_ID)

    rootSeat.result.current.write(CONVERSATION_ID, {
      messages: [message('root-stale')],
      hasMore: false,
      oldestCursor: 'cursor-root',
    })
    // 只有一只桶 ⇒ 非根"命中缓存",把根的陈旧快照当成自己的历史直接铺上去
    const staleAsOwn = paneSeat.result.current.read(CONVERSATION_ID)
    expect(staleAsOwn?.messages[0]?.content).toBe('root-stale')
    expect(staleAsOwn?.oldestCursor).toBe('cursor-root')
  })

  it('反证:同一只桶里后写的一方把先写的顶掉(根切回时读到的是非根那份)', () => {
    const rootSeat = mountPaneCache(PANE_ID)
    const paneSeat = mountPaneCache(PANE_ID)

    rootSeat.result.current.write(CONVERSATION_ID, {
      messages: [message('root-stale')],
      hasMore: true,
      oldestCursor: 'cursor-root',
    })
    paneSeat.result.current.write(CONVERSATION_ID, {
      messages: [message('pane-fresh')],
      hasMore: false,
      oldestCursor: null,
    })

    const afterOtherPaneWrote = rootSeat.result.current.read(CONVERSATION_ID)
    expect(afterOtherPaneWrote?.messages[0]?.content).toBe('pane-fresh')
    expect(afterOtherPaneWrote?.hasMore).toBe(false)
    expect(afterOtherPaneWrote?.oldestCursor).toBeNull()
  })

  it('反证的唯一变量是窗格维:同一组会话 id 在现口径下必须是两只不同的桶', () => {
    expect(conversationCacheKey(null, CONVERSATION_ID)).not.toBe(
      conversationCacheKey(PANE_ID, CONVERSATION_ID),
    )
    expect(conversationCacheKey('pane-a', CONVERSATION_ID)).not.toBe(
      conversationCacheKey('pane-b', CONVERSATION_ID),
    )
    // 会话半边照旧参与身份:同窗格两条会话不能共用一只桶
    expect(conversationCacheKey(PANE_ID, 'conv-1')).not.toBe(
      conversationCacheKey(PANE_ID, 'conv-2'),
    )
  })
})

describe('G-935 缺口B 快照落盘 / 惰性装载', () => {
  it('write 后落盘键出现,含窗格化桶键与消息引用', async () => {
    writeConversationCache(PANE_ID, CONVERSATION_ID, {
      messages: [message('disk-me')],
      hasMore: true,
      oldestCursor: 'cursor-disk',
    })
    // 落盘是 200ms 合批,等它过一遍再验
    await new Promise((resolve) => setTimeout(resolve, 300))
    const raw = window.localStorage.getItem(CONVERSATION_PANE_CACHE_PERSIST_KEY)
    expect(raw).toBeTruthy()
    const blob = JSON.parse(raw as string) as {
      entries: Array<[string, { messages: Array<{ content: string }> }]>
    }
    const hit = blob.entries.find(([key]) => key === conversationCacheKey(PANE_ID, CONVERSATION_ID))
    expect(hit?.[1].messages[0]?.content).toBe('disk-me')
  })

  it('惰性装载:上个会话留下的合法快照在首个读触点灌回内存;不合法条目按条丢弃', () => {
    const goodKey = conversationCacheKey(PANE_ID, 'conv-good')
    const badKey = conversationCacheKey(PANE_ID, 'conv-bad')
    window.localStorage.setItem(
      CONVERSATION_PANE_CACHE_PERSIST_KEY,
      JSON.stringify({
        entries: [
          [goodKey, { messages: [message('hydrated-ok')], hasMore: false, oldestCursor: null }],
          [badKey, { messages: 'not-an-array', hasMore: false, oldestCursor: null }],
        ],
      }),
    )
    // 首个读触点即触发装载(同步),必须拿回合法那条
    expect(readConversationCache(PANE_ID, 'conv-good')?.messages[0]?.content).toBe('hydrated-ok')
    expect(readConversationCache(PANE_ID, 'conv-bad')).toBeNull()
  })

  it('坏 blob(非法 JSON)⇒ 清键回落空表,不炸首个触点', () => {
    window.localStorage.setItem(CONVERSATION_PANE_CACHE_PERSIST_KEY, '{not-json')
    expect(readConversationCache(PANE_ID, CONVERSATION_ID)).toBeNull()
    expect(window.localStorage.getItem(CONVERSATION_PANE_CACHE_PERSIST_KEY)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
