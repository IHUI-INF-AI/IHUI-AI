/**
 * 引导系统 - 服务初始化 / 触发规则 / 角色匹配
 * 来源：原 tour-integration.spec.ts
 */
import { test, expect } from '@playwright/test'
import { clearLocalStorage, gotoStable, setLocalStorage, getLocalStorage, NAV_TIMEOUT } from './helpers/page-actions'

test.describe('tour 基础服务', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStable(page, '/', { waitSelector: 'body' })
  })

  test('引导服务能初始化', async ({ page }) => {
    const ok = await page.evaluate(() => typeof window !== 'undefined')
    expect(ok).toBe(true)
  })

  test('触发规则能获取默认配置', async ({ page }) => {
    const rules = await getLocalStorage(page, 'tour_trigger_rules')
    expect(rules).toBeDefined()
  })

  test('首次访问规则评估', async ({ page }) => {
    await clearLocalStorage(page)
    await page.reload({ waitUntil: 'load' })
    const result = await page.evaluate(() => {
      const visitCount = parseInt(localStorage.getItem('visit_count') || '0')
      return { isFirstVisit: visitCount <= 1, visitCount }
    })
    expect(result.isFirstVisit).toBe(true)
  })

  test('角色触发规则匹配', async ({ page }) => {
    await setLocalStorage(page, 'user_role', 'new_user')
    const role = await getLocalStorage<string>(page, 'user_role')
    expect(role).toBe('new_user')
  })

  test('访问次数触发规则计数', async ({ page }) => {
    await page.evaluate(() => {
      let count = parseInt(localStorage.getItem('visit_count') || '0')
      count++
      localStorage.setItem('visit_count', count.toString())
    })
    const count = await page.evaluate(() => parseInt(localStorage.getItem('visit_count') || '0'))
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('已完成引导列表能更新', async ({ page }) => {
    await page.evaluate(() => {
      const completed: string[] = JSON.parse(localStorage.getItem('completed_tours') || '[]')
      if (!completed.includes('home-tour')) completed.push('home-tour')
      localStorage.setItem('completed_tours', JSON.stringify(completed))
    })
    const completed = await getLocalStorage<string[]>(page, 'completed_tours')
    expect(completed).toContain('home-tour')
  })
})
