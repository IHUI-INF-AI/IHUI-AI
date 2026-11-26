// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序端通知铃声播放库(2026-11-26 立)。
 *
 * 与 web/RN 同一张音符表(单一真相源 `@ihui/shared/notifications/ringtone`),本端只负责
 * 把同源渲染出的 8 个包内 WAV 用 InnerAudioContext 播出来:
 * - 选中铃声 / 声音开关每次收帧**现读** Taro storage,不在模块加载时固化;
 * - 单实例复用防叠加;后台被系统回收 / 音源失效时 onError 静默销毁,下一条通知重建;
 * - 连发去抖 1200ms;试听(用户主动点)绕过去抖;
 * - 任何播放失败都静默,绝不阻塞通知链路。
 *
 * 版权红线:8 个音全部为自制合成音,不含微信/QQ/苹果/诺基亚等任何成品采样。
 */
import Taro from '@tarojs/taro'
import {
  DEFAULT_RINGTONE_ID,
  resolveRingtoneId,
  type RingtoneId,
} from '@ihui/shared/notifications/ringtone'
import { NOTIFICATION_RINGTONE_KEY, NOTIFICATION_SOUND_ENABLED_KEY } from '@/constants/storage'

/** 连发去抖窗口:短时间连炸只响一次(与 web/RN 同口径 1200ms) */
const MIN_PLAY_INTERVAL_MS = 1200

/**
 * 包内铃声资产路径(scripts/gen-ringtone-assets.mjs 从同一音符表渲染)。
 * 小程序端主包受 2 MiB 硬限,8 枚铃声单独编码 MP3(见生成脚本头注);web/RN 仍用 WAV。
 */
function ringtoneSrc(id: RingtoneId): string {
  return `/static/sounds/ringtone-${id}.mp3`
}

/* -------------------------------------------------------------------------- */
/* 本地存储:后端 user_preferences(group=notifications)是跨端真相源,本地仅作缓存  */
/* -------------------------------------------------------------------------- */

/** 读取当前选中铃声;未知/空值一律回落默认,绝不留下"选了但播不出"的状态 */
export function readStoredRingtoneId(): RingtoneId {
  try {
    return resolveRingtoneId(Taro.getStorageSync(NOTIFICATION_RINGTONE_KEY))
  } catch {
    return DEFAULT_RINGTONE_ID
  }
}

/** 写入选中铃声本地缓存(后端由设置页另行 PUT) */
export function writeStoredRingtoneId(id: RingtoneId): void {
  try {
    Taro.setStorageSync(NOTIFICATION_RINGTONE_KEY, resolveRingtoneId(id))
  } catch {
    // 配额满 / 隐私模式:静默,后端仍会存
  }
}

/**
 * 声音开关:未设置 / 空值 / 非否定字面量一律视为**开启**(默认开,登录后收到新消息就响)。
 * 只有显式存 `'0'` / `'false'` 才静音;历史"关闭即删键"的写法在默认开启下会被吃掉,故关闭必须留值。
 */
export function isSoundEnabled(): boolean {
  let raw: unknown
  try {
    raw = Taro.getStorageSync(NOTIFICATION_SOUND_ENABLED_KEY)
  } catch {
    return true
  }
  if (typeof raw !== 'string') return true
  const normalized = raw.trim().toLowerCase()
  return normalized !== '0' && normalized !== 'false'
}

/** 写声音开关本地缓存(后端由设置页 PUT `soundEnabled` 同步) */
export function setSoundEnabled(enabled: boolean): void {
  try {
    Taro.setStorageSync(NOTIFICATION_SOUND_ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    // 配额满 / 隐私模式:静默
  }
}

/**
 * 后端通知偏好(跨端真相源)归一化到本地缓存。**只在网络拉取成功后调用**:
 * 拉取失败不得走这里,否则会把"接口失败"误当成"后端没设过"去覆盖本地已有值。
 *
 * 极性:
 * - soundEnabled:`'0'` / `'false'` → 关闭(写 `'0'`);`'1'` / `'true'` / 无该键 / 空 → 开启(写 `'1'`)。
 * - ringtone:有键才回写本地并经 `resolveRingtoneId` 收敛;无键保留本地已有选择。
 */
export function hydrateFromServerSettings(
  settings: Record<string, string | undefined> | undefined,
): void {
  const rawSound = settings?.soundEnabled
  const soundEnabled =
    rawSound === undefined || rawSound === null
      ? true
      : rawSound.trim().toLowerCase() !== '0' && rawSound.trim().toLowerCase() !== 'false'
  setSoundEnabled(soundEnabled)

  const rawRingtone = settings?.ringtone
  if (typeof rawRingtone === 'string' && rawRingtone) {
    writeStoredRingtoneId(resolveRingtoneId(rawRingtone))
  }
}

/* -------------------------------------------------------------------------- */
/* 播放器:单实例复用防叠加;失败静默                                            */
/* -------------------------------------------------------------------------- */

let sharedCtx: Taro.InnerAudioContext | null = null
let lastPlayedAt = 0

function destroyContext(): void {
  if (sharedCtx) {
    try {
      sharedCtx.destroy()
    } catch {
      // 销毁失败不影响下次重建
    }
  }
  sharedCtx = null
}

function ensureContext(): Taro.InnerAudioContext | null {
  if (sharedCtx) return sharedCtx
  try {
    const ctx = Taro.createInnerAudioContext()
    ctx.onError(() => {
      // 后台被回收 / 音源失效:销毁实例,下一条通知重建;不阻塞通知链路
      destroyContext()
    })
    sharedCtx = ctx
    return ctx
  } catch {
    return null
  }
}

function play(id: RingtoneId, bypassDebounce: boolean): boolean {
  const now = Date.now()
  if (!bypassDebounce && now - lastPlayedAt < MIN_PLAY_INTERVAL_MS) return false
  const ctx = ensureContext()
  if (!ctx) return false
  try {
    ctx.stop()
    ctx.src = ringtoneSrc(id)
    ctx.play()
    lastPlayedAt = now
    return true
  } catch {
    destroyContext()
    return false
  }
}

/**
 * 通知链路播放:现读声音开关 + 现读选中铃声。
 * 开关关闭 / 被去抖拦下 / 无可用音频实例时返回 false,不抛错。
 */
export function playNotificationRingtone(): boolean {
  if (!isSoundEnabled()) return false
  return play(readStoredRingtoneId(), false)
}

/**
 * 试听:用户在设置页主动点「试听」必须立刻出声,绕开 1200ms 去抖 ——
 * 否则连点几个铃声只有第一个响得出来。试听后照常记录时刻,避免刚试听完又叠响通知铃。
 */
export function previewRingtone(id: unknown = DEFAULT_RINGTONE_ID): boolean {
  lastPlayedAt = 0
  return play(resolveRingtoneId(id), true)
}

/** 测试面:复位模块级播放器与去抖时刻(存储由用例内的 Taro mock 控制) */
export const __test__ = {
  resetForTest(): void {
    destroyContext()
    lastPlayedAt = 0
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
