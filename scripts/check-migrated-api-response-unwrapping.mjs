#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-migrated-api-response-unwrapping.mjs
 *
 * 判据(spec 项16 ① / 项18 ③):迁移后的响应解包**待验一致必须为 0**。
 *
 * 契约(取自 `apps/web/src/lib/api.ts` 头注,不是本门自己的发明):
 *   `apiOrThrow<T>` 内部 `const r = await fetchApi<T>(…); …; return r.data`
 *   ⇒ 调用点拿到的**已经是信封的 data**。之后再解一层 `.data` 就是双解包,页面拿到
 *   undefined ⇒ 界面静默空列表;api.ts 头注点名的移动端「把信封当数组 ⇒ 空列表」15 族
 *   正是同一病的另一端。
 *
 * 认定形态(只有**紧跟在调用结果上的链**才算,判据必须逐条可指):
 *   A. `apiOrThrow<…>(…).then(cb)` / `.catch(cb)` 链内 cb 里再取 `.data`;
 *   B. `apiOrThrow<…>(…)` 的结果**直接** `.data`(如 `(await apiOrThrow<T>(x)).data`)。
 * 不认定:调用之后隔了别的语句的任何 `.data`。
 *
 * ⚠️ 首跑教训(写进判据,别改回去):最初用「以 `;` 收束的语句」当切分,在本仓**无分号风格**
 * 下直接失效 —— ASI 让 `queryFn: () => apiOrThrow<…>(…)` 与后面的 react-query `q.state.data`
 * 落进同一段,量出 74 处全是假阳。所以本门改成**括号配平**取调用边界,再只看调用后的链。
 *
 * 退出码:0 = 待验一致 0;1 = 待验点 > 0(逐条点名带行号);2 = 用法/环境错。
 *
 * 跑法:`node scripts/check-migrated-api-response-unwrapping.mjs [--check-gate] [--json]`
 *   `--check-gate` = 判定档(spec 逐字同名);缺省同样判定,该旗只为契约兼容保留。
 * 定位:**验收门**,按票在验收时执行;未登记进 guardian-runner 阻断清单(不改共享提交链),
 * 「在位」不得读成「已接线」。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ROOTS = ['apps/web', 'apps/miniapp-taro', 'apps/mobile-rn']
const SKIP_DIR = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '__tests__', 'e2e', 'cypress'])

function walk(dir, out = []) {
  if (!statSync(dir, { throwIfNoEntry: false })) return out
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch (err) {
    throw new Error(`枚举不到射程目录 ${dir}: ${err.message}`)
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue
      walk(full, out)
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx)$/.test(e.name)) {
      out.push(full)
    }
  }
  return out
}

/** 从 openIdx(须指向 `(`)配平到对应 `)` 的下标;不配平返回 -1 */
function matchParen(src, openIdx) {
  let depth = 0
  let mode = 'code'
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (mode !== 'code') {
      if (c === '\\') { i += 1; continue }
      if ((mode === "'" && c === "'") || (mode === '"' && c === '"') || (mode === '`' && c === '`')) mode = 'code'
      continue
    }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1; i += 1; continue }
    if (c === '(') depth += 1
    else if (c === ')') { depth -= 1; if (depth === 0) return i }
  }
  return -1
}

const CALL_HEAD = /^apiOrThrow\s*(?:<[^\n]*?>)?\s*\(/
const CHAIN_HEAD = /^\s*\.\s*(then|catch|finally|data)\s*/
const DATA_PROP = /^\s*\.\s*data\b/

/** 返回 [{line, kind, snippet}] —— 紧跟调用结果的链上再解一层 `.data` 的点位 */
function findSites(text) {
  const sites = []
  let from = 0
  for (;;) {
    const callIdx = text.indexOf('apiOrThrow', from)
    if (callIdx === -1) break
    const head = text.slice(callIdx, callIdx + 300)
    const m = CALL_HEAD.exec(head)
    if (!m) { from = callIdx + 10; continue }
    const openIdx = callIdx + m[0].length - 1
    const closeIdx = matchParen(text, openIdx)
    if (closeIdx === -1) { from = callIdx + 10; continue }
    const line = text.slice(0, callIdx).split('\n').length

    // B: 调用结果直接 .data
    const direct = text.slice(closeIdx + 1, closeIdx + 40)
    if (DATA_PROP.test(direct)) {
      sites.push({ line, kind: '直接解包', snippet: head.replace(/\s+/g, ' ').slice(0, 160) })
      from = closeIdx + 1
      continue
    }

    // A: .then/.catch/.finally 链内再取 .data(只看链体,不外溢到后面的语句)
    let cursor = closeIdx + 1
    let sawChain = false
    for (;;) {
      const rest = text.slice(cursor, cursor + 4000)
      const cm = CHAIN_HEAD.exec(rest)
      if (!cm) break
      sawChain = true
      const name = cm[1]
      cursor += cm[0].length
      if (name === 'data') {
        sites.push({ line, kind: '链上直接 .data', snippet: head.replace(/\s+/g, ' ').slice(0, 160) })
        break
      }
      const chainOpen = text.indexOf('(', cursor)
      if (chainOpen === -1 || chainOpen - cursor > 20) break
      const chainClose = matchParen(text, chainOpen)
      if (chainClose === -1) break
      const body = text.slice(chainOpen, chainClose + 1)
      if (/\.\s*data\b/.test(body)) {
        sites.push({ line, kind: `链内回调再取 .data`, snippet: body.replace(/\s+/g, ' ').slice(0, 160) })
        break
      }
      cursor = chainClose + 1
    }
    from = sawChain ? cursor : closeIdx + 1
  }
  return sites
}

const scanned = []
const sites = []
for (const rel of ROOTS) {
  const abs = path.join(repoRoot, rel)
  if (!statSync(abs, { throwIfNoEntry: false })) continue
  const files = walk(abs)
  if (files.length === 0) {
    console.error(`射程 ${rel} 枚举不到任何 .ts/.tsx ⇒ 该面未判定(exit 2),不得读成"待验一致 0"`)
    process.exit(2)
  }
  scanned.push({ label: rel, files: files.length })
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    if (!text.includes('apiOrThrow')) continue
    for (const s of findSites(text)) sites.push({ file: path.relative(repoRoot, file).split(path.sep).join('/'), ...s })
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ scanned, pending: sites.length, sites }, null, 2))
} else {
  for (const s of scanned) console.log(`扫描 ${s.label}: ${s.files} 个文件`)
  console.log(`apiOrThrow 调用结果上再解一层 .data 的待验点 = ${sites.length}(blocking)`)
  for (const s of sites) console.log(`  ✗ ${s.file}:${s.line} [${s.kind}] ${s.snippet}`)
}

process.exit(sites.length > 0 ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
