// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  ANDROID_DEFAULT_CHANNEL_ID,
  ANDROID_RINGTONE_CHANNELS,
  ANDROID_SILENT_CHANNEL_ID,
} from '@ihui/shared/notifications/ringtone'
import { buildAndroidChannelSpecs } from '../notification-channels'

// 注入 importance 枚举替身:纯函数不碰 RN 原生 API,字面量即可真跑通。
const ImportanceSource = { AndroidImportance: { HIGH: 6, MAX: 7 } }

describe('Android 通知渠道规格构建', () => {
  const specs = buildAndroidChannelSpecs(ImportanceSource)

  it('恰好 10 条,channelId 无重复(8 铃声 + 静音 + default)', () => {
    expect(specs).toHaveLength(10)
    const ids = specs.map((s) => s.channelId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('8 条铃声的 channelId/sound 全部对拍 shared 导出,不硬编码第二份期望表', () => {
    const ringtoneSpecs = specs.filter((s) =>
      ANDROID_RINGTONE_CHANNELS.some((c) => c.channelId === s.channelId),
    )
    expect(ringtoneSpecs).toHaveLength(ANDROID_RINGTONE_CHANNELS.length)
    for (const expected of ANDROID_RINGTONE_CHANNELS) {
      const spec = specs.find((s) => s.channelId === expected.channelId)
      expect(spec).toBeDefined()
      expect(spec!.channelId).toBe(expected.channelId)
      expect(spec!.sound).toBe(expected.sound)
      expect(spec!.importance).toBe(ImportanceSource.AndroidImportance.HIGH)
    }
  })

  it('静音渠道 sound === null,仍送达但不出声', () => {
    const silent = specs.find((s) => s.channelId === ANDROID_SILENT_CHANNEL_ID)
    expect(silent).toBeDefined()
    expect(silent!.sound).toBeNull()
    expect(silent!.importance).toBe(ImportanceSource.AndroidImportance.HIGH)
  })

  it('default 兜底渠道存在且 importance 最高(MAX)', () => {
    const fallback = specs.find((s) => s.channelId === ANDROID_DEFAULT_CHANNEL_ID)
    expect(fallback).toBeDefined()
    expect(fallback!.importance).toBe(ImportanceSource.AndroidImportance.MAX)
    // 历史兜底渠道不带 sound(沿用旧默认音行为)
    expect(fallback!.sound).toBeUndefined()
  })

  it('渠道顺序:8 条铃声在前,静音居中,default 兜底', () => {
    expect(specs.map((s) => s.channelId)).toEqual([
      ...ANDROID_RINGTONE_CHANNELS.map((c) => c.channelId),
      ANDROID_SILENT_CHANNEL_ID,
      ANDROID_DEFAULT_CHANNEL_ID,
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
