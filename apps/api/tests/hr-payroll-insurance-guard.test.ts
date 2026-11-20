// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 社保配置守卫单测(2026-11-13 立,**不连库**)。
 *
 * 立因:算薪不再允许"缺社保配置就按 0 出单"。判断一条地区费率配置够不够算薪,
 * 全靠 validateInsuranceConfig 这个纯函数。它一旦宽松,错单就会静默流出。
 *
 * 锁的判据:
 *   · null = 没填 → 必须报问题(与"明确为 0"区分)
 *   · 0 = 明确不缴 → 合法
 *   · 费率录成 8(而非 0.08) → 必须拦住,否则社保算成工资 8 倍
 *   · 基数上下限缺失 / 下限为 0 / 上限小于下限 → 必须拦住
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const { validateInsuranceConfig, collectInsuranceAdvisories } = await import(
  '../src/services/hr-payroll.js'
)

type RateRow = Parameters<typeof validateInsuranceConfig>[0]

/** 造一条"完全合规"的配置,各用例在这上面改字段 */
function makeRow(over: Partial<Record<string, unknown>> = {}): RateRow {
  return {
    id: '00000000-0000-4000-8000-000000000000',
    regionName: '测试市',
    pensionEmployer: '0.1600',
    pensionPersonal: '0.0800',
    unemploymentEmployer: '0.0050',
    unemploymentPersonal: '0.0050',
    medicalEmployer: '0.0800',
    medicalPersonal: '0.0200',
    injuryEmployer: '0.0020',
    housingFundRate: '0.0700',
    insuranceBaseMin: '3000.00',
    insuranceBaseMax: '30000.00',
    fundBaseMin: null,
    fundBaseMax: null,
    effectiveYear: 2026,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as unknown as RateRow
}

describe('validateInsuranceConfig — 配置完整性判据', () => {
  it('字段齐全时无问题', () => {
    expect(validateInsuranceConfig(makeRow())).toEqual([])
  })

  it('个人费率显式填 0 是合法值(某地确实不缴)', () => {
    const issues = validateInsuranceConfig(
      makeRow({ pensionPersonal: '0', medicalPersonal: '0', unemploymentPersonal: '0' }),
    )
    expect(issues).toEqual([])
  })

  it('个人费率留空(null)必须报问题 —— 与"明确为 0"区分', () => {
    const issues = validateInsuranceConfig(makeRow({ medicalPersonal: null }))
    expect(issues.some((i) => i.includes('医疗个人费率') && i.includes('为空'))).toBe(true)
    expect(issues.some((i) => i.includes('medicalPersonal'))).toBe(true)
  })

  it('公积金费率留空必须报问题', () => {
    const issues = validateInsuranceConfig(makeRow({ housingFundRate: null }))
    expect(issues.some((i) => i.includes('公积金费率') && i.includes('为空'))).toBe(true)
  })

  it('费率录成 8 而不是 0.08 必须拦住', () => {
    const issues = validateInsuranceConfig(makeRow({ pensionPersonal: '8' }))
    expect(issues.some((i) => i.includes('养老个人费率') && i.includes('超出合理区间'))).toBe(true)
  })

  it('公积金费率录成 7 而不是 0.07 必须拦住', () => {
    const issues = validateInsuranceConfig(makeRow({ housingFundRate: '7' }))
    expect(issues.some((i) => i.includes('公积金费率') && i.includes('超出合理区间'))).toBe(true)
  })

  it('负费率必须拦住', () => {
    const issues = validateInsuranceConfig(makeRow({ medicalPersonal: '-0.01' }))
    expect(issues.some((i) => i.includes('医疗个人费率'))).toBe(true)
  })

  it('基数上下限缺失必须报问题', () => {
    const issues = validateInsuranceConfig(
      makeRow({ insuranceBaseMin: null, insuranceBaseMax: null }),
    )
    expect(issues.some((i) => i.includes('缴费基数上下限缺失'))).toBe(true)
  })

  it('只有下限没有上限也要报问题', () => {
    const issues = validateInsuranceConfig(makeRow({ insuranceBaseMax: null }))
    expect(issues.some((i) => i.includes('缴费基数上下限缺失'))).toBe(true)
  })

  it('下限为 0 必须拦住', () => {
    const issues = validateInsuranceConfig(makeRow({ insuranceBaseMin: '0' }))
    expect(issues.some((i) => i.includes('上下限不合法'))).toBe(true)
  })

  it('上限小于下限必须拦住(录反了)', () => {
    const issues = validateInsuranceConfig(
      makeRow({ insuranceBaseMin: '30000.00', insuranceBaseMax: '3000.00' }),
    )
    expect(issues.some((i) => i.includes('上下限不合法'))).toBe(true)
  })

  it('多个字段都有问题时全部列出,不只报第一条', () => {
    const issues = validateInsuranceConfig(
      makeRow({
        pensionPersonal: null,
        medicalPersonal: '8',
        housingFundRate: null,
        insuranceBaseMin: null,
      }),
    )
    expect(issues.length).toBeGreaterThanOrEqual(4)
  })
})

describe('collectInsuranceAdvisories — 防"悄悄沿用了旧年度数据"', () => {
  it('记录时间早于生效年度 → 提示疑似未更新', () => {
    const advisories = collectInsuranceAdvisories(
      makeRow({ effectiveYear: 2026, updatedAt: new Date('2025-06-01T00:00:00Z') }),
    )
    expect(advisories.some((a) => a.includes('疑似沿用旧年度数据未更新'))).toBe(true)
  })

  it('记录时间与生效年度同年 → 不提示', () => {
    const advisories = collectInsuranceAdvisories(
      makeRow({ effectiveYear: 2026, updatedAt: new Date('2026-07-01T00:00:00Z') }),
    )
    expect(advisories.some((a) => a.includes('疑似沿用旧年度数据未更新'))).toBe(false)
  })

  it('个人费率与公积金全为 0 → 提示核对', () => {
    const advisories = collectInsuranceAdvisories(
      makeRow({
        pensionPersonal: '0',
        medicalPersonal: '0',
        unemploymentPersonal: '0',
        housingFundRate: '0',
      }),
    )
    expect(advisories.some((a) => a.includes('均为 0'))).toBe(true)
  })

  it('未单独配置公积金上下限 → 提示回退社保上下限', () => {
    const advisories = collectInsuranceAdvisories(
      makeRow({ fundBaseMin: null, fundBaseMax: null }),
    )
    expect(advisories.some((a) => a.includes('回退社保上下限'))).toBe(true)
  })

  it('配置完整且已单独配公积金上下限 → 零提醒', () => {
    const advisories = collectInsuranceAdvisories(
      makeRow({
        fundBaseMin: '2000.00',
        fundBaseMax: '15000.00',
        updatedAt: new Date('2026-07-01T00:00:00Z'),
      }),
    )
    expect(advisories).toEqual([])
  })
})
