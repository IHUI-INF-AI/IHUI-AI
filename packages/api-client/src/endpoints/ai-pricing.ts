// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 模型定价查询端点封装(W4 成本真网计价,2026-09-12 立)。
 *
 * 后端:apps/api/src/routes/ai-pricing.ts(数据源 ai_pricing 表,单位「分/千 token」整数,CNY)。
 * web 经同源代理 `/api/ai-pricing` 落 8802 网关(无显式白名单,走 `/api/:path*` 兜底)。
 * 徽章按当前模型查表计费;未收录、币种非 CNY 或接口不可用时返回 null,由调用方降级为「不显示 ¥」。
 * 注意:响应字段用后端别名 inputPrice/outputPrice,规避 response-sanitizer 对含 "token" 字段名的脱敏。
 */
import { fetchApi } from '../client.js'

/** 单条模型定价(单位:分/千 token) */
export interface AiPricingItem {
  modelId: string
  /** 输入单价(分/千 token) */
  inputPrice: number
  /** 输出单价(分/千 token) */
  outputPrice: number
  /** 币种(seed 统一为 CNY) */
  currency: string
}

/** 归一化后的模型单价(元/千 token,仅 CNY) */
export interface ModelPriceCny {
  /** 命中的价目表模型 ID(便于排查归一化结果) */
  modelId: string
  /** 输入单价(元/千 token) */
  inputPricePer1kCny: number
  /** 输出单价(元/千 token) */
  outputPricePer1kCny: number
}

/** 拉取模型定价列表(GET /api/ai-pricing;pageSize 上限 200,足以覆盖全量 seed) */
export async function getAiPricingList(pageSize = 200): Promise<AiPricingItem[]> {
  const res = await fetchApi<{ items?: AiPricingItem[] }>(`/api/ai-pricing?pageSize=${pageSize}`)
  if (!res.success) return []
  return (res.data?.items ?? []).filter((it) => typeof it?.modelId === 'string')
}

/**
 * 按模型 ID 匹配价目:
 *  1. 先精确匹配(如 stepfun/step-3.7-flash、azure/gpt-4o);
 *  2. 未命中则剥离 `vendor/` 前缀,按裸模型名再匹配(如 openai/gpt-4o → gpt-4o)。
 * 均未命中返回 null(调用方降级为不显示 ¥)。
 */
export function matchAiPricing(model: string, items: AiPricingItem[]): AiPricingItem | null {
  if (!model) return null
  const exact = items.find((it) => it.modelId === model)
  if (exact) return exact
  const slash = model.lastIndexOf('/')
  if (slash < 0) return null
  const bare = model.slice(slash + 1)
  if (!bare) return null
  return items.find((it) => it.modelId === bare) ?? null
}

/** 查当前模型单价(元/千 token);未收录 / 非 CNY / 接口不可用 → null */
export async function getModelPriceCny(model: string): Promise<ModelPriceCny | null> {
  if (!model || model === 'auto') return null
  const items = await getAiPricingList()
  const hit = matchAiPricing(model, items)
  if (!hit || hit.currency !== 'CNY') return null
  return {
    modelId: hit.modelId,
    inputPricePer1kCny: hit.inputPrice / 100,
    outputPricePer1kCny: hit.outputPrice / 100,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
