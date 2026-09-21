#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-capability-catalog.mjs — 能力目录 ↔ 生成产物 ↔ 路由登记 三方一致性守门
 *
 * 背景(2026-09-20 立):`packages/types/src/capability-catalog.ts` 是「哪些端点可被
 * 机器凭据调用」的单一事实源,运行时闸口在 `apps/api/src/utils/capability-guard.ts`
 * (requireCapability / requireAnyCapability / requireCapabilityRules / declareCapability)。
 * 但"新增对外端点必须登记能力"此前只是注释里的约定 —— 本脚本把它变成机械门禁。
 * 职责是**防漂移**,不是立刻把 /api/* 开放给第三方。
 *
 * 四项检查:
 *   A 产物一致性  目录声明的 scope 集合与字段,必须与 packages/types/generated/
 *                 capabilities.json 完全一致(缺失/多余/字段漂移 → 失败,提示重新生成)。
 *   B 端点登记覆盖 扫描 v1 路由文件里注册的每个 handler,判定是否被能力闸覆盖;
 *                 未覆盖 → 失败并列出端点清单。declareCapability 算覆盖但计入 warn 统计。
 *   C scope 语义  闸口引用的 scope 必须存在于目录;dataClass=platform 或
 *                 thirdPartyEligible=false 的 scope 不得出现在 /v1 对第三方开放的 rules 表里。
 *   D 反向核对    目录 routes 字段声明了、但代码里找不到注册点 → warn(防文档腐化)。
 *
 * CLI 用法:
 *   node scripts/check-capability-catalog.mjs [选项]
 *     (无参数)      全量模式(A+B+C+D),CI 用
 *     --staged      仅判定本次暂存的 v1 路由文件(B/C 缩窄到这些文件,D 跳过),pre-commit 用
 *     --json        输出机器可读 JSON(诊断信息走 stderr)
 *     --self-test   跑内置样例断言(不读业务文件),失败 exit 1
 *     --quiet       抑制 info 输出
 *     --max-list=N  未覆盖清单最多打印 N 行(默认 400,0=不打印清单)
 *     --help        打印帮助
 *
 * 环境变量(测试/CI 接缝):
 *   CAPABILITY_CATALOG_FILES  逗号/换行分隔的仓库根相对路径,替代 git 暂存区清单
 *   CAPABILITY_CATALOG_ROOT   覆盖仓库根(单测用临时 fixture 树跑完整 CLI)
 *   HUSKY_SKIP_CAPABILITY_CATALOG_GUARD=1  紧急跳过
 *
 * 退出码:0 通过 / 1 检查失败 / 2 脚本自身异常。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { COLORS as C } from './lib/logger.mjs'
import { isExcludedDirName } from './lib/exclude-dirs.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(process.env.CAPABILITY_CATALOG_ROOT || resolve(__dirname, '..'))

const CATALOG_TS_REL = 'packages/types/src/capability-catalog.ts'
const MANIFEST_JSON_REL = 'packages/types/generated/capabilities.json'
const ROUTES_DIR_REL = 'apps/api/src/routes'
const V1_ROUTE_FILE_RE = /^apps\/api\/src\/routes\/(other\/)?v1-[^/]+\.ts$/
const HANDLER_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all', 'route']
/** aliasToModule 复合键分隔符(importerRel + KEY_SEP + alias)。 */
const KEY_SEP = '::'
/** 闸口工厂 → 语义类别。declareCapability 是迁移期登记(算覆盖,计入 warn)。 */
const GUARD_KINDS = {
  requireCapability: 'require',
  requireAnyCapability: 'any',
  requireCapabilityRules: 'rules',
  declareCapability: 'declare',
}
/** 与 capability-catalog.ts 的 LEGACY_DATA_CLASS_ALIASES 保持一致。 */
const DATA_CLASS_ALIASES = { 'self-metadata-implicit': 'compute' }
const ARTIFACT_FIELDS = ['domain', 'dataClass', 'risk', 'billable', 'thirdPartyEligible', 'idempotencyRequired', 'description', 'routes', 'tools', 'rate']

// ═════════════════════════ 底层扫描器(纯函数,零依赖) ═════════════════════════
const WS_CHARS = new Set([' ', '\t', '\n', '\r', '\f', '\v'])
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>'])

function skipWs(src, i) {
  while (i < src.length && WS_CHARS.has(src[i])) i += 1
  return i
}

function lineOf(src, index) {
  let line = 1
  for (let i = 0; i < index && i < src.length; i += 1) if (src.charCodeAt(i) === 10) line += 1
  return line
}

function readString(src, i) {
  const quote = src[i]
  let out = ''
  let j = i + 1
  let dynamic = false
  while (j < src.length) {
    const ch = src[j]
    if (ch === '\\') {
      const nx = src[j + 1] ?? ''
      out += nx === 'n' ? '\n' : nx === 't' ? '\t' : nx === 'r' ? '\r' : nx
      j += 2
      continue
    }
    if (ch === quote) return { value: out, end: j + 1, dynamic }
    if (quote === '`' && ch === '$' && src[j + 1] === '{') dynamic = true
    out += ch
    j += 1
  }
  return { value: null, end: j, dynamic: true }
}

function readRegex(src, i) {
  let j = i + 1
  let inClass = false
  while (j < src.length) {
    const ch = src[j]
    if (ch === '\\') { j += 2; continue }
    if (ch === '\n') break
    if (ch === '[') inClass = true
    else if (ch === ']') inClass = false
    else if (ch === '/' && !inClass) {
      let k = j + 1
      while (k < src.length && /[a-z]/.test(src[k])) k += 1
      return { source: src.slice(i + 1, j), flags: src.slice(j + 1, k), end: k }
    }
    j += 1
  }
  return { source: '', flags: '', end: j }
}

/** `/` 处是否为正则字面量(而非除号):回看最近一个非空白字符。 */
function isRegexStart(src, i) {
  let j = i - 1
  while (j >= 0 && WS_CHARS.has(src[j])) j -= 1
  if (j < 0) return true
  const ch = src[j]
  if (/[\w$)\]'"`]/.test(ch)) return false
  return REGEX_PREV.has(ch)
}

/** 注释整体替换为等长空格(保留换行 → 行号与偏移不漂移)。 */
function stripComments(src) {
  const out = src.split('')
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i += 1 }
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] !== '\n') out[i] = ' '
        i += 1
      }
      out[i] = ' '
      if (i + 1 < src.length) out[i + 1] = ' '
      i += 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { i = readString(src, i).end; continue }
    if (ch === '/' && isRegexStart(src, i)) { i = readRegex(src, i).end; continue }
    i += 1
  }
  return out.join('')
}

/** 从表达式起点消费到 depth=0 的 stop 字符(不含该字符)。 */
function readExpression(src, i, stops) {
  const start = skipWs(src, i)
  let j = start
  let depth = 0
  while (j < src.length) {
    const ch = src[j]
    if (ch === "'" || ch === '"' || ch === '`') { j = readString(src, j).end; continue }
    if (ch === '/' && isRegexStart(src, j)) { j = readRegex(src, j).end; continue }
    if (ch === '(' || ch === '[' || ch === '{') { depth += 1; j += 1; continue }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break
      depth -= 1
      j += 1
      continue
    }
    if (depth === 0 && stops.includes(ch)) break
    j += 1
  }
  return { text: src.slice(start, j).trim(), end: j }
}

function parseObject(src, i) {
  const obj = {}
  let j = i + 1
  for (;;) {
    j = skipWs(src, j)
    if (j >= src.length) break
    if (src[j] === '}') { j += 1; break }
    const before = j
    if (src.slice(j, j + 3) === '...') { j = readExpression(src, j + 3, ',}').end; continue }
    let key = null
    if (src[j] === "'" || src[j] === '"') { const r = readString(src, j); key = r.value; j = r.end }
    else {
      const m = /^[A-Za-z_$][\w$]*/.exec(src.slice(j))
      if (m) { key = m[0]; j += m[0].length }
    }
    if (key === null) { j = readExpression(src, j, ',}').end }
    else {
      j = skipWs(src, j)
      if (src[j] === '?') j += 1
      if (src[j] === ':') { const v = parseValue(src, j + 1, ',}'); obj[key] = v.value; j = v.end }
      else if (src[j] === '(' || src[j] === '<') { j = readExpression(src, j, ',}').end }
      else obj[key] = { __raw: key }
    }
    j = skipWs(src, j)
    if (src[j] === ',') { j += 1; continue }
    if (src[j] === '}') { j += 1; break }
    if (j === before) j += 1
  }
  return { value: obj, end: j }
}

function parseList(src, i, open, close, stops) {
  const items = []
  let j = i + 1
  for (;;) {
    j = skipWs(src, j)
    if (j >= src.length) break
    if (src[j] === close) { j += 1; break }
    const before = j
    const v = parseValue(src, j, stops)
    items.push(v.value)
    j = skipWs(src, v.end)
    if (src[j] === ',') { j += 1; continue }
    if (src[j] === close) { j += 1; break }
    if (j === before) j += 1
  }
  return { items, end: j }
}

function parseArray(src, i) {
  const r = parseList(src, i, '[', ']', ',]')
  return { value: r.items, end: r.end }
}

/** TS 字面量子集解析器:对象/数组/字符串/数字/布尔/正则/调用表达式,其余归一为 {__raw}。 */
function parseValue(src, i, stops = ',)}]') {
  const start = skipWs(src, i)
  const ch = src[start]
  if (ch === undefined) return { value: undefined, end: start, text: '' }
  if (ch === '{') { const r = parseObject(src, start); return { value: r.value, end: r.end, text: src.slice(start, r.end) } }
  if (ch === '[') { const r = parseArray(src, start); return { value: r.value, end: r.end, text: src.slice(start, r.end) } }
  if (ch === "'" || ch === '"' || ch === '`') {
    const r = readString(src, start)
    return { value: r.dynamic ? { __raw: src.slice(start, r.end) } : r.value, end: r.end, text: src.slice(start, r.end) }
  }
  if (ch === '/' && isRegexStart(src, start)) {
    const r = readRegex(src, start)
    return { value: { __regex: true, source: r.source, flags: r.flags }, end: r.end, text: src.slice(start, r.end) }
  }
  const num = /^-?[\d][\d_]*(?:\.[\d_]+)?(?:e[-+]?\d+)?/i.exec(src.slice(start))
  if (num) return { value: Number(num[0].replace(/_/g, '')), end: start + num[0].length, text: num[0] }
  const id = /^[A-Za-z_$][\w$]*/.exec(src.slice(start))
  if (id) {
    let k = start + id[0].length
    if (src[k] === '<') { const gt = src.indexOf('>', k); if (gt > 0) k = gt + 1 }
    const after = skipWs(src, k)
    if (src[after] === '(') {
      const r = parseList(src, after, '(', ')', ',)')
      return { value: { __call: true, name: id[0], args: r.items }, end: r.end, text: src.slice(start, r.end) }
    }
    if (id[0] === 'true') return { value: true, end: after, text: 'true' }
    if (id[0] === 'false') return { value: false, end: after, text: 'false' }
    if (id[0] === 'null') return { value: null, end: after, text: 'null' }
    if (id[0] === 'undefined') return { value: undefined, end: after, text: 'undefined' }
  }
  const r = readExpression(src, start, stops)
  return { value: { __raw: r.text }, end: r.end, text: src.slice(start, r.end) }
}

const isRaw = (v) => v !== null && typeof v === 'object' && '__raw' in v
const asString = (v) => (typeof v === 'string' ? v : undefined)

// ═════════════════════════ A:目录源码解析 + 产物比对 ═════════════════════════
function findExportInit(stripped, name) {
  const anchor = stripped.indexOf(`export const ${name}`)
  if (anchor < 0) return -1
  const eq = stripped.indexOf('=', anchor + name.length)
  return eq < 0 ? -1 : skipWs(stripped, eq + 1)
}

/** 解析 CAPABILITY_CATALOG 源码 → 条目数组(与 buildManifest 消费的同源数据)。 */
function parseCatalogEntries(tsSource) {
  const code = stripComments(tsSource)
  const start = findExportInit(code, 'CAPABILITY_CATALOG')
  if (start < 0 || code[start] !== '[') throw new Error(`未能定位 export const CAPABILITY_CATALOG = [ ... ](${CATALOG_TS_REL})`)
  const parsed = parseArray(code, start)
  const entries = []
  for (const item of parsed.value) {
    const obj = item && item.__call ? item.args?.[0] : item
    if (!obj || Array.isArray(obj) || isRaw(obj)) continue
    const scope = asString(obj.scope)
    if (!scope) continue
    entries.push({
      scope,
      domain: asString(obj.domain) ?? '',
      dataClass: asString(obj.dataClass) ?? '',
      risk: asString(obj.risk) ?? '',
      billable: obj.billable === true,
      thirdPartyEligible: obj.thirdPartyEligible !== false,
      idempotencyRequired: obj.idempotencyRequired === true,
      description: asString(obj.description) ?? '',
      // 归属服务:缺省 'api'。[D] 反向核据此跳过 apps/ai-service 提供的条目 —— 本脚本
      // 是**文本解析** TS 目录(不是 import 它),少解析一个字段就等于判据看不见该字段,
      // 曾把 10 条 ai-service 端点全报成"文档腐化"。
      host: asString(obj.host) ?? 'api',
      routes: (Array.isArray(obj.routes) ? obj.routes : []).filter((r) => typeof r === 'string'),
      tools: (Array.isArray(obj.tools) ? obj.tools : []).filter((t) => typeof t === 'string'),
    })
  }
  return entries
}

/** 解析 RATE_PROFILES(产物 rate 字段的期望值来源)。 */
function parseRateProfiles(tsSource) {
  const code = stripComments(tsSource)
  const start = findExportInit(code, 'RATE_PROFILES')
  if (start < 0 || code[start] !== '{') return null
  const parsed = parseObject(code, start)
  const out = {}
  for (const [risk, v] of Object.entries(parsed.value ?? {})) {
    if (v && !isRaw(v)) out[risk] = { rpm: v.rpm, burst: v.burst, dailyCalls: v.dailyCalls, concurrent: v.concurrent, maxDurationMs: v.maxDurationMs }
  }
  return Object.keys(out).length > 0 ? out : null
}

function parseArtifact(jsonText) {
  const raw = JSON.parse(jsonText)
  if (!raw || !Array.isArray(raw.capabilities)) throw new Error(`${MANIFEST_JSON_REL} 缺少 capabilities 数组`)
  return raw
}

function expectedArtifactEntry(entry, rateProfiles) {
  const dataClass = DATA_CLASS_ALIASES[entry.dataClass] ?? entry.dataClass
  return {
    domain: entry.domain,
    dataClass,
    risk: entry.risk,
    billable: entry.billable,
    thirdPartyEligible: entry.thirdPartyEligible,
    idempotencyRequired: entry.idempotencyRequired,
    description: entry.description,
    routes: entry.routes,
    tools: entry.tools,
    rate: rateProfiles ? rateProfiles[entry.risk] : undefined,
  }
}

/** A 检查:目录 ↔ 产物 缺失/多余/字段漂移。manifest 为 null 表示产物缺失。 */
function compareWithCatalog(entries, rateProfiles, manifest) {
  const result = { missing: [], extra: [], drift: [], artifactMissing: !manifest }
  if (!manifest) return result
  const jsonIndex = new Map()
  for (const cap of manifest.capabilities) jsonIndex.set(String(cap?.scope ?? ''), cap)
  const tsScopes = new Set()
  for (const entry of entries) {
    tsScopes.add(entry.scope)
    const cap = jsonIndex.get(entry.scope)
    if (!cap) { result.missing.push(entry.scope); continue }
    const expected = expectedArtifactEntry(entry, rateProfiles)
    for (const field of ARTIFACT_FIELDS) {
      if (field === 'rate' && !rateProfiles) continue
      const a = JSON.stringify(expected[field] ?? (field === 'tools' || field === 'routes' ? [] : expected[field]))
      const b = JSON.stringify(cap[field])
      if (a !== b) result.drift.push({ scope: entry.scope, field, ts: expected[field], artifact: cap[field] })
    }
  }
  for (const scope of jsonIndex.keys()) if (!tsScopes.has(scope)) result.extra.push(scope)
  return result
}

// ═════════════════════════ B/C:路由文件解析与覆盖判定 ═════════════════════════
function collectGuardCalls(code) {
  const calls = []
  const localVars = new Map()
  for (const [fn, kind] of Object.entries(GUARD_KINDS)) {
    const re = new RegExp(`(?:^|[^.\\w$])${fn}\\s*\\(`, 'g')
    let m
    while ((m = re.exec(code))) {
      const nameStart = code.indexOf(fn, m.index)
      const parsed = parseValue(code, nameStart)
      const call = parsed.value
      if (!call || !call.__call) continue
      const scopes = []
      const rules = []
      const arg0 = call.args?.[0]
      if (kind === 'require' || kind === 'declare') {
        if (typeof arg0 === 'string') scopes.push(arg0)
      } else if (kind === 'any') {
        for (const s of Array.isArray(arg0) ? arg0 : []) if (typeof s === 'string') scopes.push(s)
      } else if (kind === 'rules') {
        for (const r of Array.isArray(arg0) ? arg0 : []) {
          if (!r || isRaw(r) || Array.isArray(r)) continue
          const scope = asString(r.scope)
          const pattern = r.pattern && r.pattern.__regex ? r.pattern : null
          if (!scope) continue
          scopes.push(scope)
          rules.push({ scope, patternSource: pattern ? pattern.source : null, flags: pattern ? pattern.flags : '', methods: Array.isArray(r.methods) ? r.methods.filter((x) => typeof x === 'string') : [] })
        }
      }
      calls.push({ fn, kind, scopes, rules, index: nameStart, line: lineOf(code, nameStart), text: parsed.text })
      const varRe = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${fn}\\s*\\(`)
      const vm = varRe.exec(code.slice(0, nameStart + fn.length + 1))
      if (vm) localVars.set(vm[1], calls[calls.length - 1])
    }
  }
  return { calls, localVars }
}

function referencesGuard(text, localVars) {
  for (const fn of Object.keys(GUARD_KINDS)) {
    if (new RegExp(`\\b${fn}\\s*\\(`).test(text)) return true
  }
  for (const name of localVars.keys()) if (new RegExp(`\\b${name}\\b`).test(text)) return true
  return false
}

function collectPreHandlerHooks(code, localVars) {
  const hooks = []
  const re = /\baddHook\s*\(\s*(['"])preHandler\1\s*,/g
  let m
  while ((m = re.exec(code))) {
    const parenIdx = code.indexOf('(', m.index)
    // 用原文切分取第二个实参:箭头函数体必须完整纳入(parseValue 只会吃到参数列表)
    const parts = splitArgTexts(code, parenIdx)
    const text = parts[1] ?? ''
    if (!referencesGuard(text, localVars)) continue
    const kinds = new Set()
    for (const [fn, kind] of Object.entries(GUARD_KINDS)) if (new RegExp(`\\b${fn}\\s*\\(`).test(text)) kinds.add(kind)
    for (const [name, call] of localVars) if (new RegExp(`\\b${name}\\b`).test(text)) kinds.add(call.kind)
    hooks.push({ index: m.index, line: lineOf(code, m.index), text, kinds: [...kinds] })
  }
  return hooks
}

function extractHandlers(code) {
  const handlers = []
  const re = new RegExp(`(?:^|[^.\\w$])(?:server|app|fastify|instance)\\.(${HANDLER_METHODS.join('|')})\\s*\\(`, 'g')
  let m
  while ((m = re.exec(code))) {
    const method = m[1].toUpperCase()
    const parenIdx = m.index + m[0].length - 1
    const args = parseList(code, parenIdx, '(', ')', ',)').items
    const argTexts = splitArgTexts(code, parenIdx)
    if (method === 'ROUTE') {
      const opts = args[0] && !isRaw(args[0]) ? args[0] : {}
      const url = asString(opts.url) ?? firstString(argTexts[0], 'url')
      const httpMethod = (asString(opts.method) ?? firstString(argTexts[0], 'method') ?? 'ANY').toUpperCase()
      if (url) handlers.push({ method: httpMethod, path: url, optionsText: argTexts[0] ?? '', index: m.index, line: lineOf(code, m.index) })
      continue
    }
    const path = typeof args[0] === 'string' ? args[0] : null
    const optsText = argTexts.length > 1 && argTexts[1].trimStart().startsWith('{') ? argTexts[1] : ''
    handlers.push({
      method,
      path,
      pathDynamic: path === null,
      optionsText: optsText,
      index: m.index,
      line: lineOf(code, m.index),
    })
  }
  return handlers
}

/** 把 `( ... )` 内的实参按顶层逗号切出原文(用于「有没有写 preHandler」这类文本级判定)。 */
function splitArgTexts(code, openParenIdx) {
  if (code[openParenIdx] !== '(') return []
  const out = []
  let depth = 0
  let j = openParenIdx + 1
  let segStart = j
  while (j < code.length) {
    const ch = code[j]
    if (ch === "'" || ch === '"' || ch === '`') { j = readString(code, j).end; continue }
    if (ch === '/' && isRegexStart(code, j)) { j = readRegex(code, j).end; continue }
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (ch === ')' && depth === 0) { out.push(code.slice(segStart, j)); break }
      depth -= 1
    } else if (ch === ',' && depth === 0) {
      out.push(code.slice(segStart, j))
      segStart = j + 1
    }
    j += 1
  }
  return out.map((s) => s.trim()).filter((s) => s.length > 0)
}

function firstString(text, key) {
  const m = new RegExp(`\\b${key}\\s*:\\s*['"\`]([^'"\`]*)['"\`]`).exec(text || '')
  return m ? m[1] : undefined
}

function joinPath(prefix, path) {
  const p = `/${path ?? ''}`.replace(/\/{2,}/g, '/')
  if (!prefix || prefix === '/') return p
  return `/${prefix}${p}`.replace(/\/{2,}/g, '/')
}

/** 单文件分析:handler 覆盖情况 + 闸口引用的 scope + rules 表内容。 */
function analyzeRouteFile({ relPath, source, prefixes = [''] }) {
  const code = stripComments(source)
  const { calls, localVars } = collectGuardCalls(code)
  const hooks = collectPreHandlerHooks(code, localVars)
  const handlers = extractHandlers(code)
  const allRules = calls.filter((c) => c.kind === 'rules').flatMap((c) => c.rules)
  const fileLevel = hooks.length > 0
  const analyzed = handlers.map((h) => {
    let covered = null
    if (h.optionsText && referencesGuard(h.optionsText, localVars)) {
      const kinds = new Set()
      for (const [fn, kind] of Object.entries(GUARD_KINDS)) if (new RegExp(`\\b${fn}\\s*\\(`).test(h.optionsText)) kinds.add(kind)
      for (const [name, call] of localVars) if (new RegExp(`\\b${name}\\b`).test(h.optionsText)) kinds.add(call.kind)
      covered = { via: 'preHandler', kinds: [...kinds] }
    } else if (fileLevel) {
      covered = { via: 'plugin-addHook', kinds: [...new Set(hooks.flatMap((h) => h.kinds))] }
    }
    return {
      method: h.method,
      path: h.path ?? '«动态路径»',
      fullPath: h.path === null ? '«动态路径»' : joinPath(prefixes[0] ?? '', h.path),
      line: h.line,
      candidates: prefixes.map((p) => joinPath(p, h.path ?? '')),
      covered,
      guardedOnlyByDeclare: !!covered && covered.kinds.length > 0 && covered.kinds.every((k) => k === 'declare'),
    }
  })
  return {
    relPath,
    handlers: analyzed,
    uncovered: analyzed.filter((h) => !h.covered),
    declareOnly: analyzed.filter((h) => h.guardedOnlyByDeclare),
    guardScopes: calls.flatMap((c) => c.scopes.map((s) => ({ scope: s, kind: c.kind, line: c.line }))),
    thirdPartyRules: allRules
      .filter((r) => r.patternSource && /^\/v1(\/|$)/.test(r.patternSource.replace(/\\\//g, '/').replace(/^\^/, '')))
      .map((r) => r.scope),
    localGuardVarCount: localVars.size,
    hookCount: hooks.length,
  }
}

// ═════════════════════════ D:反向核对(声明了却没注册) ═════════════════════════
function pathMatcher(pattern) {
  const parts = String(pattern).split('/').filter(Boolean)
  return { parts, count: parts.length }
}

function segEq(a, b) {
  const dyn = (s) => s.startsWith(':') || s.startsWith('{') || s === '*'
  return a === b || dyn(a) || dyn(b)
}

/** 声明模式与实际注册模式互匹配(参数段/通配段两侧均视为占位)。 */
function routesMatch(declared, actual) {
  const d = pathMatcher(declared)
  const a = pathMatcher(actual)
  if (d.parts.at(-1) === '*') {
    if (a.count < d.count - 1) return false
    for (let i = 0; i < d.count - 1; i++) if (!segEq(d.parts[i], a.parts[i])) return false
    return true
  }
  if (a.count !== d.count) return false
  return d.parts.every((p, i) => segEq(p, a.parts[i]))
}

function methodMatch(declared, actual) {
  if (declared === actual) return true
  if (declared === 'WS' && actual === 'GET') return true
  return actual === 'ALL'
}

function parseDeclaredRoute(route) {
  const m = /^([A-Z]+)\s+(\S+)$/.exec(String(route).trim())
  return m ? { method: m[1], path: m[2] } : null
}

function buildPrefixMap(fileSources) {
  const aliasToModule = new Map() // (importerRel + KEY_SEP + alias) -> moduleRel
  const registrations = [] // { importerRel(alias 所在文件), alias, prefix }
  for (const [rel, raw] of fileSources) {
    const code = stripComments(raw)
    const importRe = /import\s+(?:type\s+)?([\s\S]*?)\s*from\s*['"](\.[^'"]+)['"]/g
    let im
    while ((im = importRe.exec(code))) {
      const spec = im[2]
      const moduleRel = resolveModuleRel(rel, spec)
      if (!moduleRel) continue
      const clause = (im[1] ?? '').trim().replace(/^type\s+/, '')
      const names = []
      const braceIdx = clause.indexOf('{')
      const head = (braceIdx >= 0 ? clause.slice(0, braceIdx) : clause).replace(/,\s*$/, '').trim()
      const def = /^[A-Za-z_$][\w$]*/.exec(head)
      if (def) names.push(def[0])
      if (braceIdx >= 0) {
        const inner = clause.slice(braceIdx + 1, clause.lastIndexOf('}'))
        for (const part of inner.split(',')) {
          const t = part.trim().replace(/^type\s+/, '')
          if (!t) continue
          const as = t.split(/\s+as\s+/)
          names.push((as[1] ?? as[0]).trim())
        }
      }
      for (const alias of names) aliasToModule.set(rel + KEY_SEP + alias, moduleRel)
    }
    const regRe = /\.register\s*\(\s*([A-Za-z_$][\w$]*)\s*(?:,\s*(\{[\s\S]{0,200}?\}))?\s*\)/g
    let rm
    while ((rm = regRe.exec(code))) {
      const prefix = rm[2] ? (/prefix\s*:\s*['"]([^'"]*)['"]/.exec(rm[2])?.[1] ?? '') : ''
      registrations.push({ importer: rel, alias: rm[1], prefix })
    }
  }
  const prefixesByModule = new Map()
  const parentOf = new Map()
  for (const reg of registrations) {
    const moduleRel = aliasToModule.get(reg.importer + KEY_SEP + reg.alias)
    if (!moduleRel) continue
    const list = prefixesByModule.get(moduleRel) ?? []
    if (!list.includes(reg.prefix)) list.push(reg.prefix)
    prefixesByModule.set(moduleRel, list)
    if (!parentOf.has(moduleRel)) parentOf.set(moduleRel, reg.importer)
  }
  /** 有效前缀 = 自身注册前缀 × 注册方文件的有效前缀;多处注册时返回全部候选。 */
  const prefixOf = (moduleRel, seen = new Set()) => {
    if (seen.has(moduleRel)) return ['']
    seen.add(moduleRel)
    const own = prefixesByModule.get(moduleRel) ?? []
    const parent = parentOf.get(moduleRel)
    const parents = parent && parent !== moduleRel ? prefixOf(parent, seen) : ['']
    const out = []
    for (const p of own) {
      for (const q of parents) {
        const combo = q && p ? `${q}${p}` : q || p
        if (!out.includes(combo)) out.push(combo)
      }
    }
    return out.length > 0 ? out : ['']
  }
  return { prefixOf }
}

function resolveModuleRel(importerRel, spec) {
  const base = resolve(dirname(join(ROOT, importerRel)), spec).replace(/\\/g, '/').replace(/\.[cm]?[jt]sx?$/, '')
  for (const cand of [`${base}.ts`, `${base}.mts`, `${base}/index.ts`]) {
    if (existsSync(cand)) return cand.slice(ROOT.replace(/\\/g, '/').length + 1)
  }
  return null
}

function listTsFiles(dirAbs, out = []) {
  let entries = []
  try { entries = readdirSync(dirAbs) } catch { return out }
  for (const name of entries) {
    const abs = join(dirAbs, name)
    let st
    try { st = statSync(abs) } catch { continue }
    if (st.isDirectory()) { if (!isExcludedDirName(name)) listTsFiles(abs, out) }
    else if (/\.m?ts$/.test(name) && !/\.d\.ts$/.test(name)) out.push(abs)
  }
  return out
}

// ═════════════════════════ 编排:四项检查汇总 ═════════════════════════
function evaluate({ entries, rateProfiles, artifact, artifactError, routeFiles, registry }) {
  const failures = []
  const warnings = []
  const stats = { catalogScopes: entries.length, artifactScopes: artifact ? artifact.capabilities.length : 0, filesScanned: routeFiles.length, handlers: 0, covered: 0, declareOnly: 0, uncovered: 0, referencedScopes: 0, unknownScopes: 0, platformLeaks: 0, declaredRoutes: 0, staleDeclaredRoutes: 0 }

  // ── A 产物一致性 ──
  if (artifactError) failures.push({ check: 'A', code: 'ARTIFACT_INVALID', message: `产物无法解析: ${artifactError}` })
  else if (!artifact) failures.push({ check: 'A', code: 'ARTIFACT_MISSING', message: `产物缺失: ${MANIFEST_JSON_REL} —— 运行 pnpm capabilities:export 生成后提交` })
  else {
    const cmp = compareWithCatalog(entries, rateProfiles, artifact)
    if (cmp.missing.length) failures.push({ check: 'A', code: 'ARTIFACT_MISSING_SCOPES', message: `产物缺少 ${cmp.missing.length} 个 scope: ${cmp.missing.join(', ')}`, scopes: cmp.missing })
    if (cmp.extra.length) failures.push({ check: 'A', code: 'ARTIFACT_EXTRA_SCOPES', message: `产物多出 ${cmp.extra.length} 个 scope(目录已删): ${cmp.extra.join(', ')}`, scopes: cmp.extra })
    for (const d of cmp.drift) failures.push({ check: 'A', code: 'ARTIFACT_DRIFT', message: `字段漂移 ${d.scope}.${d.field}: 目录=${JSON.stringify(d.ts)} 产物=${JSON.stringify(d.artifact)}` })
  }
  if (failures.some((f) => f.check === 'A' && f.code !== 'REGENERATE_HINT')) {
    failures.push({ check: 'A', code: 'REGENERATE_HINT', message: `重新生成: pnpm capabilities:export  (校验: pnpm capabilities:check)` })
  }

  const catalogIndex = new Map(entries.map((e) => [e.scope, e]))

  // ── B 端点登记覆盖 ──
  for (const file of routeFiles) {
    stats.handlers += file.analysis.handlers.length
    stats.covered += file.analysis.handlers.length - file.analysis.uncovered.length
    stats.declareOnly += file.analysis.declareOnly.length
    stats.uncovered += file.analysis.uncovered.length
    if (file.analysis.declareOnly.length > 0) {
      warnings.push({ check: 'B', code: 'DECLARE_ONLY', message: `${file.relPath}: ${file.analysis.declareOnly.length} 个端点仅 declareCapability 登记(迁移期,未强制 scope): ${file.analysis.declareOnly.map((h) => `${h.method} ${h.fullPath}`).join(', ')}` })
    }
    if (file.analysis.uncovered.length > 0) {
      failures.push({
        check: 'B',
        code: 'ENDPOINT_UNCOVERED',
        file: file.relPath,
        message: `${file.relPath}: ${file.analysis.uncovered.length} 个端点未接能力闸`,
        endpoints: file.analysis.uncovered.map((h) => ({ method: h.method, path: h.fullPath, registeredAs: h.path, line: h.line })),
      })
    }
  }

  // ── C scope 语义合法 ──
  const referenced = new Map()
  for (const file of routeFiles) for (const ref of file.analysis.guardScopes) {
    const cur = referenced.get(ref.scope) ?? { kinds: new Set(), lines: [], files: new Set() }
    cur.kinds.add(ref.kind)
    cur.lines.push(ref.line)
    cur.files.add(file.relPath)
    referenced.set(ref.scope, cur)
  }
  stats.referencedScopes = referenced.size
  for (const [scope, info] of referenced) {
    if (!catalogIndex.has(scope)) {
      stats.unknownScopes += 1
      failures.push({ check: 'C', code: 'SCOPE_UNREGISTERED', message: `闸口引用了目录中不存在的 scope: ${scope}(${[...info.files].join(', ')})` })
      continue
    }
    const entry = catalogIndex.get(scope)
    const dataClass = DATA_CLASS_ALIASES[entry.dataClass] ?? entry.dataClass
    const ineligible = dataClass === 'platform' || entry.thirdPartyEligible === false
    if (!ineligible) continue
    const leaked = routeFiles.some((f) => f.analysis.thirdPartyRules.includes(scope))
    if (leaked) {
      stats.platformLeaks += 1
      failures.push({ check: 'C', code: 'PLATFORM_IN_THIRD_PARTY_RULES', message: `scope ${scope} 属 ${dataClass === 'platform' ? "dataClass='platform'" : 'thirdPartyEligible=false'},不得出现在 /v1 对第三方开放的 requireCapabilityRules 表中` })
    } else {
      warnings.push({ check: 'C', code: 'M2M_FORBIDDEN_GATE', message: `scope ${scope}(${dataClass === 'platform' ? 'platform' : 'thirdPartyEligible=false'})被闸口引用,机器凭据在该端点恒 403 M2M_FORBIDDEN —— 确认是"有意只给人 JWT"而非漏登记` })
    }
  }

  // ── D 反向核对(全量模式) ──
  if (registry) {
    for (const entry of entries) {
      for (const declared of entry.routes) {
        // `host: 'ai-service'` 的条目由 apps/ai-service(FastAPI)注册,在本仓库 apps/api
        // 源码里**当然**找不到注册点 —— 那是归属不同,不是文档腐化。判据与
        // scripts/openapi-check.mjs、apps/api/scripts/export-openapi.ts 的 host 跳过同源。
        if (entry.host === 'ai-service') {
          stats.declaredRoutes += 1
          continue
        }
        const parsed = parseDeclaredRoute(declared)
        if (!parsed) { warnings.push({ check: 'D', code: 'ROUTE_FORMAT', message: `${entry.scope}: routes 字段格式应为 "METHOD /path",实际「${declared}」` }); continue }
        stats.declaredRoutes += 1
        const hit = registry.some((r) => methodMatch(parsed.method, r.method) && r.candidates.some((c) => routesMatch(parsed.path, c)))
        if (!hit) {
          stats.staleDeclaredRoutes += 1
          warnings.push({ check: 'D', code: 'DECLARED_ROUTE_NOT_FOUND', message: `${entry.scope}: 目录声明「${declared}」,但代码里找不到对应注册点(文档腐化或路由改名/下线)` })
        }
      }
    }
  }

  return { failures, warnings, stats }
}

// ═════════════════════════ 文件 IO / git ═════════════════════════
function readText(relPath) {
  try { return readFileSync(join(ROOT, relPath), 'utf8') } catch { return null }
}

function getStagedFiles() {
  const fromEnv = (process.env.CAPABILITY_CATALOG_FILES || '').split(/[,\n]/).map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean)
  if (fromEnv.length > 0) return fromEnv
  try {
    const out = execFileSync('git', ['-C', ROOT, 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
    return out.split(/\r?\n/).map((l) => l.trim().replace(/\\/g, '/')).filter(Boolean)
  } catch (e) {
    console.warn(`${C.yellow}⚠️ 无法读取 git 暂存区(${e?.message ?? e}),B/C 端点覆盖检查本轮跳过${C.reset}`)
    return null
  }
}

/**
 * 载入路由树源码。
 * @param {boolean} minimal staged 模式:只载入 v1 路由文件 + 各级 index.ts
 *        (前缀解析只需要"谁 register 了谁",即 index.ts;避免全树读取拖慢 pre-commit)
 */
function loadRouteSources(minimal = false) {
  const map = new Map()
  for (const abs of listTsFiles(join(ROOT, ROUTES_DIR_REL))) {
    const rel = abs.replace(/\\/g, '/').slice(ROOT.replace(/\\/g, '/').length + 1)
    if (minimal && !V1_ROUTE_FILE_RE.test(rel) && !/(^|\/)index\.ts$/.test(rel)) continue
    let text
    try { text = readFileSync(abs, 'utf8') } catch { continue }
    map.set(rel, text)
  }
  return map
}

function collectRegistry(fileSources, prefixOf) {
  const registry = []
  for (const [rel, raw] of fileSources) {
    if (!/\.(get|post|put|patch|delete|head|options|all|route)\s*\(/.test(raw)) continue
    const code = stripComments(raw)
    const handlers = extractHandlers(code)
    if (handlers.length === 0) continue
    const prefixes = prefixOf(rel)
    for (const h of handlers) {
      if (h.path === null) continue
      registry.push({ file: rel, method: h.method, candidates: prefixes.map((p) => joinPath(p, h.path)) })
    }
  }
  return registry
}

// ═════════════════════════ CLI ═════════════════════════
const argv = process.argv.slice(2)
const OPTS = {
  staged: argv.includes('--staged'),
  json: argv.includes('--json'),
  selfTest: argv.includes('--self-test'),
  quiet: argv.includes('--quiet'),
  help: argv.includes('--help') || argv.includes('-h'),
}
const MAX_LIST = (() => {
  const m = argv.find((a) => a.startsWith('--max-list='))
  return m ? Number(m.split('=')[1]) : 400
})()

const HELP_TEXT = `
check-capability-catalog.mjs — 能力目录 / 生成产物 / v1 路由登记 三方一致性守门

用法:
  node scripts/check-capability-catalog.mjs [选项]

选项:
  (无参数)      全量模式:A 产物一致性 + B 端点覆盖 + C scope 语义 + D 反向核对
  --staged      仅判定本次暂存的 v1 路由文件(D 反向核对跳过),pre-commit 用
  --json        输出机器可读 JSON
  --self-test   内置样例断言(覆盖 / 未覆盖 / platform 泄漏 / 产物漂移),不读业务文件
  --quiet       抑制 info 输出
  --max-list=N  未覆盖端点清单最多打印 N 行(默认 400,0=只给计数)
  --help        本帮助

退出码:0 通过 / 1 检查失败 / 2 脚本异常
紧急跳过: HUSKY_SKIP_CAPABILITY_CATALOG_GUARD=1 git commit ...

检查项:
  A  capability-catalog.ts 声明的 scope/字段 ↔ generated/capabilities.json
  B  apps/api/src/routes/{,other/}v1-*.ts 每个 handler 必须接能力闸
  C  闸口引用的 scope 必须在目录内;/v1 对第三方开放的 rules 表禁用 platform / 非第三方 scope
  D  目录 routes 声明了但代码里无注册点(warn)
`

function printUncovered(failures) {
  const items = failures.filter((f) => f.code === 'ENDPOINT_UNCOVERED')
  let printed = 0
  for (const f of items) {
    console.error(`${C.bold}  ${f.file}${C.reset} — ${f.endpoints.length} 个`)
    for (const e of f.endpoints) {
      if (printed >= MAX_LIST) {
        const rest = items.reduce((s, x) => s + x.endpoints.length, 0) - printed
        console.error(`${C.dim}    … 其余 ${rest} 行略(--max-list 调整)${C.reset}`)
        return
      }
      console.error(`    ${C.red}✗${C.reset} ${e.method} ${e.path}  ${C.dim}(L${e.line})${C.reset}`)
      printed += 1
    }
  }
}

function loadInputs() {
  const catalogSource = readText(CATALOG_TS_REL)
  if (catalogSource === null) throw new Error(`读不到能力目录源文件: ${CATALOG_TS_REL}`)
  const entries = parseCatalogEntries(catalogSource)
  const rateProfiles = parseRateProfiles(catalogSource)
  const jsonText = readText(MANIFEST_JSON_REL)
  let artifact = null
  let artifactError = null
  if (jsonText !== null) {
    try { artifact = parseArtifact(jsonText) } catch (e) { artifactError = String(e?.message ?? e) }
  }
  return { entries, rateProfiles, artifact, artifactError }
}

function selectRouteFiles(fileSources) {
  const allV1 = [...fileSources.keys()].filter((rel) => V1_ROUTE_FILE_RE.test(rel)).sort()
  if (!OPTS.staged) return { files: allV1, filtered: false }
  const staged = getStagedFiles()
  if (staged === null) return { files: [], filtered: true, unavailable: true }
  const picked = staged.filter((rel) => V1_ROUTE_FILE_RE.test(rel) && existsSync(join(ROOT, rel)))
  return { files: [...new Set(picked)].sort(), filtered: true, stagedCount: staged.length }
}

async function main() {
  if (OPTS.help) { console.log(HELP_TEXT); return 0 }
  if (OPTS.selfTest) return runSelfTest()
  if (process.env.HUSKY_SKIP_CAPABILITY_CATALOG_GUARD === '1') {
    console.log(`${C.yellow}⏭  能力目录守门跳过(HUSKY_SKIP_CAPABILITY_CATALOG_GUARD=1)${C.reset}`)
    return 0
  }

  const { entries, rateProfiles, artifact, artifactError } = loadInputs()
  const routeSources = loadRouteSources(OPTS.staged)
  const { prefixOf } = buildPrefixMap(routeSources)
  const { files: selected, unavailable } = selectRouteFiles(routeSources)
  const routeFiles = selected.map((rel) => {
    const raw = routeSources.get(rel) ?? readText(rel) ?? ''
    return { relPath: rel, analysis: analyzeRouteFile({ relPath: rel, source: raw, prefixes: prefixOf(rel) }) }
  })
  const registry = OPTS.staged ? null : collectRegistry(routeSources, prefixOf)
  const report = evaluate({ entries, rateProfiles, artifact, artifactError, routeFiles, registry })
  const failed = report.failures.length > 0

  if (OPTS.json) {
    console.log(JSON.stringify({
      mode: OPTS.staged ? 'staged' : 'full',
      skippedStagedScan: !!unavailable,
      filesScanned: routeFiles.map((f) => f.relPath),
      stats: report.stats,
      failures: report.failures,
      warnings: report.warnings,
    }, null, 2))
    return failed ? 1 : 0
  }

  const s = report.stats
  const log = (...a) => { if (!OPTS.quiet) console.log(...a) }
  log(`${C.cyan}${C.bold}📇 能力目录守门 check-capability-catalog${C.reset} ${C.dim}(${OPTS.staged ? 'staged 模式' : '全量模式'})${C.reset}`)
  log(`  [A] 产物一致性: 目录 ${s.catalogScopes} 个 scope / 产物 ${s.artifactScopes} 个 → ${failedFor(report, 'A') ? `${C.red}失败${C.reset}` : `${C.green}一致${C.reset}`}`)
  log(`  [B] 端点登记覆盖: ${s.filesScanned} 文件 / ${s.handlers} handler → 已覆盖 ${s.covered}(其中 declareCapability ${s.declareOnly})/ ${C.red}未覆盖 ${s.uncovered}${C.reset}`)
  log(`  [C] scope 语义: 引用 ${s.referencedScopes} 个 scope → 未知 ${s.unknownScopes} / 第三方 rules 泄漏 ${s.platformLeaks}`)
  if (registry) log(`  [D] 反向核对: 目录声明 ${s.declaredRoutes} 条路由 → ${C.yellow}代码中找不到注册点 ${s.staleDeclaredRoutes}${C.reset}`)
  else log(`  [D] 反向核对: ${C.dim}staged 模式跳过(需全量路由树)${C.reset}`)
  if (unavailable) log(`  ${C.yellow}⚠️ 暂存区不可读,B/C 本轮未判定${C.reset}`)

  for (const f of report.failures) {
    if (f.code === 'ENDPOINT_UNCOVERED') continue
    console.error(`${C.red}❌ [${f.check}] ${f.message}${C.reset}`)
  }
  const uncoveredFailures = report.failures.filter((f) => f.code === 'ENDPOINT_UNCOVERED')
  if (uncoveredFailures.length > 0) {
    console.error(`${C.red}${C.bold}❌ [B] 未登记能力的对外端点(共 ${s.uncovered} 个):${C.reset}`)
    if (MAX_LIST !== 0) printUncovered(report.failures)
    console.error(`${C.dim}  修复: 给这些 handler 接 preHandler: [requireApiKeyAuth, requireCapability('<scope>')],`)
    console.error(`        或在路由族上用 addHook('preHandler', requireCapabilityRules([...])) 一次覆盖;`)
    console.error(`        scope 必须先在 ${CATALOG_TS_REL} 登记并 pnpm capabilities:export。${C.reset}`)
  }
  for (const w of report.warnings) console.warn(`${C.yellow}⚠️ [${w.check}] ${w.message}${C.reset}`)

  if (!failed) log(`${C.green}${C.bold}✅ 能力目录与路由登记一致${C.reset}`)
  else {
    console.error(`${C.red}${C.bold}❌ 能力目录守门未通过(${report.failures.filter((f) => f.code !== 'REGENERATE_HINT').length} 项)${C.reset}`)
    console.error(`${C.dim}  紧急跳过: HUSKY_SKIP_CAPABILITY_CATALOG_GUARD=1 git commit ...${C.reset}`)
  }
  return failed ? 1 : 0
}

function failedFor(report, check) {
  return report.failures.some((f) => f.check === check)
}

// ═════════════════════════ --self-test(内置样例断言) ═════════════════════════
const SAMPLE_CATALOG = `
export const RATE_PROFILES = { low: { rpm: 600, burst: 120, dailyCalls: 50_000, concurrent: 8, maxDurationMs: 30_000 } }
export const CAPABILITY_CATALOG = [
  c({ scope: 'chat:write', domain: 'chat', dataClass: 'compute', risk: 'low', billable: true, thirdPartyEligible: true, idempotencyRequired: false, description: '补全', routes: ['POST /v1/chat/completions'], tools: [] }),
  c({ scope: 'publish:operate', domain: 'platform', dataClass: 'platform', risk: 'low', billable: false, thirdPartyEligible: false, idempotencyRequired: true, description: '发布', routes: ['POST /api/publish/*'], tools: ['publish_article'] }),
] as const
`

function sampleArtifact(overrides = {}) {
  const cap = (scope, extra) => ({
    scope,
    domain: extra.domain ?? 'chat',
    dataClass: extra.dataClass ?? 'compute',
    risk: 'low',
    billable: extra.billable ?? true,
    thirdPartyEligible: extra.thirdPartyEligible ?? true,
    idempotencyRequired: extra.idempotencyRequired ?? false,
    description: extra.description ?? '',
    routes: extra.routes ?? [],
    tools: extra.tools ?? [],
    rate: { rpm: 600, burst: 120, dailyCalls: 50000, concurrent: 8, maxDurationMs: 30000 },
  })
  return {
    capabilities: [
      cap('chat:write', { description: '补全', routes: ['POST /v1/chat/completions'], ...overrides }),
      cap('publish:operate', { domain: 'platform', dataClass: 'platform', billable: false, thirdPartyEligible: false, idempotencyRequired: true, description: '发布', routes: ['POST /api/publish/*'], tools: ['publish_article'] }),
    ],
  }
}

function runSelfTest() {
  let failedCount = 0
  const assert = (cond, msg) => {
    if (cond) console.log(`[self-test]   ✅ ${msg}`)
    else { failedCount += 1; console.error(`[self-test]   ❌ ${msg}`) }
  }
  const entries = parseCatalogEntries(SAMPLE_CATALOG)
  const rateProfiles = parseRateProfiles(SAMPLE_CATALOG)
  assert(entries.length === 2, `样例目录解析出 2 个 scope(实际 ${entries.length})`)
  assert(entries[0].routes[0] === 'POST /v1/chat/completions', 'routes 数组解析正确')
  assert(rateProfiles?.low?.dailyCalls === 50000, 'RATE_PROFILES 数字下划线归一(50_000 → 50000)')

  const ok = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [], registry: null })
  assert(ok.failures.length === 0, `产物一致时 A 无失败(实际 ${ok.failures.length})`)

  const drifted = evaluate({ entries, rateProfiles, artifact: sampleArtifact({ billable: false }), artifactError: null, routeFiles: [], registry: null })
  assert(drifted.failures.some((f) => f.code === 'ARTIFACT_DRIFT' && /chat:write\.billable/.test(f.message)), '产物字段漂移 → A 报 ARTIFACT_DRIFT')

  const missingArtifact = evaluate({ entries, rateProfiles, artifact: null, artifactError: null, routeFiles: [], registry: null })
  assert(missingArtifact.failures.some((f) => f.code === 'ARTIFACT_MISSING'), '产物缺失 → A 报 ARTIFACT_MISSING')

  const uncoveredSrc = `export default async (server) => { server.post('/chat/completions', async () => {}) }`
  const coveredSrc = `const gate = requireCapabilityRules([{ methods: ['POST'], pattern: /^\\/v1\\/chat\\/completions$/, scope: 'chat:write' }])
export default async (server) => {
  server.post('/chat/completions', { preHandler: [requireApiKeyAuth, gate] }, async () => {})
  server.get('/chat/sessions', { preHandler: [requireCapability('chat:write')] }, async () => {})
  server.get('/chat/hooks-only', async () => {})
}`
  const hookSrc = `export default async (server) => { server.addHook('preHandler', requireCapabilityRules([{ pattern: /^\\/v1\\/x$/, scope: 'chat:write' }]))
  server.get('/x', async () => {}) }`
  const platformLeak = `export default async (server) => { server.addHook('preHandler', requireCapabilityRules([{ pattern: /^\\/v1\\/publish$/, scope: 'publish:operate' }]))
  server.post('/publish', async () => {}) }`
  const unknownScope = `export default async (server) => { server.post('/z', { preHandler: [requireCapability('nope:read')] }, async () => {}) }`
  const declareSrc = `export default async (server) => { server.post('/d', { preHandler: [declareCapability('chat:write')] }, async () => {}) }`

  const mk = (rel, src) => ({ relPath: rel, analysis: analyzeRouteFile({ relPath: rel, source: src, prefixes: ['/v1'] }) })
  const uncov = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [mk('apps/api/src/routes/v1-a.ts', uncoveredSrc)], registry: null })
  assert(uncov.failures.some((f) => f.code === 'ENDPOINT_UNCOVERED' && f.endpoints[0].path === '/v1/chat/completions' && f.endpoints[0].registeredAs === '/chat/completions'), '未接闸 handler → B 报 ENDPOINT_UNCOVERED 并带前缀展开路径')

  const cov = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [mk('apps/api/src/routes/v1-a.ts', coveredSrc)], registry: null })
  assert(cov.stats.uncovered === 1 && cov.stats.covered === 2, `rules 变量/preHandler 内联算覆盖,裸 handler 不覆盖(covered=${cov.stats.covered} uncovered=${cov.stats.uncovered})`)

  const hook = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [mk('apps/api/src/routes/v1-h.ts', hookSrc)], registry: null })
  assert(hook.stats.uncovered === 0 && hook.stats.covered === 1, '插件级 addHook(requireCapabilityRules) 覆盖全族 handler')

  const leak = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [mk('apps/api/src/routes/v1-p.ts', platformLeak)], registry: null })
  assert(leak.failures.some((f) => f.code === 'PLATFORM_IN_THIRD_PARTY_RULES'), 'platform scope 进入 /v1 对第三方 rules → C 失败')

  // 回归(2026-09-20):箭头函数体内的 rules 变量引用必须被识别为插件级覆盖
  // (早期实现用 parseValue 取第二个实参,只会吃到 (req, reply) 参数列表 → 误报未覆盖)
  const dualChannel = [
    "const diffGate = requireCapabilityRules([{ methods: ['POST'], pattern: /^\\/api\\/v1\\/ai\\/apply-diff$/, scope: 'chat:write' }])",
    'export default async (server) => {',
    '  server.addHook(\'preHandler\', async (request, reply) => { if (hasApiKeyCredential(request)) return diffGate.call(request.server, request, reply) })',
    "  server.post('/apply-diff', async () => {})",
    '}',
  ].join('\n')
  const dual = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [mk('apps/api/src/routes/v1-dual.ts', dualChannel)], registry: null })
  assert(dual.stats.uncovered === 0 && dual.stats.covered === 1, `双通道 addHook 引用 rules 变量算覆盖(uncovered=${dual.stats.uncovered})`)

  const unknown = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [mk('apps/api/src/routes/v1-u.ts', unknownScope)], registry: null })
  assert(unknown.failures.some((f) => f.code === 'SCOPE_UNREGISTERED'), '闸口引用未登记 scope → C 失败')

  const declared = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [mk('apps/api/src/routes/v1-d.ts', declareSrc)], registry: null })
  assert(declared.stats.declareOnly === 1 && declared.stats.uncovered === 0, 'declareCapability 算覆盖但计入 warn 统计')
  assert(declared.warnings.some((w) => w.code === 'DECLARE_ONLY'), 'declareCapability 产生 DECLARE_ONLY 警告')

  const registry = [{ file: 'apps/api/src/routes/v1-a.ts', method: 'POST', candidates: ['/v1/chat/completions'] }]
  const stale = evaluate({ entries, rateProfiles, artifact: sampleArtifact(), artifactError: null, routeFiles: [], registry })
  assert(stale.warnings.filter((w) => w.code === 'DECLARED_ROUTE_NOT_FOUND').length === 1, `目录声明无注册点 → D warn(实际 ${stale.warnings.filter((w) => w.code === 'DECLARED_ROUTE_NOT_FOUND').length})`)
  assert(routesMatch('/api/publish/*', '/api/publish/weibo'), '声明尾部通配匹配实际路径')
  assert(stripComments("// server.get('/x')\n").trim() === '', '注释内的注册点不计入')

  if (failedCount > 0) {
    console.error(`[self-test] ❌ ${failedCount} 个断言失败`)
    return 1
  }
  console.log(`${C.green}[self-test] ✅ 全部断言通过(解析/覆盖判定/语义校验/产物比对逻辑正常)${C.reset}`)
  return 0
}

// ─── 单元测试导出锚点(AGENTS.md §22c) ───
export const __test__ = {
  stripComments,
  parseValue,
  parseCatalogEntries,
  parseRateProfiles,
  compareWithCatalog,
  analyzeRouteFile,
  collectGuardCalls,
  extractHandlers,
  evaluate,
  routesMatch,
  joinPath,
  parseDeclaredRoute,
  V1_ROUTE_FILE_RE,
  SAMPLE_CATALOG,
  sampleArtifact,
}

// ─── 入口守护(AGENTS.md §22d):import 时不触发 main 副作用 ───
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => { process.exit(code) })
    .catch((e) => {
      console.error(`${C.red}❌ check-capability-catalog 脚本执行异常: ${e?.message ?? e}${C.reset}`)
      console.error(e?.stack ?? '(no stack)')
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
