import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROOT_DIR = path.resolve(__dirname, '..')
const HISTORY_FILE = path.join(ROOT_DIR, '.performance-history.json')

const PERFORMANCE_BUDGETS = {
  script: { budget: 10000, unit: 'kB', critical: 95 },
  stylesheet: { budget: 4000, unit: 'kB', critical: 90 },
  image: { budget: 20000, unit: 'kB', critical: 90 },
  font: { budget: 60000, unit: 'kB', critical: 90 },
  total: { budget: 100000, unit: 'kB', critical: 90 }
}

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function formatSize(bytes) {
  return (bytes / 1024).toFixed(2)
}

function getBuildStats() {
  const distDir = path.join(ROOT_DIR, 'dist/web')
  if (!fs.existsSync(distDir)) {
    log('❌ 构建目录不存在，请先运行 npm run build', 'red')
    return null
  }

  const stats = {
    script: 0,
    stylesheet: 0,
    image: 0,
    font: 0,
    total: 0,
    timestamp: new Date().toISOString(),
    commit: ''
  }

  try {
    stats.commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim()
  } catch {
    stats.commit = 'unknown'
  }

  function walkDir(dir) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walkDir(fullPath)
      } else {
        const ext = path.extname(entry.name).toLowerCase()
        const size = fs.statSync(fullPath).size
        
        if (['.js', '.mjs'].includes(ext)) {
          stats.script += size
        } else if (['.css'].includes(ext)) {
          stats.stylesheet += size
        } else if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
          stats.image += size
        } else if (['.woff', '.woff2', '.ttf', '.otf', '.eot'].includes(ext)) {
          stats.font += size
        }
        stats.total += size
      }
    }
  }

  walkDir(distDir)
  return stats
}

function loadHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'))
    } catch {
      return []
    }
  }
  return []
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2))
}

function analyzeTrends(history, current) {
  if (history.length < 2) return null

  const previous = history[history.length - 1]
  const trends = {}

  for (const key of Object.keys(PERFORMANCE_BUDGETS)) {
    const diff = current[key] - previous[key]
    const percentChange = previous[key] > 0 ? (diff / previous[key]) * 100 : 0
    trends[key] = {
      diff: formatSize(diff * 1024),
      percentChange: percentChange.toFixed(2),
      direction: diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
    }
  }

  return trends
}

function checkBudgets(stats) {
  const results = []
  
  for (const [type, config] of Object.entries(PERFORMANCE_BUDGETS)) {
    const actualKB = stats[type] / 1024
    const usage = (actualKB / config.budget) * 100
    const status = usage >= config.critical ? 'critical' : usage >= 80 ? 'warning' : 'ok'
    
    results.push({
      type,
      actual: actualKB.toFixed(2),
      budget: config.budget,
      usage: usage.toFixed(1),
      status
    })
  }
  
  return results
}

function generateReport(stats, trends, budgetResults) {
  log('\n' + '='.repeat(70), 'blue')
  log('📊 性能监控报告', 'blue')
  log('='.repeat(70), 'blue')
  log(`\n📅 时间: ${stats.timestamp}`)
  log(`🔗 提交: ${stats.commit}`)

  log('\n📦 资源大小:', 'cyan')
  log('-'.repeat(70))

  for (const result of budgetResults) {
    const statusIcon = result.status === 'critical' ? '🔴' : result.status === 'warning' ? '🟡' : '🟢'
    const trendInfo = trends && trends[result.type] 
      ? ` ${trends[result.type].direction} ${trends[result.type].percentChange}%`
      : ''
    
    log(`${statusIcon} ${result.type.padEnd(12)} | ${result.actual.padStart(10)} kB / ${result.budget} kB | ${result.usage}%${trendInfo}`, 
      result.status === 'critical' ? 'red' : result.status === 'warning' ? 'yellow' : 'green')
  }

  if (trends) {
    log('\n📈 趋势分析:', 'cyan')
    log('-'.repeat(70))
    
    for (const [type, trend] of Object.entries(trends)) {
      const color = trend.direction === '↓' ? 'green' : trend.direction === '↑' ? 'red' : 'reset'
      log(`${type.padEnd(12)} | ${trend.diff} kB (${trend.percentChange}%) ${trend.direction}`, color)
    }
  }

  const criticalCount = budgetResults.filter(r => r.status === 'critical').length
  const warningCount = budgetResults.filter(r => r.status === 'warning').length

  log('\n' + '='.repeat(70), 'blue')
  log('📋 汇总:', 'cyan')
  log(`   🔴 严重: ${criticalCount}`)
  log(`   🟡 警告: ${warningCount}`)
  log(`   🟢 正常: ${budgetResults.length - criticalCount - warningCount}`)

  if (criticalCount > 0) {
    log('\n⚠️ 存在严重性能问题，请立即优化！', 'red')
  } else if (warningCount > 0) {
    log('\n⚠️ 性能预算接近限制，建议优化', 'yellow')
  } else {
    log('\n✅ 性能状态良好', 'green')
  }

  return criticalCount === 0
}

function generateMarkdownReport(stats, trends, budgetResults) {
  const reportPath = path.join(ROOT_DIR, 'PERFORMANCE_REPORT.md')
  
  let md = `# 性能监控报告

> 生成时间: ${stats.timestamp}
> 提交: ${stats.commit}

## 资源大小

| 类型 | 实际大小 | 预算 | 使用率 | 状态 |
|------|---------|------|--------|------|
`

  for (const result of budgetResults) {
    const status = result.status === 'critical' ? '🔴' : result.status === 'warning' ? '🟡' : '🟢'
    md += `| ${result.type} | ${result.actual} kB | ${result.budget} kB | ${result.usage}% | ${status} |\n`
  }

  if (trends) {
    md += `\n## 趋势分析\n\n| 类型 | 变化 | 百分比 |\n|------|------|--------|\n`
    for (const [type, trend] of Object.entries(trends)) {
      md += `| ${type} | ${trend.diff} kB ${trend.direction} | ${trend.percentChange}% |\n`
    }
  }

  md += `\n## 建议\n\n`
  
  const criticalItems = budgetResults.filter(r => r.status === 'critical')
  const warningItems = budgetResults.filter(r => r.status === 'warning')
  
  if (criticalItems.length > 0) {
    md += `### 紧急优化\n`
    for (const item of criticalItems) {
      md += `- **${item.type}**: 使用率 ${item.usage}%，超出预算\n`
    }
  }
  
  if (warningItems.length > 0) {
    md += `### 建议优化\n`
    for (const item of warningItems) {
      md += `- **${item.type}**: 使用率 ${item.usage}%，接近预算限制\n`
    }
  }

  if (criticalItems.length === 0 && warningItems.length === 0) {
    md += `当前性能状态良好，继续保持！\n`
  }

  fs.writeFileSync(reportPath, md)
  log(`\n📄 Markdown 报告已保存到: ${reportPath}`, 'cyan')
}

async function main() {
  const stats = getBuildStats()
  if (!stats) {
    process.exit(1)
  }

  const history = loadHistory()
  const trends = analyzeTrends(history, stats)
  const budgetResults = checkBudgets(stats)

  const isHealthy = generateReport(stats, trends, budgetResults)
  generateMarkdownReport(stats, trends, budgetResults)

  // 保存历史记录
  history.push({
    timestamp: stats.timestamp,
    commit: stats.commit,
    script: stats.script,
    stylesheet: stats.stylesheet,
    image: stats.image,
    font: stats.font,
    total: stats.total
  })

  // 只保留最近 30 条记录
  if (history.length > 30) {
    history.shift()
  }
  saveHistory(history)

  process.exit(isHealthy ? 0 : 1)
}

main().catch(error => {
  log(`\n❌ 错误: ${error.message}`, 'red')
  process.exit(1)
})
