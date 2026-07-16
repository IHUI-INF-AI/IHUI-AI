#!/usr/bin/env node
/**
 * 扫描 zh-TW.json 中的简体字残留。
 * 用 opencc-js 简→繁转换每个 value，找出转换后字符发生变化的 value（即包含简体字）。
 *
 * 用法: node scripts/scan-zh-tw-simp.mjs [--staged]
 *   --staged: 仅当 zh-TW.json 在 git 暂存区时检查，有问题 exit 1（pre-commit 用）
 *   无参数:   全量检查，有问题 exit 1
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import * as OpenCC from 'opencc-js'

const isStaged = process.argv.includes('--staged')
const file = path.resolve('apps/web/messages/zh-TW.json')

if (isStaged) {
  try {
    const staged = execSync('git diff --cached --name-only', {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    if (!staged.includes('apps/web/messages/zh-TW.json')) {
      console.log('zh-TW.json 未在暂存区，跳过简体字扫描')
      process.exit(0)
    }
  } catch {
    process.exit(0)
  }
}

const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n')

// 'cn' = 简体 → 繁体（台湾字形，不改用词）
// 不同于 'twp' 台湾惯用词（智能→智慧），'tw' 只做字形转换
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' })

const issues = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const m = line.match(/^(\s+)"([^"]+)":\s+"([^"]*)"\s*,?\s*$/)
  if (!m) continue
  const key = m[2]
  const value = m[3]
  if (!value) continue
  if (!/[\u4e00-\u9fff]/.test(value)) continue
  const converted = converter(value)
  if (converted !== value) {
    issues.push({ line: i + 1, key, value, converted })
  }
}

if (issues.length === 0) {
  console.log('✅ zh-TW.json 无简体字残留')
  process.exit(0)
}

console.error(`❌ 发现 ${issues.length} 处简体字残留:`)
for (const it of issues) {
  console.error(`  L${it.line}: "${it.key}": "${it.value}"`)
  console.error(`       → "${it.converted}"`)
}
process.exit(1)
