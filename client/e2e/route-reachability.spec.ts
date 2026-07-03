/**
 * 路由可达性验证 (CI 守门)
 *
 * 2026-07-02 创建: 固化 /goal 模式下 13 条新路由 + P2 6 条挂载路由的浏览器端验证
 *
 * 覆盖:
 * - 11 条 admin children 路由 (requiresAuth + requiresAdmin)
 * - 1 条 support 路由 (requiresAuth)
 * - 1 条 catchAll 404
 * - 2 条公开页 (agreement / help, 不需要 auth)
 * - 2 条第三方登录回调 (dingtalk / work-wechat, 不需要 auth)
 * - 1 条 admin-classic catch-all (requiresAuth + requiresAdmin)
 * - 1 条 settings 子页 (account-cancel, requiresAuth)
 *
 * 运行方式:
 *   cmd /c "set PW_BASE_URL=http://localhost:8888&& npx playwright test e2e/route-reachability.spec.ts"
 *   或 dev server 健康时直接: npx playwright test e2e/route-reachability.spec.ts
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

// 注入 mock 登录态绕过守卫 (token + user_data + login_expiry_time)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now()
    localStorage.setItem('token', 'mock-token-for-route-verification')
    localStorage.setItem('user_token', 'mock-token-for-route-verification')
    localStorage.setItem('user_data', JSON.stringify({
      uuid: 'mock-uuid',
      id: 'mock-id',
      username: 'test-admin',
      nickname: '测试管理员',
      isAdmin: true,
      userType: 'admin',
      roles: ['admin', 'ROLE_ADMIN'],
      permissions: ['admin:*', '*'],
      loginTime: new Date(now).toISOString(),
      lastActiveTime: new Date(now).toISOString(),
    }))
    localStorage.setItem('login_expiry_time', String(now + 86400000))
  })
})

// 需要登录的路由: [path, 期望页面包含的关键词(中文 i18n)]
const AUTHED_ROUTES: Array<[string, string]> = [
  ['/admin/agent-management', '智能体'],
  ['/admin/ai-capability-management', 'AI'],
  ['/admin/content-management', '内容'],
  ['/admin/auth-management', '认证'],
  ['/admin/rbac-management', 'RBAC'],
  ['/admin/business-management', '业务'],
  ['/admin/course-category-management', '课程'],
  ['/admin/distribution-management', '分销'],
  ['/admin/tour-permissions', '权限'],
  ['/admin/utils-admin', '工具'],
  ['/admin/notification-center', '通知'],
  ['/support/tickets', '工单'],
  // P2 新挂载
  ['/admin-classic/home', '管理'],
  ['/settings/account-cancel', '注销'],
  // P1 孤岛群挂载 - 章节管理
  ['/admin/exam/chapter', '章节'],
  ['/admin/exam/chapter-section', '小节'],
  // P1 孤岛群挂载 - 需求广场
  ['/admin/demand-square', '需求'],
  ['/admin/demand-square/review', '审核'],
  // P1 孤岛群挂载 - 开发者管理
  ['/admin/developer', '开发者'],
  ['/admin/developer/link', '关联'],
  // P1 孤岛群挂载 - 字典管理
  ['/admin/dict', '字典'],
  ['/admin/dict/data', '字典'],
  // P1 孤岛群挂载 - 定时任务
  ['/admin/job', '任务'],
  ['/admin/job/log', '日志'],
  // P3 独立管理页挂载
  ['/admin/migration', '迁移'],
  ['/admin/log/logininfor', '清理'],
  ['/admin/log/operlog', '操作'],
  ['/admin/online', '在线'],
  ['/admin/sms/template', '短信'],
  ['/admin/zone', '专区'],
  // P1 孤岛群挂载 - 教育模块
  ['/edu', '教育'],
  ['/admin/edu', '教育'],
  // P1 孤岛群挂载 - Settings 子页
  ['/settings/app-permission', '权限'],
  ['/settings/business-license', '营业'],
  ['/settings/change-phone', '手机'],
  ['/settings/icp-record', 'ICP'],
  ['/settings/model-record', '模型'],
  ['/settings/usage-rules', '规则'],
  // H3 扩展 - exam CRUD 页面 (15 条, AdminTableV2 表格, 验证 "ID" 列头渲染)
  ['/admin/exam/list', '考试'],
  ['/admin/exam/paper', '试卷'],
  ['/admin/exam/paper-mock', '试卷'],
  ['/admin/exam/paper-normal', '试卷'],
  ['/admin/exam/paper-random', '试卷'],
  ['/admin/exam/paper-category', '试卷'],
  ['/admin/exam/question', '题目'],
  ['/admin/exam/question-category', '题目'],
  ['/admin/exam/question-single', '题目'],
  ['/admin/exam/question-multi', '题目'],
  ['/admin/exam/question-judgment', '题目'],
  ['/admin/exam/question-fill', '题目'],
  ['/admin/exam/question-subjective', '题目'],
  ['/admin/exam/answer', '答题'],
  ['/admin/exam/answer-detail', '答题'],
  // PR-F F8: edu member 学员档案模块路由可达性
  ['/edu/member', '档案'],
  ['/edu/member/report', '档案'],
  ['/edu/member/notes', '笔记'],
  ['/edu/member/offline-records', '线下'],
  ['/edu/member/certificates/upload', '证书'],
  ['/edu/member/papers', '试卷'],
  ['/edu/member/papers/upload', '试卷'],
]

// 公开路由(不需要登录): [path, 期望关键词]
const PUBLIC_ROUTES: Array<[string, string]> = [
  ['/agreement/user', '协议'],
  ['/help', '帮助'],
]

// 第三方登录回调(不需要登录, 验证不 500 即可)
const CALLBACK_ROUTES: string[] = [
  '/admin/login/dingtalk',
  '/admin/login/work-wechat',
]

// catchAll 404
const NOT_FOUND_PATH = '/random-path-not-exist-xyz'

test.describe('路由可达性: 登录态路由渲染', () => {
  test.setTimeout(60000)

  for (const [path, expectKeyword] of AUTHED_ROUTES) {
    test(`登录态访问 ${path} 渲染成功 (含 "${expectKeyword}")`, async ({ page }) => {
      const resp = await page.goto(`${BASE}${path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
      expect(resp?.status()).toBe(200)
      await page.waitForTimeout(1500)

      // 验证不跳转到登录页 (用 pathname 精确匹配, 避免 /admin/log/logininfor 等含 /login 子串的路径误判)
      const pathname = new URL(page.url()).pathname
      expect(pathname).not.toBe('/login')
      expect(pathname).not.toBe('/register')

      // 验证页面内容包含期望关键词
      const text = await page.evaluate(() => document.body.innerText.slice(0, 3000))
      const ok = text.toLowerCase().includes(expectKeyword.toLowerCase())
      if (!ok) {
        console.error(`[路由验证] ${path} 页面未包含关键词 "${expectKeyword}"`)
        console.error(`[路由验证] 实际内容前 500 字: ${text.slice(0, 500)}`)
      }
      expect(ok).toBe(true)
    })
  }
})

test.describe('路由可达性: 公开页渲染', () => {
  test.setTimeout(60000)

  for (const [path, expectKeyword] of PUBLIC_ROUTES) {
    test(`公开访问 ${path} 渲染成功 (含 "${expectKeyword}")`, async ({ page }) => {
      const resp = await page.goto(`${BASE}${path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
      expect(resp?.status()).toBe(200)
      await page.waitForTimeout(1500)

      // 公开页不应跳转登录 (用 pathname 精确匹配, 避免子串误判)
      const pathname = new URL(page.url()).pathname
      expect(pathname).not.toBe('/login')
      expect(pathname).not.toBe('/register')

      // 验证页面内容
      const text = await page.evaluate(() => document.body.innerText.slice(0, 3000))
      expect(text.toLowerCase()).toContain(expectKeyword.toLowerCase())
    })
  }
})

test.describe('路由可达性: 第三方登录回调', () => {
  test.setTimeout(60000)

  for (const path of CALLBACK_ROUTES) {
    test(`回调页 ${path} 不报 500`, async ({ page }) => {
      const resp = await page.goto(`${BASE}${path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      })
      expect(resp?.status()).toBe(200)
      // 回调页可能因缺少 code 参数显示错误提示, 但不应 500
    })
  }
})

test.describe('路由可达性: catchAll 404 兜底', () => {
  test.setTimeout(30000)

  test('随机路径命中 404 页面', async ({ page }) => {
    await page.goto(`${BASE}${NOT_FOUND_PATH}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })
    await page.waitForTimeout(1500)

    const text = await page.evaluate(() => document.body.innerText.slice(0, 1000))
    expect(text.toLowerCase()).toContain('404')
  })
})
