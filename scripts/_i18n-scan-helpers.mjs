#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * i18n 死 key 审计器公共函数(2026-07-26 立)
 *
 * 抽出 scripts/scan-dead-i18n-keys.mjs 中的核心逻辑,
 * 供 4 端独立扫描脚本(extension / mobile-rn / desktop / miniapp-taro)
 * 与 web 兼容入口(scan-dead-i18n-keys.mjs)复用,避免 5 份代码复制。
 *
 * 不直接运行,仅供其他脚本 import:
 *
 *   import { main as runScan } from './_i18n-scan-helpers.mjs'
 *   const code = runScan({
 *     name: 'extension',
 *     messagesPath: 'packages/i18n/messages/extension/zh-CN.json',
 *     scanTargets: ['apps/extension/entrypoints', 'apps/extension/src'],
 *     outputPattern: '.trae-cn/tmp/i18n-extension-dead-keys-{date}.md',
 *   })
 *   process.exit(code)
 *
 * 死 key 判定:zh-CN.json 存在 + 代码无静态 t('key') 引用 + 不在任何 useTranslations/getTranslations namespace 下 = 死 key
 * 翻译不完整:5 语言任一缺该 key(不计入死 key,单列)
 * 动态 key:t(`prefix.${var}`) 模板字符串不算静态引用,会列在"动态 key 提示"段
 *
 * 跳过条件:
 *   - messagesPath 不存在(messages 目录缺失,如 desktop 端)
 *   - scanTargets 为空数组(端无 JS 代码,如 desktop 端)
 *   两种情况都直接 exit 0,不计入死 key。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']
const EXCLUDE_DIRS = new Set([
  'node_modules', '.next', '.git', 'dist', 'build', 'coverage',
  '__tests__', 'tests', 'test', '__mocks__', 'fixtures',
])
const EXCLUDE_FILE_PATTERNS = [
  /\.test\.(ts|tsx)$/,
  /\.spec\.(ts|tsx)$/,
  /\.d\.ts$/,
  /messages\//,
]

// 静态 t('key') / t("key") - 全路径点分命名空间
export const STATIC_T_RE = /\bt\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]\s*\)/g
// 动态 t(`prefix.${var}`) - 仅提示用
export const DYNAMIC_T_RE = /\bt\(\s*['"`]([^'"`]*\$\{[^'"`]+}[^'"`]*)['"`]\s*\)/g
// useTranslations('namespace') / getTranslations('namespace') - 命名空间下所有 key 视为潜在引用(启发式)
// 2026-07-26 增强:getTranslations 是 next-intl/server 在 server component 使用的 API(等价于 useTranslations),
// subagent-D commit 5ebb17915 仅识别 useTranslations 模式,导致 server component 引用 namespace 被误判为死 key。
export const USE_T_RE = /\b(?:useTranslations|getTranslations)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`]\s*\)/g
// 备用:i18n.t / getFixedT 链式调用
export const I18N_T_RE = /\b(?:i18n\.t|getFixedT|useTranslations)\s*\(\s*['"`]?[a-zA-Z-]*['"`]?\s*\)\s*\(\s*['"`]([a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+)['"`]/g
// JSX prop 字面量: <Xxx namespace="literal" />
export const JSX_PROP_NS_RE = /\bnamespace\s*=\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`]/g
// TypeScript 联合类型字面量: namespace?: 'a' | 'b'
export const UNION_TYPE_NS_RE = /\bnamespace\s*\??\s*:\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`](\s*\|\s*['"`]([a-zA-Z][a-zA-Z0-9_.\-]*)['"`])*/g

// 递归展开 JSON → 点分 key 集合(叶子值才算 key,纯命名空间不计)
export function flatten(obj, prefix = '', out = new Set()) {
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

export function loadJson(p) {
  if (!fs.existsSync(p)) throw new Error(`文件不存在: ${p}`)
  const raw = fs.readFileSync(p, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`JSON 解析失败: ${p} (${e.message})`)
  }
}

export function walkDir(dir, out = []) {
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

export function scanCode(files) {
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
      JSX_PROP_NS_RE.lastIndex = 0
      while ((m = JSX_PROP_NS_RE.exec(line)) !== null) usedNamespaces.add(m[1])
      UNION_TYPE_NS_RE.lastIndex = 0
      while ((m = UNION_TYPE_NS_RE.exec(line)) !== null) {
        usedNamespaces.add(m[1])
        if (m[3]) usedNamespaces.add(m[3])
      }
      DYNAMIC_T_RE.lastIndex = 0
      while ((m = DYNAMIC_T_RE.exec(line)) !== null) {
        dynamicHits.push({ file: path.relative(ROOT, f), line: i + 1, snippet: trimmed.slice(0, 200) })
      }
    }
  }
  return { staticRefs, usedNamespaces, dynamicHits, scanned: files.length }
}

// 判定 leaf key 是否在某个 used namespace 下
export function isInUsedNamespace(key, usedNamespaces) {
  for (const ns of usedNamespaces) {
    if (key === ns || key.startsWith(ns + '.')) return true
  }
  return false
}

export function groupByNamespace(keys) {
  const groups = new Map()
  for (const k of keys) {
    const ns = k.split('.')[0]
    if (!groups.has(ns)) groups.set(ns, [])
    groups.get(ns).push(k)
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

/**
 * 主流程入口(供 4 端脚本 + web 兼容入口调用)
 *
 * @param {Object} opts
 * @param {string} opts.name - 端名(用于日志/报告,例 'extension')
 * @param {string} opts.messagesPath - 相对 ROOT 的 zh-CN.json 路径
 * @param {string[]} [opts.scanTargets=[]] - 相对 ROOT 的代码扫描目录列表
 * @param {string} opts.outputPattern - 报告输出路径模板,可用 {date} 占位当天日期
 * @param {boolean} [opts.dryRun=false] - 只打印统计,不写报告
 * @param {boolean} [opts.exitOnDead=false] - 发现死 key 时返回 1
 * @param {string|null} [opts.out=null] - 自定义输出路径(覆盖 outputPattern)
 * @param {string} [opts.scriptName] - 日志前缀(默认 scan-{name}-dead-i18n-keys)
 * @returns {number} 0 成功,1 --exit 1 模式且发现死 key
 */
export function main(opts) {
  const {
    name,
    messagesPath,
    scanTargets = [],
    outputPattern,
    dryRun = false,
    exitOnDead = false,
    out = null,
    scriptName,
  } = opts

  const TAG = scriptName || `scan-${name}-dead-i18n-keys`
  const TODAY = new Date().toISOString().slice(0, 10)
  const ZH_CN_PATH = path.join(ROOT, messagesPath)
  const LOCALE_DIR = path.dirname(ZH_CN_PATH)
  const LOCALE_PATHS = Object.fromEntries(LOCALES.map((l) => [l, path.join(LOCALE_DIR, `${l}.json`)]))
  const SCAN_TARGETS = scanTargets.map((t) => path.join(ROOT, t))

  // 0. 跳过条件:messages 不存在(端无独立 i18n,如 desktop)
  if (!fs.existsSync(ZH_CN_PATH)) {
    console.log(`[${TAG}] 跳过:基准语言文件不存在 ${path.relative(ROOT, ZH_CN_PATH)}(端无独立 i18n)`)
    return 0
  }

  // 0b. 跳过条件:无 JS 代码扫描目标(端是纯原生包装,如 desktop)
  if (SCAN_TARGETS.length === 0) {
    console.log(`[${TAG}] 跳过:scanTargets 为空(端无 JS 代码,无法静态扫描)`)
    return 0
  }

  // 1. 加载 zh-CN.json + 其他 4 语言
  console.log(`[${TAG}] target=${name} 加载基准: ${path.relative(ROOT, ZH_CN_PATH)}`)
  const leafKeys = flatten(loadJson(ZH_CN_PATH))
  const localeData = { 'zh-CN': { keys: leafKeys } }
  for (const l of LOCALES) {
    if (l === 'zh-CN') continue
    if (!fs.existsSync(LOCALE_PATHS[l])) {
      console.warn(`[${TAG}] 警告:语言文件不存在: ${path.relative(ROOT, LOCALE_PATHS[l])}`)
      localeData[l] = { keys: new Set() }
      continue
    }
    localeData[l] = { keys: flatten(loadJson(LOCALE_PATHS[l])) }
    console.log(`[${TAG}] 加载: ${path.relative(ROOT, LOCALE_PATHS[l])} (${localeData[l].keys.size} keys)`)
  }

  // 2. 扫描代码
  const files = []
  for (const t of SCAN_TARGETS) walkDir(t, files)
  console.log(`[${TAG}] 扫描代码: ${files.length} 个文件`)
  const { staticRefs, usedNamespaces, dynamicHits } = scanCode(files)
  console.log(`[${TAG}] 静态引用 key: ${staticRefs.size} 个(去重)`)
  console.log(`[${TAG}] useTranslations/getTranslations namespace: ${usedNamespaces.size} 个`)

  // 3. 死 key
  const deadKeys = new Set()
  for (const k of leafKeys) {
    if (!staticRefs.has(k) && !isInUsedNamespace(k, usedNamespaces)) deadKeys.add(k)
  }
  // 4. 翻译不完整
  const incompleteKeys = new Set()
  for (const k of leafKeys) {
    for (const l of LOCALES) {
      if (l !== 'zh-CN' && !localeData[l].keys.has(k)) { incompleteKeys.add(k); break }
    }
  }

  // 5. 统计
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
  console.log(`  useTranslations/getTranslations namespace: ${totalNamespaces}`)
  console.log(`  死 key: ${deadCount} (${deadRatio}%)`)
  console.log(`  翻译不完整 key: ${incompleteCount}`)
  console.log(`  动态 t(\`prefix.\${var}\`) 命中: ${dynamicHits.length} 处`)

  if (dryRun) {
    console.log(`\n[${TAG}] --dry-run:跳过报告写入`)
    if (exitOnDead && deadCount > 0) return 1
    return 0
  }

  // 6. 生成 markdown 报告
  const lines = []
  const L = (s = '') => lines.push(s)
  L(`# i18n 死 key 审计报告(${TODAY},target=${name})`)
  L()
  L(`> 自动生成 by \`scripts/${TAG}.mjs\`(2026-07-26 公共函数抽象到 _i18n-scan-helpers.mjs)`)
  L(`> target=${name},messagesPath=${messagesPath}`)
  L('## 总览')
  L(`- target:**${name}**`)
  L(`- 扫描文件:5 语言(\`${LOCALES.map((l) => path.relative(ROOT, LOCALE_PATHS[l])).join('`, `')}\`)`)
  L(`- 递归 leaf key 总数:**${totalLeaves}**`)
  L(`- 代码静态引用 key(全路径 \`t('a.b.c')\` 形式):**${totalRefs}**(去重)`)
  L(`- \`useTranslations/getTranslations('namespace')\` 命名空间:**${totalNamespaces}** 个(命名空间下所有 key 视作潜在引用,启发式)`)
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

  const outPath = out
    ? path.resolve(ROOT, out)
    : path.join(ROOT, outputPattern.replace('{date}', TODAY))
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')
  console.log(`\n[${TAG}] 报告写入: ${path.relative(ROOT, outPath)}`)

  if (exitOnDead && deadCount > 0) {
    console.error(`[${TAG}] --exit 1:发现 ${deadCount} 个死 key`)
    return 1
  }
  return 0
}
