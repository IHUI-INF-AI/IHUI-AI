#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Static HTTP endpoint scanner for apps/api/src/routes/**/*.ts
// Node-only (builtins only, ESM), no npm dependencies.
// Run: node scripts/scan-api-routes.mjs [--report-only]
//
// ## 精度边界(2026-11-09 实测,必须随产物一起读)
// 本器只覆盖 **apps/api/src/routes/**/*.ts 的 Fastify 挂载图**。同仓另有一份更宽的后端路由
// 取值实现 `scripts/check-api-routes.mjs` 的 `extractBackendRoutes()`,它额外含 FastAPI(Python 路由)
// 与边缘改写派生,实测 **5730 条** vs 本器 **5514 条**。两份都是"从源码抽端点",属已知的取值重复:
//   · 为什么不合并:`check-api-routes.mjs` 是顶层直接执行的 4600+ 行判据脚本(零 export、无 main 守卫),
//     复用只能 spawn 子进程并等它跑完整轮对账(实测 41s);而本器的设计前提是"零依赖、可独立秒级运行",
//     两者前提冲突。合并的代价大于收益,故保留两份、在此显式登记。
//   · 漂移后果:本器清单**不含** FastAPI 与边缘改写的端点 ⇒ 消费方(gen-ai-tools-from-routes.mjs 的存在性
//     校验)对这两类路径会误报"不存在"。目前唯一消费域 hr 是纯 Fastify,已 14/14 逐条对账通过。
//   · 收敛出路(债,不是缺陷):把 `extractBackendRoutes` 抽到 `scripts/lib/` 共用,两器都改 import;
//     前置条件是先给 check-api-routes 加 main 守卫并拆掉顶层副作用。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { gitBinary, readWorktreeFile } from './lib/face-reader.mjs'
import { renderPin } from './lib/generated-input-pin.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ROUTES_DIR = path.join(ROOT, 'apps', 'api', 'src', 'routes')
const WATERMARK_SRC = path.join(ROOT, 'packages', 'design-tokens', 'src', 'index.ts')
const OUT_FILE = path.join(ROOT, 'apps', 'cli', 'src', 'tools', 'api-endpoints.generated.ts')
const INDEX_FILE = path.join(ROUTES_DIR, 'index.ts')
const REPORT_ONLY = process.argv.includes('--report-only')

const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const INSTANCES = '(?:server|fastify|app|instance|s|sub|f)'
const REGISTER_SRC = '\\b' + INSTANCES + '\\s*\\.\\s*register\\s*\\('
const ROUTE_SRC = '\\b' + INSTANCES + '\\s*\\.\\s*route\\s*\\('
const BASE_INSTANCES = ['server', 'fastify', 'app', 'instance', 's', 'sub', 'f']
const KEYWORD_RE_START = new Set([
  'return',
  'case',
  'throw',
  'typeof',
  'yield',
  'await',
  'delete',
  'void',
  'in',
  'of',
  'instanceof',
  'new',
  'else',
  'do',
])

const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/')

// ---------------------------------------------------------------------------
// Source masking: produce a structural view (strings/comments/regex -> spaces,
// same length/indices) plus a per-position "is real code" byte array.
//   M    : used for bracket balancing and .register(/.route( detection (no
//          false positives from inside strings or comments)
//   code : 1 for real code chars, 0 for comment/string chars (regex regions
//          stay 1). Used to filter shorthand/import matches that fall inside
//          comments or string literals.
// ---------------------------------------------------------------------------
function maskSource(text) {
  const n = text.length
  const M = text.split('')
  const code = new Uint8Array(n)
  code.fill(1)
  const clr = (k) => {
    if (text[k] !== '\n' && text[k] !== '\r') M[k] = ' '
  }
  const clrCode = (k) => {
    clr(k)
    code[k] = 0
  }

  const isRegexStart = (i) => {
    let j = i - 1
    while (j >= 0 && (M[j] === ' ' || M[j] === '\n' || M[j] === '\r' || M[j] === '\t')) j--
    if (j < 0) return true
    const prev = M[j]
    if ('=(,[!:;&|?{}+-*%~^<>'.includes(prev)) return true
    let ws = j
    while (ws >= 0 && /[A-Za-z0-9_$]/.test(M[ws])) ws--
    const word = M.slice(ws + 1, j + 1)
    return KEYWORD_RE_START.has(word)
  }

  let i = 0
  while (i < n) {
    const c = text[i]
    // line comment
    if (c === '/' && text[i + 1] === '/') {
      let j = i
      while (j < n && text[j] !== '\n') {
        clrCode(j)
        j++
      }
      i = j
      continue
    }
    // block comment
    if (c === '/' && text[i + 1] === '*') {
      clrCode(i)
      clrCode(i + 1)
      let j = i + 2
      while (j < n) {
        if (text[j] === '*' && text[j + 1] === '/') {
          clrCode(j)
          clrCode(j + 1)
          j += 2
          break
        }
        clrCode(j)
        j++
      }
      i = j
      continue
    }
    // string / template literal (mask whole literal incl. ${...} to spaces)
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      clrCode(i)
      let j = i + 1
      while (j < n) {
        if (text[j] === '\\') {
          clrCode(j)
          j++
          if (j < n) {
            clrCode(j)
            j++
          }
          continue
        }
        if (text[j] === q) {
          clrCode(j)
          j++
          break
        }
        clrCode(j)
        j++
      }
      i = j
      continue
    }
    // regex literal (mask in M only, keep code=1 so any real token stays visible)
    if (c === '/' && isRegexStart(i)) {
      let j = i + 1
      let inClass = false
      let closed = -1
      while (j < n) {
        const d = text[j]
        if (d === '\\') {
          j += 2
          continue
        }
        if (d === '[') inClass = true
        else if (d === ']') inClass = false
        else if (d === '/' && !inClass) {
          closed = j
          break
        } else if (d === '\n') break
        j++
      }
      if (closed >= 0) {
        for (let k = i; k <= closed; k++) clr(k)
        let f = closed + 1
        while (f < n && /[a-z]/i.test(text[f])) {
          clr(f)
          f++
        }
        i = f
        continue
      }
    }
    i++
  }
  return { M: M.join(''), code }
}

function findCallClose(M, from) {
  let depth = 0
  for (let i = from; i < M.length; i++) {
    const c = M[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

function findBraceClose(M, from) {
  let d = 0
  for (let i = from; i < M.length; i++) {
    if (M[i] === '{') d++
    else if (M[i] === '}') {
      d--
      if (d === 0) return i
    }
  }
  return -1
}

function splitArgs(M, innerStart, innerEnd) {
  const args = []
  let depth = 0
  let start = innerStart
  for (let i = innerStart; i < innerEnd; i++) {
    const c = M[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      args.push([start, i])
      start = i + 1
    }
  }
  args.push([start, innerEnd])
  return args
}

function findCalls(M, text, src) {
  const out = []
  const re = new RegExp(src, 'g')
  let m
  while ((m = re.exec(M))) {
    const openParen = m.index + m[0].length - 1
    const closeParen = findCallClose(M, openParen)
    if (closeParen < 0) continue
    out.push({
      start: m.index,
      openParen,
      closeParen,
      innerStart: openParen + 1,
      innerEnd: closeParen,
    })
  }
  return out
}

function extractLastPrefix(text, code, from, to) {
  const seg = text.slice(from, to)
  const re = /prefix\s*:\s*(['"`])([^'"`]*)\1/g
  let m
  let last = ''
  while ((m = re.exec(seg))) {
    if (code[from + m.index] === 0) continue
    last = m[2]
  }
  return last
}

function classifyArg(structText) {
  const t = structText.trim()
  if (t === '') return { kind: 'empty' }
  if (t[0] === '{') return { kind: 'object' }
  if (
    /^(async|function)\b/.test(t) ||
    (/^[(]/.test(t) && t.includes('=>')) ||
    /^[A-Za-z_$][\w$]*\s*=>/.test(t)
  ) {
    return { kind: 'inline' }
  }
  let m = /^([A-Za-z_$][\w$]*)\s*\(/.exec(t)
  if (m) return { kind: 'factory', name: m[1] }
  m = /^([A-Za-z_$][\w$]*)$/.exec(t)
  if (m) return { kind: 'identifier', name: m[1] }
  return { kind: 'other' }
}

function findInlineBody(M, a1s, a1e) {
  const seg = M.slice(a1s, a1e)
  const arrow = seg.indexOf('=>')
  const searchFrom = arrow >= 0 ? arrow + 2 : 0
  let brace = -1
  for (let i = searchFrom; i < seg.length; i++) {
    if (seg[i] === '{') {
      brace = a1s + i
      break
    }
  }
  if (brace < 0) return null
  const close = findBraceClose(M, brace)
  if (close < 0 || close > a1e) return null
  return [brace, close]
}

function resolveSpecifier(spec, fromFile) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = []
  if (base.endsWith('.js')) {
    candidates.push(base.slice(0, -3) + '.ts')
    candidates.push(base.slice(0, -3) + path.sep + 'index.ts')
  } else {
    candidates.push(base + '.ts')
    candidates.push(path.join(base, 'index.ts'))
  }
  for (const c of candidates) if (fs.existsSync(c)) return c
  return null
}

function addClause(clause, target, map) {
  const braceOpen = clause.indexOf('{')
  if (braceOpen >= 0) {
    const before = clause.slice(0, braceOpen).trim().replace(/,\s*$/, '').trim()
    if (/^[A-Za-z_$][\w$]*$/.test(before)) map.set(before, { file: target, orig: 'default' })
    const inner = clause.slice(braceOpen + 1, clause.lastIndexOf('}'))
    for (let part of inner.split(',')) {
      part = part.trim().replace(/^type\s+/, '')
      if (!part) continue
      const asM = /^([\s\S]*?)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part)
      const orig = asM ? asM[1].trim() : part
      const local = asM ? asM[2].trim() : part
      if (/^[A-Za-z_$][\w$]*$/.test(local)) map.set(local, { file: target, orig })
    }
  } else if (/^\*\s+as\s+([A-Za-z_$][\w$]*)$/.test(clause.trim())) {
    const local = clause.trim().match(/as\s+([A-Za-z_$][\w$]*)$/)[1]
    map.set(local, { file: target, orig: '*' })
  } else {
    const local = clause.trim()
    if (/^[A-Za-z_$][\w$]*$/.test(local)) map.set(local, { file: target, orig: 'default' })
  }
}

function parseImports(text, code, file) {
  const map = new Map()
  // static imports (incl. mixed `import Default, { named } from`)
  const re = /\bimport\s+(?!type\s)([^;]*?)\s+from\s*(['"`])([^'"`]*)\2/g
  let m
  while ((m = re.exec(text))) {
    if (code[m.index] === 0) continue
    const target = resolveSpecifier(m[3], file)
    if (!target) continue
    addClause(m[1], target, map)
  }
  return map
}

function parseDynamicImports(text, code, file, map) {
  // const { default: NAME } = await import('./x.js')  /  const NAME = await import('./x.js')
  const re =
    /\b(?:const|let|var)\s+([^=;]{1,80}?)\s*=\s*(?:await\s+)?import\s*\(\s*(['"`])([^'"`]*)\2\s*\)/g
  let m
  while ((m = re.exec(text))) {
    if (code[m.index] === 0) continue
    const target = resolveSpecifier(m[3], file)
    if (!target) continue
    const lhs = m[1].trim()
    if (lhs.startsWith('{')) {
      const inner = lhs.slice(1, lhs.lastIndexOf('}'))
      for (let part of inner.split(',')) {
        part = part.trim()
        if (!part) continue
        const colon = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)$/.exec(part)
        const orig = colon ? colon[1] : part
        const local = colon ? colon[2] : part
        if (/^[A-Za-z_$][\w$]*$/.test(local)) map.set(local, { file: target, orig })
      }
    } else if (/^[A-Za-z_$][\w$]*$/.test(lhs)) {
      map.set(lhs, { file: target, orig: 'default' })
    }
  }
}

function collectLocalNames(text, code) {
  const set = new Set()
  const re = /\b(?:const|let|var|function|export\s+const)\s+([A-Za-z_$][\w$]*)\s*[=:(]/g
  let m
  while ((m = re.exec(text))) {
    if (code[m.index] === 0) continue
    set.add(m[1])
  }
  return set
}

function parseReexports(text, code, file) {
  const list = []
  const re = /\bexport\s+(?!type\s)(\{[^}]*\})\s*from\s*(['"`])([^'"`]*)\2/g
  let m
  while ((m = re.exec(text))) {
    if (code[m.index] === 0) continue
    const target = resolveSpecifier(m[3], file)
    if (!target) continue
    const inner = m[1].slice(1, -1)
    for (let part of inner.split(',')) {
      part = part.trim().replace(/^type\s+/, '')
      if (!part) continue
      const asM = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part)
      const orig = asM ? asM[1] : part
      const exported = asM ? asM[2] : part
      list.push({ exported, orig, file: target })
    }
  }
  return list
}

function inlineParam(arg1Text) {
  let m = /\(\s*([A-Za-z_$][\w$]*)/.exec(arg1Text)
  if (m) return m[1]
  m = /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/.exec(arg1Text.trim())
  if (m) return m[1]
  return null
}

function parseShorthand(text, code, names) {
  const out = []
  const alts = [...new Set(names)].sort((a, b) => b.length - a.length).join('|')
  const re = new RegExp(
    '\\b(?:' +
      alts +
      ')\\.(get|post|put|patch|delete|head|options)\\s*\\(\\s*([\'"`])([^\'"`\\r\\n]*)\\2',
    'g',
  )
  let m
  while ((m = re.exec(text))) {
    if (code[m.index] === 0) continue
    const url = m[3]
    if (url !== '' && !url.startsWith('/')) continue
    out.push({ pos: m.index, method: m[1].toUpperCase(), url })
  }
  return out
}

function parseRouteCalls(M, text) {
  const out = []
  const re = new RegExp(ROUTE_SRC, 'g')
  let m
  while ((m = re.exec(M))) {
    const openParen = m.index + m[0].length - 1
    let objStart = -1
    for (let i = openParen + 1; i < M.length; i++) {
      if (M[i] === '{') {
        objStart = i
        break
      }
      if (M[i] === ')') break
    }
    if (objStart < 0) continue
    const objEnd = findBraceClose(M, objStart)
    if (objEnd < 0) continue
    const objText = text.slice(objStart, objEnd + 1)
    const urlM = /url\s*:\s*(['"`])([^'"`]*)\1/.exec(objText)
    if (!urlM) continue
    const methodM = /method\s*:\s*(\[[^\]]*\]|['"`][A-Za-z]+['"`])/.exec(objText)
    const methods = []
    if (methodM) {
      const v = methodM[1]
      if (v.startsWith('[')) {
        for (const q of v.matchAll(/['"`]([A-Za-z]+)['"`]/g)) {
          const mm = q[1].toUpperCase()
          if (VALID_METHODS.has(mm)) methods.push(mm)
        }
      } else {
        const mm = v.replace(/^['"`]|['"`]$/g, '').toUpperCase()
        if (VALID_METHODS.has(mm)) methods.push(mm)
      }
    }
    if (methods.length === 0) methods.push('GET')
    out.push({ pos: m.index, url: urlM[2], methods })
  }
  return out
}

const fileCache = new Map()
function getFile(abs) {
  if (fileCache.has(abs)) return fileCache.get(abs)
  const text = readWorktreeFile(ROOT, rel(abs)) ?? ''
  const { M, code } = maskSource(text)
  const imports = parseImports(text, code, abs)
  parseDynamicImports(text, code, abs, imports)
  const localNames = collectLocalNames(text, code)
  const reexports = parseReexports(text, code, abs)
  const regCalls = findCalls(M, text, REGISTER_SRC)
  const inlineParams = []
  for (const c of regCalls) {
    c.args = splitArgs(M, c.innerStart, c.innerEnd)
    // prefix lives in an options object argument only
    let pref = ''
    for (let k = c.args.length - 1; k >= 0; k--) {
      const seg = M.slice(c.args[k][0], c.args[k][1]).trim()
      if (!seg.startsWith('{')) continue
      const p = extractLastPrefix(text, code, c.args[k][0], c.args[k][1])
      if (p !== '') {
        pref = p
        break
      }
    }
    c.prefix = pref
    const a1 = c.args[0] || [c.innerStart, c.innerEnd]
    c.arg1Text = text.slice(a1[0], a1[1])
    c.arg1Class = classifyArg(M.slice(a1[0], a1[1]))
    c.body = c.arg1Class.kind === 'inline' ? findInlineBody(M, a1[0], a1[1]) : null
    if (c.arg1Class.kind === 'inline') {
      const p = inlineParam(c.arg1Text)
      if (p) inlineParams.push(p)
    }
  }
  const shorthand = parseShorthand(text, code, [...BASE_INSTANCES, ...inlineParams])
  const routeCalls = parseRouteCalls(M, text)
  const rec = {
    abs,
    text,
    M,
    code,
    imports,
    localNames,
    reexports,
    regCalls,
    shorthand,
    routeCalls,
  }
  fileCache.set(abs, rec)
  return rec
}

function chaseExport(orig, file, seen = new Set()) {
  const key = file + '|' + orig
  if (seen.has(key)) return file
  seen.add(key)
  const rec = getFile(file)
  const hit = rec.reexports.find((e) => e.exported === orig)
  if (hit) return chaseExport(hit.orig, hit.file, seen)
  return file
}

function resolveRegisterTarget(name, fromFile) {
  const rec = getFile(fromFile)
  const imp = rec.imports.get(name)
  if (imp) return chaseExport(imp.orig, imp.file)
  // sub-plugin defined locally in the same file
  if (rec.localNames.has(name)) return fromFile
  return null
}

function normPrefix(s) {
  if (!s) return ''
  let x = s.replace(/\/{2,}/g, '/')
  if (x.length > 1 && x.endsWith('/')) x = x.replace(/\/+$/, '')
  return x
}
const joinPrefix = (a, b) => normPrefix((a || '') + (b || ''))

function finalize(p) {
  if (!p) return '/'
  let x = p
  if (!x.startsWith('/')) x = '/' + x
  x = x.replace(/\/{2,}/g, '/')
  if (x.length > 1) x = x.replace(/\/+$/, '')
  return x
}

function cleanUrl(u) {
  // template-literal urls (e.g. `/${vendor}/chat`) are runtime-interpolated;
  // canonicalize the interpolation to a path param so no `${` reaches the output
  return u.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, ':$1').replace(/\$\{[^}]*\}/g, ':param')
}

function combine(base, local, url) {
  const acc = normPrefix((base || '') + (local || ''))
  const u = cleanUrl(url || '')
  if (acc === '') return u === '' ? '/' : finalize(u)
  if (u === '') return acc
  if (u === acc || u.startsWith(acc + '/')) return finalize(u)
  return finalize(acc + (u.startsWith('/') ? u : '/' + u))
}

function domainOf(p) {
  if (p === '/' || p === '') return 'root'
  let s = p
  for (const pre of ['/api', '/v1beta', '/v1']) {
    if (s === pre || s.startsWith(pre + '/')) {
      s = s.slice(pre.length)
      break
    }
  }
  if (s.startsWith('/')) s = s.slice(1)
  if (s === '') return 'root'
  return (s.split('/')[0] || 'root').toLowerCase()
}

function mkEndpoint(method, p, source, resolution, file) {
  return {
    method,
    path: p,
    domain: domainOf(p),
    source,
    resolution,
    file,
    pathParams: [...p.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]),
    wildcard: p.includes('*'),
  }
}

function cmp(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

// ---------------------------------------------------------------------------
// Collect files
// ---------------------------------------------------------------------------
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.ts')) out.push(p)
  }
}
const allTs = []
walk(ROUTES_DIR, allTs)
const isTest = (p) => p.includes('__tests__') || p.endsWith('.test.ts') || p.endsWith('.spec.ts')
const testFiles = allTs.filter(isTest)
const nonTest = allTs.filter((p) => !isTest(p))

// ---------------------------------------------------------------------------
// Pass A: BFS over the register graph from index.ts -> file -> Set<outerPrefix>
// ---------------------------------------------------------------------------
const prefixMap = new Map()
const addPrefix = (f, p) => {
  if (!prefixMap.has(f)) prefixMap.set(f, new Set())
  prefixMap.get(f).add(p)
}
addPrefix(INDEX_FILE, '')
const visited = new Set()
const unresolved = new Set()
const worklist = [{ file: INDEX_FILE, prefix: '', depth: 0 }]
while (worklist.length) {
  const { file, prefix, depth } = worklist.shift()
  const vkey = file + '|' + prefix
  if (visited.has(vkey)) continue
  visited.add(vkey)
  if (depth > 8) continue
  const rec = getFile(file)
  for (const c of rec.regCalls) {
    const newPrefix = joinPrefix(prefix, c.prefix || '')
    const k = c.arg1Class.kind
    if (k === 'identifier' || k === 'factory') {
      const target = resolveRegisterTarget(c.arg1Class.name, file)
      if (target) {
        addPrefix(target, newPrefix)
        worklist.push({ file: target, prefix: newPrefix, depth: depth + 1 })
      } else {
        unresolved.add(c.arg1Class.name + ' @ ' + rel(file))
      }
    } else if (k === 'other') {
      unresolved.add(c.arg1Text.trim().slice(0, 60) + ' @ ' + rel(file))
    }
    // inline / object / empty: no file to enqueue
  }
}

// ---------------------------------------------------------------------------
// Pass B: for EVERY non-test file, extract routes with their local prefix
// ---------------------------------------------------------------------------
const rawEndpoints = []
const reachedFiles = new Set()
const inferredFiles = new Set()
for (const file of nonTest) {
  const rec = getFile(file)
  const inlineBodies = rec.regCalls
    .filter((c) => c.arg1Class.kind === 'inline' && c.body)
    .map((c) => ({ bs: c.body[0], be: c.body[1], inner: c.prefix || '' }))
  const localFor = (pos) => {
    const enc = inlineBodies.filter((b) => b.bs <= pos && pos <= b.be).sort((a, b) => a.bs - b.bs)
    return enc.map((b) => b.inner).join('')
  }
  const hasRoutes = rec.shorthand.length > 0 || rec.routeCalls.length > 0
  const reached = prefixMap.has(file) && prefixMap.get(file).size > 0
  if (reached) reachedFiles.add(file)
  else if (hasRoutes) inferredFiles.add(file)
  const resolution = reached ? 'exact' : 'inferred'
  const outers = reached ? [...prefixMap.get(file)] : ['']
  const src = rel(file)
  for (const s of rec.shorthand) {
    const lp = localFor(s.pos)
    for (const outer of outers)
      rawEndpoints.push(mkEndpoint(s.method, combine(outer, lp, s.url), src, resolution, file))
  }
  for (const r of rec.routeCalls) {
    const lp = localFor(r.pos)
    for (const m of r.methods) {
      for (const outer of outers)
        rawEndpoints.push(mkEndpoint(m, combine(outer, lp, r.url), src, resolution, file))
    }
  }
}

// Dedupe by METHOD + fullPath, preferring an 'exact' resolution.
const byKey = new Map()
for (const e of rawEndpoints) {
  const key = e.method + ' ' + e.path
  const prev = byKey.get(key)
  if (!prev) byKey.set(key, e)
  else if (prev.resolution !== 'exact' && e.resolution === 'exact') byKey.set(key, e)
}
const list = [...byKey.values()]
list.sort((a, b) => cmp(a.domain, b.domain) || cmp(a.path, b.path) || cmp(a.method, b.method))

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const escapeField = (s) => String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`')
const dataLines = list.map((e) =>
  [e.method, e.path, e.domain, e.source, e.resolution].map(escapeField).join('\t'),
)
for (const l of dataLines) {
  if (l.includes('`') || l.includes('${')) {
    console.error('FATAL: a data line contains a backtick or ${ — refusing to write')
    process.exit(1)
  }
}
const templateBody = dataLines.join('\n') + '\n'

const watermarkSrc = readWorktreeFile(ROOT, rel(WATERMARK_SRC))
if (watermarkSrc === null) {
  console.error('FATAL: watermark source unreadable: ' + rel(WATERMARK_SRC))
  process.exit(2)
}
const watermark = watermarkSrc.split('\n').slice(0, 3).join('\n') + '\n'
const header =
  [
    '',
    '/**',
    ' * Generated by scripts/scan-api-routes.mjs - DO NOT hand-edit.',
    ' * Each line: METHOD <TAB> fullPath <TAB> domain <TAB> sourceFile <TAB> resolution',
    ' */',
  ].join('\n') + '\n'
const mainExport = 'export const API_ENDPOINTS_RAW = `' + templateBody + '`\n'
const generatedAt = new Date().toISOString()

/**
 * 自述钉(lib/generated-input-pin.mjs 的唯一实现)。
 * 输入面 = 参与 register 图的每个文件 + 水印源:路由文件内容一变,挂载前缀图或端点清单就可能变,
 * 故它们是这份产物的真输入,而非"生成时恰好读过的那几个文件"这种更窄的口径。
 * 门侧会在被审面按这份清单现算 inputsSha256;列漏一个输入 ⇒ 产物陈旧永远查不出来(2026-11-07 事故同型)。
 */
const pinInputRels = [
  ...new Set([rel(WATERMARK_SRC), ...[...prefixMap.keys()].map((k) => rel(path.resolve(ROOT, k)))]),
].sort()
const pinInputs = pinInputRels.map((r) => ({ rel: r, text: readWorktreeFile(ROOT, r) }))
const headProbe = spawnSync(gitBinary(), ['-C', ROOT, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
  timeout: 30000,
  stdio: ['ignore', 'pipe', 'pipe'],
})
const sourceCommit = headProbe.status === 0 ? headProbe.stdout.trim() : 'unknown'
const pinBlock =
  renderPin({
    generator: 'scripts/scan-api-routes.mjs',
    sourceCommit,
    inputs: pinInputs,
    generatedAt,
    extraLines: [`files: ${pinInputRels.length}`, `endpoints: ${dataLines.length}`],
  }).join('\n') + '\n'

const tail =
  `export const API_ENDPOINTS_GENERATED_AT = '${generatedAt}'\n` +
  `export const API_ENDPOINT_LINE_COUNT = ${dataLines.length}\n`
const content = watermark + header + pinBlock + mainExport + tail

if (!REPORT_ONLY) {
  const outDir = path.dirname(OUT_FILE)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(OUT_FILE, content, 'utf8')
  // watermark self-check (byte-equal first 3 lines)
  const back = readWorktreeFile(ROOT, rel(OUT_FILE)) ?? ''
  const a = back.split('\n').slice(0, 3).join('\n')
  const b = watermarkSrc.split('\n').slice(0, 3).join('\n')
  if (a !== b) {
    console.error('FATAL: generated watermark (first 3 lines) is not byte-equal to source')
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// Coverage report
// ---------------------------------------------------------------------------
const byMethod = {}
for (const e of list) byMethod[e.method] = (byMethod[e.method] || 0) + 1
const byDomain = {}
for (const e of list) byDomain[e.domain] = (byDomain[e.domain] || 0) + 1
const topDomains = Object.entries(byDomain)
  .sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))
  .slice(0, 15)
const wildcardCount = list.filter((e) => e.wildcard).length
const paramCount = list.filter((e) => e.pathParams.length > 0).length
const unresolvedList = [...unresolved].sort()

const R = []
R.push('==== API endpoint scan coverage report ====')
R.push('total .ts files under routes      : ' + allTs.length)
R.push('test files excluded              : ' + testFiles.length)
R.push('non-test .ts files scanned       : ' + nonTest.length)
R.push('files reached via register graph  : ' + reachedFiles.size)
R.push('files inferred-only (with routes) : ' + inferredFiles.size)
for (const f of [...inferredFiles].sort()) R.push('   - ' + rel(f))
R.push('total endpoints (deduped)        : ' + list.length)
R.push('endpoints by method              : ' + JSON.stringify(byMethod))
R.push('top 15 domains by count          :')
for (const [d, c] of topDomains) R.push('   ' + String(c).padStart(6) + '  ' + d)
R.push('distinct domains                 : ' + Object.keys(byDomain).length)
R.push('wildcard endpoints               : ' + wildcardCount)
R.push('endpoints with :path params      : ' + paramCount)
R.push('unresolved register targets      : ' + unresolvedList.length)
for (const u of unresolvedList) R.push('   - ' + u)
console.log(R.join('\n'))

// line-3 md5 of the generated file (for verification)
const readBack = readWorktreeFile(ROOT, rel(OUT_FILE)) ?? content
const lines3 = readBack.split('\n').slice(0, 3)
const line3md5 = crypto
  .createHash('md5')
  .update(lines3[2] || '', 'utf8')
  .digest('hex')
const blockmd5 = crypto.createHash('md5').update(lines3.join('\n'), 'utf8').digest('hex')
console.log('generated file                    : ' + rel(OUT_FILE))
console.log('written                           : ' + !REPORT_ONLY)
console.log('generated-at                      : ' + generatedAt)
console.log('line-3 md5                        : ' + line3md5)
console.log('watermark (3-line block) md5      : ' + blockmd5)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
