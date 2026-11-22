// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步落库与游标/运行快照(2026-11-14 立)。
 *
 * 落库口径:
 * - 考勤行按 `hr_attendance_record` 的 (employee_id, department_id, date) 唯一索引
 *   幂等插入;已存在时 **不覆盖**(人工裁决/请假/缺勤优先级不被同步器洗掉)。
 * - 平台未知枚举原样写进 `status`;超过列宽(20)无法原样落库的行计入 invalidRows,
 *   不静默截断。完整原值同时写进 remark 便于排查。
 * - 游标/运行快照复用 `system_configs`(schema 零改动,设计稿 §10/§11)。
 */

import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { hrAttendanceRecord, hrEmployee, systemConfigs, userProfiles } from '@ihui/database'
import { db } from '../db/index.js'
import {
  mapAttendanceStatus,
  type AttendanceSyncRunResult,
  type NormalizedAttendanceRecord,
} from './attendance-sync-types.js'

export const ATTENDANCE_SYNC_CURSOR_KEY_PREFIX = 'sync:attendance:cursor:'
export const ATTENDANCE_SYNC_LAST_RUN_KEY = 'sync:attendance:last-run'
export const DINGTALK_USERID_MAP_KEY = 'sync:dingtalk:userid-map'
const HR_ATTENDANCE_STATUS_MAX = 20

export interface EmployeeRef {
  id: string
  departmentId: string
}

export interface AttendanceInsertRow {
  employeeId: string
  departmentId: string
  date: string
  checkInTime: Date | null
  checkOutTime: Date | null
  status: string
  remark: string
}

export interface AttendanceSyncRepo {
  findEmployeeByNo(employeeNo: string): Promise<EmployeeRef | null>
  /** true=新增;false=唯一键冲突(幂等命中) */
  insertAttendanceIfAbsent(row: AttendanceInsertRow): Promise<boolean>
  readConfig(key: string): Promise<string | null>
  writeConfig(key: string, value: string): Promise<void>
}

export interface PersistAttendanceResult {
  inserted: number
  duplicates: number
  employeeNotFound: number
  invalidRows: number
}

export const drizzleAttendanceSyncRepo: AttendanceSyncRepo = {
  async findEmployeeByNo(employeeNo) {
    const [row] = await db
      .select({ id: hrEmployee.id, departmentId: hrEmployee.departmentId })
      .from(hrEmployee)
      .where(
        and(
          eq(hrEmployee.employeeNo, employeeNo),
          eq(hrEmployee.status, 'active'),
          isNull(hrEmployee.deletedAt),
        ),
      )
      .limit(1)
    return row ?? null
  },
  async insertAttendanceIfAbsent(row) {
    const inserted = await db
      .insert(hrAttendanceRecord)
      .values({
        employeeId: row.employeeId,
        departmentId: row.departmentId,
        date: row.date,
        checkInTime: row.checkInTime,
        checkOutTime: row.checkOutTime,
        status: row.status,
        checkInMethod: 'manual',
        checkOutMethod: 'manual',
        operatedBy: null,
        remark: row.remark,
      })
      .onConflictDoNothing()
      .returning({ id: hrAttendanceRecord.id })
    return inserted.length > 0
  },
  async readConfig(key) {
    const [row] = await db
      .select({ value: systemConfigs.value })
      .from(systemConfigs)
      .where(eq(systemConfigs.key, key))
      .limit(1)
    return row?.value ?? null
  },
  async writeConfig(key, value) {
    await db
      .insert(systemConfigs)
      .values({
        key,
        value,
        type: 'json',
        category: 'attendance-sync',
        description: '飞书/钉钉考勤同步运行状态(自动写入)',
        isPublic: false,
      })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value, updatedAt: new Date() },
      })
  },
}

/** 名册工号:user_profiles.employee_no(非空、去空白、去重),设计稿 §7.5。 */
export async function loadEmployeeNumbers(_repo: AttendanceSyncRepo): Promise<string[]> {
  const rows = await db
    .selectDistinct({ employeeNo: userProfiles.employeeNo })
    .from(userProfiles)
    .where(isNotNull(userProfiles.employeeNo))
  const seen = new Set<string>()
  for (const row of rows) {
    const no = row.employeeNo?.trim()
    if (no) seen.add(no)
  }
  return [...seen]
}

/** 钉钉人工 userid 映射:JSON `{"工号":"userid"}`;非法/缺失一律空映射。 */
export async function loadDingTalkUserIdMap(
  repo: AttendanceSyncRepo,
): Promise<Record<string, string>> {
  const raw = await repo.readConfig(DINGTALK_USERID_MAP_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') continue
      const no = key.trim()
      const userId = value.trim()
      if (no && userId) out[no] = userId
    }
    return out
  } catch {
    return {}
  }
}

function buildRemark(record: NormalizedAttendanceRecord): string {
  const parts = [
    `source=${record.provider}`,
    `externalId=${record.externalId ?? '-'}`,
    `statusRaw=${record.statusRaw ?? '-'}`,
  ]
  return `[sync] ${parts.join('; ')}`.slice(0, 500)
}

/**
 * 单条记录 → 落库值。未知枚举原样保留;列宽装不下则判 invalid,不截断冒充。
 */
export function resolveAttendanceStatus(record: NormalizedAttendanceRecord): {
  status: string | null
  reason: 'status_too_long' | 'empty' | null
} {
  const mapping = mapAttendanceStatus(record.provider, record.statusRaw)
  const status = mapping.system ?? (mapping.raw || null)
  if (!status) return { status: null, reason: 'empty' }
  if (status.length > HR_ATTENDANCE_STATUS_MAX) {
    return { status: null, reason: 'status_too_long' }
  }
  return { status, reason: null }
}

function mergeRecords(
  records: readonly NormalizedAttendanceRecord[],
): NormalizedAttendanceRecord[] {
  const merged = new Map<string, NormalizedAttendanceRecord>()
  for (const record of records) {
    const key = `${record.provider}|${record.employeeNo}|${record.date}`
    const prev = merged.get(key)
    if (!prev) {
      merged.set(key, { ...record })
      continue
    }
    merged.set(key, {
      ...prev,
      checkInTime: prev.checkInTime ?? record.checkInTime,
      checkOutTime: prev.checkOutTime ?? record.checkOutTime,
      statusRaw: prev.statusRaw ?? record.statusRaw,
      externalId: prev.externalId ?? record.externalId,
    })
  }
  return [...merged.values()]
}

/**
 * 幂等落库一轮。重复调用同一批记录:第一次 inserted,第二次 duplicates,
 * 不产生重复行(唯一索引 + onConflictDoNothing)。
 */
export async function persistAttendanceRecords(
  records: readonly NormalizedAttendanceRecord[],
  repo: AttendanceSyncRepo = drizzleAttendanceSyncRepo,
): Promise<PersistAttendanceResult> {
  const result: PersistAttendanceResult = {
    inserted: 0,
    duplicates: 0,
    employeeNotFound: 0,
    invalidRows: 0,
  }

  for (const record of mergeRecords(records)) {
    const employeeNo = record.employeeNo.trim()
    if (!employeeNo) {
      result.invalidRows += 1
      continue
    }
    const employee = await repo.findEmployeeByNo(employeeNo)
    if (!employee) {
      result.employeeNotFound += 1
      continue
    }
    const resolved = resolveAttendanceStatus(record)
    if (!resolved.status) {
      result.invalidRows += 1
      continue
    }
    if (!record.checkInTime && !record.checkOutTime && !record.statusRaw) {
      result.invalidRows += 1
      continue
    }

    const inserted = await repo.insertAttendanceIfAbsent({
      employeeId: employee.id,
      departmentId: employee.departmentId,
      date: record.date,
      checkInTime: record.checkInTime,
      checkOutTime: record.checkOutTime,
      status: resolved.status,
      remark: buildRemark(record),
    })
    if (inserted) result.inserted += 1
    else result.duplicates += 1
  }
  return result
}

export async function writeAttendanceSyncCursor(
  repo: AttendanceSyncRepo,
  provider: string,
  windowDate: string,
): Promise<void> {
  await repo.writeConfig(
    `${ATTENDANCE_SYNC_CURSOR_KEY_PREFIX}${provider}`,
    JSON.stringify({ lastSyncWindow: windowDate, updatedAt: new Date().toISOString() }),
  )
}

/** 最近一次运行快照:仅供运维巡检,不是审计流水(设计稿 §11)。 */
export async function writeAttendanceSyncLastRun(
  repo: AttendanceSyncRepo,
  result: AttendanceSyncRunResult,
): Promise<void> {
  await repo.writeConfig(ATTENDANCE_SYNC_LAST_RUN_KEY, JSON.stringify(result))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
