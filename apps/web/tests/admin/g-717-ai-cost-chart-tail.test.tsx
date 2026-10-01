// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-717 —— 图表截断必须带余量行 + 脏日期不得炸整屏(真缺陷)的回归用例。
 *
 * 这档测试存在的理由不是"给新函数盖个戳",而是把票面那句 **"不得只补文案不补求和"**
 * 变成机器判据。四条各自防一种已经发生过的失效型:
 *
 *  1. **求和恒等式**(票面验收原文:"11 个模型 ⇒ 呈现行数 11(10 + 其他)且各行求和 == 总额")。
 *     这里真断言 `sum(rows) === 全量总额`,而不是断言行数完事 —— 只数行数的话,
 *     "加了一行其他、却把被截掉的量算丢了"照样绿。同档留一条**反向对照**:老写法
 *     (只截断不合并)的行数也"能看",但求和必然对不上总额 —— 没这条,两种断言分不出区别。
 *  2. **脏 dateKey 不抛 + 阳性对照**。只断"不抛"会放过一种假绿:兜底根本没被调用、
 *     而测试喂的值本来就不脏。所以同档留一条裸写法 `fmt.format(new Date('abc'))`
 *     **必须抛 RangeError** 的对照 —— 它证明"这一型真会把整屏炸掉"不是编出来的风险。
 *  3. **装车锁(源码级)**。本仓最高频失效型是"函数写好了但渲染链上没人调"
 *     (守门 64/70/81/115 同族:"产物存在 ≠ 能力在线")。所以直接读 page.tsx 的**代码面**
 *     (剥注释后),判旧的截断/裸日期写法已消失、新出口真在渲染路径上被调用。
 *     判据只看代码面:本文件头注与 page.tsx 的说明块都逐字引用了那些旧写法,
 *     按原文匹配会把"解释自己"的散文判成违规(守门 131 同一课)。锁自身也有成对对照
 *     (注释里的命中不得算、代码里的必须算),否则它可能是把"永远匹配不到"当成通过。
 *  4. **真渲染对账**。前三条都只到"函数层 + 源码层";本档最后把 AiCostPage 真挂起来
 *     (mock 掉 fetchApi),从 DOM 里数出行数并把每行的金额读回来求和,与总额卡片对账。
 *     这条才是"余量行接在页面渲染的那条数据链上"的正面证据 —— 纯函数绿而渲染链没接上,
 *     正是本仓反复记过的那一格。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import * as React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import AiCostPage, {
  buildModelChartData,
  formatDayLabel,
  formatFiniteNumber,
  toFiniteNumber,
  MODEL_CHART_ROW_LIMIT,
  OTHER_SLICE_KEY,
  NUM_FALLBACK,
  type ByModel,
} from '../../app/(main)/admin/ai-cost/page'

const DAY_FMT = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' })
const PLAIN_FMT = new Intl.NumberFormat('en-US')

/** 造 n 个模型,cost 单位为分且逐条不同(便于"前 N 大"可判、且整数求和无浮点误差)。 */
function makeModels(n: number): ByModel[] {
  return Array.from({ length: n }, (_, i) => ({
    model: `model-${i}`,
    cost: (i + 1) * 100,
    tokens: (i + 1) * 10,
    calls: i + 1,
  }))
}

// 泛型箭头函数在 .tsx 里必须写成 `<T,>` —— 单个 `<T>` 会被当 JSX 开标签,
// 症状是"整个套件在收集阶段就失败、0 个用例执行"(守门 114 判的那一型)。
const sumBy = <T,>(rows: readonly T[], pick: (row: T) => number): number =>
  rows.reduce((acc, row) => acc + pick(row), 0)

/**
 * 剥注释(行/块)但**保留字符串内容**。
 * 保留字符串是必须的:`tChat('modelCategoryOther')` 这类调用就写在模板字面量里,
 * 连字符串一起抹会让装车锁对它自己的立项形态失明。
 */
export function stripComments(src: string): string {
  const out: string[] = []
  let i = 0
  let inLine = false
  let inBlock = false
  let inStr: string | null = null
  while (i < src.length) {
    const ch = src[i]
    const next = src[i + 1]
    if (inLine) {
      if (ch === '\n') {
        inLine = false
        out.push(ch)
      }
      i += 1
      continue
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false
        i += 2
        continue
      }
      out.push(ch === '\n' ? ch : ' ')
      i += 1
      continue
    }
    if (inStr) {
      out.push(ch)
      if (ch === '\\') {
        i += 2
      } else {
        if (ch === inStr) inStr = null
        i += 1
      }
      continue
    }
    if (ch === '/' && next === '/') {
      inLine = true
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      inBlock = true
      i += 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch
      out.push(ch)
      i += 1
      continue
    }
    out.push(ch)
    i += 1
  }
  return out.join('')
}

describe('G-717 · 按模型图截断必须带余量行', () => {
  it('11 个模型 ⇒ 呈现行数 11(10 + 其他),且各行求和 == 总额', () => {
    const source = makeModels(11)
    const chart = buildModelChartData(source, MODEL_CHART_ROW_LIMIT)

    expect(chart.rows).toHaveLength(11)
    expect(chart.totalModelCount).toBe(11)

    const otherRow = chart.rows[chart.rows.length - 1]
    expect(otherRow?.isOther).toBe(true)
    expect(otherRow?.mergedCount).toBe(1)

    // ★ 票面要的那一条:不是数行数,是对账。
    const sourceCost = sumBy(source, (m) => toFiniteNumber(m.cost))
    const sourceTokens = sumBy(source, (m) => toFiniteNumber(m.tokens))
    expect(sumBy(chart.rows, (r) => r.cost)).toBe(sourceCost)
    expect(sumBy(chart.rows, (r) => r.tokens)).toBe(sourceTokens)
    expect(chart.totalCost).toBe(sourceCost)
    expect(chart.totalTokens).toBe(sourceTokens)

    // 反向对照:只截断不合并时,行数看着正常但求和对不上总额。
    const legacySliced = source.slice(0, MODEL_CHART_ROW_LIMIT)
    expect(legacySliced).toHaveLength(MODEL_CHART_ROW_LIMIT)
    expect(sumBy(legacySliced, (m) => toFiniteNumber(m.cost))).not.toBe(sourceCost)
  })

  it('余量片是真累加出来的,不是 total − head 的减法', () => {
    const source = makeModels(25) // ⇒ 前 10 条 + 一条折叠 15 个的"其他"
    const chart = buildModelChartData(source, MODEL_CHART_ROW_LIMIT)
    const otherRow = chart.rows[chart.rows.length - 1]
    const head = chart.rows.slice(0, MODEL_CHART_ROW_LIMIT)

    expect(chart.rows).toHaveLength(MODEL_CHART_ROW_LIMIT + 1)
    expect(otherRow?.isOther).toBe(true)
    expect(otherRow?.mergedCount).toBe(15)
    // 独立重算尾部真实集合(按 cost 降序后剩下的那 15 条),而不是拿总数减 head。
    const tailCost = [...source]
      .sort((a, b) => toFiniteNumber(b.cost) - toFiniteNumber(a.cost))
      .slice(MODEL_CHART_ROW_LIMIT)
      .reduce((s, m) => s + toFiniteNumber(m.cost), 0)
    expect(otherRow?.cost).toBe(tailCost)
    expect(head.every((r) => !r.isOther)).toBe(true)
    expect(sumBy(chart.rows, (r) => r.cost)).toBe(sumBy(source, (m) => toFiniteNumber(m.cost)))
  })

  it('未超限不造余量行:恰好等于上限与低于上限都原样呈现', () => {
    const atLimit = buildModelChartData(makeModels(MODEL_CHART_ROW_LIMIT), MODEL_CHART_ROW_LIMIT)
    expect(atLimit.rows).toHaveLength(MODEL_CHART_ROW_LIMIT)
    expect(atLimit.rows.some((r) => r.isOther)).toBe(false)
    expect(atLimit.totalModelCount).toBe(MODEL_CHART_ROW_LIMIT)

    const underLimit = buildModelChartData(makeModels(3), MODEL_CHART_ROW_LIMIT)
    expect(underLimit.rows).toHaveLength(3)
    expect(underLimit.rows.some((r) => r.isOther)).toBe(false)
  })

  it('缺省 limit 就是 MODEL_CHART_ROW_LIMIT(渲染处传的也是它)', () => {
    const chart = buildModelChartData(makeModels(11))
    expect(chart.rows).toHaveLength(MODEL_CHART_ROW_LIMIT + 1)
  })

  it('0 值项先被过滤(不占展示名额),但求和恒等式依然成立', () => {
    const withZeros: ByModel[] = [
      ...makeModels(12),
      // 三条 cost 与 tokens 皆为 0 的行:被过滤掉,同时它们贡献 0 ⇒ 总额不变。
      { model: 'zero-1', cost: 0, tokens: 0, calls: 7 },
      { model: 'zero-2', cost: '0', tokens: 0, calls: 0 },
      { model: 'zero-3', cost: 'abc', tokens: 0, calls: 0 },
    ]
    const chart = buildModelChartData(withZeros, MODEL_CHART_ROW_LIMIT)

    expect(chart.totalModelCount).toBe(12)
    expect(chart.rows).toHaveLength(MODEL_CHART_ROW_LIMIT + 1)
    expect(chart.rows.some((r) => r.model.startsWith('zero-'))).toBe(false)
    expect(sumBy(chart.rows, (r) => r.cost)).toBe(sumBy(withZeros, (m) => toFiniteNumber(m.cost)))
  })

  it('带 cost 的行永不因 tokens=0 被丢(过滤判据是"两者皆 0")', () => {
    const chart = buildModelChartData(
      [{ model: 'cost-only', cost: 500, tokens: 0, calls: 0 }, ...makeModels(3)],
      MODEL_CHART_ROW_LIMIT,
    )
    expect(chart.rows.some((r) => r.model === 'cost-only')).toBe(true)
    expect(chart.totalModelCount).toBe(4)
  })

  it('脏 cost / 非有限数一律归 0,任何展示行都不带 NaN', () => {
    const dirty: ByModel[] = [
      { model: 'nan-cost', cost: Number.NaN, tokens: 5, calls: 1 },
      { model: 'inf-cost', cost: Number.POSITIVE_INFINITY, tokens: 5, calls: 1 },
      { model: 'str-cost', cost: '1234', tokens: 5, calls: 1 },
      { model: 'null-ish', cost: 'abc', tokens: 9, calls: 1 },
    ]
    const chart = buildModelChartData(dirty, MODEL_CHART_ROW_LIMIT)

    for (const row of chart.rows) {
      expect(Number.isFinite(row.cost)).toBe(true)
      expect(Number.isFinite(row.tokens)).toBe(true)
      expect(Number.isFinite(row.calls)).toBe(true)
    }
    expect(chart.rows.find((r) => r.model === 'str-cost')?.cost).toBe(1234)
    expect(chart.rows.find((r) => r.model === 'nan-cost')?.cost).toBe(0)
    expect(chart.rows.find((r) => r.model === 'inf-cost')?.cost).toBe(0)
  })

  it('余量片走独立 React key,不会与真实模型名相撞', () => {
    const chart = buildModelChartData(makeModels(11), MODEL_CHART_ROW_LIMIT)
    const keys = chart.rows.map((r) => (r.isOther ? OTHER_SLICE_KEY : r.model))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('G-717 · 脏日期不得炸整屏', () => {
  // 阳性对照:不兜底就会抛 —— 这条红了才说明"炸整屏"那一型是真的,不是假想风险。
  it('阳性对照:裸 Intl 写法遇脏 dateKey 必须抛 RangeError', () => {
    expect(() => DAY_FMT.format(new Date('2026-13-45'))).toThrow(RangeError)
    expect(() => DAY_FMT.format(new Date('abc'))).toThrow(RangeError)
    expect(() => DAY_FMT.format(new Date(''))).toThrow(RangeError)
  })

  it('脏 dateKey ⇒ 原样返回 dateKey,绝不抛', () => {
    for (const dirty of ['2026-13-45', 'abc', '', '   ', 'not-a-date', 'null', 'undefined']) {
      let result: string | undefined
      expect(() => {
        result = formatDayLabel(DAY_FMT, dirty)
      }).not.toThrow()
      expect(result).toBe(dirty)
    }
  })

  it('正常 dateKey ⇒ 照旧走 formatter(兜底没把可用值一起吞掉)', () => {
    const label = formatDayLabel(DAY_FMT, '2026-09-29')
    expect(label).toBe(DAY_FMT.format(new Date('2026-09-29')))
    expect(label).not.toBe('2026-09-29')
    expect(label).not.toBe('')
  })
})

describe('G-717 · 非有限数的读数占位', () => {
  it('toFiniteNumber:脏值归 0,合法数字串归数值', () => {
    expect(toFiniteNumber('150')).toBe(150)
    expect(toFiniteNumber(150)).toBe(150)
    expect(toFiniteNumber(Number.NaN)).toBe(0)
    expect(toFiniteNumber(Number.POSITIVE_INFINITY)).toBe(0)
    expect(toFiniteNumber('abc')).toBe(0)
    expect(toFiniteNumber('')).toBe(0)
    expect(toFiniteNumber(null)).toBe(0)
    expect(toFiniteNumber(undefined)).toBe(0)
  })

  it('formatFiniteNumber:NaN / ±Infinity ⇒ `--`,而非 formatter 打出的 NaN / ∞', () => {
    expect(formatFiniteNumber(PLAIN_FMT, Number.NaN)).toBe(NUM_FALLBACK)
    expect(formatFiniteNumber(PLAIN_FMT, Number.POSITIVE_INFINITY)).toBe(NUM_FALLBACK)
    expect(formatFiniteNumber(PLAIN_FMT, Number.NEGATIVE_INFINITY)).toBe(NUM_FALLBACK)
    // 这两条把"默认路径确实会漏脏读数"钉在明处 —— 否则 `--` 像是凭空发明的兜底。
    expect(PLAIN_FMT.format(Number.NaN)).toBe('NaN')
    expect(PLAIN_FMT.format(Number.POSITIVE_INFINITY)).toBe('∞')
  })

  it('formatFiniteNumber:有限数原样交给 formatter(没顺手改可用读数)', () => {
    expect(formatFiniteNumber(PLAIN_FMT, 1234.5)).toBe('1,234.5')
    expect(formatFiniteNumber(PLAIN_FMT, 0)).toBe('0')
  })
})

describe('G-717 · 装车锁(余量行必须真接在渲染链上)', () => {
  const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const PAGE_FILE = join(WEB_ROOT, 'app/(main)/admin/ai-cost/page.tsx')
  const code = stripComments(readFileSync(PAGE_FILE, 'utf8'))

  it('取到的代码面必须非平凡(防止"剥完什么都不剩"被读成通过)', () => {
    expect(code.length).toBeGreaterThan(3000)
    expect(code).toMatch(/AiCostPage/)
  })

  it('旧的静默截断写法不得再出现在代码面', () => {
    expect(code).not.toMatch(/byModel\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)
  })

  it('把脏 dateKey 裸喂 Intl 的写法不得再出现在代码面', () => {
    expect(code).not.toMatch(/dayFmt\s*\.\s*format\(\s*new Date\(/)
  })

  it('新出口必须真被渲染路径调用(不是写了没人用)', () => {
    expect(code).toMatch(/buildModelChartData\(/)
    expect(code).toMatch(/modelChart\.rows\.map\(/)
    expect(code).toMatch(/formatDayLabel\(\s*dayFmt\s*,\s*row\.date\s*\)/)
    expect(code).toMatch(/tChat\(\s*'modelCategoryOther'\s*\)/)
    expect(code).toMatch(/MODEL_CHART_ROW_LIMIT/)
    expect(code).toMatch(/mergedCount/)
  })

  it('阳性对照:旧写法喂给同一批正则必须命中(锁不是空的)', () => {
    expect('const y = d.byModel.slice(0, 10).map(() => null)').toMatch(
      /byModel\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/,
    )
    expect('const x = () => dayFmt.format(new Date(row.date))').toMatch(
      /dayFmt\s*\.\s*format\(\s*new Date\(/,
    )
  })

  it('剥注释自身成对对照:注释里的旧写法不算,代码里的必须算', () => {
    const commentOnly = '/* 说明:旧写法 d.byModel.slice(0, 10) 已废弃 */\nconst ok = 1'
    expect(stripComments(commentOnly)).not.toMatch(/byModel\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)

    const inCode = '// 注释里也写了 d.byModel.slice(0, 10)\nconst bad = d.byModel.slice(0, 10)'
    expect(stripComments(inCode)).toMatch(/byModel\s*\.\s*slice\(\s*0\s*,\s*10\s*\)/)

    // 字符串内容必须保留:取词调用就住在模板字面量里。
    expect(stripComments('const s = `${tChat(\'modelCategoryOther\')} (+1)`')).toMatch(
      /tChat\(\s*'modelCategoryOther'\s*\)/,
    )
  })
})

/* ------------------------------------------------------------------ *
 * 真渲染对账:AiCostPage 挂起来,从 DOM 读行数与金额再与总额对账。
 * 这条是"接在页面渲染的那条数据链上"的正面证据 —— 前三条判据就算全绿,
 * 也仍可能出现"纯函数正确、渲染处没用它"那一格(本仓最高频失效型)。
 * ------------------------------------------------------------------ */

const { mockFetchApi } = vi.hoisted(() => ({ mockFetchApi: vi.fn() }))

vi.mock('@/lib/api', () => ({ fetchApi: mockFetchApi }))

// 词表 mock:按 key 取中文名(两个命名空间共用一张表即可,判据只关心渲染出来的字)。
vi.mock('next-intl', () => {
  const ZH: Record<string, string> = {
    byModel: '按模型',
    byDay: '按天',
    noModelData: '暂无模型数据',
    noDayData: '暂无按天数据',
    calls: '次',
    modelCategoryOther: '其他',
    totalCost: '总成本',
    totalTokens: '总Token',
    totalCalls: '总调用',
    cacheHitRate: '命中率',
    loading: '加载中',
    title: 'AI 成本',
    subtitle: '副标题',
    empty: '暂无数据',
    emptyHint: '空提示',
    toMetrics: '指标',
    rangeLabel: '区间',
    range1d: '1天',
    range7d: '7天',
    range30d: '30天',
    budgets: '预算',
    budgetScope: '范围',
    budgetKey: '键',
    dailyToken: '日Token',
    monthlyCost: '月成本',
    topUsers: 'Top 用户',
    noUserData: '暂无用户',
    budgetAlerts: '预警',
    noAlerts: '暂无预警',
    vipQuotas: '配额',
    noVipData: '暂无配额',
    l1HitRate: 'L1',
    l2HitRate: 'L2',
    promptCacheErrors: '错误',
    critical: '严重',
    warning: '警告',
    userLabel: '用户',
  }
  return {
    useTranslations: () => (key: string) => ZH[key] ?? key,
    useLocale: () => 'zh-CN',
  }
})

function renderPage(): ReturnType<typeof render> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    React.createElement(
      QueryClientProvider,
      { client },
      React.createElement(AiCostPage),
    ),
  )
}

/**
 * 从 DOM 把"按模型"每行的金额读回来(每行右列形如 `1,100 tk · ¥11.00`,日行不含 `tk`)。
 * 只取 `¥` 之后的那一段 —— 直接 parseFloat 会先吃前行中的 token 数(1,100 ⇒ 1100)。
 */
function modelRowAmountsFromDom(container: HTMLElement): number[] {
  const out: number[] = []
  for (const el of Array.from(container.querySelectorAll('span'))) {
    const text = el.textContent ?? ''
    if (!/tk · ¥/.test(text)) continue
    const m = /¥\s*([\d.,]+)/.exec(text)
    if (!m) continue
    out.push(Number.parseFloat(m[1].replace(/,/g, '')))
  }
  return out
}

describe('G-717 · 真渲染对账(AiCostPage 挂起来量 DOM)', () => {
  afterEach(() => {
    cleanup()
    mockFetchApi.mockReset()
  })

  it('11 个模型 ⇒ DOM 里 11 行(10 + 其他),各行金额求和 == 总额卡片的 ¥66.00', async () => {
    mockFetchApi.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/admin/ai/cost/dashboard')) {
        return {
          success: true,
          data: {
            // 6600 分 = ¥66.00,与下面 11 个模型之和逐分对得上(100+200+…+1100)。
            summary: { totalCost: 6600, totalTokens: 660, totalCalls: 66, cacheHitRate: 0 },
            byModel: makeModels(11),
            // 日行金额刻意不等于 6600:否则 "¥66.00" 会在日行与总额卡片各出现一次,
            // getByText 反而因"命中多个"而失败 —— 那与判据无关,是夹具自己造的歧义。
            byDay: [{ date: '2026-09-29', cost: 4200, tokens: 660, calls: 66 }],
            period: { startDate: '', endDate: '' },
          },
        }
      }
      return { success: true, data: [] }
    })

    const { container } = renderPage()

    // 余量行出现即代表数据已回来(其他行也都在这之后渲染)。
    await screen.findByText(/^其他 \(\+1\)$/)

    const amounts = modelRowAmountsFromDom(container)
    expect(amounts).toHaveLength(11)
    // ★ 求和对账是从 DOM 读出来的,不是从函数返回值读出来的。
    expect(amounts.reduce((s, n) => s + n, 0)).toBeCloseTo(66, 2)
    expect(screen.getAllByText('¥66.00').length).toBeGreaterThan(0)

    // 被折叠的第 11 个模型名不得再单独成行(它的量必须住在"其他"里)。
    expect(screen.queryByText('model-0')).toBeNull()
    expect(screen.getByText('model-10')).toBeTruthy()
    expect(screen.getByText('model-1')).toBeTruthy()

    // 总数说明:标题旁必须出现 11(共 N 个模型)。
    const title = screen.getByText('按模型').parentElement
    expect(title?.textContent).toContain('11')
  })

  it('脏 dateKey 进 byDay ⇒ 原样显示该串,页面不崩、模型行照常渲染', async () => {
    mockFetchApi.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/admin/ai/cost/dashboard')) {
        return {
          success: true,
          data: {
            summary: { totalCost: 300, totalTokens: 30, totalCalls: 3, cacheHitRate: 0 },
            byModel: makeModels(3),
            byDay: [
              { date: 'not-a-date', cost: 100, tokens: 10, calls: 1 },
              { date: '2026-13-45', cost: 100, tokens: 10, calls: 1 },
              { date: '', cost: 100, tokens: 10, calls: 1 },
            ],
            period: { startDate: '', endDate: '' },
          },
        }
      }
      return { success: true, data: [] }
    })

    // 组件渲染期若真抛 RangeError,render() 会把异常向上抛 ⇒ 这条自然红。
    renderPage()

    expect(await screen.findByText('not-a-date')).toBeTruthy()
    expect(screen.getByText('2026-13-45')).toBeTruthy()
    // 空串脏值也原样返回(渲染成空文本节点),不得抛 —— 用"页面其余部分照常渲染"作证据。
    expect(screen.getAllByText(/^model-\d$/)).toHaveLength(3)
    expect(screen.getByText('按天')).toBeTruthy()
  })

  it('低于上限 ⇒ DOM 里没有"其他"行', async () => {
    mockFetchApi.mockImplementation(async (url: string) => {
      if (url.startsWith('/api/admin/ai/cost/dashboard')) {
        return {
          success: true,
          data: {
            summary: { totalCost: 600, totalTokens: 60, totalCalls: 6, cacheHitRate: 0 },
            byModel: makeModels(3),
            byDay: [{ date: '2026-09-29', cost: 600, tokens: 60, calls: 6 }],
            period: { startDate: '', endDate: '' },
          },
        }
      }
      return { success: true, data: [] }
    })

    const { container } = renderPage()
    await screen.findByText('model-2')

    expect(screen.queryByText(/^其他/)).toBeNull()
    expect(modelRowAmountsFromDom(container)).toHaveLength(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
