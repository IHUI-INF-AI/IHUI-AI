// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 考勤**读接口**(GET /attendance/stats)的端侧聚合层(唯一实现;面板与测试都从这里取,禁止页面另算一遍)。
//
// 为什么存在:web 侧 2026-11-03 给教师考勤页补了真趋势图
// (apps/web/app/(main)/edu/edu-management/attendance/AttendanceTrendChart.tsx),其数据源是
// stats 端点的 `periodBreakdown`;本端同职能页此前只取单日清单(GET /attendance?date=),
// 连统计区都没有。记录清单接口只收单日 date、无区间参数且 pageSize≤100,按天逐次请求即 N+1,
// 所以两端同一结论:**趋势与统计都走 stats 端点**,端上只做二次聚合,后端一行不改。
//
// 三条纪律:
//  1. **端点与参数与 web 逐字同档**:`period` + `startDate` + `endDate` (+ 可选 `classId`),
//     即后端 attendanceStatsQuerySchema 的那四键;本端不新造接口、不加新参数。
//  2. **状态词表不新开**:段键集合 = contract.ts 的 ATTENDANCE_STATUS_CODES 加一枚协议外收口段
//     `other`(§0.6 单一真相源;守门 check-shared-layer-duplication)。
//  3. **算式与 web 同一条**:桶聚合 → 时段升序 → total = 桶内和 → 出勤率 = present ÷ total
//     (round ×10000÷100,与后端 stats 的全局口径同一算式)。
//
// `shiftDayKey` 只做**公历日历日的加减**(UTC 格架上算,结果与时区无关),不是"今天几号"的第二把尺
// —— 业务日仍单源 `@/utils/time`(Asia/Shanghai)。共享层没有日加减出口(present 现读
// packages/shared/src 无同名 util),故在此实现并由镜像测试钉住。

import {
  ATTENDANCE_STATUS_CODES,
  DATE_RE,
  statusToneOf,
  type AttendanceStatusCode,
  type StatusTone,
} from './contract'

/** 统计端点路径(与本端列表页 `/edu-ai-management/attendance` 同一基址,BASE_URL 已含 /api)。 */
export const ATTENDANCE_STATS_PATH = '/edu-ai-management/attendance/stats'

/**
 * 时段粒度:与 web 页的默认档同字面值。后端 z.enum(['daily','weekly','monthly']),
 * 本端只挂 daily —— 页面没有粒度选择器,不自造第二套周期词汇(要加先加控件)。
 */
export const STATS_PERIOD = 'daily'

/** 趋势窗口天数:端内固定「截至所选业务日的 N 天」,Web 侧那枚区间选择器不在本票射程。 */
export const TREND_WINDOW_DAYS = 14

/** 协议外状态码的收口段键(与 web 侧 AttendanceTrendSegmentKey 的 'other' 同一语义)。 */
export const OTHER_SEGMENT = 'other'

/** 图上/统计区每一段:5 枚协议码 + other。 */
export type TrendSegmentKey = AttendanceStatusCode | typeof OTHER_SEGMENT

/** 段序:词表顺序在前,other 恒在末位(读数与色块都按这个顺序排,两处不会各排一遍)。 */
export const TREND_SEGMENT_ORDER: readonly TrendSegmentKey[] = [
  ...ATTENDANCE_STATUS_CODES,
  OTHER_SEGMENT,
]

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
  total: number
  attendanceRate: number
  statusBreakdown: AttendanceStatusCountRow[]
  periodBreakdown?: AttendancePeriodCountRow[] | null
}

/** 一段读数:条宽用 share(精确百分比),文字用 pct(整数)。 */
export interface TrendSegment {
  key: TrendSegmentKey
  count: number
  /** 色档(单源 contract.statusToneOf;本端 tone 表就是四档,不为 web 的橙/蓝另开格) */
  tone: StatusTone
  /** 占该时段的百分比(0~100,不截断 —— 堆叠条宽度之和必须等于整条) */
  share: number
  /** 端内显示用的整数占比 */
  pct: number
}

/** 一个时段的读数:分母 total = 该时段有考勤记录的人次(不是班级在册人数)。 */
export interface AttendanceTrendPoint {
  /** 时段键(日粒度 = YYYY-MM-DD):服务端下发,客户端只排序不重算 */
  period: string
  /** 非零段,按 TREND_SEGMENT_ORDER 顺序 */
  segments: TrendSegment[]
  /** 分母 = 该时段全部状态计数之和 */
  total: number
  /** 出勤率(%) = present ÷ total,两位小数 */
  attendanceRate: number
}

/** 非有限值/负数/小数一律折成 0,绝不让 NaN 进图表(与 web 侧 toCount 同一算式)。 */
function toCount(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0
}

/** 占比算式唯一出口:分母 ≤0 ⇒ 0(不除零、不猜)。 */
function shareOf(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0
}

/** 把 count 折进桶;桶不存在则新建。 */
function bump(bucket: Record<string, number>, status: string, count: number): void {
  bucket[status] = (bucket[status] ?? 0) + count
}

/**
 * 由 (状态, 计数) 行集产出段读数序列(统计区与趋势区共用这一把尺,不分叉)。
 *
 * 三条不丢数的规则(与 web 侧 buildAttendanceTrendSeries 逐条同):
 *  1. 状态取不到字符串 ⇒ 该行整行跳过(服务端坏数据,不臆造读数);
 *  2. count ≤ 0 或非有限 ⇒ 折 0,不进分母也不进分子;
 *  3. 状态码不在词表内 ⇒ 进 other,留在分母里(后端加新状态时出勤率不会静默虚高)。
 *
 * 分母用**调用方给定的 total**:出勤率读数直接取服务端 `stats.attendanceRate`,
 * 若这里再自求一次和,两个分母就可能不同名同值 ⇒ 页面会出现"占比与出勤率对不上"。
 */
export function buildSegments(
  rows: ReadonlyArray<{ status?: unknown; count?: unknown } | null | undefined>,
  total: number,
): TrendSegment[] {
  const denom = toCount(total)
  const counts: Record<string, number> = {}
  for (const row of rows) {
    const status = typeof row?.status === 'string' ? row.status.trim() : ''
    if (!status) continue
    const count = toCount(row?.count)
    if (count === 0) continue
    bump(counts, status, count)
  }
  const out: TrendSegment[] = []
  let knownSum = 0
  for (const code of ATTENDANCE_STATUS_CODES) {
    const count = counts[code] ?? 0
    knownSum += count
    if (count === 0) continue
    const share = shareOf(count, denom)
    out.push({ key: code, count, tone: statusToneOf(code), share, pct: Math.round(share) })
  }
  const other = Math.max(0, denom - knownSum)
  if (other > 0) {
    out.push({
      key: OTHER_SEGMENT,
      count: other,
      tone: statusToneOf(OTHER_SEGMENT),
      share: shareOf(other, denom),
      pct: Math.round(shareOf(other, denom)),
    })
  }
  return out
}

/**
 * 把 periodBreakdown 聚合成按时间升序的读数序列(一时段一点)。
 * 时段取不到字符串 ⇒ 该行整行跳过;时段键相同则合并计数。
 */
export function buildTrendSeries(
  rows: ReadonlyArray<AttendancePeriodCountRow | null | undefined>,
): AttendanceTrendPoint[] {
  const buckets = new Map<string, AttendancePeriodCountRow[]>()
  for (const row of rows) {
    const period = typeof row?.period === 'string' ? row.period.trim() : ''
    const status = typeof row?.status === 'string' ? row.status.trim() : ''
    if (!period || !status) continue
    const count = toCount(row?.count)
    if (count === 0) continue
    const held = { period, status, count }
    const list = buckets.get(period)
    if (list) list.push(held)
    else buckets.set(period, [held])
  }

  return Array.from(buckets.entries())
    .sort((a, b) => (a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1))
    .map(([period, list]) => {
      const total = list.reduce((sum, r) => sum + r.count, 0)
      return {
        period,
        segments: buildSegments(list, total),
        total,
        attendanceRate: rateOf(presentCountOf(list), total),
      }
    })
}

/** 出勤率算式唯一出口(与后端 stats 逐字同一式:先 ×10000 取整再 ÷100 ⇒ 恒两位小数)。 */
export function rateOf(present: number, total: number): number {
  const denom = toCount(total)
  return denom > 0 ? Math.round((toCount(present) / denom) * 10000) / 100 : 0
}

/** 从 (状态, 计数) 行集里取 present 的计数(词表第一档,单源 contract)。 */
function presentCountOf(rows: ReadonlyArray<{ status: string; count: number }>): number {
  const hit = rows.find((r) => r.status === ATTENDANCE_STATUS_CODES[0])
  return toCount(hit?.count)
}

/**
 * 公历日历日加减:YYYY-MM-DD ± 整数天 ⇒ YYYY-MM-DD。
 *
 * 与时区无关的做法:把日键折成 UTC 午夜毫秒(格架上的"第几天"),加减整天后原样读回。
 * 两条不猜:
 *  - 形状不合 DATE_RE、或 delta 不是整数 ⇒ null;
 *  - **日历上不存在**的合法形状(2026-02-31)⇒ null —— Date.UTC 会静默进位成 03-03,
 *    拿它去请求等于把"这个月没有这天"说成"3 月 3 日有考勤"。
 */
export function shiftDayKey(date: string, deltaDays: number): string | null {
  if (!DATE_RE.test(date)) return null
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
  const sy = shifted.getUTCFullYear()
  const sm = shifted.getUTCMonth() + 1
  const sd = shifted.getUTCDate()
  const pad = (n: number, len: number) => String(n).padStart(len, '0')
  return `${pad(sy, 4)}-${pad(sm, 2)}-${pad(sd, 2)}`
}

/**
 * 组装 stats 请求路径(带 query)。窗口 = 截至 `date` 往前共 `windowDays` 天(含当日)。
 *
 * 起点算不出来 ⇒ **null**:调用方据此连请求都不发(§0.10 失效方向 = 多要一次说明,
 * 不是打过去吃一个 400)。classId 空串 = 不带该键 = 全部班级(与 web 同口径)。
 */
export function attendanceStatsUrl(input: {
  date: string
  classId?: string
  windowDays?: number
}): string | null {
  if (!DATE_RE.test(input.date)) return null
  const days = input.windowDays ?? TREND_WINDOW_DAYS
  if (!Number.isInteger(days) || days < 1) return null
  const startDate = shiftDayKey(input.date, -(days - 1))
  if (!startDate) return null
  const parts = [`period=${STATS_PERIOD}`, `startDate=${startDate}`, `endDate=${input.date}`]
  const classId = (input.classId ?? '').trim()
  if (classId) parts.push(`classId=${encodeURIComponent(classId)}`)
  return `${ATTENDANCE_STATS_PATH}?${parts.join('&')}`
}

/** 从单日清单里取首个班级 id(与页面「本次点名哪个班」同一个 targetClassId 口径)。 */
export function firstClassIdOf(
  rows: ReadonlyArray<{ classId?: string | null } | null | undefined>,
): string {
  for (const r of rows) {
    const id = typeof r?.classId === 'string' ? r.classId.trim() : ''
    if (id) return id
  }
  return ''
}

/**
 * stats 响应 → 统计区读数(一次算完,面板只管渲染,不在视图层做算术)。
 * `attendanceRate` 直接用服务端下发值,客户端不重算(两个分母必须同一枚)。
 */
export interface AttendanceStatsReadout {
  /** 分母:该窗口内有考勤记录的人次 */
  total: number
  /** 出勤率(%),服务端值原样呈现;取不到 ⇒ null(不拿 0 冒充"没出勤") */
  attendanceRate: number | null
  /** 状态构成(非零段,按词表顺序) */
  rows: TrendSegment[]
  /** 客户端自求的 breakdown 之和,仅用于点名"服务端 total 与明细对不上"这一型 */
  breakdownSum: number
}

export function readStats(payload: AttendanceStatsPayload | null): AttendanceStatsReadout {
  const breakdown = payload?.statusBreakdown ?? []
  const total = toCount(payload?.total)
  const raw = payload?.attendanceRate
  return {
    total,
    attendanceRate: typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
    rows: buildSegments(breakdown, total),
    breakdownSum: breakdown.reduce((sum, r) => sum + toCount(r?.count), 0),
  }
}

// AGENTS §22c:镜像测试直接 import 本出口,不得复制判据。本文件是纯 lib(无 CLI 入口),按 §22d 免守卫。
export const __test__ = {
  ATTENDANCE_STATS_PATH,
  STATS_PERIOD,
  TREND_WINDOW_DAYS,
  OTHER_SEGMENT,
  TREND_SEGMENT_ORDER,
  toCount,
  buildSegments,
  buildTrendSeries,
  rateOf,
  shiftDayKey,
  attendanceStatsUrl,
  firstClassIdOf,
  readStats,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
