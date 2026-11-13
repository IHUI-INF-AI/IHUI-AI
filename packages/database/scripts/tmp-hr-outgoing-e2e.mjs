// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** 外出导入真库端到端验证(临时脚本)。 */
import postgres from 'postgres'
import { createAnyImportBatch, confirmAnyImportBatch } from '../../../apps/api/src/services/hr-import-entry.ts'
import { getImportBatchDetail, resolveImportRow } from '../../../apps/api/src/services/hr-import.ts'

const dsn = process.env.DATABASE_URL
if (!dsn) throw new Error('DATABASE_URL 未设置')
const sql = postgres(dsn, { max: 1 })

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

async function cleanup() {
  await sql`DELETE FROM hr_import_batch WHERE file_name LIKE 'e2e-out%'`
  await sql`DELETE FROM hr_outgoing_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))`
  await sql`DELETE FROM hr_attendance_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))
    AND date >= '2026-11-01' AND date < '2026-12-01'`
}

async function main() {
  await cleanup()

  // 预置一条缺勤,验证会被 approved 外出修正为 present
  await sql`INSERT INTO hr_attendance_record (employee_id, department_id, date, status, check_in_method)
    SELECT e.id, e.department_id, '2026-11-15', 'absent', 'manual'
    FROM hr_employee e WHERE e.employee_no='E2E001' ON CONFLICT DO NOTHING`

  console.log('\n【外出】飞书风格外出表')
  const csv = `某某公司 2026年11月外出明细
导出时间:2026-11-12
工号,姓名,开始日期,结束日期,开始时间,结束时间,外出地点,外出事由,审批状态,审批单号
E2E001,张三,2026-11-15,2026-11-15,09:00,12:00,客户现场A,上门实施,已通过,OUT-001
E2E002,李四,2026-11-16,2026-11-17,,,外地分公司,驻场支持,已通过,OUT-002
UNKNOWN66,王五,2026-11-15,2026-11-15,10:00,11:00,某地,未知人员,已通过,OUT-003
E2E001,张三,2026-11-15,2026-11-15,09:00,12:00,客户现场A,重复行,已通过,OUT-001
`
  const out = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'outgoing',
    fileName: 'e2e-out.csv',
    storageFileId: '66666666-6666-4666-8666-666666666601',
    buffer: Buffer.from(csv, 'utf8'),
  })
  console.log('  批次:', out.batch.status, '| 总', out.batch.totalRows, '匹配', out.batch.matchedRows,
    '差异', out.batch.conflictRows, '未找到', out.batch.notFoundRows)
  assert(out.batch.importKind === 'outgoing', '批次类型 = outgoing')
  assert(out.batch.totalRows === 4, '总行 4')
  assert(out.batch.matchedRows === 2, '匹配 2')
  assert(out.batch.notFoundRows === 1, '未找到 1')

  const detail = await getImportBatchDetail(out.batch.id)
  assert(!!detail.rows.find((r) => r.matchStatus === 'duplicate'), '同批重复行识别为 duplicate')

  console.log('  → 确认写入')
  const conf = await confirmAnyImportBatch({ batchId: out.batch.id })
  console.log('   ', JSON.stringify(conf))
  assert(conf.inserted === 2, '写入 2 条外出')

  const recs = await sql`
    SELECT o.start_date::text, o.end_date::text, o.start_time::text, o.end_time::text,
           o.minutes, o.destination, o.status, o.source, o.external_id
    FROM hr_outgoing_record o JOIN hr_employee e ON e.id=o.employee_id
    WHERE e.employee_no IN ('E2E001','E2E002') AND o.deleted_at IS NULL ORDER BY o.start_date`
  for (const r of recs) {
    console.log('   ', r.start_date, '~', r.end_date, r.start_time ?? '-', r.end_time ?? '-',
      r.minutes + 'min', r.destination, r.status, r.source)
  }
  assert(recs.length === 2, '外出表 2 条')
  assert(recs[0].minutes === 180, '09:00~12:00 = 180 分钟')
  assert(recs[0].start_time === '09:00:00', '开始时刻正确')
  assert(recs[0].status === 'approved', '状态 approved')
  assert(recs[0].source === 'import', '来源 import')
  assert(recs[0].external_id === 'OUT-001', '外部单号保留')
  assert(recs[1].minutes === 960, '无时刻两天 → 2×480 = 960 分钟')

  console.log('  → 外出把缺勤修正为出勤')
  const fixed = await sql`
    SELECT r.date::text, r.status FROM hr_attendance_record r JOIN hr_employee e ON e.id=r.employee_id
    WHERE e.employee_no='E2E001' AND r.date='2026-11-15' AND r.deleted_at IS NULL`
  assert(fixed[0]?.status === 'present', '2026-11-15 缺勤已修正为 present')
  assert(conf.attendanceFixed === 1, '报告修正 1 条考勤记录')

  // ============ 差异裁决 ============
  console.log('\n【外出差异】系统已有 180 分钟,导入 240 分钟')
  const out2 = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'outgoing',
    fileName: 'e2e-out2.csv',
    storageFileId: '66666666-6666-4666-8666-666666666602',
    buffer: Buffer.from(`工号,姓名,开始日期,结束日期,开始时间,结束时间,外出地点,外出事由
E2E001,张三,2026-11-15,2026-11-15,09:00,13:00,客户现场A,时长不同
`, 'utf8'),
  })
  console.log('  差异数:', out2.batch.conflictRows)
  assert(out2.batch.conflictRows === 1, '180 vs 240 → 检测出差异')
  let blocked = false
  try {
    await confirmAnyImportBatch({ batchId: out2.batch.id })
  } catch (e) {
    blocked = e.errorCode === 'IMPORT_HAS_UNRESOLVED_CONFLICTS'
  }
  assert(blocked, '未裁决差异 → 拒绝确认')

  const d2 = await getImportBatchDetail(out2.batch.id)
  const c2 = d2.rows.find((r) => r.matchStatus === 'conflict')
  console.log('  差异明细:', JSON.stringify(c2.diffDetail))
  await resolveImportRow({ rowId: c2.id, resolution: 'adopt_import' })
  const c2r = await confirmAnyImportBatch({ batchId: out2.batch.id })
  console.log('   adopt_import:', JSON.stringify(c2r))
  const after = await sql`
    SELECT minutes FROM hr_outgoing_record o JOIN hr_employee e ON e.id=o.employee_id
    WHERE e.employee_no='E2E001' AND o.start_date='2026-11-15' AND o.deleted_at IS NULL`
  assert(after[0].minutes === 240, 'adopt_import → 240 分钟')

  // ============ keep_system ============
  console.log('\n【外出 keep_system】保留系统值')
  const out3 = await createAnyImportBatch({
    periodMonth: '2026-11',
    importKind: 'outgoing',
    fileName: 'e2e-out3.csv',
    storageFileId: '66666666-6666-4666-8666-666666666603',
    buffer: Buffer.from(`工号,姓名,开始日期,结束日期,开始时间,结束时间,外出地点,外出事由
E2E001,张三,2026-11-15,2026-11-15,09:00,14:00,客户现场A,又一个不同
`, 'utf8'),
  })
  const d3 = await getImportBatchDetail(out3.batch.id)
  const c3 = d3.rows.find((r) => r.matchStatus === 'conflict')
  await resolveImportRow({ rowId: c3.id, resolution: 'keep_system' })
  const c3r = await confirmAnyImportBatch({ batchId: out3.batch.id })
  console.log('   keep_system:', JSON.stringify(c3r))
  const kept = await sql`
    SELECT minutes FROM hr_outgoing_record o JOIN hr_employee e ON e.id=o.employee_id
    WHERE e.employee_no='E2E001' AND o.start_date='2026-11-15' AND o.deleted_at IS NULL`
  assert(kept[0].minutes === 240, 'keep_system → 保持 240 分钟')

  console.log('\n✅ 外出导入真库端到端全部通过')
  await cleanup()
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e)
  await sql.end()
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
