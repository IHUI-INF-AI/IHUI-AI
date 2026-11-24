#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-border-system.mjs — 容器描边角色系统守门(2026-11-15 立)
 *
 * 集成位置: scripts/guardian-runner.mjs 第 **323** 项(blocking)
 *
 * 立因:描边在收口前有 10 种写法(border-border 1122 处、border-input 530、border-primary 族 140、
 * ring-primary 36、border-ring 11,另有 5 个零消费 token 与小程序局部别名)。同一条 1px 边界
 * 在不同文件深浅不一,且 `border-border/60` 这类"token 已是 alpha 再叠 /N"的双层 alpha
 * 让实际值变成 6%,既不可读也无法统一调。角色层(--color-stroke-*)与 Phase 2 收口完成后,
 * 本门负责不让它们长回来。判据取向与全仓主流一致:缺省判工作树,--staged 判索引 blob
 * (内容读取统一经 scripts/lib/face-reader.mjs,2026-11-15 接入);
 * 任一面取不到按"无法判定"exit 2,不静默回落工作树。
 *
 * R1 token 源头不得回退 —— alpha 角色(subtle/default/strong/inverse/field)只允许 rgba() 阶梯,
 *    不许裸 hex/hsl(否则失去"随表面自动调和");不透明角色(focus/selected/danger)允许 hex。
 * R2 禁 `border-border/<N>` —— 双层 alpha;要更浅取 stroke-subtle,要更深取 stroke-default。
 * R3 `border-primary` / `ring-primary` 仅允许 focus 变体 —— 容器描边不得取墨档(AGENTS §4;
 *    聚焦是唯一例外,RN 侧由 check-brand-foreground R8 按 focused 三元放行)。
 * R4 宽度只允许 1px / 2px —— ui-react 原语里 `border-3`..`border-9` 一律判红。
 * R5 三端角色齐全 —— tokens.css / tailwind-preset.js / rn-tokens.ts 三张表都必须有 8 个角色名。
 * R6 alpha 角色禁再叠 /N —— subtle/default/strong/inverse/field 本身已是 alpha;
 *    focus/selected/danger 是不透明色,允许 /N(单层 alpha)。
 *
 * 用法: node scripts/check-border-system.mjs [--staged] [--worktree]
 * 退出: 0 通过 / 1 违规 / 2 无法判定
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

if (process.env.HUSKY_SKIP_BORDER_SYSTEM === '1') {
  console.log(
    '[check-border-system] HUSKY_SKIP_BORDER_SYSTEM=1 ⇒ 跳过(应急放行,提交信息须写明责任归属)',
  )
  process.exit(0)
}

const picked = selectFace({
  staged: process.argv.includes('--staged'),
  worktree: process.argv.includes('--worktree'),
  def: 'worktree',
})
if (picked.error) {
  console.error(`[check-border-system] ⏭ 未判定:${picked.error}`)
  process.exit(2)
}
/** 判定面:--staged ⇒ 索引 blob;缺省 / --worktree ⇒ 工作树(与本门原语义一致) */
const face = picked.face
const isStaged = face === 'staged'

const ROLES = ['subtle', 'default', 'strong', 'inverse', 'field', 'focus', 'selected', 'danger']
const ALPHA_ROLES = new Set(['subtle', 'default', 'strong', 'inverse', 'field'])
const SCAN_ROOTS = [
  'apps/web/src',
  'apps/web/app',
  'apps/extension/entrypoints',
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
  'packages/ui-react/src',
  'packages/app/src',
  'packages/shared/src',
]
const EXT = /\.(tsx|ts|jsx|js|css|scss)$/
const SKIP = /(?:^|[\\/])(?:node_modules|dist|build|\.next[^\\/]*|\.output|tests?|__tests__)\b/
const COMMENT = /^\s*(?:\/\/|\/\*|\*)/

/**
 * 本门读仓库内容的**唯一**出口:按判定面走取材层(与守门 70/77/83 同口径)。
 * 取不到(该面没有这份 blob)⇒ null,调用方判 exit 2;派生失败 ⇒ 当场 exit 2,不回落另一面。
 */
function readBlob(rel) {
  try {
    if (face === 'worktree') return readWorktreeFile(ROOT, rel)
    const spec = face === 'head' ? `HEAD:${rel}` : `:${rel}`
    return catBatch(ROOT, [spec]).get(spec) ?? null
  } catch (e) {
    console.error(
      `[check-border-system] ⏭ 未判定:${face} 面取不到 ${rel}(${e instanceof Error ? e.message : String(e)})`,
    )
    process.exit(2)
  }
}

let cachedList = null

function listFiles() {
  if (cachedList) return cachedList
  const files = []
  const walk = (rel) => {
    const abs = path.join(ROOT, rel)
    if (!fs.existsSync(abs)) return
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${e.name}`
      if (SKIP.test(child)) continue
      if (e.isDirectory()) walk(child)
      else if (EXT.test(e.name) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name)) files.push(child)
    }
  }
  for (const r of SCAN_ROOTS) walk(r)
  cachedList = files
  return cachedList
}

const violations = []
const add = (rule, file, line, detail) => violations.push({ rule, file, line, detail })

// R1 · 角色源头只允许 rgba()/var()
{
  const css = readBlob('packages/design-tokens/src/styles/tokens.css')
  if (css === null) {
    console.error('[check-border-system] 无法读取 tokens.css,按未判定 exit 2')
    process.exit(2)
  }
  css.split(/\r?\n/).forEach((raw, i) => {
    if (COMMENT.test(raw)) return
    const m = /^\s*--color-stroke-([a-z-]+)\s*:\s*([^;]+);/.exec(raw)
    if (!m) return
    const value = m[2].trim()
    if (ALPHA_ROLES.has(m[1]) && !/^rgba?\(/.test(value)) {
      add('R1', 'tokens.css', i + 1, `alpha 角色 stroke-${m[1]} 必须用 rgba(): ${value}`)
    }
  })
}

// R2/R3/R6/R4 · 源码类名面
// 工作树面全量读;索引面只判本次新增行(一次 git diff 取齐)。不在 pre-commit 里逐文件 git show:
// Windows 上单次 git 调用实测 ~0.7s,184 个文件就是两分钟,门会被超时机制静默放过。
const R2 = /border-border\/\d+/
const R3 = /((?:[\w\-[\]]+:)*)(?:border|ring)-primary(?![-/\w])/g
const R6 = /border-stroke-([a-z-]+)\/\d+/g
const R4 = /\bborder(?:-[xytrbl])?-([3-9])\b/

const lines = []
if (isStaged) {
  let diff
  try {
    diff = gitRaw(['diff', '--cached', '-U0', '--', ...SCAN_ROOTS], ROOT)
  } catch (e) {
    console.error(
      `[check-border-system] ⏭ 未判定:索引面取新增行失败(${e instanceof Error ? e.message : String(e)})`,
    )
    process.exit(2)
  }
  let file = null
  let no = 0
  for (const raw of diff.split(/\r?\n/)) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '')
      no = 0
      continue
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw)
    if (hunk) {
      no = Number(hunk[1])
      continue
    }
    if (raw.startsWith('+') && file && file !== '/dev/null' && EXT.test(file)) {
      lines.push({ file, no, text: raw.slice(1) })
      no++
    }
  }
} else {
  for (const rel of listFiles()) {
    const src = readBlob(rel)
    if (src === null) continue
    src.split(/\r?\n/).forEach((text, i) => lines.push({ file: rel, no: i + 1, text }))
  }
}

for (const { file, no, text } of lines) {
  if (COMMENT.test(text)) continue
  const idx = text.indexOf('//')
  const line = idx === -1 ? text : text.slice(0, idx)
  if (R2.test(line)) add('R2', file, no, 'border-border/<N> 双层 alpha')
  for (const m of line.matchAll(R3)) {
    if (!/focus/i.test(m[1] || '')) add('R3', file, no, `${m[0]} 非 focus 变体`)
  }
  for (const m of line.matchAll(R6)) {
    if (ALPHA_ROLES.has(m[1])) add('R6', file, no, `${m[0]} 在 alpha 角色上再叠 /N`)
  }
  if (file.startsWith('packages/ui-react/src/')) {
    const m = R4.exec(line)
    if (m) add('R4', file, no, `${m[0]} 超出 1/2px 档`)
  }
}

// R5 · 三端角色齐全
const SOURCES = [
  ['packages/design-tokens/src/styles/tokens.css', (s) => s.includes(`--color-stroke-`)],
  ['packages/design-tokens/src/tailwind-preset.js', (s) => s.includes(`stroke: {`)],
  ['packages/design-tokens/src/rn-tokens.ts', (s) => s.includes('RnStrokeTokens')],
]
for (const [rel, hint] of SOURCES) {
  const src = readBlob(rel)
  if (src === null) {
    console.error(`[check-border-system] 无法读取 ${rel},按未判定 exit 2`)
    process.exit(2)
  }
  if (!hint(src)) add('R5', rel, 0, '缺少 stroke 角色表')
  for (const role of ROLES) {
    const present = rel.endsWith('.css')
      ? src.includes(`--color-stroke-${role}:`)
      : rel.endsWith('.ts')
        ? new RegExp(`\\b${role}\\s*:`).test(src)
        : new RegExp(`\\b${role}\\s*:`).test(src)
    if (!present) add('R5', rel, 0, `缺角色 ${role}`)
  }
}

if (violations.length === 0) {
  console.log(
    `[check-border-system] ✅ 描边角色系统 ${ROLES.length} 档齐全,无违规(${isStaged ? '索引面' : '工作树'})`,
  )
  process.exit(0)
}
console.error(`[check-border-system] ❌ 发现 ${violations.length} 条描边违规:`)
for (const v of violations.slice(0, 60)) {
  console.error(`  ${v.rule} ${v.file}${v.line ? `:${v.line}` : ''} — ${v.detail}`)
}
console.error(
  '修复:取角色名(stroke-subtle/default/strong/inverse/field/focus/selected/danger),不得再写 /N 双层 alpha。',
)
process.exit(1)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
