// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 即梦(Jimeng4)视频任务端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET /api/ai/jimeng4/video/tasks?page&pageSize
 *    → 信封 success({ list, total, page, pageSize })
 *    (apps/api/src/routes/ai-vendors/proxy-tools.ts:720-738;分页 schema
 *     page 默认 1 / pageSize 默认 20 上限 100,同文件 64-67)
 *  - GET /api/ai/jimeng4/video/tasks/:taskId
 *    → 信封 success({ task, warning? });未完成时主动同步火山引擎状态后回写(同文件 741-811)。
 *    404 走 error(404, '任务不存在')(同文件 754)。
 *  - 路由面 toolsVendorRoutes 经 aiVendorRoutes 由
 *    apps/api/src/routes/index.ts:764 以 prefix '/api/ai' 注册,故完整路径如上。
 *  - 行形状 = video_generation_tasks 表(packages/database/src/schema/ai-config.ts:260-278):
 *    id(serial→number) / taskId / status / message / result / createdAt / updatedAt。
 *  - result 为 JSON 字符串,视频地址在 result.video_urls[0](web 解析口径见
 *    apps/web/app/(main)/ai-generation/video-tasks/video-task-row.tsx:21-33)。
 *  - web 消费方:apps/web/app/(main)/ai-generation/video-tasks/page.tsx:69-94。
 *  - packages/api-client 既有 ai-media.ts / media-tasks.ts 是别的资源面,不可顶替。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** 即梦视频任务行(GET /api/ai/jimeng4/video/tasks → data.list 元素) */
export interface JimengVideoTask {
  id: number
  taskId: string
  /** 协议字面值:accepted / running / success / failed(与后端比对用,不做翻译) */
  status: string
  message: string | null
  /** JSON 字符串,成功时为 { video_urls: string[], raw: unknown } */
  result: string | null
  createdAt: string
  updatedAt: string
}

export interface JimengVideoTaskList {
  list: JimengVideoTask[]
  total: number
  page: number
  pageSize: number
}

export interface JimengVideoTaskDetail {
  task: JimengVideoTask
  /** 状态同步失败时的降级提示(后端附加,可缺省) */
  warning?: string
}

export interface JimengVideoTasksQuery {
  page?: number
  /** 后端字段名 pageSize(上限 100,proxy-tools.ts:66) */
  pageSize?: number
}

export async function getJimengVideoTasks(
  query: JimengVideoTasksQuery = {},
): Promise<ApiResult<JimengVideoTaskList>> {
  return fetchApi<JimengVideoTaskList>(`/api/ai/jimeng4/video/tasks${buildQs(query)}`)
}

export async function getJimengVideoTask(
  taskId: number | string,
): Promise<ApiResult<JimengVideoTaskDetail>> {
  return fetchApi<JimengVideoTaskDetail>(
    `/api/ai/jimeng4/video/tasks/${encodeURIComponent(String(taskId))}`,
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
