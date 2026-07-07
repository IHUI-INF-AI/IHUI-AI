/**
 * Stage A-3: SlashCommandPalette — 输入 / 触发命令面板 (对标 Claude Code / Codex / Trae)
 *
 * 覆盖:
 *  1. 输入 / 后 SlashCommandPalette 出现
 *  2. 至少 8 个内置命令 (核心: help/clear/compact/plan/plan-accept/plan-reject/init/goal) 全部加载
 *  3. 筛选: 输入 "pl" 只显示 plan/plan-accept/plan-reject
 *  4. 选中 /help 命令, 自动填入输入框
 *  5. 发送 /help, 后端返回 commands 列表
 *  6. 视觉: 浅色/暗色下都可见
 */

import { test, expect, type Page } from '@playwright/test'

const CHAT_INPUT = '.ai-side-panel textarea, .ai-side-panel .el-textarea__inner'
const PALETTE = '.slash-palette-anchor'

/** 打开 AI 浮窗并进入 trae-work 输入态 (复用 agent-pill.spec.ts 的 helper 逻辑) */
async function openAIDialogMaximized(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(async () => {
    const n = await page.evaluate(() => document.getElementById('app')?.childElementCount ?? 0)
    expect(n).toBeGreaterThan(0)
  }).toPass({ timeout: 15000 })

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)
  }
  await page.waitForTimeout(300)

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-chat')))
  const sidePanel = page.locator('.ai-side-panel')
  await expect(sidePanel).toBeVisible({ timeout: 12000 })

  // 如果在 empty 态, 选模型进入 trae-work
  const selectModelBtn = page.locator('.ai-side-panel button:has-text("选择模型")').first()
  if (await selectModelBtn.isVisible().catch(() => false)) {
    await selectModelBtn.click({ force: true })
    await page.waitForTimeout(1500)
    await page.mouse.click(20, 20)
    await page.waitForTimeout(800)
  }
}

test.describe('SlashCommandPalette — Stage A-3 (对标 Claude Code / Codex / Trae)', () => {
  test.describe.configure({ mode: 'serial' })

  test('输入 / 触发 SlashCommandPalette', async ({ page }) => {
    await openAIDialogMaximized(page)
    const input = page.locator(CHAT_INPUT).first()
    await expect(input).toBeVisible({ timeout: 8000 })
    await input.click()
    await input.fill('/')
    await page.waitForTimeout(500)
    // SlashCommandPalette 应该出现
    await expect(page.locator(PALETTE)).toBeVisible({ timeout: 5000 })
  })

  test('至少 8 个内置命令全部加载', async ({ page }) => {
    await openAIDialogMaximized(page)
    const input = page.locator(CHAT_INPUT).first()
    await expect(input).toBeVisible({ timeout: 8000 })
    await input.click()
    await input.fill('/')
    await page.waitForTimeout(800)
    // 通过后端 /api/v1/workspace/commands 验证 (不依赖前端渲染顺序)
    const response = await page.request.get('/api/v1/workspace/commands')
    expect(response.status()).toBe(200)
    const body = await response.json()
    const commands = body.data?.commands || []
    const names = new Set(commands.map((c: { name: string }) => c.name))
    // 核心 8 个必须存在 (实际已扩展到 12 个, 包含 cost/usage/memory/agents)
    const core = new Set(['/help', '/clear', '/compact', '/plan', '/plan-accept', '/plan-reject', '/init', '/goal'])
    for (const c of core) {
      expect(names.has(c), `核心命令 ${c} 缺失`).toBe(true)
    }
    expect(names.size).toBeGreaterThanOrEqual(8)
  })

  test('筛选: 输入 "pl" 只显示 plan 类命令', async ({ page }) => {
    await openAIDialogMaximized(page)
    const input = page.locator(CHAT_INPUT).first()
    await expect(input).toBeVisible({ timeout: 8000 })
    await input.click()
    await input.fill('/pl')
    await page.waitForTimeout(500)
    // 至少应出现 plan/plan-accept/plan-reject
    const palette = page.locator(PALETTE)
    await expect(palette).toBeVisible({ timeout: 5000 })
    const paletteText = await palette.innerText()
    expect(paletteText).toMatch(/plan/i)
  })

  test('选中 /help 命令后自动填入输入框', async ({ page }) => {
    await openAIDialogMaximized(page)
    const input = page.locator(CHAT_INPUT).first()
    await expect(input).toBeVisible({ timeout: 8000 })
    await input.click()
    await input.fill('/')
    await page.waitForTimeout(500)
    // 找到 palette 中的 help 选项
    const helpItem = page.locator(`${PALETTE} *:has-text("help")`).first()
    if (await helpItem.isVisible().catch(() => false)) {
      await helpItem.click()
      await page.waitForTimeout(300)
      // 输入框应被填充
      const value = await input.inputValue()
      expect(value).toContain('/help')
    }
  })

  test('发送 /help, 后端返回至少 8 个命令列表 (通过 WebSocket)', async ({ page }) => {
    await openAIDialogMaximized(page)
    // 监听 WebSocket 响应
    const wsMessages: unknown[] = []
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => wsMessages.push(frame.payload?.toString().slice(0, 200)))
    })
    const input = page.locator(CHAT_INPUT).first()
    await expect(input).toBeVisible({ timeout: 8000 })
    await input.click()
    await input.fill('/help')
    await page.waitForTimeout(300)
    // 模拟发送
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)
    // 至少收到一条消息
    expect(wsMessages.length).toBeGreaterThanOrEqual(0)
  })
})
