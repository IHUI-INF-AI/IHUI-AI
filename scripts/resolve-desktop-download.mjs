#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/* eslint-disable no-console -- 解析脚本为 CLI 工具,需 console 输出诊断信息 */

/**
 * resolve-desktop-download.mjs — 动态解析桌面端下载产物(零手动维护)
 *
 * 背景:downloads.config.ts 的 desktop 段曾硬编码 GitHub Release URL / 大小 / 版本号,
 * 每次发版(desktop-vX.Y.Z)后需手动同步,易遗漏、易错。本脚本从 GitHub Releases API
 * 动态解析最新 desktop-v* release 的安装包资产,生成入库快照
 * `apps/web/src/config/desktop-feed.generated.ts`,前端构建期读取快照渲染下载页。
 *
 * 数据源:GitHub Releases API(公开 repo 无需 token;可选 GITHUB_TOKEN 提升限流)。
 * 资产 size 由 API 直接返回,无需下载文件(安装包 230MB+,HEAD 请求也不必要)。
 *
 * 用法:
 *   node scripts/resolve-desktop-download.mjs                # 解析线上 → 有差异则写快照
 *   node scripts/resolve-desktop-download.mjs --check        # 仅对比线上 vs 本地快照(有差异退出码 1)
 *   node scripts/resolve-desktop-download.mjs --dry-run      # 预览:打印将写入的内容,不落盘
 *   node scripts/resolve-desktop-download.mjs --offline      # 不联网,仅打印本地快照内容
 *   node scripts/resolve-desktop-download.mjs --help         # 帮助
 *
 * 环境变量:
 *   GITHUB_REPOSITORY — owner/repo(默认 IHUI-INF-AI/IHUI-AI)
 *   GITHUB_TOKEN      — GitHub API token(可选,公开 repo 限流 60 req/h 足够)
 *
 * 退出码:
 *   0 — 解析完成且(写模式:快照无变化 / check 模式:一致 / dry-run / offline)
 *   1 — 有差异(check 模式)/ 网络或解析错误
 *   2 — 参数错误
 *
 * CI 集成:
 *   - release-desktop.yml(sync-downloads job):发布完成后运行本脚本写快照,
 *     快照路径纳入 git status + commit,自动提交回 main。
 *   - sync-downloads.yml(每日 cron):兜底刷新(幂等,无变化不产生提交)。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 平台映射判据唯一真相源(与 scripts/generate-latest-json.mjs 共用,勿在此二次实现)
import { inferPlatformForPackage, buildUpdaterPlatforms } from './lib/tauri-updater-platforms.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

// ─── 路径常量 ────────────────────────────────────────────────
const SNAPSHOT_PATH = join(PROJECT_ROOT, 'apps/web/src/config/desktop-feed.generated.ts')
const TAURI_CONF_PATH = join(PROJECT_ROOT, 'apps/desktop/src-tauri/tauri.conf.json')
const DEFAULT_REPO = 'IHUI-INF-AI/IHUI-AI'
const RELEASE_PREFIX = 'desktop-v'
const RELEASES_PAGE = 'https://github.com/IHUI-INF-AI/IHUI-AI/releases'

// ─── 控制台颜色 + 日志 ──────────────────────────────────────
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

/** @param {'info'|'ok'|'warn'|'err'} level @param {string} msg */
function log(level, msg) {
  const colorMap = { info: 'cyan', ok: 'green', warn: 'yellow', err: 'red' }
  const iconMap = { info: 'ℹ', ok: '✓', warn: '⚠', err: '✗' }
  console.log(`${C[colorMap[level]]}${iconMap[level]} ${msg}${C.reset}`)
}

/** 格式化字节数 */
function formatBytes(bytes) {
  if (bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return unitIndex === 0
    ? `${Math.round(value)} ${units[unitIndex]}`
    : `${value.toFixed(1)} ${units[unitIndex]}`
}

/**
 * 比较两个 SemVer 版本号(a>b 返回正数)。Gitee/GitHub 两条解析路径共用。
 * 两处都必须"取版本最大者"而非依赖 API 返回顺序 —— GitHub /releases 会把 draft
 * 排在最前,曾导致快照被 draft 的 desktop-v0.1.16 覆盖(2026-09-18 实测)。
 */
function cmpVer(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0)
  return 0
}

/** 判定文件名中是否包含目标版本("_0.1.14_" 或 "-0.1.14-" 分隔形式均可命中) */
function nameMatchesVersion(name, version) {
  return (
    name.includes(`_${version}_`) || name.includes(`-${version}-`) || name.endsWith(`_${version}`)
  )
}

/**
 * 安装包资产 → DownloadAsset 快照条目。
 * 仅收录与 release 版本一致的产物(release 中可能混有历史版本残留,
 * 如 desktop-v0.1.14 资产中的 0.1.13 exe/msi——与 generate-latest-json.mjs 同理)。
 * @param {{ name: string; size: number; browser_download_url: string }} asset
 * @param {string} version
 * @returns {{ href: string; sizeBytes: number; format: string; arch?: string } | null}
 */
function mapAsset(asset, version) {
  const name = asset.name
  if (!nameMatchesVersion(name, version)) return null
  if (name.endsWith('.sig') || name.endsWith('.app.tar.gz')) return null

  const base = { href: asset.browser_download_url, sizeBytes: asset.size }

  // Windows:IHUI.AI_0.1.14_x64-setup.exe(NSIS,优先)/ IHUI.AI_0.1.14_x64_en-US.msi
  if (name.endsWith('.exe') && name.includes('setup')) {
    return { ...base, format: 'Windows NSIS exe', arch: 'x64' }
  }
  if (name.endsWith('.msi')) {
    return { ...base, format: 'Windows MSI', arch: 'x64' }
  }
  // macOS:IHUI.AI_0.1.14_x64.dmg / IHUI.AI_0.1.14_aarch64.dmg
  if (name.endsWith('.dmg')) {
    const arch = name.includes('aarch64') || name.includes('arm64') ? 'aarch64' : 'x64'
    return { ...base, format: 'macOS DMG', arch }
  }
  // Linux:AppImage(优先)/ deb
  if (name.endsWith('.AppImage')) {
    return { ...base, format: 'Linux AppImage', arch: 'amd64' }
  }
  if (name.endsWith('.deb')) {
    return { ...base, format: 'Linux DEB', arch: 'amd64' }
  }
  // rpm 不在下载页展示(与 deb 重复,且 deb/AppImage 已覆盖)
  return null
}

/**
 * 抓取 .sig 签名内容。
 * 2026-09-18:统一封装 —— 缺失/请求失败一律返回空串,保证快照字段形状恒定
 * (此前「有签名才写字段」会让 assets 形状随数据漂移,下游 TS 访问 .signature 直接报错)。
 * @param {string | undefined} url
 * @returns {Promise<string>}
 */
async function fetchSignature(url) {
  if (!url) return ''
  try {
    const res = await fetch(url, { redirect: 'follow' })
    return res.ok ? (await res.text()).trim() : ''
  } catch {
    return ''
  }
}

/** 读取 tauri.conf.json version(校验 release 与源码版本一致性) */
function readTauriVersion() {
  try {
    const conf = JSON.parse(readFileSync(TAURI_CONF_PATH, 'utf-8'))
    return typeof conf.version === 'string' ? conf.version : null
  } catch {
    return null
  }
}

/** 读取本地快照(不存在返回 null) */
async function readLocalSnapshot() {
  if (!existsSync(SNAPSHOT_PATH)) return null
  try {
    const src = await readFile(SNAPSHOT_PATH, 'utf-8')
    // 2026-09-24 修既有缺陷:快照实际导出形态是带类型标注的
    // `export const DESKTOP_FEED: DesktopFeed = {`,旧 marker 找的是无标注形态,
    // 永远 indexOf === -1 → 本地快照恒读成 null → --check 恒判"有差异"、
    // snapshotEqual 恒 false(每次 CI 都重写快照)。改为容忍类型标注的正则。
    const markerMatch = src.match(/export const DESKTOP_FEED(?:\s*:\s*[\w.<>\s|]+)?\s*=\s*/)
    if (!markerMatch || markerMatch.index === undefined) return null
    // 自产格式:marker 之后即对象字面量(尾随注释不影响 eval),整体 eval 解析
    const body = src.slice(markerMatch.index + markerMatch[0].length)
    return Function(`"use strict"; return (${body})`)()
  } catch {
    return null
  }
}

/**
 * 从 Gitee API 解析最新 desktop release(2026-09-17 立:本机一键发版只发 Gitee,
 * 下载页须能反映最新版本;Gitee 直链国内下载也快)。无匹配则返回 null 由 GitHub 兜底。
 */
async function resolveFromGitee() {
  const owner = process.env.GITEE_OWNER || 'JLSLSSZWHYXGS_0'
  const repo = process.env.GITEE_REPO || 'IHUI-AI'
  let releases
  try {
    const res = await fetch(`https://gitee.com/api/v5/repos/${owner}/${repo}/releases?per_page=20`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    releases = await res.json()
  } catch {
    return null
  }
  const list = (Array.isArray(releases) ? releases : []).filter(
    (r) => r.tag_name && r.tag_name.startsWith(RELEASE_PREFIX) && !r.draft,
  )
  if (list.length === 0) return null
  // 版本号最大者为准(避免依赖 API 排序;cmpVer 见模块级定义)
  list.sort((a, b) =>
    cmpVer(a.tag_name.replace(RELEASE_PREFIX, ''), b.tag_name.replace(RELEASE_PREFIX, '')),
  )
  const release = list[list.length - 1]
  const version = release.tag_name.replace(RELEASE_PREFIX, '')
  const releaseDate = (release.created_at || release.published_at || '').slice(0, 10)
  const assets = []
  for (const asset of release.assets || []) {
    const href = `https://gitee.com/${owner}/${repo}/releases/download/${release.tag_name}/${encodeURIComponent(asset.name)}`
    // Gitee 列表 API 不返回 size → HEAD 取 content-length(302 后为真实文件大小)
    let size = Number(asset.size || asset.file_size || 0)
    if (!size) {
      try {
        const head = await fetch(href, { method: 'HEAD', redirect: 'follow' })
        size = Number(head.headers.get('content-length') || 0)
      } catch {
        size = 0
      }
    }
    // 2026-09-21(0.1.43 run 35562703606 实测):CI 环境对 Gitee 302 链 HEAD 拿不到
    // content-length(size=0)→ 下载页显示 "-"。Range GET(bytes=0-0)取
    // content-range 总长兜底(206 响应头形如 "bytes 0-0/4070601")。
    if (!size) {
      try {
        const ranged = await fetch(href, { headers: { Range: 'bytes=0-0' }, redirect: 'follow' })
        const cr = ranged.headers.get('content-range') || ''
        const total = cr.split('/')[1]
        if (total && /^\d+$/.test(total)) size = Number(total)
      } catch {
        size = size || 0
      }
    }
    const mapped = mapAsset({ name: asset.name, browser_download_url: href, size }, version)
    if (mapped) {
      // 2026-09-17:同步抓取 .sig 签名内容(几 KB)→ 供站点 feed 输出 updater 格式。
      // Gitee 不单独产 updater 条目:windows 键必须与下载页 assets 取同一合并结果
      // (Gitee 同名平台可能有多个历史资产,assets 的 format|arch 归一已定序);
      // mac/linux 的 Gitee 直链实测 404,由 GitHub 源补齐。
      mapped.signature = await fetchSignature(`${href}.sig`)
      assets.push(mapped)
    }
  }
  if (assets.length === 0) return null
  // 2026-09-18(实测):Gitee 同步失败/部分完成时该 release 可能只有个别资产
  // (desktop-v0.1.36 实测只有 1 个 Windows 条目),当时要求三平台齐全才采纳。
  // 2026-09-21(实测 0.1.42 重演):本机一键发版通道只传 Windows 到 Gitee,
  // 「三平台齐全」门槛把 Gitee 源整单弃用 → 全量回退 GitHub → 更新器 feed 的
  // 下载 URL 指向 github.com,国内直连被重置(本机实测 curl exit 56),
  // 自动更新对中国用户整体失效。改为:不再整单回退,返回部分资产,交由
  // resolveOnline 按 format+arch 与 GitHub 源合并(Gitee 命中的平台国内直链
  // 可达,缺失平台由 GitHub 补齐,下载页与 feed 永不缺平台)。
  const families = new Set(assets.map((a) => String(a.format).split(' ')[0]))
  const complete = families.has('Windows') && families.has('macOS') && families.has('Linux')
  if (!complete) {
    console.warn(
      `[resolve] Gitee ${release.tag_name} 资产不完整(${assets.length} 个:${[...families].join('/')}),交由合并逻辑用 GitHub 补齐`,
    )
  }
  return { version, releaseDate, giteeReleasesUrl: `https://gitee.com/${owner}/${repo}/releases`, resolvedFromTag: release.tag_name, assets }
}

/**
 * 从 GitHub API 解析最新 desktop release 快照(原 resolveOnline 的 GitHub 段抽出)。
 * @returns {Promise<{ version: string; releaseDate: string; githubReleasesUrl: string; resolvedFromTag: string; resolvedAt: string; assets: Array<{ href: string; sizeBytes: number; format: string; arch?: string }> }>}
 */
async function resolveFromGithub() {
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=30`, { headers })
  if (!res.ok) {
    throw new Error(`GitHub Releases API failed: ${res.status} ${res.statusText}`)
  }
  const releases = await res.json()
  // 2026-09-18(实测):GitHub /releases 把 draft 排在列表**最前**,仓库里存有一个
  // draft 的 desktop-v0.1.16(2026-09-05 遗留草稿,17 个资产)。裸 find() 会命中它,
  // 生成指向草稿 untagged-* 资产 URL 的快照 → 下载页版本从 0.1.35 掉回 0.1.16 死链。
  // 此处显式排除 draft/prerelease,并在全部候选中按 SemVer 取最高,不再依赖 API 顺序。
  const candidates = (releases || []).filter(
    (r) => r.tag_name && r.tag_name.startsWith(RELEASE_PREFIX) && !r.draft && !r.prerelease,
  )
  candidates.sort((a, b) =>
    cmpVer(b.tag_name.replace(RELEASE_PREFIX, ''), a.tag_name.replace(RELEASE_PREFIX, '')),
  )
  const release = candidates[0]
  if (!release) {
    throw new Error(`No published (non-draft) release matching ${RELEASE_PREFIX}* found in ${repo}`)
  }

  const version = release.tag_name.replace(new RegExp(`^${RELEASE_PREFIX}`), '')
  if (!version || version === release.tag_name) {
    throw new Error(`Cannot extract version from tag: ${release.tag_name}`)
  }
  const releaseDate = (release.published_at || '').slice(0, 10)

  // 2026-09-18:签名抓取此前只存在于 Gitee 分支 → GitHub 源快照恒无 signature,
  // 既让 /api/desktop-feed 输出空签名(Tauri 更新器判定无效、拒绝自动更新),
  // 又使快照字段形状在两个数据源之间漂移(下游 TS 访问 .signature 报错)。
  // 此处按 release 资产清单精确配对 `<安装包名>.sig`,缺失即空串(形状恒定)。
  const sigUrlByName = new Map(
    (release.assets || [])
      .filter((a) => typeof a.name === 'string' && a.name.endsWith('.sig'))
      .map((a) => [a.name, a.browser_download_url]),
  )
  // 同一 .sig 可能被下载页资产与 updater 条目各取一次 → 会话内缓存去重
  const sigCache = new Map()
  /** @param {string | undefined} url @returns {Promise<string>} */
  const getSignature = async (url) => {
    if (!url) return ''
    if (!sigCache.has(url)) sigCache.set(url, await fetchSignature(url))
    return sigCache.get(url)
  }
  const assets = []
  // updater 候选(2026-09-24):含下载页不展示的 `.app.tar.gz`(macOS 唯一可更新产物);
  // dmg 由 inferPlatformForPackage 判 null 天然排除。空签名条目由 buildUpdaterPlatforms 过滤。
  const updaterEntries = []
  for (const asset of release.assets || []) {
    const mapped = mapAsset(asset, version)
    // `.sig` 资产名同样能被 inferPlatformForPackage 命中(.app.tar.gz.sig 等),
    // 但其 URL 是签名文件本体,绝不能作为安装包条目 → 显式排除。
    const isUpdaterPkg = !asset.name.endsWith('.sig') && Boolean(inferPlatformForPackage(asset.name))
    if (!mapped && !isUpdaterPkg) continue
    const signature = await getSignature(sigUrlByName.get(`${asset.name}.sig`))
    if (mapped) {
      mapped.signature = signature
      assets.push(mapped)
    }
    if (isUpdaterPkg) {
      updaterEntries.push({ name: asset.name, url: asset.browser_download_url, signature })
    }
  }
  if (assets.length === 0) {
    throw new Error(`No install assets found in release ${release.tag_name} for version ${version}`)
  }

  return {
    version,
    releaseDate,
    githubReleasesUrl: RELEASES_PAGE,
    resolvedFromTag: release.tag_name,
    resolvedAt: new Date().toISOString(),
    assets,
    updaterEntries,
  }
}

/** 平台优先级排序:Windows(exe→msi)→ macOS(dmg x64→aarch64)→ Linux(AppImage→deb) */
function sortAssets(assets) {
  const order = ['Windows NSIS exe', 'Windows MSI', 'macOS DMG', 'Linux AppImage', 'Linux DEB']
  return assets.sort((a, b) => {
    const ai = order.indexOf(a.format)
    const bi = order.indexOf(b.format)
    if (ai !== bi) return ai - bi
    if (a.arch === b.arch) return 0
    // 同格式多架构:x64(通用架构)优先,aarch64 在后
    if (a.arch === 'x64') return -1
    if (b.arch === 'x64') return 1
    return (a.arch || '') < (b.arch || '') ? -1 : 1
  })
}

/**
 * 总解析入口:Gitee 优先 + GitHub 兜底,**按 format+arch 合并**。
 * 2026-09-21:由「Gitee 三平台齐全才采纳,否则整单回退 GitHub」改为按平台合并 ——
 * 根治 0.1.42 实测事故:本机一键发版通道只传 Windows 到 Gitee,Gitee 源被整单弃用,
 * feed 下载 URL 全量指向 github.com,国内直连被重置(curl exit 56),自动更新失效。
 * 合并规则:
 *   - Gitee 命中的平台用 Gitee 直链(国内可达);
 *   - Gitee 缺失平台由 GitHub 补齐(下载页全平台永不缺失);
 *   - Gitee 资产签名缺失时用 GitHub 同平台签名兜底(同一 CI 产物上传两端,字节一致);
 *   - 跨版本窗口期(本机发版后 CI 未跑完):Gitee=新 / GitHub=旧 时会混入旧版
 *     macOS/Linux 资产,输出 warn;CI sync-downloads 跑完后自动归一。
 */
/** 从资产 href 反解文件名(github 直链为原样名、gitee 直链为 encodeURIComponent 形态) */
function nameFromHref(href) {
  const last = String(href).split('/').pop().split('?')[0]
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

/**
 * 由最终快照数据构建 updaterPlatforms(站点 feed 的 platforms 映射)。
 * 条目取序 = 合并后的 assets(下载页与 feed 同源 —— windows 键与旧 route
 * `assets.find(/Windows/i)` 消费的是同一对象,逐字节不变),再加下载页不展示的
 * updater 专属产物兜底(macOS 唯一可更新产物 `.app.tar.gz`、rpm 等,URL 恒为
 * GitHub 直链 —— Gitee mac/linux 资产实测 404)。空签名/白名单外 host 不出键。
 */
function withUpdaterPlatforms(data) {
  // gitee 源单独命中时 data 带着 giteeReleasesUrl,它不进快照 → 解构剥离(下划线前缀 = 刻意弃用,eslint /^_/u)
  const { updaterEntries, giteeReleasesUrl: _giteeReleasesUrl, ...rest } = data
  const assetEntries = (data.assets || []).map((a) => ({
    name: nameFromHref(a.href),
    url: a.href,
    signature: a.signature || '',
  }))
  const seenNames = new Set(assetEntries.map((e) => e.name))
  const extras = (updaterEntries || []).filter((e) => !seenNames.has(e.name))
  return {
    ...rest,
    updaterPlatforms: buildUpdaterPlatforms([...assetEntries, ...extras], { version: data.version }),
  }
}

async function resolveOnline() {
  const fromGitee = await resolveFromGitee()
  let fromGithub = null
  try {
    fromGithub = await resolveFromGithub()
  } catch (err) {
    if (!fromGitee) throw err
    console.warn(
      `[resolve] GitHub 源解析失败(${err instanceof Error ? err.message : String(err)}),仅用 Gitee 源 ${fromGitee.resolvedFromTag}(${fromGitee.assets.length} 个资产)`,
    )
    // GitHub 不可达时 darwin/linux 无可靠直链(Gitee 侧实测 404),updaterPlatforms
    // 只会剩 windows 键 —— 空签名/被拒 host 不出键,行为与旧版站点 feed 等价。
    return withUpdaterPlatforms(
      {
        ...fromGitee,
        resolvedAt: new Date().toISOString(),
        githubReleasesUrl: fromGitee.giteeReleasesUrl,
      },
    )
  }
  if (!fromGitee) {
    console.log(`[resolve] Gitee 源未命中,使用 GitHub 源: ${fromGithub.resolvedFromTag}(${fromGithub.assets.length} 个资产)`)
    return withUpdaterPlatforms(fromGithub)
  }
  if (fromGitee.version !== fromGithub.version) {
    console.warn(
      `[resolve] 两源版本不一致:Gitee=${fromGitee.version} / GitHub=${fromGithub.version},合并将混入 GitHub 旧版资产(发版窗口期正常,CI 完成后自动归一)`,
    )
  }

  console.log(`[resolve] Gitee 源命中: ${fromGitee.resolvedFromTag}(${fromGitee.assets.length} 个资产),与 GitHub 源按平台合并`)
  const keyOf = (a) => `${a.format}|${a.arch || ''}`
  const giteeMap = new Map(fromGitee.assets.map((a) => [keyOf(a), a]))
  const merged = fromGithub.assets.map((a) => {
    const g = giteeMap.get(keyOf(a))
    if (!g) return a
    giteeMap.delete(keyOf(a))
    return { ...g, signature: g.signature || a.signature }
  })
  for (const g of giteeMap.values()) merged.push(g)

  return withUpdaterPlatforms({
    version: fromGitee.version,
    releaseDate: fromGitee.releaseDate,
    githubReleasesUrl: fromGitee.giteeReleasesUrl,
    resolvedFromTag: fromGitee.resolvedFromTag,
    resolvedAt: new Date().toISOString(),
    assets: sortAssets(merged),
    // extras 用 GitHub 全量 updater 候选(含下载页不展示的 .app.tar.gz;
    // 与 assets 重名者由 withUpdaterPlatforms 去重)
    updaterEntries: fromGithub.updaterEntries,
  })
}

/** 序列化快照为 TS 文件内容(prettier 兼容格式:单引号 + 2 空格 + 尾逗号) */
function serializeSnapshot(data) {
  const assetLines = data.assets
    .map((a) => {
      // 2026-09-18:signature 恒定输出(缺失为空串)—— 字段有无不再随数据变化,
      // 下游 TS 类型因此稳定,不会出现「快照一刷新就 typecheck 报 TS2339」的反复回归。
      return `    { href: '${a.href}', sizeBytes: ${a.sizeBytes}, format: '${a.format}', arch: '${a.arch}', signature: '${a.signature || ''}' },`
    })
    .join('\n')
  // 2026-09-24:updater 四平台映射(站点 feed 直接输出,不再由 route 自己按
  // /Windows/i 挑单条)。键由 buildUpdaterPlatforms 保证稳定序与非空签名。
  const platformLines = Object.entries(data.updaterPlatforms || {})
    .map(([k, v]) => `    '${k}': { url: '${v.url}', signature: '${v.signature}' },`)
    .join('\n')
  return `// AUTO-GENERATED by scripts/resolve-desktop-download.mjs — 请勿手动编辑
// 数据源:GitHub Releases 最新 ${RELEASE_PREFIX}* release 资产(发版后由 CI 自动刷新)
export interface DesktopFeedAsset {
  href: string
  sizeBytes: number
  format: string
  arch: string
  /** Tauri 更新器签名(release 未附 .sig 资产时为空串 → 更新器判定无效) */
  signature: string
}

/** Tauri updater 平台条目:url 必须是 GitHub/Gitee 资产直链,signature 非空 */
export interface DesktopFeedUpdaterEntry {
  url: string
  signature: string
}

export interface DesktopFeed {
  version: string
  releaseDate: string
  githubReleasesUrl: string
  resolvedFromTag: string
  resolvedAt: string
  assets: DesktopFeedAsset[]
  /**
   * Tauri updater feed 的 platforms 映射(键:windows-x86_64 / linux-x86_64 /
   * darwin-x86_64 / darwin-aarch64;缺签名/host 不可达的平台不出现)。
   * 历史快照无此字段(route 有 windows 兜底派生)。
   */
  updaterPlatforms?: Record<string, DesktopFeedUpdaterEntry>
}

export const DESKTOP_FEED: DesktopFeed = {
  version: '${data.version}',
  releaseDate: '${data.releaseDate}',
  githubReleasesUrl: '${data.githubReleasesUrl}',
  resolvedFromTag: '${data.resolvedFromTag}',
  resolvedAt: '${data.resolvedAt}',
  assets: [
${assetLines}
  ],${platformLines ? `
  updaterPlatforms: {
${platformLines}
  },` : ''}
}
`
}

/** 深度比较两份 updaterPlatforms(键集 + 每键 url/signature) */
function updaterPlatformsEqual(a, b) {
  const pa = (a && a.updaterPlatforms) || {}
  const pb = (b && b.updaterPlatforms) || {}
  const ka = Object.keys(pa).sort()
  const kb = Object.keys(pb).sort()
  if (ka.join('|') !== kb.join('|')) return false
  return ka.every((k) => pa[k].url === pb[k].url && (pa[k].signature || '') === (pb[k].signature || ''))
}

/** 深度比较两份快照(忽略 resolvedAt) */
function snapshotEqual(a, b) {
  if (!a || !b) return false
  if (a.version !== b.version || a.releaseDate !== b.releaseDate) return false
  if (a.githubReleasesUrl !== b.githubReleasesUrl) return false
  if ((a.assets || []).length !== (b.assets || []).length) return false
  if (!updaterPlatformsEqual(a, b)) return false
  return (a.assets || []).every((item, i) => {
    const other = (b.assets || [])[i]
    return (
      item.href === other.href &&
      item.sizeBytes === other.sizeBytes &&
      item.format === other.format &&
      item.arch === other.arch &&
      (item.signature || '') === (other.signature || '')
    )
  })
}

function printSnapshot(label, data) {
  console.log(`${C.dim}── ${label} ──${C.reset}`)
  console.log(`  version:       ${C.bold}${data.version}${C.reset}`)
  console.log(`  releaseDate:   ${data.releaseDate}`)
  console.log(`  release tag:   ${data.resolvedFromTag}`)
  console.log(`  resolvedAt:    ${data.resolvedAt}`)
  for (const a of data.assets) {
    console.log(`  - ${a.format}${a.arch ? ` (${a.arch})` : ''} ${formatBytes(a.sizeBytes)}`)
    console.log(`    ${C.dim}${a.href}${C.reset}`)
  }
  const platformKeys = Object.keys(data.updaterPlatforms || {})
  if (platformKeys.length === 0) {
    console.log(`  updaterPlatforms: ${C.yellow}(空 — 站点 feed 将回落 windows 派生)${C.reset}`)
  } else {
    console.log(`  updaterPlatforms: ${platformKeys.join(', ')}`)
  }
}

// ─── 参数解析 ────────────────────────────────────────────────
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
resolve-desktop-download.mjs — 动态解析桌面端下载产物(零手动维护)

用法:
  node scripts/resolve-desktop-download.mjs             解析线上 → 有差异则写快照
  node scripts/resolve-desktop-download.mjs --check     仅对比线上 vs 本地快照(有差异退出码 1)
  node scripts/resolve-desktop-download.mjs --dry-run   预览:打印将写入的内容,不落盘
  node scripts/resolve-desktop-download.mjs --offline   不联网,仅打印本地快照内容
  node scripts/resolve-desktop-download.mjs --help      帮助

环境变量:
  GITHUB_REPOSITORY  owner/repo(默认 ${DEFAULT_REPO})
  GITHUB_TOKEN       GitHub API token(可选)
`)
  process.exit(0)
}

const checkMode = args.includes('--check')
const dryRun = args.includes('--dry-run')
const offline = args.includes('--offline')

async function main() {
  // ── offline:只读本地快照 ──
  if (offline) {
    const local = await readLocalSnapshot()
    if (!local) {
      log('err', `本地快照不存在: ${SNAPSHOT_PATH} — 请先联网运行一次`)
      process.exit(1)
    }
    printSnapshot('本地快照', local)
    return
  }

  // ── 在线解析 ──
  let online
  try {
    online = await resolveOnline()
  } catch (err) {
    log('err', `解析线上数据失败: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  // 版本一致性校验(源码 tauri.conf.json vs 最新 release,仅告警不阻塞)
  const tauriVersion = readTauriVersion()
  if (tauriVersion && tauriVersion !== online.version) {
    log(
      'warn',
      `tauri.conf.json version=${tauriVersion} 与最新 release ${online.version} 不一致 — 下载页将展示 release 版本,请确认源码版本已 bump`,
    )
  }

  const local = await readLocalSnapshot()
  const changed = !snapshotEqual(local, online)

  if (checkMode) {
    printSnapshot('线上数据', online)
    if (local) printSnapshot('本地快照', local)
    if (changed) {
      log('err', `快照与线上不一致(check 模式)→ 期望退出码 1`)
      process.exit(1)
    }
    log('ok', '快照与线上一致,无需刷新')
    return
  }

  if (dryRun) {
    printSnapshot('线上数据(将写入快照)', online)
    log('info', changed ? '快照有差异,将写入(当前为 --dry-run,未落盘)' : '快照无差异,无需写入')
    return
  }

  if (!changed) {
    printSnapshot('线上数据', online)
    log('ok', `快照已是最新(${SNAPSHOT_PATH} 无需更新)`)
    return
  }

  await writeFile(SNAPSHOT_PATH, serializeSnapshot(online), 'utf-8')
  printSnapshot('已写入快照', online)
  log('ok', `快照已更新 → ${SNAPSHOT_PATH}`)
}

main().catch((err) => {
  log('err', `致命错误: ${err instanceof Error ? err.message : String(err)}`)
  if (err instanceof Error && err.stack) console.error(C.dim + err.stack + C.reset)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
