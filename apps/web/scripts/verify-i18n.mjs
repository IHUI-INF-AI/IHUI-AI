/**
 * i18n JSON 文件校验脚本(替代 PowerShell ConvertFrom-Json 假阳性)
 *
 * 检测:
 *   1. JSON 语法错误(Node.js 原生 JSON.parse,大小写敏感)
 *   2. 大小写敏感的重复键(同层级 'Payment' vs 'payment' 视为冲突)
 *
 * 用法: node scripts/verify-i18n.mjs
 * 退出码: 0 = 全部通过, 1 = 有错误
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const messagesDir = join(__dirname, '..', 'messages')

/**
 * 递归检测同一对象层级中大小写不敏感的重复键
 * 例如 { "Payment": 1, "payment": 2 } 会被标记
 */
function findDuplicateKeys(obj, path = '', seen = new Map(), dups = []) {
  if (typeof obj !== 'object' || obj === null) return dups
  const keys = Object.keys(obj)
  for (const k of keys) {
    const lower = k.toLowerCase()
    const fullPath = path ? `${path}.${k}` : k
    if (seen.has(lower) && seen.get(lower) !== k) {
      dups.push(`${path || '$'}: '${seen.get(lower)}' vs '${k}'`)
    } else {
      seen.set(lower, k)
    }
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      findDuplicateKeys(obj[k], fullPath, new Map(), dups)
    }
  }
  return dups
}

const files = readdirSync(messagesDir).filter((f) => f.endsWith('.json'))
let hasError = false

console.log(`\n=== i18n JSON 验证(${files.length} 个文件) ===\n`)

for (const file of files) {
  const filePath = join(messagesDir, file)
  const raw = readFileSync(filePath, 'utf-8')
  try {
    const data = JSON.parse(raw)
    const dups = findDuplicateKeys(data)
    if (dups.length === 0) {
      console.log(`✓ ${file}: 有效 (无大小写敏感重复键)`)
    } else {
      console.log(`⚠ ${file}: 有效,但发现 ${dups.length} 个大小写敏感重复键(可能是合法命名空间):`)
      dups.slice(0, 10).forEach((d) => console.log(`    - ${d}`))
      if (dups.length > 10) console.log(`    ... 还有 ${dups.length - 10} 个`)
    }
  } catch (e) {
    console.error(`✗ ${file}: JSON 语法错误 - ${e.message}`)
    hasError = true
  }
}

console.log('\n=== 验证完成 ===')
if (hasError) {
  console.error('❌ 存在 JSON 语法错误,请修复后重试')
  process.exit(1)
} else {
  console.log('✅ 全部 JSON 文件语法正确')
  process.exit(0)
}
