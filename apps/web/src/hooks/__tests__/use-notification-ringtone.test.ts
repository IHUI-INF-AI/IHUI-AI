// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type * as RingtoneWebModule from '@ihui/shared/notifications/ringtone-web'

const h = vi.hoisted(() => ({
  play: vi.fn(),
  preview: vi.fn(),
  unlock: vi.fn(),
  fetchApi: vi.fn(),
  authenticated: true,
  lastMessage: null as unknown,
}))

vi.mock('@/lib/api', () => ({ fetchApi: h.fetchApi }))

vi.mock('@/hooks/use-websocket', () => ({
  useWebSocket: () => ({ lastMessage: h.lastMessage }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: h.authenticated }),
}))

vi.mock('@ihui/shared/notifications/ringtone-web', async (importActual) => {
  const actual = await importActual<typeof RingtoneWebModule>()
  return {
    ...actual,
    playRingtone: h.play,
    previewRingtone: h.preview,
    unlockRingtoneAudio: h.unlock,
  }
})

import { useNotificationRingtone } from '../use-notification-ringtone'
import { syncPreferencesFromServer } from '../use-ringtone-preference'
import {
  isSoundNotificationEnabled,
  setSoundNotificationEnabled,
} from '@ihui/shared/notifications/notification-store'
import { readStoredRingtoneId, resolveRingtoneId } from '@ihui/shared/notifications/ringtone'

const frame = (type: string, title = '新通知') => ({
  type: 'notification',
  data: {
    id: `n-${type}`,
    type,
    title,
    content: '',
    createdAt: '2026-11-26T00:00:00.000Z',
    isRead: false,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  h.authenticated = true
  h.lastMessage = null
  window.localStorage.clear()
})

describe('useNotificationRingtone — 响铃决策', () => {
  it('已登录 + 默认开启 + 普通通知帧 → 播当前选中铃声', () => {
    h.lastMessage = frame('system')
    renderHook(() => useNotificationRingtone())
    expect(h.play).toHaveBeenCalledTimes(1)
    expect(h.play).toHaveBeenCalledWith(readStoredRingtoneId())
  })

  it.each(['ai_response', 'chat_message', 'agent.action', 'ai_question', 'chat_question_answered'])(
    '内部帧 %s 不响',
    (type) => {
      h.lastMessage = frame(type)
      renderHook(() => useNotificationRingtone())
      expect(h.play).not.toHaveBeenCalled()
    },
  )

  it('声音关闭(本地写 0)→ 不响', () => {
    setSoundNotificationEnabled(false)
    h.lastMessage = frame('system')
    renderHook(() => useNotificationRingtone())
    expect(h.play).not.toHaveBeenCalled()
  })

  it('未登录 → 不响', () => {
    h.authenticated = false
    h.lastMessage = frame('system')
    renderHook(() => useNotificationRingtone())
    expect(h.play).not.toHaveBeenCalled()
  })

  it('非 notification 封壳帧 → 不响', () => {
    h.lastMessage = { type: 'ai_response', data: {} }
    renderHook(() => useNotificationRingtone())
    expect(h.play).not.toHaveBeenCalled()
  })

  it('关闭后下一条帧立即静音(现读开关,不看 mount 快照)', () => {
    h.lastMessage = frame('system', '第一条')
    const { rerender } = renderHook(() => useNotificationRingtone())
    expect(h.play).toHaveBeenCalledTimes(1)
    setSoundNotificationEnabled(false)
    h.lastMessage = frame('system', '第二条')
    rerender()
    expect(h.play).toHaveBeenCalledTimes(1)
  })

  it('后台/失焦照常响:hook 不按 visibilityState/hidden/focus 短路', () => {
    h.lastMessage = frame('system')
    renderHook(() => useNotificationRingtone())
    expect(h.play).toHaveBeenCalledTimes(1)
  })
})

describe('铃声 / 开关纯函数口径', () => {
  it('未知 id 回落 dingdong;合法 id 原样收敛', () => {
    expect(resolveRingtoneId('bogus')).toBe('dingdong')
    expect(resolveRingtoneId(null)).toBe('dingdong')
    expect(resolveRingtoneId('waterdrop')).toBe('waterdrop')
  })

  it('无本地值默认开启;写 0 静音;写 1 开启', () => {
    expect(isSoundNotificationEnabled()).toBe(true)
    setSoundNotificationEnabled(false)
    expect(isSoundNotificationEnabled()).toBe(false)
    setSoundNotificationEnabled(true)
    expect(isSoundNotificationEnabled()).toBe(true)
  })
})

describe('syncPreferencesFromServer — 登录后服务端校正本地', () => {
  it("后端 soundEnabled='false' + 本地无值 → 落地关闭(本地写 '0',开关 false),铃声一并收敛", async () => {
    h.fetchApi.mockResolvedValue({
      success: true,
      data: { settings: { soundEnabled: 'false', ringtone: 'waterdrop' } },
    })
    const ok = await syncPreferencesFromServer()
    expect(ok).toBe(true)
    expect(window.localStorage.getItem('ihui-notification-sound-enabled')).toBe('0')
    expect(isSoundNotificationEnabled()).toBe(false)
    expect(readStoredRingtoneId()).toBe('waterdrop')
  })

  it('接口失败时本地已有值不被改写', async () => {
    window.localStorage.setItem('ihui-notification-sound-enabled', '1')
    window.localStorage.setItem('ihui-notification-ringtone', 'marimba')
    h.fetchApi.mockResolvedValue({ success: false, data: null })
    const ok = await syncPreferencesFromServer()
    expect(ok).toBe(false)
    expect(window.localStorage.getItem('ihui-notification-sound-enabled')).toBe('1')
    expect(readStoredRingtoneId()).toBe('marimba')
  })
})

describe('playRingtone 连发去抖 1200ms', () => {
  it('短时间连续两次只播第一次,第二次被去抖拦下', async () => {
    const actual = await vi.importActual<typeof RingtoneWebModule>(
      '@ihui/shared/notifications/ringtone-web',
    )

    class FakeParam {
      setValueAtTime(): void {}
      exponentialRampToValueAtTime(): void {}
    }
    class FakeGain {
      gain = new FakeParam()
      connect(): void {}
      disconnect(): void {}
    }
    class FakeOsc {
      type = ''
      frequency = { value: 0 }
      connect(): void {}
      disconnect(): void {}
      start(): void {}
      stop(): void {}
      onended: (() => void) | null = null
    }
    class FakeCtx {
      state = 'running'
      destination = {}
      currentTime = 0
      createOscillator(): FakeOsc {
        return new FakeOsc()
      }
      createGain(): FakeGain {
        return new FakeGain()
      }
      resume(): Promise<void> {
        return Promise.resolve()
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      value: FakeCtx as unknown as typeof AudioContext,
      configurable: true,
      writable: true,
    })

    const first = actual.playRingtone('dingdong')
    const second = actual.playRingtone('dingdong')
    expect(first).toBe(true)
    expect(second).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
