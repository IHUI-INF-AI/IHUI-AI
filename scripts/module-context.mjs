#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模块阅读包(只读出口)—— 守门 103 的另一半
 *
 * 为什么要有它:`config/architecture-policy.yaml` 此前**只有判据没有出口**。判据只说
 * "哪里不对",agent 真要动一个模块时仍然得手抄边界 —— 而 AGENTS §11 的派单模板**强制**
 * 手写"受影响文件"清单,同一节又记着这份清单写错就是越权/污染事故。本命令把
 * "这个模块是否纳管 / 声明依赖 / 本模块契约文件 / 依赖模块的契约文件 / 公开入口 / 边界条款"
 * 变成一条命令的输出,§11 那一格从手写变成生成。
 *
 * 同源(硬约束):策略表解析、入口解析、契约工件面、齐备性判据**全部 import 自
 * `./check-architecture-policy.mjs`**,本文件不得出现第二份 YAML/exports 解析;
 * 退出码直接由 `auditDeclarations()` 对该模块的结果推导 —— 阅读包说的"缺"与门判的"缺"
 * 必须是同一个函数的同一次结论(两处算同一件事必然漂移)。
 *
 * 与上游形态的差别(规格 §4 已登记的弱点):上游的阅读包是字符串拼装,缺工件只打印
 * `missing` 而**不进退出码**,等于不判。这里两样都给。
 *
 * 用法:
 *   node scripts/module-context.mjs <模块 id>            # 人读版阅读包
 *   node scripts/module-context.mjs <模块 id> --json     # 机器可读(必须可 JSON.parse)
 *   node scripts/module-context.mjs <模块 id> --files    # 只出文件清单(派单"受影响文件"格)
 *   node scripts/module-context.mjs --list               # 列出全部模块 id
 *   可选:--face head|index(默认 head,与判据同面) / --strict / --policy <绝对路径>
 * 退出码:0 齐备 / 1 该模块有按判红口径成立的缺项 / 2 **未知模块 id 或取不到策略表**
 *        (未知 id 不得 exit 0 —— 本仓刚在 sync-lost-commit-tags.mjs 上踩过"静默走默认分支")
 */
import { readFileSync } from 'node:fs'
import { dirname as pDirname, resolve as pResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate, declarationContext, moduleContractArtifacts, resolveEntrypoint, auditDeclarations } from './check-architecture-policy.mjs'
import { catBatch, gitRaw } from './lib/face-reader.mjs'

const ROOT = pResolve(pDirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 180000
const FACES = ['head', 'index']

const git = (args) => gitRaw(args, ROOT, { timeout: GIT_TIMEOUT, maxBuffer: 1 << 29 })
const revOf = (face) => (face === 'head' ? 'HEAD' : face === 'index' ? '' : null)

/** 路径清单:恒取 HEAD(工作树档只把**内容**换成磁盘,清单跟着 HEAD 走才不会漏判失踪文件) */
function facePaths(face) {
  return face === 'index' ? git(['ls-files', '-z']).split('\0').filter(Boolean) : git(['ls-tree', '-r', '--name-only', 'HEAD', '-z']).split('\0').filter(Boolean)
}

function readPolicyFromFace(face, policyPath) {
  const rel = policyPath || gate.POLICY_REL
  if (policyPath && !policyPath.startsWith('/') && !/^[A-Za-z]:/.test(policyPath)) throw new Error(`--policy 必须是绝对路径(相对路径会被按仓库根解释,而自检夹具在仓库外):${policyPath}`)
  const rev = revOf(face)
  const spec = `${rev}:${gate.POLICY_REL}`
  const got = catBatch(ROOT, policyPath ? [] : [spec], { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  const text = policyPath ? readFileSync(rel, 'utf8') : got.get(spec)
  if (typeof text !== 'string' || !text.trim()) throw new Error(`取材面 ${rev || '索引'} 取不到 ${rel}`)
  return { label: `${rev || '索引'}:${rel}`, text }
}

function collect(P, ctx, id) {
  const m = P.modules.get(id)
  const own = moduleContractArtifacts(m, ctx, P)
  const entries = m.entrypoints.map((ep) => ({ ep, ...resolveEntrypoint(m, ep, ctx) }))
  const deps = [...m.requires].map((d) => {
    const t = P.modules.get(d)
    if (!t) return { module: d, managed: null, note: '策略表里没有这一格(T1 会点名)', files: [] }
    const a = moduleContractArtifacts(t, ctx, P)
    return { module: d, managed: t.managed, exported: t.exported, layer: t.layer, entrypoints: t.entrypoints.map((ep) => ({ ep, ...resolveEntrypoint(t, ep, ctx) })), files: a.all.map((x) => x.path) }
  })
  const judged = auditDeclarations(P, ctx, { trialModules: [id] }).violations.filter((v) => v.module === id)
  const accountable = judged.filter((v) => !v.soft)
  const reportedOnly = judged.filter((v) => v.soft)
  const files = [...new Set([...own.all.map((x) => x.path), ...entries.map((e) => e.path).filter((p) => typeof p === 'string'), ...deps.flatMap((d) => [...d.files, ...d.entrypoints.map((e) => e.path).filter((p) => typeof p === 'string')])])]
  return { m, own, entries, deps, missing: accountable.map((v) => `${v.rule}:${v.file}`), reported: reportedOnly.map((v) => `${v.rule}:${v.file}`), files }
}

function main(argv) {
  const json = argv.includes('--json')
  const filesOnly = argv.includes('--files')
  const listOnly = argv.includes('--list')
  const strict = argv.includes('--strict')
  const badFlag = argv.find((a) => a.startsWith('--') && !['--json', '--files', '--list', '--strict', '--face', '--policy'].includes(a))
  if (badFlag) return fail(`未知开关「${badFlag}」:只认 --json / --files / --list / --strict / --face <head|index> / --policy <绝对路径>`)
  const at = (name) => {
    const i = argv.indexOf(name)
    return i >= 0 ? argv[i + 1] : null
  }
  const face = at('--face') || 'head'
  if (!FACES.includes(face)) return fail(`未知 --face「${face}」(只认 ${FACES.join('/')})—— 拼错不得静默走默认档`)
  const policyArg = at('--policy')
  const taken = new Set()
  if (at('--face')) taken.add(argv.indexOf('--face') + 1)
  if (policyArg) taken.add(argv.indexOf('--policy') + 1)
  const positional = argv.filter((a, i) => !a.startsWith('--') && !taken.has(i))
  const id = positional[0] || null

  let P
  let label
  try {
    const src = readPolicyFromFace(face, policyArg)
    label = src.label
    P = gate.loadPolicy(gate.parseYaml(src.text, src.label))
  } catch (e) {
    return fail(`取/解析策略表失败 ⇒ 无法判定:${e.message}`)
  }
  if (listOnly) {
    if (json) console.log(JSON.stringify({ modules: [...P.modules.values()].map((m) => ({ id: m.id, package: m.pkg, layer: m.layer, managed: m.managed, exported: m.exported })) }, null, 2))
    else for (const m of [...P.modules.values()].sort((a, b) => a.id.localeCompare(b.id))) console.log(`${m.managed ? 'managed ' : 'unmanaged'} ${m.id}${m.pkg ? `\t${m.pkg}` : ''}`)
    return 0
  }
  if (!id) return fail('缺少模块 id —— 用法:node scripts/module-context.mjs <模块 id> [--json|--files];全部 id 见 --list')
  if (!P.modules.has(id)) {
    const near = [...P.modules.keys()].filter((k) => k.includes(id)).slice(0, 6)
    return fail(`未知模块 id「${id}」:策略表里没有这一格。相近:${near.length ? near.join(', ') : '(无)'};全部 id 见 node scripts/module-context.mjs --list`)
  }
  const paths = facePaths(face)
  const ctx = declarationContext(P, paths, revOf(face))
  const r = collect(P, ctx, id)
  const bad = r.missing.length + (strict ? r.reported.length : 0)
  if (filesOnly) {
    for (const f of r.files) console.log(f)
    for (const f of r.own.bad.map((x) => x.path)) console.log(`MISSING ${f}`)
    return bad ? 1 : 0
  }
  if (json) {
    console.log(JSON.stringify({ policyFace: label, moduleId: r.m.id, package: r.m.pkg, layer: r.m.layer, managed: r.m.managed, exported: r.m.exported, requires: [...r.m.requires], contractFiles: r.own.all, entries: r.entries, dependencyContracts: r.deps, files: r.files, missing: r.missing, reported: r.reported, unparsedManifests: ctx.unparsed }, null, 2))
    return bad ? 1 : 0
  }
  const yn = (b) => (b === true ? 'yes' : b === false ? 'no' : 'unknown')
  console.log(`# 模块阅读包 ${r.m.id}${r.m.pkg ? ` (${r.m.pkg})` : ''}`)
  console.log(`策略表面: ${label} | 纳管 managed: ${yn(r.m.managed)}${r.m.managed ? '(契约违规按判红口径问责)' : '(只报数)'} | 层: ${r.m.layer} | 对外 exported: ${yn(r.m.exported)}`)
  console.log('边界条款: 跨模块只能经「已声明的 requires + public_entrypoints」进入;按路径穿透别的包内部 = 守门 103 的 D3;未声明就 import = D1。')
  console.log('           行内豁免注释(族名 arch-exempt，须带原因)只对 D 判据生效;不得为消红改 managed / 阈值 / exported。')
  console.log(`\n## 声明依赖 requires(${r.m.requires.size})`)
  for (const d of r.deps) console.log(`- ${d.module}  managed=${yn(d.managed)} exported=${yn(d.exported)}${d.note ? `  ← ${d.note}` : ''}`)
  if (!r.deps.length) console.log('- (无:本模块声明为零依赖)')
  console.log(`\n## 本模块契约文件(${r.own.all.length})`)
  if (!r.own.all.length) console.log('- missing  (一块都没有:未声明 contract_files、不命中 contract_file_patterns、根下也无 README/AGENTS/CONTEXT)')
  for (const x of r.own.all) console.log(`- ${x.exists ? 'present' : 'missing'}  ${x.path}  [${x.source}]`)
  console.log('\n## 公开入口 public_entrypoints(' + r.entries.length + ')')
  if (!r.entries.length) console.log('- (无:本模块声明为不对外,任何 import 它都算 D3)')
  for (const e of r.entries) console.log(`- ${e.state === 'ok' ? 'present' : 'missing'}  ${e.ep}  ${e.state === 'ok' ? `→ ${e.path}` : `→ (${e.how})`}`)
  console.log('\n## 依赖模块的契约文件')
  for (const d of r.deps) {
    console.log(`- ${d.module}(${d.files.length} 份${d.files.length > 10 ? ',只列前 10' : ''})`)
    for (const f of d.files.slice(0, 10)) console.log(`    present ${f}`)
    for (const e of d.entrypoints.slice(0, 10)) console.log(`    ${e.state === 'ok' ? 'present' : 'missing'}  入口 ${e.ep}${e.state === 'ok' ? ` → ${e.path}` : ''}`)
  }
  if (!r.deps.length) console.log('- (无声明依赖)')
  if (ctx.unparsed.length) console.log(`\n⚠️ 这些包清单 JSON.parse 失败,入口判定会退化:${ctx.unparsed.join(', ')}`)
  if (r.reported.length) console.log(`\n· 报数(${strict ? '已按 --strict 升成问责,计入退出码' : '未收口档,不计退出码;--strict 升成问责'}):${r.reported.join(' ; ')}`)
  if (r.missing.length) {
    console.log(`\n❌ 本模块有 ${r.missing.length} 处声明与现实脱节:${r.missing.join(' ; ')}`)
    console.log(`   判据面复现:node scripts/check-architecture-policy.mjs${strict ? ' --strict' : ''}`)
    return 1
  }
  // 人读档的退出码必须跟 --json / --files 用同一把尺(就是上面那个 bad)。
  // 三个面各算各的会产出"同一份阅读包 --json 判 1、人读判 0":调用方拿到什么结论
  // 完全取决于它碰巧用了哪个开关,而 --strict 的问责语义会在人读这一路上静默失效。
  if (bad) {
    console.log(`\n❌ --strict 问责:本模块有 ${r.reported.length} 处契约工件缺项计入退出码:${r.reported.join(' ; ')}`)
    console.log(`   判据面复现:node scripts/check-architecture-policy.mjs --strict`)
    return 1
  }
  console.log(`\n✅ 本模块声明齐备(入口与已声明契约工件都在取材面里)${r.reported.length ? ';仍有报数档缺项,见上' : ''}`)
  return 0
}

function fail(msg) {
  console.error(`❌ ${msg}`)
  return 2
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { main, collect, FACES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
