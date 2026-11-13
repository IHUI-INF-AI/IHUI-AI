// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

/**
 * 请假/加班导入真库端到端验证(临时脚本)。
 */
import postgres from 'postgres'
import {
  createAnyImportBatch,
  confirmAnyImportBatch,
} from '../../../apps/api/src/services/hr-import-entry.ts'
import { getImportBatchDetail, resolveImportRow } from '../../../apps/api/src/services/hr-import.ts'

const dsn = process.env.DATABASE_URL
if (!dsn) throw new Error('DATABASE_URL 未设置')
const sql = postgres(dsn, { max: 1 })

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

async function cleanup() {
  await sql`DELETE FROM hr_import_batch WHERE file_name LIKE 'e2e-lv%' OR file_name LIKE 'e2e-ot%'`
  await sql`DELETE FROM hr_leave_request WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))
    AND start_date >= '2026-11-01' AND start_date < '2026-12-01'`
  await sql`DELETE FROM hr_overtime_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_leave_balance WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_attendance_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))
    AND date >= '2026-11-01' AND date < '2026-12-01'`
}

async function main() {
  await cleanup()

  // ============ 请假导入 ============
  console.log('\n【请假】飞书风格请假表')
  const leaveCsv = `某某公司 2026年11月请假明细
导出时间:2026-11-12
工号,姓名,假别,开始日期,结束日期,请假天数,请假事由,审批状态,审批单号
E2E001,张三,年假,2026-11-10,2026-11-11,2,家中有事,已通过,LV-001
E2E002,李四,病假,2026-11-12,2026-11-12,1,感冒就医,已通过,LV-002
UNKNOWN88,王五,事假,2026-11-15,2026-11-15,1,私事,已通过,LV-003
E2E001,张三,年假,2026-11-10,2026-11-11,2,重复行,已通过,LV-001
`
  const lv = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'leave',
    fileName: 'e2e-lv.csv',
    storageFileId: '44444444-4444-4444-8444-444444444401',
    buffer: Buffer.from(leaveCsv, 'utf8'),
  })
  console.log('  批次:', lv.batch.status, '| 总', lv.batch.totalRows, '匹配', lv.batch.matchedRows,
    '差异', lv.batch.conflictRows, '未找到', lv.batch.notFoundRows)
  assert(lv.batch.importKind === 'leave', '批次类型 = leave')
  assert(lv.batch.totalRows === 4, '总行 4')
  assert(lv.batch.matchedRows === 2, '匹配 2(系统无此请假)')
  assert(lv.batch.notFoundRows === 1, '未找到 1(UNKNOWN88)')

  const lvDetail = await getImportBatchDetail(lv.batch.id)
  assert(!!lvDetail.rows.find((r) => r.matchStatus === 'duplicate'), '同批重复行识别为 duplicate')

  console.log('  → 确认写入')
  const lvConfirm = await confirmAnyImportBatch({ batchId: lv.batch.id })
  console.log('   ', JSON.stringify(lvConfirm))
  assert(lvConfirm.inserted === 2, '写入 2 条请假')

  const leaves = await sql`
    SELECT employee_id, leave_type, start_date::text, end_date::text, total_days, status
    FROM hr_leave_request WHERE employee_id IN (SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))
      AND deleted_at IS NULL ORDER BY start_date`
  console.log('  落库:', leaves.map((l) => `${l.leave_type}/${l.start_date}~${l.end_date}/${l.total_days}天/${l.status}`).join(' '))
  assert(leaves.length === 2, 'hr_leave_request 2 条')
  assert(leaves[0].leave_type === 'annual', '年假映射正确')
  assert(leaves[0].total_days === 2, '天数 = 2')
  assert(leaves[0].status === 'approved', '状态 = approved(导入视为已批)')
  assert(leaves[1].leave_type === 'sick', '病假映射正确')

  console.log('  → 额度账联动')
  const bal = await sql`
    SELECT leave_type, year, total_days, used_days, remaining_days FROM hr_leave_balance
    WHERE employee_id IN (SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))
    ORDER BY leave_type`
  console.log('  额度:', bal.map((b) => `${b.leave_type}/y${b.year}/用${b.used_days}/剩${b.remaining_days}`).join(' '))
  assert(bal.length === 2, '额度账 2 条(年假+病假)')
  const annual = bal.find((b) => b.leave_type === 'annual')
  assert(annual.used_days === 2, '年假已用 2 天')
  assert(annual.remaining_days === -2, '未设总额 → 剩余 -2(明确暴露"未设额度")')

  console.log('  → 请假区间考勤记录标 leave')
  // 先造一条 11-10 的缺勤记录,验证会被改成 leave
  await sql`INSERT INTO hr_attendance_record (employee_id, department_id, date, status, check_in_method)
    SELECT e.id, e.department_id, '2026-11-10', 'absent', 'manual' FROM hr_employee e WHERE e.employee_no='E2E001'
    ON CONFLICT DO NOTHING`
  // 重新导入一次同类请假触发区间更新(已有记录 → matched 幂等,confirm 会再执行区间更新)
  const lv2 = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'leave',
    fileName: 'e2e-lv2.csv',
    storageFileId: '44444444-4444-4444-8444-444444444402',
    buffer: Buffer.from(`工号,姓名,假别,开始日期,结束日期,请假天数,请假事由,审批状态
E2E001,张三,年假,2026-11-10,2026-11-11,2,家中有事,已通过
`, 'utf8'),
  })
  const lv2Confirm = await confirmAnyImportBatch({ batchId: lv2.batch.id })
  console.log('   第二次:', JSON.stringify(lv2Confirm))
  const marked = await sql`
    SELECT r.date::text AS date, r.status FROM hr_attendance_record r JOIN hr_employee e ON e.id=r.employee_id
    WHERE e.employee_no='E2E001' AND r.date='2026-11-10' AND r.deleted_at IS NULL`
  assert(marked[0]?.status === 'leave', 'approved 请假区间内考勤记录已标为 leave')

  // ============ 请假差异裁决 ============
  console.log('\n【请假差异】系统已有不同天数 → 必须裁决')
  const lv3 = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'leave',
    fileName: 'e2e-lv3.csv',
    storageFileId: '44444444-4444-4444-8444-444444444403',
    buffer: Buffer.from(`工号,姓名,假别,开始日期,结束日期,请假天数,请假事由
E2E001,张三,年假,2026-11-10,2026-11-11,3,天数不同
`, 'utf8'),
  })
  console.log('  差异数:', lv3.batch.conflictRows)
  assert(lv3.batch.conflictRows === 1, '天数 2 vs 3 → 检测出差异')
  let blocked = false
  try {
    await confirmAnyImportBatch({ batchId: lv3.batch.id })
  } catch (e) {
    blocked = e.errorCode === 'IMPORT_HAS_UNRESOLVED_CONFLICTS'
  }
  assert(blocked, '未裁决差异 → 拒绝确认')

  const lv3Detail = await getImportBatchDetail(lv3.batch.id)
  const conf = lv3Detail.rows.find((r) => r.matchStatus === 'conflict')
  console.log('  差异明细:', JSON.stringify(conf.diffDetail))
  await resolveImportRow({ rowId: conf.id, resolution: 'keep_system' })
  const lv3c = await confirmAnyImportBatch({ batchId: lv3.batch.id })
  console.log('  keep_system 后:', JSON.stringify(lv3c))
  const afterKeep = await sql`
    SELECT total_days FROM hr_leave_request r JOIN hr_employee e ON e.id=r.employee_id
    WHERE e.employee_no='E2E001' AND r.start_date='2026-11-10' AND r.deleted_at IS NULL`
  assert(afterKeep[0].total_days === 2, 'keep_system → 系统天数仍为 2')

  // ============ 加班导入 ============
  console.log('\n【加班】飞书风格加班表')
  const otCsv = `工号,姓名,加班日期,加班时长,加班类型,加班事由,审批单号
E2E001,张三,2026-11-08,3小时,休息日,版本上线,OT-001
E2E002,李四,2026-11-09,90分钟,工作日,客户支持,OT-002
UNKNOWN77,王五,2026-11-08,2,工作日,未知人员,OT-003
`
  const ot = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'overtime',
    fileName: 'e2e-ot.csv',
    storageFileId: '55555555-5555-4555-8555-555555555501',
    buffer: Buffer.from(otCsv, 'utf8'),
  })
  console.log('  批次:', ot.batch.status, '| 总', ot.batch.totalRows, '匹配', ot.batch.matchedRows,
    '差异', ot.batch.conflictRows, '未找到', ot.batch.notFoundRows)
  assert(ot.batch.importKind === 'overtime', '批次类型 = overtime')
  assert(ot.batch.matchedRows === 2, '匹配 2')
  assert(ot.batch.notFoundRows === 1, '未找到 1')

  const otConfirm = await confirmAnyImportBatch({ batchId: ot.batch.id })
  console.log('   ', JSON.stringify(otConfirm))
  assert(otConfirm.inserted === 2, '写入 2 条加班')

  const ots = await sql`
    SELECT ot.date::text, ot.minutes, ot.overtime_type, ot.status, ot.source, ot.external_id
    FROM hr_overtime_record ot JOIN hr_employee e ON e.id=ot.employee_id
    WHERE e.employee_no IN ('E2E001','E2E002') AND ot.deleted_at IS NULL ORDER BY ot.date`
  console.log('  落库:', ots.map((o) => `${o.date}/${o.minutes}min/${o.overtime_type}/${o.source}`).join(' '))
  assert(ots.length === 2, '加班表 2 条')
  assert(ots[0].minutes === 180, '3小时 → 180 分钟')
  assert(ots[0].overtime_type === 'weekend', '休息日 → weekend')
  assert(ots[0].source === 'import', '来源 = import')
  assert(ots[1].minutes === 90, '90分钟 → 90')
  assert(ots[1].overtime_type === 'workday', '工作日 → workday')

  // ============ 加班差异 ============
  console.log('\n【加班差异】系统已有 180 分钟,导入 4 小时')
  const ot2 = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'overtime',
    fileName: 'e2e-ot2.csv',
    storageFileId: '55555555-5555-4555-8555-555555555502',
    buffer: Buffer.from(`工号,姓名,加班日期,加班时长,加班类型
E2E001,张三,2026-11-08,4小时,休息日
`, 'utf8'),
  })
  assert(ot2.batch.conflictRows === 1, '180 vs 240 → 检测出差异')
  const ot2Detail = await getImportBatchDetail(ot2.batch.id)
  const otConf = ot2Detail.rows.find((r) => r.matchStatus === 'conflict')
  console.log('  差异明细:', JSON.stringify(otConf.diffDetail))
  await resolveImportRow({ rowId: otConf.id, resolution: 'adopt_import' })
  const ot2c = await confirmAnyImportBatch({ batchId: ot2.batch.id })
  console.log('  adopt_import 后:', JSON.stringify(ot2c))
  const otAfter = await sql`
    SELECT minutes FROM hr_overtime_record ot JOIN hr_employee e ON e.id=ot.employee_id
    WHERE e.employee_no='E2E001' AND ot.date='2026-11-08' AND ot.deleted_at IS NULL`
  assert(otAfter[0].minutes === 240, 'adopt_import → 240 分钟')

  // ============ 类型隔离 ============
  console.log('\n【类型隔离】同一份文件以不同类型导入')
  const shared = Buffer.from(`工号,姓名,加班日期,加班时长\nE2E001,张三,2026-11-20,2小时\n`, 'utf8')
  const t1 = await createAnyImportBatch({
    periodMonth: '2026-11', importKind: 'overtime', fileName: 'e2e-ot3.csv',
    storageFileId: '55555555-5555-4555-8555-555555555503', buffer: shared,
  })
  let dupBlocked = false
  try {
    await createAnyImportBatch({
      periodMonth: '2026-11', importKind: 'overtime', fileName: 'e2e-ot3.csv',
      storageFileId: '55555555-5555-4555-8555-555555555504', buffer: shared,
    })
  } catch (e) {
    dupBlocked = e.errorCode === 'IMPORT_DUPLICATE_FILE'
  }
  assert(dupBlocked, '同类型同文件重复导入被拒绝')
  console.log('  批次类型:', t1.batch.importKind)

  console.log('\n✅ 请假/加班导入真库端到端全部通过')
  await cleanup()
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e)
  await sql.end()
  process.exit(1)
})
