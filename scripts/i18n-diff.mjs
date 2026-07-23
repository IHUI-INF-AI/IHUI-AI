#!/usr/bin/env node
/**
 * i18n AI 翻译流水线 - 差异检测器(零 LLM API 调用)。
 *
 * 设计理念(2026-07-24 立,用户规则:不耗费自己算力,翻译由 AI agent 在开发流程中完成):
 *   - 本脚本只做"检测 + 输出清单",不调用任何 LLM API
 *   - AI agent 读取输出的 .trae-cn/tmp/i18n-pending.json,自己翻译,写入 i18n-translations.json
 *   - 再由 scripts/i18n-apply.mjs 应用翻译结果到 locale 文件
 *   - 整个流水线对用户算力零消耗,翻译能力由 AI 编程 agent 自带
 *
 * 检测维度(3 类):
 *   1. missing    - base-only key(zh-CN 有但目标语言缺失)
 *   2. untranslated - 值 === zh-CN 原值(ko/ja/en 含汉字却未翻译)
 *   3. asciiFallback - 值 === en 值且纯 ASCII(ko/ja/zh-TW 用 en 兜底未翻译)
 *
 * 输出:
 *   - .trae-cn/tmp/i18n-pending.json (机器可读,AI agent 消费)
 *   - stdout (人类可读报告)
 *
 * 用法:
 *   node scripts/i18n-diff.mjs                  # 全量检测
 *   node scripts/i18n-diff.mjs --staged         # 仅检测 staged 涉及的 locale 文件
 *   node scripts/i18n-diff.mjs --output <path>  # 自定义输出路径
 *   node scripts/i18n-diff.mjs --quiet          # 只输出 JSON,不打印报告
 *   node scripts/i18n-diff.mjs --target=extension  # 扫描 extension i18n(packages/i18n/messages/extension/)
 *
 * 退出码:
 *   0 = 无 pending
 *   1 = 有 pending(用于守门,warn-only 场景不阻塞)
 *   2 = 用法错误
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const isStaged = process.argv.includes('--staged')
const isQuiet = process.argv.includes('--quiet')
const outputIdx = process.argv.indexOf('--output')
const customOutput = outputIdx >= 0 ? process.argv[outputIdx + 1] : null
const targetArg = process.argv.find((a) => a.startsWith('--target='))
const TARGET = targetArg ? targetArg.split('=')[1] : 'web'
const isExtension = TARGET === 'extension'

const MESSAGES_DIR = isExtension
  ? path.join(ROOT, 'packages/i18n/messages/extension')
  : path.join(ROOT, 'apps/web/messages')
const TMP_DIR = path.join(ROOT, '.trae-cn/tmp')
const DEFAULT_OUTPUT = path.join(TMP_DIR, 'i18n-pending.json')
const OUTPUT_FILE = customOutput || DEFAULT_OUTPUT

const BASE_LANG = 'zh-CN'
const TARGET_LANGS = ['en', 'ja', 'ko', 'zh-TW']
const STAGED_MESSAGES_PREFIX = isExtension
  ? 'packages/i18n/messages/extension/'
  : 'apps/web/messages/'

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

const HAN_RE = /[\u4e00-\u9fff]/
const ASCII_RE = /^[A-Za-z0-9 ._!?'",:;\-/()&+@#$%^*=]+$/

// 品牌/术语表(嵌入 pending JSON 供 AI agent 翻译时参考)
function loadGlossary() {
  const glossaryPath = path.join(ROOT, 'scripts/brand-glossary.json')
  if (!fs.existsSync(glossaryPath)) return null
  try {
    return JSON.parse(fs.readFileSync(glossaryPath, 'utf8'))
  } catch {
    return null
  }
}

function loadMessages() {
  const langs = {}
  if (!fs.existsSync(MESSAGES_DIR)) return langs
  for (const entry of fs.readdirSync(MESSAGES_DIR)) {
    if (!entry.endsWith('.json')) continue
    try {
      langs[entry.replace('.json', '')] = JSON.parse(
        fs.readFileSync(path.join(MESSAGES_DIR, entry), 'utf8'),
      )
    } catch {
      // 解析失败跳过
    }
  }
  return langs
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

function getStagedLocales() {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf8',
      cwd: ROOT,
    })
    const staged = output.split('\n').filter(Boolean)
    const locales = new Set()
    for (const f of staged) {
      if (f.startsWith(STAGED_MESSAGES_PREFIX) && f.endsWith('.json')) {
        const locale = path.basename(f, '.json')
        locales.add(locale)
      }
    }
    return [...locales]
  } catch {
    return []
  }
}

// 判断是否为"未翻译"(值 === zh-CN 原值)
// 对 zh-TW 跳过:简繁字形可能同形(如"登录"简繁同形),会海量误报
// 对 ja 跳过:日文汉字词与中文同形是合法的(如 保存/通知/回答),untranslated 海量误报
//   ja 的简体字残留由 scan-i18n-zh-residue.mjs warnOnly 模式负责
// 对 ko/en:值 === zh-CN value 且 value 含汉字 → 未翻译
function isUntranslated(lang, langValue, baseValue) {
  if (lang === 'zh-TW' || lang === 'ja') return false
  if (typeof langValue !== 'string' || typeof baseValue !== 'string') return false
  if (langValue !== baseValue) return false
  return HAN_RE.test(langValue)
}

// 判断是否为"ASCII fallback"(值 === en 值且纯 ASCII)
// 对 ko/ja/zh-TW:值 === en value 且 en value 纯 ASCII → 用 en 兜底未翻译
// 白名单跳过(有意为之的英文):
//   1. en value 在 brand-glossary 的 canonical values 集合中(品牌/字体/术语英文名)
//   2. en value 是纯大写词(品牌缩写/技术术语: iOS/API/HTML/LLM 等)
//   3. en value 长度 < 3(短词如 "AI"/"AR" 不算未翻译)
function isAsciiFallback(lang, langValue, enValue, glossaryValues) {
  if (lang === 'en') return false
  if (typeof langValue !== 'string' || typeof enValue !== 'string') return false
  if (langValue !== enValue) return false
  if (enValue.length < 3) return false
  if (!ASCII_RE.test(enValue)) return false
  // 品牌/术语白名单:en value 是 glossary 中的 canonical 英文名,有意为之
  if (glossaryValues && glossaryValues.has(enValue)) return false
  // 纯大写词(品牌缩写/技术术语):iOS/API/HTML/LLM/SaaS 等有意为之
  // 注意:不含小数点的纯大写+数字+空格+连字符组合
  if (/^[A-Z][A-Z0-9 ./\-]*$/.test(enValue) && !enValue.includes('.')) return false
  return true
}

function detectPending(messages, glossaryValues) {
  const base = messages[BASE_LANG]
  if (!base) return { pending: {}, review: {}, stats: { total: 0 } }

  const baseEntries = collectLeafEntries(base)
  const baseMap = new Map(baseEntries.map((e) => [e.key, e.value]))
  const enMap = messages.en
    ? new Map(collectLeafEntries(messages.en).map((e) => [e.key, e.value]))
    : new Map()

  const pending = {}
  const review = {}
  let total = 0

  for (const lang of TARGET_LANGS) {
    if (!messages[lang]) continue
    const langEntries = collectLeafEntries(messages[lang])
    const langMap = new Map(langEntries.map((e) => [e.key, e.value]))
    const langPending = []

    for (const { key, value: baseValue } of baseEntries) {
      if (!langMap.has(key)) {
        langPending.push({
          key,
          type: 'missing',
          sourceValue: baseValue,
        })
        continue
      }
      const langValue = langMap.get(key)
      if (isUntranslated(lang, langValue, baseValue)) {
        langPending.push({
          key,
          type: 'untranslated',
          sourceValue: baseValue,
          currentValue: langValue,
        })
        continue
      }
      const enValue = enMap.get(key)
      if (isAsciiFallback(lang, langValue, enValue, glossaryValues)) {
        // asciiFallback 大多是有意为之(品牌名/技术术语用英文),不进入 pending
        // 单独收集到 review 供 AI agent 可选审核(如 "OpenCompass 司南"→"OpenCompass"丢词)
        if (!review[lang]) review[lang] = []
        review[lang].push({
          key,
          type: 'asciiFallback',
          sourceValue: baseValue,
          enValue,
          currentValue: langValue,
        })
      }
    }

    if (langPending.length > 0) {
      pending[lang] = langPending
      total += langPending.length
    }
  }

  return { pending, review, stats: { total } }
}

function printReport(result, targetLangs) {
  const { pending, stats } = result
  if (stats.total === 0) {
    console.log(`${C.green}✅ [i18n AI 翻译流水线] 无 pending,所有语言 parity + 翻译完整${C.reset}`)
    return
  }

  console.log(`${C.yellow}⚠️ [i18n AI 翻译流水线] 检测到 ${stats.total} 处 pending:${C.reset}`)
  console.log('')

  for (const lang of targetLangs) {
    if (!pending[lang]) continue
    const items = pending[lang]
    const byType = {}
    for (const it of items) {
      byType[it.type] = (byType[it.type] || 0) + 1
    }
    const typeSummary = Object.entries(byType)
      .map(([t, c]) => `${t}=${c}`)
      .join(' ')
    console.log(`${C.cyan}[${lang}]${C.reset} ${items.length} 处 (${typeSummary})`)

    const SHOW_LIMIT = 8
    for (const it of items.slice(0, SHOW_LIMIT)) {
      const typeLabel =
        it.type === 'missing'
          ? `${C.red}missing${C.reset}`
          : it.type === 'untranslated'
            ? `${C.magenta}untranslated${C.reset}`
            : `${C.yellow}asciiFallback${C.reset}`
      const sourcePreview = String(it.sourceValue).slice(0, 60)
      console.log(`  ${typeLabel} ${C.dim}${it.key}${C.reset}`)
      console.log(`    ${C.dim}zh-CN: "${sourcePreview}"${C.reset}`)
      if (it.currentValue && it.type !== 'missing') {
        console.log(`    ${C.dim}${lang}: "${String(it.currentValue).slice(0, 60)}"${C.reset}`)
      }
    }
    if (items.length > SHOW_LIMIT) {
      console.log(`  ${C.dim}... 还有 ${items.length - SHOW_LIMIT} 处${C.reset}`)
    }
    console.log('')
  }

  // 显示 review 总数(asciiFallback,可选审核)
  const reviewCount = Object.values(result.review || {}).reduce((s, arr) => s + arr.length, 0)
  if (reviewCount > 0) {
    console.log(`${C.dim}[可选审核] asciiFallback ${reviewCount} 处(品牌名/技术术语用英文,大多有意为之,详见 reviewAscii 字段)${C.reset}`)
    console.log('')
  }

  console.log(`${C.bold}下一步(AI agent 自主执行,零用户算力):${C.reset}`)
  console.log(`  1. 读取 ${C.cyan}.trae-cn/tmp/i18n-pending.json${C.reset}`)
  console.log(`  2. AI agent 自己翻译(参考 scripts/brand-glossary.json 保证品牌名一致)`)
  console.log(`  3. 写入 ${C.cyan}.trae-cn/tmp/i18n-translations.json${C.reset}`)
  console.log(`  4. 运行 ${C.cyan}node scripts/i18n-apply.mjs${C.reset} 应用翻译`)
  console.log(`  5. 运行 ${C.cyan}node scripts/check-i18n-keys.mjs${C.reset} 验证 parity`)
}

function main() {
  const messages = loadMessages()
  const langNames = Object.keys(messages).sort()

  if (langNames.length === 0 || !messages[BASE_LANG]) {
    if (!isQuiet) {
      console.log(`${C.yellow}[i18n AI 翻译流水线] messages 文件不存在或不完整,跳过${C.reset}`)
    }
    process.exit(0)
  }

  // staged 模式:仅当 zh-CN.json 在暂存区时才检测(避免多 agent 并行误伤)
  // 设计:只有改 zh-CN.json(基准语言)的 agent 才需要跑翻译流水线
  // 其他 agent 改 target locale 文件时不会触发阻塞
  if (isStaged) {
    const stagedLocales = getStagedLocales()
    if (!stagedLocales.includes(BASE_LANG)) {
      if (!isQuiet) {
        console.log(`${C.green}[i18n AI 翻译流水线] 暂存区未改动 ${BASE_LANG}.json,跳过(仅 zh-CN 改动时触发)${C.reset}`)
      }
      process.exit(0)
    }
  }

  const glossary = loadGlossary()
  // 构建 glossary values 白名单(品牌/字体/术语的 canonical 英文名)
  // 用于 isAsciiFallback 过滤有意为之的英文品牌名/技术术语
  const glossaryValues = new Set()
  if (glossary) {
    for (const category of ['brands', 'fonts', 'terms']) {
      if (glossary[category]) {
        for (const v of Object.values(glossary[category])) glossaryValues.add(v)
      }
    }
  }
  const result = detectPending(messages, glossaryValues)

  const output = {
    generatedAt: new Date().toISOString(),
    baseLang: BASE_LANG,
    targetLangs: TARGET_LANGS,
    stats: {
      ...result.stats,
      reviewCount: Object.values(result.review).reduce((s, arr) => s + arr.length, 0),
    },
    pending: result.pending,
    reviewAscii: result.review,
    glossary: glossary
      ? {
          brands: glossary.brands,
          fonts: glossary.fonts,
          terms: glossary.terms,
        }
      : null,
    workflow: {
      description: 'AI agent 自主翻译流水线(零 LLM API 调用,翻译能力由 AI 编程 agent 自带)',
      steps: [
        '1. 读取本文件 .trae-cn/tmp/i18n-pending.json',
        '2. AI agent 自己翻译(结合 glossary 字段保证品牌名/术语一致)',
        '3. 写入 .trae-cn/tmp/i18n-translations.json (结构: { translations: { [lang]: { [key]: translatedValue } } })',
        '4. 运行 node scripts/i18n-apply.mjs 应用翻译',
        '5. 运行 node scripts/check-i18n-keys.mjs 验证 parity',
      ],
      translationRules: [
        '品牌名优先用 glossary.brands 中的 canonical 英文名(如 智谱清言→Zhipu AI)',
        '字体名优先用 glossary.fonts 中的英文系统名(如 宋体→SimSun)',
        '技术术语优先用 glossary.terms 中的英文国际通用词(如 物联网→IoT)',
        '占位符 {var} / {{var}} 必须原样保留',
        'zh-TW 必须用繁体字形(opencc cn→tw),禁止简体字残留',
        'ko 禁止中文残留,ja 日文汉字词允许(如 登録/確認)',
        'en 禁止中文残留,禁止破碎机翻英文(如 AgentDevPlatform)',
      ],
    },
  }

  // 确保 .trae-cn/tmp/ 存在
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true })
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8')

  if (!isQuiet) {
    printReport(result, TARGET_LANGS)
    console.log('')
    console.log(`${C.dim}清单已写入: ${path.relative(ROOT, OUTPUT_FILE)}${C.reset}`)
  }

  process.exit(result.stats.total > 0 ? 1 : 0)
}

main()
