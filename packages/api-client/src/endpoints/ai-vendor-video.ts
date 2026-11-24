// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 厂商「文生视频」异步任务端点封装(B 桶上提,2026-11-06)。
 *
 * 挂载点逐字对账(不用 :param 通配猜):
 *   apps/api/src/routes/index.ts:791 `server.register(aiVendorRoutes, { prefix: '/api/ai' })`
 *   → ai-vendors.ts:39 `await server.register(llmVendorRoutes)`
 *   → ai-vendors/proxy-llm.ts:270 起,POST '/dashscope/video'(同文件 555 行)
 *     与 POST '/doubao/video'(同文件 925 行)。
 * 完整路径因此是 /api/ai/dashscope/video 与 /api/ai/doubao/video。
 *
 * 本族另外两条**故意不封**(强封即假封装,证据见各自行):
 *   - POST /api/ai/kling/task/create(proxy-tools.ts:1092)= Kling **对口型 lip-sync** 任务,
 *     body 是 klingTaskCreateBody(proxy-tools.ts:149-158):sessionId 必填、faceChoose 必填且
 *     ≥1 项。小程序 pkg-ai/ai/video.tsx 只握有 prompt/时长/分辨率,结构性凑不出这个 body。
 *   - POST /api/ai/sora/request/end(ai-frontend-routes.ts:551)= **任务状态查询**
 *     (代理 GET /api/ai/sora2/tasks/:taskId,body 取 task_id/taskId,ai-frontend-routes.ts:552-554),
 *     不是生成入口,同一页拿不到 task_id。
 */

import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import type { AsyncTask } from './ai-media.js'

/**
 * 两条视频生成路由共用的入参。
 * 后端真身 apps/api/src/routes/ai-vendors/_shared.ts:201-221 `promptModelBody`(Zod,全字段可选),
 * 其中 duration / fps / seed 是 `z.number()`、resolution / size / aspect_ratio 是 `z.string()`
 * —— 端内把 duration/fps 当字符串送会在这一步被 Zod 打回,故这里按 schema 落类型。
 */
export interface VendorVideoGenerateBody {
  prompt?: string
  model?: string
  /** 生成数量(1-10) */
  n?: number
  size?: string
  aspect_ratio?: string
  /** 秒 */
  duration?: number
  fps?: number
  resolution?: string
  prompt_extend?: boolean
  watermark?: boolean
  seed?: number
  imageUrl?: string
  image?: string
  negativePrompt?: string
  camera?: Record<string, unknown>
  /** 厂商私有参数包透传 */
  parameters?: Record<string, unknown>
}

/**
 * 两条路由的响应。
 * 后端真身 proxy-llm.ts:597 与 :966 —— 出口一律
 * `success({ taskId: task.taskId, status: task.status, raw: data })`,
 * task 由 createTask(_shared.ts:1351-1370) 造,status 出厂恒为 'pending',
 * raw 是厂商原始回包(未归一)。`data` 是**对象**,不是裸数组。
 */
export interface VendorVideoTaskAck {
  taskId: string
  status: AsyncTask['status']
  raw: unknown
}

/** POST /api/ai/dashscope/video —— 通义万相视频生成(需鉴权;上游 DashScope 异步任务) */
export function generateVideoDashscope(
  body: VendorVideoGenerateBody = {},
): Promise<ApiResult<VendorVideoTaskAck>> {
  return fetchApi<VendorVideoTaskAck>('/api/ai/dashscope/video', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** POST /api/ai/doubao/video —— 豆包(方舟)视频生成(需鉴权;上游 contents/generations/tasks) */
export function generateVideoDoubao(
  body: VendorVideoGenerateBody = {},
): Promise<ApiResult<VendorVideoTaskAck>> {
  return fetchApi<VendorVideoTaskAck>('/api/ai/doubao/video', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
