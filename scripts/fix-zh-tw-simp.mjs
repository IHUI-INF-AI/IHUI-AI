#!/usr/bin/env node
/**
 * 修复 zh-TW.json 中的简体字残留。
 * 用 opencc-js 'cn' → 'tw' 转换每个 value，自动写回原文件。
 * 与 scan-i18n-zh-residue.mjs zh-TW 配套使用（仅做字形转换，不改用词）。
 */
import fs from 'node:fs'
import path from 'node:path'
import * as OpenCC from 'opencc-js'

const file = path.resolve('apps/web/messages/zh-TW.json')
const original = fs.readFileSync(file, 'utf8')
const lines = original.split('\n')

// 'cn' = 简体 → 繁体（台湾字形，不改用词）
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

let fixedCount = 0
const out = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  // 匹配 "key": "value"（value 可能含中文、英文、占位符、转义符）
  const m = line.match(/^(\s+)"([^"]+)":\s+"((?:[^"\\]|\\.)*)"\s*,?\s*$/)
  if (!m) {
    out.push(line)
    continue
  }
  const indent = m[1]
  const key = m[2]
  const value = m[3]
  if (!value || !/[\u4e00-\u9fff]/.test(value)) {
    out.push(line)
    continue
  }
  const converted = converter(value)
  if (converted !== value) {
    fixedCount++
    // 保持原行的 key / 引号 / 逗号结构,只替换 value 部分
    const tail = line.endsWith(',') ? ',' : ''
    out.push(`${indent}"${key}": "${converted}"${tail}`)
  } else {
    out.push(line)
  }
}

const fixed = out.join('\n')
fs.writeFileSync(file, fixed, 'utf8')
console.log(`Fixed ${fixedCount} values in zh-TW.json`)
