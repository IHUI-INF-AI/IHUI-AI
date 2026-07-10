#!/usr/bin/env node
/**
 * 行尾格式检测 (Line Ending Detector)
 *
 * 目的: 防止 src/scripts/e2e/config/docs 下**新引入**的 CRLF/LF/CR 混用
 *       (项目 .gitattributes 已声明 `* text=auto eol=lf`).
 *
 * 用法:
 *   node scripts/check-line-endings.mjs           # 检查 git staged 文件 (lint-staged 集成)
 *   node scripts/check-line-endings.mjs --all     # 检查全项目 (含历史遗留, 用于批量规范化)
 *
 * 退出码:
 *   0 - 通过
 *   1 - 发现混合行尾
 *
 * 模式:
 *   --staged (默认) lint-staged 集成: 只检查 git diff --cached --name-only
 *   --all         全项目扫描: 找出所有 CRLF/CR 文件 (用于批量规范化, 需配套 git add --renormalize)
 *
 * 检测规则:
 *   - 扫描 src/scripts/e2e/config/docs 下的文本文件 (.ts/.vue/.scss/.json 等)
 *   - 二进制文件自动跳过 (基于 MIME 启发式: 前 8KB 含 0x00 字节)
 *   - 任何 CRLF 或 lone CR 行视为违规
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const SCAN_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.scss', '.css', '.sass', '.less',
  '.json', '.md', '.html', '.xml', '.yml', '.yaml',
  // .ps1/.sh/.bat/.cmd 排除: Windows 脚本 (.ps1/.bat/.cmd) 在 Windows 上需 CRLF 才能运行,
  // .sh 在 Linux/macOS 上需 LF. 由 .gitattributes 的 `eol=lf` + git 自动转换处理,
  // 这里不二次校验 (避免与 .gitattributes 冲突)
])

const SKIP_DIRS = new Set([
  'node_modules', 'dist', '.git', 'test-results',
  'logs', 'pw-output', '__screenshots__', 'storybook-static',
  'chromatic-build', '.vite', '.cache',
])

const ALLOWED_PREFIXES = [
  path.join(clientRoot, 'src') + path.sep,
  path.join(clientRoot, 'scripts') + path.sep,
  path.join(clientRoot, 'e2e') + path.sep,
  path.join(clientRoot, 'config') + path.sep,
  path.join(projectRoot, 'scripts') + path.sep,
  path.join(projectRoot, 'docs') + path.sep,
]

const WHITELIST_FILES = new Set([
  path.join(clientRoot, '.gitattributes'),
  path.join(projectRoot, '.gitattributes'),
])

function isBinaryByName(p) {
  const base = path.basename(p)
  return base.endsWith('.png') || base.endsWith('.jpg') ||
    base.endsWith('.jpeg') || base.endsWith('.gif') ||
    base.endsWith('.webp') || base.endsWith('.ico') ||
    base.endsWith('.pdf') || base.endsWith('.zip') ||
    base.endsWith('.tar') || base.endsWith('.gz') ||
    base.endsWith('.woff') || base.endsWith('.woff2') ||
    base.endsWith('.ttf') || base.endsWith('.eot')
}

function isBinaryByContent(buf) {
  const head = buf.subarray(0, Math.min(8192, buf.length))
  for (let i = 0; i < head.length; i++) {
    if (head[i] === 0) return true
  }
  return false
}

function isAllowedPath(p) {
  return ALLOWED_PREFIXES.some((prefix) => p.startsWith(prefix))
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((rel) => path.resolve(projectRoot, rel))
      .filter((p) => isAllowedPath(p) && fs.existsSync(p))
  } catch {
    return []
  }
}

function walk(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      if (entry.name === '_archive') continue
      out.push(...walk(p))
    } else {
      const ext = path.extname(entry.name).toLowerCase()
      if (SCAN_EXT.has(ext) && !isBinaryByName(p)) {
        out.push(p)
      }
    }
  }
  return out
}

let totalViolations = 0
const files = []
const modeAll = process.argv.includes('--all')

if (modeAll) {
  for (const dir of ALLOWED_PREFIXES.map((p) => p.slice(0, -1))) {
    files.push(...walk(dir))
  }
} else {
  files.push(...getStagedFiles())
}

for (const f of files) {
  if (WHITELIST_FILES.has(f)) continue
  const buf = fs.readFileSync(f)
  if (isBinaryByContent(buf)) continue
  let crlfLines = 0
  let crOnlyLines = 0
  let lfOnlyLines = 0
  let totalLines = 0
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) {
      if (i > 0 && buf[i - 1] === 0x0d) {
        crlfLines++
      } else {
        lfOnlyLines++
      }
      totalLines++
    } else if (buf[i] === 0x0d) {
      if (i + 1 >= buf.length || buf[i + 1] !== 0x0a) {
        crOnlyLines++
      }
    }
  }
  if (crlfLines > 0 || crOnlyLines > 0) {
    totalViolations++
    const rel = path.relative(projectRoot, f)
    console.error(`\n[VIOLATION] ${rel}`)
    console.error(`  LF=${lfOnlyLines}  CRLF=${crlfLines}  CR=${crOnlyLines}  total=${totalLines}`)
    console.error(`  修复: git add --renormalize ${rel} && git commit -m "chore: normalize LF"`)
  }
}

if (totalViolations > 0) {
  const mode = modeAll ? '(全项目模式)' : '(staged 模式)'
  console.error(`\n[FAIL] ${mode} 共发现 ${totalViolations} 个文件含 CRLF 或 CR 行`)
  console.error(`项目 .gitattributes 已声明 'text=auto eol=lf', 所有文本文件必须用 LF 行尾`)
  process.exit(1)
}

const mode = modeAll ? '全项目' : 'git staged'
console.log(`[OK] ${mode}模式: ${files.length} 个文件全部使用 LF 行尾`)
process.exit(0)
