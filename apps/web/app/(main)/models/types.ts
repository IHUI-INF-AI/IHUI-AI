export type Provider =
  // 国际原厂
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'meta'
  | 'mistral'
  | 'xai'
  | 'cohere'
  | 'nvidia'
  | 'ai21'
  | 'microsoft'
  | 'perplexity'
  // 国际推理平台
  | 'groq'
  | 'together'
  | 'fireworks'
  // 国际云平台/聚合平台
  | 'aws'
  | 'bedrock'
  | 'azure'
  | 'openrouter'
  | 'huggingface'
  | 'replicate'
  | 'stability'
  | 'inflection'
  | 'ibm'
  | 'cerebras'
  | 'sambanova'
  | 'snowflake'
  | 'deepinfra'
  | 'alephalpha'
  | 'nous'
  | 'vertexai'
  | 'gemma'
  | 'copilot'
  | 'bing'
  // 国际推理/云平台扩展
  | 'novita'
  | 'lambda'
  | 'baseten'
  | 'crusoe'
  | 'targon'
  | 'centml'
  | 'nebius'
  | 'ollama'
  | 'upstage'
  | 'leptonai'
  | 'hyperbolic'
  | 'featherless'
  | 'parasail'
  | 'openwebui'
  | 'lmstudio'
  | 'friendli'
  | 'anyscale'
  | 'infermatic'
  | 'replit'
  // 国内推理/云平台扩展
  | 'siliconcloud'
  | 'modelscope'
  | 'ppio'
  | 'volcengine'
  | 'bailian'
  | 'baai'
  | 'tii'
  | 'liquid'
  | 'ai2'
  // 国内厂商
  | 'qwen'
  | 'zhipu'
  | 'moonshot'
  | 'doubao'
  | 'stepfun'
  | 'hunyuan'
  | 'wenxin'
  | 'minimax'
  | 'baichuan'
  | 'spark'
  | 'yi'
  | 'sensenova'
  | 'skywork'
  | 'internlm'
  // 2026-07 新增国内新势力厂商
  | 'ornith'
  | 'codebrain'
  | 'mai'
  // 2026-07-22 新增免费 / 试用 credits provider(参考 cheahjs/free-llm-api-resources)
  | 'cloudflare_workers_ai'
  | 'nvidia_nim'
  | 'github_models'
  | 'vercel_ai_gateway'
  | 'opencode_zen'
  | 'modal'
  | 'inferencenet'
  | 'nlpcloud'
  | 'scaleway'
  | 'alibaba_intl'
  | 'local'

/**
 * 厂商分组(用于 ModelsNav 按分组展示 provider,降低 80+ 厂商的认知负担)
 */
export type ProviderGroup =
  'international' | 'domestic' | 'inference' | 'cloud' | 'aggregator' | 'local'

export interface Model {
  id: string
  name: string
  provider: Provider
  description: string
  contextLength: number
  inputPrice: number
  /** 输出价(美元 / 百万 tokens);未提供时由调用方按 inputPrice 推算 */
  outputPrice?: number
  /** 能力标签,用于快捷筛选 + 卡片标签 */
  features: string[]
  /** 0-100 推荐度,用于"推荐排序"与卡片 Highlight 徽章 */
  popularity?: number
  /** 发布时间(ISO 字符串),用于"最新排序" */
  releasedAt?: string
  /** 是否首页"推荐位"展示(顶部精选) */
  highlight?: boolean
}

/**
 * 快捷筛选能力 key(与 translations models.quickFilters 对应)
 * - free: inputPrice === 0
 * - longContext: contextLength >= 200000
 * - reasoning: features 含 Reasoning
 * - vision: features 含 Vision 或 Multimodal
 * - coding: features 含 Coding
 * - chinese: features 含 Chinese-Optimized 或 Bilingual
 * - openSource: features 含 Open Source
 * - favorite: 用户收藏(localStorage 持久化)
 * - configured: 用户已在 LLM 配置中心配置该 provider 的 API Key 且启用
 * - notConfigured: 用户未配置该 provider 的 API Key
 */
export type QuickFilter =
  | 'free'
  | 'longContext'
  | 'reasoning'
  | 'vision'
  | 'coding'
  | 'chinese'
  | 'openSource'
  | 'favorite'
  | 'configured'
  | 'notConfigured'

/** 排序方式 */
export type SortKey = 'recommended' | 'priceAsc' | 'priceDesc' | 'contextDesc' | 'nameAsc'

/** 视图模式 */
export type ViewMode = 'grid' | 'list'

/**
 * 预设 prompt:用于详情对话框"快捷试用"区,降低用户试用门槛
 * 用户点击预设 → 自动填入输入框 → 可直接发送或编辑
 */
export interface PresetPrompt {
  key: string
  label: string
  content: string
}

/** 收藏模型 localStorage 键 */
export const FAVORITE_MODELS_STORAGE_KEY = 'ihui:favorite-models'
