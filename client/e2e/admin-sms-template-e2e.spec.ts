/**
 * 短信模板管理页面 E2E 测试
 * 验证迁移自 auth_sms_temp 的短信模板模块: 路由守卫 + 页面加载 + API 联调
 */
import { test, expect } from '@playwright/test'
import { setLoggedIn, setLoggedOut } from './helpers/auth-helper'

const BASE = 'http://127.0.0.1:8888'

test.describe('短信模板管理 (admin/sms/template) E2E', () => {
  test('未登录访问 /admin/sms/template 跳登录', async ({ page }) => {
    await page.goto(`${BASE}/admin/sms/template`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const url = page.url()
    // 未登录 + requiresAdmin 应跳 /login
    expect(url).toContain('/login')
  })

  test('mock admin 登录后页面加载成功', async ({ page }) => {
    // 设置 mock 登录态 (含 admin 权限)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await setLoggedIn(page, { uuid: 'u-admin', username: 'admin' })
    // 补充 admin 权限标记 (路由守卫检查 isAdmin/role/userType)
    await page.evaluate(() => {
      const u = JSON.parse(localStorage.getItem('user_data') || '{}')
      u.isAdmin = true
      u.role = 'admin'
      localStorage.setItem('user_data', JSON.stringify(u))
    })

    await page.goto(`${BASE}/admin/sms/template`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)

    // 不应跳转到登录页
    const url = page.url()
    expect(url).not.toContain('/login')

    // 页面应渲染 (SPA 已加载)
    const body = await page.evaluate(() => document.body?.innerText?.length || 0)
    expect(body).toBeGreaterThan(0)
  })

  test('短信模板列表 API 通过前端代理可达', async ({ request }) => {
    // 直接通过前端代理调用后端 API
    const resp = await request.get(`${BASE}/api/v1/sms/template/list`, { timeout: 10000 })
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.code).toBe(0)
    expect(body.data).toHaveProperty('list')
    expect(body.data).toHaveProperty('total')
  })

  test('短信模板 CRUD 全流程', async ({ request }) => {
    // 1. 新增
    const createResp = await request.post(`${BASE}/api/v1/sms/template`, {
      data: {
        templateName: 'E2E测试模板',
        templateCode: 'SMS_E2E_TEST',
        templateContent: '验证码:{code}',
        templateType: '1',
        signName: 'IHUI',
        status: '0',
      },
    })
    expect(createResp.status()).toBe(200)
    const createBody = await createResp.json()
    expect(createBody.code).toBe(0)
    const templateId = createBody.data.templateId
    expect(templateId).toBeTruthy()

    // 2. 列表应包含新模板
    const listResp = await request.get(`${BASE}/api/v1/sms/template/list`)
    const listBody = await listResp.json()
    expect(listBody.data.total).toBeGreaterThanOrEqual(1)

    // 3. 详情
    const detailResp = await request.get(`${BASE}/api/v1/sms/template/${templateId}`)
    const detailBody = await detailResp.json()
    expect(detailBody.data.templateName).toBe('E2E测试模板')

    // 4. 修改
    const updateResp = await request.put(`${BASE}/api/v1/sms/template`, {
      data: { templateId, templateName: 'E2E测试模板-改' },
    })
    expect(updateResp.status()).toBe(200)

    // 5. 状态切换
    const statusResp = await request.put(`${BASE}/api/v1/sms/template/changeStatus`, {
      data: { templateId, status: '1' },
    })
    expect(statusResp.status()).toBe(200)

    // 6. 重复编码校验
    const dupResp = await request.post(`${BASE}/api/v1/sms/template`, {
      data: { templateName: '重复', templateCode: 'SMS_E2E_TEST', templateContent: 'test' },
    })
    const dupBody = await dupResp.json()
    expect(dupBody.code).toBe(400)

    // 7. 删除
    const delResp = await request.delete(`${BASE}/api/v1/sms/template/${templateId}`)
    expect(delResp.status()).toBe(200)
    const delBody = await delResp.json()
    expect(delBody.data.count).toBe(1)
  })
})
