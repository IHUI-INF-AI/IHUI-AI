#!/usr/bin/env node
/**
 * 死代码扫描器 (持久化工具)
 *
 * 2026-07-02 创建: 扫描 src/views + src/components + src/utils 下未被引用的文件
 *
 * 用法:
 *   node scripts/scan-dead-code.mjs
 *   node scripts/scan-dead-code.mjs --dir views    # 只扫 views
 *   node scripts/scan-dead-code.mjs --dir components  # 只扫 components
 *   node scripts/scan-dead-code.mjs --dir utils       # 只扫 utils
 *
 * 输出:
 *   DEAD_CODE_FULL_REPORT.md — 完整报告(含分类 + 误报标注)
 *
 * 判定标准:
 *   - views: 文件路径在 src/ 全局无 import/require/字符串引用
 *   - components: 文件路径 + PascalCase 组件名在 src/ 全局无引用
 *   - utils: 文件路径在 src/ 全局无 import/require 引用
 *
 * 已知 false positive:
 *   - 子组件/Dialog 通过 <ComponentName /> 引用,路径中无文件名
 *   - 动态 import (import(`@/views/${name}`)) 无法被静态扫描
 *   - utils 函数通过 re-export (index.ts barrel) 引用
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

// 命令行参数
const args = process.argv.slice(2)
const dirArgIdx = args.indexOf('--dir')
const targetDir = dirArgIdx >= 0 ? args[dirArgIdx + 1] : 'all'

const SCAN_DIRS = {
  views: path.join(SRC, 'views'),
  components: path.join(SRC, 'components'),
  utils: path.join(SRC, 'utils'),
}

const EXTENSIONS = {
  views: ['.vue'],
  components: ['.vue'],
  utils: ['.ts'],
}

// 忽略目录
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.vite', 'storybook-static', 'playwright-report', '__tests__', '__mocks__'])

// 收集目录下所有文件
function collectFiles(dir, exts, base = dir, list = []) {
  if (!fs.existsSync(dir)) return list
  for (const f of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(f)) continue
    const full = path.join(dir, f)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      collectFiles(full, exts, base, list)
    } else if (exts.some((ext) => f.endsWith(ext))) {
      list.push({
        abs: full,
        rel: path.relative(base, full).replace(/\\/g, '/'),
        relFromSrc: path.relative(SRC, full).replace(/\\/g, '/'),
        basename: path.basename(full, path.extname(full)),
        size: stat.size,
      })
    }
  }
  return list
}

// 收集 src 下所有文件(用于 grep)
function collectAllSrcFiles(dir = SRC, list = []) {
  if (!fs.existsSync(dir)) return list
  for (const f of fs.readdirSync(dir)) {
    if (IGNORE_DIRS.has(f)) continue
    const full = path.join(dir, f)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      collectAllSrcFiles(full, list)
    } else {
      list.push(full)
    }
  }
  return list
}

const allSrcFiles = collectAllSrcFiles()

// 缓存文件内容
const contentCache = new Map()
function getContent(filePath) {
  if (!contentCache.has(filePath)) {
    try {
      contentCache.set(filePath, fs.readFileSync(filePath, 'utf-8'))
    } catch {
      contentCache.set(filePath, null)
    }
  }
  return contentCache.get(filePath)
}

// 搜索引用
function searchReferences(file, scanType) {
  const refs = []
  const { relFromSrc, basename, abs } = file
  const ext = path.extname(abs)

  // 搜索词: 文件路径 + 组件名(components 额外搜 PascalCase)
  const searchTerms = [
    `'@/${relFromSrc}`,
    `"@/${relFromSrc}"`,
    `'@/${relFromSrc.replace(/\.(vue|ts)$/, '')}`,
    `"@/${relFromSrc.replace(/\.(vue|ts)$/, '')}"`,
    `'./${basename}'`,
    `"./${basename}"`,
    `'./${basename}.vue'`,
    `'./${basename}.ts'`,
  ]

  // 相对子路径引用 (如 './distribution/components/Foo.vue', '../shared/Bar.vue')
  // 用 basename + ext 作为搜索词, 能覆盖任意相对路径深度
  if (ext === '.vue') {
    searchTerms.push(`/${basename}.vue'`, `/${basename}.vue"`)
  } else if (ext === '.ts') {
    searchTerms.push(`/${basename}.ts'`, `/${basename}.ts"`)
    // ts 文件可能不带扩展名引用
    searchTerms.push(`/${basename}'`, `/${basename}"`)
  }

  // components 额外搜 PascalCase 组件名
  if (scanType === 'components') {
    // PascalCase: MyComponent
    searchTerms.push(`<${basename}>`, `<${basename} `, `</${basename}>`)
    // 也搜 import XxxName from (basename 作为 import 名)
    searchTerms.push(basename)
  }

  // utils 额外搜文件名(不带扩展名)作为模块引用
  if (scanType === 'utils') {
    searchTerms.push(`'@/utils/${basename}'`, `"@/utils/${basename}"`)
    searchTerms.push(`from '@/utils/${basename}'`)
    searchTerms.push(`from "./${basename}"`)
    searchTerms.push(`from "./${basename}.js"`)
  }

  for (const srcFile of allSrcFiles) {
    // 跳过自身
    if (srcFile === abs) continue
    const content = getContent(srcFile)
    if (!content) continue

    for (const term of searchTerms) {
      if (content.includes(term)) {
        refs.push({
          file: path.relative(ROOT, srcFile).replace(/\\/g, '/'),
          term: term.slice(0, 60),
        })
        break // 找到一个引用即可
      }
    }
  }

  return refs
}

// 主逻辑
const dirsToScan = targetDir === 'all' ? Object.keys(SCAN_DIRS) : [targetDir]
const results = {}

for (const dirName of dirsToScan) {
  const dirPath = SCAN_DIRS[dirName]
  const exts = EXTENSIONS[dirName]
  const files = collectFiles(dirPath, exts)
  const orphans = []
  const referenced = []

  for (const file of files) {
    const refs = searchReferences(file, dirName)
    if (refs.length === 0) {
      orphans.push(file)
    } else {
      referenced.push({ file, refs })
    }
  }

  results[dirName] = { total: files.length, orphans, referenced }
}

// 生成报告
const report = []
report.push('# 死代码完整扫描报告')
report.push('')
report.push(`> 生成时间: ${new Date().toISOString()}`)
report.push(`> 扫描范围: ${dirsToScan.map((d) => `src/${d}`).join(' + ')}`)
report.push(`> 判定标准: 文件路径 + 组件名在 src/ 全局无 import/require/标签引用`)
report.push('')

let totalFiles = 0
let totalOrphans = 0
for (const [dirName, data] of Object.entries(results)) {
  totalFiles += data.total
  totalOrphans += data.orphans.length
  report.push(`## src/${dirName}/ — ${data.orphans.length}/${data.total} 未引用`)
  report.push('')
  if (data.orphans.length > 0) {
    report.push('| # | 路径 | 大小 |')
    report.push('|---|------|------|')
    data.orphans.sort((a, b) => a.rel.localeCompare(b.rel)).forEach((f, i) => {
      report.push(`| ${i + 1} | \`${f.relFromSrc}\` | ${(f.size / 1024).toFixed(1)} KB |`)
    })
  } else {
    report.push('✅ 全部文件都有引用')
  }
  report.push('')
}

report.push('---')
report.push(`## 总计`)
report.push(`- 扫描文件: ${totalFiles}`)
report.push(`- 未引用: ${totalOrphans}`)
report.push(`- 已引用: ${totalFiles - totalOrphans}`)
report.push('')
report.push('## 已知限制')
report.push('- 动态 import (如 `import(\`@/views/\${name}\`)`) 无法被静态扫描')
report.push('- 通过 index.ts barrel re-export 的 utils 函数可能误报')
report.push('- components 子组件通过 `<ComponentName />` 引用, 已搜标签名但可能有命名变体')
report.push('- e2e 测试中的引用不在 src/ 范围内, 可能误报')

const reportPath = path.join(ROOT, '..', 'DEAD_CODE_FULL_REPORT.md')
fs.writeFileSync(reportPath, report.join('\n'))

// 控制台摘要
console.log('=== 死代码扫描完成 ===')
for (const [dirName, data] of Object.entries(results)) {
  console.log(`src/${dirName}/: ${data.orphans.length}/${data.total} 未引用`)
}
console.log(`\n总计: ${totalOrphans}/${totalFiles} 未引用`)
console.log(`报告已写入: ${path.relative(ROOT, reportPath)}`)
