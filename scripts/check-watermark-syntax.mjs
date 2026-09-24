#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-watermark-syntax.mjs — 溯源水印语法门禁(2026-09-03 P1 落地 / 2026-09-24 判据缺陷修复)
 *
 * 本门只问一件事:**被注入的水印内容会不会把文件语法弄坏**(watermark.mjs 早期版本曾把
 * 裸 `© 2026...` 文本行插进 .kt/.java/.xml,并把 L3 尾行写成裸零宽字符 → 编译直接报错)。
 *
 *   R1  任何含零宽载荷(U+200B / U+200C / U+200D / U+2060)或横幅文本的行必须落在**注释**里
 *       (行注释 / 块注释 / HTML 注释,含行尾 `code // <载荷>` 这种内联形态)
 *   R2  .xml 若含 `<?xml` 声明,必须是文件第一个非空行,且横幅不得在其之前
 *
 * ── 2026-09-24 修复(接线前必须先修,否则每次提交必红)────────────────────────
 * 真仓全量实测 exit 1 / 26 处违规,其中 **26 处全是判据缺陷造成的红点,真存量债 0 条**:
 *
 *  1. **取材面跟着磁盘走** → 22 处落在被 .gitignore 的本地产物上(`.trae/bundle-check*.js`
 *     15 处 + `apps/mobile-cap/.../_next/static/chunks/*.js` 7 处)。这些文件在干净
 *     checkout / CI 里根本不存在,却在共享工作区永远存在 ⇒ 接线即恒红。同型病灶先例:
 *     守门 `check-pwsh-version.mjs` 在 2026-09-15 就是被同一件事坑过才修的。
 *     ⇒ 现在**清单一律来自版本树**(缺省 `git ls-tree -r --name-only HEAD`,
 *     `--staged` 取 `git diff --cached --diff-filter=ACMR`),"文件是否参与审计"由
 *     版本树决定,不再由磁盘上恰好有什么决定。
 *  2. **命中不区分语法位置** → `scripts/check-gate-wiring.mjs:171` 的
 *     `const ZERO_WIDTH_RE = /[<零宽>]/g` 命中在**正则字面量内部**,
 *     `scripts/tests/check-gate-wiring.test.mjs:137/139` 命中在**测试夹具字符串**里 ——
 *     两者都是完全合法的语法。
 *     ⇒ 引入 `maskHidden()`:先把字符串/模板字面量/正则字面量/注释区间从行里**掩掉**
 *     再匹配。**与守门 80 `check-git-read-timeout.mjs` 的 markHidden 同语义**(那边
 *     是"夹具里的 git 字符串不参与判定",这边是"夹具里的零宽不参与判定"),但本门
 *     需要按文件类型的注释符号 + 正则字面量 + 三引号串,故独立实现 ——
 *     **两处判据语义必须同步演进,改任一处都要回头核对另一处**(80 的 import 会把它
 *     的 HOT 清单/self-test 一并拉进本门,故不复用其函数而复刻其规则)。
 *  3. **和自己的注入器打架** → `apps/api/src/services/login-anomaly-notifier.ts:448`
 *     是 `} // <零宽载荷>`,即 `watermark.mjs` L3 尾行被格式化后**并到末行代码尾部**的
 *     形态;旧 R1 只认"行首注释前缀",于是本门把注入器自己的产物判红。
 *     ⇒ 内联注释同样算注释包裹(见 `maskHidden` 的行注释分支),L3 五种写法
 *     (`// x` / `# x` / `-- x` / `/* x *\/` / `<!-- x -->`)一律合法。
 *  4. **runner 在 staged 模式无条件追加 `--staged`**,而本门把 argv[2] 当文件路径
 *     ⇒ 一接线就以"文件不存在: --staged"崩掉。现真正解析该开关,语义与守门 67 一致:
 *     **清单取暂存集,内容取索引 blob(`git show :<path>`)**,绝不"名字叫 --staged
 *     但其实仍扫全工作树"(那正是本仓点名的失效形态)。
 *
 * 判据强度只增不减:掩码只会**去掉**命中,不会新增;两类真问题(R1 非注释位的裸零宽、
 * R2 `<?xml?>` 不在首位)在修后仍必红 —— 由镜像测试的正反成对用例钉死。
 *
 * 用法:
 *   node scripts/check-watermark-syntax.mjs                 # 全量:审计版本树(HEAD)里的文件
 *   node scripts/check-watermark-syntax.mjs --staged        # pre-commit:审计暂存区索引 blob
 *   node scripts/check-watermark-syntax.mjs <file>...       # 单文件自查(读磁盘内容)
 *   node scripts/check-watermark-syntax.mjs --root <dir>    # 显式注入仓库根(测试夹具用)
 *
 * 退出码: 0 = 通过 / 1 = 有违规(业务失败) / 2 = 脚本自身异常(git 解析失败等,绝不静默放行)
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, relative, basename, extname, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'
import { resolveGitBin } from './lib/gitdir.mjs'

// 零宽载荷字符(与 watermark.mjs 的 ZWSP/ZWNJ/ZWJ/SENTINEL 对应)
// 由码点构造字符类:本门源码里**不留**任何 Cf 类不可见字符 —— 文本级批量改写(reflow /
// prettier / sed / 编码往返)会静默改写它们(§5c 记录的 144 文件 218 处载荷损坏即此),
// 而字面写死的判据源码自己就是靶子。运行时字符类与旧斜杠写法逐字符等价。
export const INVISIBLE_CODEPOINTS = [0x200b, 0x200c, 0x200d, 0x2060]
export const INVISIBLE_RE = new RegExp('[' + INVISIBLE_CODEPOINTS.map((c) => String.fromCharCode(c)).join('') + ']')

// 横幅行形态(与 watermark.mjs isBannerLine 同款):剥行首注释前缀(// # --)后,
// 行首锚定匹配版权行 / 溯源声明 / [ID]: 载荷行才视为横幅内容行。
// 仅 includes(BANNER_ID) 会误伤源码常量定义(如 watermark.mjs 的 BANNER_ID 常量)。
export const BANNER_TEXT_RE =
  /^(?:©\s*\d{4}\s+IHUI\s+AI|Provenance-watermarked(?:\.|\s)|\[IHUI-AI-PROVENANCE\]\s*:)/
export function isBannerLine(line) {
  return BANNER_TEXT_RE.test(String(line).trim().replace(/^\s*(\/\/|#|--)\s*/, ''))
}

/**
 * 粗筛 needles:一整轮扫描 12k 文件,绝大多数行既不含零宽也不含横幅字形。
 * 先按**子串**筛候选行,再对该行做掩码与精确判定 —— 掩码因此只需处理极少数行。
 */
const BANNER_NEEDLES = ['©', 'Provenance-watermarked', '[IHUI-AI-PROVENANCE]']
export function mayCarryMark(line) {
  if (INVISIBLE_RE.test(line)) return true
  for (const needle of BANNER_NEEDLES) if (line.includes(needle)) return true
  return false
}

// ---------- 文件类型 → 注释风格(与 watermark.mjs EXT_MAP/STYLES 对齐) ----------
export const STYLES = {
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

/**
 * 目录段黑名单 —— 与旧实现(walk 时的 SKIP_DIRS)保持一致,**不随本次修复收窄**:
 * 清单虽然已改由版本树给出(理论上不会再出现 node_modules),但历史上确有跟踪文件
 * 落在 `vendor/`、`dist/` 等段下,少一条就等于对既有内容新增红点。
 */
export const SKIP_DIRS = new Set([
  'node_modules', '.git', '.turbo', 'dist', 'build', '.next', 'out', 'coverage',
  '.pnpm', 'target', '.cache', '.vercel', 'storybook-static', '_.husky', '_husky',
  '.husky/_', '.nyc_output', '.gradle', '.idea', '__pycache__', '.pytest_cache',
  '.venv', 'venv', 'vendor', 'expo/dist', '.expo',
  'tmp', 'playwright-report', 'test-results', 'vs',
  '.next-static', '.cxx', 'CMakeFiles', '.externalNativeBuild', '.cmake', '.wxt',
])

export const SKIP_FILES = new Set([
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

export function styleFor(path) {
  const name = basename(path)
  if (name === 'Dockerfile' || name.startsWith('Dockerfile.')) return STYLES.hash
  if (name === 'Makefile' || name.startsWith('Makefile.')) return STYLES.hash
  if (name === 'go.mod') return STYLES.slash
  if (name.startsWith('.env.') || name === '.env.example') return STYLES.hash
  if (name === 'next-env.d.ts') return null
  const key = EXT_MAP[extname(name).toLowerCase()]
  return key ? STYLES[key] : null
}

/** 该路径是否参与审计(过滤口径 = 旧 walk 的过滤口径,一字未放宽)。 */
export function isAuditCandidate(relPath) {
  const rel = String(relPath).replaceAll('\\', '/')
  const name = basename(rel)
  if (SKIP_FILES.has(name)) return false
  if (BINARY_EXT.has(extname(name).toLowerCase())) return false
  if (!styleFor(rel)) return false
  return rel.split('/').every((seg) => !SKIP_DIRS.has(seg) && !isExcludedDirName(seg))
}

// ---------- 掩码:把"字符串 / 模板 / 正则字面量 / 注释"区间从判定视野里剔掉 ----------

/** 每种风格参与掩码的语法区间(与守门 80 markHidden 同语义,按本门所需扩展) */
export function maskTokensFor(style) {
  const isHtml = style === STYLES.html
  return {
    // 行注释:仅本风格的那一种(`#` 在 md 里是标题、`--` 在 js 里非法,不得跨风格套用)
    line: style.line ? [style.line] : [],
    // 块注释:旧实现对所有风格同时参考 /* */ 与 <!-- -->,此处保持一致(不收窄也不放宽)
    block: [
      [STYLES.block.open, STYLES.block.close],
      [STYLES.html.open, STYLES.html.close],
    ],
    // 引号串:prose 类型(md/html/xml)不掩 —— 正文里的撇号会把整篇吞进"字符串"
    str: !isHtml,
    // 正则字面量:只有 slash(语言系)需要;Python 的正则写在 r'...' 里,已被 str 覆盖
    regex: style === STYLES.slash,
  }
}

const REGEX_OK_AFTER = new Set([
  '=', '(', ',', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '^', '~', '<', '>',
])
const REGEX_KEYWORD_RE =
  /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)\s*$/

/** `/` 出现在这里是否更像正则字面量而非除法?(前一个有效字符 + 关键字回溯) */
export function regexLiteralStarts(src, i) {
  let k = i - 1
  while (k >= 0 && /\s/.test(src[k]) && src[k] !== '\n') k--
  if (k < 0 || src[k] === '\n') return true
  if (REGEX_OK_AFTER.has(src[k])) return true
  return REGEX_KEYWORD_RE.test(src.slice(Math.max(0, k - 24), k + 1))
}

/**
 * 返回与 src 等长的掩码数组(1 = 该字符不参与判定;换行恒为 0 以保持行偏移对齐)。
 * 复刻守门 80 `markHidden` 的规则集并按本门需要扩展:行注释 / 块注释(未闭合保守掩到 EOF)
 * / 引号串(含**三引号**,否则 Python 文档串会把整文件吞掉)+ 正则字面量。
 */
export function maskHidden(src, toks) {
  const n = src.length
  const hidden = new Uint8Array(n)
  const hide = (from, to) => {
    const end = Math.min(to, n)
    for (let k = Math.max(0, from); k < end; k++) if (src[k] !== '\n') hidden[k] = 1
  }
  let i = 0
  while (i < n) {
    const c = src[i]
    let matched = false
    for (const lc of toks.line) {
      if (src.startsWith(lc, i)) {
        const s = i
        while (i < n && src[i] !== '\n') i++
        hide(s, i)
        matched = true
        break
      }
    }
    if (matched) continue
    for (const [open, close] of toks.block) {
      if (src.startsWith(open, i)) {
        const s = i
        const e = src.indexOf(close, i + open.length)
        i = e === -1 ? n : e + close.length
        hide(s, i) // 未闭合:保守视为注释内(与旧 commentRanges 的"保守"口径一致)
        matched = true
        break
      }
    }
    if (matched) continue
    if (toks.str && (c === '"' || c === "'" || c === '`')) {
      const s = i
      const triple = src[i + 1] === c && src[i + 2] === c
      const q = triple ? c + c + c : c
      let j = i + q.length
      let closed = false
      while (j < n) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src.startsWith(q, j)) {
          j += q.length
          closed = true
          break
        }
        // `'` 与 `"` 不得跨行(它们不可能包住换行)。扫描到行尾仍未闭合 ⇒ 这**不是**字符串
        // (典型:JSX 文本里的撇号 `Don't`、中文文案里的单个直引号)⇒ 一字不掩,
        // 把该引号当普通字符前进一步。旧实现"止于行尾并掩掉半截"会造成状态机错位,
        // 使紧随其后的模板串正文(如 LoginScreen 内嵌 SVG 的横幅行)脱离掩码 → 假阳。
        if (!triple && c !== '`' && src[j] === '\n') break
        j++
      }
      if (closed) {
        hide(s, j)
        i = j
        continue
      }
      // 未闭合(含未闭合的反引号模板):不掩任何东西,当普通字符继续 —— 掩到 EOF 会把
      // 整份文件的真实违规一起藏掉,那才是本门最不能接受的失效方向。
      i++
      continue
    }
    if (toks.regex && c === '/' && regexLiteralStarts(src, i)) {
      let j = i + 1
      let inClass = false
      let closed = false
      while (j < n) {
        const d = src[j]
        if (d === '\n') break // 正则字面量不跨行
        if (d === '\\') {
          j += 2
          continue
        }
        if (d === '[') inClass = true
        else if (d === ']') inClass = false
        else if (d === '/' && !inClass) {
          closed = true
          break
        }
        j++
      }
      if (closed) {
        let k = j + 1
        while (k < n && /[a-z]/i.test(src[k])) k++ // 修饰符
        hide(i, k)
        i = k
        continue
      }
    }
    i++
  }
  return hidden
}

/** 取一行的"可见"文本(掩码位替换为空格);整行未被掩时直接复用原串。 */
export function visibleSlice(line, start, hidden) {
  let any = false
  for (let k = 0; k < line.length; k++) if (hidden[start + k]) { any = true; break }
  if (!any) return line
  let out = ''
  for (let k = 0; k < line.length; k++) out += hidden[start + k] ? ' ' : line[k]
  return out
}

export function lineStartsOf(lines) {
  const starts = new Array(lines.length)
  let off = 0
  for (let i = 0; i < lines.length; i++) {
    starts[i] = off
    off += lines[i].length + 1 // +1 = split 掉的 \n
  }
  return starts
}

/** R1:载荷行或横幅行必须被注释包裹(掩码后仍有标记 = 落在语法位置) */
export function checkMarkedLines(lines, starts, hidden, relPath, issues) {
  for (let i = 0; i < lines.length; i++) {
    if (!mayCarryMark(lines[i])) continue
    const visible = visibleSlice(lines[i], starts[i], hidden)
    // 精判必须走**锚定正则**:mayCarryMark 只是子串粗筛(正文里的 `©` / `Provenance` 一词
    // 都会命中),拿粗筛当结论会产出一批假阳(实测 README.md:9 的版权引述段)。
    const hasInvisible = INVISIBLE_RE.test(visible)
    if (!hasInvisible && !isBannerLine(visible)) continue
    const kind = hasInvisible ? '裸零宽载荷行(未注释包裹)' : '横幅行未注释包裹'
    issues.push(`${relPath}:${i + 1}  [${kind}]`)
  }
}

/** R2: .xml 的 <?xml 声明必须位于第一个非空行且横幅不早于它(判原始行,掩码不参与位置判断) */
export function checkXmlDecl(lines, relPath, issues) {
  if (extname(relPath).toLowerCase() !== '.xml') return
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

/** 纯函数:一份文本 + 它的注释风格 ⇒ 违规清单。单文件/全量/暂存三条路径共用同一判据。 */
export function judgeText(text, style, relPath) {
  const src = String(text).replace(/^\uFEFF/, '')
  const lines = src.split('\n')
  const issues = []
  checkMarkedLines(lines, lineStartsOf(lines), maskHidden(src, maskTokensFor(style)), relPath, issues)
  checkXmlDecl(lines, relPath, issues)
  return issues
}

function isBinary(buf) {
  const end = Math.min(buf.length, 4096)
  for (let i = 0; i < end; i++) if (buf[i] === 0) return true
  return false
}

// ---------- git 派生(绝对路径 + safe.directory + windowsHide + timeout + maxBuffer) ----------
let _gitBin
function gitBin() {
  if (_gitBin === undefined) _gitBin = resolveGitBin()
  return _gitBin
}

function gitOut(args, root, timeoutMs) {
  const bin = gitBin()
  if (!bin) throw new Error('git 可执行文件候选解析全部失败 —— 判据无法执行')
  return execFileSync(bin, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', '-C', root, ...args], {
    encoding: 'buffer',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 28,
    timeout: timeoutMs,
    windowsHide: true,
  })
}

/** 路径清单走 `-z`:避免 git 对非 ASCII 路径做引号转义(转义后既匹配不到也取不到 blob)。 */
function gitPathList(args, root, timeoutMs) {
  return gitOut(args, root, timeoutMs).toString('utf8').split('\0').filter(Boolean)
}

/** 缺省模式的清单:版本树(HEAD 提交树)。被 gitignore 的本地产物结构上不可能出现。 */
export function headPaths(root, timeoutMs = 120000) {
  return gitPathList(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], root, timeoutMs)
}

/** --staged 的清单:暂存集 A/C/M/R(删除态无内容不判),与守门 67/79 同口径。 */
export function stagedPaths(root, timeoutMs = 60000) {
  return gitPathList(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'],
    root,
    timeoutMs,
  )
}

const norm = (p) =>
  String(p)
    .trim() // git 输出带尾换行:未 trim 会让"同一个根"被判成不同路径(本仓实测踩过的坑)
    .replaceAll('\\', '/')
    .replace(/\/+$/, '')
    .toLowerCase()

/**
 * 防"夹具静默扫真仓":`--root` 指到一个**嵌套在别的仓库里**的非仓库目录时,
 * `git -C <dir>` 会向上逃逸到外层仓库,于是自测以为自己扫的是夹具、实际扫的是真仓
 * (本仓实测教训:14 例 13 红且无人发现)。判不了就 exit 2,绝不静默按错的仓报绿。
 */
export function assertRepoRoot(root, timeoutMs = 60000) {
  const top = norm(gitOut(['rev-parse', '--show-toplevel'], root, timeoutMs).toString('utf8'))
  const want = norm(root)
  if (top !== want) {
    throw new Error(`--root 不是它所归属仓库的顶层(${root} → 实为 ${top}):向上逃逸会扫错仓`)
  }
  return true
}

/** 索引 blob(暂存内容本身,**不回退工作区** —— 工作区脏不是本次提交的内容)。 */
export function readIndexBlob(root, rel, timeoutMs = 60000) {
  try {
    return gitOut(['show', `:${rel}`], root, timeoutMs)
  } catch {
    return null
  }
}

export function readHeadBlob(root, rel, timeoutMs = 60000) {
  try {
    return gitOut(['show', `HEAD:${rel}`], root, timeoutMs)
  } catch {
    return null
  }
}

// ---------- main ----------
export async function main(argv = process.argv.slice(2), defaultRoot) {
  const root = defaultRoot ?? resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const flags = new Set()
  const positional = []
  let explicitRoot = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--root') {
      explicitRoot = argv[++i]
      continue
    }
    if (a.startsWith('--')) flags.add(a)
    else positional.push(a)
  }
  const staged = flags.has('--staged')
  if (flags.has('--help') || flags.has('-h')) {
    console.log(
      '用法: node scripts/check-watermark-syntax.mjs [--staged] [--root <dir>] [<file>...]\n' +
        '  缺省   审计版本树(HEAD 提交树)内的可注入文件\n' +
        '  --staged 审计暂存区(索引 blob),pre-commit 用此模式\n' +
        '  <file>   只审计指定磁盘文件(开发者自查)',
    )
    return 0
  }
  const unknown = [...flags].filter((f) => f !== '--staged')
  if (unknown.length) {
    console.error(`[check:watermark-syntax] 未知参数: ${unknown.join(' ')}`)
    return 2
  }
  const ROOT = explicitRoot ? resolve(explicitRoot) : root
  if (!positional.length) assertRepoRoot(ROOT) // 抛错 → 外层按脚本异常 exit 2(绝不静默扫真仓)

  let entries // {rel, bytes, source}
  const stats = { listed: 0, candidate: 0, disk: 0, blob: 0, missing: 0 }
  if (positional.length) {
    // 单/多文件模式:磁盘内容(与旧行为一致,供 `watermark.mjs inject` 后自查)
    entries = []
    for (const target of positional) {
      const abs = resolve(ROOT, target)
      if (!existsSync(abs)) {
        console.error(`文件不存在: ${target}`)
        return 1
      }
      stats.candidate++
      stats.disk++
      entries.push({
        rel: relative(ROOT, abs).replaceAll('\\', '/'),
        bytes: readFileSync(abs),
        source: 'disk',
      })
    }
    stats.listed = positional.length
  } else if (staged) {
    const paths = stagedPaths(ROOT) // 抛错即由 catch 统一按异常退出(不静默放行)
    stats.listed = paths.length
    entries = []
    for (const rel of paths) {
      if (!isAuditCandidate(rel)) continue
      stats.candidate++
      const bytes = readIndexBlob(ROOT, rel)
      if (bytes === null) {
        stats.missing++ // 索引取不到 = 如实报数,不得伪装成"通过"
        continue
      }
      entries.push({ rel, bytes, source: 'index' })
    }
  } else {
    const paths = headPaths(ROOT)
    stats.listed = paths.length
    entries = []
    for (const rel of paths) {
      if (!isAuditCandidate(rel)) continue
      stats.candidate++
      // "是否存在"按版本树判:HEAD 里有 ⇒ 必须被审计;工作区恰好没检出则回退 HEAD blob
      let bytes = null
      try {
        bytes = readFileSync(join(ROOT, rel))
        stats.disk++
      } catch {
        bytes = readHeadBlob(ROOT, rel)
        if (bytes === null) {
          stats.missing++
          continue
        }
        stats.blob++
      }
      entries.push({ rel, bytes, source: 'blob' })
    }
  }

  let totalIssues = 0
  let checked = 0
  for (const { rel, bytes } of entries) {
    if (isBinary(bytes)) continue
    const style = styleFor(rel)
    if (!style) continue
    checked++
    for (const msg of judgeText(bytes.toString('utf8'), style, rel)) {
      console.log(`  [FAIL] ${msg}`)
      totalIssues++
    }
  }

  const mode = positional.length ? `显式文件 ${positional.length} 个` : staged ? '--staged 暂存区' : '版本树 HEAD'
  console.log(
    `[check:watermark-syntax] 取材=${mode} 清单=${stats.listed} 可注入=${checked}` +
      ` (工作区副本 ${stats.disk} / blob 回退 ${stats.blob} / 取不到内容 ${stats.missing})`,
  )
  if (totalIssues > 0) {
    console.log(`违例 ${totalIssues} 处`)
    console.log('处理: 对违例文件执行 node scripts/watermark.mjs clean <file> 后重新 inject, 或手工补注释前缀')
    return 1
  }
  console.log('全部通过: 载荷/横幅行均注释包裹(字符串/模板/正则字面量内的命中不计), XML 声明位置正确。')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`❌ [check:watermark-syntax] ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    },
  )
}

export const __test__ = {
  INVISIBLE_CODEPOINTS,
  INVISIBLE_RE,
  BANNER_TEXT_RE,
  STYLES,
  SKIP_DIRS,
  SKIP_FILES,
  mayCarryMark,
  isBannerLine,
  styleFor,
  isAuditCandidate,
  maskTokensFor,
  regexLiteralStarts,
  maskHidden,
  visibleSlice,
  lineStartsOf,
  checkMarkedLines,
  checkXmlDecl,
  judgeText,
  isBinary,
  headPaths,
  stagedPaths,
  assertRepoRoot,
  readIndexBlob,
  readHeadBlob,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
