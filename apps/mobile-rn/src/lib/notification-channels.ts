// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Android 通知渠道规格构建(2026-11-26 立)。
 *
 * 职责边界:
 * - 渠道 id / 音源名的唯一真相源在 `@ihui/shared/notifications/ringtone`(三端同源),
 *   本层只把那张表翻成 expo-notifications 的渠道配置;不另抄第二份铃声/渠道表。
 * - 本模块是纯函数:不碰 RN 原生 API、不做 IO,importance 枚举经参数注入,
 *   vitest 环境可直接构造替身跑通。
 *
 * 为什么"按 id 分 channel"而不是"一条 channel 改 sound":Android 渠道一旦创建,
 * sound / importance 即不可再改(改也只在卸载重装后生效)。所以启动时预建全部 8 条
 * 铃声渠道 + 1 条静音渠道 + 1 条历史兜底渠道,服务端按收件人偏好把 channel_id 指过去,
 * 用户切换铃声/声音开关下一条通知即落到对应渠道。
 */
import {
  ANDROID_DEFAULT_CHANNEL_ID,
  ANDROID_RINGTONE_CHANNELS,
  ANDROID_SILENT_CHANNEL_ID,
} from '@ihui/shared/notifications/ringtone'
import { rnTokens } from '@ihui/design-tokens'

/** 注入用的 importance 枚举面;运行时由 `Notifications` 命名空间提供,测试传字面量即可。 */
export interface ImportanceSource {
  AndroidImportance: { HIGH: number; MAX: number }
}

export interface AndroidChannelSpec {
  channelId: string
  name: string
  importance: number
  sound?: string | null
  vibrationPattern?: number[]
  lightColor?: string
}

/**
 * 铃声 id → 渠道展示名中文映射。中文名只允许出现在这一处;
 * id / channelId / sound 一律从 shared 派生,不在这里拼字符串。
 */
const RINGTONE_LABELS: Record<string, string> = {
  dingdong: '门铃',
  tritone: '三音上扬',
  waterdrop: '水滴',
  doublebell: '双响铃',
  bubble: '气泡',
  marimba: '木琴',
  chime: '和弦铃',
  knock: '轻敲',
}

/** 与历史 default 渠道一致的振动节奏(0 延迟,起振 250ms,停 250ms,再振 250ms)。 */
const DEFAULT_VIBRATION_PATTERN: readonly [number, number, number, number] = [0, 250, 250, 250]

/**
 * 构建 Android 预建渠道全表(顺序:8 条铃声 + 静音 + default)。
 * @param source expo-notifications 的 `Notifications` 命名空间(取 AndroidImportance 枚举)
 */
export function buildAndroidChannelSpecs(source: ImportanceSource): AndroidChannelSpec[] {
  const { AndroidImportance } = source

  const ringtoneChannels: AndroidChannelSpec[] = ANDROID_RINGTONE_CHANNELS.map((channel) => ({
    channelId: channel.channelId,
    name: `通知铃声 · ${RINGTONE_LABELS[channel.id] ?? channel.id}`,
    importance: AndroidImportance.HIGH,
    sound: channel.sound,
    vibrationPattern: [...DEFAULT_VIBRATION_PATTERN],
    lightColor: rnTokens.brand.DEFAULT,
  }))

  const silentChannel: AndroidChannelSpec = {
    channelId: ANDROID_SILENT_CHANNEL_ID,
    name: '通知（静音）',
    importance: AndroidImportance.HIGH,
    // 独立静音渠道:用户关掉通知声音后仍送达但不出声;不把既有渠道的 sound 清掉
    // (渠道创建后改不动,清不掉就是"关了还在响")。
    sound: null,
    vibrationPattern: [...DEFAULT_VIBRATION_PATTERN],
    lightColor: rnTokens.brand.DEFAULT,
  }

  const fallbackChannel: AndroidChannelSpec = {
    channelId: ANDROID_DEFAULT_CHANNEL_ID,
    name: 'default',
    importance: AndroidImportance.MAX,
    vibrationPattern: [...DEFAULT_VIBRATION_PATTERN],
    lightColor: rnTokens.brand.DEFAULT,
  }

  return [...ringtoneChannels, silentChannel, fallbackChannel]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
