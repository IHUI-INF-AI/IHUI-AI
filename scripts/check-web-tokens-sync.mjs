#!/usr/bin/env node
/* eslint-disable no-console */
/** check-web-tokens-sync.mjs - prevent web globals.css from hand-copying
 * tokens.css @theme vars. web uses @import single source (2026-07-23 done).
 * Allow: @media/@layer/@container blocks (high-contrast override etc).
 * Block: top-level :root/.dark re-declaring @theme vars (regression).
 * Usage: node scripts/check-web-tokens-sync.mjs [--quiet|--staged]
 * Exit: 0=ok, 1=regression. Template: check-rn-global-css-sync.mjs */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB_GLOBALS = join(root, 'apps/web/app/globals.css')
const TOKENS_PATH = join(root, 'packages/design-tokens/src/styles/tokens.css')
const quiet = process.argv.includes('--quiet')

function findTopLevelBlocks(css, selectors) {
  const blocks = []
  const stack = []
  let i = 0
  let line = 1
  while (i < css.length) {
    const ch = css[i]
    if (ch === '\n') { line++; i++; continue }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      if (end === -1) break
      for (let k = i; k < end + 2; k++) if (css[k] === '\n') line++
      i = end + 2
      continue
    }
    if (ch === '@') {
      const m = css.slice(i).match(/^@(\w[\w-]*)/)
      if (m) {
        let j = i + m[0].length
        while (j < css.length && css[j] !== '{' && css[j] !== ';') {
          if (css[j] === '\n') line++
          if (css[j] === '/' && css[j + 1] === '*') {
            const end = css.indexOf('*/', j + 2)
            if (end === -1) { j = css.length; break }
            for (let k = j; k < end + 2; k++) if (css[k] === '\n') line++
            j = end + 2
            continue
          }
          j++
        }
        if (css[j] === '{') { stack.push({ type: 'at-rule', name: m[1] }); i = j + 1; continue }
        if (css[j] === ';') { i = j + 1; continue }
        i = j
        continue
      }
    }
    if (ch === '{') {
      let k = i - 1
      while (k >= 0 && /\s/.test(css[k])) k--
      const selEnd = k + 1
      while (k >= 0) {
        if (css[k] === '}' || css[k] === '{' || css[k] === ';') break
        if (css[k] === '/' && css[k - 1] === '*') {
          k -= 2
          while (k >= 0 && !(css[k] === '/' && css[k + 1] === '*')) k--
          k--
          continue
        }
        k--
      }
      const selector = css.slice(k + 1, selEnd).trim()
      const inAtRule = stack.some((s) => s.type === 'at-rule')
      if (!inAtRule && selectors.includes(selector)) {
        let bs = i + 1, bd = 1, be = bs
        const bl = line
        while (be < css.length && bd > 0) {
          if (css[be] === '/' && css[be + 1] === '*') {
            const end = css.indexOf('*/', be + 2)
            be = end === -1 ? css.length : end + 2
            continue
          }
          if (css[be] === '{') bd++
          else if (css[be] === '}') bd--
          else if (css[be] === '\n') line++
          be++
        }
        blocks.push({ selector, content: css.slice(bs, be - 1), line: bl })
      }
      stack.push({ type: 'block', selector })
      i++
      continue
    }
    if (ch === '}') { stack.pop(); i++; continue }
    i++
  }
  return blocks
}

function extractVarNames(text) {
  const names = new Set()
  const re = /(--[\w-]+)\s*:/g
  let m
  while ((m = re.exec(text)) !== null) names.add(m[1])
  return [...names]
}

function extractThemeVarNames(css) {
  const tm = css.match(/@theme\s*\{([\s\S]*?)\}/)
  if (!tm) return new Set()
  const names = new Set()
  const re = /(--[\w-]+)\s*:/g
  let m
  while ((m = re.exec(tm[1])) !== null) names.add(m[1])
  return names
}

// --- Main ---

if (!quiet) console.log('[check-web-tokens-sync] Verifying globals.css @import single source...')

let exitCode = 0
let webCss, tokensCss
try {
  webCss = readFileSync(WEB_GLOBALS, 'utf8')
  tokensCss = readFileSync(TOKENS_PATH, 'utf8')
} catch (e) {
  console.error('[check-web-tokens-sync] Read fail: ' + e.message)
  process.exit(1)
}

const hasImport = /@import\s+['"][^'"]*design-tokens\/src\/styles\/tokens\.css['"]/.test(webCss)
if (!hasImport) {
  console.error('[check-web-tokens-sync] REGRESSION: globals.css missing @import tokens.css!')
  console.error('  web must @import single source token, do not remove.')
  exitCode = 1
} else if (!quiet) {
  console.log('[check-web-tokens-sync] @import tokens.css OK')
}

const themeVarNames = extractThemeVarNames(tokensCss)
if (themeVarNames.size === 0) {
  console.error('[check-web-tokens-sync] WARN: tokens.css @theme has no vars')
} else if (!quiet) {
  console.log('[check-web-tokens-sync] tokens.css @theme: ' + themeVarNames.size + ' vars')
}

const topBlocks = findTopLevelBlocks(webCss, [':root', '.dark'])

if (topBlocks.length === 0) {
  if (!quiet) console.log('[check-web-tokens-sync] no top-level :root/.dark blocks OK (high-contrast in @media allowed)')
} else {
  const regressions = []
  for (const b of topBlocks) {
    const vars = extractVarNames(b.content)
    const dups = vars.filter((v) => themeVarNames.has(v))
    if (dups.length > 0) regressions.push({ selector: b.selector, line: b.line, dups })
  }
  if (regressions.length > 0) {
    console.error('[check-web-tokens-sync] REGRESSION: top-level :root/.dark hand-copies tokens.css @theme vars!')
    console.error('  Should use @import, duplicate defs cause 3-end drift.')
    for (const r of regressions) {
      console.error('  ' + r.selector + ' (line ' + r.line + '): ' + r.dups.join(', '))
    }
    exitCode = 1
  } else if (!quiet) {
    console.log('[check-web-tokens-sync] ' + topBlocks.length + ' top-level blocks no dup OK')
  }
}

if (exitCode === 0) {
  if (!quiet) console.log('[check-web-tokens-sync] OK web token single source normal, no regression')
  process.exit(0)
}
process.exit(exitCode)
