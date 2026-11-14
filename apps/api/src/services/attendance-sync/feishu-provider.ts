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
 *   · leave/overtime/outgoing(审批):user_approval/query 端点已核实,枚举映射待补,暂抛未实现
 */

import type { AttendanceProvider, PlatformCredentials, SyncKind, SyncRow } from './types.js'
import { AppError } from '../../errors/AppError.js'
import { resolveFeishuEmployeeNos } from './feishu-employee-source.js'

const TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'
const USER_TASKS_QUERY_URL = 'https://open.feishu.cn/open-apis/attendance/v1/user_tasks/query'

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
 * 飞书考勤同步 provider。
 *
 * attendance 已实现;审批三类端点已核实但枚举映射待补,暂抛 NOT_IMPLEMENTED(501)。
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

    // 审批类:端点已核实(user_approval/query),枚举/分页/模板过滤待补 → 显式未实现
    if (importKind !== 'attendance') {
      throw new AppError(
        `飞书 ${importKind} 同步尚未实现(审批枚举映射待补,见 attendance-sync 设计 §7.4)`,
        501,
        'SYNC_FEISHU_APPROVAL_NOT_IMPLEMENTED',
      )
    }

    const token = await getTenantAccessToken(creds)
    // 目标工号:名册全量 ∩ 可选白名单(见 feishu-employee-source.ts),空 → 0 行空批次
    const employeeNos = await resolveFeishuEmployeeNos(userId)
    const rows = await fetchAttendance(token, employeeNos, periodMonth)

    // 打卡按整月窗口拉取,无平台游标;下次游标沿用入参(增量后续接 check_date 推进)
    return { rows, nextCursor: cursor }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
