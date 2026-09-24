#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * i18n AI 翻译流水线 - 差异检测器(零 LLM API 调用)。
 *
 * 设计理念(2026-07-24 立,用户规则:不耗费自己算力,翻译由 AI agent 在开发流程中完成):
 *   - 本脚本只做"检测 + 输出清单",不调用任何 LLM API
 *   - AI agent 读取输出的 .ihui-agent/tmp/i18n-pending.json,自己翻译,写入 i18n-translations.json
 *   - 再由 scripts/i18n-apply.mjs 应用翻译结果到 locale 文件
 *   - 整个流水线对用户算力零消耗,翻译能力由 AI 编程 agent 自带
 *
 * 检测维度(3 类):
 *   1. missing    - base-only key(zh-CN 有但目标语言缺失)
 *   2. untranslated - 值 === zh-CN 原值(ko/ja/en 含汉字却未翻译)
 *   3. asciiFallback - 值 === en 值且纯 ASCII(ko/ja/zh-TW 用 en 兜底未翻译)
 *
 * 输出:
 *   - .ihui-agent/tmp/i18n-pending.json (机器可读,AI agent 消费)
 *   - stdout (人类可读报告)
 *
 * 用法:
 *   node scripts/i18n-diff.mjs                  # 全量检测
 *   node scripts/i18n-diff.mjs --staged         # 仅检测 staged 涉及的 locale 文件
 *   node scripts/i18n-diff.mjs --output <path>  # 自定义输出路径
 *   node scripts/i18n-diff.mjs --quiet          # 只输出 JSON,不打印报告
 *   node scripts/i18n-diff.mjs --target=web           # packages/i18n/messages/web/*.json(默认)
 *   node scripts/i18n-diff.mjs --target=extension     # packages/i18n/messages/extension/*.json
 *   node scripts/i18n-diff.mjs --target=miniapp-taro  # packages/i18n/messages/miniapp-taro/*.json
 *   node scripts/i18n-diff.mjs --target=shared        # packages/i18n/messages/shared/*.json
 *   node scripts/i18n-diff.mjs --target=mobile-rn     # packages/i18n/messages/mobile-rn/*.json
 *   node scripts/i18n-diff.mjs --target=cli           # packages/i18n/messages/cli/*.json
 *   node scripts/i18n-diff.mjs --target=api           # packages/i18n/messages/api/*.json
 *
 * --target 取值必须与 packages/i18n/messages/ 下的目录名逐字相同。
 * 2026-09-25 修:未知 / 拼错的 --target(如 `mobile_rn`、`Miniapp-Taro`)过去会**静默回落到 web**,
 * 于是"以为在检测 mobile-rn"实际在读写 web 语言包,且没有任何提示。现一律 exit 2 并点名错误值。
 *
 * 退出码:
 *   0 = 无 pending
 *   1 = 有 pending(用于守门,warn-only 场景不阻塞)
 *   2 = 用法错误(未知 --target / --target 指向的目录不存在)
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
// 调用方是否**显式**传了 --target —— 决定"目录不存在"是否判死(见 resolveTarget 内注释)
const TARGET_IS_EXPLICIT = targetArg !== undefined

// target → 目录 + 文件扩展名 + staged 前缀
// 2026-07-25 i18n 单一来源:web/miniapp-taro 翻译迁移到 packages/i18n/messages/<platform>/
// 2026-09-25 补 mobile-rn / cli / api:packages/i18n/messages/ 下实测有 7 个端目录,本表此前
//   只登记 4 个 ⇒ 另外 3 端**根本接不进 §19 强制的翻译流水线**,mobile-rn 的 5 语言 parity
//   因此无人能补、静默劣化(2026-09-25 修 HomeScreen 9 个裸 key 之前的成因即此)。
//   三端目录内容均为 zh-CN/en/ja/ko/zh-TW 五个 .json,与 web 同构,故 ext 一致、无需特殊解析。
//   api 也登记的决定性依据(实测,非猜测):scripts/check-i18n-messages-exist.mjs 的 ENDPOINTS
//   已把 packages/i18n/messages/api 列为第 7 个"必须存在且可解析"的语言包端 —— 不登记它,
//   `--target=api` 就在本脚本这里成为下一个静默黑洞。如实登记它的**不完整**处:apps/api 目前
//   不加载 @ihui/i18n(预算告警模板在 budget-alert-service.ts 内联中文,注释自述这份 JSON 是
//   "翻译单一来源…供未来 i18n-loader 接入"),且 scripts/check-i18n-keys.mjs 无 api 目标
//   ⇒ api 端流水线只到"检测 + 写回",parity 守门仍不覆盖它;登记不等于假装已验收。
const TARGET_CONFIG = {
  web: {
    dir: 'packages/i18n/messages/web',
    ext: '.json',
    stagedPrefix: 'packages/i18n/messages/web/',
  },
  extension: {
    dir: 'packages/i18n/messages/extension',
    ext: '.json',
    stagedPrefix: 'packages/i18n/messages/extension/',
  },
  'miniapp-taro': {
    dir: 'packages/i18n/messages/miniapp-taro',
    ext: '.json',
    stagedPrefix: 'packages/i18n/messages/miniapp-taro/',
  },
  shared: {
    dir: 'packages/i18n/messages/shared',
    ext: '.json',
    stagedPrefix: 'packages/i18n/messages/shared/',
  },
  'mobile-rn': {
    dir: 'packages/i18n/messages/mobile-rn',
    ext: '.json',
    stagedPrefix: 'packages/i18n/messages/mobile-rn/',
  },
  cli: {
    dir: 'packages/i18n/messages/cli',
    ext: '.json',
    stagedPrefix: 'packages/i18n/messages/cli/',
  },
  api: {
    dir: 'packages/i18n/messages/api',
    ext: '.json',
    stagedPrefix: 'packages/i18n/messages/api/',
  },
}
const VALID_TARGETS = Object.keys(TARGET_CONFIG)

/**
 * 解析 --target。**绝不回落到 web**(2026-09-25 的修复本体)。
 *
 * 两类判死,均为 exit 2(用法错误),且都在读/写任何文件之前发生:
 *   1. 值不在 TARGET_CONFIG 里 —— 含 `mobile_rn`、`Miniapp-Taro`、空值这类拼错。
 *      旧写法 `TARGET_CONFIG[TARGET] || TARGET_CONFIG.web` 会把它们统统当成 web,
 *      表现为"报告全绿而检测的是另一个端的语言包"(diff 侧)或"改写错端语言包"(apply 侧)。
 *   2. 显式 --target 指向的目录在磁盘上不存在 —— 目录名打错/端尚未落地,同样不能当"没有差异"。
 *
 * 判死 2 只对**显式** --target 生效:不带 --target 走默认 web,而 scripts/tests/i18n-diff.test.mjs
 * 钉死了"messages 目录不存在 → exit 0 + 跳过"(空仓库 / 部分 checkout 的合法形态)。
 * 这里保留该行为是有意的非对称:调用方点名了一个端,沉默就是撒谎;没点名而目录缺失,如实报"跳过"。
 *
 * @param {string} raw      --target= 的原始值
 * @param {string} root     仓库根(沿用本脚本既有的 cwd 口径)
 * @param {boolean} explicit 调用方是否显式传了 --target
 * @param {(msg: string[]) => void} onFatal 判死出口(CLI 传 process.exit 包装,便于子进程断言)
 * @returns {{target: string, cfg: {dir: string, ext: string, stagedPrefix: string}}}
 */
function resolveTarget(raw, root, explicit, onFatal) {
  const given = raw === undefined || raw === null ? '' : String(raw)
  const cfg = TARGET_CONFIG[given]
  if (!cfg) {
    onFatal([
      `❌ [i18n] --target=${JSON.stringify(given)} 不是受支持的端,已拒绝执行(未读任何语言包、未写任何文件)。`,
      `   可用目标(须与 packages/i18n/messages/ 下的目录名逐字相同): ${VALID_TARGETS.join(' / ')}`,
      `   拼写陷阱:连字符不是下划线、大小写敏感 —— "mobile_rn"、"Miniapp-Taro" 都会被拒。`,
      `   为什么不再容忍:此前未知 --target 会静默按 web 处理,于是打错一个字母`,
      `            就把"A 端的翻译"写进了"B 端的语言包",而报告看起来一切正常。`,
    ])
  }
  if (explicit && !fs.existsSync(path.join(root, cfg.dir))) {
    onFatal([
      `❌ [i18n] --target=${JSON.stringify(given)} 的语言包目录不存在: ${cfg.dir}`,
      `   可用目标: ${VALID_TARGETS.join(' / ')}`,
      `   已拒绝执行(未读任何语言包、未写任何文件)。`,
    ])
  }
  return { target: given, cfg }
}

/** CLI 出口:打印到 stderr 并以用法错误码退出(exit 2,与头注一致)。 */
function fatalUsage(lines) {
  for (const line of lines) console.error(line)
  process.exit(2)
}

const TARGET_CFG = resolveTarget(TARGET, ROOT, TARGET_IS_EXPLICIT, fatalUsage).cfg

const MESSAGES_DIR = path.join(ROOT, TARGET_CFG.dir)
const TMP_DIR = path.join(ROOT, '.ihui-agent/tmp')
const DEFAULT_OUTPUT = path.join(TMP_DIR, 'i18n-pending.json')
const OUTPUT_FILE = customOutput || DEFAULT_OUTPUT

const BASE_LANG = 'zh-CN'
const TARGET_LANGS = ['en', 'ja', 'ko', 'zh-TW']
const STAGED_MESSAGES_PREFIX = TARGET_CFG.stagedPrefix
const MESSAGE_EXT = TARGET_CFG.ext

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

// 2026-07-25 miniapp-taro 迁移到 .json 后,TS 解析辅助函数已移除

// 2026-09-07 根治:--staged 模式下数据源必须是暂存区 blob,而非工作区文件。
// 此前 readFileSync 直接读工作区:并行会话未暂存的 zh-CN WIP 键(其他语言尚未补译)
// 会混入 pending 检测,阻塞无关 commit。与 check-i18n-keys.mjs 同款修复。
const stagedI18nFiles = (() => {
  if (!isStaged) return null
  try {
    const out = execSync(`git diff --cached --name-only -- "${TARGET_CFG.dir}"`, {
      cwd: ROOT,
      encoding: 'utf8',
      windowsHide: true,
    })
    return new Set(out.split('\n').filter(Boolean))
  } catch {
    return null
  }
})()

function readMessageJson(absPath) {
  const repoRel = absPath.replaceAll('\\', '/').replace(/^.*?packages\/i18n\//, 'packages/i18n/')
  if (stagedI18nFiles && stagedI18nFiles.has(repoRel)) {
    const blob = execSync(`git show ":${repoRel}"`, {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    })
    return JSON.parse(blob)
  }
  return JSON.parse(fs.readFileSync(absPath, 'utf8'))
}

function loadMessages() {
  const langs = {}
  if (!fs.existsSync(MESSAGES_DIR)) return langs
  for (const entry of fs.readdirSync(MESSAGES_DIR)) {
    if (!entry.endsWith(MESSAGE_EXT)) continue
    try {
      const filePath = path.join(MESSAGES_DIR, entry)
      // 2026-07-25 miniapp-taro 迁移到 .json,所有 target 统一 JSON 解析
      // 2026-09-07:staged 模式改读暂存区 blob(见 readMessageJson)
      langs[entry.replace(MESSAGE_EXT, '')] = readMessageJson(filePath)
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
      windowsHide: true,
    })
    const staged = output.split('\n').filter(Boolean)
    const locales = new Set()
    for (const f of staged) {
      if (f.startsWith(STAGED_MESSAGES_PREFIX) && f.endsWith(MESSAGE_EXT)) {
        const locale = path.basename(f, MESSAGE_EXT)
        locales.add(locale)
      }
    }
    return [...locales]
  } catch {
    return []
  }
}

// 有意同值 key 白名单:语言切换页语言名在任何 UI 语言下都显示为该语言原生文字
// (繁體中文/日本語 在 en/ko 下也是 "繁體中文"/"日本語",非未翻译)
const INTENTIONAL_SAME_VALUE_KEYS = new Set([
  'settingLanguage.d1', // 繁體中文(原生名,所有语言同值)
  'settingLanguage.d2', // 日本語(原生名,所有语言同值)
])

// 判断是否为"未翻译"(值 === zh-CN 原值)
// 对 zh-TW 跳过:简繁字形可能同形(如"登录"简繁同形),会海量误报
// 对 ja 跳过:日文汉字词与中文同形是合法的(如 保存/通知/回答),untranslated 海量误报
//   ja 的简体字残留由 scan-i18n-zh-residue.mjs warnOnly 模式负责
// 对 ko/en:值 === zh-CN value 且 value 含汉字 → 未翻译
function isUntranslated(lang, langValue, baseValue, key) {
  if (lang === 'zh-TW' || lang === 'ja') return false
  if (key && INTENTIONAL_SAME_VALUE_KEYS.has(key)) return false
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
      if (isUntranslated(lang, langValue, baseValue, key)) {
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
    console.log(
      `${C.dim}[可选审核] asciiFallback ${reviewCount} 处(品牌名/技术术语用英文,大多有意为之,详见 reviewAscii 字段)${C.reset}`,
    )
    console.log('')
  }

  console.log(`${C.bold}下一步(AI agent 自主执行,零用户算力):${C.reset}`)
  console.log(`  1. 读取 ${C.cyan}.ihui-agent/tmp/i18n-pending.json${C.reset}(本清单 target=${TARGET})`)
  console.log(`  2. AI agent 自己翻译(参考 scripts/brand-glossary.json 保证品牌名一致)`)
  console.log(`  3. 写入 ${C.cyan}.ihui-agent/tmp/i18n-translations.json${C.reset}`)
  console.log(
    `     并把本清单的 ${C.cyan}target / messagesDir${C.reset} 两个字段原样抄进去 ——`,
  )
  console.log(`     i18n-apply 用它做"写的就是刚检测的那一端"对账,不一致直接拒写`)
  console.log(`  4. 运行 ${C.cyan}node scripts/i18n-apply.mjs --target=${TARGET}${C.reset} 应用翻译`)
  console.log(
    `  5. 运行 ${C.cyan}node scripts/check-i18n-keys.mjs --target=${TARGET}${C.reset} 验证 parity`,
  )
  console.log(
    `     ${C.dim}(api 端尚无 parity 守门覆盖,原因见本文件 TARGET_CONFIG 注释)${C.reset}`,
  )
}

function main() {
  const messages = loadMessages()
  const langNames = Object.keys(messages).sort()

  // 先自证"这一轮看的是哪一端的语言包"。exit 0 的"无 pending"在端搞错时输出完全同形,
  // 这正是本次修复要消灭的形态 —— 报告必须自带目标路径,人能一眼对账。
  if (!isQuiet) {
    console.log(
      `${C.cyan}[i18n 流水线目标]${C.reset} ${TARGET} → ${TARGET_CFG.dir}` +
        `(${langNames.length} 个 locale:${langNames.join(', ') || '无'})`,
    )
    console.log('')
  }

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
        console.log(
          `${C.green}[i18n AI 翻译流水线] 暂存区未改动 ${BASE_LANG}${MESSAGE_EXT},跳过(仅 zh-CN 改动时触发)${C.reset}`,
        )
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
    // 2026-09-25:清单必须自证"是哪一端产出的"。i18n-apply 拿这两个字段做写前对账,
    // 从而堵死"检测了 A 端、却把翻译写进 B 端语言包"这一类静默错端写入。
    target: TARGET,
    messagesDir: TARGET_CFG.dir,
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
        '1. 读取本文件 .ihui-agent/tmp/i18n-pending.json',
        '2. AI agent 自己翻译(结合 glossary 字段保证品牌名/术语一致)',
        `3. 写入 .ihui-agent/tmp/i18n-translations.json,结构 { target: "${TARGET}", messagesDir: "${TARGET_CFG.dir}", translations: { [lang]: { [key]: translatedValue } } } —— target/messagesDir 从本清单原样抄过去,i18n-apply 会据此拒写错端`,
        `4. 运行 node scripts/i18n-apply.mjs --target=${TARGET} 应用翻译`,
        `5. 运行 node scripts/check-i18n-keys.mjs --target=${TARGET} 验证 parity(api 端尚无该守门,详见本脚本 TARGET_CONFIG 注释)`,
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

  // 确保 .ihui-agent/tmp/ 存在
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
