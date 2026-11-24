// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 飞书 provider(2026-11-13 立,打卡 kind 已实现)。
 *
 * 端点/token 见 docs/attendance-sync-api-design.md §7(唯一事实源,不在本文件罗列)。
 *
 * 实现范围:
 *   · attendance(打卡):user_tasks/query,employee_type=employee_no(工号直用,免用户映射)
 *   · leave/overtime/outgoing(审批):user_approvals/query(复数),2026-11-17 官方文档逐字段核实
 *     (端点/请求体/status 枚举/响应容器结构/30 天窗口),状态文本由请求参数确定,不猜响应字段
 */

import type { AttendanceProvider, PlatformCredentials, SyncKind, SyncRow } from './types.js'
import { AppError } from '../../errors/AppError.js'
import { resolveFeishuEmployeeNos } from './feishu-employee-source.js'

const TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
const USER_TASKS_QUERY_URL = 'https://open.feishu.cn/open-apis/attendance/v1/user_tasks/query'
const USER_APPROVALS_QUERY_URL =
  'https://open.feishu.cn/open-apis/attendance/v1/user_approvals/query'

/** token 内存缓存(单进程 cron 足够;tenant_access_token ~2h,提前 5min 刷新) */
let cachedToken: { token: string; expireAt: number } | null = null

async function getTenantAccessToken(creds: PlatformCredentials): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expireAt > now) return cachedToken.token

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: creds.appId, app_secret: creds.appSecret }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) {
    throw new AppError(
      `飞书 tenant_access_token 获取失败:HTTP ${res.status}`,
      502,
      'SYNC_FEISHU_TOKEN_HTTP',
    )
  }
  const data = (await res.json()) as {
    code: number
    msg?: string
    tenant_access_token?: string
    expire?: number
  }
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new AppError(
      `飞书 tenant_access_token 获取失败:${data.msg ?? `code ${data.code}`}`,
      502,
      'SYNC_FEISHU_TOKEN_API',
    )
  }
  // expire 单位秒;提前 5min 过期
  const ttlMs = Math.max(60, (data.expire ?? 7200) - 300) * 1000
  cachedToken = { token: data.tenant_access_token, expireAt: now + ttlMs }
  return cachedToken.token
}

/**
 * periodMonth(YYYY-MM)→ [起始 yyyyMMdd, 结束 yyyyMMdd](整月,含当月天数)。
 * 导出供测试钉住。
 */
export function monthRangeToYmdInt(periodMonth: string): { from: number; to: number } {
  const [y, m] = periodMonth.split('-').map(Number)
  const year = y ?? 1970
  const month = m ?? 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    from: Number(`${year}${pad(month)}01`),
    to: Number(`${year}${pad(month)}${pad(lastDay)}`),
  }
}

/**
 * 审批查询日期窗切片(官方硬约束:check_date_from/to 间隔不超过 30 天)。
 *
 * 整月可能是 31 天,故按 30 天一窗切;导出供测试钉住。
 */
export function approvalDateSlices(periodMonth: string): { from: number; to: number }[] {
  const [y, m] = periodMonth.split('-').map(Number)
  const year = y ?? 1970
  const month = m ?? 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  const slices: { from: number; to: number }[] = []
  for (let d = 1; d <= lastDay; d += 30) {
    const end = Math.min(d + 29, lastDay)
    slices.push({
      from: Number(`${year}${pad(month)}${pad(d)}`),
      to: Number(`${year}${pad(month)}${pad(end)}`),
    })
  }
  return slices
}

/**
 * 飞书审批状态数字枚举(2026-11-17 官方文档核实,design §7.4)。
 *
 * 0 待审批 / 1 未通过 / 2 已通过 / 3 已撤回 / 4 已撤销。
 * 请假、加班仅支持查已通过(2)和已撤回(3);外出、出差支持全部状态。
 */
export const FEISHU_APPROVAL_STATUS_TEXT: Readonly<Record<number, string>> = {
  0: '待审批',
  1: '未通过',
  2: '已通过',
  3: '已撤回',
  4: '已撤销',
}

/** 状态数字 → 中文文本;未知 → null(不臆造) */
export function feishuApprovalStatusText(status: number): string | null {
  return FEISHU_APPROVAL_STATUS_TEXT[status] ?? null
}

/** 秒级时间戳(字符串)→ HH:mm(本地时区);空/非法 → null */
function tsToHHmm(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  const d = new Date(n * 1000)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface FeishuRecord {
  check_in_record?: { check_time?: string | number } | null
  check_out_record?: { check_time?: string | number } | null
}
interface FeishuUserTaskResult {
  user_id?: string
  employee_name?: string
  day?: number
  records?: FeishuRecord[]
}
interface FeishuUserTasksResp {
  code: number
  msg?: string
  data?: { user_task_results?: FeishuUserTaskResult[] }
}

// ── 审批 user_approval/query 接口(2026-11-14 核实,见 design §7.4) ──

/** 飞书审批实例的多语言名称对象(假别等字段) */
interface FeishuI18nName {
  ch?: string
  en?: string
  ja?: string
}

/** leave 实例(飞书 user_approval/query leaves[];字段见 design §7.4 已核实清单) */
interface FeishuLeaveItem {
  /** 审批实例唯一 ID(幂等键) */
  approval_id?: string
  /** 员工 uniq_id */
  uniq_id?: string
  /** 多语言名称(含假别,如 {"ch":"事假","en":"Personal"}) */
  i18n_names?: FeishuI18nName
  /** 开始时间 yyyy-MM-dd HH:mm:ss */
  start_time?: string
  /** 结束时间 yyyy-MM-dd HH:mm:ss */
  end_time?: string
  /** 事由 */
  reason?: string
}

/** overtime 实例(字段名部分未核实 → 仅取已核实字段:approval_id/uniq_id/start_time/end_time/reason) */
interface FeishuOvertimeItem {
  approval_id?: string
  uniq_id?: string
  start_time?: string
  end_time?: string
  reason?: string
}

/** outgoing(out) 实例(字段名部分未核实 → 仅取已核实字段) */
interface FeishuOutItem {
  approval_id?: string
  uniq_id?: string
  start_time?: string
  end_time?: string
  reason?: string
  destination?: string
}

/** user_approvals/query 响应:按「员工+日期」分组的容器(官方结构) */
interface FeishuUserApprovalEntry {
  /** 员工标识(以 employee_type=employee_no 请求时即工号) */
  user_id?: string
  /** 单据作用日期 yyyyMMdd */
  date?: string
  leaves?: FeishuLeaveItem[]
  overtimes?: FeishuOvertimeItem[]
  outs?: FeishuOutItem[]
  trips?: unknown[]
}

/** user_approvals/query 响应 */
interface FeishuUserApprovalsResp {
  code: number
  msg?: string
  data?: {
    user_approvals?: FeishuUserApprovalEntry[]
  }
}

/** 飞书时间字符串(yyyy-MM-dd HH:mm:ss)→ HH:mm(取时:分);非法 → null */
function datetimeToHHmm(value: string | undefined): string | null {
  if (!value) return null
  const m = /(\d{2}):(\d{2})/.exec(value)
  return m ? `${m[1]}:${m[2]}` : null
}

/** 飞书时间字符串 → yyyy-MM-dd;非法 → null */
function datetimeToDate(value: string | undefined): string | null {
  if (!value) return null
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** 多语言名称 → 中文文本(取 ch;缺回落 en);用于 leave 假别透传 */
function i18nToText(obj: FeishuI18nName | undefined): string | null {
  if (!obj) return null
  return obj.ch ?? obj.en ?? null
}

/**
 * 拉取飞书打卡结果(attendance kind)。
 *
 * 用工号(employee_no)作为 user_ids,系统与飞书按工号对齐,免额外查用户映射。
 * 每条 user_task_result 的 records[0] 取上班(check_in)/下班(check_out)打卡时间。
 */
async function fetchAttendance(
  token: string,
  employeeNos: string[],
  periodMonth: string,
): Promise<SyncRow[]> {
  const { from, to } = monthRangeToYmdInt(periodMonth)
  // 目标工号由 resolveFeishuEmployeeNos 提供(名册全量 ∩ 可选白名单,见 feishu-employee-source.ts)。
  // 空 → 返回 0 行空批次(不报错),由调用方决定是否跳过。

  if (employeeNos.length === 0) return []

  const res = await fetch(`${USER_TASKS_QUERY_URL}?employee_type=employee_no`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      user_ids: employeeNos,
      check_date_from: from,
      check_date_to: to,
      need_overtime_result: false,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    throw new AppError(`飞书打卡结果查询失败:HTTP ${res.status}`, 502, 'SYNC_FEISHU_ATT_HTTP')
  }
  const data = (await res.json()) as FeishuUserTasksResp
  if (data.code !== 0) {
    throw new AppError(
      `飞书打卡结果查询失败:${data.msg ?? `code ${data.code}`}`,
      502,
      'SYNC_FEISHU_ATT_API',
    )
  }

  const rows: SyncRow[] = []
  for (const result of data.data?.user_task_results ?? []) {
    const rec = result.records?.[0]
    if (!result.day) continue
    // day 为 yyyyMMdd(int)→ YYYY-MM-DD
    const dayStr = String(result.day)
    const date = `${dayStr.slice(0, 4)}-${dayStr.slice(4, 6)}-${dayStr.slice(6, 8)}`
    rows.push({
      employeeNo: result.user_id ?? null,
      employeeName: result.employee_name ?? null,
      date,
      startDate: null,
      endDate: null,
      checkInTime: tsToHHmm(rec?.check_in_record?.check_time),
      checkOutTime: tsToHHmm(rec?.check_out_record?.check_time),
      typeText: null,
      durationText: null,
      totalDays: null,
      destination: null,
      reason: null,
      // 飞书 user_tasks/query 不返回迟到/早退判定 → 留空,由现有导入按打卡时间判定
      statusText: null,
      // 打卡无平台单号;record_id 在 records 内,此处不细分(判重靠日期+工号)
      externalId: null,
    })
  }
  return rows
}

/**
 * 拉取飞书审批数据(leave/overtime/outgoing kind)。
 *
 * user_approvals/query 按「员工+日期」分组返回 leaves[]/overtimes[]/outs[](官方容器结构)。
 *
 * 2026-11-17 官方文档核实口径(design §7.4):
 *   · 已核实字段:approval_id(唯一 ID)/uniq_id/i18n_names(多语言名称)/start_time/end_time/reason/destination。
 *   · check_date_from/to 间隔 ≤30 天 → approvalDateSlices 切窗。
 *   · 状态是数字单值:请假/加班仅支持 2(已通过)/3(已撤回),故两态各查一次,
 *     状态文本由请求参数确定(不读响应中未证实的字段)。
 *   · 假别(i18n_names.ch)透传中文原文,由现有 normalizeLeaveType 正则匹配(年假/事假/病假...),
 *     不写死假别枚举(企业自定义假期类型)。
 */
async function fetchApproval(
  token: string,
  employeeNos: string[],
  periodMonth: string,
  importKind: SyncKind,
): Promise<SyncRow[]> {
  if (employeeNos.length === 0) return []

  const rows: SyncRow[] = []
  for (const slice of approvalDateSlices(periodMonth)) {
    for (const status of FEISHU_APPROVAL_PULL_STATUSES) {
      rows.push(...(await queryApprovalSlice(token, employeeNos, slice, status, importKind)))
    }
  }
  return rows
}

/** 请假/加班可查询的两种已结论状态(官方:仅支持已通过、已撤回) */
const FEISHU_APPROVAL_PULL_STATUSES = [2, 3] as const

async function queryApprovalSlice(
  token: string,
  employeeNos: string[],
  slice: { from: number; to: number },
  status: number,
  importKind: SyncKind,
): Promise<SyncRow[]> {
  const res = await fetch(`${USER_APPROVALS_QUERY_URL}?employee_type=employee_no`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      user_ids: employeeNos,
      check_date_from: slice.from,
      check_date_to: slice.to,
      check_date_type: 'PeriodTime',
      status,
    }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    throw new AppError(`飞书审批查询失败:HTTP ${res.status}`, 502, 'SYNC_FEISHU_APPROVAL_HTTP')
  }
  const data = (await res.json()) as FeishuUserApprovalsResp
  if (data.code !== 0) {
    throw new AppError(
      `飞书审批查询失败:${data.msg ?? `code ${data.code}`}`,
      502,
      'SYNC_FEISHU_APPROVAL_API',
    )
  }
  return mapApprovalEntriesToRows(
    importKind,
    data.data?.user_approvals ?? [],
    feishuApprovalStatusText(status),
  )
}

/**
 * 飞书审批响应容器 → SyncRow[](纯函数,供测试直用生产实现)。
 *
 * 字段口径(2026-11-17 官方文档核实,见 design §7.4):
 *   · employeeNo 取 item.uniq_id,缺失回落 entry.user_id(以 employee_no 请求时即工号);
 *   · externalId 取 approval_id(幂等键);
 *   · leave 的 typeText 取 i18n_names 多语言名称中文(ch),透传交 normalizeLeaveType 匹配;
 *   · start_time/end_time 转日期与打卡时分;
 *   · statusText 由调用方请求的 status 决定,不读响应中未证实的字段;
 *   · overtime/outgoing 的类型/时长字段名官方响应未明示 → 留 null,不臆造;
 *   · 未知/缺失字段一律 null,不臆造。
 */
export function mapApprovalEntriesToRows(
  importKind: SyncKind,
  entries: readonly FeishuUserApprovalEntry[],
  statusText: string | null = null,
): SyncRow[] {
  const rows: SyncRow[] = []
  for (const entry of entries) {
    if (importKind === 'leave') {
      for (const item of entry.leaves ?? []) rows.push(toRow(entry, item, statusText, 'leave'))
    }
    if (importKind === 'overtime') {
      for (const item of entry.overtimes ?? []) {
        rows.push(toRow(entry, item, statusText, 'overtime'))
      }
    }
    if (importKind === 'outgoing') {
      for (const item of entry.outs ?? []) rows.push(toRow(entry, item, statusText, 'outing'))
    }
  }
  return rows
}

type FeishuApprovalItem = FeishuLeaveItem | FeishuOvertimeItem | FeishuOutItem

/** 单条审批项 → SyncRow;kind 只决定透传哪个特化字段(假别/目的地) */
function toRow(
  entry: FeishuUserApprovalEntry,
  item: FeishuApprovalItem,
  statusText: string | null,
  kind: 'leave' | 'overtime' | 'outing',
): SyncRow {
  const typeText = kind === 'leave' ? i18nToText((item as FeishuLeaveItem).i18n_names) : null
  const destination = kind === 'outing' ? ((item as FeishuOutItem).destination ?? null) : null
  return {
    employeeNo: item.uniq_id ?? entry.user_id ?? null,
    employeeName: null,
    date: datetimeToDate(item.start_time),
    startDate: datetimeToDate(item.start_time),
    endDate: datetimeToDate(item.end_time),
    checkInTime: datetimeToHHmm(item.start_time),
    checkOutTime: datetimeToHHmm(item.end_time),
    typeText,
    durationText: null,
    totalDays: null,
    destination,
    reason: item.reason ?? null,
    statusText,
    externalId: item.approval_id ?? null,
  }
}

/**
 * 飞书考勤同步 provider。
 *
 * attendance 已实现;审批三类的端点/状态枚举/容器结构已按官方文档核实(design §7.4),
 * 假别/加班/外出字段透传交现有 normalize 系列函数/人工裁决,不写死假别枚举。
 */
export const feishuProvider: AttendanceProvider = {
  source: 'feishu',

  async fetchBatch(params: {
    userId: string
    creds: PlatformCredentials
    importKind: SyncKind
    cursor: string | null
    periodMonth: string
  }): Promise<{ rows: SyncRow[]; nextCursor: string | null }> {
    const { userId, creds, importKind, cursor, periodMonth } = params

    const token = await getTenantAccessToken(creds)
    // 目标工号:名册全量 ∩ 可选白名单(见 feishu-employee-source.ts),空 → 0 行空批次
    const employeeNos = await resolveFeishuEmployeeNos(userId)

    // 审批类(leave/overtime/outgoing):走 user_approvals/query 并按 30 天窗口分片(见 design §7.4)
    if (importKind !== 'attendance') {
      const rows = await fetchApproval(token, employeeNos, periodMonth, importKind)
      return { rows, nextCursor: cursor }
    }

    const rows = await fetchAttendance(token, employeeNos, periodMonth)

    // 打卡按整月窗口拉取,无平台游标;下次游标沿用入参(增量后续接 check_date 推进)
    return { rows, nextCursor: cursor }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
