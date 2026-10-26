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

/** 登记表 workbuddy 行供给的登记字段(与号池登记器同一份口径,禁止第二处字面量)。 */
export interface WorkbuddyRegistrationContract {
  providerCode: string
  configName: string
  baseUrl: string
  apiFormat: string
  enabled: boolean
  isRelayPublic: boolean
}

export interface SqlStatement {
  sql: string
  params: unknown[]
}

/**
 * 从登记表 jsonl 文本取 workbuddy 档位。取不到 / 不可信 ⇒ `{ok:false, why}` 且 why 写明出路
 * (失效方向恒为"多要一次定向说明",绝不回落硬编码档位、绝不静默跳写)。
 */
export function parseWorkbuddyRegistration(
  registryText: string,
): { ok: true; contract: WorkbuddyRegistrationContract } | { ok: false; why: string } {
  const hits: Array<Record<string, unknown>> = []
  const bad: string[] = []
  String(registryText ?? '')
    .split('\n')
    .forEach((line, i) => {
      if (!line.trim()) return
      let o: unknown
      try {
        o = JSON.parse(line)
      } catch (e) {
        bad.push(`第 ${i + 1} 行不是合法 JSON(${e instanceof Error ? e.message : String(e)})`)
        return
      }
      const rec = o as Record<string, unknown>
      if (rec?.providerCode === WORKBUDDY_PROVIDER_CODE) hits.push(rec)
    })
  if (bad.length) return { ok: false, why: `登记表不可信:${bad.join(' · ')}` }
  if (hits.length === 0)
    return {
      ok: false,
      why: `登记表 scripts/data/relay-upstream-models.jsonl 无 providerCode=${WORKBUDDY_PROVIDER_CODE} 登记行 ⇒ 拒写 ai_model_config/ai_model_config_models;出路:先按登记器口径登记该档位`,
    }
  if (hits.length > 1)
    return {
      ok: false,
      why: `providerCode=${WORKBUDDY_PROVIDER_CODE} 有 ${hits.length} 枚登记行,不得猜该用哪一条`,
    }
  const e = hits[0]
  if (!e)
    return {
      ok: false,
      why: `providerCode=${WORKBUDDY_PROVIDER_CODE} 命中计数与索引不一致(内部不变式被破坏),不猜`,
    }
  const miss: string[] = []
  for (const k of ['configName', 'baseUrl', 'apiFormat'] as const)
    if (typeof e[k] !== 'string' || !e[k]) miss.push(k)
  for (const k of ['enabled', 'isRelayPublic'] as const)
    if (typeof e[k] !== 'boolean') miss.push(`${k}(必须布尔)`)
  if (!Array.isArray(e.models) || e.models.length === 0) miss.push('models(必须非空数组)')
  if (miss.length)
    return { ok: false, why: `workbuddy 登记行缺字段:${miss.join(' · ')}(不回落硬编码档位)` }
  return {
    ok: true,
    contract: {
      providerCode: WORKBUDDY_PROVIDER_CODE,
      configName: e.configName as string,
      baseUrl: e.baseUrl as string,
      apiFormat: e.apiFormat as string,
      enabled: e.enabled as boolean,
      isRelayPublic: e.isRelayPublic as boolean,
    },
  }
}

/** 配置行匹配键与登记器 readSnapshot 同源:(provider_code, base_url, owner_uuid IS NULL)。 */
export function buildConfigMatchStatement(contract: WorkbuddyRegistrationContract): SqlStatement {
  return {
    sql: `select id from ai_model_config
     where provider_code=$1 and base_url=$2 and owner_uuid is null order by id limit 1`,
    params: [contract.providerCode, contract.baseUrl],
  }
}

/**
 * 配置行落库语句。既有行只回写双方共源的 name/api_format/enabled 与动态侧自有的
 * provider_group/group_label;base_url(匹配键)与 description(登记器 insert-only)不覆盖。
 */
export function buildConfigSyncStatements(
  contract: WorkbuddyRegistrationContract,
  display: { description: string; providerGroup: string; groupLabel: string },
  existingId: number | null,
): SqlStatement {
  if (existingId !== null)
    return {
      sql: `update ai_model_config set name=$1, api_format=$2, enabled=$3,
         provider_group=$4, group_label=$5, updated_at=now()
       where id=$6 and provider_code=$7 and owner_uuid is null returning id`,
      params: [
        contract.configName,
        contract.apiFormat,
        contract.enabled,
        display.providerGroup,
        display.groupLabel,
        existingId,
        contract.providerCode,
      ],
    }
  return {
    sql: `insert into ai_model_config (name, provider_code, base_url, api_format, enabled, description, provider_group, group_label, is_builtin)
     values ($1,$2,$3,$4,$5,$6,$7,$8,false) returning id`,
    params: [
      contract.configName,
      contract.providerCode,
      contract.baseUrl,
      contract.apiFormat,
      contract.enabled,
      display.description,
      display.providerGroup,
      display.groupLabel,
    ],
  }
}

/** 模型行落库语句:enabled / is_relay_public 取登记表档位;能力/定价列归动态同步器。 */
export function buildModelSyncStatements(
  contract: WorkbuddyRegistrationContract,
  configId: number,
  row: WorkbuddyPoolModelRow,
  existingId: number | null,
): SqlStatement {
  const metadata = JSON.stringify(row.metadata)
  if (existingId !== null)
    return {
      sql: `update ai_model_config_models set display_name=$1, context_length=$2, max_output_tokens=$3,
         input_price_per_1k=0, output_price_per_1k=0, enabled=$4, is_relay_public=$5,
         supports_tool_call=$6, supports_vision=$7, supports_streaming=true,
         tags=$8::text[], vendor=$9, description=$10, sort_order=$11, metadata=$12::jsonb,
         updated_at=now() where id=$13`,
      params: [
        row.displayName,
        row.contextLength,
        row.maxOutputTokens,
        contract.enabled,
        contract.isRelayPublic,
        row.supportsToolCall,
        row.supportsVision,
        row.tags,
        row.vendor,
        row.description,
        row.sortOrder,
        metadata,
        existingId,
      ],
    }
  return {
    sql: `insert into ai_model_config_models
       (config_id, model_id, display_name, context_length, max_output_tokens, input_price_per_1k, output_price_per_1k,
        enabled, is_relay_public, supports_tool_call, supports_vision, supports_streaming, tags, vendor, description, sort_order, metadata)
     values ($1,$2,$3,$4,$5,0,0,$6,$7,$8,$9,true,$10::text[],$11,$12,$13,$14::jsonb)`,
    params: [
      configId,
      row.modelId,
      row.displayName,
      row.contextLength,
      row.maxOutputTokens,
      contract.enabled,
      contract.isRelayPublic,
      row.supportsToolCall,
      row.supportsVision,
      row.tags,
      row.vendor,
      row.description,
      row.sortOrder,
      metadata,
    ],
  }
}

export const __test__ = {
  WORKBUDDY_MODEL_PREFIX,
  WORKBUDDY_PROVIDER_CODE,
  isChatCapableModel,
  toPoolModelId,
  buildWorkbuddyModelRows,
  parseWorkbuddyRegistration,
  buildConfigMatchStatement,
  buildConfigSyncStatements,
  buildModelSyncStatements,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
