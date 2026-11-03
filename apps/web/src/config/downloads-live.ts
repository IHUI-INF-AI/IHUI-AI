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
 *  - ios       → 自有站点腿的恒定指针 `ihui-ai-latest.ipa`(302 + `X-Release-Version`,与安卓同一腿);
 *                站点腿答不上才回落 GitHub Release 固定 tag `ios-nightly` 的那枚资产
 *  - extension → `public/downloads/extension/` 里按 mtime 最新的那枚实物文件
 *  - cli       → npm registry 的 `dist-tags.latest` + `time[version]`
 *  - mobile    → 与 android 同一个包(只借版本标注,安装包仍归 android-apk 那一格)
 *  - 微信小程序 → 该端没有"版本号可枚举"的发布源,但**码本身**是实物:问 `public/images/common/`
 *                下那枚 `miniapp-qr.png` 的字节(生码链 gen-miniapp-code.mjs 向微信要真图)⇒ 有真图即 live
 *  - web       → PWA,没有可下载安装包 ⇒ 如实 unavailable,不编版本号
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
  applyProbedAssetSize,
  judgeAppVersionRow,
  judgeExtensionArtifact,
  judgeIosReleaseDoc,
  judgeIpaPointerProbe,
  judgeMiniappQr,
  judgeNpmRegistryDoc,
  pickNewestArtifact,
  toDesktopLiveInfo,
} from './downloads-live-meta'
import type { ExtensionManifestEntry, LiveDownloads, LivePlatformInfo } from './downloads-live-meta'
import type { DownloadPlatform } from './downloads.config'

const IOS_RELEASE_TAG = 'ios-nightly'
const IOS_ASSET_NAME = 'ihui-ai-latest.ipa'
/** 站点腿上的恒定指针名(与 scripts/publish-mobile-ipa.mjs 的 LATEST_IPA_KEY 同形) */
const IOS_LATEST_KEY = 'ihui-ai-latest.ipa'
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
const MINIAPP_QR_RELATIVE = join('public', 'images', 'common', 'miniapp-qr.png')

/**
 * 服务端到本机 API 的基址。生产 env 里 `API_URL=` 是空值 ⇒ 必须显式回落。
 * 用 127.0.0.1 而不是 localhost:入口 router 现读只绑 127.0.0.1,`localhost` 在双栈机上
 * 先解析 ::1 会 ECONNREFUSED —— 那种失败长得像"注册表没数据",会被误判成 unavailable。
 */
function localApiBase(envValue: string | undefined = process.env.API_URL): string {
  const raw = typeof envValue === 'string' ? envValue.trim() : ''
  return raw === '' ? 'http://127.0.0.1:8802' : raw.replace(/\/+$/, '')
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: { timeoutMs: number; headers?: Record<string, string>; fetchImpl?: typeof fetch },
): Promise<T | null> {
  const fetchImpl = init.fetchImpl ?? fetch
  try {
    const res = await fetchImpl(url, {
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
function readExtensionManifest(dirRoot: string): ExtensionManifestEntry | null {
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
function resolveExtensionFromDisk(inputs: ExtensionDiskInputs = {}): LivePlatformInfo {
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

/** 小程序那一端:码是实物文件,读它就比写死"未接入"诚实(字节不够 = 占位图,仍算未接入) */
export function resolveMiniappQrFromDisk(
  inputs: { dirRoot?: string; nowIso?: string } = {},
): LivePlatformInfo {
  const dirRoot = inputs.dirRoot ?? process.cwd()
  const nowIso = inputs.nowIso ?? new Date().toISOString()
  const file = join(dirRoot, MINIAPP_QR_RELATIVE)
  try {
    if (!existsSync(file)) return judgeMiniappQr({ exists: false, sizeBytes: 0 }, nowIso)
    return judgeMiniappQr({ exists: true, sizeBytes: statSync(file).size }, nowIso)
  } catch {
    return {
      platform: 'wechat-miniapp',
      source: 'snapshot',
      reason: 'miniapp-qr-unreadable',
      resolvedAt: nowIso,
    }
  }
}

/**
 * 安卓版:版本/日期取注册表 `app_versions` 的 latest 行(发布链末尾腿自动登记)。
 * 但注册表**没有体积列** ⇒ `judgeAppVersionRow` 只能给 0,页面上渲染成 `-`(诚实的"未量")。
 * 站点腿自己知道真实字节(版本副本的 Content-Length,本机臂实测 28ms)⇒ 问它一次,把"未量"变成实数;
 * 问不到就照旧留 0,**不拿估算冒充**。版本号仍以注册表行为准 —— 腿上的头只用于对账(那归尺子那一格)。
 */
async function resolveAndroid(
  nowIso: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LivePlatformInfo> {
  const url = `${localApiBase()}/api/app-version/latest?platform=android`
  const doc = await fetchJsonWithTimeout<unknown>(url, {
    timeoutMs: LOCAL_API_TIMEOUT_MS,
    fetchImpl,
  })
  const info = judgeAppVersionRow(doc, {
    registryPlatform: 'android',
    displayPlatform: 'android-apk',
    assetFormat: 'Android APK',
    nowIso,
  })
  if (info.source !== 'live') return info
  let path = ''
  try {
    path = new URL(info.assets?.[0]?.href ?? '').pathname
  } catch {
    path = ''
  }
  if (!path.startsWith(LEG_PATH_PREFIX)) return info
  const { reading } = await probeSiteLeg(path, fetchImpl)
  return applyProbedAssetSize(info, reading?.sizeBytes ?? 0)
}

/** RN 源码端与 Android 端是同一个包:只借版本/日期做标注,不给安装包(那格属 android-apk) */
function asMobileEnd(info: LivePlatformInfo): LivePlatformInfo {
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

/**
 * 站点腿的两条探测臂:**本机源站优先**。
 * `IHUI-IMAGE-CDN` 与站点同机,问它自己是 2–36ms;走公网域名那一臂是同一台机出去再绕回边缘,
 * 2026-11-03 现读中位 1161ms、最差 5466ms,还偶发十几秒(undici 只列 v6 地址的那种 ConnectTimeout)。
 * 页面渲染里嵌这一腿,慢/挂的直接后果是**下载栏整格退回入库快照**(判据把取不到当未接入),
 * 用户看到的是旧版本号 —— 与「线上一条 200、账面看不出异常」那型同族。
 * 换的只是"问谁":本机臂读到的仍是同一份 cdn-server 判断(302 + `X-Release-*` + 版本副本头),
 * 而交给用户的 href 取 Location 里那个公网绝对地址,一个字节都没换成内网地址。
 */
const LOCAL_LEG_ORIGIN = 'http://127.0.0.1:80'
const LOCAL_LEG_TIMEOUT_MS = 1500
const LEG_PATH_PREFIX = '/remote-images/download/'

/** 站点腿的公网基址(env 可换);本机臂的 Host 头就从这里取,一处定义不复制第二份 */
function siteLegBase(): string {
  const raw =
    typeof process.env.IHUI_SITE_LEG_BASE === 'string' ? process.env.IHUI_SITE_LEG_BASE.trim() : ''
  return (raw === '' ? 'https://www.aizhs.top' : raw).replace(/\/+$/, '')
}

function legProbeHost(): string {
  const raw =
    typeof process.env.IHUI_SITE_LEG_HOST === 'string' ? process.env.IHUI_SITE_LEG_HOST.trim() : ''
  if (raw !== '') return raw
  try {
    return new URL(siteLegBase()).host
  } catch {
    return 'www.aizhs.top'
  }
}

interface LegArm {
  base: string
  headers: Record<string, string>
  label: 'local' | 'public'
  timeoutMs: number
}

/** 顺序即优先级:本机臂先跑(1.5s 上限,答不上就立刻换公网臂) */
function legArms(): LegArm[] {
  return [
    {
      base: LOCAL_LEG_ORIGIN,
      headers: { host: legProbeHost() },
      label: 'local',
      timeoutMs: LOCAL_LEG_TIMEOUT_MS,
    },
    { base: siteLegBase(), headers: {}, label: 'public', timeoutMs: NPM_TIMEOUT_MS },
  ]
}

export interface LegPointerReading {
  status: number
  location: string | null
  version: string | null
  sizeBytes: number
  contentType: string
}

/**
 * 单臂读一次指针:302 的落点**在同一臂上**再 HEAD(本机臂就 HEAD 本机)——
 * 拿着公网 Location 去 HEAD 会把刚省掉的那一跳又加回来。
 * 取不到(异常/超时)一律 null,由调用方决定下一臂;非 302 是回答,原样带出去交判据。
 */
async function probeLegArm(
  arm: LegArm,
  pointerPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LegPointerReading | null> {
  try {
    const r = await fetchImpl(`${arm.base}${pointerPath}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(arm.timeoutMs),
      headers: { ...arm.headers, range: 'bytes=0-0' },
      next: { revalidate: REVALIDATE_S },
    })
    const loc = r.headers.get('location')
    await r.body?.cancel().catch(() => {})
    const reading: LegPointerReading = {
      status: r.status,
      location: typeof loc === 'string' && loc !== '' ? loc : null,
      version: r.headers.get('x-release-version'),
      sizeBytes: 0,
      contentType: '',
    }
    if (r.status === 302 && reading.location !== null) {
      let copyPath = ''
      try {
        copyPath = new URL(reading.location).pathname
      } catch {
        copyPath = ''
      }
      if (copyPath !== '') {
        const f = await fetchImpl(`${arm.base}${copyPath}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(arm.timeoutMs),
          headers: arm.headers,
          next: { revalidate: REVALIDATE_S },
        })
        reading.sizeBytes = Number(f.headers.get('content-length') || 0)
        reading.contentType = String(f.headers.get('content-type') || '')
        await f.body?.cancel().catch(() => {})
      }
    }
    return reading
  } catch {
    return null
  }
}

/**
 * 逐臂问到"能判"为止。返回 {reading, tried}:reading 为 null ⇒ 两臂都没有响应,
 * 调用方据此落未判定并逐臂点名(两态不并桶,§0.3)。
 */
async function probeSiteLeg(
  pointerPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ reading: LegPointerReading | null; tried: string[] }> {
  const tried: string[] = []
  let last: LegPointerReading | null = null
  for (const arm of legArms()) {
    const reading = await probeLegArm(arm, pointerPath, fetchImpl)
    if (reading === null) {
      tried.push(`${arm.label}:无响应`)
      continue
    }
    last = reading
    tried.push(`${arm.label}:HTTP ${reading.status}`)
    if (reading.status === 302 && reading.location !== null) return { reading, tried }
  }
  // 两臂都答了但不是 302(比如还没发布过)⇒ 把最后一臂的真实读数交给判据,不编
  return { reading: last, tried }
}

/** iOS 那一格的指针路径(安卓共用同一形态,路径前缀只在上面写一次) */
const IPA_POINTER_PATH = `${LEG_PATH_PREFIX}${IOS_LATEST_KEY}`

async function probeIpaSiteLeg(
  nowIso: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LivePlatformInfo> {
  const { reading, tried } = await probeSiteLeg(IPA_POINTER_PATH, fetchImpl)
  if (reading === null) {
    return {
      platform: 'ios',
      source: 'snapshot',
      reason: `ipa-pointer-probe-failed(${tried.join('|')})`.slice(0, 160),
      resolvedAt: nowIso,
    }
  }
  return judgeIpaPointerProbe(reading, nowIso)
}

async function resolveIos(nowIso: string): Promise<LivePlatformInfo> {
  const leg = await probeIpaSiteLeg(nowIso)
  if (leg.source === 'live') return leg
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO
  const doc = await fetchJson<unknown>(
    `https://api.github.com/repos/${repo}/releases/tags/${IOS_RELEASE_TAG}`,
    githubHeaders(),
    REVALIDATE_S,
  )
  const gh = judgeIosReleaseDoc(doc, { assetName: IOS_ASSET_NAME, nowIso })
  if (gh.source !== 'live') return gh
  // GitHub 兜底成功时把"站点腿为什么没用上"一起带出去:排查"为什么还在慢腿上"不用猜
  return { ...gh, reason: leg.reason ? `site-leg-unused:${leg.reason}` : gh.reason }
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
  if (resolved.source === 'live')
    return toDesktopLiveInfo(resolved.data, nowIso, resolved.data.scan)
  return {
    platform: 'desktop',
    source: 'snapshot',
    reason: `desktop-feed-${resolved.source}:${resolved.reason}`.slice(0, 160),
    ...(resolved.scan === undefined ? {} : { scan: resolved.scan }),
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
    'wechat-miniapp': resolveMiniappQrFromDisk({ nowIso }),
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
      return resolveMiniappQrFromDisk({ nowIso })
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
  LEG_PATH_PREFIX,
  legArms,
  probeSiteLeg,
  resolveAndroid,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
