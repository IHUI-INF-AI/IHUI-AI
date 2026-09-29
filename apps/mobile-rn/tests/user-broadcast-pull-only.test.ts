// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D153b / D154(2026-09-30 立)—— App(RN)端接 per-user 广播的验收面。
 *
 * 与小程序端同一四条(票 V4 §11.3 D153 第 6 栏 ①②③ + "端内不得有第二份事件名清单"):
 *  ① 注入一帧 ⇒ 账本值变且**数据面 HTTP 计数为 0**;
 *  ② 缺 `changedBy` ⇒ 整帧拒收,账本不改、不喊"已同步";
 *  ③ 结构判据:端内源文件不得并置两个事件名成清单,也不得自建 WebSocket / 自 parse 帧;
 *  ④ 反向对照:摘掉订阅接线 ⇒ ① 的断言不成立(证明测的是推送,不是轮询副作用)。
 *  ⑤ RN 措辞:pullOnly 那句话不得把"小程序端"烘进 App 语包(票第 3 栏要求措辞属于这一端)。
 *  ⑥ 广播链路不得新立 UI 面:lib / hook 两层不 import FloatBox,而挂载层确实把本端已有的
 *    FloatBox 提示口接了进来(票第 2 栏「提示出口复用该端已有机制」)。
 *
 * 关于本文件顶上那条 `vi.mock('@ihui/types', …)`:本端 vitest 把 `@ihui/types` 别名指到
 * `tests/__mocks__/ihui-types.ts`,而那份替身只有 device-fingerprint 用的几个名字,
 * 没有任何广播符号(`conversationUpdatedEvent` / `mcpStatusEvent` / `parseUserBroadcastFrame` /
 * `isNewerThan` / `isMcpConnectionState`)。照现状跑,本用例测的是虚构 API
 * (与同配置文件里 sso-core / auth / api-client 三条收口记录同一型)。
 * 处置:**只在本用例内**把 '@ihui/types' 指回真实源码,不动端级别名 ——
 * 改别名会影响 mobile-rn 全部套件,那属该配置持有者的一票(已登记进交付报告)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ihui/types', async () => {
  const mod = await import('../../../packages/types/src/index')
  return { default: mod, ...mod }
})

import { feedUserBroadcastFrame, resetUserBroadcastHub } from '@ihui/api-client'
import {
  conversationUpdatedEvent,
  mcpStatusEvent,
  toUserBroadcastFrame,
} from '@ihui/types'
import { conversationMetaLedger, mcpStatusLedger } from '@ihui/shared/chat'

import {
  attachUserBroadcast,
  resetBroadcastNotices,
  type UserBroadcastAdapterDeps,
} from '../src/lib/user-broadcast'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'http://localhost:8802'
const CONVERSATION_ID = 'conv-rn-1'

/** 端内接线面(判结构 + 判措辞用) */
const END_SOURCE_FILES = [
  join(HERE, '../src/lib/user-broadcast.ts'),
  join(HERE, '../src/hooks/use-user-broadcast-sync.ts'),
  join(HERE, '../src/screens/ChatScreen.tsx'),
]

function translate(key: string, params?: Record<string, string | number>): string {
  return params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`
}

const throwingSocketFactory = (): never => {
  throw new Error('test: no socket in vitest env')
}

function makeDeps(
  overrides: Partial<UserBroadcastAdapterDeps> = {},
): UserBroadcastAdapterDeps & { notices: string[]; undetermined: unknown[] } {
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

function updatedFrame(title: string, at = '2026-09-30T08:00:00.000Z') {
  return toUserBroadcastFrame(
    conversationUpdatedEvent({
      conversationId: CONVERSATION_ID,
      fields: ['title'],
      changedBy: 'user-elsewhere',
      at,
      values: { title },
    }),
  )
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

describe('D153b RN:conversation:updated → 抽屉行值变 + pullOnly 明示', () => {
  it('① 注入一帧 ⇒ 账本值变且数据面 HTTP 请求计数为 0', () => {
    conversationMetaLedger.remember([CONVERSATION_ID])
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    expect(sub).not.toBeNull()

    expect(
      feedUserBroadcastFrame(updatedFrame('另一端改的新标题'), { baseUrl: BASE_URL }),
    ).not.toBeNull()
    expect(conversationMetaLedger.titleFor(CONVERSATION_ID, '旧标题')).toBe('另一端改的新标题')
    expect(deps.notices).toEqual(['«chat.meta.pullOnly»'])

    // 换票(/ws/ticket)属连接面,不计入"再拉一次数据"这条判据
    const dataPlane = fetchCalls.filter((url) => !url.endsWith('/ws/ticket'))
    expect(dataPlane).toEqual([])
    expect(fetchCalls.length).toBeLessThanOrEqual(1)

    sub?.close()
  })

  it('② 缺 changedBy 的帧整帧拒收:账本一字不改,也不喊"已同步"', () => {
    conversationMetaLedger.remember([CONVERSATION_ID])
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    expect(
      feedUserBroadcastFrame(
        {
          event: 'conversation:updated',
          data: {
            conversationId: CONVERSATION_ID,
            fields: ['title'],
            at: '2026-09-30T08:00:00.000Z',
            values: { title: '不该被应用的标题' },
          },
        },
        { baseUrl: BASE_URL },
      ),
    ).toBeNull()
    expect(conversationMetaLedger.titleFor(CONVERSATION_ID, '旧标题')).toBe('旧标题')
    expect(deps.notices).toEqual([])
    expect(deps.undetermined).toHaveLength(1)
    sub?.close()
  })

  it('④ 反向对照:摘掉订阅接线后喂同一帧 ⇒ ① 的断言不成立', () => {
    conversationMetaLedger.remember([CONVERSATION_ID])
    expect(
      feedUserBroadcastFrame(updatedFrame('另一端改的新标题'), { baseUrl: BASE_URL }),
    ).toBeNull()
    expect(conversationMetaLedger.titleFor(CONVERSATION_ID, '旧标题')).toBe('旧标题')

    const libSource = readFileSync(join(HERE, '../src/lib/user-broadcast.ts'), 'utf8')
    expect(libSource).toContain('subscribeUserBroadcast(')
  })
})

describe('D154 RN:mcp:status → 状态行 + 桌面端管理提示', () => {
  it('failed 帧 ⇒ 状态行取词键 + mobileSettingsHint 一起说,并落进账本', () => {
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    expect(
      feedUserBroadcastFrame(
        toUserBroadcastFrame(mcpStatusEvent({ server: 'github', state: 'failed' })),
        { baseUrl: BASE_URL },
      ),
    ).not.toBeNull()
    const rows = mcpStatusLedger.snapshot()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.state).toBe('failed')
    expect(deps.notices[0]).toContain('«chat.mcp.state.failed»')
    expect(deps.notices[0]).toContain('«chat.mcp.mobileSettingsHint»')
    sub?.close()
  })

  it('connected 帧 ⇒ 该行被摘掉且不说任何话(连上不是要提示的事)', () => {
    const deps = makeDeps()
    const sub = attachUserBroadcast(deps)
    feedUserBroadcastFrame(
      toUserBroadcastFrame(mcpStatusEvent({ server: 'github', state: 'connecting' })),
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
})

describe('结构纪律(RN 端)', () => {
  it('③ 端内不得并置事件名成清单 / 不得自建 WebSocket / 不得自 parse 帧', () => {
    for (const file of END_SOURCE_FILES) {
      const source = readFileSync(file, 'utf8')
      const hasBothNames = source.includes('conversation:updated') && source.includes('mcp:status')
      if (hasBothNames) {
        expect(/\[[^\]]*'conversation:updated'[^\]]*'mcp:status'/.test(source)).toBe(false)
        expect(/new\s+Set\s*\(\s*\[[^\]]*'conversation:updated'[^\]]*'mcp:status'/.test(source)).toBe(
          false,
        )
      }
      expect(source).not.toMatch(/USER_BROADCAST_(EVENT_NAMES|SUBSCRIBABLE_EVENTS)\s*=/)
      expect(source).not.toMatch(/===?\s*['"](conversation:updated|mcp:status)['"]/)
      expect(source).not.toMatch(/new\s+WebSocket\s*\(/)
      expect(source).not.toMatch(/parseUserBroadcastFrame\s*\(/)
    }
  })

  it('⑥ 广播链路不得新立 UI 面:lib / hook 两层都不 import FloatBox(提示口由调用方注入)', () => {
    for (const file of [END_SOURCE_FILES[0] as string, END_SOURCE_FILES[1] as string]) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/from\s+['"][^'"]*FloatBox['"]/)
    }
    // 而挂载层确实把本端已有的 FloatBox 提示口接了进来(不是空实现)
    const screen = readFileSync(END_SOURCE_FILES[2] as string, 'utf8')
    expect(screen).toContain("showToast('info', message)")
  })

  it('⑤ App 语包的 pullOnly 不得写"小程序"(措辞必须属于这一端)', () => {
    for (const locale of ['zh-CN', 'zh-TW'] as const) {
      const pack = JSON.parse(
        readFileSync(join(HERE, '../../../packages/i18n/messages/mobile-rn', `${locale}.json`), 'utf8'),
      ) as { chat?: { meta?: { pullOnly?: string } } }
      const text = pack.chat?.meta?.pullOnly ?? ''
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toContain('小程序')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
