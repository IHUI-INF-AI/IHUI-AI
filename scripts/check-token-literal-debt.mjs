#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-token-literal-debt.mjs — RN 样式裸数字回潮锁(差值棘轮,门 247;原拟 240,远端已占 240=大屏读数百度门,合并前改号)
 *
 * 为什么要有这道门:tokens-migrate 把 261 个已入库屏的 3720 处裸数字转成了 rnSpacing/rnType 档,
 * 但仓里没有任何判据管"新增" —— 不加门,下一次随手写 `padding: 16` 就把它加回来了,
 * 两端样式对齐会重新漂移,而已做的转写没有任何机制保护(§0.9 造好没装车 = 没有)。
 *
 * 判据(复用 tokens-migrate 的 migrateText,单一真相源,本文件零复算):
 *   - "违规" = 该文件里**可自动对档**的裸数字命中数(恰在档才计;10/13/18 这类杂值不计 —— 它们没法自动修,
 *     按 §12e 不做成只有作者能猜的恒红门)。
 *   - 差值棘轮:只拦"本次暂存把违规数变大"。锚点 = **该文件 HEAD blob 自身**的违规数(§0.5)。
 *     存量(HEAD 已有的)只在全量档报数,不判红。
 *   - 新增文件:HEAD 不存在 ⇒ 锚点 0,索引有命中即红(新屏从第一行起就该用档位)。
 *
 * 取材面纪律(§0.4):--staged 判**索引 blob** vs HEAD blob 同面同轮;默认(全量)只报数;
 * --worktree 仅人工逃生舱;两面旗同给 exit 2。取不到任一面 ⇒ exit 2「未判定」,不记绿也不冒红。
 *
 * Usage:
 *   node scripts/check-token-literal-debt.mjs            # 全量报数(不判红)
 *   node scripts/check-token-literal-debt.mjs --staged   # 提交链档:只拦本次新增
 *   node scripts/check-token-literal-debt.mjs --strict   # 全量问责存量(人工盘点用,不进提交链)
 *   node scripts/check-token-literal-debt.mjs --self-test
 */
import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch } from './lib/face-reader.mjs'
import { migrateText } from './tokens-migrate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE_DIRS = ['packages/app/src/', 'apps/mobile-rn/src/']
const isScopedTsx = (rel) => rel.endsWith('.tsx') && SCOPE_DIRS.some((d) => rel.startsWith(d))

/** 文本里可自动对档的裸数字处数;空文本 = 0 */
export function literalDebtOf(text) {
  return text ? migrateText(text).hits : 0
}

/** 差值判定:索引比 HEAD 多出来的处数;>0 即本次回潮 */
export function addedDebt(headHits, stagedHits) {
  return Math.max(0, stagedHits - headHits)
}

function git(args, opts = {}) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', maxBuffer: 1 << 28, ...opts })
}

function scopedTracked() {
  return git(['ls-files', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter(isScopedTsx)
}

function stagedScoped() {
  return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .filter(isScopedTsx)
}

/** 批量取面内容;取不到抛(catBatch 语义),由调用方翻成「未判定」 */
function readFace(face, rels) {
  if (rels.length === 0) return new Map()
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const got = catBatch(ROOT, rels.map((r) => prefix + r), { maxBuffer: 1 << 27 })
  const out = new Map()
  for (const r of rels) out.set(r, got.has(prefix + r) ? got.get(prefix + r) : null)
  return out
}

function scanFull() {
  const files = scopedTracked()
  let headTexts
  try {
    headTexts = readFace('head', files)
  } catch (e) {
    console.error(`❌ 未判定:取不到 HEAD 面(${e?.message ?? e})`)
    process.exit(2)
  }
  const rows = files
    .map((f) => ({ file: f, hits: literalDebtOf(headTexts.get(f)) }))
    .filter((r) => r.hits > 0)
  return { files: files.length, rows, total: rows.reduce((s, r) => s + r.hits, 0) }
}

function scanStaged() {
  const files = stagedScoped()
  if (files.length === 0) return { files: 0, rows: [] }
  let headTexts
  let stagedTexts
  try {
    headTexts = readFace('head', files)
    stagedTexts = readFace('staged', files)
  } catch (e) {
    console.error(`❌ 未判定:取不到被审面(${e?.message ?? e})`)
    process.exit(2)
  }
  const rows = []
  for (const f of files) {
    const headHits = literalDebtOf(headTexts.get(f))
    const stagedHits = literalDebtOf(stagedTexts.get(f))
    const added = addedDebt(headHits, stagedHits)
    if (added > 0) rows.push({ file: f, headHits, stagedHits, added })
  }
  return { files: files.length, rows }
}

function selfTest() {
  const cases = [
    ['padding: 16', 1],
    ['padding: rnSpacing.lg', 0],
    ['padding: 10', 0],
    ['fontSize: 14', 1],
    ['fontSize: rnType.body.size', 0],
    ['marginTop: -16', 0],
    ['gap: 8, rowGap: 12', 2],
  ]
  let failed = 0
  for (const [src, want] of cases) {
    const got = literalDebtOf(src)
    if (got !== want) {
      failed++
      console.error(`✗ 判据对照失败: ${JSON.stringify(src)} 期望 ${want} 实得 ${got}`)
    }
  }
  const diffCases = [
    [3, 3, 0],
    [3, 5, 2],
    [0, 1, 1],
    [5, 3, 0],
  ]
  for (const [h, s, want] of diffCases) {
    if (addedDebt(h, s) !== want) {
      failed++
      console.error(`✗ 差值对照失败: HEAD ${h} / 索引 ${s} 期望 ${want}`)
    }
  }
  // 阳性对照:同一段文本换回裸数字必须被差值判据抓到
  const head = 'const s = { padding: rnSpacing.lg }'
  const staged = 'const s = { padding: 16 }'
  if (addedDebt(literalDebtOf(head), literalDebtOf(staged)) === 0) {
    failed++
    console.error('✗ 阳性对照失败:把档改回裸数字,差值判据没抓到')
  }
  console.log(failed === 0 ? `自检 ${cases.length + diffCases.length + 1} 例,失败 0` : `自检失败 ${failed} 例`)
  process.exit(failed === 0 ? 0 : 1)
}

function run() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  if (staged && worktree) {
    console.error('❌ 未判定:--staged 与 --worktree 同给,取材面不明(§0.4 不允许回落另一个面)')
    process.exit(2)
  }
  if (staged) {
    const { files, rows } = scanStaged()
    if (rows.length === 0) {
      console.log(`✅ token 回潮检查:本次暂存 ${files} 个射程文件,新增可对档裸数字 0 处`)
      return process.exit(0)
    }
    console.error(`❌ 本次把可自动对档的裸数字加回来(${rows.length} 个文件):`)
    for (const r of rows) console.error(`   ${r.file}: HEAD ${r.headHits} → 索引 ${r.stagedHits} (+${r.added})`)
    console.error('   修复:node scripts/tokens-migrate.mjs <file> --apply(恰在档才换,杂值不动)')
    return process.exit(1)
  }
  const { files, rows, total } = scanFull()
  console.log(`token 裸数字报数:射程 ${files} 个 .tsx,可对档存量 ${rows.length} 文件 / ${total} 处`)
  for (const r of rows.sort((a, b) => b.hits - a.hits).slice(0, 20)) {
    console.log(`  ${String(r.hits).padStart(5)} ${r.file}`)
  }
  if (rows.length > 20) console.log(`  … 其余 ${rows.length - 20} 个文件(明细:--strict 或 tokens-migrate 目录档)`)
  if (strict && rows.length > 0) {
    console.error(`❌ --strict 问责存量:${total} 处待转写(修复:node scripts/tokens-migrate.mjs packages/app/src apps/mobile-rn/src --apply)`)
    return process.exit(1)
  }
  console.log('说明:默认档只报数不判红(§12e 存量未清零不得 blocking);提交链只拦本次新增。')
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) run()

export const __test__ = { literalDebtOf, addedDebt }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
