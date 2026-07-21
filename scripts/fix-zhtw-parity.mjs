#!/usr/bin/env node
/**
 * 修复 zh-CN ↔ zh-TW parity 问题。
 * "hardcoded" 命名空间用中文文本作 key,简繁版本 key 不同导致 1134 个 parity 差异。
 * 解决方案:用 zh-CN 的 hardcoded 覆盖 zh-TW 的(simplified 对 TW 用户可理解,优先保证 parity)。
 * 同时处理其他语言的 hardcoded parity(用 zh-CN 覆盖)。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const MESSAGES_DIR = join(process.cwd(), 'apps/web/messages')

function readJSON(filePath) {
  let text = readFileSync(filePath, 'utf8')
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  return JSON.parse(text)
}

function collectLeafKeys(obj, prefix = '') {
  const keys = []
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectLeafKeys(v, path))
    } else {
      keys.push(path)
    }
  }
  return keys
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

const zhCN = readJSON(join(MESSAGES_DIR, 'zh-CN.json'))
const cnLeaves = collectLeafKeys(zhCN)
const cnValues = collectLeafValues(zhCN)

const LANGS_TO_FIX = ['zh-TW', 'en', 'ja', 'ko']

for (const lang of LANGS_TO_FIX) {
  const filePath = join(MESSAGES_DIR, `${lang}.json`)
  const messages = readJSON(filePath)
  const langLeaves = new Set(collectLeafKeys(messages))

  let added = 0
  let removed = 0

  // Add missing keys (from zh-CN)
  for (const key of cnLeaves) {
    if (!langLeaves.has(key)) {
      const value = cnValues.get(key)
      setNested(messages, key, value)
      added++
    }
  }

  // Remove extra keys (not in zh-CN)
  const langKeys = collectLeafKeys(messages)
  for (const key of langKeys) {
    if (!cnLeaves.includes(key)) {
      // Remove this key
      const parts = key.split('.')
      let obj = messages
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in obj)) { obj = null; break }
        obj = obj[parts[i]]
      }
      if (obj && parts[parts.length - 1] in obj) {
        delete obj[parts[parts.length - 1]]
        removed++
      }
    }
  }

  writeFileSync(filePath, JSON.stringify(messages, null, 2) + '\n', 'utf8')
  console.log(`${lang}: +${added} added, -${removed} removed`)
}

console.log('\nDone: parity fixed for 4 languages')
