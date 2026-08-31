#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
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

/** 从安装包文件名提取 SemVer 版本号("IHUI.AI_0.1.14_x64-setup.exe" → "0.1.14") */
function extractVersion(assetName) {
  const m = assetName.match(/(\d+\.\d+\.\d+)/)
  return m ? m[1] : null
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
    const marker = 'export const DESKTOP_FEED = '
    const start = src.indexOf(marker)
    if (start === -1) return null
    // 自产格式:marker 之后即对象字面量(无尾分号),整体 eval 解析
    const body = src.slice(start + marker.length)
    return Function(`"use strict"; return (${body})`)()
  } catch {
    return null
  }
}

/**
 * 从 GitHub API 解析最新 desktop release 快照。
 * @returns {Promise<{ version: string; releaseDate: string; githubReleasesUrl: string; resolvedFromTag: string; resolvedAt: string; assets: Array<{ href: string; sizeBytes: number; format: string; arch?: string }> }>}
 */
async function resolveOnline() {
  const repo = process.env.GITHUB_REPOSITORY || DEFAULT_REPO
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=10`, { headers })
  if (!res.ok) {
    throw new Error(`GitHub Releases API failed: ${res.status} ${res.statusText}`)
  }
  const releases = await res.json()
  const release = (releases || []).find((r) => r.tag_name && r.tag_name.startsWith(RELEASE_PREFIX))
  if (!release) {
    throw new Error(`No release matching ${RELEASE_PREFIX}* found in ${repo}`)
  }

  const version = release.tag_name.replace(new RegExp(`^${RELEASE_PREFIX}`), '')
  if (!version || version === release.tag_name) {
    throw new Error(`Cannot extract version from tag: ${release.tag_name}`)
  }
  const releaseDate = (release.published_at || '').slice(0, 10)

  const assets = []
  for (const asset of release.assets || []) {
    const mapped = mapAsset(asset, version)
    if (mapped) assets.push(mapped)
  }
  if (assets.length === 0) {
    throw new Error(`No install assets found in release ${release.tag_name} for version ${version}`)
  }

  // 平台优先级:Windows(exe→msi)→ macOS(dmg x64→aarch64)→ Linux(AppImage→deb)
  const order = ['Windows NSIS exe', 'Windows MSI', 'macOS DMG', 'Linux AppImage', 'Linux DEB']
  assets.sort((a, b) => {
    const ai = order.indexOf(a.format)
    const bi = order.indexOf(b.format)
    if (ai !== bi) return ai - bi
    if (a.arch === b.arch) return 0
    // 同格式多架构:x64(通用架构)优先,aarch64 在后
    if (a.arch === 'x64') return -1
    if (b.arch === 'x64') return 1
    return (a.arch || '') < (b.arch || '') ? -1 : 1
  })

  return {
    version,
    releaseDate,
    githubReleasesUrl: RELEASES_PAGE,
    resolvedFromTag: release.tag_name,
    resolvedAt: new Date().toISOString(),
    assets,
  }
}

/** 序列化快照为 TS 文件内容(prettier 兼容格式:单引号 + 2 空格 + 尾逗号) */
function serializeSnapshot(data) {
  const assetLines = data.assets
    .map(
      (a) =>
        `    { href: '${a.href}', sizeBytes: ${a.sizeBytes}, format: '${a.format}', arch: '${a.arch}' },`,
    )
    .join('\n')
  return `// AUTO-GENERATED by scripts/resolve-desktop-download.mjs — 请勿手动编辑
// 数据源:GitHub Releases 最新 ${RELEASE_PREFIX}* release 资产(发版后由 CI 自动刷新)
export const DESKTOP_FEED = {
  version: '${data.version}',
  releaseDate: '${data.releaseDate}',
  githubReleasesUrl: '${data.githubReleasesUrl}',
  resolvedFromTag: '${data.resolvedFromTag}',
  resolvedAt: '${data.resolvedAt}',
  assets: [
${assetLines}
  ],
}
`
}

/** 深度比较两份快照(忽略 resolvedAt) */
function snapshotEqual(a, b) {
  if (!a || !b) return false
  if (a.version !== b.version || a.releaseDate !== b.releaseDate) return false
  if (a.githubReleasesUrl !== b.githubReleasesUrl) return false
  if ((a.assets || []).length !== (b.assets || []).length) return false
  return (a.assets || []).every((item, i) => {
    const other = (b.assets || [])[i]
    return (
      item.href === other.href &&
      item.sizeBytes === other.sizeBytes &&
      item.format === other.format &&
      item.arch === other.arch
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
