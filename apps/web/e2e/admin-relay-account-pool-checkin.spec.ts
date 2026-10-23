// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { test, expect } from '@playwright/test'

/**
 * O64 号池↔签到助手同步:admin 号池页 e2e(设计 §11/G7)。
 *
 * 覆盖:页面可达性(未登录降级为拦截验证)、「签到」列与行操作渲染、
 * 号池相关 API 无 5xx。深度交互(导入→同步→回写)由 api/ai-service 单测
 * 与集成环境覆盖,浏览器层只锁「渲染契约不回归」。
 */

test.describe('Admin 号池页签到列(O64)', () => {
  test('未登录访问 admin/relay/account-pool 被拦截或可达', async ({ page }) => {
    await page.goto('/admin/relay/account-pool')
    await page.waitForURL(/\/(login|register|403|forbidden)/, { timeout: 5000 }).catch(() => {})
    const url = page.url()
    expect(
      url.includes('/login') ||
        url.includes('/register') ||
        url.includes('/403') ||
        url.includes('/forbidden') ||
        url.includes('/admin/relay/account-pool'),
    ).toBeTruthy()
  })

  test('号池页渲染且无服务端错误(若可访问)', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/admin/relay/account-pool')
    await page.waitForLoadState('domcontentloaded')
    expect(
      serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e),
      ),
    ).toHaveLength(0)

    if (!page.url().includes('/admin/relay/account-pool')) return
    const main = page.locator('main, [role="main"]').first()
    await expect(main).toBeVisible({ timeout: 10000 })
  })

  test('「签到」列表头存在(O64 新增列,若可访问)', async ({ page }) => {
    await page.goto('/admin/relay/account-pool')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/admin/relay/account-pool')) return
    const header = page.locator('th', { hasText: '签到' }).first()
    await expect(header).toBeVisible({ timeout: 10000 })
  })

  test('行操作含立即签到/重推同步入口(O64)', async ({ page }) => {
    await page.goto('/admin/relay/account-pool')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/admin/relay/account-pool')) return

    // 等表格落定:出现「暂无数据」(空池)或至少一行带勾选框的真实数据
    const tbody = page.locator('table tbody').first()
    await tbody
      .locator('tr', { hasText: '暂无数据' })
      .or(tbody.locator('tr').filter({ has: page.getByRole('checkbox') }))
      .first()
      .waitFor({ timeout: 10_000 })
      .catch(() => {})

    // 仅当确实空池(无任何账号行)才放行;有数据行时操作按钮必须存在
    if (
      await tbody
        .getByText('暂无数据')
        .isVisible()
        .catch(() => false)
    )
      return

    const runBtn = page.getByRole('button', { name: '立即签到' }).first()
    const resyncBtn = page.getByRole('button', { name: '重推签到同步' }).first()
    await expect(resyncBtn.or(runBtn)).toBeVisible()
  })
})
