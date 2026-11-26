// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序通知铃声库单测(2026-11-26 立)。
 * 钉住:默认开启、显式关闭才静音、未知 id 回落 dingdong、1200ms 去抖、
 * 试听绕抖、开关关不响、本地读写回环。Taro storage / InnerAudioContext 全部桩件。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

interface FakeCtx {
  src: string
  play: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  destroy: ReturnType<typeof vi.fn>
  onError: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => {
  const storage: Record<string, unknown> = {}
  const ctxs: FakeCtx[] = []
  return { storage, ctxs }
})

vi.mock('@tarojs/taro', () => {
  const Taro = {
    getStorageSync: (key: string) => mocks.storage[key],
    setStorageSync: (key: string, value: unknown) => {
      mocks.storage[key] = value
    },
    createInnerAudioContext: () => {
      const ctx: FakeCtx = {
        src: '',
        play: vi.fn(),
        stop: vi.fn(),
        destroy: vi.fn(),
        onError: vi.fn(),
      }
      mocks.ctxs.push(ctx)
      return ctx
    },
  }
  return { default: Taro, ...Taro }
})

import {
  __test__,
  hydrateFromServerSettings,
  isSoundEnabled,
  playNotificationRingtone,
  previewRingtone,
  readStoredRingtoneId,
  setSoundEnabled,
  writeStoredRingtoneId,
} from '../notification-ringtone'

beforeEach(() => {
  vi.useFakeTimers()
  for (const key of Object.keys(mocks.storage)) delete mocks.storage[key]
  mocks.ctxs.length = 0
  __test__.resetForTest()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('声音开关(默认开启)', () => {
  it('未设置 / 空值一律视为开启', () => {
    expect(isSoundEnabled()).toBe(true)
  })

  it('显式存 0 / false 才静音,其余值仍开启', () => {
    mocks.storage['ihui-notification-sound-enabled'] = '0'
    expect(isSoundEnabled()).toBe(false)
    mocks.storage['ihui-notification-sound-enabled'] = 'false'
    expect(isSoundEnabled()).toBe(false)
    mocks.storage['ihui-notification-sound-enabled'] = '1'
    expect(isSoundEnabled()).toBe(true)
  })

  it('setSoundEnabled 写回 1 / 0,读回极性一致', () => {
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })

  it('开关关闭时通知链路不播放、不创建音频实例', () => {
    setSoundEnabled(false)
    expect(playNotificationRingtone()).toBe(false)
    expect(mocks.ctxs).toHaveLength(0)
  })
})

describe('铃声 id 收敛', () => {
  it('空存储回落默认 dingdong', () => {
    expect(readStoredRingtoneId()).toBe('dingdong')
  })

  it('未知 / 非法 id 一律回落 dingdong,不留播不出的状态', () => {
    mocks.storage['ihui-notification-ringtone'] = 'not-a-ringtone'
    expect(readStoredRingtoneId()).toBe('dingdong')
    mocks.storage['ihui-notification-ringtone'] = ''
    expect(readStoredRingtoneId()).toBe('dingdong')
  })

  it('writeStoredRingtoneId 写入后读回同一合法 id', () => {
    writeStoredRingtoneId('waterdrop')
    expect(readStoredRingtoneId()).toBe('waterdrop')
  })
})

describe('后端偏好 hydration 归一化', () => {
  it("后端 soundEnabled='false' + 本地无值 → 关闭(写本地 '0')", () => {
    hydrateFromServerSettings({ soundEnabled: 'false' })
    expect(isSoundEnabled()).toBe(false)
  })

  it("soundEnabled='0' 关闭;'true' / '1' / 无键 → 开启", () => {
    hydrateFromServerSettings({ soundEnabled: '0' })
    expect(isSoundEnabled()).toBe(false)
    hydrateFromServerSettings({ soundEnabled: 'true' })
    expect(isSoundEnabled()).toBe(true)
    hydrateFromServerSettings({ soundEnabled: '1' })
    expect(isSoundEnabled()).toBe(true)
    hydrateFromServerSettings({})
    expect(isSoundEnabled()).toBe(true)
  })

  it('ringtone 有键回写并收敛;未知 id 回落 dingdong', () => {
    hydrateFromServerSettings({ ringtone: 'marimba' })
    expect(readStoredRingtoneId()).toBe('marimba')
    hydrateFromServerSettings({ ringtone: 'bogus' })
    expect(readStoredRingtoneId()).toBe('dingdong')
  })

  it('ringtone 无键时保留本地已有选择,不被清空', () => {
    writeStoredRingtoneId('waterdrop')
    hydrateFromServerSettings({ soundEnabled: 'true' })
    expect(readStoredRingtoneId()).toBe('waterdrop')
  })
})

describe('播放与去抖', () => {
  it('开启状态播放当前选中铃声,src 指向包内 MP3', () => {
    writeStoredRingtoneId('dingdong')
    expect(playNotificationRingtone()).toBe(true)
    const ctx = mocks.ctxs[mocks.ctxs.length - 1]
    expect(ctx?.src).toBe('/static/sounds/ringtone-dingdong.mp3')
    expect(ctx?.play).toHaveBeenCalledTimes(1)
  })

  it('1200ms 内连发只响一次(去抖拦下第二次)', () => {
    expect(playNotificationRingtone()).toBe(true)
    expect(playNotificationRingtone()).toBe(false)
    expect(mocks.ctxs[mocks.ctxs.length - 1]?.play).toHaveBeenCalledTimes(1)
  })

  it('超过去抖窗口后再次播放放行', () => {
    expect(playNotificationRingtone()).toBe(true)
    vi.advanceTimersByTime(1200)
    expect(playNotificationRingtone()).toBe(true)
  })

  it('试听绕过去抖:连点不同铃声都能立刻出声', () => {
    expect(playNotificationRingtone()).toBe(true)
    expect(previewRingtone('waterdrop')).toBe(true)
    expect(previewRingtone('marimba')).toBe(true)
    const last = mocks.ctxs[mocks.ctxs.length - 1]
    expect(last?.src).toBe('/static/sounds/ringtone-marimba.mp3')
  })

  it('试听未知 id 同样回落默认铃声', () => {
    expect(previewRingtone('bogus')).toBe(true)
    const last = mocks.ctxs[mocks.ctxs.length - 1]
    expect(last?.src).toBe('/static/sounds/ringtone-dingdong.mp3')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
