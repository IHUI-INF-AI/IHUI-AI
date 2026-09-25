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
 *   node scripts/watermark.mjs inject [file...]   # 注入水印(幂等: 已注入且载荷完整则跳过; 残迹/载荷损坏先清洗再重注); 省略 file 则全树注入
 *   node scripts/watermark.mjs verify [file...]   # 校验覆盖率 + **载荷可解码性**(未覆盖/残迹/载荷损坏 均 exit 1)
 *   node scripts/watermark.mjs list-uncovered     # 列出 载荷损坏 + 残迹 + 未覆盖(供批量修复管道消费)
 *   node scripts/watermark.mjs decode <file>      # 解码指定文件中的隐写内容
 *   node scripts/watermark.mjs clean <file>       # 移除指定文件的水印(仅限版权所有者自查用)
 *
 * verify / list-uncovered 的判定口径 = `git ls-files` ∩ 可注入类型(见 scanCoverage)
 *   **减去**来源台账已登记的第三方内容(`config/third-party-provenance/*.json` 的 roots,
 *   经 scripts/lib/third-party-roots.mjs 单点解析)。横幅是归属主张,不得打到第三方作品上;
 *   这些文件不是"没人管",而是改由 scripts/provenance-ledger.mjs 的 P8「归属反噬」审计。
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createExclusionPredicate, LedgerUnavailable } from './lib/third-party-roots.mjs'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')

/**
 * 已登记第三方内容的排除面(scripts/lib/third-party-roots.mjs 是唯一来源)。
 *
 * 惰性求值 + 缓存:一次 `git ls-files`,且 `decode` / `clean <file>` 这类不关心排除面的
 * 子命令不必派生 git。取不到时**大声失败**:排除面算不出来就按"没有第三方内容"继续跑,
 * 等于让自愈式门禁往 Apache-2.0 许可原文里插横幅 —— 那是本层存在的理由反过来的事故。
 */
let _excl
function exclusion() {
  if (!_excl) {
    try {
      _excl = createExclusionPredicate(ROOT)
    } catch (e) {
      const why = e instanceof LedgerUnavailable ? e.message : String(e?.message ?? e)
      console.error(`[watermark] 第三方排除面无法判定:${why.split('\n')[0]}`)
      console.error('  水印层拒绝在算不出"哪些是已登记第三方内容"时继续判定(既不冒绿也不冒红)。')
      console.error('  请先修 config/third-party-provenance/*.json 或 git 可用性,再重跑。')
      process.exit(1)
    }
  }
  return _excl
}

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
          .join(''),
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
        String.fromCharCode(parseInt([...cu].map((b) => (b === ZWNJ ? '1' : '0')).join(''), 2)),
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
  '.ts': 'slash',
  '.tsx': 'slash',
  '.js': 'slash',
  '.jsx': 'slash',
  '.mjs': 'slash',
  '.cjs': 'slash',
  '.mts': 'slash',
  '.cts': 'slash',
  '.go': 'slash',
  '.java': 'slash',
  '.rs': 'slash',
  '.kt': 'slash',
  '.kts': 'slash',
  '.swift': 'slash',
  '.c': 'slash',
  '.h': 'slash',
  '.cpp': 'slash',
  '.hpp': 'slash',
  '.cc': 'slash',
  '.scala': 'slash',
  '.dart': 'slash',
  '.scss': 'slash',
  '.sass': 'slash',
  '.less': 'slash',
  // 注意:.vue/.svelte/.astro 首行是 <template>/<script>,插 // 行注释会被编译器当模板文本,故不映射(跳过)
  '.py': 'hash',
  '.sh': 'hash',
  '.bash': 'hash',
  '.zsh': 'hash',
  '.fish': 'hash',
  '.yml': 'hash',
  '.yaml': 'hash',
  '.toml': 'hash',
  '.rb': 'hash',
  '.ini': 'hash',
  '.conf': 'hash',
  '.cfg': 'hash',
  '.env': 'hash',
  '.properties': 'hash',
  '.ps1': 'hash',
  '.psm1': 'hash',
  '.pl': 'hash',
  '.r': 'hash',
  '.lua': 'hash',
  '.css': 'block',
  '.jsonc': 'block',
  '.html': 'html',
  '.htm': 'html',
  '.xml': 'html',
  '.md': 'html',
  '.markdown': 'html',
  '.sql': 'sql',
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  '.pnpm',
  'target',
  '.cache',
  '.vercel',
  'storybook-static',
  '_.husky',
  '_husky',
  '.husky/_',
  '.nyc_output',
  '.gradle',
  '.idea',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  // ⚠️ `'vendor'` 是**目录名巧合**,不是第三方排除机制:它只是让
  // apps/desktop/src-tauri/vendor/tray-icon-0.24.2/ 碰巧幸免。第三方排除的唯一出口是台账 roots
  // (见 exclusion() / scripts/lib/third-party-roots.mjs),与本条无关,摘掉本条也不得改变
  // 已登记第三方路径的排除结论。留着是因为未登记的 vendor/** 仍属"拿了没登记"(P2 的地盘)。
  'vendor',
  'expo/dist',
  '.expo',
  // 与 check-watermark-syntax.mjs SKIP_DIRS 对齐: 构建/本地产物不纳入水印覆盖
  'tmp',
  'playwright-report',
  'test-results',
  'vs',
  '.next-static',
  // WXT 扩展框架的生成目录(.gitignore 已忽略, 无源码, 否则本地 verify 假阳性)
  '.wxt',
  '.cxx',
  'CMakeFiles',
  '.externalNativeBuild',
  '.cmake',
])

const SKIP_FILES = new Set([
  'pnpm-lock.yaml',
  'uv.lock',
  'yarn.lock',
  'package-lock.json',
  'bun.lockb',
  'Cargo.lock',
  'poetry.lock',
  'go.sum',
  '.gitignore',
  '.dockerignore',
  '.npmignore',
  '.prettierignore',
  '.gitattributes',
  '.editorconfig',
  '.actrc',
  '.prettierrc',
  '.eslintignore',
  '.env',
  '.env.local',
  '.env.production',
])

const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.bmp',
  '.avif',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.7z',
  '.rar',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.wasm',
  '.mp4',
  '.mp3',
  '.wav',
  '.ogg',
  '.mov',
  '.webm',
  '.db',
  '.sqlite',
  '.sqlite3',
  '.lock',
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
  // 已登记第三方内容一律不注入:横幅是**归属主张**,往 Mozilla/Cargo 分发的文件上打它
  // 等于把别人的作品声明成自己的(2026-09-25 实测 pdf.worker.min.mjs 的前 3 行即此事故)。
  // 放在 isBinary/styleFor 之后、任何写入之前;连"显式点名注入"也拒(见主流程 exit 1)。
  const relOfTarget = relative(ROOT, absPath).replaceAll('\\', '/')
  if (exclusion().isExcluded(relOfTarget)) return 'skip-third-party'
  const buf = readFileSync(absPath)
  if (isBinary(buf)) return 'skip-binary'
  let text = buf.toString('utf8').replace(/^\uFEFF/, '') // strip BOM, 避免 shebang 检测失败
  // 载荷存在**且可解码** → 已完成(幂等跳过)
  if (INVISIBLE_RE.test(text) && payloadIntact(text)) return 'skip-done'
  // 注意: 本工具自身源码包含横幅常量定义, clean 会"自噬", 故跳过自身
  if (absPath === fileURLToPath(import.meta.url)) return 'skip-self'
  // 残迹态(只有横幅文本、载荷被剥离)与**载荷损坏**(存在但解码不符)统一走清洗重注。
  // 2026-09-22 补第三类触发:横幅文本存在但**从未有过载荷**(裸两行版权头)。旧实现只在
  // "见到 BANNER_ID 或零宽字符"时才清洗 ⇒ 这类文件被直接前置一条新横幅,留下**双横幅**,
  // 而此后载荷已完整 ⇒ 恒走 skip-done ⇒ 重复头永久冻结(实测 141 个已跟踪文件,119 个已入 main)。
  if (text.includes(BANNER_ID) || INVISIBLE_RE.test(text) || text.split('\n').some(isBannerLine)) {
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
  // 正文若已以空行起始,横幅后不再补分隔空行 → clean→inject 往返零漂移
  const sep = text.startsWith('\n') ? '' : '\n'
  const body = (shebang + xmlDecl + banner + sep + text).replace(/\r?\n$/, '')
  const out = body + '\n' + tail
  writeFileSync(absPath, out, 'utf8')
  return 'injected'
}

// 横幅行形态:剥掉行首注释前缀(// # --)后按**行首锚定**判定,
// 避免误伤源码里出现的 BANNER_ID 常量 / 正则定义(如 check-watermark-syntax.mjs)。
// 版权行必须带 ` (智汇AI)` 品牌段:2026-09-22 实测 `apps/api/scripts/verify-carrier.ts`
// 的说明行 `// © 2026 IHUI AI · 运营商一键登录后端集成自检…` 会被旧锚整行删除。
const BANNER_TEXT_RE =
  /^(?:©\s*\d{4}\s+IHUI\s+AI\s*\(智汇AI\)|Provenance-watermarked(?:\.|\s)|\[IHUI-AI-PROVENANCE\]\s*:)/
function isBannerLine(line) {
  return BANNER_TEXT_RE.test(line.trim().replace(/^\s*(\/\/|#|--)\s*/, ''))
}

/** 提取文本内全部零宽载荷片段 */
function extractMarks(text) {
  return text.match(new RegExp(`${SENTINEL}[${ZWSP}${ZWNJ}${ZWJ}]+${SENTINEL}`, 'g')) ?? []
}

/**
 * 载荷是否**完整可解码**(而非仅"存在")。
 *
 * 背景: U+200B / U+200C / U+200D / U+2060 属 Unicode Cf 类不可见字符, 会被
 * 文本级工具(reflow、空白归一、正则替换、sed -i、编辑器编码往返)改写 ——
 * 改写后 `INVISIBLE_RE` 仍能命中, 但解码结果是垃圾(如 `PROVENCE-2026`、
 * `IHUHU-AI`、`IIUIUIUI-AI`、混入控制字符)。
 * 旧版只验"存在性", 使 144 个已跟踪文件的载荷静默损坏而无人察觉。
 */
function payloadIntact(text) {
  const marks = extractMarks(text)
  return marks.length > 0 && marks.every((m) => decodePayload(m) === WATERMARK_TEXT)
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
    if (!inBanner && /^\s*(\/\*|<!--)\s*$/.test(line) && isBannerLine(next)) {
      inBanner = true
      continue
    }
    // 命中横幅内容行(行首锚定:版权行 / 溯源声明 / [ID]: 载荷行)→ 整块跳过
    if (isBannerLine(line)) {
      inBanner = true
      continue
    }
    // 横幅块的关闭符(*/ 或 -->)紧随其后 → 一并吞掉,避免留下未闭合注释
    if (inBanner && /^\s*(\*\/|-->)\s*$/.test(line)) {
      inBanner = false
      continue
    }
    inBanner = false
    // 删除含隐写载荷的行。三种形态都必须命中:
    //   ① 标准载荷 INVISIBLE_MARK(精确匹配)
    //   ② 任意裸零宽行(无注释前缀)
    //   ③ **带注释前缀的裸载荷行**(如 `// <零宽串>`,文件尾水印的常见形态)。
    // ③ 是 2026-09-14 实测的漏网形态:尾部水印被文本工具改写为「载荷损坏」
    // (解码得 `PBOVENANCE` 等)后,既不等于 INVISIBLE_MARK,剥掉 `//` 后又匹配不上
    // BANNER_TEXT_RE,于是清洗后残留在文件中部 → payloadIntact 的 every() 恒假 →
    // 覆盖率守门自愈失败。此处按「剥注释前缀后仅剩零宽字符」统一识别。
    const bare = line
      .trim()
      .replace(/^(\/\/|#|--|\/\*|\*)\s*/, '')
      .replace(/(\*\/|-->)\s*$/, '')
      .trim()
    if (line.includes(INVISIBLE_MARK) || /^[\u200b\u200c\u200d\u2060]+$/.test(bare)) continue
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

/**
 * 水印判定口径的文件集合 = `git ls-files`(与 check-watermark-coverage.mjs 同一份集合)。
 *
 * verify 此前走 walk(ROOT) 全树遍历, 只按 SKIP_DIRS 猜、不认 .gitignore, 于是把
 * `.ihui-agent/**` 等本机未跟踪产物一并计入 → 本机恒报 2000+ 缺口而 CI 恒绿,
 * 把每个本地核验的 agent 引向"仓库有几千个水印问题"的错觉(AGENTS §5c 口径是"只统计 git 跟踪文件")。
 * 用 `-z`: 默认输出会按 core.quotePath 把非 ASCII 文件名转义成八进制串, 那种路径永远对不上真实文件。
 */
function gitTrackedFiles() {
  let out
  try {
    out = execFileSync('git', ['-c', 'safe.directory=*', 'ls-files', '-z'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    })
  } catch (e) {
    console.error(`[watermark] 取不到 git 跟踪清单: ${String(e?.message ?? e).split('\n')[0]}`)
    console.error('  水印口径以 `git ls-files` 为准; 清单缺失时绝不按"已覆盖"放行。')
    process.exit(1)
  }
  return out
    .split('\0')
    .map((s) => s.trim())
    .filter(Boolean)
}

// walk() 是按目录名剪枝的, 跟踪清单必须同样排除: 已跟踪的第三方目录
// (apps/desktop/src-tauri/vendor/**) 一旦不再排除就凭空多出假缺口。
function underSkipDir(rel) {
  const dirs = rel.split('/').slice(0, -1)
  return dirs.some((seg) => SKIP_DIRS.has(seg))
}

/** 显式传参时按参数收窄范围, 不留"传了参数却静默跑全局"的误导 */
function scopeFromArgs(args) {
  return args.map((a) => {
    const abs = [resolve(process.cwd(), a), resolve(ROOT, a)].find(
      (p) => existsSync(p) && statSync(p).isFile(),
    )
    if (!abs) {
      console.error(`[watermark] 找不到可校验的文件(需为已存在的普通文件): ${a}`)
      process.exit(1)
    }
    return relative(ROOT, abs).replaceAll('\\', '/')
  })
}

function scanCoverage(scope) {
  let total = 0,
    marked = 0,
    residue = 0,
    skipped = 0,
    thirdParty = 0
  const missing = []
  const residues = []
  const corrupted = []
  const excluded = []
  const excl = exclusion()
  const candidates = scope ?? gitTrackedFiles().filter((rel) => !underSkipDir(rel))
  for (const rel of candidates) {
    const abs = join(ROOT, rel)
    if (SKIP_FILES.has(basename(abs))) continue
    if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
    if (!styleFor(abs)) continue
    // 台账登记的第三方内容**从分母里移出**,但不是"看不见":它改由 provenance-ledger 的
    // P8「归属反噬」按同一份 roots 审计(有我方横幅 ⇒ 判红)。水印层与台账层在此交接,
    // 谁都不许既不管又不报数,故 excluded 原样回传并打印条数。
    // 显式传参(scope 非空)同样适用:否则 `verify <第三方文件>` 会凭空报一个假缺口,
    // 而自愈式门禁就会照着它去 inject —— 那正是本次要根除的动作。
    if (excl.isExcluded(rel)) {
      thirdParty++
      excluded.push(rel)
      continue
    }
    // 已跟踪但工作区无此文件(并行会话删文件未提交 / 部分 checkout): 无从校验, 不计入分母
    if (!existsSync(abs)) {
      skipped++
      continue
    }
    total++
    const text = readFileSync(abs, 'utf8')
    const hasPayload = INVISIBLE_RE.test(text)
    const hasBannerText = text.includes(BANNER_ID)
    if (hasPayload && payloadIntact(text)) marked++
    else if (hasPayload) {
      corrupted.push(rel) // 载荷存在但已损坏
    } else if (hasBannerText) {
      residue++ // 残迹: 只有横幅文本、载荷已丢失,水印形同虚设
      residues.push(rel)
    } else missing.push(rel)
  }
  return { total, marked, residue, skipped, missing, residues, corrupted, thirdParty, excluded }
}

function verifyAll(scope) {
  const { total, marked, residue, skipped, missing, residues, corrupted, thirdParty, excluded } =
    scanCoverage(scope)
  console.log(
    `[watermark:verify] 覆盖 ${marked}/${total} 个${scope ? '指定' : '已跟踪'}文件, 残迹(载荷丢失) ${residue} 个, 载荷损坏 ${corrupted.length} 个, 跳过 ${skipped} 个, 台账登记的第三方内容不计入 ${thirdParty} 个`,
  )
  // 排除面必须可见:静默少算 N 个文件与"根本没有第三方内容"在输出上无法区分,
  // 而后者会让人以为门禁从未碰过第三方(它碰过,见 pdf.worker.min.mjs 事故)。
  if (thirdParty > 0) {
    console.log(`  已登记第三方(改由 provenance-ledger P8 审计归属反噬),示例(前 10):`)
    excluded.slice(0, 10).forEach((f) => console.log('  · ' + f))
    if (excluded.length > 10) console.log(`  · … 其余 ${excluded.length - 10} 个`)
  }
  if (residue) {
    console.log(`残迹文件 ${residue} 个(需 clean 后重新注入), 示例(前 15):`)
    residues.slice(0, 15).forEach((f) => console.log('  - ' + f))
  }
  if (corrupted.length) {
    console.log(`载荷损坏 ${corrupted.length} 个(存在但解码不符, 需重新 inject), 示例(前 15):`)
    corrupted.slice(0, 15).forEach((f) => console.log('  - ' + f))
    process.exitCode = 1
  }
  if (missing.length) {
    console.log(`未覆盖 ${missing.length} 个, 示例(前 30):`)
    missing.slice(0, 30).forEach((f) => console.log('  - ' + f))
    process.exitCode = 1
  } else if (!residue && !corrupted.length) {
    console.log('纳入口径的文件均已携带完整溯源水印。')
  }
}

// ---------- 主流程 ----------
const [cmd, ...rest] = process.argv.slice(2)
const target = rest[0]

if (cmd === 'inject') {
  // 文件模式: inject <file>...(与 usage 声明一致;残迹文件会先内部 clean 再注入)
  if (rest.length) {
    for (const t of rest) {
      const abs = resolve(t)
      if (!existsSync(abs)) {
        console.error(`文件不存在: ${t}`)
        process.exitCode = 1
        continue
      }
      const r = injectFile(abs)
      console.log(`[watermark:inject] ${relative(ROOT, abs).replaceAll('\\', '/')} → ${r}`)
      // 'skip-third-party' 也计红:有人(或某个生成器)显式点名要把横幅打进已登记的
      // 第三方内容,这是一次需要被看见的拒绝,不是一次静默的"好的已经处理完了"。
      if (r === 'skip-type' || r === 'skip-binary' || r === 'skip-third-party') process.exitCode = 1
    }
  } else {
    let n = 0,
      done = 0,
      skip = 0,
      tp = 0
    for (const abs of walk(ROOT)) {
      if (SKIP_FILES.has(basename(abs))) continue
      if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
      const r = injectFile(abs)
      if (r === 'injected') n++
      else if (r === 'skip-done') done++
      else if (r === 'skip-third-party') tp++
      else skip++
    }
    console.log(
      `[watermark:inject] 新注入 ${n} 个, 已有 ${done} 个, 跳过(类型/二进制) ${skip} 个, 台账登记的第三方内容未触碰 ${tp} 个`,
    )
  }
} else if (cmd === 'verify') {
  verifyAll(rest.length ? scopeFromArgs(rest) : null)
} else if (cmd === 'list-uncovered') {
  // 供批量修复管道消费: 先损坏后残迹再未覆盖, 每行一个相对路径
  const { missing, residues, corrupted } = scanCoverage(rest.length ? scopeFromArgs(rest) : null)
  ;[...corrupted, ...residues, ...missing].forEach((f) => console.log(f))
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
  console.log(
    '用法: node scripts/watermark.mjs <inject|verify|list-uncovered|decode|clean|clean-all> [file...]',
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
