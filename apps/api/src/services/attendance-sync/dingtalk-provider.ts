// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 考勤同步器 — 钉钉 provider(2026-11-13 立,打卡 kind 已实现)。
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
 * 实现范围:attendance(打卡)已实现;leave/overtime/outgoing(审批)端点已核实,
 * 枚举映射待补,暂抛未实现。
 */

import type { AttendanceProvider, PlatformCredentials, SyncKind, SyncRow } from './types.js'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { systemConfigs } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'

const TOKEN_URL = 'https://oapi.dingtalk.com/gettoken'
const ATTENDANCE_LIST_URL = 'https://oapi.dingtalk.com/attendance/list'

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

/**
 * 整月(YYYY-MM)按 ≤7 天切片 → [from,to](yyyy-MM-dd HH:mm:ss)序列。
 * 导出供测试钉住(钉钉单次时间窗硬约束 ≤7 天)。
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

/** 毫秒时间戳 → HH:mm(本地时区);空/非法 → null */
function msToHHmm(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const d = new Date(value)
  const pad = (x: number) => String(x).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
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

/**
 * 钉钉考勤同步 provider。
 *
 * attendance 已实现;审批三类端点已核实但枚举映射待补,暂抛 NOT_IMPLEMENTED(501)。
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

    if (importKind !== 'attendance') {
      throw new AppError(
        `钉钉 ${importKind} 同步尚未实现(审批枚举映射待补,见 attendance-sync 设计 §7.4)`,
        501,
        'SYNC_DINGTALK_APPROVAL_NOT_IMPLEMENTED',
      )
    }

    const token = await getAccessToken(creds)
    const employeeNoToUserid = await loadUseridMap(userId)
    const rows = await fetchAttendance(token, employeeNoToUserid, periodMonth)

    // 打卡按整月窗口分片拉取,无平台游标;下次游标沿用入参
    return { rows, nextCursor: cursor }
  },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
