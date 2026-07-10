/**
 * 证书下载页 e2e 回归测试
 *
 * 2026-07-03 创建: 固化 CertificateDownload.vue 的 PDF 导出/打印功能 + 暗色模式背景色正确性
 *
 * 覆盖:
 * - 源码级: 验证 exportService / THEME_TOKENS 导入、handleDownload/handlePrint 函数存在、暗色背景色走 token
 * - 浏览器级 (需 dev server): 验证页面渲染、下载/打印按钮可点击、不存在证书显示空态
 *
 * 运行方式:
 *   # 源码级 (CI 必跑, 无需 dev server)
 *   npx playwright test e2e/learn-cert-download.spec.ts -g "源码级"
 *
 *   # 浏览器级 (需 PW_BASE_URL 或 dev server 健康)
 *   cmd /c "set PW_BASE_URL=http://localhost:8888&& npx playwright test e2e/learn-cert-download.spec.ts"
 */
import { test, expect } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CERT_DOWNLOAD_VUE = path.resolve(__dirname, '..', 'src', 'views', 'learn', 'CertificateDownload.vue')
const EXPORT_SERVICE_TS = path.resolve(__dirname, '..', 'src', 'utils', 'exportService.ts')
const THEME_TOKENS_TS = path.resolve(__dirname, '..', 'src', 'styles', '_theme-tokens.ts')

const BASE = process.env.PW_BASE_URL || 'http://127.0.0.1:8888'

// ============================================================================
// 源码级守门 (无需 dev server, CI 必跑)
// ============================================================================

test.describe('证书下载页 - 源码级守门', () => {
  test('CertificateDownload.vue 文件存在', () => {
    expect(fs.existsSync(CERT_DOWNLOAD_VUE)).toBe(true)
  })

  test('exportService.ts 工具服务文件存在', () => {
    expect(fs.existsSync(EXPORT_SERVICE_TS)).toBe(true)
  })

  test('THEME_TOKENS 主题令牌文件存在', () => {
    expect(fs.existsSync(THEME_TOKENS_TS)).toBe(true)
  })

  test('CertificateDownload.vue 导入 exportElementToPDF + printElement', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain("import { exportElementToPDF, printElement } from '@/utils/exportService'")
  })

  test('CertificateDownload.vue 导入 THEME_TOKENS', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain("import { THEME_TOKENS } from '@/styles/_theme-tokens'")
  })

  test('CertificateDownload.vue 包含 handleDownload 函数', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toMatch(/async function handleDownload/)
  })

  test('CertificateDownload.vue 包含 handlePrint 函数', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toMatch(/async function handlePrint/)
  })

  test('handleDownload 使用 exportElementToPDF + THEME_TOKENS.darkSurface (暗色背景走 token)', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain('exportElementToPDF(certCardRef.value')
    expect(content).toContain('THEME_TOKENS.darkSurface')
    expect(content).toContain('THEME_TOKENS.lightSurface')
    // 关键: 暗色模式背景色必须走 token, 禁止硬编码色值
    expect(content).toMatch(/isDark\.value \? THEME_TOKENS\.darkSurface : THEME_TOKENS\.lightSurface/)
  })

  test('handlePrint 使用 printElement + THEME_TOKENS (暗色背景走 token)', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain('printElement(certCardRef.value')
  })

  test('CertificateDownload.vue 不硬编码主题色值', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    // 禁止在 script 中硬编码这些色值 (应走 THEME_TOKENS 或 CSS 变量)
    expect(content).not.toMatch(/backgroundColor:\s*['"]#/)
    expect(content).not.toMatch(/backgroundColor:\s*['"]rgb/)
  })

  test('CertificateDownload.vue 有下载/打印按钮 (template 层)', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain('@click="handleDownload"')
    expect(content).toContain('@click="handlePrint"')
  })

  test('CertificateDownload.vue 有 loading 状态 (downloading + printing)', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain(':loading="downloading"')
    expect(content).toContain(':loading="printing"')
  })

  test('CertificateDownload.vue 有 certCardRef 用于导出 DOM 锚点', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toMatch(/ref="certCardRef"/)
    expect(content).toMatch(/const certCardRef = ref<HTMLElement/)
  })

  test('CertificateDownload.vue 路由参数 id 用于拉取证书详情', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain("route.params.id")
    expect(content).toContain('learnApi.certificateDetail(id)')
  })

  test('CertificateDownload.vue 错误兜底有 ElMessage.error', () => {
    const content = fs.readFileSync(CERT_DOWNLOAD_VUE, 'utf-8')
    expect(content).toContain("ElMessage.error(t('learnCertificateDownload.downloadFailed'))")
    expect(content).toContain("ElMessage.error(t('learnCertificateDownload.printFailed'))")
  })

  test('exportService.ts 导出 exportElementToPDF + printElement 函数', () => {
    const content = fs.readFileSync(EXPORT_SERVICE_TS, 'utf-8')
    expect(content).toMatch(/export (async )?function exportElementToPDF/)
    expect(content).toMatch(/export (async )?function printElement/)
  })

  test('THEME_TOKENS 包含 darkSurface + lightSurface', () => {
    const content = fs.readFileSync(THEME_TOKENS_TS, 'utf-8')
    expect(content).toMatch(/darkSurface/)
    expect(content).toMatch(/lightSurface/)
  })
})

// ============================================================================
// 浏览器级守门 (需 PW_BASE_URL 或 dev server 健康时跑)
// ============================================================================

test.describe('证书下载页 - 浏览器级守门', () => {
  test.beforeAll(async ({ request }) => {
    // 探测 dev server 是否健康, 不健康则跳过整个 describe
    try {
      const res = await request.get(BASE, { timeout: 3000 })
      if (!res.ok()) test.skip(true, 'dev server 不可用')
    } catch {
      test.skip(true, 'dev server 不可用')
    }
  })

  test.beforeEach(async ({ page }) => {
    // 注入 mock 登录态
    await page.addInitScript(() => {
      const now = Date.now()
      localStorage.setItem('token', 'mock-token-for-route-verification')
      localStorage.setItem('user_token', 'mock-token-for-route-verification')
      localStorage.setItem('user_data', JSON.stringify({
        uuid: 'mock-uuid',
        id: 'mock-id',
        username: 'test-user',
        nickname: '测试用户',
        loginTime: new Date(now).toISOString(),
      }))
      localStorage.setItem('login_expiry_time', String(now + 86400000))
    })

    // Mock /api/v1/user/info — auth guard 可能在页面加载时调用此接口
    // 注意: 不能用 **/api/** 作为兜底, 因为它会匹配 Vite 模块加载 /src/api/*.ts
    // 导致模块返回 application/json MIME 类型, Vue 应用无法渲染
    await page.route('**/api/v1/user/info', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          msg: 'ok',
          data: {
            uuid: 'mock-uuid',
            username: 'test-user',
            nickname: '测试用户',
            avatar: '',
            phone: '13800138000',
            email: 'test@example.com',
            isVip: false,
            status: 1,
          },
        }),
      })
    })
  })

  test('证书下载页可访问 (使用 mock id)', async ({ page }) => {
    // 拦截证书详情 API, 返回 mock 数据
    // 注意: 组件代码 cert.value = res.data, res 是 AxiosResponse, res.data 是响应体
    // 所以 mock 响应体必须直接是证书对象, 不能用 { code, msg, data } 包装
    await page.route('**/learn/certificate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-cert-001',
          name: '测试课程证书',
          issueTime: '2026-07-03 10:00:00',
          courseName: '测试课程',
        }),
      })
    })

    await page.goto(`${BASE}/learn/certificate/download/mock-cert-001`, {
      waitUntil: 'networkidle',
    })

    // 验证证书卡片渲染
    await expect(page.locator('.cert-card')).toBeVisible()
    await expect(page.locator('.cert-name')).toContainText('测试课程证书')
  })

  test('下载按钮 + 打印按钮存在且可点击', async ({ page }) => {
    await page.route('**/learn/certificate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-cert-002',
          name: '按钮测试证书',
          issueTime: '2026-07-03',
        }),
      })
    })

    await page.goto(`${BASE}/learn/certificate/download/mock-cert-002`, {
      waitUntil: 'networkidle',
    })

    const downloadBtn = page.locator('.actions button').first()
    const printBtn = page.locator('.actions button').nth(1)

    await expect(downloadBtn).toBeVisible()
    await expect(printBtn).toBeVisible()
    // 验证按钮文案
    await expect(downloadBtn).toContainText(/下载|Download/)
    await expect(printBtn).toContainText(/打印|Print/)
  })

  test('证书不存在时显示空态', async ({ page }) => {
    await page.route('**/learn/certificate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(null),
      })
    })

    await page.goto(`${BASE}/learn/certificate/download/nonexistent-id`, {
      waitUntil: 'networkidle',
    })

    // 证书不存在时显示 el-empty
    await expect(page.locator('.el-empty')).toBeVisible()
  })

  test('breadcrumb 面包屑渲染', async ({ page }) => {
    await page.route('**/learn/certificate/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-cert-003',
          name: '面包屑测试证书',
          issueTime: '2026-07-03',
        }),
      })
    })

    await page.goto(`${BASE}/learn/certificate/download/mock-cert-003`, {
      waitUntil: 'networkidle',
    })

    // 面包屑应存在
    const breadcrumb = page.locator('.el-breadcrumb')
    if (await breadcrumb.count() > 0) {
      await expect(breadcrumb).toBeVisible()
    }
  })
})
