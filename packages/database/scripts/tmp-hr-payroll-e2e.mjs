// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 薪资计算真库端到端验证(临时脚本)。 */
import postgres from 'postgres'
import { buildPayroll } from '../../../apps/api/src/services/hr-payroll.ts'

const dsn = process.env.DATABASE_URL
if (!dsn) throw new Error('DATABASE_URL 未设置')
const sql = postgres(dsn, { max: 1 })

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

const deptId = '11111111-1111-4111-8111-111111111111'
const emp1 = '22222222-2222-4222-8222-222222222221'
const emp2 = '22222222-2222-4222-8222-222222222222'

async function cleanup() {
  await sql`DELETE FROM hr_payroll_item WHERE employee_id IN (${emp1}::uuid, ${emp2}::uuid)`
  await sql`DELETE FROM hr_payroll_period WHERE period_month='2026-11'`
  await sql`DELETE FROM hr_attendance_monthly WHERE employee_id IN (${emp1}::uuid, ${emp2}::uuid)`
  await sql`DELETE FROM hr_salary_config WHERE employee_id IN (${emp1}::uuid, ${emp2}::uuid)`
  await sql`DELETE FROM hr_insurance_rate_config WHERE region_name='E2E测试市'`
  await sql`DELETE FROM hr_employee_tax_profile WHERE employee_id IN (${emp1}::uuid, ${emp2}::uuid)`
}

async function main() {
  await cleanup()

  console.log('\n【1】准备:薪资配置 + 社保费率 + 专项扣除 + 月结')
  // 月薪 21750(日薪 = 21750/21.75 = 1000)
  await sql`INSERT INTO hr_salary_config (employee_id, base_salary, fixed_allowance, effective_from)
    VALUES (${emp1}::uuid, '21750.00', '500.00', '2026-01-01')`
  // 员工2 不配薪资 → 应被跳过
  // 社保费率:养老8% + 医疗2% + 失业0.5% = 10.5%;公积金 7%
  await sql`INSERT INTO hr_insurance_rate_config
    (region_name, pension_personal, medical_personal, unemployment_personal, housing_fund_rate,
     insurance_base_min, insurance_base_max, effective_year, enabled)
    VALUES ('E2E测试市', 0.08, 0.02, 0.005, 0.07, '3000.00', '30000.00', 2026, true)`
  // 专项扣除:1 个孩子(2000)、独生赡养(3000)、租房(1500) = 6500
  await sql`INSERT INTO hr_employee_tax_profile
    (employee_id, children_count, children_deduction_ratio, infant_count, is_only_child,
     housing_type, housing_rent_amount, other_monthly_deduction)
    VALUES (${emp1}::uuid, 1, 1.00, 0, true, 'rent', '1500.00', '0.00')`

  // 月结:应出勤 21 天、实出勤 20 天、缺勤 1 天、加班:工作日2h + 休息日8h + 节假日0
  await sql`INSERT INTO hr_attendance_monthly
    (period_month, employee_id, department_id, scheduled_days, actual_days, late_count, early_count,
     absent_days, leave_days, ot_hours, ot_detail)
    VALUES ('2026-11', ${emp1}::uuid, ${deptId}::uuid, '21.0', '20.0', 1, 0, '1.0', '{"annual":1}'::jsonb,
            '10.00', '{"weekday":2,"weekend":8,"holiday":0}'::jsonb)`
  await sql`INSERT INTO hr_attendance_monthly
    (period_month, employee_id, department_id, scheduled_days, actual_days, late_count, early_count,
     absent_days, leave_days, ot_hours, ot_detail)
    VALUES ('2026-11', ${emp2}::uuid, ${deptId}::uuid, '21.0', '21.0', 0, 0, '0.0', '{}'::jsonb,
            '0.00', '{"weekday":0,"weekend":0,"holiday":0}'::jsonb)`

  console.log('\n【2】计算工资')
  const result = await buildPayroll({ periodMonth: '2026-11', regionName: 'E2E测试市' })
  console.log('  ', JSON.stringify(result))
  assert(result.inserted === 1, '只算了配了薪资的员工(1 人)')
  assert(result.skippedNoConfig === 1, '缺薪资配置的员工被跳过并报数')

  console.log('\n【3】逐项核对计算')
  const [item] = await sql`
    SELECT base_salary, allowance, ot_amount, attendance_deduction, gross_pay,
           insurance_personal, housing_fund_personal, taxable_income, income_tax, net_pay, breakdown
    FROM hr_payroll_item WHERE employee_id=${emp1}::uuid`
  const b = item.breakdown
  console.log('  breakdown.steps:', JSON.stringify(b.steps))

  // 日薪 = 21750 / 21.75 = 1000
  assert(b.steps.dailyRate === 1000, '日薪 = 21750/21.75 = 1000')
  // 基本工资 = 1000 × 20 = 20000
  assert(b.steps.basePay === 20000, '基本工资 = 1000 × 20 天 = 20000')
  // 加班:时薪 = 21750/21.75/8 = 125
  // 工作日 2h × 1.5 + 休息日 8h × 2 = 3 + 16 = 19 小时当量 × 125 = 2375
  assert(b.steps.otAmount === 2375, '加班费 = 125 × (2×1.5 + 8×2) = 2375')
  // 缺勤扣款 = 1000 × 1 = 1000
  assert(b.steps.absenceDeduction === 1000, '缺勤扣款 = 1000 × 1 天 = 1000')
  // 应发 = 20000 + 500 + 2375 - 1000 = 21875
  assert(b.steps.grossPay === 21875, '应发 = 20000+500+2375-1000 = 21875')
  // 社保个人 = 21750 × 10.5% = 2283.75
  assert(b.steps.insurancePersonal === 2283.75, '社保个人 = 21750×10.5% = 2283.75')
  // 公积金 = 21750 × 7% = 1522.5
  assert(b.steps.housingFundPersonal === 1522.5, '公积金 = 21750×7% = 1522.5')
  // 专项扣除 = 2000(1孩) + 3000(独生赡养) + 1500(租房) = 6500
  assert(b.steps.specialDeduction === 6500, '专项附加扣除 = 2000+3000+1500 = 6500')
  // 计税所得 = 21875 - 2283.75 - 1522.5 - 6500 - 5000 = 6568.75
  assert(b.steps.taxableIncome === 6568.75, '计税所得 = 6568.75')
  // 个税:(6568.75 × 3%) - 0 = 197.06
  assert(b.steps.incomeTax === 197.06, '个税 = 6568.75×3% = 197.06')
  // 实发 = 21875 - 2283.75 - 1522.5 - 197.06 = 17871.69
  assert(b.steps.netPay === 17871.69, '实发 = 17871.69')

  assert(b.rates.region === 'E2E测试市', '费率快照带地区')
  assert(b.rates.pensionPersonal === 0.08, '费率快照带养老比例')

  console.log('\n【4】落库字段与 breakdown 一致')
  assert(Number(item.base_salary) === 21750, 'base_salary 落库 = 21750')
  assert(Number(item.gross_pay) === b.steps.grossPay, 'gross_pay 与 breakdown 一致')
  assert(Number(item.net_pay) === b.steps.netPay, 'net_pay 与 breakdown 一致')

  console.log('\n【5】幂等:重算不重复插入')
  const r2 = await buildPayroll({ periodMonth: '2026-11', regionName: 'E2E测试市' })
  console.log('  ', JSON.stringify(r2))
  assert(r2.inserted === 0 && r2.updated === 1, '重算只更新')
  const cnt = await sql`SELECT count(*)::int AS c FROM hr_payroll_item WHERE employee_id=${emp1}::uuid`
  assert(cnt[0].c === 1, '工资单不重复')

  console.log('\n【6】缺社保配置时不猜数')
  await sql`DELETE FROM hr_insurance_rate_config WHERE region_name='E2E测试市'`
  const _r3 = await buildPayroll({ periodMonth: '2026-11' })
  const [item3] = await sql`
    SELECT breakdown FROM hr_payroll_item WHERE employee_id=${emp1}::uuid`
  console.log('  warnings:', JSON.stringify(item3.breakdown.warnings))
  assert(item3.breakdown.warnings.length > 0, '缺费率配置 → 有 warning')
  assert(item3.breakdown.steps.insurancePersonal === 0, '缺配置时社保按 0(不猜)')

  console.log('\n【7】已审批周期拒绝重算')
  await sql`UPDATE hr_payroll_period SET status='approved' WHERE period_month='2026-11'`
  let blocked = false
  try {
    await buildPayroll({ periodMonth: '2026-11' })
  } catch (e) {
    blocked = e.errorCode === 'PAYROLL_PERIOD_APPROVED'
    console.log('   ', e.message)
  }
  assert(blocked, '已审批周期拒绝重算')

  console.log('\n✅ 薪资计算真库端到端全部通过')
  await cleanup()
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e)
  await sql.end()
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
