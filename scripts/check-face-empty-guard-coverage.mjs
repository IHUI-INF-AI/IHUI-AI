#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-face-empty-guard-coverage.mjs —— 元门 B:空输入保护的只读盘点(2026-11-07)
 *
 * 本门**不改任何现有门**,只做两件事:
 *  ① 把"有三面旗 + 批量枚举"的门按静态形态分成 guarded / missing-guard / no-zero-check /
 *     no-enumeration,输出清单(缺保护的门点名到 file:line 由源码行号可见,不在这里伪造行号);
 *  ② 默认只报清单(exit 0),`--strict` 时对 missing-guard 判红(exit 1),供人工审计;
 *     枚举到 0 个门脚本 ⇒ exit 2("取数面不可用",本门自己遵守元门 B 的口径)。
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
  for (const f of readable) {
    const c = classifyFaceGateSource(texts.get(f))
    groups[c.verdict].push({ file: f, reason: c.reason })
  }

  const summary = {
    face,
    scannedGates: readable.length,
    faceCapable:
      groups.guarded.length + groups['missing-guard'].length + groups['no-zero-check'].length + groups['no-enumeration'].length,
    guarded: groups.guarded.length,
    missingGuard: groups['missing-guard'].length,
    noZeroCheck: groups['no-zero-check'].length,
    noEnumeration: groups['no-enumeration'].length,
  }

  if (opts.json) {
    console.log(JSON.stringify({ ...summary, groups }, null, 2))
  } else {
    console.log(
      `空输入保护盘点:face=${face} 扫描门=${summary.scannedGates} 三面门=${summary.faceCapable} ` +
        `有保护=${summary.guarded} 缺保护=${summary.missingGuard} 无零值判定=${summary.noZeroCheck} 无枚举=${summary.noEnumeration}`,
    )
    console.log('缺保护(有 0 值判定但邻域无 exit 2/未判定;修复责任在各门属主,本门不改它们):')
    for (const g of groups['missing-guard']) console.log(`  - ${g.file}(${g.reason})`)
    if (groups['no-zero-check'].length > 0) {
      console.log('未判定型(有枚举但没有显式 0 值判定,需人工确认是否把空输入漏过):')
      for (const g of groups['no-zero-check']) console.log(`  - ${g.file}`)
    }
    if (groups['no-enumeration'].length > 0) {
      console.log('单件读取型(有三面旗但未见批量枚举;单件 null 是否等于未判定需人工确认):')
      for (const g of groups['no-enumeration']) console.log(`  - ${g.file}`)
    }
  }

  if (opts.strict && summary.missingGuard > 0) process.exit(1)
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
