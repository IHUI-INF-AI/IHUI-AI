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
// 豁免:品牌名/技术术语/占位符/短缩写(按 AGENTS.md §20 翻译策略应保留英文)
const untranslatedValueIssues = []
const TRANSLATABLE_LANGS = ['ja', 'ko', 'zh-CN', 'zh-TW']

// 加载 brand-glossary.json 的 canonical 英文名作为白名单
const BRAND_CANONICAL_SET = new Set()
try {
  const glossary = JSON.parse(readFileSync(join(ROOT, 'scripts/brand-glossary.json'), 'utf8'))
  if (glossary.brands) {
    for (const v of Object.values(glossary.brands)) {
      if (typeof v === 'string') BRAND_CANONICAL_SET.add(v)
    }
  }
} catch {
  // glossary 加载失败不阻塞,继续空集合
}

// 豁免规则:值匹配以下任一条件则保留英文,不标记为"未翻译"
function isExemptFromTranslation(value, key) {
  if (typeof value !== 'string' || value.length === 0) return true
  const v = value.trim()
  // 1. 短缩写(≤5 字符且全大写字母/数字,如 AI/ID/IP/PV/UV/CPU/QPS/VIP/GPT/MCP/SSO/RBAC/RLS/SSE/H5/PC/DAU/KB)
  if (/^[A-Z][A-Z0-9]{0,4}$/.test(v)) return true
  // 2. 占位符/示例值(含 ... / :// / @ / 纯数字 / 货币符号 / 文件路径)
  if (/(\.\.\.|:\/\/|@|^\$|^\d+[.,]?\d*$|^\/|\.txt$|\.json$|\.md$)/.test(v)) return true
  // 3. 技术术语(含 . 或连字符的组合,如 npm/i -g/next.config/sk-.../User-Agent/Base URL/Model ID/Client ID)
  if (/^[A-Za-z]+(\s|-)[A-Z]/.test(v) && v.length <= 30) return true
  // 4. 错误码/内部标识(含数字+字母混合且无空格,如 POL-001/aliGener21/Api1/Arch1)
  if (/^[A-Za-z]+[0-9]/.test(v) || /^[A-Za-z]+-[0-9]/.test(v)) return true
  // 5. 已知品牌名/产品名(从 brand-glossary.json 的 canonical 值加载)
  if (BRAND_CANONICAL_SET.has(v)) return true
  // 6. 纯大写英文标题(全大写且含空格,如 "LATEST NEWS" / "CHOOSE YOUR PLAN" — 有意为之的英文设计标题)
  if (/^[A-Z][A-Z\s]+$/.test(v) && v.length >= 4) return true
  // 7. 编程语言/框架名(TypeScript/Python/Vue.js/React 等)
  if (/^(TypeScript|JavaScript|Python|Java|Go|Rust|Vue\.js|Vue|React|HTML|CSS|Markdown|Word|Excel|PPT|PDF|TXT|JSON|YAML|XML)$/.test(v)) return true
  // 8. 文件格式扩展名描述(如 "Word (docx)")
  if (/^[A-Za-z]+\s*\([a-z0-9]+\)$/.test(v)) return true
  // 9. key 名暗示应保留英文(含 slug/id/key/url/ip/ua/qps/token/placeholder 的 key)
  if (/(slug|placeholder|ip|ua|url|id|key|token|qps|example|formatExample)$/i.test(key)) return true
  // 10. 比例/分辨率格式(如 16:9, 9:16, 1:1, 4:3)
  if (/^\d+:\d+$/.test(v)) return true
  // 11. 含 $ 或 SLA 的价格/指标(如 "99.9% SLA", "Input $/1K", "Output $/1K")
  if (/[\$]|SLA/i.test(v)) return true
  // 12. 含 / 的组合术语(如 "macOS / Windows / Linux", "README / GitHub", "Windsurf (Codeium)")
  if (/\s\/\s/.test(v)) return true
  // 13. 已知技术术语集合(Webhook/Pipeline/Tokens/Bucket/Endpoint/Hooks/Diff/License/Provider/Context/Temperature/max_tokens/tokens)
  if (/^(Webhook|Webhooks|Pipeline|Tokens|tokens|Bucket|Endpoint|Hooks|Diff|License|Provider|Context|Temperature|max_tokens|AppSecret|AppID|AccessToken|RefreshToken|OpenID|Client ID|Client Secret|API Key|Base URL|Model ID|Context Length|Max Tokens|Top P|Frequency Penalty|Presence Penalty|Response Format|System Prompt|AgenticAI|RAG|Swagger|OpenAPI|Bearer|JWT|OAuth|SAML|LDAP|URL|URI|UUID|GUID|CRUD|DDL|DML|DCL|TCL|ACID|BASE|CAP|CRDT|WAL|WAF|CDN|DNS|DHCP|TCP|UDP|HTTP|HTTPS|TLS|SSL|SSH|SFTP|FTP|SMTP|IMAP|POP3|DNS|API|SDK|CLI|GUI|TUI|REPL|IDE|VM|OS|FS|IO|CPU|GPU|RAM|ROM|SSD|HDD|USB|HDMI|VGA|DP|PCI|BIOS|UEFI|GPT|MBR)$/.test(v)) return true
  // 14. 下划线分隔的技术标识符(如 cc-switch, codex++, GoogleAP, max_tokens)
  if (/^[a-z][a-zA-Z0-9]*[-_+][a-zA-Z0-9+_-]*$/.test(v) && !/\s/.test(v)) return true
  // 15. 品牌名后缀组合(如 "Windsurf (Codeium)", "Cline (VSCode)", "IBM watsonx", "TII Falcon", "Ai2 Allen")
  if (/^[A-Z][A-Za-z]+\s\([A-Za-z]+\)$/.test(v)) return true
  if (/^[A-Z][A-Za-z]+\s[a-z][a-z]+$/.test(v) && v.length <= 25) return true
  return false
}

if (!isStaged || messagesChanged) {
  const enLeaves = collectLeafValues(messages.en || {})
  for (const lang of TRANSLATABLE_LANGS) {
    if (lang === 'en' || !messages[lang]) continue
    const langValues = collectLeafValues(messages[lang])
    const untranslated = []
    for (const [key, enValue] of enLeaves) {
      if (typeof enValue !== 'string' || enValue.length < 2) continue
      if (!/^[A-Za-z0-9 ._!?'",:;\-/()&+@#$%^*=]+$/.test(enValue)) continue
      if (isExemptFromTranslation(enValue, key)) continue
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
