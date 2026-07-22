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
  healthStatus?: string
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
  /** Phase 1 新增:健康状态 */
  healthStatus: string
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
export const DEFAULT_MODEL_PARAMS: Required<Omit<ModelDefaultParamsStructured, 'systemPrompt' | 'stop' | 'responseFormat' | 'extra'>> = {
  temperature: 0.7,
  maxTokens: 4096,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
}
