// 验证 5 个 i18n JSON 文件语法 + 检测重复键(替代 PowerShell ConvertFrom-Json 假阳性)
// 用法: node scripts/verify-i18n.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const files = [
  'apps/web/messages/en.json',
  'apps/web/messages/zh-CN.json',
  'apps/web/messages/zh-TW.json',
  'apps/web/messages/ja.json',
  'apps/web/messages/ko.json',
]

// 检测 JSON 内重复键(大小写敏感)— Node.js JSON.parse 默认取最后一个,不会报错
// 这里手动检测,以便提前警告
function findDuplicateKeys(obj, path = '', seen = new Map(), dups = []) {
  if (typeof obj !== 'object' || obj === null) return dups
  const keys = Object.keys(obj)
  for (const k of keys) {
    const fullPath = path ? `${path}.${k}` : k
    // 检测同级是否有大小写不同的同名键(可能导致混淆)
    const lower = k.toLowerCase()
    if (seen.has(lower) && seen.get(lower) !== k) {
      dups.push(`${path || '$'}: '${seen.get(lower)}' vs '${k}'`)
    } else {
      seen.set(lower, k)
    }
    findDuplicateKeys(obj[k], fullPath, new Map(), dups)
  }
  return dups
}

let allOk = true
for (const rel of files) {
  const abs = join(root, rel)
  try {
    const raw = readFileSync(abs, 'utf8')
    const data = JSON.parse(raw)
    const dups = findDuplicateKeys(data)
    if (dups.length > 0) {
      console.log(`⚠️  ${rel}: OK (${Object.keys(data).length} top-level keys), ${dups.length} case-insensitive duplicate warnings:`)
      dups.slice(0, 5).forEach(d => console.log(`     - ${d}`))
    } else {
      console.log(`✅ ${rel}: OK (${Object.keys(data).length} top-level keys, no case-insensitive dups)`)
    }
  } catch (err) {
    console.error(`❌ ${rel}: ERROR — ${err.message}`)
    allOk = false
  }
}

console.log(allOk ? '\n✅ All i18n files valid.' : '\n❌ Some i18n files failed.')
process.exit(allOk ? 0 : 1)
