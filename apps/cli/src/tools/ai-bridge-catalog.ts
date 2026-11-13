// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ai-service 端点**目录层**(2026-11-13 自 `ai-bridge.ts` 拆出,AGENTS §3 拆档)。
 *
 * 只做两件事:把生成器产出的行清单解析成记录;按 path 抽占位名。
 * **零网络、零副作用** —— 目录层的价值就在于此:模型可以先"看"再"调",不必为检索付出一次请求。
 *
 * 判据一条没动,只换了住处。`ai-bridge.ts` 仍是唯一对外的工具族出口。
 */

import { AI_ENDPOINTS_RAW } from './ai-endpoints.generated.js'

/** 目录里的一条 ai-service 端点记录。 */
export interface AiEndpointRecord {
  method: string
  path: string
  /** 一级能力域(去掉 api/v1 后的首段),如 knowledge / agents / llm */
  domain: string
  /** OpenAPI operationId(可能为空 —— ai-service 有 Duplicate Operation ID 告警,不保证唯一) */
  operationId: string
  summary: string
  tags: string[]
  /** path 里的 `{param}` 占位名 */
  pathParams: string[]
}

/** 惰性解析缓存:682 行只在首次调用时切一次。 */
let catalogCache: AiEndpointRecord[] | null = null

/** 端点目录(唯一解析点)。字段序与生成器 `serializeRow` 逐字对齐。 */
export function aiEndpointCatalog(): AiEndpointRecord[] {
  if (catalogCache) return catalogCache
  const rows: AiEndpointRecord[] = []
  for (const line of AI_ENDPOINTS_RAW.split('\n')) {
    if (line === '') continue
    const [method, path, domain, operationId, summary, tags, pathParams] = line.split('\u0001')
    if (!method || !path) continue
    rows.push({
      method,
      path,
      domain: domain ?? '',
      operationId: operationId ?? '',
      summary: summary ?? '',
      tags: tags ? tags.split(',').filter(Boolean) : [],
      pathParams: pathParams ? pathParams.split(',').filter(Boolean) : [],
    })
  }
  catalogCache = rows
  return rows
}

/** 路径参数名(与生成器 `pathParamNames` 同口径:OpenAPI 的 `{x}` 形态)。 */
export function aiPathParamsOf(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).filter((x): x is string => typeof x === 'string')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
