/**
 * 生成移动端字号 baseline 文件
 * 用法：npx tsx scripts/generate-fontsize-baseline.ts
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.join(rootDir, 'src')
const baselineDir = path.join(rootDir, 'scripts', 'baselines')
const baselineFile = path.join(baselineDir, 'fontsize-baseline.json')

const MIN_FONT_SIZE = 12

function extractMinPx(value: string): number | null {
  const trimmed = value.trim()
  const clampMatch = trimmed.match(/clamp\(\s*([\d.]+)px/)
  if (clampMatch) return parseFloat(clampMatch[1])
  const pxMatch = trimmed.match(/^([\d.]+)px$/)
  if (pxMatch) return parseFloat(pxMatch[1])
  if (/[\d.]+px/.test(trimmed)) {
    const m = trimmed.match(/([\d.]+)px/)
    if (m) return parseFloat(m[1])
  }
  return null
}

function collectFiles(dir: string, exts: string[]): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue
      results.push(...collectFiles(full, exts))
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(full)
    }
  }
  return results
}

function checkFile(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const keys: string[] = []
  const fontSizeRegex = /font-size\s*:\s*([^;}\n]+)/g

  lines.forEach((line, lineIdx) => {
    let match: RegExpExecArray | null
    fontSizeRegex.lastIndex = 0
    while ((match = fontSizeRegex.exec(line)) !== null) {
      const value = match[1].trim()
      const minPx = extractMinPx(value)
      if (minPx !== null && minPx < MIN_FONT_SIZE) {
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue
        if (line.includes('$') && line.includes(':')) {
          const beforeColon = line.split(':')[0]
          if (beforeColon.includes('$')) continue
        }
        const rel = path.relative(rootDir, filePath).replace(/\\/g, '/')
        keys.push(`${rel}:${lineIdx + 1}:${match.index + 1}`)
      }
    }
  })
  return keys
}

function main() {
  console.log('[generate-fontsize-baseline] 生成 baseline...')
  const files = collectFiles(srcDir, ['.vue', '.scss', '.css'])
  const allKeys: string[] = []
  for (const file of files) {
    allKeys.push(...checkFile(file))
  }
  if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true })
  fs.writeFileSync(baselineFile, JSON.stringify(allKeys, null, 2) + '\n', 'utf8')
  console.log(`  已生成 ${baselineFile}`)
  console.log(`  baseline 记录数: ${allKeys.length}`)
}

main()
