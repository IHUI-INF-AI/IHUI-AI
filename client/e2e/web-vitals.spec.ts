import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

/**
 * Core Web Vitals 基线（Dev 模式）
 * 使用 PerformanceObserver 监听 LCP/FCP/TTFB/CLS 等指标
 * 阈值仅作 dev 参考；生产基线以 build:prod + serve 为准
 */

test('首页 Core Web Vitals（dev 模式基线）', async ({ page }) => {
  // 注入 PerformanceObserver，在导航前就开始监听
  await page.addInitScript(() => {
    const w = window as unknown as {
      __perfVitals: Record<string, number>
      __lcpObserver?: PerformanceObserver
      __clsObserver?: PerformanceObserver
    }
    w.__perfVitals = {}

    // LCP
    try {
      w.__lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number }
        const value = last.renderTime || last.loadTime || last.startTime
        w.__perfVitals.lcp = value
      })
      w.__lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      /* LCP 不可用 */
    }

    // CLS
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

  const start = Date.now()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  // 等 LCP 稳定
  await page.waitForTimeout(2000)
  const totalMs = Date.now() - start

  const vitals = await page.evaluate(() => {
    const w = window as unknown as { __perfVitals: Record<string, number> }
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const paints = performance.getEntriesByType('paint')
    const fcp = paints.find((p) => p.name === 'first-contentful-paint')?.startTime
    return {
      ...w.__perfVitals,
      ttfb: nav ? nav.responseStart - nav.requestStart : undefined,
      domInteractive: nav ? nav.domInteractive : undefined,
      domContentLoaded: nav ? nav.domContentLoadedEventEnd : undefined,
      load: nav ? nav.loadEventEnd : undefined,
      fcp,
    }
  })

  console.log('[Vitals] 首页 dev 性能基线:', JSON.stringify({ totalMs, ...vitals }))

  // Dev 模式宽松阈值（包含 vite 预构建 + ESM 解析开销）
  // 生产阈值见 production-smoke.spec.ts
  if (vitals.fcp !== undefined) {
    expect(vitals.fcp, 'FCP < 5s（dev 模式含预构建）').toBeLessThan(5000)
  }
  if (vitals.lcp !== undefined) {
    expect(vitals.lcp, 'LCP < 8s（dev 模式含预构建）').toBeLessThan(8000)
  }
  if (vitals.cls !== undefined) {
    expect(vitals.cls, 'CLS < 0.5（避免明显抖动）').toBeLessThan(0.5)
  }
  expect(totalMs, '总加载 < 30s').toBeLessThan(30000)
})

test('首页 JS 资源大小（gzip 前）', async ({ page }) => {
  const resources: Array<{ url: string; type: string; size: number; duration: number }> = []
  page.on('response', async (resp) => {
    try {
      const url = resp.url()
      if (!url.includes('127.0.0.1:8888') && !url.includes('localhost:8888')) return
      const ct = (resp.headers()['content-type'] || '').toLowerCase()
      if (!ct.includes('javascript') && !ct.includes('css') && !url.endsWith('.js') && !url.endsWith('.css')) return
      const body = await resp.body().catch(() => null)
      resources.push({ url: url.replace(BASE, ''), type: ct, size: body ? body.length : 0, duration: 0 })
    } catch {
      /* 忽略单个资源 */
    }
  })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(1500)

  const jsTotal = resources.filter((r) => r.type.includes('javascript')).reduce((s, r) => s + r.size, 0)
  const cssTotal = resources.filter((r) => r.type.includes('css')).reduce((s, r) => s + r.size, 0)
  const top = [...resources].sort((a, b) => b.size - a.size).slice(0, 5)
  console.log(`[Resources] JS=${(jsTotal / 1024).toFixed(0)}KB, CSS=${(cssTotal / 1024).toFixed(0)}KB, count=${resources.length}`)
  console.log('[Resources] Top5:', JSON.stringify(top.map((r) => ({ url: r.url, size: r.size }))))

  // Dev 模式单页 < 20MB（Vite 源码 + sourcemap + ESM 解析开销大；生产 < 1MB，gzip 后 < 200KB）
  expect(jsTotal, '首页 JS 总大小 < 20MB（dev 含 sourcemap）').toBeLessThan(20 * 1024 * 1024)
})

/**
 * 多页面性能基线（dev 模式）
 * 覆盖 6 个核心页面,确保所有页面 LCP/FCP 在可接受范围
 */

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'agents', path: '/agents' },
  { name: 'plaza', path: '/plaza' },
  { name: 'vip', path: '/vip' },
  { name: 'tools', path: '/tools' },
]

for (const p of PAGES) {
  test(`多页面性能基线 - ${p.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as {
        __perfVitals: Record<string, number>
        __lcpObserver?: PerformanceObserver
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
    })

    await page.goto(`${BASE}${p.path}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const vitals = await page.evaluate(() => {
      const w = window as unknown as { __perfVitals: Record<string, number> }
      const paints = performance.getEntriesByType('paint')
      const fcp = paints.find((p) => p.name === 'first-contentful-paint')?.startTime
      return { ...w.__perfVitals, fcp }
    })

    console.log(`[Vitals] ${p.name}:`, JSON.stringify(vitals))

    // Dev 模式宽松阈值
    if (vitals.fcp !== undefined) {
      expect(vitals.fcp, `${p.name} FCP < 5s`).toBeLessThan(5000)
    }
    if (vitals.lcp !== undefined) {
      expect(vitals.lcp, `${p.name} LCP < 8s`).toBeLessThan(8000)
    }
  })
}
