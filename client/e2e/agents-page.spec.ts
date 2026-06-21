/**
 * 智能体广场页面 E2E：验证 mock bylink 接口数据正确渲染为分类分组
 */
import { test, expect } from '@playwright/test'

test.describe('智能体广场', () => {
  test.setTimeout(45000)

  test('页面加载并显示 mock 智能体分类与卡片', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/agents', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(3000)

    const bodyText = await page.locator('body').innerText()

    // 验证 5 个分类名至少出现一个
    const categories = ['AI写作', 'AI客服', 'AI绘画', 'AI编程', 'AI办公']
    const foundCategory = categories.find(c => bodyText.includes(c))
    expect(foundCategory, `页面应包含至少一个智能体分类，实际内容: ${bodyText.substring(0, 500)}`).toBeTruthy()

    // 验证智能体名称出现
    const agentNames = ['写作助手', '翻译润色', '智能客服', '头像设计师', '代码助手', 'PPT']
    const foundAgent = agentNames.find(n => bodyText.includes(n))
    expect(foundAgent, `页面应包含至少一个智能体名称`).toBeTruthy()

    // 验证不是"0 个智能体"
    expect(bodyText).not.toMatch(/共\s*0\s*个智能体/)

    // 验证无致命 console 错误
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ERR_NETWORK') &&
      !e.includes('net::ERR') &&
      !e.includes('ResizeObserver') &&
      !e.includes('Download the React DevTools')
    )
    expect(criticalErrors, `Console 错误: ${criticalErrors.join('; ')}`).toHaveLength(0)
  })

  test('分类筛选区域可见', async ({ page }) => {
    await page.goto('/agents', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)

    // 验证页面有智能体广场容器
    const container = page.locator('.agents-square-list, .agents-container, [class*="agent"]').first()
    await expect(container).toBeVisible({ timeout: 10000 })
  })
})
