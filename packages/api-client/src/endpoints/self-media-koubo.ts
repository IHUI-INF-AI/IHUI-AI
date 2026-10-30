// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自媒体 · 口播稿流水线端点(补 RN 承载 web /self-media/koubo 用,2026-10-27 契约现读)。
 *
 * 链路:RN/Web → apps/api 代理(apps/api/src/routes/self-media-routes.ts)→ ai-service
 * (apps/ai-service/app/routers/self_media.py)。api 层原样透传上游 JSON/状态码
 * (self-media-routes.ts:67-79),不套 success 信封,故 fetchApi 拿到的是裸 JSON
 * (packages/api-client/src/client.ts:807-815)。全族 preHandler authenticate
 * (self-media-routes.ts:87-95),经 apps/api/src/routes/index.ts:1064 以 prefix /api 注册。
 *
 *  - POST /api/self-media/koubo/generate  body { date(MMDD,^\d{4}$), topic?, model?, ownerUuid?, dryRun? }
 *      → { ok, date, topic, dryRun, status, outputPath, articlesCount,
 *          articles:[{index, content, topic}], trace, error, duration_ms }
 *      (api 代理:self-media-routes.ts:135-137;上游 self_media.py:639-672;
 *       请求体模型 self_media.py:129-134 —— date 必须 4 位数字,否则上游 422)
 *  - POST /api/self-media/koubo/validate body { filePath }
 *      → { ok, returncode, stdout, stderr }
 *      (self-media-routes.ts:139-141;上游 self_media.py:692-712;请求体模型 :137-138)
 *  - GET  /api/self-media/koubo/history?limit=
 *      → { items: KouboHistoryItem[], count }
 *      (self-media-routes.ts:143-147;上游 self_media.py:715-719;
 *       行序列化 self_media.py:282-308 —— id/category/title/status/draftId/topicKeyword/createdAt/updatedAt/payload)
 *
 * 耗时提示:generate 为 8 篇串行 + 双门禁,5-10 分钟(上游 docstring self_media.py:641-645),
 * 调用方超时须放宽(fetchApi 默认 30s 会先失败),本封装透传 timeoutMs。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** generate 入参(字段名对齐上游 KouboGenerateRequest,self_media.py:129-134) */
export interface KouboGenerateInput {
  /** MMDD,必须 4 位数字(self_media.py:130 的 pattern) */
  date: string
  topic?: string
  model?: string
  ownerUuid?: string
  /** 默认 true(上游 dryRun: bool = True) */
  dryRun?: boolean
}

/** 单篇口播稿 */
export interface KouboArticle {
  index: number
  content: string
  topic?: Record<string, unknown>
}

/** generate 返回体(self_media.py:656-672) */
export interface KouboGenerateResult {
  ok: boolean
  date?: string
  topic?: string
  dryRun?: boolean
  status?: string
  outputPath?: string
  articlesCount?: number
  articles?: KouboArticle[]
  trace?: unknown[]
  error?: string | null
  duration_ms?: number
}

/** validate 返回体(self_media.py:707-712) */
export interface KouboValidateResult {
  ok: boolean
  returncode?: number
  stdout?: string
  stderr?: string
}

/** 历史行(self_media.py:288-297) */
export interface KouboHistoryItem {
  id: string
  category: string
  title: string
  status: string
  draftId?: string
  topicKeyword?: string
  createdAt?: string | null
  updatedAt?: string | null
  payload?: {
    date?: string
    topic?: string
    filePath?: string
  } & Record<string, unknown>
}

export interface KouboHistoryResult {
  items: KouboHistoryItem[]
  count?: number
}

/**
 * POST /api/self-media/koubo/generate —— 生成 8 篇口播稿 + 双门禁。
 * 上游实测 5-10 分钟,默认 30s 超时会先掐断,故默认放宽到 12 分钟。
 */
export async function generateKoubo(
  input: KouboGenerateInput,
): Promise<ApiResult<KouboGenerateResult>> {
  return fetchApi<KouboGenerateResult>('/api/self-media/koubo/generate', {
    method: 'POST',
    body: JSON.stringify(input),
    timeoutMs: 12 * 60 * 1000,
  })
}

/** POST /api/self-media/koubo/validate —— 对已生成的稿子跑双门禁校验(脚本 120s 上限) */
export async function validateKoubo(
  filePath: string,
): Promise<ApiResult<KouboValidateResult>> {
  return fetchApi<KouboValidateResult>('/api/self-media/koubo/validate', {
    method: 'POST',
    body: JSON.stringify({ filePath }),
    timeoutMs: 3 * 60 * 1000,
  })
}

/** GET /api/self-media/koubo/history —— 口播稿发布历史(读 self_media_published 表) */
export async function getKouboHistory(
  query: { limit?: number } = {},
): Promise<ApiResult<KouboHistoryResult>> {
  return fetchApi<KouboHistoryResult>(`/api/self-media/koubo/history${buildQs(query)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
