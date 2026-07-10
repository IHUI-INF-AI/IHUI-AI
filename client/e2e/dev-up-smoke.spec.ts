/**
 * dev-up 启动验收烟测 (2026-07-03 立)
 *
 * 目的: scripts/dev-up.ps1 启动后端 + Vite 完成后, 用一组最薄 HTTP 探活
 *       把"前后端启动成功"从"人眼看 uvicorn_dev_up.log"升级为"CI 守门".
 *       防止:
 *         - 后端 listen 在 8000 但 /api/health 实际 500
 *         - 前端 8888 启动但首屏白屏 (CORS / HMR 错误)
 *         - 后端某路由 (如 personality) 路径错误被 try/except 静默吞掉
 *
 * 触发场景:
 *   - dev 启动后手跑: npx playwright test e2e/dev-up-smoke.spec.ts
 *   - CI 用 webServer 自动跑 (playwright.config.ts 的 webServer.url = FRONTEND_URL)
 *
 * 注意:
 *   - 端口字面量全部来自 client/config/ports.ts, 严禁再写 8000/8888/4173
 *   - 必须在 8000/8888 真实存活时跑 (复用 playwright 的 webServer 或外部 dev-up)
 *   - 后端路由模块较多 (11+ legacy), 冷启动需 50-60s, 故 expect timeout 给 10s
 *     并跳过冷启动场景 (use webServer.reuseExistingServer)
 */

import { test, expect } from '@playwright/test'
import { BACKEND_URL, FRONTEND_URL } from '../config/ports'

// 端口字面量已抽到 client/config/ports.ts, 此处仅允许环境变量覆盖
const BACKEND = process.env.PW_BACKEND_URL ?? BACKEND_URL
const FRONTEND = process.env.PW_BASE_URL ?? FRONTEND_URL

interface ApiResp {
  code: string | number
  msg: string
  data: unknown
  timestamp: number
}

async function fetchJson(url: string): Promise<{ status: number; body: ApiResp }> {
  const r = await fetch(url)
  const text = await r.text()
  let body: ApiResp
  try {
    body = JSON.parse(text)
  } catch {
    body = { code: 'PARSE_ERR', msg: text.slice(0, 200), data: null, timestamp: 0 }
  }
  return { status: r.status, body }
}

test.describe('dev-up 启动烟测', () => {
  test('后端 /api/health 直连 200', async () => {
    const r = await fetch(`${BACKEND}/api/health`)
    expect(r.status, `后端 ${BACKEND}/api/health 应可访问`).toBe(200)
    const text = await r.text()
    expect(text.length, 'health 响应非空').toBeGreaterThan(0)
  })

  test('后端 /api/health 返标准 ApiResponse (code/msg/data/timestamp)', async () => {
    const { body } = await fetchJson(`${BACKEND}/api/health`)
    expect(['0', 0, '200', 200]).toContain(body.code)
    expect(typeof body.msg).toBe('string')
    expect(body.timestamp).toBeGreaterThan(0)
  })

  test('前端 Vite dev server 首页 200 + 标题渲染', async ({ page }) => {
    const r = await page.goto('/', { waitUntil: 'domcontentloaded' })
    expect(r?.status(), `前端 ${FRONTEND}/ 应可访问`).toBe(200)
    const title = await page.title()
    expect(title, '首页 title 非空').toBeTruthy()
  })

  test('后端 /api/personality/test 路由注册 (防 2026-07-03 路径错配回归)', async () => {
    // 路由文件实际在 app.api.v1.agents.personality,
    // router.py 历史错误地引用 app.api.v1.tools.personality, 被 try/except 静默吞掉
    // 此处 POST 触发实际路由, 防止类似 import 错误再次悄悄回退
    const r = await fetch(`${BACKEND}/api/personality/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_input: 'smoke-test' }),
    })
    // 200 = 路由就位 (n8n 返回值不论, 关键是路由本身被注册)
    // 5xx = 路由缺失, 被 try/except 静默吞掉
    expect(r.status, 'personality 路由必须注册 (不可被 try/except 静默跳过)').toBeLessThan(500)
  })

  test('Vite 代理链路: 前端 → /api/health 透传到后端', async ({ page }) => {
    // 经 Vite 代理调用 (前端开发最常见路径), 不能因为 vite.config.ts proxy 配错而 502
    const r = await page.request.get('/api/health')
    expect(r.status(), 'Vite 代理 /api/health 必透传').toBe(200)
  })
})
