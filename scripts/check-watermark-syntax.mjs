#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-watermark-syntax.mjs — 溯源水印语法门禁(2026-09-03 P1 落地)
 *
 * 背景: watermark.mjs 早期版本曾对 .xml(.kt/.java 尾部)注入产生语法违规:
 *   - 横幅/载荷行未按文件类型加注释前缀(裸 `© 2026...` 文本行 → 编译报错)
 *   - .xml 的 `<?xml?>` 声明被挤离文档首位 / 横幅插到声明之前
 *   - L3 尾行裸零宽字符(无 `//`/`#`/`--`/`<!--`/`/*` 包裹)
 *
 * 本门禁扫描全仓库可注入类型文件,断言:
 *   R1  任何含零宽载荷(\u200b\u200c\u200d\u2060)的行必须被注释包裹
 *       (line 风格行首前缀;html/block 风格处于注释区内或行内 open..close 覆盖)
 *   R2  .xml 若含 `<?xml` 声明,必须是文件第一个非空行,且横幅不得在其之前
 *
 * 用法: node scripts/check-watermark-syntax.mjs          # 全扫,违例 exit 1
 *       node scripts/check-watermark-syntax.mjs <file>   # 单文件
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

// 零宽载荷字符(与 watermark.mjs 的 ZWSP/ZWNJ/ZWJ/SENTINEL 对应)
const INVISIBLE_RE = /[\u200b\u200c\u200d\u2060]/

// 横幅行形态(与 watermark.mjs isBannerLine 同款): 剥行首注释前缀(// # --)后,
// 行首锚定匹配版权行 / 溯源声明 / [ID]: 载荷行才视为横幅内容行。
// 仅 includes(BANNER_ID) 会误伤源码常量定义(如 watermark.mjs 的 BANNER_ID 常量)。
const BANNER_TEXT_RE =
  /^(?:©\s*\d{4}\s+IHUI\s+AI|Provenance-watermarked(?:\.|\s)|\[IHUI-AI-PROVENANCE\]\s*:)/
function isBannerLine(line) {
  return BANNER_TEXT_RE.test(line.trim().replace(/^\s*(\/\/|#|--)\s*/, ''))
}

// ---------- 文件类型 → 注释风格(与 watermark.mjs EXT_MAP/STYLES 对齐) ----------
const STYLES = {
  slash: { line: '//' },
  hash: { line: '#' },
  block: { open: '/*', close: '*/' },
  html: { open: '<!--', close: '-->' },
  sql: { line: '--' },
}

const EXT_MAP = {
  '.ts': 'slash', '.tsx': 'slash', '.js': 'slash', '.jsx': 'slash',
  '.mjs': 'slash', '.cjs': 'slash', '.mts': 'slash', '.cts': 'slash',
  '.go': 'slash', '.java': 'slash', '.rs': 'slash', '.kt': 'slash', '.kts': 'slash',
  '.swift': 'slash', '.c': 'slash', '.h': 'slash', '.cpp': 'slash', '.hpp': 'slash',
  '.cc': 'slash', '.scala': 'slash', '.dart': 'slash',
  '.scss': 'slash', '.sass': 'slash', '.less': 'slash',
  '.py': 'hash', '.sh': 'hash', '.bash': 'hash', '.zsh': 'hash', '.fish': 'hash',
  '.yml': 'hash', '.yaml': 'hash', '.toml': 'hash', '.rb': 'hash', '.ini': 'hash',
  '.conf': 'hash', '.cfg': 'hash', '.env': 'hash', '.properties': 'hash',
  '.ps1': 'hash', '.psm1': 'hash', '.pl': 'hash', '.r': 'hash', '.lua': 'hash',
  '.css': 'block', '.jsonc': 'block',
  '.html': 'html', '.htm': 'html', '.xml': 'html',
  '.md': 'html', '.markdown': 'html',
  '.sql': 'sql',
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.turbo', 'dist', 'build', '.next', 'out', 'coverage',
  '.pnpm', 'target', '.cache', '.vercel', 'storybook-static', '_.husky', '_husky',
  '.husky/_', '.nyc_output', '.gradle', '.idea', '__pycache__', '.pytest_cache',
  '.venv', 'venv', 'vendor', 'expo/dist', '.expo',
  // 与 watermark.mjs SKIP_DIRS 对齐: 忽略目录/构建产物不检查(均 .gitignore)
  'tmp', 'playwright-report', 'test-results', 'vs',
  // CMake/AGP 原生构建产物(.cxx 为 Android externalNativeBuild 生成目录)
  '.cxx', 'CMakeFiles', '.externalNativeBuild', '.cmake',
])

const SKIP_FILES = new Set([
  'pnpm-lock.yaml', 'uv.lock', 'yarn.lock', 'package-lock.json',
  'bun.lockb', 'Cargo.lock', 'poetry.lock', 'go.sum', '.gitignore', '.dockerignore',
  '.npmignore', '.prettierignore', '.gitattributes', '.editorconfig', '.actrc',
  '.prettierrc', '.eslintignore', '.env', '.env.local', '.env.production',
])

const BINARY_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.avif',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.gz', '.tar', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.mp4', '.mp3', '.wav', '.ogg', '.mov', '.webm',
  '.db', '.sqlite', '.sqlite3', '.lock',
])

function styleFor(absPath) {
  const name = basename(absPath)
  if (name === 'Dockerfile' || name.startsWith('Dockerfile.')) return STYLES.hash
  if (name === 'Makefile' || name.startsWith('Makefile.')) return STYLES.hash
  if (name === 'go.mod') return STYLES.slash
  if (name.startsWith('.env.') || name === '.env.example') return STYLES.hash
  if (name === 'next-env.d.ts') return null
  const key = EXT_MAP[extname(absPath).toLowerCase()]
  return key ? STYLES[key] : null
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) {
      const rel = relative(ROOT, abs).replaceAll('\\', '/')
      if (SKIP_DIRS.has(entry.name) || rel.split('/').some((s) => SKIP_DIRS.has(s))) continue
      yield* walk(abs)
    } else if (entry.isFile()) {
      yield abs
    }
  }
}

function isBinary(buf) {
  for (let i = 0; i < Math.min(buf.length, 4096); i++) if (buf[i] === 0) return true
  return false
}

/** 行内 open..close 注释是否覆盖到零宽载荷 */
function lineCommentCovers(line, style) {
  const open = style.open
  const close = style.close
  let o = line.indexOf(open)
  while (o !== -1) {
    const c = line.indexOf(close, o + open.length)
    const segEnd = c === -1 ? line.length : c
    const seg = line.slice(o + open.length, segEnd)
    if (INVISIBLE_RE.test(seg) || isBannerLine(seg)) return true
    o = c === -1 ? -1 : line.indexOf(open, c + close.length)
  }
  return false
}

/** 跨行注释区间(仅 html/block 风格): 返回 [start,end][] 闭区间(行索引) */
function commentRanges(lines, style) {
  const ranges = []
  let start = -1
  const open = style.open
  const close = style.close
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (start < 0) {
      // 若本行存在"未在本行闭合"的 open → 开启区间
      let idx = line.indexOf(open)
      let opened = false
      while (idx !== -1) {
        const after = line.indexOf(close, idx + open.length)
        if (after === -1) { opened = true; break }
        idx = line.indexOf(open, after + close.length)
      }
      if (opened) start = i
    } else if (line.includes(close)) {
      ranges.push([start, i])
      start = -1
    }
  }
  if (start !== -1) ranges.push([start, lines.length - 1]) // 未闭合,保守视为注释内
  return ranges
}

/** R1/R3: 载荷行或横幅行必须被注释包裹 */
function checkMarkedLines(lines, style, relPath, issues) {
  const isLine = Boolean(style.line)
  // 区间: line 风格文件也允许 /* */ 与 <!-- --> 块注释(文档/示例常出现), 一并纳入
  const ownRanges = isLine ? [] : commentRanges(lines, style)
  const blockRanges = commentRanges(lines, STYLES.block)
  const htmlRanges = commentRanges(lines, STYLES.html)
  const inRange = (ranges, i) => ranges.some(([a, b]) => i >= a && i <= b)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const hasMark = INVISIBLE_RE.test(line) || isBannerLine(line)
    if (!hasMark) continue
    let ok
    if (isLine) {
      // 行首注释前缀, 或处于 /* */ / <!-- --> 块注释内
      ok =
        line.trimStart().startsWith(style.line) ||
        inRange(blockRanges, i) ||
        inRange(htmlRanges, i)
    } else {
      ok =
        inRange(ownRanges, i) ||
        lineCommentCovers(line, style) ||
        inRange(blockRanges, i) ||
        inRange(htmlRanges, i)
    }
    if (!ok) {
      const kind = INVISIBLE_RE.test(line)
        ? '裸零宽载荷行(未注释包裹)'
        : '横幅行未注释包裹'
      issues.push(`${relPath}:${i + 1}  [${kind}]`)
    }
  }
}

/** R2: .xml 的 <?xml 声明必须位于第一个非空行且横幅不早于它 */
function checkXmlDecl(lines, absPath, relPath, issues) {
  if (extname(absPath).toLowerCase() !== '.xml') return
  const xmlIdx = lines.findIndex((l) => /^\s*<\?xml/.test(l))
  if (xmlIdx === -1) return
  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0)
  if (!/^\s*<\?xml/.test(lines[firstNonEmpty])) {
    issues.push(`${relPath}:${firstNonEmpty + 1}  [XML 声明非首个非空行(须保持第 1 行)]`)
    return
  }
  const bannerIdx = lines.findIndex((l) => isBannerLine(l) || INVISIBLE_RE.test(l))
  if (bannerIdx !== -1 && bannerIdx < xmlIdx) {
    issues.push(`${relPath}:${bannerIdx + 1}  [横幅插在 XML 声明之前]`)
  }
}

function checkFile(absPath) {
  const style = styleFor(absPath)
  if (!style) return 0
  const buf = readFileSync(absPath)
  if (isBinary(buf)) return 0
  const text = buf.toString('utf8').replace(/^\uFEFF/, '')
  const lines = text.split('\n')
  const issues = []
  const relPath = relative(ROOT, absPath).replaceAll('\\', '/')
  checkMarkedLines(lines, style, relPath, issues)
  checkXmlDecl(lines, absPath, relPath, issues)
  issues.forEach((m) => console.log(`  [FAIL] ${m}`))
  return issues.length
}

// ---------- main ----------
const targetArg = process.argv[2]
let totalIssues = 0
let checked = 0

if (targetArg) {
  if (!existsSync(targetArg)) {
    console.error(`文件不存在: ${targetArg}`)
    process.exit(1)
  }
  totalIssues = checkFile(targetArg)
  checked = 1
} else {
  for (const abs of walk(ROOT)) {
    const name = basename(abs)
    if (SKIP_FILES.has(name)) continue
    if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
    if (!styleFor(abs)) continue
    checked++
    totalIssues += checkFile(abs)
  }
}

console.log(`[check:watermark-syntax] 扫描 ${checked} 个可注入文件, 违例 ${totalIssues} 处`)
if (totalIssues > 0) {
  console.log('处理: 对违例文件执行 node scripts/watermark.mjs clean <file> 后重新 inject, 或手工补注释前缀')
  process.exit(1)
}
console.log('全部通过: 载荷/横幅行均注释包裹, XML 声明位置正确。')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
