// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * desktop-feed-live.ts — 桌面端「最新版本」的运行期解析器(零人工、零入库依赖)
 *
 * 为什么要这一层(2026-10-17 立;立因是**线上事故**,不是预防性重构):
 *
 *   旧链的形态:发版 → CI 跑 scripts/resolve-desktop-download.mjs 生成入库快照
 *   desktop-feed.generated.ts → **CI 把快照 push 回 main** → 站点读快照。
 *
 *   这条链有一格是死的,且**修 push 语句治不好**:
 *     · GitHub 规定:用 GITHUB_TOKEN 推送产生的 commit,不会触发新的 workflow run;
 *     · main 又开了 required status check「CI / lint-typecheck-test (push)」;
 *     ⇒ 该 check 在 bot 提交上永远缺席 ⇒ push 恒被拒
 *       (GH006:Required status check ... is expected,sync-downloads.yml 自 10-11 起连日 failure)。
 *   后果由线上实测给出:`https://aizhs.top/desktop-feed.json` 长期输出 **0.1.54**,
 *   而仓库当时已发到 desktop-v0.1.58。这一格不是"忘了跑命令",是自动化被平台约束堵死。
 *
 *   所以正解不是"把 push 再修一遍",而是**根本不再依赖提交**:站点在运行期直接读发布源。
 *
 * 真相源的选择(不新造判据):
 *   每个 desktop release 都自带 `latest.json` —— 由 tauri-action 在 CI 发版时生成,
 *   内含 version / notes / pub_date / platforms(全平台 URL + minisign 签名)。
 *   签名是对**包体**签的、由发版流水线产出 ⇒ 与资产严格配对,任何本地重算都是第二份真相。
 *   ⇒ 本模块只做「找最新 release + 取它自带的 latest.json」,**一次都不**重新推演平台键和签名。
 *
 * 2026-10-17 同时修掉的第二个事故(host 钉定的反噬):
 *   旧生成侧把 windows-x86_64 的 URL 强行改写为 Gitee 直链(意图是国内可达)。
 *   实测该 URL **HTTP 404**(Gitee 仓 /releases API 返回 `[]`,从未托管这些资产):
 *     https://gitee.com/JLSLSSZWHYXGS_0/IHUI-AI/releases/download/desktop-v0.1.54/AI_0.1.54_x64-setup.exe
 *   即 Windows 用户收到更新提示后**下载必然失败**,而 GitHub 同源直链实测 200。
 *   ⇒ 不再无条件改写 host:以 release 自带的产物 URL 为准(签名天然配对),
 *     Gitee 只在**确实存在**时才可能被调用方选用。宁可慢,不可给一条下载不了的地址。
 */

import { DESKTOP_FEED } from './desktop-feed.generated'
import type { DesktopFeed, DesktopFeedAsset } from './desktop-feed.generated'
import type { DesktopFeedPayload } from './desktop-feed-payload'

const RELEASE_PREFIX = 'desktop-v'
const DEFAULT_REPO = 'IHUI-INF-AI/IHUI-AI'
/** tauri-action 在每次发版时随产物一起上传的标准更新器清单 */
const FEED_ASSET_NAME = 'latest.json'
/**
 * 发布源不可达时的最长等待:宁可降级到快照,也不能把页面/更新器拖死。
 *
 * 为什么必须显式给这么小的值(2026-10-17 实测):本机(以及国内同网段的机器)对
 * `github.com` 的**资产下载**域名直连会 ETIMEDOUT,而不是快速失败 —— 不设超时时这一个
 * 请求能把首屏拖到 20 秒以上。降级是有成本保护的(ISR 缓存 10 分钟),慢比不对更容易被
 * 当成"网站卡了",而不是"上游没通"。
 */
const UPSTREAM_TIMEOUT_MS = 6000

/** GitHub Releases API 返回的、本模块真正用到的最小字段集 */
export interface UpstreamReleaseAsset {
  name?: string
  size?: number
  browser_download_url?: string
}

export interface UpstreamRelease {
  tag_name?: string
  draft?: boolean
  prerelease?: boolean
  published_at?: string
  html_url?: string
  assets?: UpstreamReleaseAsset[]
}

/** 从发布源解析到的最新桌面 release(未含 latest.json 正文时为 null payload) */
export interface LiveDesktopSource {
  repo: string
  tag: string
  version: string
  releaseDate: string
  htmlUrl: string
  /** release 自带的 latest.json 直链 */
  latestJsonUrl: string
  /** latest.json 正文;取不到时为 null(调用方据此降级) */
  payload: DesktopFeedPayload | null
  /** 下载页要展示的安装包(size 由 Releases API 给出,免下载 200MB 包体) */
  assets: DesktopFeedAsset[]
}

export type LiveDesktopResolution =
  | { source: 'live'; data: LiveDesktopSource }
  | { source: 'snapshot'; reason: string; fallback: DesktopFeed } /**
 * SemVer 三段比较(a>b 返回正数)。与 scripts/resolve-desktop-download.mjs 的 cmpVer 同形状。
 *
 * 为什么两者都按"取版本最大者"而不是依赖 API 顺序:GitHub /releases 会把 draft 排在最前,
 * 仓库历史上真被 draft 的 desktop-v0.1.16 覆盖过快照(2026-09-18 实测)。
 */
export function cmpVer(a: string, b: string): number {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** asset 名里版本号的分隔形态两种都命中:`_0.1.58_` 与 `-0.1.58-` */
function nameMatchesVersion(name: string, version: string): boolean {
  return (
    name.includes(`_${version}_`) || name.includes(`-${version}-`) || name.endsWith(`_${version}`)
  )
}

/**
 * 安装包资产 → 下载页条目。只收录与 release 版本一致的产物(release 里可能混有历史残留),
 * 与 .sig / .app.tar.gz / latest.json 不进下载页(不是给人下载的面孔)。
 *
 * signature 恒填空串:下载页不消费签名,而 DesktopFeedAsset 把它列为必填字段。
 * 更新器通路走的是 release 自带 latest.json 的 platforms(签名在那里由发版流水线给出,
 * 与包体严格配对),**不从这里派生** —— 两边不许互相假设。
 */
function mapAsset(asset: UpstreamReleaseAsset, version: string): DesktopFeedAsset | null {
  const name = asset.name
  const href = asset.browser_download_url
  if (!name || !href) return null
  if (!nameMatchesVersion(name, version)) return null
  if (name.endsWith('.sig') || name.endsWith('.app.tar.gz') || name.endsWith('.json')) return null
  const base = { href, sizeBytes: Number(asset.size || 0), signature: '' }
  if (name.endsWith('.exe') && name.includes('setup')) {
    return { ...base, format: 'Windows NSIS exe', arch: 'x64' }
  }
  if (name.endsWith('.msi')) return { ...base, format: 'Windows MSI', arch: 'x64' }
  if (name.endsWith('.dmg')) {
    const dmgArch = name.includes('aarch64') || name.includes('arm64') ? 'aarch64' : 'x64'
    return { ...base, format: 'macOS DMG', arch: dmgArch }
  }
  if (name.endsWith('.AppImage')) return { ...base, format: 'Linux AppImage', arch: 'amd64' }
  if (name.endsWith('.deb')) return { ...base, format: 'Linux DEB', arch: 'amd64' }
  return null
}

/** 下载页展示序:Windows(exe→msi)→ macOS → Linux(AppImage→deb) */
const DOWNLOAD_PAGE_ORDER = [
  'Windows NSIS exe',
  'Windows MSI',
  'macOS DMG',
  'Linux AppImage',
  'Linux DEB',
]

function sortAssets(assets: DesktopFeedAsset[]): DesktopFeedAsset[] {
  return [...assets].sort((a, b) => {
    const ai = DOWNLOAD_PAGE_ORDER.indexOf(a.format)
    const bi = DOWNLOAD_PAGE_ORDER.indexOf(b.format)
    if (ai !== bi) return ai - bi
    if (a.arch === b.arch) return 0
    if (a.arch === 'x64') return -1
    if (b.arch === 'x64') return 1
    return (a.arch || '') < (b.arch || '') ? -1 : 1
  })
}

export interface LatestDesktopPick {
  tag: string
  version: string
  releaseDate: string
  htmlUrl: string
  latestJsonUrl: string | null
  downloadAssets: UpstreamReleaseAsset[]
}

/**
 * 纯判据:在一组 release 中挑出「版本最大的已发布 desktop release」。
 * 抽成纯函数是为了让"取最大而不是取第一""排除 draft/prerelease"这两条能被真数据证,
 * 而不是靠读代码的人相信。
 */
export function pickLatestDesktopRelease(
  releases: readonly UpstreamRelease[],
): LatestDesktopPick | null {
  const candidates = (releases || []).filter(
    (r) =>
      typeof r.tag_name === 'string' &&
      r.tag_name.startsWith(RELEASE_PREFIX) &&
      !r.draft &&
      !r.prerelease,
  )
  if (candidates.length === 0) return null
  const sorted = [...candidates].sort((a, b) =>
    cmpVer(
      String(b.tag_name).slice(RELEASE_PREFIX.length),
      String(a.tag_name).slice(RELEASE_PREFIX.length),
    ),
  )
  const release = sorted[0]
  // noUncheckedIndexedAccess 下 sorted[0] 形态上可能为 undefined;上面 length 检查已排除,
  // 这里显式收口而不是 ! 断言 —— 断言会把"判据失效"折叠成"判据成立"。
  if (!release) return null
  const tag = String(release.tag_name)
  const version = tag.slice(RELEASE_PREFIX.length)
  if (!version) return null
  const assets = release.assets || []
  const feed = assets.find((a) => a.name === FEED_ASSET_NAME)
  return {
    tag,
    version,
    releaseDate: (release.published_at || '').slice(0, 10),
    htmlUrl: release.html_url || '',
    latestJsonUrl: feed?.browser_download_url ?? null,
    downloadAssets: assets,
  }
}

/**
 * 把 `pickLatestDesktopRelease` 的产物 + latest.json 正文组装成一个可在站点各处消费的形态。
 * payload 为 null 时意味着拿不到更新器清单 —— 调用方必须降级,不得输出半份 feed。
 */
export function buildLiveSource(
  pick: LatestDesktopPick,
  payload: DesktopFeedPayload | null,
  repo: string,
): LiveDesktopSource {
  return {
    repo,
    tag: pick.tag,
    version: pick.version,
    releaseDate: pick.releaseDate,
    htmlUrl: pick.htmlUrl,
    latestJsonUrl: pick.latestJsonUrl ?? '',
    payload,
    assets: sortAssets(
      pick.downloadAssets
        .map((a) => mapAsset(a, pick.version))
        .filter((a): a is DesktopFeedAsset => a !== null),
    ),
  }
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      // ISR:同一窗口内并重复发起出口请求;10 分钟窗口对"发版后自动生效"足够快
      next: { revalidate: 600 },
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    // 超时 / 断网 / 限流一律按"取不到"处理 —— 由调用方降级到快照,不在渲染路径上抛
    return null
  }
}

/**
 * 运行期解析最新桌面版本。
 *
 * 返回值带上来源是因为consumer必须先回答"这次用的是线上还是快照" ——
 * 旧链把两种来源都渲染成同一个版本号,于是"自动化静默死掉"在页面上完全不可见,
 * 这正是 0.1.54 能在页面上躺 4 天没人发现的原因。
 */
export async function resolveLiveDesktopFeed(): Promise<LiveDesktopResolution> {
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  // 公开源无 token 时 60 req/h;配了能显著提高上限,属可选增益
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const releases = await fetchJson<UpstreamRelease[]>(
    `https://api.github.com/repos/${repo}/releases?per_page=100`,
    headers,
  )
  if (!releases || releases.length === 0) {
    return { source: 'snapshot', reason: 'releases api unreachable', fallback: DESKTOP_FEED }
  }
  const pick = pickLatestDesktopRelease(releases)
  if (!pick) {
    return {
      source: 'snapshot',
      reason: `no published ${RELEASE_PREFIX}* release`,
      fallback: DESKTOP_FEED,
    }
  }
  // latest.json 取不到时**不再整份降级**,而是带着 payload=null 返回 live。
  //
  // 为什么必须拆这一格(2026-10-17 实测才定下粒度):`api.github.com` 可达,而 GitHub 的
  //   **资产下载**域名在国内常直连超时(本机实测 ETIMEDOUT)。若按"latest.json 取不到
  //   就退回 0.1.54 快照",等于把"版本号显示成旧号"与"更新包暂时下不动"这两件严重度
  //   完全不同的事捆在一起罚 —— 而版本号**仅靠 API 就能答对**,没理由跟着退回旧值。
  //   两端按各自容忍度分别消费:
  //     · 下载页(展示):只要 source==='live' 就显示新版本号 + 新资产,不看 payload;
  //     · 更新器 feed:payload 缺失 ⇒ 宁给快照里那份已知完好的组合,也绝不输出空签名条目
  //       (客户端拿到空签名 = 下载后验签失败,严格比"暂时没有更新提示"更糟)。
  const payload = pick.latestJsonUrl
    ? await fetchJson<DesktopFeedPayload>(pick.latestJsonUrl, { Accept: 'application/json' })
    : null
  const usable =
    payload && typeof payload.version === 'string' && payload.platforms ? payload : null
  return { source: 'live', data: buildLiveSource(pick, usable, repo) }
}

/**
 * 更新器 feed 专用入口。
 *
 * 与下载页的区别只有一条:**这里要求 payload 完整**。原因是两端对"不完整"的代价不对等:
 *   下载页少一个新版本号 = 显示有点旧;而更新器少一份签名 = 客户端下载后验签失败,
 *   后者严格更糟。同一个上午的实测里,`api.github.com` 通而 GitHub 资产下载域名超时,
 *   所以"版本号答得对、更新包暂时取不到"是真实存在且必须分而治之的形态。
 *
 * 把这份选择放在这里而不是两个 route 各写一遍 —— 两条 App Route 历史上就是逐字节
 * 复制后改一处漏一处,才有了 desktop-feed-payload.ts 那次合并;不许再开第二份判据。
 */
export async function resolveDesktopFeedForUpdater(): Promise<DesktopFeed> {
  const resolved = await resolveLiveDesktopFeed()
  if (resolved.source !== 'live') return resolved.fallback
  return resolved.data.payload ? liveToDesktopFeed(resolved.data) : DESKTOP_FEED
}

/**
 * live 源 → 快照形态,使下载页那条既有链路(PLATFORM_META → DownloadDetailContent)
 * 不必为了"这次是活的还是旧的"分叉出第二套类型。
 */
export function liveToDesktopFeed(data: LiveDesktopSource): DesktopFeed {
  const updaterPlatforms = Object.fromEntries(
    Object.entries(data.payload?.platforms || {}).map(([key, entry]) => [
      key,
      { url: entry.url, signature: entry.signature },
    ]),
  )
  return {
    version: data.version,
    releaseDate: data.releaseDate,
    githubReleasesUrl: `https://github.com/${data.repo}/releases`,
    resolvedFromTag: data.tag,
    resolvedAt: new Date().toISOString(),
    assets: data.assets,
    updaterPlatforms,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
