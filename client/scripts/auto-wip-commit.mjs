#!/usr/bin/env node
/**
 * 自动 WIP 备份守护 (2026-07-04 立)
 *
 * 目的: 第三层兜底, 即使 lint-staged --no-stash 失效 + orphan stash 守护脚本漏检,
 *       也能从 patch 备份恢复未提交的样式修改.
 *
 * 机制: 检测工作区未提交修改 → 生成 git diff patch 文件 → 保存到 .auto-wip/ 目录
 *       (不污染 git history, 不影响工作区, 不用 stash 避免陷阱)
 *       保留最近 20 个 patch, 旧的自动清理.
 *
 * 用法:
 *   node scripts/auto-wip-commit.mjs              # 单次检查 + 备份
 *   node scripts/auto-wip-commit.mjs --watch      # 长期守护, 每 30 分钟备份一次
 *   node scripts/auto-wip-commit.mjs --interval 10  # 自定义间隔 (分钟)
 *   node scripts/auto-wip-commit.mjs --list       # 列出所有备份
 *   node scripts/auto-wip-commit.mjs --restore <name>  # 从备份恢复
 *
 * 恢复:
 *   git apply .auto-wip/<name>.patch
 *   或: node scripts/auto-wip-commit.mjs --restore <name>
 *
 * 注意: patch 文件不含 binary 文件内容 (git diff --binary 例外), 如有图片等
 *       binary 修改, 需手动备份. 本脚本主要保护文本类样式/代码修改.
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')
const backupDir = path.join(clientRoot, '.auto-wip')

const args = process.argv.slice(2)
const watch = args.includes('--watch')
const list = args.includes('--list')
const intervalIdx = args.indexOf('--interval')
const intervalMin = intervalIdx >= 0 ? parseInt(args[intervalIdx + 1], 10) : 30
const restoreIdx = args.indexOf('--restore')
const restoreName = restoreIdx >= 0 ? args[restoreIdx + 1] : null

function runGit(args) {
  try {
    return execSync(`git ${args}`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    return ''
  }
}

function ensureBackupDir() {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
}

function getTimestamp() {
  const d = new Date()
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function hasUncommittedChanges() {
  const status = runGit('status --porcelain')
  return status.trim().length > 0
}

function generateBackup() {
  if (!hasUncommittedChanges()) {
    return null
  }
  ensureBackupDir()
  const ts = getTimestamp()
  const branch = runGit('rev-parse --abbrev-ref HEAD').trim() || 'unknown'
  const patchFile = path.join(backupDir, `wip-${ts}-${branch}.patch`)
  // 生成含 binary 的 patch (tracked 文件的 staged + unstaged 修改)
  const patch = runGit('diff HEAD --binary')
  if (!patch.trim()) {
    return null
  }
  fs.writeFileSync(patchFile, patch, 'utf-8')
  // 同时写一个元数据 json
  const metaFile = patchFile.replace(/\.patch$/, '.meta.json')
  const meta = {
    timestamp: ts,
    branch,
    createdAt: new Date().toISOString(),
    fileCount: (patch.match(/^diff --git/gm) || []).length,
  }
  fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2), 'utf-8')
  return { patchFile, meta }
}

function cleanupOldBackups(keep = 20) {
  if (!fs.existsSync(backupDir)) return
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.patch'))
    .map(f => ({
      name: f,
      full: path.join(backupDir, f),
      mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
  // 删除超出 keep 数量的旧备份
  for (let i = keep; i < files.length; i++) {
    const f = files[i]
    fs.unlinkSync(f.full)
    const metaFile = f.full.replace(/\.patch$/, '.meta.json')
    if (fs.existsSync(metaFile)) fs.unlinkSync(metaFile)
  }
}

function listBackups() {
  if (!fs.existsSync(backupDir)) {
    console.log('无备份')
    return
  }
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.patch'))
    .map(f => {
      const full = path.join(backupDir, f)
      const metaFile = full.replace(/\.patch$/, '.meta.json')
      let meta = {}
      try { meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8')) } catch (_) {}
      return {
        name: f,
        size: fs.statSync(full).size,
        mtime: fs.statSync(full).mtime,
        ...meta,
      }
    })
    .sort((a, b) => b.mtime - a.mtime)
  if (files.length === 0) {
    console.log('无备份')
    return
  }
  console.log(`共 ${files.length} 个备份 (位于 ${backupDir}):`)
  for (const f of files) {
    const size = f.size > 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${f.size}B`
    const fc = f.fileCount ? `${f.fileCount} 文件` : '?'
    console.log(`  ${f.name}  ${size}  ${fc}  ${f.branch || ''}`)
  }
}

function restoreBackup(name) {
  if (!name) {
    console.error('用法: node scripts/auto-wip-commit.mjs --restore <name>')
    process.exit(1)
  }
  // 允许不带 .patch 后缀
  const fullName = name.endsWith('.patch') ? name : `${name}.patch`
  const patchFile = path.join(backupDir, fullName)
  if (!fs.existsSync(patchFile)) {
    console.error(`[FAIL] 备份不存在: ${patchFile}`)
    console.error('可用备份:')
    listBackups()
    process.exit(1)
  }
  console.log(`[INFO] 从 ${fullName} 恢复...`)
  // 用 git apply 恢复 (不 commit, 让用户检查后手动 commit)
  const patch = fs.readFileSync(patchFile, 'utf-8')
  // 写到临时文件让 git apply 读取
  const tmpFile = path.join(backupDir, '.restore-tmp.patch')
  fs.writeFileSync(tmpFile, patch, 'utf-8')
  try {
    execSync(`git apply --whitespace=nowarn "${tmpFile}"`, {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    console.log('[OK] 恢复成功, 修改已应用到工作区. 请检查后手动 commit.')
  } catch (e) {
    console.error('[FAIL] 恢复失败, 可能有冲突. 尝试 --3way 模式:')
    try {
      execSync(`git apply --3way "${tmpFile}"`, {
        cwd: projectRoot,
        stdio: 'inherit',
      })
      console.log('[OK] --3way 恢复成功')
    } catch (e2) {
      console.error('[FAIL] --3way 也失败. patch 文件保留在:', tmpFile)
      console.error('手动尝试: git apply --3way "' + tmpFile + '"')
      process.exit(1)
    }
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
  }
}

function doOnce() {
  const result = generateBackup()
  if (result) {
    const size = fs.statSync(result.patchFile).size
    const sizeStr = size > 1024 ? `${(size / 1024).toFixed(1)}KB` : `${size}B`
    console.log(`[WIP] ${new Date().toISOString()} 备份已保存: ${path.basename(result.patchFile)} (${sizeStr}, ${result.meta.fileCount} 文件)`)
    cleanupOldBackups()
  }
  // 静默模式 (watch 时不打印无修改)
}

// 处理特殊命令
if (list) {
  listBackups()
  process.exit(0)
}

if (restoreName) {
  restoreBackup(restoreName)
  process.exit(0)
}

// 单次或 watch 模式
if (watch) {
  console.log(`[WIP] 自动 WIP 备份守护启动, 每 ${intervalMin} 分钟检查一次`)
  console.log(`[WIP] 备份目录: ${backupDir}`)
  console.log(`[WIP] Ctrl+C 停止`)
  doOnce()
  setInterval(doOnce, intervalMin * 60 * 1000)
  // 保持进程存活
  process.stdin.resume()
} else {
  doOnce()
  process.exit(0)
}
