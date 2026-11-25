// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端通知铃声播放/存储/开关收口层(2026-11-26 立)。
 *
 * 职责边界:
 * - 铃声曲目表/音符序列的单一真相源在 `@ihui/shared/notifications/ringtone`(三端同源),
 *   本层只负责 RN 原生播放(expo-audio)、本地缓存与声音开关读取,不重复定义曲目。
 * - 播放时每次现读当前选中 id 与开关状态,不在模块加载时固化常量,也不依赖组件 mount
 *   时捕获的闭包值 —— 用户在设置页改完铃声/开关,下一条通知立即生效。
 * - 本地缓存只是设备侧副本,后端 user_preferences(group=notifications)的 `ringtone` /
 *   `soundEnabled` 才是跨端同步真相源;登录后由设置页 GET 校正,失败再回退本地。
 *
 * 版权红线:8 个音频全部是由共享层曲目表渲染出的自制合成 WAV,不含任何第三方成品提示音,
 * 对外也不使用「微信同款 / 苹果同款」之类表述。
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAudioPlayer } from 'expo-audio'
import {
  DEFAULT_RINGTONE_ID,
  RINGTONE_IDS,
  resolveRingtoneId,
  type RingtoneId,
} from '@ihui/shared/notifications/ringtone'
import { RINGTONE_ASSETS } from './notification-ringtone-assets'

export type { RingtoneId }

/** 供设置页逐项渲染的曲目 id 清单(顺序与共享层表一致)。 */
export const RINGTONE_ID_LIST: readonly RingtoneId[] = RINGTONE_IDS

const RINGTONE_STORAGE_KEY = 'ihui-notification-ringtone'
const SOUND_STORAGE_KEY = 'ihui-notification-sound-enabled'

/* -------------------------------------------------------------------------- */
/* 本地缓存:模块级内存镜像,同步现读;异步落 AsyncStorage 做冷启动回源             */
/* -------------------------------------------------------------------------- */

let ringtoneCache: RingtoneId | null = null
let soundEnabledCache: boolean | null = null

/** 同步取当前选中铃声 id;未读缓存时回落默认,绝不留下"选了但播不出来"的状态。 */
export function getStoredRingtoneIdSync(): RingtoneId {
  return ringtoneCache ?? DEFAULT_RINGTONE_ID
}

/** 写入选中铃声:先更内存镜像(立即生效),再异步落本地缓存,失败静默(后端仍会存)。 */
export function setStoredRingtoneId(id: unknown): void {
  ringtoneCache = resolveRingtoneId(id)
  void AsyncStorage.setItem(RINGTONE_STORAGE_KEY, ringtoneCache).catch(() => {})
}

/**
 * 提示音开关是否开启。
 * 口径与共享层 web 侧一致:未设置 = 开启(像微信一样登录后收到新消息就响);
 * 只有显式写 `'0'` 才静音。
 */
export function isSoundEnabled(): boolean {
  return soundEnabledCache ?? true
}

/** 写入开关:先更内存镜像(关闭立即静音),再异步落本地缓存。 */
export function setSoundEnabled(enabled: boolean): void {
  soundEnabledCache = enabled
  void AsyncStorage.setItem(SOUND_STORAGE_KEY, enabled ? '1' : '0').catch(() => {})
}

/**
 * 冷启动 / 进通知设置页时回源本地缓存到内存镜像。
 * 读不到任何值就保持默认(铃声 dingdong、提示音开),不抛错、不阻塞通知链路。
 */
export async function hydrateRingtoneSettings(): Promise<void> {
  try {
    const [ringtoneRaw, soundRaw] = await Promise.all([
      AsyncStorage.getItem(RINGTONE_STORAGE_KEY),
      AsyncStorage.getItem(SOUND_STORAGE_KEY),
    ])
    ringtoneCache = resolveRingtoneId(ringtoneRaw)
    soundEnabledCache = soundRaw !== '0'
  } catch {
    // 隐私模式 / 存储不可用:保留默认值即可
  }
}

/**
 * 归一后端 soundEnabled 取值:`'0'` / `'false'` → 关闭;`'1'` / `'true'` / 无该键 → 开启。
 * 纯函数,便于单测;与本地开关"未设置=开启"口径一致。
 */
export function resolveSoundEnabledFromServer(raw: unknown): boolean {
  return raw !== '0' && raw !== 'false'
}

/**
 * 把服务端通知偏好回写本地镜像与缓存:开关归一 + 铃声 id 收敛。
 * 仅在 GET 成功响应后由调用方调用;接口失败时不得调用,以免覆盖本地已有值。
 */
export function applyServerPreferences(raw: unknown): void {
  if (raw === null || raw === undefined || typeof raw !== 'object') return
  const record = raw as Record<string, unknown>
  setSoundEnabled(resolveSoundEnabledFromServer(record.soundEnabled))
  const serverRingtone = record.ringtone
  if (typeof serverRingtone === 'string') setStoredRingtoneId(serverRingtone)
}

/* -------------------------------------------------------------------------- */
/* 播放层:expo-audio 命令式单例,1200ms 连发去抖                                  */
/* -------------------------------------------------------------------------- */

/** 两条通知铃声之间的最小间隔(ms),短时间连炸只响一次,避免"叮叮叮"轰炸。 */
const MIN_PLAY_INTERVAL_MS = 1200

let lastPlayedAt = 0
let player: ReturnType<typeof createAudioPlayer> | null = null

function ensurePlayer(): ReturnType<typeof createAudioPlayer> {
  if (!player) player = createAudioPlayer(null)
  return player
}

function playAsset(source: number): void {
  const p = ensurePlayer()
  // expo-audio 没有 stop():换曲前 pause + 归零头为等价写法(对齐 AigcListScreen 既有处置)。
  p.pause()
  void p.seekTo(0)
  p.replace(source)
  p.play()
}

/**
 * 播放指定铃声(通知链路用)。
 * @returns 是否真的发起了播放;被去抖拦下返回 false
 */
export function playRingtone(id?: unknown): boolean {
  const now = Date.now()
  if (now - lastPlayedAt < MIN_PLAY_INTERVAL_MS) return false
  const source = RINGTONE_ASSETS[resolveRingtoneId(id)]
  try {
    playAsset(source)
    lastPlayedAt = now
    return true
  } catch {
    // 播放失败静默:不阻塞通知链路,也不把音频异常抛进收帧 effect
    return false
  }
}

/**
 * 试听:用户在设置页主动点击,必须绕过去抖 —— 否则连点几个铃声只有第一个响得出来。
 * 试听后照常记录播放时刻,避免试听刚结束就收到通知又叠响一次。
 */
export function previewRingtone(id?: unknown): boolean {
  lastPlayedAt = 0
  return playRingtone(id)
}

/**
 * 仅供测试:清掉模块级播放时刻、播放器单例与缓存镜像,保证用例之间互不串扰。
 * 产品代码不得调用。
 */
export function __resetInternalsForTest(): void {
  ringtoneCache = null
  soundEnabledCache = null
  lastPlayedAt = 0
  player = null
}

/* -------------------------------------------------------------------------- */
/* 通知 id 去重工厂:同一 id 只响一次                                            */
/* -------------------------------------------------------------------------- */

/**
 * 按通知 id 去重。ws.lastMessage 在多次渲染中重复出现,若不按 id 收口,
 * 同一条通知会响多次;返回的 shouldRing 对新 id 放行,重复 id 拦下。
 * 无 id 的帧(null/空)每次放行,不参与去重。
 */
export function createRingtoneDedupe(): { shouldRing: (id: string | null) => boolean } {
  const seen = new Set<string>()
  return {
    shouldRing(id: string | null): boolean {
      if (id === null || id === undefined) return true
      if (seen.has(id)) return false
      seen.add(id)
      return true
    },
  }
}

/* -------------------------------------------------------------------------- */
/* 内部帧判定:与 web 端 NON_NOTIFICATION_TYPES 同源口径                          */
/* -------------------------------------------------------------------------- */

/**
 * AI 操控指令 / 对话同步帧不是"给用户看的通知",响铃只会造成噪音。
 * 与 `apps/web/src/hooks/use-notification.ts` 的排除清单保持一致。
 */
const NON_NOTIFICATION_TYPES = ['ai_response', 'chat_message', 'agent.action']

interface NotificationFrameLike {
  type?: string
  data?: { id?: unknown; type?: unknown } | null
}

/**
 * 判断一封 WS 帧是否属于"用户可见通知"。
 * `false` 时不应入通知列表,也不应响铃。
 */
export function isUserVisibleNotification(msg: NotificationFrameLike | null | undefined): boolean {
  if (!msg || msg.type !== 'notification' || !msg.data) return false
  const dataType = typeof msg.data.type === 'string' ? msg.data.type : ''
  return !NON_NOTIFICATION_TYPES.includes(dataType)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
