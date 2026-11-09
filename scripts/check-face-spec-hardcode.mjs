#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-face-spec-hardcode.mjs —— 元门 A:面规格拼接静态扫描(2026-11-07)
 *
 * 只做一件事:**门脚本不许自己手拼 git rev/spec**。手拼的地方一旦拼错,git 会返回
 * "不存在",门再把"取不到"当成"没有",于是静默判绿/误判死/数字算小 —— 2026-11-07 一天
 * 出现 6 次同型事故,其中 3 次的直接成因就是这里的三种写法(详见
 * `.trae/documents/reading-trust-defense-20261107.md`)。
 *
 * 运行形态:手动 / 由 `scripts/run-reading-trust-defense.mjs` 调度(本脚本自身不登记为
 * 五处权威接线点,故不在此宣称 hook 位置)。
 *
 * 口径:
 *   · 扫描 `scripts/*.mjs` 与 `scripts/lib/*.mjs`(测试夹具在 scripts/tests,不在扫描面);
 *   · 默认 **棘轮**:基线内=存量(只报清单与计数),基线外=新增 ⇒ exit 1;
 *   · `--strict`:存量也判红(供人工审计/新增门自证用);
 *   · 判定面默认 HEAD;`--staged` / `--worktree` 显式切换;枚举到 0 个文件 ⇒ exit 2(不得判绿)。
 *
 * 本文件与 `scripts/lib/face-spec-scan.mjs` 自身豁免(它们必须写出这些 pattern 才能识别),
 * 豁免面在 `SELF_EXEMPT` 里逐字列名,不允许用通配符扩大。
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { listFaceFiles, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { readFaceBatch } from './lib/gate-face.mjs'
import { baselineKeysFrom, fingerprintHits, scanFaceSpecText, splitByBaseline } from './lib/face-spec-scan.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_PATH = join(ROOT, 'scripts', 'data', 'face-spec-hardcode-baseline.json')

/** 只豁免"识别器自身"与"统一面规格 helper 本体"(spec 的合法拼装点);新增脚本不得加进来。 */
const SELF_EXEMPT = new Set([
  'scripts/check-face-spec-hardcode.mjs',
  'scripts/lib/face-spec-scan.mjs',
  'scripts/lib/gate-face.mjs',
  'scripts/lib/face-reader.mjs',
])

const SCRIPT_FACE_RE = /^scripts\/(?:[^/]+\.mjs|lib\/[^/]+\.mjs)$/

function parseArgs(argv) {
  const opts = { staged: false, worktree: false, strict: false, json: false, baseline: BASELINE_PATH }
  for (const a of argv) {
    if (a === '--staged') opts.staged = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--strict') opts.strict = true
    else if (a === '--json') opts.json = true
    else if (a.startsWith('--baseline=')) opts.baseline = resolve(ROOT, a.slice('--baseline='.length))
    else throw new Undetermined(`未知参数 ${a}`)
  }
  return opts
}

function loadBaseline(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(parsed.entries)) return { ok: false, error: `${file} 缺 entries 数组` }
    return { ok: true, keys: baselineKeysFrom(parsed.entries), total: parsed.entries.length }
  } catch (e) {
    return { ok: false, error: `基线不可读(${e.message})` }
  }
}

/** 按面取脚本正文;任一面整体取不到时返回 ok:false(由调用方 exit 2)。 */
function readScriptsOnFace(face) {
  let files
  try {
    files = listFaceFiles(ROOT, face, { paths: ['scripts'] }).filter((f) => SCRIPT_FACE_RE.test(f))
  } catch (e) {
    return { ok: false, error: `面清单不可用(${e.message})` }
  }
  files = files.filter((f) => !SELF_EXEMPT.has(f))
  if (files.length === 0) {
    return { ok: false, error: `${face} 面枚举到 0 个门脚本(取数面不可用,不得判绿)` }
  }
  const texts = new Map()
  if (face === 'worktree') {
    for (const f of files) texts.set(f, readWorktreeFile(ROOT, f))
  } else {
    const got = readFaceBatch(ROOT, face, files)
    for (const f of files) texts.set(f, got.get(f) ?? null)
  }
  const readable = files.filter((f) => typeof texts.get(f) === 'string').length
  if (readable === 0) {
    return { ok: false, error: `${face} 面 ${files.length} 个脚本正文全部取不到(取数面不可用,不得判绿)` }
  }
  return { ok: true, files, texts, unreadable: files.filter((f) => typeof texts.get(f) !== 'string') }
}

function main() {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(`未判定:${e.message}`)
    process.exit(2)
  }
  const facePick = selectFace(opts)
  if (facePick.error) {
    console.error(`未判定:${facePick.error}`)
    process.exit(2)
  }

  const read = readScriptsOnFace(facePick.face)
  if (!read.ok) {
    console.error(`未判定:${read.error}`)
    process.exit(2)
  }
  if (read.unreadable.length > 0) {
    console.error(`未判定:${facePick.face} 面有 ${read.unreadable.length} 个脚本正文取不到:${read.unreadable.join(', ')}`)
    process.exit(2)
  }

  const baseline = loadBaseline(opts.baseline)
  if (!baseline.ok) {
    console.error(`未判定:${baseline.error}`)
    process.exit(2)
  }

  const hits = []
  for (const [file, text] of read.texts) hits.push(...scanFaceSpecText(text, { file }))
  const fingerprinted = fingerprintHits(hits)
  const { stock, fresh } = splitByBaseline(fingerprinted, baseline.keys)

  const summary = {
    face: facePick.face,
    scannedScripts: read.files.length,
    baselineEntries: baseline.total,
    stock: stock.length,
    fresh: fresh.length,
  }

  if (opts.json) {
    console.log(JSON.stringify({ ...summary, hits: { stock, fresh } }, null, 2))
  } else {
    console.log(`面规格静态扫描:face=${summary.face} 脚本=${summary.scannedScripts} 存量=${summary.stock} 新增=${summary.fresh}`)
    if (stock.length > 0) {
      console.log('存量(棘轮基线内,不判红;修面责任在该门属主):')
      for (const h of stock) console.log(`  - ${h.file}:${h.line} [${h.patternId}] ${h.snippet}`)
    }
    if (fresh.length > 0) {
      console.log('新增(越基线,判红):')
      for (const h of fresh) console.log(`  - ${h.file}:${h.line} [${h.patternId}] ${h.snippet}\n    应改:${h.hint}`)
    }
  }

  if (opts.strict ? fingerprinted.length > 0 : fresh.length > 0) process.exit(1)
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
