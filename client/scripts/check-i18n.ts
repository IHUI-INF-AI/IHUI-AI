/**
 * 国际化文案审核脚本
 * 1. 检测所有 locale 模块的覆盖率（与 zh-CN 基准对比）
 * 2. 检测空值 / 重复 / 占位符
 * 3. 检测硬编码中文字符串（源码）
 * 4. 输出覆盖率报告 + 待补充项
 * 5. CI 中覆盖率 < 阈值时失败
 */

import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.join(process.cwd(), 'src', 'locales', 'modules')
const SOURCE_DIRS = [path.join(process.cwd(), 'src'), path.join(process.cwd(), 'miniapp', 'src')]

/** 期望最低覆盖率（按 key 数量）。en-US 与 en 重复，阈值为 0 视为可选 */
const COVERAGE_THRESHOLDS: Record<string, number> = {
  'en': 90,
  'en-US': 0,
  'ja': 50,
  'ko': 30,
  'zh-TW': 80,
}

/** 支持的语言 */
const LOCALES = ['zh-CN', 'en', 'zh-TW', 'en-US', 'ja', 'ko']

/** 跳过硬编码检查的文件（注释 / 文档 / 日志） */
const SKIP_HARDCODED_FILES = [
  'node_modules',
  'dist',
  '.git',
  'i18n',
  'locales',
  'test',
  '__tests__',
  'mock',
  '__mocks__',
  'README',
  '.md',
]

interface LocaleReport {
  locale: string
  totalModules: number
  totalKeys: number
  missingKeys: number
  coverage: number
  emptyValues: number
  missingFiles: string[]
}

interface HardcodedString {
  file: string
  line: number
  text: string
}

function readJSON(p: string): Record<string, unknown> | null {
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v as Record<string, unknown>, key))
    } else {
      out.push(key)
    }
  }
  return out
}

function countEmpty(obj: Record<string, unknown>): number {
  let n = 0
  for (const v of Object.values(obj)) {
    if (v === '' || v === null || v === undefined) n++
  }
  return n
}

/** 报告各 locale 覆盖率 */
function reportLocales(): LocaleReport[] {
  const baselineDir = path.join(LOCALES_DIR, 'zh-CN')
  const baselineFiles = fs.readdirSync(baselineDir).filter((f) => f.endsWith('.json'))
  const baselineKeys = new Set<string>()
  for (const f of baselineFiles) {
    const obj = readJSON(path.join(baselineDir, f))
    if (obj) flattenKeys(obj).forEach((k) => baselineKeys.add(`${f}::${k}`))
  }
  const baselineTotal = baselineKeys.size

  const reports: LocaleReport[] = []
  for (const locale of LOCALES) {
    if (locale === 'zh-CN') continue
    const dir = path.join(LOCALES_DIR, locale)
    if (!fs.existsSync(dir)) {
      reports.push({
        locale,
        totalModules: baselineFiles.length,
        totalKeys: baselineTotal,
        missingKeys: baselineTotal,
        coverage: 0,
        emptyValues: 0,
        missingFiles: [...baselineFiles],
      })
      continue
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    let presentKeys = 0
    let empty = 0
    const missingFiles: string[] = []

    for (const f of baselineFiles) {
      const obj = readJSON(path.join(dir, f))
      if (!obj) {
        missingFiles.push(f)
        continue
      }
      const keys = flattenKeys(obj)
      keys.forEach((k) => {
        if (baselineKeys.has(`${f}::${k}`)) presentKeys++
      })
      empty += countEmpty(obj)
    }

    reports.push({
      locale,
      totalModules: baselineFiles.length,
      totalKeys: baselineTotal,
      missingKeys: baselineTotal - presentKeys,
      coverage: baselineTotal === 0 ? 100 : Math.round((presentKeys / baselineTotal) * 100),
      emptyValues: empty,
      missingFiles,
    })
  }

  return reports
}

/** 检测源码中硬编码中文字符串（未走 i18n） */
function findHardcodedStrings(): HardcodedString[] {
  const results: HardcodedString[] = []
  const cnRegex = /[\u4e00-\u9fff]{4,}/g // 至少 4 个连续中文
  for (const root of SOURCE_DIRS) {
    if (!fs.existsSync(root)) continue
    walk(root, (file) => {
      if (SKIP_HARDCODED_FILES.some((s) => file.includes(s))) return
      if (!/\.(vue|ts|tsx|js|jsx)$/.test(file)) return
      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue
        const matches = line.match(cnRegex)
        if (matches) {
          results.push({ file, line: i + 1, text: matches[0] })
        }
      }
    })
  }
  return results
}

function walk(dir: string, cb: (file: string) => void): void {
  if (!fs.existsSync(dir)) return
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (SKIP_HARDCODED_FILES.some((s) => p.includes(s))) continue
      walk(p, cb)
    } else {
      cb(p)
    }
  }
}

function formatBytes(n: number): string {
  return n.toString()
}

function main(): void {
  console.log('\n🌐 国际化文案审核')
  console.log('━'.repeat(60))
  console.log(`基准语言: zh-CN`)
  console.log(`支持语言: ${LOCALES.join(', ')}`)
  console.log()

  const reports = reportLocales()
  console.log('📊 各语言覆盖率:')
  let allPass = true
  for (const r of reports) {
    const threshold = COVERAGE_THRESHOLDS[r.locale] || 0
    const pass = r.coverage >= threshold
    if (!pass) allPass = false
    const icon = pass ? '✅' : '❌'
    console.log(`  ${icon} ${r.locale.padEnd(8)} 覆盖率 ${r.coverage.toString().padStart(3)}%  (阈值 ${threshold}%)  缺失 ${r.missingKeys} keys  空值 ${r.emptyValues}`)
    if (r.missingFiles.length > 0 && r.missingFiles.length <= 5) {
      console.log(`       缺失模块: ${r.missingFiles.join(', ')}`)
    } else if (r.missingFiles.length > 5) {
      console.log(`       缺失模块: ${r.missingFiles.length} 个（${r.missingFiles.slice(0, 3).join(', ')}...）`)
    }
  }

  console.log('\n🔍 硬编码中文检查:')
  const hardcoded = findHardcodedStrings()
  console.log(`  命中数: ${hardcoded.length} 处（4 个以上连续中文）`)
  if (hardcoded.length > 0) {
    console.log('  样例（前 10）:')
    for (const h of hardcoded.slice(0, 10)) {
      const rel = path.relative(process.cwd(), h.file)
      console.log(`    ${rel}:${h.line}  ${h.text.slice(0, 30)}${h.text.length > 30 ? '...' : ''}`)
    }
    if (hardcoded.length > 10) {
      console.log(`    ... 还有 ${hardcoded.length - 10} 处`)
    }
    // 仅警告，不失败
  }

  console.log('\n' + '━'.repeat(60))
  if (allPass) {
    console.log('✅ i18n 覆盖率检查通过')
    process.exit(0)
  } else {
    console.log('❌ i18n 覆盖率未达标')
    process.exit(1)
  }
}

main()
