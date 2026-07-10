import { test } from '@playwright/test'

test('验证：body 背景修复后', async ({ page }) => {
  await page.addInitScript(() => {
    const futureExpiry = Date.now() + 86400000
    const userData = JSON.stringify({
      uuid: 'integration_test', id: 'integration_test', username: 'integration_test',
      nickname: '集成测试用户', status: 1, isVip: false,
    })
    const userInfo = JSON.stringify({
      userId: 'integration_test', userName: 'integration_test',
      nickName: '集成测试用户', avatar: '',
    })
    localStorage.setItem('token', 'integration_test_token')
    localStorage.setItem('user_token', 'integration_test_token')
    localStorage.setItem('user_data', userData)
    localStorage.setItem('userInfo', userInfo)
    localStorage.setItem('login_expiry_time', String(futureExpiry))
    sessionStorage.setItem('token', 'integration_test_token')
    sessionStorage.setItem('user_token', 'integration_test_token')
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle', { timeout: 15000 })
  await page.waitForFunction(() => document.body.innerText.length > 30, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(800)

  await page.evaluate(() => {
    document.querySelectorAll('.promotion-modal-overlay, .modal-overlay').forEach(el => el.remove())
  })
  await page.waitForTimeout(300)

  // 浅色模式
  await page.evaluate(() => document.documentElement.classList.remove('dark'))
  await page.waitForTimeout(200)
  const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  console.log('浅色模式 body bg =', lightBg)
  await page.screenshot({ path: 'test-results/fixed-light.png' })

  // 浅色 hover
  const btn = page.locator('button.nav-item-new-chat').first()
  const box = await btn.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
    await page.waitForTimeout(500)
  }
  const hoverBg = await page.evaluate(() => getComputedStyle(document.querySelector('button.nav-item-new-chat') as HTMLElement).backgroundColor)
  console.log('浅色模式新对话按钮 hover bg =', hoverBg)
  await page.screenshot({ path: 'test-results/fixed-hover-light.png' })

  // 深色模式
  await page.evaluate(() => document.documentElement.classList.add('dark'))
  await page.waitForTimeout(500)
  const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  console.log('深色模式 body bg =', darkBg)
  await page.screenshot({ path: 'test-results/fixed-dark.png' })

  // 深色 hover
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 5 })
    await page.waitForTimeout(500)
  }
  const darkHoverBg = await page.evaluate(() => getComputedStyle(document.querySelector('button.nav-item-new-chat') as HTMLElement).backgroundColor)
  console.log('深色模式新对话按钮 hover bg =', darkHoverBg)
  await page.screenshot({ path: 'test-results/fixed-hover-dark.png' })
})
