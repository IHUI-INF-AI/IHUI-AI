#!/usr/bin/env node
/**
 * i18n 缺失键批量补全工具
 *
 * 2026-07-03 创建: 批量补全各语言缺失的 i18n 键
 *
 * 策略:
 *   - zh-TW: 从 zh-CN 简体转繁体 (opencc-js, S2TW 模式)
 *   - en:    从 en-US 复制 (若 en-US 有), 否则从 zh-CN 复制作占位
 *   - ja:    从 en 复制 (若 en 有), 否则从 zh-CN 复制作占位
 *   - ko:    从 en 复制 (若 en 有), 否则从 zh-CN 复制作占位
 *
 * 用法: node scripts/fill-missing-i18n.mjs
 *        node scripts/fill-missing-i18n.mjs --dry-run   # 只打印, 不写入
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as OpenCC from 'opencc-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// 简体→繁体转换器
const s2tw = OpenCC.Converter({ from: 'cn', to: 'tw' })

function readJSON(p) {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function writeJSON(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf-8')
}

// 深度合并: 将 src 中存在但 dst 中缺失的键补上
function deepFill(dst, src, valueTransformer) {
  let filled = 0
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (typeof dst[k] !== 'object' || dst[k] === null || Array.isArray(dst[k])) {
        dst[k] = {}
      }
      filled += deepFill(dst[k], v, valueTransformer)
    } else {
      if (!(k in dst) || dst[k] === '' || dst[k] === null || dst[k] === undefined) {
        dst[k] = valueTransformer ? valueTransformer(v) : v
        filled++
      }
    }
  }
  return filled
}

// 处理单个语言
function fillLocale(locale, fallbackChain) {
  const baselineDir = path.join(LOCALES_DIR, 'zh-CN')
  const baselineFiles = fs.readdirSync(baselineDir).filter((f) => f.endsWith('.json'))
  const localeDir = path.join(LOCALES_DIR, locale)

  if (!fs.existsSync(localeDir)) {
    fs.mkdirSync(localeDir, { recursive: true })
  }

  let totalFilled = 0
  const moduleStats = []

  for (const f of baselineFiles) {
    const baselineObj = readJSON(path.join(baselineDir, f))
    if (!baselineObj) continue

    const localePath = path.join(localeDir, f)
    const localeObj = readJSON(localePath) || {}

    // 记录补全前的键数
    const beforeKeys = countKeys(localeObj)

    // 按回退链补全
    let filled = 0
    for (const fallback of fallbackChain) {
      const fallbackDir = path.join(LOCALES_DIR, fallback.locale)
      const fallbackPath = path.join(fallbackDir, f)
      const fallbackObj = readJSON(fallbackPath)
      if (!fallbackObj) continue

      filled += deepFill(localeObj, fallbackObj, fallback.transformer)
    }

    // 还有什么都没补上的, 从 zh-CN 基线补全 (最后兜底)
    if (filled === 0 && countKeys(localeObj) < countKeys(baselineObj)) {
      filled += deepFill(localeObj, baselineObj, fallbackChain[0]?.transformer)
    }

    const afterKeys = countKeys(localeObj)
    if (filled > 0) {
      if (!dryRun) {
        writeJSON(localePath, localeObj)
      }
      totalFilled += filled
      moduleStats.push({ file: f, filled, before: beforeKeys, after: afterKeys })
    }
  }

  return { totalFilled, moduleStats }
}

function countKeys(obj) {
  let n = 0
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      n += countKeys(v)
    } else {
      n++
    }
  }
  return n
}

// 主流程
console.log('🔧 i18n 缺失键批量补全工具')
if (dryRun) console.log('   (dry-run 模式: 只打印, 不写入)')
console.log()

const tasks = [
  {
    locale: 'zh-TW',
    fallbackChain: [
      // 从 zh-CN 简体转繁体
      { locale: 'zh-CN', transformer: (v) => (typeof v === 'string' ? s2tw(v) : v) },
    ],
  },
  {
    locale: 'en',
    fallbackChain: [
      // 先从 en-US 复制 (美式英语)
      { locale: 'en-US', transformer: (v) => v },
      // 兜底: 从 zh-CN 复制 (中文占位, 待翻译)
      { locale: 'zh-CN', transformer: (v) => v },
    ],
  },
  {
    locale: 'en-US',
    fallbackChain: [
      // 从 en 复制 (en 已 100% 覆盖)
      { locale: 'en', transformer: (v) => v },
    ],
  },
  {
    locale: 'ja',
    fallbackChain: [
      // 先从 en 复制 (英语回退)
      { locale: 'en', transformer: (v) => v },
      // 兜底: 从 zh-CN 复制
      { locale: 'zh-CN', transformer: (v) => v },
    ],
  },
  {
    locale: 'ko',
    fallbackChain: [
      { locale: 'en', transformer: (v) => v },
      { locale: 'zh-CN', transformer: (v) => v },
    ],
  },
]

for (const task of tasks) {
  console.log(`🔹 补全 ${task.locale}...`)
  const { totalFilled, moduleStats } = fillLocale(task.locale, task.fallbackChain)
  console.log(`   总补全: ${totalFilled} keys`)

  // 打印前 10 个模块
  const top = moduleStats.sort((a, b) => b.filled - a.filled).slice(0, 10)
  if (top.length > 0) {
    console.log('   Top 10 模块:')
    for (const s of top) {
      console.log(`     ${s.file}: +${s.filled} keys (${s.before} → ${s.after})`)
    }
  }
  console.log()
}

console.log('✅ 补全完成')
if (dryRun) {
  console.log('   (dry-run 模式, 未写入文件. 去掉 --dry-run 参数执行实际写入)')
} else {
  console.log('   请运行 npm run check:i18n 验证覆盖率')
}
