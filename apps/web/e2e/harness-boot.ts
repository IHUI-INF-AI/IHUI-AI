// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// e2e 隔离 harness 路由的启动夹具(单一真相源):
// streaming-smoothness(默认模式)与 streaming-lifecycle(?mode=lifecycle)两个 spec 共用。
// 职责:假会话态放行 MobileLoginGate + 全量 /api/** mock 信封(零后端依赖),再 goto harness。
import type { Page, Route } from '@playwright/test'

const AUTH_USER = {
  id: 'u1',
  nickname: 'E2E',
  username: 'e2e',
  avatar: '',
  roleId: 1,
  status: 1,
}
// 鉴权持久化真实形状(zustand persist 包裹):key 'ihui-auth' = { state:{ isAuthenticated, user }, version }
// token/refreshToken 是 httpOnly cookie 不落盘,这里仅让 isAuthenticated 标志位通过,使 MobileLoginGate
// 放行 harness children(不携带任何生产凭据)。
const IHUI_AUTH = {
  state: { isAuthenticated: true, user: AUTH_USER },
  version: 0,
}

// 通用信封:覆盖 GlobalShell/TopBar 等全局查询(check-update / monitor-panels/query /
// profile 等),避免无后端时整页崩。
// 关键:shape 必须与 app 的 fetchApi 判定一致 —— 成功看 `code: 0`(非 `success` 字段),
// fetchApi 会归一化成 { success:true, data },各 queryFn 再取 res.data.*。
// 字段尽量铺全,让各 queryFn 取到 defined 值(避免 "Query data cannot be undefined")。
const RICH = {
  code: 0,
  message: 'ok',
  data: {
    id: 'u1',
    nickname: 'E2E',
    username: 'e2e',
    avatar: '',
    roleId: 1,
    status: 1,
    mode: 'member',
    role: 'member',
    version: '0.0.0',
    hasUpdate: false,
    items: [],
    list: [],
    data: [],
    rows: [],
    results: [],
    permissions: [],
    conversations: [],
    messages: [],
    workspaces: [],
    notifications: [],
    panels: [],
    monitors: [],
    query: [],
    profile: { id: 'u1', nickname: 'E2E' },
    user: { id: 'u1', nickname: 'E2E' },
  },
}

export async function bootHarnessPage(
  page: Page,
  opts: { mode?: 'smoothness' | 'lifecycle' } = {},
): Promise<void> {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('[harness]')) {
      // eslint-disable-next-line no-console
      console.log(`[browser:${msg.type()}] ${msg.text()}`)
    }
  })
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log(`[pageerror] ${err.message}`)
  })

  await page.addInitScript((authJson: string) => {
    localStorage.setItem('ihui-auth', authJson)
  }, JSON.stringify(IHUI_AUTH))

  await page.route('**/api/auth/me', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: {
          user: { id: 'u1', nickname: 'E2E', username: 'e2e', roleId: 1, status: 1 },
        },
      }),
    }),
  )

  await page.route('**/api/**', (route: Route) => {
    const method = route.request().method()
    if (method !== 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ code: 0, message: 'ok', data: {} }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(RICH),
    })
  })

  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8801'
  const query = opts.mode && opts.mode !== 'smoothness' ? `?mode=${opts.mode}` : ''
  await page.goto(`${base}/e2e-harness/markdown-stream${query}`, { waitUntil: 'domcontentloaded' })
  await page.getByTestId('start-stream').waitFor({ state: 'visible', timeout: 120000 })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
