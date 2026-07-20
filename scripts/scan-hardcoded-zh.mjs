#!/usr/bin/env node
/**
 * 硬编码中文扫描器(2026-07-20 立)
 *
 * 扫描 apps/web/app 和 apps/web/src/components 下所有 .tsx/.ts 文件,
 * 找出含硬编码中文字符串且未走 t()/next-intl 的代码行,
 * 输出按文件分组的 JSON 清单 + 文本摘要,供 i18n 迁移使用。
 *
 * 用法:
 *   node scripts/scan-hardcoded-zh.mjs                       # 全量扫描,输出到 stdout
 *   node scripts/scan-hardcoded-zh.mjs --json <out.json>     # 输出 JSON 到文件
 *   node scripts/scan-hardcoded-zh.mjs --top 30              # 只显示 TOP N
 *   node scripts/scan-hardcoded-zh.mjs --exit 1              # 发现硬编码则 exit 1(供 pre-commit 守门)
 *
 * 设计:
 *   - 排除 messages/ / i18n / locale 目录
 *   - 排除 admin(后端路由 + 单独的 i18n 流)
 *   - 排除测试文件 __tests__/*.test.tsx(测试用例本就要中文字符串)
 *   - 排除 metadata / description / useTranslations / getTranslations 行
 *   - 排除纯注释 / import / type 声明行
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TARGETS = [
  path.join(ROOT, 'apps/web/app'),
  path.join(ROOT, 'apps/web/src/components'),
]
const EXCLUDE_DIRS = new Set([
  'node_modules', '.next', '.git', 'admin', 'dist', 'build',
  'messages', 'locales', 'i18n', 'locale', '__tests__', 'tests', 'test',
])
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /messages\//,
  /\.d\.ts$/,
]

const ZH_RE = /[\u4e00-\u9fa5]/
const SKIP_LINE_RE = /^\s*(\/\/|\/\*|\*|import |export type|interface |type [A-Z]|: \w+ = \(? useTranslations|useTranslations\(|getTranslations\(|metadata:|description:|@)/
const SKIP_TOKEN_RE = /useTranslations|getTranslations|next-intl|metadata|description:/

const args = new Set(process.argv.slice(2))
const JSON_OUT = args.has('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null
const TOP_N = args.has('--top') ? parseInt(process.argv[process.argv.indexOf('--top') + 1], 10) : 30
const STRICT = args.has('--exit') && process.argv[process.argv.indexOf('--exit') + 1] === '1'

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) {
      if (EXCLUDE_FILE_PATTERNS.some(re => re.test(full))) continue
      out.push(full)
    }
  }
  return out
}

const allFiles = []
for (const t of TARGETS) walk(t, allFiles)

let totalHits = 0
const fileHits = []

for (const f of allFiles) {
  const src = fs.readFileSync(f, 'utf8')
  if (!ZH_RE.test(src)) continue
  const lines = src.split('\n')
  const hits = []
  let inBlockComment = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false
      continue
    }
    if (line.includes('/*') && !line.includes('*/')) { inBlockComment = true; continue }
    if (!ZH_RE.test(line)) continue
    if (SKIP_LINE_RE.test(line)) continue
    if (SKIP_TOKEN_RE.test(line)) continue
    hits.push({ line: i + 1, text: line.trim().slice(0, 200) })
  }
  if (hits.length > 0) {
    totalHits += hits.length
    fileHits.push({
      file: path.relative(ROOT, f),
      count: hits.length,
      samples: hits,
    })
  }
}

fileHits.sort((a, b) => b.count - a.count)

if (JSON_OUT) {
  fs.writeFileSync(
    JSON_OUT,
    JSON.stringify({
      scannedAt: new Date().toISOString(),
      totalFiles: fileHits.length,
      totalHits,
      targets: TARGETS.map(t => path.relative(ROOT, t)),
      files: fileHits,
    }, null, 2),
    'utf8',
  )
  console.log(`[scan-hardcoded-zh] Wrote ${fileHits.length} files / ${totalHits} hits to ${JSON_OUT}`)
  if (STRICT && totalHits > 0) process.exit(1)
  process.exit(0)
}

console.log('=== 硬编码中文 TOP ' + TOP_N + ' 文件(待 i18n) ===')
fileHits.slice(0, TOP_N).forEach(h => {
  console.log(`\n  ${String(h.count).padStart(4)} 处 | ${h.file}`)
  h.samples.slice(0, 2).forEach(s => console.log(`        L${s.line}: ${s.text}`))
})
console.log('\n=== 总计 ===')
console.log(`  含硬编码中文的文件: ${fileHits.length}`)
console.log(`  硬编码中文行数: ${totalHits}`)
console.log(`  扫描路径: ${TARGETS.map(t => path.relative(ROOT, t)).join(' + ')}`)
console.log(`  排除目录: ${[...EXCLUDE_DIRS].join(', ')}`)

if (STRICT && totalHits > 0) {
  console.error('\n[scan-hardcoded-zh] --exit 1:发现硬编码中文,pre-commit 拒绝通过')
  process.exit(1)
}
