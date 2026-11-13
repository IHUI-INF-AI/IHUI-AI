// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤导入真库端到端验证(临时脚本,验证后删除)。
 * 场景 A:首次导入(系统无记录)→ 匹配写入
 * 场景 B:系统已有记录 + 导入时间不同 → 差异必须人工裁决
 */
import postgres from 'postgres'
import {
  createImportBatch,
  getImportBatchDetail,
  resolveImportRow,
  confirmImportBatch,
  listImportBatches,
} from '../../../apps/api/src/services/hr-import.ts'

const dsn = process.env.DATABASE_URL
if (!dsn) throw new Error('DATABASE_URL 未设置')

function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
  console.log('  ✓ ' + msg)
}

const sql = postgres(dsn, { max: 1 })
const STORAGE1 = '33333333-3333-4333-8333-333333333301'
const STORAGE2 = '33333333-3333-4333-8333-333333333302'

async function cleanup() {
  await sql`DELETE FROM hr_import_batch WHERE file_name IN ('e2e-a.csv','e2e-b.csv')`
  await sql`DELETE FROM hr_attendance_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002'))
    AND date >= '2026-11-01' AND date < '2026-12-01'`
}

async function main() {
  await cleanup()

  // ---------- 场景 A:首次导入,系统无记录 ----------
  console.log('\n【场景 A】首次导入(系统无记录)')
  const csvA = `某某科技有限公司 2026年11月考勤表
导出时间:2026-11-12 10:00:00
工号,姓名,日期,上班打卡,下班打卡,考勤结果
E2E001,张三,2026-11-01,09:12,18:30,正常
E2E002,李四,2026-11-01,08:55,18:05,正常
UNKNOWN99,王五,2026-11-01,09:00,18:00,正常
E2E001,张三,2026-11-01,09:12,18:30,正常
`
  const a = await createImportBatch({
    periodMonth: '2026-11',
    fileName: 'e2e-a.csv',
    storageFileId: STORAGE1,
    buffer: Buffer.from(csvA, 'utf8'),
  })
  console.log('  批次状态:', a.batch.status, '| 总', a.batch.totalRows,
    '匹配', a.batch.matchedRows, '差异', a.batch.conflictRows, '未找到', a.batch.notFoundRows,
    '| 表头行', 2, '映射字段', new Set(Object.values(a.mapping)).size)
  assert(a.batch.status === 'pending_review', '批次进入待核对')
  assert(a.batch.totalRows === 4, '总行数 4(不含说明行)')
  assert(a.batch.matchedRows === 2, '匹配 2 行(系统无记录可直接写)')
  assert(a.batch.notFoundRows === 1, '未找到 1 行(UNKNOWN99 不在员工表)')

  const detailA = await getImportBatchDetail(a.batch.id)
  const dupA = detailA.rows.find((r) => r.matchStatus === 'duplicate')
  assert(!!dupA, '同批重复行识别为 duplicate 并排除')

  console.log('  → 确认写入')
  const ca = await confirmImportBatch({ batchId: a.batch.id })
  console.log('   ', ca)
  assert(ca.inserted === 2, '写入 2 条')
  assert(ca.skipped === 2, '跳过 2 条(not_found + duplicate)')

  const recA = await sql`
    SELECT e.employee_no, r.date::text AS date, r.status, r.check_in_method,
           to_char(r.check_in_time AT TIME ZONE 'Asia/Shanghai','HH24:MI') AS cin
    FROM hr_attendance_record r JOIN hr_employee e ON e.id=r.employee_id
    WHERE e.employee_no IN ('E2E001','E2E002') AND r.date>='2026-11-01' AND r.date<'2026-12-01'
      AND r.deleted_at IS NULL ORDER BY e.employee_no`
  console.log('  落库:', recA.map((r) => `${r.employee_no}/${r.date}/${r.cin}/${r.status}/${r.check_in_method}`).join(' '))
  assert(recA.length === 2, '正式表 2 条')
  assert(recA[0].check_in_method === 'import', '打卡方式 = import')

  // ---------- 场景 B:系统已有记录,导入时间不同 → 差异 ----------
  console.log('\n【场景 B】系统已有记录 + 导入时间不同 → 差异必须裁决')
  const csvB = `工号,姓名,日期,上班打卡,下班打卡,考勤结果
E2E001,张三,2026-11-01,10:30,19:00,迟到
`
  const b = await createImportBatch({
    periodMonth: '2026-11',
    fileName: 'e2e-b.csv',
    storageFileId: STORAGE2,
    buffer: Buffer.from(csvB, 'utf8'),
  })
  console.log('  批次:', b.batch.status, '| 匹配', b.batch.matchedRows, '差异', b.batch.conflictRows)
  assert(b.batch.conflictRows === 1, '检测出 1 条差异(系统 09:12 vs 导入 10:30)')
  assert(b.batch.matchedRows === 0, '无自动匹配(差异不算匹配)')

  const detailB = await getImportBatchDetail(b.batch.id)
  const conflict = detailB.rows.find((r) => r.matchStatus === 'conflict')
  assert(!!conflict, '差异行已落暂存')
  const diffs = conflict.diffDetail
  console.log('  差异明细:', JSON.stringify(diffs))
  assert(Array.isArray(diffs) && diffs.length >= 1, '差异明细记录了字段级对比')

  console.log('  → 未裁决时确认应被拒绝')
  let blocked = false
  try {
    await confirmImportBatch({ batchId: b.batch.id })
  } catch (e) {
    blocked = e.errorCode === 'IMPORT_HAS_UNRESOLVED_CONFLICTS'
    console.log('   ', e.message)
  }
  assert(blocked, '未裁决差异 → 拒绝确认(绝不自动覆盖)')

  console.log('  → 系统记录未被改动(验证"绝不自动覆盖")')
  const beforeResolve = await sql`
    SELECT to_char(r.check_in_time AT TIME ZONE 'Asia/Shanghai','HH24:MI') AS cin
    FROM hr_attendance_record r JOIN hr_employee e ON e.id=r.employee_id
    WHERE e.employee_no='E2E001' AND r.date='2026-11-01' AND r.deleted_at IS NULL`
  assert(beforeResolve[0].cin === '09:12', '裁决前系统记录仍是 09:12')

  console.log('  → 裁决 keep_system(保留系统值)')
  await resolveImportRow({ rowId: conflict.id, resolution: 'keep_system' })
  const cb = await confirmImportBatch({ batchId: b.batch.id })
  console.log('   ', cb)
  assert(cb.updated === 0, 'keep_system 时不更新系统记录')
  const afterKeep = await sql`
    SELECT to_char(r.check_in_time AT TIME ZONE 'Asia/Shanghai','HH24:MI') AS cin
    FROM hr_attendance_record r JOIN hr_employee e ON e.id=r.employee_id
    WHERE e.employee_no='E2E001' AND r.date='2026-11-01' AND r.deleted_at IS NULL`
  assert(afterKeep[0].cin === '09:12', 'keep_system 后系统值仍是 09:12')

  // ---------- 场景 C:裁决 adopt_import → 覆盖 ----------
  console.log('\n【场景 C】差异裁决 adopt_import → 采用导入值')
  // 与场景 B 内容必须不同(否则被 SHA-256 幂等闸拦下,那是正确行为)
  const csvC = `工号,姓名,日期,上班打卡,下班打卡,考勤结果,备注
E2E001,张三,2026-11-01,10:30,19:00,迟到,第二次导入
`
  await sql`DELETE FROM hr_import_batch WHERE file_name='e2e-c.csv'`
  const c = await createImportBatch({
    periodMonth: '2026-11',
    fileName: 'e2e-c.csv',
    storageFileId: '33333333-3333-4333-8333-333333333303',
    buffer: Buffer.from(csvC, 'utf8'),
  })
  const detailC = await getImportBatchDetail(c.batch.id)
  const confC = detailC.rows.find((r) => r.matchStatus === 'conflict')
  assert(!!confC, '再次检测出差异')
  await resolveImportRow({ rowId: confC.id, resolution: 'adopt_import' })
  const cc = await confirmImportBatch({ batchId: c.batch.id })
  console.log('   ', cc)
  assert(cc.updated === 1, 'adopt_import 更新 1 条')
  const afterAdopt = await sql`
    SELECT to_char(r.check_in_time AT TIME ZONE 'Asia/Shanghai','HH24:MI') AS cin, r.status
    FROM hr_attendance_record r JOIN hr_employee e ON e.id=r.employee_id
    WHERE e.employee_no='E2E001' AND r.date='2026-11-01' AND r.deleted_at IS NULL`
  console.log('  覆盖后:', afterAdopt[0].cin, afterAdopt[0].status)
  assert(afterAdopt[0].cin === '10:30', '采用导入值后系统记录变为 10:30')

  // ---------- 场景 D:重复文件 + 重复确认拦截 ----------
  console.log('\n【场景 D】幂等与重复保护')
  let dupBlocked = false
  try {
    await createImportBatch({
      periodMonth: '2026-11',
      fileName: 'e2e-a.csv',
      storageFileId: '33333333-3333-4333-8333-333333333309',
      buffer: Buffer.from(csvA, 'utf8'),
    })
  } catch (e) {
    dupBlocked = e.errorCode === 'IMPORT_DUPLICATE_FILE'
  }
  assert(dupBlocked, '同文件同月重复上传被拒绝')

  let reBlocked = false
  try {
    await confirmImportBatch({ batchId: c.batch.id })
  } catch (e) {
    reBlocked = e.errorCode === 'IMPORT_BATCH_ALREADY_VERIFIED'
  }
  assert(reBlocked, '已确认批次不可重复确认')

  const batches = await listImportBatches({ periodMonth: '2026-11' })
  const verified = batches.filter((x) => ['e2e-a.csv', 'e2e-b.csv', 'e2e-c.csv'].includes(x.fileName))
  console.log('  批次状态:', verified.map((x) => `${x.fileName}=${x.status}`).join(' '))
  assert(verified.every((x) => x.status === 'verified'), '三个批次均为 verified')

  console.log('\n✅ 真库端到端全部通过(4 场景)')
  await cleanup()
  await sql.end()
}

main().catch(async (e) => {
  console.error('\n❌ FAILED:', e)
  await sql.end()
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
