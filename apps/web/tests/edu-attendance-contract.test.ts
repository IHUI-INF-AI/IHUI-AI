// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 教育考勤 Web 三件能力的契约测试:端点/入参形态 + 五语言新增键集等值。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..', '..')
const WEB_MSGS = ['zh-CN', 'zh-TW', 'ja', 'ko', 'en'] as const

const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

const teacherFile = 'apps/web/app/(main)/edu/edu-management/attendance/PageClient.tsx'
const batchFile = 'apps/web/app/(main)/edu/edu-management/attendance/BatchCheckInDialog.tsx'
const exportFile = 'apps/web/app/(main)/edu/edu-management/attendance/ExportButton.tsx'
const classSelectFile = 'apps/web/app/(main)/edu/edu-management/attendance/ClassSelect.tsx'
const studentFile = 'apps/web/app/(main)/edu/attendance/PageClient.tsx'

/** 本票在 eduAttendance 命名空间新增的键(五语言必须同批等值) */
const NEW_EDU_KEYS = [
  'classLabel',
  'selectClass',
  'batchCheckIn',
  'batchConfirm',
  'batchResultCreated',
  'batchResultSkipped',
  'batchResultMissed',
  'batchFailed',
  'exportCsv',
  'exportFailed',
  'studentPageTitle',
  'studentPageSubtitle',
  'selfCheckIn',
  'selfCheckInSuccess',
  'selfCheckInFailed',
  'notLoggedIn',
]

describe('edu attendance web contract', () => {
  it('批量点名走 POST /attendance/batch-check-in,班级取自下拉(无手输 UUID)', () => {
    const src = read(batchFile)
    expect(src).toContain("'/api/edu-ai-management/attendance/batch-check-in'")
    expect(src).toContain("method: 'POST'")
    expect(src).toContain('classId,')
    expect(src).toContain('date,')
    expect(src).toContain('status,')
    // 班级来源 = 共享下拉组件,不是输入框
    expect(src).toContain("from './ClassSelect'")
    expect(src).toContain('<ClassSelect')
    expect(src).not.toMatch(/classId.*trim/)
    // 响应契约形态
    expect(src).toContain('created: number')
    expect(src).toContain('skipped: number')
    expect(src).toContain('missedIds: string[]')
  })

  it('导出走 GET /attendance/export 且固定 format=csv、经 fetchRaw 下载、班级用下拉', () => {
    const src = read(exportFile)
    expect(src).toContain('/api/edu-ai-management/attendance/export?')
    expect(src).toContain("format: 'csv'")
    expect(src).toContain('classId,')
    expect(src).toContain('startDate')
    expect(src).toContain('endDate')
    expect(src).toContain('fetchRaw')
    expect(src).toContain('<ClassSelect')
    expect(src).not.toMatch(/classId.*trim/)
  })

  it('学生本人页取数走 GET /attendance/me(禁权限守卫端点),自签只发 date/remark', () => {
    const src = read(studentFile)
    expect(src).toContain('user?.id')
    expect(src).toContain('/api/edu-ai-management/attendance/me?date=${date}')
    // 旧写法带 edu:view/edu:manage 守卫,普通学生必 403 ⇒ 禁止回潮
    expect(src).not.toContain('/api/edu-ai-management/attendance?studentId=')
    expect(src).toContain("'/api/edu-ai-management/attendance/self-check-in'")
    expect(src).toContain("method: 'POST'")
    // 载荷只有 date/remark:不接受 studentId、不接受 classId
    expect(src).toContain('JSON.stringify({ date, remark: remark.trim() || undefined })')
    expect(src).not.toMatch(/JSON\.stringify\(\{[^}]*studentId/)
    expect(src).not.toMatch(/JSON\.stringify\(\{[^}]*classId/)
    expect(src).not.toMatch(/classId.*trim/)
    // 后端可读 message 必须显示(409/403/401 不静默)
    expect(src).toContain('serverMessage')
  })

  it('教师侧班级一律经 GET /api/edu-ai-management/class 下拉选择(全目录零手输 UUID)', () => {
    const src = read(classSelectFile)
    expect(src).toContain('/api/edu-ai-management/class?page=')
    expect(src).toContain('SelectTrigger')
    const all = [teacherFile, batchFile, exportFile].map(read).join('\n')
    expect(all).not.toMatch(/classId.*trim|placeholder.*UUID/)
    expect(read(teacherFile)).toContain('<ClassSelect')
  })

  it('教师端已接线批量点名与导出两枚子组件', () => {
    const src = read(teacherFile)
    expect(src).toContain("from './BatchCheckInDialog'")
    expect(src).toContain("from './ExportButton'")
    expect(src).toContain('<BatchCheckInDialog')
    expect(src).toContain('<ExportButton')
  })

  it('五语言 eduAttendance 新增键集等值且非空', () => {
    for (const loc of WEB_MSGS) {
      const msgs = JSON.parse(read(`packages/i18n/messages/web/${loc}.json`)) as Record<
        string,
        Record<string, string>
      >
      for (const key of NEW_EDU_KEYS) {
        expect(msgs.eduAttendance?.[key], `${loc}.${key}`).toBeTruthy()
      }
      expect(msgs.nav?.eduMyAttendance, `nav.eduMyAttendance@${loc}`).toBeTruthy()
    }
  })

  it('侧栏学生入口存在且不带 permission/adminOnly/advancedOnly(全员可见)', () => {
    const src = read('apps/web/src/components/sidebar/nav-data.ts')
    const line = src.split('\n').find((l) => l.includes("href: '/edu/attendance'"))
    expect(line).toBeDefined()
    expect(line).toContain("labelKey: 'eduMyAttendance'")
    expect(line).not.toMatch(/permission|adminOnly|advancedOnly/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
