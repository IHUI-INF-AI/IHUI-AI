#!/usr/bin/env node
/**
 * 扫描 ko.json 中的中文残留。
 * 检测 value 中是否包含未翻译为韩语的汉字字符。
 *
 * 用法: node scripts/scan-ko-zh-residue.mjs [--staged]
 *   --staged: 仅当 ko.json 在 git 暂存区时检查，有问题 exit 1（pre-commit 用）
 *   无参数:   全量检查，有问题 exit 1
 *
 * 检测规则:
 *   - 纯中文残留: value 含汉字 [\u4e00-\u9fff] 且不含韩语 [\uac00-\ud7af] → exit 1 阻塞 commit
 *   - 半翻译:     value 同时含汉字和韩语字符（如 "페이지眉"） → exit 0 warn-only（可能是有意为之，如品牌名）
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const isStaged = process.argv.includes('--staged')
const file = path.resolve('apps/web/messages/ko.json')

if (isStaged) {
  try {
    const staged = execSync('git diff --cached --name-only', {
      cwd: process.cwd(),
      encoding: 'utf8',
    })
    if (!staged.includes('apps/web/messages/ko.json')) {
      console.log('ko.json 未在暂存区，跳过中文残留扫描')
      process.exit(0)
    }
  } catch {
    process.exit(0)
  }
}

const text = fs.readFileSync(file, 'utf8')
const lines = text.split('\n')

const hanRe = /[\u4e00-\u9fff]/
const hangulRe = /[\uac00-\ud7af]/

const pureChinese = [] // 纯中文残留：有汉字无韩语
const halfTranslated = [] // 半翻译：汉字+韩语混合

for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const m = line.match(/^(\s+)"([^"]+)":\s+"([^"]*)"\s*,?\s*$/)
  if (!m) continue
  const key = m[2]
  const value = m[3]
  if (!value) continue
  if (!hanRe.test(value)) continue // 不含汉字直接跳过

  if (hangulRe.test(value)) {
    // 含汉字且含韩语 → 半翻译
    halfTranslated.push({ line: i + 1, key, value })
  } else {
    // 含汉字但不含韩语 → 纯中文残留
    pureChinese.push({ line: i + 1, key, value })
  }
}

let failed = false

if (pureChinese.length > 0) {
  console.error(`❌ 发现 ${pureChinese.length} 处纯中文残留 (无韩语字符):`)
  for (const it of pureChinese) {
    console.error(`  L${it.line}: "${it.key}": "${it.value}"`)
  }
  failed = true
}

if (halfTranslated.length > 0) {
  console.warn(`⚠️ 发现 ${halfTranslated.length} 处半翻译 (韩语+汉字混合):`)
  for (const it of halfTranslated) {
    console.warn(`  L${it.line}: "${it.key}": "${it.value}"`)
  }
  console.warn('   (半翻译为 warn-only，可能是有意为之如品牌名，不阻塞 commit)')
}

if (!failed && halfTranslated.length === 0) {
  console.log('✅ ko.json 无中文残留')
}

process.exit(failed ? 1 : 0)
