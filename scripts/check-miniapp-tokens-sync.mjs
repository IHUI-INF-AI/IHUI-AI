#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-miniapp-tokens-sync.mjs - Guard: verify apps/miniapp-taro/src/app.css
 * color vars are in sync with packages/design-tokens/src/styles/tokens.css.
 *
 * Taro 4 + Tailwind v3 不兼容 v4 的 @theme 语法,无法 @import tokens.css。
 * apps/miniapp-taro/scripts/sync-design-tokens.mjs 负责生成 :root/.dark 块,
 * 本脚本负责在 pre-commit 时校验生成结果与源 tokens.css 一致(防漂移)。
 *
 * Supports @theme {} and :root {} syntax in tokens.css.
 *
 * Usage:
 *   node scripts/check-miniapp-tokens-sync.mjs           # full scan
 *   node scripts/check-miniapp-tokens-sync.mjs --quiet    # errors only
 *   node scripts/check-miniapp-tokens-sync.mjs --staged   # accepted, full scan (no-op)
 *
 * Exit: 0 = in sync, 1 = mismatches found
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const APP_CSS_PATH = join(root, 'apps/miniapp-taro/src/app.css')
const TOKENS_PATH = join(root, 'packages/design-tokens/src/styles/tokens.css')
const quiet = process.argv.includes('--quiet')

/** Extract inner text of all blocks matching a selector (balanced braces). */
function extractAllBlocks(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '\\s*\\{', 'g')
  const blocks = []
  let m
  while ((m = re.exec(css)) !== null) {
    let i = m.index + m[0].length
    let depth = 1
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') depth--
      i++
    }
    blocks.push(css.slice(m.index + m[0].length, i - 1))
    re.lastIndex = i
  }
  return blocks
}

/** Extract --color-* vars from block text. Returns { name: value }. */
function extractColorVars(text) {
  const vars = {}
  const re = /(--color-[\w-]+)\s*:\s*([^;]+);/g
  let m
  while ((m = re.exec(text)) !== null) vars[m[1]] = m[2].trim()
  return vars
}

/** Merge --color-* vars from multiple selector blocks (later overrides earlier). */
function mergeColorVars(css, selectors) {
  const merged = {}
  for (const sel of selectors)
    for (const block of extractAllBlocks(css, sel))
      Object.assign(merged, extractColorVars(block))
  return merged
}

// --- Main ---

if (!quiet)
  console.log(
    '[check-miniapp-tokens-sync] Checking miniapp-taro/src/app.css vs design-tokens/tokens.css...'
  )

const appCss = readFileSync(APP_CSS_PATH, 'utf8')
const tokensCss = readFileSync(TOKENS_PATH, 'utf8')

// miniapp-taro: :root (light) + .dark (dark)
const appRoot = mergeColorVars(appCss, [':root'])
const appDark = mergeColorVars(appCss, ['.dark'])

// tokens.css: @theme + :root (light, both syntaxes) + .dark (dark)
const tokensRoot = mergeColorVars(tokensCss, ['@theme', ':root'])
const tokensDark = mergeColorVars(tokensCss, ['.dark'])

// Compare: only check vars that exist in miniapp-taro (it copies a subset)
const diffs = []
for (const [name, val] of Object.entries(appRoot)) {
  const t = tokensRoot[name]
  if (t === undefined || t !== val)
    diffs.push({ block: ':root', name, app: val, tok: t ?? '<missing>' })
}
for (const [name, val] of Object.entries(appDark)) {
  const t = tokensDark[name]
  if (t === undefined || t !== val)
    diffs.push({ block: '.dark', name, app: val, tok: t ?? '<missing>' })
}

if (diffs.length === 0) {
  const total = Object.keys(appRoot).length + Object.keys(appDark).length
  if (!quiet)
    console.log(`[check-miniapp-tokens-sync] All ${total} variables are in sync`)
  process.exit(0)
}

console.error(`[check-miniapp-tokens-sync] Found ${diffs.length} mismatch(es):`)
for (const block of [':root', '.dark']) {
  const items = diffs.filter((d) => d.block === block)
  if (!items.length) continue
  console.error(`  ${block} block:`)
  for (const d of items)
    console.error(`    ${d.name}: miniapp-taro='${d.app}' vs tokens='${d.tok}'`)
}
process.exit(1)
