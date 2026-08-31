#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IHUI AI (智汇AI) 溯源水印工具
 *
 * 用途: 为仓库内所有文本源文件注入多层版权溯源水印, 用于识别与追责未授权商用。
 *
 * 三层水印:
 *   L1 可见版权声明 —— 文件顶部注释横幅 (含作者 李春川 / 智汇AI / IHUI AI)
 *   L2 零宽字符隐写 —— 嵌入在横幅注释内部的不可见标记 (ZWSP/ZWNJ/ZWJ 编码)
 *   L3 独立隐形标记 —— 文件末尾一行仅含零宽字符的"空行", 删除可见横幅仍可检出
 *
 * 用法:
 *   node scripts/watermark.mjs inject          # 注入水印(幂等, 已注入则跳过)
 *   node scripts/watermark.mjs verify          # 校验全仓库水印覆盖率
 *   node scripts/watermark.mjs decode <file>   # 解码指定文件中的隐写内容
 *   node scripts/watermark.mjs clean <file>    # 移除指定文件的水印(仅限版权所有者自查用)
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

// ---------- 水印配置 ----------
const WATERMARK_TEXT = 'IHUI-AI·智汇AI·李春川·LC·aizhs.top·PROVENANCE-2026'
const BANNER_ID = 'IHUI-AI-PROVENANCE'
const BANNER_LINES = [
  '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
  'Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。',
]

// ---------- 零宽字符编解码 ----------
const ZWSP = '\u200b' // 0
const ZWNJ = '\u200c' // 1
const ZWJ = '\u200d' // 字符分隔
const SENTINEL = '\u2060' // 起止哨兵 (Word Joiner, 不可见)

function encodePayload(text) {
  const chars = [...text].map((ch) => {
    const cp = ch.codePointAt(0)
    // 用 UTF-16 码元逐个编码, 兼容任意字符
    return String.fromCharCode(cp)
      .split('')
      .map((c) =>
        c
          .charCodeAt(0)
          .toString(2)
          .padStart(8, '0')
          .split('')
          .map((b) => (b === '0' ? ZWSP : ZWNJ))
          .join('')
      )
      .join(ZWJ)
  })
  return SENTINEL + chars.join(ZWJ + ZWJ) + SENTINEL
}

function decodePayload(zwString) {
  const body = zwString.replace(new RegExp(SENTINEL, 'g'), '')
  const charUnits = body.split(ZWJ + ZWJ)
  return charUnits
    .map((unit) => {
      const codeUnits = unit.split(ZWJ)
      const codes = codeUnits.map((cu) =>
        String.fromCharCode(
          parseInt(
            [...cu]
              .map((b) => (b === ZWNJ ? '1' : '0'))
              .join(''),
            2
          )
        )
      )
      return codes.join('')
    })
    .join('')
}

const INVISIBLE_MARK = encodePayload(WATERMARK_TEXT)
const INVISIBLE_RE = new RegExp(`${SENTINEL}[${ZWSP}${ZWNJ}${ZWJ}]+${SENTINEL}`)

// ---------- 文件类型 → 注释风格 ----------
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
  // 注意:.vue/.svelte/.astro 首行是 <template>/<script>,插 // 行注释会被编译器当模板文本,故不映射(跳过)
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
  if (name.startsWith('.env.') || name === '.env.example' || name === '.env.production.example') {
    return STYLES.hash
  }
  if (name === 'next-env.d.ts') return null // Next.js 自动生成, 不动
  const styleKey = EXT_MAP[extname(absPath).toLowerCase()]
  return styleKey ? STYLES[styleKey] : null
}

function isBinary(buf) {
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    if (buf[i] === 0) return true
  }
  return false
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

function makeBanner(style, extra) {
  if (style.line) {
    const zw = extra ?? INVISIBLE_MARK
    const lines = BANNER_LINES.map((l) => `${style.line} ${l}`)
    lines.push(`${style.line} [${BANNER_ID}]:${zw}`)
    return lines.join('\n') + '\n'
  }
  // block / html
  const inner = BANNER_LINES.map((l) => `  ${l}`).join('\n')
  const zw = extra ?? INVISIBLE_MARK
  return `${style.open}\n${inner}\n  [${BANNER_ID}]:${zw}\n${style.close}\n`
}

function injectFile(absPath) {
  const style = styleFor(absPath)
  if (!style) return 'skip-type'
  const buf = readFileSync(absPath)
  if (isBinary(buf)) return 'skip-binary'
  let text = buf.toString('utf8').replace(/^\uFEFF/, '') // strip BOM, 避免 shebang 检测失败
  if (INVISIBLE_RE.test(text)) return 'skip-done'
  // 残迹态(只有横幅文本、载荷被剥离):先清干净再注入,避免横幅重复
  // 注意: 本工具自身源码包含横幅常量定义, clean 会"自噬", 故跳过自身
  if (absPath === fileURLToPath(import.meta.url)) return 'skip-self'
  if (text.includes(BANNER_ID)) {
    try {
      cleanFile(absPath)
      text = readFileSync(absPath, 'utf8').replace(/^\uFEFF/, '')
    } catch {
      /* clean 失败则继续按残迹处理 */
    }
  }
  // XML 声明必须位于文档首位: 提取后置于横幅之前, 而不是跳过
  let xmlDecl = ''
  const xmlMatch = text.match(/^\s*<\?xml[\s\S]*?\?>\r?\n?/)
  if (xmlMatch) {
    xmlDecl = xmlMatch[0]
    text = text.slice(xmlMatch[0].length)
  }

  // 保留 shebang 行在最前
  let shebang = ''
  const nl = text.startsWith('#!') ? (text.indexOf('\n') >= 0 ? '\n' : '') : null
  if (nl !== null) {
    const idx = text.indexOf('\n')
    shebang = idx >= 0 ? text.slice(0, idx + 1) : text + '\n'
    text = idx >= 0 ? text.slice(idx + 1) : ''
  }

  const banner = makeBanner(style)
  // L3: 文件末尾独立隐形行(注释包裹, 避免裸零宽字符导致 JS/TS/CSS 等解析报错)
  let tail = ''
  if (style.line) tail = style.line + ' ' + INVISIBLE_MARK + '\n'
  else if (style === STYLES.sql) tail = '-- ' + INVISIBLE_MARK + '\n'
  else if (style === STYLES.html) tail = '<!-- ' + INVISIBLE_MARK + ' -->\n'
  else tail = '/* ' + INVISIBLE_MARK + ' */\n'

  // 统一去末尾换行再追加,保证 L3 恒为独立末行(绝不与末行内容拼接,也不落在中间空行)
  const body = (shebang + xmlDecl + banner + '\n' + text).replace(/\r?\n$/, '')
  const out = body + '\n' + tail
  writeFileSync(absPath, out, 'utf8')
  return 'injected'
}

function cleanFile(absPath) {
  const text = readFileSync(absPath, 'utf8')
  const lines = text.split('\n')
  const keep = []
  let inBanner = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const next = lines[i + 1] ?? ''
    // 块横幅 opener(/* 或 <!-- 独占一行)且下一行是横幅文案 → 整块跳过
    if (
      !inBanner &&
      /^\s*(\/\*|<!--)\s*$/.test(line) &&
      (next.includes(BANNER_ID) || BANNER_LINES.some((b) => next.includes(b)))
    ) {
      inBanner = true
      continue
    }
    // 命中横幅内容行(含 BANNER_ID 或横幅文案)→ 整块跳过
    if (line.includes(BANNER_ID) || BANNER_LINES.some((b) => line.includes(b))) {
      inBanner = true
      continue
    }
    // 横幅块的关闭符(*/ 或 -->)紧随其后 → 一并吞掉,避免留下未闭合注释
    if (inBanner && /^\s*(\*\/|-->)\s*$/.test(line)) {
      inBanner = false
      continue
    }
    inBanner = false
    // 删除含隐写载荷的行(标准 INVISIBLE_MARK 或任意裸零宽行都命中)
    if (line.includes(INVISIBLE_MARK) || /^[\u200b\u200c\u200d\u2060]+$/.test(line.trim())) continue
    keep.push(line)
  }
  let out = keep.join('\n')
  // 清残余: 尾部悬挂注释标记 / 孤立 /* <!-- 行 / 首尾空行归一
  out = out
    .replace(/(\r?\n)(\/\/|#|--)\s*$/, '$1')
    .replace(/^\s*\/\*[^*]*$/, '')
    .replace(/^\s*<!--\s*$/, '')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n')
  writeFileSync(absPath, out, 'utf8')
}

function findMarks(text) {
  return [...text.matchAll(new RegExp(INVISIBLE_RE, 'g'))].map((m) => decodePayload(m[0]))
}

function verifyAll() {
  let total = 0, marked = 0, residue = 0
  const skipped = 0
  const missing = []
  const residues = []
  for (const abs of walk(ROOT)) {
    const name = basename(abs)
    if (SKIP_FILES.has(name)) continue
    if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
    if (!styleFor(abs)) continue
    total++
    const text = readFileSync(abs, 'utf8')
    const hasPayload = INVISIBLE_RE.test(text)
    const hasBannerText = text.includes(BANNER_ID)
    if (hasPayload) marked++
    else if (hasBannerText) {
      residue++ // 残迹: 只有横幅文本、载荷已丢失,水印形同虚设
      residues.push(relative(ROOT, abs).replaceAll('\\', '/'))
    } else missing.push(relative(ROOT, abs).replaceAll('\\', '/'))
  }
  console.log(`[watermark:verify] 覆盖 ${marked}/${total} 个文件, 残迹(载荷丢失) ${residue} 个, 跳过 ${skipped} 个`)
  if (residue) {
    console.log(`残迹文件 ${residue} 个(需 clean 后重新注入), 示例(前 15):`)
    residues.slice(0, 15).forEach((f) => console.log('  - ' + f))
  }
  if (missing.length) {
    console.log(`未覆盖 ${missing.length} 个, 示例(前 30):`)
    missing.slice(0, 30).forEach((f) => console.log('  - ' + f))
    process.exitCode = 1
  } else if (!residue) {
    console.log('全部源文件均已携带完整溯源水印。')
  }
}

// ---------- 主流程 ----------
const [cmd, target] = process.argv.slice(2)

if (cmd === 'inject') {
  let n = 0, done = 0, skip = 0
  for (const abs of walk(ROOT)) {
    if (SKIP_FILES.has(basename(abs))) continue
    if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
    const r = injectFile(abs)
    if (r === 'injected') n++
    else if (r === 'skip-done') done++
    else skip++
  }
  console.log(`[watermark:inject] 新注入 ${n} 个, 已有 ${done} 个, 跳过(类型/二进制) ${skip} 个`)
} else if (cmd === 'verify') {
  verifyAll()
} else if (cmd === 'decode') {
  if (!target || !existsSync(target)) {
    console.error('用法: node scripts/watermark.mjs decode <file>')
    process.exit(1)
  }
  const marks = findMarks(readFileSync(target, 'utf8'))
  if (!marks.length) console.log('未发现隐写水印')
  else marks.forEach((m) => console.log('解码: ' + m))
} else if (cmd === 'clean') {
  if (!target || !existsSync(target)) {
    console.error('用法: node scripts/watermark.mjs clean <file>')
    process.exit(1)
  }
  cleanFile(target)
  console.log('已移除该文件水印')
} else if (cmd === 'clean-all') {
  let n = 0
  for (const abs of walk(ROOT)) {
    if (SKIP_FILES.has(basename(abs))) continue
    if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
    const t = readFileSync(abs, 'utf8')
    if (!t.includes(BANNER_ID) && !INVISIBLE_RE.test(t)) continue
    cleanFile(abs)
    n++
  }
  console.log(`[watermark:clean-all] 已清理 ${n} 个文件的水印`)
} else {
  console.log('用法: node scripts/watermark.mjs <inject|verify|decode|clean|clean-all> [file]')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
