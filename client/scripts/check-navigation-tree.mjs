#!/usr/bin/env node
/**
 * navigation.json 6 语言 key 树一致性深度审计
 *
 * 目的: 比 check-i18n-keys.ts 更严格地验证 6 语言 navigation.json
 *       - 所有语言 leaf key 集合完全一致 (无 missing/extra)
 *       - eduCenter key 全部 6 语言都存在 (sidebar 接入硬约束)
 *
 * 区别于 check-i18n-keys.ts:
 *   - check-i18n-keys.ts: 扫描 t() 调用 ↔ modules/ 覆盖
 *   - 本脚本: 模块内 6 语言之间的一致性 + 关键 key 存在
 *
 * 用法:
 *   node scripts/check-navigation-tree.mjs         # 全量检查
 *   node scripts/check-navigation-tree.mjs --staged # 仅 staged navigation.json 触发
 *
 * 退出码:
 *   0 - 通过
 *   1 - 6 语言 key 树不一致 / 关键 key 缺失
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '..')
const projectRoot = path.resolve(clientRoot, '..')

const onlyStaged = process.argv.includes('--staged')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'en-US', 'ja', 'ko']
const BASE_LANG = 'zh-CN'
const REQUIRED_KEYS = ['navigation.eduCenter']

function getKeys(obj, prefix = '') {
  const keys = []
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (obj[k] !== null && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      keys.push(...getKeys(obj[k], full))
    } else {
      keys.push(full)
    }
  }
  return keys.sort()
}

function getStagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: projectRoot,
      encoding: 'utf-8',
    })
    return out.split('\n').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean)
  } catch {
    return null
  }
}

let violationCount = 0
function report(file, msg) {
  console.error(`  [FAIL] ${file}: ${msg}`)
  violationCount++
}

function checkConsistency() {
  const trees = {}
  for (const lang of LANGS) {
    const p = path.join(clientRoot, `src/locales/modules/${lang}/navigation.json`)
    if (!fs.existsSync(p)) {
      report(p, `文件不存在`)
      continue
    }
    trees[lang] = getKeys(JSON.parse(fs.readFileSync(p, 'utf-8')))
  }

  const base = trees[BASE_LANG]
  if (!base) return
  console.log(`\n[BASE] ${BASE_LANG}: ${base.length} leaf keys`)

  for (const lang of LANGS) {
    if (lang === BASE_LANG) continue
    const other = trees[lang]
    if (!other) continue
    const missing = base.filter(k => !other.includes(k))
    const extra = other.filter(k => !base.includes(k))
    if (missing.length === 0 && extra.length === 0) {
      console.log(`  [OK] ${lang}: ${other.length} keys, identical to ${BASE_LANG}`)
    } else {
      report(
        `navigation.json (${lang})`,
        `missing=${missing.length} extra=${extra.length}, 缺失示例: ${missing.slice(0, 3).join(', ')}`,
      )
    }
  }
}

function checkRequiredKeys() {
  console.log('\n[REQ] 关键 key 必须 6 语言全覆盖')
  for (const lang of LANGS) {
    const p = path.join(clientRoot, `src/locales/modules/${lang}/navigation.json`)
    if (!fs.existsSync(p)) continue
    const keys = getKeys(JSON.parse(fs.readFileSync(p, 'utf-8')))
    for (const required of REQUIRED_KEYS) {
      if (!keys.includes(required)) {
        report(p, `缺少关键 key: ${required}`)
      }
    }
  }
}

// staged 模式: 仅当 navigation.json 在 staged 才跑
let shouldRun = true
if (onlyStaged) {
  const staged = getStagedFiles()
  if (staged === null) {
    console.log('[staged] git 不可用, 退到全量检查')
  } else {
    const hasTrigger = LANGS.some(lang => staged.includes(`client/src/locales/modules/${lang}/navigation.json`))
    if (!hasTrigger) {
      console.log('[staged] navigation.json 不在 staged, 跳过')
      shouldRun = false
    }
  }
}

if (shouldRun) {
  checkConsistency()
  checkRequiredKeys()
}

if (violationCount > 0) {
  console.error(`\n[FAIL] 共 ${violationCount} 处违规`)
  process.exit(1)
}

console.log('\n[OK] navigation.json 6 语言 key 树一致 + 关键 key 齐全')
