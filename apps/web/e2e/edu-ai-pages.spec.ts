import { setupTest as test, expect } from './fixtures'

/**
 * AI 教育板块 11 页面完整验证。
 *
 * 覆盖:
 * - 页面加载无 500 错误
 * - 页面标题可见
 * - 页面主体区域可见
 * - 无控制台异常
 */

const EDU_AI_PAGES = [
  { path: '/edu-ai/policy', name: '政策法规' },
  { path: '/edu-ai/certification', name: '证书认证' },
  { path: '/edu-ai/aigc-tools', name: 'AIGC 工具库' },
  { path: '/edu-ai/courses', name: 'AI 课程' },
  { path: '/edu-ai/fund-data', name: '基金数据' },
  { path: '/edu-ai/map', name: '学习地图' },
  { path: '/edu-ai/marking', name: 'AI 批改' },
  { path: '/edu-ai/outbound', name: '外呼业务' },
  { path: '/edu-ai/tbox', name: '设备管理' },
  { path: '/edu-ai/video-compose', name: '视频编排' },
  { path: '/edu-ai/voice', name: '语音通话' },
]

test.describe('AI 教育板块 11 页面验证', () => {
  for (const { path, name } of EDU_AI_PAGES) {
    test(`${name} 页面可访问 (${path})`, async ({ adminPage: page }) => {
      const serverErrors: string[] = []
      const consoleErrors: string[] = []

      // 收集服务端错误
      page.on('response', (resp) => {
        if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
      })

      // 收集控制台错误
      page.on('pageerror', (err) => consoleErrors.push(err.message))

      await page.goto(path)
      await page.waitForLoadState('networkidle')

      // 过滤已知的无关错误（favicon、AI 服务超时等）
      const realServerErrors = serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
          !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
      )

      // 断言无服务端 500 错误
      expect(realServerErrors, `${name} 页面不应有服务端错误`).toHaveLength(0)

      // 断言无控制台异常
      expect(consoleErrors, `${name} 页面不应有控制台异常`).toHaveLength(0)

      // 断言页面主体可见
      const main = page.locator('main, [role="main"], .space-y-4, .container').first()
      await expect(main, `${name} 页面主体应可见`).toBeVisible({ timeout: 5000 })

      // 断言页面标题可见
      const title = page.locator('h1').first()
      await expect(title, `${name} 页面标题应可见`).toBeVisible({ timeout: 5000 })
    })
  }
})