import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const BASE = 'http://localhost:8888'
const BACKEND = 'http://127.0.0.1:8000'

async function fetchToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${BACKEND}/api/auth/login`, {
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
    data: { username: 'admin', password: 'admin123' },
    failOnStatusCode: false,
  })
  if (resp.status() === 200) {
    const body = await resp.json()
    return body?.data?.token || body?.data?.access_token || body?.token || ''
  }
  return ''
}

async function setLoginState(page: Page, token: string) {
  await page.addInitScript((t) => {
    const now = Date.now()
    const userData = {
      uuid: 'admin', id: 'admin', username: 'admin', nickname: 'admin',
      status: 1, isVip: false, role: 'admin', isAdmin: true, userType: 'admin',
      loginTime: new Date(now).toISOString(), lastActiveTime: new Date(now).toISOString(),
      createTime: new Date(now).toISOString(), updateTime: new Date(now).toISOString(),
      roles: ['admin'], permissions: ['*:*:*'],
    }
    localStorage.setItem('user_token', t)
    localStorage.setItem('token', t)
    localStorage.setItem('login_expiry_time', String(now + 24 * 60 * 60 * 1000))
    localStorage.setItem('login_duration', String(24 * 60 * 60 * 1000))
    localStorage.setItem('user_data', JSON.stringify(userData))
  }, token)
}

async function mockUserInfo(page: Page) {
  await page.route('**/user/info**', async (route) => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        code: 200, success: true, message: 'ok',
        data: { id: 1, uuid: 'admin', username: 'admin', nickname: 'admin', status: 1, isVip: false, roles: ['admin'], permissions: ['*:*:*'], authInfo: { email: '', phone: '' } },
      }),
    })
  })
}

test('轮播图预览功能验证', async ({ page, request }) => {
  const token = await fetchToken(request)
  expect(token).toBeTruthy()
  await mockUserInfo(page)
  await setLoginState(page, token)

  await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/setting/carousel`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  console.log(`轮播图页面URL: ${page.url()}`)
  expect(page.url()).toContain('/admin/setting/carousel')

  // 点击添加按钮
  const addBtn = page.locator('.el-button--primary').first()
  await addBtn.click()
  await page.waitForTimeout(2000)

  // 验证弹窗打开
  const dialogVisible = await page.locator('.el-dialog').isVisible().catch(() => false)
  console.log(`弹窗是否可见: ${dialogVisible}`)
  expect(dialogVisible).toBe(true)

  // 通过 JavaScript 设置 formData
  await page.evaluate(() => {
    const el = document.querySelector('.el-dialog')
    if (!el) return
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && setupState.formData && typeof setupState.onPreview === 'function') {
        setupState.formData.title = '测试轮播图'
        setupState.formData.image = 'https://example.com/test.jpg'
        setupState.formData.link = 'https://example.com'
        setupState.formData.status = 'on'
        break
      }
      instance = instance.parent
    }
  })
  await page.waitForTimeout(300)

  // 验证预览按钮可见
  const previewBtn = page.locator('.el-dialog__footer button').filter({ hasText: '预览' }).first()
  const previewBtnVisible = await previewBtn.isVisible().catch(() => false)
  console.log(`预览按钮是否可见: ${previewBtnVisible}`)
  expect(previewBtnVisible).toBe(true)

  // 点击预览按钮
  await previewBtn.click()
  await page.waitForTimeout(1500)

  // 验证预览弹窗打开
  const previewDialog = page.locator('.el-dialog').filter({ hasText: '轮播图预览' })
  const previewDialogVisible = await previewDialog.isVisible().catch(() => false)
  console.log(`预览弹窗是否可见: ${previewDialogVisible}`)
  expect(previewDialogVisible).toBe(true)

  // 验证预览内容
  const previewContent = await page.evaluate(() => ({
    hasPreviewCarousel: !!document.querySelector('.preview-carousel'),
    hasTitle: !!document.querySelector('.preview-carousel__title'),
    title: document.querySelector('.preview-carousel__title')?.textContent,
    hasImage: !!document.querySelector('.preview-carousel__image'),
    hasLink: !!document.querySelector('.preview-carousel__link'),
  }))
  console.log(`预览内容: ${JSON.stringify(previewContent)}`)
  expect(previewContent.hasPreviewCarousel).toBe(true)
  expect(previewContent.title).toContain('测试轮播图')

  await page.screenshot({ path: 'test-results/carousel-preview.png', fullPage: true })
})

test('保存并继续编辑按钮验证', async ({ page, request }) => {
  const token = await fetchToken(request)
  expect(token).toBeTruthy()
  await mockUserInfo(page)
  await setLoginState(page, token)

  await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/aiworld/site`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // 点击添加按钮
  const addBtn = page.locator('.el-button--primary').first()
  await addBtn.click()
  await page.waitForTimeout(2000)

  // 验证"保存并继续编辑"按钮存在
  const continueBtn = page.locator('.el-dialog__footer button').filter({ hasText: '保存并继续编辑' }).first()
  const continueBtnVisible = await continueBtn.isVisible().catch(() => false)
  console.log(`保存并继续编辑按钮是否可见: ${continueBtnVisible}`)
  expect(continueBtnVisible).toBe(true)

  // 验证三个按钮都存在：取消、保存并继续编辑、保存
  const allBtns = await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    if (!footer) return []
    return Array.from(footer.querySelectorAll('button')).map(b => b.textContent?.trim())
  })
  console.log(`弹窗底部所有按钮: ${JSON.stringify(allBtns)}`)
  expect(allBtns).toContain('取消')
  expect(allBtns).toContain('保存并继续编辑')
  expect(allBtns).toContain('保存')

  await page.screenshot({ path: 'test-results/save-continue-button.png', fullPage: true })
})

test('保存并继续编辑实际保存验证', async ({ page, request }) => {
  const token = await fetchToken(request)
  expect(token).toBeTruthy()
  await mockUserInfo(page)
  await setLoginState(page, token)

  // mock 创建站点 API，返回成功和新 id
  let createCalled = false
  await page.route('**/admin/aiworld/site**', async (route) => {
    const method = route.request().method()
    if (method === 'POST') {
      createCalled = true
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 200, success: true, message: 'ok', data: { id: 999 } }),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/aiworld/site`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // 点击添加按钮
  const addBtn = page.locator('.el-button--primary').first()
  await addBtn.click()
  await page.waitForTimeout(2000)

  // 通过 JavaScript 设置必填字段
  await page.evaluate(() => {
    const el = document.querySelector('.el-dialog')
    if (!el) return
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && setupState.formData && typeof setupState.onPreview === 'function') {
        setupState.formData.name = '测试站点'
        setupState.formData.section = 'AI 对话'
        break
      }
      instance = instance.parent
    }
  })
  await page.waitForTimeout(300)

  // 点击"保存并继续编辑"
  const continueBtn = page.locator('.el-dialog__footer button').filter({ hasText: '保存并继续编辑' }).first()
  await continueBtn.click()
  await page.waitForTimeout(2000)

  // 验证创建 API 被调用
  console.log(`创建API是否被调用: ${createCalled}`)
  expect(createCalled).toBe(true)

  // 验证弹窗仍然打开（保存并继续编辑不关闭弹窗）
  const dialogStillVisible = await page.locator('.el-dialog').isVisible().catch(() => false)
  console.log(`保存后弹窗是否仍然打开: ${dialogStillVisible}`)
  expect(dialogStillVisible).toBe(true)

  // 验证模式切换为编辑（新增保存后应切换为编辑模式）
  const dialogTitle = await page.evaluate(() => {
    const title = document.querySelector('.el-dialog__title')
    return title?.textContent?.trim()
  })
  console.log(`保存后弹窗标题: ${dialogTitle}`)
  expect(dialogTitle).toContain('编辑')

  await page.screenshot({ path: 'test-results/save-continue-actual.png', fullPage: true })
})
