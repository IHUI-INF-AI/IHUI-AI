// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到助手 Phase1c+1d 全流程 UI 走查(登录态,走真实 8803 后端)。
 *
 * 覆盖:分组录入/徽章/筛选/编辑对话框、JWT 徽章、三个 tab(签到记录/积分历史/
 * 积分看板)、调度状态徽章、一键全部签到按钮存在(不点击,避免真实外网签到)、
 * 删除清理。数据自建自删,不依赖外部状态。
 *
 * 运行:cd apps/web && npx playwright test e2e/checkin-phase1d.spec.ts --project=chromium
 * 前置:seed:test-users 已种 test@aizhs.top;8801 dev 在跑(签到数据面已整栈桩成内存仓,
 * 不再需要 8803 ai-service —— CI 的 e2e 作业本就不起该服务,见 installCheckinMocks)。
 */
import { expect } from '@playwright/test'
import { test } from './fixtures'
import path from 'node:path'
import fs from 'node:fs'

/** 与测试同型的假 JWT(后端只 base64 解 payload,不验签):data.id 可解析 + exp 未过期 */
function makeFakeJwt(userId: string): string {
  const b64u = (s: string) => Buffer.from(s).toString('base64url')
  const payload = { data: { id: userId }, exp: Math.floor(Date.now() / 1000) + 86400 }
  return `${b64u('{}')}.${b64u(JSON.stringify(payload))}.e2e`
}

const ACCOUNT_NAME = `E2E走查号-${Date.now() % 100000}`
const GROUP_A = '主力'
const GROUP_B = '备用'

/**
 * 签到数据面的**有状态内存仓**(2026-10-21 立)。
 *
 * 根因:next.config 把 /api/checkin/:path* 反代到 ai-service(8803),而 CI 的 e2e 作业
 * 不起该服务 ⇒ 页面首屏 loadAll() 的 Promise.all 四路 GET(accounts / records /
 * credits/history / credits/daily)全 500 ⇒ catch 置 loadError ⇒ 渲染的是"加载失败"
 * 分支,空状态 / 调度徽章 / tab 空态一个都不出现(CI 现读:断言死在
 * getByText('暂无签到账号,点击右上角添加') 那一行,重试 3 次全同)。
 * 2026-10-20 只补了 scheduler/status + accounts 两路桩 —— records / credits 两路仍 500,
 * Promise.all 照旧整体 reject,补桩等于没补。出路:把签到数据面**整栈**桩成内存仓:
 * 页面所有变更(录入 POST / 分组 PATCH / 删除 DELETE)都以 await loadAll() 收尾,
 * 仓即持久层,七个用例的跨用例状态(录入 → 筛选 → 改组 → 删除)由仓承载,
 * 不依赖外部服务、不留脏数据;POST 按 name upsert,重试/复跑幂等。
 */
interface MockCheckinAccount {
  id: number
  name: string
  group: string
  platform: string
  device_map: Record<string, unknown>
  enabled: boolean
  jwt_exp: string | null
  cooldown_until: string | null
  created_at: string
  updated_at: string
}

const mockStore = { accounts: [] as MockCheckinAccount[], nextId: 1 }

/** 与后端同款:base64 解 JWT payload 取 exp(不验签),解析失败返回 null */
function jwtExpOf(jwt: string): string | null {
  const part = jwt.split('.')[1]
  if (!part) return null
  try {
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { exp?: number }
    return typeof payload.exp === 'number' ? new Date(payload.exp * 1000).toISOString() : null
  } catch {
    return null
  }
}

const jsonOk = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body),
})

/** 把签到数据面整栈桩到 page 上(路由按 page 注册,故每个用例装一次;仓是模块级的) */
async function installCheckinMocks(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/checkin/scheduler/status', (route) =>
    route.fulfill(jsonOk({ enabled: true, started: true, next_run: null, next_run_qoder: null })),
  )
  await page.route(/\/api\/checkin\/records(\?.*)?$/, (route) =>
    route.fulfill(jsonOk({ records: [], count: 0 })),
  )
  await page.route(/\/api\/checkin\/credits\/history(\?.*)?$/, (route) =>
    route.fulfill(jsonOk({ history: [], count: 0, total_credits_delta: 0 })),
  )
  await page.route(/\/api\/checkin\/credits\/daily(\?.*)?$/, (route) =>
    route.fulfill(jsonOk({ days: [], series: { total: [], gained: [], consumed: [] } })),
  )
  // 行内 mutation:PATCH /accounts/{id}/{group,enabled,name,jwt}
  await page.route(/\/api\/checkin\/accounts\/\d+\/(group|enabled|name|jwt)$/, (route) => {
    const url = new URL(route.request().url())
    const m = /\/api\/checkin\/accounts\/(\d+)\/(group|enabled|name|jwt)$/.exec(url.pathname)
    const acc = mockStore.accounts.find((a) => String(a.id) === m?.[1])
    const body = route.request().postDataJSON() as Record<string, unknown>
    if (acc && m) {
      if (m[2] === 'group') acc.group = String(body.group ?? '')
      if (m[2] === 'enabled') acc.enabled = Boolean(body.enabled)
      if (m[2] === 'name') acc.name = String(body.name ?? acc.name)
      if (m[2] === 'jwt') acc.jwt_exp = jwtExpOf(String(body.jwt ?? ''))
      acc.updated_at = new Date().toISOString()
    }
    const id = Number(m?.[1] ?? 0)
    const resp =
      m?.[2] === 'group'
        ? { ok: true, id, group: acc?.group ?? '' }
        : m?.[2] === 'jwt'
          ? { ok: true, id, jwt_exp: acc?.jwt_exp ?? null }
          : m?.[2] === 'enabled'
            ? { ok: true, id, enabled: acc?.enabled ?? true }
            : { ok: true, id, name: acc?.name ?? '' }
    route.fulfill(jsonOk(resp))
  })
  // DELETE /accounts/{id}(确认对话框删除后回到空状态)
  await page.route(/\/api\/checkin\/accounts\/\d+$/, (route) => {
    const url = new URL(route.request().url())
    const m = /\/api\/checkin\/accounts\/(\d+)$/.exec(url.pathname)
    mockStore.accounts = mockStore.accounts.filter((a) => String(a.id) !== m?.[1])
    route.fulfill(jsonOk({ ok: true, id: Number(m?.[1] ?? 0) }))
  })
  // 列表(GET)+ 录入(POST,按 name upsert)
  await page.route(/\/api\/checkin\/accounts(\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as {
        name: string
        jwt: string
        device_map?: Record<string, unknown>
        group?: string
        platform?: string
      }
      const now = new Date().toISOString()
      const acc: MockCheckinAccount = {
        id: mockStore.nextId++,
        name: body.name,
        group: body.group ?? '',
        platform: body.platform ?? 'trae',
        device_map: body.device_map ?? {},
        enabled: true,
        jwt_exp: jwtExpOf(body.jwt),
        cooldown_until: null,
        created_at: now,
        updated_at: now,
      }
      mockStore.accounts = mockStore.accounts.filter((a) => a.name !== acc.name)
      mockStore.accounts.push(acc)
      route.fulfill(jsonOk(acc))
      return
    }
    route.fulfill(jsonOk({ accounts: mockStore.accounts, count: mockStore.accounts.length }))
  })
}

let storageStatePath = ''

test.describe.serial('签到助手 · 登录态全流程', () => {
  // G-962 D组#106(批5,2026-10-22):原 beforeAll 登录建 API 上下文 + afterAll 列表后逐号删除的
  // 幂等清理腿已摘除 —— 后端 checkin 账号族只注册 GET/POST accounts,DELETE 单号零注册,
  // 清理预期是错的;且 2026-10-21 起数据面整栈桩为内存仓,真后端从未落账号,该腿整体是死代码。
  test.beforeAll(() => {
    // 仓复位:重试/复跑时七个用例的跨用例状态从"空表"重新起算(模块级仓在同 worker 内不重置)
    mockStore.accounts = []
    mockStore.nextId = 1
  })

  test.afterAll(() => {
    if (storageStatePath && fs.existsSync(storageStatePath)) {
      try {
        fs.rmSync(path.dirname(storageStatePath), { recursive: true, force: true })
      } catch {
        /* .auth 目录可能被并行 project 共用,静默 */
      }
    }
  })

  // 签到数据面整栈桩(内存仓 + 各路由)对每个用例装一次 —— 仓与根因释疑见 installCheckinMocks。
  // 认证不走桩:fixture 的 apiLoginAndSaveStorageState 打真 API(CI 的 e2e 作业起 8802)。
  test.beforeEach(async ({ authenticatedPage }) => {
    await installCheckinMocks(authenticatedPage)
  })

  test('页面渲染:标题/调度徽章/头部按钮/空状态全为翻译文案(无裸键)', async ({
    authenticatedPage,
  }) => {
    // 桩的面(为什么是整栈而不是只桩 accounts)见 installCheckinMocks 的根因释疑:
    // Promise.all 四路任一 500,页面就整体落"加载失败"分支,空状态永不渲染。
    await authenticatedPage.goto('/checkin')
    await expect(authenticatedPage.getByRole('heading', { name: '签到助手' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '一键全部签到' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '添加账号' })).toBeVisible()
    // 调度徽章(仓桩 enabled+started)
    await expect(authenticatedPage.getByText('自动签到已开启')).toBeVisible()
    // 空状态 + 无裸 i18n 键
    await expect(authenticatedPage.getByText('暂无签到账号，点击右上角添加')).toBeVisible()
    const html = await authenticatedPage.content()
    expect(html).not.toContain('checkin.checkin')
  })

  test('录入对话框:含分组字段;提交后分组徽章与分组筛选出现', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/checkin')
    await authenticatedPage.getByRole('button', { name: '添加账号' }).click()
    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // 2026-10-10 f98f6d295d 起:平台/名称/JWT/设备头/分组全部收进「手动填写(高级)」折叠区
    // (page.tsx 的 <details> 默认关闭,未展开时内容在 DOM 但 hidden)。分组字段在折叠区内,
    // 必须先展开再断可见,否则断言读的是折叠态而非字段缺失。
    await dialog.getByText('手动填写(高级)').click()
    await expect(dialog.getByText('分组(可选)')).toBeVisible()
    await dialog.locator('#checkin-name').fill(ACCOUNT_NAME)
    await dialog.locator('#checkin-jwt').fill(makeFakeJwt('u-e2e-phase1d'))
    await dialog.locator('#checkin-group').fill(GROUP_A)
    await dialog.getByRole('button', { name: '提交' }).click()
    await expect(dialog).toBeHidden()

    // 行内名称 + 分组徽章 + JWT 正常到期日(灰字,非过期/临期徽章)
    const row = authenticatedPage.getByRole('row').filter({ hasText: ACCOUNT_NAME })
    await expect(row).toBeVisible()
    await expect(row.getByText(GROUP_A, { exact: true })).toBeVisible()
    // 分组筛选下拉出现(有分组才渲染),且含未分组选项
    const groupFilter = authenticatedPage.getByTestId('group-filter')
    await expect(groupFilter).toBeVisible()
    await expect(groupFilter.locator('option', { hasText: '未分组' })).toHaveCount(1)
  })

  test('分组筛选:切到未分组后账号行隐藏,切回全部分组恢复', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/checkin')
    const groupFilter = authenticatedPage.getByTestId('group-filter')
    await expect(groupFilter).toBeVisible()
    await groupFilter.selectOption({ label: '未分组' })
    await expect(authenticatedPage.getByRole('row').filter({ hasText: ACCOUNT_NAME })).toHaveCount(
      0,
    )
    await groupFilter.selectOption({ label: '全部分组' })
    await expect(authenticatedPage.getByRole('row').filter({ hasText: ACCOUNT_NAME })).toHaveCount(
      1,
    )
  })

  test('分组编辑对话框:换组后徽章跟随更新', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/checkin')
    await authenticatedPage.getByRole('button', { name: '设置分组' }).first().click()
    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog.getByText('设置分组')).toBeVisible()
    await dialog.locator('#checkin-group-update').fill(GROUP_B)
    await dialog.getByRole('button', { name: '提交' }).click()
    await expect(dialog).toBeHidden()
    await expect(
      authenticatedPage
        .getByRole('row')
        .filter({ hasText: ACCOUNT_NAME })
        .getByText(GROUP_B, { exact: true }),
    ).toBeVisible()
  })

  test('三个 tab:签到记录/积分历史空态 + 积分看板空态(无 i18n 裸键)', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/checkin')
    await expect(authenticatedPage.getByText('暂无签到记录')).toBeVisible()
    await authenticatedPage.getByRole('tab', { name: '积分历史' }).click()
    await expect(authenticatedPage.getByText('暂无积分记录')).toBeVisible()
    await authenticatedPage.getByRole('tab', { name: '积分看板' }).click()
    await expect(authenticatedPage.getByText('暂无积分数据，完成首次签到后生成看板')).toBeVisible()
    const html = await authenticatedPage.content()
    expect(html).not.toContain('checkin.checkin')
  })

  test('一键全部签到按钮存在且可点击状态正常(不点击,避免真实外网签到)', async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto('/checkin')
    const btn = authenticatedPage.getByRole('button', { name: '一键全部签到' })
    await expect(btn).toBeEnabled()
  })

  test('删除清理:确认对话框删除后回到空状态', async ({ authenticatedPage }) => {
    await authenticatedPage.goto('/checkin')
    await authenticatedPage.getByRole('button', { name: '删除', exact: true }).first().click()
    const dialog = authenticatedPage.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '删除账号' })).toBeVisible()
    await dialog.getByRole('button', { name: '确认删除' }).click()
    await expect(authenticatedPage.getByText('暂无签到账号，点击右上角添加')).toBeVisible()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
