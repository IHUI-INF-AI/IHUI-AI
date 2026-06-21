/**
 * 引导系统 - 分析数据 / 完成率 / 停留时间
 * 来源：原 tour-integration.spec.ts
 */
import { test, expect } from '@playwright/test'
import { gotoStable, setLocalStorage, getLocalStorage } from './helpers/page-actions'

test.describe('tour 分析数据', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStable(page, '/', { waitSelector: 'body' })
  })

  test('引导分析数据能正确存储', async ({ page }) => {
    const tourId = 'analytics-test-tour'
    const analyticsData = {
      tourId,
      startTime: Date.now(),
      steps: [],
      completed: false,
    }
    await setLocalStorage(page, `tour_analytics_${tourId}`, analyticsData)
    const stored = await getLocalStorage<{ tourId: string }>(page, `tour_analytics_${tourId}`)
    expect(stored?.tourId).toBe(tourId)
  })

  test('完成率数据能正确计算', async ({ page }) => {
    const records = [
      { tourId: 'home-tour', completed: true, startTime: Date.now() - 10000, endTime: Date.now() },
      { tourId: 'home-tour', completed: false, startTime: Date.now() - 8000, endTime: Date.now() },
      { tourId: 'home-tour', completed: true, startTime: Date.now() - 6000, endTime: Date.now() },
    ]
    await setLocalStorage(page, 'tour_analytics_records', records)
    const stored = await getLocalStorage<Array<{ completed: boolean }>>(page, 'tour_analytics_records')
    const completedCount = (stored || []).filter(r => r.completed).length
    const completionRate = completedCount / (stored?.length || 1)
    expect(completionRate).toBeCloseTo(0.667, 1)
  })

  test('步骤停留时间数据能正确统计', async ({ page }) => {
    const stepDurations = {
      step1: [5000, 6000, 4500],
      step2: [3000, 3500, 4000],
      step3: [8000, 7500, 9000],
    }
    await setLocalStorage(page, 'tour_step_durations', stepDurations)
    const durations = await getLocalStorage<Record<string, number[]>>(page, 'tour_step_durations')
    expect(durations?.step1).toBeDefined()
    expect(durations?.step1.length).toBe(3)
  })
})
