// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 考勤**写接口**的端侧契约(唯一实现;页面与测试都从这里取,禁止在 index.tsx 里另算一遍)。
//
// 为什么存在:2026-11 后端收口后,POST .../attendance/check-in 与 .../batch-check-in 的入参
// **已删 status 字段** —— 出勤状态一律由服务端按该班 `edu_attendance_rule` 阈值 + `judgeStatus`
// 现算(zod 默认 strip 未知键:老客户端继续传 status 只会被静默忽略)。此前本端把
// status 写死成 present,后果不是"多传一个无用字段"而是**账面造假**:被规则判成迟到的人,
// 请求体里那句自报值会诱使后来者以为客户端说了算。故这里三个写载荷类型结构上都不含
// status 键(编译期挡回潮),页面一律按服务端返回列表的 status 渲染。
//
// 第二条新约束(与后端 resolveTeacherCheckIn 同口径,端上只做**前置拦**,不自行裁决):
// `date` 与 `checkInTime` 必须落在同一个上海业务日。未显式给时刻时,只有当日才允许
// (由服务器落 now);回填非当日必须给出该日内的具体时刻,否则本端直接拒发请求,
// 而不是打过去吃一个 400。日键的唯一算法在 `@/utils/time`(Asia/Shanghai),此处不写第二份。

/** 考勤日期列口径(与后端 attendanceDateSchema 的正则逐字一致)。 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** 时间选择器给的时刻形态 HH:mm(24 小时制,含取值范围:25:00 这种墙上钟面不存在的时刻一律拒收)。 */
export const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 上海 = UTC+8,且中国无夏令时 ⇒ 固定偏移可直书;日期算法仍单源在 @/utils/time。 */
const SHANGHAI_OFFSET = '+08:00'

/**
 * 考勤状态词表(展示档;判据仍在服务端 judgeStatus,本端不复算阈值)。
 * `early` 这一档自此**真的会出现在列表里**:签退重判是它唯一的写入路径,此前它只存在于
 * 报表枚举、写不进库,所以端上的文案/色档一直没建这一格。
 */
export const ATTENDANCE_STATUS_CODES = ['present', 'late', 'early', 'absent', 'leave'] as const
export type AttendanceStatusCode = (typeof ATTENDANCE_STATUS_CODES)[number]

/** 展示色档:与壳(ChildRecordsView)的 tone 词汇 + RN statusTone 同一套,不另立色。 */
export type StatusTone = 'ok' | 'warn' | 'danger' | 'muted'

export const STATUS_TONES: Record<AttendanceStatusCode, StatusTone> = {
  present: 'ok',
  late: 'warn',
  early: 'warn',
  absent: 'danger',
  leave: 'muted',
}

/**
 * 色档 → 类名:四个类名全部是本端在册用词(壳的 ok/warn/danger 三档 + 全局 muted-foreground),
 * 不新引色值。design-tokens 里没有 orange 档 ⇒ early 归 warn(琥珀),与 late 同族。
 */
export const TONE_CLASS: Record<StatusTone, string> = {
  ok: 'text-emerald-600',
  warn: 'text-amber-600',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
}

/** 词表外的未知状态 ⇒ muted(不猜):调用方仍把原文显示出来,交服务端词表解释。 */
export function statusToneOf(status: string): StatusTone {
  return (STATUS_TONES as Partial<Record<string, StatusTone>>)[status] ?? 'muted'
}

/** 该业务日是否「非当日」⇒ 必须显式给出该日内时刻。 */
export function needsExplicitMoment(date: string, today: string): boolean {
  return DATE_RE.test(date) && date !== today
}

/** 回填拦阻:选了非当日却还没给时刻 ⇒ 一切「签到」类写动作禁用,并给出可读原因。 */
export function backfillBlocked(date: string, today: string, hm: string): boolean {
  return needsExplicitMoment(date, today) && !HM_RE.test(hm)
}

/** `date` + `HH:mm` → 带显式偏移的 ISO 时刻;任一段形状不对 ⇒ null(不回落 now,不猜)。 */
export function checkInMomentIso(date: string, hm: string): string | null {
  if (!DATE_RE.test(date) || !HM_RE.test(hm)) return null
  return `${date}T${hm}:00${SHANGHAI_OFFSET}`
}

/** 教师代签入参(注意:没有 status)。 */
export interface CheckInPayload {
  studentId: string
  classId: string
  date: string
  checkInMethod: 'manual'
  checkInTime?: string
}

/** 整班点名入参:刻意没有 studentIds(名单唯一来源是该班在册学生),也没有 status。 */
export interface BatchCheckInPayload {
  classId: string
  date: string
  checkInTime?: string
}

/** 签退入参:时刻由服务器落,端上只交归属三件 + 方式。 */
export interface CheckOutPayload {
  studentId: string
  classId: string
  date: string
  checkOutMethod: 'manual'
}

/** 代签入参;日期形状不对或回填缺时刻 ⇒ null(调用方据此禁用按钮,请求根本不发出去)。 */
export function buildCheckInPayload(input: {
  studentId: string
  classId: string
  date: string
  hm: string
  today: string
}): CheckInPayload | null {
  const { studentId, classId, date, hm, today } = input
  if (!DATE_RE.test(date)) return null
  const body: CheckInPayload = { studentId, classId, date, checkInMethod: 'manual' }
  if (hm !== '') {
    const iso = checkInMomentIso(date, hm)
    if (!iso) return null
    body.checkInTime = iso
  } else if (needsExplicitMoment(date, today)) {
    return null
  }
  return body
}

export function buildBatchPayload(input: {
  classId: string
  date: string
  hm: string
  today: string
}): BatchCheckInPayload | null {
  const { classId, date, hm, today } = input
  if (!DATE_RE.test(date)) return null
  const body: BatchCheckInPayload = { classId, date }
  if (hm !== '') {
    const iso = checkInMomentIso(date, hm)
    if (!iso) return null
    body.checkInTime = iso
  } else if (needsExplicitMoment(date, today)) {
    return null
  }
  return body
}

export function buildCheckOutPayload(input: {
  studentId: string
  classId: string
  date: string
}): CheckOutPayload {
  return {
    studentId: input.studentId,
    classId: input.classId,
    date: input.date,
    checkOutMethod: 'manual',
  }
}

/** 列表状态计数(按词表顺序输出,零计数不出现);词表外的状态排在末尾、如实点名。 */
export function statusTally(
  rows: Array<{ status: string }>,
): Array<{ code: string; count: number }> {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
  const listed = new Set<string>(ATTENDANCE_STATUS_CODES)
  const extra = [...counts.keys()].filter((k) => !listed.has(k))
  return [...ATTENDANCE_STATUS_CODES, ...extra]
    .map((code) => ({ code, count: counts.get(code) ?? 0 }))
    .filter((r) => r.count > 0)
}

// AGENTS §22c:镜像测试直接 import 本出口,不得复制判据。本文件是纯 lib(无 CLI 入口),按 §22d 免守卫。
export const __test__ = {
  DATE_RE,
  HM_RE,
  ATTENDANCE_STATUS_CODES,
  STATUS_TONES,
  TONE_CLASS,
  statusToneOf,
  needsExplicitMoment,
  backfillBlocked,
  checkInMomentIso,
  buildCheckInPayload,
  buildBatchPayload,
  buildCheckOutPayload,
  statusTally,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
