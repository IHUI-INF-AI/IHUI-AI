// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 免点击安装的 JS 侧编排(2026-11-05 立,机主:「都不行」但仍要「完全自动」)。
 *
 * 分工:
 *   · lib/apk-update.ts 仍是唯一下载/安装状态机,本文件不复制任何下载逻辑;
 *   · 本文件只回答两个问题:① 这一轮该不该"不等人点"就自动开始;② 怎么把用户送到
 *     无障碍服务的启用页(那是整条链唯一需要人做一次的动作)。
 *
 * 为什么默认自动而不是让用户选:机主要的就是"代码更新后什么都不点"。但整包 ~80MB,
 * 所以加了 12 小时节流 —— 同一份更新反复自动拉起安装器只会让人以为 App 在抽风
 * (装完后版本号已变,正常情况下不会再命中;节流防的是"用户取消安装后每次进前台都再来一遍")。
 *
 * 与 OTA 的关系:OTA 就绪(ready)时跳过 APK 自动安装 —— 那一轮 JS 已经在下次冷启动生效,
 * 再去下 80MB 属于白耗流量(见 UpdatePrompt 的调用点)。
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { NativeModules, Platform } from 'react-native'
import { applyApkUpdate, apkSnapshot } from './apk-update'
import { otaSnapshot } from './ota-update'

const LAST_AUTO_APPLY_KEY = 'ihui:apk:auto-apply-at'
/** 同一份更新 12 小时内只自动拉起一次安装器(用户取消后不反复打扰)。 */
const AUTO_APPLY_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000

/**
 * 若当前有可用更新且不在节流窗口内,直接开始"下载 → 拉起安装器"。
 *
 * 不抛异常:自动路径失败只落回状态机(卡片会显示 error),绝不因为自动化把更新检查本身搞崩。
 * @returns 是否真的发起了自动安装。
 */
export async function tryAutoApplyApk(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  const apk = apkSnapshot()
  if (apk.state !== 'available') return false
  // OTA 已就绪时不必再整包(那一份 JS 下次冷启动就生效)
  if (otaSnapshot().state === 'ready') return false

  try {
    const raw = await AsyncStorage.getItem(LAST_AUTO_APPLY_KEY)
    const last = raw ? Number(raw) : 0
    if (Number.isFinite(last) && Date.now() - last < AUTO_APPLY_MIN_INTERVAL_MS) return false
    await AsyncStorage.setItem(LAST_AUTO_APPLY_KEY, String(Date.now()))
  } catch {
    // 存储不可用时不阻塞更新(宁可多试一次,也不要让自动安装永远不触发)
  }

  await applyApkUpdate()
  return true
}

/** 打开系统的无障碍服务列表,让用户为本应用一次性启用「IHUI 自动安装」。 */
export async function openAutoInstallSettings(): Promise<void> {
  if (Platform.OS !== 'android') return
  try {
    // 延迟解析:expo-intent-launcher 在模块求值期就会加载 expo-modules-core,
    // 而后者读 `globalThis.expo.EventEmitter` —— vitest 里这个全局不存在,任何顶层
    // import 都会让加载它的整套件收集期直接崩(2026-11-05 实测 app-root / video-immersive 两套)。
    // 只有"用户真点了去开启"才需要这个原生能力,所以放到调用时再取。
    const IntentLauncher = await import('expo-intent-launcher')
    await IntentLauncher.startActivityAsync('android.settings.ACCESSIBILITY_SETTINGS')
  } catch {
    /* 个别 ROM 没有该入口时静默失败,由设置页文案兜底(手动到「设置 → 无障碍」) */
  }
}

// =============================================================================
// 真实状态检测(2026-11-23 立:把"用户说开过了"换成"系统说真的在跑")
// =============================================================================
/**
 * 三态口径(缺一不可):
 *   · enabled=true  ⇒ 服务被系统实际绑定,引导永久不再出现;
 *   · enabled=false ⇒ 确实没开,该引导(包括 Android 13+ 被锁住时给两步引导);
 *   · enabled=null  ⇒ 当前安装包没带原生模块(旧包)或非 Android —— **绝不冒充已开启**。
 *
 * restrictedRisk 同理:true 才是"Android 13+ 因安装来源被「受限制的设置」锁住",
 * false/null 都不能拿来吓用户(实测 adb 覆盖安装后同一开关立刻变 On)。
 */
export interface AutoInstallStatus {
  enabled: boolean | null
  package: string | null
  installer: string | null
  restrictedRisk: boolean | null
  sdkInt: number | null
  source: 'native' | 'unavailable'
}

const NATIVE_STATUS_MODULE = 'AutoInstallStatus'

interface AutoInstallStatusNative {
  getStatus?: () => Promise<unknown>
}

function lookupStatusModule(): AutoInstallStatusNative | null {
  try {
    const mod = (NativeModules as Record<string, unknown> | undefined)?.[NATIVE_STATUS_MODULE]
    if (!mod || typeof mod !== 'object') return null
    const getStatus = (mod as AutoInstallStatusNative).getStatus
    return typeof getStatus === 'function' ? (mod as AutoInstallStatusNative) : null
  } catch {
    return null
  }
}

/** 纯函数:把原生回包清洗成三态。字段缺失一律 null —— 读不到 ≠ 没开。 */
export function normalizeAutoInstallStatus(
  raw: unknown,
  sdkIntFallback: number | null = null,
): AutoInstallStatus {
  const r = (raw ?? {}) as Record<string, unknown>
  const asBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null)
  const asText = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null
  const asInt = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null
  return {
    enabled: asBool(r.enabled),
    package: asText(r.package),
    installer: asText(r.installer),
    restrictedRisk: asBool(r.restrictedRisk),
    sdkInt: asInt(r.sdkInt) ?? sdkIntFallback,
    source: 'native',
  }
}

function unavailableStatus(): AutoInstallStatus {
  return {
    enabled: null,
    package: null,
    installer: null,
    restrictedRisk: null,
    sdkInt: typeof Platform.Version === 'number' ? Math.trunc(Platform.Version) : null,
    source: 'unavailable',
  }
}

/** 当前安装包是否带精确读数能力(旧包/非 Android 为 false)。 */
export function hasAutoInstallStatusModule(): boolean {
  return Platform.OS === 'android' && lookupStatusModule() !== null
}

/** 读真实状态;读不到一律返回 unknown,不抛异常。 */
export async function getAutoInstallStatus(): Promise<AutoInstallStatus> {
  if (Platform.OS !== 'android') return unavailableStatus()
  const mod = lookupStatusModule()
  if (!mod?.getStatus) return unavailableStatus()
  try {
    const raw: unknown = await mod.getStatus()
    // 诊断(2026-11-23):原生两条判据(settings / AMS)各自读到的原始值只进 logcat ——
    // 排查「设置里明明开着、App 却读成没开」时,`adb logcat -s ReactNativeJS | grep ihui-auto-install` 一眼可判。
    if (typeof console !== 'undefined' && raw && typeof raw === 'object') {
      console.info('[ihui-auto-install:raw]', JSON.stringify(raw))
    }
    return normalizeAutoInstallStatus(
      raw,
      typeof Platform.Version === 'number' ? Math.trunc(Platform.Version) : null,
    )
  } catch {
    return unavailableStatus()
  }
}

/** 「我已开启」的真实检测:null = 读不到,不能用"没读到"判"没开"。 */
export async function verifyAutoInstallEnabled(): Promise<boolean | null> {
  return (await getAutoInstallStatus()).enabled
}

/** 打开本应用的系统「应用信息」页(Android 13+ 解除受限设置的第一步)。 */
export async function openAppDetailsSettings(packageName?: string | null): Promise<void> {
  if (Platform.OS !== 'android') return
  const pkg = typeof packageName === 'string' ? packageName.trim() : ''
  try {
    const IntentLauncher = await import('expo-intent-launcher')
    await IntentLauncher.startActivityAsync(
      'android.settings.APPLICATION_DETAILS_SETTINGS',
      pkg ? { data: `package:${pkg}` } : undefined,
    )
  } catch {
    /* 个别 ROM 没有该入口时静默失败,由文案兜底 */
  }
}

/**
 * 智能入口:受限风险时先送「应用信息」页(只有那里有"允许受限制的设置"),
 * 否则直达无障碍列表。引导卡与设置页共用这一个出口,避免两处各判一次。
 */
export async function openAutoInstallSettingsSmart(): Promise<'app-details' | 'accessibility'> {
  const status = await getAutoInstallStatus()
  if (status.restrictedRisk === true) {
    await openAppDetailsSettings(status.package)
    return 'app-details'
  }
  await openAutoInstallSettings()
  return 'accessibility'
}

const GUIDE_KEY = 'ihui:a11y:guide-ack-at'
/** 引导卡:点过「已开启/稍后」后 7 天内不再打扰(没开成也不会天天糊脸)。 */
const GUIDE_RESURFACE_MS = 7 * 24 * 60 * 60 * 1000

/** 无障碍服务用途说明的明示同意(2026-11-18 立):没同意过就不跳系统设置。 */
const CONSENT_KEY = 'ihui:a11y:consent-at'

/** 是否已就「无障碍服务用途」给出明示同意。 */
export async function hasA11yConsent(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY)
    const at = raw ? Number(raw) : 0
    return Number.isFinite(at) && at > 0
  } catch {
    return false
  }
}

/** 记下用户对用途说明的明示同意(点「同意并去开启」时调用)。 */
export async function grantA11yConsent(): Promise<void> {
  try {
    await AsyncStorage.setItem(CONSENT_KEY, String(Date.now()))
  } catch {
    /* 存不下就下次再问一次,绝不按"已同意"处理 */
  }
}

/**
 * 该不该弹"开启自动安装"的引导。
 *
 * 2026-11-23 改口径:先读系统真实状态 —— 服务已经在跑就**永不打扰**(旧实现只能看
 * "用户确认过",于是开好了还照样弹);读不到 / 确实没开时才走 7 天节流。
 * 读不到时宁可多弹一次也不假装已开启:假绿会让用户以为自动安装在生效,实际每次都停在安装器。
 */
export async function shouldShowAutoInstallGuide(): Promise<boolean> {
  if (Platform.OS !== 'android') return false
  const status = await getAutoInstallStatus()
  if (status.enabled === true) return false
  try {
    const raw = await AsyncStorage.getItem(GUIDE_KEY)
    const at = raw ? Number(raw) : 0
    if (!Number.isFinite(at) || at <= 0) return true
    return Date.now() - at >= GUIDE_RESURFACE_MS
  } catch {
    return false
  }
}

/** 记下"用户已处理过引导"(点了去开启或我已开启都算),避免每次冷启动都弹。 */
export async function ackAutoInstallGuide(): Promise<void> {
  try {
    await AsyncStorage.setItem(GUIDE_KEY, String(Date.now()))
  } catch {
    /* 存储不可用时下次再弹一次,不阻断主流程 */
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
