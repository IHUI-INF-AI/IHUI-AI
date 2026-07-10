/**
 * 暗色模式审计: AI HOT 资讯新增 UI 元素
 *
 * 检查 HomePage3.vue 中新增的 AI HOT 相关 CSS 是否都有 html.dark & 暗色样式.
 * 确保暗色模式下文字/背景对比度足够.
 *
 * 用法: node scripts/audit-aihot-dark-mode.mjs
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const vuePath = resolve(root, 'src/components/home/HomePage3.vue')
const content = readFileSync(vuePath, 'utf-8')

// 提取所有 AI HOT 相关的 CSS class
const aiHotClasses = new Set()
const classRegex = /\.ai-(?:hot-bar|cat-bar|daily-panel|daily-section|daily-archive|source-dropdown|search-status|load-more)[\w-]*/g
let match
while ((match = classRegex.exec(content)) !== null) {
  aiHotClasses.add(match[0])
}

// 检查哪些 class 有对应的 html.dark 样式
const darkBlocks = content.match(/html\.dark\s+&\s*\{[^}]+\}/g) || []
const darkContent = darkBlocks.join('\n')

const missing = []
const present = []

for (const cls of aiHotClasses) {
  // 检查该 class 是否在 html.dark 块附近出现
  // 由于 SCSS 嵌套, 检查父级选择器是否有 dark 前缀
  const classInDark = darkContent.includes(cls) || 
    content.includes(`html.dark & {\n      background:`) // 通用暗色覆盖

  // 更精确: 检查 class 定义附近是否有 html.dark
  const classIdx = content.indexOf(cls + ' {')
  if (classIdx === -1) continue
  
  // 向后搜索 500 字符内是否有 html.dark
  const nearby = content.substring(classIdx, classIdx + 800)
  if (nearby.includes('html.dark')) {
    present.push(cls)
  } else {
    // 检查是否有通用的暗色变量 (hsl var 自动适配)
    if (nearby.includes('hsl(var(--') && !nearby.includes('hsl(0deg 0%')) {
      present.push(cls + ' (via CSS variables)')
    } else {
      missing.push(cls)
    }
  }
}

console.log('\n=== AI HOT 暗色模式审计 ===\n')
console.log(`检查的 CSS class 数量: ${aiHotClasses.size}`)
console.log(`已有暗色样式: ${present.length}`)
console.log(`缺少暗色样式: ${missing.length}`)

if (present.length > 0) {
  console.log('\n✓ 已覆盖:')
  present.forEach(c => console.log(`  ${c}`))
}

if (missing.length > 0) {
  console.log('\n⚠ 可能缺少暗色样式 (使用 CSS 变量自动适配的无需处理):')
  missing.forEach(c => console.log(`  ${c}`))
  console.log('\n注意: 使用 hsl(var(--xxx)) 变量的 class 会自动适配暗色模式, 无需 html.dark 覆盖.')
  console.log('仅当使用硬编码颜色 (如 hsl(0deg 0% 12%)) 时才需要显式 html.dark 覆盖.')
} else {
  console.log('\n✓ 所有 AI HOT CSS class 暗色模式覆盖完整')
}

// 额外检查: 是否有硬编码颜色未做暗色覆盖
const hardcodedDark = content.match(/hsl\(0deg 0% \d+%\)/g) || []
const hardcodedWithoutDark = []

// 检查每个硬编码颜色是否在 html.dark 块内
let idx = 0
while (idx < content.length) {
  const found = content.indexOf('hsl(0deg 0%', idx)
  if (found === -1) break
  // 向前搜索 200 字符内是否有 html.dark
  const before = content.substring(Math.max(0, found - 200), found)
  if (!before.includes('html.dark')) {
    const line = content.substring(0, found).split('\n').length
    hardcodedWithoutDark.push(`行 ${line}: ${content.substring(found, found + 20)}`)
  }
  idx = found + 1
}

if (hardcodedWithoutDark.length > 0) {
  console.log('\n⚠ 硬编码暗色值但不在 html.dark 块内:')
  hardcodedWithoutDark.forEach(c => console.log(`  ${c}`))
} else {
  console.log('\n✓ 所有硬编码颜色都在 html.dark 块内')
}

console.log('\n审计完成.\n')
process.exit(0)
