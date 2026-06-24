import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { gzipSync } from 'zlib'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const budgetConfig = (await import('../performance-budget.config.js')).default

// 2026-06-24 优化：只扫描 dist/web（生产部署的平台），不聚合 h5/alipay/electron
// 之前扫描整个 dist 目录，会把所有平台的产物（dist/web + dist/h5 + dist/alipay + dist/electron）叠加，
// 导致统计值虚高、预算告警无法反映真实线上首屏大小。
const platform = budgetConfig.platform || 'web'
const distDir = path.resolve(process.cwd(), 'dist', platform)

/** 计算 buffer 的 gzipped 大小 (kB) */
function gzippedKb(buf) {
  if (!buf || buf.length === 0) return 0
  return gzipSync(buf).length / 1024
}

function formatSize(kb) {
  return kb.toFixed(2) + ' kB'
}

function getFilesByType(dir, type) {
  const files = []

  function walk(currentDir) {
    if (!fs.existsSync(currentDir)) return
    const entries = fs.readdirSync(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        // 2026-06-24 优化：跳过 .map 源映射文件，不计入预算（不影响线上传输）
        if (entry.name.endsWith('.map')) continue
        if (type === 'script' && ext === '.js') {
          files.push({ path: fullPath, size: fs.statSync(fullPath).size })
        } else if (type === 'stylesheet' && ext === '.css') {
          files.push({ path: fullPath, size: fs.statSync(fullPath).size })
        } else if (type === 'image' && ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
          files.push({ path: fullPath, size: fs.statSync(fullPath).size })
        } else if (type === 'font' && ['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(ext)) {
          files.push({ path: fullPath, size: fs.statSync(fullPath).size })
        }
      }
    }
  }

  walk(dir)
  return files
}

function checkBudgets() {
  console.log('\n📊 性能预算检查报告\n')
  console.log('='.repeat(60))
  console.log(`📂 扫描目录: dist/${platform} (生产部署平台单平台)\n`)

  let hasWarnings = false
  let hasErrors = false
  const results = []

  for (const budget of budgetConfig.budgets) {
    const files = getFilesByType(distDir, budget.resourceType)
    // 2026-06-24 优化：使用 gzipped 后大小，更接近真实网络传输量
    const totalSizeKb = files.reduce((sum, f) => sum + gzippedKb(fs.readFileSync(f.path)), 0)
    const budgetKb = budget.budget
    const percentage = ((totalSizeKb / budgetKb) * 100).toFixed(1)

    const status = totalSizeKb > budgetKb ? '❌' : totalSizeKb > budgetKb * 0.8 ? '⚠️' : '✅'

    if (totalSizeKb > budgetKb) {
      hasErrors = true
    } else if (totalSizeKb > budgetKb * 0.8) {
      hasWarnings = true
    }

    results.push({
      type: budget.resourceType,
      description: budget.description,
      actual: formatSize(totalSizeKb),
      budget: budget.budget + ' kB',
      percentage: percentage + '%',
      status,
      fileCount: files.length,
    })
  }

  console.log('\n资源类型预算 (gzipped 后):')
  console.log('-'.repeat(60))

  for (const r of results) {
    console.log(`${r.status} ${r.type.padEnd(12)} | 实际: ${r.actual.padStart(10)} | 预算: ${r.budget.padStart(10)} | 使用率: ${r.percentage.padStart(7)} | ${r.fileCount} 文件`)
    console.log(`   ${r.description}`)
  }

  console.log('\n' + '='.repeat(60))

  if (hasErrors) {
    console.log('\n❌ 性能预算超限！请优化资源大小。')
    process.exit(1)
  } else if (hasWarnings) {
    console.log('\n⚠️ 性能预算接近限制，建议优化。')
  } else {
    console.log('\n✅ 所有性能预算检查通过！')
  }
}

checkBudgets()
