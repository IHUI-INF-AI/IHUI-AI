#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 硬编码中文扫描器(2026-07-20 立)
 *
 * 扫描 apps/web(app + src/components + src/hooks)与 packages/ui-react|shared 下所有 .tsx/.ts 文件,
 * 找出含硬编码中文字符串且未走 t()/next-intl 的代码行,
 * 输出按文件分组的 JSON 清单 + 文本摘要,供 i18n 迁移使用。
 *
 * 用法:
 *   node scripts/scan-hardcoded-zh.mjs                       # 全量扫描,输出到 stdout
 *   node scripts/scan-hardcoded-zh.mjs --json <out.json>     # 输出 JSON 到文件
 *   node scripts/scan-hardcoded-zh.mjs --top 30              # 只显示 TOP N
 *   node scripts/scan-hardcoded-zh.mjs --staged              # 只扫暂存区文件(pre-commit 用)
 *   node scripts/scan-hardcoded-zh.mjs --exit 1              # 越过基线(ratchet)则 exit 1,供 pre-commit 守门
 *   node scripts/scan-hardcoded-zh.mjs --update-baseline     # 用当前全量结果重写基线文件(清理后下调)
 *
 * 基线(ratchet)设计:存量 800+ 文件 / 1.1 万行硬编码中文是历史债,**一次性清不完也不该挡所有提交**;
 * 基线记录"每文件当前命中数",只有 ①暂存文件命中数比基线多 或 ②基线外新文件出现命中 才判违规。
 * 于是清理可增量推进(清完一个文件就 --update-baseline 把它的额度降为 0),而新增永远被拦。
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
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// ROOT 由脚本自身位置推导:守门链偶发从子包 cwd 调用,写死 process.cwd() 会静默扫不到文件而"恒绿"
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGETS = [
  path.join(ROOT, 'apps/web/app'),
  path.join(ROOT, 'apps/web/src/components'),
  path.join(ROOT, 'apps/web/src/hooks'),
  path.join(ROOT, 'packages/ui-react/src'),
  path.join(ROOT, 'packages/shared/src'),
]
const BASELINE_FILE = path.join(ROOT, 'scripts/hardcoded-zh-baseline.json')
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

/**
 * 把字符串字面量的**内容**替换成空格(定界符保留、长度不变)。
 * 只用于"这一行是否开了跨行块注释"的判定:避免 `'https://x/*'` 里字符串内的 `//`、`/*`
 * 骗到状态机。命中判定仍走原始行 —— 模板串里的中文是真界面文案,不能掩掉。
 */
function bareOf(line) {
  let out = ''
  let q = null
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (q) {
      if (c === '\\') {
        out += '  '
        i += 1
      } else if (c === q) {
        q = null
        out += c
      } else out += ' '
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      q = c
      out += c
      continue
    }
    out += c
  }
  return out
}

const argv = process.argv.slice(2)
const args = new Set(argv)
const JSON_OUT = args.has('--json') ? argv[argv.indexOf('--json') + 1] : null
const TOP_N = args.has('--top') ? parseInt(argv[argv.indexOf('--top') + 1], 10) : 30
const STRICT = args.has('--exit') && argv[argv.indexOf('--exit') + 1] === '1'
const STAGED = args.has('--staged')
const UPDATE_BASELINE = args.has('--update-baseline')

/** 读基线:缺文件时按"空基线"处理(新文件一律零额度,宁可误拦不可漏拦) */
function readBaseline() {
  try {
    const raw = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
    return raw && raw.files ? raw.files : {}
  } catch {
    return {}
  }
}

function stagedFiles() {
  try {
    return new Set(
      execFileSync('git', ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .split('\n')
        .map((s) => s.trim().replace(/\\/g, '/'))
        .filter(Boolean),
    )
  } catch {
    return new Set()
  }
}

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

// --staged 且暂存集为空时保持全量口径(手动裸跑的情形),否则"暂存集空 ⇒ 零命中 ⇒ 恒绿"是假通过
const stagedSet = STAGED ? stagedFiles() : null
const scopeFiles =
  stagedSet && stagedSet.size > 0
    ? allFiles.filter((f) => stagedSet.has(path.relative(ROOT, f).replace(/\\/g, '/')))
    : allFiles

let totalHits = 0
const fileHits = []

for (const f of scopeFiles) {
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
    // 判"是否开了跨行块注释"之前,必须先剥字符串与行注释:
    // 否则 `// 见 /api/ai-tutor/*` 里的 `/*` 会把状态机永久卡进"块注释中",
    // 该文件后续真实命中全被判 0(假绿)。2026-09-23 由 learn 族代理变异自检抓到。
    const probe = bareOf(line)
    const codeForBlock = probe.split('//')[0]
    if (codeForBlock.includes('/*') && !codeForBlock.includes('*/')) { inBlockComment = true; continue }
    // 剥掉**同行成对**的块注释:`{/* JSX 注释 */}` 与 `/* … */` 都是注释。
    // 原实现只跟踪"跨行块注释",整行成对的形态会漏剥 ⇒ 中文注释被算成命中
    // (实测 swarm-topology-view 18 处假阳),进而污染基线额度。
    const code = line.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    if (!ZH_RE.test(code)) continue
    if (SKIP_LINE_RE.test(code)) continue
    if (SKIP_TOKEN_RE.test(code)) continue
    hits.push({ line: i + 1, text: code.trim().slice(0, 200) })
  }
  if (hits.length > 0) {
    totalHits += hits.length
    fileHits.push({
      // 归一为正斜杠:基线要入仓,Windows 的 path.relative 给反斜杠会跨平台漂移
      file: path.relative(ROOT, f).replace(/\\/g, '/'),
      count: hits.length,
      samples: hits,
    })
  }
}

fileHits.sort((a, b) => b.count - a.count)

// ── 基线(ratchet)判定 ─────────────────────────────────────────────────────
// 只拦"比基线更多"的命中:存量额度冻结在 scripts/hardcoded-zh-baseline.json,
// 不在基线里的新文件额度为 0(新文件出现硬编码即拦)。
const baseline = readBaseline()
const violations = fileHits
  .map((h) => ({ file: h.file, count: h.count, allowed: baseline[h.file] ?? 0 }))
  .filter((v) => v.count > v.allowed)
  .sort((a, b) => b.count - b.allowed - (a.count - a.allowed))

if (UPDATE_BASELINE) {
  if (STAGED) {
    console.error('[scan-hardcoded-zh] --update-baseline 必须不带 --staged(要用全量结果重写基线)')
    process.exit(2)
  }
  const files = {}
  for (const h of fileHits) files[h.file] = h.count
  fs.writeFileSync(
    BASELINE_FILE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        targets: TARGETS.map((t) => path.relative(ROOT, t).replace(/\\/g, '/')),
        total: totalHits,
        files,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )
  console.log(
    `[scan-hardcoded-zh] 基线已重写:${fileHits.length} 文件 / ${totalHits} 行 → scripts/hardcoded-zh-baseline.json`,
  )
  process.exit(0)
}

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
  if (STRICT && violations.length > 0) process.exit(1)
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

if (violations.length > 0) {
  console.error(`\n[scan-hardcoded-zh] 越过基线(${violations.length} 个文件新增硬编码中文):`)
  for (const v of violations.slice(0, 10)) {
    console.error(`  ${v.file}: ${v.count} 处 > 基线 ${v.allowed} 处(新增 ${v.count - v.allowed})`)
  }
  if (violations.length > 10) console.error(`  …另有 ${violations.length - 10} 个文件`)
  console.error('  正解:界面文案走 t()/语言包(见 AGENTS.md §19);确属内容文案或已取词的误报,')
  console.error('  先跑 node scripts/scan-hardcoded-zh.mjs 定位,再 node scripts/scan-hardcoded-zh.mjs --update-baseline 下调基线。')
}
if (STRICT && violations.length > 0) {
  console.error('\n[scan-hardcoded-zh] --exit 1:本次改动新增了硬编码中文,pre-commit 拒绝通过')
  process.exit(1)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
