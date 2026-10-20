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
 * 前置:seed:test-users 已种 test@aizhs.top;8801 dev + 8803 ai-service 在跑。
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

let storageStatePath = ''

test.describe.serial('签到助手 · 登录态全流程', () => {
  let apiContext: import('@playwright/test').APIRequestContext

  test.beforeAll(async ({ playwright, baseURL }) => {
    // fixture 的 storageState 由 authenticatedPage 惰性建立;这里直接用同一凭据做 API 上下文,
    // 供走查后删除测试账号(幂等清理,不依赖 UI 删除成功)。
    const account = process.env.E2E_USER_ACCOUNT ?? 'test@aizhs.top'
    const password = process.env.E2E_USER_PASSWORD ?? 'Test@123456'
    apiContext = await playwright.request.newContext({ baseURL })
    const login = await apiContext.post('/api/auth/login', {
      data: { account, password },
    })
    const body = await login.json().catch(() => null)
    const token = body?.data?.accessToken as string | undefined
    if (token) {
      await apiContext.dispose()
      apiContext = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { Authorization: `Bearer ${token}` },
      })
    }
  })

  test.afterAll(async () => {
    // 幂等清理:按名称找到账号并删除(UI 删除失败也不留脏数据)
    try {
      const list = await apiContext.get('/api/checkin/accounts')
      const body = await list.json().catch(() => null)
      for (const acc of body?.accounts ?? []) {
        if (String(acc.name).startsWith('E2E走查号-')) {
          await apiContext.delete(`/api/checkin/accounts/${acc.id}`)
        }
      }
    } catch {
      /* 上下文不可用时静默:afterAll 不应炸 */
    }
    await apiContext.dispose()
    if (storageStatePath && fs.existsSync(storageStatePath)) {
      try {
        fs.rmSync(path.dirname(storageStatePath), { recursive: true, force: true })
      } catch {
        /* .auth 目录可能被并行 project 共用,静默 */
      }
    }
  })

  test('页面渲染:标题/调度徽章/头部按钮/空状态全为翻译文案(无裸键)', async ({
    authenticatedPage,
  }) => {
    // 2026-10-20 根因:CI 的 e2e 作业没有 ai-service(8803)(.github/workflows/e2e.yml 自述),
    // 而 next.config 把 /api/checkin/:path* 反代到 http://localhost:8803 ⇒ 调度状态接口必 500;
    // page.tsx 的 getCheckinSchedulerStatus().catch() 静默把 scheduler 留在 null,徽章那一段
    // ({scheduler && …},page.tsx:1888)根本不渲染 —— 断言在 CI 永远"取不到输入"而非"判出问题"。
    // 出路:把状态接口桩成 enabled+started。信封不是 house 标准 { code, message, data } 也不是
    // { success, data } —— fetchAiServiceJson 把 HTTP body 整体塞进 {success:true, data:json}
    // (packages/api-client/src/client.ts:1210-1213),api-client 的 unwrap() 再把它取出来,
    // 而 ai-service 那侧 routers/checkin.py:408 直接 return scheduler.status() 裸字典;
    // 字段名取 @ihui/types 的 CheckinSchedulerStatusResponse(enabled/started/next_run/next_run_qoder)。
    // 徽章仍有牙:断的仍是 t('schedulerEnabled') 这句翻译文案本身。
    await authenticatedPage.route('**/api/checkin/scheduler/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          enabled: true,
          started: true,
          next_run: null,
          next_run_qoder: null,
        }),
      }),
    )
    // 2026-10-21 补第二桩:空状态那句 `t('emptyAccounts')` 只在账号列表**真取到空数组**时渲染
    // (page.tsx:2100);CI 无 8803 ⇒ getCheckinAccounts 走 catch,列表停在未加载态 ⇒ 徽章能过、
    // 空状态永远不出现(上一轮 CI 现读正是断在这一行)。后端 GET /accounts 返回
    // { accounts, count }(routers/checkin.py:263-274),这里桩成空表。
    await authenticatedPage.route(/\/api\/checkin\/accounts(\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accounts: [], count: 0 }),
      }),
    )
    await authenticatedPage.goto('/checkin')
    await expect(authenticatedPage.getByRole('heading', { name: '签到助手' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '一键全部签到' })).toBeVisible()
    await expect(authenticatedPage.getByRole('button', { name: '添加账号' })).toBeVisible()
    // 调度徽章(状态接口已在上面桩成 enabled+started;CI 无 8803,真接口必然 500)
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
