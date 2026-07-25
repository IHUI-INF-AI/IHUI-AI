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

// 解析 --target 参数(默认 web),支持 --target=value 和 --target value 两种形式
const args = process.argv.slice(2)
let target = 'web'
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--target' && i + 1 < args.length) target = args[i + 1]
  else if (args[i].startsWith('--target=')) target = args[i].slice('--target='.length)
}
const dryRun = args.includes('--dry-run')
const MSG_DIR = join(ROOT, 'packages', 'i18n', 'messages', target)

// 删除规则:[顶层key, 子路径] — null 表示删除整个顶层 key
// web 规则
const WEB_DELETE_RULES = [
  ['audit', null], // 删除整个 audit 命名空间(31 个 leaf)
  ['help', 'faq'], // 删除 help.faq 子对象(5 个数组 key)
  ['chat', 'permission.autoRevertedDesc'], // 删除单个 key
]
// miniapp-taro 规则(7 个无引用 key,subagent 交叉验证确认)
const MINIAPP_DELETE_RULES = [
  ['common', 'search'], // 搜索(SearchBar 用硬编码默认值)
  ['nav', 'chat'], // AI 对话(TabBar 不引用)
  ['nav', 'agents'], // 智能体(用 aiGroup.agent)
  ['nav', 'orders'], // 订单(用 order.title)
  ['nav', 'wallet'], // 钱包(用 wallet.* 子键)
  ['nav', 'settings'], // 设置(用 setting.* 命名空间)
  ['chat', 'newConversation'], // 新建对话(用 share.index.newChat)
]
const DELETE_RULES = target === 'miniapp-taro' ? MINIAPP_DELETE_RULES : WEB_DELETE_RULES

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

console.log(`\n汇总:[target=${target}] ${dryRun ? '[DRY-RUN] ' : ''}共删除 ${totalDeleted} 个 key,5 语言 leaf 总数 ${totalBefore} → ${totalAfter}`)
