import { t } from '@/utils/i18n'

export type ModelType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'coze'
  | 'dashscope'
  | 'baidu'
  | 'alibaba'
  | 'tencent'
  | 'doubao'
  | 'zhipu'
  | 'moonshot'
  | 'custom'

export interface PricingConfig {
  inputTokenPrice: number
  outputTokenPrice: number
  imagePrice?: number
  audioPrice?: number
  videoPrice?: number
  regionPricing?: {
    [region: string]: {
      inputTokenPrice: number
      outputTokenPrice: number
      imagePrice?: number
      audioPrice?: number
      videoPrice?: number
    }
  }
  bulkDiscounts?: {
    thresholds: number[]
    discounts: number[]
  }
}

export interface ProxyConfig {
  proxyUrl?: string
  loadBalanceStrategy?: 'round-robin' | 'least-connections' | 'weighted'
  failoverEnabled?: boolean
  cacheEnabled?: boolean
  cacheTTL?: number
  rateLimit?: {
    qps: number
    burst: number
  }
  apiKeys?: string[]
  healthCheck?: {
    enabled: boolean
    interval: number
    timeout: number
  }
}

export interface AIModel {
  id: string
  name: string
  type: ModelType
  provider: string
  modelId: string
  apiKey?: string
  baseUrl?: string
  description?: string
  capabilities?: string[]
  maxTokens?: number
  temperature?: number
  enabled: boolean
  usageCount?: number
  lastUsed?: string
  createTime?: string
  updateTime?: string
  pricing?: PricingConfig
  proxy?: ProxyConfig
  config?: Record<string, unknown>
}

export const MODEL_PROVIDERS = {
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'organization'],
    defaultPricing: {
      inputTokenPrice: 0.03,
      outputTokenPrice: 0.06,
    },
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'version'],
    defaultPricing: {
      inputTokenPrice: 0.003,
      outputTokenPrice: 0.015,
    },
  },
  google: {
    name: 'Google',
    icon: '🔍',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    models: ['gemini-pro', 'gemini-ultra', 'gemini-1.5-pro'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.0015,
    },
  },
  coze: {
    name: '智汇智能体（ihui）',
    icon: '💬',
    baseUrl: 'https://api.coze.cn/v1',
    models: ['coze-pro'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl', 'botId'],
    defaultPricing: {
      inputTokenPrice: 0.002,
      outputTokenPrice: 0.002,
    },
  },
  dashscope: {
    name: '阿里云百炼',
    icon: '☁️',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-vl-max'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.002,
    },
  },
  baidu: {
    name: '百度文心一言',
    icon: '🔷',
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
    models: ['ernie-bot', 'ernie-bot-turbo', 'ernie-bot-4', 'ernie-vilg'],
    requiredFields: ['apiKey', 'secretKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0012,
      outputTokenPrice: 0.0012,
    },
  },
  alibaba: {
    name: '阿里通义千问',
    icon: '🌐',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.002,
    },
  },
  tencent: {
    name: '腾讯混元',
    icon: '💎',
    baseUrl: 'https://hunyuan.tencentcloudapi.com',
    models: ['hunyuan-standard', 'hunyuan-pro', 'hunyuan-lite'],
    requiredFields: ['secretId', 'secretKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.001,
    },
  },
  doubao: {
    name: '字节豆包',
    icon: '🎯',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: ['doubao-pro', 'doubao-lite', 'doubao-vision'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0008,
      outputTokenPrice: 0.0016,
    },
  },
  zhipu: {
    name: '智谱AI',
    icon: '🌟',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4', 'glm-3-turbo', 'glm-4v'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.001,
    },
  },
  moonshot: {
    name: 'Moonshot AI',
    icon: '🌙',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    requiredFields: ['apiKey'],
    optionalFields: ['baseUrl'],
    defaultPricing: {
      inputTokenPrice: 0.0005,
      outputTokenPrice: 0.002,
    },
  },
  custom: {
    name: '自定义模型',
    icon: '🔧',
    baseUrl: '',
    models: [],
    requiredFields: ['apiKey', 'baseUrl', 'modelId'],
    optionalFields: [],
    defaultPricing: {
      inputTokenPrice: 0.001,
      outputTokenPrice: 0.001,
    },
  },
}

export type PluginType = 'function' | 'tool' | 'integration' | 'custom'

export type PluginStatus = 'draft' | 'published' | 'deprecated' | 'reviewing'

export interface Plugin {
  id: string
  name: string
  type: PluginType
  description: string
  version: string
  author: string
  icon?: string
  category?: string
  tags?: string[]
  status: PluginStatus
  config?: Record<string, unknown>
  manifest?: Record<string, unknown>
  apiEndpoint?: string
  webhookUrl?: string
  enabled: boolean
  installCount?: number
  rating?: number
  ratingCount?: number
  createTime?: string
  updateTime?: string
}

export interface ApiEndpoint {
  id: string
  gatewayId: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  description?: string
  parameters?: ApiParameter[]
  requestBody?: ApiRequestBody
  responses?: ApiResponse
  authRequired: boolean
  rateLimit?: {
    qps: number
    burst: number
  }
  enabled: boolean
}

export interface ApiParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description?: string
  defaultValue?: any
  enum?: any[]
  min?: number
  max?: number
  pattern?: string
}

export interface ApiRequestBody {
  contentType: 'application/json' | 'application/xml' | 'multipart/form-data'
  schema: Record<string, unknown>
  required?: string[]
}

export interface ApiResponse {
  statusCode: number
  description?: string
  schema: Record<string, unknown>
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface DeveloperAPI {
  id: string
  name: string
  path: string
  method: ApiMethod
  description: string
  version: string
  category?: string
  tags?: string[]
  requestParams?: Array<{
    name: string
    type: string
    required: boolean
    description?: string
    example?: any
  }>
  responseSchema?: Record<string, unknown>
  authRequired: boolean
  rateLimit?: {
    requests: number
    period: string
  }
  enabled: boolean
  callCount?: number
  successCount?: number
  errorCount?: number
  createTime?: string
  updateTime?: string
}

export type MCPProtocol = 'stdio' | 'sse' | 'websocket'

export type MCPServerStatus = 'active' | 'inactive' | 'error'

export interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface MCPResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface MCPPrompt {
  name: string
  description?: string
  arguments?: Array<{
    name: string
    description?: string
    required?: boolean
  }>
}

export interface MCPCapability {
  tools?: MCPTool[]
  resources?: MCPResource[]
  prompts?: MCPPrompt[]
}

export interface MCPServer {
  id: string
  name: string
  protocol: MCPProtocol
  url: string
  apiKey?: string
  description?: string
  status: MCPServerStatus
  errorMessage?: string
  transport?: {
    command?: string
    args?: string[]
  }
  config?: Record<string, unknown>
  tools?: MCPTool[]
  resources?: MCPResource[]
  prompts?: MCPPrompt[]
  capabilities?: MCPCapability
  createTime?: string
  updateTime?: string
}

export const MCP_PROTOCOLS: Record<
  MCPProtocol,
  { name: string; description: string; icon: string }
> = {
  stdio: {
    name: 'STDIO',
    description: t('text.types.标准输入输出适用'),
    icon: '📟',
  },
  sse: {
    name: 'SSE',
    description: t('text.types.服务器发送事件适1'),
    icon: '📡',
  },
  websocket: {
    name: 'WebSocket',
    description: t('text.types.WebSocke2'),
    icon: '🔌',
  },
}
