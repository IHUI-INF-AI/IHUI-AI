// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Web 银行卡管理页真实登录态 E2E（2026-11-27）。
 *
 * 覆盖用户可见的写闭环：新增两张 → 第二张设为默认 → 删除两张；
 * 所有断言以 `/api/wallet/bank-cards` 的落库结果为准，不只看页面文案。
 * 依赖 e2e/.auth/user.json（auth.setup / fixtures 生成的真实登录态），
 * 不伪造 localStorage，也不 mock API。
 */
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

type WalletCard = {
  id: string
  bankName: string
  number: string
  isDefault: boolean
  readOnly?: boolean
}

function apiUrl(page: Page, path: string): string {
  return new URL(path, page.url()).toString()
}

async function bearerHeaders(page: Page): Promise<Record<string, string>> {
  const cookies = await page.context().cookies()
  const token = cookies.find((cookie) => cookie.name === 'auth_token')?.value
  if (!token) throw new Error('E2E 登录态缺少 auth_token cookie')
  return { Authorization: `Bearer ${token}` }
}

async function listCards(page: Page): Promise<WalletCard[]> {
  const response = await page.request.get(apiUrl(page, '/api/wallet/bank-cards'), {
    headers: await bearerHeaders(page),
  })
  expect(response.ok()).toBeTruthy()
  const body = (await response.json()) as { data?: WalletCard[] }
  return Array.isArray(body.data) ? body.data : []
}

async function purgeEditableCards(page: Page): Promise<void> {
  const cards = await listCards(page)
  const headers = await bearerHeaders(page)
  for (const card of cards) {
    if (card.readOnly) continue
    const response = await page.request.delete(
      apiUrl(page, `/api/wallet/bank-cards/${encodeURIComponent(card.id)}`),
      { headers },
    )
    expect(response.ok()).toBeTruthy()
  }
}

async function addCard(page: Page, bankName: string, holder: string, number: string) {
  await page.getByTestId('bank-card-add').click()
  // testID 为当前源码首选；placeholder 兜底兼容尚未重新构建的历史产物，
  // 两者指向同一个输入框，不改变被测行为。
  await page
    .getByTestId('bank-card-bank-name')
    .or(page.getByPlaceholder(/招商银行|bank name/i))
    .first()
    .fill(bankName)
  await page
    .getByTestId('bank-card-holder')
    .or(page.getByPlaceholder(/持卡人|cardholder/i))
    .first()
    .fill(holder)
  await page
    .getByTestId('bank-card-number')
    .or(page.getByPlaceholder(/银行卡号|card number/i))
    .first()
    .fill(number)
  await page
    .getByTestId('bank-card-save')
    .or(page.getByRole('button', { name: /保存|save/i }))
    .first()
    .click()

  await expect.poll(async () => {
    const cards = await listCards(page)
    return cards.some((card) => card.bankName === bankName)
  }).toBe(true)

  await expect(page.getByText(bankName)).toBeVisible()
  const cards = await listCards(page)
  const card = cards.find((item) => item.bankName === bankName)
  if (!card) throw new Error(`新增后未找到银行卡: ${bankName}`)
  return card
}

async function deleteCardViaUi(page: Page, card: WalletCard): Promise<void> {
  // 每次删除前重载，清掉上一张卡确认态/列表刷新留下的 React 状态。
  await page.reload()
  await expect(page.getByTestId('bank-card-add')).toBeVisible({ timeout: 30_000 })
  await page.getByTestId(`bank-card-delete-${card.id}`).click()
  const confirm = page.getByTestId(`bank-card-delete-confirm-${card.id}`)
  await expect(confirm).toBeVisible()
  // RNW 在删除成功后立刻卸载该行，普通 click 会等稳定性而报 detached；
  // 这里直接派发 DOM click，断言仍以 API 落库为准。
  await confirm.evaluate((element) => (element as HTMLElement).click())
  await expect.poll(async () => {
    const cards = await listCards(page)
    return cards.some((item) => item.id === card.id)
  }).toBe(false)
}

test.describe('钱包银行卡管理页', () => {
  test('真实登录态下新增、设默认、删除，后端落库一致', async ({ authenticatedPage }) => {
    test.setTimeout(60_000)
    const page = authenticatedPage
    await page.goto('/wallet/bank-cards')
    await expect(page.getByTestId('bank-card-add')).toBeVisible({ timeout: 30_000 })

    // 只清显式卡；历史提现投影 readOnly，不能被测试删除。
    await purgeEditableCards(page)
    await page.reload()
    await expect(page.getByTestId('bank-card-add')).toBeVisible({ timeout: 30_000 })

    const first = await addCard(page, 'E2E测试银行A', 'E2E持卡人A', '4111111111111111')
    expect(first.isDefault).toBe(true)

    const second = await addCard(page, 'E2E测试银行B', 'E2E持卡人B', '5555555555554444')
    expect(second.isDefault).toBe(false)

    await page.getByTestId(`bank-card-default-${second.id}`).click()
    await expect.poll(async () => {
      const cards = await listCards(page)
      return cards.find((card) => card.id === second.id)?.isDefault === true
    }).toBe(true)
    await expect.poll(async () => {
      const cards = await listCards(page)
      return cards.find((card) => card.id === first.id)?.isDefault === false
    }).toBe(true)

    for (const card of [second, first]) {
      await deleteCardViaUi(page, card)
    }

    expect(await listCards(page)).toEqual([])
  })

  test('提现选卡过滤历史只读投影卡', async ({ authenticatedPage }) => {
    const page = authenticatedPage
    await page.route('**/api/wallet/bank-cards', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 0,
          message: 'success',
          data: [
            {
              id: 'readonly-projection-1',
              number: '**** **** **** 9999',
              holder: '历史持卡人',
              bankName: '历史银行',
              isDefault: true,
              readOnly: true,
            },
            {
              id: 'editable-card-1',
              number: '**** **** **** 1111',
              holder: '可编辑持卡人',
              bankName: '可编辑银行',
              isDefault: false,
              readOnly: false,
            },
          ],
        }),
      })
    })
    await page.goto('/wallet/withdraw')
    await page.getByText('银行卡', { exact: true }).click()
    await expect(page.getByText('可编辑银行')).toBeVisible({ timeout: 15_000 })
    // 历史提现投影只有掩码、没有可解密绑定 id，不能出现在可选项里。
    await expect(page.getByText('历史银行')).toHaveCount(0)
  })

  test.afterEach(async ({ authenticatedPage }) => {
    try {
      await purgeEditableCards(authenticatedPage)
    } catch {
      // 清理失败不覆盖主断言；残留卡由下一次 before/after 清理。
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
