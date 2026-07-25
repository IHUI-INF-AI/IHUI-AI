#!/usr/bin/env node
/**
 * 清理 37 个已确认无引用的 i18n key(5 语言同步)
 *
 * 清理清单(subagent 交叉验证确认):
 * 1. audit 整个顶层命名空间(31 个 leaf key)— 无任何代码引用
 * 2. help.faq 子对象(5 个数组 key:account/payment/project/ai/tech)— /help 页面已迁移到后端 API
 * 3. chat.permission.autoRevertedDesc(1 个)— 被 autoRevertedDescWithDuration 替代
 *
 * 用法:node scripts/cleanup-unused-i18n-keys.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const LOCALES = ['zh-CN', 'zh-TW', 'ko', 'ja', 'en']
const MSG_DIR = join(ROOT, 'packages', 'i18n', 'messages', 'web')

// 删除规则:[顶层key, 子路径] — null 表示删除整个顶层 key
const DELETE_RULES = [
  ['audit', null], // 删除整个 audit 命名空间(31 个 leaf)
  ['help', 'faq'], // 删除 help.faq 子对象(5 个数组 key)
  ['chat', 'permission.autoRevertedDesc'], // 删除单个 key
]

function deepDelete(obj, path) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof current[parts[i]] !== 'object' || current[parts[i]] === null) return false
    current = current[parts[i]]
  }
  const lastKey = parts[parts.length - 1]
  if (!(lastKey in current)) return false
  delete current[lastKey]
  return true
}

function countLeaves(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return 1
  let count = 0
  for (const k of Object.keys(obj)) {
    count += countLeaves(obj[k])
  }
  return count || 1
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

let totalDeleted = 0
let totalBefore = 0
let totalAfter = 0

for (const locale of LOCALES) {
  const filePath = join(MSG_DIR, `${locale}.json`)
  const raw = readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)
  const before = countLeaves(data)

  let deleted = 0
  for (const [topKey, subPath] of DELETE_RULES) {
    if (subPath === null) {
      if (topKey in data) {
        const sub = data[topKey]
        const subLeaves = countLeaves(sub)
        delete data[topKey]
        deleted += subLeaves
        console.log(`  [${locale}] 删除顶层 "${topKey}" (${subLeaves} 个 leaf key)`)
      } else {
        console.log(`  [${locale}] 跳过:顶层 "${topKey}" 不存在`)
      }
    } else {
      const fullKey = `${topKey}.${subPath}`
      if (topKey in data) {
        const ok = deepDelete(data, fullKey)
        if (ok) {
          deleted += 1
          console.log(`  [${locale}] 删除 "${fullKey}"`)
        } else {
          console.log(`  [${locale}] 跳过:"${fullKey}" 不存在`)
        }
      } else {
        console.log(`  [${locale}] 跳过:顶层 "${topKey}" 不存在`)
      }
    }
  }

  // 清理空父对象(help.faq 删除后,如果 help 下无其他子 key 则不删 help 本身)
  // 实际上 help 下有很多其他 key(title/subtitle 等),所以 help 不会空
  // 但 audit 整个删除后,如果 audit 下无其他子 key,audit 已被整体删除

  const after = countLeaves(data)
  console.log(`[${locale}] 删除 ${deleted} 个 key,leaf 总数 ${before} → ${after}`)
  totalDeleted += deleted
  totalBefore += before
  totalAfter += after

  if (!dryRun) {
    const out = JSON.stringify(data, null, 2) + '\n'
    writeFileSync(filePath, out, 'utf8')
  }
}

console.log(`\n汇总:${dryRun ? '[DRY-RUN] ' : ''}共删除 ${totalDeleted} 个 key,5 语言 leaf 总数 ${totalBefore} → ${totalAfter}`)
