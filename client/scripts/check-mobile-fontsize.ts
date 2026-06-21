/**
 * 移动端字号静态巡检：扫描源码中 font-size 声明，检测小于 12px 的绝对值
 * 用法：
 *   npx tsx scripts/check-mobile-fontsize.ts              # 严格模式
 *   CHECK_FONTSIZE_BASELINE=1 npx tsx scripts/check-mobile-fontsize.ts  # baseline 模式
 * 退出码：0 通过，1 存在违规
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.join(rootDir, 'src')
const baselineFile = path.join(rootDir, 'scripts', 'baselines', 'fontsize-baseline.json')

const MIN_FONT_SIZE = 12
const BASELINE_MODE = process.env.CHECK_FONTSIZE_BASELINE === '1'

interface Violation {
  file: string
  line: number
  col: number
  value: string
  minPx: number
  context: string
}

/** 从 font-size 值中提取最小绝对像素值 */
function extractMinPx(value: string): number | null {
  const trimmed = value.trim()

  // clamp(min, preferred, max) - 取最小值
  const clampMatch = trimmed.match(/clamp\(\s*([\d.]+)px/)
  if (clampMatch) return parseFloat(clampMatch[1])

  // 纯像素值
  const pxMatch = trimmed.match(/^([\d.]+)px$/)
  if (pxMatch) return parseFloat(pxMatch[1])

  // 带单位的值（em/rem 不检查，需运行时分析）
  if (/[\d.]+px/.test(trimmed)) {
    const m = trimmed.match(/([\d.]+)px/)
    if (m) return parseFloat(m[1])
  }

  return null
}

/** 收集目录下所有目标文件 */
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

/** 检查单个文件 */
function checkFile(filePath: string): Violation[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const violations: Violation[] = []

  // 匹配 font-size: value 形式（含 scoped style 中的声明）
  const fontSizeRegex = /font-size\s*:\s*([^;}\n]+)/g

  lines.forEach((line, lineIdx) => {
    let match: RegExpExecArray | null
    fontSizeRegex.lastIndex = 0
    while ((match = fontSizeRegex.exec(line)) !== null) {
      const value = match[1].trim()
      const minPx = extractMinPx(value)
      if (minPx !== null && minPx < MIN_FONT_SIZE) {
        // 排除注释行
        if (line.trim().startsWith('//') || line.trim().startsWith('/*')) continue
        // 排除 SCSS 变量定义（$font-size-xs: 12px）
        if (line.includes('$') && line.includes(':')) {
          const beforeColon = line.split(':')[0]
          if (beforeColon.includes('$')) continue
        }
        violations.push({
          file: path.relative(rootDir, filePath).replace(/\\/g, '/'),
          line: lineIdx + 1,
          col: match.index + 1,
          value,
          minPx,
          context: line.trim().slice(0, 100),
        })
      }
    }
  })

  return violations
}

function loadBaseline(): Record<string, true> {
  if (!fs.existsSync(baselineFile)) return {}
  try {
    const data = JSON.parse(fs.readFileSync(baselineFile, 'utf8'))
    const map: Record<string, true> = {}
    for (const key of data) map[key] = true
    return map
  } catch {
    return {}
  }
}

function main() {
  console.log('[check-mobile-fontsize] 扫描源码中 font-size 声明...')
  console.log(`  最小字号阈值: ${MIN_FONT_SIZE}px`)
  console.log(`  模式: ${BASELINE_MODE ? 'baseline（仅报告新增违规）' : '严格'}`)
  console.log('─'.repeat(60))

  const files = collectFiles(srcDir, ['.vue', '.scss', '.css'])
  console.log(`  扫描文件数: ${files.length}`)

  const allViolations: Violation[] = []
  for (const file of files) {
    allViolations.push(...checkFile(file))
  }

  const baseline = BASELINE_MODE ? loadBaseline() : {}
  const newViolations = allViolations.filter(v => {
    const key = `${v.file}:${v.line}:${v.col}`
    return !baseline[key]
  })

  console.log(`  总违规数: ${allViolations.length}`)
  if (BASELINE_MODE) {
    console.log(`  baseline 已知: ${allViolations.length - newViolations.length}`)
    console.log(`  新增违规: ${newViolations.length}`)
  }

  if (newViolations.length > 0) {
    console.log('\n  新增违规详情:')
    for (const v of newViolations) {
      console.log(`    ✗ ${v.file}:${v.line}  font-size: ${v.value}  (最小 ${v.minPx}px < ${MIN_FONT_SIZE}px)`)
      console.log(`      ${v.context}`)
    }
    console.error(`\n[check-mobile-fontsize] ${newViolations.length} 处新增违规 ✗`)
    process.exit(1)
  }

  console.log('\n[check-mobile-fontsize] 通过 ✓')
  process.exit(0)
}

main()
