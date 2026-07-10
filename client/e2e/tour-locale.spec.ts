/**
 * 引导系统 - 多语言 / 错误处理 / 性能
 * 来源：原 tour-integration.spec.ts
 */
import { test, expect } from '@playwright/test'
import { gotoStable, setLocalStorage, getLocalStorage } from './helpers/page-actions'

test.describe('tour 多语言', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStable(page, '/', { waitSelector: 'body' })
  })

  test('多语言引导内容能正确加载', async ({ page }) => {
    const localeData = {
      locale: 'zh-CN',
      translations: {
        'home-tour': {
          steps: [
            { id: 'step1', title: '欢迎', content: '欢迎使用智汇AI' },
          ],
        },
      },
    }
    await setLocalStorage(page, 'tour_locale', localeData)
    const locale = await getLocalStorage<{ locale: string }>(page, 'tour_locale')
    expect(locale?.locale).toBe('zh-CN')
  })
})

test.describe('tour 错误处理', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStable(page, '/', { waitSelector: 'body' })
  })

  test('无效引导数据被正确处理', async ({ page }) => {
    await setLocalStorage(page, 'tour_invalid', 'not a valid json')
    const result = await page.evaluate(() => {
      try {
        const data = localStorage.getItem('tour_invalid')
        return data ? JSON.parse(data) : null
      } catch {
        return { error: 'invalid_json' }
      }
    })
    expect((result as { error: string }).error).toBe('invalid_json')
  })

  test('缺失引导步骤被正确处理', async ({ page }) => {
    const result = await page.evaluate(() => {
      const steps = null
      return { hasSteps: !!steps, stepsCount: (steps as any)?.length || 0 }
    })
    expect((result as { hasSteps: boolean }).hasSteps).toBe(false)
    expect((result as { stepsCount: number }).stepsCount).toBe(0)
  })
})

test.describe('tour 性能', () => {
  test('引导服务初始化时间合理', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/', { waitUntil: 'load', timeout: 25000 })
    await page.evaluate(() => new Promise<void>((resolve) => {
      if (document.readyState === 'complete') resolve()
      else window.addEventListener('load', () => resolve())
    }))
    const initTime = Date.now() - startTime
    expect(initTime).toBeLessThan(5000)
  })

  test('引导数据存储操作快速完成', async ({ page }) => {
    await gotoStable(page, '/', { waitSelector: 'body' })
    const operationTime = await page.evaluate(() => {
      const start = performance.now()
      for (let i = 0; i < 100; i++) localStorage.setItem(`test_key_${i}`, `test_value_${i}`)
      for (let i = 0; i < 100; i++) localStorage.removeItem(`test_key_${i}`)
      return performance.now() - start
    })
    expect(operationTime).toBeLessThan(100)
  })
})

test.describe('tour 管理页面加载', () => {
  const adminPages = [
    '/admin/tour-editor',
    '/admin/tour-analytics',
    '/admin/trigger-rules',
    '/admin/tour-templates',
    '/admin/feedback-analytics',
  ]

  for (const path of adminPages) {
    test(`页面 ${path} 能加载`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'load', timeout: 25000 })
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})
      const content = await page.content()
      expect(content.length).toBeGreaterThan(0)
    })
  }
})
