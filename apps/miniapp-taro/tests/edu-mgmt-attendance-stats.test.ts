// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 教师考勤页统计/趋势聚合层的用例册(edu-mgmt-attendance/stats.ts 的镜像测试)。
 *
 * 判的是「小程序这一格与 web 那一格必须读同一份数」这件事里能被算错的五处:
 *  ① 段集合**必须仍是 contract 的那五档 + 一枚 other** —— 端内一新开状态词表,两端就开始
 *     各读各的(§0.6 单一真相源;守门 check-shared-layer-duplication 只看跨包同名,看不到这种)。
 *  ② periodBreakdown 的三条不丢数规则:坏行跳过 / 非正计数折 0 / 协议外码进 other。
 *     其中「六段之和恒等于 total」是读数不丢的唯一可断言形态。
 *  ③ 出勤率算式与后端 stats 逐字同一式(×10000 取整再 ÷100 ⇒ 恒两位小数),
 *     统计区那枚读数直接取服务端下发值、客户端不重算(两个分母必须同一枚)。
 *  ④ 窗口起点的日历加减:2026-02-31 这种「形状合法但日历上不存在」的日键必须判 null ——
 *     Date.UTC 会把它静默进位成 03-03,拿它去请求等于把"这天不存在"说成"这天的考勤在 3 月 3 日"。
 *  ⑤ 请求参数集只有 period + startDate + endDate (+ 可选 classId),与后端
 *     attendanceStatsQuerySchema 同档;多一个自造的键就是新造接口。
 *
 * 判据一律 import 生产出口(§22c:测试里不得复刻一份常量或算式)。
 */
import { describe, it, expect } from 'vitest'
import {
  __test__ as S,
  type AttendanceStatsPayload,
} from '../src/pkg-user/edu-mgmt-attendance/stats'
import {
  __test__ as C,
  ATTENDANCE_STATUS_CODES,
  STATUS_TONES,
} from '../src/pkg-user/edu-mgmt-attendance/contract'

const KNOWN = ATTENDANCE_STATUS_CODES
/** tone 词汇(四档)由 STATUS_TONES 的取值集合现算,不在本册重抄一份字面量(§22c)。 */
const TONE_VOCAB = Array.from(new Set(Object.values(STATUS_TONES)))

/** 把段数组折成 {code: count},方便逐档断言(读的是生产实现,不重算)。 */
function countsOf(segments: Array<{ key: string; count: number }>): Record<string, number> {
  return Object.fromEntries(segments.map((s) => [s.key, s.count]))
}

describe('① 段集合与状态档单源同一份词表', () => {
  it('前五段逐字等于 contract 的词表,末段是协议外收口 other', () => {
    const order = S.TREND_SEGMENT_ORDER
    expect(order.slice(0, KNOWN.length)).toEqual([...KNOWN])
    expect(order[KNOWN.length]).toBe(S.OTHER_SEGMENT)
    expect(order).toHaveLength(KNOWN.length + 1)
  })

  it('other 的色档落在 tone 表的四档词汇内(不为兜底段新开一格色)', () => {
    const rows = [{ status: 'suspended', count: 3 }]
    const segs = S.buildSegments(rows, 3)
    expect(segs).toHaveLength(1)
    expect(segs[0]?.key).toBe(S.OTHER_SEGMENT)
    expect(TONE_VOCAB).toContain(segs[0]?.tone)
  })
})

describe('② periodBreakdown 聚合的三条不丢数规则', () => {
  it('时段或状态取不到字符串 ⇒ 整行跳过(服务端坏数据不臆造读数)', () => {
    const series = S.buildTrendSeries([
      { period: '', status: 'present', count: 5 },
      { period: '2026-11-02', status: '  ', count: 5 },
      { period: '2026-11-02', status: 'present', count: 4 },
      null,
      undefined,
    ])
    expect(series).toHaveLength(1)
    expect(series[0]?.period).toBe('2026-11-02')
    expect(series[0]?.total).toBe(4)
  })

  it('count ≤ 0 / 非有限 / 小数 ⇒ 折 0 不进分母(小数向下取整,不四舍五入)', () => {
    const series = S.buildTrendSeries([
      { period: '2026-11-01', status: 'present', count: 0 },
      { period: '2026-11-01', status: 'late', count: -7 },
      { period: '2026-11-01', status: 'absent', count: Number.NaN },
      { period: '2026-11-01', status: 'leave', count: 2.9 },
    ])
    expect(series).toHaveLength(1)
    expect(series[0]?.total).toBe(2)
    expect(countsOf(series[0]?.segments ?? [])).toEqual({ leave: 2 })
    expect(series[0]?.attendanceRate).toBe(0)
  })

  it('协议外的状态码进 other 且留在分母里 ⇒ 各段之和恒等于 total', () => {
    const rows = [
      { period: '2026-11-01', status: 'present', count: 6 },
      { period: '2026-11-01', status: 'late', count: 2 },
      { period: '2026-11-01', status: 'suspended', count: 1 },
      { period: '2026-11-01', status: 'expelled', count: 1 },
    ]
    const series = S.buildTrendSeries(rows)
    expect(series).toHaveLength(1)
    const point = series[0]
    expect(point?.total).toBe(10)
    const segs = point?.segments ?? []
    expect(segs.reduce((n, s) => n + s.count, 0)).toBe(point?.total)
    expect(countsOf(segs)).toEqual({ present: 6, late: 2, other: 2 })
    // other 恒在末位(词表段在前,收口段在后 —— 色块与文字两处顺序同源)
    expect(segs[segs.length - 1]?.key).toBe(S.OTHER_SEGMENT)
    // 后端加新状态时出勤率不会静默虚高:分母含 other
    expect(point?.attendanceRate).toBe(60)
  })

  it('同一时段散成的多行合并成一个点,并按时间升序', () => {
    const series = S.buildTrendSeries([
      { period: '2026-11-03', status: 'present', count: 1 },
      { period: '2026-11-01', status: 'absent', count: 2 },
      { period: '2026-11-01', status: 'present', count: 3 },
      { period: '2026-11-02', status: 'leave', count: 1 },
    ])
    expect(series.map((p) => p.period)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03'])
    expect(series[0]?.total).toBe(5)
  })
})

describe('③ 出勤率与分母', () => {
  it('算式与后端 stats 同一式:×10000 取整再 ÷100 ⇒ 恒两位小数', () => {
    expect(S.rateOf(2, 3)).toBe(66.67)
    expect(S.rateOf(1, 3)).toBe(33.33)
    expect(S.rateOf(0, 0)).toBe(0)
    expect(S.rateOf(Number.NaN, 5)).toBe(0)
  })

  it('统计区的分母用服务端 total,不用自求和 ⇒ 明细对不上时不静默改读数', () => {
    const rows = [
      { status: 'present', count: 4 },
      { status: 'late', count: 2 },
    ]
    const segs = S.buildSegments(rows, 20)
    // 20 − 6 ⇒ 其余 14 人次进 other(读数不丢),而不是被折进五档里、也不是把分母改成 6
    expect(countsOf(segs)).toEqual({ present: 4, late: 2, other: 14 })
    expect(segs.reduce((n, s) => n + s.count, 0)).toBe(20)
    const shares = segs.reduce((n, s) => n + s.share, 0)
    expect(shares).toBeCloseTo(100, 6)
  })

  it('readStats 的出勤率直接取服务端值,客户端不重算', () => {
    const payload: AttendanceStatsPayload = {
      total: 10,
      attendanceRate: 42.13,
      statusBreakdown: [{ status: 'present', count: 8 }],
    }
    const readout = S.readStats(payload)
    expect(readout.attendanceRate).toBe(42.13)
    expect(readout.total).toBe(10)
    // 服务端 total 与明细之和不一致时如实报数(不抹平)
    expect(readout.breakdownSum).toBe(8)
  })

  it('payload 缺失 ⇒ 零读数且不抛;出勤率非有限 ⇒ null(不拿 0 冒充"没出勤")', () => {
    const empty = S.readStats(null)
    expect(empty).toEqual({ total: 0, attendanceRate: null, rows: [], breakdownSum: 0 })
    expect(
      S.readStats({ total: 5, attendanceRate: Number.NaN, statusBreakdown: [] }).attendanceRate,
    ).toBeNull()
    expect(
      S.readStats({ total: 5, attendanceRate: '42' as unknown as number, statusBreakdown: [] })
        .attendanceRate,
    ).toBeNull()
  })
})

describe('④ 窗口起点的日历加减', () => {
  it('跨月 / 跨年 / 闰年都落在真实日历日上', () => {
    expect(S.shiftDayKey('2026-11-04', -13)).toBe('2026-10-22')
    expect(S.shiftDayKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(S.shiftDayKey('2026-02-28', 1)).toBe('2026-03-01')
    expect(S.shiftDayKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(S.shiftDayKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(S.shiftDayKey('2026-11-04', 0)).toBe('2026-11-04')
  })

  it('形状不合法 / 偏移不是整数 ⇒ null(不回落、不猜)', () => {
    expect(S.shiftDayKey('2026-11-4', -1)).toBeNull()
    expect(S.shiftDayKey('2026-11-04T00:00:00Z', -1)).toBeNull()
    expect(S.shiftDayKey('', -1)).toBeNull()
    expect(S.shiftDayKey('2026-11-04', -1.5)).toBeNull()
  })

  it('形状合法但日历上不存在的日键 ⇒ null —— Date.UTC 的静默进位不得当成"这天"', () => {
    expect(S.shiftDayKey('2026-02-31', -1)).toBeNull()
    expect(S.shiftDayKey('2026-13-01', -1)).toBeNull()
    expect(S.shiftDayKey('2026-04-31', 0)).toBeNull()
  })

  it('年份补零到四位', () => {
    expect(S.shiftDayKey('1000-01-01', -1)).toBe('0999-12-31')
    expect(S.shiftDayKey('2026-11-04', 0)).toBe('2026-11-04')
  })
})

describe('⑤ stats 请求的参数集与后端同档', () => {
  it('只带 period + startDate + endDate;窗口 = 截至业务日共 N 天(含当日)', () => {
    const url = S.attendanceStatsUrl({ date: '2026-11-04' })
    expect(url).toBe(
      `${S.ATTENDANCE_STATS_PATH}?period=${S.STATS_PERIOD}&startDate=2026-10-22&endDate=2026-11-04`,
    )
    expect(S.TREND_WINDOW_DAYS).toBe(14)
  })

  it('classId 有值才带(空串 = 全部班级,与 web 同口径)', () => {
    const withClass = S.attendanceStatsUrl({
      date: '2026-11-04',
      classId: 'c1',
      windowDays: 3,
    })
    expect(withClass).toContain('&classId=c1')
    expect(withClass).toContain('startDate=2026-11-02')
    expect(S.attendanceStatsUrl({ date: '2026-11-04', classId: '   ' })).not.toContain('classId')
  })

  it('窗口天数不合法 / 日键不合法 ⇒ null(调用方据此连请求都不发)', () => {
    expect(S.attendanceStatsUrl({ date: '2026-11-04', windowDays: 0 })).toBeNull()
    expect(S.attendanceStatsUrl({ date: '2026-11-04', windowDays: 2.5 })).toBeNull()
    expect(S.attendanceStatsUrl({ date: 'x' })).toBeNull()
  })

  it('本端路径不带 /api 前缀(BASE_URL 已含;与页面列表请求同一基址)', () => {
    expect(S.ATTENDANCE_STATS_PATH.startsWith('/api')).toBe(false)
    expect(S.ATTENDANCE_STATS_PATH).toBe('/edu-ai-management/attendance/stats')
  })
})

describe('⑥ 班级归属与页面同口径', () => {
  it('取首个非空 classId(与页面 targetClassId 的算法同一出口,不各算一遍)', () => {
    expect(S.firstClassIdOf([{ classId: '' }, { classId: ' c2 ' }, { classId: 'c3' }])).toBe('c2')
    expect(S.firstClassIdOf([{ classId: null }, null, undefined])).toBe('')
  })
})

describe('⑦ 色档不得开出 tone 表之外的格', () => {
  it('每个非零段都能从 contract 的 tone 表取到档,且填充类名成套', () => {
    const segs = S.buildSegments(
      KNOWN.map((status) => ({ status, count: 1 })),
      KNOWN.length,
    )
    expect(segs).toHaveLength(KNOWN.length)
    for (const seg of segs) {
      expect(TONE_VOCAB).toContain(seg.tone)
      expect(C.TONE_BG_CLASS[seg.tone]).toMatch(/^bg-/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
