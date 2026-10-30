// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 内容生成端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 * 全部 POST,响应统一 success(<厂商原始 data>)信封;媒体地址/文本提取复用
 * endpoints/ai-media.ts 的 extractMediaUrls / extractText(与 web 同一实现,
 * web 侧入口 apps/web/src/lib/ai-media.ts:5 亦为对该文件的 re-export)。
 *
 *  - POST /api/ai/dashscope/chat   body { prompt, model }
 *    (apps/api/src/routes/ai-vendors/proxy-llm.ts:276-290;aiVendorRoutes 挂
 *     prefix '/api/ai',apps/api/src/routes/index.ts:764;鉴权 preHandler proxy-llm.ts:270-273)
 *  - POST /api/ai/dashscope/image  body { prompt, model, size, n }(proxy-llm.ts:303-317)
 *  - POST /api/ai/doubao/image     body { prompt, model, size }(proxy-llm.ts:739)
 *  - POST /api/ai/agnes/image      body { prompt, size }(proxy-llm.ts:355)
 *  - POST /api/ai/jimeng4/image    body { prompt, width, height }(proxy-tools.ts:588)
 *  - POST /api/ai/dashscope/video  body { prompt, model }(proxy-llm.ts:551)
 *  - POST /api/ai/audio/speech     body { text, voice }(apps/api/src/routes/ai-audio.ts:273,
 *    prefix '/api/ai' 见 apps/api/src/routes/index.ts:770)
 *  - POST /api/ai/suno/generate    body { prompt, duration }(proxy-media.ts:85)
 *  - POST /api/ai/tencent/hunyuan3d/submit body { Prompt, ResultFormat }(proxy-extended.ts:111)
 *  - POST /api/chat/kling/video/generate body { prompt, duration } → data.task_id
 *    (apps/api/src/routes/chat-models.ts:642-673;chatModelRoutes 挂 prefix '/api/chat',
 *     apps/api/src/routes/index.ts:586)
 *  - GET  /api/chat/kling/task/:taskId → data.task_status(succeed/fail) + 产物
 *    (chat-models.ts:728-736)
 *
 * web 消费方:apps/web/app/(main)/ai-generation/PageClient.tsx:41-108(请求体逐字同源)。
 * packages/api-client 既有 ai-media.ts 是媒体工具与别的异步任务面,无本组生成入口,不可顶替。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 通用 POST:返回厂商原始 data,URL/文本提取交给调用方(与 web callApi 同结构) */
async function postGeneration(
  path: string,
  body: Record<string, unknown>,
): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(path, { method: 'POST', body: JSON.stringify(body) })
}

/** 文本类生成:POST /api/ai/dashscope/chat(web 固定 model qwen3-max,PageClient.tsx:41-42) */
export async function generateAiText(
  prompt: string,
  model = 'qwen3-max',
): Promise<ApiResult<unknown>> {
  return postGeneration('/api/ai/dashscope/chat', { prompt, model })
}

/** 代码生成:复用 chat 端点 + web 同一拼 prompt 口径(PageClient.tsx:100-105) */
export async function generateAiCode(
  prompt: string,
  language: string,
  model = 'qwen3-max',
): Promise<ApiResult<unknown>> {
  return postGeneration('/api/ai/dashscope/chat', {
    prompt: `Generate ${language} code: ${prompt}`,
    model,
  })
}

/** 图像生成厂商档(web ImageProvider 的四个真腿,PageClient.tsx:44-58) */
export type AiImageProvider = 'qwen' | 'doubao' | 'agnes' | 'jimeng'

export async function generateAiImage(
  provider: AiImageProvider,
  prompt: string,
  size: string,
): Promise<ApiResult<unknown>> {
  if (provider === 'qwen') {
    return postGeneration('/api/ai/dashscope/image', {
      prompt,
      model: 'wan2.6-t2i',
      size,
      n: 1,
    })
  }
  if (provider === 'doubao') {
    return postGeneration('/api/ai/doubao/image', {
      prompt,
      model: 'doubao-seedream-3-0-t2i-250415',
      size,
    })
  }
  if (provider === 'agnes') {
    return postGeneration('/api/ai/agnes/image', { prompt, size })
  }
  return postGeneration('/api/ai/jimeng4/image', { prompt, width: 1024, height: 1024 })
}

/** 视频生成厂商档(generic=dashscope / kling 异步两步) */
export type AiVideoProvider = 'generic' | 'kling'

/** 通用文生视频:POST /api/ai/dashscope/video(web 固定 model wan2.5-t2v-plus,PageClient.tsx:89) */
export async function generateAiVideo(
  prompt: string,
  model = 'wan2.5-t2v-plus',
): Promise<ApiResult<unknown>> {
  return postGeneration('/api/ai/dashscope/video', { prompt, model })
}

/** Kling 提交:POST /api/chat/kling/video/generate(web duration 固定 '5',PageClient.tsx:64-70) */
export async function submitKlingVideo(
  prompt: string,
  duration = '5',
): Promise<ApiResult<{ task_id?: string }>> {
  return fetchApi<{ task_id?: string }>('/api/chat/kling/video/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, duration }),
  })
}

/** Kling 轮询:GET /api/chat/kling/task/:taskId → data.task_status(chat-models.ts:728-736) */
export async function getKlingTask(taskId: string): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(`/api/chat/kling/task/${encodeURIComponent(taskId)}`)
}

/** 语音合成:POST /api/ai/audio/speech(web 传 text 而非 prompt,PageClient.tsx:94-95) */
export async function generateAiSpeech(
  text: string,
  voice: string,
): Promise<ApiResult<unknown>> {
  return postGeneration('/api/ai/audio/speech', { text, voice })
}

/** 音乐生成:POST /api/ai/suno/generate(web 把 genre 拼到 prompt 前,PageClient.tsx:97-98) */
export async function generateAiMusic(
  prompt: string,
  genre: string,
  duration: number,
): Promise<ApiResult<unknown>> {
  return postGeneration('/api/ai/suno/generate', { prompt: `${genre} ${prompt}`, duration })
}

/** 3D 模型提交:POST /api/ai/tencent/hunyuan3d/submit(字段首字母大写,PageClient.tsx:107-108) */
export async function generateAi3D(
  prompt: string,
  format: string,
): Promise<ApiResult<unknown>> {
  return postGeneration('/api/ai/tencent/hunyuan3d/submit', {
    Prompt: prompt,
    ResultFormat: format,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
