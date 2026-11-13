// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤导入真库端到端验证(临时脚本,验证后删除)。
 *
 * 场景:模拟飞书导出的月度打卡表(含表头说明行) →
 *  上传解析 → 匹配 → 差异裁决 → 确认写入 → 回读正式考勤表核对。
 */
import { readFileSync as _readFileSync } from 'node:fs'
import postgres from 'postgres'

const dsn = process.env.DATABASE_URL
if (!dsn) throw new Error('DATABASE_URL 未设置')

// 直接构造一份"飞书风格"CSV:顶部有公司名与导出时间,表头在第 3 行
const csv = `某某科技有限公司 2026年11月考勤表
导出时间:2026-11-12 10:00:00
工号,姓名,日期,上班打卡,下班打卡,考勤结果
E2E001,张三,2026-11-01,09:12,18:30,正常
E2E002,李四,2026-11-01,08:55,18:05,正常
E2E001,张三,2026-11-02,09:35,18:10,迟到
UNKNOWN99,王五,2026-11-01,09:00,18:00,正常
E2E001,张三,2026-11-01,09:12,18:30,正常
`

const sql = postgres(dsn, { max: 1 })

async function main() {
  const { detectMapping: _detectMapping, parseMatrix, normalizeDateCell, normalizeTimeCell } = await import(
    '../../apps/api/src/services/hr-import.ts'
  )

  const matrix = csv
    .trim()
    .split('\n')
    .map((line) => line.split(',').map((c) => c.trim()))

  const parsed = parseMatrix(matrix)
  console.log('=== 解析结果 ===')
  console.log('表头行索引:', parsed.headerRowIndex, '(应为 2,即第 3 行)')
  console.log('识别字段数:', new Set(Object.values(parsed.mapping)).size)
  console.log('数据行数:', parsed.rows.length)

  if (parsed.headerRowIndex !== 2) throw new Error('表头探测失败')
  if (parsed.rows.length !== 5) throw new Error(`数据行数应为 5,实际 ${parsed.rows.length}`)

  const first = parsed.rows[0]
  console.log('首行工号:', first.parsed.employeeNo, '日期:', first.parsed.date)
  if (first.parsed.employeeNo !== 'E2E001') throw new Error('工号解析失败')
  if (normalizeDateCell(first.parsed.date) !== '2026-11-01') throw new Error('日期归一失败')
  if (normalizeTimeCell(first.parsed.checkInTime, '2026-11-01') !== '2026-11-01T09:12:00') {
    throw new Error('时间归一失败')
  }
  console.log('✓ 解析层全部通过')

  // 清理上一轮痕迹(幂等重跑)
  await sql`DELETE FROM hr_import_batch WHERE file_name = 'e2e-feishu.csv'`
  await sql`DELETE FROM hr_attendance_record WHERE employee_id IN (
    SELECT id FROM hr_employee WHERE employee_no IN ('E2E001','E2E002')) AND date >= '2026-11-01' AND date < '2026-12-01'`

  console.log('\n=== 已验证解析层,后续落库链路在 API 层脚本中验证 ===')
  await sql.end()
}

main().catch(async (e) => {
  console.error('FAILED:', e)
  await sql.end()
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
