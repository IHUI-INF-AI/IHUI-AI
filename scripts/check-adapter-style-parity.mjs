#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-adapter-style-parity.mjs — miniapp-taro adapter 层硬编码颜色守门(2026-09-03 立)。
 *
 * 背景:adapter 层(apps/miniapp-taro/src/components/adapters/*.taro.tsx)规范是
 *       「禁止硬编码颜色,一律用 getRnTokens(effectiveScheme) 取 token」。但个别残留
 *       与 packages/app 共享源组件逐字一致(轮播点/空态文字/加载器动态 HSL 等),
 *       属合理保留。本脚本采用基线模式(学习 check-mobile-rn-style-parity.mjs):
 *       存量记录在 scripts/adapter-style-parity-baseline.json 中放行,
 *       任何新增硬编码颜色即 BLOCK,推动存量只减不增。
 *
 * 扫描范围:仅 adapters/*.taro.tsx(index.ts 无样式,自然零命中)。
 * 提取规则:去注释后提取 #hex(3-8 位)与 rgba()/rgb()/hsla()/hsl() 字面量
 *          (含 SVG 字符串 fill/stroke 与渐变 stop 内的色值,统一按颜色字面量计)。
 *
 * 校验内容:
 *   RULE-1 (BLOCK): 出现基线之外的新增硬编码颜色(必须改用 getRnTokens token)。
 *   RULE-2 (WARN) : 基线中已不存在的条目(文件已治理,建议 --update-baseline 收紧基线)。
 *
 * 退出码:0 = 全部通过(含 WARN,不阻塞);1 = 出现 BLOCK 级失败(阻塞)。
 *
 * 用法:
 *   node scripts/check-adapter-style-parity.mjs                  # 全量校验
 *   node scripts/check-adapter-style-parity.mjs --update-baseline # 治理后收紧基线
 *   node scripts/check-adapter-style-parity.mjs --quiet           # 仅输出失败
 *   node scripts/check-adapter-style-parity.mjs --help            # 帮助
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码绝对路径) ───
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADAPTERS_DIR = join(root, 'apps/miniapp-taro/src/components/adapters')
const BASELINE_PATH = join(root, 'scripts/adapter-style-parity-baseline.json')

// ─── CLI 解析 ───
const argv = process.argv.slice(2)
const quiet = argv.includes('--quiet') || argv.includes('-q')
const showHelp = argv.includes('--help') || argv.includes('-h')
const updateBaseline = argv.includes('--update-baseline')

if (showHelp) {
  console.log(`
check-adapter-style-parity.mjs — miniapp-taro adapter 层硬编码颜色守门(2026-09-03)

用法:
  node scripts/check-adapter-style-parity.mjs [选项]

选项:
  --update-baseline    用当前扫描结果重写基线(仅在完成治理、减少硬编码后使用)
  --quiet, -q          仅输出失败(BLOCK 级)信息
  --help, -h           显示此帮助

扫描范围:
  apps/miniapp-taro/src/components/adapters/*.taro.tsx

提取规则:
  去注释后的 #hex(3-8 位)与 rgba()/rgb()/hsla()/hsl() 颜色字面量
  (含 SVG 字符串 fill/stroke 与渐变 stop 内色值)

校验内容:
  RULE-1 (BLOCK) 出现基线之外的新增硬编码颜色(必须改用 getRnTokens token)
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

/** 收集 adapters 目录下所有 .taro.tsx 文件(不递归,adapter 层为平铺目录)。 */
function listAdapters(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.taro.tsx'))
    .map((name) => join(dir, name))
}

const COLOR_RES = [
  /#[0-9a-fA-F]{3,8}\b/g,
  /\b(?:rgba?|hsla?)\([^)]*\)/gi,
]

/** 扫描单文件,返回 { file(相对 adapters 目录,正斜杠), colors(小写去重排序) }。 */
function scanFile(f) {
  const clean = stripTsComments(readText(f))
  const colors = new Set()
  for (const src of COLOR_RES) {
    const re = new RegExp(src.source, src.flags.includes('g') ? src.flags : src.flags + 'g')
    let m
    while ((m = re.exec(clean)) !== null) colors.add(m[0].toLowerCase().replace(/\s+/g, ''))
  }
  return { file: f.slice(ADAPTERS_DIR.length + 1).split('\\').join('/'), colors: [...colors].sort() }
}

// ─── 主校验逻辑 ───

/** @returns {number} exit code */
function main() {
  if (!quiet) console.log('[check-adapter-style-parity] adapter 层硬编码颜色基线守门...')

  if (!existsSync(ADAPTERS_DIR)) {
    console.error(`[FAIL] 扫描目录不存在: ${ADAPTERS_DIR}`)
    return 1
  }

  const files = listAdapters(ADAPTERS_DIR)
  const current = files.map(scanFile).filter((e) => e.colors.length > 0)
  const currentMap = new Map(current.map((e) => [e.file, new Set(e.colors)]))
  const currentCount = current.reduce((n, e) => n + e.colors.length, 0)

  // ── --update-baseline:用当前结果重写基线(只应由治理提交调用) ──
  if (updateBaseline) {
    const baseline = {}
    for (const [file, colors] of [...currentMap.entries()].sort()) {
      baseline[file] = [...colors].sort()
    }
    writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n', 'utf8')
    console.log(`[OK] 基线已更新: ${BASELINE_PATH}(${currentCount} 处硬编码颜色 / ${current.length} 文件)`)
    return 0
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error(`[FAIL] 基线文件不存在: ${BASELINE_PATH}`)
    console.error('       首次建立基线请运行: node scripts/check-adapter-style-parity.mjs --update-baseline')
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

  // ── RULE-1:基线之外的新增硬编码颜色 -> BLOCK ──
  const newHits = [] // { file, colors[] }
  for (const [file, colors] of currentMap) {
    const base = baselineMap.get(file) || new Set()
    const added = [...colors].filter((c) => !base.has(c))
    if (added.length > 0) newHits.push({ file, added })
  }
  // 文件被删除但基线还在 -> 提示收紧(WARN,不算失败)
  const staleFiles = [...baselineMap.keys()].filter((f) => !currentMap.has(f))
  // 基线中已有文件里被治理掉的颜色 -> WARN
  const shrunk = []
  for (const [file, base] of baselineMap) {
    const cur = currentMap.get(file)
    if (!cur) continue
    const removed = [...base].filter((c) => !cur.has(c))
    if (removed.length > 0) shrunk.push({ file, removed })
  }

  if (newHits.length > 0) {
    console.error(`[FAIL] RULE-1: ${newHits.length} 个文件出现基线之外的新增硬编码颜色(必须改用 getRnTokens token):`)
    for (const h of newHits.slice(0, 30))
      console.error(`    components/adapters/${h.file}: ${h.added.join(' ')}`)
  } else if (!quiet) {
    console.log(`[PASS] RULE-1: 无新增硬编码颜色(存量 ${currentCount} 处 / ${current.length} 文件,只减不增)`)
  }

  let warnings = 0
  if (staleFiles.length > 0 || shrunk.length > 0) {
    warnings = staleFiles.length + shrunk.length
    console.warn(`[WARN] RULE-2: ${staleFiles.length} 个基线文件已删除 / ${shrunk.length} 个文件硬编码颜色已减少,建议运行 --update-baseline 收紧基线:`)
    for (const f of staleFiles.slice(0, 10)) console.warn(`    components/adapters/${f}(已删除)`)
    for (const s of shrunk.slice(0, 10)) console.warn(`    components/adapters/${s.file}(已移除: ${s.removed.join(' ')})`)
  }

  if (newHits.length > 0) {
    console.error(`\n❌ adapter 层硬编码颜色守门失败:新增硬编码颜色违反「一律用 getRnTokens 取 token」规范`)
    return 1
  }
  if (!quiet) {
    if (warnings > 0) console.log(`\n✅ adapter 层硬编码颜色守门通过(${warnings} 项 WARN,建议收紧基线)`)
    else console.log('\n✅ adapter 层硬编码颜色守门通过')
  }
  return 0
}

process.exit(main())
