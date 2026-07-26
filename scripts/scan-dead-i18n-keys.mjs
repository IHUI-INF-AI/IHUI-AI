#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * i18n 死 key 审计器(2026-07-26 立)
 *
 * 扫描 web 端 zh-CN.json 中已声明但代码中无任何 t() / getTranslations() 引用的 "死 key",
 * 同时检测 5 语言翻译完整性(任一语言缺该 key → 翻译不完整提示)。
 *
 * 用法:
 *   node scripts/scan-dead-i18n-keys.mjs                    # 默认输出 .trae-cn/tmp/i18n-dead-keys-YYYY-MM-DD.md
 *   node scripts/scan-dead-i18n-keys.mjs --dry-run         # 只打印统计,不写报告
 *   node scripts/scan-dead-i18n-keys.mjs --out <path>       # 自定义输出路径
 *   node scripts/scan-dead-i18n-keys.mjs --exit 1           # 发现死 key 则 exit 1
 *   node scripts/scan-dead-i18n-keys.mjs --help             # 帮助
 *
 * 实际位置(任务文档原写 apps/web/messages/,项目实际迁到 packages/i18n/messages/web/):
 *   - 基准语言:packages/i18n/messages/web/zh-CN.json
 *   - 5 语言:   packages/i18n/messages/web/{en,ja,ko,zh-CN,zh-TW}.json
 *   - 代码扫描:apps/web/src + apps/miniapp-taro/src + apps/cli/src
 *
 * 死 key 判定:zh-CN.json 存在 + 代码无静态 t('key') 引用 + 不在任何 useTranslations namespace 下 = 死 key
 * 翻译不完整:5 语言任一缺该 key(不计入死 key,单列)
 * 动态 key:t(`prefix.${var}`) 模板字符串不算静态引用,会列在"动态 key 提示"段
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const REPORT_DIR = path.join(ROOT, '.trae-cn/tmp')
const DEFAULT_TODAY = new Date().toISOString().slice(0, 10)
const ZH_CN_PATH = path.join(ROOT, 'packages/i18n/messages/web/zh-CN.json')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const LOCALE_PATHS = Object.fromEntries(LOCALES.map((l) => [l, path.join(ROOT, `packages/i18n/messages/web/${l}.json`)]))
const SCAN_TARGETS = [
  path.join(ROOT, 'apps/web/src'),
  path.join(ROOT, 'apps/web/app'), // Next.js 15 App Router(2026-07-26 漏扫 bug 修复)
  path.join(ROOT, 'apps/miniapp-taro/src'),
  path.join(ROOT, 'apps/cli/src'),
]
const EXCLUDE_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage', '__tests__', 'tests', 'test', '__mocks__', 'fixtures'])
const EXCLUDE_FILE_PATTERNS = [/\.test\.(ts|tsx)$/, /\.spec\.(ts|tsx)$/, /\.d\.ts$/, /messages\//]

// 静态 t('key') / t("key") - 全路径点分命名空间
const STATIC_T_RE = /\bt\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]\s*\)/g
// 动态 t(`prefix.${var}`) - 仅提示用
const DYNAMIC_T_RE = /\bt\(\s*['"`]([^'"`]*\$\{[^'"`]+}[^'"`]*)['"`]\s*\)/g
// useTranslations('namespace') - 命名空间下所有 key 视为潜在引用(启发式)
const USE_T_RE = /\buseTranslations\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`]\s*\)/g
// 备用:i18n.t / getFixedT 链式调用
const I18N_T_RE = /\b(?:i18n\.t|getFixedT|useTranslations)\s*\(\s*['"`]?[a-zA-Z-]*['"`]?\s*\)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g

// 解析 argv
function parseArgs(argv) {
  const args = { dryRun: false, exitOnDead: false, out: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--exit') { args.exitOnDead = argv[++i] === '1' }
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--help' || a === '-h') args.help = true
  }
  return args
}
function printHelp() {
  console.log(`scan-dead-i18n-keys.mjs — i18n 死 key 审计器

用法:
  node scripts/scan-dead-i18n-keys.mjs                    # 默认输出 .trae-cn/tmp/i18n-dead-keys-${DEFAULT_TODAY}.md
  node scripts/scan-dead-i18n-keys.mjs --dry-run         # 只打印统计,不写报告
  node scripts/scan-dead-i18n-keys.mjs --out <path>       # 自定义输出路径
  node scripts/scan-dead-i18n-keys.mjs --exit 1           # 发现死 key 则 exit 1
  node scripts/scan-dead-i18n-keys.mjs --help             # 帮助

输入(实际位置):
  基准:  ${path.relative(ROOT, ZH_CN_PATH)}
  5 语言: ${LOCALES.map((l) => path.relative(ROOT, LOCALE_PATHS[l])).join(', ')}
  代码扫描: ${SCAN_TARGETS.map((t) => path.relative(ROOT, t)).join(' + ')}

排除:node_modules / .next / dist / __tests__ / *.test.ts(x) / *.spec.ts(x) / .d.ts
`)
}

// 递归展开 JSON → 点分 key 集合(叶子值才算 key,纯命名空间不计)
function flatten(obj, prefix = '', out = new Set()) {
  if (obj === null || obj === undefined) return out
  if (Array.isArray(obj)) {
    // 字符串数组整体算一个叶子 key(prefix)
    if (obj.length > 0 && obj.every((v) => typeof v === 'string' || typeof v === 'number')) {
      if (prefix) out.add(prefix)
    }
    return out
  }
  if (typeof obj !== 'object') { if (prefix) out.add(prefix); return out }
  const keys = Object.keys(obj)
  if (keys.length === 0) { if (prefix) out.add(prefix); return out }
  for (const k of keys) {
    const v = obj[k]
    const np = prefix ? `${prefix}.${k}` : k
    if (v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) flatten(v, np, out)
    else out.add(np) // 字符串/数字/字符串数组/空对象/空数组 → 叶子
  }
  return out
}

function loadJson(p) {
  if (!fs.existsSync(p)) throw new Error(`文件不存在: ${p}`)
  const raw = fs.readFileSync(p, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`JSON 解析失败: ${p} (${e.message})`)
  }
}

function walkDir(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDE_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkDir(full, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) {
      if (EXCLUDE_FILE_PATTERNS.some((re) => re.test(full))) continue
      out.push(full)
    }
  }
  return out
}

function scanCode(files) {
  const staticRefs = new Set()
  const usedNamespaces = new Set()
  const dynamicHits = []
  for (const f of files) {
    const lines = fs.readFileSync(f, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue
      let m
      STATIC_T_RE.lastIndex = 0
      while ((m = STATIC_T_RE.exec(line)) !== null) staticRefs.add(m[1])
      I18N_T_RE.lastIndex = 0
      while ((m = I18N_T_RE.exec(line)) !== null) staticRefs.add(m[1])
      USE_T_RE.lastIndex = 0
      while ((m = USE_T_RE.exec(line)) !== null) usedNamespaces.add(m[1])
      DYNAMIC_T_RE.lastIndex = 0
      while ((m = DYNAMIC_T_RE.exec(line)) !== null) {
        dynamicHits.push({ file: path.relative(ROOT, f), line: i + 1, snippet: trimmed.slice(0, 200) })
      }
    }
  }
  return { staticRefs, usedNamespaces, dynamicHits, scanned: files.length }
}

// 判定 leaf key 是否在某个 used namespace 下
function isInUsedNamespace(key, usedNamespaces) {
  for (const ns of usedNamespaces) {
    if (key === ns || key.startsWith(ns + '.')) return true
  }
  return false
}

function groupByNamespace(keys) {
  const groups = new Map()
  for (const k of keys) {
    const ns = k.split('.')[0]
    if (!groups.has(ns)) groups.set(ns, [])
    groups.get(ns).push(k)
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) { printHelp(); process.exit(0) }

  // 1. 加载 zh-CN.json + 其他 4 语言
  if (!fs.existsSync(ZH_CN_PATH)) {
    console.error(`[scan-dead-i18n-keys] 错误:基准语言文件不存在: ${ZH_CN_PATH}`)
    console.error('(任务文档原写 apps/web/messages/,项目实际位于 packages/i18n/messages/web/)')
    process.exit(1)
  }
  console.log(`[scan-dead-i18n-keys] 加载基准: ${path.relative(ROOT, ZH_CN_PATH)}`)
  const leafKeys = flatten(loadJson(ZH_CN_PATH))
  const localeData = { 'zh-CN': { keys: leafKeys } }
  for (const l of LOCALES) {
    if (l === 'zh-CN') continue
    if (!fs.existsSync(LOCALE_PATHS[l])) {
      console.warn(`[scan-dead-i18n-keys] 警告:语言文件不存在: ${path.relative(ROOT, LOCALE_PATHS[l])}`)
      localeData[l] = { keys: new Set() }
      continue
    }
    localeData[l] = { keys: flatten(loadJson(LOCALE_PATHS[l])) }
    console.log(`[scan-dead-i18n-keys] 加载: ${path.relative(ROOT, LOCALE_PATHS[l])} (${localeData[l].keys.size} keys)`)
  }

  // 2. 扫描代码 + 3. 死 key + 4. 翻译不完整
  const files = []
  for (const t of SCAN_TARGETS) walkDir(t, files)
  console.log(`[scan-dead-i18n-keys] 扫描代码: ${files.length} 个文件`)
  const { staticRefs, usedNamespaces, dynamicHits } = scanCode(files)
  console.log(`[scan-dead-i18n-keys] 静态引用 key: ${staticRefs.size} 个(去重)`)
  console.log(`[scan-dead-i18n-keys] useTranslations namespace: ${usedNamespaces.size} 个`)

  const deadKeys = new Set()
  for (const k of leafKeys) {
    if (!staticRefs.has(k) && !isInUsedNamespace(k, usedNamespaces)) deadKeys.add(k)
  }
  const incompleteKeys = new Set()
  for (const k of leafKeys) {
    for (const l of LOCALES) {
      if (l !== 'zh-CN' && !localeData[l].keys.has(k)) { incompleteKeys.add(k); break }
    }
  }

  // 5. 统计输出
  const totalLeaves = leafKeys.size
  const totalRefs = staticRefs.size
  const totalNamespaces = usedNamespaces.size
  const deadCount = deadKeys.size
  const incompleteCount = incompleteKeys.size
  const deadRatio = totalLeaves > 0 ? ((deadCount / totalLeaves) * 100).toFixed(1) : '0.0'
  const summary = {
    scannedAt: new Date().toISOString(),
    totalLeafKeys: totalLeaves,
    totalStaticRefs: totalRefs,
    totalUsedNamespaces: totalNamespaces,
    deadKeyCount: deadCount,
    deadKeyRatio: deadRatio + '%',
    incompleteKeyCount: incompleteCount,
  }

  console.log('\n=== 总览 ===')
  console.log(`  基准语言 leaf keys: ${totalLeaves}`)
  console.log(`  代码静态引用 key: ${totalRefs}`)
  console.log(`  useTranslations namespace: ${totalNamespaces}`)
  console.log(`  死 key: ${deadCount} (${deadRatio}%)`)
  console.log(`  翻译不完整 key: ${incompleteCount}`)
  console.log(`  动态 t(\`prefix.\${var}\`) 命中: ${dynamicHits.length} 处`)

  if (args.dryRun) {
    console.log('\n[scan-dead-i18n-keys] --dry-run:跳过报告写入')
    if (args.exitOnDead && deadCount > 0) process.exit(1)
    process.exit(0)
  }

  // 6. 生成 markdown 报告
  const lines = []
  const L = (s = '') => lines.push(s)
  L(`# i18n 死 key 审计报告(${DEFAULT_TODAY})`)
  L()
  L('> 自动生成 by `scripts/scan-dead-i18n-keys.mjs`(2026-07-26 立)')
  L('> 任务文档原写 `apps/web/messages/*.json`,项目实际位于 `packages/i18n/messages/web/`(2026-07-25 i18n 单一来源迁移)。')
  L('## 总览')
  L(`- 扫描文件:5 语言(\`${LOCALES.map((l) => path.relative(ROOT, LOCALE_PATHS[l])).join('`, `')}\`)`)
  L(`- 递归 leaf key 总数:**${totalLeaves}**`)
  L(`- 代码静态引用 key(全路径 \`t('a.b.c')\` 形式):**${totalRefs}**(去重)`)
  L(`- \`useTranslations('namespace')\` 命名空间:**${totalNamespaces}** 个(命名空间下所有 key 视作潜在引用,启发式)`)
  L(`- 死 key 数量:**${deadCount}**(占比 **${deadRatio}%**)`)
  L(`- 翻译不完整 key 数量:**${incompleteCount}**`)
  L(`- 动态 t(\`prefix.\${var}\`) 命中:${dynamicHits.length} 处`)
  L('## 死 key 列表(按 namespace 分组)')
  if (deadCount === 0) { L('_无死 key_ ✅') }
  else for (const [ns, keys] of groupByNamespace(deadKeys)) {
    L(`### \`${ns}.*\`  (${keys.length} 个)`)
    for (const k of keys) L(`- \`${k}\``)
  }
  L('## 翻译不完整 key 列表(5 语言中任一缺失)')
  if (incompleteCount === 0) { L('_翻译完整_ ✅') }
  else for (const [ns, keys] of groupByNamespace(incompleteKeys)) {
    L(`### \`${ns}.*\`  (${keys.length} 个)`)
    for (const k of keys) {
      const missingLangs = LOCALES.filter((l) => l !== 'zh-CN' && !localeData[l].keys.has(k))
      L(`- \`${k}\`  (缺: ${missingLangs.join(', ')})`)
    }
  }
  L('## 动态 key 提示(代码中拼接的 key,无法静态扫描)')
  if (dynamicHits.length === 0) {
    L('_未发现动态 t(`prefix.${var}`) 调用_')
  } else {
    L(`共 ${dynamicHits.length} 处动态 key 调用,这些 key 即使在 zh-CN.json 中定义也无法通过静态扫描验证,建议人工核对:`)
    const byFile = new Map()
    for (const h of dynamicHits) { if (!byFile.has(h.file)) byFile.set(h.file, []); byFile.get(h.file).push(h) }
    for (const [f, hits] of byFile) {
      L(`- \`${f}\`(${hits.length} 处)`)
      for (const h of hits.slice(0, 3)) L(`  - L${h.line}: \`${h.snippet}\``)
      if (hits.length > 3) L(`  - ... 另 ${hits.length - 3} 处`)
    }
  }
  L('## 排除项')
  L('- 目录:node_modules / .next / dist / coverage / __tests__ / tests / __mocks__ / fixtures')
  L('- 文件:`*.test.ts(x)` / `*.spec.ts(x)` / `*.d.ts`')
  L('---')
  L(`_Generated at ${summary.scannedAt}_`)

  const outPath = args.out
    ? path.resolve(ROOT, args.out)
    : path.join(REPORT_DIR, `i18n-dead-keys-${DEFAULT_TODAY}.md`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')
  console.log(`\n[scan-dead-i18n-keys] 报告写入: ${path.relative(ROOT, outPath)}`)

  if (args.exitOnDead && deadCount > 0) {
    console.error(`[scan-dead-i18n-keys] --exit 1:发现 ${deadCount} 个死 key`)
    process.exit(1)
  }
  process.exit(0)
}

main()
