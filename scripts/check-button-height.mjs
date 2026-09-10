#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Button 高度/宽度覆盖守门(2026-09-07 立,AGENTS.md §4「Button 高度档位守门」配套)
// 规则:<Button> 禁止 className h-* / w-* 覆盖尺寸,必须用 size 档位
//       (xs/sm/default/lg/icon-xs/icon-sm/icon,定义见 packages/ui-react/src/components/button.tsx)
// 同时校验 size 值合法性(防拼写错误静默回退 default 档)。
// 豁免:原生 <button> 自绘(IDE 面板等 24px 紧凑档为有意设计)、Input/SelectTrigger/Skeleton、
//       Button 上的 h-5/h-6(24px/20px 紧凑档,存量 45 处表格行/侧栏密集场景,与原生紧凑档同哲学)、
//       packages/ui-react/src/components/button.tsx 定义文件本身、测试文件。
// 用法:node scripts/check-button-height.mjs            (全量扫描,pre-commit 用)
//       node scripts/check-button-height.mjs --staged   (仅扫描 staged 文件)
// 紧急跳过:HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1 git commit ...
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'

const ROOT = process.cwd()
const ROOTS = [
  'apps/web/app',
  'apps/web/src',
  'apps/extension/src',
  'apps/desktop/src',
  'packages/ui-react/src',
].filter((dir) => {
  try {
    statSync(path.join(ROOT, dir))
    return true
  } catch {
    return false
  }
})
const EXCLUDE_FILE = 'packages/ui-react/src/components/button.tsx' // size 档位定义文件
const VALID_SIZES = new Set(['xs', 'sm', 'default', 'lg', 'icon-xs', 'icon-sm', 'icon'])
const SIZE_TOKEN_RE = /^(h|w)-(7|8|9|10|11|12|\[.+\])$/ // h-7 / h-[36px] 等;h-5/h-6(24px/20px 紧凑档)豁免
const BAD_SIZE_RE = /^(h|w)-/ // h-*/w-* 类(SIZE_TOKEN_RE 已排除紧凑档)

let stagedOnly = process.argv.includes('--staged')
let stagedSet = null
if (stagedOnly) {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', { encoding: 'utf8' })
    stagedSet = new Set(out.split('\n').filter(Boolean).map((f) => f.replaceAll('\\', '/')))
  } catch {
    stagedOnly = false
  }
}

const files = []
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) walk(p)
    else if (/\.(tsx|jsx)$/.test(e)) files.push(p.replaceAll('\\', '/'))
  }
}
ROOTS.forEach((r) => walk(path.join(ROOT, r)))

// 提取从 <Button 开始的完整开标签(感知字符串/花括号/箭头函数,零误报)
function extractTag(src, start) {
  let i = start + 7 // "<Button".length
  let depth = 0
  let quote = null
  while (i < src.length) {
    const c = src[i]
    if (quote) {
      if (c === '\\') { i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue }
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === '>' && depth === 0) return src.slice(start, i + 1)
    i++
  }
  return null
}
function lineOf(src, idx) {
  let n = 1
  for (let i = 0; i < idx; i++) if (src[i] === '\n') n++
  return n
}
function extractClasses(tag) {
  const out = []
  for (const s of tag.match(/\bclassName\s*=\s*"([^"]*)"/g) || [])
    out.push(...s.replace(/^.*?"/, '').replace(/"$/, '').split(/\s+/))
  for (const b of tag.match(/\bclassName\s*=\s*\{[\s\S]*?\}/g) || [])
    for (const s of b.match(/'([^']*)'/g) || []) out.push(...s.slice(1, -1).split(/\s+/))
  return out.filter(Boolean)
}
function extractSize(tag) {
  const m = tag.match(/\bsize\s*=\s*"([^"]*)"/) || tag.match(/\bsize\s*=\s*\{\s*'([^']*)'\s*\}/)
  return m ? m[1] : null
}

const violations = []
for (const f of files) {
  const rel = path.relative(ROOT, f).replaceAll('\\', '/')
  if (rel === EXCLUDE_FILE) continue
  if (/(^|\/)(tests?|e2e|__tests__)\//.test(rel) || /\.(test|spec)\./.test(rel)) continue
  if (stagedOnly && !stagedSet.has(rel)) continue
  let src
  try {
    src = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  const re = /<Button(?=[\s/>])/g
  let m
  while ((m = re.exec(src))) {
    const tag = extractTag(src, m.index)
    if (!tag) continue
    const classes = extractClasses(tag)
    const size = extractSize(tag)
    const bad = classes.filter((c) => BAD_SIZE_RE.test(c) && SIZE_TOKEN_RE.test(c))
    const badSize =
      size !== null && !VALID_SIZES.has(size) ? [`size="${size}" 不在档位表 ${[...VALID_SIZES].join('/')}`] : []
    if (bad.length || badSize.length) {
      violations.push({ file: rel, line: lineOf(src, m.index), bad: [...bad, ...badSize] })
    }
  }
}

if (violations.length) {
  console.error(`❌ Button 高度/宽度覆盖守门:发现 ${violations.length} 处违规\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  →  ${v.bad.join(', ')}`)
  }
  console.error(
    '\n修复:改用 size 档位(xs/sm/default/lg/icon-xs/icon-sm/icon),需要新高度先在 button.tsx size 表立档。',
  )
  console.error('规则详见 AGENTS.md §4「Button 高度档位守门」。紧急跳过:HUSKY_SKIP_BUTTON_HEIGHT_GUARD=1')
  process.exit(1)
}
console.log(`✅ Button 高度/宽度守门通过(0 违规,扫描 ${files.length} 个 tsx/jsx)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
