#!/usr/bin/env node
/**
 * i18n AI 翻译流水线 - 翻译结果应用器(零 LLM API 调用)。
 *
 * 设计理念(2026-07-24 立,与 i18n-diff.mjs 配套):
 *   - 本脚本只做"读取 AI agent 写入的翻译结果 + 应用到 locale 文件"
 *   - 翻译能力由 AI 编程 agent 自带,不调用任何 LLM API
 *   - 应用后自动保持 key 顺序与 zh-CN 基准一致
 *
 * 输入: .trae-cn/tmp/i18n-translations.json
 *   {
 *     "translatedAt": "2026-07-24T...",
 *     "translatedBy": "AI agent (claude/glm/gpt)",
 *     "translations": {
 *       "en": { "skills.market.title": "Skills Market", ... },
 *       "ja": { ... },
 *       "ko": { ... },
 *       "zh-TW": { ... }
 *     }
 *   }
 *
 * 用法:
 *   node scripts/i18n-apply.mjs                  # 应用默认路径的翻译结果
 *   node scripts/i18n-apply.mjs --input <path>   # 自定义翻译结果路径
 *   node scripts/i18n-apply.mjs --check          # 只校验 parity,不写入
 *   node scripts/i18n-apply.mjs --target=extension  # 操作 extension i18n
 *   node scripts/i18n-apply.mjs --target=miniapp-taro  # 操作 miniapp-taro i18n(读写 .ts)
 *
 * 退出码:
 *   0 = 成功应用 / check 通过
 *   1 = 翻译结果不完整(仍有 pending) 或应用失败
 *   2 = 用法错误
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()
const isCheck = process.argv.includes('--check')
const inputIdx = process.argv.indexOf('--input')
const customInput = inputIdx >= 0 ? process.argv[inputIdx + 1] : null
const targetArg = process.argv.find((a) => a.startsWith('--target='))
const TARGET = targetArg ? targetArg.split('=')[1] : 'web'

// target → 目录 + 文件扩展名(与 i18n-diff.mjs 保持一致)
const TARGET_CONFIG = {
  web: { dir: 'apps/web/messages', ext: '.json' },
  extension: { dir: 'packages/i18n/messages/extension', ext: '.json' },
  'miniapp-taro': { dir: 'apps/miniapp-taro/src/i18n', ext: '.ts' },
}
const TARGET_CFG = TARGET_CONFIG[TARGET] || TARGET_CONFIG.web
const isMiniappTaro = TARGET === 'miniapp-taro'

const MESSAGES_DIR = path.join(ROOT, TARGET_CFG.dir)
const TMP_DIR = path.join(ROOT, '.trae-cn/tmp')
const DEFAULT_INPUT = path.join(TMP_DIR, 'i18n-translations.json')
const INPUT_FILE = customInput || DEFAULT_INPUT

const BASE_LANG = 'zh-CN'
const TARGET_LANGS = ['en', 'ja', 'ko', 'zh-TW']
const MESSAGE_EXT = TARGET_CFG.ext

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

function loadJson(file) {
  if (!fs.existsSync(file)) return null
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    console.error(`${C.red}❌ JSON 解析失败: ${file}${C.reset}`)
    console.error(`   ${e.message}`)
    return null
  }
}

// 解析 .ts 文件中的 `export default { ... }` 对象字面量为普通 JS 对象
// 用 typescript 包走 AST(禁止 eval/new Function),逻辑与 i18n-diff.mjs 一致
function parseTsObject(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)
  let exportAssignment = null
  for (const stmt of sourceFile.statements) {
    if (ts.isExportAssignment(stmt)) {
      exportAssignment = stmt
      break
    }
  }
  if (!exportAssignment) return null
  const expr = exportAssignment.expression
  if (!ts.isObjectLiteralExpression(expr)) return null
  return extractTsObject(expr)
}

function extractTsObject(node) {
  const obj = {}
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = prop.name
    const key = ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
      ? name.text
      : String(name.text || '')
    obj[key] = extractTsValue(prop.initializer)
  }
  return obj
}

function extractTsValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (node.kind === ts.SyntaxKind.NullKeyword) return null
  if (ts.isObjectLiteralExpression(node)) return extractTsObject(node)
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(extractTsValue)
  return null
}

// 提取 .ts 文件头部 `// ...` 注释行(export default 之前)
function extractHeaderComment(content) {
  const lines = content.split(/\r?\n/)
  const comments = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) {
      comments.push(line)
    } else if (trimmed === '') {
      continue
    } else {
      break
    }
  }
  return comments.length > 0 ? comments.join('\n') : null
}

// 将 JS 对象序列化为 TypeScript 对象字面量(单引号字符串,2 空格缩进)
function serializeTsObject(obj, indent = 0) {
  const keys = Object.keys(obj)
  if (keys.length === 0) return '{}'
  const pad = '  '.repeat(indent + 1)
  const closePad = '  '.repeat(indent)
  const lines = keys.map((k) => {
    const keyStr = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k}'`
    return `${pad}${keyStr}: ${serializeTsValue(obj[k], indent + 1)}`
  })
  return `{\n${lines.join(',\n')}\n${closePad}}`
}

function serializeTsValue(value, indent) {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `'${escaped}'`
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[${value.map((v) => serializeTsValue(v, indent + 1)).join(', ')}]`
  }
  if (typeof value === 'object') return serializeTsObject(value, indent)
  return 'null'
}

// 写回 .ts 文件:保留原头部注释 + export default { ... }
function writeTsObject(filePath, obj, headerComment) {
  const body = serializeTsObject(obj, 0)
  const content = headerComment
    ? `${headerComment}\nexport default ${body}\n`
    : `export default ${body}\n`
  fs.writeFileSync(filePath, content, 'utf8')
}

function collectLeafEntries(obj, prefix = '') {
  const entries = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      entries.push(...collectLeafEntries(v, p))
    } else {
      entries.push({ key: p, value: v })
    }
  }
  return entries
}

// 按 dot-path 设置嵌套对象的值,自动创建中间对象
function setByPath(obj, dotPath, value) {
  const parts = dotPath.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== 'object') {
      cur[k] = {}
    }
    cur = cur[k]
  }
  cur[parts[parts.length - 1]] = value
}

// 按 zh-CN 基准的 key 顺序重排目标语言对象
// 保持 zh-CN 的 namespace 结构 + leaf 顺序,目标语言多余的 key 追加到末尾
function reorderToBase(baseObj, targetObj) {
  const baseEntries = collectLeafEntries(baseObj)
  const targetMap = new Map(collectLeafEntries(targetObj).map((e) => [e.key, e.value]))
  const reordered = {}
  for (const { key } of baseEntries) {
    if (targetMap.has(key)) {
      setByPath(reordered, key, targetMap.get(key))
    }
  }
  // 追加 target 多余的 key(base 缺失的)
  for (const [key, value] of targetMap) {
    if (!baseEntries.some((e) => e.key === key)) {
      setByPath(reordered, key, value)
    }
  }
  return reordered
}

function applyTranslations(translations, messages) {
  const base = messages[BASE_LANG]
  if (!base) {
    console.error(`${C.red}❌ 基准语言 ${BASE_LANG}${MESSAGE_EXT} 不存在${C.reset}`)
    return { applied: 0, skipped: 0, errors: [] }
  }

  let applied = 0
  let skipped = 0
  const errors = []

  for (const lang of TARGET_LANGS) {
    if (!translations[lang]) {
      skipped++
      continue
    }
    if (!messages[lang]) {
      errors.push(`${lang}${MESSAGE_EXT} 不存在,跳过`)
      continue
    }

    const langTranslations = translations[lang]
    const langObj = messages[lang]

    for (const [key, value] of Object.entries(langTranslations)) {
      if (typeof value !== 'string') {
        errors.push(`[${lang}] ${key}: 翻译值非字符串 (${typeof value}),跳过`)
        continue
      }
      setByPath(langObj, key, value)
      applied++
    }

    // 重排 key 顺序与 zh-CN 一致
    messages[lang] = reorderToBase(base, langObj)
  }

  return { applied, skipped, errors }
}

function verifyParity(messages) {
  const baseEntries = collectLeafEntries(messages[BASE_LANG])
  const baseKeys = new Set(baseEntries.map((e) => e.key))
  const issues = []

  for (const lang of TARGET_LANGS) {
    if (!messages[lang]) continue
    const langKeys = new Set(collectLeafEntries(messages[lang]).map((e) => e.key))
    const missing = [...baseKeys].filter((k) => !langKeys.has(k))
    if (missing.length > 0) {
      issues.push({ lang, type: 'missing', count: missing.length, keys: missing.slice(0, 10) })
    }
  }

  return issues
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`${C.red}❌ 翻译结果文件不存在: ${path.relative(ROOT, INPUT_FILE)}${C.reset}`)
    console.error(`   请先由 AI agent 写入翻译结果,或用 --input <path> 指定其他路径`)
    console.error(`   期望结构: { translations: { [lang]: { [key]: translatedValue } } }`)
    process.exit(1)
  }

  const translationData = loadJson(INPUT_FILE)
  if (!translationData) {
    process.exit(1)
  }

  const translations = translationData.translations
  if (!translations || typeof translations !== 'object') {
    console.error(`${C.red}❌ 翻译结果缺少 translations 字段或格式错误${C.reset}`)
    process.exit(1)
  }

  const messages = {}
  for (const entry of fs.readdirSync(MESSAGES_DIR)) {
    if (!entry.endsWith(MESSAGE_EXT)) continue
    try {
      const filePath = path.join(MESSAGES_DIR, entry)
      messages[entry.replace(MESSAGE_EXT, '')] = isMiniappTaro
        ? parseTsObject(filePath)
        : JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      // 解析失败跳过
    }
  }

  if (!messages[BASE_LANG]) {
    console.error(`${C.red}❌ 基准语言 ${BASE_LANG}${MESSAGE_EXT} 不存在或解析失败${C.reset}`)
    process.exit(1)
  }

  console.log(`${C.bold}[i18n AI 翻译应用]${C.reset} ${isCheck ? '校验模式' : '应用模式'}`)
  console.log(`翻译来源: ${translationData.translatedBy || '(未标注)'}`)
  console.log(`翻译时间: ${translationData.translatedAt || '(未标注)'}`)
  console.log('')

  if (isCheck) {
    // 校验模式:只验证 parity,不写入
    const issues = verifyParity(messages)
    if (issues.length === 0) {
      console.log(`${C.green}✅ parity 校验通过,所有语言 key 集合与 ${BASE_LANG} 一致${C.reset}`)
      process.exit(0)
    }
    console.error(`${C.red}❌ parity 校验失败:${C.reset}`)
    for (const issue of issues) {
      console.error(`  [${issue.lang}] 缺失 ${issue.count} 键: ${issue.keys.join(', ')}${issue.count > 10 ? ' ...' : ''}`)
    }
    process.exit(1)
  }

  // 应用模式:写入翻译结果
  const result = applyTranslations(translations, messages)
  console.log(`应用: ${C.green}${result.applied}${C.reset} 处,跳过: ${C.yellow}${result.skipped}${C.reset} 语言,错误: ${C.red}${result.errors.length}${C.reset}`)

  if (result.errors.length > 0) {
    for (const err of result.errors) {
      console.error(`  ${C.red}⚠️ ${err}${C.reset}`)
    }
  }

  // 写回 locale 文件
  let written = 0
  for (const lang of TARGET_LANGS) {
    if (!messages[lang]) continue
    if (!translations[lang]) continue
    const file = path.join(MESSAGES_DIR, `${lang}${MESSAGE_EXT}`)
    if (isMiniappTaro) {
      const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
      const header = extractHeaderComment(original)
      writeTsObject(file, messages[lang], header)
    } else {
      fs.writeFileSync(file, JSON.stringify(messages[lang], null, 2) + '\n', 'utf8')
    }
    written++
    console.log(`  ${C.green}✅${C.reset} ${lang}${MESSAGE_EXT} 已更新`)
  }

  console.log('')
  console.log(`${C.dim}共写入 ${written} 个 locale 文件${C.reset}`)

  // 应用后自动校验 parity
  const issues = verifyParity(messages)
  if (issues.length > 0) {
    console.error(`${C.yellow}⚠️ 应用后仍有 parity 问题(可能翻译结果不完整):${C.reset}`)
    for (const issue of issues) {
      console.error(`  [${issue.lang}] 仍缺 ${issue.count} 键`)
    }
    console.error(`   ${C.dim}建议: 重新跑 node scripts/i18n-diff.mjs 获取最新 pending 清单${C.reset}`)
    process.exit(1)
  }

  console.log(`${C.green}✅ parity 校验通过${C.reset}`)
  console.log('')
  console.log(`${C.bold}下一步:${C.reset}`)
  console.log(`  1. ${C.cyan}node scripts/check-i18n-keys.mjs${C.reset} 完整守门`)
  console.log(`  2. ${C.cyan}node scripts/scan-i18n-zh-residue.mjs ko --staged${C.reset} 中文残留检测`)
  console.log(`  3. ${C.cyan}node scripts/scan-i18n-zh-residue.mjs zh-TW --staged${C.reset} 简体字残留检测`)

  process.exit(0)
}

main()
