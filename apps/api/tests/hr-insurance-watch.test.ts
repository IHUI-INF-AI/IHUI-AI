// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 社保配置"变更即时感知 + 该更新没更新会被发现"判据单测(2026-11-21 立,**不连库**)。
 *
 * 锁两件事:
 *   · diffInsuranceConfig —— 配置写入后发给人的消息必须说清"哪一项从多少变成多少",
 *     且同值重复提交不打扰人(否则每次保存都发一条,提醒很快失效);
 *   · judgeInsuranceRows —— 当年缺配置/配置不完整必须 alert(算薪会拒绝);
 *     记录时间早于生效年度、过调基期后次年未录 → advisory;到 12 月仍缺次年 → alert。
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const { diffInsuranceConfig, judgeInsuranceRows } =
  await import('../src/services/hr-insurance-watch.js')

type Row = Parameters<typeof judgeInsuranceRows>[0][number]

/** 一条"2026 年完整合规"的配置(各用例在此之上改字段) */
function makeRow(over: Partial<Record<string, unknown>> = {}): Row {
  return {
    regionName: '测试市',
    effectiveYear: 2026,
    enabled: true,
    updatedAt: new Date('2026-07-05T00:00:00.000Z'),
    pensionPersonal: '0.0800',
    medicalPersonal: '0.0200',
    unemploymentPersonal: '0.0050',
    housingFundRate: '0.0700',
    insuranceBaseMin: '3000.00',
    insuranceBaseMax: '21750.00',
    fundBaseMin: '15000.00',
    fundBaseMax: '21750.00',
    ...over,
  } as Row
}

// 上海时区 2026-11-21 14:00 ⇒ 业务年 2026、11 月
const AT_NOV = new Date('2026-11-21T06:00:00.000Z')
// 上海时区 2026-12-20 ⇒ 已进入必须补齐次年配置的窗口
const AT_DEC = new Date('2026-12-20T06:00:00.000Z')
// 上海时区 2026-03-10 ⇒ 未到调基期,不应催次年配置
const AT_MAR = new Date('2026-03-10T06:00:00.000Z')

describe('diffInsuranceConfig', () => {
  it('首次建档:已填口径逐项记成「未填 → 值」,不产生 enabled 变更项', () => {
    const changes = diffInsuranceConfig(null, {
      regionName: '测试市',
      effectiveYear: 2026,
      enabled: true,
      pensionPersonal: '0.0800',
      medicalPersonal: null,
      unemploymentPersonal: null,
      housingFundRate: null,
      insuranceBaseMin: '3000.00',
      insuranceBaseMax: '21750.00',
      fundBaseMin: null,
      fundBaseMax: null,
    })
    expect(changes.map((c) => c.label)).toEqual(['养老个人费率', '社保基数下限', '社保基数上限'])
    expect(changes[0]).toMatchObject({ from: '未填', to: '0.08' })
  })

  it('改写单项:只报这一项,from/to 量纲归一(numeric 字符串按数值展示)', () => {
    const row = makeRow()
    const changes = diffInsuranceConfig(row, {
      ...(row as unknown as Record<string, unknown>),
      pensionPersonal: '0.0850',
    })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ field: 'pensionPersonal', from: '0.08', to: '0.085' })
  })

  it('同值重复提交 ⇒ 零变更(不发通知,避免提醒疲劳)', () => {
    const row = makeRow()
    const changes = diffInsuranceConfig(row, row as unknown as Record<string, unknown>)
    expect(changes).toHaveLength(0)
  })

  it('启停状态变化必须单独成项(停用后算薪会拒绝,必须让人看见)', () => {
    const row = makeRow()
    const changes = diffInsuranceConfig(row, {
      ...(row as unknown as Record<string, unknown>),
      enabled: false,
    })
    expect(changes.map((c) => c.label)).toEqual(['是否启用'])
    expect(changes[0]).toMatchObject({ from: '启用', to: '停用' })
  })
})

describe('judgeInsuranceRows · 当年配置', () => {
  it('一条启用配置都没有 ⇒ alert NO_CURRENT_CONFIG(算薪会拒绝)', () => {
    const findings = judgeInsuranceRows([], AT_NOV)
    const alert = findings.find((f) => f.code === 'NO_CURRENT_CONFIG')
    expect(alert?.level).toBe('alert')
    expect(alert?.effectiveYear).toBe(2026)
  })

  it('当年配置完整 ⇒ 无 alert;11 月缺次年 ⇒ 仅有 advisory', () => {
    const findings = judgeInsuranceRows([makeRow()], AT_NOV)
    expect(findings.filter((f) => f.level === 'alert')).toHaveLength(0)
    const next = findings.find((f) => f.code === 'NEXT_YEAR_CONFIG_MISSING')
    expect(next?.level).toBe('advisory')
    expect(next?.effectiveYear).toBe(2027)
  })

  it('3 月未到调基期 ⇒ 不催次年配置', () => {
    const findings = judgeInsuranceRows([makeRow()], AT_MAR)
    expect(findings).toHaveLength(0)
  })

  it('缺个人费率或基数上下限 ⇒ alert INCOMPLETE_CONFIG 且点名缺什么', () => {
    const findings = judgeInsuranceRows(
      [makeRow({ pensionPersonal: null, insuranceBaseMax: null })],
      AT_MAR,
    )
    const alert = findings.find((f) => f.code === 'INCOMPLETE_CONFIG')
    expect(alert?.level).toBe('alert')
    expect(alert?.message).toContain('社保基数上下限')
    expect(alert?.message).toContain('个人三险费率')
    expect(alert?.regionName).toBe('测试市')
  })

  it('记录时间早于生效年度 ⇒ advisory STALE_RECORD(疑似沿用旧年度)', () => {
    const findings = judgeInsuranceRows(
      [makeRow({ updatedAt: new Date('2025-06-01T00:00:00.000Z') })],
      AT_MAR,
    )
    const stale = findings.find((f) => f.code === 'STALE_RECORD')
    expect(stale?.level).toBe('advisory')
    expect(stale?.message).toContain('2025')
  })

  it('12 月仍未录次年配置 ⇒ 升为 alert(否则次年 1 月算薪必被拒)', () => {
    const findings = judgeInsuranceRows([makeRow()], AT_DEC)
    const next = findings.find((f) => f.code === 'NEXT_YEAR_CONFIG_MISSING')
    expect(next?.level).toBe('alert')
  })

  it('次年配置已录 ⇒ 不再催', () => {
    const findings = judgeInsuranceRows(
      [
        makeRow(),
        makeRow({ effectiveYear: 2027, updatedAt: new Date('2026-12-01T00:00:00.000Z') }),
      ],
      AT_DEC,
    )
    expect(findings.map((f) => f.code)).not.toContain('NEXT_YEAR_CONFIG_MISSING')
  })

  it('停用的配置不算"已录"(enabled=false 视同缺失)', () => {
    const findings = judgeInsuranceRows([makeRow({ enabled: false })], AT_NOV)
    expect(findings.find((f) => f.code === 'NO_CURRENT_CONFIG')?.level).toBe('alert')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
