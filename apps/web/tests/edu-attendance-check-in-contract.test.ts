// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教育考勤 web 端三格契约锁(ATT-WEB 票①②③,2026-11-04)
 *
 * ① 写接口不再自报状态:`.../check-in` 与 `.../batch-check-in` 的请求体结构上不含 status 键,
 *    UI 的「状态」下拉是**删除**而非隐藏;回填非当日必须给该日内时刻,否则当场拒发并点名原因。
 * ② 早退(early)档:后端签退重判后它真会进列表,五档的取词键与色档逐档核对,不许落到默认档。
 * ③ 「全部状态」筛选:归一后 URL 不得出现 status=all(后端按枚举精确匹配,带上就恒空)。
 *
 * 纪律(AGENTS §22c):判据**不在本文件复算** —— 载荷/URL/回填/趋势聚合一律 import 源实现;
 * 文案**不抄字面量** —— 挂真 NextIntlClientProvider + 真词包(zh-CN.json),期望值从词包取。
 * 因白名单指定 `.ts` 后缀,渲染用 React.createElement(vitest esbuild 已配 jsx: automatic)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as React from 'react'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

const apiOrThrowMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api', () => ({ apiOrThrow: apiOrThrowMock }))

import {
  backfillBlocked,
  bizDay,
  buildAttendanceListUrl,
  buildBatchCheckInPayload,
  buildCheckInPayload,
  checkInMomentIso,
  DATE_RE,
  needsExplicitMoment,
} from '../app/(main)/edu/edu-management/attendance/check-in-contract'
import { BatchCheckInDialog } from '../app/(main)/edu/edu-management/attendance/BatchCheckInDialog'
import {
  ATTENDANCE_COLOR_MAP,
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_KEY_MAP,
  CheckInDialog,
} from '../app/(main)/edu/edu-management/attendance/PageClient'
import { buildAttendanceTrendSeries } from '../app/(main)/edu/edu-management/attendance/AttendanceTrendChart'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(here, '..', '..', '..')
const WEB_LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
/** 本票在 eduAttendance 命名空间新增的键(五语言必须同批等值) */
const NEW_BACKFILL_KEYS = ['checkInAt', 'backfillNeedsTime']

const DIR = 'apps/web/app/(main)/edu/edu-management/attendance'
const pageFile = `${DIR}/PageClient.tsx`
const batchFile = `${DIR}/BatchCheckInDialog.tsx`
const chartFile = `${DIR}/AttendanceTrendChart.tsx`
const exportFile = `${DIR}/ExportButton.tsx`

const loadLocale = (loc: string): Record<string, Record<string, string>> =>
  JSON.parse(
    readFileSync(join(ROOT, 'packages/i18n/messages/web', `${loc}.json`), 'utf8'),
  ) as Record<string, Record<string, string>>

const messagesZh = loadLocale('zh-CN')
const att = messagesZh.eduAttendance as Record<string, string>
/** 从真词包取词条(抄字面量就成了"测试替身自证") */
const w = (key: string): string => att[key] ?? ''

const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8')
/** 徽章兜底色从页面现读(不在测试里复制常量,§22c);取不到就返回空串让断言咬住"这条接线没了" */
const pageBadgeFallbackColor = (): string => {
  const m = read(pageFile).match(/ATTENDANCE_COLOR_MAP\.get\(r\.status\)\s*\?\?\s*'([^']+)'/)
  return m ? (m[1] as string) : ''
}

const CLASS_ID = '11111111-1111-4111-8111-111111111111'
const STUDENT_ID = '22222222-2222-4222-8222-222222222222'
const TODAY = '2026-11-04'
const BACKFILL_DAY = '2026-11-01'
const BAD_DATE = '2026/11/04'
const BATCH_URL = '/api/edu-ai-management/attendance/batch-check-in'

function renderDialog(node: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(NextIntlClientProvider, { locale: 'zh-CN', messages: messagesZh }, node),
    ),
  )
}

/** Radix Dialog 走 portal,内容在 body 上而不在 render() 的 container 里 ⇒ 一律按 role=dialog 取面 */
const dialogEl = (): HTMLElement => screen.getByRole('dialog') as HTMLElement
const inputOfType = (type: string): HTMLInputElement =>
  dialogEl().querySelector(`input[type="${type}"]`) as HTMLInputElement
const firstInput = (): HTMLInputElement => dialogEl().querySelector('input') as HTMLInputElement
const buttonNamed = (name: string): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement
/** 只数真正打到批量点名的请求:班级清单(useClasses)也经同一个 apiOrThrow 替身 */
const batchCalls = (): unknown[][] =>
  apiOrThrowMock.mock.calls.filter((c) => String(c[0]).includes('batch-check-in'))

afterEach(() => {
  cleanup()
  apiOrThrowMock.mockReset()
})

describe('格① 写载荷:状态由服务端现算,端上不自报', () => {
  it('当日代签:载荷没有 status、也没有 checkInTime(时刻由服务器落 now)', () => {
    const payload = buildCheckInPayload({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
      date: TODAY,
      hm: '',
      today: TODAY,
    })
    expect(payload).not.toBeNull()
    expect(Object.keys(payload!).sort()).toEqual(['checkInMethod', 'classId', 'date', 'studentId'])
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('checkInTime')
  })

  it('回填非当日:给了该日内时刻 ⇒ checkInTime 带显式 +08:00 偏移;没给 ⇒ null(请求不发出去)', () => {
    const withMoment = buildCheckInPayload({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
      date: BACKFILL_DAY,
      hm: '09:15',
      today: TODAY,
    })
    expect(withMoment).not.toBeNull()
    expect(withMoment!.checkInTime).toBe(`${BACKFILL_DAY}T09:15:00+08:00`)
    expect(withMoment).not.toHaveProperty('status')

    const missing = buildCheckInPayload({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
      date: BACKFILL_DAY,
      hm: '',
      today: TODAY,
    })
    expect(missing).toBeNull()
  })

  it('形状不对一律 null,不回落 now、不猜:日期非 YYYY-MM-DD、时刻非 HH:mm 都拦下', () => {
    const base = { studentId: STUDENT_ID, classId: CLASS_ID, today: TODAY }
    expect(buildCheckInPayload({ ...base, date: BAD_DATE, hm: '' })).toBeNull()
    expect(buildCheckInPayload({ ...base, date: '', hm: '09:15' })).toBeNull()
    expect(buildCheckInPayload({ ...base, date: TODAY, hm: '25:00' })).toBeNull()
    // 钟面上不存在的时刻 ⇒ 构造器与校验尺同口径
    expect(checkInMomentIso(TODAY, '25:00')).toBeNull()
    expect(checkInMomentIso(TODAY, '09:15')).toBe(`${TODAY}T09:15:00+08:00`)
    expect(DATE_RE.test('2026-11-4')).toBe(false)
  })

  it('整班点名:载荷没有 status、没有 studentIds(名单唯一来源是该班在册学生)', () => {
    const payload = buildBatchCheckInPayload({
      classId: CLASS_ID,
      date: TODAY,
      hm: '',
      today: TODAY,
    })
    expect(payload).not.toBeNull()
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('studentIds')
    expect(Object.keys(payload!).sort()).toEqual(['classId', 'date'])
    // 回填同口径:非当日缺时刻 ⇒ null
    expect(
      buildBatchCheckInPayload({ classId: CLASS_ID, date: BACKFILL_DAY, hm: '', today: TODAY }),
    ).toBeNull()
    const backfill = buildBatchCheckInPayload({
      classId: CLASS_ID,
      date: BACKFILL_DAY,
      hm: '08:40',
      today: TODAY,
    })
    expect(backfill!.checkInTime).toBe(`${BACKFILL_DAY}T08:40:00+08:00`)
  })

  it('备注空白不进载荷(不把空串写成"有备注")', () => {
    const payload = buildCheckInPayload({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
      date: TODAY,
      hm: '',
      today: TODAY,
      remark: '   ',
    })
    expect(payload).not.toHaveProperty('remark')
    const filled = buildCheckInPayload({
      studentId: STUDENT_ID,
      classId: CLASS_ID,
      date: TODAY,
      hm: '',
      today: TODAY,
      remark: ' 迟到补录 ',
    })
    expect(filled!.remark).toBe('迟到补录')
  })

  it('两个写入口的源码都不留 status:表单态、请求体、状态下拉都不许再有(删除而非隐藏)', () => {
    const all = [pageFile, batchFile].map(read).join('\n')
    expect(all).not.toMatch(/setStatus\(/)
    expect(all).not.toMatch(/update\('status'/)
    expect(all).not.toMatch(/CheckInFormData/)
    expect(all).not.toMatch(/statusOptions/)
    // 两个写弹窗不再取「状态」这个词(清单表头/筛选那两处渲染的是服务端状态,不在此列)
    expect(read(batchFile)).not.toMatch(/'status'/)
    expect(read(pageFile)).not.toMatch(/<Label>\{t\('status'\)\}<\/Label>/)
    // 请求体一律由契约构造,页面不得再手拼第二个(手拼的那份必然把 status 加回来)
    expect(read(batchFile)).toContain('buildBatchCheckInPayload')
    expect(read(pageFile)).toContain('buildCheckInPayload')
    // 代签的 mutation 只转发契约载荷(请假审批那处 JSON.stringify 里的 status 是另一族协议,不算)
    expect(read(pageFile)).toMatch(/mutationFn:\s*\(data: CheckInPayload\)/)
    expect(read(batchFile)).not.toMatch(/JSON\.stringify\(\{[^}]*\bstatus\b/)
  })
})

describe('格① 回填口径:非当日必须给该日内时刻', () => {
  it('业务日尺与后端同口径:UTC 16:30 已是上海次日 ⇒ 不由浏览器本地日说了算', () => {
    expect(bizDay(new Date('2026-11-03T16:30:00Z'))).toBe('2026-11-04')
    expect(bizDay(new Date('2026-11-04T15:30:00Z'))).toBe('2026-11-04')
    expect(DATE_RE.test(bizDay())).toBe(true)
  })

  it('needsExplicitMoment / backfillBlocked 真值表(当日放行、回填缺时刻即拦)', () => {
    expect(needsExplicitMoment(TODAY, TODAY)).toBe(false)
    expect(needsExplicitMoment(BACKFILL_DAY, TODAY)).toBe(true)
    // 日期形状不对时不由它判(交载荷构造器 null),这里必须不冒充"要回填"
    expect(needsExplicitMoment('乱码', TODAY)).toBe(false)
    expect(backfillBlocked(TODAY, TODAY, '')).toBe(false)
    expect(backfillBlocked(BACKFILL_DAY, TODAY, '')).toBe(true)
    expect(backfillBlocked(BACKFILL_DAY, TODAY, '07:05')).toBe(false)
  })

  it('代签弹窗真渲染:非当日未给时刻 ⇒ 警告上屏 + 按钮禁用 + 一次 onSave 都不发', async () => {
    const onSave = vi.fn(async () => {})
    renderDialog(
      React.createElement(CheckInDialog, {
        open: true,
        onOpenChange: () => {},
        classId: CLASS_ID,
        defaultDate: TODAY,
        today: TODAY,
        onSave,
      }),
    )
    const dialog = await screen.findByRole('dialog')
    // 「状态」下拉已删除(不是隐藏):弹窗里连这个词都不出现
    expect(dialog.textContent).not.toContain(w('status'))
    // 时刻输入框在位(回填的唯一出路)
    expect(inputOfType('time')).not.toBeNull()

    fireEvent.change(firstInput(), { target: { value: STUDENT_ID } })
    fireEvent.change(inputOfType('date'), { target: { value: BACKFILL_DAY } })

    await waitFor(() => expect(dialog.textContent).toContain(w('backfillNeedsTime')))
    const confirm = buttonNamed(w('confirmCheckIn'))
    expect(confirm.disabled).toBe(true)
    fireEvent.click(confirm)
    expect(onSave).not.toHaveBeenCalled()

    fireEvent.change(inputOfType('time'), { target: { value: '09:15' } })
    await waitFor(() => expect(dialog.textContent).not.toContain(w('backfillNeedsTime')))
    expect(buttonNamed(w('confirmCheckIn')).disabled).toBe(false)
    fireEvent.click(buttonNamed(w('confirmCheckIn')))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const sent = onSave.mock.calls[0]![0] as Record<string, unknown>
    expect(Object.keys(sent)).not.toContain('status')
    expect(sent.status).toBeUndefined()
    expect(sent.checkInTime).toBe(`${BACKFILL_DAY}T09:15:00+08:00`)
    expect(sent.date).toBe(BACKFILL_DAY)
  })

  it('批量点名真发请求:body 里没有 status,回填时带该日内 ISO 时刻', async () => {
    apiOrThrowMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).includes('batch-check-in')
          ? { created: 2, skipped: 1, missedIds: [] }
          : { list: [], total: 0 },
      ),
    )
    renderDialog(
      React.createElement(BatchCheckInDialog, {
        open: true,
        onOpenChange: () => {},
        defaultDate: TODAY,
        defaultClassId: CLASS_ID,
        today: TODAY,
        onDone: () => {},
      }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).not.toContain(w('status'))

    // 回填缺时刻 ⇒ 按钮禁用,请求一次都不发
    fireEvent.change(inputOfType('date'), { target: { value: BACKFILL_DAY } })
    await waitFor(() => expect(dialog.textContent).toContain(w('backfillNeedsTime')))
    const submit = buttonNamed(w('batchConfirm'))
    expect(submit.disabled).toBe(true)
    fireEvent.click(submit)
    expect(batchCalls()).toHaveLength(0)

    fireEvent.change(inputOfType('time'), { target: { value: '08:40' } })
    await waitFor(() => expect(buttonNamed(w('batchConfirm')).disabled).toBe(false))
    fireEvent.click(buttonNamed(w('batchConfirm')))

    await waitFor(() => expect(batchCalls()).toHaveLength(1))
    const [url, init] = batchCalls()[0] as [string, RequestInit]
    expect(url).toBe(BATCH_URL)
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(Object.keys(body)).not.toContain('status')
    expect(body).toEqual({
      classId: CLASS_ID,
      date: BACKFILL_DAY,
      checkInTime: `${BACKFILL_DAY}T08:40:00+08:00`,
    })
    await waitFor(() => expect(dialog.textContent).toContain(w('batchResultCreated')))
  })
})

describe('格② 早退档:五档逐档有词有色,不落默认档', () => {
  it('档位表就是那五枚协议码;early 取 statusEarly、色取橙,与 late/absent 互不混档', () => {
    expect(ATTENDANCE_STATUS.map((s) => s.value)).toEqual([
      'present',
      'late',
      'early',
      'absent',
      'leave',
    ])
    expect(ATTENDANCE_COLOR_MAP.get('early')).toBe('bg-orange-500')
    expect(ATTENDANCE_STATUS_KEY_MAP.get('early')).toBe('statusEarly')
    // 五档色互不相同,且都不等于徽章兜底色(兜底色从页面现读,不在测试里另抄一份)⇒
    // 任何一档都不会被"洗"成灰色
    const fallback = pageBadgeFallbackColor()
    const colors = ATTENDANCE_STATUS.map((s) => s.color)
    expect(new Set(colors).size).toBe(colors.length)
    for (const c of colors) expect(c).not.toBe(fallback)
  })

  it('五档取词键 + 本票新键在五语言词包里齐备非空(缺一语种就显示成协议码)', () => {
    for (const loc of WEB_LOCALES) {
      const ns = loadLocale(loc).eduAttendance
      for (const tier of ATTENDANCE_STATUS) {
        expect(String(ns[tier.labelKey] ?? '').trim(), `${loc}.${tier.labelKey}`).toBeTruthy()
      }
      // 早退必须真有译文,不能把协议码本身当文案
      expect(ns.statusEarly, `${loc}.statusEarly`).not.toBe('early')
      for (const key of NEW_BACKFILL_KEYS) {
        expect(String(ns[key] ?? '').trim(), `${loc}.${key}`).toBeTruthy()
      }
    }
  })

  it('新键语种纯度:en 不含中日韩字族、ko 不含假名/汉字、ja 不含谚文;插值不得写成双花括号', () => {
    const cjk = /[぀-ゟ가-힯一-鿿]/u
    for (const loc of WEB_LOCALES) {
      const ns = loadLocale(loc).eduAttendance
      const joined = NEW_BACKFILL_KEYS.map((k) => ns[k] ?? '').join(' ')
      expect(joined, `${loc} 不得出现 {{`).not.toContain('{{')
      if (loc === 'en') expect(joined, 'en 不得含中日韩字族').not.toMatch(cjk)
      if (loc === 'ko') expect(joined, 'ko 不得含假名/汉字').not.toMatch(/[぀-ゟ一-鿿]/u)
      if (loc === 'ja') expect(joined, 'ja 不得含谚文').not.toMatch(/[가-힯]/u)
    }
  })

  it('趋势聚合把 early 记进 early 段而不是 other;图例的 early 色/词都在', () => {
    const series = buildAttendanceTrendSeries([
      { period: '2026-11-04', status: 'early', count: 3 },
      { period: '2026-11-04', status: 'present', count: 5 },
    ])
    expect(series[0]).toMatchObject({ early: 3, present: 5, other: 0, total: 8 })
    const chart = read(chartFile)
    expect(chart).toContain('early: CHART_ORANGE')
    expect(chart).toContain("'early'")
    expect(read(pageFile)).toMatch(/early:\s*t\('statusEarly'\)/)
  })

  it('清单徽章 / 状态分布 / 周期表列头 / 「全部状态」下拉共用同一张档位表(单点定义,别处不得再抄)', () => {
    const page = read(pageFile)
    // 表定义只此一处(搬去未登记文件会被家族 i18n 契约判孤儿键 ⇒ 必须留在页面里)
    expect((page.match(/const ATTENDANCE_STATUS = \[/g) ?? []).length).toBe(1)
    expect(page).toContain('export const ATTENDANCE_STATUS = [')
    expect(pageBadgeFallbackColor()).toBe('bg-gray-500')
    expect(page).toContain('attendanceStatusLabel(r.status)')
    expect((page.match(/ATTENDANCE_STATUS\.map/g) ?? []).length).toBeGreaterThanOrEqual(3)
    // 别的考勤文件不得再抄第二张表
    for (const f of [batchFile, chartFile, exportFile]) {
      expect(read(f)).not.toMatch(/labelKey: 'statusPresent'/)
    }
    // 导出是服务端 CSV:客户端不得另立一套状态映射(两份词表必然漂开)
    expect(read(exportFile)).not.toMatch(/status/)
  })
})

describe('格③ 「全部状态」筛选:URL 里不得出现 status=all', () => {
  it('空筛选 = 不带 status 参数;非空才带,且只认协议码', () => {
    expect(buildAttendanceListUrl('2026-11-05', '')).toBe(
      '/api/edu-ai-management/attendance?date=2026-11-05',
    )
    expect(buildAttendanceListUrl('2026-11-05', '')).not.toContain('status')
    expect(buildAttendanceListUrl('2026-11-05', 'early')).toContain('status=early')
    // 日期与筛选双空 ⇒ 连问号都不拼(不给后端留空 query 形态)
    expect(buildAttendanceListUrl('', '')).toBe('/api/edu-ai-management/attendance')
  })

  it('页面侧:考勤筛选与请假筛选同一条归一写法,哨兵值只留在 UI 不进 query', () => {
    const page = read(pageFile)
    expect(page).toMatch(/setAttendanceStatusFilter\(v === 'all' \? '' : v\)/)
    // 两处筛选(考勤 + 请假)口径必须一致:归一表达式恰好用两次
    expect((page.match(/=== 'all' \? '' : v/g) ?? []).length).toBe(2)
    expect(page).not.toMatch(/status=all/)
    expect(page).toContain('buildAttendanceListUrl(attendanceDate, attendanceStatusFilter)')
    // 旧的模板串拼接(会把归一前的值直接写进 URL)不许回潮
    expect(page).not.toMatch(/attendance\?date=\$\{attendanceDate\}\$\{/)
    // 「全部状态」那枚 option 仍是 UI 哨兵值,取词键不变
    expect(page).toContain(`<SelectItem value="all">{t('allStatus')}</SelectItem>`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
