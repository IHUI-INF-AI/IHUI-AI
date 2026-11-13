// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

/**
 * HR 月度薪资「一键代办」真库端到端验证(临时脚本)。
 *
 * 走真实 HTTP:准备数据 → 按模板顺序跑 5 步 → 用 summarizePayrollRun 翻译结果 → 核对。
 * 与 ai-task-executor 的 defaultCaller 同形(回环 fetch + 内部服务 token)。
 */
import { createHmac } from 'node:crypto'
import postgres from 'postgres'
import { buildHrMonthlyPayrollTemplate, summarizePayrollRun } from '../../../apps/api/src/services/hr-payroll-workflow.ts'

const PORT = process.env.PORT ?? '34591'
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

/** 与 jobs/ai-task-cron.ts 的 defaultCaller 同形:回环 fetch + 内部服务 token */
async function caller(method, path, params) {
  const qs =
    method.toUpperCase() === 'GET' && Object.keys(params ?? {}).length
      ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`
      : ''
  const url = `http://127.0.0.1:${PORT}/api${path}${qs}`
  // legacy 档要求身份签名:HMAC-SHA256(secret, "legacy-v1\nuserId\ntimestamp")
  // 见 plugins/internal-service-token.ts 的 verifyLegacyIdentityHeaders
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
  if (!res.ok) {
    throw new Error(`endpoint ${method} ${path} failed: ${res.status} ${JSON.stringify(body)?.slice(0, 200)}`)
  }
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

async function main() {
  await cleanup()

  console.log('\n[1] 准备真实数据:部门 / 员工 / 规则 / 薪资配置')
  await sql`INSERT INTO hr_department (id, name, sort_order, created_at, updated_at)
    VALUES (${deptId}::uuid, 'E2E流程测试部', 0, now(), now())`
  await sql`INSERT INTO hr_employee (id, employee_no, name, department_id, status, created_at, updated_at)
    VALUES (${emp1}::uuid, 'WF001', '流程测试员', ${deptId}::uuid, 'active', now(), now())`
  await sql`INSERT INTO hr_attendance_rule (department_id, late_after, early_before, workdays)
    VALUES (${deptId}::uuid, '09:00', '18:00', 31)`
  // 月薪 21750(日薪 = 1000)
  await sql`INSERT INTO hr_salary_config (employee_id, base_salary, fixed_allowance, effective_from)
    VALUES (${emp1}::uuid, '21750.00', '500.00', '2026-01-01')`
  // 11-02(周一)正常出勤 → 让日结有真实数据
  await sql`INSERT INTO hr_attendance_record (employee_id, department_id, date, check_in_time, check_out_time, status, check_in_method, operated_by)
    VALUES (${emp1}::uuid, ${deptId}::uuid, '2026-11-02',
            '2026-11-02 00:55:00+00', '2026-11-02 10:10:00+00', 'present', 'import', ${ADMIN_ID}::uuid)`
  console.log('  数据就绪:1 部门 / 1 员工 / 1 条打卡 / 月薪 21750')

  console.log('\n[2] 按模板顺序执行 5 步真实 HTTP 调用')
  const tpl = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-11' })
  const stepResults = []
  for (let i = 0; i < tpl.steps.length; i++) {
    const step = tpl.steps[i]
    const t0 = Date.now()
    try {
      const output = await caller(step.method, step.path, step.params ?? {})
      stepResults.push({
        stepIndex: i,
        ok: true,
        output,
        startedAt: new Date(t0).toISOString(),
        finishedAt: new Date().toISOString(),
      })
      console.log(`   步骤 ${i} ✓ ${step.method} ${step.path} (${Date.now() - t0}ms)`)
    } catch (e) {
      stepResults.push({
        stepIndex: i,
        ok: false,
        error: String(e.message).slice(0, 300),
        startedAt: new Date(t0).toISOString(),
        finishedAt: new Date().toISOString(),
      })
      console.log(`   步骤 ${i} ✗ ${step.method} ${step.path}: ${String(e.message).slice(0, 160)}`)
      break
    }
  }
  assert(stepResults.every((r) => r.ok), '五个步骤全部跑通')

  console.log('\n[3] 用 summarizePayrollRun 翻译结果')
  const summary = summarizePayrollRun(stepResults)
  console.log('   ', JSON.stringify(summary, null, 1).replace(/\n/g, '\n    '))
  assert(summary.ok === true, '摘要判定为成功')
  assert(summary.monthlyEmployees >= 1, `月结覆盖 ${summary.monthlyEmployees} 人`)
  assert(summary.payslipCount >= 1, `产出 ${summary.payslipCount} 条工资单`)
  assert(Number(summary.totalGross) > 0, `应发合计 ${summary.totalGross}`)

  console.log('\n[4] 回读数据库核对(不只看接口返回)')
  const [item] = await sql`
    SELECT base_salary, gross_pay, net_pay FROM hr_payroll_item WHERE employee_id = ${emp1}::uuid`
  assert(!!item, 'hr_payroll_item 有记录')
  assert(Number(item.gross_pay) === Number(summary.totalGross), `gross_pay 与摘要一致(${item.gross_pay})`)

  const [monthly] = await sql`
    SELECT scheduled_days, actual_days, absent_days FROM hr_attendance_monthly WHERE employee_id = ${emp1}::uuid`
  assert(!!monthly, 'hr_attendance_monthly 有记录')
  console.log(`   月结:应出勤 ${monthly.scheduled_days} 天 / 实出勤 ${monthly.actual_days} 天 / 缺勤 ${monthly.absent_days} 天`)

  console.log('\n[5] 验证幂等:重复跑第 0 步不应重复写')
  const beforeCount = await sql`SELECT count(*)::int AS c FROM hr_attendance_daily WHERE employee_id = ${emp1}::uuid`
  await caller('POST', '/hr-settle/daily', { periodMonth: '2026-11' })
  const afterCount = await sql`SELECT count(*)::int AS c FROM hr_attendance_daily WHERE employee_id = ${emp1}::uuid`
  assert(beforeCount[0].c === afterCount[0].c, `日结行数不增长(${beforeCount[0].c} → ${afterCount[0].c})`)

  console.log('\n[6] 验证失败即停 + 可续跑:传非法月份')
  const tplBad = buildHrMonthlyPayrollTemplate({ periodMonth: '2026-13' })
  let failedAt = null
  for (let i = 0; i < tplBad.steps.length; i++) {
    try {
      await caller(tplBad.steps[i].method, tplBad.steps[i].path, tplBad.steps[i].params ?? {})
    } catch {
      failedAt = i
      break
    }
  }
  assert(failedAt !== null, `非法月份在第 ${failedAt} 步被拦下(不会跑完)`)

  console.log('\n✅ HR 月度薪资一键代办真库端到端全部通过')
  await cleanup()
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e.message)
  try { await cleanup() } catch {}
  await sql.end()
  process.exit(1)
})
