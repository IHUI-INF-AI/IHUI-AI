/**
 * 云托管 Agent 运行端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 * 数据面在 ai-service(不在 apps/api),web 经 next rewrites 直连 8803
 * (apps/web/next.config.ts:626-637 「research / checkpoints / cloud-runs / context-compaction /
 * computer-use router 均注册在 ai-service(prefix="/api")」),故本封装与
 * endpoints/artifacts.ts、endpoints/checkin.ts 同口径走 fetchAiServiceJson。
 *
 *  - GET /api/cloud-runs?page&page_size&status
 *    → 信封 {code:0, message, data:{list,total,page,pageSize}}
 *    (apps/ai-service/app/routers/cloud_runs.py:94-113,router prefix="/cloud-runs" :35,
 *     由 main 以 prefix="/api" 挂载 :10-14)
 *    page 默认 1、page_size 默认 20 且被钳到 1..100
 *    (apps/ai-service/app/services/cloud_run_store.py:231-255,pageSize 键名 :254)
 *  - GET /api/cloud-runs/{run_id} → 信封同形,data = 单条 run dict
 *    (apps/ai-service/app/routers/cloud_runs.py:116-126;不存在返回 404 :124)
 *  - 鉴权:两读端点均 Depends(get_current_user_id) JWT(cloud_runs.py:99 / :119);
 *    fetchAiServiceJson 自动带 Bearer 并在 401 时静默续期重放一次
 *    (packages/api-client/src/client.ts:1189-1200)。
 *  - 行形状 = CloudRun dataclass 的 asdict(cloud_run_store.py:90-92),
 *    这里只声明展示层实际消费的字段。
 *  - web 同参数消费方:apps/web/src/components/cloud-runs/CloudRunsView.tsx:49(列表)、
 *    :65(详情),/cloud-agent 与 /cloud-run 两个路由共用该视图组件。
 */
import type { ApiResult } from '@ihui/types'

import { fetchAiServiceJson } from '../client.js'

/** 单条云运行记录(GET /api/cloud-runs → data.list / GET /api/cloud-runs/{run_id} → data) */
export interface CloudRunRecord {
  run_id: string
  task: string
  status: 'running' | 'done' | 'error'
  agent_type?: string
  /** 列表端点额外注入的截断摘要(≤200 字符,cloud_runs.py:37-38 / :103-108) */
  output_summary?: string
  output?: string
  error?: string
  session_alias?: string
  user_id?: string
  started_at?: string
  ended_at?: string
}

export interface CloudRunListResult {
  list: CloudRunRecord[]
  total: number
  page: number
  /** 后端为 camelCase `pageSize`(cloud_run_store.py:254),不是 page_size */
  pageSize: number
}

export interface CloudRunListQuery {
  page?: number
  /** 后端钳制区间 1..100(cloud_run_store.py:247) */
  pageSize?: number
  status?: 'running' | 'done' | 'error'
}

/** ai-service 统一信封(cloud_runs.py:18 自述对齐 api-client 的 code===0 判定) */
interface AiServiceEnvelope<T> {
  code: number
  message: string
  data: T
}

function unwrap<T>(res: ApiResult<AiServiceEnvelope<T>>): ApiResult<T> {
  if (!res.success) {
    return { success: false, error: res.error, status: res.status, errorCode: res.errorCode }
  }
  const body = res.data
  if (!body || body.code !== 0) {
    return { success: false, error: body?.message ?? '', status: res.status }
  }
  return { success: true, data: body.data, status: res.status }
}

/** 云运行历史列表(分页,可选状态过滤) */
export async function getCloudRuns(
  query: CloudRunListQuery = {},
): Promise<ApiResult<CloudRunListResult>> {
  const res = await fetchAiServiceJson<AiServiceEnvelope<CloudRunListResult>>('/api/cloud-runs', {
    params: {
      page: query.page,
      page_size: query.pageSize,
      status: query.status,
    },
  })
  return unwrap(res)
}

/** 单条云运行详情(含完整最终输出/状态/起止时间);不存在时后端 404 */
export async function getCloudRunDetail(
  runId: string,
): Promise<ApiResult<CloudRunRecord>> {
  const res = await fetchAiServiceJson<AiServiceEnvelope<CloudRunRecord>>(
    `/api/cloud-runs/${encodeURIComponent(runId)}`,
  )
  return unwrap(res)
}
