// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 飞书/钉钉考勤同步的纯类型与枚举映射(2026-11-14 立,RP-15/16/17)。
 *
 * 纪律:
 * - 平台原始枚举**只做已在设计稿 §7 核实过的映射**;未核实的值一律不猜,
 *   `EnumMapping.system === null` 且 `raw` 原样返回,由落库侧写原始枚举。
 * - 审批三类(leave/overtime/outgoing)的平台枚举尚未核实(设计稿 §7.4),
 *   本文件保留空别名表,不编造映射。
 */

export const HR_ATTENDANCE_SYNC_JOB_NAME = 'hr-attendance-sync-daily'
/**
 * 每日北京时间 02:00(与设计稿 §10 一致)。
 * BullMQ 的 pattern 按 **UTC** 解析,故写成 UTC 18:00(= 次日北京 02:00);
 * 与 edu-arrear-remind-daily 的时区口径一致,不依赖进程本地钟。
 */
export const HR_ATTENDANCE_SYNC_CRON = '0 18 * * *'
/** 总开关:仅显式 true/1/yes 才开;缺省关闭。 */
export const ATTENDANCE_SYNC_ENABLED_ENV = 'HR_ATTENDANCE_SYNC_ENABLED'

export type AttendanceSyncProviderId = 'feishu' | 'dingtalk'
export const ATTENDANCE_SYNC_PROVIDER_IDS: readonly AttendanceSyncProviderId[] = [
  'feishu',
  'dingtalk',
]

export type ApprovalKind = 'leave' | 'overtime' | 'outgoing'

/** 枚举映射结果:system=系统值(未核实时为 null),raw=平台原值。 */
export interface EnumMapping {
  system: string | null
  raw: string
  known: boolean
}

/** 从平台拉回、尚未落库的一条考勤记录。 */
export interface NormalizedAttendanceRecord {
  provider: AttendanceSyncProviderId
  employeeNo: string
  /** 业务日 YYYY-MM-DD(上海口径) */
  date: string
  checkInTime: Date | null
  checkOutTime: Date | null
  /** 平台原始状态枚举;落库时未知值原样保留 */
  statusRaw: string | null
  /** 平台记录 ID / 组合键,仅用于日志与排障 */
  externalId: string | null
}

export interface AttendanceSyncError {
  provider: string
  kind: string
  message: string
}

export interface AttendanceSyncRunResult {
  /** 本次运行时总开关状态(false=空跑,不发起任何平台请求) */
  enabled: boolean
  /** 拉取窗口业务日 YYYY-MM-DD */
  windowDate: string
  /** 名册中参与同步的工号数 */
  scannedUsers: number
  /** 实际发起的 provider 拉取次数 */
  attempted: number
  /** 新增考勤行数 */
  syncedRows: number
  /** 幂等命中(已存在同员工同部门同日)行数 */
  duplicates: number
  /** 名册工号在 hr_employee 中找不到的次数 */
  employeeNotFound: number
  /** 字段无法落库(如未知枚举超过列宽)的行数 */
  invalidRows: number
  /** 凭证/scope 缺失而跳过的 provider 数 */
  skippedNotConfigured: number
  /** 审批三类尚未实现而跳过的次数(当前固定 0,见设计稿 §7.4 缺口) */
  skippedNotImplemented: number
  errors: AttendanceSyncError[]
  finishedAt: string
}

export function isAttendanceSyncEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env[ATTENDANCE_SYNC_ENABLED_ENV]?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

const SYSTEM_ATTENDANCE_STATUSES = new Set(['present', 'late', 'early', 'absent', 'leave'])

/**
 * 钉钉 `timeResult` 的已核实取值(设计稿 §7.2:Normal/Late/Early/…/NotSigned)。
 * 飞书打卡结果枚举未经逐值核实 ⇒ 仅做系统值同名透传,不做猜测。
 */
const DINGTALK_TIME_RESULT_MAP: Readonly<Record<string, string>> = {
  normal: 'present',
  late: 'late',
  early: 'early',
  notsigned: 'absent',
}

/** 平台打卡状态 → 系统状态;未核实值返回 null 并原样保留 raw。 */
export function mapAttendanceStatus(
  provider: AttendanceSyncProviderId,
  raw: string | null,
): EnumMapping {
  const value = (raw ?? '').trim()
  if (!value) return { system: null, raw: '', known: false }

  const lowered = value.toLowerCase()
  if (SYSTEM_ATTENDANCE_STATUSES.has(lowered)) {
    return { system: lowered, raw: value, known: true }
  }
  if (provider === 'dingtalk') {
    const hit = DINGTALK_TIME_RESULT_MAP[lowered]
    if (hit) return { system: hit, raw: value, known: true }
  }
  return { system: null, raw: value, known: false }
}

/**
 * 假别平台枚举 → 系统假别(sick/personal/annual/marriage/maternity/other)。
 * 平台别名表**刻意留空**:设计稿 §7.4 明确未逐值核实,填任何值都等于编造。
 * 若平台原值本身就是系统值(如 `annual`),按同名透传。
 */
const SYSTEM_LEAVE_TYPES = new Set(['sick', 'personal', 'annual', 'marriage', 'maternity', 'other'])

export function mapLeaveType(raw: string | null): EnumMapping {
  const value = (raw ?? '').trim()
  if (!value) return { system: null, raw: '', known: false }
  const lowered = value.toLowerCase()
  if (SYSTEM_LEAVE_TYPES.has(lowered)) {
    return { system: lowered, raw: value, known: true }
  }
  return { system: null, raw: value, known: false }
}

/**
 * 审批定义/模板 code → 三类导入。平台模板 code 未核实(§7.4),
 * 因此只认系统值同名透传,未知一律 null 并保留 raw。
 */
export function classifyApprovalKind(raw: string | null): {
  kind: ApprovalKind | null
  raw: string
  known: boolean
} {
  const value = (raw ?? '').trim()
  if (!value) return { kind: null, raw: '', known: false }
  const lowered = value.toLowerCase()
  if (lowered === 'leave' || lowered === 'overtime' || lowered === 'outgoing') {
    return { kind: lowered, raw: value, known: true }
  }
  return { kind: null, raw: value, known: false }
}

/** 平台记录时间:毫秒时间戳 / `YYYY-MM-DD HH:mm:ss`(上海) / ISO。 */
export function parsePlatformDateTime(raw: unknown): Date | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) {
    const d = new Date(`${text.replace(' ', 'T')}+08:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(text)
  return Number.isNaN(d.getTime()) ? null : d
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
