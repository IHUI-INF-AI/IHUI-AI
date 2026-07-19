#!/usr/bin/env node
/**
 * 应用 brand-glossary.json 中的品牌/字体/术语 canonical 映射到 i18n 文件。
 *
 * 默认策略：
 *   - en.json: 直接替换中文 token 为 canonical 英文名（如 "智谱清言" → "Zhipu AI"）
 *   - ko.json: 韩语 + canonical 英文名混合（品牌名用英文，普通文本保留韩语）
 *   - ja.json: 日语 + canonical 英文名混合
 *   - zh-CN.json: 跳过（基准语言，不替换）
 *   - zh-TW.json: 默认跳过（zh-TW 是繁体中文，应保留繁体品牌名而非英文化；
 *                 如需替换用 --locale=zh-TW 显式执行，但需人工核对 dry-run）
 *
 * 安全限制：
 *   - 只处理 key 中含中文字符的映射条目，跳过纯英文 key（如 "Moonshot"→"Moonshot AI"）
 *     避免把 en.json 中合法英文 "Moonshot" 错误替换
 *   - 路径/扩展名保护：value 是文件路径或 URL 时不替换（避免破坏 /images/svg/大模型.svg）
 *   - 替换是字符串字面量替换（split/join），不解析 JSON
 *
 * 替换粒度：按 token 替换，不动整体 value 结构。
 *   例如 value = "欢迎使用智谱清言，由智谱AI开发"
 *   → "欢迎使用 Zhipu AI，由 Zhipu AI 开发"
 *
 * 用法：
 *   node scripts/apply-brand-glossary.mjs --dry-run    # 仅打印将替换的 key + 旧值 + 新值
 *   node scripts/apply-brand-glossary.mjs              # 实际写回 3 个语言文件(en/ko/ja)
 *   node scripts/apply-brand-glossary.mjs --locale=en  # 仅处理 en.json
 *   node scripts/apply-brand-glossary.mjs --locale=zh-TW --dry-run  # zh-TW 需显式指定 + 人工核对
 */
import fs from 'node:fs'
import path from 'node:path'
import * as OpenCC from 'opencc-js'

const DIR = path.resolve('apps/web/messages')
const GLOSSARY = JSON.parse(fs.readFileSync(path.resolve('scripts/brand-glossary.json'), 'utf8'))

// 合并 3 类映射(brand/font/term)为单一替换表
const ALL_REPLACEMENTS = {
  ...GLOSSARY.brands,
  ...GLOSSARY.fonts,
  ...GLOSSARY.terms,
}

// 安全过滤：只保留 key 中含中文字符的映射，跳过纯英文 key（避免误改合法英文）
const CHINESE_RE = /[\u4e00-\u9fff]/
const REPLACEMENTS = Object.fromEntries(
  Object.entries(ALL_REPLACEMENTS).filter(([k]) => CHINESE_RE.test(k))
)

// zh-TW 专用：只替换 brands + fonts（保留中文术语的繁体字形，避免破坏中文表达）
// 例如 "人工智能" 在 zh-TW 中应保留为繁体"人工智能"，不应改为 "AI"
// 例如 "大模型" 在 zh-TW 中应保留为繁体"大模型"，不应改为 "LLM"
const ZH_TW_REPLACEMENTS = Object.fromEntries(
  Object.entries({ ...GLOSSARY.brands, ...GLOSSARY.fonts }).filter(([k]) => CHINESE_RE.test(k))
)

// 按 key 长度降序排序，避免短 key 先替换破坏长 key
const SORTED_KEYS = Object.keys(REPLACEMENTS).sort((a, b) => b.length - a.length)
const ZH_TW_SORTED_KEYS = Object.keys(ZH_TW_REPLACEMENTS).sort((a, b) => b.length - a.length)

// zh-TW 专用：简→繁字形转换器（brand-glossary 的 key 是简体，需转为繁体字形才能匹配 zh-TW value）
const cnToTwConverter = OpenCC.Converter({ from: 'cn', to: 'tw' })

// 预生成简体 key → 繁体字形 key 的映射表（避免循环中反复转换）
const TRADITIONAL_KEYS = Object.fromEntries(
  ZH_TW_SORTED_KEYS.map(k => [k, cnToTwConverter(k)])
)

const LOCALE_DEFAULT = ['en', 'ko', 'ja']

// 路径/扩展名保护：value 是文件路径或 URL 时不替换
const PATH_RE = /^\/|\/[^/]+\.(svg|png|jpg|jpeg|gif|webp|pdf|css|js|ts|tsx|jsx)$/i

function applyReplacements(value, locale) {
  if (typeof value !== 'string') return { value, changed: false, hits: [] }
  // 路径/扩展名保护：避免破坏文件引用（如 "/images/svg/大模型.svg"）
  if (PATH_RE.test(value)) return { value, changed: false, hits: [] }
  let result = value
  const hits = []
  // zh-TW: 只用 brands+fonts 子集；其他 locale: 用全量
  const keys = locale === 'zh-TW' ? ZH_TW_SORTED_KEYS : SORTED_KEYS
  const table = locale === 'zh-TW' ? ZH_TW_REPLACEMENTS : REPLACEMENTS
  for (const k of keys) {
    // zh-TW: 用繁体字形 key 匹配；其他 locale: 用原简体 key 匹配
    const matchKey = locale === 'zh-TW' ? TRADITIONAL_KEYS[k] : k
    if (!result.includes(matchKey)) continue
    const replacement = table[k]
    const before = result
    result = result.split(matchKey).join(replacement)
    if (result !== before) {
      hits.push({ from: matchKey, to: replacement })
    }
  }
  return { value: result, changed: hits.length > 0, hits }
}

function walk(obj, pathStr, locale, dryRun, stats) {
  if (typeof obj === 'string') {
    const { value, changed, hits } = applyReplacements(obj, locale)
    if (changed) {
      stats.changed++
      if (dryRun) {
        console.log(`  [${locale}] ${pathStr}`)
        for (const h of hits) {
          console.log(`    ${h.from} → ${h.to}`)
        }
        console.log(`    旧值: ${JSON.stringify(obj).slice(0, 100)}`)
        console.log(`    新值: ${JSON.stringify(value).slice(0, 100)}`)
      }
      return value
    }
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map((v, i) => walk(v, `${pathStr}[${i}]`, locale, dryRun, stats))
  }
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const k of Object.keys(obj)) {
      out[k] = walk(obj[k], pathStr ? `${pathStr}.${k}` : k, locale, dryRun, stats)
    }
    return out
  }
  return obj
}

function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const localeArgIdx = args.indexOf('--locale')
  const locales = localeArgIdx >= 0 && args[localeArgIdx + 1]
    ? [args[localeArgIdx + 1]]
    : LOCALE_DEFAULT

  console.log(`品牌映射表应用 ${dryRun ? '(dry-run)' : '(实际写回)'}`)
  console.log(`处理语言: ${locales.join(', ')}`)
  console.log(`映射条目: ${SORTED_KEYS.length} 个\n`)

  let totalChanged = 0
  for (const loc of locales) {
    const file = path.join(DIR, `${loc}.json`)
    if (!fs.existsSync(file)) {
      console.log(`[${loc}] 跳过 (文件不存在)`)
      continue
    }
    const raw = fs.readFileSync(file, 'utf8')
    const obj = JSON.parse(raw)
    const stats = { changed: 0 }
    const newObj = walk(obj, '', loc, dryRun, stats)
    if (stats.changed === 0) {
      console.log(`[${loc}] 0 处需替换`)
      continue
    }
    if (!dryRun) {
      fs.writeFileSync(file, JSON.stringify(newObj, null, 2) + '\n', 'utf8')
    }
    console.log(`[${loc}] ${stats.changed} 处替换${dryRun ? ' (dry-run, 未写回)' : ' 已写回'}`)
    totalChanged += stats.changed
  }
  console.log(`\n总计: ${totalChanged} 处替换`)
  if (dryRun && totalChanged > 0) {
    console.log('如确认无误,运行 `node scripts/apply-brand-glossary.mjs` 实际写回')
  }
}

main()
