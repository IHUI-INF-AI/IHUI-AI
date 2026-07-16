#!/usr/bin/env node
/**
 * 扫描 zh-TW.json 中的简体字残留。
 * 用 opencc-js 简→繁转换每个 value，找出转换后字符发生变化的 value（即包含简体字）。
 */
import fs from 'node:fs'
import path from 'node:path'
import * as OpenCC from 'opencc-js'

const file = path.resolve('apps/web/messages/zh-TW.json')
const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n')

// 'cn' = 简体 → 繁体（台湾字形，不改用词）
// 不同于 'twp' 台湾惯用词（智能→智慧），'tw' 只做字形转换
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

const issues = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  // 匹配 "key": "value"（value 可能含中文、英文、占位符）
  const m = line.match(/^(\s+)"([^"]+)":\s+"([^"]*)"\s*,?\s*$/)
  if (!m) continue
  const indent = m[1]
  const key = m[2]
  const value = m[3]
  if (!value) continue
  if (!/[\u4e00-\u9fff]/.test(value)) continue // 仅扫描中文 value
  const converted = converter(value)
  if (converted !== value) {
    issues.push({ line: i + 1, indent, key, value, converted })
  }
}

console.log(`Found ${issues.length} values with simplified Chinese characters`)
const out = []
out.push(`Found ${issues.length} values with simplified Chinese characters in zh-TW.json`)
out.push('')
for (const it of issues) {
  out.push(`L${it.line}: "${it.key}": "${it.value}"`)
  out.push(`     → "${it.converted}"`)
  out.push('')
}
fs.writeFileSync(path.resolve('apps/web/messages/_zh-tw-scan-result.txt'), out.join('\n'), 'utf8')
console.log('Written: apps/web/messages/_zh-tw-scan-result.txt')
