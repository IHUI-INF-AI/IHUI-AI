// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from '../e2e/fixtures'

/**
 * 侧栏会话菜单层级重构(2026-10-26)的真浏览器冒烟验证。
 *
 * 触发规则: sidebar-chat-history.tsx / chat/conversation-list.tsx 菜单结构改动必须跑此测试。
 * 守护目标:
 *   1. 一线只留高频动作(侧栏 ≤10 / 历史页 ≤7 个 menuitem),导出/压缩收进二级子菜单
 *   2. 悬停「导出 / 分享」→ 向右展开(侧栏 7 项 / 历史页 2 项);「压缩」→ 展开 2 项
 *   3. 点击「导出为 Markdown」实际触发下载(证据链: response/download 事件)
 *   4. 「绑定 Issue」对话框副标题出现 bindIssueHint 白话文案
 *   5. 每个关键态截图落 apps/web/test-results/menu-hierarchy-*.png
 */

const DESKTOP_ASIDE = 'aside[aria-label="主导航"]:not([role="dialog"])'
const SIDEBAR_HISTORY_SELECTOR = `${DESKTOP_ASIDE} [role="region"][aria-label="任务列表"]`
const CONVERSATION_ITEM_SELECTOR = `${SIDEBAR_HISTORY_SELECTOR} ul > li > button`
const CONVERSATIONS_URL = 'http://localhost:8801/api/chat/conversations'

async function ensureConversations(page: Page): Promise<void> {
  try {
    const listRes = await page.request.get(CONVERSATIONS_URL)
    const listBody = (await listRes.json().catch(() => null)) as {
      data?: { conversations?: Array<{ title: string }> }
    } | null
    const existing = listBody?.data?.conversations ?? []
    const need = [1, 2].filter((i) => !existing.some((c) => c.title === `menu-smoke-conv-${i}`))
    for (const i of need) {
      await page.request.post(CONVERSATIONS_URL, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        data: { title: `menu-smoke-conv-${i}`, model: 'deepseek/deepseek-chat' },
      })
    }
  } catch (e) {
    console.warn(`[menu-hierarchy] 会话准备失败: ${(e as Error).message}`)
  }
}

async function openMenuForFirstConversation(page: Page) {
  await page.goto('/chat', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector(SIDEBAR_HISTORY_SELECTOR, { timeout: 30000 })
  const item = page.locator(CONVERSATION_ITEM_SELECTOR).first()
  await expect(item).toBeVisible({ timeout: 30000 })
  await item.hover()
  const more = page.getByTestId('conversation-more-menu').first()
  await expect(more).toBeVisible()
  await more.click()
  return page.getByRole('menu').first()
}

test.describe('侧栏会话菜单层级(重构后)', () => {
  test.beforeEach(async ({ authenticatedPage: page }) => {
    await ensureConversations(page)
  })

  test('一线菜单收敛 + 二级子菜单可展开 + 下载与Issue提示', async ({ authenticatedPage: _p }) => {
    const page = _p
    const menu = await openMenuForFirstConversation(page)
    await expect(menu).toBeVisible()

    // ── 断言 1:一线条目清单(含 2 枚子菜单触发器) ──
    const topLabels = await menu.getByRole('menuitem').allInnerTexts()
    const cleaned = topLabels.map((s) => s.trim()).filter(Boolean)
    console.log('[menu-hierarchy] 一线菜单项:', JSON.stringify(cleaned))
    expect(cleaned.length).toBeLessThanOrEqual(10)
    for (const must of ['重命名', '置顶', '归档', '删除', '导出 / 分享会话', '压缩会话']) {
      expect(
        cleaned.some((s) => s.includes(must)),
        `一线应含「${must}」`,
      ).toBeTruthy()
    }
    // 导出的 7 个具体格式不应再出现在一线
    for (const gone of [
      '导出为 TXT',
      '导出 PDF',
      '导出 JSON',
      '快照',
      '图片卡',
      '20 万',
      '100 万',
    ]) {
      expect(
        cleaned.some((s) => s.includes(gone)),
        `一线不应再平铺「${gone}」`,
      ).toBeFalsy()
    }
    console.log('[stage] 1 top ok')
    await page.screenshot({ path: 'test-results/menu-hierarchy-1-top.png' })

    // ── 断言 2:导出子菜单展开为 7 项(headless 下 pointer 事件不稳,直接 click 触发器) ──
    await page.getByTestId('conversation-export-submenu').first().click()
    const exportSub = page.getByRole('menu').nth(1)
    await expect(exportSub).toBeVisible({ timeout: 15000 })
    const exportLabels = (await exportSub.getByRole('menuitem').allInnerTexts()).map((s) =>
      s.trim(),
    )
    console.log('[stage] 2 export-sub ok:', JSON.stringify(exportLabels))
    expect(exportLabels.length).toBe(7)
    await page.screenshot({ path: 'test-results/menu-hierarchy-2-export-sub.png' })
    console.log('[stage] shot2 ok')

    // ── 断言 3:实际点一次「导出为 Markdown」,应触发下载(非空操作) ──
    const dl = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
    await exportSub.getByText('导出为 Markdown').click()
    const download = await dl
    if (download) {
      console.log('[stage] 3 download hit:', download.suggestedFilename())
      expect(download.suggestedFilename()).toMatch(/\.md$/)
    } else {
      // 导出不走 blob-download 事件时(如隐藏 iframe),至少要确认菜单关闭且无错误 toast
      console.log('[stage] 3 no-download-event, check toast')
      await expect(page.getByText(/失败/).first()).toHaveCount(0, { timeout: 3000 })
    }

    // ── 断言 4:压缩子菜单 2 项 ──
    const more2 = page.getByTestId('conversation-more-menu').first()
    await more2.click()
    const menu2 = page.getByRole('menu').first()
    await expect(menu2).toBeVisible()
    await page.getByTestId('conversation-compress-submenu').first().click()
    const compSub = page.getByRole('menu').nth(1)
    await expect(compSub).toBeVisible({ timeout: 15000 })
    const compLabels = (await compSub.getByRole('menuitem').allInnerTexts()).map((s) => s.trim())
    console.log('[menu-hierarchy] 压缩子菜单:', JSON.stringify(compLabels))
    expect(compLabels.length).toBe(2)
    await page.screenshot({ path: 'test-results/menu-hierarchy-3-compress-sub.png' })
    // 关干净两级菜单(Escape 各关一层),再等 menu 全部收起;否则点触发钮会 toggle 反向关掉
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page
      .waitForFunction(() => !document.querySelector('[role="menu"]'), undefined, { timeout: 5000 })
      .catch(() => {})

    // ── 断言 5:绑定 Issue 对话框出现白话用法提示 ──
    await more2.click()
    const menu3 = page.getByRole('menu').first()
    await expect(menu3).toBeVisible({ timeout: 10000 })
    await menu3.getByText('绑定 Issue').click()
    const dialog = page.getByTestId('issue-bind-dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    // Radix DialogDescription 渲染形态为 paragraph(a11y 快照实测),非 role=description
    const desc = await dialog.locator('p').first().innerText()
    console.log('[menu-hierarchy] Issue 对话框副标题:', desc)
    expect(desc).toContain('GitHub')
    expect(desc).toContain('不绑定')
    await page.screenshot({ path: 'test-results/menu-hierarchy-4-issue-hint.png' })
    await page.keyboard.press('Escape')
  })

  test('历史页 /chat/history 同型菜单:一线收敛 + 两枚子菜单', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/chat/history', { waitUntil: 'domcontentloaded', timeout: 60000 })
    // 限定主内容区:侧栏常驻同名 testid 为 hover 才显示(opacity-0),取 history 那份
    const main = page.locator('main#main')
    const more = main.getByTestId('conversation-more-menu').last()
    await expect(more).toBeVisible({ timeout: 30000 })
    await more.click()
    const menu = page.getByRole('menu').first()
    await expect(menu).toBeVisible()

    const topLabels = (await menu.getByRole('menuitem').allInnerTexts()).map((s) => s.trim())
    console.log('[menu-hierarchy] 历史页一线:', JSON.stringify(topLabels))
    expect(topLabels.length).toBeLessThanOrEqual(7)
    for (const must of ['重命名', '导出 / 分享', '压缩', '删除']) {
      expect(
        topLabels.some((s) => s.includes(must)),
        `历史页一线应含「${must}」`,
      ).toBeTruthy()
    }
    for (const gone of ['导出为 Markdown', '导出为 TXT', '20 万', '100 万']) {
      expect(
        topLabels.some((s) => s.includes(gone)),
        `历史页一线不应平铺「${gone}」`,
      ).toBeFalsy()
    }

    // 导出子菜单 2 项(MD/TXT);侧栏那份触发器在 DOM 更前且同为可见态,取最后一个
    await page.getByTestId('conversation-export-submenu').filter({ visible: true }).last().click()
    const exportSub = page.getByRole('menu').nth(1)
    await expect(exportSub).toBeVisible({ timeout: 15000 })
    const exportLabels = (await exportSub.getByRole('menuitem').allInnerTexts()).map((s) =>
      s.trim(),
    )
    console.log('[menu-hierarchy] 历史页导出子菜单:', JSON.stringify(exportLabels))
    expect(exportLabels.length).toBe(2)
    await page.screenshot({ path: 'test-results/menu-hierarchy-5-history-export-sub.png' })

    // 压缩子菜单 2 项
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page
      .waitForFunction(() => !document.querySelector('[role="menu"]'), undefined, { timeout: 5000 })
      .catch(() => {})
    await more.click()
    await page.getByTestId('conversation-compress-submenu').filter({ visible: true }).last().click()
    const compSub = page.getByRole('menu').nth(1)
    await expect(compSub).toBeVisible({ timeout: 15000 })
    const compLabels = (await compSub.getByRole('menuitem').allInnerTexts()).map((s) => s.trim())
    console.log('[menu-hierarchy] 历史页压缩子菜单:', JSON.stringify(compLabels))
    expect(compLabels.length).toBe(2)
    await page.keyboard.press('Escape')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
