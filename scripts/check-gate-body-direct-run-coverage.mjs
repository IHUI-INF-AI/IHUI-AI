#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 门 312:直跑面判面层覆盖 ratchet(2026-11-08 立,配套 fix/gate-body-provenance-1108)。
 *
 * 立因:门体同代自检(gate-body-provenance)已在所有**派发**路径上强制;但人手
 * `node scripts/check-x.mjs` 直跑时,只有 import 了判面层的门才会经 selectFace 触发自检。
 * 存量 48 道没 import ⇒ 直跑面仍是缝。本门把这条缝钉成「只许收紧」的闸:
 *
 * R1 注册门(scripts/guardian-runner.mjs 里 `script:`)若 import 闭包不含判面层,且不在
 *    scripts/data/gate-body-direct-run-allowlist.json ⇒ 判红(新门再也长不进这条缝)。
 * R2 台账条目必须 ⊆ BASELINE_PATHS(硬基线,内嵌本文件)⇒ 清单只许缩短,不许新增抵账。
 * R3 台账条目对应的门现已覆盖 ⇒ 判红(清单腐烂;删掉条目本身就是「已迁移」的证据)。
 * R4 why < 10 字、reviewBy 缺失/非法/到期 ⇒ 判红。
 * R5 registry 读数不到 / 0 道门 / 闭包超预算 / 台账形状非法 ⇒ 未判定 exit 2(本门没有资格答 0/1)。
 *
 * 用法:
 *   node scripts/check-gate-body-direct-run-coverage.mjs            # 判 HEAD
 *   node scripts/check-gate-body-direct-run-coverage.mjs --staged   # 判索引
 *  手跑单门请改走:node scripts/guardian-runner.mjs --only=<id|script>(派发面含门体自检)
 *
 * 单一真相源:本门与 gate-body-provenance 复用同一条闭包遍历(closureFromTexts),
 * 不另起一套 import 解析。
 */
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { listFaceFiles, selectFace } from './lib/face-reader.mjs'
import { blobsAtFace, closureFromTexts, faceLabel, findRepoRoot } from './lib/gate-body-provenance.mjs'

const SELF = fileURLToPath(import.meta.url)
const REGISTRY_REL = 'scripts/guardian-runner.mjs'
const ALLOWLIST_REL = 'scripts/data/gate-body-direct-run-allowlist.json'
const SURFACES = ['scripts/lib/face-reader.mjs', 'scripts/lib/gate-body-provenance.mjs']
const KIND = 'direct-run-uncovered'
const WHY_MIN = 10
const BASELINE_PATHS = [
  "scripts/check-adapter-style-parity.mjs",
  "scripts/check-adapter-wiring.mjs",
  "scripts/check-artifact-budget.mjs",
  "scripts/check-brand-email-channel.mjs",
  "scripts/check-c-drive-pollution.mjs",
  "scripts/check-cli-i18n-parity.mjs",
  "scripts/check-config-table-existence.mjs",
  "scripts/check-cross-end-parity-drift.mjs",
  "scripts/check-cross-end-spec-coverage.mjs",
  "scripts/check-db-schema-drift.mjs",
  "scripts/check-dev-db-rotation-window.mjs",
  "scripts/check-diagnostic-redaction.mjs",
  "scripts/check-dist-encoding.mjs",
  "scripts/check-error-message-bounded.mjs",
  "scripts/check-home-junctions.mjs",
  "scripts/check-i18n-broken-en.mjs",
  "scripts/check-i18n-cross-end-wording.mjs",
  "scripts/check-icu-locale-support.mjs",
  "scripts/check-installer-assets.mjs",
  "scripts/check-lint-staged-stdio-pin.mjs",
  "scripts/check-list-cap-honesty.mjs",
  "scripts/check-llm-provider-schema.mjs",
  "scripts/check-mass-deletion.mjs",
  "scripts/check-migration-ledger-drift.mjs",
  "scripts/check-nested-additional-properties.mjs",
  "scripts/check-no-conflict-markers.mjs",
  "scripts/check-overlay-zindex.mjs",
  "scripts/check-parent-pollution.mjs",
  "scripts/check-process-exit-attribution.mjs",
  "scripts/check-project-plan-size.mjs",
  "scripts/check-safe-parse.mjs",
  "scripts/check-scratch-root-no-nesting.mjs",
  "scripts/check-service-binary-paths.mjs",
  "scripts/check-sse-frame-watermark.mjs",
  "scripts/check-staged-typecheck-mirror-sync.mjs",
  "scripts/check-stale-stashes.mjs",
  "scripts/check-statusbar-single-source.mjs",
  "scripts/check-tagsview-visual.mjs",
  "scripts/check-tool-schema-projection.mjs",
  "scripts/check-upload-budget.mjs",
  "scripts/check-verify-tmp-files.mjs",
  "scripts/check-watermark-syntax.mjs",
  "scripts/check-workflow-step-order.mjs",
  "scripts/check-zh-term-quality.mjs",
  "scripts/desktop-nsis-template.mjs",
  "scripts/fix-package-exports-conditions.mjs",
  "scripts/gen-knip-taro-entries.mjs",
  "scripts/gen-tool-name-sets.mjs"
]

function makeFaceReader(root, face) {
  const cache = new Map()
  const readText = (rel) => {
    if (!cache.has(rel)) {
      const hit = blobsAtFace(root, face, [rel]).get(rel)
      cache.set(rel, hit && hit.exists ? hit.text : null)
    }
    return cache.get(rel) ?? null
  }
  const preload = (rels) => {
    const missing = [...new Set(rels)].filter((r) => !cache.has(r))
    if (missing.length === 0) return
    const batch = blobsAtFace(root, face, missing)
    for (const rel of missing) {
      const hit = batch.get(rel)
      cache.set(rel, hit && hit.exists ? hit.text : null)
    }
  }
  return { readText, preload }
}

function validateLedger(ledger, rel) {
  if (!ledger || !Array.isArray(ledger.entries)) return [`${rel} 形状非法:需 { entries: [...] }`]
  const errors = []
  const seen = new Set()
  ledger.entries.forEach((row, i) => {
    const tag = `entries[${i}]`
    if (!row || typeof row !== 'object') return errors.push(`${tag} 不是对象`)
    if (typeof row.path !== 'string' || !row.path.startsWith('scripts/')) errors.push(`${tag}.path 必须是 scripts/ 下路径`)
    else if (seen.has(row.path)) errors.push(`${tag}.path 重复:${row.path}`)
    else seen.add(row.path)
    if (row.kind !== KIND) errors.push(`${tag}.kind 必须是 ${KIND}`)
    if (typeof row.why !== 'string' || row.why.trim().length < WHY_MIN) errors.push(`${tag}.why 少于 ${WHY_MIN} 字`)
    if (typeof row.reviewBy !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewBy)) {
      errors.push(`${tag}.reviewBy 必须是 YYYY-MM-DD`)
    }
    return undefined
  })
  return errors
}

/**
 * 审计主体。返回 { code, lines }:code=0/1 可答;code=2 表示本门没有资格作答。
 * @param {{root:string, face:string, allowlistRel?:string, baseline?:string[]}} args
 */
export function runAudit({ root, face, allowlistRel = ALLOWLIST_REL, baseline = BASELINE_PATHS }) {
  const label = faceLabel(face)
  const { readText: readBlob, preload } = makeFaceReader(root, face)
  // 判面文件清单先取一次:候选路径「在不在这个面」用纯内存 Set 判,避免为不存在的
  // 候选(扩展名变体 / import 字符串里的假路径)逐条 spawn git —— 并发合入期一次
  // git 调用可到 100ms+,几百条就会把门拖成分钟级。
  let known = null
  try {
    known = new Set(listFaceFiles(root, face, { paths: ['scripts/'] }))
  } catch {
    known = null
  }
  const readText = (rel) => (known && !known.has(rel) ? null : readBlob(rel))

  const registry = readText(REGISTRY_REL)
  if (registry === null) {
    return { code: 2, lines: [`未判定:[312] ${label} 面读不到 ${REGISTRY_REL} —— 无法枚举注册门,本门没有资格回答 0 或 1`] }
  }
  const scripts = [...new Set([...registry.matchAll(/script:\s*'([^']+)'/g)].map((m) => m[1]))].sort()
  if (scripts.length === 0) {
    return { code: 2, lines: [`未判定:[312] ${label} 面从 ${REGISTRY_REL} 枚举到 0 道门 —— registry 形状变了,本门无法判定`] }
  }
  // 一次批量预热:注册门脚本 + scripts/lib 全量。闭包遍历里 readText 若是逐文件 spawn git,
  // 在并发合入期(共享对象库有锁竞争)会慢到分钟级 —— 这里把 git 调用压到常数次。
  let libFiles = []
  try {
    libFiles = listFaceFiles(root, face, { paths: ['scripts/lib/'] })
  } catch {
    libFiles = []
  }
  preload([...libFiles, ...scripts.map((s) => `scripts/${s}`)])

  const ledgerText = readText(allowlistRel)
  if (ledgerText === null) {
    return { code: 2, lines: [`未判定:[312] ${label} 面读不到台账 ${allowlistRel} —— 存量债无账可查,本门拒绝作答`] }
  }
  let ledger
  try {
    ledger = JSON.parse(ledgerText)
  } catch {
    ledger = null
  }
  const shapeErrors = validateLedger(ledger, allowlistRel)
  if (shapeErrors.length > 0) {
    return { code: 2, lines: [`未判定:[312] 台账 ${allowlistRel} 形状非法(${shapeErrors.length} 处)`, ...shapeErrors.slice(0, 12).map((e) => `  ${e}`)] }
  }

  const uncovered = []
  for (const name of scripts) {
    const rel = `scripts/${name}`
    let closure
    try {
      closure = closureFromTexts(rel, readText)
    } catch (e) {
      return { code: 2, lines: [`未判定:[312] 门体闭包超预算:${rel}(${e.message})`] }
    }
    if (!SURFACES.some((x) => closure.includes(x))) uncovered.push(rel)
  }

  const uncoveredSet = new Set(uncovered)
  const allowSet = new Set(ledger.entries.map((e) => e.path))
  const today = new Date().toISOString().slice(0, 10)

  const newUncovered = uncovered.filter((rel) => !allowSet.has(rel))
  const notInBaseline = ledger.entries.filter((e) => !baseline.includes(e.path))
  const rotten = ledger.entries.filter((e) => !uncoveredSet.has(e.path))
  const expired = ledger.entries.filter((e) => e.reviewBy < today)

  const label312 = `[312] 直跑面判面层覆盖 ratchet · 面=${label}`
  if (newUncovered.length + notInBaseline.length + rotten.length + expired.length === 0) {
    return {
      code: 0,
      lines: [`✅ ${label312}:注册门 ${scripts.length} 道 / 已覆盖 ${scripts.length - uncovered.length} / 存量债 ${ledger.entries.length} / 到期 0`],
    }
  }

  const lines = [`❌ ${label312} 判红`, `  注册门 ${scripts.length} 道 / 已覆盖 ${scripts.length - uncovered.length} / 存量债 ${ledger.entries.length}`]
  if (newUncovered.length > 0) {
    lines.push(`  R1 新增未接判面层的注册门 ${newUncovered.length} 道(必须 import './lib/face-reader.mjs'):`)
    for (const rel of newUncovered) lines.push(`    - ${rel}`)
  }
  if (notInBaseline.length > 0) {
    lines.push(`  R2 台账只许缩短:${notInBaseline.length} 条不在硬基线内(新增条目必须先迁门,不许抵账):`)
    for (const e of notInBaseline) lines.push(`    - ${e.path}`)
  }
  if (rotten.length > 0) {
    lines.push(`  R3 清单腐烂:${rotten.length} 条对应的门已接判面层,必须删条目(删除本身即「已迁移」证据):`)
    for (const e of rotten) lines.push(`    - ${e.path}`)
  }
  if (expired.length > 0) {
    lines.push(`  R4 到期未迁移:${expired.length} 条 reviewBy 已过期:`)
    for (const e of expired) lines.push(`    - ${e.path}(reviewBy ${e.reviewBy})`)
  }
  lines.push('  修复:新增门 import 判面层;已迁移门删台账条目;手跑单门走 guardian-runner --only=<id|script>。')
  return { code: 1, lines }
}

function main() {
  const argv = process.argv.slice(2)
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    process.stderr.write(`未判定:[312] ${error}\n`)
    process.exit(2)
  }
  let root
  try {
    const rootArg = argv.find((a) => a.startsWith('--root='))
    root = rootArg ? resolve(rootArg.slice('--root='.length)) : findRepoRoot(SELF)
  } catch {
    process.stderr.write('未判定:[312] 定位仓库根失败 —— 本门无法判定\n')
    process.exit(2)
  }
  const { code, lines } = runAudit({ root, face })
  const text = `${lines.join('\n')}\n`
  if (code === 0) process.stdout.write(text)
  else process.stderr.write(text)
  process.exit(code)
}

const isDirectRun = Boolean(process.argv[1]) && resolve(process.argv[1]) === resolve(SELF)
if (isDirectRun) main()

export const __test__ = { runAudit, BASELINE_PATHS, ALLOWLIST_REL, REGISTRY_REL }
