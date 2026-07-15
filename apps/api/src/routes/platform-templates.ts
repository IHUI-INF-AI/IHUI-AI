/**
 * LLM 平台模板(预置,只读,用户不可改)。
 *
 * 用户在自己的 LLM 配置页选择模板后,只需填:
 *  - apiKey(授权密钥,加密存储)
 *  - modelIdForTest(测试用的模型 ID)
 *  - contextLength(对话上下文支持数)
 *  - name(可选,用于在 UI 中区分)
 *
 * 平台的 baseUrl / apiFormat / headers 模板已硬编码,系统自动按此调用上游。
 * 复用 ai-service 的 litellm 调用链路,所以 provider 协议遵循 LiteLLM 约定。
 */

export type ApiFormat = 'openai_chat' | 'anthropic_messages' | 'openai_responses'

export interface PlatformTemplate {
  /** 唯一代码(LiteLLM 风格的 provider 前缀) */
  code: string
  /** UI 显示名称 */
  name: string
  /** 平台厂商,用于展示归类 */
  vendor:
    | 'openai'
    | 'anthropic'
    | 'google'
    | 'deepseek'
    | 'moonshot'
    | 'zhipu'
    | 'alibaba'
    | 'baidu'
    | 'bytedance'
    | 'stepfun'
    | 'groq'
    | 'openrouter'
    | 'ollama'
    | 'local'
    | 'custom'
  /** 平台描述(给用户看的) */
  description: string
  /** API Base URL(不含 /v1/chat/completions 之类路径) */
  baseUrl: string
  /** API 协议格式 */
  apiFormat: ApiFormat
  /** 用于测试的默认模型 ID(可被用户覆盖) */
  defaultModelId: string
  /** 默认上下文长度 */
  defaultContextLength: number
  /** 上游模型列表拉取路径(相对 baseUrl,带占位符 {api_key}) */
  modelsListPath?: string
  /** 是否官方平台(影响 logo 颜色等 UI) */
  isOfficial: boolean
  /** 文档 URL */
  docsUrl?: string
  /** 注册 URL(用户没 key 时引导去申请) */
  signupUrl?: string
}

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  // 国际主流
  {
    code: 'openai',
    name: 'OpenAI',
    vendor: 'openai',
    description: 'GPT-4o / GPT-4o-mini / o1 系列',
    baseUrl: 'https://api.openai.com/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'gpt-4o-mini',
    defaultContextLength: 128000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://platform.openai.com/docs',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
  {
    code: 'anthropic',
    name: 'Anthropic Claude',
    vendor: 'anthropic',
    description: 'Claude 3.5 / 3.7 Sonnet / Opus',
    baseUrl: 'https://api.anthropic.com',
    apiFormat: 'anthropic_messages',
    defaultModelId: 'claude-3-5-sonnet-latest',
    defaultContextLength: 200000,
    modelsListPath: '/v1/models',
    isOfficial: true,
    docsUrl: 'https://docs.anthropic.com',
    signupUrl: 'https://console.anthropic.com',
  },
  {
    code: 'google',
    name: 'Google Gemini',
    vendor: 'google',
    description: 'Gemini 1.5 Pro / Flash (免费 15 RPM)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiFormat: 'openai_chat',
    defaultModelId: 'gemini-1.5-flash',
    defaultContextLength: 1000000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://ai.google.dev',
    signupUrl: 'https://aistudio.google.com/apikey',
  },
  // 国内主流
  {
    code: 'deepseek',
    name: 'DeepSeek',
    vendor: 'deepseek',
    description: 'DeepSeek-V3 / R1(国产开源 SOTA)',
    baseUrl: 'https://api.deepseek.com',
    apiFormat: 'openai_chat',
    defaultModelId: 'deepseek-chat',
    defaultContextLength: 64000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://platform.deepseek.com/docs',
    signupUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    code: 'moonshot',
    name: 'Moonshot Kimi',
    vendor: 'moonshot',
    description: 'Kimi(月之暗面)128K 长上下文',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'moonshot-v1-8k',
    defaultContextLength: 8000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://platform.moonshot.cn/docs',
    signupUrl: 'https://platform.moonshot.cn/user-center',
  },
  {
    code: 'zhipu',
    name: '智谱 GLM',
    vendor: 'zhipu',
    description: 'GLM-4 / GLM-4-Plus',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiFormat: 'openai_chat',
    defaultModelId: 'glm-4-flash',
    defaultContextLength: 128000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://open.bigmodel.cn/dev/api',
    signupUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    code: 'alibaba',
    name: '通义千问 Qwen',
    vendor: 'alibaba',
    description: 'Qwen-Plus / Qwen-Max / Qwen-Long',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'qwen-plus',
    defaultContextLength: 128000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://help.aliyun.com/zh/model-studio',
    signupUrl: 'https://dashscope.console.aliyun.com/apiKey',
  },
  {
    code: 'baidu',
    name: '文心一言 Ernie',
    vendor: 'baidu',
    description: 'ERNIE-4.0 / ERNIE-3.5',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    apiFormat: 'openai_chat',
    defaultModelId: 'ernie-3.5-8k',
    defaultContextLength: 8000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://cloud.baidu.com/doc/qianfan',
    signupUrl: 'https://console.bce.baidu.com',
  },
  {
    code: 'bytedance',
    name: '豆包 Doubao',
    vendor: 'bytedance',
    description: 'Doubao-pro / lite(字节火山引擎)',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiFormat: 'openai_chat',
    defaultModelId: 'doubao-lite-32k',
    defaultContextLength: 32000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://www.volcengine.com/docs/82379',
    signupUrl: 'https://console.volcengine.com/ark',
  },
  {
    code: 'stepfun',
    name: '阶跃星辰 StepFun',
    vendor: 'stepfun',
    description: 'Step-3 / Step-2 / Step-1',
    baseUrl: 'https://api.stepfun.com/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'step-1-8k',
    defaultContextLength: 8000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://platform.stepfun.com/docs',
    signupUrl: 'https://platform.stepfun.com',
  },
  // 免费/聚合
  {
    code: 'groq',
    name: 'Groq',
    vendor: 'groq',
    description: 'Llama 3.3 70B(超快推理,免费)',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'llama-3.3-70b-versatile',
    defaultContextLength: 128000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://console.groq.com/docs',
    signupUrl: 'https://console.groq.com/keys',
  },
  {
    code: 'openrouter',
    name: 'OpenRouter',
    vendor: 'openrouter',
    description: '统一接入多家模型(有 free tier)',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'openrouter/auto',
    defaultContextLength: 128000,
    modelsListPath: '/models',
    isOfficial: true,
    docsUrl: 'https://openrouter.ai/docs',
    signupUrl: 'https://openrouter.ai/keys',
  },
  // 本地
  {
    code: 'ollama',
    name: 'Ollama (本地)',
    vendor: 'ollama',
    description: '本地部署的开源模型',
    baseUrl: 'http://localhost:11434/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'llama3.2',
    defaultContextLength: 128000,
    modelsListPath: '/models',
    isOfficial: false,
  },
  {
    code: 'lmstudio',
    name: 'LM Studio (本地)',
    vendor: 'local',
    description: '本地 GUI 启动的 OpenAI 兼容服务',
    baseUrl: 'http://localhost:1234/v1',
    apiFormat: 'openai_chat',
    defaultModelId: 'local-model',
    defaultContextLength: 128000,
    modelsListPath: '/v1/models',
    isOfficial: false,
  },
  // 自定义
  {
    code: 'custom',
    name: '自定义平台',
    vendor: 'custom',
    description: '其他 OpenAI 兼容服务(自填 URL)',
    baseUrl: '',
    apiFormat: 'openai_chat',
    defaultModelId: '',
    defaultContextLength: 32000,
    isOfficial: false,
  },
]

/** 快速按 code 查找 */
export const TEMPLATE_MAP: Record<string, PlatformTemplate> = Object.fromEntries(
  PLATFORM_TEMPLATES.map((t) => [t.code, t]),
)
