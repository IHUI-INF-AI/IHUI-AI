// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到助手端点封装(Phase1b,2026-10-03 立)。
 *
 * 后端:apps/ai-service/app/routers/checkin.py(prefix /api/checkin,web rewrites
 * 以 /api/checkin/:path* 同形转发到 8803):
 *   POST   /accounts              录入账号(jwt 校验可解析 + 过期即拒)
 *   GET    /accounts              列表(jwt 永不出库,含最近一次记录摘要)
 *   DELETE /accounts/{id}         删除(级联 records / error_counts)
 *   PATCH  /accounts/{id}/enabled 启用/停用
 *   PATCH  /accounts/{id}/jwt     更新 JWT(重录凭证,响应含新 jwt_exp)
 *   POST   /accounts/{id}/checkin 手动签到(尊重冷却与全局限流,命中即 429)
 *   GET    /accounts/{id}/tasks   WorkBuddy growth 任务列表(只读)
 *   POST   /accounts/{id}/task-run WorkBuddy 任务族执行(kind=dry_run 可选;出站暂停/冷却中 429)
 *   GET    /records               签到记录倒序分页
 *   GET    /credits/history       积分流水
 *   GET    /credits/daily         每日快照三线序列
 *   GET    /scheduler/status      调度器状态(enabled/started 为顶层两维;wb_tasks.enabled
 *                                 是「巡检 job 现在真注册着」的观测态,不是配置意图)
 * 响应为裸 JSON(无 {code,data} 包装),走 fetchAiServiceJson。
 * 类型契约见 @ihui/types(checkin.ts,镜像 checkin_store.py 序列化形态)。
 */
import type {
  CheckinAccount,
  CheckinAccountsResponse,
  CheckinCreditsDailyResponse,
  CheckinCreditsHistoryItem,
  CheckinCreditsHistoryResponse,
  CheckinCreditsQueryResponse,
  CheckinDeleteResponse,
  CheckinDeviceMapUpdateResponse,
  CheckinGroupUpdateResponse,
  CheckinJwtUpdateResponse,
  CheckinNameUpdateResponse,
  CheckinRecord,
  CheckinRecordsResponse,
  CheckinSchedulerStatusResponse,
  CheckinSetEnabledResponse,
  CreateCheckinAccountIn,
  CreateCheckinAccountResponse,
  ManualCheckinResponse,
  UpdateCheckinAccountGroupIn,
  UpdateCheckinAccountJwtIn,
  UpdateCheckinAccountNameIn,
  UpdateCheckinDeviceMapIn,
} from '@ihui/types'
import { fetchAiServiceJson } from '../client.js'

/** 统一解包:success=false 时抛错(调用方捕获后展示 error message) */
function unwrap<T>(res: { success: boolean; data?: T; error?: string }): T {
  if (!res.success || res.data === undefined) throw new Error(res.error || '请求失败')
  return res.data
}

/** 录入签到账号(jwt 加密落库,响应不含任何 jwt 字段) */
export async function createCheckinAccount(
  input: CreateCheckinAccountIn,
): Promise<CreateCheckinAccountResponse> {
  return unwrap<CreateCheckinAccountResponse>(
    await fetchAiServiceJson<CreateCheckinAccountResponse>('/api/checkin/accounts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

/** 账号列表(脱敏:无 jwt / jwt_enc 字段) */
export async function listCheckinAccounts(): Promise<CheckinAccountsResponse> {
  return unwrap<CheckinAccountsResponse>(
    await fetchAiServiceJson<CheckinAccountsResponse>('/api/checkin/accounts'),
  )
}

/** 删除账号(属主校验,记录级联删除) */
export async function deleteCheckinAccount(accountId: number): Promise<CheckinDeleteResponse> {
  return unwrap<CheckinDeleteResponse>(
    await fetchAiServiceJson<CheckinDeleteResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}`,
      { method: 'DELETE' },
    ),
  )
}

/** 启用/停用账号(停用后每日调度跳过,手动签到仍可用) */
export async function setCheckinAccountEnabled(
  accountId: number,
  enabled: boolean,
): Promise<CheckinSetEnabledResponse> {
  return unwrap<CheckinSetEnabledResponse>(
    await fetchAiServiceJson<CheckinSetEnabledResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/enabled`,
      { method: 'PATCH', body: JSON.stringify({ enabled }) },
    ),
  )
}

/** 更新账号 JWT(重录凭证,jwt 加密落库,响应含新解析的 jwt_exp) */
export async function updateCheckinAccountJwt(
  accountId: number,
  jwt: string,
): Promise<CheckinJwtUpdateResponse> {
  const body: UpdateCheckinAccountJwtIn = { jwt }
  return unwrap<CheckinJwtUpdateResponse>(
    await fetchAiServiceJson<CheckinJwtUpdateResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/jwt`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  )
}

/** 更新账号分组(Phase1d;空串 = 移出分组) */
export async function updateCheckinAccountGroup(
  accountId: number,
  group: string,
): Promise<CheckinGroupUpdateResponse> {
  const body: UpdateCheckinAccountGroupIn = { group }
  return unwrap<CheckinGroupUpdateResponse>(
    await fetchAiServiceJson<CheckinGroupUpdateResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/group`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  )
}

/** 更新账号展示名(重命名;旧版捕获的 UUID 编码名由用户就地改名) */
export async function updateCheckinAccountName(
  accountId: number,
  name: string,
): Promise<CheckinNameUpdateResponse> {
  const body: UpdateCheckinAccountNameIn = { name }
  return unwrap<CheckinNameUpdateResponse>(
    await fetchAiServiceJson<CheckinNameUpdateResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/name`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  )
}

/** 手动触发签到:尊重冷却与全局限流(命中返回 429),结果照写 records */ export async function manualCheckinAccount(
  accountId: number,
): Promise<ManualCheckinResponse> {
  return unwrap<ManualCheckinResponse>(
    await fetchAiServiceJson<ManualCheckinResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/checkin`,
      { method: 'POST' },
    ),
  )
}

/** 整体替换设备指纹 map(≤16KB;平台相关键,后端原样落库) */
export async function updateCheckinAccountDeviceMap(
  accountId: number,
  deviceMap: Record<string, unknown>,
): Promise<CheckinDeviceMapUpdateResponse> {
  const body: UpdateCheckinDeviceMapIn = { device_map: deviceMap }
  return unwrap<CheckinDeviceMapUpdateResponse>(
    await fetchAiServiceJson<CheckinDeviceMapUpdateResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/device_map`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  )
}

/**
 * 任务族 kind 全集(与 ai-service `TaskRunIn.kind` 的 Literal 逐字一致)。
 * 目前只有 WorkBuddy 账号有任务族实现;其余平台返回 ok:false + reason(不冒充空列表)。
 */
export type CheckinTaskKind =
  'growth' | 'travel' | 'activity' | 'blackcat' | 'redeem' | 'lottery' | 'all'

/** GET /accounts/{id}/tasks 响应(只读清单;上游形态读不懂 ⇒ unjudged=true) */
export interface CheckinTaskListResponse {
  ok: boolean
  kind: 'list'
  tasks: Array<Record<string, unknown>>
  reason: string | null
  unjudged: boolean
}

/** POST /accounts/{id}/task-run 响应(delta 读不出 = null,绝不用 0 冒充) */
export interface CheckinTaskRunResponse {
  ok: boolean
  kind: string
  accepted: string[]
  claimed: string[]
  credit_delta: number | null
  energy_delta: number | null
  reason?: string | null
  unjudged: boolean
}

/** POST /accounts/{id}/autopilot 响应(全量自动驾驶一轮摘要) */
export interface CheckinAutopilotResponse {
  ok: boolean
  reason?: string
  dry_run: boolean
  total_tasks: number
  claimed_already: string[]
  plan: Array<Record<string, unknown>>
  executed: Array<Record<string, unknown>>
  claimed: string[]
  credits: number
  undone: Array<Record<string, unknown>>
  unregistered: string[]
  pending_platform: string[]
  subscribe_status_refreshed: boolean
  subscribe_status: Record<string, unknown> | null
  read_failed: boolean
}

/** WorkBuddy 任务族清单(只读;非 WorkBuddy 账号 ok:false + reason) */
export async function getCheckinAccountTasks(accountId: number): Promise<CheckinTaskListResponse> {
  return unwrap<CheckinTaskListResponse>(
    await fetchAiServiceJson<CheckinTaskListResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/tasks`,
    ),
  )
}

/** 执行一个任务族(kind=all = 全族一轮;dry_run 只读预演;出站暂停/冷却中 429) */
export async function runCheckinAccountTask(
  accountId: number,
  kind: CheckinTaskKind,
  dryRun = false,
): Promise<CheckinTaskRunResponse> {
  return unwrap<CheckinTaskRunResponse>(
    await fetchAiServiceJson<CheckinTaskRunResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/task-run`,
      { method: 'POST', body: JSON.stringify({ kind, dry_run: dryRun }) },
    ),
  )
}

/** 全量自动驾驶一轮(幂等;dry_run 只出计划零写侧;claim=false 只执行不领奖) */
export async function runCheckinAccountAutopilot(
  accountId: number,
  options?: { dryRun?: boolean; claim?: boolean },
): Promise<CheckinAutopilotResponse> {
  return unwrap<CheckinAutopilotResponse>(
    await fetchAiServiceJson<CheckinAutopilotResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/autopilot`,
      {
        method: 'POST',
        body: JSON.stringify({
          dry_run: options?.dryRun ?? false,
          claim: options?.claim ?? true,
        }),
      },
    ),
  )
}

/** 签到记录倒序分页(可选按账号过滤) */
export async function listCheckinRecords(options?: {
  accountId?: number
  limit?: number
}): Promise<CheckinRecordsResponse> {
  return unwrap<CheckinRecordsResponse>(
    await fetchAiServiceJson<CheckinRecordsResponse>('/api/checkin/records', {
      params: {
        account_id: options?.accountId,
        limit: options?.limit,
      },
    }),
  )
}

/** 积分流水(从 records 聚合 credits_delta 非空的签到,倒序) */
export async function listCheckinCreditsHistory(options?: {
  accountId?: number
  limit?: number
}): Promise<CheckinCreditsHistoryResponse> {
  return unwrap<CheckinCreditsHistoryResponse>(
    await fetchAiServiceJson<CheckinCreditsHistoryResponse>('/api/checkin/credits/history', {
      params: {
        account_id: options?.accountId,
        limit: options?.limit,
      },
    }),
  )
}

/** 调度器状态(enabled+started → 每日自动签到运行中) */
export async function getCheckinSchedulerStatus(): Promise<CheckinSchedulerStatusResponse> {
  return unwrap<CheckinSchedulerStatusResponse>(
    await fetchAiServiceJson<CheckinSchedulerStatusResponse>('/api/checkin/scheduler/status'),
  )
}

/** 手动查询账号积分余额并落当日快照(失败返回 ok:false + error,不抛栈) */
export async function queryCheckinAccountCredits(
  accountId: number,
): Promise<CheckinCreditsQueryResponse> {
  return unwrap<CheckinCreditsQueryResponse>(
    await fetchAiServiceJson<CheckinCreditsQueryResponse>(
      `/api/checkin/accounts/${accountId}/query_credits`,
      { method: 'POST' },
    ),
  )
}

/** 积分每日快照三线序列(total/gained/consumed,按日升序) */
export async function listCheckinCreditsDaily(options?: {
  days?: number
}): Promise<CheckinCreditsDailyResponse> {
  return unwrap<CheckinCreditsDailyResponse>(
    await fetchAiServiceJson<CheckinCreditsDailyResponse>('/api/checkin/credits/daily', {
      params: { days: options?.days },
    }),
  )
}

export type {
  CheckinAccount,
  CheckinCreditsDailyResponse,
  CheckinCreditsHistoryItem,
  CheckinCreditsQueryResponse,
  CheckinJwtUpdateResponse,
  CheckinRecord,
  CheckinSchedulerStatusResponse,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
