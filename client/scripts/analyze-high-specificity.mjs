/**
 * 分析高特异性选择器来源
 *
 * 启动开发服务器后用 Playwright 访问核心页面，
 * 收集所有 4 类以上的选择器，并标注其来源样式表（href）
 */
import { chromium } from '@playwright/test'

const PAGES = [
  { path: '/', name: '首页' },
  { path: '/vip', name: 'VIP 页' },
  { path: '/about', name: '关于我们' },
  { path: '/open', name: '开放平台' },
]

const BASE = process.env.BASE_URL || 'http://localhost:8888'

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const all = []

  for (const p of PAGES) {
    try {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
      await page.waitForTimeout(2000)

      const found = await page.evaluate(() => {
        const bad = []
        for (const sheet of document.styleSheets) {
          const href = sheet.href || '(inline)'
          try {
            const rules = sheet.cssRules || []
            for (const rule of rules) {
              if (rule.selectorText) {
                const classCount = (rule.selectorText.match(/\.[a-zA-Z_-][\w-]*/g) || []).length
                if (classCount >= 4) {
                  bad.push({ selector: rule.selectorText.slice(0, 120), href })
                }
              }
            }
          } catch (_e) {
            // 跨域样式表跳过
          }
        }
        return bad
      })

      for (const f of found) {
        all.push({ ...f, page: p.name })
      }
    } catch (e) {
      console.error(`✗ ${p.name} 访问失败:`, String(e).slice(0, 100))
    }
  }

  await browser.close()

  // 按来源分组统计
  const byHref = new Map()
  for (const item of all) {
    if (!byHref.has(item.href)) {
      byHref.set(item.href, { count: 0, samples: [], pages: new Set() })
    }
    const entry = byHref.get(item.href)
    entry.count++
    entry.pages.add(item.page)
    if (entry.samples.length < 3) entry.samples.push(item.selector)
  }

  console.log('\n========== 高特异性选择器来源分析 ==========\n')
  console.log(`总计 ${all.length} 个高特异性选择器（4 类以上）\n`)

  const sorted = [...byHref.entries()].sort((a, b) => b[1].count - a[1].count)
  for (const [href, info] of sorted) {
    console.log(`【来源】${href}`)
    console.log(`  数量: ${info.count}`)
    console.log(`  出现页面: ${[...info.pages].join(', ')}`)
    console.log(`  样本:`)
    info.samples.forEach((s) => console.log(`    - ${s}`))
    console.log()
  }

  // 判断是否为 Element Plus
  const epCount = [...byHref.keys()]
    .filter((h) => h.includes('element-plus') || h.includes('el-'))
    .reduce((sum, h) => sum + byHref.get(h).count, 0)
  const projectCount = all.length - epCount

  console.log('========== 结论 ==========')
  console.log(`Element Plus 样式表: ${epCount} 个`)
  console.log(`项目代码样式表: ${projectCount} 个`)
  if (projectCount === 0) {
    console.log('✓ 所有高特异性选择器均来自 Element Plus 组件库，非项目代码，无需修复')
  } else {
    console.log('⚠️  存在项目代码中的高特异性选择器，建议优化')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
