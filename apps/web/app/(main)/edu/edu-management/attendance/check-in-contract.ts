// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 教育考勤**写接口**的端侧契约(唯一实现:页面与测试都从这里取,禁止在 PageClient / 弹窗里另算一遍)。
//
// 为什么存在(2026-11 后端收口,apps/api/src/routes/edu-ai-management.ts 现读):
// ① `POST .../attendance/check-in` 与 `.../batch-check-in` 的入参**已删 status 字段** ——
//    出勤状态一律由服务端按该班 `edu_attendance_rule` 阈值 + `judgeStatus` 现算。
//    下面三个写载荷类型结构上都不含 status 键(编译期挡回潮);页面渲染的状态只来自服务端返回。
//    留着端上自报 status 的危害不是"多传一个无用字段",而是账面造假:被规则判成迟到的人,
//    请求体里那句自报值会诱使后来者以为客户端说了算。
// ② `date` 与 `checkInTime` 必须落在同一个上海业务日。未显式给时刻时只有当日才合法(服务器落 now);
//    回填非当日必须给出该日内的具体时刻,否则本端直接拒发请求,而不是打过去吃一个 400。
//    这里只做**前置拦**,不自行裁决状态(阈值判据单源在服务端 judgeStatus,§0.6)。
//
// 与小程序端 `apps/miniapp-taro/src/pkg-user/edu-mgmt-attendance/contract.ts` 同档位、同算法
// (回填口径两端一致,且后端本就支持时刻精度,故非当日一律要求显式时刻)。
// 平台特有:纯 TS(零 DOM、零 IO),web 三处消费点(PageClient 代签、批量点名弹窗、清单取数)共用。

/** 考勤日期列口径(与后端 attendanceDateSchema 的正则逐字一致)。 */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** 时间输入给的时刻形态 HH:mm(24 小时制;25:00 这种墙上钟面不存在的时刻一律拒收)。 */
export const MOMENT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** 上海 = UTC+8 且无夏令时 ⇒ 固定偏移可直书;业务日算法只此一处(bizDay)。 */
const SHANGHAI_OFFSET = '+08:00'

/**
 * 上海业务日 YYYY-MM-DD —— 与后端 bizDayKey 同口径。
 * 刻意不用浏览器本地日:服务器按上海日判"当日/回填",跨时区工位用本地日会拦错方向。
 * 时间格式化走 Intl.DateTimeFormat(AGENTS §3),en-CA 产出的正是 ISO 的 YYYY-MM-DD。
 */
export function bizDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** 该业务日是否「非当日」⇒ 必须显式给出该日内时刻。 */
export function needsExplicitMoment(date: string, today: string): boolean {
  return DATE_RE.test(date) && date !== today
}

/** 回填拦阻:选了非当日却还没给合法时刻 ⇒ 一切「签到」类写动作禁用,并给出可读原因。 */
export function backfillBlocked(date: string, today: string, hm: string): boolean {
  return needsExplicitMoment(date, today) && !MOMENT_RE.test(hm)
}

/** `date` + `HH:mm` → 带显式偏移的 ISO 时刻;任一段形状不对 ⇒ null(不回落 now、不猜)。 */
export function checkInMomentIso(date: string, hm: string): string | null {
  if (!DATE_RE.test(date) || !MOMENT_RE.test(hm)) return null
  return `${date}T${hm}:00${SHANGHAI_OFFSET}`
}

/** 教师代签入参(注意:没有 status)。 */
export interface CheckInPayload {
  studentId: string
  classId: string
  date: string
  checkInMethod: string
  /** 当日可缺省(服务器落 now);回填非当日必填,且必须落在该日内 */
  checkInTime?: string
  remark?: string
}

/** 整班点名入参:刻意没有 studentIds(名单唯一来源是该班在册学生),也没有 status。 */
export interface BatchCheckInPayload {
  classId: string
  date: string
  checkInTime?: string
  remark?: string
}

/** 代签入参构造:日期形状不对、或回填缺时刻 ⇒ null(调用方据此禁用按钮,请求根本不发出去)。 */
export function buildCheckInPayload(input: {
  studentId: string
  classId: string
  date: string
  hm: string
  today: string
  checkInMethod?: string
  remark?: string
}): CheckInPayload | null {
  const { studentId, classId, date, hm, today } = input
  if (!DATE_RE.test(date)) return null
  const body: CheckInPayload = {
    studentId,
    classId,
    date,
    checkInMethod: input.checkInMethod ?? 'manual',
  }
  const remark = (input.remark ?? '').trim()
  if (remark) body.remark = remark
  if (hm !== '') {
    const iso = checkInMomentIso(date, hm)
    if (!iso) return null
    body.checkInTime = iso
  } else if (needsExplicitMoment(date, today)) {
    return null
  }
  return body
}

/** 整班点名入参构造:拦阻口径与代签逐字相同。 */
export function buildBatchCheckInPayload(input: {
  classId: string
  date: string
  hm: string
  today: string
  remark?: string
}): BatchCheckInPayload | null {
  const { classId, date, hm, today } = input
  if (!DATE_RE.test(date)) return null
  const body: BatchCheckInPayload = { classId, date }
  const remark = (input.remark ?? '').trim()
  if (remark) body.remark = remark
  if (hm !== '') {
    const iso = checkInMomentIso(date, hm)
    if (!iso) return null
    body.checkInTime = iso
  } else if (needsExplicitMoment(date, today)) {
    return null
  }
  return body
}

/**
 * 考勤清单取数 URL:`GET /api/edu-ai-management/attendance`。
 * status 只在筛选值非空时才进 query —— 「全部状态」在页面侧已被归一成 ''(与请假筛选同一写法),
 * 后端按枚举精确匹配,带上 `status=all` 会让列表恒空(2026-11 实测缺陷)。
 */
export function buildAttendanceListUrl(date: string, statusFilter: string): string {
  const params = new URLSearchParams()
  if (date) params.set('date', date)
  if (statusFilter) params.set('status', statusFilter)
  const qs = params.toString()
  return `/api/edu-ai-management/attendance${qs ? `?${qs}` : ''}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
