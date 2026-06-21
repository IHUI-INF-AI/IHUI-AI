/**
 * 生产构建 smoke 测试
 * - 假设 `npx vite preview --port 4173 --host 127.0.0.1` 已启动
 * - Vite preview 不重写 history 路由（这是部署 nginx 的职责），
 *   故子页面 SPA 内部跳转由 router 自行处理
 * - 验证：首页加载时间、首页 title、首页内容渲染、关键 chunk 已构建
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://127.0.0.1:4173'
const DIST = path.join(process.cwd(), 'dist', 'web')

test.describe('生产构建 smoke', () => {
  test('首页 domcontentloaded < 3s', async ({ page }) => {
    const start = Date.now()
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    const ms = Date.now() - start
    console.log(`[prod] 首页 domcontentloaded ${ms}ms`)
    expect(ms).toBeLessThan(3000)
  })

  test('首页 title 含智汇', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle(/智汇/)
  })

  test('首页内容含核心文案', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    const has = await page.evaluate(() => {
      const t = document.body.innerText
      return t.includes('登录') || t.includes('AI应用') || t.includes('AI社区') || t.includes('AI')
    })
    expect(has, '首页含核心文案').toBeTruthy()
  })

  test('关键 chunk 已构建（vue-vendor/element-plus/locales）', async () => {
    const files = fs.readdirSync(path.join(DIST, 'assets', 'js'))
    const css = fs.readdirSync(path.join(DIST, 'assets', 'css'))
    expect(files.some(f => f.startsWith('vue-vendor')), 'vue-vendor chunk').toBeTruthy()
    expect(files.some(f => f.startsWith('element-plus')), 'element-plus chunk').toBeTruthy()
    expect(files.some(f => f.startsWith('vue-i18n')), 'vue-i18n chunk').toBeTruthy()
    expect(css.some(f => f.startsWith('vue-vendor')), 'vue-vendor css').toBeTruthy()
    // 大型按需组件 chunk 仍需存在（按需加载）
    expect(files.some(f => f.startsWith('AIChat') || f.startsWith('echarts') || f.startsWith('pdf')), '大型按需 chunk').toBeTruthy()
  })

  test('代码 dist 大小 < 30MB（gzip 前；含按需 lazy chunk）', async () => {
    // 只检查 JS + CSS chunks（实际下载到浏览器的代码）
    // 排除 docs / fonts / images 等静态资源（这些不进 SPA 启动路径）
    function dirSize(dir: string, includeExt: string[]): number {
      let total = 0
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name)
        if (f.isDirectory()) total += dirSize(p, includeExt)
        else if (includeExt.some(ext => f.name.endsWith(ext))) total += fs.statSync(p).size
      }
      return total
    }
    const bytes = dirSize(path.join(DIST, 'assets'), ['.js', '.css'])
    const mb = bytes / 1024 / 1024
    console.log(`[prod] 代码 (js+css, gzip 前) = ${mb.toFixed(2)}MB`)
    // 实际 gzip 后约 5-7MB。30MB 是 gzip 前的合理上限。
    expect(mb).toBeLessThan(30)
  })
})

/**
 * 生产构建 Web Vitals 基线（严格阈值）
 * 基于 Google Core Web Vitals 标准:
 *   LCP < 2.5s (良好) / < 4s (需改进)
 *   FCP < 1.8s (良好) / < 3s (需改进)
 *   CLS < 0.1 (良好) / < 0.25 (需改进)
 *   TTFB < 800ms (良好)
 */
test.describe('生产 Web Vitals 基线', () => {
  test('首页 LCP < 2.5s（生产严格阈值）', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __perfVitals: Record<string, number>
        __lcpObserver?: PerformanceObserver
        __clsObserver?: PerformanceObserver
      }
      w.__perfVitals = {}
      try {
        w.__lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number }
          w.__perfVitals.lcp = last.renderTime || last.loadTime || last.startTime
        })
        w.__lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch {
        /* LCP 不可用 */
      }
      try {
        let clsValue = 0
        w.__clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput?: boolean }>) {
            if (!entry.hadRecentInput) clsValue += entry.value
          }
          w.__perfVitals.cls = clsValue
        })
        w.__clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch {
        /* CLS 不可用 */
      }
    })

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const vitals = await page.evaluate(() => {
      const w = window as unknown as { __perfVitals: Record<string, number> }
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      const paints = performance.getEntriesByType('paint')
      const fcp = paints.find((p) => p.name === 'first-contentful-paint')?.startTime
      return {
        ...w.__perfVitals,
        ttfb: nav ? nav.responseStart - nav.requestStart : undefined,
        fcp,
      }
    })

    console.log('[Prod Vitals] 首页:', JSON.stringify(vitals))

    // 生产严格阈值（基于实际数据 1348ms 收紧,提前发现性能退化）
    // 实际数据: LCP 1348ms / FCP 1332ms / CLS 0.048 / TTFB 2.8ms
    if (vitals.fcp !== undefined) {
      expect(vitals.fcp, '生产 FCP < 1.5s（收紧阈值,实际 1332ms）').toBeLessThan(1500)
    }
    if (vitals.lcp !== undefined) {
      expect(vitals.lcp, '生产 LCP < 2.0s（收紧阈值,实际 1348ms）').toBeLessThan(2000)
    }
    if (vitals.cls !== undefined) {
      expect(vitals.cls, '生产 CLS < 0.08（收紧阈值,实际 0.048）').toBeLessThan(0.08)
    }
    if (vitals.ttfb !== undefined) {
      expect(vitals.ttfb, '生产 TTFB < 500ms（收紧阈值,实际 2.8ms）').toBeLessThan(500)
    }
  })
})
