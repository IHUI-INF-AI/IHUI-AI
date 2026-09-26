// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

/**
 * D20「小程序会话列表读服务端 + 置顶可用」的行为测试。
 *
 * 判据的对象是**这一票新立的三件事**:
 *   ① 取列表的判序 fail-closed —— 服务端没真拿到就不算拿到,一律回落本机快照并标 source;
 *   ② 置顶只在服务端来源的行上可用(本机快照 id 不是会话主键,给了必失败);
 *   ③ 排序/置顶动作不另起炉灶,全走共享出口(sortPinnedFirst / togglePinnedItem)。
 * 夹具里的 mock 只用于切断平台依赖,不改变被测判序本身。
 */

const taroCalls = vi.hoisted(() => ({
  toast: [] as Array<{ title?: string }>,
  storage: {} as Record<string, unknown>,
}))

vi.mock('@tarojs/taro', () => {
  const Taro = {
    getStorageSync: (key: string) => {
      const v = taroCalls.storage[key]
      if (v instanceof Error) throw v
      return v ?? ''
    },
    setStorageSync: (key: string, val: unknown) => {
      taroCalls.storage[key] = val
    },
    showToast: (opts: { title?: string }) => {
      taroCalls.toast.push(opts)
    },
    showModal: vi.fn(),
    navigateTo: vi.fn(),
    useDidShow: vi.fn(),
  }
  return { default: Taro, ...Taro }
})

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return {
    View: make('div'),
    Text: make('span'),
    Image: make('img'),
    Button: make('button'),
    ScrollView: make('div'),
  }
})

vi.mock('@ihui/api-client', () => ({
  listConversations: vi.fn(),
  setConversationPinned: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tList: () => [],
    locale: 'zh-CN',
    setLocale: () => {},
  }),
  t: (key: string) => key,
}))

// 页面用的两个装饰性组件与被测判序无关,截断其平台依赖
vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: Record<string, unknown>) =>
    createElement('div', { className: props.className as string }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})
vi.mock('@/components/SearchBar', () => {
  const Stub = () => createElement('input')
  Stub.displayName = 'SearchBarStub'
  return { default: Stub }
})
vi.mock('@/constants/remote-icons', () => ({
  REMOTE_ICONS: {
    message: 'message.png',
    imageOr: 'image.png',
    aimusic: 'voice.png',
    jiqiren: 'agent.png',
    search: 'search.png',
  },
}))

import {
  loadHistoryRows,
  mapServerConversation,
  orderHistoryRows,
  readLocalHistory,
  type ConversationRow,
} from '../src/pkg-ai/ai/history'
import ConversationHistoryItem from '../src/components/ConversationHistoryItem'
import type { ApiResult } from '@ihui/types'
import type { ListConversationsResult } from '@ihui/api-client'

/** 造一条服务端会话行(字段齐备,只用 Partial 覆盖差异位) */
function convRow(over: Partial<ConversationRow> & { id: string }): ConversationRow {
  return {
    userId: 'user-1',
    title: '未命名',
    model: 'gpt',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-02T00:00:00.000Z',
    ...over,
  }
}

const LOCAL_SNAPSHOT = [
  {
    id: 'hist_1700000000000',
    title: '本机快照对话',
    time: '2026-09-03T00:00:00.000Z',
    timestamp: Date.parse('2026-09-03T00:00:00.000Z'),
    messages: [{ content: '本机里的回答' }],
  },
]

function serverOk(conversations: ConversationRow[]): ApiResult<ListConversationsResult> {
  return {
    success: true,
    data: { conversations, page: 1, pageSize: 50, total: conversations.length },
  }
}

beforeEach(() => {
  taroCalls.toast.length = 0
  Object.keys(taroCalls.storage).forEach((k) => delete taroCalls.storage[k])
})

describe('① loadHistoryRows —— 判序必须 fail-closed', () => {
  it('服务端 success:true ⇒ 用服务端行,并且根本不读本机快照', async () => {
    const readLocal = vi.fn(() => LOCAL_SNAPSHOT)
    const res = await loadHistoryRows({
      fetchServer: async () => serverOk([convRow({ id: 'c-1', title: '服务端会话' })]),
      readLocal,
    })
    expect(res.source).toBe('server')
    expect(res.items.map((i) => i.id)).toEqual(['c-1'])
    expect(readLocal).not.toHaveBeenCalled()
  })

  it('success:false(未登录 401 / 4xx)⇒ 回落本机快照并标 source=local', async () => {
    const res = await loadHistoryRows({
      fetchServer: async (): Promise<ApiResult<ListConversationsResult>> => ({
        success: false,
        error: 'unauthorized',
        status: 401,
      }),
      readLocal: () => LOCAL_SNAPSHOT,
    })
    expect(res.source).toBe('local')
    expect(res.items.map((i) => i.id)).toEqual(['hist_1700000000000'])
  })

  it('调用抛错(网络故障 / 5xx 走 fetchApi 的 HttpError)⇒ 同样回落,不崩', async () => {
    const res = await loadHistoryRows({
      fetchServer: async () => {
        throw new Error('HttpError: 502')
      },
      readLocal: () => LOCAL_SNAPSHOT,
    })
    expect(res.source).toBe('local')
    expect(res.items).toHaveLength(1)
  })

  it('success:true 但 conversations 不是数组 ⇒ 仍算没拿到(不把半截数据当服务端结果)', async () => {
    const res = await loadHistoryRows({
      fetchServer: async () =>
        ({
          success: true,
          data: { conversations: null },
        }) as unknown as ApiResult<ListConversationsResult>,
      readLocal: () => LOCAL_SNAPSHOT,
    })
    expect(res.source).toBe('local')
  })

  it('服务端与本机都取不到 ⇒ 空列表 + local 源(空态可渲染,绝不抛给页面)', async () => {
    taroCalls.storage['ai_chat_history'] = new Error('storage 损坏')
    const res = await loadHistoryRows({
      fetchServer: async () => {
        throw new Error('offline')
      },
      readLocal: readLocalHistory,
    })
    expect(res.source).toBe('local')
    expect(res.items).toEqual([])
  })

  it('readLocalHistory:存储里不是数组 ⇒ 返回空数组而不是把脏值当列表', () => {
    taroCalls.storage['ai_chat_history'] = '{ bad json'
    expect(readLocalHistory()).toEqual([])
    taroCalls.storage['ai_chat_history'] = LOCAL_SNAPSHOT
    expect(readLocalHistory()).toHaveLength(1)
  })
})

describe('② 行映射与置顶可用位', () => {
  it('mapServerConversation 把 pinned 归一成布尔、透传 messageCount、取最后活动时间', () => {
    const row = mapServerConversation(
      convRow({
        id: 'c-9',
        title: '带置顶的会话',
        pinned: true,
        pinnedAt: '2026-09-05T00:00:00.000Z',
        lastMessageAt: '2026-09-06T00:00:00.000Z',
        messageCount: 7,
      }),
    )
    expect(row.pinned).toBe(true)
    expect(row.messageCount).toBe(7)
    expect(row.timestamp).toBe(Date.parse('2026-09-06T00:00:00.000Z'))
    // 服务端列表接口不带消息体 ⇒ 留空数组,由行组件跳过摘要行
    expect(row.messages).toEqual([])
  })

  it('未声明 pinned 的会话行 ⇒ pinned=false(而不是 undefined 混进渲染)', () => {
    expect(mapServerConversation(convRow({ id: 'c-10' })).pinned).toBe(false)
  })

  it('ConversationHistoryItem:canPin=false 时不渲染任何置顶入口', () => {
    const html = renderToStaticMarkup(
      createElement(ConversationHistoryItem, {
        id: 'hist_1',
        title: '本机快照对话',
        preview: '本机里的回答',
        time: '09-03 00:00',
        countLabel: '1 条消息',
        iconSrc: 'message.png',
        canPin: false,
        pinned: false,
        pinLabel: '置顶',
        pinnedLabel: '已置顶',
        onOpen: () => {},
        onTogglePin: () => {},
      }),
    )
    expect(html).not.toContain('置顶')
    expect(html).toContain('本机快照对话')
  })

  it('ConversationHistoryItem:canPin=true 才出现置顶动作,已置顶时文案换成可解除态', () => {
    const unpinned = renderToStaticMarkup(
      createElement(ConversationHistoryItem, {
        id: 'c-1',
        title: '服务端会话',
        time: '09-06 00:00',
        countLabel: '7 条消息',
        iconSrc: 'message.png',
        canPin: true,
        pinned: false,
        pinLabel: '置顶',
        pinnedLabel: '已置顶',
        onOpen: () => {},
        onTogglePin: () => {},
      }),
    )
    expect(unpinned).toContain('置顶')
    expect(unpinned).not.toContain('已置顶')

    const pinnedHtml = renderToStaticMarkup(
      createElement(ConversationHistoryItem, {
        id: 'c-1',
        title: '服务端会话',
        time: '09-06 00:00',
        countLabel: '7 条消息',
        iconSrc: 'message.png',
        canPin: true,
        pinned: true,
        pinLabel: '置顶',
        pinnedLabel: '已置顶',
        onOpen: () => {},
        onTogglePin: () => {},
      }),
    )
    expect(pinnedHtml).toContain('已置顶')
  })

  it('服务端行没有 preview ⇒ 摘要行整条不渲染(不得用占位文案冒充对话内容)', () => {
    const html = renderToStaticMarkup(
      createElement(ConversationHistoryItem, {
        id: 'c-2',
        title: '只有标题的服务端会话',
        time: '09-06 00:00',
        countLabel: '0 条消息',
        iconSrc: 'message.png',
        canPin: true,
        pinned: false,
        pinLabel: '置顶',
        pinnedLabel: '已置顶',
        onOpen: () => {},
        onTogglePin: () => {},
      }),
    )
    expect(html).toContain('只有标题的服务端会话')
    expect(html.match(/只有标题的服务端会话/g)).toHaveLength(1)
    expect(html).toContain('0 条消息')
  })
})

describe('③ 排序只有一个出口 —— 置顶优先由共享 sortPinnedFirst 决定', () => {
  it('置顶行即便时间更靠后也浮到最前;非置顶保持原相对顺序', () => {
    const rows = orderHistoryRows([
      { id: 'new', title: 'n', time: '', timestamp: 3000, messages: [] },
      { id: 'pinned-old', title: 'p', time: '', timestamp: 1000, messages: [], pinned: true },
      { id: 'mid', title: 'm', time: '', timestamp: 2000, messages: [] },
    ])
    expect(rows.map((r) => r.id)).toEqual(['pinned-old', 'new', 'mid'])
  })

  it('没有任何置顶 ⇒ 纯时间倒序(兜底态本机快照的行为不变)', () => {
    const rows = orderHistoryRows([
      { id: 'a', title: 'a', time: '', timestamp: 1000, messages: [] },
      { id: 'b', title: 'b', time: '', timestamp: 3000, messages: [] },
      { id: 'c', title: 'c', time: '', timestamp: 2000, messages: [] },
    ])
    expect(rows.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })
})

describe('④ 源码级反向锁:共享层优先 / 不另起炉灶 / 不直连后端', () => {
  const src = readFileSync(resolve(__dirname, '../src/pkg-ai/ai/history.tsx'), 'utf8')
  const componentSrc = readFileSync(
    resolve(__dirname, '../src/components/ConversationHistoryItem.tsx'),
    'utf8',
  )

  it('置顶动作与排序都从共享包导入', () => {
    expect(src).toContain("@ihui/shared/chat/conversation-pin'")
    expect(src).toContain('togglePinnedItem(')
    expect(src).toContain("@ihui/shared/chat/conversation-org'")
    expect(src).toContain('sortPinnedFirst(')
  })

  it('端内只允许那一处 .sort( 打底时间序 —— 出现第二处就是在自写置顶排序', () => {
    const sortCalls = src.match(/\.sort\(/g) ?? []
    expect(sortCalls).toHaveLength(1)
  })

  it('页面与行组件都不得绕过 api-client 直连后端(守门 73 的本地预锁)', () => {
    for (const text of [src, componentSrc]) {
      expect(text).not.toMatch(/Taro\.request\(/)
      expect(text).not.toMatch(/\bfetch\(/)
      expect(text).not.toMatch(/axios/)
    }
    expect(src).toContain("from '@ihui/api-client'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
