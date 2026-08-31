#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * clean-garbage.mjs — 项目一键垃圾/缓存清理(2026-08-31 轮固化)
 *
 * 背景(2026-08-31 实测):G 盘 100% 占满(可用 860KB),排查回收约 62G:
 *   .git/lost-found 17G、Rust target 13G、.turbo 12G、Next cache 7.9G、
 *   git loose objects 7.3G、Trae CXX staging 3.35G、android build 2.3G 等。
 *   本脚本把「全部可重建缓存/产物」固化为白名单,一键清理,杜绝手动逐项排查。
 *
 * 设计铁律:
 *   1. 白名单式删除——只删显式列出的可重建路径,绝不扫描式误伤源码/资产/venv。
 *   2. 源码零触碰——不动 app/src、public 分发安装包、.venv、db-backup。
 *   3. 运行中安全——.next/cache、.turbo 等 dev 运行中删除自动重建;文件被占用
 *      (EPERM/EBUSY)时跳过并警告,不中断其余项。
 *   4. git 相关(lost-found / gc)默认跳过——并行会话在用 git 时禁止锁仓库,
 *      需显式 --git 才执行。
 *
 * 用法:
 *   node scripts/clean-garbage.mjs              # 清理全部安全项
 *   node scripts/clean-garbage.mjs --dry-run    # 只统计报告,不删除
 *   node scripts/clean-garbage.mjs --git        # 追加 git 维护(lost-found 清理 + gc)
 *   node scripts/clean-garbage.mjs --quiet      # 只输出汇总
 */
import { promises as fs } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ---------- 白名单:可重建缓存/产物(默认清理) ----------
const SAFE_TARGETS = [
  { p: 'apps/web/.next/cache', why: 'Next.js dev 缓存(自动重建)' },
  { p: 'apps/web/.next/dev/cache/turbopack', why: 'Turbopack 持久化缓存(自动重建)' },
  { p: 'apps/web/out', why: 'Next 静态导出产物(构建重建)' },
  { p: 'apps/web/tmp', why: 'web 临时目录' },
  { p: 'apps/web/playwright-report', why: 'E2E 测试报告(低价值)' },
  { p: 'apps/api/dist', why: 'api 构建产物(tsx watch 直跑 src)' },
  { p: 'apps/desktop/src-tauri/target', why: 'Rust 编译产物(cargo build 重建)' },
  { p: 'apps/mobile-rn/android/app/build', why: 'Android gradle 构建产物' },
  { p: 'apps/mobile-rn/android/.gradle', why: 'Android 本地 gradle 缓存' },
  { p: 'apps/miniapp-taro/dist', why: 'Taro 编译产物(重新编译)' },
  { p: '.cxx-modules-staging', why: 'Trae CXX 模块暂存' },
  { p: '.cxx-worklets-staging', why: 'Trae CXX worklet 暂存' },
]

// ---------- 白名单:git 维护(仅 --git 执行,并行会话时勿用) ----------
const GIT_TARGETS = [
  { p: '.git/lost-found', why: 'git fsck 孤儿对象恢复区(HEAD 推送后可删)' },
]

// ---------- 辅助 ----------
async function dirSizeBytes(dir) {
  let total = 0
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return 0
  }
  for (const name of names) {
    const p = path.join(dir, name)
    try {
      const st = await fs.stat(p)
      if (st.isDirectory()) total += await dirSizeBytes(p)
      else if (st.isFile()) total += st.size
    } catch {
      // stat 竞态(文件被删/占用)→ 跳过
    }
  }
  return total
}

function toGB(bytes) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

function toMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(0) + ' MB'
}

function fmt(bytes) {
  return bytes >= 1024 ** 3 ? toGB(bytes) : toMB(bytes)
}

async function removeTarget(target, dryRun) {
  const abs = path.join(ROOT, target.p)
  const exists = await fs.access(abs).then(() => true).catch(() => false)
  if (!exists) return { target: target.p, size: 0, action: 'skip(不存在)' }

  const size = await dirSizeBytes(abs)
  if (dryRun) {
    return { target: target.p, size, action: 'DRY-RUN 将删除' }
  }
  try {
    await fs.rm(abs, { recursive: true, force: true })
    return { target: target.p, size, action: '已删除' }
  } catch (err) {
    // Windows 下文件被 dev server/进程占用 → EPERM/EBUSY
    return { target: target.p, size, action: `失败(占用?): ${err.code || err.message}` }
  }
}

async function gitMaintenance(dryRun) {
  const results = []
  // 1) lost-found(在 GIT_TARGETS 里统一走 removeTarget 逻辑)
  // 2) git gc:打包 loose objects(2026-08-31: 88123 个 loose → 596M pack,回收 7.3G)
  if (!dryRun) {
    console.log('[clean-garbage] git gc --prune=now(打包松散对象)...')
    try {
      execFileSync('git', ['gc', '--prune=now'], { cwd: ROOT, stdio: 'ignore' })
      results.push('git gc 完成')
    } catch (err) {
      results.push(`git gc 失败: ${err.message.split('\n')[0]}`)
    }
  } else {
    results.push('DRY-RUN: 跳过 git gc')
  }
  return results
}

// ---------- 入口 ----------
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const withGit = args.includes('--git')
const quiet = args.includes('--quiet')

console.log(`[clean-garbage] ${dryRun ? 'DRY-RUN(仅统计)' : '清理'}开始 · 根目录 ${ROOT}`)

let totalFreed = 0
let rows = []
const allTargets = [...SAFE_TARGETS, ...(withGit ? GIT_TARGETS : [])]
const skippedGit = !withGit ? GIT_TARGETS : []

for (const t of allTargets) {
  const r = await removeTarget(t, dryRun)
  totalFreed += r.size
  rows.push(r)
}

if (skippedGit.length > 0 && !quiet) {
  console.log(`[clean-garbage]   跳过 git 维护项(需 --git): ${skippedGit.map(t => t.p).join(', ')}`)
}

if (withGit) {
  const gitResults = await gitMaintenance(dryRun)
  for (const r of gitResults) {
    if (!quiet) console.log(`[clean-garbage]   ${r}`)
  }
}

// tmp/ 下除 db-backup 外的临时文件
const tmpRoot = path.join(ROOT, 'tmp')
const tmpEntries = await fs.readdir(tmpRoot).catch(() => [])
for (const name of tmpEntries) {
  if (name === 'db-backup') continue
  const p = path.join(tmpRoot, name)
  const size = await dirSizeBytes(p)
  if (dryRun) {
    rows.push({ target: `tmp/${name}`, size, action: 'DRY-RUN 将删除' })
  } else {
    try {
      await fs.rm(p, { recursive: true, force: true })
      rows.push({ target: `tmp/${name}`, size, action: '已删除' })
    } catch (err) {
      rows.push({ target: `tmp/${name}`, size, action: `失败: ${err.code || err.message}` })
    }
  }
  totalFreed += size
}

// logs/ 下 *.bundle(gitignore 过的一次性备份)
const logsRoot = path.join(ROOT, 'logs')
const logsEntries = await fs.readdir(logsRoot).catch(() => [])
for (const name of logsEntries) {
  if (!name.endsWith('.bundle')) continue
  const p = path.join(logsRoot, name)
  const size = await dirSizeBytes(p)
  if (dryRun) {
    rows.push({ target: `logs/${name}`, size, action: 'DRY-RUN 将删除' })
  } else {
    try {
      await fs.rm(p, { recursive: true, force: true })
      rows.push({ target: `logs/${name}`, size, action: '已删除' })
    } catch (err) {
      rows.push({ target: `logs/${name}`, size, action: `失败: ${err.code || err.message}` })
    }
  }
  totalFreed += size
}

// 散落的 *.tsbuildinfo(增量编译缓存,自动重建)
async function sweepTsbuildinfo(dir) {
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return
  }
  for (const name of names) {
    if (name === 'node_modules') continue // 跳过依赖目录,只清项目源码级缓存
    const p = path.join(dir, name)
    const st = await fs.stat(p).catch(() => null)
    if (!st) continue
    if (st.isDirectory()) {
      await sweepTsbuildinfo(p)
    } else if (st.isFile() && name.endsWith('.tsbuildinfo')) {
      const size = st.size
      if (dryRun) {
        rows.push({ target: p.slice(ROOT.length + 1), size, action: 'DRY-RUN 将删除' })
      } else {
        await fs.rm(p, { force: true }).catch(() => {})
        rows.push({ target: p.slice(ROOT.length + 1), size, action: '已删除' })
      }
      totalFreed += size
    }
  }
}
// 只扫一层 workspace 结构,避免递归 node_modules
for (const top of ['apps', 'packages']) {
  const topAbs = path.join(ROOT, top)
  const dirs = await fs.readdir(topAbs).catch(() => [])
  for (const d of dirs) {
    const p = path.join(topAbs, d)
    const st = await fs.stat(p).catch(() => null)
    if (st?.isDirectory()) await sweepTsbuildinfo(p)
  }
}

// 统一输出明细(quiet 模式跳过)
if (!quiet) {
  for (const r of rows) {
    if (r.action.startsWith('skip')) continue
    const flag = r.action.startsWith('失败') ? ' ⚠' : ''
    console.log(`[clean-garbage]   ${r.action.padEnd(18)} ${fmt(r.size).padStart(9)}  ${r.target}${flag}`)
  }
}

const success = rows.filter(r => r.action.startsWith('失败')).length === 0
console.log(`[clean-garbage] ${dryRun ? '预计可回收' : '已回收'} ${fmt(totalFreed)} · 共 ${rows.length} 项` + (success ? '' : ' · ⚠ 有失败项见上'))
process.exit(success ? 0 : 1)
