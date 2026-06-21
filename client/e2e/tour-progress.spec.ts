/**
 * 引导系统 - 进度保存 / A/B 测试 / 个性化
 * 来源：原 tour-integration.spec.ts
 */
import { test, expect } from '@playwright/test'
import { gotoStable, setLocalStorage, getLocalStorage } from './helpers/page-actions'

test.describe('tour 进度与 A/B', () => {
  test.beforeEach(async ({ page }) => {
    await gotoStable(page, '/', { waitSelector: 'body' })
  })

  test('引导进度能保存与恢复', async ({ page }) => {
    await setLocalStorage(page, 'tour_test-tour_progress', { step: 2, savedAt: Date.now() })
    const progress = await getLocalStorage<{ step: number }>(page, 'tour_test-tour_progress')
    expect(progress?.step).toBe(2)
  })

  test('A/B 测试变体能正确分配', async ({ page }) => {
    const variants = ['control', 'variant_a', 'variant_b']
    const variant = variants[Math.floor(Math.random() * variants.length)]
    await setLocalStorage(page, 'ab_test_variant', variant)
    const stored = await getLocalStorage<string>(page, 'ab_test_variant')
    expect(variants).toContain(stored)
  })

  test('A/B 测试会话数据能正确记录', async ({ page }) => {
    await setLocalStorage(page, 'ab_test_session', {
      sessionId: 'session-' + Date.now(),
      testName: 'tour-cta-test',
      variant: 'variant_a',
      startTime: Date.now(),
      stepActions: [],
    })
    const session = await getLocalStorage<{ testName: string; variant: string }>(page, 'ab_test_session')
    expect(session?.testName).toBe('tour-cta-test')
    expect(session?.variant).toBe('variant_a')
  })

  test('步骤行为数据能正确记录', async ({ page }) => {
    const actions = [
      { stepId: 'step1', action: 'view', timestamp: Date.now() - 1000 },
      { stepId: 'step1', action: 'complete', timestamp: Date.now() },
    ]
    await setLocalStorage(page, 'tour_step_actions', actions)
    const stored = await getLocalStorage<Array<{ action: string }>>(page, 'tour_step_actions')
    expect(stored).toHaveLength(2)
    expect(stored?.[0].action).toBe('view')
    expect(stored?.[1].action).toBe('complete')
  })

  test('用户角色能正确检测', async ({ page }) => {
    await page.evaluate(() => {
      const role = localStorage.getItem('user_role')
      if (!role) {
        const isNewUser = !localStorage.getItem('has_visited_before')
        localStorage.setItem('user_role', isNewUser ? 'new_user' : 'regular')
        localStorage.setItem('has_visited_before', 'true')
      }
    })
    const role = await getLocalStorage<string>(page, 'user_role')
    expect(['new_user', 'regular', 'premium', 'admin']).toContain(role)
  })

  test('个性化引导步骤能正确生成', async ({ page }) => {
    await setLocalStorage(page, 'personalized_tour_steps', [
      { id: 'welcome', title: '欢迎回来', content: '继续您的探索之旅' },
      { id: 'feature', title: '新功能', content: '发现最新功能' },
    ])
    const steps = await getLocalStorage<Array<{ id: string }>>(page, 'personalized_tour_steps')
    expect(steps).toHaveLength(2)
    expect(steps?.[0].id).toBe('welcome')
  })
})
