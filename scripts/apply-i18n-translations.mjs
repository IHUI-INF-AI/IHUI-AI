#!/usr/bin/env node
/**
 * 应用 i18n 翻译映射到语言文件
 * 读取翻译映射(英文值 → 翻译值),将语言文件中值 === 英文原值的键替换为翻译值
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const MESSAGES_DIR = join(ROOT, 'apps/web/messages')
const TRANSLATION_DIR = join(ROOT, '.trae-cn/goal-runtime')

const ASCII_RE = /^[-A-Za-z0-9 ._!?'",:;()&+@#$%^*=]+$/
const LANGS = ['ja', 'ko', 'zh-CN', 'zh-TW']

function collectLeafPaths(obj, prefix = '') {
  const result = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      result.push(...collectLeafPaths(v, path))
    } else {
      result.push({ path, value: v })
    }
  }
  return result
}

function getNested(obj, dotPath) {
  return dotPath.split('.').reduce((acc, k) => {
    if (acc && typeof acc === 'object' && k in acc) return acc[k]
    return undefined
  }, obj)
}

function setNested(obj, dotPath, value) {
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

let totalReplaced = 0

for (const lang of LANGS) {
  const translationMap = JSON.parse(
    readFileSync(join(TRANSLATION_DIR, `i18n-translation-${lang}.json`), 'utf8')
  )
  const enMessages = JSON.parse(readFileSync(join(MESSAGES_DIR, 'en.json'), 'utf8'))
  const langMessages = JSON.parse(readFileSync(join(MESSAGES_DIR, `${lang}.json`), 'utf8'))

  const enLeaves = collectLeafPaths(enMessages)
  let replacedCount = 0

  for (const { path, value: enValue } of enLeaves) {
    if (typeof enValue !== 'string' || enValue.length < 2) continue
    if (!ASCII_RE.test(enValue)) continue

    const langValue = getNested(langMessages, path)
    if (langValue !== enValue) continue

    const translation = translationMap[enValue]
    if (translation === undefined) continue
    if (translation === enValue) continue

    setNested(langMessages, path, translation)
    replacedCount++
  }

  writeFileSync(
    join(MESSAGES_DIR, `${lang}.json`),
    JSON.stringify(langMessages, null, 2) + '\n',
    'utf8'
  )

  console.log(`${lang}: ${replacedCount} 个键已翻译`)
  totalReplaced += replacedCount
}

console.log(`\n总计: ${totalReplaced} 个键已翻译`)
