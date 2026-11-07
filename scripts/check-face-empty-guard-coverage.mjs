#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-face-empty-guard-coverage.mjs —— 元门 B:空输入保护的只读盘点(2026-11-07)
 *
 * 本门**不改任何现有门**,只做两件事:
 *  ① 把"有三面旗 + 批量枚举"的门按静态形态分成四类,输出清单(门号到 file:line 由源码可见):
 *     - 真洞(`real-hole`):零值作用在输入集合,所在函数/执行路径内无 exit 2 / 未判定出口;
 *     - 已核实误报(`verified-false-positive`):`depth === 0` 结构配平、self-test 断言、字节 NUL 哨兵;
 *     - 待人工判(`manual-review`):结果计数/中间量/解析不出左值 —— 判不准就不造保护;
 *     - 已保护(`guarded`):零值判定与未判定出口在同一函数作用域 + 同一执行路径。
 *  ② 默认只报清单(exit 0),`--strict` 时**只对真洞**判红(exit 1);
 *     枚举到 0 个门脚本 ⇒ exit 2("取数面不可用",本门自己遵守元门 B 的口径)。
 *
 * 数字纪律(2026-11-07 用户裁定):同时输出旧 `missing-guard` 总数与四分类;真洞才是缺口,
 * 误报/人工不因分类而消失,禁止把"分类后数字变小"写成"缺口减少"。
 *
 * 为什么不做成默认红:盘点对象是**存量**(2026-11-07 之前写的门),把它们一次性判红等于
 * 强迫所有门同批改动,而当日已有四条线在 scripts/ 上并行 —— 这正是要避免的第五次撞车。
 * 逐门修复由各门属主按清单推进(见 `.trae/documents/reading-trust-defense-20261107.md` §3)。
 *
 * 运行形态:手动 / 由 `scripts/run-reading-trust-defense.mjs` 调度。
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { classifyFaceGateSource } from './lib/face-empty-guard.mjs'
import { listFaceFiles, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { readFaceBatch } from './lib/gate-face.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GATE_FILE_RE = /^scripts\/(?:check|scan|guard|verify)-[^/]+\.mjs$/

function parseArgs(argv) {
  const opts = { staged: false, worktree: false, strict: false, json: false }
  for (const a of argv) {
    if (a === '--staged') opts.staged = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--json') opts.json = true
    else throw new Undetermined(`未知参数 ${a}`)
  }
  return opts
}

function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`未判定:${e.message}`)
    process.exit(2)
  }
  const picked = selectFace(opts)
  if (picked.error) {
    console.error(`未判定:${picked.error}`)
    process.exit(2)
  }
  const face = picked.face

  let files
  try {
    files = listFaceFiles(ROOT, face, { paths: ['scripts'] }).filter((f) => GATE_FILE_RE.test(f))
  } catch (e) {
    console.error(`未判定:${face} 面清单不可用(${e.message})`)
    process.exit(2)
  }
  if (files.length === 0) {
    console.error(`未判定:取数面不可用:${face} 面枚举到 0 个门脚本(不得判绿)`)
    process.exit(2)
  }

  let texts
  if (face === 'worktree') {
    texts = new Map(files.map((f) => [f, readWorktreeFile(ROOT, f)]))
  } else {
    texts = readFaceBatch(ROOT, face, files)
  }
  const readable = files.filter((f) => typeof texts.get(f) === 'string')
  if (readable.length === 0) {
    console.error(`未判定:取数面不可用:${face} 面 ${files.length} 个门脚本正文全部取不到`)
    process.exit(2)
  }

  const groups = { guarded: [], 'missing-guard': [], 'no-zero-check': [], 'no-enumeration': [], 'not-face-gate': [] }
  const byClass = {
    guarded: [],
    'real-hole': [],
    'verified-false-positive': [],
    'manual-review': [],
    'no-zero-check': [],
    'no-enumeration': [],
    'not-face-gate': [],
  }
  for (const f of readable) {
    const c = classifyFaceGateSource(texts.get(f))
    groups[c.verdict].push({ file: f, reason: c.reason, classification: c.classification, evidence: c.evidence ?? null })
    byClass[c.classification].push({ file: f, reason: c.reason, excused: c.excused ?? null, evidence: c.evidence ?? null })
  }

  const rawMissing = groups['missing-guard'].length
  const summary = {
    face,
    scannedGates: readable.length,
    faceCapable:
      groups.guarded.length + groups['missing-guard'].length + groups['no-zero-check'].length + groups['no-enumeration'].length,
    guarded: groups.guarded.length,
    // 旧口径(仅 `verdict`):保留,避免"数字因分类而变小"。
    missingGuard: rawMissing,
    // 新口径:真洞才是缺口;误报与待人工判不计入已修。
    realHole: byClass['real-hole'].length,
    verifiedFalsePositive: byClass['verified-false-positive'].length,
    manualReview: byClass['manual-review'].length,
    regradedGuarded: groups.guarded.length,
    noZeroCheck: groups['no-zero-check'].length,
    noEnumeration: groups['no-enumeration'].length,
  }

  if (opts.json) {
    console.log(JSON.stringify({ ...summary, groups, byClass }, null, 2))
  } else {
    console.log(
      `空输入保护盘点:face=${face} 扫描门=${summary.scannedGates} 三面门=${summary.faceCapable} ` +
        `有保护=${summary.guarded} 真洞=${summary.realHole} 已核实误报=${summary.verifiedFalsePositive} ` +
        `待人工判=${summary.manualReview} (旧 missing-guard=${rawMissing};真洞才是缺口,误报/人工不因分类消失)`,
    )
    console.log('真洞(零值作用在输入集合且作用域内无 exit 2/未判定;必须修):')
    for (const g of byClass['real-hole']) {
      const ev = g.evidence || {}
      console.log(`  - ${g.file}:${ev.zeroLine ?? '?'} [${ev.varName ?? '?'}] ${g.reason}`)
    }
    console.log('已核实误报(不计缺口,逐条留证):')
    for (const g of byClass['verified-false-positive']) {
      const ev = g.evidence || {}
      console.log(`  - ${g.file}:${ev.zeroLine ?? '?'} [${g.excused ?? '?'}] ${g.reason}`)
    }
    console.log('待人工判(不造保护,保持现状):')
    for (const g of byClass['manual-review']) {
      const ev = g.evidence || {}
      console.log(`  - ${g.file}:${ev.zeroLine ?? '?'} [${ev.varName ?? '?'}] ${g.reason}`)
    }
    if (groups['no-zero-check'].length > 0) {
      console.log('未判定型(有枚举但没有显式 0 值判定,需人工确认是否把空输入漏过):')
      for (const g of groups['no-zero-check']) console.log(`  - ${g.file}`)
    }
    if (groups['no-enumeration'].length > 0) {
      console.log('单件读取型(有三面旗但未见批量枚举;单件 null 是否等于未判定需人工确认):')
      for (const g of groups['no-enumeration']) console.log(`  - ${g.file}`)
    }
  }

  if (opts.strict && summary.realHole > 0) process.exit(1)
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
