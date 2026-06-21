import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const BASE = 'http://localhost:8888'
const BACKEND = 'http://127.0.0.1:8000'

async function fetchToken(request: APIRequestContext): Promise<string> {
  const resp = await request.post(`${BACKEND}/api/v1/auth/login`, {
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

test('Hot 弹窗测试（对照）', async ({ page, request }) => {
  const token = await fetchToken(request)
  expect(token).toBeTruthy()
  await mockUserInfo(page)
  await setLoginState(page, token)

  await page.goto(`${BASE}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.goto(`${BASE}/admin/search/hot`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  await page.screenshot({ path: 'test-results/hot-page-before-click.png', fullPage: true })

  // 列出所有按钮文字
  const buttonTexts = await page.locator('button').allTextContents()
  console.log(`Hot 页面按钮: ${JSON.stringify(buttonTexts)}`)

  const addBtn = page.locator('.el-button--primary').first()
  await expect(addBtn).toBeVisible({ timeout: 5000 })
  await addBtn.click()

  await page.waitForTimeout(1000)

  const dialogVisible = await page.locator('.el-dialog').isVisible()
  console.log(`Hot 弹窗可见: ${dialogVisible}`)

  const overlayState = await page.evaluate(() => {
    const o = document.querySelector('.el-overlay') as any
    if (!o) return 'no overlay'
    const symbols = Object.getOwnPropertySymbols(o)
    const state: Record<string, any> = {}
    for (const sym of symbols) {
      state[sym.toString()] = o[sym]
    }
    // 检查 overlay 的 DOM 路径
    const path: string[] = []
    let el: Element | null = o
    while (el && el !== document.documentElement) {
      path.unshift(el.tagName + '.' + (el.className || '').toString().slice(0, 40))
      el = el.parentElement
    }
    return {
      display: getComputedStyle(o).display,
      inlineStyle: o.getAttribute('style'),
      symbols: state,
      hasDialog: !!o.querySelector('.el-dialog'),
      domPath: path.join(' > '),
    }
  })
  console.log(`Hot overlay 状态: ${JSON.stringify(overlayState, null, 2)}`)

  // 检查 ElDialog 的 props
  const hotDialogState = await page.evaluate(() => {
    const app = document.querySelector('#app') as any
    if (!app?.__vue_app__) return 'no vue app'
    let elDialogComp: any = null
    const visited = new WeakSet()
    function traverse(comp: any, depth: number) {
      if (!comp || depth > 20 || visited.has(comp)) return
      visited.add(comp)
      const name = comp.type?.name || comp.type?.__name || 'anonymous'
      if (name === 'ElDialog') { elDialogComp = comp; return }
      const subTree = comp.subTree
      if (subTree) traverseVNode(subTree, comp, depth)
    }
    function traverseVNode(vnode: any, parentComp: any, depth: number) {
      if (!vnode) return
      if (vnode.component) traverse(vnode.component, depth + 1)
      if (vnode.children && Array.isArray(vnode.children)) {
        for (const child of vnode.children) traverseVNode(child, parentComp, depth)
      }
      if (vnode.dynamicChildren && Array.isArray(vnode.dynamicChildren)) {
        for (const child of vnode.dynamicChildren) traverseVNode(child, parentComp, depth)
      }
    }
    traverse(app.__vue_app__._instance, 0)
    if (!elDialogComp) return 'no ElDialog found'
    return { props: elDialogComp.props, vnodeProps: elDialogComp.vnode?.props ? Object.keys(elDialogComp.vnode.props) : [] }
  })
  console.log(`Hot ElDialog props: ${JSON.stringify(hotDialogState, null, 2)}`)

  await page.screenshot({ path: 'test-results/hot-dialog-test.png', fullPage: true })

  expect(dialogVisible).toBeTruthy()
})
