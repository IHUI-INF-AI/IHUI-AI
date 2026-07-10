#!/usr/bin/env node
/**
 * 前端编译包自动归档脚本 (2026-07-07 立)
 *
 * 目的: 解决 "npm run build 覆盖 dist 后旧版本找不回来" 问题.
 *       dist 目录默认被 .gitignore, 不会进 git 历史.
 *       本脚本在 build 前自动把旧 dist 打包成 archives/frontend-{platform}-{timestamp}.zip,
 *       保留最近 N 份 (默认 10), 超出自动删除最旧.
 *
 * 触发方式 (npm prebuild 钩子):
 *   - npm run build:web          → prebuild:web          → 归档 dist/web
 *   - npm run build:h5           → prebuild:h5           → 归档 dist/h5
 *   - npm run build:alipay       → prebuild:alipay       → 归档 dist/alipay
 *   - npm run build:electron     → prebuild:electron     → 归档 dist/electron
 *   - npm run build:mp-weixin    → prebuild:mp-weixin    → 归档 miniapp/dist/build/mp-weixin
 *
 * 用法:
 *   node scripts/keep-build-archive.mjs --platform web
 *   node scripts/keep-build-archive.mjs --platform mp-weixin --keep 5
 *   node scripts/keep-build-archive.mjs --platform web --dry-run
 *
 * 环境变量覆盖:
 *   ARCHIVES_KEEP=15           覆盖保留份数
 *   ARCHIVES_DIR=../archives   覆盖归档目录
 *   BUILD_PLATFORM=web         自动读取 (prebuild 钩子注入)
 *
 * 退出码:
 *   0 - 成功 / 跳过 (无 dist / dry-run)
 *   1 - 错误 (压缩失败 / 路径不存在)
 */

import { execSync, spawnSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CLIENT_ROOT = path.resolve(__dirname, '..')
const PROJECT_ROOT = path.resolve(CLIENT_ROOT, '..')

// ── 参数解析 ──────────────────────────────────────────────
const args = process.argv.slice(2)
const parsed = {}
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  if (a.startsWith('--')) {
    const key = a.slice(2)
    const next = args[i + 1]
    if (next && !next.startsWith('--')) {
      parsed[key] = next
      i++
    } else {
      parsed[key] = true
    }
  }
}

// --platform 优先, 否则用 env.BUILD_PLATFORM
const platform = parsed.platform || process.env.BUILD_PLATFORM || 'web'
const keep = parseInt(parsed.keep || process.env.ARCHIVES_KEEP || '10', 10)
const dryRun = parsed['dry-run'] === true || parsed.dryRun === true
const archivesDirRaw = parsed['archives-dir'] || process.env.ARCHIVES_DIR || path.join(PROJECT_ROOT, 'archives')
const archivesDir = path.resolve(archivesDirRaw)

// ── 平台 → dist 路径映射 ──────────────────────────────────
const PLATFORM_DIST_MAP = {
  web: path.join(CLIENT_ROOT, 'dist', 'web'),
  h5: path.join(CLIENT_ROOT, 'dist', 'h5'),
  alipay: path.join(CLIENT_ROOT, 'dist', 'alipay'),
  electron: path.join(CLIENT_ROOT, 'dist', 'electron'),
  'mp-weixin': path.join(CLIENT_ROOT, 'miniapp', 'dist', 'build', 'mp-weixin'),
  mp_weixin: path.join(CLIENT_ROOT, 'miniapp', 'dist', 'build', 'mp-weixin'),
}

const distPath = PLATFORM_DIST_MAP[platform]
if (!distPath) {
  console.error(`❌ 未知平台: ${platform}`)
  console.error(`   支持: ${Object.keys(PLATFORM_DIST_MAP).join(', ')}`)
  process.exit(1)
}

// ── 工具函数 ──────────────────────────────────────────────
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

const getDirSize = (dir) => {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-ChildItem -Path '${dir}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum | Select-Object -ExpandProperty Sum"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    )
    return parseInt(out.trim(), 10) || 0
  } catch {
    return 0
  }
}

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const getTimestamp = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

const listArchives = (dir, prefix) => {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.zip'))
    .map((f) => {
      const full = path.join(dir, f)
      const stat = fs.statSync(full)
      return { name: f, path: full, mtime: stat.mtimeMs, size: stat.size }
    })
    .sort((a, b) => b.mtime - a.mtime)
}

const applyRetention = (archives, keep) => {
  if (archives.length <= keep) return []
  const toDelete = archives.slice(keep)
  for (const a of toDelete) {
    try {
      if (!dryRun) {
        fs.unlinkSync(a.path)
      }
    } catch (e) {
      console.error(`  ⚠️  删除失败: ${a.name} (${e.message})`)
    }
  }
  return toDelete
}

// ── 压缩函数 (Windows 优先 PowerShell + .NET ZipFile, 跨平台 fallback 7zip/zip) ──
const compressDir = async (srcDir, destZip) => {
  const platform_ = process.platform

  if (platform_ === 'win32') {
    // Windows: 用 PowerShell + System.IO.Compression.FileSystem (无需外部依赖)
    const psScript = `
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory(
  '${srcDir.replace(/'/g, "''")}',
  '${destZip.replace(/'/g, "''")}',
  [System.IO.Compression.CompressionLevel]::Optimal,
  $false
)
`
    const r = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (r.status !== 0) {
      throw new Error(`PowerShell 压缩失败: ${r.stderr || r.stdout}`)
    }
  } else {
    // Unix: 用 zip 命令
    const r = spawnSync('zip', ['-r', '-q', '-9', destZip, '.'], {
      cwd: srcDir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (r.status !== 0) {
      throw new Error(`zip 压缩失败: ${r.stderr || r.stdout}`)
    }
  }
}

// ── 主流程 ──────────────────────────────────────────────
const main = async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📦 前端编译包归档 (平台: ${platform})`)
  console.log(`   dist:    ${distPath}`)
  console.log(`   archives: ${archivesDir}`)
  console.log(`   keep:    ${keep}${dryRun ? '  (DRY-RUN)' : ''}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // 1. 检查 dist 是否存在
  if (!fs.existsSync(distPath)) {
    console.log(`⏭️  跳过: dist 不存在 (${distPath})`)
    console.log(`   这是首次构建或该平台未编译过, 无旧版本需要归档.`)
    process.exit(0)
  }

  const stat = fs.statSync(distPath)
  if (!stat.isDirectory()) {
    console.log(`⏭️  跳过: dist 路径不是目录 (${distPath})`)
    process.exit(0)
  }

  // 2. 计算 dist 大小
  const distSize = getDirSize(distPath)
  const fileCount = (() => {
    try {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-ChildItem -Path '${distPath}' -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      )
      return parseInt(out.trim(), 10) || 0
    } catch {
      return 0
    }
  })()
  console.log(`📊 当前 dist: ${fileCount} 文件, ${formatBytes(distSize)}`)

  // 3. 创建 archives 目录
  if (!dryRun) {
    ensureDir(archivesDir)
  }

  // 4. 压缩
  const timestamp = getTimestamp()
  const archiveName = `frontend-${platform}-${timestamp}.zip`
  const archivePath = path.join(archivesDir, archiveName)

  if (dryRun) {
    console.log(`🔍 [DRY-RUN] 将创建: ${archivePath}`)
  } else {
    const startTime = Date.now()
    try {
      await compressDir(distPath, archivePath)
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      const archiveSize = fs.statSync(archivePath).size
      const ratio = distSize > 0 ? ((1 - archiveSize / distSize) * 100).toFixed(1) : 0
      console.log(`✅ 归档完成: ${archiveName}`)
      console.log(`   大小: ${formatBytes(archiveSize)} (压缩率 ${ratio}%, 耗时 ${elapsed}s)`)
    } catch (e) {
      console.error(`❌ 归档失败: ${e.message}`)
      process.exit(1)
    }
  }

  // 5. 应用保留策略
  const prefix = `frontend-${platform}-`
  const existing = listArchives(archivesDir, prefix)
  if (existing.length > keep) {
    const toDelete = existing.slice(keep)
    console.log(`🧹 保留策略: 当前 ${existing.length} 份, 保留最新 ${keep} 份, 删除 ${toDelete.length} 份`)
    for (const a of toDelete) {
      console.log(`   🗑️  ${a.name} (${formatBytes(a.size)})${dryRun ? '  [DRY-RUN]' : ''}`)
    }
    if (!dryRun) {
      const deleted = applyRetention(existing, keep)
      if (deleted.length !== toDelete.length) {
        console.error(`⚠️  删除数量不匹配: 预期 ${toDelete.length}, 实际 ${deleted.length}`)
      }
    }
  } else {
    console.log(`🧹 保留策略: 当前 ${existing.length} 份, 保留 ${keep} 份, 无需删除`)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📂 当前 ${platform} 归档列表 (按时间倒序):`)
  const final = listArchives(archivesDir, prefix)
  for (const a of final.slice(0, Math.min(5, final.length))) {
    const t = new Date(a.mtime).toLocaleString('zh-CN', { hour12: false })
    console.log(`   ${t}  ${formatBytes(a.size).padStart(10)}  ${a.name}`)
  }
  if (final.length > 5) {
    console.log(`   ... 共 ${final.length} 份, 只显示最新 5 份`)
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch((e) => {
  console.error(`❌ 未捕获异常: ${e.message}`)
  console.error(e.stack)
  process.exit(1)
})
