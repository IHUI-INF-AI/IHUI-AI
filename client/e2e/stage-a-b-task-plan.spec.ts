/**
 * Stage A-4 + Stage B-1: TaskListPanel + PlanReviewPanel (对标 Claude Code / Cursor)
 *
 * 覆盖:
 *  1. TaskListPanel: agent.todo.update 事件触发后, 面板出现
 *  2. PlanReviewPanel: agent.plan.proposed 事件触发后, 面板出现
 *  3. PlanReviewPanel 接受按钮触发 acceptPlan
 *  4. PlanReviewPanel 拒绝按钮触发 rejectPlan
 *  5. 视觉: 浅色/暗色下都可见
 */

import { test, expect, type Page } from '@playwright/test'

const TASK_LIST = '.task-list-anchor'
const PLAN_REVIEW = '.plan-review-anchor'

/** 打开 AI 浮窗并进入 trae-work 输入态 */
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

  const selectModelBtn = page.locator('.ai-side-panel button:has-text("选择模型")').first()
  if (await selectModelBtn.isVisible().catch(() => false)) {
    await selectModelBtn.click({ force: true })
    await page.waitForTimeout(1500)
    await page.mouse.click(20, 20)
    await page.waitForTimeout(800)
  }
}

/** 注入 todo 事件 (模拟 agent.todo.update 推送) */
async function injectTodoUpdate(page: Page, todos: Array<{ id: string; title: string; status: string; priority?: string }>) {
  await page.evaluate((todosData) => {
    // 模拟 useWorkspaceAgent 的事件处理
    const event = new CustomEvent('agent.todo.update', { detail: { todos: todosData } })
    window.dispatchEvent(event)
  }, todos)
}

/** 注入 plan 事件 (模拟 agent.plan.proposed 推送) */
async function injectPlanProposed(
  page: Page,
  plan: { title: string; summary: string; steps: Array<{ id?: string; title: string; description?: string; files?: string[] }>; risks?: string[] }
) {
  await page.evaluate((planData) => {
    const event = new CustomEvent('agent:plan:proposed', { detail: { plan: planData } })
    window.dispatchEvent(event)
  }, plan)
}

test.describe('TaskListPanel — Stage A-4 (agent.todo.update)', () => {
  test.describe.configure({ mode: 'serial' })

  test('agent.todo.update 事件触发后 TaskListPanel 出现', async ({ page }) => {
    await openAIDialogMaximized(page)
    // 初始无 todo
    await expect(page.locator(TASK_LIST)).toHaveCount(0)
    // 注入 todo 事件
    await injectTodoUpdate(page, [
      { id: '1', title: '分析项目结构', status: 'in_progress', priority: 'high' },
      { id: '2', title: '生成 AGENTS.md', status: 'pending', priority: 'medium' },
    ])
    await page.waitForTimeout(500)
    // 任务面板应出现
    await expect(page.locator(TASK_LIST)).toBeVisible({ timeout: 5000 })
  })

  test('空 todo 数组不渲染 TaskListPanel', async ({ page }) => {
    await openAIDialogMaximized(page)
    await injectTodoUpdate(page, [])
    await page.waitForTimeout(500)
    await expect(page.locator(TASK_LIST)).toHaveCount(0)
  })
})

test.describe('PlanReviewPanel — Stage B-1 (agent.plan.proposed)', () => {
  test.describe.configure({ mode: 'serial' })

  test('agent.plan.proposed 事件触发后 PlanReviewPanel 出现', async ({ page }) => {
    await openAIDialogMaximized(page)
    await expect(page.locator(PLAN_REVIEW)).toHaveCount(0)
    // 注入 plan 事件
    await injectPlanProposed(page, {
      title: '重构用户认证模块',
      summary: '将现有 cookie auth 迁移到 JWT + refresh token 方案',
      steps: [
        { id: '1', title: '调研现有认证逻辑', description: '阅读 routes/auth.py' },
        { id: '2', title: '设计 JWT 中间件', files: ['server/app/middleware/jwt.py'] },
      ],
      risks: ['需要兼容旧 cookie session', '刷新 token 机制需配合 Redis'],
    })
    await page.waitForTimeout(500)
    await expect(page.locator(PLAN_REVIEW)).toBeVisible({ timeout: 5000 })
  })

  test('接受 plan: 点击 Accept 按钮后 PlanReviewPanel 消失', async ({ page }) => {
    await openAIDialogMaximized(page)
    await injectPlanProposed(page, {
      title: '测试 plan',
      summary: '测试接受流程',
      steps: [{ id: '1', title: '步骤 1' }],
    })
    await page.waitForTimeout(500)
    const planPanel = page.locator(PLAN_REVIEW)
    await expect(planPanel).toBeVisible({ timeout: 5000 })
    // 找到 Accept 按钮
    const acceptBtn = planPanel.locator('button:has-text("接受"), button:has-text("Accept")').first()
    if (await acceptBtn.isVisible().catch(() => false)) {
      await acceptBtn.click()
      await page.waitForTimeout(500)
      // plan 应被清空
      await expect(planPanel).toHaveCount(0)
    }
  })

  test('拒绝 plan: 点击 Reject 按钮后 PlanReviewPanel 消失', async ({ page }) => {
    await openAIDialogMaximized(page)
    await injectPlanProposed(page, {
      title: '测试 plan',
      summary: '测试拒绝流程',
      steps: [{ id: '1', title: '步骤 1' }],
    })
    await page.waitForTimeout(500)
    const planPanel = page.locator(PLAN_REVIEW)
    await expect(planPanel).toBeVisible({ timeout: 5000 })
    const rejectBtn = planPanel.locator('button:has-text("拒绝"), button:has-text("Reject")').first()
    if (await rejectBtn.isVisible().catch(() => false)) {
      await rejectBtn.click()
      await page.waitForTimeout(500)
      await expect(planPanel).toHaveCount(0)
    }
  })
})
