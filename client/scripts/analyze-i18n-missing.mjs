#!/usr/bin/env node
/**
 * i18n 缺失键分析器
 *
 * 2026-07-03 创建: 分析各语言缺失键的模块分布, 输出补全建议
 *
 * 用法: node scripts/analyze-i18n-missing.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales', 'modules')

const LOCALES = ['zh-CN', 'en', 'zh-TW', 'en-US', 'ja', 'ko']
const TARGET_LOCALES = ['en', 'zh-TW', 'ja', 'ko'] // en-US 已与 en 对齐

function readJSON(p) {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function flattenKeys(obj, prefix = '') {
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v, key))
    } else {
      out.push(key)
    }
  }
  return out
}

function getMissingKeysForLocale(locale) {
  const baselineDir = path.join(LOCALES_DIR, 'zh-CN')
  const baselineFiles = fs.readdirSync(baselineDir).filter((f) => f.endsWith('.json'))

  const dir = path.join(LOCALES_DIR, locale)
  if (!fs.existsSync(dir)) {
    return { missingByModule: {}, totalMissing: baselineFiles.length * 1000, missingFiles: [...baselineFiles] }
  }

  const missingByModule = {}
  let totalMissing = 0

  for (const f of baselineFiles) {
    const baselineObj = readJSON(path.join(baselineDir, f))
    const localeObj = readJSON(path.join(dir, f))

    if (!baselineObj) continue
    const baselineKeys = new Set(flattenKeys(baselineObj))

    if (!localeObj) {
      missingByModule[f] = [...baselineKeys]
      totalMissing += baselineKeys.size
      continue
    }

    const localeKeys = new Set(flattenKeys(localeObj))
    const missing = [...baselineKeys].filter((k) => !localeKeys.has(k))
    if (missing.length > 0) {
      missingByModule[f] = missing
      totalMissing += missing.length
    }
  }

  return { missingByModule, totalMissing }
}

// 主流程
console.log('📊 i18n 缺失键分析报告')
console.log('━'.repeat(60))
console.log()

for (const locale of TARGET_LOCALES) {
  const { missingByModule, totalMissing } = getMissingKeysForLocale(locale)
  console.log(`🔹 ${locale}: 总缺失 ${totalMissing} keys`)

  // 按缺失数量排序
  const sortedModules = Object.entries(missingByModule)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15) // 前 15 个最缺失的模块

  if (sortedModules.length > 0) {
    console.log('   Top 15 缺失模块:')
    for (const [mod, keys] of sortedModules) {
      console.log(`     ${mod}: ${keys.length} keys`)
    }
  }
  console.log()
}

console.log('━'.repeat(60))
console.log()
console.log('💡 补全策略建议:')
console.log('  - zh-TW: 从 zh-CN 繁化 (近 1:1 字符级转换)')
console.log('  - en:    从 zh-CN 翻译 (或复用 en-US 已有翻译)')
console.log('  - ja:    从 zh-CN 翻译 (或复用 en 已有翻译)')
console.log('  - ko:    从 zh-CN 翻译 (或复用 en 已有翻译)')
