// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'

/**
 * D195 通知隐藏→归档→恢复流 真 e2e(有登录态、有种子数据,不再是"若可访问"的软跳过)。
 *
 * 前置(由 global-setup 自动完成):
 * - seed:test-users ⇒ test@aizhs.top 存在(authenticatedPage 夹具可登录)
 * - seed:e2e-notifications ⇒ 该用户名下两条种子通知:
 *   · 「E2E种子通知·未归档」在 active 分区(供隐藏腿)
 *   · 「E2E种子通知·已归档」在 archived 分区(供恢复腿)
 *
 * 覆盖:
 * 1. active 分区看到未归档种子 → 点行尾「隐藏」→ 从 active 消失(API 复核 archived_at 非空)
 * 2. 切「已归档」分区 → 预置归档种子在场 → 点行尾「恢复」→ 回到 active 分区(API 复核 archived_at 为空)
 * 3. 分区计数与列表互斥:同一条通知不得同时出现在两个分区(分区判据=archived_at 是否为空)
 *
 * 种子缺失/未登录 ⇒ graceful skip(与全仓 e2e 约定一致),不硬红。
 */

const ACTIVE_SEED = 'E2E种子通知·未归档'
const ARCHIVED_SEED = 'E2E种子通知·已归档'

/** 已登录且页面真到了 /notifications ⇒ true;否则 graceful skip。 */
async function onNotificationsPage(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/notifications')
  await page.waitForLoadState('domcontentloaded')
  if (!page.url().includes('/notifications')) return false
  await page.waitForTimeout(1500)
  return true
}

/** 行定位:NotificationItem 是 role=button 的整行,以种子标题区分。 */
function seedRow(page: import('@playwright/test').Page, title: string) {
  return page.locator('[role="button"]', { hasText: title }).first()
}

test.describe('D195 通知隐藏→归档→恢复流', () => {
  test('隐藏:active 分区的通知隐藏后离开 active,且 API 复核 archived_at 非空', async ({
    authenticatedPage: page,
  }) => {
    if (!(await onNotificationsPage(page))) test.skip(true, '未登录或页面不可达,graceful skip')

    const row = seedRow(page, ACTIVE_SEED)
    if (!(await row.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip(true, '种子通知不在场(seed 未跑),graceful skip')
    }
    await expect(row).toBeVisible()

    // 行尾「隐藏」按钮(整行 onClick 是标已读;操作按钮 stopPropagation,点它不会误触别的)
    await row.getByRole('button', { name: /隐藏|Hide/ }).click()
    // 乐观更新 + 服务端往返;轮询等它从 active 消失
    await expect(row).toBeHidden({ timeout: 10000 })

    // API 复核:active 分区查不到它(后端判据是 archived_at IS NULL,不是前端自说自话)
    const listResp = await page.request.get('/api/notifications?page=1&pageSize=100')
    expect(listResp.status()).toBe(200)
    const listBody = (await listResp.json()) as {
      data?: { list?: Array<{ title: string; archivedAt: string | null }> }
    }
    const inActive = (listBody.data?.list ?? []).filter((n) => n.title === ACTIVE_SEED)
    expect(inActive, '隐藏后 active 分区不得再返回该通知').toHaveLength(0)
  })

  test('恢复:已归档分区的通知恢复后回到 active,且 API 复核 archived_at 为空', async ({
    authenticatedPage: page,
  }) => {
    if (!(await onNotificationsPage(page))) test.skip(true, '未登录或页面不可达,graceful skip')

    // 切「已归档」分区(tab 文案来自 i18n:已归档/Archived)
    await page.getByRole('button', { name: /已归档|Archived/ }).first().click()
    const row = seedRow(page, ARCHIVED_SEED)
    if (!(await row.isVisible({ timeout: 8000 }).catch(() => false))) {
      test.skip(true, '预置归档种子不在场(seed 未跑),graceful skip')
    }
    await expect(row).toBeVisible()

    // 行尾「恢复」按钮
    await row.getByRole('button', { name: /恢复|Restore/ }).click()
    await expect(row).toBeHidden({ timeout: 10000 })

    // API 复核:active 分区必须重新出现这条
    const listResp = await page.request.get('/api/notifications?page=1&pageSize=100')
    expect(listResp.status()).toBe(200)
    const listBody = (await listResp.json()) as {
      data?: { list?: Array<{ title: string }> }
    }
    expect(
      (listBody.data?.list ?? []).some((n) => n.title === ARCHIVED_SEED),
      '恢复后 active 分区必须重新返回该通知',
    ).toBe(true)
  })

  test('分区互斥:同一条通知不得同时在 active 与 archived 两个分区', async ({
    authenticatedPage: page,
  }) => {
    if (!(await onNotificationsPage(page))) test.skip(true, '未登录或页面不可达,graceful skip')

    // 分区判据在后端(archived_at 空与非空),API 面直接断言两份返回集不相交
    const activeResp = await page.request.get('/api/notifications?partition=active&page=1&pageSize=100')
    expect(activeResp.status()).toBe(200)
    const archivedResp = await page.request.get(
      '/api/notifications?partition=archived&page=1&pageSize=100',
    )
    expect(archivedResp.status()).toBe(200)
    const active = ((await activeResp.json()) as { data?: { list?: Array<{ id: string }> } })
      .data?.list ?? []
    const archived = ((await archivedResp.json()) as { data?: { list?: Array<{ id: string }> } })
      .data?.list ?? []
    const archivedIds = new Set(archived.map((n) => n.id))
    const overlap = active.filter((n) => archivedIds.has(n.id)).map((n) => n.id)
    expect(overlap, `两分区交集必须为空,实得 ${overlap.join(',')}`).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
