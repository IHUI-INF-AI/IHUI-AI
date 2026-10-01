// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent.action 重放水位票客户端侧测试(2026-09-30,票 b76-12c-1)。
 *
 * 钉两组不变量:
 *  - 共享层 createReplayWatermark 的四条判定语义(判序早于判体):
 *      a) 101 条之后重放第 1 条 → stale 不执行(治「有界 id 集合淘汰后重放复活」);
 *      b) 同序号同 id 重放 → duplicate 幂等忽略且不进故障;
 *      c) 序号回退(旧连接残帧)→ stale 静默丢且不污染水位;
 *      d) 同序号不同 id → conflict 记 typed fault(不静默)。
 *  - 桌面桥(use-agent-control.ts)接线:同一 requestId 重放只执行一次。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { createReplayWatermark } from '@ihui/shared/utils/agent-action-addressing'

const { fetchApiMock, clipboardGetMock, warnSpy } = vi.hoisted(() => ({
  fetchApiMock: vi.fn(),
  clipboardGetMock: vi.fn(),
  warnSpy: vi.fn(),
}))

vi.mock('react', () => ({ default: { useRef: () => ({ current: undefined }) } }))
vi.mock('@ihui/api-client', () => ({ createNotificationClient: vi.fn() }))
vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('@/lib/tauri-bridge', () => ({
  isTauri: vi.fn(() => false),
  clipboardGet: clipboardGetMock,
  clipboardSet: vi.fn(),
  getActiveWindow: vi.fn(),
  keyboardHotkey: vi.fn(),
  keyboardPress: vi.fn(),
  keyboardType: vi.fn(),
  mouseClick: vi.fn(),
  mouseMove: vi.fn(),
  mouseScroll: vi.fn(),
  screenshotScreen: vi.fn(),
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign(vi.fn(), { getState: () => ({ token: 'tk' }) }),
}))
vi.mock('@/lib/api-base-url', () => ({ resolveWsApiBaseUrl: () => 'http://127.0.0.1:8802' }))

import { __test__ as desktopBridge } from '../src/hooks/use-agent-control'

function wsFrame(requestId: string) {
  return {
    type: 'notification',
    data: {
      type: 'agent.action',
      request: {
        requestId,
        category: 'computer',
        action: 'clipboard_get',
        params: {},
      },
    },
  } as never
}

beforeEach(() => {
  fetchApiMock.mockReset()
  fetchApiMock.mockResolvedValue({ success: true })
  clipboardGetMock.mockReset()
  clipboardGetMock.mockResolvedValue({ clipboard: 'hello' })
  warnSpy.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(warnSpy)
})

describe('createReplayWatermark 四条判定语义', () => {
  it('a) 101 条之后重放第 1 条 → stale,不执行且水位不被回写', () => {
    const wm = createReplayWatermark()
    const route = 'desktop/inst-a'
    for (let ordinal = 1; ordinal <= 101; ordinal++) {
      expect(wm.observe(route, ordinal, `id-${ordinal}`)).toEqual({ kind: 'fresh' })
    }
    // 重放第 1 条:低于水位 → 静默丢(接线端据此 return,不执行)
    expect(wm.observe(route, 1, 'id-1')).toEqual({ kind: 'stale' })
    // 水位未被污染:仍钉在第 101 条
    expect(wm.peek(route)).toEqual({ lastOrdinal: 101, lastId: 'id-101' })
  })

  it('b) 同序号同 id 重放 → duplicate 幂等忽略(不进故障)', () => {
    const wm = createReplayWatermark()
    const route = 'desktop/inst-b'
    expect(wm.observe(route, 7, 'id-7')).toEqual({ kind: 'fresh' })
    expect(wm.observe(route, 7, 'id-7')).toEqual({ kind: 'duplicate' })
    // 幂等重放不推进、不改写水位
    expect(wm.peek(route)).toEqual({ lastOrdinal: 7, lastId: 'id-7' })
  })

  it('c) 序号回退(旧连接残帧)→ stale 静默丢且不污染水位', () => {
    const wm = createReplayWatermark()
    const route = 'web/inst-c'
    expect(wm.observe(route, 20, 'id-20')).toEqual({ kind: 'fresh' })
    expect(wm.observe(route, 21, 'id-21')).toEqual({ kind: 'fresh' })
    // 旧连接残帧:序号倒退回 20 且身份不同 → 丢,但水位保持 21
    expect(wm.observe(route, 20, 'id-stale-frame')).toEqual({ kind: 'stale' })
    expect(wm.peek(route)).toEqual({ lastOrdinal: 21, lastId: 'id-21' })
  })

  it('d) 同序号不同 id → conflict 记 typed fault(消息含路由/序号/两侧身份)', () => {
    const wm = createReplayWatermark()
    const route = 'web/inst-d'
    expect(wm.observe(route, 30, 'id-30')).toEqual({ kind: 'fresh' })
    const verdict = wm.observe(route, 30, 'id-30-impostor')
    expect(verdict.kind).toBe('conflict')
    if (verdict.kind === 'conflict') {
      expect(verdict.message).toContain(route)
      expect(verdict.message).toContain('30')
      expect(verdict.message).toContain('id-30')
      expect(verdict.message).toContain('id-30-impostor')
    }
    // conflict 不改写水位(typed fault 只留痕,不 settle)
    expect(wm.peek(route)).toEqual({ lastOrdinal: 30, lastId: 'id-30' })
  })

  it('路由之间互不串扰(每路由独立墓碑)', () => {
    const wm = createReplayWatermark()
    expect(wm.observe('desktop/i1', 5, 'id-a')).toEqual({ kind: 'fresh' })
    expect(wm.observe('web/i2', 1, 'id-b')).toEqual({ kind: 'fresh' })
    expect(wm.observe('desktop/i1', 5, 'id-a')).toEqual({ kind: 'duplicate' })
    expect(wm.observe('web/i2', 1, 'id-b')).toEqual({ kind: 'duplicate' })
  })
})

describe('桌面桥重放接线(use-agent-control handleWsMessage)', () => {
  it('同一 requestId 重放只执行一次(不二次回执)', async () => {
    const { handleWsMessage } = desktopBridge
    handleWsMessage(wsFrame('req-replay-once'))
    handleWsMessage(wsFrame('req-replay-once'))
    await vi.waitFor(() => expect(fetchApiMock).toHaveBeenCalledTimes(1))
    // 稍等再确认第二次确实没有产生第二份回执
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchApiMock).toHaveBeenCalledTimes(1)
    const calls = fetchApiMock.mock.calls as Array<[string, unknown]>
    expect(calls.every(([url]) => String(url).includes('/api/agent-control/result'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
