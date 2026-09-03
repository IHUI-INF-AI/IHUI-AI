#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-mobile-rn-style-parity.mjs — mobile-rn 跨端样式一致性守门(2026-09-03 立)。
 *
 * 背景:web/miniapp-taro 与 mobile-rn 必须视觉一致(除平台独占差异)。miniapp-taro 端
 *       已由 check-miniapp-taro-style-parity.mjs 完成 token 化守门,但 mobile-rn 端
 *       存量页(Uniapp 迁移)仍有大量硬编码 hex,导致两端色值分裂。本脚本采用
 *       基线模式:存量硬编码记录在 scripts/rn-style-parity-baseline.json 中放行,
 *       任何新增硬编码 hex 即 BLOCK,推动存量只减不增,最终与小程序端 token 体系对齐。
 *
 * 校验内容:
 *   RULE-1 (BLOCK): src/**(ts/tsx)中出现基线之外的新增 #hex 字面量(必须改用
 *                   @ihui/design-tokens 的 rnLightTokens/rnDarkTokens)。
 *   RULE-2 (WARN) : 基线中已不存在的条目(文件已治理,建议 --update-baseline 收紧基线)。
 *
 * 退出码:0 = 全部通过(含 WARN,不阻塞);1 = 出现 BLOCK 级失败(阻塞)。
 *
 * 用法:
 *   node scripts/check-mobile-rn-style-parity.mjs                  # 全量校验
 *   node scripts/check-mobile-rn-style-parity.mjs --update-baseline # 治理后收紧基线
 *   node scripts/check-mobile-rn-style-parity.mjs --quiet           # 仅输出失败
 *   node scripts/check-mobile-rn-style-parity.mjs --help            # 帮助
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, sep } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码绝对路径) ───
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'apps/mobile-rn/src')
const BASELINE_PATH = join(root, 'scripts/rn-style-parity-baseline.json')

// ─── CLI 解析 ───
const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const showHelp = argv.includes('--help') || argv.includes('-h')
const updateBaseline = argv.includes('--update-baseline')

if (showHelp) {
  console.log(`
check-mobile-rn-style-parity.mjs — mobile-rn 跨端样式一致性守门(2026-09-03)

用法:
  node scripts/check-mobile-rn-style-parity.mjs [选项]

选项:
  --update-baseline    用当前扫描结果重写基线(仅在完成治理、减少硬编码后使用)
  --quiet, -q          仅输出失败(BLOCK 级)信息
  --help, -h           显示此帮助

校验内容:
  RULE-1 (BLOCK) src/**(ts/tsx)出现基线之外的新增硬编码 #hex(必须改用 design-tokens)
  RULE-2 (WARN)  基线中已不存在的条目(建议 --update-baseline 收紧)

退出码:
  0 = 通过(含 WARN)
  1 = BLOCK 级失败
`)
  process.exit(0)
}

// ─── 工具函数 ───

/** 读取文本并去除 BOM。 */
function readText(p) {
  let s = readFileSync(p, 'utf8')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s
}

/** 去除 TS/JS 行注释与块注释(避免把注释里的示例色值当硬编码)。 */
function stripTsComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** 递归收集目录下所有指定后缀文件。 */
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, exts, out)
    else if (exts.includes(full.slice(full.lastIndexOf('.') + 1))) out.push(full)
  }
  return out
}

/** 扫描单文件,返回 { file(相对路径,正斜杠), hexes(小写去重) }。 */
function scanFile(f) {
  const clean = stripTsComments(readText(f))
  const hexes = new Set()
  const re = /#([0-9a-fA-F]{3,8})\b/g
  let m
  while ((m = re.exec(clean)) !== null) hexes.add(m[0].toLowerCase())
  const rel = f.slice(SRC.length + 1).split(sep).join('/')
  return { file: rel, hexes: [...hexes] }
}

// ─── 主校验逻辑 ───

/** @returns {number} exit code */
function main() {
  if (!quiet) console.log('[check-mobile-rn-style-parity] RN 端硬编码 hex 基线守门...')

  if (!existsSync(SRC)) {
    console.error(`[FAIL] 扫描目录不存在: ${SRC}`)
    return 1
  }

  const files = walk(SRC, ['ts', 'tsx'])
  const current = files.map(scanFile).filter((e) => e.hexes.length > 0)
  const currentMap = new Map(current.map((e) => [e.file, new Set(e.hexes)]))
  const currentCount = current.reduce((n, e) => n + e.hexes.length, 0)

  // ── --update-baseline:用当前结果重写基线(只应由治理提交调用) ──
  if (updateBaseline) {
    const baseline = {}
    for (const [file, hexes] of [...currentMap.entries()].sort()) {
      baseline[file] = [...hexes].sort()
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
    console.log(`[OK] 基线已更新: ${BASELINE_PATH}(${currentCount} 处硬编码 / ${current.length} 文件)`)
    return 0
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`[FAIL] 基线文件不存在: ${BASELINE_PATH}`)
    console.error('       首次建立基线请运行: node scripts/check-mobile-rn-style-parity.mjs --update-baseline')
    return 1
  }

  let baseline
  try {
    baseline = JSON.parse(readText(BASELINE_PATH))
  } catch (e) {
    console.error(`[FAIL] 基线文件解析失败: ${e.message}`)
    return 1
  }
  const baselineMap = new Map(Object.entries(baseline).map(([f, h]) => [f, new Set(h)]))

  // ── RULE-1:基线之外的新增硬编码 hex -> BLOCK ──
  const newHits = [] // { file, hexes[] }
  for (const [file, hexes] of currentMap) {
    const base = baselineMap.get(file) || new Set()
    const added = [...hexes].filter((h) => !base.has(h))
    if (added.length > 0) newHits.push({ file, added })
  }
  // 文件被删除但基线还在 -> 提示收紧(WARN,不算失败)
  const staleFiles = [...baselineMap.keys()].filter((f) => !currentMap.has(f))
  // 基线中已有文件里被治理掉的 hex -> WARN
  const shrunk = []
  for (const [file, base] of baselineMap) {
    const cur = currentMap.get(file)
    if (!cur) continue
    const removed = [...base].filter((h) => !cur.has(h))
    if (removed.length > 0) shrunk.push({ file, removed })
  }

  if (newHits.length > 0) {
    console.error(`[FAIL] RULE-1: ${newHits.length} 个文件出现基线之外的新增硬编码 #hex(必须改用 @ihui/design-tokens):`)
    for (const h of newHits.slice(0, 30))
      console.error(`    apps/mobile-rn/src/${h.file}: ${h.added.join(' ')}`)
  } else if (!quiet) {
    console.log(`[PASS] RULE-1: 无新增硬编码 #hex(存量 ${currentCount} 处 / ${current.length} 文件,只减不增)`)
  }

  let warnings = 0
  if (staleFiles.length > 0 || shrunk.length > 0) {
    warnings = staleFiles.length + shrunk.length
    console.warn(`[WARN] RULE-2: ${staleFiles.length} 个基线文件已删除 / ${shrunk.length} 个文件硬编码已减少,建议运行 --update-baseline 收紧基线:`)
    for (const f of staleFiles.slice(0, 10)) console.warn(`    apps/mobile-rn/src/${f}(已删除)`)
    for (const s of shrunk.slice(0, 10)) console.warn(`    apps/mobile-rn/src/${s.file}(已移除: ${s.removed.join(' ')})`)
  }

  if (newHits.length > 0) {
    console.error(`\n❌ RN 端样式一致性守门失败:新增硬编码 hex 将加剧与小程序端的视觉分裂`)
    return 1
  }
  if (!quiet) {
    if (warnings > 0) console.log(`\n✅ RN 端样式一致性守门通过(${warnings} 项 WARN,建议收紧基线)`)
    else console.log('\n✅ RN 端样式一致性守门通过')
  }
  return 0
}

process.exit(main())
