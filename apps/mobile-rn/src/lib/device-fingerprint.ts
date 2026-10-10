// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 平台特有:依赖 React Native API(Platform / Dimensions / PixelRatio / I18nManager),不适合共享
import { Dimensions, I18nManager, PixelRatio, Platform } from 'react-native'
import { modelId as deviceModelId } from 'expo-device'
import { createDeviceFingerprintCollector, type DeviceFingerprintInput } from '@ihui/types'

/**
 * mobile-rn 端设备指纹采集器(React Native)。
 *
 * 原实现只喂 `platform: Platform.OS` 一个字段 ⇒ 全网 iPhone 得到同一个 hash、全网 Android
 * 得到同一个 hash,而该列是 `user_devices` 的 (userId, fingerprintHash) 唯一键,并被审计 /
 * 支付风控 / 异常检测当设备标识消费 ⇒ "新设备登录"检测与设备维度风控在 RN 端结构性失效
 * (台账实测:`platform:'ios'` 与 `'android'` 各只有一个值)。
 *
 * 补采口径(不新增依赖,AGENTS §3):
 * - `platform`:Android 用 `Brand-Model-android-APILevel`(`Platform.constants` 内建即有);
 *   iOS 用 `expo-device` 的 `modelId` 拼成 `ios-<model>-<osVersion>`(expo-device 是本端既有依赖,
 *   src/hooks/use-push.ts 已在用)。取不到机型(模拟器 / web / 原生未就绪)就**不填机型段**,
 *   退回 `ios-<osVersion>` 并由 `screen` 段承担机型区分 —— 拿不到的段就不填(契约允许按可用性采集)。
 * - `screen`:物理像素 = dp × `PixelRatio`,`colorDepth` 用 `pixelRatio * 8` 估算 —— **与 miniapp
 *   的 `taroDeviceFingerprintCollector` 同一估算口径**(契约里已登记该口径与 web 端不同源)。
 * - `timezone` / `language`:走 `Intl` 与 `I18nManager`,取不到就跳过。
 *
 * `hardwareConcurrency` / `deviceMemory` / `canvas` / `webgl`:RN 无对应内建 API,不采集。
 */

function readAndroidModel(): string | null {
  const c = Platform.constants
  if (!c || !('Brand' in c) || !('Model' in c)) return null
  const brand = typeof c.Brand === 'string' ? c.Brand.trim() : ''
  const model = typeof c.Model === 'string' ? c.Model.trim() : ''
  if (!brand || !model) return null
  const api = 'API Level' in c && typeof c['API Level'] === 'number' ? String(c['API Level']) : ''
  return api ? `${brand}-${model}-android-${api}` : `${brand}-${model}-android`
}

function readIosModel(): string | null {
  // modelId 是厂商机型标识(iPhone16,2),用户改设备名不影响它;modelName 会变 ⇒ 指纹取 modelId
  const raw: unknown = deviceModelId
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

function readPlatformToken(): string {
  if (Platform.OS === 'android') {
    const model = readAndroidModel()
    if (model) return model
  }
  const version =
    typeof Platform.Version === 'number' ? String(Platform.Version) : String(Platform.Version ?? '')
  if (Platform.OS === 'ios') {
    const model = readIosModel()
    if (model) return version ? `${Platform.OS}-${model}-${version}` : `${Platform.OS}-${model}`
  }
  return version ? `${Platform.OS}-${version}` : Platform.OS
}

function readScreen(): DeviceFingerprintInput['screen'] {
  try {
    const { width, height } = Dimensions.get('screen')
    const scale = PixelRatio.get()
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      return undefined
    const px = (v: number): number =>
      Math.round(v * (Number.isFinite(scale) && scale > 0 ? scale : 1))
    return { width: px(width), height: px(height), colorDepth: px(scale) }
  } catch {
    return undefined
  }
}

function readTimezone(): string | undefined {
  try {
    const tz = new Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof tz === 'string' && tz.trim() ? tz.trim() : undefined
  } catch {
    return undefined
  }
}

function readLanguage(): string | undefined {
  // 唯一类型化出口是 I18nManager.getConstants().localeIdentifier(直接读 I18nManager.localeIdentifier
  // 在 RN 0.8x 的 .d.ts 里不存在 —— 那会是一处 TS2339,不是"更简洁的写法")。
  try {
    const id = I18nManager.getConstants().localeIdentifier
    if (typeof id === 'string' && id.trim()) return id.trim()
  } catch {
    /* 落到 Intl 那条 */
  }
  try {
    const loc = new Intl.NumberFormat().resolvedOptions().locale
    return typeof loc === 'string' && loc.trim() ? loc.trim() : undefined
  } catch {
    return undefined
  }
}

export const mobileRnDeviceFingerprintCollector = createDeviceFingerprintCollector({
  collect: (): DeviceFingerprintInput => {
    const input: DeviceFingerprintInput = { platform: readPlatformToken() }
    const screen = readScreen()
    if (screen) input.screen = screen
    const timezone = readTimezone()
    if (timezone) input.timezone = timezone
    const language = readLanguage()
    if (language) input.language = language
    return input
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
