#!/usr/bin/env node
/**
 * 导出所有未翻译键(值 === en 仅 ASCII)到 .trae-cn/goal-runtime/i18n-untranslated-<lang>.json
 * 供后续批量翻译使用
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const MESSAGES_DIR = join(ROOT, 'apps/web/messages')
const OUTPUT_DIR = join(ROOT, '.trae-cn/goal-runtime')

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

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

function setNestedValue(obj, dotPath, value) {
  const keys = dotPath.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in cur) || typeof cur[keys[i]] !== 'object') {
      cur[keys[i]] = {}
    }
    cur = cur[keys[i]]
  }
  cur[keys[keys.length - 1]] = value
}

const enMessages = JSON.parse(readFileSync(join(MESSAGES_DIR, 'en.json'), 'utf8'))
const enLeaves = collectLeafValues(enMessages)

const TRANSLATABLE_LANGS = ['ja', 'ko', 'zh-CN', 'zh-TW']
const ASCII_RE = /^[-A-Za-z0-9 ._!?'",:;()&+@#$%^*=]+$/

let totalExported = 0

for (const lang of TRANSLATABLE_LANGS) {
  const langMessages = JSON.parse(readFileSync(join(MESSAGES_DIR, `${lang}.json`), 'utf8'))
  const langValues = collectLeafValues(langMessages)

  const untranslated = {}
  let count = 0

  for (const [key, enValue] of enLeaves) {
    if (typeof enValue !== 'string' || enValue.length < 2) continue
    if (!ASCII_RE.test(enValue)) continue
    const langValue = langValues.get(key)
    if (langValue === enValue) {
      setNestedValue(untranslated, key, enValue)
      count++
    }
  }

  const outputPath = join(OUTPUT_DIR, `i18n-untranslated-${lang}.json`)
  writeFileSync(outputPath, JSON.stringify(untranslated, null, 2), 'utf8')
  console.log(`${lang}: ${count} 个未翻译键 → ${outputPath}`)
  totalExported += count
}

console.log(`\n总计: ${totalExported} 个未翻译键已导出`)
