// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * D20 小程序端剩下三格的判序测试。
 *
 * 三格各自的"错法"都不一样,所以判据分别是:
 *   ① 回放:三条同时成立才算拿到消息 —— **空会话 ≠ 取不到**,两者必须走不同出口;
 *   ② 删除:后端没回 deleted:true 就是没删成,列表必须回到删之前那一份;
 *   ③ 续页:先手侧再服务端,兜底态(本机快照)结构上不该再打服务端。
 * 夹具里的 mock 只用于切断平台依赖,不改变被测判序本身。
 */

vi.mock('@tarojs/taro', () => {
  const Taro = {
    getStorageSync: () => '',
    setStorageSync: () => {},
    showToast: vi.fn(),
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
  deleteConversation: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, tList: () => [], locale: 'zh-CN', setLocale: () => {} }),
  t: (key: string) => key,
  useTt: () => (key: string, fb: string) => fb,
}))

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
  replayServerConversation,
  mapServerMessage,
  type ReplayOutcome,
} from '../src/pkg-ai/ai/server-chat-replay'
import {
  serverHasMoreFromPage,
  mergeHistoryRows,
  decideLoadMore,
  deleteServerConversation,
  availableFilterTypes,
  resolveActiveFilter,
  type HistoryItem,
} from '../src/pkg-ai/ai/history'
import type { ConversationMessage, GetMessagesResult } from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'

/** 造一条服务端消息行(只用 Partial 覆盖差异位) */
function msg(over: Partial<ConversationMessage> & { role: string; content: string }) {
  return {
    id: 'm-1',
    conversationId: 'c-1',
    tokens: null,
    metadata: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    ...over,
  } as unknown as ConversationMessage
}

function okResult(messages: unknown): ApiResult<GetMessagesResult> {
  return {
    success: true,
    data: { messages, page: 1, pageSize: 100, total: 0, hasMore: false, nextCursor: null },
  } as unknown as ApiResult<GetMessagesResult>
}

/* ================================================================== *
 * ① 回放 —— 服务端会话消息
 * ================================================================== */

describe('① replayServerConversation 判序必须 fail-closed', () => {
  it('success:true + 数组 ⇒ 用服务端消息,时间戳与角色都落位', async () => {
    const out = await replayServerConversation({
      fetchMessages: async () =>
        okResult([msg({ role: 'user', content: '你好' }), msg({ role: 'assistant', content: '在的' })]),
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    expect(out.messages[1]?.content).toBe('在的')
    expect(out.messages[0]?.timestamp).toBe(Date.parse('2026-09-20T00:00:00.000Z'))
  })

  it('抛错(网络故障 / 5xx 走 fetchApi 的 HttpError)⇒ request-failed,不崩', async () => {
    const out = await replayServerConversation({
      fetchMessages: async () => {
        throw new Error('HttpError: 502')
      },
    })
    expect(out).toEqual({ ok: false, reason: 'request-failed' })
  })

  it('success:false(未登录 401 / 会话不属于本人 403)⇒ request-failed', async () => {
    const out = await replayServerConversation({
      fetchMessages: async (): Promise<ApiResult<GetMessagesResult>> =>
        ({ success: false, error: 'forbidden', status: 403 }) as unknown as ApiResult<GetMessagesResult>,
    })
    expect(out.ok).toBe(false)
  })

  it('success:true 但 messages 不是数组 ⇒ bad-payload(不把半截数据当"会话没有消息")', async () => {
    const out = await replayServerConversation({ fetchMessages: async () => okResult(null) })
    expect(out).toEqual({ ok: false, reason: 'bad-payload' })
  })

  it('真·空会话 ⇒ ok:true + 空数组 —— 与"取不到"必须是两个出口', async () => {
    const out: ReplayOutcome = await replayServerConversation({
      fetchMessages: async () => okResult([]),
    })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.messages).toEqual([])
  })

  it('system 角色与正文非字符串的行整条丢弃,其余照回放', async () => {
    const out = await replayServerConversation({
      fetchMessages: async () =>
        okResult([
          msg({ role: 'system', content: '系统提示词' }),
          msg({ role: 'user', content: undefined as unknown as string }),
          msg({ role: 'assistant', content: '正常回答' }),
        ]),
    })
    if (!out.ok) throw new Error('应当判成功')
    expect(out.messages).toHaveLength(1)
    expect(out.messages[0]?.content).toBe('正常回答')
  })

  it('reasoning 透传;空串 reasoning 不写字段(否则思考块会渲染成空壳)', () => {
    expect(mapServerMessage(msg({ role: 'assistant', content: 'a', reasoning: '想了想' }))?.reasoning)
      .toBe('想了想')
    expect(mapServerMessage(msg({ role: 'assistant', content: 'a', reasoning: '' }))?.reasoning)
      .toBeUndefined()
  })

  it('tokenCount 只给 assistant —— 用户消息带"消耗"是假数据', () => {
    expect(mapServerMessage(msg({ role: 'assistant', content: 'a', tokens: 123 }))?.tokenCount).toBe(123)
    expect(mapServerMessage(msg({ role: 'user', content: 'a', tokens: 123 }))?.tokenCount).toBeUndefined()
  })
})

describe('①b 卡片族的逆向读数(回放不能只剩正文)', () => {
  it('落库 toolName/success 适配成端内 name/done,脏项逐条剔除而不整表作废', () => {
    const row = mapServerMessage(
      msg({
        role: 'assistant',
        content: '我读了文件',
        metadata: {
          toolCalls: [
            { id: 't1', toolName: 'read_file', args: { path: 'a.ts' }, result: 'ok', status: 'success', durationMs: 12 },
            { toolName: '缺 id 的脏项', status: 'success' },
            { id: 't3', status: 'success' },
          ],
        } as never,
      }),
    )
    expect(row?.aiCards?.toolCalls).toEqual([
      { id: 't1', name: 'read_file', status: 'done', durationMs: 12, args: { path: 'a.ts' }, result: 'ok' },
    ])
  })

  it('终端任务的 truncated/totalChars 必须带回 —— 丢了标志就是把截断当完整', () => {
    const row = mapServerMessage(
      msg({
        role: 'assistant',
        content: '跑完了',
        metadata: {
          terminalTasks: [
            { id: 'x1', command: 'pnpm test', status: 'completed', output: '…', truncated: true, totalChars: 90000, exitCode: 0 },
          ],
        } as never,
      }),
    )
    expect(row?.aiCards?.terminalTasks?.[0]).toMatchObject({
      truncated: true,
      totalChars: 90000,
      exitCode: 0,
    })
  })

  it('五族卡片全空 ⇒ 不挂 aiCards(挂了就是给渲染层造一个空执行过程区)', () => {
    const row = mapServerMessage(msg({ role: 'assistant', content: '只有正文' }))
    expect(row).not.toHaveProperty('aiCards')
    const emptyArrays = mapServerMessage(
      msg({ role: 'assistant', content: 'a', metadata: { toolCalls: [] } } as never),
    )
    expect(emptyArrays).not.toHaveProperty('aiCards')
  })

  it('引用缺 url 就不带 url(不造点不动的假链接)', () => {
    const row = mapServerMessage(
      msg({
        role: 'assistant',
        content: 'a',
        metadata: { citations: [{ source: 'doc', label: '文档' }, { source: 'web', label: '网页', url: 'https://x' }] } as never,
      }),
    )
    expect(row?.aiCards?.citations).toEqual([
      { source: 'doc', label: '文档' },
      { source: 'web', label: '网页', url: 'https://x' },
    ])
  })

  it('metadata.steerApplied 由共享出口回填(与本机快照恢复路径同一个函数)', async () => {
    const out = await replayServerConversation({
      fetchMessages: async () =>
        okResult([
          msg({
            role: 'assistant',
            content: 'a',
            metadata: { steerApplied: [{ text: '顺便看下 tests' }] } as never,
          }),
        ]),
    })
    if (!out.ok) throw new Error('应当判成功')
    expect(out.messages[0]?.aiCards?.steerNotices).toEqual([
      { phase: 'injected', text: '顺便看下 tests' },
    ])
  })
})

/* ================================================================== *
 * ② 删除 —— 服务端来源下的删除判序
 * ================================================================== */

describe('② deleteServerConversation 三条同时成立才算删掉', () => {
  it('不抛 ∧ success:true ∧ deleted:true ⇒ ok', async () => {
    const out = await deleteServerConversation({
      remove: async () => ({ success: true, data: { deleted: true } }) as ApiResult<{ deleted: boolean }>,
    })
    expect(out.ok).toBe(true)
  })

  it('success:false ⇒ 不算删掉(失败要能触发列表回滚)', async () => {
    const out = await deleteServerConversation({
      remove: async () => ({ success: false, error: 'forbidden', status: 403 }) as ApiResult<{ deleted: boolean }>,
    })
    expect(out.ok).toBe(false)
  })

  it('success:true 但 deleted 不是 true ⇒ 不算删掉(后端回了别的载荷不能当成功)', async () => {
    const out = await deleteServerConversation({
      remove: async () => ({ success: true, data: { deleted: false } }) as ApiResult<{ deleted: boolean }>,
    })
    expect(out.ok).toBe(false)
  })

  it('抛错 ⇒ 不算删掉且不冒泡到调用方', async () => {
    const out = await deleteServerConversation({
      remove: async () => {
        throw new Error('offline')
      },
    })
    expect(out.ok).toBe(false)
  })
})

/* ================================================================== *
 * ③ 续页 —— 服务端翻页判据
 * ================================================================== */

describe('③ serverHasMoreFromPage', () => {
  it('total 是权威:未取满 total 才算还有', () => {
    expect(serverHasMoreFromPage(50, 120)).toBe(true)
    expect(serverHasMoreFromPage(120, 120)).toBe(false)
    expect(serverHasMoreFromPage(121, 120)).toBe(false)
  })

  it('total 缺失 ⇒ 按满页保守判"可能还有"(宁可多问一次,绝不少问)', () => {
    expect(serverHasMoreFromPage(50, undefined)).toBe(true)
    expect(serverHasMoreFromPage(12, undefined)).toBe(false)
    expect(serverHasMoreFromPage(50, 'NaN-ish')).toBe(true)
  })
})

function row(id: string): HistoryItem {
  return { id, title: id, time: '', messages: [] }
}

describe('③ mergeHistoryRows —— 翻页重叠不得长出双胞胎', () => {
  it('已有 id 再来一遍就跳过,新行接在后面', () => {
    const merged = mergeHistoryRows([row('a'), row('b')], [row('b'), row('c')])
    expect(merged.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })

  it('整页都是重复 ⇒ 列表一字不变(此时 total 若也说满了,hasMore 才会关)', () => {
    const prev = [row('a')]
    expect(mergeHistoryRows(prev, [row('a')]).map((x) => x.id)).toEqual(['a'])
  })
})

describe('③ decideLoadMore —— 先手侧、再服务端、最后才收口', () => {
  const base = {
    hasMore: true,
    loadingMore: false,
    source: 'server' as const,
    serverHasMore: true,
    shownCount: 20,
    filteredCount: 50,
  }

  it('本侧还有没展示完的行 ⇒ 只推进展示页,不打接口', () => {
    expect(decideLoadMore(base)).toBe('advance-page')
  })

  it('本侧展示完 + 服务端还有 ⇒ 去取下一页', () => {
    expect(decideLoadMore({ ...base, shownCount: 50 })).toBe('fetch-server')
  })

  it('两头都没有 ⇒ finish(这里才落「没有更多了」)', () => {
    expect(decideLoadMore({ ...base, shownCount: 50, serverHasMore: false })).toBe('finish')
  })

  it('兜底态(source=local)结构上不去打服务端 —— 本机快照没有下一页', () => {
    expect(decideLoadMore({ ...base, shownCount: 50, source: 'local' })).toBe('finish')
  })

  it('在途/已收口一律 noop,防一次上拉并发打两页', () => {
    expect(decideLoadMore({ ...base, shownCount: 50, loadingMore: true })).toBe('noop')
    expect(decideLoadMore({ ...base, hasMore: false })).toBe('noop')
  })
})

/* ================================================================== *
 * ④ 源码级反向锁:不另起炉灶 / 不直连后端 / 兜底不得静默
 * ================================================================== */

describe('④ 源码级反向锁', () => {
  const replaySrc = readFileSync(
    resolve(__dirname, '../src/pkg-ai/ai/server-chat-replay.ts'),
    'utf8',
  )
  const chatSrc = readFileSync(resolve(__dirname, '../src/pkg-ai/ai/chat.tsx'), 'utf8')
  const historySrc = readFileSync(resolve(__dirname, '../src/pkg-ai/ai/history.tsx'), 'utf8')

  it('三个文件都不得绕过 api-client 直连后端(守门 73 的本地预锁)', () => {
    for (const text of [replaySrc, chatSrc, historySrc]) {
      expect(text).not.toMatch(/Taro\.request\(/)
      expect(text).not.toMatch(/\bfetch\(/)
      expect(text).not.toMatch(/XMLHttpRequest/)
    }
    expect(chatSrc).toContain('getMessages(')
    expect(historySrc).toContain('deleteConversation(')
  })

  it('steer 回填只有一个出口 —— 回放路径不得自写第二份 steerApplied 读法', () => {
    expect(replaySrc).toContain('backfillSteerNoticesFromMetadata(')
    expect(replaySrc).not.toMatch(/steerApplied\s*\]|\bsplit\(/)
  })

  it('回放失败必须走可见出口,不得静默留在空态', () => {
    expect(chatSrc).toMatch(/runServerReplay[\s\S]{0,900}Taro\.showModal\(/)
    expect(chatSrc).toContain("t('ai.chat.replayFailed')")
  })

  it('删除失败必须回滚列表(出现 setList(snapshot) 才叫回滚,不是只 toast)', () => {
    expect(historySrc).toMatch(/setList\(snapshot\)[\s\S]{0,200}deleteFailed/)
  })

  it('页面内仍只有一处 .sort( —— 续页没顺手引入第二份排序', () => {
    expect(historySrc.match(/\.sort\(/g) ?? []).toHaveLength(1)
  })
})

/* ================================================================== *
 * ④ 筛选芯片由数据派生 —— image/voice/agent 从无任何写入方
 * (服务端 chat_messages 无类型列,本机快照写入也不设 type),
 * 恒空芯片是死 UI;芯片必须只随真实存在的类型出现,失效筛选回落『全部』。
 * ================================================================== */

describe('④ availableFilterTypes —— 芯片只随真实数据出现', () => {
  it('服务端行(无 type)⇒ 只有 all/chat 两枚,image/voice/agent 不得渲染', () => {
    const rows = [{ id: 'a' }, { id: 'b' }] as unknown as Array<{ type?: HistoryItem['type'] }>
    const got = availableFilterTypes(rows)
    expect(got.has('all')).toBe(true)
    expect(got.has('chat')).toBe(true)
    expect(got.has('image')).toBe(false)
    expect(got.has('voice')).toBe(false)
    expect(got.has('agent')).toBe(false)
  })

  it('快照条目带 type:image ⇒ image 芯片出现(将来有写入方时自动回归)', () => {
    const rows = [{ id: 'a', type: 'image' }, { id: 'b' }] as unknown as Array<{
      type?: HistoryItem['type']
    }>
    expect(availableFilterTypes(rows).has('image')).toBe(true)
  })

  it('反向:没有任何行带 voice ⇒ voice 不在集内(不许凭空给芯片)', () => {
    const rows = [{ id: 'a', type: 'image' }] as unknown as Array<{ type?: HistoryItem['type'] }>
    expect(availableFilterTypes(rows).has('voice')).toBe(false)
  })

  it('非数组入参安全回落 {all,chat};入参不被改写', () => {
    expect(availableFilterTypes(undefined as unknown as Array<{ type?: HistoryItem['type'] }>).has('chat')).toBe(true)
    const src = [{ id: 'a', type: 'agent' }] as unknown as Array<{ type?: HistoryItem['type'] }>
    availableFilterTypes(src)
    expect(src).toEqual([{ id: 'a', type: 'agent' }])
  })
})

describe('④ resolveActiveFilter —— 失效筛选回落『全部』,不渲染空列表', () => {
  const base = new Set<FilterTypeAlias>(['all', 'chat'])
  it('数据重载后 image 已不存在 ⇒ 活跃筛选回落 all', () => {
    expect(resolveActiveFilter('image', base)).toBe('all')
  })
  it('正向:类型仍在集内 ⇒ 保持原筛选(不得偷偷重置)', () => {
    expect(resolveActiveFilter('image', new Set<FilterTypeAlias>(['all', 'chat', 'image']))).toBe('image')
    expect(resolveActiveFilter('all', base)).toBe('all')
  })
})

type FilterTypeAlias = Parameters<typeof resolveActiveFilter>[0]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
