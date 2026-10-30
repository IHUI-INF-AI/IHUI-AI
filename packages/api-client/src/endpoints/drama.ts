// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短剧编辑器端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - POST /api/drama/scripts/:id/enhance  body { title?: string }
 *    → 信封 success({ consistency, pacing, outline })
 *    (apps/api/src/routes/drama.ts:35-48;dramaRoutes 挂 prefix /api,
 *     apps/api/src/routes/index.ts:1047)
 *  - POST /api/drama/scripts/:id/scenes/:sceneIndex/lines/:lineIndex/enhance
 *    body { content: string(1..5000), instruction?: string }
 *    → 信封 success({ original, rewritten, sceneIndex: number, lineIndex: number })
 *    (apps/api/src/routes/drama.ts:50-107,响应体在 100-107)
 *  - 两条均经 preHandler authenticate(apps/api/src/routes/drama.ts:28-34),未登录 401。
 *  - title / instruction 走 emptyToUndefined(drama.ts:17-23):空串须省略而非发 ""。
 *  - web 消费方:apps/web/app/(main)/drama/page.tsx:58-61、79-86。
 *  - packages/api-client 既有 endpoints 无 drama 域封装,本条为唯一落点。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 整体增强结果(POST /api/drama/scripts/:id/enhance → data) */
export interface DramaEnhanceResult {
  consistency: unknown
  pacing: unknown
  outline: unknown
}

/** 单行改写结果(POST .../lines/:lineIndex/enhance → data) */
export interface DramaLineRewriteResult {
  original: string
  rewritten: string
  sceneIndex: number
  lineIndex: number
}

/**
 * 剧本整体增强:角色一致性 + 节奏分析 + 章节大纲。
 * title 空串须省略(后端 emptyToUndefined 只对 undefined/空串走 optional,显式空串会 400)。
 */
export async function enhanceDramaScript(
  scriptId: string,
  body: { title?: string } = {},
): Promise<ApiResult<DramaEnhanceResult>> {
  const payload = body.title ? { title: body.title } : {}
  return fetchApi<DramaEnhanceResult>(
    `/api/drama/scripts/${encodeURIComponent(scriptId)}/enhance`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

/** 单行对白改写:instruction 为空时省略(同 emptyToUndefined 口径) */
export async function enhanceDramaLine(
  scriptId: string,
  sceneIndex: number,
  lineIndex: number,
  body: { content: string; instruction?: string },
): Promise<ApiResult<DramaLineRewriteResult>> {
  const payload = body.instruction
    ? { content: body.content, instruction: body.instruction }
    : { content: body.content }
  return fetchApi<DramaLineRewriteResult>(
    `/api/drama/scripts/${encodeURIComponent(scriptId)}/scenes/${sceneIndex}/lines/${lineIndex}/enhance`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
