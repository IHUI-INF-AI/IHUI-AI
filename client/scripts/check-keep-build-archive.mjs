#!/usr/bin/env node
/**
 * 前端编译包归档守门脚本 (2026-07-07 立)
 *
 * 目的: 验证 keep-build-archive 集成是否完整, 拦截归档失效的情况.
 *
 * 检查项:
 *   1. client/scripts/keep-build-archive.mjs 存在
 *   2. package.json 含 prebuild:web/h5/alipay/electron/mp-weixin 5 个钩子
 *   3. package.json 含 archive:* 命令
 *   4. 每个 prebuild 钩子指向正确的 --platform 参数
 *   5. archives 目录可写
 *   6. (可选) 至少 1 个历史归档存在
 *
 * 用法:
 *   node scripts/check-keep-build-archive.mjs           # 完整检查
 *   node scripts/check-keep-build-archive.mjs --strict  # 严格模式, 任何 warning 也阻塞
 *   node scripts/check-keep-build-archive.mjs --fix     # 自动修复 (创建缺失目录)
 *
 * 退出码:
 *   0 - 全部通过
 *   1 - 有失败项
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CLIENT_ROOT = path.resolve(__dirname, '..')
const PROJECT_ROOT = path.resolve(CLIENT_ROOT, '..')

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const fix = args.includes('--fix')

let passCount = 0
let failCount = 0
let warnCount = 0

const PASS = (msg) => { passCount++; console.log(`  ✅ ${msg}`) }
const FAIL = (msg) => { failCount++; console.log(`  ❌ ${msg}`) }
const WARN = (msg) => { warnCount++; console.log(`  ⚠️  ${msg}`) }
const INFO = (msg) => console.log(`  ℹ️  ${msg}`)

// ── Check 1: 脚本存在 ──
console.log('\n[1] 脚本存在性')
const scriptPath = path.join(CLIENT_ROOT, 'scripts', 'keep-build-archive.mjs')
if (fs.existsSync(scriptPath)) {
  const stat = fs.statSync(scriptPath)
  PASS(`scripts/keep-build-archive.mjs 存在 (${(stat.size / 1024).toFixed(1)} KB)`)
} else {
  FAIL(`scripts/keep-build-archive.mjs 不存在`)
}

// ── Check 2: prebuild 钩子 ──
console.log('\n[2] prebuild 钩子配置')
const pkgPath = path.join(CLIENT_ROOT, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const expectedHooks = ['web', 'h5', 'alipay', 'electron', 'mp-weixin']
const expectedCommands = ['prebuild:web', 'prebuild:h5', 'prebuild:alipay', 'prebuild:electron', 'prebuild:mp-weixin']

for (const cmd of expectedCommands) {
  if (pkg.scripts[cmd]) {
    const expectedPlatform = cmd.replace('prebuild:', '')
    const scriptCall = pkg.scripts[cmd]
    if (scriptCall.includes(`--platform ${expectedPlatform}`)) {
      PASS(`${cmd} → ${scriptCall}`)
    } else {
      FAIL(`${cmd} 存在但 --platform 不正确 (期望 ${expectedPlatform}, 实际: ${scriptCall})`)
    }
  } else {
    FAIL(`${cmd} 缺失`)
  }
}

// ── Check 3: archive:* 命令 ──
console.log('\n[3] archive:* 命令')
const archiveCommands = ['archive:web', 'archive:h5', 'archive:alipay', 'archive:electron', 'archive:mp-weixin', 'archive:all', 'archive:list']
for (const cmd of archiveCommands) {
  if (pkg.scripts[cmd]) {
    PASS(`${cmd} 已注册`)
  } else {
    if (strict) {
      FAIL(`${cmd} 缺失`)
    } else {
      WARN(`${cmd} 缺失 (建议添加)`)
    }
  }
}

// ── Check 4: archives 目录 ──
console.log('\n[4] archives 目录')
const archivesDir = path.join(PROJECT_ROOT, 'archives')
if (fs.existsSync(archivesDir)) {
  PASS(`archives 目录存在 (${archivesDir})`)
  try {
    fs.accessSync(archivesDir, fs.constants.W_OK)
    PASS('archives 目录可写')
  } catch {
    FAIL('archives 目录不可写')
  }
} else {
  if (fix) {
    fs.mkdirSync(archivesDir, { recursive: true })
    PASS(`archives 目录已创建`)
  } else {
    FAIL(`archives 目录不存在 (使用 --fix 自动创建)`)
  }
}

// ── Check 5: 历史归档 ──
console.log('\n[5] 历史归档')
if (fs.existsSync(archivesDir)) {
  const files = fs.readdirSync(archivesDir).filter((f) => f.startsWith('frontend-') && f.endsWith('.zip'))
  if (files.length > 0) {
    const totalSize = files.reduce((a, f) => a + fs.statSync(path.join(archivesDir, f)).size, 0)
    PASS(`发现 ${files.length} 份历史归档, 总计 ${(totalSize / 1024 / 1024).toFixed(2)} MB`)
    // 按平台分组统计
    const byPlatform = {}
    for (const f of files) {
      const m = f.match(/^frontend-(\w+(?:-\w+)?)-\d{8}-\d{6}\.zip$/)
      if (m) {
        const p = m[1]
        byPlatform[p] = (byPlatform[p] || 0) + 1
      }
    }
    for (const [p, c] of Object.entries(byPlatform)) {
      INFO(`  ${p}: ${c} 份`)
    }
  } else {
    WARN('无历史归档 (运行 npm run archive:web 等手动触发)')
  }
}

// ── Check 6: build 脚本含 vue-tsc ──
console.log('\n[6] build 脚本类型检查')
const buildCommands = ['build:web', 'build:h5', 'build:alipay', 'build:electron']
for (const cmd of buildCommands) {
  const script = pkg.scripts[cmd]
  if (script && script.includes('vue-tsc')) {
    PASS(`${cmd} 含 vue-tsc 类型检查`)
  } else if (script) {
    WARN(`${cmd} 缺 vue-tsc 类型检查 (跳过类型检查可能导致 dist 缺 index.html)`)
  }
}

// ── Check 7: .gitignore 配置 ──
console.log('\n[7] .gitignore 配置')
const gitignorePath = path.join(CLIENT_ROOT, '.gitignore')
if (fs.existsSync(gitignorePath)) {
  const content = fs.readFileSync(gitignorePath, 'utf8')
  if (content.includes('dist') || content.includes('dist/')) {
    PASS('client/.gitignore 含 dist (编译产物不进 git, 归档是唯一历史)')
  } else {
    WARN('client/.gitignore 未排除 dist')
  }
}
const rootGitignorePath = path.join(PROJECT_ROOT, '.gitignore')
if (fs.existsSync(rootGitignorePath)) {
  const content = fs.readFileSync(rootGitignorePath, 'utf8')
  if (content.match(/^archives\/?$/m) || content.match(/\narchives\/?\n/)) {
    PASS('根 .gitignore 含 archives (推荐: archives 不进 git, 体积大)')
  } else {
    INFO('根 .gitignore 未排除 archives (建议添加, archives 单个文件 100+ MB)')
  }
}

// ── 汇总 ──
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`📊 检查汇总: ${passCount} 通过, ${failCount} 失败, ${warnCount} 警告`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

if (failCount > 0) {
  console.log(`\n❌ ${failCount} 项失败, 阻塞`)
  process.exit(1)
}

if (strict && warnCount > 0) {
  console.log(`\n⚠️  严格模式: ${warnCount} 项警告, 阻塞`)
  process.exit(1)
}

console.log(`\n✅ 全部通过${warnCount > 0 ? ` (${warnCount} 警告可后续优化)` : ''}`)
process.exit(0)
