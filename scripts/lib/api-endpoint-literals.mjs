// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * api-endpoint-literals.mjs — 「端内直拼 API 路径字面量」静态提取器(任务 B 唯一实现)。
 *
 * 为什么单独成层:`scripts/check-api-endpoint-delta.mjs`(门)与 `scripts/tests/*.test.mjs`
 * 必须用**同一把尺**,否则「门红了、单测绿」会同时成立。本层只做提取与归一,不做裁决。
 *
 * 识别的形态(正例见 scripts/tests/api-endpoint-delta.test.mjs):
 *   形1 `call-literal`    : 调用实参位上的引号字面量 —— fetch('/api/x') / http.get('/api/x')
 *   形2 `request-url`     : 对象 url 属性位 —— request({ url: '/api/y' }) / Taro.request({ url: ... })
 *   形3 `const-def`       : 同文件常量定义位 —— const P = '/api/z';fetch(P)(后续按 const-ref 回填)
 *   形4 `template`        : 模板串(含 `${}` 插值),归一成 `:param`
 *   形5 `const-ref`       : 调用实参是标识符,同文件 const 可解析成字面量 ⇒ 回填路径
 *   形6 `shared-indirect`: 实参标识符来自 `@ihui/api-client` ⇒ 是共享端点消费,不是端内直拼
 *   形7 `unknown`         : 直接传输调用点,但 URL 实参是变量/形参且同文件解不出 ⇒ **未判定**,
 *                          单独计数并逐条落账(绝不折成「没有」)
 *   形8 `bare-literal`    : 不在上述结构位、但仍是 `/api/...` 字面量的其它出现(如路由表/正则)
 *
 * 归一:去掉 query/hash;`${…}` → `:param`;字面量中的转义 `\$` 去掉。
 * 前缀:默认取 `/api/<seg1>`(`PREFIX_DEPTH = 1`)。depth=2 的读数由 --depth 旗标给出,
 *       便于与历史盘点口径对齐(见 check-api-endpoint-delta.mjs 头注)。
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

/** 端 → 源码根。test/story 文件默认**不在射程**(它们是夹具,不是生产直拼)。 */
export const END_DIRS = {
  web: 'apps/web',
  rn: 'apps/mobile-rn',
  mp: 'apps/miniapp-taro',
}

/** 共享端点真源目录(单一实现:pakcages/api-client/src/endpoints 内的 `fetchApi` 字面量)。 */
export const SHARED_ENDPOINT_DIR = 'packages/api-client/src/endpoints'

/** 共享客户端包名:实参来自它的调用点记为 shared-indirect,不算端内直拼。 */
export const SHARED_CLIENT_PKG = '@ihui/api-client'

const CODE_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIR_RE =
  /(?:^|\/)(?:node_modules|\.next|\.nuxt|dist|build|coverage|\.turbo|\.output|\.cache|\.tmp[^/]*)(?:\/|$)/
const TEST_FILE_RE = /(?:\.test\.|\.spec\.|__tests__\/|\.stories\.|\.story\.|\.d\.ts$)/

/** 默认前缀深度:1 ⇒ `/api/<seg1>`。 */
export const PREFIX_DEPTH = 1

export function isCodeFile(rel) {
  const p = rel.replace(/\\/g, '/')
  return CODE_RE.test(p) && !SKIP_DIR_RE.test(p)
}

export function isTestFile(rel) {
  return TEST_FILE_RE.test(rel.replace(/\\/g, '/'))
}

/** 仓库根下的文件清单(相对路径、正斜杠、排序)。dir 不存在 ⇒ 返回空数组(调用方判未判定)。 */
export function walkFiles(root, dir, { includeTests = false, listFiles = null } = {}) {
  if (typeof listFiles === 'function') {
    return listFiles(dir)
      .filter(isCodeFile)
      .filter((f) => includeTests || !isTestFile(f))
      .sort()
  }
  const out = []
  const stack = [join(root, dir)]
  while (stack.length) {
    const cur = stack.pop()
    // 读不到目录 ⇒ 原样抛给调用方(折空集会被读成「该端没有直拼」,§0.3)
    const entries = readdirSync(cur, { withFileTypes: true })
    for (const ent of entries) {
      const abs = join(cur, ent.name)
      if (ent.isDirectory()) {
        if (SKIP_DIR_RE.test(relPath(root, abs))) continue
        stack.push(abs)
      } else if (isCodeFile(relPath(root, abs))) {
        if (!includeTests && isTestFile(relPath(root, abs))) continue
        out.push(relPath(root, abs))
      }
    }
  }
  return out.sort()
}

function relPath(root, abs) {
  return relative(root, abs).replace(/\\/g, '/')
}

/**
 * 把模板串插值 `${...}` 换成 `:param`(支持嵌套花括号,如 `${buildQs({ a })}`)。
 * 不能用简单正则 `[^}]*` —— 会把 `buildQs({...})` 截成半截,留下 `(` 被误判成正则。
 */
export function stripInterpolations(s) {
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s[i] === '$' && s[i + 1] === '{') {
      let depth = 1
      let j = i + 2
      while (j < s.length && depth > 0) {
        const c = s[j]
        if (c === '{') depth++
        else if (c === '}') depth--
        j++
      }
      out += ':param'
      i = j
    } else {
      out += s[i]
      i++
    }
  }
  return out
}

/**
 * 归一化路径:去 query/hash、插值→`:param`、去转义 `\$`、保证以 `/api` 开头。
 * @param {string} raw 形如 `/api/ai/models/${id}?a=1`
 */
export function normalizePath(raw) {
  if (typeof raw !== 'string') return null
  const p0 = raw
    .replace(/\\\$/g, '$')
    .split('?')[0]
    .split('#')[0]
    .trim()
  if (!/^\/api(?:\/|$|[?#])/.test(p0)) return null
  let p = stripInterpolations(p0)
  p = p.replace(/([^/]):param/g, '$1/:param')
  // 正则/通配符形态(例:中间件 matcher `/api/(.*)`)不是端点,不参与差集
  if (/[()*+?^|[\]\\$]/.test(p)) return null
  p = p.replace(/\/{2,}/g, '/')
  if (p.length > 1) p = p.replace(/\/$/, '')
  return p
}

/**
 * 共享端点文件内的路径字面量归一。
 *
 * `packages/api-client/src/client.ts` 的 resolveUrl 对所有相对路径补 `/api` 前缀
 * (例如 `fetchApi('/srs/streams')` 实际请求 `/api/srs/streams`)。因此共享端点清单里
 * 的相对字面量必须归一到 `/api/...`,否则端内写全路径(`/api/srs/streams`)会被误判成
 * 「端内独有前缀」——这是门 300 的假阳性来源。
 */
export function normalizeSharedPath(raw) {
  if (typeof raw !== 'string') return null
  const p0 = raw
    .replace(/\\\$/g, '$')
    .split('?')[0]
    .split('#')[0]
    .trim()
  if (!p0.startsWith('/')) return null
  if (/^\/api(?:\/|$)/.test(p0)) return normalizePath(p0)
  if (p0 === '/' || p0.startsWith('//')) return null
  return normalizePath('/api' + p0)
}

/** 共享端点文件内允许「相对路径字面量」的调用标记(避免把普通字符串误收)。 */
const SHARED_CALL_RE = /(?:fetchApi|fetchAiServiceJson|fetchWithAuthRefresh)\s*(?:<[^>]*>)?\s*\(/

/** 前缀:默认 `/api/<seg1>`;depth=2 ⇒ `/api/<seg1>/<seg2>`。 */
export function prefixOf(normalized, depth = PREFIX_DEPTH) {
  if (!normalized) return null
  const segs = normalized.split('/').filter(Boolean)
  return '/' + segs.slice(0, depth + 1).join('/')
}

/**
 * 路径的段数组。用于「共享端点是否覆盖该字面量」的判定:
 *   - `exact`  : 段数相同,且逐段相等(共享侧的 `:param` 通配任意非空段)
 *   - `prefix` : 本端点字面量比某共享路径更短(共享侧在其下继续有端点)
 *   - `none`   : 无覆盖
 */
export function sharedCoverage(normalized, sharedPaths) {
  if (!normalized) return { kind: 'none', via: null }
  const a = normalized.split('/').filter(Boolean)
  for (const sp of sharedPaths) {
    const b = sp.split('/').filter(Boolean)
    if (a.length === b.length && matchSegs(a, b)) return { kind: 'exact', via: sp }
  }
  for (const sp of sharedPaths) {
    const b = sp.split('/').filter(Boolean)
    if (a.length < b.length && matchSegs(a, b.slice(0, a.length))) {
      return { kind: 'prefix', via: sp }
    }
  }
  return { kind: 'none', via: null }
}

function matchSegs(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (b[i] === ':param') continue
    if (a[i] === ':param') continue
    if (a[i] !== b[i]) return false
  }
  return true
}

const QUOTE = ['"', "'", '`']

function isQuote(ch) {
  return QUOTE.includes(ch)
}

/**
 * 从一行代码里扫出 `/api` 字面量(含模板串),返回 [{raw, normalized, col, startInLine}]。
 * 不做跨行模板串(项目内跨行 URL 模板极少;跨行时该行会被记为未判定,不会静默漏掉:
 * `unknownCallSites` 会把「直接传输调用点 + 非字面量实参」逐条列出)。
 */
export function scanLineLiterals(line) {
  const out = []
  const s = line
  for (let i = 0; i < s.length; i++) {
    const q = s[i]
    if (!isQuote(q)) continue
    let j = i + 1
    let raw = ''
    let closed = false
    while (j < s.length) {
      const c = s[j]
      if (c === '\\') {
        raw += c + (s[j + 1] ?? '')
        j += 2
        continue
      }
      if (c === q) {
        closed = true
        break
      }
      raw += c
      j++
    }
    if (!closed) {
      // 未闭合 = 本行看不全(多为跨行模板/拼接)⇒ 记未判定线索,不当「没有」
      if (/\/api/.test(s.slice(i))) out.push({ raw: s.slice(i), normalized: null, col: i, unclosed: true })
      break
    }
    if (/^\/api(?:\/|$|['"`\s?])/.test(raw)) {
      const normalized = normalizePath(raw)
      if (normalized) out.push({ raw, normalized, col: i })
      else out.push({ raw, normalized: null, col: i, suspicious: true })
    }
    i = j // 跳过已消费的字符串
  }
  return out
}

/** 取字面量前的紧邻结构位(用于形态归档,不影响是否计入)。 */
function positionOf(line, col) {
  const before = line.slice(0, col)
  if (/url\s*:\s*$/.test(before)) return 'request-url'
  if (/\)\s*\.\s*(?:get|post|put|delete|patch|head|options)?\s*\(\s*$/.test(before) || /[(,]\s*$/.test(before))
    return 'call-literal'
  if (/=\s*$/.test(before)) return 'const-def'
  if (/:\s*$/.test(before) || /\[\s*$/.test(before) || /,\s*$/.test(before)) return 'object-literal'
  if (/\+/.test(before)) return 'concat'
  return 'bare-literal'
}

/** 同文件常量表:`const NAME = 'literal'`(只收 `/api` 开头的,避免把普通常量当 URL)。 */
export function collectConstPaths(text) {
  const out = new Map()
  for (const line of text.split('\n')) {
    const m = line.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]\s*(['"`])(\/api[^'"`]*)\2/)
    if (m) out.set(m[1], m[3])
  }
  return out
}

/** 从 `@ihui/api-client` import 进来的标识符集合(单行/多行 import 都认)。 */
export function collectSharedClientBindings(text) {
  const out = new Set()
  const re = new RegExp(
    'import\\s+([\\s\\S]*?)\\s+from\\s+[\'"]' + SHARED_CLIENT_PKG.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]',
    'g',
  )
  for (const m of text.matchAll(re)) {
    const spec = m[1]
    for (const n of spec.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) out.add(n[1])
  }
  return out
}

const DIRECT_CALL_RE =
  /\bfetch(?:Api)?\s*\(\s*([A-Za-z_$][\w$]*)\s*(?:[,)])|\b(?:Taro|wx|my|tt|swan|qq|ks|uni)\.request\s*\(\s*\{\s*url\s*:\s*([A-Za-z_$][\w$]*)|\.request\s*\(\s*\{\s*url\s*:\s*([A-Za-z_$][\w$]*)/g

/**
 * 提取一个端目录的全部直拼点。
 * @returns {{ rows: Row[], unknowns: Row[], files: number, filesWithLiteral: number }}
 * Row: { end, file, line, col, form, raw, normalized, prefix, sharedKind, sharedVia, unknownReason? }
 */
export function extractEndpoints(root, end, dir, { includeTests = false, listFiles = null, readFile = null } = {}) {
  const files = walkFiles(root, dir, { includeTests, listFiles })
  if (files.length === 0) throw new Error(`endpoint-scan: ${end} 目录 ${dir} 枚举到 0 个源码文件`)
  const rows = []
  const unknowns = []
  let filesWithLiteral = 0
  for (const rel of files) {
    const text = typeof readFile === 'function' ? readFile(rel) : readText(root, rel)
    if (text === null || text === undefined) throw new Error(`endpoint-scan: ${end} 取不到正文 ${rel}`)
    const consts = collectConstPaths(text)
    const sharedBindings = collectSharedClientBindings(text)
    let hit = false
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
      const lits = scanLineLiterals(line)
      for (const lit of lits) {
        if (!lit.normalized) {
          unknowns.push({
            end,
            file: rel,
            line: i + 1,
            col: lit.col,
            form: 'unknown',
            raw: lit.raw.slice(0, 160),
            unknownReason: '路径字面量含正则/通配符/非法段 ⇒ 不是可对账端点(未判定)',
          })
          continue
        }
        hit = true
        const form = lit.unclosed ? 'unclosed-literal' : positionOf(line, lit.col)
        rows.push({
          end,
          file: rel,
          line: i + 1,
          col: lit.col,
          form: form === 'const-def' ? 'const-def' : /`/.test(lit.raw) ? 'template' : form,
          raw: lit.raw.slice(0, 160),
          normalized: lit.normalized,
          prefix: lit.normalized ? prefixOf(lit.normalized) : null,
        })
      }
      // 变量/常量透传:同一行有直接传输调用但实参不是字面量
      for (const m of line.matchAll(DIRECT_CALL_RE)) {
        const ident = m[1] || m[2] || m[3]
        if (!ident) continue
        if (consts.has(ident) || sharedBindings.has(ident)) continue
        unknowns.push({
          end,
          file: rel,
          line: i + 1,
          col: m.index ?? 0,
          form: 'unknown',
          raw: line.trim().slice(0, 160),
          ident,
          unknownReason: sharedBindings.has(ident)
            ? 'shared-client-binding'
            : '不可解析的 URL 实参(变量/形参/跨文件常量)',
        })
      }
      // const-ref 回填:调用位上的标识符若同文件有 /api 常量,计入一行(避免「常量定义」被当成唯一证据)
      for (const m of line.matchAll(DIRECT_CALL_RE)) {
        const ident = m[1] || m[2] || m[3]
        if (!ident || !consts.has(ident)) continue
        const normalized = normalizePath(consts.get(ident))
        if (!normalized) continue
        hit = true
        rows.push({
          end,
          file: rel,
          line: i + 1,
          col: m.index ?? 0,
          form: 'const-ref',
          raw: consts.get(ident),
          normalized,
          prefix: prefixOf(normalized),
          viaConst: ident,
        })
      }
    }
    if (hit) filesWithLiteral++
  }
  return { rows, unknowns, files: files.length, filesWithLiteral }
}

function readText(root, rel) {
  return readFileSync(join(root, rel), 'utf8')
}

/**
 * 共享端点清单:`packages/api-client/src/endpoints/**` 里的 `/api` 字面量。
 * 返回 {paths: string[] (去重、排序), occurrences: [{file,line,raw,normalized,prefix}]}
 */
export function extractSharedEndpoints(root, { listFiles = null, readFile = null } = {}) {
  const files = walkFiles(root, SHARED_ENDPOINT_DIR, { includeTests: false, listFiles })
  if (files.length === 0) throw new Error(`endpoint-scan: 共享端点目录 ${SHARED_ENDPOINT_DIR} 枚举到 0 个文件`)
  const occurrences = []
  for (const rel of files) {
    const text = typeof readFile === 'function' ? readFile(rel) : readText(root, rel)
    if (text === null || text === undefined) throw new Error(`endpoint-scan: 共享端点取不到正文 ${rel}`)
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue
      // 相对路径必须落在 fetchApi/fetchAiServiceJson 调用参数位(含跨行实参),
      // 否则普通字符串(如 UI 文案 `/xxx`)会被误收成共享端点。
      const prev = (lines[i - 1] ?? '').trim()
      const prev2 = (lines[i - 2] ?? '').trim()
      const callHere =
        SHARED_CALL_RE.test(line) ||
        (SHARED_CALL_RE.test(prev) && prev.endsWith('(')) ||
        (prev.endsWith('(') && SHARED_CALL_RE.test(prev2))
      const found = new Map()
      for (const lit of scanLineLiterals(line)) {
        if (lit.normalized) found.set(lit.normalized, lit.raw)
      }
      // 共享端点里常见 `${base}/api/memory` 这类「baseURL 拼接」写法:字面量不以 `/` 开头,
      // 但仍指向 /api 端点。只收字符串内出现的 `/api/...` 子串,避免把整串 URL 或注释算进来。
      for (const m of line.matchAll(/\/api(?:\/[^'"`\s\\]*)?/g)) {
        const normalized = normalizePath(m[0])
        if (normalized && !found.has(normalized)) found.set(normalized, m[0])
      }
      // 相对路径必须落在 fetchApi/fetchAiServiceJson 调用参数位(含跨行实参),否则普通字符串误收。
      if (callHere) {
        for (const m of line.matchAll(/['"`](\/[^'"`\s]*)/g)) {
          const raw = m[1]
          if (/^\/api(?:\/|$)/.test(raw)) continue // 绝对路径已由 scanLineLiterals 收录
          const normalized = normalizeSharedPath(raw)
          if (normalized && !found.has(normalized)) found.set(normalized, raw)
        }
      }
      for (const [normalized, raw] of found) {
        occurrences.push({ file: rel, line: i + 1, raw: raw.slice(0, 160), normalized, prefix: prefixOf(normalized) })
      }
    }
  }
  const paths = [...new Set(occurrences.map((o) => o.normalized))].sort()
  return { paths, occurrences }
}

/** 端内独有前缀 = 该端出现、但共享端点清单里没有任何路径以该前缀开头的那些。 */
export function uniquePrefixes(rows, sharedPrefixes) {
  const uniq = new Set()
  for (const r of rows) {
    if (!r.prefix) continue
    if (sharedPrefixes.has(r.prefix)) continue
    uniq.add(r.prefix)
  }
  return [...uniq].sort()
}

export function sharedPrefixSet(sharedPaths, depth = PREFIX_DEPTH) {
  return new Set(sharedPaths.map((p) => prefixOf(p, depth)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
