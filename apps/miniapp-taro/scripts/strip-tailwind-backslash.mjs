// Post-build: strip Tailwind-generated backslash escapes from .wxss files
//
// Why:
// Taro 4 + Tailwind 3 produces class names with backslash-escaped special
// characters (e.g. \. \\[ \\] \\! \: \/, etc.) in CSS output. PostCSS/Tailwind
// emits them as `.top-2\.5`, `.top-\[2rpx\]`, `.hover\:bg-red`, `.bg-red\/50`
// — this is valid CSS, but the WeChat Mini Program WXSS parser rejects `\`
// inside class selectors with "unexpected `\` at pos X" (verified in IDE log
// 2026-07-26, pos 1132 = `.\!visible`).
//
// This script walks `dist/` and removes the trailing backslash before any of
// the Tailwind escape characters. Covers the full Tailwind 3.4 escape set
// observed in our build output.
//
// AliPay (axml) is unaffected — ant-style CSS allows `\` in selectors.
// So we ONLY strip `.wxss` files (not `.acss`).
//
// Usage:
//   node scripts/strip-tailwind-backslash.mjs [dist-root] [--watch]
// - Default dist-root: dist
// - --watch: watch mode, re-strip on .wxss change (for dev mode)
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync, watch } from 'node:fs'
import { join, resolve, basename } from 'node:path'

// Tailwind 3.4 escape set: backslash before any of these chars is processed.
// Observed in build output: . \ [ ] ! / : ( ) , % # & * ' +
// (verified against dist/app-origin.wxss 2026-07-26, including calc(16rpx\+env(...)))
//
// WXSS handling:
// - Most chars (. [ ] / : ( ) , % # & * ' +): strip the backslash, WXSS accepts
//   the bare char inside a class selector.
// - `\!` is special: WXSS rejects both `\` (no escape support) AND leading `!`
//   (treated as important marker). Tried CSS hex escape `\21 ` first — WXSS
//   still rejects the `\`. Final fix: strip BOTH the backslash AND the `!`,
//   so `.\!visible` -> `.visible`. Safe because:
//   (a) `!visible` is Tailwind's important modifier for `visibility:visible`,
//       merging into `.visible { visibility: visible }` is functionally
//       equivalent for the visibility property (visible is visible).
//   (b) For color utilities like `!bg-primary`, source uses `!bg-primary`
//       only to win specificity over `bg-muted` on the same element — the
//       non-important `.bg-primary` rule still applies, just without
//       `!important`. Acceptable tradeoff vs WXSS compile failure.
const RE = /\\([.\\[\]!/:(),%#&*'+])/g

function walk(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (p.endsWith('.wxss')) out.push(p)
  }
  return out
}

function stripFile(file) {
  const orig = readFileSync(file, 'utf8')
  let count = 0
  const next = orig.replace(RE, (_, ch) => {
    count++
    // `\!` -> delete both chars (WXSS accepts neither `\` nor leading `!`)
    return ch === '!' ? '' : ch
  })
  if (count > 0) {
    writeFileSync(file, next, 'utf8')
  }
  return count
}

function stripAll(root) {
  const files = walk(root)
  let totalReplacements = 0
  let filesChanged = 0
  for (const file of files) {
    const n = stripFile(file)
    if (n > 0) {
      totalReplacements += n
      filesChanged += 1
    }
  }
  console.log(`[strip-tailwind-backslash] scanned=${files.length} changed=${filesChanged} replacements=${totalReplacements}`)
}

const args = process.argv.slice(2)
const watchMode = args.includes('--watch')
const rootArg = args.find((a) => !a.startsWith('--'))
const root = resolve(rootArg || 'dist')

if (watchMode) {
  // Initial strip
  stripAll(root)
  console.log(`[strip-tailwind-backslash] watching ${root} for .wxss changes...`)
  // Recursive watch (Node 20+ supports recursive on Windows)
  try {
    watch(root, { recursive: true }, (eventType, filename) => {
      if (!filename) return
      if (!filename.endsWith('.wxss')) return
      const filePath = join(root, filename)
      if (!existsSync(filePath)) return
      try {
        const n = stripFile(filePath)
        if (n > 0) {
          console.log(`[strip-tailwind-backslash] ${basename(filename)} stripped ${n} escapes`)
        }
      } catch {
        // File may be mid-write, ignore
      }
    })
  } catch (e) {
    console.error('[strip-tailwind-backslash] watch failed:', e.message)
    process.exit(1)
  }
} else {
  stripAll(root)
}
