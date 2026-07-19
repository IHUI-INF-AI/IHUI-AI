#!/usr/bin/env node
/**
 * 应用 brand-glossary.json 中的品牌/字体/术语 canonical 映射到 3 语言 i18n 文件。
 *
 * 策略：
 *   - en.json: 直接替换中文 token 为 canonical 英文名（如 "智谱清言" → "Zhipu AI"）
 *   - ko.json: 韩语 + canonical 英文名混合（品牌名用英文，普通文本保留韩语）
 *   - ja.json: 日语 + canonical 英文名混合
 *   - zh-CN.json: 跳过（基准语言，不替换）
 *   - zh-TW.json: 跳过（繁体字形不匹配简体 key，需用 opencc 单独处理）
 *
 * 安全限制：
 *   - 只处理 key 中含中文字符的映射条目，跳过纯英文 key（如 "Moonshot"→"Moonshot AI"）
 *     避免把 en.json 中合法英文 "Moonshot" 错误替换
 *   - 替换是字符串字面量替换（split/join），不解析 JSON
 *
 * 替换粒度：按 token 替换，不动整体 value 结构。
 *   例如 value = "欢迎使用智谱清言，由智谱AI开发"
 *   → "欢迎使用 Zhipu AI，由 Zhipu AI 开发"
 *
 * 用法：
 *   node scripts/apply-brand-glossary.mjs --dry-run    # 仅打印将替换的 key + 旧值 + 新值
 *   node scripts/apply-brand-glossary.mjs              # 实际写回 3 个语言文件
 *   node scripts/apply-brand-glossary.mjs --locale=en  # 仅处理 en.json
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('apps/web/messages')
const GLOSSARY = JSON.parse(fs.readFileSync(path.resolve('scripts/brand-glossary.json'), 'utf8'))

// 合并 3 类映射(brand/font/term)为单一替换表
const ALL_REPLACEMENTS = {
  ...GLOSSARY.brands,
  ...GLOSSARY.fonts,
  ...GLOSSARY.terms,
}

// 安全过滤：只保留 key 中含中文字符的映射，跳过纯英文 key（避免误改合法英文）
// 例如 "Moonshot"→"Moonshot AI" 这种是品牌 canonical 自映射，不应在英文文件里执行
const CHINESE_RE = /[\u4e00-\u9fff]/
const REPLACEMENTS = Object.fromEntries(
  Object.entries(ALL_REPLACEMENTS).filter(([k]) => CHINESE_RE.test(k))
)

// 按 key 长度降序排序，避免短 key 先替换破坏长 key（如 "AI" 不应替换 "智谱AI" 中的 "AI"）
const SORTED_KEYS = Object.keys(REPLACEMENTS).sort((a, b) => b.length - a.length)

const LOCALE_DEFAULT = ['en', 'ko', 'ja']

function applyReplacements(value) {
  if (typeof value !== 'string') return { value, changed: false, hits: [] }
  let result = value
  const hits = []
  for (const k of SORTED_KEYS) {
    if (!result.includes(k)) continue
    const replacement = REPLACEMENTS[k]
    const before = result
    result = result.split(k).join(replacement)
    if (result !== before) {
      hits.push({ from: k, to: replacement })
    }
  }
  return { value: result, changed: hits.length > 0, hits }
}

function walk(obj, pathStr, locale, dryRun, stats) {
  if (typeof obj === 'string') {
    const { value, changed, hits } = applyReplacements(obj)
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
