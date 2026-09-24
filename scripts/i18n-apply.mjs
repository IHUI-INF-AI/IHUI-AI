#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * i18n AI 翻译流水线 - 翻译结果应用器(零 LLM API 调用)。
 *
 * 设计理念(2026-07-24 立,与 i18n-diff.mjs 配套):
 *   - 本脚本只做"读取 AI agent 写入的翻译结果 + 应用到 locale 文件"
 *   - 翻译能力由 AI 编程 agent 自带,不调用任何 LLM API
 *   - 应用后自动保持 key 顺序与 zh-CN 基准一致
 *
 * 输入: .ihui-agent/tmp/i18n-translations.json
 *   {
 *     "translatedAt": "2026-07-24T...",
 *     "translatedBy": "AI agent (claude/glm/gpt)",
 *     "target": "web",                         // 2026-09-25 起:从 pending 清单原样抄,用于写前对账
 *     "messagesDir": "packages/i18n/messages/web",  // 同上
 *     "translations": {
 *       "en": { "skills.market.title": "Skills Market", ... },
 *       "ja": { ... },
 *       "ko": { ... },
 *       "zh-TW": { ... }
 *     }
 *   }
 *
 * 用法:
 *   node scripts/i18n-apply.mjs                  # 应用默认路径的翻译结果(= web 端)
 *   node scripts/i18n-apply.mjs --input <path>   # 自定义翻译结果路径
 *   node scripts/i18n-apply.mjs --check          # 只校验 parity,不写入
 *   node scripts/i18n-apply.mjs --target=<端>    # 端名须与 packages/i18n/messages/ 目录名逐字相同:
 *                                                #   web / extension / miniapp-taro / shared /
 *                                                #   mobile-rn / cli / api(全部读写 .json)
 *
 * 两道防写错端的机制(2026-09-25 立,此前 `--target=mobile-rn` 会静默改写 **web** 的语言包):
 *   1. 未知 / 拼错的 --target → exit 2 并点名错误值 + 列出可用端,不再回落到 web。
 *   2. 写前对账:翻译结果若自带 target / messagesDir(由 i18n-diff 产出),必须与 --target
 *      解析出的目录一致,不一致 → exit 2 且**一个字节都不写**。输入没带这两个字段时无法对账,
 *      会如实打一条警告说明"本轮无对账依据",而不是把"没证据"当成"对上了"。
 *
 * 退出码:
 *   0 = 成功应用 / check 通过
 *   1 = 翻译结果不完整(仍有 pending) 或应用失败
 *   2 = 用法错误(未知 --target / 目录不存在 / 输入声明的端与 --target 不符)
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const isCheck = process.argv.includes('--check')
const inputIdx = process.argv.indexOf('--input')
const customInput = inputIdx >= 0 ? process.argv[inputIdx + 1] : null
const targetArg = process.argv.find((a) => a.startsWith('--target='))
const TARGET = targetArg ? targetArg.split('=')[1] : 'web'
const TARGET_IS_EXPLICIT = targetArg !== undefined

// target → 目录 + 文件扩展名(与 i18n-diff.mjs 保持一致 —— 两份表必须同步改,漂移即错端写入)
// 2026-07-25 i18n 单一来源:web/miniapp-taro 翻译迁移到 packages/i18n/messages/<platform>/
// 2026-09-25 补 mobile-rn / cli / api:packages/i18n/messages/ 下实测有 7 个端目录,本表此前只
//   登记 4 个,而未知 --target 会静默回落到 web ⇒ `--target=mobile-rn` 实际改写的是
//   packages/i18n/messages/web/*.json —— 操作员以为在补 App 端翻译,盘上被动的是 web。
//   三端均为 zh-CN/en/ja/ko/zh-TW 五个 .json,与 web 同构(ext 一致,无需特殊解析)。
//   api 一并登记的理由见 i18n-diff.mjs 的 TARGET_CONFIG 注释(check-i18n-messages-exist 已把
//   它列为第 7 个语言包端;它暂无运行时消费方与 parity 守门,登记≠验收)。
const TARGET_CONFIG = {
  web: { dir: 'packages/i18n/messages/web', ext: '.json' },
  extension: { dir: 'packages/i18n/messages/extension', ext: '.json' },
  'miniapp-taro': { dir: 'packages/i18n/messages/miniapp-taro', ext: '.json' },
  shared: { dir: 'packages/i18n/messages/shared', ext: '.json' },
  'mobile-rn': { dir: 'packages/i18n/messages/mobile-rn', ext: '.json' },
  cli: { dir: 'packages/i18n/messages/cli', ext: '.json' },
  api: { dir: 'packages/i18n/messages/api', ext: '.json' },
}
const VALID_TARGETS = Object.keys(TARGET_CONFIG)

/** 目录串归一(斜杠方向 / 前导 ./ / 尾部斜杠),供"输入声明的目录 vs 本次解析的目录"对账用 */
function normalizeDir(p) {
  return String(p)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '')
}

/**
 * 解析 --target。**绝不回落到 web**(2026-09-25 的修复本体)。
 *
 * 两类判死,都发生在读任何语言包、写任何文件之前:
 *   1. 值不在 TARGET_CONFIG 里(`mobile_rn`、`Miniapp-Taro`、空值等)。
 *   2. 目标目录在磁盘上不存在。
 *
 * 与 i18n-diff.mjs 的一处**有意差异**:diff 对"未显式传 --target 且目录不存在"保留旧的
 * 优雅跳过(scripts/tests/i18n-diff.test.mjs 钉死了那条 exit 0)。本脚本做不到 —— 它无论如何
 * 都要从该目录读 zh-CN 基准并往同目录写回,目录不存在就没有可以继续的语义,因此一律判死。
 *
 * @param {string} raw      --target= 的原始值
 * @param {string} root     仓库根(沿用本脚本既有的 cwd 口径)
 * @param {boolean} explicit 调用方是否显式传了 --target(仅用于把话说准)
 * @param {(msg: string[]) => void} onFatal 判死出口
 * @returns {{target: string, cfg: {dir: string, ext: string}}}
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
      `            就把"A 端的翻译"整份改写进"B 端的语言包",而输出看起来一切正常。`,
    ])
  }
  if (!fs.existsSync(path.join(root, cfg.dir))) {
    onFatal([
      `❌ [i18n] --target=${JSON.stringify(given)}${explicit ? '' : '(默认)'} 的语言包目录不存在: ${cfg.dir}`,
      `   可用目标: ${VALID_TARGETS.join(' / ')}`,
      `   已拒绝执行(未读任何语言包、未写任何文件)。本脚本必须从该目录读 zh-CN 基准并写回同目录。`,
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

/**
 * 写前对账:翻译结果"implied 的端"必须与 --target 解析出的目录一致。
 *
 * 为什么需要它:`--target` 只能防住打错,**防不住拿错了文件** ——
 * .ihui-agent/tmp/i18n-translations.json 是全端共用同一个路径的单一产物,
 * 上一轮为 web 生成的翻译躺在那里,这一轮 `--target=mobile-rn` 一跑就把 web 的
 * 文案写进 mobile-rn。i18n-diff 现在会在 pending 清单里写下 target/messagesDir,
 * 供 agent 原样抄进翻译结果;本函数据此在写之前中止而不是静默合并。
 *
 * @returns {string[]} 问题清单(空 = 可对账且一致,或输入未声明可对账字段)
 */
function targetMismatchProblems(data, target, cfg) {
  const problems = []
  const declaredTarget = typeof data.target === 'string' ? data.target : null
  const declaredDir = typeof data.messagesDir === 'string' ? data.messagesDir : null

  if (declaredTarget !== null && !TARGET_CONFIG[declaredTarget]) {
    problems.push(
      `翻译结果自带的 target=${JSON.stringify(declaredTarget)} 不是受支持的端(可用: ${VALID_TARGETS.join(' / ')})`,
    )
  } else if (declaredTarget !== null && declaredTarget !== target) {
    problems.push(
      `翻译结果是为 target=${declaredTarget} 产出的,本次 --target=${target} —— 两端不同`,
    )
  }
  if (declaredDir !== null && normalizeDir(declaredDir) !== normalizeDir(cfg.dir)) {
    problems.push(
      `翻译结果自带 messagesDir=${declaredDir},而本次解析出的目录是 ${cfg.dir} —— 不是同一份语言包`,
    )
  }
  return problems
}

const MESSAGES_DIR = path.join(ROOT, TARGET_CFG.dir)
const TMP_DIR = path.join(ROOT, '.ihui-agent/tmp')
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

// 2026-07-25 miniapp-taro 迁移到 .json 后,TS 解析/序列化辅助函数已移除

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
      // 2026-07-28 升级: 支持非字符串值(数组/对象)
      // 背景: pricingPage.testimonials.items 是 6 元素对象数组、search.quickSuggestions
      //       是 8 元素数组、newsletter.benefits.items 是 5 元素对象数组。
      //       旧逻辑 typeof value !== 'string' 直接跳过,导致 10 个键无法 apply,
      //       必须手动 fs.writeFileSync 补全(P0 协作风险)。
      // collectLeafEntries 已将数组/对象当作 leaf 不递归,这里直接 setByPath 写入。
      if (value === undefined || value === null) {
        errors.push(`[${lang}] ${key}: 翻译值为 ${typeof value},跳过`)
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

  // ── 写前对账(2026-09-25):翻译结果声明的端必须与 --target 解析出的目录一致 ──
  // 放在读语言包之前:一旦不符,本轮既不读也不写,盘上零变化。
  const mismatches = targetMismatchProblems(translationData, TARGET, TARGET_CFG)
  if (mismatches.length > 0) {
    console.error(`${C.red}❌ [i18n-apply] 拒绝写入:输入翻译与 --target 不是同一端(极可能拿错了输入文件)${C.reset}`)
    for (const p of mismatches) console.error(`   · ${p}`)
    console.error(`   本次 --target=${TARGET} → ${TARGET_CFG.dir}`)
    console.error(`${C.red}   已拒绝执行:未读任何语言包、未写任何文件。${C.reset}`)
    console.error(`   正确做法:node scripts/i18n-diff.mjs --target=${TARGET} 重新生成本端清单,`)
    console.error(`            并把 pending 清单里的 target / messagesDir 原样抄进翻译结果。`)
    process.exit(2)
  }
  if (typeof translationData.target !== 'string' && typeof translationData.messagesDir !== 'string') {
    // 没有可对比的声明 ⇒ 如实说明"本轮无对账依据",而不是把没证据当成对上了。
    console.warn(
      `${C.yellow}⚠️ 翻译结果未声明 target / messagesDir ⇒ 写前对账无从进行,写入目录仅由 --target=${TARGET} 单侧决定${C.reset}`,
    )
  }

  const messages = {}
  for (const entry of fs.readdirSync(MESSAGES_DIR)) {
    if (!entry.endsWith(MESSAGE_EXT)) continue
    try {
      const filePath = path.join(MESSAGES_DIR, entry)
      // 2026-07-25 miniapp-taro 迁移到 .json,所有 target 统一 JSON 解析
      messages[entry.replace(MESSAGE_EXT, '')] = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
      // 解析失败跳过
    }
  }

  if (!messages[BASE_LANG]) {
    console.error(`${C.red}❌ 基准语言 ${BASE_LANG}${MESSAGE_EXT} 不存在或解析失败${C.reset}`)
    process.exit(1)
  }

  console.log(`${C.bold}[i18n AI 翻译应用]${C.reset} ${isCheck ? '校验模式' : '应用模式'}`)
  // 目标端一律先自证:即将被写的目录必须出现在输出里,否则"写对了"和"写错了端"同形。
  console.log(
    `${C.cyan}目标端:${C.reset} ${TARGET} → ${TARGET_CFG.dir}(${isCheck ? '只校验不写' : '写回目标'})`,
  )
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
    // 2026-07-25 miniapp-taro 迁移到 .json,所有 target 统一 JSON 写入
    fs.writeFileSync(file, JSON.stringify(messages[lang], null, 2) + '\n', 'utf8')
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
    console.error(`   ${C.dim}建议: 重新跑 node scripts/i18n-diff.mjs --target=${TARGET} 获取最新 pending 清单${C.reset}`)
    process.exit(1)
  }

  console.log(`${C.green}✅ parity 校验通过${C.reset}`)
  console.log('')

  // 异常大 diff 检测(2026-07-26 工程债 #11):i18n-apply 不应触发 >100 行改动
  // 原因:reorderToBase 重排 5 语言时,如果 base 顺序变更,4 语言整段 reorder 会产生大量 diff
  // 仅警告,不阻断;--strict 标志可升级为 blocking
  try {
    const diffStat = execSync('git diff --stat -- packages/i18n/messages/', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    const totalLine = diffStat.split('\n').slice(-2, -1)[0] || ''
    const m = totalLine.match(/(\d+)\s+insertions?\(\+\)/)
    const insertions = m ? parseInt(m[1], 10) : 0
    if (insertions > 100) {
      console.warn(`${C.yellow}⚠️ i18n apply 触发 ${insertions} 行 insertions(>100 阈值),可能 reorderToBase 重排了 5 语言${C.reset}`)
      console.warn(`${C.yellow}   建议:git diff --stat 核对是否仅预期小 diff(只新增翻译 key 即可,不应大量 reorder)${C.reset}`)
    }
  } catch {
    // git 不可用时静默跳过
  }

  console.log(`${C.bold}下一步:${C.reset}`)
  console.log(`  1. ${C.cyan}node scripts/check-i18n-keys.mjs --target=${TARGET}${C.reset} 完整守门`)
  console.log(`  2. ${C.cyan}node scripts/scan-i18n-zh-residue.mjs ko --staged${C.reset} 中文残留检测`)
  console.log(`  3. ${C.cyan}node scripts/scan-i18n-zh-residue.mjs zh-TW --staged${C.reset} 简体字残留检测`)

  process.exit(0)
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
