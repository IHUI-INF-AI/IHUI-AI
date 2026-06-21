/**
 * 计算 index.html 中 inline script 的 sha256 hash
 * 用法：npm run csp:hash
 *
 * 输出：每个 inline script 块的 sha256 hash，可添加到 CSP script-src
 *       用于渐进收紧 CSP，移除 'unsafe-inline'
 */
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8')

// 匹配所有 <script>...</script> 块（排除 type="application/ld+json" 和带 src 的外部脚本）
const scriptRegex = /<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/gi

let match: RegExpExecArray | null
let index = 0
const hashes: string[] = []
const externalScripts: string[] = []

while ((match = scriptRegex.exec(indexHtml)) !== null) {
  const fullTag = match[0]
  const content = match[1].trim()

  // 跳过带 src 的外部脚本
  if (/\ssrc=/i.test(fullTag)) {
    const srcMatch = fullTag.match(/\ssrc=["']([^"']+)["']/i)
    if (srcMatch) externalScripts.push(srcMatch[1])
    continue
  }

  // 跳过空内容
  if (!content) continue

  index++
  const hash = crypto.createHash('sha256').update(content).digest('base64')
  const hashStr = `'sha256-${hash}'`
  hashes.push(hashStr)

  // 提取内容前 60 字符作为预览
  const preview = content.slice(0, 60).replace(/\n/g, ' ').replace(/\s+/g, ' ')
  console.log(`[块 ${index}] ${hashStr}`)
  console.log(`  长度: ${content.length} 字符`)
  console.log(`  预览: ${preview}...`)
  console.log()
}

console.log('─'.repeat(60))
console.log(`inline script 块总数: ${index}`)
console.log(`外部脚本: ${externalScripts.length} 个`)
if (externalScripts.length > 0) {
  console.log(`  ${externalScripts.join(', ')}`)
}
console.log()
console.log('CSP script-src hash 列表（用于替换 unsafe-inline）：')
console.log(hashes.join(' '))
console.log()
console.log('注意：')
console.log('  1. style-src 因主题预加载动态创建 style，仍需保留 unsafe-inline')
console.log('  2. 若 inline script 内容变化，需重新计算 hash')
console.log('  3. 建议先用 Report-Only 模式验证，再切换为强制模式')
