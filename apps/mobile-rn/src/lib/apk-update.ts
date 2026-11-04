// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * APK 整包更新(2026-11-04 立,机主原话:「程序内推更新按钮 下载更新自动拉起安装」)。
 *
 * 为什么要有这一层(与 lib/ota-update.ts 的分工,别混):
 *   - OTA(expo-updates)换的是 **JS bundle**,只能改界面与逻辑,改不了原生面(权限/清单/原生模块);
 *   - APK 换的是**整个安装包**,能带新的原生能力,但代价是 ~90MB 下载 + 系统安装器。
 *   所以两条通道**并列共存、互不替代**:有 JS 热更先吃热更(秒级、免安装),升原生面才走 APK。
 *
 * 机主 2026-11-04 第二条硬约束是「不允许再出现编译这么久了」⇒ 本模块的存在前提是
 * **平时永远用不到它**:日常改样式/改逻辑走 Metro 热更 + OTA,只有发新版原生包时才让用户
 * 在应用内点一下完成升级,不必再插数据线重编。
 *
 * 三条设计红线(都是为了不把"升级"做成"打不开"):
 *   1. **绝不自动下载**:OTA 的 bundle 几 MB 可以静默拉,APK 是 ~90MB,静默下载 = 偷跑用户流量。
 *      本模块只自动**检查**,下载必须由用户点按触发。
 *   2. **能力缺失要降级,不能报错**:应用内直装依赖原生意图(见 lookupIntentLauncher),
 *      原生模块不在(还没重编包的旧版本)时自动退到"浏览器下载安装",而不是给用户一个
 *      按了没反应的按钮。
 *   3. **判据不认服务端单方面结论**:/api/app-version/check-update 的 hasUpdate 是拿
 *      `latest.buildNumber > 当前版本记录.buildNumber` 算的,而"当前版本"是按 version 字符串
 *      回查版本表 —— 本地构建/未登记的版本号查不到 ⇒ currentBuild 记 0 ⇒ 任何 latest 行都会
 *      被判成"有更新"。所以客户端必须自己再比一次版本号(compareVersions),两边都成立才算更新。
 *
 * 状态口径与 ota-update 对齐(idle/checking/up-to-date/available/downloading/installing/error/
 * unsupported),差别只在于"就绪"叫 available —— APK 没有静默预下载,"就绪"本身没有内容。
 */

import { Linking, Platform } from 'react-native'
import { useSyncExternalStore } from 'react'
import * as FileSystem from 'expo-file-system/legacy'
import { checkAppVersion } from '@ihui/api-client'
import {
  createSpeedMeter,
  downloadRanged,
  DownloadCancellation,
  DownloadCancelledError,
} from './ranged-download'
import { APP_USER_AGENT, APP_VERSION } from './config'

export type ApkUpdateState =
  | 'idle'
  /** 正在问服务端 latest 版本 */
  | 'checking'
  /** 服务端说没有比当前更新的包 */
  | 'up-to-date'
  /** 有更新,等用户点"下载并安装"(绝不自动下) */
  | 'available'
  | 'downloading'
  /** 已把安装交给系统(应用内直装)或浏览器(降级) */
  | 'installing'
  | 'error'
  /** 非 Android(web/iOS 装不了 APK) */
  | 'unsupported'

/** 安装入口:应用内直装 / 浏览器降级。文案与排查都靠它区分,不靠猜。 */
export type ApkInstallMode = 'in-app' | 'browser' | null

export interface ApkStore {
  state: ApkUpdateState
  /** 当前进程的显示版本(src/lib/config.ts 的 APP_VERSION,与原生 versionName 同源) */
  currentVersion: string
  latestVersion: string | null
  downloadUrl: string | null
  releaseNotes: string | null
  /** 服务端标记的强制更新(仅作 UI 提示;是否阻断由客户端策略决定,本模块不擅自锁死应用) */
  forceUpdate: boolean
  /** 0-100,仅 downloading 时采样 */
  progress: number
  downloadedBytes: number
  totalBytes: number
  /**
   * 实测速率(字节/秒,4 秒滚动窗口)。为什么非要有:85MB 走跨境腿时"百分比不动"
   * 与"几十 B/s 在动"对用户是两种完全不同的体感,而前者会被当成死机。
   */
  bytesPerSecond: number
  /** 当前并发连接数(分片下载的真实读数;单流降级时为 1) */
  connections: number
  /** 下载完成的本地文件(安装失败后重试时复用,不必再下 90MB) */
  fileUri: string | null
  installMode: ApkInstallMode
  lastError: string | null
  lastCheckedAt: number | null
  /** 提示卡是否被用户关掉;新一轮"查到更新"时自动复位 */
  dismissed: boolean
}

let store: ApkStore = {
  state: 'idle',
  currentVersion: APP_VERSION,
  latestVersion: null,
  downloadUrl: null,
  releaseNotes: null,
  forceUpdate: false,
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  bytesPerSecond: 0,
  connections: 1,
  fileUri: null,
  installMode: null,
  lastError: null,
  lastCheckedAt: null,
  dismissed: false,
}

const listeners = new Set<() => void>()
/** 正在飞的那一趟检查(并发去重:挂载后自动检查与设置页手动检查会撞车) */
let inFlightCheck: Promise<ApkUpdateState> | null = null
/** 正在飞的下载任务(取消时按类型分派:分片腿靠令牌,单流腿靠 pauseAsync) */
type ActiveDownload =
  | { kind: 'ranged'; cancellation: DownloadCancellation }
  | { kind: 'legacy'; task: FileSystem.DownloadResumable }

let activeDownload: ActiveDownload | null = null

function patch(next: Partial<ApkStore>): void {
  store = { ...store, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** 只有 Android 能装 APK;web 与 iOS 上没有这条通道。 */
export function isApkUpdateSupported(): boolean {
  return Platform.OS === 'android'
}

// =============================================================================
// 版本比较(纯函数,可被单测钉住)
// =============================================================================

/**
 * 解析 `X.Y[.Z[.W]]`,只接受纯数字段 —— 与 app.config.js 派生的
 * `<base>.<UTC YYYYMMDD>` 形态(如 `0.0.5.20261104`)同形。
 * 非该形态一律返回 null(交给调用方决定"信服务端"还是"当没更新")。
 */
function parseVersion(value: string): number[] | null {
  const trimmed = value.trim()
  if (!/^\d+(?:\.\d+){0,3}$/.test(trimmed)) return null
  const parts = trimmed.split('.').map((n) => Number(n))
  while (parts.length < 4) parts.push(0)
  return parts
}

/**
 * 比较两个版本号:a>b 返回 1,a<b 返回 -1,相等 0,**任一方不可解析返回 null**。
 *
 * 返回 null 而不是 0 是关键:把"读不懂"伪装成"一样新"正是本仓反复吃亏的那类错误
 * (见 MEMORY「门恒绿两大成因」①实现取错层级 ②夹具与实现同错)。调用方必须显式处理 null。
 */
export function compareVersions(a: string, b: string): number | null {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 4; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

/**
 * 服务端结论 + 客户端复核的合并判据。
 *
 * 服务端 hasUpdate 有假阳性(见文件头红线 3),客户端 compareVersions 有"读不懂"。
 * 两者**同时**成立才算真有更新:读不懂时退化成"信服务端",但绝不因为读不懂就报"有更新"。
 */
export function decideHasUpdate(input: {
  serverHasUpdate: boolean
  latestVersion: string | null | undefined
  currentVersion: string
}): boolean {
  const latest = input.latestVersion?.trim()
  if (!latest) return false
  const cmp = compareVersions(latest, input.currentVersion)
  if (cmp === null) return input.serverHasUpdate
  return cmp > 0 && input.serverHasUpdate !== false
}

// =============================================================================
// 安装能力探测
// =============================================================================

interface IntentActivityOptions {
  data?: string
  type?: string
  flags?: number
  category?: string
}

interface IntentLauncherModule {
  startActivityAsync?: (action: string, params?: IntentActivityOptions) => Promise<unknown>
  startActivity?: (action: string, params?: IntentActivityOptions) => Promise<unknown>
}

/**
 * 探测应用内直装所需的**原生意图模块**是否在当前进程里。
 *
 * 为什么不去 `require('expo-intent-launcher')`:
 *   该包的 JS 入口在**模块初始化期**就调 `requireNativeModule('ExpoIntentLauncher')`,
 *   原生模块不在(还没重编包的旧 APK)时会当场抛错 —— 一个顶层的静态 import 就能让整个
 *   bundle 起不来。而 expo-modules-core 的原生模块注册表本身就挂在全局
 *   (`globalThis.expo.modules`,见 expo-modules-core/src/requireNativeModule.ts),
 *   直接读它是**纯取值、不会抛**,拿不到就是 null,天然满足红线 2。
 *
 * 命名的两种写法(startActivityAsync / startActivity)都探:前者是 JS 包装层的名字,
 * 后者是原生 ModuleDefinition 里的函数名。探测两手比猜一个更稳,且失败只是降级到浏览器。
 */
function lookupIntentLauncher(): IntentLauncherModule | null {
  try {
    const registry = (globalThis as unknown as { expo?: { modules?: Record<string, unknown> } })
      .expo?.modules
    const mod = registry?.ExpoIntentLauncher as IntentLauncherModule | undefined
    if (!mod) return null
    if (typeof mod.startActivityAsync === 'function') return mod
    if (typeof mod.startActivity === 'function') return mod
    return null
  } catch {
    return null
  }
}

/** 当前设备能否"下载完直接拉起系统安装器"(false ⇒ 只能走浏览器降级)。 */
export function canInstallInApp(): boolean {
  return Platform.OS === 'android' && lookupIntentLauncher() !== null
}

// =============================================================================
// 检查
// =============================================================================

/**
 * 检查是否有更新的 APK。并发去重(同 ota-update 的 inFlight 口径)。
 * @returns 结束时的状态,不抛异常。
 */
export function checkApkUpdate(): Promise<ApkUpdateState> {
  if (inFlightCheck) return inFlightCheck
  inFlightCheck = runCheck().finally(() => {
    inFlightCheck = null
  })
  return inFlightCheck
}

async function runCheck(): Promise<ApkUpdateState> {
  if (!isApkUpdateSupported()) {
    patch({ state: 'unsupported', lastError: null })
    return 'unsupported'
  }
  patch({ state: 'checking', lastError: null, lastCheckedAt: Date.now() })
  try {
    const res = await checkAppVersion({ version: store.currentVersion, platform: 'android' })
    if (!res.success) {
      patch({ state: 'error', lastError: res.error ?? '版本检查失败' })
      return 'error'
    }
    const data = res.data
    const latestVersion = typeof data.latestVersion === 'string' ? data.latestVersion : null
    const hasUpdate = decideHasUpdate({
      serverHasUpdate: data.hasUpdate !== false,
      latestVersion,
      currentVersion: store.currentVersion,
    })
    if (!hasUpdate) {
      patch({
        state: 'up-to-date',
        latestVersion: latestVersion ?? store.currentVersion,
        downloadUrl: null,
        releaseNotes: null,
        forceUpdate: false,
      })
      return 'up-to-date'
    }
    patch({
      state: 'available',
      latestVersion,
      downloadUrl: typeof data.downloadUrl === 'string' ? data.downloadUrl : null,
      releaseNotes: typeof data.releaseNotes === 'string' ? data.releaseNotes : null,
      forceUpdate: data.forceUpdate === true,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      bytesPerSecond: 0,
      connections: 1,
      fileUri: null,
      installMode: null,
      // 新一轮更新复位一次性关闭,与 ota-update 的 ready 分支同语义
      dismissed: false,
    })
    return 'available'
  } catch (e) {
    patch({ state: 'error', lastError: e instanceof Error ? e.message : String(e) })
    return 'error'
  }
}

// =============================================================================
// 下载 + 安装
// =============================================================================

/** 缓存目录常量在 web 上为 null;拿不到目录就等于没有"应用内下载"这条腿。 */
function apkFileUri(version: string): string | null {
  const dir = FileSystem.cacheDirectory
  if (!dir) return null
  // 文件名带版本号:重试同版本可复用,升级到新版本自动换文件,不会拿旧包去装新版本
  return `${dir}ihui-ai-${version}.apk`
}

/**
 * 单流下载(降级腿)。只有分片腿判定"服务端不支持 Range"时才走到这里。
 * 保留它而不是删掉:同样 85MB,单流至少能下完,只是慢;直接报错等于把用户堵死。
 */
async function downloadApkLegacy(url: string, target: string): Promise<string> {
  const meter = createSpeedMeter()
  let previous = 0
  const resumable = FileSystem.createDownloadResumable(
    url,
    target,
    // 与服务端其它请求同源的首方 UA:缺省 UA 会被 okhttp 默认串顶替,
    // 而后端 bot-detection 把 okhttp 列进爬虫关键字(src/lib/config.ts 的 APP_USER_AGENT 头注)。
    { headers: { 'User-Agent': APP_USER_AGENT } },
    (p) => {
      const total = p.totalBytesExpectedToWrite
      const delta = p.totalBytesWritten - previous
      previous = p.totalBytesWritten
      meter.push(delta)
      patch({
        progress: total > 0 ? Math.min(100, Math.round((p.totalBytesWritten / total) * 100)) : 0,
        downloadedBytes: p.totalBytesWritten,
        totalBytes: total > 0 ? total : 0,
        bytesPerSecond: meter.bytesPerSecond(),
        connections: 1,
      })
    },
  )
  activeDownload = { kind: 'legacy', task: resumable }
  try {
    const result = await resumable.downloadAsync()
    if (!result?.uri) throw new Error('下载完成但没有拿到文件路径')
    return result.uri
  } finally {
    if (activeDownload?.kind === 'legacy') activeDownload = null
  }
}

/**
 * 下载 APK(分片加速 + 原生单流兜底)。
 *
 * 分片是**尝试**,不是唯一可用的腿:真机实测它在跨境慢链路上可能整批挂到读超时
 * (8 条 × 2MB 在 95s 内 0 字节;改 4 条 × 512KB 后 4 片仍在 64s 超时点集体 onerror),
 * 首片看门狗会在 45s 内撤单。所以这里对**任何**非取消的分片失败都退回
 * `createDownloadResumable` —— 慢,但是原生流式、有真实进度,绝不让用户盯着 0% 假装在下载。
 * 取消/半包口径在分片腿里判,这里只负责选腿与错误归类。
 */
async function downloadApk(url: string, version: string): Promise<string> {
  const target = apkFileUri(version)
  if (!target) throw new Error('设备没有可写的缓存目录')

  const cancellation = new DownloadCancellation()
  activeDownload = { kind: 'ranged', cancellation }
  try {
    const result = await downloadRanged({
      url,
      uri: target,
      headers: { 'User-Agent': APP_USER_AGENT },
      cancellation,
      onProgress: (p) =>
        patch({
          progress:
            p.totalBytes > 0
              ? Math.min(100, Math.round((p.downloadedBytes / p.totalBytes) * 100))
              : 0,
          downloadedBytes: p.downloadedBytes,
          totalBytes: p.totalBytes,
          bytesPerSecond: p.bytesPerSecond,
          connections: p.connections,
        }),
    })
    return result.uri
  } catch (e) {
    if (e instanceof DownloadCancelledError) throw e
    // 分片腿的任何失败(不认 Range / 首片停滞 / 重试耗尽 / 长度不符 / 写盘失败)都退回单流:
    // 它是加速尝试,不该拥有"让用户没得下"的权力。
    // activeDownload 会在下面的 finally 按身份清理,不能无条件置空
    // (否则取消会打在已经换掉的腿上)。
    return downloadApkLegacy(url, target)
  } finally {
    if (activeDownload?.kind === 'ranged' && activeDownload.cancellation === cancellation) {
      activeDownload = null
    }
  }
}

/**
 * 把本地 APK 交给系统安装器(应用内直装)。
 * 抛错表示这条腿不可用 —— 由调用方降级,不在这里吞掉原因。
 */
async function launchInstaller(fileUri: string): Promise<void> {
  const launcher = lookupIntentLauncher()
  if (!launcher) throw new Error('当前安装包不含原生意图模块')
  const start = launcher.startActivityAsync ?? launcher.startActivity
  if (!start) throw new Error('原生意图模块缺少 startActivity')
  // content:// 由 expo-file-system 自带的 FileSystemFileProvider 提供(其 android manifest 已声明),
  // 不需要我们再补 FileProvider;FLAG_GRANT_READ_URI_PERMISSION(1)让安装器能读到这个文件。
  const contentUri = await FileSystem.getContentUriAsync(fileUri)
  await start('android.intent.action.VIEW', {
    data: contentUri,
    flags: 1,
    type: 'application/vnd.android.package-archive',
  })
}

/** 浏览器降级:把直链交给系统浏览器,由它下载并弹安装。 */
async function openInBrowser(url: string): Promise<void> {
  await Linking.openURL(url)
}

/**
 * 下载并安装(用户点按触发,唯一入口)。
 *
 * 三条路径,按能力自动选:
 *   A. 有原生意图模块 → 应用内下载(带读条)→ 当场拉起系统安装器;
 *   B. 没有 → 直接开浏览器下载并安装(不在应用内白下 90MB 再装不上);
 *   C. 下载成功但安装失败 → 复用已下载文件重试一次,仍失败则退 B。
 *
 * @returns 结束时的状态,不抛异常。
 */
export async function applyApkUpdate(): Promise<ApkUpdateState> {
  const { downloadUrl, latestVersion, state } = store
  if (state === 'downloading') return 'downloading'
  if (!downloadUrl) {
    patch({ state: 'error', lastError: '服务端没有下发安装包地址' })
    return 'error'
  }
  if (!latestVersion) {
    patch({ state: 'error', lastError: '服务端没有下发目标版本号' })
    return 'error'
  }

  // B:能力缺失直接交给浏览器 —— 这里**不下载**,避免"下完装不上"的双重浪费
  if (!canInstallInApp()) {
    patch({ state: 'installing', installMode: 'browser', lastError: null })
    try {
      await openInBrowser(downloadUrl)
      return 'installing'
    } catch (e) {
      patch({
        state: 'error',
        installMode: null,
        lastError: e instanceof Error ? e.message : String(e),
      })
      return 'error'
    }
  }

  // A:应用内下载 → 拉起安装器
  patch({
    state: 'downloading',
    installMode: 'in-app',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    bytesPerSecond: 0,
    connections: 1,
    lastError: null,
  })
  let uri: string
  try {
    uri = await downloadApk(downloadUrl, latestVersion)
  } catch (e) {
    patch({
      state: 'error',
      installMode: null,
      lastError: e instanceof Error ? e.message : String(e),
    })
    return 'error'
  }

  patch({ state: 'installing', fileUri: uri, progress: 100 })
  try {
    await launchInstaller(uri)
    return 'installing'
  } catch (installError) {
    // C:文件已经在本地了,先原地重试一次(有些机型首次授权后第二次才放行)
    try {
      await launchInstaller(uri)
      return 'installing'
    } catch {
      patch({
        state: 'error',
        installMode: 'browser',
        lastError: installError instanceof Error ? installError.message : String(installError),
      })
      // 最后一道:把直链给浏览器,至少让用户能升级完成(下载的临时文件由系统缓存清理)
      try {
        await openInBrowser(downloadUrl)
      } catch {
        /* 浏览器也打不开就停在 error,由 UI 如实告知 */
      }
      return 'error'
    }
  }
}

/** 取消下载:回到 available,让用户能重新点(不把半截文件当成"已下载")。 */
export async function cancelApkDownload(): Promise<void> {
  const active = activeDownload
  activeDownload = null
  if (active?.kind === 'ranged') {
    // 令牌一置,分片腿立刻停派新片并 abort 在飞请求(见 ranged-download 的 onCancel)
    active.cancellation.cancel()
  } else if (active?.kind === 'legacy') {
    try {
      await active.task.pauseAsync()
    } catch {
      /* 已经结束的下载 pause 会抛,忽略即可 */
    }
  }
  patch({ state: 'available', progress: 0, downloadedBytes: 0, totalBytes: 0, bytesPerSecond: 0 })
}

/** 关掉提示卡(仅本次会话;下一轮查到更新会再出现)。 */
export function dismissApkPrompt(): void {
  patch({ dismissed: true })
}

/**
 * 回到前台要不要补查一次。口径同 ota-update.shouldAutoRecheck:
 * 已经 available/在下载/在安装/用户已关掉,都不打扰。
 */
export function shouldAutoRecheckApk(minIntervalMs: number): boolean {
  if (store.state === 'available' || store.state === 'installing' || store.dismissed) return false
  if (store.state === 'downloading') return false
  if (store.lastCheckedAt === null) return true
  return Date.now() - store.lastCheckedAt >= minIntervalMs
}

/** 当前状态快照(非 React 环境读取用)。 */
export function apkSnapshot(): ApkStore {
  return store
}

/** 订阅状态(useSyncExternalStore:提示卡与设置页共享同一份)。 */
export function useApkUpdate(): ApkStore {
  return useSyncExternalStore(
    subscribe,
    () => store,
    () => store,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
