// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短剧(drama)域端点封装 —— web /drama 一页两表单的 RN 取数出口。
 *
 * 后端契约证据(路径 / 方法 / 信封逐条实测,非推断):
 * - 注册前缀:apps/api/src/routes/index.ts:1040 `server.register(dramaRoutes, { prefix: '/api' })`
 *   (被注册的是 apps/api/src/routes/drama.ts,不是 other/drama-routes.ts 的同名导出)
 * - POST /api/drama/scripts/:id/enhance   apps/api/src/routes/drama.ts:36
 *     body: { title?: string }            drama.ts:16-18(zod,空串经 emptyToUndefined 转 undefined)
 *     data: { consistency, pacing, outline } drama.ts:47 `success({ consistency, pacing, outline })`
 *     三字段真实类型来自 apps/api/src/services/ai/plot-advisor-service.ts:
 *       consistency = ConsistencyIssue[]  (同文件:86-90,type/message/severity)
 *       pacing      = PacingAnalysis      (同文件:208-213,totalPoints/byType/score/suggestions)
 *       outline     = string[]            (同文件:307-310 返回 Promise<string[]>)
 * - POST /api/drama/scripts/:id/scenes/:sceneIndex/lines/:lineIndex/enhance  drama.ts:51-52
 *     body: { content: string(1..5000), instruction?: string } drama.ts:20-23
 *     data: { original, rewritten, sceneIndex:number, lineIndex:number } drama.ts:100-107
 * - 鉴权:插件级 preHandler `await authenticate(request)`,失败 401(drama.ts:26-33)
 * - 信封:统一 { code, message, data }(apps/api/src/utils/response.ts:22-24),fetchApi 已剥壳到 data。
 *
 * 两条 GET 同名端点(apps/api/src/routes/other/drama-routes.ts:133/137)是恒返 {list:[],total:0}
 * 的空桩,web /drama 亦不使用,故本文件不封装。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 角色一致性问题(后端 plot-advisor-service.ts:86-90 同形)。 */
export interface DramaConsistencyIssue {
  type: 'trait_conflict' | 'relation_conflict' | 'unresolved_foreshadow'
  message: string
  severity: 'info' | 'warning' | 'critical'
}

/** 节奏分析(后端 plot-advisor-service.ts:208-213 同形;score 0~100)。 */
export interface DramaPacingAnalysis {
  totalPoints: number
  byType: Record<string, number>
  score: number
  suggestions: string[]
}

/** POST /drama/scripts/:id/enhance 的 data 载荷。 */
export interface DramaEnhanceResult {
  consistency: DramaConsistencyIssue[]
  pacing: DramaPacingAnalysis
  outline: string[]
}

/** POST /drama/scripts/:id/scenes/:s/lines/:l/enhance 的 data 载荷。 */
export interface DramaLineRewrite {
  original: string
  rewritten: string
  sceneIndex: number
  lineIndex: number
}

/** 整体增强:角色一致性 + 节奏分析 + 章节大纲(title 缺省时后端落 `剧本 ${id}`)。 */
export async function enhanceDramaScript(
  scriptId: string,
  body: { title?: string } = {},
): Promise<ApiResult<DramaEnhanceResult>> {
  return fetchApi<DramaEnhanceResult>(
    `/api/drama/scripts/${encodeURIComponent(scriptId)}/enhance`,
    { method: 'POST', body: JSON.stringify(body), timeoutMs: 120_000 },
  )
}

/** 单行对白改写(sceneIndex/lineIndex 后端按字符串收参、按数字回参)。 */
export async function enhanceDramaScriptLine(input: {
  scriptId: string
  sceneIndex: number
  lineIndex: number
  content: string
  instruction?: string
}): Promise<ApiResult<DramaLineRewrite>> {
  const { scriptId, sceneIndex, lineIndex, content, instruction } = input
  return fetchApi<DramaLineRewrite>(
    `/api/drama/scripts/${encodeURIComponent(scriptId)}/scenes/${sceneIndex}/lines/${lineIndex}/enhance`,
    {
      method: 'POST',
      body: JSON.stringify({ content, ...(instruction ? { instruction } : {}) }),
      timeoutMs: 120_000,
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
