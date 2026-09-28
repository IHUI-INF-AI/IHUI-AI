// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * IHUI AI (智汇AI) 溯源署名工具 —— **v2:纯可见横幅,不再写入任何零宽字符**
 *
 * 用途: 为仓库内文本源文件维护可见的版权/许可署名(署名即溯源)。
 *
 * 形态史:
 *   v1(2026-09-12 ~ 2026-09-28)三层水印:
 *     L1 可见版权声明 —— 文件顶部两行注释横幅
 *     L2 零宽字符隐写 —— 横幅第三行 `[IHUI-AI-PROVENANCE]:<ZW>`(ZWSP/ZWNJ/ZWJ 编码)
 *     L3 独立隐形标记 —— 文件末尾一行仅含零宽字符的注释行
 *   v2(本文件产出的唯一形态)**只有 L1 两行**,无 L2、无 L3、无零宽字符。
 *     立因:外部审计点名"每个源文件里嵌零宽字符 ⇒ 企业用户与外部贡献者看到即放弃",
 *     而许可证已收口为纯 Apache-2.0 ⇒ 旧第二行"未授权商用可被溯源追责"的措辞与许可证
 *     自相矛盾。隐写既不构成法律要件、又把仓库变成"自带不可见字符"的异形交付物。
 *
 * 兼容矩阵(旧形态一律**可见、可升级、不判红** —— 与任何提交都无关的恒红门只会逼并行会话
 * 跳钩子、连带约 190 道守门一起作废,AGENTS §12e 反复记过这一型):
 *   current        = 两行 v2 横幅 ∧ 无水印零宽载荷        → 已达标
 *   legacy         = 带 v1 零宽载荷(可解码)              → 待升级,只报数,不 exit 1,不自愈
 *   legacy-corrupt = 带 v1 零宽载荷但解码不符(历史 144 文件事故) → 同上,只报数
 *   missing        = 既无 v1 载荷也无 v2 横幅              → 缺口,exit 1 + 可自愈注入
 *   注:剥掉载荷后的文件在 v2 眼里就是 `current`(v1 的"残迹"档在 v2 是合法终态),
 *   所以"旧格式被静默放过"与"新格式被静默判红"两种失效都不存在 —— 两者各有一条自检钉住。
 *
 * 用法:
 *   node scripts/watermark.mjs inject [file...]   # 注入/升级 v2 横幅(幂等;旧格式 → 清洗重写为 v2)
 *   node scripts/watermark.mjs verify [file...]   # 校验:missing 判红;legacy 只报数并给出口
 *   node scripts/watermark.mjs list-uncovered     # 只列缺口(missing),供自愈门禁消费
 *   node scripts/watermark.mjs list-legacy        # 只列待升级旧格式,供批量剥离器消费
 *   node scripts/watermark.mjs decode <file>      # 解码 v1 隐写(无载荷时明说"v2 无隐写",不报错)
 *   node scripts/watermark.mjs clean <file>       # 移除署名横幅(版权所有者自查用)
 *   node scripts/watermark.mjs clean-all          # 同上,全树
 *
 * verify / list-* 的判定口径 = `git ls-files` ∪ 未跟踪未忽略 ∩ 可注入类型
 *   (唯一实现 `scripts/lib/watermark-scope.mjs`)
 *   **减去**来源台账已登记的第三方内容(`config/third-party-provenance/*.json` 的 roots,
 *   经 scripts/lib/third-party-roots.mjs 单点解析)。横幅是归属主张,不得打到第三方作品上;
 *   这些文件不是"没人管",而是改由 scripts/provenance-ledger.mjs 的 P8「归属反噬」审计。
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { createExclusionPredicate, LedgerUnavailable } from './lib/third-party-roots.mjs'
import { coverageFileSet } from './lib/watermark-scope.mjs'

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

// ---------- 署名配置 ----------
/** v1 隐写载荷的明文(仅用于**识别与解码**旧形态,v2 不再产出它) */
const WATERMARK_TEXT = 'IHUI-AI·智汇AI·李春川·LC·aizhs.top·PROVENANCE-2026'
const BANNER_ID = 'IHUI-AI-PROVENANCE'
/** v2 唯一产出的两行横幅:版权 + 归属 URL + 许可 + Provenance-watermarked 署名标记。 */
const BANNER_LINES = [
  '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
  'Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。',
]
/**
 * v1 的横幅文本(只读识别用)。第二行含"未授权商用可被溯源追责" —— 与纯 Apache-2.0
 * 许可证冲突,是本轮收口的对象。第一行**逐字未改**,所以任何按 `© YYYY IHUI AI (智汇AI)`
 * 锚定的既有判据(双横幅巡检 / P8 归属反噬 / check-watermark-syntax)不受影响。
 */
const LEGACY_BANNER_LINES = [
  '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
  'Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。',
]

// ---------- 零宽字符编解码(仅用于识别/解码/升级 v1) ----------
const ZWSP = '\u200b' // 0
const ZWNJ = '\u200c' // 1
const ZWJ = '\u200d' // 字符分隔
const SENTINEL = '\u2060' // 起止哨兵 (Word Joiner, 不可见)
const ALL_ZW_RE = new RegExp(`[${ZWSP}${ZWNJ}${ZWJ}${SENTINEL}]`, 'g')

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
/** `[IHUI-AI-PROVENANCE]:` 载荷行(块/HTML 风格下行首只有缩进)。 */
const PAYLOAD_LINE_RE = new RegExp(`^\\s*(?://|#|--|\\*)?\\s*\\[${BANNER_ID}\\]\\s*:`)
/** 剥掉注释包装后仅剩零宽的整行(L3 尾行五种风格同视)。 */
const OPEN_RE = /^(?:\/\/|#|--|\/\*|<!--)\s*/
const CLOSE_RE = /\s*(?:\*\/|-->)$/
const ONLY_ZW_RE = new RegExp(`^[${ZWSP}${ZWNJ}${ZWJ}${SENTINEL}\\s]*$`)

function zwCount(text) {
  return (text.match(ALL_ZW_RE) || []).length
}

/** 整行是否"只有载荷":剥注释包装后仅剩零宽字符,且至少含一个。 */
function isPureZwLine(line) {
  if (!line || zwCount(line) === 0) return false
  const bare = line.trim().replace(OPEN_RE, '').replace(CLOSE_RE, '').trim()
  return bare.length > 0 && ONLY_ZW_RE.test(bare)
}

/** 文件里是否存在**水印形态**的零宽载荷(不含字符串字面量等内容型零宽)。 */
function hasWatermarkPayload(text) {
  if (INVISIBLE_RE.test(text)) return true
  return text.split(/\r?\n/).some((l) => PAYLOAD_LINE_RE.test(l) || isPureZwLine(l))
}

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

/**
 * v2 横幅:**只有两行可见文本**,不含任何零宽字符、不含 `[ID]:` 载荷行。
 * 形参 `extra` 保留只为兼容既有调用形态(一律忽略);v1 时代它承载零宽载荷。
 */
function makeBanner(style, extra) {
  void extra
  if (style.line) {
    return BANNER_LINES.map((l) => `${style.line} ${l}`).join('\n') + '\n'
  }
  const inner = BANNER_LINES.map((l) => `  ${l}`).join('\n')
  return `${style.open}\n${inner}\n${style.close}\n`
}

/**
 * 状态判定(单一实现,`verify` / `list-*` / `injectFile` 三处共用同一份判据)。
 * @returns {{state:'current'|'legacy'|'legacyCorrupt'|'missing', zw:number}}
 */
function classifyText(text) {
  const zw = zwCount(text)
  const payload = hasWatermarkPayload(text)
  if (payload) {
    return { state: payloadIntact(text) ? 'legacy' : 'legacyCorrupt', zw }
  }
  return { state: hasVisibleBanner(text) ? 'current' : 'missing', zw }
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
  const cls = classifyText(text)
  // v2 已达标 → 幂等跳过。**故意不看 cls.zw**:字符串字面量里的零宽属测试内容
  // (实测 apps/cli/tests/prompt-boundary.test.ts 拿 U+200B 做 sanitize 用例),
  // 若把它当"待升级"就会对别人的夹具反复重写头部。
  if (cls.state === 'current') return 'skip-done'
  const upgrading = cls.state === 'legacy' || cls.state === 'legacyCorrupt'
  // 注意: 本工具自身源码包含横幅常量定义, clean 会"自噬", 故跳过自身
  if (absPath === fileURLToPath(import.meta.url)) return 'skip-self'
  // v1 三态(带载荷 / 载荷损坏 / 只有裸横幅)统一走清洗重注 → 产出 v2。
  // 2026-09-22 补第三类触发:横幅文本存在但从未有过载荷(裸两行版权头)。旧实现只在
  // "见到 BANNER_ID 或零宽字符"时才清洗 ⇒ 这类文件被直接前置一条新横幅,留下**双横幅**,
  // 而此后恒走 skip-done ⇒ 重复头永久冻结(实测 141 个已跟踪文件,119 个已入 main)。
  if (text.includes(BANNER_ID) || zwCount(text) > 0 || text.split('\n').some(isBannerLine)) {
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
  // v2:无 L3 尾行。正文若已以空行起始,横幅后不再补分隔空行 → clean→inject 往返零漂移
  const sep = text.startsWith('\n') ? '' : '\n'
  const body = (shebang + xmlDecl + banner + sep + text).replace(/\r?\n$/, '')
  const out = body + '\n'
  writeFileSync(absPath, out, 'utf8')
  return upgrading ? 'upgraded' : 'injected'
}

// 横幅行形态:剥掉行首注释前缀(// # --)后按**行首锚定**判定,
// 避免误伤源码里出现的 BANNER_ID 常量 / 正则定义(如 check-watermark-syntax.mjs)。
// 版权行必须带 ` (智汇AI)` 品牌段:2026-09-22 实测 `apps/api/scripts/verify-carrier.ts`
// 的说明行 `// © 2026 IHUI AI · 运营商一键登录后端集成自检…` 会被旧锚整行删除。
// v1 与 v2 的第二行都以 `Provenance-watermarked` 起头 ⇒ 同一个锚同时认两代形态。
const BANNER_TEXT_RE =
  /^(?:©\s*\d{4}\s+IHUI\s+AI\s*\(智汇AI\)|Provenance-watermarked(?:\.|\s)|\[IHUI-AI-PROVENANCE\]\s*:)/
function isBannerLine(line) {
  return BANNER_TEXT_RE.test(
    String(line ?? '')
      .trim()
      .replace(/^\s*(\/\/|#|--)\s*/, ''),
  )
}

/** 首个非空行之后不远处就该看到横幅:窗口取 16 行(shebang + XML 声明 + 块注释缩进都够)。 */
function hasVisibleBanner(text) {
  return text.split(/\r?\n/, 16).some(isBannerLine)
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
 *
 * v2 语义: 这一维**只用来区分 legacy 与 legacyCorrupt**(两档都只报数、都不判红)。
 * 载荷本身已不是要求项,所以它不再有权决定退出码。
 */
function payloadIntact(text) {
  const marks = extractMarks(text)
  if (marks.length === 0) return true // 没有哨兵包裹的载荷(只有裸零宽行)⇒ 无所谓损坏
  return marks.every((m) => decodePayload(m) === WATERMARK_TEXT)
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
    if (line.includes(INVISIBLE_MARK) || isPureZwLine(line)) continue
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
 * 水印判定口径的文件集合 = `scripts/lib/watermark-scope.mjs` 的那一份实现
 * (已跟踪 ∪ 未跟踪但未忽略)。
 *
 * verify 此前走 walk(ROOT) 全树遍历, 只按 SKIP_DIRS 猜、不认 .gitignore, 于是把
 * `.ihui-agent/**` 等本机未跟踪产物一并计入 → 本机恒报 2000+ 缺口而 CI 恒绿,
 * 把每个本地核验的 agent 引向"仓库有几千个水印问题"的错觉(AGENTS §5c 口径是"只统计 git 跟踪文件")。
 * 后来又发现分母窄了一格(G-253):**还没进索引的新文件**与"整文件重写后尚未 add"的文件
 * 在盘上真实存在、会被下一次提交带进仓库,却对两把尺子都不存在 —— 于是"漏盖横幅"这件事
 * 恰好发生在最需要的时刻。现在两处共用同一份集合并都并上未跟踪面(`--exclude-standard`
 * 继续让 .gitignore 挡产物)。用 `-z`: 默认输出会按 core.quotePath 把非 ASCII 文件名
 * 转义成八进制串, 那种路径永远对不上真实文件。
 */
function gitTrackedFiles() {
  const { files, error } = coverageFileSet({ root: ROOT })
  if (error) {
    console.error(`[watermark] ${error}`)
    console.error('  水印口径以 git 清单为准; 清单缺失时绝不按"已覆盖"放行。')
    process.exit(1)
  }
  return files
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
    current = 0,
    legacy = 0,
    legacyCorrupt = 0,
    skipped = 0,
    thirdParty = 0,
    zwTotal = 0
  const missing = []
  const legacies = []
  const corrupt = []
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
    const { state, zw } = classifyText(readFileSync(abs, 'utf8'))
    zwTotal += zw
    if (state === 'current') current++
    else if (state === 'legacy') {
      legacy++
      legacies.push(rel)
    } else if (state === 'legacyCorrupt') {
      legacyCorrupt++
      corrupt.push(rel)
    } else missing.push(rel)
  }
  return {
    total,
    current,
    legacy,
    legacyCorrupt,
    skipped,
    missing,
    legacies,
    corrupt,
    thirdParty,
    excluded,
    zwTotal,
  }
}

function verifyAll(scope) {
  const r = scanCoverage(scope)
  console.log(
    `[watermark:verify v2] 纳入 ${r.total} 个${scope ? '指定' : '口径内'}文件 → v2 已达标 ${r.current} 个 / ` +
      `v1 待升级 ${r.legacy} 个(其中载荷损坏 ${r.legacyCorrupt})/ 未覆盖 ${r.missing.length} 个 / ` +
      `跳过 ${r.skipped} 个 / 台账登记的第三方内容不计入 ${r.thirdParty} 个`,
  )
  console.log(
    `  零宽字符实数:口径内文件合计 ${r.zwTotal} 个(其中待升级文件贡献的部分由下方剥离器一次清干净)`,
  )
  // 排除面必须可见:静默少算 N 个文件与"根本没有第三方内容"在输出上无法区分,
  // 而后者会让人以为门禁从未碰过第三方(它碰过,见 pdf.worker.min.mjs 事故)。
  if (r.thirdParty > 0) {
    console.log(`  已登记第三方(改由 provenance-ledger P8 审计归属反噬),示例(前 10):`)
    r.excluded.slice(0, 10).forEach((f) => console.log('  · ' + f))
    if (r.excluded.length > 10) console.log(`  · … 其余 ${r.excluded.length - 10} 个`)
  }
  // **待升级只报数、不判红**:它是迁移期存量,与任何单次提交都无关。当场判红就是一台
  // 恒红门,唯一结局是每个并行会话各走一次应急跳门、连带全部守门作废(§12e 同型)。
  // 但也不许静默:数量 + 示例 + 出口三件齐全,才不至于被读成"什么都没查出"。
  if (r.legacy + r.legacyCorrupt > 0) {
    console.log(
      `  v1 待升级 ${r.legacy + r.legacyCorrupt} 个(带零宽载荷;**不判红**,升级出口:` +
        `node scripts/watermark-strip-payload.mjs --dry-run / --apply,或逐文件 inject):`,
    )
    ;[...r.corrupt, ...r.legacies].slice(0, 15).forEach((f) => console.log('  - ' + f))
    if (r.legacyCorrupt > 0) {
      console.log(
        `    其中载荷损坏 ${r.legacyCorrupt} 个(历史 144 文件事故那一型)—— 同样只是待升级,不再是缺口`,
      )
    }
  }
  if (r.missing.length) {
    console.log(`未覆盖 ${r.missing.length} 个, 示例(前 30):`)
    r.missing.slice(0, 30).forEach((f) => console.log('  - ' + f))
    process.exitCode = 1
  } else {
    console.log('✅ 无未覆盖缺口:纳入口径的文件均已携带可见署名横幅(v1 载荷待升级的不算缺口)。')
  }
}

// ---------- 主流程 ----------
function main(argv) {
  const [cmd, ...rest] = argv
  const target = rest[0]

  if (cmd === 'inject') {
    // 文件模式: inject <file>...(与 usage 声明一致;旧格式文件会先内部 clean 再注入)
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
        if (r === 'skip-type' || r === 'skip-binary' || r === 'skip-third-party')
          process.exitCode = 1
      }
    } else {
      let n = 0,
        up = 0,
        done = 0,
        skip = 0,
        tp = 0
      for (const abs of walk(ROOT)) {
        if (SKIP_FILES.has(basename(abs))) continue
        if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
        const r = injectFile(abs)
        if (r === 'injected') n++
        else if (r === 'upgraded') up++
        else if (r === 'skip-done') done++
        else if (r === 'skip-third-party') tp++
        else skip++
      }
      console.log(
        `[watermark:inject] 新注入 ${n} 个, 由 v1 升级为 v2 ${up} 个, 已是 v2 ${done} 个, ` +
          `跳过(类型/二进制) ${skip} 个, 台账登记的第三方内容未触碰 ${tp} 个`,
      )
    }
  } else if (cmd === 'verify') {
    verifyAll(rest.length ? scopeFromArgs(rest) : null)
  } else if (cmd === 'list-uncovered') {
    // 供自愈门禁消费:**只列缺口(missing)**。v1 待升级不进这份清单 ——
    // 否则 11k+ 文件会同时落进自愈集合,既顶爆单次缺口安全闸,又等于在别人的提交里
    // 顺手做一次全仓改写(那才是真正的恒红门成因)。
    const r = scanCoverage(rest.length ? scopeFromArgs(rest) : null)
    r.missing.forEach((f) => console.log(f))
    // 统计行走**同一条 stdout**(以 # 开头,消费方按前缀分流):门禁不必为了拿"还剩多少
    // 待升级"再全量扫一遍 11.5k 文件 —— 两次扫描之间仓库可能已被并发会话推进,那会把
    // 判据的输入拆成两个时刻(本仓"同面同轮"那条规矩的同一型)。
    console.log(
      '#watermark-stats ' +
        JSON.stringify({
          total: r.total,
          current: r.current,
          legacy: r.legacy,
          legacyCorrupt: r.legacyCorrupt,
          missing: r.missing.length,
          zwTotal: r.zwTotal,
          thirdParty: r.thirdParty,
        }),
    )
  } else if (cmd === 'list-legacy') {
    const { legacies, corrupt } = scanCoverage(rest.length ? scopeFromArgs(rest) : null)
    ;[...corrupt, ...legacies].forEach((f) => console.log(f))
  } else if (cmd === 'decode') {
    if (!target || !existsSync(target)) {
      console.error('用法: node scripts/watermark.mjs decode <file>')
      process.exit(1)
    }
    const text = readFileSync(target, 'utf8')
    const marks = findMarks(text)
    if (!marks.length) {
      console.log(
        `未发现 v1 隐写水印(零宽字符 ${zwCount(text)} 个${zwCount(text) ? ' ⇒ 属内容型零宽,不是水印载荷' : ''})—— v2 横幅为可见署名,无隐写层`,
      )
    } else {
      marks.forEach((m) => console.log('解码: ' + m))
    }
  } else if (cmd === 'clean') {
    if (!target || !existsSync(target)) {
      console.error('用法: node scripts/watermark.mjs clean <file>')
      process.exit(1)
    }
    cleanFile(target)
    console.log('已移除该文件署名横幅')
  } else if (cmd === 'clean-all') {
    let n = 0
    for (const abs of walk(ROOT)) {
      if (SKIP_FILES.has(basename(abs))) continue
      if (BINARY_EXT.has(extname(abs).toLowerCase())) continue
      const t = readFileSync(abs, 'utf8')
      if (!t.includes(BANNER_ID) && !INVISIBLE_RE.test(t) && !hasVisibleBanner(t)) continue
      cleanFile(abs)
      n++
    }
    console.log(`[watermark:clean-all] 已清理 ${n} 个文件的署名横幅`)
  } else {
    console.log(
      '用法: node scripts/watermark.mjs <inject|verify|list-uncovered|list-legacy|decode|clean|clean-all> [file...]',
    )
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main(process.argv.slice(2))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

/**
 * §22c 镜像出口:`watermark-strip-payload.mjs` 与本门的测试**共用这一份**横幅文本与
 * 跳过规则。第二份真相正是本仓记过最多次的失守形态(两处算同一件事必漂移)。
 */
export const __test__ = {
  BANNER_ID,
  WATERMARK_TEXT,
  BANNER_LINES,
  LEGACY_BANNER_LINES,
  SKIP_DIRS,
  SKIP_FILES,
  BINARY_EXT,
  EXT_MAP,
  INVISIBLE_MARK,
  INVISIBLE_RE,
  PAYLOAD_LINE_RE,
  ALL_ZW_RE,
  encodePayload,
  decodePayload,
  classifyText,
  hasVisibleBanner,
  hasWatermarkPayload,
  isPureZwLine,
  isBannerLine,
  payloadIntact,
  zwCount,
  styleFor,
  makeBanner,
  scanCoverage,
}
