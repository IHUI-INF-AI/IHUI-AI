// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * downloads-live.ts — 下载端运行期真值的 **IO 层**(仅服务端;含 `node:fs`)。
 *
 * 要解决的问题:此前 8 端里只有 desktop 在运行期解析版本,其余全部读构建期内联值
 * (`NEXT_PUBLIC_*` 经 DefinePlugin 钉进产物)。后果是"包已发出去、页面还写着旧号",
 * 而账面(代码)看不出任何异常 —— 与「线上版本标记会骗」同型。
 *
 * 每端只问它自己的权威发布处,不新造第二份真相(AGENTS §0.6):
 *  - desktop   → 该端 release 自带的 latest.json(复用 desktop-feed-live,不另起一条腿)
 *  - android   → `app_versions` 注册表 `status='latest'` 行(发布链 `publish-mobile-apk.mjs`
 *                末尾腿已自动登记 ⇒ 这条才是真正"发版即更新")
 *  - ios       → GitHub Release 固定 tag `ios-nightly` 的 `ihui-ai-latest.ipa` 资产
 *  - extension → `public/downloads/extension/` 里按 mtime 最新的那枚实物文件
 *  - cli       → npm registry 的 `dist-tags.latest` + `time[version]`
 *  - mobile    → 与 android 同一个包(只借版本标注,安装包仍归 android-apk 那一格)
 *  - web / 微信小程序 → 没有机器可读的发布源 ⇒ 如实 unavailable,不编版本号
 *
 * 判据与类型住 `downloads-live-meta.ts`(客户端组件也 import 那份),本文件只做取数。
 *
 * iOS 那一格顺带修掉的死链(2026-11-02 实测):`NEXT_PUBLIC_DOWNLOAD_APPSTORE_URL` 用的是
 * `releases/latest/download/ihui-ai-latest.ipa`,而 `releases/latest` 现读解析到
 * `nightly-40425910619`(Android 的 nightly,`make_latest: true`),那枚 release 里只有
 * `.apk` ⇒ iOS 按钮此前 404。真资产在
 * `releases/download/ios-nightly/ihui-ai-latest.ipa`(iOS 的 workflow 设了
 * `make_latest: false`,所以它永远拿不到 latest 别名)。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { fetchJson, resolveLiveDesktopFeed } from './desktop-feed-live'
import {
  judgeAppVersionRow,
  judgeExtensionArtifact,
  judgeIosReleaseDoc,
  judgeNpmRegistryDoc,
  pickNewestArtifact,
  toDesktopLiveInfo,
} from './downloads-live-meta'
import type { ExtensionManifestEntry, LiveDownloads, LivePlatformInfo } from './downloads-live-meta'
import type { DownloadPlatform } from './downloads.config'

const IOS_RELEASE_TAG = 'ios-nightly'
const IOS_ASSET_NAME = 'ihui-ai-latest.ipa'
const CLI_NPM_PACKAGE = 'ihui-cli'
const DEFAULT_REPO = 'IHUI-INF-AI/IHUI-AI'
const LOCAL_API_TIMEOUT_MS = 4000
const NPM_TIMEOUT_MS = 8000
/**
 * 未认证 GitHub API 上限 60 次/小时/IP:desktop 与 iOS 两条腿各占 6 次/小时,留足余量。
 * 要缩短窗口先确认限流余量 —— 撞上限的表现是静默降级成 snapshot(取不到),比旧号更难查。
 */
const REVALIDATE_S = 600
const EXTENSION_DIR_RELATIVE = join('public', 'downloads', 'extension')
const EXTENSION_MANIFEST_RELATIVE = join('public', 'downloads', 'manifest.json')

/**
 * 服务端到本机 API 的基址。生产 env 里 `API_URL=` 是空值 ⇒ 必须显式回落。
 * 用 127.0.0.1 而不是 localhost:入口 router 现读只绑 127.0.0.1,`localhost` 在双栈机上
 * 先解析 ::1 会 ECONNREFUSED —— 那种失败长得像"注册表没数据",会被误判成 unavailable。
 */
export function localApiBase(envValue: string | undefined = process.env.API_URL): string {
  const raw = typeof envValue === 'string' ? envValue.trim() : ''
  return raw === '' ? 'http://127.0.0.1:8802' : raw.replace(/\/+$/, '')
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: { timeoutMs: number; headers?: Record<string, string> },
): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(init.timeoutMs),
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
      next: { revalidate: REVALIDATE_S },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** 读 manifest 里扩展端那一格;文件缺失/形状不对一律 null(不算错,只是没有对账输入) */
export function readExtensionManifest(dirRoot: string): ExtensionManifestEntry | null {
  const file = join(dirRoot, EXTENSION_MANIFEST_RELATIVE)
  if (!existsSync(file)) return null
  try {
    const doc = JSON.parse(readFileSync(file, 'utf-8')) as {
      platforms?: { extension?: { version?: unknown; assets?: { sizeBytes?: unknown }[] } }
    }
    const entry = doc.platforms?.extension
    if (entry === undefined) return null
    return { version: entry.version, sizeBytes: entry.assets?.[0]?.sizeBytes }
  } catch {
    return null
  }
}

export interface ExtensionDiskInputs {
  dirRoot?: string
  nowIso?: string
}

/** 扩展端:枚举实物取最新一枚 —— 版本与体积都来自文件本身,换包即生效,不需要重新构建站点 */
export function resolveExtensionFromDisk(inputs: ExtensionDiskInputs = {}): LivePlatformInfo {
  const dirRoot = inputs.dirRoot ?? process.cwd()
  const nowIso = inputs.nowIso ?? new Date().toISOString()
  const dir = join(dirRoot, EXTENSION_DIR_RELATIVE)
  let entries
  try {
    if (!existsSync(dir)) return judgeExtensionArtifact(null, null, nowIso)
    entries = readdirSync(dir)
      .filter((name) => /\.zip$/i.test(name))
      .map((name) => {
        const st = statSync(join(dir, name))
        return { name, sizeBytes: st.size, mtimeMs: st.mtimeMs }
      })
  } catch {
    // 读不动目录 ≠ 没有包:回落 snapshot,不冒"该端未上架"的绿也不冒红
    return {
      platform: 'extension',
      source: 'snapshot',
      reason: 'extension-dir-unreadable',
      resolvedAt: nowIso,
    }
  }
  return judgeExtensionArtifact(pickNewestArtifact(entries), readExtensionManifest(dirRoot), nowIso)
}

async function resolveAndroid(nowIso: string): Promise<LivePlatformInfo> {
  const url = `${localApiBase()}/api/app-version/latest?platform=android`
  const doc = await fetchJsonWithTimeout<unknown>(url, { timeoutMs: LOCAL_API_TIMEOUT_MS })
  return judgeAppVersionRow(doc, {
    registryPlatform: 'android',
    displayPlatform: 'android-apk',
    assetFormat: 'Android APK',
    nowIso,
  })
}

/** RN 源码端与 Android 端是同一个包:只借版本/日期做标注,不给安装包(那格属 android-apk) */
export function asMobileEnd(info: LivePlatformInfo): LivePlatformInfo {
  return { ...info, platform: 'mobile', assets: undefined }
}

/** GitHub API 请求头(有 token 就带上:未认证配额是 60 次/小时/IP) */
function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

async function resolveIos(nowIso: string): Promise<LivePlatformInfo> {
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO
  const doc = await fetchJson<unknown>(
    `https://api.github.com/repos/${repo}/releases/tags/${IOS_RELEASE_TAG}`,
    githubHeaders(),
    REVALIDATE_S,
  )
  return judgeIosReleaseDoc(doc, { assetName: IOS_ASSET_NAME, nowIso })
}

async function resolveCli(nowIso: string): Promise<LivePlatformInfo> {
  const doc = await fetchJsonWithTimeout<unknown>(`https://registry.npmjs.org/${CLI_NPM_PACKAGE}`, {
    timeoutMs: NPM_TIMEOUT_MS,
  })
  return judgeNpmRegistryDoc(doc, { packageName: CLI_NPM_PACKAGE, nowIso })
}

/**
 * desktop 复用既有解析器(它还要负责 latest.json 的签名 payload),不另起一条腿。
 * 上游为什么降级一并带在 reason 里 —— 降级原因(扫了几页、几条)是排查"页面为何还旧"的
 * 唯一入口,吞掉它等于把下一次事故重新藏起来。
 */
async function resolveDesktop(nowIso: string): Promise<LivePlatformInfo> {
  const resolved = await resolveLiveDesktopFeed()
  if (resolved.source === 'live') return toDesktopLiveInfo(resolved.data, nowIso)
  return {
    platform: 'desktop',
    source: 'snapshot',
    reason: `desktop-feed-${resolved.source}:${resolved.reason}`.slice(0, 160),
    resolvedAt: nowIso,
  }
}

function unavailableEnd(
  platform: DownloadPlatform,
  reason: string,
  nowIso: string,
): LivePlatformInfo {
  return { platform, source: 'unavailable', reason, resolvedAt: nowIso }
}

/**
 * 全端运行期真值。各端并发取、单端失败只降自己那一格(降级是分端的,不是整体的)。
 * `web` 是 PWA 无可安装产物、`wechat-miniapp` 没有机器可读的发布源 ⇒ 如实 unavailable。
 */
export async function resolveLiveDownloads(): Promise<LiveDownloads> {
  const nowIso = new Date().toISOString()
  const [desktop, android, ios, cli] = await Promise.all([
    resolveDesktop(nowIso),
    resolveAndroid(nowIso),
    resolveIos(nowIso),
    resolveCli(nowIso),
  ])
  return {
    desktop,
    'android-apk': android,
    mobile: asMobileEnd(android),
    ios,
    cli,
    extension: resolveExtensionFromDisk({ nowIso }),
    web: unavailableEnd('web', 'web-is-pwa-no-installable-artifact', nowIso),
    'wechat-miniapp': unavailableEnd(
      'wechat-miniapp',
      'miniapp-has-no-machine-readable-release-source',
      nowIso,
    ),
  }
}

/** 单端入口(详情页用):只解析被请求的那一端,省掉其余端的上游开销 */
export async function resolveLiveDownload(platform: DownloadPlatform): Promise<LivePlatformInfo> {
  const nowIso = new Date().toISOString()
  switch (platform) {
    case 'desktop':
      return resolveDesktop(nowIso)
    case 'android-apk':
      return resolveAndroid(nowIso)
    case 'mobile':
      return asMobileEnd(await resolveAndroid(nowIso))
    case 'ios':
      return resolveIos(nowIso)
    case 'cli':
      return resolveCli(nowIso)
    case 'extension':
      return resolveExtensionFromDisk({ nowIso })
    case 'web':
      return unavailableEnd('web', 'web-is-pwa-no-installable-artifact', nowIso)
    case 'wechat-miniapp':
      return unavailableEnd(
        'wechat-miniapp',
        'miniapp-has-no-machine-readable-release-source',
        nowIso,
      )
    default:
      return unavailableEnd(platform, `unknown-platform:${platform}`, nowIso)
  }
}

/** 自检/镜像测试入口 */
export const __test__ = {
  localApiBase,
  asMobileEnd,
  IOS_RELEASE_TAG,
  IOS_ASSET_NAME,
  CLI_NPM_PACKAGE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
