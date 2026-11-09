#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-generated-pin-face.mjs —— 元门 C:派生件「钉面一致性」(2026-11-07)
 *
 * 病根:生成物里的 `inputsSha256` 是**某个面**算出来的。2026-11-07 的事故是:
 * 用**工作树面**算出来的钉值,拿去判**索引面**的提交,于是同一份产物在两个面上互相对不上,
 * 门时红时绿,还会覆盖别人按索引面写好的块。
 *
 * 本门不再手拼 rev/spec(全部走 `lib/gate-face.mjs` 的 readFaceBatch),并做三件事:
 *  ① 在**被审面**(默认 head,可 `--staged` / `--worktree`)上枚举带 `IHUI-GEN-PIN-BEGIN` 的产物;
 *  ② 按被审面现算 `inputsSha256`,与钉里的值比对;
 *  ③ 不一致时**额外在 head/staged/worktree 三个面各算一遍**,报告"钉值是按哪个面算的、
 *     被审面是哪个" —— 这正是事故里最难从日志看出来的一段。
 *
 * 口径:
 *   · 枚举到 0 个带钉产物 ⇒ exit 2(判据无对象不是通过);
 *   · 产物或输入在被审面取不到 ⇒ exit 2(未判定,不得当成"文件不存在");
 *   · 钉格式坏 ⇒ exit 2(判不出不是"不陈旧");
 *   · 面不一致 ⇒ exit 1 并点名两侧;
 *   · 无钉 ⇒ 报告"未钉",不判红(是否必须钉由产物属主决定,本门不越权)。
 *
 * 运行形态:手动 / 由 `scripts/run-reading-trust-defense.mjs` 调度。
 */

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { differingInputs, digestInputs, parsePin } from './lib/generated-input-pin.mjs'
import { assertFaceEnumeration, assertFaceRead } from './lib/face-empty-guard.mjs'
import { gitBinary, selectFace, Undetermined } from './lib/face-reader.mjs'
import { readFaceBatch } from './lib/gate-face.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PIN_MARKER = 'IHUI-GEN-PIN-BEGIN'
const PIN_PATHS = ['apps', 'packages']
const FACES_TO_ATTRIBUTE = ['head', 'staged', 'worktree']

function parseArgs(argv) {
  const opts = { staged: false, worktree: false, json: false }
  for (const a of argv) {
    if (a === '--staged') opts.staged = true
    else if (a === '--worktree') opts.worktree = true
    else if (a === '--json') opts.json = true
    else throw new Undetermined(`未知参数 ${a}`)
  }
  return opts
}

/**
 * 在指定面枚举带钉产物。
 * 参数顺序纪律:`--cached` 之类选项必须落在 pattern **之前**(2026-11-07 事故:
 * `git grep pattern --cached` 让 `--cached` 被当成 pathspec,`--staged` 整面 exit 2)。
 */
function pinnedFilesOnFace(face) {
  const common = ['grep', '-l', '-F', PIN_MARKER]
  const args =
    face === 'staged'
      ? ['grep', '-l', '--cached', '-F', PIN_MARKER, '--', ...PIN_PATHS]
      : face === 'head'
        ? [...common, 'HEAD', '--', ...PIN_PATHS]
        : [...common, '--', ...PIN_PATHS]
  const r = spawnSync(gitBinary(), ['-C', ROOT, ...args], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  if (r.error) throw new Undetermined(`在 ${face} 面枚举带钉产物失败(${r.error.message})`)
  if (r.status === 1) return []
  if (r.status !== 0) throw new Undetermined(`git grep 在 ${face} 面退出 ${r.status}:${(r.stderr || '').trim().slice(0, 200)}`)
  // 给了 rev 时 git grep 输出 `HEAD:<path>`;本门要的是仓库相对路径。
  return r.stdout
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => (face === 'head' ? p.replace(/^HEAD:/, '') : p))
}

/** 取所有面里出现过的输入 rel(去重)。 */
function collectInputRels(pins) {
  const set = new Set()
  for (const p of pins.values()) for (const i of p.parsed.perInput || []) set.add(i.rel)
  return [...set]
}

function readAllFaces(rels) {
  const out = new Map()
  for (const f of FACES_TO_ATTRIBUTE) out.set(f, readFaceBatch(ROOT, f, rels))
  return out
}

/**
 * 纯判定:钉值与被审面现算摘要是否一致;不一致时用三面重算定位"钉是按哪个面算的"。
 * @param {{digest:string, perInput:Array<{rel:string,sha:string}>}} parsed
 * @param {Map<string, {digest:string, perInput:Array}>} perFace
 * @param {string} auditFace
 */
export function judgeProduct(parsed, perFace, auditFace) {
  const audit = perFace.get(auditFace)
  if (audit.digest === parsed.digest) return { status: 'ok', auditFace, pinnedBy: auditFace }
  const matched = FACES_TO_ATTRIBUTE.filter((f) => perFace.get(f)?.digest === parsed.digest)
  return {
    status: matched.length > 0 ? 'face-mismatch' : 'stale',
    auditFace,
    pinnedBy: matched.length > 0 ? matched.join(',') : '(none,与三个面都不一致)',
    pinnedDigest: parsed.digest,
    auditDigest: audit.digest,
    diffs: differingInputs(parsed, audit.perInput).slice(0, 8),
  }
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
  const auditFace = picked.face

  let pinnedFiles
  try {
    pinnedFiles = pinnedFilesOnFace(auditFace)
  } catch (e) {
    console.error(`未判定:${e.message}`)
    process.exit(2)
  }
  try {
    assertFaceEnumeration({ face: auditFace, stage: '带钉产物', count: pinnedFiles.length })
  } catch (e) {
    console.error(`未判定:${e.message}`)
    process.exit(2)
  }

  const products = readFaceBatch(ROOT, auditFace, pinnedFiles)
  const readable = pinnedFiles.filter((f) => typeof products.get(f) === 'string')
  try {
    assertFaceRead({ face: auditFace, stage: '带钉产物正文', requested: pinnedFiles.length, readable: readable.length })
  } catch (e) {
    console.error(`未判定:${e.message}`)
    process.exit(2)
  }

  const pins = new Map()
  const malformed = []
  for (const f of readable) {
    const parsed = parsePin(products.get(f))
    if (parsed.malformed) malformed.push({ file: f, reason: parsed.reason })
    else if (parsed.present) pins.set(f, { parsed })
  }
  if (malformed.length > 0) {
    for (const m of malformed) console.error(`未判定:${m.file} 的钉不可解析(${m.reason})`)
    process.exit(2)
  }

  const inputRels = collectInputRels(pins)
  const textsByFace = readAllFaces(inputRels)
  const report = []
  for (const [file, { parsed }] of pins) {
    const ownRels = (parsed.perInput || []).map((i) => i.rel)
    const perFace = new Map()
    for (const f of FACES_TO_ATTRIBUTE) {
      perFace.set(f, digestInputs(ownRels.map((rel) => ({ rel, text: textsByFace.get(f).get(rel) ?? null }))))
    }
    report.push({ file, ...judgeProduct(parsed, perFace, auditFace) })
  }

  const bad = report.filter((r) => r.status !== 'ok')
  const summary = {
    face: auditFace,
    pinnedProducts: pins.size,
    unPinned: readable.length - pins.size,
    ok: report.filter((r) => r.status === 'ok').length,
    bad: bad.length,
    faceMismatch: report.filter((r) => r.status === 'face-mismatch').length,
    stale: report.filter((r) => r.status === 'stale').length,
  }

  if (opts.json) {
    console.log(JSON.stringify({ ...summary, report }, null, 2))
  } else {
    console.log(
      `派生件钉面一致性:被审面=${auditFace} 带钉产物=${summary.pinnedProducts} 一致=${summary.ok} ` +
        `面错位=${summary.faceMismatch} 陈旧=${summary.stale} 未钉=${summary.unPinned}`,
    )
    for (const r of bad) {
      console.log(`  - ${r.file}:钉值按 ${r.pinnedBy} 面算,被审面是 ${r.auditFace}`)
      console.log(`    pinned=${String(r.pinnedDigest).slice(0, 16)}… audit=${String(r.auditDigest).slice(0, 16)}…`)
      for (const d of r.diffs) console.log(`    ${d.rel}:钉=${String(d.pinned).slice(0, 12)} 现算=${String(d.actual).slice(0, 12)}`)
    }
  }

  if (bad.length > 0) process.exit(1)
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) main()

export { pinnedFilesOnFace }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
