// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 用户级 LLM 配置中心 v2 类型定义(2026-07-22 立)
 *
 * 数据模型:
 * - aiModelConfig (provider 主表,1:N → aiModelConfigModels)
 * - aiModelConfigModels (子表,每个 provider 挂载多个 model)
 * - aiModelConfigGroups (用户自定义分组)
 *
 * 既有 v1 类型(UserLlmConfig / FormState)仍存在,新代码推荐用 v2 类型。
 */
import type { PlatformTemplate, TestResult, UpstreamModel } from './types'

export type { PlatformTemplate, TestResult, UpstreamModel }

/**
 * provider / model 健康档封闭联合(G-716 立,2026-09-29)。
 *
 * 立因:此前这里是裸 `healthStatus?: string`,而 `ProviderCardV2.tsx` 用三档 if 猜色、
 * 并把**原始英文枚举直接渲染进徽章**(同文件 noKey 徽章反而走 `t()` ⇒ 同一组件两种口径)。
 * 封闭联合把值域钉住,渲染面从此拿得到"每一档都有词表键"这一编译期保证。
 *
 * **取值域是反查出来的,不是手抄的**(按当次 schema 实测,勿照本注释派单):
 *   - `packages/database/src/schema/ai-config.ts:77`
 *       `healthStatus: varchar('health_status', { length: 16 }).default('unknown')`
 *     ⇒ 缺省档是 `unknown`,所以"没有健康记录"是一个**真实档位**,不是兜底文案;
 *   - `packages/database/src/schema/ai-relay.ts:28` 的列注释原文
 *       `healthStatus:unknown/healthy/degraded/down,healthCheckedAt 最近检查时间`
 *     ⇒ 同一列在 relay 侧的文档值域,与上面缺省档合起来就是这四档;
 *   - 写入面实测同值:`services/relay-health-check-service.ts:273`('healthy')、
 *     `routes/user-llm-configs-v2.ts:564`(缺省建值 'unknown')、
 *     `routes/relay-monitor-public.ts:108`(`?? 'unknown'`)。
 *   - 同族既有写法:`app/(main)/models/channels/channels-api.ts:13` 的
 *     `RelayKeyPoolHealthStatus` 是同一值域的第二份声明(不同表、同档位)。
 *     **合并成一份是另一票**(动它要连 channels/PageClient 一起改),本票只登记不并表。
 *
 * 词表落在 `llmSettings.v2.health` 下的四档(healthy / degraded / down / unknown,五语言齐)。
 * 刻意**不**复用 `shared` 里 `capabilityMarket.healthy|degraded|unhealthy` 那张表 ——
 * 那是 MCP 能力市场的档位(`unhealthy` 与本域的 `down` 不同名同不同义,`degraded` 在那里
 * 译成"需网络"是能力市场专属语义),把两张表并成一张会同时改坏两个域的文案。
 */
export const PROVIDER_HEALTH_STATUSES = ['unknown', 'healthy', 'degraded', 'down'] as const

export type ProviderHealthStatus = (typeof PROVIDER_HEALTH_STATUSES)[number]

/**
 * 把接口来的原始字符串收敛成封闭档位。
 *
 * 落在值域外的值 ⇒ `unknown`。这不是"把未知档兜底成某个已知文案":
 * `unknown` 正是 schema 的缺省档,语义是"本轮无法判定"(上游 constants 的同一口径),
 * 它自己就是一句显式的"没判到",不是一个被冒充的健康结论。
 * 反过来,把认不出的值原样渲染出去(改动前的行为)才是把"判不出"写成"某个状态"。
 */
export function toProviderHealthStatus(raw: string | null | undefined): ProviderHealthStatus {
  return (PROVIDER_HEALTH_STATUSES as readonly string[]).includes(raw ?? '')
    ? (raw as ProviderHealthStatus)
    : 'unknown'
}

/** 单个 model 子表行(对应 ai_model_config_models) */
export interface UserLlmModel {
  id: number
  configId: number
  modelId: string
  displayName: string | null
  contextLength: number
  inputPricePer1k: string
  outputPricePer1k: string
  defaultParams: Record<string, unknown>
  enabled: boolean
  isDefault: boolean
  sortOrder: number
  /** G-716:封闭档位;取回原始串时用 toProviderHealthStatus 收敛,勿直接 cast */
  healthStatus?: ProviderHealthStatus
  lastHealthCheckAt?: string | null
  extraMetadata?: Record<string, unknown>
  usage30dTokens?: number
  usage30dCostCents?: number
  createdAt?: string
  updatedAt?: string
}

/** Provider 主表行(增强字段,2026-07-22 立) */
export interface UserLlmProvider {
  id: number
  name: string
  providerCode: string
  isBuiltin: boolean
  baseUrl: string
  apiFormat: 'openai_chat' | 'anthropic_messages' | 'openai_responses'
  modelIdForTest: string | null
  enabled: boolean
  description: string | null
  sortOrder: number
  /** Phase 1 新增:provider 分组代码 */
  providerGroup: string | null
  /** Phase 1 新增:分组显示名 */
  groupLabel: string | null
  /** Phase 1 新增:冗余快速读默认 model */
  defaultModelId: string | null
  /** Phase 1 新增:同分组内排序 */
  sortOrderInGroup: number
  /** Phase 1 新增:健康状态(G-716:封闭档位,值域见 ProviderHealthStatus 上方反查注释) */
  healthStatus: ProviderHealthStatus
  /** Phase 1 新增:上次健康检查时间 */
  lastHealthCheckAt: string | null
  /** Phase 1 新增:30 天 token 用量 */
  usage30dTokens: number
  /** Phase 1 新增:30 天成本(分) */
  usage30dCostCents: number
  hasApiKey: boolean
  lastTestStatus: 'success' | 'failed' | null
  lastTestedAt: string | null
  /** 融合 admin/ai-models:test 响应耗时(2026-07-22 立) */
  lastTestResponseMs?: number | null
  /** 融合 admin/ai-models:test 失败错误详情(2026-07-22 立) */
  lastTestError?: string | null
  createdAt: string
  /** Provider 下的 model 列表(列表接口聚合返回) */
  models?: UserLlmModel[]
}

/** Provider 分组(列表接口聚合后的结构) */
export interface ProviderGroup {
  group: string
  groupLabel: string
  providers: UserLlmProvider[]
  /** 分组实体 id(来自 /llm-groups,按 label 匹配注入;聚合接口本身不返回) */
  id?: number
}

/** 列表响应 */
export interface ProviderListData {
  groups: ProviderGroup[]
  total: number
}

/** 分组响应 */
export interface GroupData {
  id: number
  label: string
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface GroupListData {
  list: GroupData[]
  total: number
  schemaPending?: boolean
}

/** Provider 表单状态(用于 dialog) */
export interface ProviderFormState {
  id: number | null
  providerCode: string
  name: string
  apiKey: string
  baseUrlOverride: string
  apiFormat: 'openai_chat' | 'anthropic_messages' | 'openai_responses'
  providerGroup: string
  groupLabel: string
  description: string
  enabled: boolean
}

export const EMPTY_PROVIDER_FORM: ProviderFormState = {
  id: null,
  providerCode: 'openai',
  name: '',
  apiKey: '',
  baseUrlOverride: '',
  apiFormat: 'openai_chat',
  providerGroup: 'default',
  groupLabel: '默认',
  description: '',
  enabled: true,
}

/** Model 默认参数结构化字段(2026-07-22 立,融合 /chat/settings 参数能力) */
export interface ModelDefaultParamsStructured {
  /** 采样温度 0~2(行业通用英文术语,替代"温度") */
  temperature?: number
  /** 单次响应最大 token(行业通用英文术语,替代"最大 token") */
  maxTokens?: number
  /** 核采样阈值 0~1 */
  topP?: number
  /** 频率惩罚 -2~2 */
  frequencyPenalty?: number
  /** 存在惩罚 -2~2 */
  presencePenalty?: number
  /** 系统提示词(行业通用英文术语,替代"系统提示词") */
  systemPrompt?: string
  /** 停止序列(字符串数组) */
  stop?: string[]
  /** 响应格式:'text' | 'json_object' */
  responseFormat?: 'text' | 'json_object'
  /** 扩展字段(行业特殊参数,如 seed / tools 等) */
  extra?: Record<string, unknown>
}

/** Model 表单状态(2026-07-22 升级,结构化 params) */
export interface ModelFormState {
  id: number | null
  modelId: string
  displayName: string
  contextLength: number
  inputPricePer1k: string
  outputPricePer1k: string
  /** 结构化默认参数(推荐,前端直接编辑) */
  params: ModelDefaultParamsStructured
  /** JSON 入口(高级,允许用户直接编辑完整 jsonb) */
  advancedJson: string
  enabled: boolean
  isDefault: boolean
  sortOrder: number
}

export const EMPTY_MODEL_FORM: ModelFormState = {
  id: null,
  modelId: '',
  displayName: '',
  contextLength: 32000,
  inputPricePer1k: '0',
  outputPricePer1k: '0',
  params: {
    temperature: 0.7,
    maxTokens: 4096,
    topP: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
    systemPrompt: '',
  },
  advancedJson: '',
  enabled: true,
  isDefault: false,
  sortOrder: 0,
}

/** Model 默认参数默认值(创建空表单时填充) */
export const DEFAULT_MODEL_PARAMS: Required<
  Omit<ModelDefaultParamsStructured, 'systemPrompt' | 'stop' | 'responseFormat' | 'extra'>
> = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
