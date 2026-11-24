// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ================== 模块边界 mock ==================
// tauri-bridge 顶层 import 的 tauri 三件 + isTauriRuntime(判据单一来源在 api-base-url)。
const invokeMock = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]): Promise<unknown> => undefined),
)
const isTauriState = vi.hoisted(() => ({ value: true }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock, Channel: class {} }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ onStartDragging: vi.fn(), close: vi.fn() }),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(), save: vi.fn() }))
vi.mock('../api-base-url', () => ({ isTauriRuntime: () => isTauriState.value }))

import {
  normalizeSystemNotificationPermission,
  querySystemNotificationPermission,
  sendDesktopNotification,
  type SystemNotificationPermission,
} from '../tauri-bridge'

/** 显式列出四个出口,导出被改名/摘线时编译期就红(不靠运行时 undefined)。 */
interface BridgeSurface {
  normalizeSystemNotificationPermission: (raw: unknown) => {
    state: string
    reason: string
    source: string
  }
  querySystemNotificationPermission: () => Promise<{
    state: string
    reason: string
    source: string
  }>
  sendDesktopNotification: (title: string, body: string) => Promise<void>
}
const bridge: BridgeSurface = {
  normalizeSystemNotificationPermission,
  querySystemNotificationPermission,
  sendDesktopNotification,
}

const VALID = (state: SystemNotificationPermission) => ({
  state,
  reason: 'registry-value',
  source: 'registry',
})

describe('normalizeSystemNotificationPermission - 封闭三态归一', () => {
  it('allowed / denied / unjudged 三态原样保留，reason/source 透传', () => {
    expect(bridge.normalizeSystemNotificationPermission(VALID('allowed'))).toEqual(VALID('allowed'))
    expect(bridge.normalizeSystemNotificationPermission(VALID('denied'))).toEqual(VALID('denied'))
    expect(bridge.normalizeSystemNotificationPermission(VALID('unjudged'))).toEqual(
      VALID('unjudged'),
    )
  })

  it('非对象 / null / 数组 / 原始值 → unjudged 且不冒充 allowed', () => {
    for (const bad of [null, undefined, 42, 'allowed', [], ['allowed']]) {
      const r = bridge.normalizeSystemNotificationPermission(bad)
      expect(r.state).toBe('unjudged')
      expect(r.reason).toBe('invalid-report-shape')
      expect(r.state).not.toBe('allowed')
    }
  })

  it('未知 state(含 plugin 的 granted/prompt)→ unjudged 且点名', () => {
    for (const bad of ['granted', 'prompt', 'YES', '', 1]) {
      const r = bridge.normalizeSystemNotificationPermission({
        state: bad,
        reason: 'x',
        source: 'y',
      })
      expect(r.state).toBe('unjudged')
      expect(r.reason).toBe('invalid-report-state')
    }
  })

  it('缺 reason / source → 用占位原因补全，state 不受影响', () => {
    expect(bridge.normalizeSystemNotificationPermission({ state: 'denied' })).toEqual({
      state: 'denied',
      reason: 'reason-missing',
      source: 'source-missing',
    })
  })
})

describe('querySystemNotificationPermission - 命令消费与 fail-closed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauriState.value = true
  })

  it('非 Tauri → unjudged/platform-not-tauri，绝不发 invoke', async () => {
    isTauriState.value = false
    const r = await bridge.querySystemNotificationPermission()
    expect(r).toEqual({ state: 'unjudged', reason: 'platform-not-tauri', source: 'platform' })
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('Tauri 下调用 query_notification_permission 命令并归一回执', async () => {
    invokeMock.mockResolvedValueOnce(VALID('denied'))
    const r = await bridge.querySystemNotificationPermission()
    expect(invokeMock).toHaveBeenCalledWith('query_notification_permission')
    expect(r).toEqual(VALID('denied'))
  })

  it('invoke 抛错 → unjudged 且点名错误，不默认 allowed', async () => {
    invokeMock.mockRejectedValueOnce(new Error('ipc-down'))
    const r = await bridge.querySystemNotificationPermission()
    expect(r.state).toBe('unjudged')
    expect(r.reason).toContain('bridge-invoke-failed')
    expect(r.reason).toContain('ipc-down')
    expect(r.state).not.toBe('allowed')
  })

  it('回执畸形 → unjudged/invalid-report-shape', async () => {
    invokeMock.mockResolvedValueOnce({ nonsense: true })
    const r = await bridge.querySystemNotificationPermission()
    expect(r.state).toBe('unjudged')
    expect(r.reason).toBe('invalid-report-state')
  })
})

describe('sendDesktopNotification - 真实消费系统三态', () => {
  const calls = { request: 0, notify: 0, sysQuery: 0 }

  beforeEach(() => {
    vi.clearAllMocks()
    isTauriState.value = true
    calls.request = 0
    calls.notify = 0
    calls.sysQuery = 0
  })

  /** 构造分命令 mock：plugin 未授权 → 进入系统三态判定分支。 */
  function mockIpc(systemState: SystemNotificationPermission, requestResult = 'granted') {
    invokeMock.mockImplementation(async (...args: unknown[]) => {
      const cmd = String(args[0])
      if (cmd === 'plugin:notification|is_permission_granted') return false
      if (cmd === 'query_notification_permission') {
        calls.sysQuery++
        return VALID(systemState)
      }
      if (cmd === 'plugin:notification|request_permission') {
        calls.request++
        return requestResult
      }
      if (cmd === 'plugin:notification|notify') {
        calls.notify++
        return undefined
      }
      return undefined
    })
  }

  it('系统 denied → 短路：查询了命令，但不请求应用权限、不发通知', async () => {
    mockIpc('denied')
    await bridge.sendDesktopNotification('标题', '正文')
    expect(calls.sysQuery).toBe(1)
    expect(calls.request).toBe(0)
    expect(calls.notify).toBe(0)
  })

  it('系统 unjudged → 不冒充 denied，继续走原 plugin 路径发通知', async () => {
    mockIpc('unjudged')
    await bridge.sendDesktopNotification('标题', '正文')
    expect(calls.sysQuery).toBe(1)
    expect(calls.request).toBe(1)
    expect(calls.notify).toBe(1)
  })

  it('系统 allowed → 继续走原 plugin 路径发通知', async () => {
    mockIpc('allowed')
    await bridge.sendDesktopNotification('标题', '正文')
    expect(calls.sysQuery).toBe(1)
    expect(calls.request).toBe(1)
    expect(calls.notify).toBe(1)
  })

  it('plugin 已授权 → 不查系统命令，直接发(不改变原有快路径)', async () => {
    invokeMock.mockImplementation(async (...args: unknown[]) => {
      const cmd = String(args[0])
      if (cmd === 'plugin:notification|is_permission_granted') return true
      if (cmd === 'query_notification_permission') {
        calls.sysQuery++
        return VALID('allowed')
      }
      if (cmd === 'plugin:notification|notify') {
        calls.notify++
        return undefined
      }
      return undefined
    })
    await bridge.sendDesktopNotification('标题', '正文')
    expect(calls.sysQuery).toBe(0)
    expect(calls.request).toBe(0)
    expect(calls.notify).toBe(1)
  })
})

describe('变异锁 - 消费方必须真装在发送路径上', () => {
  it('sendDesktopNotification 函数体内必须调用 querySystemNotificationPermission', () => {
    const src = readFileSync(path.resolve(__dirname, '../tauri-bridge.ts'), 'utf8')
    const start = src.indexOf('export async function sendDesktopNotification')
    expect(start).toBeGreaterThanOrEqual(0)
    const end = src.indexOf('\n}', start)
    const fn = src.slice(start, end)
    // 正向：真调用在
    expect(fn).toContain('querySystemNotificationPermission()')
    // 反向：把调用抹掉后判据必须不再命中(证明这条锁有牙，不是恒绿)
    expect(fn.replace('querySystemNotificationPermission()', '')).not.toContain(
      'querySystemNotificationPermission()',
    )
  })
})
