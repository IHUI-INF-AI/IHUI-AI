import fs from 'fs'
import path from 'path'

const dir = 'packages/i18n/messages/mobile-rn'
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'))

function getAllKeys(obj, prefix = '') {
  let keys = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

const keyMap = new Map()

for (const file of files) {
  const filePath = path.join(dir, file)
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const keys = getAllKeys(content).sort()
  keyMap.set(file, keys)
}

// 以 en.json 为基准
const baseFile = 'en.json'
const baseKeys = keyMap.get(baseFile)

const report = []

for (const file of files) {
  if (file === baseFile) continue
  const keys = keyMap.get(file)
  const missing = baseKeys.filter(k => !keys.includes(k))
  const extra = keys.filter(k => !baseKeys.includes(k))

  report.push(`\n=== ${file} ===`)
  report.push(`总 keys: ${keys.length}`)
  if (missing.length > 0) {
    report.push(`缺失 ${missing.length} 个 keys:`)
    missing.forEach(k => report.push(`  - ${k}`))
  } else {
    report.push(`缺失 keys: 无`)
  }
  if (extra.length > 0) {
    report.push(`多余 ${extra.length} 个 keys:`)
    extra.forEach(k => report.push(`  + ${k}`))
  } else {
    report.push(`多余 keys: 无`)
  }
}

fs.writeFileSync('i18n-parity-report.txt', report.join('\n'), 'utf-8')
console.log('报告已生成: i18n-parity-report.txt')
console.log(report.join('\n'))
