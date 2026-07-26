// Post-build: strip Tailwind-generated backslash escapes from .wxss files
//
// Why:
// Taro 4 + Tailwind 3 produces class names with backslash-escaped special
// characters (e.g. \. \\[ \\] \\! \:, etc.) in CSS output. PostCSS/Tailwind
// emits them as `.top-2\.5`, `.top-\[2rpx\]`, etc. — this is valid CSS, but
// the WeChat Mini Program WXSS parser rejects `\` inside class selectors
// with "unexpected `\` at pos X" (verified in IDE log 2026-07-26).
//
// This script walks `dist/` and removes the trailing backslash before any
// of: . [ ] ! / : ( ) , % # & *  (covers the Tailwind escape set observed
// in our build output, and is a strict superset of the WXSS-safe subset).
//
// AliPay (axml) is unaffected — ant-style CSS allows `\` in selectors.
// So we ONLY strip `.wxss` files (not `.acss`).
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Tailwind escapes: backslash before one of . [ ] !
// (covers the actual escape set observed in Tailwind 3.4 output)
const RE = /\\([.\\[\\]!])/g

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

const root = resolve(process.argv[2] || 'dist')
const files = walk(root)
let totalReplacements = 0
let filesChanged = 0

for (const file of files) {
  const orig = readFileSync(file, 'utf8')
  const next = orig.replace(RE, '$1')
  if (next !== orig) {
    const diff = (orig.match(/\\([.\[\]!/:(),%#&*])/g) || []).length
    writeFileSync(file, next, 'utf8')
    totalReplacements += diff
    filesChanged += 1
  }
}

console.log(`[strip-tailwind-backslash] scanned=${files.length} changed=${filesChanged} replacements=${totalReplacements}`)
