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

test('批量编辑功能验证', async ({ page, request }) => {
  const token = await fetchToken(request)
  expect(token).toBeTruthy()
  await mockUserInfo(page)
  await setLoginState(page, token)

  // mock 更新 API
  let updateCount = 0
  await page.route('**/admin/aiworld/site/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()
    // 列表请求返回 mock 数据
    if (url.includes('/site/list')) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          code: 200, success: true, message: 'ok',
          data: {
            records: [
              { id: 1, name: '站点A', section: 'AI对话', status: 'active', sortOrder: 1 },
              { id: 2, name: '站点B', section: 'AI绘画', status: 'inactive', sortOrder: 2 },
            ],
            total: 2, current: 1, size: 50,
          },
        }),
      })
    } else if (method === 'PUT') {
      // 更新请求
      updateCount++
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ code: 200, success: true, message: 'ok' }),
      })
    } else {
      await route.continue()
    }
  })

  await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/aiworld/site`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // 直接通过 JavaScript 调用 onBatchEdit 方法
  // 注意：AdminTableV2 也有 onBatchEdit 方法，需要找到 Site.vue 的组件实例（有 batchEditVisible 的）
  const editResult = await page.evaluate(() => {
    const el = document.querySelector('.admin-list-page') || document.querySelector('.el-table-v2') || document.querySelector('#app')
    if (!el) return 'no element'
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      // 查找有 batchEditVisible 的组件（Site.vue），而不是 AdminTableV2
      if (setupState && setupState.batchEditVisible !== undefined && typeof setupState.onBatchEdit === 'function') {
        setupState.onBatchEdit([
          { id: 1, name: '站点A', section: 'AI对话', status: 'active', sortOrder: 1 },
          { id: 2, name: '站点B', section: 'AI绘画', status: 'inactive', sortOrder: 2 },
        ])
        return 'found'
      }
      instance = instance.parent
    }
    return 'not found'
  })
  console.log(`查找onBatchEdit结果: ${editResult}`)
  await page.waitForTimeout(1000)

  // 检查 batchEditVisible 的值
  const batchEditState = await page.evaluate(() => {
    const el = document.querySelector('.admin-list-page') || document.querySelector('.el-table-v2') || document.querySelector('#app')
    if (!el) return 'no element'
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && setupState.batchEditVisible !== undefined && typeof setupState.onBatchEdit === 'function') {
        return {
          batchEditVisible: setupState.batchEditVisible,
          batchEditRowsLen: setupState.batchEditRows?.length,
        }
      }
      instance = instance.parent
    }
    return 'not found'
  })
  console.log(`批量编辑状态: ${JSON.stringify(batchEditState)}`)

  // 验证批量编辑弹窗打开
  const batchEditDialog = page.locator('.el-dialog').filter({ hasText: '批量编辑' })
  const batchEditDialogVisible = await batchEditDialog.isVisible().catch(() => false)
  console.log(`批量编辑弹窗是否可见: ${batchEditDialogVisible}`)
  expect(batchEditDialogVisible).toBe(true)

  // 验证提示文字
  const tipText = await page.locator('.batch-edit__tip').textContent()
  console.log(`提示文字: ${tipText}`)
  expect(tipText).toContain('2')

  // 勾选"状态"字段
  const statusCheckbox = page.locator('.el-form-item').filter({ hasText: '状态' }).locator('.el-checkbox')
  await statusCheckbox.click()
  await page.waitForTimeout(300)

  // 选择状态为"隐藏"
  const statusSelect = page.locator('.el-form-item').filter({ hasText: '状态' }).locator('.el-select')
  await statusSelect.click()
  await page.waitForTimeout(300)
  await page.locator('.el-select-dropdown__item').filter({ hasText: '隐藏' }).click()
  await page.waitForTimeout(300)

  // 点击批量保存
  const saveBtn = page.locator('.el-dialog').filter({ hasText: '批量编辑' }).locator('button').filter({ hasText: '批量保存' })
  await saveBtn.click()
  await page.waitForTimeout(2000)

  // 验证更新 API 被调用2次（2条数据）
  console.log(`更新API调用次数: ${updateCount}`)
  expect(updateCount).toBe(2)

  // 验证弹窗关闭
  const dialogClosed = await batchEditDialog.isVisible().catch(() => false)
  console.log(`批量编辑弹窗是否关闭: ${!dialogClosed}`)
  expect(dialogClosed).toBe(false)

  await page.screenshot({ path: 'test-results/batch-edit.png', fullPage: true })
})

test('手机端预览功能验证', async ({ page, request }) => {
  const token = await fetchToken(request)
  expect(token).toBeTruthy()
  await mockUserInfo(page)
  await setLoginState(page, token)

  await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/aiworld/site`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // 等待 loading 遮罩消失
  await page.waitForSelector('.el-loading-mask', { state: 'detached', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)

  // 直接调用 onAdd 方法打开弹窗（比点击按钮更可靠）
  await page.evaluate(() => {
    const el = document.querySelector('.admin-list-page') || document.querySelector('#app')
    if (!el) return
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && typeof setupState.onAdd === 'function') {
        setupState.onAdd()
        return 'found'
      }
      instance = instance.parent
    }
  })
  await page.waitForTimeout(1500)

  // 等待编辑弹窗出现
  await page.waitForSelector('.el-dialog', { state: 'visible', timeout: 10000 })
  await page.waitForTimeout(500)

  // 设置 formData
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
  await page.waitForTimeout(500)

  // 直接调用 onPreview 方法打开预览弹窗（比点击按钮更可靠）
  await page.evaluate(() => {
    const el = document.querySelector('.el-dialog')
    if (!el) return
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && typeof setupState.onPreview === 'function') {
        setupState.onPreview()
        return 'found'
      }
      instance = instance.parent
    }
  })
  await page.waitForTimeout(1500)

  // 验证预览弹窗打开（用 preview-detail class 定位，避免依赖翻译）
  const previewDialog = page.locator('.preview-detail')
  const previewVisible = await previewDialog.isVisible().catch(() => false)
  console.log(`预览弹窗是否可见: ${previewVisible}`)
  expect(previewVisible).toBe(true)

  // 验证电脑端/手机端切换按钮存在（用 radio button 定位）
  const pcBtn = page.locator('.preview-toolbar .el-radio-button').first()
  const mobileBtn = page.locator('.preview-toolbar .el-radio-button').last()
  const pcBtnVisible = await pcBtn.isVisible().catch(() => false)
  const mobileBtnVisible = await mobileBtn.isVisible().catch(() => false)
  console.log(`电脑端按钮: ${pcBtnVisible}, 手机端按钮: ${mobileBtnVisible}`)
  expect(pcBtnVisible).toBe(true)
  expect(mobileBtnVisible).toBe(true)

  // 验证默认是电脑端
  const hasPcClass = await page.evaluate(() => {
    const detail = document.querySelector('.preview-detail')
    return detail && !detail.classList.contains('preview-detail--mobile')
  })
  console.log(`默认是否电脑端: ${hasPcClass}`)
  expect(hasPcClass).toBe(true)

  // 点击手机端
  await mobileBtn.click()
  await page.waitForTimeout(500)

  // 验证切换到手机端
  const hasMobileClass = await page.evaluate(() => {
    const detail = document.querySelector('.preview-detail')
    return detail && detail.classList.contains('preview-detail--mobile')
  })
  console.log(`切换后是否手机端: ${hasMobileClass}`)
  expect(hasMobileClass).toBe(true)

  await page.screenshot({ path: 'test-results/mobile-preview.png', fullPage: true })
})

test('批量编辑失败重试验证', async ({ page, request }) => {
  const token = await fetchToken(request)
  expect(token).toBeTruthy()
  await mockUserInfo(page)
  await setLoginState(page, token)

  // 屏蔽预期的 500 错误日志（本测试模拟更新失败场景）
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('500')) return
  })
  page.on('pageerror', (err) => {
    if (err.message.includes('500') || err.message.includes('服务器内部错误')) return
  })

  // mock 更新 API：前2次成功，第3次失败；重试时成功
  let updateCount = 0
  let shouldFail = true
  await page.route('**/admin/aiworld/site/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (url.includes('/site/list')) {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          code: 200, success: true, message: 'ok',
          data: {
            records: [
              { id: 1, name: '站点A', section: 'AI对话', status: 'active', sortOrder: 1 },
              { id: 2, name: '站点B', section: 'AI绘画', status: 'inactive', sortOrder: 2 },
              { id: 3, name: '站点C', section: 'AI编程', status: 'active', sortOrder: 3 },
            ],
            total: 3, current: 1, size: 50,
          },
        }),
      })
    } else if (method === 'PUT') {
      updateCount++
      // 第3次更新（id=3）失败，重试时成功
      if (shouldFail && updateCount === 3) {
        await route.fulfill({
          status: 500, contentType: 'application/json',
          body: JSON.stringify({ code: 500, success: false, message: '服务器错误' }),
        })
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ code: 200, success: true, message: 'ok' }),
        })
      }
    } else {
      await route.continue()
    }
  })

  await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/aiworld/site`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // 调用 onBatchEdit 打开弹窗
  await page.evaluate(() => {
    const el = document.querySelector('.admin-list-page') || document.querySelector('.el-table-v2') || document.querySelector('#app')
    if (!el) return
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && setupState.batchEditVisible !== undefined && typeof setupState.onBatchEdit === 'function') {
        setupState.onBatchEdit([
          { id: 1, name: '站点A', section: 'AI对话', status: 'active', sortOrder: 1 },
          { id: 2, name: '站点B', section: 'AI绘画', status: 'inactive', sortOrder: 2 },
          { id: 3, name: '站点C', section: 'AI编程', status: 'active', sortOrder: 3 },
        ])
        break
      }
      instance = instance.parent
    }
  })
  await page.waitForTimeout(1000)

  // 验证弹窗打开
  const batchEditDialog = page.locator('.el-dialog').filter({ hasText: '批量编辑' })
  expect(await batchEditDialog.isVisible().catch(() => false)).toBe(true)

  // 勾选"状态"字段
  const statusCheckbox = page.locator('.el-form-item').filter({ hasText: '状态' }).locator('.el-checkbox')
  await statusCheckbox.click()
  await page.waitForTimeout(300)

  // 选择状态为"隐藏"
  const statusSelect = page.locator('.el-form-item').filter({ hasText: '状态' }).locator('.el-select')
  await statusSelect.click()
  await page.waitForTimeout(300)
  await page.locator('.el-select-dropdown__item').filter({ hasText: '隐藏' }).click()
  await page.waitForTimeout(300)

  // 点击批量保存
  const saveBtn = batchEditDialog.locator('button').filter({ hasText: '批量保存' })
  await saveBtn.click()
  await page.waitForTimeout(3000)

  // 验证更新 API 被调用3次
  console.log(`更新API调用次数: ${updateCount}`)
  expect(updateCount).toBe(3)

  // 验证弹窗未关闭（有失败项）
  const dialogStillOpen = await batchEditDialog.isVisible().catch(() => false)
  console.log(`有失败项时弹窗是否仍打开: ${dialogStillOpen}`)
  expect(dialogStillOpen).toBe(true)

  // 验证失败提示文字
  const failedText = await page.locator('.batch-edit__failed-text').textContent().catch(() => '')
  console.log(`失败提示文字: ${failedText}`)
  expect(failedText).toContain('失败')
  expect(failedText).toContain('1')

  // 验证"重试失败项"按钮出现
  const retryBtn = batchEditDialog.locator('button').filter({ hasText: '重试失败项' })
  const retryBtnVisible = await retryBtn.isVisible().catch(() => false)
  console.log(`重试按钮是否可见: ${retryBtnVisible}`)
  expect(retryBtnVisible).toBe(true)

  // 点击重试按钮（重试时 shouldFail 设为 false，重试会成功）
  shouldFail = false
  await retryBtn.click()
  await page.waitForTimeout(2000)

  // 验证重试后弹窗关闭
  const dialogClosed = await batchEditDialog.isVisible().catch(() => false)
  console.log(`重试后弹窗是否关闭: ${!dialogClosed}`)
  expect(dialogClosed).toBe(false)

  await page.screenshot({ path: 'test-results/batch-edit-retry.png', fullPage: true })
})
