// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D153b / D154(2026-09-30 立)—— 小程序端接 per-user 广播的验收面。
 *
 * 四条用例对应票 V4 §11.3 D153 第 6 栏的三条判据与"不得有第二份事件名清单"这一型:
 *  ① 注入一帧 ⇒ 账本/列表值变,且**数据面 HTTP 请求计数为 0**(票面验收①:
 *     "B 端不发 HTTP 请求即更新",不是"收到推送后再 GET 一次");
 *  ② 缺 `changedBy` ⇒ 整帧被共享层 parse 拒收,账本一个字都不改(票面验收③);
 *  ③ 端内不得出现第二份事件名清单(判结构:扫源码,不是扫运行时);
 *  ④ 反向对照:**摘掉订阅接线**后喂同一帧 ⇒ ① 的断言必不成立
 *     —— 证明测的是推送,不是轮询副作用(票面验收②的同型)。
 *
 * 用例只驱动 `src/lib/user-broadcast`(接线本体),不 import Taro / 端内 store:
 * 那两层是挂载点(showToast / 登录态),在 node 环境下 import 即触平台 API。
 * 判据本体(账本、以库为准、取词)住在 @ihui/shared/chat,两端共用同一份。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  feedUserBroadcastFrame,
  getUserBroadcastHubStats,
  resetUserBroadcastHub,
} from '@ihui/api-client'
import {
  conversationUpdatedEvent,
  mcpStatusEvent,
  toUserBroadcastFrame,
  type ConversationUpdatedEvent,
} from '@ihui/types'
import { conversationMetaLedger, mcpStatusLedger } from '@ihui/shared/chat'

import {
  attachUserBroadcast,
  buildTaroBroadcastWsUrl,
  resetBroadcastNotices,
  type UserBroadcastAdapterDeps,
} from '@/lib/user-broadcast'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'https://aizhs.top/api'
const CONVERSATION_ID = 'conv-1'
const PULL_ONLY_TEXT = '«chat.meta.pullOnly»'

/** 端内接线面(判结构用):这些文件里出现事件名字面量的位置必须是 handler 键,不得成清单 */
const END_SOURCE_FILES = [
  join(HERE, '../src/lib/user-broadcast.ts'),
  join(HERE, '../src/hooks/use-user-broadcast-sync.ts'),
  join(HERE, '../src/pkg-ai/ai/history.tsx'),
]

function translate(key: string, params?: Record<string, string | number>): string {
  return params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`
}

/** 假 WS 工厂:一建连就抛 ⇒ 共享层按既有守卫 onError 收场,用例不依赖任何真实 socket */
const throwingSocketFactory = (): never => {
  throw new Error('test: no socket in node env')
}

function makeDeps(overrides: Partial<UserBroadcastAdapterDeps> = {}): UserBroadcastAdapterDeps & {
  notices: string[]
  undetermined: unknown[]
} {
  const notices: string[] = []
  const undetermined: unknown[] = []
  return {
    notices,
    undetermined,
    baseUrl: BASE_URL,
    token: 'test-access-token',
    translate,
    notify: (message: string) => {
      notices.push(message)
    },
    webSocketFactory: throwingSocketFactory,
    onUndetermined: (raw: unknown) => {
      undetermined.push(raw)
    },
    ...overrides,
  }
}

function updatedFrame(
  title: string,
  at = '2026-09-30T08:00:00.000Z',
): ReturnType<typeof toUserBroadcastFrame> {
  const evt = conversationUpdatedEvent({
    conversationId: CONVERSATION_ID,
    fields: ['title'],
    changedBy: 'user-elsewhere',
    at,
    values: { title },
  })
  return toUserBroadcastFrame(evt)
}

let fetchCalls: string[] = []

beforeEach(() => {
  fetchCalls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown) => {
      fetchCalls.push(String(typeof input === 'string' ? input : (input as { url?: string })?.url))
      throw new Error('test: network disabled')
    }),
  )
  resetUserBroadcastHub()
  conversationMetaLedger.clear()
  mcpStatusLedger.clear()
  resetBroadcastNotices()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('D153b 小程序端:conversation:updated → 就地改值 + pullOnly 明示', () => {
  it('① 注入一帧 ⇒ 列表值变且数据面 HTTP 请求计数为 0', () => {
    // 本端已加载的会话(页面加载后交进账本)—— 这就是 history.tsx 里那份行集的形状
    conversationMetaLedger.remember([CONVERSATION_ID])
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    expect(sub).not.toBeNull()

    const applied = feedUserBroadcastFrame(updatedFrame('另一端改的新标题'), { baseUrl: BASE_URL })
    expect(applied).not.toBeNull()

    // 列表值真的变了(不是"收到了但没应用")
    expect(conversationMetaLedger.titleFor(CONVERSATION_ID, '旧标题')).toBe('另一端改的新标题')
    // 且界面拿到的是这一句明示,而不是"已同步"的假话
    expect(deps.notices).toEqual([PULL_ONLY_TEXT])

    // 数据面一条 HTTP 都没有:换票(/ws/ticket)属连接面,不计入本判据 —— 票面验收①
    // 说的是"不再拉一次数据",不是"不许握手"
    const dataPlane = fetchCalls.filter((url) => !url.endsWith('/ws/ticket'))
    expect(dataPlane).toEqual([])
    expect(fetchCalls.length).toBeLessThanOrEqual(1)

    sub?.close()
  })

  it('② 缺 changedBy 的帧整帧拒收:账本一字不改,也不喊"已同步"', () => {
    conversationMetaLedger.remember([CONVERSATION_ID])
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    expect(sub).not.toBeNull()

    // 票面验收③:changedBy 是消费端区分回声/别人改的唯一凭据 ⇒ parse 层必须拒整帧,
    // 而不是当成"不知道谁改的"照用(那会把生产面的 bug 洗成用户可见的沉默分叉)
    const withoutChangedBy = {
      event: 'conversation:updated',
      data: {
        conversationId: CONVERSATION_ID,
        fields: ['title'],
        at: '2026-09-30T08:00:00.000Z',
        values: { title: '不该被应用的标题' },
      },
    }
    expect(feedUserBroadcastFrame(withoutChangedBy, { baseUrl: BASE_URL })).toBeNull()
    expect(conversationMetaLedger.titleFor(CONVERSATION_ID, '旧标题')).toBe('旧标题')
    expect(deps.notices).toEqual([])
    // 拒收不等于静默丢弃:这一格必须被点名(未判定计数)
    expect(deps.undetermined).toHaveLength(1)

    sub?.close()
  })

  it('④ 反向对照:摘掉订阅接线后喂同一帧 ⇒ ① 的断言不成立(证明测的是推送)', () => {
    conversationMetaLedger.remember([CONVERSATION_ID])
    // 刻意不调 attachUserBroadcast —— 与"把 handler 摘掉"是同一状态
    const evt: ConversationUpdatedEvent | null = feedUserBroadcastFrame(
      updatedFrame('另一端改的新标题'),
      { baseUrl: BASE_URL },
    ) as ConversationUpdatedEvent | null
    expect(evt).toBeNull()
    // 上面那条正是 ① 的第一号断言的反面:值没变 ⇒ ① 会红
    expect(conversationMetaLedger.titleFor(CONVERSATION_ID, '旧标题')).toBe('旧标题')

    // 装车证明:接线确实经由共享出口,端内没有第二条连接实现
    const libSource = readFileSync(join(HERE, '../src/lib/user-broadcast.ts'), 'utf8')
    expect(libSource).toContain('subscribeUserBroadcast(')
  })

  it('账本只覆盖"本端已知的行":未加载的会话报 known:false,不凭空长一行', () => {
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    conversationMetaLedger.remember(['some-other-conversation'])

    feedUserBroadcastFrame(updatedFrame('标题'), { baseUrl: BASE_URL })
    // 本端没有这一行 ⇒ 不新增(新增就是把"没同步"读成"已同步")
    expect(conversationMetaLedger.get(CONVERSATION_ID)).toBeUndefined()
    // 而 pullOnly 仍然要喊 —— 它说的就是"这一端下次打开才对上"
    expect(deps.notices).toEqual([PULL_ONLY_TEXT])
    sub?.close()
  })
})

describe('D154 小程序端:mcp:status → 状态行 + 桌面端管理提示', () => {
  it('failed 帧 ⇒ 状态行取词键 + mobileSettingsHint,两句话一起说', () => {
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)

    const frame = toUserBroadcastFrame(
      mcpStatusEvent({ server: 'github', state: 'failed', reason: 'stdio exited' }),
    )
    expect(feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })).not.toBeNull()

    const rows = mcpStatusLedger.snapshot()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.server).toBe('github')
    expect(rows[0]?.state).toBe('failed')
    expect(deps.notices).toHaveLength(1)
    expect(deps.notices[0]).toContain('«chat.mcp.state.failed»')
    expect(deps.notices[0]).toContain('«chat.mcp.mobileSettingsHint»')

    sub?.close()
  })

  it('reconnecting 帧带 attempt/maxAttempts ⇒ 取词必须有分子也要分母', () => {
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    const frame = toUserBroadcastFrame(
      mcpStatusEvent({ server: 'fs', state: 'reconnecting', attempt: 2, maxAttempts: 5 }),
    )
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
    expect(deps.notices[0]).toContain(
      '«chat.mcp.state.reconnecting»({"server":"fs","attempt":2,"maxAttempts":5})',
    )
    sub?.close()
  })

  it('connected 帧 ⇒ 该行被摘掉且不说话(连上不是要提示的事)', () => {
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    feedUserBroadcastFrame(
      toUserBroadcastFrame(mcpStatusEvent({ server: 'github', state: 'failed' })),
      { baseUrl: BASE_URL },
    )
    deps.notices.length = 0
    feedUserBroadcastFrame(
      toUserBroadcastFrame(mcpStatusEvent({ server: 'github', state: 'connected' })),
      { baseUrl: BASE_URL },
    )
    expect(mcpStatusLedger.snapshot()).toHaveLength(0)
    expect(deps.notices).toEqual([])
    sub?.close()
  })

  it('同一 (server,state,attempt) 只喊一次:重连风暴不得刷屏', () => {
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    const frame = toUserBroadcastFrame(mcpStatusEvent({ server: 'x', state: 'connecting' }))
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
    expect(deps.notices).toHaveLength(1)
    sub?.close()
  })
})

describe('结构纪律:端内不得出现第二份事件名清单', () => {
  const CONVERSATION_EVENT = 'conversation:updated'
  const MCP_EVENT = 'mcp:status'

  it('③ 端内源文件里没有把两个事件名列成数组/Set 的清单,且每个名字只以 handler 键出现', () => {
    for (const file of END_SOURCE_FILES) {
      const source = readFileSync(file, 'utf8')
      const hasBothNames = source.includes(CONVERSATION_EVENT) && source.includes(MCP_EVENT)
      // 清单形态 = 两个名字并置在同一个数组/Set 字面量里。
      // handler 键形态(`{ 'conversation:updated': fn }`)是共享出口的入参形状,不是清单,放过。
      const inSameArray = /\[[^\]]*'conversation:updated'[^\]]*'mcp:status'/.test(source)
      const inSameSet = /new\s+Set\s*\(\s*\[[^\]]*'conversation:updated'[^\]]*'mcp:status'/.test(source)
      if (hasBothNames) {
        expect(inSameArray).toBe(false)
        expect(inSameSet).toBe(false)
      }
      // 也不得重新声明共享层那张表的名字(第二份真相的最短路径)
      expect(source).not.toMatch(/USER_BROADCAST_(EVENT_NAMES|SUBSCRIBABLE_EVENTS)\s*=/)
      // 事件名不得出现在「=== / == 比较」位置(那是在端内自己判名字,等于第二份清单的消费端)
      const bareComparisons = source.match(/===?\s*['"](conversation:updated|mcp:status)['"]/g) ?? []
      expect(bareComparisons).toEqual([])
    }
  })

  it('端内不得自建 WebSocket / 不得自己解析帧(必须经共享出口)', () => {
    for (const file of END_SOURCE_FILES) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/new\s+WebSocket\s*\(/)
      expect(source).not.toMatch(/Taro\.connectSocket\s*\(/)
      // 页面侧不得再写一份 parse(共享层 parseUserBroadcastFrame 是唯一判据)
      expect(source).not.toMatch(/parseUserBroadcastFrame\s*\(/)
    }
  })
})

describe('URL 推导:绕开 WHATWG URL(JSCore 不保证在位)', () => {
  it('https → wss 并剥掉 /api 前缀;相对基址返回空串(据此不建连)', () => {
    expect(buildTaroBroadcastWsUrl('https://aizhs.top/api', 't+1')).toBe(
      'wss://aizhs.top/ws/broadcast?token=t%2B1',
    )
    expect(buildTaroBroadcastWsUrl('http://localhost:8802/api', 't')).toBe(
      'ws://localhost:8802/ws/broadcast?token=t',
    )
    // H5 dev 的相对基址推不出 host ⇒ '' ⇒ attachUserBroadcast 必须拒绝建连
    expect(buildTaroBroadcastWsUrl('/api', 't')).toBe('')
  })

  it('推不出地址时 attach 返回 null,而不是"假装已订阅"', () => {
    const deps = makeDeps({ baseUrl: '/api' })
    expect(attachUserBroadcast(deps)).toBeNull()
    expect(getUserBroadcastHubStats()).toHaveLength(0)
  })

  it('没有 token 时一条连接都不建(未登录不得挂着连接)', () => {
    const deps = makeDeps({ token: null })
    expect(attachUserBroadcast(deps)).toBeNull()
    expect(getUserBroadcastHubStats()).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
