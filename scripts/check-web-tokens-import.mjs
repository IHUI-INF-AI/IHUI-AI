#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-web-tokens-import.mjs - Guard: verify apps/web/app/globals.css
 * @imports design-tokens from packages/design-tokens/src/styles/tokens.css
 * and base.css.
 *
 * apps/web uses Tailwind v4 + CSS-based config and @import tokens.css /
 * base.css directly (no manual :root/.dark hand-copy like miniapp-taro).
 * The 50+ CSS variables flow through one @import line - any accidental
 * removal causes silent visual drift (light/dark mode breakage).
 *
 * This script enforces the @import is present in globals.css and points
 * to the canonical design-tokens package.
 *
 * Usage:
 *   node scripts/check-web-tokens-import.mjs           # exit 0 on OK, 1 on drift
 *   node scripts/check-web-tokens-import.mjs --quiet   # errors only
 *   node scripts/check-web-tokens-import.mjs --staged  # accepted (full scan)
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const GLOBALS_CSS = join(root, 'apps/web/app/globals.css')
const TOKENS_CSS = join(root, 'packages/design-tokens/src/styles/tokens.css')
const BASE_CSS = join(root, 'packages/design-tokens/src/styles/base.css')
const quiet = process.argv.includes('--quiet')

const REQUIRED_IMPORTS = [
  { needle: "@import '../../../packages/design-tokens/src/styles/tokens.css'", file: GLOBALS_CSS, source: TOKENS_CSS, label: 'tokens.css' },
  { needle: "@import '../../../packages/design-tokens/src/styles/base.css'", file: GLOBALS_CSS, source: BASE_CSS, label: 'base.css' },
]

function check() {
  const failures = []
  for (const { needle, file, source, label } of REQUIRED_IMPORTS) {
    if (!existsSync(file)) {
      failures.push(`MISSING file: ${file}`)
      continue
    }
    if (!existsSync(source)) {
      failures.push(`MISSING source: ${source} (referenced by ${label} @import)`)
      continue
    }
    const content = readFileSync(file, 'utf8')
    if (!content.includes(needle)) {
      failures.push(`MISSING @import in ${file}: ${needle}`)
    }
  }
  return failures
}

function main() {
  const failures = check()
  if (failures.length === 0) {
    if (!quiet) console.log('[OK] apps/web/app/globals.css @imports design-tokens correctly (tokens.css + base.css)')
    process.exit(0)
  }
  console.error('[FAIL] apps/web tokens @import drift detected:')
  for (const f of failures) console.error(`  - ${f}`)
  console.error('Fix: restore @import in apps/web/app/globals.css to single-source the design tokens.')
  process.exit(1)
}

main()
