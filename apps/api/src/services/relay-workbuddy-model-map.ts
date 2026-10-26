// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 上游模型目录 → 项目模型配置的纯映射(2026-10-23 立)。
 *
 * 为什么带 `workbuddy/` 前缀:上游模型 id(hy3/glm-5.3/deepseek-v4-pro 等)与现有渠道
 * 大面积撞名(实测 swiftapi/zhipu/qwen 等已有同名模型),不前缀会被渠道路由先截走,
 * 账号池永远轮不到;前缀 + ai_relay_model_catalog 别名解析保证请求真正落到 WorkBuddy。
 *
 * 只做字符串/对象映射与 SQL 语句构造(不执行、不碰 DB/网络),便于单测与同步脚本共用同一份判据。
 *
 * 单源档位(票 L28826,2026-10-28):ai_model_config / ai_model_config_models 的**登记字段**
 * (config_name / base_url / api_format / enabled / is_relay_public)唯一取值源 =
 * `scripts/data/relay-upstream-models.jsonl` 的 workbuddy 登记行,由 `parseWorkbuddyRegistration`
 * 读取;号池登记器 `scripts/relay-upstream-models-sync.mjs` 吃同一行。两路写字段互斥
 * (能力/定价/catalog 只归动态同步器;points_multiplier 只归登记器;name/description 双方皆 insert-only),
 * 且共用同一配置行匹配键 (provider_code, base_url, owner_uuid IS NULL) ⇒ 谁后跑不再决定结果。
 */

export const WORKBUDDY_MODEL_PREFIX = 'workbuddy/'
export const WORKBUDDY_PROVIDER_CODE = 'workbuddy'

export interface WorkbuddyUpstreamModel {
  id: string
  name?: string
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  supportsImages?: boolean
  supportsToolCall?: boolean
  supportsReasoning?: boolean
  onlyReasoning?: boolean
  disabledMultimodal?: boolean
  tags?: string[]
  vendor?: string
  descriptionZh?: string
  descriptionEn?: string
  reasoning?: { effort?: string; summary?: string }
}

export interface WorkbuddyPoolModelRow {
  modelId: string
  upstreamModel: string
  displayName: string
  contextLength: number
  maxOutputTokens: number | null
  supportsToolCall: boolean
  supportsVision: boolean
  tags: string[]
  vendor: string | null
  description: string | null
  metadata: Record<string, unknown>
  sortOrder: number
}

/** 账号池只支持 chat;text-to-image 模型(如 hunyuan-image-alpha)不能挂进来 */
export function isChatCapableModel(model: WorkbuddyUpstreamModel): boolean {
  const tags = Array.isArray(model.tags) ? model.tags : []
  return !tags.includes('text-to-image')
}

export function toPoolModelId(upstreamId: string): string {
  return `${WORKBUDDY_MODEL_PREFIX}${upstreamId}`
}

/**
 * 生成待落库的模型行:
 * - model_id = workbuddy/<上游 id>(别名在 catalog 里映射回上游 id);
 * - 上下文/输出上限取上游元数据,缺省 32000 / null;
 * - 能力标记取上游 supportsImages/supportsToolCall,reasoning 落 tags 与 metadata;
 * - 排除 text-to-image(账号池仅 chat)。
 */
export function buildWorkbuddyModelRows(
  models: WorkbuddyUpstreamModel[],
  opts: { excludeIds?: string[]; startSortOrder?: number } = {},
): WorkbuddyPoolModelRow[] {
  const exclude = new Set(opts.excludeIds ?? [])
  const rows: WorkbuddyPoolModelRow[] = []
  let order = opts.startSortOrder ?? 0
  for (const model of models) {
    if (!model || typeof model.id !== 'string' || !model.id) continue
    if (exclude.has(model.id)) continue
    if (!isChatCapableModel(model)) continue
    const tags = [...new Set((Array.isArray(model.tags) ? model.tags : []).filter(Boolean))]
    if (model.supportsReasoning && !tags.includes('reasoning')) tags.push('reasoning')
    if (model.onlyReasoning && !tags.includes('reasoning-only')) tags.push('reasoning-only')
    tags.push('workbuddy')
    rows.push({
      modelId: toPoolModelId(model.id),
      upstreamModel: model.id,
      displayName: (model.name || model.id).slice(0, 128),
      contextLength:
        typeof model.maxInputTokens === 'number' && model.maxInputTokens > 0
          ? model.maxInputTokens
          : 32000,
      maxOutputTokens:
        typeof model.maxOutputTokens === 'number' && model.maxOutputTokens > 0
          ? model.maxOutputTokens
          : null,
      supportsToolCall: model.supportsToolCall === true,
      supportsVision: model.supportsImages === true,
      tags: [...new Set(tags)],
      vendor: typeof model.vendor === 'string' && model.vendor ? model.vendor : null,
      description: (model.descriptionZh || model.descriptionEn || '').slice(0, 500) || null,
      metadata: {
        workbuddy: {
          upstreamModel: model.id,
          onlyReasoning: model.onlyReasoning === true,
          reasoning: model.reasoning ?? null,
          disabledMultimodal: model.disabledMultimodal === true,
        },
      },
      sortOrder: order++,
    })
  }
  return rows
}

export const __test__ = {
  WORKBUDDY_MODEL_PREFIX,
  isChatCapableModel,
  toPoolModelId,
  buildWorkbuddyModelRows,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
