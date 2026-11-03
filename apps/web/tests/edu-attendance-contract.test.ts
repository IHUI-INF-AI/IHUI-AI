// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 教育考勤 Web 四件能力的契约测试:端点/入参形态 + 统计区真图表 + 五语言新增键集等值。
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..', '..', '..')
const WEB_MSGS = ['zh-CN', 'zh-TW', 'ja', 'ko', 'en'] as const

const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')

const teacherFile = 'apps/web/app/(main)/edu/edu-management/attendance/PageClient.tsx'
const trendChartFile = 'apps/web/app/(main)/edu/edu-management/attendance/AttendanceTrendChart.tsx'
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

/** 统计趋势票在 eduAttendance 命名空间新增的键(五语言必须同批等值) */
const NEW_TREND_KEYS = [
  'trendChartTitle',
  'trendChartScope',
  'trendChartHint',
  'trendCountAxisLabel',
  'trendChartAria',
  'statusOther',
  'scopeAllClasses',
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

  it('统计区挂的是真图表(recharts 折线 + 同图堆叠柱),不是 CSS 进度条冒充趋势', () => {
    const page = read(teacherFile)
    const chart = read(trendChartFile)
    // 页面侧接线:import + JSX 都在
    expect(page).toContain("from './AttendanceTrendChart'")
    expect(page).toContain('<AttendanceTrendChart')
    // 组件侧必须是真图表库,且两轴同图:堆叠柱(stackId)+ 出勤率折线(dataKey)
    expect(chart).toContain("from 'recharts'")
    expect(chart).toContain('ComposedChart')
    expect(chart).toContain('ResponsiveContainer')
    expect(chart).toContain('stackId="status"')
    expect(chart).toMatch(/<Line[\s\S]*dataKey="attendanceRate"/)
    expect(chart).toMatch(/<Bar[\s\S]*dataKey=\{key\}/)
    // 五枚状态段 + other 段都在色表里(缺一段就有一类人画不出来)
    for (const code of ['present', 'late', 'early', 'absent', 'leave', 'other']) {
      expect(chart, `segment ${code}`).toContain(code)
    }
  })

  it('趋势取数复用页面既有 stats 请求:组件不得自带第二套请求层,后端一行不动', () => {
    const page = read(teacherFile)
    const chart = read(trendChartFile)
    // 组件零 IO:不发请求、不接 react-query
    expect(chart).not.toContain('apiOrThrow')
    expect(chart).not.toContain('useQuery')
    expect(chart).not.toContain('fetch(')
    // 班级 + 起止日期 + 粒度三要素都进同一次 stats 请求(记录清单接口只收单日 date)
    expect(page).toMatch(/attendance-stats[\s\S]*?selectedClassId/)
    expect(page).toContain("params.set('classId', selectedClassId)")
    expect(page).toContain('startDate: statsStartDate')
    expect(page).toContain('endDate: statsEndDate')
    expect(page).toContain('/api/edu-ai-management/attendance/stats?${params}')
    // 图与周期表同一个聚合出口 ⇒ 两处读数不可能各说一套
    expect(page).toContain('stats?.periodBreakdown ?? []')
    expect(page).toContain('breakdown={periodRows}')
    expect(page).toContain('buildAttendanceTrendSeries(periodRows)')
    // 禁止为出图去动后端(本票约束:聚合在客户端;清单接口只认单日 date,同行不得出现区间参数)
    expect(page).not.toMatch(/\/attendance\?[^\n]*(?:startDate|endDate)/)
  })

  it('趋势组件守本仓 UI 硬规矩:色取 token、无 hex、无原生 title、无分割线、无任意值圆角', () => {
    const chart = read(trendChartFile)
    expect(chart).toContain('CHART_GREEN')
    expect(chart).toContain("from '@ihui/design-tokens'")
    expect(chart).not.toMatch(/#[0-9a-fA-F]{3,8}\b/) // 色值不得写死在组件里
    expect(chart).not.toMatch(/\btitle=/) // 禁原生提示窗
    expect(chart).toContain('aria-label=') // 无障碍描述走 aria-label
    expect(chart).not.toContain('<hr')
    expect(chart).not.toMatch(/\bdivide-/u)
    expect(chart).not.toMatch(/\bborder-(?:t|b|l|r)-/u) // 单边边框当分割线
    expect(chart).not.toMatch(/rounded-\[/u) // 圆角只许档位类
    expect(chart).not.toMatch(/\b(?:alert|confirm|prompt)\s*\(/u)
    // 取词在页面侧:组件不得自己接 i18n hook,文案只能来自 props
    expect(chart).not.toMatch(/useTranslations\s*\(/u)
    // 折线色必须是 design-tokens 的图表档:var(--primary) 在 tokens.css 里根本不存在
    // (真名 --color-primary 且是纯墨档),写它 = 折线静默渲染成"无线"(2026-11-03 真浏览器实测)
    expect(chart).not.toMatch(/stroke="var\(--primary\)"/u)
    expect(chart).toMatch(/stroke=\{CHART_[A-Z]+\}/u)
  })

  it('五语言 eduAttendance 趋势键齐备、非空、{scope} 插值位不丢、语族不串', () => {
    const cjk = /[぀-ゟ가-힯一-鿿]/u // 假名 | 谚文 | 汉字
    const kanaOrHangul = /[぀-ゟ가-힯]/u
    for (const loc of WEB_MSGS) {
      const msgs = JSON.parse(read(`packages/i18n/messages/web/${loc}.json`)) as Record<
        string,
        Record<string, string>
      >
      for (const key of NEW_TREND_KEYS) {
        expect(msgs.eduAttendance?.[key], `${loc}.${key}`).toBeTruthy()
      }
      // ICU 单花括号插值,禁止 {{n}} 形态回潮(AGENTS §19)
      expect(msgs.eduAttendance!.trendChartScope, `${loc}.trendChartScope`).toContain('{scope}')
      expect(msgs.eduAttendance!.trendChartAria, `${loc}.trendChartAria`).toContain('{scope}')
      for (const key of NEW_TREND_KEYS) {
        expect(msgs.eduAttendance![key], `${loc}.${key}`).not.toContain('{{')
      }
      // 语种纯度(新键自查,与 scan-i18n-zh-residue / 门 133 同向不重复判存量)
      const joined = NEW_TREND_KEYS.map((key) => msgs.eduAttendance![key]).join(' ')
      if (loc === 'en') expect(joined, 'en 不得含中日韩字族').not.toMatch(cjk)
      if (loc === 'ko') expect(joined, 'ko 不得含假名/汉字').not.toMatch(/[぀-ゟ一-鿿]/u)
      if (loc === 'ja') expect(joined, 'ja 不得含谚文').not.toMatch(/[가-힯]/u)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
