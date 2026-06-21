import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const budgetConfig = (await import('../performance-budget.config.js')).default

const distDir = path.resolve(process.cwd(), 'dist')

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2) + ' kB'
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
  
  let hasWarnings = false
  let hasErrors = false
  const results = []
  
  for (const budget of budgetConfig.budgets) {
    const files = getFilesByType(distDir, budget.resourceType)
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    const budgetBytes = budget.budget * 1024
    const percentage = ((totalSize / budgetBytes) * 100).toFixed(1)
    
    const status = totalSize > budgetBytes ? '❌' : totalSize > budgetBytes * 0.8 ? '⚠️' : '✅'
    
    if (totalSize > budgetBytes) {
      hasErrors = true
    } else if (totalSize > budgetBytes * 0.8) {
      hasWarnings = true
    }
    
    results.push({
      type: budget.resourceType,
      description: budget.description,
      actual: formatSize(totalSize),
      budget: budget.budget + ' kB',
      percentage: percentage + '%',
      status
    })
  }
  
  console.log('\n资源类型预算:')
  console.log('-'.repeat(60))
  
  for (const r of results) {
    console.log(`${r.status} ${r.type.padEnd(12)} | 实际: ${r.actual.padStart(10)} | 预算: ${r.budget.padStart(10)} | 使用率: ${r.percentage}`)
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
