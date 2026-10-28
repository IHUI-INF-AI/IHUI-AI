#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-tool-schema-projection.mjs —— 投影完整性守门(b76-05 票2,2026-09-30 立)。
 *
 * 判什么(全部对着"真正进生产的那份投影器"跑,不是平行导出):
 *   ① 键序:每个注册工具描述符经 canonical 形态投影后,JSON 键序必须与
 *      canonicalize(sortKeys) 结果一致(canonicalJson 在投影器同一文件,单一实现);
 *   ② 拒绝通道:投影过程中若丢弃/无法解释任何关键字 ⇒ ToolSchemaProjectionError
 *      (携带 `$.properties.x` 形式的路径),本脚本退出码非零并打印该路径;
 *      依赖 $ref 而无 resolver 的描述符在这里**如实报数**(词汇表刻意不含 $ref);
 *   ③ A/B 不回归:逐工具断言投影前后的 property 名集合与 required 集合相等
 *      ({added:[],removed:[],requiredChanged:false}),即 schema-projection.ts
 *      A13 等价性硬门槛的可跑版本;
 *   ④ 缓存中性:同一描述符连续投影 100 次 ⇒ canonicalJson 输出逐字节相等
 *      (防 Object.keys 顺序或插入顺序泄漏进 prompt-cache 前缀)。
 *
 * 取材面:
 *   - 投影器 = packages/types/src/schema-projection.ts **源码**经 typescript.transpileModule
 *     现场转译后 import(该文件对 tool-contract 只有 import type,转译后零运行时依赖,
 *     因此守门永远测的是源码,不吃 stale dist)。转译产物落 .ihui-agent/tmp(非仓库内容)。
 *   - 描述符表 = apps/cli/src/tools/*.ts 的真实工具声明字面量(`parameters: {...}` +
 *     相邻 `required: [...]`),按字符串/注释感知的括号配平截取后求值。
 *     变量引用等无法静态求值的声明逐条计入 skipped(**未判定,不是通过**,汇总点名)。
 *
 * 退出码:0 = 全部可判工具四项全过(允许含 skipped 未判定点名);
 *         1 = 任一工具拒绝/键序/A-B/缓存中性违规。
 * 用法:node scripts/check-tool-schema-projection.mjs [--self-test]
 */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PROBE_DIR = path.join(ROOT, '.ihui-agent', 'tmp', 'b76', 't2-probe')
const TOOLS_SRC_DIR = path.join(ROOT, 'apps', 'cli', 'src', 'tools')
const SELF_TEST = process.argv.includes('--self-test')

const errors = []
const warnings = []

// ---------------------------------------------------------------------------
// 投影器装载:源码现场转译(单一事实源 = src,不吃 dist)
// ---------------------------------------------------------------------------

function loadProjector() {
  const require = createRequire(pathToFileURL(path.join(ROOT, 'package.json')))
  const ts = require('typescript')
  const src = readFileSync(path.join(ROOT, 'packages', 'types', 'src', 'schema-projection.ts'), 'utf-8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  rmSync(PROBE_DIR, { recursive: true, force: true })
  mkdirSync(PROBE_DIR, { recursive: true })
  const outFile = path.join(PROBE_DIR, 'schema-projection.mjs')
  writeFileSync(outFile, js)
  return import(pathToFileURL(outFile).href)
}

// ---------------------------------------------------------------------------
// 字符串/注释感知的括号配平截取(防 description 文案里的 '{' 骗过深度计数)
// ---------------------------------------------------------------------------

function balancedSlice(text, openIdx) {
  const open = text[openIdx]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let i = openIdx
  let state = 'code' // code | line-comment | block-comment | single | double | template
  while (i < text.length) {
    const ch = text[i]
    const next = text[i + 1]
    if (state === 'code') {
      if (ch === '/' && next === '/') { state = 'line-comment'; i += 2; continue }
      if (ch === '/' && next === '*') { state = 'block-comment'; i += 2; continue }
      if (ch === "'") { state = 'single'; i++; continue }
      if (ch === '"') { state = 'double'; i++; continue }
      if (ch === '`') { state = 'template'; i++; continue }
      if (ch === open) depth++
      if (ch === close) {
        depth--
        if (depth === 0) return text.slice(openIdx, i + 1)
      }
      i++
      continue
    }
    if (state === 'line-comment') { if (ch === '\n') state = 'code'; i++; continue }
    if (state === 'block-comment') { if (ch === '*' && next === '/') { state = 'code'; i += 2; continue } i++; continue }
    // 字符串三态:转义跳过下一字符
    if (ch === '\\') { i += 2; continue }
    if ((state === 'single' && ch === "'") || (state === 'double' && ch === '"') || (state === 'template' && ch === '`')) {
      state = 'code'
    }
    i++
  }
  return null
}

/** 从一段工具声明文本里向前找最近的 name: '字面量'(工具名)。 */
function findToolName(text, beforeIdx) {
  const windowStart = Math.max(0, beforeIdx - 800)
  const window = text.slice(windowStart, beforeIdx)
  const hits = [...window.matchAll(/\bname:\s*'([a-zA-Z0-9_.-]+)'/g)]
  return hits.length > 0 ? hits[hits.length - 1][1] : null
}

function listToolSourceFiles() {
  const out = []
  for (const entry of readdirSync(TOOLS_SRC_DIR, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.ts')) out.push(path.join(TOOLS_SRC_DIR, entry.name))
  }
  return out.sort()
}

/** 静态抽取描述符表:返回 Map(工具名 → {parameters, required, source})与 skipped 清单。 */
function extractDescriptorTable() {
  const table = new Map()
  const skipped = []
  for (const file of listToolSourceFiles()) {
    const relFile = path.relative(ROOT, file).replace(/\\/g, '/')
    const text = readFileSync(file, 'utf-8')
    const re = /(?<![\w.)])parameters\s*:\s*\{/g
    let m
    while ((m = re.exec(text)) !== null) {
      const openIdx = m.index + m[0].length - 1
      const lit = balancedSlice(text, openIdx)
      if (!lit) continue
      // 工具名:声明内 name: 必须在 parameters 之前
      const name = findToolName(text, m.index)
      // 相邻 required: [ ... ]
      let required = []
      const tail = text.slice(openIdx + lit.length, openIdx + lit.length + 200)
      const reqMatch = tail.match(/^\s*,\s*required\s*:\s*\[/)
      if (reqMatch) {
        const reqOpen = openIdx + lit.length + reqMatch[0].length - 1
        const reqLit = balancedSlice(text, reqOpen)
        if (reqLit) {
          try {
            required = new Function(`return (${reqLit})`)()
          } catch {
            /* required 求值失败 ⇒ 按空清单处理并记 skipped */
            skipped.push(`${relFile}: ${name ?? '(unnamed)'} required 字面量含变量引用,未判定`)
          }
        }
      }
      const key = `${name ?? `(unnamed@${relFile})`}`
      try {
        const parameters = new Function(`return (${lit})`)()
        // 整体 schema 形态({type:'object', properties:{…}})不是 ToolParameter 映射,
        // 喂给投影器会把 'type' 当属性名 —— 归为未判定,不产出假拒绝。
        if (typeof parameters === 'object' && parameters !== null && ('type' in parameters || 'properties' in parameters)) {
          skipped.push(`${relFile}: ${key} parameters 为整体 schema 形态而非 ToolParameter 映射,未判定`)
        } else if (table.has(key)) {
          table.set(`${key}#${table.size}`, { parameters, required, source: relFile })
        } else {
          table.set(key, { parameters, required, source: relFile })
        }
      } catch (e) {
        skipped.push(`${relFile}: ${key} parameters 字面量含变量引用/TS 语法(${String(e?.message ?? e).split('\n')[0]}),未判定`)
      }
      re.lastIndex = openIdx + lit.length
    }
  }
  return { table, skipped }
}

// ---------------------------------------------------------------------------
// 四项判据
// ---------------------------------------------------------------------------

function collectKeys(node, prefix, out) {
  if (typeof node !== 'object' || node === null) return out
  for (const [k, v] of Object.entries(node)) {
    const p = `${prefix}.${k}`
    out.push(p)
    collectKeys(v, p, out)
  }
  return out
}

function runChecks(proj, table) {
  const results = []
  for (const [name, { parameters, required, source }] of table) {
    const result = { name, source, rejections: [], orderOk: true, ab: null, cacheNeutral: true }
    // ② 拒绝通道 + ①键序 + ④缓存中性 都跑在 canonical 形态上(它内部先走严格投影)
    try {
      const canonical = proj.projectToolInputSchemaCanonical(parameters, required)
      // ① 键序:canonical 形态的序列化必须与 canonicalJson(sortKeys) 一致
      result.orderOk = JSON.stringify(canonical) === proj.canonicalJson(canonical)
      // ③ A/B:property 名集合与 required 集合相等
      const inputProps = new Set(Object.keys(parameters))
      const projectedProps = new Set(Object.keys(canonical.properties ?? {}))
      const added = [...projectedProps].filter((k) => !inputProps.has(k))
      const removed = [...inputProps].filter((k) => !projectedProps.has(k))
      const reqA = [...required].sort().join(',')
      const reqB = [...(canonical.required ?? [])].sort().join(',')
      result.ab = { added, removed, requiredChanged: reqA !== reqB }
      // ④ 缓存中性:同一描述符连续投影 100 次逐字节相等
      let first = null
      let neutral = true
      for (let i = 0; i < 100; i++) {
        const s = proj.canonicalJson(proj.projectToolInputSchemaCanonical(parameters, required))
        if (first === null) first = s
        else if (s !== first) { neutral = false; break }
      }
      result.cacheNeutral = neutral
    } catch (e) {
      if (e && e.name === 'ToolSchemaProjectionError') {
        result.rejections.push({ path: e.path, reason: e.reason })
      } else {
        result.rejections.push({ path: '$', reason: `projection threw: ${String(e?.message ?? e).split('\n')[0]}` })
      }
    }
    results.push(result)
  }
  return results
}

function summarize(results, skipped) {
  let bad = 0
  let $refCount = 0
  for (const r of results) {
    const problems = []
    if (r.rejections.length > 0) {
      problems.push(`拒绝 ${r.rejections.length} 条`)
      for (const rej of r.rejections) {
        console.log(`  ✗ [拒绝] ${r.name} @ ${rej.path}: ${rej.reason}`)
        if (rej.path.includes('$ref') || rej.reason.includes('$ref')) $refCount++
      }
    }
    if (!r.orderOk) problems.push('键序 ≠ canonicalize(sortKeys)')
    if (r.ab && (r.ab.added.length || r.ab.removed.length || r.ab.requiredChanged)) {
      problems.push(`A/B 漂移 ${JSON.stringify({ added: r.ab.added, removed: r.ab.removed, requiredChanged: r.ab.requiredChanged })}`)
    }
    if (!r.cacheNeutral) problems.push('100 次投影输出非逐字节相等')
    if (problems.length > 0) {
      bad++
      for (const p of problems) {
        errors.push(`投影完整性: 工具 "${r.name}"(${r.source}) ${p}`)
        if (!r.rejections.length) console.log(`  ✗ ${r.name}: ${p}`)
      }
    }
  }
  console.log(`可判工具 ${results.length - bad}/${results.length} 全过;$ref 如实报数 ${$refCount} 条;未判定 ${skipped.length} 条`)
  for (const s of skipped.slice(0, 10)) warnings.push(`描述符取材未判定: ${s}`)
  if (skipped.length > 10) warnings.push(`…另有 ${skipped.length - 10} 条未判定声明(汇总从略)`)
  return bad
}

// ---------------------------------------------------------------------------
// self-test:变异自证(判据有牙才配叫门)
// ---------------------------------------------------------------------------

async function selfTest(proj) {
  const st = []
  const good = {
    parameters: { url: { type: 'string', description: 'u' }, flag: { type: 'boolean' } },
    required: ['url'],
  }
  // ST1 阳性:合法描述符四项全过
  const okRun = runChecks(proj, new Map([['good', { ...good, source: 'self-test' }]]))
  st.push([
    'ST1 合法描述符四项全过(阳性对照)',
    okRun[0].rejections.length === 0 && okRun[0].orderOk && okRun[0].ab.added.length === 0 && okRun[0].cacheNeutral,
    JSON.stringify(okRun[0]),
  ])
  // ST2 变异:注入词汇表外关键字 ⇒ 必须拒绝且路径定位到 $.properties.x.anyOf
  const mutated = JSON.parse(JSON.stringify(good))
  mutated.parameters.url.anyOf = [{ type: 'string' }]
  const mutRun = runChecks(proj, new Map([['mut', { ...mutated, source: 'self-test' }]]))
  st.push([
    'ST2 注入 anyOf ⇒ ToolSchemaProjectionError 且路径含 properties.url(拒绝通道有牙)',
    mutRun[0].rejections.some((r) => r.path.includes('properties.url')),
    JSON.stringify(mutRun[0].rejections),
  ])
  // ST3 键序判据有牙:手工构造插入顺序乱的输出 ⇒ orderOk 必须 false
  const unsorted = { type: 'object', required: ['a'], properties: { a: { type: 'string', description: 'd' } } }
  const direct = JSON.stringify(unsorted)
  st.push([
    'ST3 键序判据有牙(乱序 ≠ canonicalJson 排序)',
    direct !== proj.canonicalJson(unsorted),
    direct.slice(0, 40),
  ])
  // ST4 取材面非空:真实描述符表至少 30 个可判工具,否则取材器失效
  const { table, skipped } = extractDescriptorTable()
  st.push([
    'ST4 真实描述符表非空(≥30 个可判工具,防取材正则空转)',
    table.size >= 30,
    `可判 ${table.size},未判定 ${skipped.length}`,
  ])
  const badCount = st.filter((x) => !x[1]).length
  for (const [name, ok, got] of st) console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' —— 实得: ' + got}`)
  console.log(`# 自检 ${st.length - badCount}/${st.length} 通过`)
  process.exit(badCount ? 1 : 0)
}

// ---------------------------------------------------------------------------

const proj = await loadProjector()
if (SELF_TEST) {
  await selfTest(proj)
}
console.log('\n=== 投影完整性守门(check-tool-schema-projection) ===')
const { table, skipped } = extractDescriptorTable()
console.log(`描述符表: 可判 ${table.size} 个工具,未判定 ${skipped.length} 条声明`)
const results = runChecks(proj, table)
const bad = summarize(results, skipped)
if (errors.length > 0) {
  console.log('\n阻断项:')
  for (const e of errors) console.log(`  - ${e}`)
  process.exit(1)
}
console.log('✅ 投影完整性守门通过(键序/拒绝通道/A-B/缓存中性)')
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
