// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 教师考勤「统计区 + 趋势区」的端侧算术(唯一实现;面板与测试都从这里取,禁止页面另算一遍)。
//
// 立因:web 侧 2026-11-03 给教师考勤页补了真趋势图
// (apps/web/app/(main)/edu/edu-management/attendance/AttendanceTrendChart.tsx),数据源是 stats 端点的
// statusBreakdown / periodBreakdown;本端(教师考勤屏)此前只取单日清单,连统计区都没有。
// 记录清单接口 GET /attendance 只收单日 date、无区间参数且分页上限 100,按天逐次请求即 N+1
// ⇒ 与 web、小程序同一结论:**统计与趋势都走 stats 端点**,端上只做二次聚合,后端一行不改。
//
// 与小程序侧逐字同档(AGENTS §4「小程序与 RN 必须长成同一张脸」):
//   apps/miniapp-taro/src/pkg-user/edu-mgmt-attendance/stats.ts —— 同一枚端点、同一套参数
//   (period / startDate / endDate / 可选 classId)、同一个 14 日窗口、同一条出勤率算式。
//   端内差异只有两处:① 路径带 /api 前缀(RN 的 fetchApi 与小程序的 BASE_URL 不同基址);
//   ② 状态档取用走本端单源 ./attendance-status(小程序走它的 contract.ts)。
//
// 三条纪律:
//  1. 不新造接口、不加新参数、不改 apps/api;
//  2. 状态档不新开第二份表:段键 = attendance-status 认下的五枚协议码 + 一枚协议外收口段 other,
//     文案仍走 `eduAttendance.status.<码>`,色档仍走 tone 四档(AGENTS §0.6);
//  3. 算式与 web 同一条:桶聚合 → 时段升序 → total = 桶内和 → 出勤率 = present ÷ total
//     (先 ×10000 取整再 ÷100 ⇒ 恒两位小数,与后端 /attendance/stats 的全局口径同一算式)。
import { attendanceStatusTone, type AttendanceBadgeTone } from './attendance-status'

/** 考勤状态协议码(与后端 eduAttendanceRecord.status 逐字一致;新增码归 other,不在此列)。 */
export const ATTENDANCE_STATUS_CODES = ['present', 'late', 'early', 'absent', 'leave'] as const
export type AttendanceStatusCode = (typeof ATTENDANCE_STATUS_CODES)[number]

/** 协议外状态码的收口段键(与 web 侧 AttendanceTrendSegmentKey 的 'other' 同一语义)。 */
export const OTHER_SEGMENT = 'other'

/** 统计区/趋势区每一段:5 枚协议码 + other。 */
export type AttendanceTrendSegmentKey = AttendanceStatusCode | typeof OTHER_SEGMENT

/** 段序:词表顺序在前,other 恒在末位(读数与色块都按这一序排,两处不会各排一遍)。 */
export const TREND_SEGMENT_ORDER: readonly AttendanceTrendSegmentKey[] = [
  ...ATTENDANCE_STATUS_CODES,
  OTHER_SEGMENT,
]

/** 考勤日期列口径(与后端 attendanceDateSchema 的正则逐字一致,不接受其他形态)。 */
export const ATTENDANCE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 统计端点(fetchApi 取的是完整路径,列表那句同款带 /api 前缀)。 */
export const ATTENDANCE_STATS_PATH = '/api/edu-ai-management/attendance/stats'

/** 时段粒度:与 web statsPeriod 的默认档、小程序 STATS_PERIOD 同字面值(后端 z.enum 三档)。 */
export const STATS_PERIOD = 'daily'

/** 趋势窗口天数:与小程序侧 TREND_WINDOW_DAYS 同档 —— 「截至业务日的 N 天」,端内固定不带区间选择器。 */
export const TREND_WINDOW_DAYS = 14

/** GET /attendance/stats 的 statusBreakdown 行(服务端已按 status 聚合过一轮)。 */
export interface AttendanceStatusCountRow {
  status: string
  count: number
}

/** GET /attendance/stats 的 periodBreakdown 行(服务端已按 (时段, 状态) 聚合过一轮)。 */
export interface AttendancePeriodCountRow {
  period: string
  status: string
  count: number
}

/**
 * stats 端点响应体。`periodBreakdown` 只有带了 `period` 才下发 ⇒ 类型上必须允许缺省,
 * 读取侧统一归零(与 web 侧 AttendanceStats 同一形态)。
 */
export interface AttendanceStatsPayload {
  total?: number
  attendanceRate?: number
  statusBreakdown?: AttendanceStatusCountRow[] | null
  periodBreakdown?: AttendancePeriodCountRow[] | null
}

/** 一段读数:条宽用 share(精确百分比),文字用 pct(整数)。 */
export interface AttendanceTrendSegment {
  key: AttendanceTrendSegmentKey
  count: number
  /** 徽章档位:一律经本端单源 attendanceStatusTone 得出,端内不得再写第二份「码 → 色」映射 */
  tone: AttendanceBadgeTone
  /** 占该时段的百分比(0~100,不截断 —— 堆叠条各段宽度之和必须等于整条) */
  share: number
  /** 界面显示用的整数占比 */
  pct: number
}

/** 一个时段的读数:分母 total = 该时段有考勤记录的人次(不是班级在册人数)。 */
export interface AttendanceTrendPoint {
  /** 时段键:日 YYYY-MM-DD / 周 IYYY-IW / 月 YYYY-MM,服务端下发,客户端只排序不重算 */
  period: string
  /** 非零段,按 TREND_SEGMENT_ORDER 顺序 */
  segments: AttendanceTrendSegment[]
  total: number
  /** 出勤率(%) = present ÷ total,两位小数 */
  attendanceRate: number
}

/**
 * stats 响应 → 统计区读数(一次算完,面板只管渲染,不在视图层做算术)。
 * `attendanceRate` 直接用服务端下发值,客户端不重算(两个分母必须同一枚)。
 */
export interface AttendanceStatsReadout {
  /** 分母:该窗口内有考勤记录的人次 */
  total: number
  /** 出勤率(%),服务端值原样呈现;取不到 ⇒ null(不拿 0 冒充「没出勤」) */
  attendanceRate: number | null
  /** 状态构成(非零段,按段序;present 段就是「正常出勤」,不在这里另开一枚读数) */
  segments: AttendanceTrendSegment[]
}

/** 非有限值/负数/小数一律折成 0,绝不让 NaN 进图表(与 web 侧 toCount 同一算式)。 */
export function toAttendanceCount(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0
}

/** 占比算式唯一出口:分母 ≤0 ⇒ 0(不除零、不猜)。 */
export function attendanceShareOf(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0
}

/** 出勤率算式唯一出口(与后端 stats 逐字同一式:先 ×10000 取整再 ÷100 ⇒ 恒两位小数)。 */
export function attendanceRateOf(present: number, total: number): number {
  const denom = toAttendanceCount(total)
  return denom > 0 ? Math.round((toAttendanceCount(present) / denom) * 10000) / 100 : 0
}

/** 从 (状态, 计数) 行集里累计某一档的计数(词表内的档,单源不另算)。 */
export function countOfAttendanceStatus(
  rows: ReadonlyArray<{ status: string; count: number }>,
  code: AttendanceStatusCode,
): number {
  return rows.reduce((sum, r) => (r.status === code ? sum + r.count : sum), 0)
}

/**
 * 由 (状态, 计数) 行集产出段读数序列(统计区与趋势区共用这一把尺,不分叉)。
 *
 * 三条不丢数的规则(与 web 侧 buildAttendanceTrendSeries 逐条同):
 *  1. 状态取不到字符串 ⇒ 该行整行跳过(服务端坏数据,不臆造读数);
 *  2. count ≤ 0 或非有限 ⇒ 折 0,不进分母也不进分子;
 *  3. 状态码不在词表内 ⇒ 进 other,留在分母里(后端加新状态时出勤率不会静默虚高)。
 *
 * 分母用**调用方给定的 total**:统计区的出勤率读数直接取服务端 `attendanceRate`,
 * 若这里再自求一次和,两个分母就可能不同名同值 ⇒ 页面会出现「占比与出勤率对不上」。
 */
export function buildAttendanceSegments(
  rows: ReadonlyArray<{ status?: unknown; count?: unknown } | null | undefined>,
  total: number,
): AttendanceTrendSegment[] {
  const denom = toAttendanceCount(total)
  const counts = new Map<string, number>()
  for (const row of rows) {
    const status = typeof row?.status === 'string' ? row.status.trim() : ''
    if (status === '') continue
    const count = toAttendanceCount(row?.count)
    if (count === 0) continue
    counts.set(status, (counts.get(status) ?? 0) + count)
  }

  const out: AttendanceTrendSegment[] = []
  let knownSum = 0
  for (const code of ATTENDANCE_STATUS_CODES) {
    const count = counts.get(code) ?? 0
    knownSum += count
    if (count === 0) continue
    const share = attendanceShareOf(count, denom)
    out.push({ key: code, count, tone: attendanceStatusTone(code), share, pct: Math.round(share) })
  }
  const other = Math.max(0, denom - knownSum)
  if (other > 0) {
    const share = attendanceShareOf(other, denom)
    out.push({
      key: OTHER_SEGMENT,
      count: other,
      tone: attendanceStatusTone(OTHER_SEGMENT),
      share,
      pct: Math.round(share),
    })
  }
  return out
}

/**
 * 把 periodBreakdown 聚合成按时间升序的读数序列(一时段一点)。
 * 时段或状态取不到字符串 ⇒ 该行整行跳过;同一时段的多行合并计数。
 */
export function buildAttendanceTrendSeries(
  rows: ReadonlyArray<AttendancePeriodCountRow | null | undefined>,
): AttendanceTrendPoint[] {
  const buckets = new Map<string, AttendanceStatusCountRow[]>()
  for (const row of rows) {
    const period = typeof row?.period === 'string' ? row.period.trim() : ''
    const status = typeof row?.status === 'string' ? row.status.trim() : ''
    if (period === '' || status === '') continue
    const count = toAttendanceCount(row?.count)
    if (count === 0) continue
    const held = buckets.get(period)
    if (held) held.push({ status, count })
    else buckets.set(period, [{ status, count }])
  }

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1))
    .map(([period, list]) => {
      const total = list.reduce((sum, r) => sum + r.count, 0)
      return {
        period,
        segments: buildAttendanceSegments(list, total),
        total,
        attendanceRate: attendanceRateOf(countOfAttendanceStatus(list, 'present'), total),
      }
    })
}

/** stats 响应 → 统计区读数(服务端 total / attendanceRate 原样采信,明细只用于面板画构成)。 */
export function readAttendanceStats(
  payload: AttendanceStatsPayload | null | undefined,
): AttendanceStatsReadout {
  const breakdown = payload?.statusBreakdown ?? []
  const total = toAttendanceCount(payload?.total)
  const raw = payload?.attendanceRate
  return {
    total,
    attendanceRate: typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
    segments: buildAttendanceSegments(breakdown, total),
  }
}

/**
 * 公历日历日加减:YYYY-MM-DD ± 整数天 ⇒ YYYY-MM-DD。
 *
 * 与时区无关的做法:把日键折成 UTC 午夜毫秒(格架上的「第几天」),加减整天后原样读回。
 * 两条不猜:
 *  - 形状不合日键契约、或 delta 不是整数 ⇒ null;
 *  - **日历上不存在**的合法形状(2026-02-31)⇒ null —— Date.UTC 会静默进位成 03-03,
 *    拿它去请求等于把「这个月没有这天」说成「3 月 3 日有考勤」。
 */
export function shiftAttendanceDayKey(date: string, deltaDays: number): string | null {
  if (!ATTENDANCE_DATE_RE.test(date)) return null
  if (!Number.isInteger(deltaDays)) return null
  const [ys, ms, ds] = date.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  const base = Date.UTC(y, m - 1, d)
  if (!Number.isFinite(base)) return null
  const back = new Date(base)
  if (back.getUTCFullYear() !== y || back.getUTCMonth() + 1 !== m || back.getUTCDate() !== d) {
    return null
  }
  const shifted = new Date(base + deltaDays * 86_400_000)
  if (!Number.isFinite(shifted.getTime())) return null
  const pad = (n: number, len: number): string => String(n).padStart(len, '0')
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1, 2)}-${pad(
    shifted.getUTCDate(),
    2,
  )}`
}

/** 从单日清单里取首个班级 id(与小程序侧 firstClassIdOf 同口径:页面点名的那一个班)。 */
export function firstAttendanceClassId(
  rows: ReadonlyArray<{ classId?: string | null } | null | undefined>,
): string {
  for (const r of rows) {
    const id = typeof r?.classId === 'string' ? r.classId.trim() : ''
    if (id !== '') return id
  }
  return ''
}

/**
 * 组装 stats 请求路径(带 query)。窗口 = 截至 `date` 往前共 `windowDays` 天(含当日)。
 *
 * 起点算不出来 ⇒ **null**:调用方据此连请求都不发(AGENTS §0.10 失效方向 = 多要一次说明,
 * 不是打过去吃一个 400)。classId 空串 = 不带该键 = 全部班级(与 web 同口径)。
 * 参数顺序与 web 侧 URLSearchParams、小程序侧 attendanceStatsUrl 同档:period → startDate → endDate。
 */
export function attendanceStatsUrl(input: {
  date: string
  classId?: string
  windowDays?: number
}): string | null {
  if (!ATTENDANCE_DATE_RE.test(input.date)) return null
  const days = input.windowDays ?? TREND_WINDOW_DAYS
  if (!Number.isInteger(days) || days < 1) return null
  const startDate = shiftAttendanceDayKey(input.date, -(days - 1))
  if (startDate === null) return null
  const parts = [`period=${STATS_PERIOD}`, `startDate=${startDate}`, `endDate=${input.date}`]
  const classId = (input.classId ?? '').trim()
  if (classId !== '') parts.push(`classId=${encodeURIComponent(classId)}`)
  return `${ATTENDANCE_STATS_PATH}?${parts.join('&')}`
}

// AGENTS §22c:镜像测试直接 import 本出口,不得复制判据。本文件是纯 lib(无 CLI 入口),按 §22d 免守卫。
export const __test__ = {
  ATTENDANCE_STATUS_CODES,
  OTHER_SEGMENT,
  TREND_SEGMENT_ORDER,
  ATTENDANCE_DATE_RE,
  ATTENDANCE_STATS_PATH,
  STATS_PERIOD,
  TREND_WINDOW_DAYS,
  toAttendanceCount,
  attendanceShareOf,
  attendanceRateOf,
  countOfAttendanceStatus,
  buildAttendanceSegments,
  buildAttendanceTrendSeries,
  readAttendanceStats,
  shiftAttendanceDayKey,
  firstAttendanceClassId,
  attendanceStatsUrl,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
