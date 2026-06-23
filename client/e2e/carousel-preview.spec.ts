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

test('杞挱鍥鹃瑙堝姛鑳介獙璇?, async ({ page, request }) => {
  const token = await fetchToken(request)
  test.skip(!token, '后端不可用，跳过测试')
  await mockUserInfo(page)
  await setLoginState(page, token!)

  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })


  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/setting/carousel`, { waitUntil: 'domcontentloaded' })

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)

  console.log(`杞挱鍥鹃〉闈RL: ${page.url()}`)
  expect(page.url()).toContain('/admin/setting/carousel')

  // 鐐瑰嚮娣诲姞鎸夐挳
  const addBtn = page.locator('.el-button--primary').first()
  await addBtn.click()
  await page.waitForTimeout(2000)

  // 楠岃瘉寮圭獥鎵撳紑
  const dialogVisible = await page.locator('.el-dialog').isVisible().catch(() => false)
  console.log(`寮圭獥鏄惁鍙: ${dialogVisible}`)
  expect(dialogVisible).toBe(true)

  // 閫氳繃 JavaScript 璁剧疆 formData
  await page.evaluate(() => {
    const el = document.querySelector('.el-dialog')
    if (!el) return
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && setupState.formData && typeof setupState.onPreview === 'function') {
        setupState.formData.title = '娴嬭瘯杞挱鍥?
        setupState.formData.image = 'https://example.com/test.jpg'
        setupState.formData.link = 'https://example.com'
        setupState.formData.status = 'on'
        break
      }
      instance = instance.parent
    }
  })
  await page.waitForTimeout(300)

  // 楠岃瘉棰勮鎸夐挳鍙
  const previewBtn = page.locator('.el-dialog__footer button').filter({ hasText: '棰勮' }).first()
  const previewBtnVisible = await previewBtn.isVisible().catch(() => false)
  console.log(`棰勮鎸夐挳鏄惁鍙: ${previewBtnVisible}`)
  expect(previewBtnVisible).toBe(true)

  // 鐐瑰嚮棰勮鎸夐挳
  await previewBtn.click()
  await page.waitForTimeout(1500)

  // 楠岃瘉棰勮寮圭獥鎵撳紑
  const previewDialog = page.locator('.el-dialog').filter({ hasText: '杞挱鍥鹃瑙? })
  const previewDialogVisible = await previewDialog.isVisible().catch(() => false)
  console.log(`棰勮寮圭獥鏄惁鍙: ${previewDialogVisible}`)
  expect(previewDialogVisible).toBe(true)

  // 楠岃瘉棰勮鍐呭
  const previewContent = await page.evaluate(() => ({
    hasPreviewCarousel: !!document.querySelector('.preview-carousel'),
    hasTitle: !!document.querySelector('.preview-carousel__title'),
    title: document.querySelector('.preview-carousel__title')?.textContent,
    hasImage: !!document.querySelector('.preview-carousel__image'),
    hasLink: !!document.querySelector('.preview-carousel__link'),
  }))
  console.log(`棰勮鍐呭: ${JSON.stringify(previewContent)}`)
  expect(previewContent.hasPreviewCarousel).toBe(true)
  expect(previewContent.title).toContain('娴嬭瘯杞挱鍥?)

  await page.screenshot({ path: 'test-results/carousel-preview.png', fullPage: true })
})

test('淇濆瓨骞剁户缁紪杈戞寜閽獙璇?, async ({ page, request }) => {
  const token = await fetchToken(request)
  test.skip(!token, '后端不可用，跳过测试')
  await mockUserInfo(page)
  await setLoginState(page, token!)

  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })


  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/aiworld/site`, { waitUntil: 'domcontentloaded' })

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // 鐐瑰嚮娣诲姞鎸夐挳
  const addBtn = page.locator('.el-button--primary').first()
  await addBtn.click()
  await page.waitForTimeout(2000)

  // 楠岃瘉"淇濆瓨骞剁户缁紪杈?鎸夐挳瀛樺湪
  const continueBtn = page.locator('.el-dialog__footer button').filter({ hasText: '淇濆瓨骞剁户缁紪杈? }).first()
  const continueBtnVisible = await continueBtn.isVisible().catch(() => false)
  console.log(`淇濆瓨骞剁户缁紪杈戞寜閽槸鍚﹀彲瑙? ${continueBtnVisible}`)
  expect(continueBtnVisible).toBe(true)

  // 楠岃瘉涓変釜鎸夐挳閮藉瓨鍦細鍙栨秷銆佷繚瀛樺苟缁х画缂栬緫銆佷繚瀛?
  const allBtns = await page.evaluate(() => {
    const footer = document.querySelector('.el-dialog__footer')
    if (!footer) return []
    return Array.from(footer.querySelectorAll('button')).map(b => b.textContent?.trim())
  })
  console.log(`寮圭獥搴曢儴鎵€鏈夋寜閽? ${JSON.stringify(allBtns)}`)
  expect(allBtns).toContain('鍙栨秷')
  expect(allBtns).toContain('淇濆瓨骞剁户缁紪杈?)
  expect(allBtns).toContain('淇濆瓨')

  await page.screenshot({ path: 'test-results/save-continue-button.png', fullPage: true })
})

test('淇濆瓨骞剁户缁紪杈戝疄闄呬繚瀛橀獙璇?, async ({ page, request }) => {
  const token = await fetchToken(request)
  test.skip(!token, '后端不可用，跳过测试')
  await mockUserInfo(page)
  await setLoginState(page, token!)

  // mock 鍒涘缓绔欑偣 API锛岃繑鍥炴垚鍔熷拰鏂?id
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

  await page.goto(`${BASE}`, { waitUntil: 'domcontentloaded' })


  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/aiworld/site`, { waitUntil: 'domcontentloaded' })

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)

  // 鐐瑰嚮娣诲姞鎸夐挳
  const addBtn = page.locator('.el-button--primary').first()
  await addBtn.click()
  await page.waitForTimeout(2000)

  // 閫氳繃 JavaScript 璁剧疆蹇呭～瀛楁
  await page.evaluate(() => {
    const el = document.querySelector('.el-dialog')
    if (!el) return
    let instance = (el as any).__vueParentComponent
    while (instance) {
      const setupState = instance.setupState
      if (setupState && setupState.formData && typeof setupState.onPreview === 'function') {
        setupState.formData.name = '娴嬭瘯绔欑偣'
        setupState.formData.section = 'AI 瀵硅瘽'
        break
      }
      instance = instance.parent
    }
  })
  await page.waitForTimeout(300)

  // 鐐瑰嚮"淇濆瓨骞剁户缁紪杈?
  const continueBtn = page.locator('.el-dialog__footer button').filter({ hasText: '淇濆瓨骞剁户缁紪杈? }).first()
  await continueBtn.click()
  await page.waitForTimeout(2000)

  // 楠岃瘉鍒涘缓 API 琚皟鐢?
  console.log(`鍒涘缓API鏄惁琚皟鐢? ${createCalled}`)
  expect(createCalled).toBe(true)

  // 楠岃瘉寮圭獥浠嶇劧鎵撳紑锛堜繚瀛樺苟缁х画缂栬緫涓嶅叧闂脊绐楋級
  const dialogStillVisible = await page.locator('.el-dialog').isVisible().catch(() => false)
  console.log(`淇濆瓨鍚庡脊绐楁槸鍚︿粛鐒舵墦寮€: ${dialogStillVisible}`)
  expect(dialogStillVisible).toBe(true)

  // 楠岃瘉妯″紡鍒囨崲涓虹紪杈戯紙鏂板淇濆瓨鍚庡簲鍒囨崲涓虹紪杈戞ā寮忥級
  const dialogTitle = await page.evaluate(() => {
    const title = document.querySelector('.el-dialog__title')
    return title?.textContent?.trim()
  })
  console.log(`淇濆瓨鍚庡脊绐楁爣棰? ${dialogTitle}`)
  expect(dialogTitle).toContain('缂栬緫')

  await page.screenshot({ path: 'test-results/save-continue-actual.png', fullPage: true })
})
