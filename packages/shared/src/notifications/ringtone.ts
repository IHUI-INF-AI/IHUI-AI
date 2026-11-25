// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 通知铃声单一真相源(纯数据 + 纯映射,2026-11-26 立;2026-11-26 拆出 WebAudio 半)。
 *
 * 纪律:本模块**不得出现** `window` / `AudioContext` / `webkitAudioContext` 等浏览器全局名,
 * 也不引用 lib.dom 类型(`Storage`/`AudioContext` 名字一出现,node 端 api tsc 在无 DOM lib
 * 下就会 TS2304/TS2552)。本地存储通过 `globalThis` 探测 + 本文件内最小结构类型访问;
 * WebAudio 实时合成在 `./ringtone-web`。
 *
 * 设计取舍:
 * - 铃声是一组「音符序列」(freq/start/dur/gain),不是外部 mp3。所有端都从本文件的
 *   同一张表取值:web 由 ringtone-web 走浏览器 WebAudio 实时合成,RN/小程序播放由
 *   `scripts/gen-ringtone-assets.mjs` 从同一张表渲染出的 WAV(采样率/包络/泛音同源),
 *   三端听感不会漂。
 * - 不使用任何第三方成品音源:微信/QQ/苹果/诺基亚的提示音都是有版权的音效,
 *   直接内置 = 侵权。这里全部是自制合成音,只在「品类」上贴近大众熟悉的听感
 *   (门铃、水滴、气泡、木琴…),没有任何一段采样来自其他产品。
 */

export type RingtoneId =
  | 'dingdong'
  | 'tritone'
  | 'waterdrop'
  | 'doublebell'
  | 'bubble'
  | 'marimba'
  | 'chime'
  | 'knock'

/** 单个音符:start/dur 单位秒,freq 单位 Hz,gain 为相对音量(0-1) */
export interface RingtoneNote {
  freq: number
  start: number
  dur: number
  gain?: number
}

export interface RingtoneSpec {
  id: RingtoneId
  /** 该序列总时长(秒),供资产渲染与试听进度判断 */
  duration: number
  notes: RingtoneNote[]
}

/**
 * 8 个铃声。名字与序列刻意做成大众熟悉的品类:
 * 门铃「叮—咚」、上扬三音、水滴、双响清脆铃、气泡三连、木琴、和弦铃、轻敲两下。
 * 改动任何 freq/dur 都会同时改变三端听感 —— 必须先跑 gen-ringtone-assets 重出资产。
 */
export const RINGTONES: readonly RingtoneSpec[] = [
  {
    id: 'dingdong',
    duration: 0.95,
    notes: [
      { freq: 659.25, start: 0, dur: 0.3, gain: 0.72 },
      { freq: 523.25, start: 0.34, dur: 0.55, gain: 0.58 },
    ],
  },
  {
    id: 'tritone',
    duration: 0.66,
    notes: [
      { freq: 440, start: 0, dur: 0.13, gain: 0.6 },
      { freq: 493.88, start: 0.15, dur: 0.13, gain: 0.62 },
      { freq: 587.33, start: 0.3, dur: 0.32, gain: 0.55 },
    ],
  },
  {
    id: 'waterdrop',
    duration: 0.3,
    notes: [
      { freq: 1500, start: 0, dur: 0.07, gain: 0.45 },
      { freq: 900, start: 0.07, dur: 0.2, gain: 0.4 },
    ],
  },
  {
    id: 'doublebell',
    duration: 0.5,
    notes: [
      { freq: 1046.5, start: 0, dur: 0.1, gain: 0.55 },
      { freq: 1046.5, start: 0.15, dur: 0.1, gain: 0.5 },
      { freq: 1318.5, start: 0.3, dur: 0.19, gain: 0.45 },
    ],
  },
  {
    id: 'bubble',
    duration: 0.32,
    notes: [
      { freq: 700, start: 0, dur: 0.07, gain: 0.5 },
      { freq: 900, start: 0.09, dur: 0.07, gain: 0.52 },
      { freq: 1150, start: 0.18, dur: 0.1, gain: 0.48 },
    ],
  },
  {
    id: 'marimba',
    duration: 0.5,
    notes: [
      { freq: 523.25, start: 0, dur: 0.13, gain: 0.6 },
      { freq: 783.99, start: 0.17, dur: 0.3, gain: 0.5 },
    ],
  },
  {
    id: 'chime',
    duration: 0.6,
    notes: [
      { freq: 880, start: 0, dur: 0.5, gain: 0.4 },
      { freq: 1174.66, start: 0.02, dur: 0.45, gain: 0.28 },
      { freq: 1318.51, start: 0.04, dur: 0.42, gain: 0.24 },
    ],
  },
  {
    id: 'knock',
    duration: 0.34,
    notes: [
      { freq: 180, start: 0, dur: 0.07, gain: 0.45 },
      { freq: 180, start: 0.13, dur: 0.07, gain: 0.45 },
    ],
  },
] as const

export const DEFAULT_RINGTONE_ID: RingtoneId = 'dingdong'

export const RINGTONE_IDS: readonly RingtoneId[] = RINGTONES.map((r) => r.id)

const RINGTONE_ID_SET = new Set<string>(RINGTONE_IDS)

/** 把任意存储值收敛成合法铃声 id;未知/空值一律回落默认,绝不留下"选了但播不出来"的状态 */
export function resolveRingtoneId(raw: unknown): RingtoneId {
  return typeof raw === 'string' && RINGTONE_ID_SET.has(raw)
    ? (raw as RingtoneId)
    : DEFAULT_RINGTONE_ID
}

export function getRingtone(id: unknown): RingtoneSpec {
  const resolved = resolveRingtoneId(id)
  return RINGTONES.find((r) => r.id === resolved) ?? RINGTONES[0]!
}

/* -------------------------------------------------------------------------- */
/* 本地存储:铃声选择在设备本地先落一份,后端 user_preferences 是跨端同步真相源  */
/* -------------------------------------------------------------------------- */

const RINGTONE_STORAGE_KEY = 'ihui-notification-ringtone'

/** 最小本地存储结构:只声明本文件用到的两个方法,不引用 lib.dom 的 Storage 类型 */
interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

/**
 * 从 globalThis 探测本地存储(不引用浏览器全局存储裸名,也不判 typeof 全局存储)。
 * 不存在(RN/小程序/SSR/无存储环境)时返回 null,调用方按兜底处理。
 */
function resolveStorageLike(): StorageLike | null {
  const g = globalThis as { localStorage?: StorageLike }
  return g.localStorage ?? null
}

export function readStoredRingtoneId(): RingtoneId {
  const storage = resolveStorageLike()
  if (!storage) return DEFAULT_RINGTONE_ID
  try {
    return resolveRingtoneId(storage.getItem(RINGTONE_STORAGE_KEY))
  } catch {
    return DEFAULT_RINGTONE_ID
  }
}

export function writeStoredRingtoneId(id: RingtoneId): void {
  const storage = resolveStorageLike()
  if (!storage) return
  try {
    storage.setItem(RINGTONE_STORAGE_KEY, resolveRingtoneId(id))
  } catch {
    // 隐私模式/配额满:静默,后端仍会存
  }
}

/* -------------------------------------------------------------------------- */
/* Android 通知渠道 / 音源映射(2026-11-26 立):App 不在前台时也按用户所选铃声响  */
/* -------------------------------------------------------------------------- */

/**
 * Android 通知渠道 id:一个铃声一条 channel(`msg-<id>`)。
 *
 * 为什么不是"一条 channel 改 sound":Android 的 NotificationChannel 一旦创建,
 * sound / importance 就不可再改(改也只在卸载重装后才生效)。所以"按 id 分 channel"
 * 是唯一能让用户切换铃声立刻生效的形态 —— 客户端启动时预建全部 8 条,
 * 服务端只按收件人的偏好把 channel_id 指过去。渠道 id 与音源名必须由本文件派生,
 * 不允许任何端另抄一张表(抄了必然与音频资产漂移)。
 */
export function androidChannelIdFor(id: unknown = DEFAULT_RINGTONE_ID): string {
  return `msg-${resolveRingtoneId(id)}`
}

/**
 * res/raw 里的音源名(**不含扩展名**):Android 资源标识符只允许 `[a-z0-9_]`,
 * 因此 `ringtone-dingdong.wav` 必须落成 `ringtone_dingdong.wav`,引用时写
 * `ringtone_dingdong`。资产本身与 web/RN 播放的是同一份 wav,改名只发生在这一个映射里。
 */
export function androidSoundAssetFor(id: unknown = DEFAULT_RINGTONE_ID): string {
  return `ringtone_${resolveRingtoneId(id)}`
}

/** 8 条渠道全表(客户端预建用),顺序与 RINGTONES 一致 */
export const ANDROID_RINGTONE_CHANNELS: readonly {
  id: RingtoneId
  channelId: string
  sound: string
}[] = RINGTONE_IDS.map((id) => ({
  id,
  channelId: androidChannelIdFor(id),
  sound: androidSoundAssetFor(id),
}))

/**
 * 静音渠道:用户在设置页关掉"通知声音"后,后台推送必须仍然送达但不出声 ——
 * 走一条独立的 channel(`sound: null`),而不是把他所有渠道的 sound 清掉
 * (Android 渠道创建后改不动,清不掉就是"关了还在响")。
 */
export const ANDROID_SILENT_CHANNEL_ID = 'msg-silent'

/** 兜底渠道:与 use-push 里历史那条 `default` 同名,读不到偏好时沿用旧行为 */
export const ANDROID_DEFAULT_CHANNEL_ID = 'default'

export interface AndroidNotificationTarget {
  /** 下发给 FCM 的 `message.android.notification.channel_id` */
  channelId: string
  /** res/raw 音源名(不含扩展名);静音渠道不带 sound */
  sound?: string
}

/**
 * 把用户的通知偏好收敛成一个 Android 投递目标(单一真相源:客户端建渠道、服务端定 channel_id
 * 都只认这一条规则)。
 * - `soundEnabled` 明确为假(false / 'false' / '0') ⇒ 静音渠道,不出声但仍送达;
 * - 其余 ⇒ 按 `ringtone` 落到 `msg-<id>` + `ringtone_<id>`;非法/缺失一律回落默认铃声,
 *   绝不因为偏好读不出来就不推送。
 */
export function resolveAndroidNotificationTarget(prefs: {
  ringtone?: unknown
  soundEnabled?: unknown
}): AndroidNotificationTarget {
  const rawEnabled = prefs.soundEnabled
  const soundEnabled = !(rawEnabled === false || rawEnabled === 'false' || rawEnabled === '0')
  if (!soundEnabled) return { channelId: ANDROID_SILENT_CHANNEL_ID }
  const id = resolveRingtoneId(prefs.ringtone)
  return { channelId: androidChannelIdFor(id), sound: androidSoundAssetFor(id) }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
