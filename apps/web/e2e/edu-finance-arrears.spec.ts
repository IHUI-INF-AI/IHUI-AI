// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育财务 — 催缴(欠费提醒)常驻 e2e 回归(2026-09-30 立)。
 *
 * 与同页邻居 `edu-finance-payment-dialog.spec.ts` 的分工(刻意不开第二份真相):
 *  · 邻居那条守「缴费登记 / 账期」一族,顺带证明统计卡的**标题**与「登记催缴 N 条」badge 能上屏;
 *  · 本条只守「催缴」这一块,并补邻居没有的三维:
 *    ① 上屏维:点「催费管理」后 tab **真的切换**(data-state / aria-selected —— 该页此前有
 *      "点了不切换"的存疑记录,只在人眼判定里自愈过,故钉成常驻断言),且统计卡出现在切换后的
 *      tabpanel 内(不是别处),caveat 逐字来自后端响应(留痕 / delivery.buckets / unknownReminders)。
 *    ② 不误导维:分档 Badge 必须与**当次响应**的 delivery.buckets 一一对应 —— 0 档/缺档不得占位
 *      (空库时卡片上出现「送达 0」会被读成"送达过 0 条"而不是"没有回执")。
 *    ③ 源码锁维:统计查询按 tab 门控发起、空档 `return null`、批量催费 toast 消费 sms 四档。
 *      这一层是必要的:本机 30 天窗口为空时,②只剩空态分支,若有人把卡摘线或把 toast 退回
 *      只报总数,运行维会一路绿。
 *
 * 数据纪律:断言取自当次 `/fee-reminder/stats` 真实响应,不入库造数、不因空库跳用例;
 * 空库走正向空态分支,非空库同一台 spec 自动变为一一对应的存在性核验。每次运行把
 * "存在性分支是否被行使"记进 annotation(量不到 ≠ 通过),报告不得据此写成已覆盖有数据态。
 */
import { setupTest as test, expect } from './fixtures'
import { readFileSync } from 'node:fs'
import type { Page, Response } from '@playwright/test'

const FINANCE_PATH = '/edu/edu-management/finance'
const STATS_URL = '/api/edu-ai-management/fee-reminder/stats'
const REMINDER_TAB = /催费管理/

/** 与 page.tsx 的 DELIVERY_BUCKET_LABELS 同一张表;第 4 条源码锁负责钉住它,漂了会红。 */
const DELIVERY_BUCKETS: ReadonlyArray<readonly [string, string]> = [
  ['sent', '送达'],
  ['failed', '失败'],
  ['not_configured', '通道未配置'],
  ['no_phone', '无号码'],
  ['user_refused', '用户未订阅'],
]
const UNKNOWN_BADGE_LABEL = '无回执（历史行）'

interface ReminderStats {
  days: number
  total: number
  delivery: {
    buckets: Record<string, number>
    unknownReminders: number
    remindersWithDelivery: number
  }
  caveat: string
}

const src = {
  finance: () =>
    readFileSync(
      new URL('../app/(main)/edu/edu-management/finance/page.tsx', import.meta.url),
      'utf8',
    ),
}

async function requireLoggedIn(page: Page) {
  if (page.url().includes('login')) {
    // 过期登录态属机器态,不是页面缺陷:用 skip 而不是让它红(与邻居 spec 同口径)。
    test.skip(true, `LOGIN_STATE_EXPIRED:被重定向到 ${page.url()}`)
  }
}

/** 锚定整段文本的分档 Badge 判据(「失败」是表格状态列「发送失败」的子串,故必须锚定 + 带数字)。 */
const bucketBadgeRx = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+$`)

async function openFinanceReady(page: Page) {
  await page.goto(FINANCE_PATH, { waitUntil: 'domcontentloaded' })
  await requireLoggedIn(page)
  // 该页取数后才渲染 Tabs:直接读 allInnerTexts 会拿到空数组(间歇性红的根因是探针比渲染快)。
  await expect
    .poll(async () => page.getByRole('tab').count(), { timeout: 30_000 })
    .toBeGreaterThan(0)
  // 受控 Tabs:hydration 之前的 click 不触发 onValueChange ⇒ 面板不切换。
  // networkidle ⇒ 首轮取数完成 ⇒ hydration 必已完成(邻居 spec 留下的同一条 flaky 教训)。
  await page.waitForLoadState('networkidle')
}

async function readStats(response: Response): Promise<ReminderStats> {
  const body = (await response.json()) as { code?: number; data?: ReminderStats }
  expect(
    body.code === 0 && !!body.data,
    `统计端点应返回 code=0 + data,实得 ${JSON.stringify(body).slice(0, 300)}`,
  ).toBe(true)
  return body.data as ReminderStats
}

/** 切到催缴 tab → 取回当次 stats 响应 → 等统计卡画完(否则"0 档不出现 badge"会假绿在加载态上)。 */
async function switchToReminders(page: Page): Promise<ReminderStats> {
  const pending = page.waitForResponse((r) => r.url().includes(STATS_URL), { timeout: 30_000 })
  await page.getByRole('tab', { name: REMINDER_TAB }).click()
  const response = await pending
  expect(response.status(), `统计端点应 200,实得 ${response.status()}`).toBe(200)
  const stats = await readStats(response)
  await expect(
    page.getByRole('tabpanel').getByText(`登记催缴 ${stats.total} 条`, { exact: true }),
    `统计卡应把响应 total 原样上屏(total=${stats.total}),否则卡片根本没画完就在核分档`,
  ).toBeVisible({ timeout: 20_000 })
  return stats
}

test.describe('教育财务 - 催缴(欠费提醒)上屏与不误导', () => {
  /**
   * 上屏维 ①:tab 切换的机器证据 + 统计查询的门控。
   * 邻居那条只断言"卡上的文字可见",证不了 aria 状态机真的换档;而"点了不切换"正是这一页
   * 有过存疑记录的形态(文字可见但 onValueChange 没跑 = 卡在旧面板上读到的是缓存)。
   */
  test('点「催费管理」后 tab 与面板真的换档,统计查询到这一步才发起', async ({
    adminPage: page,
  }) => {
    const statsRequests: string[] = []
    page.on('request', (r) => {
      if (r.url().includes(STATS_URL)) statsRequests.push(r.url())
    })
    await openFinanceReady(page)

    const remindersTab = page.getByRole('tab', { name: REMINDER_TAB })
    const tuitionTab = page.getByRole('tab', { name: /学费标准/ })
    await expect(tuitionTab).toHaveAttribute('data-state', 'active')
    await expect(remindersTab).toHaveAttribute('data-state', 'inactive')
    await expect(remindersTab).toHaveAttribute('aria-selected', 'false')
    // 门控:其余四个 tab 上不该白付一次报表查询
    expect(
      statsRequests,
      `未进催缴 tab 前不应发起 ${STATS_URL},实得 ${statsRequests.join(' | ')}`,
    ).toHaveLength(0)

    await remindersTab.click()
    await expect(remindersTab).toHaveAttribute('data-state', 'active', { timeout: 10_000 })
    await expect(remindersTab).toHaveAttribute('aria-selected', 'true')
    await expect(tuitionTab).toHaveAttribute('data-state', 'inactive')

    // 统计卡必须住在切换后的那个 tabpanel 里(邻居断的是整页可见,那一格不足以定位到 tab)
    const panel = page.getByRole('tabpanel')
    await expect(panel).toHaveCount(1)
    await expect(
      panel.getByRole('heading', { name: '催缴触达统计（近 30 天）', exact: true }),
    ).toBeVisible({ timeout: 20_000 })
    await expect
      .poll(() => statsRequests.length, { timeout: 20_000, message: '进催缴 tab 后应拉一次 stats' })
      .toBeGreaterThan(0)
  })

  /**
   * 上屏维 ②:caveat 逐字来自后端(前端抄一份文案也算"上屏",但会跟后端口径漂开)。
   * 文案里「留痕」与「delivery.buckets」是关键片段 —— 数字一旦被搬进报表,口径说明必须跟着走。
   */
  test('统计卡的 caveat 与后端响应逐字同源(留痕 / delivery.buckets / unknownReminders=N 一起上屏)', async ({
    adminPage: page,
  }) => {
    await openFinanceReady(page)
    const stats = await switchToReminders(page)

    const caveat = page.getByRole('tabpanel').getByText(/delivery\.buckets/)
    await expect(caveat, 'caveat 未上屏(检查 reminderStats.caveat 是否被摘线)').toBeVisible({
      timeout: 20_000,
    })
    await expect(caveat, '界面文案与响应 caveat 不同源').toHaveText(stats.caveat)
    await expect(caveat).toContainText('催缴**留痕**计数')
    await expect(caveat).toContainText('真实触达看 delivery.buckets:')
    // unknownReminders 的数字与 buckets 同源:响应里是多少,上屏就写多少
    await expect(caveat).toContainText(`unknownReminders=${stats.delivery.unknownReminders}`)
  })

  /**
   * 不误导维:分档 Badge 与当次响应的 delivery.buckets 一一对应。
   * 空库(total=0 / buckets={} / unknown=0)时,这台 spec 行使的是"0 档与缺档一律不占位"分支 ——
   * 卡片只留「登记催缴 0 条」一枚 badge;有回执数据时同一批断言自动变成"送达 N 必须显"。
   * 两个方向都只读真实响应,不造数、不跳。
   */
  test('分档 Badge 与 delivery.buckets 一一对应:0 档/缺档不占位,空库不出现「送达 0」', async ({
    adminPage: page,
  }) => {
    await openFinanceReady(page)
    const stats = await switchToReminders(page)
    const panel = page.getByRole('tabpanel')
    let positiveBranches = 0

    for (const [key, label] of DELIVERY_BUCKETS) {
      const n = stats.delivery.buckets[key] ?? 0
      if (n === 0) {
        await expect(
          panel.getByText(bucketBadgeRx(label)),
          `响应里 ${key} 为 ${String(stats.delivery.buckets[key] ?? '缺档')},界面不该出现「${label} N」`,
        ).toHaveCount(0)
      } else {
        positiveBranches += 1
        await expect(
          panel.getByText(`${label} ${n}`, { exact: true }),
          `响应 ${key}=${n},界面应有「${label} ${n}」`,
        ).toBeVisible()
      }
    }

    // 后端扩档(如 no_openid)不在分档表里时必须原样展示 key —— 静默吞档等于少报触达
    for (const [key, n] of Object.entries(stats.delivery.buckets)) {
      if (DELIVERY_BUCKETS.some(([bucketKey]) => bucketKey === key)) continue
      if (n > 0) {
        positiveBranches += 1
        await expect(panel.getByText(`${key} ${n}`, { exact: true })).toBeVisible()
      }
    }

    const unknownRx = bucketBadgeRx(UNKNOWN_BADGE_LABEL)
    if (stats.delivery.unknownReminders > 0) {
      positiveBranches += 1
      await expect(
        panel.getByText(`${UNKNOWN_BADGE_LABEL} ${stats.delivery.unknownReminders}`, {
          exact: true,
        }),
      ).toBeVisible()
    } else {
      await expect(panel.getByText(unknownRx)).toHaveCount(0)
    }

    test.info().annotations.push({
      type: 'arrears-delivery-positive-branch',
      description:
        `近 ${stats.days} 天窗口 total=${stats.total}、非零档数=${positiveBranches} ⇒ ` +
        (positiveBranches === 0
          ? '本次只行使了"空档不占位"分支,有数据态的存在性核验未被行使'
          : '本次已行使存在性核验'),
    })
  })

  /**
   * 源码锁维 ①:统计查询按 tab 门控 + 空档不渲染 + 前端类型字段名与后端契约逐字对齐。
   * 为什么需要静态一层:空库时运行维只剩空态,把 `enabled` 摘掉或把 `if (n === 0) return null`
   * 改成常显,e2e 依然全绿 —— 那正是"摘线而账面看不出来"的形态。
   */
  test('源码锁:stats 查询按催缴 tab 门控 + 0 档 return null + 分档表/字段名与契约同源', () => {
    const s = src.finance()
    expect(s).toMatch(/queryKey: \['edu-ai-management', 'fee-reminder', 'stats'\]/)
    expect(s).toContain("enabled: activeTab === 'reminders'")
    expect(s).toMatch(
      /const n = reminderStats\.delivery\.buckets\[key\] \?\? 0\s*\n\s*if \(n === 0\) return null/,
    )
    // 分档表与本 spec 的 DELIVERY_BUCKETS 同源:改了页面就必须在 spec 里一起改
    for (const [key, label] of DELIVERY_BUCKETS) {
      expect(s, `页面分档表应仍有 ['${key}', '${label}']`).toContain(`['${key}', '${label}']`)
    }
    // 前端声明的字段名 = 后端 /fee-reminder/stats 的字段名(buckets/unknownReminders/caveat)
    expect(s).toContain('buckets: Record<string, number>')
    expect(s).toContain('unknownReminders: number')
    expect(s).toContain('caveat: string')
  })

  /**
   * 源码锁维 ②:批量催费 toast 必须消费 sms 四档。
   * 守的是 2026-09-30 那次定稿:只报总数时"发出去 0 条"与"短信模板没配"在 toast 上同形,
   * 真因要等翻报表才知道。退化成一句「已发送 N 条」是本票的回归,不是重构。
   */
  test('源码锁:批量催费 toast 逐档消费 res.sms 的 sent/failed/not_configured/no_phone', () => {
    const s = src.finance()
    expect(s).toContain("'/api/edu-ai-management/fee-reminder/batch'")
    expect(s).toContain(
      'sms?: { sent: number; failed: number; not_configured: number; no_phone: number }',
    )
    expect(s).toContain("reminderChannel === 'sms' && res.sms")
    for (const field of [
      'res.sms.sent',
      'res.sms.failed',
      'res.sms.not_configured',
      'res.sms.no_phone',
    ]) {
      expect(s, `toast 应消费 ${field}`).toContain(field)
    }
    for (const phrase of [
      '短信送达 ${res.sms.sent} 条',
      '${res.sms.no_phone} 条收件人未留手机号',
      '${res.sms.not_configured} 条因短信服务未配置未发出',
      '${res.sms.failed} 条发送失败',
    ]) {
      expect(s, `toast 分档文案应保留「${phrase}」`).toContain(phrase)
    }
    // 零送达也必须点名:smsPart 同时挂在 success 与 warning 两条分支上
    expect(s).toContain('催费已发送 ${res.sent} 条${wxPart}${smsPart}')
    expect(s).toContain('没有成功发送的催费${smsPart}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
