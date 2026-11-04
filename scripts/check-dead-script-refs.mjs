#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-dead-script-refs.mjs — 「工作流/部署脚本引用不存在的脚本」只读门(2026-11-04 立)。
 *
 * 立因:deploy/** 与 .github/workflows/** 里有大量 `node scripts/xxx.mjs`、
 * `pnpm --filter <pkg> exec tsx scripts/xxx.ts` 一类引用;被引用的脚本被删/改名后,
 * 提交链上没有任何一把尺子会响 —— 静态判据只核语法与类型,CI 只有在真跑到那一步才炸,
 * 而很多部署步骤一年跑不了几次(回滚/演练/灾备),等到用时才发现引用是死的。
 *
 * 判据(只读,不改任何文件):
 *   D1 真死引用(BLOCK):被审面(工作流/部署脚本)里出现的 `scripts/*.{ts,mjs}` 引用,
 *      按其 cwd 语义解析后,在 HEAD blob 里不存在 ⇒ 判红并点名「文件:行 → 引用 → 解析结果」。
 *   D2 回滚态(只报数):解析落点在 HEAD 存在、但工作树缺失 ⇒ 这是回滚/清理现场,
 *      **不算真死引用**(按工作树判会把「被删但 HEAD 还在」误判成死引用,实测过的坑)。
 *   D3 无法解析(exit 2):引用是动态拼出来的(`scripts/${X}.mjs` / `scripts/*.mjs`),
 *      或解析所需的 cwd 语境取不到(例如 Dockerfile 没有 WORKDIR、shell 没有 cd/包前缀)。
 *      §0.3:未判定既不记绿也不冒红,单独 exit 2。
 *
 * 解析规则(误报压到 0 的关键,逐类说明——不是"整体跳过某类"):
 *   ① 注释遮蔽:YAML `#`、Dockerfile 整行 `#`、shell/ps1 `#`、JS `//` 与 `/* *\/`;
 *      屏蔽后仍保留原列位置与行号(用空格替换,不删行)。注释里的引用不是引用。
 *   ② cwd 推导:
 *      - GitHub Actions:步骤级 `working-directory:` 优先于 job 级
 *        `defaults.run.working-directory:`;都没有 ⇒ repo 根(Actions 默认)。
 *        实测反例:e2e.yml / test-real-db.yml 的两步都写了 `working-directory: packages/database`,
 *        脚本真实落点是 packages/database/scripts/pre-migrate-fresh-db-guard.mjs ——
 *        只按仓根解析会把这两条有效引用误报成真死引用(更正单 2026-11-04)。
 *      - `pnpm --filter <pkg> exec …`(含 `=`)⇒ 该包目录(包名→目录表由 HEAD 的 package.json 建)。
 *      - shell 步骤内 `cd <dir> && node scripts/...` ⇒ 同行的 cd 优先;跨行 cd 记到后续行。
 *      - Dockerfile `WORKDIR`:相对 WORKDIR 累积;绝对 WORKDIR 按 repo 根(COPY 惯例);
 *        没有 WORKDIR 又解析不出来 ⇒ 未判定(不猜)。
 *      - 相对引用(`../scripts/x`、`./scripts/x`)先按引用文件目录(import 语义),再按运行时 cwd。
 *      - 兜底再试「引用文件所在目录的每一级祖先 + 仓根」——覆盖 apps/web/scripts、
 *        deploy/scripts、packages/database/scripts 这些子目录 scripts(输出会写明是哪一级命中的)。
 *   ③ 存在性判 HEAD blob:全量面 `git ls-tree -r HEAD`;`--staged` 面额外并入索引面
 *      (本次新增的脚本在索引里就有,不能算死)。工作树只用于 D2 回滚态区分。
 *
 * 取材面:
 *   全量面 = 工作树里 deploy/** 与 .github/workflows/** 的全部文本文件(含被 .gitignore 的
 *   部署运行件 —— 它们正是在服务器上被执行的;实测 702 文件 / 1078 引用);
 *   引用目标的**存在性**仍判 HEAD blob(回滚态安全)。
 *   `--staged` 面 = 只审本次暂存的 deploy/ 与 .github/workflows/ 改动(索引 blob)。
 *
 * 用法:
 *   node scripts/check-dead-script-refs.mjs              # 全量面(工作树清单 + HEAD 存在性)
 *   node scripts/check-dead-script-refs.mjs --staged     # 只审本次暂存改动
 *   node scripts/check-dead-script-refs.mjs --verbose    # 逐条打印所有引用与解析结果
 *   node scripts/check-dead-script-refs.mjs --self-test  # 自检(覆盖六类判据)
 * 退出码:0 = 通过 / 1 = 有真死引用 / 2 = 有未判定(不折绿也不折红)
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SELF_REL = 'scripts/check-dead-script-refs.mjs'
const TEST_REL = 'scripts/tests/check-dead-script-refs.test.mjs'
const SCOPE_DIRS = ['deploy', '.github/workflows']
const SELF_SKIP_ENV = 'HUSKY_SKIP_DEAD_SCRIPT_REFS'

const posix = path.posix

/** 二进制/压缩包直接跳过(不在其中找文本引用);文本文件不设大小上限(deploy-loop.log 6.5MB 里真有引用)。 */
const BINARY_EXT = new Set([
  '.apk', '.exe', '.dll', '.so', '.dylib', '.bin', '.jar', '.class',
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.pdf',
  '.zip', '.gz', '.tar', '.7z', '.rar', '.mp4', '.mov', '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.db', '.sqlite',
])

/** §0.5 单一真相源:引用取形只在这里一份,测试 import __test__ 复用,不复制。 */
const LITERAL_RE = /(?<![\w.-])(?:\.{1,2}\/)?(?:[A-Za-z0-9_@.+-]+\/)*scripts\/[A-Za-z0-9_./-]+\.(?:ts|mjs)/g
/** 动态取形:允许 `$ { } % * ?` 出现在路径段里,用于判「无法解析」。 */
const DYNAMIC_RE = /(?<![\w.-])(?:\.{1,2}\/)?(?:[A-Za-z0-9_@.+-]+\/)*scripts\/[A-Za-z0-9_./${}%*?+-]*\.(?:ts|mjs)/g
const DYNAMIC_CHARS = /[$*?%{}]/

// ─── 注释遮蔽 ───────────────────────────────────────────────────
export function commentStyleFor(file) {
  const base = posix.basename(String(file)).toLowerCase()
  if (base.startsWith('dockerfile') || base.endsWith('.dockerfile')) return 'dockerfile'
  const dot = base.lastIndexOf('.')
  const ext = dot >= 0 ? base.slice(dot) : ''
  if (ext === '.yml' || ext === '.yaml') return 'hash'
  if (['.sh', '.bash', '.zsh', '.ps1', '.psm1', '.rb', '.conf', '.cron', '.cmd', '.bat'].includes(ext)) return 'hash'
  if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(ext)) return 'slash'
  return 'none'
}

function blank(chars, from, to) {
  for (let i = from; i < to && i < chars.length; i++) if (chars[i] !== '\n' && chars[i] !== '\r') chars[i] = ' '
}

/** 行尾(不含换行);hash/slash 行注释只遮到本行,不能把后面的行一起吞掉。 */
function endOfLine(chars, from) {
  let i = from
  while (i < chars.length && chars[i] !== '\n') i++
  return i
}

/**
 * 遮蔽注释,返回与原文等长的文本(注释字符换成空格,换行原样保留)。
 * 保守优先:'#' 只在「行首或前有空白」且不在引号里时才算注释;`${x#y}` / `$#` 不吃。
 */
export function maskComments(text, style) {
  const src = String(text ?? '')
  if (style === 'none') return src
  if (style === 'dockerfile') {
    return src
      .split('\n')
      .map((line) => (/^\s*#/.test(line) ? ' '.repeat(line.length) : line))
      .join('\n')
  }
  const chars = [...src]
  let quote = ''
  let block = false
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const prev = i > 0 ? chars[i - 1] : '\n'
    if (style === 'slash') {
      if (block) {
        if (c === '*' && chars[i + 1] === '/') { blank(chars, i, i + 2); i++; block = false; continue }
        blank(chars, i, i + 1)
        continue
      }
      if (quote) {
        if (c === '\\') { i++; continue }
        if (c === quote) quote = ''
        continue
      }
      if (c === '/' && chars[i + 1] === '/') {
        const eol = endOfLine(chars, i)
        blank(chars, i, eol)
        i = eol - 1
        continue
      }
      if (c === '/' && chars[i + 1] === '*') { blank(chars, i, i + 2); i++; block = true; continue }
      if (c === "'" || c === '"' || c === '`') { quote = c; continue }
      continue
    }
    // hash 族:YAML / shell / ps1 / ruby / conf
    if (quote) {
      if (c === '\\' && quote === '"') { i++; continue }
      if (c === quote) quote = ''
      continue
    }
    if (c === "'" || c === '"') { quote = c; continue }
    if (c === '#' && i === 0) {
      const eol = endOfLine(chars, i)
      blank(chars, i, eol)
      i = eol - 1
      continue
    }
    if (c === '#' && /\s/.test(prev) && prev !== '$' && prev !== '{') {
      const eol = endOfLine(chars, i)
      blank(chars, i, eol)
      i = eol - 1
    }
  }
  return chars.join('')
}

// ─── 引用抽取 ───────────────────────────────────────────────────
/** 在(已遮注释的)文本上抽取引用;行号/列号与原文件对齐(遮蔽是等长替换)。 */
export function scanRefs(text, file) {
  const lines = String(text ?? '').split(/\r?\n/)
  const out = []
  lines.forEach((line, idx) => {
    const literals = new Set()
    LITERAL_RE.lastIndex = 0
    let m
    while ((m = LITERAL_RE.exec(line)) !== null) {
      literals.add(`${m.index}:${m[0]}`)
      out.push({ file, line: idx + 1, col: m.index, ref: m[0], dynamic: false })
    }
    DYNAMIC_RE.lastIndex = 0
    while ((m = DYNAMIC_RE.exec(line)) !== null) {
      if (!DYNAMIC_CHARS.test(m[0])) continue
      if ([...literals].some((k) => k.startsWith(`${m.index}:`))) continue
      out.push({ file, line: idx + 1, col: m.index, ref: m[0], dynamic: true })
    }
  })
  return out
}

/** 注释遮蔽后再抽取(注释内的引用不算引用)。 */
export function extractRefs(text, file) {
  return scanRefs(maskComments(text, commentStyleFor(file)), file)
}

// ─── cwd 语境 ───────────────────────────────────────────────────
function unquote(v) {
  const s = String(v ?? '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1)
  return s
}

function norm(p) {
  if (!p) return ''
  return posix.normalize(String(p)).replace(/^\.\//, '')
}

function joinPosix(base, rel) {
  const b = norm(base)
  return b ? norm(posix.join(b, rel)) : norm(rel)
}

function insideRepo(p) {
  return typeof p === 'string' && p !== '' && !p.startsWith('..') && !posix.isAbsolute(p)
}

/** 同一行里出现在引用列之前的最后一个 literal cd 目标。 */
export function cdBefore(line, endCol) {
  const seg = String(line ?? '').slice(0, endCol)
  const re = /(?:^|&&|;|\|\||\bthen\b|\bdo\b|[({])\s*cd\s+(?:"([^"]+)"|'([^']+)'|([^\s;&|)]+))/g
  let last = null
  let m
  while ((m = re.exec(seg)) !== null) last = m[1] ?? m[2] ?? m[3]
  return last
}

/** `pnpm --filter <pkg> … exec` 的包名(支持 `--filter=x` 与引号)。 */
export function pnpmFilterPkg(line) {
  const m = String(line ?? '').match(/pnpm(?:\s+--filter(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+)))+[^\n]*?\bexec\b/)
  if (!m) return null
  return m[1] ?? m[2] ?? m[3] ?? null
}

/**
 * GitHub Actions 行级 cwd 语境:
 * 步骤级 working-directory > job 级 defaults.run.working-directory > 仓根(Actions 默认)。
 * 返回 [{cwd, reason}|null] 与行号对齐。
 */
export function buildGhaHints(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const hints = new Array(lines.length).fill(null)
  let jobDefault = null
  let inDefaults = false
  let defaultsIndent = -1
  let stepCwd = null
  let stepKeyIndent = -1
  let runIndent = -1
  let blockCwd = ''
  let blockReason = 'repo-root(GHA默认)'
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const t = raw.trim()
    if (!t) continue
    const indent = raw.length - raw.trimStart().length
    if (indent === 2 && /^[A-Za-z0-9_.-]+:\s*(?:#.*)?$/.test(t) && !t.startsWith('-')) {
      jobDefault = null; inDefaults = false; stepCwd = null; stepKeyIndent = -1; runIndent = -1
      continue
    }
    if (indent === 4 && /^defaults:\s*(?:#.*)?$/.test(t)) { inDefaults = true; defaultsIndent = indent; continue }
    if (inDefaults) {
      if (indent <= defaultsIndent) inDefaults = false
      else if (/^working-directory:\s*\S/.test(t)) { jobDefault = unquote(t.replace(/^working-directory:\s*/, '')); continue }
    }
    if (indent === 4 && /^steps:\s*(?:#.*)?$/.test(t)) {
      stepCwd = null; stepKeyIndent = -1; runIndent = -1
      continue
    }
    const stepM = raw.match(/^(\s*)- (.*)$/)
    if (stepM && indent >= 4) {
      stepCwd = null
      stepKeyIndent = indent + 2
      runIndent = -1
      const rest = stepM[2]
      if (/^run:\s*\S/.test(rest)) {
        runIndent = stepKeyIndent
        blockCwd = stepCwd ?? jobDefault ?? ''
        blockReason = stepCwd !== null ? 'working-directory(step)' : jobDefault !== null ? 'working-directory(defaults)' : 'repo-root(GHA默认)'
        hints[i] = { cwd: blockCwd, reason: blockReason }
      }
      continue
    }
    if (stepKeyIndent >= 0 && indent === stepKeyIndent) {
      if (/^working-directory:\s*\S/.test(t)) { stepCwd = unquote(t.replace(/^working-directory:\s*/, '')); continue }
      if (/^run:\s*\S/.test(t)) {
        runIndent = indent
        blockCwd = stepCwd ?? jobDefault ?? ''
        blockReason = stepCwd !== null ? 'working-directory(step)' : jobDefault !== null ? 'working-directory(defaults)' : 'repo-root(GHA默认)'
        hints[i] = { cwd: blockCwd, reason: blockReason }
        continue
      }
    }
    if (runIndent >= 0 && indent > runIndent) {
      hints[i] = { cwd: blockCwd, reason: blockReason }
      const cd = cdBefore(raw, raw.length)
      if (cd) { blockCwd = joinPosix(blockCwd, cd); blockReason = `cd:${cd}` }
    }
  }
  return hints
}

export function buildShellHints(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const hints = new Array(lines.length).fill(null)
  let cwd = null
  let reason = null
  for (let i = 0; i < lines.length; i++) {
    if (cwd !== null) hints[i] = { cwd, reason }
    const cd = cdBefore(lines[i], lines[i].length)
    if (cd) { cwd = joinPosix(cwd ?? '', cd); reason = `cd:${cd}` }
  }
  return hints
}

export function buildDockerHints(text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const hints = new Array(lines.length).fill(null)
  let workdir = null
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()
    const m = t.match(/^WORKDIR\s+(\S+)/i)
    if (m) {
      const v = unquote(m[1])
      if (v.startsWith('/')) workdir = { cwd: '', reason: `WORKDIR:${v}` }
      else if (workdir) workdir = { cwd: joinPosix(workdir.cwd, v), reason: `WORKDIR:${v}` }
      else workdir = { cwd: norm(v), reason: `WORKDIR:${v}` }
      continue
    }
    if (workdir && /^(RUN|COPY|CMD|ENTRYPOINT|ARG|ENV)\b/i.test(t)) hints[i] = { ...workdir }
  }
  return hints
}

/** 文件类别决定「解析不出来时算真死还是未判定」。 */
export function kindOf(file) {
  const f = String(file)
  if (/^\.github\/workflows\/.+\.ya?ml$/.test(f)) return 'gha'
  const base = posix.basename(f).toLowerCase()
  if (base.startsWith('dockerfile') || base.endsWith('.dockerfile')) return 'dockerfile'
  const ext = base.lastIndexOf('.') >= 0 ? base.slice(base.lastIndexOf('.')) : ''
  if (['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].includes(ext)) return 'js'
  if (['.sh', '.bash', '.zsh', '.ps1', '.psm1', '.cmd', '.bat'].includes(ext)) return 'shell'
  return 'doc'
}

export function buildHints(text, file, kind) {
  if (kind === 'gha') return buildGhaHints(text)
  if (kind === 'dockerfile') return buildDockerHints(text)
  if (kind === 'shell') return buildShellHints(text)
  return null
}

/** 解析候选(按可信度排序)。输出里保留 reason,便于人复核「凭什么这样解析」。 */
export function candidatesFor({ ref, file, lineText, col, lineHint, pkgDirs }) {
  const out = []
  const push = (cwd, reason) => {
    const target = joinPosix(cwd, ref.replace(/^\.\//, ''))
    if (insideRepo(target) && !out.some((c) => c.target === target)) out.push({ target, reason, cwd })
  }
  const clean = ref.replace(/^\.\//, '')
  if (/^\.{1,2}\//.test(ref)) {
    push(posix.dirname(file), 'file-relative')
    if (lineHint?.cwd) push(lineHint.cwd, lineHint.reason)
    push('', 'repo-root')
    return out
  }
  const pkg = pnpmFilterPkg(lineText)
  const pkgDir = pkg && pkgDirs ? pkgDirs[pkg] : null
  if (pkgDir) push(pkgDir, `pnpm-filter:${pkg}`)
  const sameLineCd = cdBefore(lineText, col)
  if (sameLineCd) push(joinPosix(lineHint?.cwd ?? '', sameLineCd), `cd:${sameLineCd}`)
  if (lineHint !== null && lineHint.cwd !== null && lineHint.cwd !== undefined) push(lineHint.cwd, lineHint.reason)
  push('', 'repo-root')
  const repoBase = posix.basename(ROOT)
  if (clean.startsWith(`${repoBase}/`)) push('', `strip-repo-name:${repoBase}`)
  let dir = posix.dirname(file)
  while (dir && dir !== '.' && insideRepo(dir)) {
    push(dir, `ancestor:${dir}`)
    dir = posix.dirname(dir)
  }
  return out
}

/**
 * 单条引用判定。`headSet` / `indexSet` = 路径存在集合;`worktreeExists(p)` = 磁盘判定。
 * 返回 {verdict:'exists'|'rollback'|'dead'|'undetermined', path, reason, tried, why}
 */
export function resolveRef({ ref, file, lineText, col, lineHint, pkgDirs, headSet, indexSet, worktreeExists }) {
  const kind = kindOf(file)
  if (ref.includes('$') || ref.includes('*') || ref.includes('?') || /[{}%]/.test(ref)) {
    return { verdict: 'undetermined', why: '动态拼接路径(非字面量)', tried: [] }
  }
  const cands = candidatesFor({ ref, file, lineText, col, lineHint, pkgDirs })
  if (cands.length === 0) return { verdict: 'undetermined', why: '没有任何可用解析基准', tried: [] }
  for (const c of cands) {
    if (headSet.has(c.target) && worktreeExists(c.target)) return { verdict: 'exists', path: c.target, reason: c.reason, cwd: c.cwd, tried: cands }
  }
  for (const c of cands) {
    if (headSet.has(c.target)) return { verdict: 'rollback', path: c.target, reason: c.reason, cwd: c.cwd, tried: cands }
  }
  for (const c of cands) {
    if (indexSet && indexSet.has(c.target)) return { verdict: 'exists', path: c.target, reason: `索引面:${c.reason}`, cwd: c.cwd, tried: cands }
  }
  // 解析不出来时,方向必须保守:能确定 cwd 的语境(工作流/js/docker WORKDIR/cd)判真死,
  // 其余(运行时 cwd 由调用方决定的 shell、文档/日志)一律未判定,不猜成死引用。
  const deterministic =
    kind === 'gha' ||
    kind === 'js' ||
    (kind === 'dockerfile' && lineHint !== null) ||
    (kind === 'shell' && (lineHint !== null || pnpmFilterPkg(lineText) !== null))
  if (!deterministic) return { verdict: 'undetermined', why: `cwd 语境取不到(${kind})`, tried: cands }
  const at = cands.find((c) => worktreeExists(c.target) && !headSet.has(c.target))
  return {
    verdict: 'dead',
    path: at ? at.target : cands[0].target,
    reason: at ? `仅工作树存在、HEAD 无:${at.reason}` : cands[0].reason,
    cwd: at ? at.cwd : cands[0].cwd,
    tried: cands,
  }
}

// ─── 仓面读取 ───────────────────────────────────────────────────
function gitOrNull(args) {
  try {
    return gitRaw(args, ROOT, { maxBuffer: 128 * 1024 * 1024 })
  } catch {
    return null
  }
}

function splitZ(out) {
  return String(out).split('\u0000').filter(Boolean)
}

function enumerateWorktree() {
  const files = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue
        walk(abs)
      } else if (e.isFile()) files.push(path.relative(ROOT, abs).split(path.sep).join('/'))
    }
  }
  for (const d of SCOPE_DIRS) {
    const abs = path.join(ROOT, d)
    if (!existsSync(abs)) return null
    walk(abs)
  }
  return files.sort()
}

function isBinaryExt(file) {
  const base = posix.basename(file).toLowerCase()
  const ext = base.lastIndexOf('.') >= 0 ? base.slice(base.lastIndexOf('.')) : ''
  return BINARY_EXT.has(ext)
}

function buildPkgDirs(headPaths, readHeadMany) {
  const specPaths = headPaths.filter((p) => /^(?:apps|packages)\/[^/]+\/package\.json$/.test(p))
  const map = {}
  if (specPaths.length === 0) return map
  const raw = readHeadMany(specPaths)
  for (const p of specPaths) {
    const txt = raw.get(p)
    if (typeof txt !== 'string') continue
    try {
      const name = JSON.parse(txt).name
      if (typeof name === 'string' && name) map[name] = posix.dirname(p)
    } catch {
      /* 解析失败的 package.json 不参与 cwd 推导(不猜) */
    }
  }
  return map
}

function readHeadMany(paths) {
  const specs = paths.map((p) => `HEAD:${p}`)
  const out = new Map()
  try {
    const raw = catBatch(ROOT, specs, { maxBuffer: 128 * 1024 * 1024 })
    paths.forEach((p, i) => out.set(p, raw.get(specs[i]) ?? null))
  } catch {
    for (const p of paths) out.set(p, null)
  }
  return out
}

function readIndexMany(paths) {
  const specs = paths.map((p) => `:${p}`)
  const out = new Map()
  try {
    const raw = catBatch(ROOT, specs, { maxBuffer: 128 * 1024 * 1024 })
    paths.forEach((p, i) => out.set(p, raw.get(specs[i]) ?? null))
  } catch {
    for (const p of paths) out.set(p, null)
  }
  return out
}

/** 汇总三档 → 进程退出码。未判定优先(§0.3:既不记绿也不折红)。 */
export function judgeReport(counts) {
  if ((counts.undetermined ?? 0) > 0) return 2
  if ((counts.dead ?? 0) > 0) return 1
  return 0
}

// ─── 主流程 ───────────────────────────────────────────────────
function audit({ face, verbose }) {
  const started = process.hrtime.bigint()
  const headOut = gitOrNull(['ls-tree', '-r', '--name-only', '-z', 'HEAD'])
  if (headOut === null) {
    console.log('❌ 未判定:取不到 HEAD 树(§0.3:不记绿也不冒红)')
    return 2
  }
  const headPaths = splitZ(headOut)
  const headSet = new Set(headPaths)
  let indexSet = null
  if (face === 'staged') {
    const idxOut = gitOrNull(['ls-files', '-z'])
    if (idxOut === null) {
      console.log('❌ 未判定:取不到索引清单')
      return 2
    }
    indexSet = new Set(splitZ(idxOut))
  }
  const pkgDirs = buildPkgDirs(headPaths, readHeadMany)

  let files
  let contents
  if (face === 'staged') {
    const diffOut = gitOrNull(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...SCOPE_DIRS])
    if (diffOut === null) {
      console.log('❌ 未判定:取不到暂存区清单')
      return 2
    }
    files = splitZ(diffOut).sort()
    if (files.length === 0) {
      console.log('[死引用门] 面=staged · 本次暂存未触及 deploy/ 或 .github/workflows/ ⇒ 0 文件,无事可判(exit 0)')
      return 0
    }
    contents = readIndexMany(files)
  } else {
    files = enumerateWorktree()
    if (files === null) {
      console.log('❌ 未判定:枚举不到 deploy/ 或 .github/workflows/')
      return 2
    }
    // §0.4:全量面的「内容」判 HEAD blob —— 已入库文件一律按 HEAD 内容审,
    // 不掺工作树里别的会话尚未提交的改动(那由 --staged 面负责)。
    // 工作树里未入库的部署运行件(被 .gitignore 的)没有 HEAD blob,按现副本读。
    contents = new Map()
    const tracked = files.filter((p) => headSet.has(p) && !isBinaryExt(p))
    const headContents = readHeadMany(tracked)
    for (const p of files) {
      if (isBinaryExt(p)) continue
      if (headSet.has(p)) {
        contents.set(p, headContents.get(p) ?? null)
        continue
      }
      try {
        contents.set(p, readFileSync(path.join(ROOT, p), 'utf8'))
      } catch {
        contents.set(p, null)
      }
    }
  }

  const occurrences = []
  const candidateOccurrences = []
  let unreadable = 0
  for (const f of files) {
    const text = contents.get(f)
    if (typeof text !== 'string') {
      if (face === 'staged' && !isBinaryExt(f)) unreadable++
      continue
    }
    // 候选面 = 遮注释前的字面量引用(用于和「702 文件 / 1078 引用 / 156 唯一」的实测读数对齐)
    candidateOccurrences.push(...scanRefs(text, f))
    const refs = extractRefs(text, f)
    if (refs.length === 0) continue
    const kind = kindOf(f)
    const hints = buildHints(text, f, kind)
    const lines = text.split(/\r?\n/)
    for (const r of refs) {
      const lineHint = hints ? hints[r.line - 1] ?? null : null
      const res = resolveRef({
        ref: r.ref,
        file: f,
        lineText: lines[r.line - 1] ?? '',
        col: r.col,
        lineHint,
        pkgDirs,
        headSet,
        indexSet,
        worktreeExists: (p) => existsSync(path.join(ROOT, p)),
      })
      occurrences.push({ ...r, ...res })
    }
  }

  if (face === 'staged' && unreadable > 0) {
    console.log(`❌ 未判定:本次暂存有 ${unreadable} 个文件取不到索引 blob`)
    return 2
  }

  const unique = new Set(occurrences.map((o) => o.ref)).size
  const candidateUnique = new Set(candidateOccurrences.map((o) => o.ref)).size
  const textFiles = files.filter((p) => typeof contents.get(p) === 'string').length
  const counts = {
    files: files.length,
    textFiles,
    binary: files.length - textFiles,
    candidates: candidateOccurrences.length,
    candidateUnique,
    commented: candidateOccurrences.length - occurrences.length,
    refs: occurrences.length,
    unique,
    exists: occurrences.filter((o) => o.verdict === 'exists').length,
    rollback: occurrences.filter((o) => o.verdict === 'rollback').length,
    dead: occurrences.filter((o) => o.verdict === 'dead').length,
    undetermined: occurrences.filter((o) => o.verdict === 'undetermined').length,
  }
  const ms = Number((process.hrtime.bigint() - started) / 1_000_000n)

  console.log(
    `[死引用门] 面=${face === 'staged' ? 'staged(索引 blob)' : 'head 全量(内容+存在性判 HEAD;清单取工作树)'} · ` +
      `文件 ${counts.files}(文本 ${counts.textFiles}/二进制跳过 ${counts.binary}) · ` +
      `候选引用 ${counts.candidates}(唯一 ${counts.candidateUnique}) · 注释内剔除 ${counts.commented} · ` +
      `判定 ${counts.refs}(唯一 ${counts.unique}) · ` +
      `存在 ${counts.exists} · 回滚态 ${counts.rollback} · 真死 ${counts.dead} · 无法解析 ${counts.undetermined} · ` +
      `耗时 ${ms}ms`,
  )

  if (verbose) {
    for (const o of occurrences) {
      const cwdTxt = ` resolvedCwd=${o.cwd ? o.cwd : '(仓根)'}${o.reason ? ` [${o.reason}]` : ''}`
      const verdict =
        o.verdict === 'exists'
          ? `存在:${o.path}${cwdTxt}`
          : o.verdict === 'rollback'
            ? `存在(回滚态:HEAD 有、工作树缺):${o.path}${cwdTxt}`
            : o.verdict === 'dead'
              ? `不存在:${o.path}${cwdTxt}`
              : `无法解析:${o.why}`
      console.log(`  ${o.file}:${o.line} → ${o.ref} → ${verdict}`)
    }
  }

  const dead = occurrences.filter((o) => o.verdict === 'dead')
  if (dead.length > 0) {
    console.log(`❌ 真死引用 ${dead.length} 处(引用路径在 HEAD blob 里不存在):`)
    for (const o of dead.slice(0, 60)) {
      console.log(`    · ${o.file}:${o.line} → ${o.ref} → 解析到 ${o.path}(${o.reason})`)
    }
    if (dead.length > 60) console.log(`    · …另有 ${dead.length - 60} 处`)
    console.log('  出路:补上被引用的脚本,或把引用改成实际落点(相对 cwd 写清楚);不要删判据。')
  }
  const undet = occurrences.filter((o) => o.verdict === 'undetermined')
  if (undet.length > 0) {
    console.log(`❓ 无法解析 ${undet.length} 处(§0.3 未判定,不折成红也不记绿,本门 exit 2):`)
    for (const o of undet.slice(0, 40)) console.log(`    · ${o.file}:${o.line} → ${o.ref} → ${o.why}`)
    if (undet.length > 40) console.log(`    · …另有 ${undet.length - 40} 处`)
  }
  const rollback = occurrences.filter((o) => o.verdict === 'rollback')
  if (rollback.length > 0) {
    console.log(`↺ 回滚态 ${rollback.length} 处(HEAD 存在、工作树缺失 ⇒ 不算真死引用):`)
    for (const o of rollback.slice(0, 10)) console.log(`    · ${o.file}:${o.line} → ${o.ref} → ${o.path}`)
  }
  if (counts.dead === 0 && counts.undetermined === 0) {
    console.log(`✅ 真死引用 0 处、无法解析 0 处(${counts.exists} 条引用全部解析到 HEAD blob 里的真实文件)`)
  }
  return judgeReport(counts)
}

// ─── 自检 ───────────────────────────────────────────────────
function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, ok, extra = '') => {
    if (ok) { pass++; console.log(`✅ ${name}`) }
    else { fail++; console.log(`❌ ${name}${extra ? `:${extra}` : ''}`) }
  }
  const headSet = new Set([
    'scripts/alive.mjs',
    'packages/database/scripts/pre-migrate-fresh-db-guard.mjs',
    'apps/api/scripts/notify-deploy-failure.ts',
    'apps/web/scripts/gen-thing.mjs',
    'deploy/scripts/ai-diagnose.mjs',
  ])
  const pkgDirs = { '@ihui/api': 'apps/api' }
  const wt = (p) => p !== 'rollback-only/../x' && headSet.has(p)
  const resolve = (o) =>
    resolveRef({
      ...o,
      pkgDirs,
      headSet,
      indexSet: null,
      worktreeExists: o.worktreeExists ?? wt,
    })

  // ① 真死引用:工作流 run 步骤(默认 cwd = 仓根)、引用不存在 ⇒ dead
  {
    const text = ['jobs:', '  test:', '    steps:', '      - name: x', '        run: node scripts/nope.mjs', ''].join('\n')
    const refs = extractRefs(text, '.github/workflows/demo.yml')
    const hints = buildGhaHints(text)
    const r = resolve({ ref: refs[0].ref, file: '.github/workflows/demo.yml', lineText: '        run: node scripts/nope.mjs', col: refs[0].col, lineHint: hints[4] })
    t('① 真死引用判红(引用不存在 ⇒ dead)', refs.length === 1 && r.verdict === 'dead', JSON.stringify(r))
  }
  // ② 注释内引用:YAML # / JS // / 块注释 / Dockerfile # 一律不算引用
  {
    const yml = 'jobs:\n  x:\n    steps:\n      - run: echo ok # node scripts/nope.mjs\n'
    const js = 'const a = 1 // node scripts/nope.mjs\n/* node scripts/nope.mjs */\n'
    const df = '# RUN node scripts/nope.mjs\nFROM node:20\n'
    t('② 注释内引用不抽取(YAML #)', extractRefs(yml, '.github/workflows/demo.yml').length === 0)
    t('② 注释内引用不抽取(JS // 与 /* */)', extractRefs(js, 'deploy/x.mjs').length === 0)
    t('② 注释内引用不抽取(Dockerfile #)', extractRefs(df, 'deploy/docker/Dockerfile.web').length === 0)
    t('② 注释遮蔽不动行号(等长替换)', maskComments(yml, 'hash').split('\n').length === yml.split('\n').length)
  }
  // ③ cwd 相对命中:pnpm --filter @ihui/api exec tsx scripts/x.ts ⇒ apps/api/scripts/x.ts
  {
    const file = 'deploy/scripts/deploy-diagnose.sh'
    const line = 'pnpm --filter @ihui/api exec tsx scripts/notify-deploy-failure.ts --title x'
    const refs = extractRefs(line, file)
    const r = resolve({ ref: refs[0].ref, file, lineText: line, col: refs[0].col, lineHint: null })
    t('③ cwd 相对命中(pnpm --filter ⇒ 包目录)', r.verdict === 'exists' && r.path === 'apps/api/scripts/notify-deploy-failure.ts', JSON.stringify(r))
  }
  // ④ 子目录 scripts 命中:祖先目录逐级(不是整体屏蔽)
  {
    const file = 'deploy/docker/x.sh'
    const line = 'node scripts/ai-diagnose.mjs'
    const refs = extractRefs(line, file)
    const r = resolve({ ref: refs[0].ref, file, lineText: line, col: refs[0].col, lineHint: null })
    t('④ 子目录 scripts 命中(ancestor:deploy)', r.verdict === 'exists' && r.path === 'deploy/scripts/ai-diagnose.mjs', JSON.stringify(r))
  }
  // ⑤ 回滚态:HEAD 存在但工作树缺失 ⇒ rollback,不许判红
  {
    const file = 'deploy/x.sh'
    const line = 'node scripts/alive.mjs'
    const refs = extractRefs(line, file)
    const r = resolve({ ref: refs[0].ref, file, lineText: line, col: refs[0].col, lineHint: null, worktreeExists: () => false })
    t('⑤ 回滚态不判红(HEAD 有、工作树缺)', r.verdict === 'rollback' && judgeReport({ dead: 0, undetermined: 0 }) === 0, JSON.stringify(r))
  }
  // ⑥ 无法解析:Dockerfile 无 WORKDIR、shell 无 cwd 语境 ⇒ undetermined 且 exit 2
  {
    const df = 'FROM node:20\nRUN node scripts/nope.mjs\n'
    const refs = extractRefs(df, 'deploy/docker/Dockerfile.x')
    const hints = buildDockerHints(df)
    const r = resolve({ ref: refs[0].ref, file: 'deploy/docker/Dockerfile.x', lineText: 'RUN node scripts/nope.mjs', col: refs[0].col, lineHint: hints[1] })
    const sh = 'node scripts/nope.mjs\n'
    const shRefs = extractRefs(sh, 'deploy/x.sh')
    const r2 = resolve({ ref: shRefs[0].ref, file: 'deploy/x.sh', lineText: 'node scripts/nope.mjs', col: shRefs[0].col, lineHint: null })
    t('⑥ 无法解析 ⇒ undetermined,exit 2(不折红)', r.verdict === 'undetermined' && r2.verdict === 'undetermined' && judgeReport({ dead: 0, undetermined: 1 }) === 2, JSON.stringify({ r, r2 }))
    t('⑥ 动态拼接路径 ⇒ undetermined', extractRefs('node scripts/${TARGET}.mjs\n', 'deploy/x.sh').some((x) => x.dynamic))
  }
  // ⑦ 更正单:GitHub Actions working-directory(步骤级优先于 job 级 defaults)
  {
    const text = [
      'jobs:',
      '  db:',
      '    defaults:',
      '      run:',
      '        working-directory: packages/database',
      '    steps:',
      '      - name: guard',
      '        working-directory: packages/database',
      '        run: |',
      '          node scripts/pre-migrate-fresh-db-guard.mjs',
      '',
    ].join('\n')
    const refs = extractRefs(text, '.github/workflows/demo.yml')
    const hints = buildGhaHints(text)
    const r = resolve({ ref: refs[0].ref, file: '.github/workflows/demo.yml', lineText: '          node scripts/pre-migrate-fresh-db-guard.mjs', col: refs[0].col, lineHint: hints[9] })
    t('⑦ working-directory 相对引用 ⇒ 存在(step 级)', r.verdict === 'exists' && r.path === 'packages/database/scripts/pre-migrate-fresh-db-guard.mjs' && /working-directory/.test(r.reason), JSON.stringify(r))
    const jobOnly = [
      'jobs:',
      '  db:',
      '    defaults:',
      '      run:',
      '        working-directory: packages/database',
      '    steps:',
      '      - name: guard',
      '        run: node scripts/pre-migrate-fresh-db-guard.mjs',
      '',
    ].join('\n')
    const refs2 = extractRefs(jobOnly, '.github/workflows/demo.yml')
    const hints2 = buildGhaHints(jobOnly)
    const r2 = resolve({ ref: refs2[0].ref, file: '.github/workflows/demo.yml', lineText: '        run: node scripts/pre-migrate-fresh-db-guard.mjs', col: refs2[0].col, lineHint: hints2[7] })
    t('⑦ working-directory 相对引用 ⇒ 存在(job 级 defaults)', r2.verdict === 'exists' && r2.path === 'packages/database/scripts/pre-migrate-fresh-db-guard.mjs', JSON.stringify(r2))
  }
  // ⑧ cd 形式:同行 cd 与跨行 cd
  {
    const line = 'cd packages/database && node scripts/pre-migrate-fresh-db-guard.mjs'
    const refs = extractRefs(line, 'deploy/x.sh')
    const r = resolve({ ref: refs[0].ref, file: 'deploy/x.sh', lineText: line, col: refs[0].col, lineHint: null })
    t('⑧ 同行 cd 参与解析', r.verdict === 'exists' && /^cd:/.test(r.reason), JSON.stringify(r))
  }
  // ⑨ Dockerfile WORKDIR 参与解析
  {
    const df = 'FROM node:20\nWORKDIR deploy\nRUN node scripts/ai-diagnose.mjs\n'
    const refs = extractRefs(df, 'deploy/docker/Dockerfile.x')
    const hints = buildDockerHints(df)
    const r = resolve({ ref: refs[0].ref, file: 'deploy/docker/Dockerfile.x', lineText: 'RUN node scripts/ai-diagnose.mjs', col: refs[0].col, lineHint: hints[2] })
    t('⑨ Dockerfile WORKDIR 参与解析', r.verdict === 'exists' && r.path === 'deploy/scripts/ai-diagnose.mjs', JSON.stringify(r))
  }
  // ⑩ 退出码合成:未判定优先于真死
  t('⑩ 退出码:有未判定 ⇒ 2(不折成 1)', judgeReport({ dead: 3, undetermined: 1 }) === 2)
  t('⑩ 退出码:只有真死 ⇒ 1', judgeReport({ dead: 1, undetermined: 0 }) === 1)
  t('⑩ 退出码:全绿 ⇒ 0', judgeReport({ dead: 0, undetermined: 0 }) === 0)

  console.log(`--self-test: ${pass}/${pass + fail} 通过`)
  return fail === 0 ? 0 : 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    process.exitCode = selfTest()
  } else {
    const face = argv.includes('--staged') ? 'staged' : 'worktree'
    process.exitCode = audit({ face, verbose: argv.includes('--verbose') })
  }
}

export const __test__ = {
  maskComments,
  commentStyleFor,
  extractRefs,
  scanRefs,
  buildGhaHints,
  buildShellHints,
  buildDockerHints,
  buildHints,
  kindOf,
  pnpmFilterPkg,
  cdBefore,
  candidatesFor,
  resolveRef,
  judgeReport,
  SELF_SKIP_ENV,
  SELF_REL,
  TEST_REL,
  SCOPE_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
