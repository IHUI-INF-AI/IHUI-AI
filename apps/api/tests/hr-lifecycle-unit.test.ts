// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事生命周期纯函数单测(2026-11-23 立)。
 * 只 import hr-lifecycle-core.ts(零 IO),不拉起连接池。
 */
import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  buildCertificateNo,
  buildResignCertificateText,
  canTransitCandidate,
  canTransitContract,
  canTransitResignation,
  computePeriodEnd,
  computeProbationEndDate,
  contractExpiryState,
  summarizeContractStates,
} from '../src/services/hr-lifecycle-core.js'

describe('addMonths(对应日规则)', () => {
  it('普通日跨月保持日期', () => {
    expect(addMonths('2026-01-15', 3)).toBe('2026-04-15')
  })
  it('31 日遇小月取月末(平年)', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })
  it('31 日遇小月取月末(闰年)', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
  })
  it('跨年', () => {
    expect(addMonths('2026-11-30', 2)).toBe('2027-01-30')
  })
})

describe('addDays', () => {
  it('正负都支持', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('computePeriodEnd(试用期届满,含尾日)', () => {
  it('1/1 起 3 个月 = 3/31', () => {
    expect(computePeriodEnd('2026-01-01', 3)).toBe('2026-03-31')
  })
  it('1/31 起 3 个月 = 4/30(月末起算取目标月末)', () => {
    expect(computePeriodEnd('2026-01-31', 3)).toBe('2026-04-30')
  })
  it('1/15 起 3 个月 = 4/14', () => {
    expect(computePeriodEnd('2026-01-15', 3)).toBe('2026-04-14')
  })
  it('2/1 起 1 个月 = 2/28', () => {
    expect(computePeriodEnd('2026-02-01', 1)).toBe('2026-02-28')
  })
})

describe('computeProbationEndDate', () => {
  it('0 个月 = 无试用期', () => {
    expect(computeProbationEndDate('2026-01-01', 0)).toBeNull()
    expect(computeProbationEndDate('2026-01-01', -1)).toBeNull()
  })
  it('6 个月', () => {
    expect(computeProbationEndDate('2026-07-01', 6)).toBe('2026-12-31')
  })
})

describe('contractExpiryState(派生态)', () => {
  const today = '2026-11-23'
  it('无结束日 = 无固定期限', () => {
    expect(contractExpiryState(null, today)).toBe('indefinite')
  })
  it('昨天到期 = expired', () => {
    expect(contractExpiryState('2026-11-22', today)).toBe('expired')
  })
  it('今天到期 = expiring', () => {
    expect(contractExpiryState('2026-11-23', today)).toBe('expiring')
  })
  it('30 天边界内 = expiring', () => {
    expect(contractExpiryState('2026-12-23', today)).toBe('expiring')
  })
  it('31 天后 = active', () => {
    expect(contractExpiryState('2026-12-24', today)).toBe('active')
  })
  it('自定义预警窗口', () => {
    expect(contractExpiryState('2026-12-30', today, 7)).toBe('active')
    expect(contractExpiryState('2026-11-30', today, 7)).toBe('expiring')
  })
})

describe('合同状态机', () => {
  it('draft 只能去 signed/terminated', () => {
    expect(canTransitContract('draft', 'signed')).toBe(true)
    expect(canTransitContract('draft', 'terminated')).toBe(true)
    expect(canTransitContract('draft', 'renewed')).toBe(false)
    expect(canTransitContract('draft', 'expired')).toBe(false)
  })
  it('signed 可去 expired/terminated/renewed', () => {
    expect(canTransitContract('signed', 'renewed')).toBe(true)
    expect(canTransitContract('signed', 'expired')).toBe(true)
  })
  it('终态不可回退', () => {
    expect(canTransitContract('terminated', 'signed')).toBe(false)
    expect(canTransitContract('renewed', 'signed')).toBe(false)
    expect(canTransitContract('expired', 'signed')).toBe(false)
  })
})

describe('离职状态机', () => {
  it('applied → approved / cancelled', () => {
    expect(canTransitResignation('applied', 'approved')).toBe(true)
    expect(canTransitResignation('applied', 'cancelled')).toBe(true)
    expect(canTransitResignation('applied', 'settled')).toBe(false)
  })
  it('approved → settled;不可撤销', () => {
    expect(canTransitResignation('approved', 'settled')).toBe(true)
    expect(canTransitResignation('approved', 'cancelled')).toBe(false)
  })
  it('settled 终态', () => {
    expect(canTransitResignation('settled', 'approved')).toBe(false)
  })
})

describe('候选人状态机', () => {
  it('主链逐级推进', () => {
    expect(canTransitCandidate('applied', 'screening')).toBe(true)
    expect(canTransitCandidate('screening', 'interview')).toBe(true)
    expect(canTransitCandidate('interview', 'offer')).toBe(true)
    expect(canTransitCandidate('offer', 'hired')).toBe(true)
  })
  it('不能跳级', () => {
    expect(canTransitCandidate('applied', 'offer')).toBe(false)
    expect(canTransitCandidate('screening', 'hired')).toBe(false)
  })
  it('任意非终态可淘汰/放弃', () => {
    expect(canTransitCandidate('applied', 'rejected')).toBe(true)
    expect(canTransitCandidate('offer', 'withdrawn')).toBe(true)
  })
  it('hired 终态', () => {
    expect(canTransitCandidate('hired', 'rejected')).toBe(false)
    expect(canTransitCandidate('rejected', 'screening')).toBe(false)
  })
})

describe('离职证明', () => {
  const id = '3f2a9c1e-4b5d-4e6f-8a9b-0c1d2e3f4a5b'
  it('编号格式 RESIGN-YYMMDD-XXXXXX', () => {
    const no = buildCertificateNo('2026-11-23T02:00:00.000Z', id)
    expect(no).toBe('RESIGN-261123-3F2A9C')
  })
  it('正文含关键要素且不做越权背书', () => {
    const text = buildResignCertificateText({
      companyName: '示例科技有限公司',
      employeeName: '张三',
      employeeNo: 'E001',
      departmentName: '财务部',
      position: '会计',
      hireDate: '2023-03-01',
      lastWorkDate: '2026-11-30',
      lastSalaryPeriod: '2026-11',
      certificateNo: 'RESIGN-261123-3F2A9C',
      issueDate: '2026-11-23',
    })
    expect(text).toContain('张三')
    expect(text).toContain('E001')
    expect(text).toContain('2023-03-01')
    expect(text).toContain('2026-11-30')
    expect(text).toContain('RESIGN-261123-3F2A9C')
    expect(text).toContain('示例科技有限公司')
    expect(text).toContain('财务部任会计岗位')
    expect(text).not.toContain('无任何争议')
  })
  it('无入职日/无结算期时仍自洽', () => {
    const text = buildResignCertificateText({
      companyName: 'A 公司',
      employeeName: '李四',
      employeeNo: 'E002',
      departmentName: '人事部',
      position: null,
      hireDate: null,
      lastWorkDate: '2026-11-30',
      lastSalaryPeriod: null,
      certificateNo: 'RESIGN-261123-ABCDEF',
      issueDate: '2026-11-23',
    })
    expect(text).toContain('在职')
    expect(text).toContain('薪资按实际出勤结算')
  })
})

describe('合同看板汇总', () => {
  it('四类计数', () => {
    const rows = [
      { status: 'signed', endDate: '2026-11-24' }, // expiring
      { status: 'signed', endDate: '2026-10-01' }, // expired
      { status: 'signed', endDate: null }, // indefinite
      { status: 'draft', endDate: '2027-12-31' }, // active
    ]
    const s = summarizeContractStates(rows, '2026-11-23')
    expect(s.total).toBe(4)
    expect(s.signed).toBe(3)
    expect(s.draft).toBe(1)
    expect(s.expiring).toBe(1)
    expect(s.expired).toBe(1)
    expect(s.indefinite).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
