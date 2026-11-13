// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

/**
 * 补偿(Saga 撤回)真库端到端验证(临时脚本)。
 *
 * 验两件事:
 *   A. 正常路径:算薪后未撤回,工资单在;
 *   B. 补偿路径:算薪后调 /hr-payroll/revert,工资单被删、周期回到 draft,
 *      且**已 approved 的周期拒绝撤回**。
 */
import { createHmac } from 'node:crypto'
import postgres from 'postgres'

const PORT = process.env.PORT ?? '34595'
const TOKEN = process.env.AI_CALLBACK_SECRET
const ADMIN_ID = '30763d9f-a4c4-4f0c-84c3-16d6b8a67c35'
const TENANT = 'cfe95955-7402-4d12-97ed-4ca9531f1da6'

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const deptId = '11111111-1111-4111-8111-111111111111'
const emp1 = '22222222-2222-4222-8222-222222222221'

async function caller(method, path, params) {
  const qs = method.toUpperCase() === 'GET' && Object.keys(params ?? {}).length
    ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : ''
  const url = `http://127.0.0.1:${PORT}/api${path}${qs}`
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = createHmac('sha256', TOKEN).update(`legacy-v1\n${ADMIN_ID}\n${ts}`, 'utf8').digest('hex')
  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: {
      'content-type': 'application/json',
      'x-internal-service-token': TOKEN,
      'x-user-id': ADMIN_ID,
      'x-internal-service-timestamp': ts,
      'x-internal-service-signature': sig,
      'x-tenant-id': TENANT,
    },
    body: method.toUpperCase() === 'GET' ? undefined : JSON.stringify(params ?? {}),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(body)?.slice(0, 200)}`)
  return body
}

async function cleanup() {
  await sql`DELETE FROM hr_payroll_item WHERE employee_id = ${emp1}::uuid`
  await sql`DELETE FROM hr_payroll_period WHERE period_month = '2026-11'`
  await sql`DELETE FROM hr_attendance_monthly WHERE employee_id = ${emp1}::uuid`
  await sql`DELETE FROM hr_attendance_daily WHERE employee_id = ${emp1}::uuid`
  await sql`DELETE FROM hr_attendance_record WHERE employee_id = ${emp1}::uuid`
  await sql`DELETE FROM hr_salary_config WHERE employee_id = ${emp1}::uuid`
  await sql`DELETE FROM hr_employee WHERE id = ${emp1}::uuid`
  await sql`DELETE FROM hr_department WHERE id = ${deptId}::uuid`
  await sql`DELETE FROM hr_attendance_rule WHERE department_id = ${deptId}::uuid`
}

async function seedData() {
  await sql`INSERT INTO hr_department (id, name, sort_order, created_at, updated_at)
    VALUES (${deptId}::uuid, 'E2E补偿测试部', 0, now(), now())`
  await sql`INSERT INTO hr_employee (id, employee_no, name, department_id, status, created_at, updated_at)
    VALUES (${emp1}::uuid, 'CP001', '补偿测试员', ${deptId}::uuid, 'active', now(), now())`
  await sql`INSERT INTO hr_attendance_rule (department_id, late_after, early_before, workdays)
    VALUES (${deptId}::uuid, '09:00', '18:00', 31)`
  await sql`INSERT INTO hr_salary_config (employee_id, base_salary, fixed_allowance, effective_from)
    VALUES (${emp1}::uuid, '21750.00', '500.00', '2026-01-01')`
  await sql`INSERT INTO hr_attendance_record (employee_id, department_id, date, check_in_time, check_out_time, status, check_in_method, operated_by)
    VALUES (${emp1}::uuid, ${deptId}::uuid, '2026-11-02',
            '2026-11-02 00:55:00+00', '2026-11-02 10:10:00+00', 'present', 'import', ${ADMIN_ID}::uuid)`
}

async function main() {
  await cleanup()
  await seedData()
  console.log('\n[1] 数据就绪')

  console.log('\n[2] 正常路径:算薪后不撤回,工资单应在')
  await caller('POST', '/hr-settle/daily', { periodMonth: '2026-11' })
  await caller('POST', '/hr-settle/monthly', { periodMonth: '2026-11' })
  await caller('POST', '/hr-payroll/calculate', { periodMonth: '2026-11' })
  const before = await sql`SELECT count(*)::int AS c FROM hr_payroll_item WHERE employee_id = ${emp1}::uuid`
  assert(before[0].c > 0, `算薪后工资单 ${before[0].c} 条`)
  const [p1] = await sql`SELECT status FROM hr_payroll_period WHERE period_month = '2026-11'`
  assert(p1.status === 'calculated', `周期状态 ${p1.status}`)

  console.log('\n[3] 补偿路径:周期非 draft 时撤回被拒(保护已确认结果)')
  const r1 = await caller('POST', '/hr-payroll/revert', { periodMonth: '2026-11' })
  assert(r1.data.skipped === true, `撤回被跳过(reason=${r1.data.reason})`)
  assert(String(r1.data.reason).includes('calculated'), '原因是周期已 calculated')
  const stillThere = await sql`SELECT count(*)::int AS c FROM hr_payroll_item WHERE employee_id = ${emp1}::uuid`
  assert(stillThere[0].c === before[0].c, '工资单未被删')

  console.log('\n[4] 补偿路径:周期回 draft 后撤回成功')
  await sql`UPDATE hr_payroll_period SET status = 'draft' WHERE period_month = '2026-11'`
  const r2 = await caller('POST', '/hr-payroll/revert', { periodMonth: '2026-11' })
  assert(r2.data.skipped === false, '撤回执行')
  assert(r2.data.deletedItems === before[0].c, `删除 ${r2.data.deletedItems} 条工资单`)
  const after = await sql`SELECT count(*)::int AS c FROM hr_payroll_item WHERE employee_id = ${emp1}::uuid`
  assert(after[0].c === 0, '工资单已清空')

  console.log('\n[5] 撤回不越界:考勤月结必须保留')
  const [monthly] = await sql`SELECT count(*)::int AS c FROM hr_attendance_monthly WHERE employee_id = ${emp1}::uuid`
  assert(monthly.c > 0, `hr_attendance_monthly 仍有 ${monthly.c} 条(未被误删)`)

  console.log('\n[6] 撤回后重算:幂等键仍在,可再次算薪')
  await caller('POST', '/hr-payroll/calculate', { periodMonth: '2026-11' })
  const redo = await sql`SELECT count(*)::int AS c FROM hr_payroll_item WHERE employee_id = ${emp1}::uuid`
  assert(redo[0].c > 0, `重算后工资单 ${redo[0].c} 条`)

  console.log('\n[7] 无周期时撤回:安全跳过')
  await sql`DELETE FROM hr_payroll_item WHERE employee_id = ${emp1}::uuid`
  await sql`DELETE FROM hr_payroll_period WHERE period_month = '2026-11'`
  const r3 = await caller('POST', '/hr-payroll/revert', { periodMonth: '2026-11' })
  assert(r3.data.skipped === true, `无周期时跳过(reason=${r3.data.reason})`)

  console.log('\n✅ 补偿机制真库端到端全部通过')
  await cleanup()
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e.message)
  try { await cleanup() } catch {}
  await sql.end()
  process.exit(1)
})
