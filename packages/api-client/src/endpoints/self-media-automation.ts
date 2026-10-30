// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自媒体 · 自动化任务端点(补 RN 承载 web /self-media/automation 用,2026-10-27 契约现读)。
 *
 * 链路:RN/Web → apps/api 代理(apps/api/src/routes/self-media-routes.ts)→ ai-service
 * (apps/ai-service/app/routers/self_media.py)。api 层原样透传上游 JSON/状态码
 * (:67-79),**不套 success 信封** —— 故 fetchApi 拿到的是裸 JSON
 * (packages/api-client/src/client.ts:807-815:非包络体整段视作 data)。
 * 全族鉴权:api 层 preHandler authenticate(apps/api/src/routes/self-media-routes.ts:87-95),
 * 经 apps/api/src/routes/index.ts:1064 以 prefix /api 注册。
 *
 *  - GET  /api/self-media/automation/tasks
 *      → { items: AutomationTask[], count }(apps/api/src/routes/self-media-routes.ts:151-153;
 *        ai-service apps/ai-service/app/routers/self_media.py:733-738)
 *  - GET  /api/self-media/automation/history?taskId=&limit=
 *      → { items: AutomationHistoryEntry[], count }(self-media-routes.ts:185-192 把 taskId 转成
 *        上游的 task_id 查询参数;self_media.py:795-803 默认 limit=30)
 *  - POST /api/self-media/automation/tasks/:taskId/toggle  body { enabled }
 *      → { ok, task_id, enabled }(self-media-routes.ts:160-169 把 body 的 enabled 转成 query;
 *        self_media.py:752-760;404 = task not found)
 *  - POST /api/self-media/automation/tasks/:taskId/config
 *      → { ok, task_id, config }(self-media-routes.ts:171-174;self_media.py:763-781)
 *        **上游请求体是 snake_case**(TaskConfigUpdate:self_media.py:725-730:
 *        hour / minute / dry_run / enabled / title_template)—— web 页发的是 camelCase
 *        (apps/web/app/(main)/self-media/automation/page.tsx:280-285),上游会静默忽略;
 *        本封装按真实契约发 snake_case。
 *  - POST /api/self-media/automation/tasks/:taskId/trigger
 *      → { ok, ... }(self-media-routes.ts:176-183;self_media.py:784-792;失败回 400)
 *
 * 任务行形状 = scheduler.list_tasks()(apps/ai-service/app/services/self_media_scheduler.py:291-319):
 * 同为 snake_case(`default_hour` / `config.dry_run` / `config.title_template` / `last_run`)。
 * web 页按 camelCase 读(page.tsx:133-143 的 Task 接口)拿不到真值,RN 端按上游真字段读 —— 这是
 * 端间契约误差的如实对齐,不改后端。历史条目形状:self_media_scheduler.py:54-62。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** 任务运行时配置(上游 snake_case,self_media_scheduler.py:309-315) */
export interface AutomationTaskConfig {
  hour: number
  minute: number
  dry_run: boolean
  enabled: boolean
  title_template: string
}

/** 单次执行记录(self_media_scheduler.py:54-62) */
export interface AutomationHistoryEntry {
  task_id: string
  /** ISO8601 UTC */
  triggered_at: string
  status: 'success' | 'failed' | 'running'
  duration_ms: number
  error: string | null
  extra: Record<string, unknown>
}

/** 定时任务行(self_media_scheduler.py:302-318) */
export interface AutomationTask {
  id: string
  name: string
  description: string
  category: 'wechat' | 'koubo'
  default_hour: number
  default_minute: number
  config: AutomationTaskConfig
  running: boolean
  last_run: AutomationHistoryEntry | null
}

export interface AutomationTaskListResult {
  items: AutomationTask[]
  count?: number
}

export interface AutomationHistoryResult {
  items: AutomationHistoryEntry[]
  count?: number
}

/** 上游 TaskConfigUpdate(self_media.py:725-730),未给的字段保持原值 */
export interface AutomationConfigPatch {
  hour?: number
  minute?: number
  dry_run?: boolean
  enabled?: boolean
  title_template?: string
}

export interface AutomationTaskMutationResult {
  ok: boolean
  task_id?: string
  enabled?: boolean
  config?: AutomationTaskConfig
  [key: string]: unknown
}

/** GET /api/self-media/automation/tasks —— 定时任务列表(含运行时配置与最近一次执行) */
export async function listAutomationTasks(): Promise<ApiResult<AutomationTaskListResult>> {
  return fetchApi<AutomationTaskListResult>('/api/self-media/automation/tasks')
}

/** GET /api/self-media/automation/history —— 执行历史(默认最近 30 条,服务重启即清空) */
export async function getAutomationHistory(
  query: { taskId?: string; limit?: number } = {},
): Promise<ApiResult<AutomationHistoryResult>> {
  return fetchApi<AutomationHistoryResult>(
    `/api/self-media/automation/history${buildQs(query)}`,
  )
}

/** POST toggle —— 启用/禁用单个任务 */
export async function toggleAutomationTask(
  taskId: string,
  enabled: boolean,
): Promise<ApiResult<AutomationTaskMutationResult>> {
  return fetchApi<AutomationTaskMutationResult>(
    `/api/self-media/automation/tasks/${encodeURIComponent(taskId)}/toggle`,
    { method: 'POST', body: JSON.stringify({ enabled }) },
  )
}

/** POST config —— 改 hour/minute/dry_run/enabled/title_template */
export async function updateAutomationTaskConfig(
  taskId: string,
  patch: AutomationConfigPatch,
): Promise<ApiResult<AutomationTaskMutationResult>> {
  return fetchApi<AutomationTaskMutationResult>(
    `/api/self-media/automation/tasks/${encodeURIComponent(taskId)}/config`,
    { method: 'POST', body: JSON.stringify(patch) },
  )
}

/** POST trigger —— 立即触发一次(异步执行,立即返回) */
export async function triggerAutomationTask(
  taskId: string,
): Promise<ApiResult<AutomationTaskMutationResult>> {
  return fetchApi<AutomationTaskMutationResult>(
    `/api/self-media/automation/tasks/${encodeURIComponent(taskId)}/trigger`,
    { method: 'POST' },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
