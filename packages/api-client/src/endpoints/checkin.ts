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
 *   POST   /accounts/{id}/checkin 手动签到(无视冷却)
 *   GET    /records               签到记录倒序分页
 *   GET    /credits/history       积分流水
 *   GET    /scheduler/status      调度器状态(enabled/started/next_run)
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
  CheckinGroupUpdateResponse,
  CheckinJwtUpdateResponse,
  CheckinRecord,
  CheckinRecordsResponse,
  CheckinSchedulerStatusResponse,
  CheckinSetEnabledResponse,
  CreateCheckinAccountIn,
  CreateCheckinAccountResponse,
  ManualCheckinResponse,
  UpdateCheckinAccountGroupIn,
  UpdateCheckinAccountJwtIn,
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

/** 手动触发签到:无视冷却,结果照写 records */
export async function manualCheckinAccount(accountId: number): Promise<ManualCheckinResponse> {
  return unwrap<ManualCheckinResponse>(
    await fetchAiServiceJson<ManualCheckinResponse>(
      `/api/checkin/accounts/${encodeURIComponent(String(accountId))}/checkin`,
      { method: 'POST' },
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
