// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到助手跨端契约(Phase1b,2026-10-03 立)。
 *
 * 镜像 apps/ai-service/app/routers/checkin.py(prefix /api/checkin)+ checkin_store.py
 * 的行序列化形态(snake_case,裸 JSON 直返,无 {code,data} 包装)。
 *
 * 脱敏纪律:CheckinAccount 绝不含 jwt / jwt_enc 字段 —— 后端 _account_row 只出脱敏
 * dict,本类型是它的镜像;jwt 本体只在录入请求(CreateCheckinAccountIn)与更新请求
 * (UpdateCheckinAccountJwtIn)里出现,对外仅暴露解析出的到期时间 jwt_exp。
 */

/** 账号最近一次签到记录摘要(list_accounts LEFT JOIN 聚合,无记录时为 null) */
export interface CheckinLastRecordSummary {
  ok: boolean | null
  action: string | null
  message: string | null
  credits: number | null
  /** ISO 8601 字符串 */
  created_at: string | null
}

/** 签到账号(脱敏形态:GET /accounts 列表项,无 jwt / jwt_enc 字段) */
export interface CheckinAccount {
  id: number
  name: string
  /** 账号分组(Phase1d;空串 = 未分组) */
  group: string
  /** 设备指纹 map(引擎可原位补齐缺失标识) */
  device_map: Record<string, unknown>
  /** 停用后每日调度跳过,手动签到仍可用 */
  enabled: boolean
  /** JWT 到期时间,ISO 8601 或 null(后端从 jwt 解析,仅到期时间不含凭证本体) */
  jwt_exp: string | null
  /** 冷却截止时间,ISO 8601 或 null(未来时间表示处于签到冷却) */
  cooldown_until: string | null
  /** ISO 8601 字符串或 null */
  created_at: string | null
  /** ISO 8601 字符串或 null */
  updated_at: string | null
  /** 列表端点附带;录入响应(POST /accounts)无此字段 */
  last_record?: CheckinLastRecordSummary | null
}

/** 单条签到记录(GET /records 列表项,镜像 _record_row) */
export interface CheckinRecord {
  id: number
  account_id: number
  /** null = 请求未完成(网络/异常类) */
  ok: boolean | null
  action: string | null
  http_status: number | null
  code: string | null
  message: string | null
  /** 错误分类:server / client / null(成功时) */
  classified_error: string | null
  /** 冷却截止时间,ISO 8601 或 null */
  cooldown_until: string | null
  credits: number | null
  credits_delta: number | null
  /** ISO 8601 字符串 */
  created_at: string | null
}

/** 积分流水项(GET /credits/history,从 records 聚合 credits_delta 非空的行) */
export interface CheckinCreditsHistoryItem {
  id: number
  account_id: number
  ok: boolean
  action: string
  credits: number | null
  credits_delta: number
  /** ISO 8601 字符串 */
  created_at: string | null
}

// ===================== 请求类型 =====================

/** POST /accounts 请求体(jwt 仅在此出现,响应永不回显) */
export interface CreateCheckinAccountIn {
  name: string
  jwt: string
  /** 可选设备指纹(缺省空对象,引擎会原位补齐) */
  device_map?: Record<string, unknown>
  /** 可选分组(Phase1d;缺省空串 = 未分组) */
  group?: string
}

/** PATCH /accounts/{id}/enabled 请求体 */
export interface SetCheckinAccountEnabledIn {
  enabled: boolean
}

/** PATCH /accounts/{id}/jwt 请求体(重录凭证,jwt 加密落库) */
export interface UpdateCheckinAccountJwtIn {
  jwt: string
}

/** PATCH /accounts/{id}/group 请求体(Phase1d;空串 = 移出分组) */
export interface UpdateCheckinAccountGroupIn {
  group: string
}

// ===================== 响应类型 =====================

/** GET /accounts 响应 */
export interface CheckinAccountsResponse {
  accounts: CheckinAccount[]
  count: number
}

/** POST /accounts 响应(单账号脱敏形态,无 last_record) */
export type CreateCheckinAccountResponse = CheckinAccount

/** DELETE /accounts/{id} 响应 */
export interface CheckinDeleteResponse {
  ok: boolean
  id: number
}

/** PATCH /accounts/{id}/enabled 响应 */
export interface CheckinSetEnabledResponse {
  ok: boolean
  id: number
  enabled: boolean
}

/** PATCH /accounts/{id}/jwt 响应 */
export interface CheckinJwtUpdateResponse {
  ok: boolean
  id: number
  /** 更新后解析出的 JWT 到期时间,ISO 8601 或 null */
  jwt_exp: string | null
}

/** PATCH /accounts/{id}/group 响应(Phase1d) */
export interface CheckinGroupUpdateResponse {
  ok: boolean
  id: number
  group: string
}

/** GET /scheduler/status 响应 */
export interface CheckinSchedulerStatusResponse {
  /** 调度总开关 */
  enabled: boolean
  /** 调度循环是否已启动 */
  started: boolean
  /** 下次执行时间,ISO 8601 或 null */
  next_run: string | null
}

/** POST /accounts/{id}/checkin 响应(本次签到记录) */
export type ManualCheckinResponse = CheckinRecord

/** GET /records 响应 */
export interface CheckinRecordsResponse {
  records: CheckinRecord[]
  count: number
}

/** GET /credits/history 响应 */
export interface CheckinCreditsHistoryResponse {
  history: CheckinCreditsHistoryItem[]
  count: number
  /** 本次返回集内 credits_delta 之和 */
  total_credits_delta: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
