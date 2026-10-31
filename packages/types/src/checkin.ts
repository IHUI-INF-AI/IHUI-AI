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

/** 支持的签到平台:'trae' = TRAE(存量默认);'workbuddy' = WorkBuddy(2026-10-12);
 * 'qoder' = Qoder(阿里 AI IDE) */
export type CheckinPlatform = 'trae' | 'workbuddy' | 'qoder' | 'minimax'

/** 签到账号(脱敏形态:GET /accounts 列表项,无 jwt / jwt_enc 字段) */
export interface CheckinAccount {
  id: number
  name: string
  /** 账号分组(Phase1d;空串 = 未分组) */
  group: string
  /** 所属平台(平台化,2026-10-10;存量账号默认 trae) */
  platform: CheckinPlatform
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
  /** 所属平台(缺省 trae;qoder 账号 device_map 需带 refresh_token 与 Cosy-* 设备头) */
  platform?: CheckinPlatform
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

/** PATCH /accounts/{id}/name 请求体(重命名展示名) */
export interface UpdateCheckinAccountNameIn {
  name: string
}

/** PATCH /accounts/{id}/device_map 请求体(整体替换设备指纹 map;≤16KB) */
export interface UpdateCheckinDeviceMapIn {
  device_map: Record<string, unknown>
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

/** PATCH /accounts/{id}/name 响应(重命名) */
export interface CheckinNameUpdateResponse {
  ok: boolean
  id: number
  name: string
}

/** PATCH /accounts/{id}/device_map 响应(2026-10-11 立) */
export interface CheckinDeviceMapUpdateResponse {
  ok: boolean
  /** 更新后 device_map 的键数量 */
  device_map_keys: number
  platform: CheckinPlatform
}

/**
 * 上一轮任务巡检摘要(2026-10-31 补)。进程内快照:重启清零、多 worker 各自一份,
 * 不是持久账本(做任务 ≠ 每日签到,不写 checkin_records)。
 * `note` 非空 = 本轮没真正跑完(出站暂停/无账号/中途中止),前端据此明说原因。
 */
export interface CheckinWbSweepSummary {
  /** 本轮开始时间,ISO 8601 */
  at: string
  /** 本轮结束时间,ISO 8601 */
  finished_at: string
  /** 本轮是否为演练(只读探针,未真实写入) */
  dry_run: boolean
  /** 本轮纳入的 WorkBuddy 账号数 */
  accounts: number
  /** 实际跑完的族次数(账号 × 族,跳过的不计) */
  families: number
  /** 累计上报受理数 */
  accepted: number
  /** 累计领奖成功数 */
  claimed: number
  /** 上游响应读不懂的族次数(unjudged) */
  unjudged: number
  /** 抛异常的族次数 */
  errors: number
  /** 因冷却跳过的账号数 */
  skipped_cooldown: number
  /** 非空 = 本轮未跑完的原因 */
  note: string | null
}

/**
 * WorkBuddy 任务中心自动巡检视图(2026-10-31 补)。
 *
 * 此前 status 只报签到五件套,这条 job 对前端完全不可见 ⇒ 用户无法得知
 * 「自动做任务」在不在跑、为什么没领到分。字段纪律:
 * - `enabled` 是**任务门 ∧ 总闸**,即「这条 job 现在真会被注册」的唯一判据;
 * - `tasks_enabled` / `cron_enabled` 是两门原值,用于解释「配了却没跑」;
 * - 全部只读,前端不得据此推测执行结果(结果仍以 task-run 返回为准)。
 */
export interface CheckinWbTasksStatus {
  /** 真会被注册 = tasks_enabled ∧ cron_enabled(唯一可信判据) */
  enabled: boolean
  /** 配置意图:WORKBUDDY_TASKS_ENABLED 原值 */
  tasks_enabled: boolean
  /** 总闸 CHECKIN_CRON_ENABLED 原值 */
  cron_enabled: boolean
  /** true=真实写侧;false=只读探针(dry-run),不会领奖 */
  live_run: boolean
  /** 巡检节拍(分钟),与调度器注册 job 的口径同源 */
  sweep_minutes: number
  /** 领奖路径是否已配置(未配置 ⇒ 只上报不领奖) */
  claim_path_configured: boolean
  /** 行为上报路径是否已配置 */
  activity_path_configured: boolean
  /** 上一轮巡检摘要;null = 本进程还没跑过,undefined = 服务端版本较旧 */
  last_sweep?: CheckinWbSweepSummary | null
}

/** GET /scheduler/status 响应 */
export interface CheckinSchedulerStatusResponse {
  /** 调度总开关 */
  enabled: boolean
  /** 调度循环是否已启动 */
  started: boolean
  /** 下次执行时间(主窗口,非 Qoder 账号),ISO 8601 或 null */
  next_run: string | null
  /** 下次执行时间(Qoder 窗口,每日 10:05),ISO 8601 或 null */
  next_run_qoder: string | null
  /** 下次探针执行时间,ISO 8601 或 null */
  next_run_probe?: string | null
  /** 下次 WorkBuddy 任务巡检时间,ISO 8601 或 null */
  next_run_wb_tasks?: string | null
  /** 自动做任务巡检视图;服务端版本较旧时不返回 ⇒ 前端按「状态未知」呈现 */
  wb_tasks?: CheckinWbTasksStatus
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

/** GET /credits/daily 响应(每日快照三线序列,按日升序) */
export interface CheckinCreditsDailyResponse {
  /** ISO 日期序列(最近 N 天,Asia/Shanghai 日界) */
  days: string[]
  series: {
    /** 各账号剩余积分之和;当日无快照为 null(前端断线) */
    total: (number | null)[]
    /** 当日签到获得(credits_delta 求和,缺失按 0) */
    gained: number[]
    /** |total[i] − gained[i] − total[i−1]|;首日或前一日缺失为 null */
    consumed: (number | null)[]
  }
}

/** POST /accounts/{id}/query_credits 响应 */
export interface CheckinCreditsQueryResponse {
  ok: boolean
  remaining: number | null
  error: string | null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
