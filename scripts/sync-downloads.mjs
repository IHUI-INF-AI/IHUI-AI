#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * sync-downloads.mjs — 自动化构建同步:复制下载包 + 更新元数据
 *
 * 功能:
 *   1. Desktop — 检测 apps/desktop/src-tauri/target/release/bundle/ 下的安装包
 *      (.exe/.msi/.deb/.AppImage/.dmg),标准化文件名后复制到 apps/web/public/downloads/desktop/
 *   2. Extension — 将 apps/extension/.output/chrome-mv3/ 打包为 ZIP,复制到
 *      apps/web/public/downloads/extension/
 *   3. Manifest — 生成 apps/web/public/downloads/manifest.json 元数据快照(供前端运行时读取)
 *
 * 用法:
 *   node scripts/sync-downloads.mjs                  # 默认:同步所有端
 *   node scripts/sync-downloads.mjs --dry-run        # 预览模式:只输出将要执行的步骤
 *   node scripts/sync-downloads.mjs --check          # 检查模式:对比源/目标差异
 *   node scripts/sync-downloads.mjs --platform=desktop  # 只同步指定端(desktop/extension)
 *   node scripts/sync-downloads.mjs --skip-build     # 跳过构建步骤(本脚本不触发构建,此 flag 供流水线集成用)
 *   node scripts/sync-downloads.mjs --help           # 显示帮助
 *
 * 构建说明:
 *   本脚本只负责"复制已有构建产物",不触发构建。构建由 turbo pipeline 负责:
 *     pnpm build && pnpm sync:downloads
 *
 * 退出码:
 *   0 — 同步完成(含 warning 跳过的情况)
 *   1 — 致命错误(目录创建失败/复制失败/打包失败)
 *   2 — 参数错误
 *
 * 守门:脚本本身在 scripts/ 下,符合 §25 豁免(正式工具)。
 */
import { execSync } from 'node:child_process'
import { readFile, writeFile, copyFile, stat, readdir, mkdir } from 'node:fs/promises'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { crc32, deflateRawSync } from 'node:zlib'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  UPDATE_MANIFEST_FILENAME,
  renderVerifyReport,
  verifyDirectory,
  writeUpdateFileManifest,
} from './update-file-manifest.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = resolve(__dirname, '..')

// ─── 路径常量 ────────────────────────────────────────────────
const DESKTOP_BUNDLE_DIR = join(PROJECT_ROOT, 'apps/desktop/src-tauri/target/release/bundle')
const DESKTOP_TAURI_CONF = join(PROJECT_ROOT, 'apps/desktop/src-tauri/tauri.conf.json')
const EXTENSION_OUTPUT_DIR = join(PROJECT_ROOT, 'apps/extension/.output/chrome-mv3')
const EXTENSION_PKG = join(PROJECT_ROOT, 'apps/extension/package.json')
const DOWNLOADS_DIR = join(PROJECT_ROOT, 'apps/web/public/downloads')
const MANIFEST_PATH = join(DOWNLOADS_DIR, 'manifest.json')

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

/**
 * @param {'info'|'ok'|'warn'|'err'} level
 * @param {string} msg
 */
function log(level, msg) {
  const colorMap = { info: 'cyan', ok: 'green', warn: 'yellow', err: 'red' }
  const iconMap = { info: '📦', ok: '✅', warn: '⚠️', err: '❌' }
  const color = C[colorMap[level]]
  const icon = iconMap[level]
  console.log(`${color}${icon} ${msg}${C.reset}`)
}

/** @param {string} name @returns {string|null} */
function getArg(name) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`))
  return arg ? arg.split('=').slice(1).join('=') : null
}

// ─── 参数解析 ────────────────────────────────────────────────
const dryRun = process.argv.includes('--dry-run')
const checkMode = process.argv.includes('--check')
const helpFlag = process.argv.includes('--help')
const skipBuild = process.argv.includes('--skip-build')
const platformFilter = getArg('platform')

// ─── 参数校验与启动日志的档名(纯字面量,无副作用,留在模块作用域)────
const validPlatforms = ['desktop', 'extension']
const mode = dryRun ? 'dry-run' : checkMode ? 'check' : 'sync'

// ─── 工具函数 ────────────────────────────────────────────────

/**
 * 格式化字节数为人类可读字符串。
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return unitIndex === 0 ? `${Math.round(value)} ${units[unitIndex]}` : `${value.toFixed(1)} ${units[unitIndex]}`
}

/**
 * 安全读取 JSON 文件,解析失败返回 null。
 * @param {string} filePath
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function readJson(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 从 tauri.conf.json 读取 version 字段。
 * @returns {Promise<string>}
 */
async function readDesktopVersion() {
  const conf = await readJson(DESKTOP_TAURI_CONF)
  if (!conf || typeof conf.version !== 'string') {
    throw new Error(`无法从 ${DESKTOP_TAURI_CONF} 读取 version 字段`)
  }
  return conf.version
}

/**
 * 从 apps/extension/package.json 读取 version 字段。
 * @returns {Promise<string>}
 */
async function readExtensionVersion() {
  const pkg = await readJson(EXTENSION_PKG)
  if (!pkg || typeof pkg.version !== 'string') {
    throw new Error(`无法从 ${EXTENSION_PKG} 读取 version 字段`)
  }
  return pkg.version
}

/**
 * 列出目录下匹配指定扩展名的文件。
 * @param {string} dir
 * @param {string} ext - 扩展名(不含点,如 "exe")
 * @returns {Promise<Array<{ name: string; path: string; mtime: number; size: number }>>}
 */
async function listFilesByExt(dir, ext) {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (!entry.name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) continue
    const fullPath = join(dir, entry.name)
    const stats = await stat(fullPath)
    results.push({ name: entry.name, path: fullPath, mtime: stats.mtimeMs, size: stats.size })
  }
  return results.sort((a, b) => b.mtime - a.mtime)
}

/**
 * 从文件名中匹配指定版本号的文件。Tauri 产物命名格式为 `ProductName_{version}_{arch}_{...}.ext`。
 * @param {Array<{ name: string; path: string; mtime: number; size: number }>} files
 * @param {string} version
 * @returns {Array<{ name: string; path: string; mtime: number; size: number }>}
 */
function filterByVersion(files, version) {
  const marker = `_${version}_`
  return files.filter((f) => f.name.includes(marker))
}

/**
 * 幂等性检查:判断是否需要复制。
 * @param {string} sourcePath
 * @param {string} targetPath
 * @returns {Promise<'copy' | 'skip' | 'missing-target'>}
 */
async function checkCopyNeeded(sourcePath, targetPath) {
  if (!existsSync(targetPath)) return 'missing-target'
  const sourceStats = await stat(sourcePath)
  const targetStats = await stat(targetPath)
  if (sourceStats.size === targetStats.size && sourceStats.mtimeMs <= targetStats.mtimeMs) {
    return 'skip'
  }
  return 'copy'
}

/**
 * 跨平台 ZIP 打包目录内容(不引入 archiver 依赖,使用 OS 原生命令)。
 * Windows 用 PowerShell Compress-Archive;macOS/Linux 用 zip -r。
 * @param {string} srcDir - 要打包的目录(打包其内容,不含目录本身)
 * @param {string} targetZip - 目标 .zip 路径
 */
function zipDirectoryContents(srcDir, targetZip) {
  // 2026-11-18 立:纯 Node 手写 zip(node:zlib),零 shell、零 PowerShell 模块依赖。
  // 原实现走 `pwsh -Command "Compress-Archive ..."` + `stdio:'ignore'`:在部署机
  // LocalSystem 服务上下文里连续 4 轮 exit=1,stderr 被吞 ⇒ 日志只能读到
  // "Command failed",无从归因;这是 24h 内 56 次部署失败轮的直接来源(额度熔断)。
  // 手写 zip 不依赖任何外部进程,开发机与服务的运行上下文行为一致;
  // 全平台同一份实现,不再有 win32/darwin 分支漂移。
  const files = []
  ;(function walk(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      const entryName = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(fullPath, entryName)
      else if (entry.isFile()) files.push({ entryName, fullPath })
    }
  })(srcDir, '')

  const chunks = []
  const central = []
  let offset = 0
  for (const file of files) {
    const raw = readFileSync(file.fullPath)
    const compressed = deflateRawSync(raw)
    // 压缩反而更大时按存储(method=0)写,避免无意义膨胀
    const useDeflate = compressed.length < raw.length
    const payload = useDeflate ? compressed : raw
    const method = useDeflate ? 8 : 0
    const checksum = crc32(raw)
    const nameBuf = Buffer.from(file.entryName, 'utf8')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0) // 本地文件头签名
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(0, 10) // 修改时间
    local.writeUInt16LE(0, 12) // 修改日期
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(raw.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28) // extra 长度
    chunks.push(local, nameBuf, payload)

    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0) // 中央目录签名
    entry.writeUInt16LE(20, 4) // version made by
    entry.writeUInt16LE(20, 6) // version needed
    entry.writeUInt16LE(0, 8) // flags
    entry.writeUInt16LE(method, 10)
    entry.writeUInt16LE(0, 12)
    entry.writeUInt16LE(0, 14)
    entry.writeUInt32LE(checksum, 16)
    entry.writeUInt32LE(payload.length, 20)
    entry.writeUInt32LE(raw.length, 24)
    entry.writeUInt16LE(nameBuf.length, 28)
    entry.writeUInt16LE(0, 30) // extra
    entry.writeUInt16LE(0, 32) // comment
    entry.writeUInt16LE(0, 34) // 磁盘号
    entry.writeUInt16LE(0, 36) // 内部属性
    entry.writeUInt32LE(0, 38) // 外部属性
    entry.writeUInt32LE(offset, 42) // 本地头偏移
    central.push(entry, nameBuf)

    offset += 30 + nameBuf.length + payload.length
  }

  const centralBuf = Buffer.concat(central)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // 中央目录结束签名
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  writeFileSync(targetZip, Buffer.concat([...chunks, centralBuf, eocd]))
}

// ─── Desktop 同步 ────────────────────────────────────────────

/**
 * 检测并同步 Desktop 安装包。
 * Windows: nsis(.exe) + msi(.msi)
 * Linux: deb(.deb) + appimage(.AppImage)
 * macOS: dmg(.dmg)
 *
 * @param {{ dryRun: boolean }} opts
 * @returns {Promise<{ version: string; assets: Array<{ href: string; sizeBytes: number; format: string; arch?: string }> }>}
 */
async function syncDesktop(opts) {
  const version = await readDesktopVersion()
  const targetDir = join(DOWNLOADS_DIR, 'desktop')
  /** @type {Array<{ href: string; sizeBytes: number; format: string; arch?: string }>} */
  const assets = []

  log('info', `Desktop 同步 → 版本: ${C.bold}${version}${C.reset}`)

  // Windows NSIS .exe
  const nsisDir = join(DESKTOP_BUNDLE_DIR, 'nsis')
  const exeFiles = filterByVersion(await listFilesByExt(nsisDir, 'exe'), version)
  if (exeFiles.length > 0) {
    const source = exeFiles[0]
    const targetName = `IHUI-AI-Setup-${version}-x64.exe`
    const targetPath = join(targetDir, targetName)
    const href = `/downloads/desktop/${targetName}`
    const status = opts.dryRun ? 'dry-run' : await checkCopyNeeded(source.path, targetPath)

    if (opts.dryRun) {
      log('info', `  [dry-run] 将复制 ${source.name} → ${targetName} (${formatBytes(source.size)})`)
    } else if (status === 'skip') {
      log('info', `  ${C.dim}skip (up to date)${C.reset} ${targetName}`)
    } else {
      await mkdir(targetDir, { recursive: true })
      await copyFile(source.path, targetPath)
      log('ok', `  copy (newer) ${targetName} (${formatBytes(source.size)})`)
    }
    assets.push({ href, sizeBytes: source.size, format: 'Windows NSIS exe', arch: 'x64' })
  } else {
    log('warn', `  Desktop NSIS .exe 未找到(版本 ${version})— 需在 Windows 运行 \`pnpm --filter @ihui/desktop build\``)
  }

  // Windows MSI .msi
  const msiDir = join(DESKTOP_BUNDLE_DIR, 'msi')
  const msiFiles = filterByVersion(await listFilesByExt(msiDir, 'msi'), version)
  if (msiFiles.length > 0) {
    const source = msiFiles[0]
    const targetName = `IHUI-AI-Setup-${version}-x64.msi`
    const targetPath = join(targetDir, targetName)
    const href = `/downloads/desktop/${targetName}`
    const status = opts.dryRun ? 'dry-run' : await checkCopyNeeded(source.path, targetPath)

    if (opts.dryRun) {
      log('info', `  [dry-run] 将复制 ${source.name} → ${targetName} (${formatBytes(source.size)})`)
    } else if (status === 'skip') {
      log('info', `  ${C.dim}skip (up to date)${C.reset} ${targetName}`)
    } else {
      await mkdir(targetDir, { recursive: true })
      await copyFile(source.path, targetPath)
      log('ok', `  copy (newer) ${targetName} (${formatBytes(source.size)})`)
    }
    assets.push({ href, sizeBytes: source.size, format: 'Windows MSI', arch: 'x64' })
  } else {
    log('warn', `  Desktop MSI .msi 未找到(版本 ${version})— 需在 Windows 运行 \`pnpm --filter @ihui/desktop build\``)
  }

  // Linux .deb
  const debDir = join(DESKTOP_BUNDLE_DIR, 'deb')
  const debFiles = filterByVersion(await listFilesByExt(debDir, 'deb'), version)
  if (debFiles.length > 0) {
    const source = debFiles[0]
    const targetName = `IHUI-AI-${version}-amd64.deb`
    const targetPath = join(targetDir, targetName)
    const href = `/downloads/desktop/${targetName}`
    const status = opts.dryRun ? 'dry-run' : await checkCopyNeeded(source.path, targetPath)

    if (opts.dryRun) {
      log('info', `  [dry-run] 将复制 ${source.name} → ${targetName} (${formatBytes(source.size)})`)
    } else if (status === 'skip') {
      log('info', `  ${C.dim}skip (up to date)${C.reset} ${targetName}`)
    } else {
      await mkdir(targetDir, { recursive: true })
      await copyFile(source.path, targetPath)
      log('ok', `  copy (newer) ${targetName} (${formatBytes(source.size)})`)
    }
    assets.push({ href, sizeBytes: source.size, format: 'Linux DEB', arch: 'amd64' })
  } else {
    if (existsSync(DESKTOP_BUNDLE_DIR)) {
      log('warn', `  Desktop .deb 未找到 — 需在 Linux 运行 \`pnpm --filter @ihui/desktop build\``)
    }
  }

  // Linux .AppImage
  const appimageDir = join(DESKTOP_BUNDLE_DIR, 'appimage')
  const appimageFiles = filterByVersion(await listFilesByExt(appimageDir, 'appimage'), version)
  if (appimageFiles.length > 0) {
    const source = appimageFiles[0]
    const targetName = `IHUI-AI-${version}.AppImage`
    const targetPath = join(targetDir, targetName)
    const href = `/downloads/desktop/${targetName}`
    const status = opts.dryRun ? 'dry-run' : await checkCopyNeeded(source.path, targetPath)

    if (opts.dryRun) {
      log('info', `  [dry-run] 将复制 ${source.name} → ${targetName} (${formatBytes(source.size)})`)
    } else if (status === 'skip') {
      log('info', `  ${C.dim}skip (up to date)${C.reset} ${targetName}`)
    } else {
      await mkdir(targetDir, { recursive: true })
      await copyFile(source.path, targetPath)
      log('ok', `  copy (newer) ${targetName} (${formatBytes(source.size)})`)
    }
    assets.push({ href, sizeBytes: source.size, format: 'Linux AppImage' })
  } else {
    if (existsSync(DESKTOP_BUNDLE_DIR)) {
      log('warn', `  Desktop .AppImage 未找到 — 需在 Linux 运行 \`pnpm --filter @ihui/desktop build\``)
    }
  }

  // macOS .dmg
  const dmgDir = join(DESKTOP_BUNDLE_DIR, 'dmg')
  const dmgFiles = filterByVersion(await listFilesByExt(dmgDir, 'dmg'), version)
  if (dmgFiles.length > 0) {
    const source = dmgFiles[0]
    const targetName = `IHUI-AI-${version}.dmg`
    const targetPath = join(targetDir, targetName)
    const href = `/downloads/desktop/${targetName}`
    const status = opts.dryRun ? 'dry-run' : await checkCopyNeeded(source.path, targetPath)

    if (opts.dryRun) {
      log('info', `  [dry-run] 将复制 ${source.name} → ${targetName} (${formatBytes(source.size)})`)
    } else if (status === 'skip') {
      log('info', `  ${C.dim}skip (up to date)${C.reset} ${targetName}`)
    } else {
      await mkdir(targetDir, { recursive: true })
      await copyFile(source.path, targetPath)
      log('ok', `  copy (newer) ${targetName} (${formatBytes(source.size)})`)
    }
    assets.push({ href, sizeBytes: source.size, format: 'macOS DMG' })
  } else {
    if (existsSync(DESKTOP_BUNDLE_DIR)) {
      log('warn', `  Desktop .dmg 未找到 — 需在 macOS 运行 \`pnpm --filter @ihui/desktop build\``)
    }
  }

  return { version, assets }
}

// ─── Extension 同步 ──────────────────────────────────────────

/**
 * 检测并同步 Extension Chrome MV3 ZIP 包。
 * @param {{ dryRun: boolean }} opts
 * @returns {Promise<{ version: string; assets: Array<{ href: string; sizeBytes: number; format: string }> }>}
 */
async function syncExtension(opts) {
  const version = await readExtensionVersion()
  const targetDir = join(DOWNLOADS_DIR, 'extension')
  const targetName = `IHUI-AI-Extension-chrome-v${version}.zip`
  const targetPath = join(targetDir, targetName)
  const href = `/downloads/extension/${targetName}`
  /** @type {Array<{ href: string; sizeBytes: number; format: string }>} */
  const assets = []

  log('info', `Extension 同步 → 版本: ${C.bold}${version}${C.reset}`)

  if (!existsSync(EXTENSION_OUTPUT_DIR)) {
    log('warn', `  Extension 源目录不存在: ${EXTENSION_OUTPUT_DIR} — 需运行 \`pnpm --filter @ihui/extension build\``)
    return { version, assets }
  }

  // 检查源目录是否非空
  const entries = await readdir(EXTENSION_OUTPUT_DIR, { withFileTypes: true })
  if (entries.length === 0) {
    log('warn', `  Extension 源目录为空: ${EXTENSION_OUTPUT_DIR} — 构建产物缺失`)
    return { version, assets }
  }

  if (opts.dryRun) {
    log('info', `  [dry-run] 将打包 ${EXTENSION_OUTPUT_DIR} → ${targetName}`)
    // dry-run 时用目录大小估算(递归求和)
    const totalSize = await calcDirSize(EXTENSION_OUTPUT_DIR)
    log('info', `  [dry-run] 源目录大小: ${formatBytes(totalSize)} (${entries.length} 个顶层条目)`)
    assets.push({ href, sizeBytes: 0, format: 'Chrome MV3 ZIP' })
    return { version, assets }
  }

  // 幂等性检查:如果目标 zip 存在,且源目录内最新文件 mtime <= 目标 mtime,则跳过
  const needRepack = await checkZipRefreshNeeded(EXTENSION_OUTPUT_DIR, targetPath)
  if (!needRepack) {
    const targetStats = await stat(targetPath)
    log('info', `  ${C.dim}skip (up to date)${C.reset} ${targetName} (${formatBytes(targetStats.size)})`)
    assets.push({ href, sizeBytes: targetStats.size, format: 'Chrome MV3 ZIP' })
    return { version, assets }
  }

  // 打包
  await mkdir(targetDir, { recursive: true })
  try {
    zipDirectoryContents(EXTENSION_OUTPUT_DIR, targetPath)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Extension ZIP 打包失败: ${msg}`)
  }
  const targetStats = await stat(targetPath)
  log('ok', `  zip (newer) ${targetName} (${formatBytes(targetStats.size)})`)
  assets.push({ href, sizeBytes: targetStats.size, format: 'Chrome MV3 ZIP' })
  return { version, assets }
}

/**
 * 递归计算目录总大小(bytes)。
 * @param {string} dir
 * @returns {Promise<number>}
 */
async function calcDirSize(dir) {
  let total = 0
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      total += await calcDirSize(fullPath)
    } else if (entry.isFile()) {
      const stats = await stat(fullPath)
      total += stats.size
    }
  }
  return total
}

/**
 * 检查 ZIP 是否需要重新打包:目标不存在或源目录最新 mtime > 目标 mtime。
 * @param {string} srcDir
 * @param {string} targetZip
 * @returns {Promise<boolean>}
 */
async function checkZipRefreshNeeded(srcDir, targetZip) {
  if (!existsSync(targetZip)) return true
  const targetStats = await stat(targetZip)
  // 找源目录最新文件 mtime(递归)
  const latestSourceMtime = await getLatestMtime(srcDir)
  return latestSourceMtime > targetStats.mtimeMs
}

/**
 * 递归获取目录下最新文件的 mtime(ms)。
 * @param {string} dir
 * @returns {Promise<number>}
 */
async function getLatestMtime(dir) {
  let latest = 0
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      latest = Math.max(latest, await getLatestMtime(fullPath))
    } else if (entry.isFile()) {
      const stats = await stat(fullPath)
      latest = Math.max(latest, stats.mtimeMs)
    }
  }
  return latest
}

// ─── Manifest 写入 ───────────────────────────────────────────

/**
 * 生成并写入 manifest.json 元数据快照。
 * @param {{ desktop?: { version: string; assets: Array<{ href: string; sizeBytes: number; format: string; arch?: string }> }; extension?: { version: string; assets: Array<{ href: string; sizeBytes: number; format: string }> } }} platforms
 * @param {boolean} dryRun
 */
async function writeManifest(platforms, dryRun) {
  const manifest = {
    syncedAt: new Date().toISOString(),
    platforms: {
      ...(platforms.desktop ? { desktop: platforms.desktop } : {}),
      ...(platforms.extension ? { extension: platforms.extension } : {}),
    },
  }

  const jsonStr = JSON.stringify(manifest, null, 2) + '\n'

  if (dryRun) {
    log('info', `  [dry-run] 将写入 manifest.json (${jsonStr.length} bytes)`)
    console.log(C.dim + jsonStr + C.reset)
    return
  }

  await mkdir(DOWNLOADS_DIR, { recursive: true })
  await writeFile(MANIFEST_PATH, jsonStr, 'utf-8')
  log('ok', `  manifest.json 已写入 (${jsonStr.length} bytes)`)
}

// ─── Check 模式 ──────────────────────────────────────────────

/**
 * 检查模式:对比源文件和目标文件的 mtime/size,输出差异表。
 * @returns {Promise<void>}
 */
async function runCheck() {
  const desktopVersion = await readDesktopVersion()
  const extensionVersion = await readExtensionVersion()

  console.log()
  console.log(C.bold + '  平台       | 源文件                                    | 目标文件                                  | 状态' + C.reset)
  console.log('  ' + '-'.repeat(130))

  // Desktop NSIS exe
  await checkDesktopAsset('nsis', 'exe', desktopVersion, `IHUI-AI-Setup-${desktopVersion}-x64.exe`)
  // Desktop MSI
  await checkDesktopAsset('msi', 'msi', desktopVersion, `IHUI-AI-Setup-${desktopVersion}-x64.msi`)
  // Desktop deb
  await checkDesktopAsset('deb', 'deb', desktopVersion, `IHUI-AI-${desktopVersion}-amd64.deb`)
  // Desktop AppImage
  await checkDesktopAsset('appimage', 'appimage', desktopVersion, `IHUI-AI-${desktopVersion}.AppImage`)
  // Desktop dmg
  await checkDesktopAsset('dmg', 'dmg', desktopVersion, `IHUI-AI-${desktopVersion}.dmg`)

  // Extension
  const extTargetName = `IHUI-AI-Extension-chrome-v${extensionVersion}.zip`
  const extTargetPath = join(DOWNLOADS_DIR, 'extension', extTargetName)
  if (!existsSync(EXTENSION_OUTPUT_DIR)) {
    printCheckRow('extension', '(源目录缺失)', extTargetName, 'missing source')
  } else {
    const entries = await readdir(EXTENSION_OUTPUT_DIR, { withFileTypes: true })
    if (entries.length === 0) {
      printCheckRow('extension', '(空目录)', extTargetName, 'missing source')
    } else if (!existsSync(extTargetPath)) {
      printCheckRow('extension', '.output/chrome-mv3/', extTargetName, 'missing target')
    } else {
      const latestSrc = await getLatestMtime(EXTENSION_OUTPUT_DIR)
      const targetStats = await stat(extTargetPath)
      if (latestSrc > targetStats.mtimeMs) {
        printCheckRow('extension', '.output/chrome-mv3/', extTargetName, 'newer source')
      } else {
        printCheckRow('extension', '.output/chrome-mv3/', extTargetName, `${C.green}up to date${C.reset}`)
      }
    }
  }

  // Manifest 检查
  console.log('  ' + '-'.repeat(130))
  if (existsSync(MANIFEST_PATH)) {
    const manifestStats = await stat(MANIFEST_PATH)
    printCheckRow('manifest', '-', 'manifest.json', `${C.green}exists${C.reset} (${formatBytes(manifestStats.size)})`)
  } else {
    printCheckRow('manifest', '-', 'manifest.json', `${C.yellow}missing${C.reset}`)
  }
  console.log()
}

/**
 * @param {string} subDir - bundle 下的子目录名(nsis/msi/deb/appimage/dmg)
 * @param {string} ext - 文件扩展名
 * @param {string} version
 * @param {string} targetName
 */
async function checkDesktopAsset(subDir, ext, version, targetName) {
  const sourceDir = join(DESKTOP_BUNDLE_DIR, subDir)
  const targetPath = join(DOWNLOADS_DIR, 'desktop', targetName)
  const files = filterByVersion(await listFilesByExt(sourceDir, ext), version)

  if (files.length === 0) {
    if (existsSync(DESKTOP_BUNDLE_DIR)) {
      printCheckRow('desktop', `(无 ${ext})`, targetName, 'missing source')
    }
    return
  }

  const source = files[0]
  if (!existsSync(targetPath)) {
    printCheckRow('desktop', source.name, targetName, 'missing target')
    return
  }

  const targetStats = await stat(targetPath)
  if (source.size !== targetStats.size) {
    printCheckRow('desktop', source.name, targetName, `size diff (${formatBytes(source.size)} vs ${formatBytes(targetStats.size)})`)
  } else if (source.mtime > targetStats.mtimeMs) {
    printCheckRow('desktop', source.name, targetName, 'newer source')
  } else {
    printCheckRow('desktop', source.name, targetName, `${C.green}up to date${C.reset}`)
  }
}

/**
 * @param {string} platform
 * @param {string} source
 * @param {string} target
 * @param {string} status
 */
function printCheckRow(platform, source, target, status) {
  const pad = (s, len) => s.length > len ? s.slice(0, len - 1) + '…' : s.padEnd(len)
  console.log(`  ${pad(platform, 10)} | ${pad(source, 40)} | ${pad(target, 40)} | ${status}`)
}

// ─── 主流程 ──────────────────────────────────────────────────

async function main() {
  // AGENTS §22d 批次 G2:以下三档(--help 打印 + exit(0) / 无效 --platform 校验 + exit(2) / 启动日志)
  // 原在模块作用域,被 import 即打印并终止宿主进程 ⇒ 搬进 main 首条,顺序逐字不变,
  // 且仍先于任何 fs / 构建产物读取。
  if (helpFlag) {
    console.log(`
${C.bold}sync-downloads.mjs${C.reset} — 自动化构建同步:复制下载包 + 更新元数据

${C.bold}用法:${C.reset}
  node scripts/sync-downloads.mjs                    默认:同步所有端
  node scripts/sync-downloads.mjs --dry-run          预览模式:只输出将要执行的步骤
  node scripts/sync-downloads.mjs --check            检查模式:对比源/目标差异
  node scripts/sync-downloads.mjs --platform=desktop 只同步指定端(desktop/extension)
  node scripts/sync-downloads.mjs --skip-build       跳过构建(本脚本不触发构建,供流水线集成)
  node scripts/sync-downloads.mjs --help             显示帮助

${C.bold}路径映射:${C.reset}
  Desktop 源:  apps/desktop/src-tauri/target/release/bundle/{nsis,msi,deb,appimage,dmg}/
  Desktop 目标: apps/web/public/downloads/desktop/
  Extension 源: apps/extension/.output/chrome-mv3/
  Extension 目标: apps/web/public/downloads/extension/
  Manifest:    apps/web/public/downloads/manifest.json
`)
    process.exit(0)
  }

  if (platformFilter && !validPlatforms.includes(platformFilter)) {
    log('err', `无效的 --platform 值: ${platformFilter}(可选: ${validPlatforms.join(', ')})`)
    process.exit(2)
  }

  log('info', `sync-downloads 启动 → 模式: ${C.bold}${mode}${C.reset}${platformFilter ? ` | 端: ${C.bold}${platformFilter}${C.reset}` : ''}${skipBuild ? ' | skip-build' : ''}`)

  const shouldSyncDesktop = !platformFilter || platformFilter === 'desktop'
  const shouldSyncExtension = !platformFilter || platformFilter === 'extension'

  // ── Check 模式 ──
  if (checkMode) {
    await runCheck()
    return
  }

  // ── Dry-run / Sync 模式 ──
  /** @type {{ desktop?: { version: string; assets: Array<{ href: string; sizeBytes: number; format: string; arch?: string }> }; extension?: { version: string; assets: Array<{ href: string; sizeBytes: number; format: string }> } }} */
  const platforms = {}

  if (shouldSyncDesktop) {
    platforms.desktop = await syncDesktop({ dryRun })
  }

  if (shouldSyncExtension) {
    platforms.extension = await syncExtension({ dryRun })
  }

  // 写入 manifest(仅 sync 模式和 dry-run 模式)
  log('info', '写入 manifest.json...')
  await writeManifest(platforms, dryRun)

  // 逐文件 sha256 清单(2026-11-04):随发布产物一起落盘并**当场自校验**。
  // 任何文件 size/sha256 不符、包里多文件(清单缺项)、清单多路径(清单多项)都直接中止发布,
  // 不做"只在 debug 跑"也不做"失败只打日志继续"。
  if (!dryRun && existsSync(DOWNLOADS_DIR)) {
    const manifestPath = join(DOWNLOADS_DIR, UPDATE_MANIFEST_FILENAME)
    const fileManifest = await writeUpdateFileManifest(DOWNLOADS_DIR, manifestPath)
    const verdict = await verifyDirectory(DOWNLOADS_DIR, fileManifest)
    console.log(renderVerifyReport(verdict, DOWNLOADS_DIR))
    if (!verdict.ok) {
      throw new Error(`更新包逐文件自校验失败:${verdict.issues.length} 项不符,已中止发布`)
    }
    log('ok', `逐文件 sha256 清单已发布: ${join('apps/web/public/downloads', UPDATE_MANIFEST_FILENAME)}(${fileManifest.files.length} 个文件)`)
  }

  // 汇总
  console.log()
  const deskAssetCount = platforms.desktop?.assets.length ?? 0
  const extAssetCount = platforms.extension?.assets.length ?? 0
  if (dryRun) {
    log('info', `${C.bold}[dry-run]${C.reset} 预览完成:desktop ${deskAssetCount} 个资源 / extension ${extAssetCount} 个资源`)
  } else {
    log('ok', `同步完成:desktop ${deskAssetCount} 个资源 / extension ${extAssetCount} 个资源`)
  }
}

import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    log('err', `致命错误: ${msg}`)
    if (err instanceof Error && err.stack) {
      console.error(C.dim + err.stack + C.reset)
    }
    process.exit(1)
  })
}

export const __test__ = {
  formatBytes,
  filterByVersion,
  checkCopyNeeded,
  checkZipRefreshNeeded,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
