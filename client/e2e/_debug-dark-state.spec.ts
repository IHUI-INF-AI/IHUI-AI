import { test, expect } from '@playwright/test'

test('debug: 暗色覆盖实际状态', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('darkMode', 'dark')
  })
  await page.goto('http://localhost:8888/', { waitUntil: 'networkidle' })

  // 等 main.ts IIFE 执行
  await page.waitForTimeout(2000)

  const state = await page.evaluate(() => {
    const html = document.documentElement
    const cs = getComputedStyle(html)
    return {
      hasDarkClass: html.classList.contains('dark'),
      localStorage: localStorage.getItem('darkMode'),
      // 暗色 4 类主题色
      elColorSuccess: cs.getPropertyValue('--el-color-success').trim(),
      elColorWarning: cs.getPropertyValue('--el-color-warning').trim(),
      elColorDanger: cs.getPropertyValue('--el-color-danger').trim(),
      elColorInfo: cs.getPropertyValue('--el-color-info').trim(),
      elColorPrimary: cs.getPropertyValue('--el-color-primary').trim(),
      // 4 类文字 token
      appTextOnSuccess: cs.getPropertyValue('--app-text-on-success').trim(),
      appTextOnWarning: cs.getPropertyValue('--app-text-on-warning').trim(),
      appTextOnDanger: cs.getPropertyValue('--app-text-on-danger').trim(),
      appTextOnInfo: cs.getPropertyValue('--app-text-on-info').trim(),
    }
  })
  console.log('STATE:', JSON.stringify(state, null, 2))
  expect(state.hasDarkClass, 'html.dark 必须添加').toBe(true)
  expect(state.elColorSuccess, 'success 暗色重映射').toBe('#15803d')
})
