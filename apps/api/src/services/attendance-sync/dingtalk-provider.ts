// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 钉钉 provider(2026-11-13 立;2026-11-17 改走考勤数据源)。
 *
 * 端点/token 见 docs/attendance-sync-api-design.md §7(唯一事实源)。
 *
 * 与飞书的关键差异(§7.2/§7.3):
 *   · 钉钉 attendance/list 只认**平台 userid**(userIdList),不支持直接用工号 →
 *     拉取前须有「工号↔userid」映射。本仓 im_adapters 无成员表,故映射存
 *     system_configs(人工维护 JSON:{"工号":"userid"}),不引入通讯录拉取依赖。
 *   · attendance/list 单次时间窗 ≤7 天 → 整月按 7 天分片多次拉取。
 *   · userCheckTime 为毫秒时间戳。
 *
 * 审批三类(leave/overtime/outgoing)**不再走审批实例接口**,改走考勤数据源
 * (2026-11-17 实测定性,详见 §7.4):
 *   · 新版审批实例详情不带表单业务字段;旧版 topapi/processinstance/get 才带
 *     form_component_values,但其权限点在本企业应用权限列表中不存在可申请项。
 *   · 请假:topapi/attendance/getleavestatus(已通过请假的时间段+时长,
 *     响应示例含 leave_code)+ topapi/attendance/vacation/type/list(假别映射)。
 *   · 加班/外出/出差:topapi/attendance/getcolumnval 的考勤报表列值
 *     (加班-工作日/休息日/节假日、出差时长、外出时长),按人按日取值。
 *     列 id 运行时由 getattcolumns 按 alias 解析,模板变更时自动跟随。
 */

import type { AttendanceProvider, PlatformCredentials, SyncKind, SyncRow } from './types.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { systemConfigs } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'

const TOKEN_URL = 'https://oapi.dingtalk.com/gettoken'
const ATTENDANCE_LIST_URL = 'https://oapi.dingtalk.com/attendance/list'
const ATT_COLUMNS_URL = 'https://oapi.dingtalk.com/topapi/attendance/getattcolumns'
const COLUMN_VAL_URL = 'https://oapi.dingtalk.com/topapi/attendance/getcolumnval'
const LEAVE_STATUS_URL = 'https://oapi.dingtalk.com/topapi/attendance/getleavestatus'
const VACATION_TYPE_URL = 'https://oapi.dingtalk.com/topapi/attendance/vacation/type/list'

/** 报表列 alias(2026-11-17 实测本企业 getattcolumns 返回的 47 列中的相关列) */
export const APPROVAL_COLUMN_ALIAS = {
  overtimeWorkday: 'overtime_工作日加班',
  overtimeRestday: 'overtime_休息日加班',
  overtimeHoliday: 'overtime_节假日加班',
  businessTrip: 'business_trip_time',
  out: 'out_time',
} as const

/** 列 id 兜底值:getattcolumns 取不到 alias 时使用(本企业实测值) */
const FALLBACK_COLUMN_IDS: Record<string, number> = {
  [APPROVAL_COLUMN_ALIAS.overtimeWorkday]: 1220189021,
  [APPROVAL_COLUMN_ALIAS.overtimeRestday]: 1220189022,
  [APPROVAL_COLUMN_ALIAS.overtimeHoliday]: 1220189023,
  [APPROVAL_COLUMN_ALIAS.businessTrip]: 1220189017,
  [APPROVAL_COLUMN_ALIAS.out]: 1220189018,
}

/** 钉钉 access_token 内存缓存(7200s,提前 5min 刷新;按 appId 区分) */
const tokenCache = new Map<string, { token: string; expireAt: number }>()

async function getAccessToken(creds: PlatformCredentials): Promise<string> {
  const now = Date.now()
  const cached = tokenCache.get(creds.appId)
  if (cached && cached.expireAt > now) return cached.token

  const url = new URL(TOKEN_URL)
  url.searchParams.set('appkey', creds.appId)
  url.searchParams.set('appsecret', creds.appSecret)
  const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(15_000) })
  if (!res.ok) {
    throw new AppError(
      `钉钉 access_token 获取失败:HTTP ${res.status}`,
      502,
      'SYNC_DINGTALK_TOKEN_HTTP',
    )
  }
  const data = (await res.json()) as {
    errcode: number
    errmsg?: string
    access_token?: string
    expires_in?: number
  }
  if (data.errcode !== 0 || !data.access_token) {
    throw new AppError(
      `钉钉 access_token 获取失败:${data.errmsg ?? `errcode ${data.errcode}`}`,
      502,
      'SYNC_DINGTALK_TOKEN_API',
    )
  }
  const ttlMs = Math.max(60, (data.expires_in ?? 7200) - 300) * 1000
  tokenCache.set(creds.appId, { token: data.access_token, expireAt: now + ttlMs })
  return data.access_token
}

/** 工号→userid 映射键(system_configs,人工维护 JSON:{"工号":"userid"}) */
function useridMapKey(userId: string): string {
  return `sync:dingtalk:userid-map:${userId}`
}

/** 读人工维护的工号→userid 映射;未配置 → 空表(返回 0 行,不报错) */
async function loadUseridMap(userId: string): Promise<Record<string, string>> {
  const [row] = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, useridMapKey(userId)))
    .limit(1)
  if (!row?.value) return {}
  try {
    const parsed = JSON.parse(row.value) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    // 配置非法 → 视为空(诊断由 cron 侧记日志),不静默崩溃
  }
  return {}
}

/** 统一 POST topapi:非 HTTP 200 与非 errcode 0 都按 502 抛出(错误码后缀区分来源) */
type TopapiEnvelope = { errcode?: number; errmsg?: string }

async function postTopapi<T>(
  url: string,
  token: string,
  body: unknown,
  code: string,
): Promise<T & TopapiEnvelope> {
  const res = await fetch(`${url}?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    throw new AppError(`钉钉接口请求失败:HTTP ${res.status}`, 502, `${code}_HTTP`)
  }
  const data = (await res.json()) as T & TopapiEnvelope
  if (data.errcode !== 0) {
    throw new AppError(
      `钉钉接口返回失败:${data.errmsg ?? `errcode ${data.errcode}`}`,
      502,
      `${code}_API`,
    )
  }
  return data
}

/**
 * 整月(YYYY-MM)按 ≤7 天切片 → [from,to](yyyy-MM-dd HH:mm:ss)序列。
 * 导出供测试钉住(钉钉 attendance/list 单次时间窗硬约束 ≤7 天)。
 */
export function monthSlices(periodMonth: string): { from: string; to: string }[] {
  const [y, m] = periodMonth.split('-').map(Number)
  const year = y ?? 1970
  const month = m ?? 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const slices: { from: string; to: string }[] = []
  for (let d = 1; d <= lastDay; d += 7) {
    const end = Math.min(d + 6, lastDay)
    slices.push({
      from: `${year}-${pad(month)}-${pad(d)} 00:00:00`,
      to: `${year}-${pad(month)}-${pad(end)} 00:00:00`,
    })
  }
  return slices
}

/**
 * 整月(YYYY-MM)按 ≤30 天切片 → [from,to](yyyy-MM-dd HH:mm:ss)序列。
 * getcolumnval 的窗口上限是 31 天,31 天月份若整月一窗恰好顶满边界,
 * 故按 30 天切(31 天月 → 两窗)。导出供测试钉住。
 */
export function columnDateSlices(periodMonth: string): { from: string; to: string }[] {
  const [y, m] = periodMonth.split('-').map(Number)
  const year = y ?? 1970
  const month = m ?? 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const slices: { from: string; to: string }[] = []
  for (let d = 1; d <= lastDay; d += 30) {
    const end = Math.min(d + 29, lastDay)
    slices.push({
      from: `${year}-${pad(month)}-${pad(d)} 00:00:00`,
      to: `${year}-${pad(month)}-${pad(end)} 23:59:59`,
    })
  }
  return slices
}

/** 整月的本地时区毫秒区间(getleavestatus 用)[startMs,endMs] */
export function monthRangeMs(periodMonth: string): { startMs: number; endMs: number } {
  const [y, m] = periodMonth.split('-').map(Number)
  const year = y ?? 1970
  const month = m ?? 1
  const startMs = new Date(year, month - 1, 1, 0, 0, 0, 0).getTime()
  const endMs = new Date(year, month, 1, 0, 0, 0, 0).getTime() - 1
  return { startMs, endMs }
}

/** 毫秒时间戳 → HH:mm(本地时区);空/非法 → null */
function msToHHmm(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const d = new Date(value)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 毫秒时间戳 → YYYY-MM-DD(本地时区);空/非法 → null */
export function msToDate(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const d = new Date(value)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface DingRecord {
  checkType?: string
  userCheckTime?: number
  workDate?: number
  userId?: string
}
interface DingListResp {
  errcode: number
  errmsg?: string
  recordresult?: DingRecord[]
  hasMore?: boolean
}

/**
 * 拉取钉钉打卡结果(attendance kind)。
 *
 * 钉钉只认 userid:employeeNoToUserid 把工号转 userid 再查 attendance/list。
 * 映射未配置 → 0 行(空批次,不报错)。同一天同一人 OnDuty/OffDuty 归并为一行。
 */
async function fetchAttendance(
  token: string,
  employeeNoToUserid: Record<string, string>,
  periodMonth: string,
): Promise<SyncRow[]> {
  const entries = Object.entries(employeeNoToUserid)
  if (entries.length === 0) return []

  const byKey = new Map<
    string,
    { employeeNo: string; date: string; on: string | null; off: string | null }
  >()
  const useridToEmployeeNo = new Map(entries.map(([no, uid]) => [uid, no]))

  for (const slice of monthSlices(periodMonth)) {
    const res = await fetch(`${ATTENDANCE_LIST_URL}?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workDateFrom: slice.from,
        workDateTo: slice.to,
        userIdList: entries.map(([, uid]) => uid),
        offset: 0,
        limit: 50,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) {
      throw new AppError(`钉钉打卡结果查询失败:HTTP ${res.status}`, 502, 'SYNC_DINGTALK_ATT_HTTP')
    }
    const data = (await res.json()) as DingListResp
    if (data.errcode !== 0) {
      throw new AppError(
        `钉钉打卡结果查询失败:${data.errmsg ?? `errcode ${data.errcode}`}`,
        502,
        'SYNC_DINGTALK_ATT_API',
      )
    }
    for (const rec of data.recordresult ?? []) {
      if (!rec.workDate || !rec.userId) continue
      const employeeNo = useridToEmployeeNo.get(rec.userId)
      if (!employeeNo) continue
      const wd = String(rec.workDate)
      const date = `${wd.slice(0, 4)}-${wd.slice(4, 6)}-${wd.slice(6, 8)}`
      const key = `${employeeNo}|${date}`
      const existing = byKey.get(key) ?? { employeeNo, date, on: null, off: null }
      const hhmm = msToHHmm(rec.userCheckTime)
      if (rec.checkType === 'OnDuty' && hhmm && !existing.on) existing.on = hhmm
      if (rec.checkType === 'OffDuty' && hhmm && !existing.off) existing.off = hhmm
      byKey.set(key, existing)
    }
  }

  return Array.from(byKey.values()).map((v) => ({
    employeeNo: v.employeeNo,
    employeeName: null,
    date: v.date,
    startDate: null,
    endDate: null,
    checkInTime: v.on,
    checkOutTime: v.off,
    typeText: null,
    durationText: null,
    totalDays: null,
    destination: null,
    reason: null,
    statusText: null,
    externalId: null,
  }))
}

interface AttColumn {
  id?: number
  name?: string
  alias?: string
}
interface AttColumnsResp {
  result?: { columns?: AttColumn[] }
}

/** 审批类 alias 值集合(alias → 是否本层关心的列) */
const APPROVAL_ALIAS_VALUES = new Set<string>(Object.values(APPROVAL_COLUMN_ALIAS))

/** 从 getattcolumns 结果里挑出审批类列:alias → {id,name}(无 id 的列视为不可取,丢弃) */
export function pickApprovalColumns(columns: AttColumn[]): Map<string, { id: number; name: string }> {
  const picked = new Map<string, { id: number; name: string }>()
  for (const col of columns) {
    const alias = col.alias?.trim()
    if (!alias) continue
    if (!APPROVAL_ALIAS_VALUES.has(alias)) continue
    if (typeof col.id === 'number' && col.id > 0) {
      picked.set(alias, { id: col.id, name: col.name ?? alias })
    }
  }
  return picked
}

/** 取审批类列 id 映射:优先按 alias 解析;解析不到 → 兜底常量 */
async function resolveApprovalColumns(token: string): Promise<Map<string, { id: number; name: string }>> {
  const data = await postTopapi<AttColumnsResp>(ATT_COLUMNS_URL, token, {}, 'SYNC_DINGTALK_COLUMNS')
  const picked = pickApprovalColumns(data.result?.columns ?? [])
  for (const [alias, fallbackId] of Object.entries(FALLBACK_COLUMN_IDS)) {
    if (!picked.has(alias)) picked.set(alias, { id: fallbackId, name: alias })
  }
  return picked
}

interface ColumnValItem {
  date?: string
  value?: string
}
interface ColumnValGroup {
  column_vals?: ColumnValItem[]
  column_vo?: { id?: number; name?: string; fixed_value?: string }
}
interface ColumnValResp {
  result?: { column_vals?: ColumnValGroup[] }
}

/** 数值化:空串/非数字 → null */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * 把单个人某一月的考勤报表列值映射成 SyncRow。
 *
 * overtime: 加班列(工作日/休息日/节假日,单位天) → typeText「加班(工作日加班)」等
 * outgoing: 出差时长(天)/外出时长(小时) → typeText「出差」「外出」
 *
 * 只输出 value > 0 的日期(报表对无记录的日期返回 "0.0" 或空串)。
 * 导出供测试钉住。
 */
export function mapColumnValuesToRows(
  kind: 'overtime' | 'outgoing',
  employeeNo: string,
  group: ColumnValGroup,
  column: { id: number; name: string },
): SyncRow[] {
  const isTrip = kind === 'outgoing' && column.name.includes('出差')
  const isDayUnit = kind === 'overtime' || isTrip
  const columnId = column.id
  const columnsName = column.name
  const vals = group.column_vals ?? []
  const rows: SyncRow[] = []
  for (const item of vals) {
    const date = item.date?.slice(0, 10) ?? null
    const n = toNumber(item.value)
    if (!date || n === null || n <= 0) continue
    rows.push({
      employeeNo,
      employeeName: null,
      date,
      startDate: null,
      endDate: null,
      checkInTime: null,
      checkOutTime: null,
      typeText: kind === 'overtime' ? `加班(${columnsName})` : isTrip ? '出差' : '外出',
      durationText: isDayUnit ? `${n}天` : `${n}小时`,
      totalDays: isDayUnit ? String(n) : null,
      destination: null,
      reason: null,
      statusText: '已通过(考勤报表统计)',
      externalId: `report:${columnId}:${date}`,
    })
  }
  return rows
}

/**
 * 按人拉「考勤报表列值」并映射成行(overtime/outgoing)。
 *
 * 映射未配置 → 0 行。列 id 由调用方解析后传入(alias → id)。
 */
async function fetchColumnRows(
  token: string,
  employeeNoToUserid: Record<string, string>,
  periodMonth: string,
  kind: 'overtime' | 'outgoing',
  columns: Map<string, { id: number; name: string }>,
): Promise<SyncRow[]> {
  const aliasList =
    kind === 'overtime'
      ? [
          APPROVAL_COLUMN_ALIAS.overtimeWorkday,
          APPROVAL_COLUMN_ALIAS.overtimeRestday,
          APPROVAL_COLUMN_ALIAS.overtimeHoliday,
        ]
      : [APPROVAL_COLUMN_ALIAS.businessTrip, APPROVAL_COLUMN_ALIAS.out]
  const picked = aliasList
    .map((alias) => columns.get(alias))
    .filter((v): v is { id: number; name: string } => Boolean(v))
  if (picked.length === 0) return []

  const entries = Object.entries(employeeNoToUserid)
  if (entries.length === 0) return []

  const rows: SyncRow[] = []
  for (const [employeeNo, userid] of entries) {
    for (const slice of columnDateSlices(periodMonth)) {
      const data = await postTopapi<ColumnValResp>(
        COLUMN_VAL_URL,
        token,
        {
          userid,
          column_id_list: picked.map((c) => c.id).join(','),
          from_date: slice.from,
          to_date: slice.to,
        },
        'SYNC_DINGTALK_COLUMNVAL',
      )
      for (const group of data.result?.column_vals ?? []) {
        const colId = group.column_vo?.id
        const col = picked.find((c) => c.id === colId)
        if (!col) continue
        rows.push(...mapColumnValuesToRows(kind, employeeNo, group, col))
      }
    }
  }
  return rows
}

interface LeaveStatusItem {
  userid?: string
  start_time?: number
  end_time?: number
  duration_percent?: number
  duration_unit?: string
  leave_code?: string
}
interface LeaveStatusResp {
  result?: { has_more?: boolean; leave_status?: LeaveStatusItem[] }
}
interface VacationTypeItem {
  leave_code?: string
  leave_name?: string
}
interface VacationTypeResp {
  result?: VacationTypeItem[]
}

/**
 * 请假状态项 → SyncRow。
 *
 * duration_unit: percent_day(百分之一天)/percent_hour(百分之一小时)。
 * leave_code → 假别名由 vacation/type/list 映射;取不到 → typeText null(不猜)。
 * 导出供测试钉住。
 */
export function mapLeaveStatusToRows(
  items: LeaveStatusItem[],
  useridToEmployeeNo: Map<string, string>,
  leaveNameByCode: Map<string, string>,
): SyncRow[] {
  const rows: SyncRow[] = []
  for (const item of items) {
    const employeeNo = item.userid ? useridToEmployeeNo.get(item.userid) : undefined
    if (!employeeNo) continue
    const date = msToDate(item.start_time)
    if (!date) continue
    const leaveCode = item.leave_code
    const typeText = leaveCode ? (leaveNameByCode.get(leaveCode) ?? null) : null
    const percent = toNumber(item.duration_percent)
    const unit = item.duration_unit
    const isDay = unit === 'percent_day'
    const amount = percent === null ? null : percent / 100
    rows.push({
      employeeNo,
      employeeName: null,
      date,
      startDate: date,
      endDate: msToDate(item.end_time),
      checkInTime: msToHHmm(item.start_time),
      checkOutTime: msToHHmm(item.end_time),
      typeText,
      durationText:
        amount === null ? null : isDay ? `${amount}天` : `${amount}小时`,
      totalDays: amount !== null && isDay ? String(amount) : null,
      destination: null,
      reason: null,
      statusText: '已通过',
      externalId: `leave:${item.userid}:${item.start_time}`,
    })
  }
  return rows
}

/** 拉请假状态(getleavestatus):userid 分批 ≤100,每批 offset 翻页 size ≤20 */
async function fetchLeaveRows(
  token: string,
  employeeNoToUserid: Record<string, string>,
  periodMonth: string,
): Promise<SyncRow[]> {
  const entries = Object.entries(employeeNoToUserid)
  if (entries.length === 0) return []
  const useridToEmployeeNo = new Map(entries.map(([no, uid]) => [uid, no]))
  const { startMs, endMs } = monthRangeMs(periodMonth)

  // 假别映射:vacation/type/list 需 op_userid(取首个映射 userid);失败 → 空表不阻断
  const leaveNameByCode = new Map<string, string>()
  const opUserid = entries[0]?.[1]
  if (opUserid) {
    try {
      const types = await postTopapi<VacationTypeResp>(
        VACATION_TYPE_URL,
        token,
        { op_userid: opUserid },
        'SYNC_DINGTALK_VACATION_TYPE',
      )
      for (const t of types.result ?? []) {
        if (t.leave_code && t.leave_name) leaveNameByCode.set(t.leave_code, t.leave_name)
      }
    } catch {
      // 假别映射失败不阻断取数:typeText 留 null,由 normalizeLeaveType 兜底
    }
  }

  const rows: SyncRow[] = []
  const userids = entries.map(([, uid]) => uid)
  for (let i = 0; i < userids.length; i += 100) {
    const chunk = userids.slice(i, i + 100)
    let offset = 0
    for (let guard = 0; guard < 200; guard += 1) {
      const data = await postTopapi<LeaveStatusResp>(
        LEAVE_STATUS_URL,
        token,
        { userid_list: chunk.join(','), start_time: startMs, end_time: endMs, offset, size: 20 },
        'SYNC_DINGTALK_LEAVE',
      )
      const items = data.result?.leave_status ?? []
      rows.push(...mapLeaveStatusToRows(items, useridToEmployeeNo, leaveNameByCode))
      if (!data.result?.has_more || items.length === 0) break
      offset += items.length
    }
  }
  return rows
}

/**
 * 钉钉考勤同步 provider。
 *
 * attendance:打卡结果;leave:请假状态;overtime/outgoing:考勤报表列值。
 * 审批实例接口不带业务字段(§7.4),故不再走审批通道。
 */
export const dingtalkProvider: AttendanceProvider = {
  source: 'dingtalk',

  async fetchBatch(params: {
    userId: string
    creds: PlatformCredentials
    importKind: SyncKind
    cursor: string | null
    periodMonth: string
  }): Promise<{ rows: SyncRow[]; nextCursor: string | null }> {
    const { userId, creds, importKind, cursor, periodMonth } = params

    const token = await getAccessToken(creds)
    const employeeNoToUserid = await loadUseridMap(userId)

    if (importKind === 'attendance') {
      const rows = await fetchAttendance(token, employeeNoToUserid, periodMonth)
      return { rows, nextCursor: cursor }
    }

    if (importKind === 'leave') {
      const rows = await fetchLeaveRows(token, employeeNoToUserid, periodMonth)
      return { rows, nextCursor: cursor }
    }

    // overtime / outgoing:走考勤报表列值
    if (Object.keys(employeeNoToUserid).length === 0) return { rows: [], nextCursor: cursor }
    const columns = await resolveApprovalColumns(token)
    const rows = await fetchColumnRows(token, employeeNoToUserid, periodMonth, importKind, columns)
    return { rows, nextCursor: cursor }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
