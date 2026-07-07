#!/usr/bin/env node
/**
 * 紧急修复脚本: 移除 Sidebar.vue nameMap 重复键
 * 原因: 2026-07-07 用户 commit 0d8695e3 添加 eduCenter 映射时, 重复了顶部已有键,
 *       TypeScript 严格模式 TS1117 阻塞 build.
 * 策略: 保留最后出现的键 (用户新加的 eduCenter 映射胜出, 符合 commit 意图)
 */
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const filePath = path.resolve(__dirname, '..', 'src', 'components', 'Sidebar.vue')

const content = fs.readFileSync(filePath, 'utf8')
const lines = content.split('\n')

// 找到 nameMap 对象的范围
let startIdx = -1
let endIdx = -1
let braceDepth = 0
let inNameMap = false
for (let i = 0; i < lines.length; i++) {
  if (!inNameMap && lines[i].includes('const nameMap: Record<string, string>')) {
    startIdx = i
    inNameMap = true
    // 找 { 后面
    for (let j = i; j < lines.length; j++) {
      if (lines[j].includes('= {')) {
        startIdx = j
        break
      }
    }
  }
  if (inNameMap) {
    for (const ch of lines[i]) {
      if (ch === '{') braceDepth++
      if (ch === '}') braceDepth--
    }
    if (braceDepth === 0 && i > startIdx) {
      endIdx = i
      break
    }
  }
}

if (startIdx === -1 || endIdx === -1) {
  console.error('❌ 未找到 nameMap 对象')
  process.exit(1)
}

console.log(`📍 nameMap 范围: 行 ${startIdx + 1} - ${endIdx + 1}`)

// 收集出现的键和行号 (倒序: 保留最后出现的)
const seen = new Map() // key -> [line indices in reverse order]
const keyRegex = /^\s*([A-Za-z_][A-Za-z0-9_]*):/

for (let i = startIdx + 1; i < endIdx; i++) {
  const m = lines[i].match(keyRegex)
  if (m) {
    const key = m[1]
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key).push(i)
  }
}

const duplicates = Array.from(seen.entries()).filter(([_, idxs]) => idxs.length > 1)
console.log(`🔍 发现 ${duplicates.length} 个重复键`)

if (duplicates.length === 0) {
  console.log('✅ 无重复键, 无需修复')
  process.exit(0)
}

// 标记需要删除的行: 保留最后一个, 删除其余
const toDelete = new Set()
for (const [key, idxs] of duplicates) {
  // idxs 是按出现顺序排列的, 最后一个是要保留的
  const toRemove = idxs.slice(0, -1)
  for (const i of toRemove) {
    toDelete.add(i)
  }
  console.log(`  ${key}: 出现 ${idxs.length} 次, 删除行 ${toRemove.map(i => i + 1).join(', ')}, 保留行 ${idxs[idxs.length - 1] + 1}`)
}

// 构造新内容 (跳过标记的行)
const newLines = lines.filter((_, i) => !toDelete.has(i))
fs.writeFileSync(filePath, newLines.join('\n'), 'utf8')
console.log(`✅ 已删除 ${toDelete.size} 行重复键定义`)
console.log(`📝 ${filePath}`)
