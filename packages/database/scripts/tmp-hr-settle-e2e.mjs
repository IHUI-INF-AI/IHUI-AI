// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 考勤结算(日结/月结)真库端到端验证(临时脚本)。 */
import postgres from 'postgres'
import { createAnyImportBatch, confirmAnyImportBatch } from '../../../apps/api/src/services/hr-import-entry.ts'
import { buildDailyAttendance, buildMonthlyAttendance } from '../../../apps/api/src/services/hr-attendance-settle.ts'

const dsn = process.env.DATABASE_URL
if (!dsn) throw new Error('DATABASE_URL 未设置')
const sql = postgres(dsn, { max: 1 })

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

async function cleanup() {
  await sql`DELETE FROM hr_import_batch WHERE file_name LIKE 'e2e-set%'`
  await sql`DELETE FROM hr_attendance_daily WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_attendance_monthly WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_leave_request WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_overtime_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_outgoing_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_attendance_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
}

async function main() {
  await cleanup()

  // 建规则:周一~周五上班,迟到阈值 09:00,早退阈值 18:00
  const deptId = '11111111-1111-4111-8111-111111111111'
  await sql`DELETE FROM hr_attendance_rule WHERE department_id = ${deptId}::uuid`
  await sql`INSERT INTO hr_attendance_rule (department_id, late_after, early_before, workdays)
    VALUES (${deptId}::uuid, '09:00', '18:00', 31)`

  console.log('\n【1】准备四类原始数据')
  // 打卡:11-02(周一)正常,11-03 迟到
  const attCsv = `工号,姓名,日期,上班打卡,下班打卡
E2E001,张三,2026-11-02,08:55,18:10
E2E001,张三,2026-11-03,09:30,18:05
E2E002,李四,2026-11-02,08:50,18:20
`
  const att = await createAnyImportBatch({
    periodMonth: '2026-11', importKind: 'attendance', fileName: 'e2e-set-att.csv',
    storageFileId: '77777777-7777-4777-8777-777777777701', buffer: Buffer.from(attCsv, 'utf8'),
  })
  await confirmAnyImportBatch({ batchId: att.batch.id })
  console.log('  打卡导入完成')

  // 请假:11-04(周三)E2E001 年假
  const lvCsv = `工号,姓名,假别,开始日期,结束日期,请假天数,请假事由,审批状态
E2E001,张三,年假,2026-11-04,2026-11-04,1,家中有事,已通过
`
  const lv = await createAnyImportBatch({
    periodMonth: '2026-11', importKind: 'leave', fileName: 'e2e-set-lv.csv',
    storageFileId: '77777777-7777-4777-8777-777777777702', buffer: Buffer.from(lvCsv, 'utf8'),
  })
  await confirmAnyImportBatch({ batchId: lv.batch.id })
  console.log('  请假导入完成')

  // 加班:11-07(周六)E2E001 休息日 3 小时
  const otCsv = `工号,姓名,加班日期,加班时长,加班类型
E2E001,张三,2026-11-07,3小时,休息日
`
  const ot = await createAnyImportBatch({
    periodMonth: '2026-11', importKind: 'overtime', fileName: 'e2e-set-ot.csv',
    storageFileId: '77777777-7777-4777-8777-777777777703', buffer: Buffer.from(otCsv, 'utf8'),
  })
  await confirmAnyImportBatch({ batchId: ot.batch.id })
  console.log('  加班导入完成')

  // 外出:11-05(周四)E2E001 上午外出 3 小时
  const outCsv = `工号,姓名,开始日期,结束日期,开始时间,结束时间,外出地点,外出事由,审批状态
E2E001,张三,2026-11-05,2026-11-05,09:00,12:00,客户现场,上门实施,已通过
`
  const out = await createAnyImportBatch({
    periodMonth: '2026-11', importKind: 'outgoing', fileName: 'e2e-set-out.csv',
    storageFileId: '77777777-7777-4777-8777-777777777704', buffer: Buffer.from(outCsv, 'utf8'),
  })
  await confirmAnyImportBatch({ batchId: out.batch.id })
  console.log('  外出导入完成')

  console.log('\n【2】生成日结')
  const daily = await buildDailyAttendance({ periodMonth: '2026-11' })
  console.log('  ', JSON.stringify(daily))
  assert(daily.employeeDays > 0, '生成日结行 > 0')

  const e1 = await sql`
    SELECT d.date::text AS date, d.status, d.scheduled_minutes, d.actual_minutes, d.late_minutes, d.overtime_minutes
    FROM hr_attendance_daily d JOIN hr_employee e ON e.id=d.employee_id
    WHERE e.employee_no='E2E001' AND d.date BETWEEN '2026-11-02' AND '2026-11-08'
    ORDER BY d.date`
  console.log('  E2E001 该周:')
  for (const r of e1) console.log('   ', r.date, r.status, `应${r.scheduled_minutes}`, `实${r.actual_minutes}`,
    `迟${r.late_minutes}`, `加${r.overtime_minutes}`)

  const d02 = e1.find((r) => r.date === '2026-11-02')
  assert(d02?.status === 'present', '11-02 正常出勤 = present')
  assert(d02.scheduled_minutes === 480, '11-02 应出勤 480 分钟')
  assert(d02.actual_minutes > 480, '11-02 实出勤含加班时长')

  const d03 = e1.find((r) => r.date === '2026-11-03')
  assert(d03?.status === 'late', '11-03 迟到 = late')
  assert(d03.late_minutes === 30, '迟到 30 分钟')

  const d04 = e1.find((r) => r.date === '2026-11-04')
  assert(d04?.status === 'leave', '11-04 请假 = leave')
  assert(d04.actual_minutes === 480, '请假当天实出勤补足到应出勤')

  const d05 = e1.find((r) => r.date === '2026-11-05')
  assert(d05?.status === 'present', '11-05 外出 = present(算出勤)')
  assert(d05.actual_minutes === 180, '外出 3 小时 = 180 分钟')

  const d07 = e1.find((r) => r.date === '2026-11-07')
  assert(d07?.overtime_minutes === 180, '11-07 周六加班 180 分钟')
  assert(d07.scheduled_minutes === 0, '周六非工作日,应出勤 0')

  const d08 = e1.find((r) => r.date === '2026-11-08')
  assert(d08?.status === 'rest', '11-08 周日无记录 = rest(不算缺勤)')

  console.log('\n【3】幂等:再跑一次日结')
  const daily2 = await buildDailyAttendance({ periodMonth: '2026-11' })
  console.log('  ', JSON.stringify(daily2))
  assert(daily2.inserted === 0, '第二次 inserted = 0(全部走更新)')
  const cnt = await sql`SELECT count(*)::int AS c FROM hr_attendance_daily d
    JOIN hr_employee e ON e.id=d.employee_id WHERE e.employee_no IN ('E2E001','E2E002')`
  assert(cnt[0].c === daily.employeeDays, '日结行数不重复增长')

  console.log('\n【4】生成月结')
  const monthly = await buildMonthlyAttendance({ periodMonth: '2026-11' })
  console.log('  ', JSON.stringify(monthly))
  assert(monthly.employees >= 1, '月结覆盖员工数 >= 1')

  const m1 = await sql`
    SELECT m.period_month, m.scheduled_days, m.actual_days, m.late_count, m.absent_days,
           m.leave_days, m.ot_hours, m.ot_detail
    FROM hr_attendance_monthly m JOIN hr_employee e ON e.id=m.employee_id
    WHERE e.employee_no='E2E001'`
  const row = m1[0]
  console.log('  E2E001 月结:', JSON.stringify(row))
  assert(Number(row.scheduled_days) > 0, '应出勤天数 > 0')
  assert(Number(row.late_count) === 1, '迟到次数 = 1')
  assert(Number(row.ot_hours) === 3, '加班 3 小时')
  assert(row.ot_detail.weekend === 3, '休息日加班 3 小时')
  assert(row.leave_days.annual === 1, '年假 1 天')

  console.log('\n【5】已签字的月结拒绝覆盖')
  await sql`UPDATE hr_attendance_monthly SET signed=true
    WHERE employee_id=(SELECT id FROM hr_employee WHERE employee_no='E2E001')`
  const monthly2 = await buildMonthlyAttendance({ periodMonth: '2026-11' })
  console.log('  ', JSON.stringify(monthly2))
  assert(monthly2.skippedSigned >= 1, '已签字月结被跳过')

  console.log('\n✅ 日结/月结真库端到端全部通过')
  await cleanup()
  await sql`DELETE FROM hr_attendance_rule WHERE department_id = ${deptId}::uuid`
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e)
  await sql.end()
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
