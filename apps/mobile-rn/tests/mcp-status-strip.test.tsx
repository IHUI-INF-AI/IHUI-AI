// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D154(2026-10-01)App(RN)端 MCP 状态行**渲染面**验收 —— 与小程序端
 * `apps/miniapp-taro/tests/mcp-status-strip.test.tsx` 同一组判据(一份账本、两个薄渲染点)。
 *
 * 四条用例:
 *  ① 喂一帧 `mcp:status(state=failed)` ⇒ 渲染输出同时出现状态行与桌面端管理提示;
 *  ② 同 server 同 state 的重复帧 ⇒ 只渲一条;
 *  ③ 装车证明:`<McpStatusStrip />` 真的挂在 ChatScreen 的渲染树里(摘掉渲染点 ⇒ 本条必红);
 *  ④ 结构纪律:端内不得重抄 state→词表键 的表、不得自建连接。
 *
 * 取证边界(如实):本机 8801/8802 无服务、RN 界面无法在本机真机渲染 ⇒
 * 本文件证的是 jsdom 下的渲染输出与源码结构,**不是**"真机已渲染"。
 * 注:React DOM 会丢弃 `testID` 这类未知属性(与 task-status-bar.test.tsx 同一备注),
 * 故断言走文本与结构,testID 语义只在真机生效。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('../src/i18n', () => {
  const t = (key: string, params?: Record<string, string | number>): string =>
    params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})

// 端级别名把 '@ihui/types' 指到 tests/__mocks__/ihui-types.ts,而那份替身没有广播符号
// (`mcpStatusEvent` 等)⇒ 照现状跑测的是虚构 API。与同目录 user-broadcast-pull-only.test.ts
// 同一处置:**只在本用例内**指回真实源码,不动端级别名(改别名影响全部套件,属该配置持有者的一票)。
vi.mock('@ihui/types', async () => {
  const mod = await import('../../../packages/types/src/index')
  return { default: mod, ...mod }
})

import { mcpStatusEvent, toUserBroadcastFrame } from '@ihui/types'
import { feedUserBroadcastFrame, resetUserBroadcastHub } from '@ihui/api-client'
import { mcpStatusLedger } from '@ihui/shared/chat'

import { McpStatusStrip, deriveMcpStatusView } from '../src/components/McpStatusStrip'
import { attachUserBroadcast, resetBroadcastNotices } from '../src/lib/user-broadcast'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'http://localhost:8802'
const STRIP_SOURCE = join(HERE, '../src/components/McpStatusStrip.tsx')
const SCREEN_SOURCE = join(HERE, '../src/screens/ChatScreen.tsx')

function translate(key: string, params?: Record<string, string | number>): string {
  return params ? `«${key}»(${JSON.stringify(params)})` : `«${key}»`
}

const throwingSocketFactory = (): never => {
  throw new Error('test: no socket in vitest env')
}

function failedFrame(server = 'github') {
  return toUserBroadcastFrame(mcpStatusEvent({ server, state: 'failed', reason: 'stdio exited' }))
}

function attach() {
  return attachUserBroadcast({
    baseUrl: BASE_URL,
    token: 'test-access-token',
    translate,
    notify: () => {},
    webSocketFactory: throwingSocketFactory,
  })
}

beforeEach(() => {
  resetUserBroadcastHub()
  mcpStatusLedger.clear()
  resetBroadcastNotices()
})

describe('D154 mobile-rn:MCP 状态行到屏幕', () => {
  it('① 喂一帧 failed ⇒ 渲染输出同时出现状态行与桌面端管理提示', () => {
    const sub = attach()
    expect(sub).not.toBeNull()
    feedUserBroadcastFrame(failedFrame('github'), { baseUrl: BASE_URL })
    expect(mcpStatusLedger.snapshot().map((r) => r.server)).toEqual(['github'])

    const { container } = render(<McpStatusStrip />)
    expect(container.textContent).toContain('«chat.mcp.state.failed»({"server":"github"})')
    expect(container.textContent).toContain('«chat.mcp.mobileSettingsHint»')
    sub?.close()
  })

  it('② 同 server 同 state 的重复帧 ⇒ 只渲一条', () => {
    const sub = attach()
    const frame = failedFrame('dup-server')
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
    feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })

    expect(mcpStatusLedger.snapshot()).toHaveLength(1)
    const { container } = render(<McpStatusStrip />)
    expect((container.textContent ?? '').split('«chat.mcp.state.failed»').length).toBe(2)
    sub?.close()
  })

  it('③ 装车证明:渲染点真的挂在 ChatScreen(摘掉渲染点本条必红)', () => {
    const screenSource = readFileSync(SCREEN_SOURCE, 'utf8')
    expect(screenSource).toMatch(
      /import\s*\{\s*McpStatusStrip\s*\}\s*from\s*'\.\.\/components\/McpStatusStrip'/,
    )
    expect(screenSource).toMatch(/<McpStatusStrip\s*\/>/)
    const stripSource = readFileSync(STRIP_SOURCE, 'utf8')
    expect(stripSource).toMatch(/mcpStatusLedger\.subscribe\(/)
    expect(stripSource).toMatch(/mcpStatusLedger\.snapshot\(/)
  })

  it('④ 结构纪律:端内不得重抄 state→词表键 的表,也不得自建连接', () => {
    const stripSource = readFileSync(STRIP_SOURCE, 'utf8')
    expect(stripSource).not.toMatch(/chat\.mcp\.state\./)
    expect(stripSource).not.toMatch(/new\s+WebSocket\s*\(/)
    expect(stripSource).not.toMatch(/parseUserBroadcastFrame\s*\(/)
    expect(stripSource).toMatch(/mcpStatusMessage\(/)
    expect(stripSource).toMatch(/MCP_MOBILE_SETTINGS_HINT_KEY/)
  })

  it('空账本 ⇒ 整条不挂载(连上不是要提示的事,零占位)', () => {
    expect(mcpStatusLedger.snapshot()).toHaveLength(0)
    const { container } = render(<McpStatusStrip />)
    expect(container.textContent).toBe('')
  })

  it('connected 帧 ⇒ 该行被摘掉,状态行随之消失', () => {
    const sub = attach()
    feedUserBroadcastFrame(failedFrame('github'), { baseUrl: BASE_URL })
    expect(render(<McpStatusStrip />).container.textContent).toContain('chat.mcp.state.failed')
    feedUserBroadcastFrame(
      toUserBroadcastFrame(mcpStatusEvent({ server: 'github', state: 'connected' })),
      { baseUrl: BASE_URL },
    )
    expect(mcpStatusLedger.snapshot()).toHaveLength(0)
    expect(render(<McpStatusStrip />).container.textContent).toBe('')
    sub?.close()
  })

  it('取不出文案的一档 ⇒ 不渲染空白行冒充"已显示",而是点名未判定', () => {
    const view = deriveMcpStatusView(
      [{ server: 'weird', state: 'connected', at: '2026-10-01T00:00:00.000Z' }],
      translate,
    )
    expect(view.lines).toEqual([])
    expect(view.undeterminedServers).toEqual(['weird'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
