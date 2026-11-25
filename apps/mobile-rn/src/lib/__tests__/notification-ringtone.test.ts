// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  __resetInternalsForTest,
  applyServerPreferences,
  createRingtoneDedupe,
  getStoredRingtoneIdSync,
  hydrateRingtoneSettings,
  isSoundEnabled,
  isUserVisibleNotification,
  playRingtone,
  previewRingtone,
  resolveSoundEnabledFromServer,
  setSoundEnabled,
  setStoredRingtoneId,
  type RingtoneId,
} from '../notification-ringtone'

// 局部替身:补足真实播放器的 replace 方法并避免播放抛错被静默吞掉;
// 全局 alias mock 只兜宿主层,局部工厂在此优先。
vi.mock('expo-audio', () => ({
  createAudioPlayer: vi.fn(() => ({
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    replace: vi.fn(),
  })),
}))

// 静态资产模块在 node/vitest 环境不加载 WAV 二进制,占位即可。
vi.mock('../notification-ringtone-assets', () => ({
  RINGTONE_ASSETS: {},
}))

describe('通知铃声 lib', () => {
  beforeEach(() => {
    __resetInternalsForTest()
  })
  afterEach(() => {
    __resetInternalsForTest()
  })

  it('提示音默认开启,只有显式关闭才静音', () => {
    expect(isSoundEnabled()).toBe(true)
    setSoundEnabled(false)
    expect(isSoundEnabled()).toBe(false)
    setSoundEnabled(true)
    expect(isSoundEnabled()).toBe(true)
  })

  it('未选铃声时回落默认 dingdong', () => {
    expect(getStoredRingtoneIdSync()).toBe('dingdong')
  })

  it('未知铃声 id 回落默认 dingdong,不写入非法值', () => {
    setStoredRingtoneId('not-a-ringtone' as RingtoneId)
    expect(getStoredRingtoneIdSync()).toBe('dingdong')
  })

  it('内部帧(ai_response / chat_message / agent.action)不响,普通用户可见帧放行', () => {
    expect(
      isUserVisibleNotification({ type: 'notification', data: { id: 'n1', type: 'message' } }),
    ).toBe(true)
    for (const internalType of ['ai_response', 'chat_message', 'agent.action']) {
      expect(
        isUserVisibleNotification({ type: 'notification', data: { id: 'n2', type: internalType } }),
      ).toBe(false)
    }
    expect(isUserVisibleNotification(null)).toBe(false)
    expect(isUserVisibleNotification({ type: 'chat', data: {} })).toBe(false)
    expect(isUserVisibleNotification({ type: 'notification' })).toBe(false)
  })

  it('通知 id 去重:同一 id 只放行一次,无 id 每次放行', () => {
    const dedupe = createRingtoneDedupe()
    expect(dedupe.shouldRing('a')).toBe(true)
    expect(dedupe.shouldRing('a')).toBe(false)
    expect(dedupe.shouldRing('b')).toBe(true)
    expect(dedupe.shouldRing(null)).toBe(true)
  })

  it('连发去抖 1200ms:间隔内第二次被拦,满间隔后放行', () => {
    vi.useFakeTimers()
    try {
      expect(playRingtone()).toBe(true)
      expect(playRingtone()).toBe(false)
      vi.advanceTimersByTime(1199)
      expect(playRingtone()).toBe(false)
      vi.advanceTimersByTime(1)
      expect(playRingtone()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('试听绕过去抖:连点不同铃声都能立刻出声', () => {
    vi.useFakeTimers()
    try {
      expect(previewRingtone('bubble')).toBe(true)
      expect(previewRingtone('marimba')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('选中铃声落本地缓存,回源后读回一致', async () => {
    setStoredRingtoneId('waterdrop')
    expect(await AsyncStorage.getItem('ihui-notification-ringtone')).toBe('waterdrop')
    await hydrateRingtoneSettings()
    expect(getStoredRingtoneIdSync()).toBe('waterdrop')
  })

  it('后端 soundEnabled 归一:0/false 关闭,其余与无键开启', () => {
    expect(resolveSoundEnabledFromServer('0')).toBe(false)
    expect(resolveSoundEnabledFromServer('false')).toBe(false)
    expect(resolveSoundEnabledFromServer('1')).toBe(true)
    expect(resolveSoundEnabledFromServer('true')).toBe(true)
    expect(resolveSoundEnabledFromServer(undefined)).toBe(true)
    expect(resolveSoundEnabledFromServer(null)).toBe(true)
  })

  it('后端偏好回写本地:false + 本地无值 → 关闭;ringtone 同步收敛', () => {
    applyServerPreferences({ soundEnabled: 'false' })
    expect(isSoundEnabled()).toBe(false)
    applyServerPreferences({ soundEnabled: 'true', ringtone: 'marimba' })
    expect(isSoundEnabled()).toBe(true)
    expect(getStoredRingtoneIdSync()).toBe('marimba')
  })

  it('接口返回空/非法形态时本地不被改写(保持默认开启与默认铃声)', () => {
    applyServerPreferences(null)
    applyServerPreferences('not-an-object')
    expect(isSoundEnabled()).toBe(true)
    expect(getStoredRingtoneIdSync()).toBe('dingdong')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
