#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * check-rn-global-css-sync.mjs - Guard: verify mobile-rn/global.css color vars
 * are in sync with packages/design-tokens/src/styles/tokens.css.
 *
 * mobile-rn manually copies --color-* vars (NativeWind 4.x = Tailwind v3,
 * cannot @import tokens.css). Value drift = visual bug. This catches it.
 *
 * Supports @theme {} and :root {} syntax in tokens.css.
 *
 * Usage:
 *   node scripts/check-rn-global-css-sync.mjs           # full scan
 *   node scripts/check-rn-global-css-sync.mjs --quiet    # errors only
 *   node scripts/check-rn-global-css-sync.mjs --staged   # accepted, full scan (no-op)
 *
 * Exit: 0 = in sync, 1 = mismatches found
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const RN_PATH = join(root, 'apps/mobile-rn/global.css')
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
    '[check-rn-global-css-sync] Checking mobile-rn/global.css vs design-tokens/tokens.css...'
  )

const rnCss = readFileSync(RN_PATH, 'utf8')
const tokensCss = readFileSync(TOKENS_PATH, 'utf8')

// mobile-rn: :root (light) + .dark (dark)
const rnRoot = mergeColorVars(rnCss, [':root'])
const rnDark = mergeColorVars(rnCss, ['.dark'])

// tokens.css: @theme + :root (light, both syntaxes) + .dark (dark)
const tokensRoot = mergeColorVars(tokensCss, ['@theme', ':root'])
const tokensDark = mergeColorVars(tokensCss, ['.dark'])

// Compare: only check vars that exist in mobile-rn (it copies a subset)
const diffs = []
for (const [name, val] of Object.entries(rnRoot)) {
  const t = tokensRoot[name]
  if (t === undefined || t !== val)
    diffs.push({ block: ':root', name, rn: val, tok: t ?? '<missing>' })
}
for (const [name, val] of Object.entries(rnDark)) {
  const t = tokensDark[name]
  if (t === undefined || t !== val)
    diffs.push({ block: '.dark', name, rn: val, tok: t ?? '<missing>' })
}

if (diffs.length === 0) {
  const total = Object.keys(rnRoot).length + Object.keys(rnDark).length
  if (!quiet)
    console.log(`[check-rn-global-css-sync] All ${total} variables are in sync`)
  process.exit(0)
}

console.error(`[check-rn-global-css-sync] Found ${diffs.length} mismatch(es):`)
for (const block of [':root', '.dark']) {
  const items = diffs.filter((d) => d.block === block)
  if (!items.length) continue
  console.error(`  ${block} block:`)
  for (const d of items)
    console.error(`    ${d.name}: mobile-rn='${d.rn}' vs tokens='${d.tok}'`)
}
process.exit(1)
