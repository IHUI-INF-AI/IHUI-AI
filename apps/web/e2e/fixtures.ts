import { test as base, expect, type Page, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

/**
 * E2E 共享 fixtures：提供已登录状态的 storageState 注入。
 *
 * 认证机制（与 src/stores/auth.ts、middleware.ts 对齐）：
 * - 登录接口：POST /api/auth/login，body 为 { account, password }；
 *   `account` 字段接受 username / email / phone 三选一（后端 findUserByAccount 统一匹配，见 apps/api/src/routes/auth.ts:55-58 + apps/api/src/db/queries.ts:45-52）
 * - 成功返回 { code: 0, data: { accessToken, ... } }
 * - token 写入 cookie `auth_token`（middleware 也会兜底读取 `token`）
 * - JWT payload 含 userId / roleId / role / exp；admin 判定：roleId >= 1
 *
 * 账号来源：
 * - 普通用户（test@aizhs.top / Test@123456）由 seed 脚本保证
 * - admin（admin / admin123）是真正的 system admin，由 packages/database/drizzle/0067_system_admin.sql + 0071_restore_admin_immutability.sql 迁移保证；
 *   由于 0067 触发器让 system admin 不可变，本 fixtures 不再 seed 冗余的 admin@aizhs.top 账号
 *
 * 现有 34 个 spec 文件直接 `import { test } from '@playwright/test'`，不受本文件影响；
 * 需要登录态的新测试可 `import { test, expect } from './fixtures'` 并使用 authenticatedPage / adminPage。
 */

// 测试用户凭据（从环境变量读取，提供默认值，不硬编码敏感信息）
const TEST_USER = {
  account: process.env.E2E_USER_ACCOUNT ?? 'test@aizhs.top',
  password: process.env.E2E_USER_PASSWORD ?? 'Test@123456',
}

const ADMIN_USER = {
  account: process.env.E2E_ADMIN_ACCOUNT ?? 'admin',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'admin123',
}

// storageState 文件路径
const USER_STORAGE_STATE = 'e2e/.auth/user.json'
const ADMIN_STORAGE_STATE = 'e2e/.auth/admin.json'

type Credentials = typeof TEST_USER

/**
 * 通过 UI 登录并保存 storageState。
 * 注意：邮箱登录表单含图形验证码（CaptchaCanvas），UI 流程可能不稳定，
 * 优先使用 apiLoginAndSaveStorageState；此函数保留用于端到端 UI 验证。
 */
/**
 * 从 Set-Cookie headers 中提取 refresh_token 值。
 * 与 apiLoginAndSaveStorageState 共享，放模块级避免作用域问题。
 */
function parseRefreshTokenFromSetCookie(res: {
  headersArray(): Array<{ name: string; value: string }>
}): string | undefined {
  for (const h of res.headersArray()) {
    if (h.name.toLowerCase() !== 'set-cookie') continue
    const m = /(?:^|;\s*)refresh_token=([^;]+)/i.exec(h.value)
    if (m) return m[1]
  }
  return undefined
}

async function loginAndSaveStorageState(
  page: Page,
  credentials: Credentials,
  storageStatePath: string,
) {
  await page.goto('/login')

  // 邮箱登录表单字段(见 src/components/login/EmailLogin.tsx);
  // account 字段为 username/email/phone 三选一时,统一提交到 #email-login-email 输入框
  const emailInput = page.locator('input[type="email"], input#email-login-email').first()
  const passwordInput = page.locator('input[type="password"]').first()
  await emailInput.fill(credentials.account)
  await passwordInput.fill(credentials.password)

  // 提交（按钮文案可能为“登录”/“Sign in”）
  await page.getByRole('button', { name: /登录|登 录|sign in|login/i }).click()

  // 等待登录成功：跳转首页或 dashboard（避免 `'/' || regex` 恒为 '/' 的错误写法）
  await page.waitForURL(
    (url: any) => {
      const p = url.pathname
      return p === '/' || /\/dashboard/.test(p)
    },
    { timeout: 15000 },
  )

  // 保存 storageState（含 cookie / localStorage）
  await page.context().storageState({ path: storageStatePath })
}

/**
 * 通过 API 直接登录（更快，不经过 UI，绕过验证码）。
 * 调用真实接口 /api/auth/login，将 accessToken 写入 cookie。
 *
 * 429 退避(2026-08-26 实锤):api 的 /api/auth/login 自带 Fastify 限流
 * max:5/1min(apps/api/src/routes/auth.ts:600 安全加固)。e2e 全量多 worker
 * 并发登录 → 429,storage 创建失败 → 后续用例连锁失败。这里对 429 退避重试
 * (读 Retry-After 或默认 65s),配合 ensureStorageState 的并发锁,正常每次
 * 运行仅登录 1-2 次,退避只是兜底。
 */
async function apiLoginAndSaveStorageState(
  request: APIRequestContext,
  baseURL: string,
  credentials: Credentials,
  storageStatePath: string,
) {
  const MAX_ATTEMPTS = 4
  let response: Awaited<ReturnType<APIRequestContext['post']>> | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    response = await request.post(`${baseURL}/api/auth/login`, {
      data: {
        account: credentials.account,
        password: credentials.password,
      },
    })
    if (response.status() !== 429) break
    const retryAfter = Number(response.headers()['retry-after'] ?? 0) || 65
    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`登录被限流(429)重试 ${MAX_ATTEMPTS} 次仍失败`)
    }
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000))
  }
  if (!response) throw new Error('登录请求未发出')

  if (!response.ok()) {
    throw new Error(`登录请求失败: ${response.status()} ${response.statusText}`)
  }

  const body = (await response.json()) as {
    code?: number
    message?: string
    data?: {
      accessToken?: string
      token?: string
      userId?: string
      refreshToken?: string
      user?: { id: string; nickname?: string }
    }
    token?: string
    user?: unknown
  }

  // 后端约定 code === 0 表示成功
  if (body.code !== 0) {
    throw new Error(`登录业务失败: code=${body.code} message=${body.message ?? ''}`)
  }

  const token = body.data?.accessToken ?? body.data?.token ?? body.token
  if (!token) {
    throw new Error('登录响应缺少 token 字段')
  }

  // P2-18(2026-08-14):登录链路 httpOnly cookie 化 —— 后端 setAuthCookies 会
  // Set-Cookie auth_token + refresh_token 两个 httpOnly cookie;刷新链路
  // /api/auth/refresh 从 refresh_token cookie 读(前端 JS 读不到)。
  // 若 storage 缺 refresh_token,页面加载后 bootstrap 的 refresh 无 cookie →
  // 400 "refreshToken 必填" → startAutoRefresh 失败回调自动弹登录框
  // (z-modal 遮罩拦截)→ e2e 全量 ~100 用例系统性失败(2026-08-26 实锤)。
  // 优先从 Set-Cookie 抓 refresh_token,body.data.refreshToken 兜底。
  const refreshTokenFromCookie = parseRefreshTokenFromSetCookie(response)
  const refreshToken = refreshTokenFromCookie ?? body.data?.refreshToken

  const hostname = new URL(baseURL).hostname

  // 构建 storageState：cookie auth_token 是 middleware 真正读取的字段；
  // 同时写入 token 兜底（middleware getToken 兼容两个名称）。
  const storageState = {
    cookies: [
      {
        name: 'auth_token',
        value: token,
        domain: hostname,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
      {
        name: 'token',
        value: token,
        domain: hostname,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax' as const,
      },
      ...(refreshToken
        ? [
            {
              name: 'refresh_token',
              value: refreshToken,
              domain: hostname,
              path: '/',
              // 与后端一致置 httpOnly:应用 JS 无需读它,refresh 请求自动附带
              httpOnly: true,
              secure: false,
              sameSite: 'Lax' as const,
            },
          ]
        : []),
    ],
    origins: [
      {
        origin: baseURL,
        localStorage: [
          { name: 'token', value: token },
          { name: 'user', value: JSON.stringify(body.data ?? {}) },
          // 恢复 auth store 持久化标志位(仅 isAuthenticated + user):
          // 缺失时应用启动 isAuthenticated=false,即便 refresh 成功也会有一段
          // 未登录窗口,期间非 GET 401 会触发登录弹窗(2026-08-26 实锤)。
          {
            name: 'ihui-auth',
            value: JSON.stringify({
              state: {
                isAuthenticated: true,
                user: body.data?.user ?? { id: body.data?.userId ?? '', nickname: '' },
              },
              version: 0,
            }),
          },
        ],
      },
    ],
  }

  const dir = path.dirname(storageStatePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(storageStatePath, JSON.stringify(storageState, null, 2))
}

/**
 * 回写 storageState 的 auth cookies(刷新轮转后更新,保持 storage 自愈)。
 * refresh 单次轮转(api 侧 RFC 6749 §10.4),每次 refresh 后旧 refresh_token 吊销;
 * 若不回写,下次测试仍用旧 token → /api/auth/refresh 401 → 应用弹登录框。
 */
async function updateStorageCookies(
  storageStatePath: string,
  cookies: Array<{
    name: string
    value: string
    httpOnly?: boolean
    domain?: string
    path?: string
    secure?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
  }>,
): Promise<void> {
  type StorageCookie = {
    name: string
    value: string
    httpOnly?: boolean
    domain?: string
    path?: string
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
  }
  try {
    const raw = await fs.readFile(storageStatePath, 'utf8')
    const state = JSON.parse(raw) as {
      cookies?: StorageCookie[]
    }
    if (!Array.isArray(state.cookies)) return
    for (const c of cookies) {
      const existing = state.cookies.find((x) => x.name === c.name)
      if (existing) {
        existing.value = c.value
        if (c.httpOnly !== undefined) existing.httpOnly = c.httpOnly
      } else {
        // 新 cookie:以现有 auth_token 的 domain/path 为模板
        const tmpl = state.cookies.find((x) => x.name === 'auth_token') ?? state.cookies[0]
        state.cookies.push({
          name: c.name,
          value: c.value,
          domain: tmpl?.domain ?? 'localhost',
          path: tmpl?.path ?? '/',
          httpOnly: c.httpOnly ?? false,
          secure: tmpl?.secure ?? false,
          sameSite: tmpl?.sameSite ?? 'Lax',
        })
      }
    }
    await fs.writeFile(storageStatePath, JSON.stringify(state, null, 2))
  } catch {
    /* 回写失败不影响本次运行(下次校验会重新登录) */
  }
}

/**
 * 校验 storageState 里的会话是否仍有效,并在 refresh 轮转成功后回写新 token。
 *
 * 背景(2026-08-26 实锤,e2e 全量 623 用例中 ~100 个系统性失败的根因):
 * - api access token TTL 15 分钟,refresh token 单次轮转(RFC 6749 重用检测);
 * - 应用启动 bootstrap 用 refresh_token cookie 静默刷新恢复会话;storageState 只创建一次,
 *   轮转后的新 refresh token 只存在于浏览器 context,不回写文件 → 后续测试加载旧 storage:
 *   /api/auth/refresh 401 → 应用自动弹登录框(z-modal 遮罩拦截指针事件)→ 点击全部超时。
 *
 * 校验方式:用 storage 的 refresh_token 调 POST /api/auth/refresh:
 *   200 → 会话有效且已轮转 → 回写新 accessToken/refreshToken → true(复用);
 *   401/400 → 会话失效 → false(触发重新登录)。
 */
async function isStorageStateValid(
  request: APIRequestContext,
  baseURL: string,
  storageStatePath: string,
): Promise<boolean> {
  try {
    // mtime 缓存(2026-08-26 实锤):storage 文件 10 分钟内视为有效,直接复用。
    // 背景:20 个 worker 并发创建 adminPage 时若全部走 refresh 轮转(每次都是
    // 网络调用+文件回写),fixture setup 30s 超时;mtime 缓存让绝大多数 worker
    // 瞬时通过,只有文件超过 10 分钟的才做 refresh(access TTL 15min,10min 时
    // 轮转一次后新 token 再覆盖 15min,无过期窗口)。
    const stat = await fs.stat(storageStatePath)
    if (Date.now() - stat.mtimeMs < 10 * 60 * 1000) return true
    const raw = await fs.readFile(storageStatePath, 'utf8')
    const state = JSON.parse(raw) as { cookies?: Array<{ name: string; value: string }> }
    const rt = state.cookies?.find((c) => c.name === 'refresh_token')?.value
    if (!rt) return false
    const res = await request.post(`${baseURL}/api/auth/refresh`, {
      headers: { cookie: `refresh_token=${rt}` },
      // 必须带 body {}:refresh 路由 schema body.type='object' 对 undefined body
      // 校验失败返回 400(2026-08-26 实锤)——无 body 的 POST 永远到不了 handler,
      // storage 的 refresh_token 从未被轮转回写,一旦被应用 bootstrap 消费即失效。
      data: {},
    })
    if (!res.ok()) return false
    const body = (await res.json().catch(() => null)) as {
      data?: { accessToken?: string; refreshToken?: string }
    } | null
    const newAccess = body?.data?.accessToken
    if (!newAccess) return false
    const newRefresh = body?.data?.refreshToken ?? parseRefreshTokenFromSetCookie(res) ?? rt
    await updateStorageCookies(storageStatePath, [
      { name: 'auth_token', value: newAccess },
      { name: 'token', value: newAccess },
      { name: 'refresh_token', value: newRefresh, httpOnly: true },
    ])
    return true
  } catch {
    return false
  }
}

/**
 * storage 创建/校验的进程级并发锁(mkdir 原子性)。
 *
 * 背景(2026-08-26 实锤):playwright 本地 workers=CPU/2(fullyParallel:true),
 * 多个 worker 首次同时发现 storage 文件缺失 → 并发调 /api/auth/login →
 * 撞 5 次/分钟限流(429) → storage 创建失败 → 后续用例连锁失败。
 *
 * 锁保证同一时刻只有一个 worker 执行"创建/校验/回写",其余 worker 轮询等待
 * 锁释放后复用文件。超时 90s(覆盖 429 退避的 65s 窗口)。
 */
async function acquireStorageLock(
  storageStatePath: string,
  timeoutMs = 45_000,
): Promise<() => Promise<void>> {
  const lockPath = `${storageStatePath}.lock`
  const start = Date.now()
  for (;;) {
    try {
      await fs.mkdir(lockPath)
      return async () => {
        // 释放失败不能静默吞:记录原因,便于排查残留锁
        try {
          await fs.rmdir(lockPath)
        } catch (e) {
          console.warn(
            `[fixtures] storage 锁释放失败(${lockPath}): ${(e as Error).message} — 将残留至下次僵尸回收`,
          )
        }
      }
    } catch {
      // 僵尸锁自愈(2026-08-26 实锤):fixture setup 超时 → Playwright 杀 worker →
      // finally 未执行 → 锁目录残留 → 下一轮所有 worker 卡在等锁连锁超时。
      // 正常持有 <5s,锁目录 mtime 超过 60s 视为持有者已死,强制回收。
      try {
        const stat = await fs.stat(lockPath)
        if (Date.now() - stat.mtimeMs > 60_000) {
          await fs.rm(lockPath, { recursive: true, force: true })
          continue
        }
      } catch {
        /* 锁目录已被其他 worker 释放,继续轮询 */
      }
      if (Date.now() - start > timeoutMs) {
        throw new Error(`获取 storage 锁超时: ${storageStatePath}`)
      }
      await new Promise((r) => setTimeout(r, 250))
    }
  }
}

/**
 * 确保 storageState 文件存在且会话有效；文件缺失或 token 失效时通过 API 登录创建/刷新。
 * 让 chromium project 下使用 authenticatedPage 的测试即使未预先执行 setup 也能跑通。
 *
 * 全程持锁:创建/校验/回写串行化,避免多 worker 并发登录触发 429 限流。
 */
async function ensureStorageState(
  request: APIRequestContext,
  baseURL: string,
  credentials: Credentials,
  storageStatePath: string,
) {
  const release = await acquireStorageLock(storageStatePath)
  try {
    try {
      await fs.access(storageStatePath)
    } catch {
      await apiLoginAndSaveStorageState(request, baseURL, credentials, storageStatePath)
      return
    }
    // 文件存在但会话可能已失效(access 过期 / refresh 被轮转消费)→ 重新登录
    if (!(await isStorageStateValid(request, baseURL, storageStatePath))) {
      await apiLoginAndSaveStorageState(request, baseURL, credentials, storageStatePath)
    }
  } finally {
    await release()
  }
}

// 扩展 test fixture，提供已登录的 page
// 仅新增 test 级 fixture authenticatedPage / adminPage；
// browser / request / baseURL 均直接复用 @playwright/test 内置 fixture
const test = base.extend<{ authenticatedPage: Page; adminPage: Page }>({
  authenticatedPage: async ({ browser, request, baseURL }: any, use: any) => {
    await ensureStorageState(request, baseURL ?? '', TEST_USER, USER_STORAGE_STATE)
    const context = await browser.newContext({ storageState: USER_STORAGE_STATE })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  adminPage: async ({ browser, request, baseURL }: any, use: any) => {
    await ensureStorageState(request, baseURL ?? '', ADMIN_USER, ADMIN_STORAGE_STATE)
    const context = await browser.newContext({ storageState: ADMIN_STORAGE_STATE })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

// 导出 test（与 @playwright/test 的 test 兼容，现有 spec 无需改动）
export const setupTest = test
// 2026-08-26:同时导出 test 本身,spec 可 import { test } from './fixtures'
// 直接使用 authenticatedPage / adminPage 扩展 fixture(如 chat-mode-badge 迁移)。
export { test }

// 导出登录辅助函数与路径
export {
  loginAndSaveStorageState,
  apiLoginAndSaveStorageState,
  ensureStorageState,
  TEST_USER,
  ADMIN_USER,
  USER_STORAGE_STATE,
  ADMIN_STORAGE_STATE,
}

// 重新导出 expect 方便使用
export { expect }
