#!/usr/bin/env node
/**
 * ts-prune 死代码扫描包装器 (knip 补充工具)
 *
 * 2026-07-03 创建: 作为 knip 的补充，专门检测未使用的 exports
 *
 * ts-prune 优势:
 *   - 基于 TypeScript Compiler API，精准检测未使用的 export 声明
 *   - 输出格式简洁：file:line - symbolName
 *   - 速度快，适合 CI 集成
 *
 * knip vs ts-prune 分工:
 *   - knip: 文件级 + 依赖级分析，配置驱动，ignore 列表完善
 *   - ts-prune: export 级分析，无配置，纯 TS 编译器扫描
 *   - 两者互补: knip 覆盖文件/依赖维度，ts-prune 覆盖 export 维度
 *
 * 用法:
 *   node scripts/scan-ts-prune.mjs              # 默认扫描
 *   node scripts/scan-ts-prune.mjs --quiet      # 只输出结果，不输出统计
 *   node scripts/scan-ts-prune.mjs --fail-on-unused  # 发现未使用 export 时 exit 1
 *
 * 输出:
 *   - 控制台: 未使用 export 列表 (已过滤 ignore)
 *   - TS_PRUNE_REPORT.md: 完整报告 (含分类 + 建议)
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const failOnUnused = args.includes('--fail-on-unused')
const quiet = args.includes('--quiet')

// 从 knip.json 读取 ignore 列表，保持与 knip 一致的过滤规则
const KNIP_CONFIG_PATH = path.join(ROOT, 'knip.json')
const KNIP_IGNORE = fs.existsSync(KNIP_CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(KNIP_CONFIG_PATH, 'utf-8')).ignore || []
  : []

// ts-prune 额外忽略模式 (knip 不覆盖的 ts-prune 特有误报)
// 注: 路径已规范化 (无前导 /)
const EXTRA_IGNORE_PATTERNS = [
  /src\/open-platform\//,        // 开放平台独立模块
  /src\/components\/ai-generation\//, // AI 生成独立模块
  /src\/templates\//,             // 模板文件
  /src\/open-platform-docs\//,    // 文档
  /\.test\.ts$/,                  // 测试文件
  /\.spec\.ts$/,                  // 测试文件
  /__tests__\//,                  // 测试目录
  /__mocks__\//,                  // mock 目录
  /src\/types\//,                 // 类型定义 (可能被隐式引用)
  /src\/env\//,                   // 环境变量声明
  /src\/shims/,                   // Vue shims
  /^[^/]+\.config\./,             // 根级配置文件 (vite.config.ts, eslint.config.js 等)
  /^config\//,                    // config 目录 (项目配置, 非 src)
  /^scripts\//,                   // scripts 目录
  /^e2e\//,                       // e2e 目录
  /^postcss\.config/,             // postcss 配置
  /^tailwind\.config/,            // tailwind 配置
]

// ts-prune "(used in module)" 标记的 symbol 是同模块内使用, 不是真正的未使用 export
function isUsedInModule(symbol) {
  return /\(used in module\)/.test(symbol)
}

function shouldIgnore(filePath) {
  // 1. 检查 knip.json ignore 列表
  for (const pattern of KNIP_IGNORE) {
    const normalized = pattern.replace(/\*/g, '').replace(/\/$/, '')
    if (normalized && filePath.includes(normalized)) return true
  }
  // 2. 检查额外忽略模式
  for (const pattern of EXTRA_IGNORE_PATTERNS) {
    if (pattern.test(filePath)) return true
  }
  return false
}

function runTsPrune() {
  try {
    const output = execSync('npx ts-prune', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,
    })
    return output
  } catch (e) {
    // ts-prune 在没有未使用 export 时也可能返回非零退出码
    if (e.stdout) return e.stdout.toString()
    console.error('[ts-prune] 执行失败:', e.message)
    process.exit(1)
  }
}

function parseOutput(output) {
  const lines = output.split('\n').filter(Boolean)
  const results = []

  for (const line of lines) {
    // ts-prune 输出格式: path/to/file.ts:line:col - symbolName
    const match = line.match(/^(.+?):(\d+)(?::\d+)?\s*-\s*(.+)$/)
    if (!match) continue

    const [, file, lineNum, symbol] = match
    // 路径规范化: 去掉前导 / 和 Windows 反斜杠
    let relativePath = file.replace(/\\/g, '/').replace(/^\//, '')

    // 跳过 (used in module) 误报 - ts-prune 标记同模块内使用的 export
    if (isUsedInModule(symbol)) continue

    if (shouldIgnore(relativePath)) continue

    results.push({
      file: relativePath,
      line: parseInt(lineNum, 10),
      symbol: symbol.trim(),
    })
  }

  return results
}

function categorizeResults(results) {
  const categories = {
    'src/views/': [],
    'src/components/': [],
    'src/utils/': [],
    'src/api/': [],
    'src/stores/': [],
    'src/composables/': [],
    'src/router/': [],
    'src/styles/': [],
    'src/locales/': [],
    'other': [],
  }

  for (const r of results) {
    let placed = false
    for (const prefix of Object.keys(categories)) {
      if (prefix === 'other') continue
      if (r.file.startsWith(prefix)) {
        categories[prefix].push(r)
        placed = true
        break
      }
    }
    if (!placed) categories.other.push(r)
  }

  return categories
}

function generateReport(results, categories) {
  const lines = [
    '# ts-prune 未使用 Export 扫描报告',
    '',
    `生成时间: ${new Date().toISOString()}`,
    '',
    '## 概览',
    '',
    `- 扫描工具: ts-prune (knip 补充)`,
    `- 未使用 export 总数: ${results.length}`,
    `- 已过滤: knip.json ignore 列表 + 额外 ts-prune 误报模式`,
    '',
    '## 分类统计',
    '',
  ]

  for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue
    lines.push(`### ${category} (${items.length} 个)`)
    lines.push('')
    for (const item of items) {
      lines.push(`- \`${item.file}:${item.line}\` - **${item.symbol}**`)
    }
    lines.push('')
  }

  lines.push('## 说明')
  lines.push('')
  lines.push('- 本报告由 ts-prune 生成，作为 knip 的补充工具')
  lines.push('- ts-prune 专门检测未使用的 TypeScript export 声明')
  lines.push('- 已过滤 knip.json ignore 列表中的文件')
  lines.push('- 可能存在误报：')
  lines.push('  - Vue SFC `<script setup>` 中定义的变量会被 Vue 编译器隐式使用')
  lines.push('  - 通过动态 import 或字符串路径引用的模块')
  lines.push('  - re-export (barrel) 文件中的中间导出')
  lines.push('')

  return lines.join('\n')
}

// 主流程
if (!quiet) {
  console.log('🔍 运行 ts-prune (knip 补充工具)...')
}

const rawOutput = runTsPrune()
const results = parseOutput(rawOutput)

if (!quiet) {
  console.log(`\n📊 ts-prune 扫描结果:`)
  console.log(`   未使用 export: ${results.length} 个 (已过滤 ignore 列表)`)
}

const categories = categorizeResults(results)

if (results.length > 0 && !quiet) {
  console.log('\n分类统计:')
  for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) {
      console.log(`  ${category}: ${items.length} 个`)
    }
  }

  console.log('\n前 20 条:')
  for (const r of results.slice(0, 20)) {
    console.log(`  ${r.file}:${r.line} - ${r.symbol}`)
  }
  if (results.length > 20) {
    console.log(`  ... 还有 ${results.length - 20} 条`)
  }
}

// 写入报告文件
const reportPath = path.join(ROOT, 'TS_PRUNE_REPORT.md')
fs.writeFileSync(reportPath, generateReport(results, categories), 'utf-8')

if (!quiet) {
  console.log(`\n📄 完整报告: ${reportPath}`)
}

if (failOnUnused && results.length > 0) {
  console.error(`\n❌ 发现 ${results.length} 个未使用 export (--fail-on-unused)`)
  process.exit(1)
}

console.log(`\n✅ ts-prune 扫描完成`)
