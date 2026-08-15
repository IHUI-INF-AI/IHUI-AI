import fs from 'fs'
import path from 'path'

const dir = 'packages/i18n/messages/mobile-rn'
const baseFile = 'en.json'
const targetFiles = ['ja.json', 'ko.json', 'zh-TW.json']

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

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object' || current[key] === null || Array.isArray(current[key])) {
      current[key] = {}
    }
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
}

const baseContent = JSON.parse(fs.readFileSync(path.join(dir, baseFile), 'utf-8'))
const baseKeys = getAllKeys(baseContent)

for (const file of targetFiles) {
  const filePath = path.join(dir, file)
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const existingKeys = getAllKeys(content)
  
  let addedCount = 0
  for (const key of baseKeys) {
    if (!existingKeys.includes(key)) {
      setNestedValue(content, key, '')
      addedCount++
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8')
  console.log(`${file}: 新增 ${addedCount} 个 keys（空字符串占位）`)
}
