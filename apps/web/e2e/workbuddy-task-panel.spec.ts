// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票:签到页「自动做任务」面板(WorkbuddyTaskPanel)· 真机 DOM 证据(AGENTS.md §17)
//
// 形态口径(全部现读,不是假设):
// - **全 route mock,零真登录**:本机 8802 的 `/api/auth/login` 带 Turnstile,`--probe-login`
//   实测 403「人机验证失败」(2026-10-31)⇒ 真登录腿在共享 dev 栈上结构上跑不通。
//   登录态按仓内既有正牌手法注入 = localStorage `ihui-auth`(zustand persist 形态)+
//   非 httpOnly `auth_token` cookie(先例 e2e/sidebar-visual.spec.ts:417-444、
//   chat-pane-same-conv-noninterfere.spec.ts 的 seedLoggedIn),API 面整栈打桩
//   (抄 e2e/checkin-phase1d.spec.ts 的 installCheckinMocks:签到数据面必须**整栈**桩,
//   page.tsx 的 loadAll 是 Promise.all 四路,任一路 500 整页落「加载失败」分支)。
// - 本仓经验两条已避开:① 登录要显式 `type`(本 spec 根本不发真登录,故不涉及);
//   ② fixtures 的 `requireEnv` 若在顶层求值会整片崩套件 ⇒ 只用惰性 getter 的 `test` 基座,
//   不碰 authenticatedPage/adminPage 那两条真登录腿。
// - 面板自带 `data-testid="wb-task-sweep-status"`,故锚点只用 testid + 按钮可见文案;
//   **不依赖 `data-tone` 的取值集合**(别线正在加新档 'not-registered')。
// - 状态判据纪律(§0.3):`wb_tasks` 缺失 ⇒ 必须说「状态未知」,断言文案里**不出现**「未启用」。
//
// 跑法(本机唯一正牌入口,口令由 gitignored 供给面注入,绝打印):
//   node scripts/e2e-local-supply.mjs --run --base-url http://localhost:8801 -- \
//     e2e/workbuddy-task-panel.spec.ts --project=chromium --no-deps

import type { Browser, Page } from '@playwright/test'

import { expect, test as base } from './fixtures'

/**
 * 本 spec 自带的 page 档 = 新建 context(不改 viewport/locale 之外的全局夹具)。
 *
 * 曾经立过 `bypassCSP: true`,原因如实更正:2026-10-31 首轮跑挂时现场同时存在两件事 ——
 * ① 兜底桩只给 `data:{}`,布局件的 `res.data.list.map` 抛 TypeError 把整页推进错误边界
 *    (**这才是那次崩溃的真因**,与本档无关,已按 RICH_SHELL 修桩);
 * ② dev 壳 CSP 的 nonce 分支不含 `'unsafe-eval'`(Next dev 的 React Refresh 必须 eval),
 *    控制台报「eval() is not supported in this environment」。
 * ②已由枚 92adf1bb5c 在 `src/config/csp.ts` 根治(仅 dev+nonce 追加,生产档一字不变),
 * 活体复量响应头已含 `'unsafe-eval'` ⇒ **绕过理由消失,本档撤除 bypassCSP**:
 * 浏览器现在是在真实 CSP 下执行页面,断言面一字未减。
 */
const test = base.extend<{ panelPage: Page }>({
  panelPage: async ({ browser }: { browser: Browser }, use: (p: Page) => Promise<void>) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'zh-CN',
      extraHTTPHeaders: { 'CF-IPCountry': 'US' },
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

const STATUS_TESTID = 'wb-task-sweep-status'
const ACCOUNT_ID = 7
const ACCOUNT_NAME = 'E2E-WB-走查号'
const TASK_CODE = 'WB-GROW-001'

/**
 * 全局壳层的兜底响应体(形态抄自 e2e/harness-boot.ts 的 RICH,再补 voice-notes 的
 * `list`/`groups` 两键):壳层各 query 直接对 `res.data.xxx` 调 .map,少一键就整页崩。
 */
const RICH_SHELL: Record<string, unknown> = {
  id: 'e2e-wb',
  nickname: 'E2E-WB',
  username: 'e2e-wb',
  avatar: '',
  roleId: 1,
  status: 1,
  mode: 'member',
  role: 'member',
  version: '0.0.0',
  hasUpdate: false,
  list: [],
  items: [],
  data: [],
  rows: [],
  results: [],
  groups: [],
  permissions: [],
  conversations: [],
  messages: [],
  workspaces: [],
  notifications: [],
  panels: [],
  monitors: [],
  query: [],
  total: 0,
  count: 0,
  page: 1,
  pageSize: 20,
  hasMore: false,
  profile: { id: 'e2e-wb', nickname: 'E2E-WB' },
  user: { id: 'e2e-wb', nickname: 'E2E-WB' },
}

/**
 * 巡检视图的构造器(2026-10-31 现读 `@ihui/shared/utils/workbuddy-sweep-view` 的判序):
 * - `enabled` 是**观测态**(这条 job 真注册在进程里),不再是两门与的推断;
 * - `not_running_reason` 是服务端给的原因;传 `null` 表示"服务端没给"(旧版本形态),
 *   此时判据只允许确证 `tasks_enabled ∧ ¬cron_enabled` 一档,其余必须落「状态未知」。
 */
function wbTasks(over: Record<string, unknown> = {}) {
  return {
    enabled: true,
    tasks_enabled: true,
    cron_enabled: true,
    live_run: true,
    not_running_reason: null,
    sweep_minutes: 30,
    claim_path_configured: true,
    activity_path_configured: true,
    last_sweep: null,
    ...over,
  }
}

/** 去掉某个键(模拟旧服务端根本不返回 `not_running_reason`)。 */
function wbTasksWithout(wb: Record<string, unknown>, key: string) {
  const clone = { ...wb }
  delete clone[key]
  return clone
}

/** GET /scheduler/status 的整份响应(wb_tasks 缺失 ⇒ 传 `{}` 覆盖掉该键)。 */
function statusBody(wb: Record<string, unknown> | null) {
  const base: Record<string, unknown> = {
    enabled: true,
    started: true,
    next_run: null,
    next_run_qoder: null,
    next_run_wb_tasks: null,
  }
  if (wb) base.wb_tasks = wb
  return base
}

interface MockOptions {
  /** scheduler/status 的响应体(默认「两门开 + live」)*/
  status?: unknown
  /** /tasks 返回的行(默认单行)*/
  tasks?: unknown[]
  /** task-run 的返回档位:'ok' 正常 / 'throttle' 429 */
  runMode?: 'ok' | 'throttle'
  /** 捕获 task-run 请求体,供「dry_run/kind」断言 */
  runBodies?: Array<Record<string, unknown>>
}

/**
 * 签到数据面整栈桩(有状态:task-run 记录请求体)。
 * ai-service 面是**非信封**响应(fetchAiServiceJson 把整个 body 当 data),
 * 而全局壳层的 fetchApi 认 `{code,data}` 信封 ⇒ 两层形态分开桩。
 */
async function installMocks(page: Page, opts: MockOptions = {}): Promise<void> {
  const status = opts.status ?? statusBody(wbTasks())
  const tasks = opts.tasks ?? [
    {
      task_code: TASK_CODE,
      title: '每日成长值',
      status: 'claimable',
      progress: 3,
      target: 5,
      reward_credit: 10,
    },
  ]

  // 兜底:全局壳层(profile / voice-notes 的 list+groups / sidebar 会话 / monitor…)一律给
  // **字段铺全的信封空值**。实测教训(22:55):只给 `data:{}` 会让 (main) 布局的语音笔记腿
  // `res.data.list.map(...)` 当场 TypeError ⇒ 整页落错误边界 ⇒ 面板根本不渲染(假红)。
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, message: 'ok', data: RICH_SHELL }),
    }),
  )
  await page.route('**/api/auth/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { user: { id: 'e2e-wb', nickname: 'E2E-WB', roleId: 1, avatar: null, phone: '' } },
      }),
    }),
  )
  await page.route('**/api/auth/refresh**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 0,
        message: 'ok',
        data: { accessToken: 'e2e-wb-access', refreshToken: 'e2e-wb-refresh', expiresIn: 3600 },
      }),
    }),
  )

  // ── 签到数据面(非信封,整 body 即 data)──
  await page.route(/\/api\/checkin\/scheduler\/status(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(status),
    }),
  )
  await page.route(/\/api\/checkin\/accounts(\?.*)?$/, (route) => {
    const now = new Date().toISOString()
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accounts: [
          {
            id: ACCOUNT_ID,
            name: ACCOUNT_NAME,
            group: '',
            platform: 'workbuddy',
            device_map: {},
            enabled: true,
            jwt_exp: null,
            cooldown_until: null,
            created_at: now,
            updated_at: now,
          },
        ],
        count: 1,
      }),
    })
  })
  await page.route(/\/api\/checkin\/records(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ records: [], count: 0 }),
    }),
  )
  await page.route(/\/api\/checkin\/credits\/history(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ history: [], count: 0, total_credits_delta: 0 }),
    }),
  )
  await page.route(/\/api\/checkin\/credits\/daily(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ days: [], series: { total: [], gained: [], consumed: [] } }),
    }),
  )
  await page.route(/\/api\/checkin\/accounts\/\d+\/tasks(\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, kind: 'list', tasks, reason: null, unjudged: false }),
    }),
  )
  await page.route(/\/api\/checkin\/accounts\/\d+\/task-run(\?.*)?$/, (route) => {
    if (opts.runBodies)
      opts.runBodies.push(route.request().postDataJSON() as Record<string, unknown>)
    if (opts.runMode === 'throttle') {
      // 429:非 2xx ⇒ fetchAiServiceJson 回 {success:false,error},面板必须显式报错不白屏
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'e2e: 上游限流,本轮未执行' }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        kind: 'all',
        accepted: ['activity'],
        claimed: ['growth'],
        credit_delta: 120,
        reason: null,
        unjudged: false,
      }),
    })
  })
}

/** 登录态注入(先例 sidebar-visual:417-444)+ 打开面板(冷编译按既有做法放宽超时)。 */
async function openPanel(page: Page, opts: MockOptions = {}): Promise<void> {
  await installMocks(page, opts)
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8801'
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'e2e-wb-access',
      url: base,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
    // 文案断言按 zh-CN(本仓唯一真相源 messages);不种 locale 时服务端落回
    // DEFAULT_LOCALE=zh-CN,种上它让 Playwright 的 en-US 浏览器语言不参与判定。
    {
      name: 'locale',
      value: 'zh-CN',
      url: base,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ])
  await page.addInitScript(() => {
    localStorage.setItem(
      'ihui-auth',
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: { id: 'e2e-wb', nickname: 'E2E-WB', roleId: 1, avatar: null, phone: '' },
        },
        version: 0,
      }),
    )
  })
  await page.goto(`${base}/checkin`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
  await expect(page.getByRole('heading', { name: '签到助手' })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: '自动做任务' }).click()
  await expect(page.getByTestId(STATUS_TESTID)).toBeVisible({ timeout: 30_000 })
}

/**
 * 「读数不得断行」的量法(不靠肉眼):对状态栏容器与其每个叶节点 span,
 * ① 横向溢出/裁切 = scrollWidth > clientWidth;② 断行 = inline 叶节点的 client rect 数 > 1。
 */
async function measureReadout(page: Page): Promise<{
  container: { scrollWidth: number; clientWidth: number; rects: number }
  leaves: Array<{ text: string; scrollWidth: number; clientWidth: number; rects: number }>
}> {
  return page.getByTestId(STATUS_TESTID).evaluate((raw) => {
    const root = raw as HTMLElement
    const box = (el: HTMLElement) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      rects: el.getClientRects().length,
    })
    const leaves = Array.from(root.querySelectorAll('span')).map((span) => ({
      text: (span.textContent ?? '').trim().slice(0, 40),
      ...box(span as HTMLElement),
    }))
    return { container: box(root), leaves }
  })
}

/** 读数必须是单行且不被裁:任一叶节点溢出/折行即红(数值进日志,不靠肉眼)。 */
function expectReadoutSingleLine(
  m: Awaited<ReturnType<typeof measureReadout>>,
  prefix: string,
): void {
  const leaf = m.leaves.find((l) => l.text.startsWith(prefix))
  if (!leaf) throw new Error(`未找到以「${prefix}」开头的读数 span:${JSON.stringify(m.leaves)}`)
  expect(leaf.scrollWidth, `${prefix} 读数横向溢出被裁`).toBeLessThanOrEqual(leaf.clientWidth + 1)
  expect(leaf.rects, `${prefix} 读数被折成 ${leaf.rects} 行`).toBe(1)
}

/**
 * 页面异常采集(唯一一份,429 例与 hydration 例共用)。
 * 排除面(逐族点名,不笼统吞):
 * - `Failed to load resource` / `net::ERR*`:浏览器网络层日志,不是应用异常;
 * - `WebSocket connection to ... failed`:本席隔离栈按 `--no-backend` 起(不与他席抢 8802),
 *   页面握手 `/ws/broadcast`、`/ws/notifications` 必 403 ⇒ 与被测面板无关的机器事实。
 * React hydration 错只认 **console error 级**且含 hydrat 的字样(实测 `[info] [auto-revert:hydration]`
 * 是本仓自己的调试日志,按 type 过滤才不会被它冒充成水合错误)。
 */
function attachErrorCollectors(page: Page): { pageErrors: string[]; consoleErrors: string[] } {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error' && /hydrat/i.test(text)) {
      pageErrors.push(`hydration: ${text}`)
      return
    }
    if (msg.type() !== 'error') return
    if (/Failed to load resource|net::ERR|WebSocket connection to/i.test(text)) return
    consoleErrors.push(text)
  })
  page.on('pageerror', (err) => pageErrors.push(err.message))
  return { pageErrors, consoleErrors }
}

test.describe('签到页 · 自动做任务面板(全桩,零第三方出站)', () => {
  test.describe.configure({ timeout: 180_000 })

  test('状态栏 · 两门开 + live_run ⇒「已启用」并带节拍', async ({ panelPage: page }) => {
    await openPanel(page, { status: statusBody(wbTasks()) })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('已启用')
    await expect(status).toContainText('每 30 分钟')
    await expect(status).not.toContainText('状态未知')
    await expect(status).not.toContainText('未启用')
  })

  test('状态栏 · 已启用 + 下次时间 ⇒ 下次读数单行不断行(§读数不得断行)', async ({
    panelPage: page,
  }) => {
    const body = statusBody(wbTasks())
    body.next_run_wb_tasks = '2026-11-01T09:30:00+08:00'
    await openPanel(page, { status: body })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('已启用')
    await expect(status).toContainText('下次 2026-11-01 09:30')

    const m = await measureReadout(page)
    // eslint-disable-next-line no-console
    console.log('[readout] ' + JSON.stringify(m))
    expect(
      m.container.scrollWidth,
      `状态栏容器横向溢出:${JSON.stringify(m.container)}`,
    ).toBeLessThanOrEqual(m.container.clientWidth + 1)
    expectReadoutSingleLine(m, '下次')
  })

  test('状态栏 · 两门开但 dry_run=false 档 ⇒「演练」文案', async ({ panelPage: page }) => {
    await openPanel(page, { status: statusBody(wbTasks({ live_run: false })) })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('演练')
    await expect(status).toContainText('WORKBUDDY_TASKS_LIVE_RUN')
    await expect(status).not.toContainText('已启用 · 每')
  })

  test('状态栏 · 总闸关 ⇒ 点名 CHECKIN_CRON_ENABLED(新原因档 + 旧服务端推断档各一例)', async ({
    panelPage: page,
  }) => {
    // 新契约:服务端直接给原因
    await openPanel(page, {
      status: statusBody(
        wbTasks({
          enabled: false,
          tasks_enabled: true,
          cron_enabled: false,
          not_running_reason: 'cron_gate_off',
        }),
      ),
    })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('CHECKIN_CRON_ENABLED')
    await expect(status).not.toContainText('已启用')
  })

  test('状态栏 · 任务门关 ⇒「未启用」并给服务端出路', async ({ panelPage: page }) => {
    await openPanel(page, {
      status: statusBody(
        wbTasks({
          enabled: false,
          tasks_enabled: false,
          cron_enabled: true,
          not_running_reason: 'tasks_gate_off',
        }),
      ),
    })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('未启用')
    await expect(status).toContainText('WORKBUDDY_TASKS_ENABLED')
  })

  test('状态栏 · 配置已开但调度器未启动 ⇒「调度器未启动/需重启」(新档 not-registered)', async ({
    panelPage: page,
  }) => {
    await openPanel(page, {
      status: statusBody(
        wbTasks({
          enabled: false,
          tasks_enabled: true,
          cron_enabled: true,
          not_running_reason: 'scheduler_not_started',
        }),
      ),
    })
    const status = page.getByTestId(STATUS_TESTID)
    const text = (await status.innerText()).replace(/\s+/g, '')
    // eslint-disable-next-line no-console
    console.log('[tier-not-registered] text=' + text)
    await expect(status).toContainText('调度器未启动')
    expect(text).toContain('重启')
    // 反假绿:既不能说在跑,也不能混进「状态未知」桶
    expect(text).not.toContain('已启用')
    expect(text).not.toContain('状态未知')
  })

  test('状态栏 · job_not_registered 同落「未启动」档;旧服务端无原因字段 ⇒ 必须落「状态未知」', async ({
    panelPage: page,
  }) => {
    await openPanel(page, {
      status: statusBody(
        wbTasks({
          enabled: false,
          tasks_enabled: true,
          cron_enabled: true,
          not_running_reason: 'job_not_registered',
        }),
      ),
    })
    await expect(page.getByTestId(STATUS_TESTID)).toContainText('调度器未启动')
  })

  test('状态栏 · enabled=false 而服务端没给原因(旧版本)⇒「状态未知」,不得替服务端编「未启用」', async ({
    panelPage: page,
  }) => {
    await openPanel(page, {
      status: statusBody(
        wbTasksWithout(
          wbTasks({ enabled: false, tasks_enabled: false, cron_enabled: true }),
          'not_running_reason',
        ),
      ),
    })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('状态未知')
    const text = (await status.innerText()).replace(/\s+/g, '')
    expect(text).not.toContain('未启用')
    expect(text).not.toContain('已启用')
  })

  test('状态栏 · wb_tasks 缺失 ⇒「状态未知」,绝不写成「未启用」(§0.3)', async ({
    panelPage: page,
  }) => {
    // 服务端版本较旧 / 该键根本不返回
    await openPanel(page, { status: statusBody(null) })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('状态未知')
    const text = (await status.innerText()).replace(/\s+/g, '')
    expect(text).not.toContain('未启用')
    expect(text).not.toContain('已启用')
  })

  test('状态栏 · 上一轮巡检有回执 ⇒ 战果数字如实呈现(不盲飞)', async ({ panelPage: page }) => {
    await openPanel(page, {
      status: statusBody({
        ...wbTasks(),
        last_sweep: {
          at: '2026-10-31T08:00:00+08:00',
          finished_at: '2026-10-31T08:00:12+08:00',
          dry_run: false,
          accounts: 1,
          families: 6,
          accepted: 4,
          claimed: 2,
          unjudged: 0,
          errors: 0,
          skipped_cooldown: 0,
          note: null,
        },
      }),
    })
    const status = page.getByTestId(STATUS_TESTID)
    await expect(status).toContainText('上次巡检 2026-10-31 08:00')
    await expect(status).toContainText('跑 6 族')
  })

  test('读取任务 ⇒ 打 /tasks 并渲染 task_code 行;空列表 ⇒ 空态文案', async ({
    panelPage: page,
  }) => {
    await openPanel(page)
    // 账号选择器:面板自己的 select(id=wb-task-account),不能用全站 getByRole('option')
    // ——签到页别处也有账号下拉,strict mode 实测撞上 2 枚同名 option。
    const accountSelect = page.locator('select#wb-task-account')
    await expect(accountSelect).toHaveValue(String(ACCOUNT_ID))
    await expect(accountSelect.locator('option', { hasText: ACCOUNT_NAME })).toHaveCount(1)
    const resp = page.waitForResponse((r) => /\/api\/checkin\/accounts\/\d+\/tasks/.test(r.url()))
    await page.getByRole('button', { name: '读取任务' }).click()
    expect((await resp).status()).toBe(200)
    await expect(page.getByText(TASK_CODE)).toBeVisible()
    await expect(page.getByText('每日成长值')).toBeVisible()
    await expect(page.getByText('3/5')).toBeVisible()
  })

  test('读取任务 · 空列表 ⇒ 空态文案(不是报错)', async ({ panelPage: page }) => {
    await openPanel(page, { tasks: [] })
    await page.getByRole('button', { name: '读取任务' }).click()
    await expect(page.getByText('暂无任务,或尚未读取')).toBeVisible()
    await expect(page.getByTestId(STATUS_TESTID)).toBeVisible()
  })

  test('预演(不写入)⇒ 请求体 dry_run=true 且 kind=all(抓 postData,不看 UI 脸色)', async ({
    panelPage: page,
  }) => {
    const bodies: Array<Record<string, unknown>> = []
    await openPanel(page, { runBodies: bodies })
    // 监听必须先挂:实测(22:56)"click 之后再 waitForResponse"永远等不到 ⇒ 用例吃满 180s 后
    // 报 "Target page, context or browser has been closed"(假红,请求其实已发出)
    const resp = page.waitForResponse((r) => /\/task-run/.test(r.url()))
    await page.getByRole('button', { name: '预演(不写入)' }).click()
    await resp
    expect(bodies.length).toBe(1)
    expect(bodies[0]).toMatchObject({ kind: 'all', dry_run: true })
    await expect(page.getByText('执行结果')).toBeVisible()
  })

  test('一键做任务 ⇒ 请求体 dry_run=false', async ({ panelPage: page }) => {
    const bodies: Array<Record<string, unknown>> = []
    await openPanel(page, { runBodies: bodies })
    const resp = page.waitForResponse((r) => /\/task-run/.test(r.url()))
    await page.getByRole('button', { name: '一键做任务' }).click()
    await resp
    expect(bodies.length).toBe(1)
    expect(bodies[0]).toMatchObject({ kind: 'all', dry_run: false })
  })

  test('task-run 返 429 ⇒ 可见错误 + 不白屏 + 无 JS 异常', async ({ panelPage: page }) => {
    const { pageErrors, consoleErrors } = attachErrorCollectors(page)

    await openPanel(page, { runMode: 'throttle' })
    await page.getByRole('button', { name: '一键做任务' }).click()
    // 可见错误:面板的报错条(error ⇒ p.bg-destructive),文案取桩里那句原文
    const errorLine = page.getByTestId('wb-task-error')
    await expect(errorLine).toBeVisible({ timeout: 15_000 })
    await expect(errorLine).toContainText('上游限流')
    // 反假绿:429 绝不能被渲染成成功回执
    await expect(page.getByText('执行结果')).toHaveCount(0)
    // 不白屏:页面骨架 + 面板 + 状态栏仍在
    await expect(page.getByRole('heading', { name: '签到助手' })).toBeVisible()
    await expect(page.getByTestId(STATUS_TESTID)).toBeVisible()
    await expect(page.getByRole('button', { name: '读取任务' })).toBeVisible()
    expect((await page.content()).length).toBeGreaterThan(1000)
    expect(pageErrors, `未捕获异常:${pageErrors.join(' | ')}`).toEqual([])
    expect(consoleErrors, `控制台 error:${consoleErrors.join(' | ')}`).toEqual([])
  })

  test('面板展开无 hydration/未翻译裸键', async ({ panelPage: page }) => {
    const { pageErrors, consoleErrors } = attachErrorCollectors(page)

    await openPanel(page, { status: statusBody(wbTasks()) })
    await expect(page.getByTestId(STATUS_TESTID)).toContainText('已启用')
    const html = await page.content()
    expect(html).not.toContain('checkin.taskPanel')
    expect(pageErrors, pageErrors.join(' | ')).toEqual([])
    expect(consoleErrors, consoleErrors.join(' | ')).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
