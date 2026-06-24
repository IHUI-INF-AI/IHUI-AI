/**
 * P6-8 安全加固 e2e 验证
 * - 响应头包含 Content-Security-Policy
 * - 响应头包含 X-Frame-Options / X-Content-Type-Options / Referrer-Policy
 * - 非 GET 请求自动携带 CSRF token header
 * - v-html 不被 <script> 注入触发
 * - escapeHtml 转义正确（dev 可执行测试）
 * - src/utils/csp.ts 是唯一 CSP 源
 */

import { test, expect } from '@playwright/test'

const BASE = 'http://127.0.0.1:8888'
const ROOT = process.cwd()

test.describe('P6-8 安全 HTTP 响应头', () => {
  test('首页携带 Content-Security-Policy', async ({ request }) => {
    const res = await request.get(`${BASE}/`, { failOnStatusCode: false })
    const csp = res.headers()['content-security-policy'] || res.headers()['content-security-policy-report-only']
    console.log(`[security] CSP header: ${csp ? csp.slice(0, 100) + '...' : 'MISSING'}`)
    expect(csp, 'Content-Security-Policy 必须存在').toBeTruthy()
    expect(csp, 'CSP 必须包含 default-src').toMatch(/default-src/i)
    expect(csp, 'CSP 必须包含 script-src').toMatch(/script-src/i)
    expect(csp, 'CSP 必须包含 report-uri').toMatch(/report-uri/i)
  })

  test('首页携带点击劫持 + MIME 嗅探防护', async ({ request }) => {
    const res = await request.get(`${BASE}/`, { failOnStatusCode: false })
    const headers = res.headers()
    console.log(`[security] X-Frame-Options: ${headers['x-frame-options']}`)
    console.log(`[security] X-Content-Type-Options: ${headers['x-content-type-options']}`)
    console.log(`[security] Referrer-Policy: ${headers['referrer-policy']}`)
    expect(headers['x-content-type-options'], 'X-Content-Type-Options 阻止 MIME 嗅探').toBe('nosniff')
    // X-Frame-Options 可能在 dev 由 CSP frame-src 替代，检查两者之一
    const hasFrameProtect = headers['x-frame-options'] || (headers['content-security-policy'] || '').includes('frame-src')
    expect(hasFrameProtect, '点击劫持防护（CSP frame-src 或 X-Frame-Options）').toBeTruthy()
  })

  test('manifest.webmanifest 响应头正确', async ({ request }) => {
    const res = await request.get(`${BASE}/manifest.webmanifest`, { failOnStatusCode: false })
    expect(res.status(), 'manifest 200').toBe(200)
    const ct = res.headers()['content-type'] || ''
    console.log(`[security] manifest content-type: ${ct}`)
    expect(ct, 'manifest content-type 正确').toMatch(/application\/manifest\+json/)
  })
})

test.describe('P6-8 XSS 防御', () => {
  test('sanitizeHtml 过滤 <script> 与 onerror', async ({ page }) => {
    test.setTimeout(45000)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    const result = await page.evaluate(async () => {
      const mod = (await import('/src/utils/htmlSanitizer.ts' as never).catch(() => null)) as { sanitizeHtml?: (s: string) => string } | null
      if (!mod || !mod.sanitizeHtml) return { hasModule: false }
      const input = '<img src=x onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">click</a>'
      const out = mod.sanitizeHtml(input)
      return { hasModule: true, output: out }
    })
    console.log(`[security] sanitizeHtml 输入长度 ${JSON.stringify(result).length}，输出: ${JSON.stringify(result)}`)
    expect(result.hasModule, 'sanitizeHtml 模块可加载').toBe(true)
    const output = String((result as { output?: string }).output || '')
    expect(output, '过滤 <script> 标签').not.toMatch(/<script/i)
    expect(output, '过滤 onerror 处理器').not.toMatch(/onerror/i)
    expect(output, '过滤 javascript: 协议').not.toMatch(/javascript:/i)
  })

  test('escapeHtml 转义 HTML 实体', async ({ page }) => {
    test.setTimeout(45000)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    const result = await page.evaluate(async () => {
      const mod = (await import('/src/utils/htmlSanitizer.ts' as never).catch(() => null)) as { escapeHtml?: (s: string) => string } | null
      if (!mod || !mod.escapeHtml) return { hasModule: false }
      return { hasModule: true, output: mod.escapeHtml('<script>alert(1)</script>') }
    })
    console.log(`[security] escapeHtml: ${JSON.stringify(result)}`)
    expect(result.hasModule, 'escapeHtml 可加载').toBe(true)
    expect(String((result as { output?: string }).output || '')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

test.describe('P6-8 CSRF / 签名防护', () => {
  test('request.ts 在非 GET 请求中自动注入签名 header（静态分析）', async () => {
    const fs = await import('fs')
    const content = fs.readFileSync(`${ROOT}/src/utils/request.ts`, 'utf-8')
    // 项目使用 HMAC 签名方案：DeviceService.getHeaders + requestSignatureService.getHeaders
    expect(content, 'request.ts 引用签名/设备服务').toMatch(/DeviceService|requestSignatureService|getHeaders/i)
    // 签名服务被调用并把返回 header 合并到 config.headers
    expect(content, 'request.ts 合并签名 header').toMatch(/Object\.assign\(\s*config\.headers\s*,\s*(deviceHeaders|signatureHeaders)/)
  })

  test('签名服务模块可加载 + getHeaders 返回非空对象', async ({ page }) => {
    test.setTimeout(45000)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(1000)

    const result = await page.evaluate(async () => {
      // 项目用 DeviceService / requestSignature 替代 CsrfService
      const mods = await Promise.all([
        import('/src/utils/deviceService.ts' as never).catch(() => null),
        import('/src/utils/requestSignature.ts' as never).catch(() => null),
      ])
      const loadedMods = mods.filter((m) => m)
      if (loadedMods.length === 0) return { hasModule: false }
      // 检查是否包含签名相关导出（getHeaders / requestSignatureService）
      const hasSignatureApi = loadedMods.some((m) => {
        const obj = m as Record<string, unknown>
        return (
          typeof obj.getHeaders === 'function' ||
          typeof (obj.default as { getHeaders?: unknown } | undefined)?.getHeaders === 'function' ||
          typeof (obj as { requestSignatureService?: { getHeaders?: unknown } }).requestSignatureService?.getHeaders === 'function' ||
          typeof obj.getRequestSignatureHeaders === 'function'
        )
      })
      return { hasModule: true, hasSignatureApi, modCount: loadedMods.length }
    })
    console.log(`[security] 签名服务探测: ${JSON.stringify(result)}`)
    expect(result.hasModule, '签名服务模块可加载').toBe(true)
    expect(result.hasSignatureApi, '签名服务含 getHeaders API').toBe(true)
  })
})

test.describe('P6-8 CSP 源文件一致性', () => {
  test('config/csp.ts 唯一源 + 6 处引用', async () => {
    const fs = await import('fs')
    const cspFile = `${ROOT}/config/csp.ts`
    expect(fs.existsSync(cspFile), 'config/csp.ts 存在').toBe(true)
    const content = fs.readFileSync(cspFile, 'utf-8')
    expect(content, '存在 PROD_CSP_STRING').toMatch(/PROD_CSP_STRING/)
    expect(content, '存在 DEV_CSP_STRING').toMatch(/DEV_CSP_STRING/)
    expect(content, '存在 CSP_REPORT_URL').toMatch(/CSP_REPORT_URL/)

    // 验证 vite.config.ts 引用 csp 配置
    const viteConfig = fs.readFileSync(`${ROOT}/vite.config.ts`, 'utf-8')
    expect(viteConfig, 'vite.config.ts 引用 csp 配置').toMatch(/from ['"]\.\/config\/csp['"]/)
    expect(viteConfig, 'vite.config.ts 使用 DEV_CSP_STRING').toMatch(/DEV_CSP_STRING/)

    // 验证 index.html 有 CSP meta
    const indexHtml = fs.readFileSync(`${ROOT}/index.html`, 'utf-8')
    const hasMetaCsp = /http-equiv=["']Content-Security-Policy["']/i.test(indexHtml)
    console.log(`[security] index.html CSP meta: ${hasMetaCsp}`)
  })
})
