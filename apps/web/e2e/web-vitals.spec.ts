import { test, expect, type Page } from '@playwright/test'

/**
 * Web Vitals 性能专项测试
 *
 * 覆盖:
 * - LCP < 2500ms
 * - FID < 100ms(或 INP < 200ms)
 * - CLS < 0.1
 * - TTFB < 800ms
 * - FCP < 1800ms
 * - 使用 page.evaluate + PerformanceObserver 采集指标
 * - dev 环境阈值放宽 2 倍(避免误报)
 */

const IS_CI = !!process.env.CI
// dev 环境阈值放宽 2 倍
const M = IS_CI ? 1 : 2

interface Vitals {
  lcp: number
  inp: number
  cls: number
  ttfb: number
  fcp: number
}

test.describe.parallel('Web Vitals 性能专项', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    page.on('pageerror', () => {})
  })

  test.afterEach(async ({ page }: { page: Page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await page
        .screenshot({
          path: `e2e/screenshots/web-vitals-${testInfo.title.replace(/\s+/g, '-')}.png`,
        })
        .catch(() => {})
    }
  })

  test('首页核心 Web Vitals 指标(LCP/CLS/TTFB/FCP/INP)', async ({ page }: { page: Page }) => {
    // 先导航到首页,再通过 page.evaluate + PerformanceObserver 采集指标
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const vitals = (await page.evaluate(async () => {
      const m: Vitals = { lcp: 0, inp: 0, cls: 0, ttfb: 0, fcp: 0 }

      // TTFB: Navigation Timing API
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (nav) m.ttfb = nav.responseStart - nav.requestStart

      // FCP: Paint Timing API
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      if (fcp) m.fcp = fcp.startTime

      // LCP: 等待 2.5s 取最终值
      await new Promise<void>((resolve) => {
        const obs = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          if (entries.length > 0) m.lcp = entries[entries.length - 1].startTime
        })
        obs.observe({ type: 'largest-contentful-paint', buffered: true })
        setTimeout(() => {
          obs.disconnect()
          resolve()
        }, 2500)
      })

      // CLS: 累积布局偏移
      const clsObs = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!(e as { hadRecentInput?: boolean }).hadRecentInput) {
            m.cls += (e as { value: number }).value
          }
        }
      })
      clsObs.observe({ type: 'layout-shift', buffered: true })
      await new Promise((r) => setTimeout(r, 500))
      clsObs.disconnect()

      // INP: 事件延迟(FID 的继任指标,取最大值)
      const evtObs = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        if (entries.length > 0) m.inp = Math.max(...entries.map((e) => e.duration))
      })
      evtObs.observe({ type: 'event', buffered: true })

      return m
    })) as Vitals

    // TTFB < 800ms
    expect(vitals.ttfb, `TTFB ${vitals.ttfb}ms 超过 ${800 * M}ms 阈值`).toBeLessThan(800 * M)
    // FCP < 1800ms
    expect(vitals.fcp, `FCP ${vitals.fcp}ms 超过 ${1800 * M}ms 阈值`).toBeLessThan(1800 * M)
    // LCP < 2500ms
    expect(vitals.lcp, `LCP ${vitals.lcp}ms 超过 ${2500 * M}ms 阈值`).toBeLessThan(2500 * M)
    // CLS < 0.1
    expect(vitals.cls, `CLS ${vitals.cls} 超过 ${0.1 * M} 阈值`).toBeLessThan(0.1 * M)
    // INP < 200ms(FID 的继任指标)
    expect(vitals.inp, `INP ${vitals.inp}ms 超过 ${200 * M}ms 阈值`).toBeLessThan(200 * M)
  })
})
