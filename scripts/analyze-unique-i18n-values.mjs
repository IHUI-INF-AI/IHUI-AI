#!/usr/bin/env node
/**
 * 统计未翻译键中的唯一英文值,输出到 .trae-cn/goal-runtime/i18n-unique-values.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const OUTPUT_DIR = join(ROOT, '.trae-cn/goal-runtime')

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

const langs = ['ja', 'ko', 'zh-CN', 'zh-TW']
const valueToKeys = new Map()

for (const lang of langs) {
  const data = JSON.parse(readFileSync(join(OUTPUT_DIR, `i18n-untranslated-${lang}.json`), 'utf8'))
  const leaves = collectLeafValues(data)
  for (const [key, value] of leaves) {
    if (!valueToKeys.has(value)) {
      valueToKeys.set(value, { count: 0, sampleKeys: [] })
    }
    const entry = valueToKeys.get(value)
    entry.count++
    if (entry.sampleKeys.length < 3) {
      entry.sampleKeys.push(key)
    }
  }
}

const sorted = [...valueToKeys.entries()].sort((a, b) => b[1].count - a[1].count)
const result = {}
for (const [value, info] of sorted) {
  result[value] = info
}

writeFileSync(join(OUTPUT_DIR, 'i18n-unique-values.json'), JSON.stringify(result, null, 2), 'utf8')
console.log(`唯一英文值: ${valueToKeys.size} 个`)
console.log(`总出现次数: ${[...valueToKeys.values()].reduce((s, i) => s + i.count, 0)}`)
console.log(`前 30 个最常出现的值:`)
sorted.slice(0, 30).forEach(([value, info]) => {
  console.log(`  "${value}" x${info.count}  (${info.sampleKeys[0]})`)
})
