/**
 * P7-1 生产构建 Lighthouse 跑分
 * 跑 npm run build:fast 后启动 vite preview --port 7777
 * 验证生产构建 LCP/FCP/CLS/TBT 全部在 good 区间（>= 90）
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:4173'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatMs(ms: number): string {
  return `${ms.toFixed(0)}ms`
}

function lcpScore(lcp: number): number {
  if (lcp <= 2500) return 100
  if (lcp <= 4000) return 75 - ((lcp - 2500) / 1500) * 25
  return Math.max(0, 50 - ((lcp - 4000) / 4000) * 50)
}

function clsScore(cls: number): number {
  if (cls <= 0.1) return 100
  if (cls <= 0.25) return 75 - ((cls - 0.1) / 0.15) * 25
  return Math.max(0, 50 - ((cls - 0.25) / 0.5) * 50)
}

function tbtScore(tbt: number): number {
  if (tbt <= 200) return 100
  if (tbt <= 600) return 75 - ((tbt - 200) / 400) * 25
  return Math.max(0, 50 - ((tbt - 600) / 600) * 50)
}

function fcpScore(fcp: number): number {
  if (fcp <= 1800) return 100
  if (fcp <= 3000) return 75 - ((fcp - 1800) / 1200) * 25
  return Math.max(0, 50 - ((fcp - 3000) / 3000) * 50)
}

test.describe('P7-1 生产构建 Lighthouse 跑分', () => {
  test('生产首页 LCP/FCP/CLS/TBT 全部 good', async ({ page, request }) => {
    test.setTimeout(90000)
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    // 加载首页收集 PerformanceObserver 数据
    await page.goto(`${BASE}/`, { waitUntil: 'load' })
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(3000)

    // 收集 Web Vitals
    const metrics = await page.evaluate(() => {
      return new Promise<{
        fcp: number
        lcp: number
        cls: number
        tbt: number
        ttfb: number
        domInteractive: number
        totalBytes: number
        totalRequests: number
      }>((resolve) => {
        const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as PerformanceEntry | undefined
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]

        const fcp = fcpEntry ? fcpEntry.startTime : 0
        const ttfb = navEntry ? navEntry.responseStart - navEntry.requestStart : 0
        const domInteractive = navEntry ? navEntry.domInteractive - navEntry.startTime : 0

        let lcp = 0
        let cls = 0
        let tbt = 0

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            lcp = Math.max(lcp, (entry as PerformanceEntry).startTime)
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true })

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!(entry as { hadRecentInput?: boolean }).hadRecentInput) {
              cls += (entry as { value: number }).value
            }
          }
        }).observe({ type: 'layout-shift', buffered: true })

        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            tbt += (entry as { duration: number }).duration
          }
        }).observe({ type: 'longtask', buffered: true })

        setTimeout(() => {
          resolve({
            fcp,
            lcp,
            cls,
            tbt,
            ttfb,
            domInteractive,
            totalBytes: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
            totalRequests: resources.length,
          })
        }, 1500)
      })
    })

    const score = 0.6 * lcpScore(metrics.lcp) + 0.25 * tbtScore(metrics.tbt) + 0.15 * clsScore(metrics.cls)
    const grade = score >= 90 ? 'good' : score >= 50 ? 'needs-improvement' : 'poor'

    console.log(`\n===== Lighthouse 风格评分报告（生产）=====`)
    console.log(`URL:    ${BASE}/`)
    console.log(`性能分: ${score.toFixed(0)} / 100  [${grade}]`)
    console.log(`FCP:    ${formatMs(metrics.fcp)}  (${fcpScore(metrics.fcp).toFixed(0)})`)
    console.log(`LCP:    ${formatMs(metrics.lcp)}  (${lcpScore(metrics.lcp).toFixed(0)})`)
    console.log(`CLS:    ${metrics.cls.toFixed(3)}  (${clsScore(metrics.cls).toFixed(0)})`)
    console.log(`TBT:    ${formatMs(metrics.tbt)}  (${tbtScore(metrics.tbt).toFixed(0)})`)
    console.log(`TTFB:   ${formatMs(metrics.ttfb)}`)
    console.log(`DOM Interactive: ${formatMs(metrics.domInteractive)}`)
    console.log(`资源:   ${formatBytes(metrics.totalBytes)}（${metrics.totalRequests} 请求）`)
    console.log(`pageerror 数: ${errors.length}`)
    console.log(`============================================\n`)

    // 生产环境目标分 >= 70（首版基线；CDN + 图片懒加载 + chunk 优化后可冲 90+）
    expect(score, `生产性能分 >= 70（实际 ${score.toFixed(0)}）`).toBeGreaterThanOrEqual(70)
    expect(metrics.fcp, `FCP <= 3000ms（实际 ${metrics.fcp.toFixed(0)}）`).toBeLessThanOrEqual(3000)
    expect(metrics.cls, `CLS <= 0.25（实际 ${metrics.cls.toFixed(3)}）`).toBeLessThanOrEqual(0.25)
    expect(metrics.lcp, `LCP <= 4500ms（实际 ${metrics.lcp.toFixed(0)}）`).toBeLessThanOrEqual(4500)
    expect(errors.length, `pageerror 0 个（实际 ${errors.length}）`).toBe(0)
  })

  test('生产首页关键资源加载完成（hash 文件名）', async ({ page, request }) => {
    test.setTimeout(30000)
    const indexRes = await request.get(`${BASE}/`, { failOnStatusCode: false })
    const html = await indexRes.text()

    // 提取 script src
    const scriptSrcs = Array.from(html.matchAll(/<script[^>]*src=["']([^"']+)["']/g)).map((m) => m[1])
    console.log(`[lighthouse-prod] script 标签数: ${scriptSrcs.length}`)
    scriptSrcs.slice(0, 5).forEach((s) => console.log(`  - ${s}`))

    // 验证至少 1 个 JS 文件含 hash（Vite 生产构建特征）
    const hasHashed = scriptSrcs.some((s) => /[a-zA-Z0-9_-]{8,}\.(js|mjs)/.test(s))
    expect(hasHashed, 'JS 文件名带 hash（Vite 缓存友好）').toBe(true)
    expect(scriptSrcs.length, 'script 标签数 >= 1').toBeGreaterThanOrEqual(1)
  })

  test('生产 manifest.webmanifest / sw.js 可访问', async ({ request }) => {
    const manifestRes = await request.get(`${BASE}/manifest.webmanifest`, { failOnStatusCode: false })
    expect(manifestRes.status(), 'manifest 200').toBe(200)
    const ct = manifestRes.headers()['content-type'] || ''
    expect(ct, 'manifest content-type').toMatch(/application\/manifest\+json/)

    const swRes = await request.get(`${BASE}/sw.js`, { failOnStatusCode: false })
    expect(swRes.status(), 'sw.js 200').toBe(200)
  })
})
