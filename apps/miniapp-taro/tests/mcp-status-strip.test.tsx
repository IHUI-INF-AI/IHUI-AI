// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D154(2026-10-01)小程序端 MCP 状态行**渲染面**验收。
 *
 * 本票补的是上一手报告 §一 表里唯一那行 ❌:`mcpStatusLedger.snapshot()` 生产面零渲染点,
 * 状态只以一次性 toast 出现。四条用例:
 *  ① 喂一帧 `mcp:status(state=failed)` ⇒ 渲染出的 DOM 里**同时**出现状态行与
 *     「桌面端管理提示」(票面 §5/§8③ 的"两端至少显示状态行 + 管理提示");
 *  ② 同 server 同 state 的重复帧 ⇒ 只渲一条(去重发生在账本层,渲染层不得再数一遍);
 *  ③ 装车证明 + 反向对照:`<McpStatusStrip />` 必须真的挂在 chat.tsx 的渲染树里 ——
 *     摘掉渲染点 ⇒ 本条必红(与守门 64/70/115/138 的"造好没装车"同族;只判组件存在
 *     等于没有判,因为组件可以永远不被任何人 import);
 *  ④ 结构纪律:端内不得出现第二份 state→词表键 的表(`chat.mcp.state.*` 字面量),
 *     也不得自建连接。
 *
 * 取证边界(如实):本机 8801/8802 无服务,微信端也无法在本机渲染 ⇒
 * 本文件证的是**静态渲染输出**(renderToStaticMarkup)与源码结构,**不是**"真机已渲染"。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return { View: make('div'), Text: make('span'), Image: make('img') }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`,
    tList: () => [],
    locale: 'zh-CN',
    setLocale: () => {},
  }),
}))

vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { mcpStatusEvent, toUserBroadcastFrame } from '@ihui/types'
import { feedUserBroadcastFrame, resetUserBroadcastHub } from '@ihui/api-client'
import { mcpStatusLedger } from '@ihui/shared/chat'

import McpStatusStrip, { deriveMcpStatusView } from '@/pkg-ai/ai/mcp-status-strip'
import { attachUserBroadcast, resetBroadcastNotices } from '@/lib/user-broadcast'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'https://aizhs.top/api'
const STRIP_SOURCE = join(HERE, '../src/pkg-ai/ai/mcp-status-strip.tsx')
const CHAT_SOURCE = join(HERE, '../src/pkg-ai/ai/chat.tsx')

function translate(key: string, params?: Record<string, string | number>): string {
  return params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`
}

const throwingSocketFactory = (): never => {
  throw new Error('test: no socket in node env')
}

function failedFrame(server = 'github') {
  return toUserBroadcastFrame(mcpStatusEvent({ server, state: 'failed', reason: 'stdio exited' }))
}

beforeEach(() => {
  resetUserBroadcastHub()
  mcpStatusLedger.clear()
  resetBroadcastNotices()
})

describe('D154 小程序端:MCP 状态行到屏幕', () => {
  it('① 喂一帧 failed ⇒ 渲染输出同时出现状态行与桌面端管理提示', () => {
    const sub = attachUserBroadcast({
      baseUrl: BASE_URL,
      token: 'test-access-token',
      translate,
      notify: () => {},
      webSocketFactory: throwingSocketFactory,
    })
    expect(sub).not.toBeNull()

    feedUserBroadcastFrame(failedFrame('github'), { baseUrl: BASE_URL })
    // 账本先有值(渲染层吃的就是这一份)
    expect(mcpStatusLedger.snapshot().map((r) => r.server)).toEqual(['github'])

    const html = renderToStaticMarkup(createElement(McpStatusStrip))
    expect(html).toContain('data-testid="mcp-status-strip"')
    // 静态标记会把文本里的 `"` 转义成 `&quot;`(JSON 参数串必带引号)⇒ 断言按转义后形态取,
    // 而不是"去掉引号只看键名"——那会把"根本没渲染这一行"也放过。
    expect(html).toContain('«chat.mcp.state.failed»({&quot;server&quot;:&quot;github&quot;})')
    expect(html).toContain('«chat.mcp.mobileSettingsHint»')
    sub?.close()
  })

  it('② 同 server 同 state 的重复帧 ⇒ 只渲一条(去重由账本保证)', () => {
    const sub = attachUserBroadcast({
      baseUrl: BASE_URL,
      token: 'test-access-token',
      translate,
      notify: () => {},
      webSocketFactory: throwingSocketFactory,
    })
    const frame = failedFrame('dup-server')
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })

    expect(mcpStatusLedger.snapshot()).toHaveLength(1)
    const html = renderToStaticMarkup(createElement(McpStatusStrip))
    expect(html.split('data-testid="mcp-status-line"')).toHaveLength(2) // 1 条线 ⇒ 2 段
    expect(html.split('«chat.mcp.state.failed»').length).toBe(2)
    sub?.close()
  })

  it('③ 装车证明:渲染点真的挂在 chat.tsx(摘掉渲染点本条必红)', () => {
    const chatSource = readFileSync(CHAT_SOURCE, 'utf8')
    expect(chatSource).toMatch(/import\s+McpStatusStrip\s+from\s+'\.\/mcp-status-strip'/)
    expect(chatSource).toMatch(/<McpStatusStrip\s*\/>/)
    // 组件本身必须真读共享账本,而不是自带一份状态
    const stripSource = readFileSync(STRIP_SOURCE, 'utf8')
    expect(stripSource).toMatch(/mcpStatusLedger\.subscribe\(/)
    expect(stripSource).toMatch(/mcpStatusLedger\.snapshot\(/)
  })

  it('④ 结构纪律:端内不得出现第二份 state→词表键 的表,也不得自建连接', () => {
    const stripSource = readFileSync(STRIP_SOURCE, 'utf8')
    expect(stripSource).not.toMatch(/chat\.mcp\.state\./)
    expect(stripSource).not.toMatch(/new\s+WebSocket\s*\(/)
    expect(stripSource).not.toMatch(/Taro\.connectSocket\s*\(/)
    expect(stripSource).not.toMatch(/parseUserBroadcastFrame\s*\(/)
    // 取词只用共享那一份出口
    expect(stripSource).toMatch(/mcpStatusMessage\(/)
    expect(stripSource).toMatch(/MCP_MOBILE_SETTINGS_HINT_KEY/)
  })

  it('空账本 ⇒ 整条不挂载(连上不是要提示的事,零占位)', () => {
    expect(mcpStatusLedger.snapshot()).toHaveLength(0)
    expect(renderToStaticMarkup(createElement(McpStatusStrip))).toBe('')
  })

  it('connected 帧 ⇒ 该行被摘掉,状态行随之消失(不是留个 connected 徽章)', () => {
    const sub = attachUserBroadcast({
      baseUrl: BASE_URL,
      token: 'test-access-token',
      translate,
      notify: () => {},
      webSocketFactory: throwingSocketFactory,
    })
    feedUserBroadcastFrame(failedFrame('github'), { baseUrl: BASE_URL })
    expect(renderToStaticMarkup(createElement(McpStatusStrip))).toContain('chat.mcp.state.failed')
    feedUserBroadcastFrame(
      toUserBroadcastFrame(mcpStatusEvent({ server: 'github', state: 'connected' })),
      { baseUrl: BASE_URL },
    )
    expect(mcpStatusLedger.snapshot()).toHaveLength(0)
    expect(renderToStaticMarkup(createElement(McpStatusStrip))).toBe('')
    sub?.close()
  })

  it('取不出文案的一档 ⇒ 不渲染空白行冒充"已显示",而是点名未判定', () => {
    const view = deriveMcpStatusView(
      [
        {
          server: 'weird',
          // 'connected' 永远不会进账本(apply 即摘行),这里直接喂派生层:
          // 它对应的就是"表里没有这句话"那一格
          state: 'connected',
          at: '2026-10-01T00:00:00.000Z',
        },
      ],
      translate,
    )
    expect(view.lines).toEqual([])
    expect(view.undeterminedServers).toEqual(['weird'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
