// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 飞书/钉钉考勤(打卡)只读拉取适配器(2026-11-14 立)。
 *
 * 端点与入参以设计稿 §7 为唯一事实源:
 * - 飞书 `POST /open-apis/attendance/v1/user_tasks/query`,employee_type=employee_no;
 * - 钉钉 `POST /attendance/list`,只认平台 userid,故必须由人工映射表提供 userId。
 *
 * 凭证只从环境变量读取,任何错误消息都不回显 secret/token。
 */

import type {
  AttendanceSyncProviderId,
  NormalizedAttendanceRecord,
} from './attendance-sync-types.js'
import { parsePlatformDateTime } from './attendance-sync-types.js'

export interface AttendancePullInput {
  /** 业务日 YYYY-MM-DD */
  date: string
  /** 名册工号(飞书直接用作 user_ids) */
  employeeNos: string[]
  /** 工号 → 钉钉 userId(人工维护映射;飞书忽略) */
  userIdMap: Record<string, string>
}

export interface AttendanceSyncProvider {
  readonly id: AttendanceSyncProviderId
  isConfigured(env?: NodeJS.ProcessEnv): boolean
  pullAttendance(input: AttendancePullInput): Promise<NormalizedAttendanceRecord[]>
}

export interface ProviderEnv {
  FEISHU_APP_ID?: string
  FEISHU_APP_SECRET?: string
  FEISHU_API_BASE?: string
  DINGTALK_APPKEY?: string
  DINGTALK_APPSECRET?: string
  DINGTALK_APP_KEY?: string
  DINGTALK_APP_SECRET?: string
  DINGTALK_API_BASE?: string
}

const HTTP_TIMEOUT_MS = 15_000
const TOKEN_LEEWAY_MS = 5 * 60 * 1000
const BATCH_SIZE = 50
const DINGTALK_MAX_PAGES = 20

interface CachedToken {
  token: string
  expiresAtMs: number
}

const tokenCache: Record<AttendanceSyncProviderId, CachedToken | null> = {
  feishu: null,
  dingtalk: null,
}

function readEnv(env: NodeJS.ProcessEnv): ProviderEnv {
  return {
    FEISHU_APP_ID: env.FEISHU_APP_ID,
    FEISHU_APP_SECRET: env.FEISHU_APP_SECRET,
    FEISHU_API_BASE: env.FEISHU_API_BASE,
    DINGTALK_APPKEY: env.DINGTALK_APPKEY,
    DINGTALK_APPSECRET: env.DINGTALK_APPSECRET,
    DINGTALK_APP_KEY: env.DINGTALK_APP_KEY,
    DINGTALK_APP_SECRET: env.DINGTALK_APP_SECRET,
    DINGTALK_API_BASE: env.DINGTALK_API_BASE,
  }
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text : null
}

function errorSummary(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  return (text || 'unknown error').slice(0, 300)
}

async function readJson(res: Response, label: string): Promise<Record<string, unknown>> {
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`)
  const json: unknown = await res.json().catch(() => null)
  const obj = asRecord(json)
  if (!obj) throw new Error(`${label} returned non-object JSON`)
  return obj
}

function formatDate(date: string): string {
  return date.replaceAll('-', '')
}

/** 飞书 tenant_access_token(历史版内部应用接口,设计稿 §7.1)。 */
async function getFeishuToken(env: ProviderEnv, fetchImpl: typeof fetch): Promise<string> {
  const cached = tokenCache.feishu
  if (cached && cached.expiresAtMs - TOKEN_LEEWAY_MS > Date.now()) return cached.token

  const appId = env.FEISHU_APP_ID?.trim()
  const appSecret = env.FEISHU_APP_SECRET?.trim()
  if (!appId || !appSecret) throw new Error('feishu credentials missing')
  const base = env.FEISHU_API_BASE?.trim() || 'https://open.feishu.cn'

  const res = await fetchImpl(`${base}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  const json = await readJson(res, 'feishu token')
  const token = asString(json.tenant_access_token)
  const code = typeof json.code === 'number' ? json.code : -1
  if (code !== 0 || !token) throw new Error(`feishu token rejected (code=${code})`)
  const expireSec = typeof json.expire === 'number' ? json.expire : 7200
  tokenCache.feishu = { token, expiresAtMs: Date.now() + expireSec * 1000 }
  return token
}

/** 钉钉 access_token(设计稿 §7.2)。 */
async function getDingTalkToken(env: ProviderEnv, fetchImpl: typeof fetch): Promise<string> {
  const cached = tokenCache.dingtalk
  if (cached && cached.expiresAtMs - TOKEN_LEEWAY_MS > Date.now()) return cached.token

  const appKey = (env.DINGTALK_APPKEY ?? env.DINGTALK_APP_KEY)?.trim()
  const appSecret = (env.DINGTALK_APPSECRET ?? env.DINGTALK_APP_SECRET)?.trim()
  if (!appKey || !appSecret) throw new Error('dingtalk credentials missing')
  const base = env.DINGTALK_API_BASE?.trim() || 'https://oapi.dingtalk.com'

  const url = `${base}/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
  const json = await readJson(res, 'dingtalk token')
  const token = asString(json.access_token)
  const errcode = typeof json.errcode === 'number' ? json.errcode : -1
  if (errcode !== 0 || !token) throw new Error(`dingtalk token rejected (errcode=${errcode})`)
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : 7200
  tokenCache.dingtalk = { token, expiresAtMs: Date.now() + expiresIn * 1000 }
  return token
}

function dayFromFeishu(raw: unknown, fallback: string): string {
  if (typeof raw === 'number') {
    const text = String(raw)
    if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  }
  const text = asString(raw)
  if (text && /^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  }
  return fallback
}

function createFeishuProvider(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): AttendanceSyncProvider {
  const cfg = readEnv(env)
  return {
    id: 'feishu',
    isConfigured: () => Boolean(cfg.FEISHU_APP_ID?.trim() && cfg.FEISHU_APP_SECRET?.trim()),
    async pullAttendance(input) {
      const employeeNos = [...new Set(input.employeeNos.map((n) => n.trim()).filter(Boolean))]
      if (employeeNos.length === 0) return []

      const token = await getFeishuToken(cfg, fetchImpl)
      const base = cfg.FEISHU_API_BASE?.trim() || 'https://open.feishu.cn'
      const out: NormalizedAttendanceRecord[] = []

      for (const batch of chunk(employeeNos, BATCH_SIZE)) {
        const res = await fetchImpl(
          `${base}/open-apis/attendance/v1/user_tasks/query?employee_type=employee_no`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              user_ids: batch,
              check_date_from: Number(formatDate(input.date)),
              check_date_to: Number(formatDate(input.date)),
              need_overtime_result: false,
            }),
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
          },
        )
        const json = await readJson(res, 'feishu attendance query')
        const code = typeof json.code === 'number' ? json.code : -1
        if (code !== 0) throw new Error(`feishu attendance query rejected (code=${code})`)

        const data = asRecord(json.data)
        for (const raw of asArray(data?.user_task_results)) {
          const task = asRecord(raw)
          if (!task) continue
          const employeeNo = asString(task.employee_no) ?? asString(task.user_id)
          if (!employeeNo) continue
          const date = dayFromFeishu(task.day, input.date)

          for (const rawRecord of asArray(task.records)) {
            const record = asRecord(rawRecord)
            if (!record) continue
            const checkIn = asRecord(record.check_in_record)
            const checkOut = asRecord(record.check_out_record)
            const checkInTime = parsePlatformDateTime(checkIn?.check_time)
            const checkOutTime = parsePlatformDateTime(checkOut?.check_time)
            // 上下班两个原始状态都保留(去重后以 / 连接):单取一个会静默丢掉早退/迟到。
            const statuses = [
              asString(checkIn?.check_result),
              asString(checkOut?.check_result),
            ].filter((s): s is string => Boolean(s))
            const statusRaw = statuses.length > 0 ? [...new Set(statuses)].join('/') : null
            const externalId =
              asString(record.check_in_record_id) ?? asString(record.check_out_record_id)
            if (!checkInTime && !checkOutTime && !statusRaw) continue
            out.push({
              provider: 'feishu',
              employeeNo,
              date,
              checkInTime,
              checkOutTime,
              statusRaw,
              externalId,
            })
          }
        }
      }
      return out
    },
  }
}

function createDingTalkProvider(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): AttendanceSyncProvider {
  const cfg = readEnv(env)
  return {
    id: 'dingtalk',
    isConfigured: () =>
      Boolean(
        (cfg.DINGTALK_APPKEY ?? cfg.DINGTALK_APP_KEY)?.trim() &&
          (cfg.DINGTALK_APPSECRET ?? cfg.DINGTALK_APP_SECRET)?.trim(),
      ),
    async pullAttendance(input) {
      const reverse = new Map<string, string>()
      for (const [employeeNo, userId] of Object.entries(input.userIdMap)) {
        const no = employeeNo.trim()
        const id = userId.trim()
        if (no && id) reverse.set(id, no)
      }
      const userIds = [...reverse.keys()]
      // 未配置映射 → 0 行空批次,不报错(设计稿 §7.3 已拍板方案 2)。
      if (userIds.length === 0) return []

      const token = await getDingTalkToken(cfg, fetchImpl)
      const base = cfg.DINGTALK_API_BASE?.trim() || 'https://oapi.dingtalk.com'
      const url = `${base}/attendance/list?access_token=${encodeURIComponent(token)}`
      const grouped = new Map<string, NormalizedAttendanceRecord>()

      for (const batch of chunk(userIds, BATCH_SIZE)) {
        for (let page = 0; page < DINGTALK_MAX_PAGES; page += 1) {
          const res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workDateFrom: `${input.date} 00:00:00`,
              workDateTo: `${input.date} 23:59:59`,
              userIdList: batch,
              offset: page * BATCH_SIZE,
              limit: BATCH_SIZE,
            }),
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
          })
          const json = await readJson(res, 'dingtalk attendance list')
          const errcode = typeof json.errcode === 'number' ? json.errcode : -1
          if (errcode !== 0) throw new Error(`dingtalk attendance list rejected (errcode=${errcode})`)

          const rows = asArray(json.recordresult)
          for (const raw of rows) {
            const row = asRecord(raw)
            if (!row) continue
            const userId = asString(row.userId)
            const employeeNo = userId ? reverse.get(userId) : undefined
            if (!userId || !employeeNo) continue
            const workDate = asString(row.workDate)?.slice(0, 10) ?? input.date
            const key = `${employeeNo}|${workDate}`
            const checkTime = parsePlatformDateTime(row.userCheckTime)
            const checkType = (asString(row.checkType) ?? '').toLowerCase()
            const statusRaw = asString(row.timeResult)
            const externalId = `${userId}:${workDate}`

            const prev = grouped.get(key)
            const next: NormalizedAttendanceRecord = prev ?? {
              provider: 'dingtalk',
              employeeNo,
              date: workDate,
              checkInTime: null,
              checkOutTime: null,
              statusRaw: null,
              externalId,
            }
            if (checkType === 'onduty' && checkTime) next.checkInTime = checkTime
            if (checkType === 'offduty' && checkTime) next.checkOutTime = checkTime
            // 同一天可能同时有 Normal(上班)与 Early(下班):两个原值都保留,
            // 以 / 连接后交给映射层;不在这里按"严重度"猜一个。
            if (statusRaw) {
              if (!next.statusRaw) next.statusRaw = statusRaw
              else if (
                next.statusRaw !== statusRaw &&
                !next.statusRaw.split('/').includes(statusRaw)
              ) {
                next.statusRaw = `${next.statusRaw}/${statusRaw}`
              }
            }
            grouped.set(key, next)
          }

          if (rows.length < BATCH_SIZE) break
        }
      }
      return [...grouped.values()]
    },
  }
}

export function createAttendanceSyncProviders(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): AttendanceSyncProvider[] {
  return [createFeishuProvider(env, fetchImpl), createDingTalkProvider(env, fetchImpl)]
}

/** 仅供测试/排障:清空进程内 token 缓存。 */
export function resetAttendanceSyncTokenCache(): void {
  tokenCache.feishu = null
  tokenCache.dingtalk = null
}

export { errorSummary as attendanceSyncErrorSummary }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
