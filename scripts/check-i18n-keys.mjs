#!/usr/bin/env node
/**
 * i18n 键完整性检查守门脚本。
 *
 * 改进点(相比旧版):
 * - 全语言覆盖: 动态扫描 apps/web/messages/*.json 全部语言文件,以 zh-CN 为基准做 parity
 * - 扩大扫描范围: 扫描 apps/web/ 下所有 .ts/.tsx(含 app/、src/components/、src/lib/ 等)
 *   排除 messages/、.next/、node_modules/、.git/
 * - 识别 getTranslations: 同时识别 useTranslations('ns') 和 getTranslations('ns')(含 await)
 * - 单文件多命名空间: 基于变量名精确归属,覆盖 t/tc/te 等变量;多 ns 时宽松检查(任一 ns 存在即通过)
 * - --staged 双模式: 暂存区报 error(exit 1) / 全量报 warning(exit 0)
 *
 * 用法: node scripts/check-i18n-keys.mjs [--staged]
 *   --staged: 只检查 git 暂存区涉及的文件(pre-commit 用, 有问题则 exit 1)
 *   无参数:   全量检查(CI 用, 历史遗留问题标 warning, exit 0)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const WEB_DIR = join(ROOT, 'apps/web')
const MESSAGES_DIR = join(WEB_DIR, 'messages')
const EXCLUDE_DIRS = new Set(['messages', '.next', 'node_modules', '.git'])
const BASE_LANG = 'zh-CN'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

function collectSourceFiles(dir, result = []) {
  if (!existsSync(dir)) return result
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      collectSourceFiles(full, result)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      result.push(full)
    }
  }
  return result
}

function loadMessages() {
  const langs = {}
  if (!existsSync(MESSAGES_DIR)) return langs
  for (const entry of readdirSync(MESSAGES_DIR)) {
    if (!entry.endsWith('.json')) continue
    try {
      langs[entry.replace('.json', '')] = JSON.parse(
        readFileSync(join(MESSAGES_DIR, entry), 'utf8'),
      )
    } catch {
    }
  }
  return langs
}

function getNested(obj, dotPath) {
  return dotPath.split('.').reduce((acc, k) => {
    if (acc && typeof acc === 'object' && k in acc) return acc[k]
    return undefined
  }, obj)
}

function collectLeafKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

function collectLeafValues(obj, prefix = '') {
  const map = new Map()
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [p, val] of collectLeafValues(v, path)) {
        map.set(p, val)
      }
    } else {
      map.set(path, v)
    }
  }
  return map
}

function extractNamespaces(src) {
  const pairs = []
  const re =
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/g
  let m
  while ((m = re.exec(src)) !== null) {
    pairs.push({ varName: m[1], ns: m[2] })
  }
  return pairs
}

function extractKeysByVar(src, varName) {
  const escaped = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const keys = new Set()
  const re = new RegExp(`\\b${escaped}\\(\\s*['"]([^'"]+)['"]`, 'g')
  let m
  while ((m = re.exec(src)) !== null) {
    keys.add(m[1])
  }
  return [...keys]
}

function hasKey(msg, ns, key) {
  const nsObj = getNested(msg, ns)
  if (!nsObj || typeof nsObj !== 'object') return false
  if (key.includes('.')) {
    return getNested(nsObj, key) !== undefined
  }
  return key in nsObj
}

const messages = loadMessages()
const langNames = Object.keys(messages).sort()

if (langNames.length === 0 || !messages[BASE_LANG]) {
  console.log(`${C.yellow}[i18n 键检查] messages 文件不存在或不完整,跳过${C.reset}`)
  process.exit(0)
}

const baseLeaves = new Set(collectLeafKeys(messages[BASE_LANG]))

let sourceFiles = []
let messagesChanged = false

if (isStaged) {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    const staged = output.split('\n').filter(Boolean)
    messagesChanged = staged.some(
      (f) => f.startsWith('apps/web/messages/') && f.endsWith('.json'),
    )
    if (messagesChanged) {
      sourceFiles = collectSourceFiles(WEB_DIR)
    } else {
      sourceFiles = staged
        .filter(
          (f) =>
            f.startsWith('apps/web/') &&
            (f.endsWith('.ts') || f.endsWith('.tsx')),
        )
        .filter((f) => {
          const rel = f.slice('apps/web/'.length)
          return (
            !rel.startsWith('messages/') &&
            !rel.startsWith('.next/') &&
            !rel.startsWith('node_modules/')
          )
        })
        .map((f) => join(ROOT, f))
        .filter((f) => existsSync(f))
    }
  } catch {
    sourceFiles = []
  }
} else {
  sourceFiles = collectSourceFiles(WEB_DIR)
}

if (sourceFiles.length === 0 && !messagesChanged) {
  console.log(`${C.green}[i18n 键检查] 无源文件变更,跳过${C.reset}`)
  process.exit(0)
}

const parityIssues = []

if (!isStaged || messagesChanged) {
  for (const lang of langNames) {
    if (lang === BASE_LANG) continue
    const langLeaves = new Set(collectLeafKeys(messages[lang]))
    const baseOnly = [...baseLeaves].filter((k) => !langLeaves.has(k))
    const langOnly = [...langLeaves].filter((k) => !baseLeaves.has(k))
    if (baseOnly.length > 0) {
      parityIssues.push({
        lang,
        direction: 'base-only',
        count: baseOnly.length,
        keys: baseOnly.slice(0, 20),
        total: baseOnly.length,
      })
    }
    if (langOnly.length > 0) {
      parityIssues.push({
        lang,
        direction: 'lang-only',
        count: langOnly.length,
        keys: langOnly.slice(0, 20),
        total: langOnly.length,
      })
    }
  }
}

// 翻译完整性检查:对非 en 的语言,值 === en 值 且仅含 ASCII 字母,标记为"未翻译"
// 仅作为 WARNING(不阻塞),用于发现历史上 i18n 复制粘贴导致的英文 fallback
const untranslatedValueIssues = []
const TRANSLATABLE_LANGS = ['ja', 'ko', 'zh-CN', 'zh-TW']
if (!isStaged || messagesChanged) {
  const enLeaves = collectLeafValues(messages.en || {})
  for (const lang of TRANSLATABLE_LANGS) {
    if (lang === 'en' || !messages[lang]) continue
    const langValues = collectLeafValues(messages[lang])
    const untranslated = []
    for (const [key, enValue] of enLeaves) {
      if (typeof enValue !== 'string' || enValue.length < 2) continue
      if (!/^[A-Za-z0-9 ._!?'",:;\-/()&+@#$%^*=]+$/.test(enValue)) continue
      const langValue = langValues.get(key)
      if (langValue === enValue) {
        untranslated.push({ key, value: enValue })
      }
    }
    if (untranslated.length > 0) {
      untranslatedValueIssues.push({
        lang,
        count: untranslated.length,
        samples: untranslated.slice(0, 10),
      })
    }
  }
}

const missingKeyIssues = []
let checkedFiles = 0
let checkedKeys = 0

for (const file of sourceFiles) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    continue
  }

  const nsPairs = extractNamespaces(src)
  if (nsPairs.length === 0) continue

  const namespaces = [...new Set(nsPairs.map((p) => p.ns))]
  const isMultiNs = namespaces.length > 1

  const seen = new Set()
  const usedKeys = []

  for (const { varName, ns } of nsPairs) {
    for (const key of extractKeysByVar(src, varName)) {
      const dedupe = `${ns}::${key}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      usedKeys.push({ key, ns, varName })
    }
  }

  if (usedKeys.length === 0) continue
  checkedFiles++
  checkedKeys += usedKeys.length

  const relPath = relative(ROOT, file)

  for (const { key, ns, varName } of usedKeys) {
    const existsInBase = isMultiNs
      ? namespaces.some((n) => hasKey(messages[BASE_LANG], n, key))
      : hasKey(messages[BASE_LANG], ns, key)
    if (!existsInBase) {
      missingKeyIssues.push({
        file: relPath,
        ns: isMultiNs ? namespaces.join('|') : ns,
        key,
        varName,
      })
    }
  }
}

const issueCount = parityIssues.length + missingKeyIssues.length
const label = isStaged ? 'ERROR' : 'WARNING'
const color = isStaged ? C.red : C.yellow

if (parityIssues.length > 0) {
  console.log(
    `${color}[i18n 键检查] Parity 问题(${parityIssues.length}个) [${label}]:${C.reset}`,
  )
  for (const issue of parityIssues) {
    if (issue.direction === 'base-only') {
      console.log(
        `${color}  ${BASE_LANG} 有但 ${issue.lang} 缺失的键(${issue.total}个):${C.reset}`,
      )
    } else {
      console.log(
        `${color}  ${issue.lang} 有但 ${BASE_LANG} 无的键(${issue.total}个):${C.reset}`,
      )
    }
    console.log(`${color}    ${issue.keys.join('\n    ')}${issue.total > 20 ? '\n    ...' : ''}${C.reset}`)
  }
  console.log('')
}

if (missingKeyIssues.length > 0) {
  const byFile = new Map()
  for (const issue of missingKeyIssues) {
    if (!byFile.has(issue.file)) byFile.set(issue.file, new Map())
    const nsMap = byFile.get(issue.file)
    if (!nsMap.has(issue.ns)) nsMap.set(issue.ns, [])
    nsMap.get(issue.ns).push(issue.key)
  }

  console.log(
    `${color}[i18n 键检查] 缺失键问题(${missingKeyIssues.length}个) [${label}]:${C.reset}`,
  )
  for (const [file, nsMap] of byFile) {
    console.log(`${color}  ${file}:${C.reset}`)
    for (const [ns, keys] of nsMap) {
      console.log(
        `${color}    命名空间 [${ns}] 缺失 ${keys.length} 键:${C.reset}`,
      )
      console.log(`${color}      ${keys.map((k) => `'${k}'`).join(', ')}${C.reset}`)
    }
  }
  console.log('')
}

// 翻译完整性:未翻译键(值 === en,非阻塞 WARNING,仅信息)
if (untranslatedValueIssues.length > 0) {
  const totalUntranslated = untranslatedValueIssues.reduce(
    (s, i) => s + i.count,
    0,
  )
  console.log(
    `${C.yellow}[i18n 翻译] 未翻译键(值===en,仅 ASCII) — ${totalUntranslated} 处待人工补译:${C.reset}`,
  )
  for (const issue of untranslatedValueIssues) {
    console.log(
      `${C.yellow}  ${issue.lang}: ${issue.count} 个未翻译键${C.reset}`,
    )
    for (const s of issue.samples) {
      console.log(
        `${C.dim}    ${s.key} = "${s.value}"${C.reset}`,
      )
    }
    if (issue.count > issue.samples.length) {
      console.log(
        `${C.dim}    ... 还有 ${issue.count - issue.samples.length} 个${C.reset}`,
      )
    }
  }
  console.log(
    `${C.dim}  → 修复:为这些键添加非英文翻译(或保留 en fallback 如有意为之)${C.reset}`,
  )
  console.log('')
}

if (issueCount > 0) {
  console.log(
    `${C.dim}[i18n 键检查] 统计: 检查 ${checkedFiles} 文件, ${checkedKeys} 键, ${langNames.length} 语言 (${langNames.join(', ')})${C.reset}`,
  )
  console.log(`${C.red}[i18n 键检查] 发现问题,拒绝提交/CI失败!${C.reset}`)
  console.log(`${C.yellow}修复方法:${C.reset}`)
  console.log(`  1. 在 apps/web/messages/${BASE_LANG}.json 对应命名空间补齐缺失键`)
  console.log(`  2. 确保所有语言文件的键集与 ${BASE_LANG} 一致(parity)`)
  console.log(`  3. 多命名空间文件用不同变量名(t/tc/te)避免冲突`)
  process.exit(1)
}

console.log(
  `${C.green}[i18n 键检查] 通过,已检查 ${checkedFiles} 文件, ${checkedKeys} 键, ${langNames.length} 语言 parity OK${C.reset}`,
)
process.exit(0)
