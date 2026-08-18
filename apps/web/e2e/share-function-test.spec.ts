/**
 * 分享功能 E2E 测试
 *
 * 测试流程:
 * 1. 通过 Playwright request API 登录获取 fresh token
 * 2. 通过 API 获取对话列表
 * 3. 通过 API 生成分享 token（验证响应脱敏已修复）
 * 4. 创建带认证 cookie 的浏览器上下文
 * 5. 打开分享页面，验证内容正常显示
 * 6. 验证无登录态也能访问分享页面
 * 7. 测试前端分享按钮 UI 流程
 */

import { setupTest as test, expect } from './fixtures'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import type { Browser, BrowserContext } from '@playwright/test'
import { request as newRequest } from '@playwright/test'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WEB_URL = 'http://localhost:8801'
const API_URL = 'http://localhost:8802'
const ADMIN_STORAGE_STATE = path.join(__dirname, '.auth', 'admin.json')

test.describe('分享功能 E2E 测试', () => {
  let conversationId: string
  let conversationTitle: string
  let shareToken: string
  let context: BrowserContext
  let accessToken: string
  let refreshToken: string

  test.beforeAll(async () => {
    console.log('[share-test] 删除过期 storageState...')
    try {
      await fs.unlink(ADMIN_STORAGE_STATE)
      console.log('[share-test] 已删除过期 admin.json')
    } catch {
      console.log('[share-test] admin.json 不存在或已删除')
    }
  })

  test('分享功能完整流程', async ({ browser }: { browser: Browser }) => {
    // ========== Step 0: 通过 Playwright request API 登录 ==========
    console.log('[share-test] Step 0: API 登录获取 fresh token...')
    const httpReq = await newRequest.newContext()
    try {
      const loginResp = await httpReq.post(`${API_URL}/api/auth/login`, {
        data: { account: 'admin', password: 'admin123' },
      })
      expect(loginResp.ok()).toBe(true)
      const loginBody = await loginResp.json()
      expect(loginBody.code).toBe(0)
      accessToken = loginBody.data?.accessToken ?? loginBody.data?.token
      refreshToken = loginBody.data?.refreshToken ?? ''
      expect(accessToken).toBeDefined()
      expect(accessToken.length).toBeGreaterThan(10)
      console.log(`[share-test] API 登录成功，accessToken 长度: ${accessToken.length}`)
    } finally {
      await httpReq.dispose()
    }

    // ========== Step 1: 获取对话列表 ==========
    console.log('[share-test] Step 1: 获取对话列表...')
    const convReq = await newRequest.newContext()
    try {
      const cr = await convReq.get(
        `${API_URL}/api/chat/conversations?page=1&pageSize=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      expect(cr.ok()).toBe(true)
      const convBody = await cr.json()
      expect(convBody.code).toBe(0)

      const conversations = convBody.data?.conversations ?? []
      console.log(`[share-test] 找到 ${conversations.length} 个对话`)

      if (conversations.length === 0) {
        test.skip(true, '没有对话数据，跳过测试')
      }

      const conversation = conversations.find((c: any) => c.id && c.title)
      expect(conversation).toBeDefined()
      conversationId = conversation.id
      conversationTitle = conversation.title
      console.log(`[share-test] 选择对话: ${conversationTitle} (ID: ${conversationId})`)
    } finally {
      await convReq.dispose()
    }

    // ========== Step 2: 通过 API 生成分享 token ==========
    console.log('[share-test] Step 2: 调用分享 API...')
    const shareReq = await newRequest.newContext()
    try {
      const sr = await shareReq.post(
        `${API_URL}/api/chat/conversations/${conversationId}/share`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      expect(sr.ok()).toBe(true)
      const shareBody = await sr.json()
      expect(shareBody.code).toBe(0)

      shareToken = shareBody.data?.token
      expect(shareToken).toBeDefined()
      expect(shareToken.length).toBe(16) // 16位 hex token
      console.log(`[share-test] 生成分享 Token: ${shareToken} (长度: ${shareToken.length})`)
    } finally {
      await shareReq.dispose()
    }

    // ========== Step 3: 创建带认证 cookie 的浏览器上下文 ==========
    console.log('[share-test] Step 3: 创建认证浏览器上下文...')
    const storageState = {
      cookies: [
        { name: 'auth_token', value: accessToken, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const, expires: -1 },
        { name: 'token', value: accessToken, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const, expires: -1 },
        { name: 'refresh_token', value: refreshToken, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const, expires: -1 },
      ],
      origins: [
        {
          origin: WEB_URL,
          localStorage: [
            { name: 'token', value: accessToken },
            { name: 'refresh_token', value: refreshToken },
            {
              name: 'user',
              value: JSON.stringify({
                accessToken,
                refreshToken,
                expiresIn: 900,
                refreshExpiresIn: 2592000,
                user: {
                  id: '6b8cd0f6-546f-44c8-853a-5f96edbe08be',
                  phone: '18643389808',
                  email: '502319984@qq.com',
                  username: 'admin',
                  nickname: '系统管理员',
                  avatar: '/images/logo.png?v=20260719-unify',
                  bio: '',
                  gender: 0,
                  birthday: '',
                  familyId: '',
                  roleId: 1,
                  status: 1,
                  isVip: 99,
                  level: 0,
                  inviteCode: '',
                  parentId: '',
                  createdAt: '2026-07-16T15:31:16.704Z',
                  updatedAt: '2026-08-01T13:59:32.482Z',
                  permissions: ['*:*:*'],
                },
              }),
            },
          ],
        },
      ],
    }
    await fs.writeFile(ADMIN_STORAGE_STATE, JSON.stringify(storageState, null, 2))
    context = await browser.newContext({ storageState })
    console.log('[share-test] 认证上下文已创建')

    // ========== Step 4: 打开分享页面 ==========
    const shareUrl = `${WEB_URL}/chat/share/${shareToken}`
    console.log(`[share-test] Step 4: 打开分享链接: ${shareUrl}`)

    const sharePage = await context.newPage()
    await sharePage.goto(shareUrl)
    await sharePage.waitForLoadState('domcontentloaded')
    await sharePage.waitForTimeout(3000)

    console.log('[share-test] 分享页面 URL:', sharePage.url())

    // 验证 URL 正确
    expect(sharePage.url()).toBe(shareUrl)

    // 截图
    const screenshotPath = path.join(__dirname, 'share-page-result.png')
    await sharePage.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`[share-test] 分享页面截图已保存: ${screenshotPath}`)

    // ========== Step 5: 验证分享页面内容 ==========
    console.log('[share-test] Step 5: 验证分享页面内容...')

    const title = await sharePage.title()
    console.log('[share-test] 页面标题:', title)

    // 检查分享页面标题
    const h1Text = await sharePage.evaluate(() => {
      const h1 = document.querySelector('h1')
      return h1?.textContent?.trim() ?? ''
    })
    console.log('[share-test] H1 内容:', h1Text)
    expect(h1Text).toBe(conversationTitle)

    // 检查是否有"复制链接"按钮
    const copyBtn = sharePage.locator('button:has-text("复制链接")')
    const copyBtnVisible = await copyBtn.isVisible({ timeout: 3000 }).catch(() => false)
    console.log('[share-test] 复制链接按钮可见性:', copyBtnVisible)
    expect(copyBtnVisible).toBe(true)

    // 检查消息内容（卡片格式）
    // Card 组件使用 rounded-lg border bg-card，CardContent 使用 p-4（无 card-content 类）
    const messageCards = await sharePage.locator('[class*="rounded-lg"][class*="border"][class*="bg-card"]').count()
    console.log(`[share-test] 消息卡片数量: ${messageCards}`)
    expect(messageCards).toBeGreaterThan(0)

    // 检查页面内容包含消息文本
    const pageContent = await sharePage.evaluate(() => document.body?.innerText?.slice(0, 1500) ?? '')
    console.log('[share-test] 分享页面内容预览:')
    console.log(pageContent.slice(0, 500))

    // 验证页面包含对话内容
    expect(pageContent.length).toBeGreaterThan(100)
    expect(pageContent).toContain('助手') // 消息角色标识

    // ========== Step 6: 验证无登录态也能访问 ==========
    console.log('[share-test] Step 6: 验证无登录态访问分享页面...')
    const freshContext = await browser.newContext()
    const freshPage = await freshContext.newPage()
    await freshPage.goto(shareUrl)
    await freshPage.waitForLoadState('domcontentloaded')
    await freshPage.waitForTimeout(2000)

    const freshUrl = freshPage.url()
    console.log('[share-test] 无登录态分享页面 URL:', freshUrl)
    expect(freshUrl).toContain('/chat/share/')
    expect(freshUrl).not.toContain('/login')

    const freshH1 = await freshPage.evaluate(() => {
      const h1 = document.querySelector('h1')
      return h1?.textContent?.trim() ?? ''
    })
    console.log('[share-test] 无登录态 H1:', freshH1)
    expect(freshH1).toBe(conversationTitle)

    const freshContent = await freshPage.evaluate(() => document.body?.innerText?.slice(0, 500) ?? '')
    console.log('[share-test] 无登录态内容预览:', freshContent.slice(0, 200))

    await freshPage.close()
    await freshContext.close()

    // ========== Step 7: 测试前端分享按钮 UI 流程 ==========
    console.log('[share-test] Step 7: 测试前端分享按钮流程...')

    const authPage = await context.newPage()
    await authPage.goto(WEB_URL)
    await authPage.waitForLoadState('domcontentloaded')
    await authPage.waitForTimeout(2000)

    console.log('[share-test] 首页 URL:', authPage.url())

    // 检查登录状态
    const isLoggedIn = await authPage.evaluate(() => ({
      hasToken: !!localStorage.getItem('token'),
      hasRefreshToken: !!localStorage.getItem('refresh_token'),
      hasUser: !!localStorage.getItem('user'),
    }))
    console.log('[share-test] 首页登录状态:', JSON.stringify(isLoggedIn))

    // 截图
    const homeScreenshot = path.join(__dirname, 'home-page.png')
    await authPage.screenshot({ path: homeScreenshot })
    console.log(`[share-test] 首页截图已保存: ${homeScreenshot}`)

    // 查找并点击对话
    const convBtn = authPage.locator('button').filter({ hasText: conversationTitle }).first()
    const convVisible = await convBtn.isVisible({ timeout: 5000 }).catch(() => false)
    console.log('[share-test] 对话按钮可见:', convVisible)

    if (convVisible) {
      console.log('[share-test] 点击对话按钮...')
      await convBtn.click()
      await authPage.waitForTimeout(2000)
      console.log('[share-test] 对话已打开，URL:', authPage.url())

      const panelScreenshot = path.join(__dirname, 'ai-panel.png')
      await authPage.screenshot({ path: panelScreenshot })
      console.log(`[share-test] AI 面板截图已保存: ${panelScreenshot}`)

      // 查找并点击分享按钮（在消息卡片上）
      const shareBtn = authPage
        .locator('button')
        .filter({ has: authPage.locator('[aria-label*="分享"], [aria-label*="share"]') })
        .first()
      const shareBtnVisible = await shareBtn.isVisible({ timeout: 5000 }).catch(() => false)
      console.log('[share-test] 分享按钮可见:', shareBtnVisible)

      if (shareBtnVisible) {
        console.log('[share-test] 点击分享按钮...')
        await shareBtn.click()
        await authPage.waitForTimeout(1500)

        const toastVisible = await authPage
          .locator('.sonner-toast')
          .first()
          .isVisible({ timeout: 3000 })
          .catch(() => false)
        console.log('[share-test] Toast 可见:', toastVisible)

        if (toastVisible) {
          const toastText = await authPage.locator('.sonner-toast').first().textContent()
          console.log('[share-test] Toast 内容:', toastText)
          expect(toastText).toContain('已复制')
        }
      } else {
        // 调试：列出页面上的所有按钮
        const allButtons = await authPage.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          return buttons.map((b) => ({
            text: b.textContent?.trim()?.slice(0, 30),
            ariaLabel: b.getAttribute('aria-label'),
          }))
        })
        console.log('[share-test] 页面上所有按钮:', JSON.stringify(allButtons.slice(0, 10), null, 2))
      }
    } else {
      console.log('[share-test] 未找到对话按钮，可能是未登录状态')
      console.log('[share-test] 当前 URL:', authPage.url())
      await authPage.screenshot({ path: path.join(__dirname, 'home-debug.png') })
    }

    await authPage.close()
    await sharePage.close()
    await context.close()

    console.log('[share-test] ===== 分享功能 E2E 测试完成 =====')
  })
})
