#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-pwsh-version.mjs
// 守门:所有项目内 .ps1 文件必须以 `#requires -Version 7` 开头
// 强制只用 PowerShell 7 (pwsh.exe),禁止用 Windows PowerShell 5.1 (powershell.exe)
//
// 退出码: 0 = 全部通过, 1 = 有违规
// 用法: node scripts/check-pwsh-version.mjs [--staged] [--root <path>]
//   --staged : 仅检查 git index 中已暂存的 .ps1(pre-commit 钩子用此模式)
//   缺省     : 全树扫描(供人工 / CI 全量审计)
//
// 2026-09-15 修复(本守门自身的 P0 回归):
//   本脚本自挂载起就**没有实现 --staged** —— 用法注释声明了、pre-commit 也照传了,
//   但实现里只有无条件的 scan(ROOT),于是「staged 模式守住新增/修改」形同虚设。
//   后果:工作区里任何**未跟踪且被 gitignore** 的遗留 .ps1(实测 .android-toolchain/*.ps1、
//   .tmp-wechat-test/watch.ps1,来自本机 Android SDK 目录与临时试验目录)都会让**每一次
//   提交**被阻断;而这些文件在干净 checkout / CI 里根本不存在 —— 守门拦的是本地垃圾,
//   不是项目代码。修法:真正解析 --staged,按 `git diff --cached` 的清单检查。

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'

const args = process.argv.slice(2)
const STAGED = args.includes('--staged')
const rootIdx = args.indexOf('--root')
const ROOT =
  rootIdx >= 0 ? resolve(args[rootIdx + 1]) : resolve(dirname(fileURLToPath(import.meta.url)), '..')

if (!existsSync(ROOT)) {
  console.error(`[FAIL] root path does not exist: ${ROOT}`)
  process.exit(1)
}

// 跳过的目录(整棵树,gitignore 等价)
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  '.next',
  'build',
  '.turbo',
  'target',
  'bin',
  'obj',
  // 项目内临时目录(.gitignore 第 5 行)
  'tmp',
  // 部署打包产物(.gitignore 第 314 行,不在项目维护范围)
  'deploy',
  // 第三方 IDE 工具目录(.gitignore 第 97 行,非项目代码)
  '.ihui-agent',
])

// 跳过的路径模式(子目录白名单)
const SKIP_PATH_PATTERNS = [
  /[\\/]\.venv[\\/]/,
  /[\\/]venv[\\/]/,
  /[\\/]node_modules[\\/]/,
  /[\\/]\.git[\\/]/,
  /[\\/]\.ihui-agent[\\/]tmp[\\/]/,
  /[\\/]site-packages[\\/]/, // playwright 驱动
  /[\\/]driver[\\/]package[\\/]bin[\\/]/, // playwright
  // 部署打包产物 + 临时目录(防漏网)
  /[\\/]tmp[\\/]/,
  /[\\/]deploy[\\/]prod-bundle[\\/]/,
  /[\\/]\.ihui-agent[\\/]/,
  // 污染治理隔离归档(2026-09-15 补):历史现场原样保存,不追溯新规则
  /[\\/]\.workbuddy[\\/]quarantine[\\/]/,
]

const violations = []

function scan(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || isExcludedDirName(e.name)) continue
      scan(full)
    } else if (e.name.endsWith('.ps1')) {
      if (SKIP_PATH_PATTERNS.some((p) => p.test(full))) continue
      checkFile(full)
    }
  }
}

function checkFile(filePath) {
  let content
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    return // 读不到的跳过
  }
  // 只检查前 5 行
  const lines = content.split(/\r?\n/).slice(0, 5)
  const hasRequires7 = lines.some((l) => /^\s*#requires\s+-Version\s+7\b/.test(l))
  if (!hasRequires7) {
    violations.push(relative(ROOT, filePath))
  }
}

/**
 * 取 index 中已暂存的 .ps1 相对路径(仅新增/修改/改名,不含删除)。
 * 返回 null 表示非 git 环境 —— 调用方退化为全树扫描,避免静默放过。
 */
function listStagedPsiFiles() {
  let out
  try {
    out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
  } catch {
    return null
  }
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((f) => f.toLowerCase().endsWith('.ps1'))
}

/** 路径是否落在目录级白名单内(与全量扫描口径保持一致)。 */
function isSkippedPath(rel) {
  const full = join(ROOT, rel)
  if (SKIP_PATH_PATTERNS.some((p) => p.test(full))) return true
  return rel.split(/[\\/]/).some((seg) => SKIP_DIRS.has(seg) || isExcludedDirName(seg))
}

if (STAGED) {
  const staged = listStagedPsiFiles()
  if (staged === null) {
    console.warn('[WARN] 非 git 环境,--staged 退化为全树扫描')
    scan(ROOT)
  } else {
    for (const rel of staged) {
      if (isSkippedPath(rel)) continue
      checkFile(join(ROOT, rel)) // 已删除的文件 readFileSync 失败即跳过
    }
  }
} else {
  scan(ROOT)
}

if (violations.length === 0) {
  console.log('[OK] all project .ps1 files declare `#requires -Version 7`')
  process.exit(0)
}

console.error(`[FAIL] ${violations.length} .ps1 file(s) missing \`#requires -Version 7\`:`)
for (const v of violations) {
  console.error(`  - ${v}`)
}
console.error('')
console.error('Fix: add the following as the FIRST line of each file:')
console.error('  #requires -Version 7')
console.error('')
console.error('Reason: PowerShell 5.1 (powershell.exe) is EOL and has known')
console.error('encoding/parsing bugs. Use PowerShell 7+ (pwsh.exe) only.')
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
