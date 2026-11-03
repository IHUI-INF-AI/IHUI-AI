// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * downloads-live-meta.ts — 下载端运行期真值的**类型与判据**(纯,不碰网络也不碰磁盘)。
 *
 * 为什么要与 downloads-live.ts 分家:那份含 `node:fs`(扩展端要枚举实物文件算体积),
 * 只能服务端 import;而侧边栏是 client component,它也要按同一条规则决定"版本号显示哪个、
 * 按钮链到哪、这一端算不算已接入"。同一条取值规则住两处必然漂移(AGENTS §0.6),
 * 所以判据住这里(两面都可 import),IO 住那里(仅服务端)。
 *
 * 三档来源的语义(AGENTS §0.3「没判」绝不写成「判过」):
 *  - `live`         运行期取到真值 ⇒ 覆盖底稿
 *  - `snapshot`     拿不到输入(超时/非 200/形状不对)⇒ 不覆盖、也不说"该端没货"
 *  - `unavailable`  拿到了输入且判据不命中(该端确实没登记 / 无机器可读发布源)⇒ 不覆盖
 */
import type { LiveDesktopSource, ReleaseScanSummary } from './desktop-feed-live'
import type { DownloadAsset, DownloadPlatform, PlatformMeta } from './downloads.config'

export type LiveSourceKind = 'live' | 'snapshot' | 'unavailable'

export interface LivePlatformInfo {
  platform: DownloadPlatform
  source: LiveSourceKind
  /** 机器可读原因码(ASCII,不进 UI 文案面) */
  reason?: string
  version?: string
  /** YYYY-MM-DD */
  releaseDate?: string
  assets?: DownloadAsset[]
  /** 本次解析时刻 ISO:端上可自证"这行是活的还是陈的" */
  resolvedAt: string
  /** 枚举预算自证(只有需要翻页枚举的端才有):pages 顶到 maxPages ⇒ 下一枚 release 会被挤出射程 */
  scan?: ReleaseScanSummary
}

export type LiveDownloads = Partial<Record<DownloadPlatform, LivePlatformInfo>>

/* -------------------------------------------------------------------------- */
/* 注册表(app_versions)判据                                                   */
/* -------------------------------------------------------------------------- */

interface AppVersionRow {
  version?: string
  platform?: string
  downloadUrl?: string | null
  status?: string
  updatedAt?: string
  createdAt?: string
}

export interface AppVersionJudgeInput {
  /** 注册表里的 platform 键(如 'android') */
  registryPlatform: string
  /** 下载端的枚举(如 'android-apk')—— 两者不同名,必须显式交,不许在返回体里说谎 */
  displayPlatform: DownloadPlatform
  /** 安装包格式标签(仅当注册表行带 downloadUrl 时使用) */
  assetFormat: string
  nowIso: string
}

/**
 * 判 `GET /api/app-version/latest?platform=X` 的响应体。
 * 三态分离的纪律与 `scripts/check-app-version-latest.mjs` 同源(不复算它的那三条判据):
 *  - 响应读不到 / 非 JSON / code≠0 ⇒ snapshot(说不出注册表里有没有行,不猜)
 *  - code=0 但 `data.latest` 缺失 ⇒ unavailable(有输入、判据不命中:该端没登记过)
 *  - 行在但 platform/status 不自洽 ⇒ unavailable 并点名(不自洽的行不硬用)
 */
export function judgeAppVersionRow(
  payload: unknown,
  input: AppVersionJudgeInput,
): LivePlatformInfo {
  const { registryPlatform, displayPlatform, assetFormat, nowIso } = input
  const base: Omit<LivePlatformInfo, 'source'> = { platform: displayPlatform, resolvedAt: nowIso }
  if (payload === null || typeof payload !== 'object') {
    return { ...base, source: 'snapshot', reason: 'registry-unreachable' }
  }
  const doc = payload as { code?: unknown; data?: unknown }
  if (doc.code !== 0) {
    return { ...base, source: 'snapshot', reason: `registry-code-${String(doc.code ?? 'missing')}` }
  }
  const data = doc.data as { latest?: AppVersionRow } | null
  if (data === null || typeof data !== 'object') {
    return { ...base, source: 'snapshot', reason: 'registry-no-data-object' }
  }
  const row = data.latest
  if (row === null || row === undefined) {
    return { ...base, source: 'unavailable', reason: `registry-row-missing:${registryPlatform}` }
  }
  if (row.platform !== registryPlatform || row.status !== 'latest') {
    return {
      ...base,
      source: 'unavailable',
      reason: `registry-row-inconsistent:${String(row.platform)}/${String(row.status)}`,
    }
  }
  const url = typeof row.downloadUrl === 'string' ? row.downloadUrl.trim() : ''
  if (url === '') {
    return { ...base, source: 'unavailable', reason: 'registry-row-has-no-download-url' }
  }
  const version =
    typeof row.version === 'string' && row.version.trim() !== '' ? row.version.trim() : undefined
  return {
    ...base,
    source: 'live',
    version,
    releaseDate: isoDateOf(row.updatedAt ?? row.createdAt),
    assets: [{ href: url, sizeBytes: 0, format: assetFormat }],
  }
}

/* -------------------------------------------------------------------------- */
/* npm registry 判据(CLI 端)                                                 */
/* -------------------------------------------------------------------------- */

interface NpmRegistryDoc {
  'dist-tags'?: { latest?: string }
  time?: Record<string, string>
  versions?: Record<string, unknown>
}

/** 判 npm registry 文档:`dist-tags.latest` 指向一个不存在的版本 ⇒ 未判定,不冒绿 */
export function judgeNpmRegistryDoc(
  doc: unknown,
  input: { packageName: string; nowIso: string },
): LivePlatformInfo {
  const { packageName, nowIso } = input
  const fallback: LivePlatformInfo = {
    platform: 'cli',
    source: 'snapshot',
    reason: 'npm-registry-unreachable',
    resolvedAt: nowIso,
  }
  if (doc === null || typeof doc !== 'object') return fallback
  const parsed = doc as NpmRegistryDoc
  const latest =
    typeof parsed['dist-tags']?.latest === 'string' ? parsed['dist-tags'].latest.trim() : ''
  if (latest === '') {
    return { ...fallback, source: 'unavailable', reason: `npm-no-dist-tag-latest:${packageName}` }
  }
  if (parsed.versions?.[latest] === undefined) {
    return { ...fallback, source: 'unavailable', reason: `npm-dist-tag-versions-desync:${latest}` }
  }
  return {
    platform: 'cli',
    source: 'live',
    version: latest,
    releaseDate: isoDateOf(parsed.time?.[latest]),
    // CLI 走 npm install,没有独立安装包可下 ⇒ assets 留空,详情页继续显示安装命令
    assets: [],
    resolvedAt: nowIso,
  }
}

/* -------------------------------------------------------------------------- */
/* GitHub Release 判据(iOS 端)                                                */
/* -------------------------------------------------------------------------- */

interface ReleaseDocAsset {
  name?: string
  size?: number
  browser_download_url?: string
}
interface ReleaseDoc {
  tag_name?: string
  published_at?: string
  assets?: ReleaseDocAsset[]
}

/**
 * 判 iOS 的固定 tag release 文档。
 * 版本号刻意**不**从 tag 推:tag 是 `ios-nightly`(不含 semver),CI 也没把版本写进资产名
 * ⇒ 这一格取不到版本就是取不到。页面宁可显示底稿,也不写一个猜出来的号。
 */
export function judgeIosReleaseDoc(
  doc: unknown,
  input: { assetName: string; nowIso: string },
): LivePlatformInfo {
  const { assetName, nowIso } = input
  const base: Omit<LivePlatformInfo, 'source'> = { platform: 'ios', resolvedAt: nowIso }
  if (doc === null || typeof doc !== 'object') {
    return { ...base, source: 'snapshot', reason: 'ios-release-unreachable' }
  }
  const parsed = doc as ReleaseDoc
  if (typeof parsed.tag_name !== 'string') {
    return { ...base, source: 'snapshot', reason: 'ios-release-doc-shape' }
  }
  const asset = (parsed.assets ?? []).find(
    (a) => typeof a?.name === 'string' && a.name === assetName,
  )
  if (asset === undefined) {
    return { ...base, source: 'unavailable', reason: `ios-asset-missing:${assetName}` }
  }
  const url =
    typeof asset.browser_download_url === 'string' ? asset.browser_download_url.trim() : ''
  if (url === '') {
    return { ...base, source: 'unavailable', reason: 'ios-asset-has-no-download-url' }
  }
  return {
    ...base,
    source: 'live',
    releaseDate: isoDateOf(parsed.published_at),
    assets: [
      {
        href: url,
        sizeBytes: Number.isFinite(asset.size) ? Number(asset.size) : 0,
        format: 'iOS IPA (TrollStore)',
      },
    ],
  }
}

/* -------------------------------------------------------------------------- */
/* 扩展端判据(实物文件是唯一真值)                                              */
/* -------------------------------------------------------------------------- */

export interface ArtifactEntry {
  name: string
  sizeBytes: number
  mtimeMs: number
}

export interface ExtensionManifestEntry {
  version?: unknown
  sizeBytes?: unknown
}

/** 扩展包站内可点地址(单一落形处,防第二处手拼漂移) */
export function extensionAssetHref(fileName: string): string {
  return `/downloads/extension/${encodeURIComponent(fileName)}`
}

/** 从扩展包文件名里取版本号;取不到返回 null(不编) */
export function parseVersionFromArtifactName(name: string): string | null {
  const matched = /-v(\d+\.\d+\.\d+)\.zip$/i.exec(name)
  return matched?.[1] ?? null
}

/** 按 mtime 取最新一枚;空集合 ⇒ null(枚举到 0 不判成"有") */
export function pickNewestArtifact(entries: readonly ArtifactEntry[]): ArtifactEntry | null {
  if (entries.length === 0) return null
  const [first, ...rest] = entries
  if (first === undefined) return null
  return rest.reduce((acc, cur) => (cur.mtimeMs > acc.mtimeMs ? cur : acc), first)
}

/**
 * 判扩展端:`sync-downloads.mjs` 生成的 manifest 只用作**交叉校验**(这份产物此前全仓零消费者,
 * 接进来当对账输入,不再是个死产物)。不一致 ⇒ 点名,但结论一律以量出来的字节为准:
 * 派生标签不得覆盖实物(2026-11-02 实测三个体积:账面 6498757 / 工作树 1852871 / 生产 1897977)。
 */
export function judgeExtensionArtifact(
  picked: ArtifactEntry | null,
  manifest: ExtensionManifestEntry | null,
  nowIso: string,
): LivePlatformInfo {
  const base: Omit<LivePlatformInfo, 'source'> = { platform: 'extension', resolvedAt: nowIso }
  if (picked === null) {
    return { ...base, source: 'unavailable', reason: 'extension-artifact-file-missing' }
  }
  const version = parseVersionFromArtifactName(picked.name)
  const drift: string[] = []
  if (manifest !== null) {
    if (typeof manifest.version === 'string' && version !== null && manifest.version !== version) {
      drift.push(`extension-manifest-version-drift:${manifest.version}!=${version}`)
    }
    if (
      typeof manifest.sizeBytes === 'number' &&
      Number.isFinite(manifest.sizeBytes) &&
      manifest.sizeBytes !== picked.sizeBytes
    ) {
      drift.push(`extension-manifest-size-drift:${manifest.sizeBytes}!=${picked.sizeBytes}`)
    }
  }
  return {
    ...base,
    source: 'live',
    version: version ?? undefined,
    reason: drift.length > 0 ? drift.join(',') : undefined,
    assets: [
      {
        href: extensionAssetHref(picked.name),
        sizeBytes: picked.sizeBytes,
        format: 'Chrome MV3 ZIP',
      },
    ],
  }
}

/* -------------------------------------------------------------------------- */
/* 合并判据(详情页与侧边栏共用这一份)                                          */
/* -------------------------------------------------------------------------- */

/** ISO 时刻 → YYYY-MM-DD;取不到返回 undefined(不写假日期) */
export function isoDateOf(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : undefined
}

/**
 * 详情页用的合并:底稿 = 构建期快照,运行期真值只在 `source==='live'` 时覆盖对应字段。
 *  - `snapshot` / `unavailable` ⇒ 原样返回底稿(拿不到输入 / 该端没登记 ≠ 该端有包)
 *  - 覆盖只动 version/releaseDate/assets 三个展示面,静态文案仍走底稿
 *  - `assets` 为空数组不覆盖(空 = 该端无独立安装包,不是"把底稿清空")
 */
export function mergeLiveMeta(
  staticMeta: PlatformMeta,
  live: LivePlatformInfo | null | undefined,
): PlatformMeta {
  if (live === null || live === undefined || live.source !== 'live') return staticMeta
  const assets = live.assets && live.assets.length > 0 ? live.assets : staticMeta.assets
  return {
    ...staticMeta,
    version: live.version ?? staticMeta.version,
    releaseDate: live.releaseDate ?? staticMeta.releaseDate,
    assets,
  }
}

export interface LiveEntryView {
  version?: string
  href: string
  /** 运行期是否取到了可点的安装包 */
  hasLiveAsset: boolean
}

/**
 * 侧边栏「下载」栏用的投影:与 `mergeLiveMeta` 同一条"只有 live 才覆盖"的规则,
 * 但**落点(href)只在底稿为空时才由运行期资产补上** —— 底稿非空说明那一格本来就有既定
 * 去处:desktop / extension / cli 指的是站内详情页 `/download/<端>`,不是裸文件链接。
 * 覆写它等于替机主改掉点击语义(点了直接开始下载文件),那不是"实时更新"要的事。
 * 版本号仍一律取运行期真值 —— 徽章说的是"最新已发布版本",与点进去看哪一页无关。
 */
export function liveEntryView(
  live: LivePlatformInfo | null | undefined,
  fallbackHref: string,
): LiveEntryView {
  if (live === null || live === undefined || live.source !== 'live') {
    return { href: fallbackHref, hasLiveAsset: false }
  }
  const assetHref = live.assets?.[0]?.href ?? ''
  return {
    version: live.version,
    href: fallbackHref !== '' || assetHref === '' ? fallbackHref : assetHref,
    hasLiveAsset: assetHref !== '',
  }
}

/**
 * desktop 的落形判据(不复制挑版判据 —— 那住 desktop-feed-live)。
 * 只搬"下载页要展示的三件":版本号 / 日期 / 资产直链与体积。
 * `signature` 刻意不带:那是更新器 feed 的东西,住 desktop-feed-live 与 /desktop-feed.json,
 * 下载页把它抄过来只会多出第二个消费面(§0.6)。
 */
export function toDesktopLiveInfo(
  source: Pick<LiveDesktopSource, 'version' | 'releaseDate' | 'assets'>,
  nowIso: string,
  scan?: ReleaseScanSummary,
): LivePlatformInfo {
  return {
    platform: 'desktop',
    source: 'live',
    version: source.version,
    releaseDate: isoDateOf(source.releaseDate),
    assets: source.assets.map((a) => ({
      href: a.href,
      sizeBytes: a.sizeBytes,
      format: a.format,
      arch: a.arch,
    })),
    ...(scan === undefined ? {} : { scan }),
    resolvedAt: nowIso,
  }
}

/**
 * iOS 站点腿指针探测的落形判据。
 * 读的是**线上 cdn-server 自己怎么答**(302 + `X-Release-Version*` 头 + 版本副本的
 * Content-Length/Type),而不是让站点再抄一份落点路径 —— 那会造出第二个"腿在哪"的真相源。
 * 三态:302 且头齐且能取到字节 ⇒ live;不是 302 / 缺头 / 类型不对 ⇒ 未判定(交调用方回落);
 * 探测本身失败(超时/断网)⇒ 也是未判定,绝不读成"该端没包"。
 */
export function judgeIpaPointerProbe(
  input: {
    status?: number
    location?: string | null
    version?: string | null
    sizeBytes?: number | null
    contentType?: string | null
  },
  nowIso: string,
): LivePlatformInfo {
  const base: Omit<LivePlatformInfo, 'source'> = { platform: 'ios', resolvedAt: nowIso }
  const status = Number(input.status ?? 0)
  const loc = typeof input.location === 'string' ? input.location.trim() : ''
  if (status !== 302 || loc === '' || !/^https?:/i.test(loc)) {
    return { ...base, source: 'snapshot', reason: `ipa-pointer-not-resolved:${status || 'no-location'}` }
  }
  const version = typeof input.version === 'string' ? input.version.trim() : ''
  if (version === '') {
    return { ...base, source: 'snapshot', reason: 'ipa-pointer-missing-version-header' }
  }
  const size = Number(input.sizeBytes ?? 0)
  const ct = String(input.contentType ?? '')
  if (!Number.isFinite(size) || size <= 0 || !ct.includes('octet-stream')) {
    return {
      ...base,
      source: 'snapshot',
      reason: `ipa-version-copy-unverified:${size || 'no-size'}/${ct || 'no-type'}`,
    }
  }
  return {
    ...base,
    source: 'live',
    version,
    assets: [{ href: loc, sizeBytes: size, format: 'iOS IPA (TrollStore)' }],
  }
}

/** 镜像测试入口(AGENTS §22c:测试 import 这份判据,不得复制一份) */
export const __test__ = {
  judgeAppVersionRow,
  judgeNpmRegistryDoc,
  judgeIosReleaseDoc,
  judgeExtensionArtifact,
  pickNewestArtifact,
  parseVersionFromArtifactName,
  extensionAssetHref,
  isoDateOf,
  mergeLiveMeta,
  liveEntryView,
  toDesktopLiveInfo,
  judgeIpaPointerProbe,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
