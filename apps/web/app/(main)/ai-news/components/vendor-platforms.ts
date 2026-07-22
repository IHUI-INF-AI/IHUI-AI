/**
 * 厂商 → 官方平台信息映射表(2026-07-22 立)
 *
 * 用于排行榜详情弹窗的「官方 API Key」链接 + 「一键导入」预填。
 * baseUrl / apiFormat 参考官方文档,actual 调用时用户需自行填入 Key。
 */
export interface VendorPlatform {
  /** 官方 API Key 申请地址 */
  officialKeyUrl: string
  /** 官方 API 文档地址 */
  docsUrl: string
  /** 默认 baseURL(用户可覆盖) */
  defaultBaseUrl: string
  /** 项目内 provider code(对应 PlatformTemplate.code) */
  providerCode: string
  /** API 格式 */
  apiFormat: 'openai_chat' | 'anthropic_messages' | 'openai_responses' | 'gemini_native'
  /** 厂商中文说明(可选) */
  note?: string
}

/** vendor(与 leaderboard seed 的 vendor 字段对齐)→ 平台信息 */
export const VENDOR_PLATFORMS: Record<string, VendorPlatform> = {
  Anthropic: {
    officialKeyUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    defaultBaseUrl: 'https://api.anthropic.com',
    providerCode: 'anthropic',
    apiFormat: 'anthropic_messages',
    note: 'Claude 系列官方厂商,需海外信用卡 + 海外手机号注册',
  },
  OpenAI: {
    officialKeyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    defaultBaseUrl: 'https://api.openai.com',
    providerCode: 'openai',
    apiFormat: 'openai_chat',
    note: 'GPT 系列官方厂商,需海外信用卡注册',
  },
  Google: {
    officialKeyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://ai.google.dev/api',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    providerCode: 'gemini',
    apiFormat: 'gemini_native',
    note: 'Gemini 系列官方厂商,Google AI Studio 免费额度可用',
  },
  Meta: {
    officialKeyUrl: 'https://llama.meta.com/get-started/',
    docsUrl: 'https://llama.meta.com/docs/',
    defaultBaseUrl: '',
    providerCode: 'meta',
    apiFormat: 'openai_chat',
    note: 'Llama / Muse 系列开源模型,需通过第三方平台部署调用',
  },
  Moonshot: {
    officialKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    docsUrl: 'https://platform.moonshot.cn/docs',
    defaultBaseUrl: 'https://api.moonshot.cn',
    providerCode: 'moonshot',
    apiFormat: 'openai_chat',
    note: 'Kimi 系列官方厂商,国内可直连注册',
  },
  Alibaba: {
    officialKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    docsUrl: 'https://help.aliyun.com/zh/dashscope/',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    providerCode: 'qwen',
    apiFormat: 'openai_chat',
    note: '通义千问 Qwen 系列,阿里云百炼平台,国内可直连',
  },
  'Z.ai': {
    officialKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    docsUrl: 'https://open.bigmodel.cn/dev/api',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    providerCode: 'zhipu',
    apiFormat: 'openai_chat',
    note: 'GLM 系列官方厂商(智谱 AI),国内可直连注册',
  },
  MiniMax: {
    officialKeyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    docsUrl: 'https://platform.minimaxi.com/document',
    defaultBaseUrl: 'https://api.minimax.chat',
    providerCode: 'minimax',
    apiFormat: 'openai_chat',
    note: 'MiniMax 系列官方厂商,国内可直连注册',
  },
  Bytedance: {
    officialKeyUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    docsUrl: 'https://www.volcengine.com/docs/82379',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    providerCode: 'doubao',
    apiFormat: 'openai_chat',
    note: '豆包 / Dreamina 系列,火山引擎方舟平台,国内可直连',
  },
  SpaceXAI: {
    officialKeyUrl: 'https://console.x.ai/',
    docsUrl: 'https://docs.x.ai/',
    defaultBaseUrl: 'https://api.x.ai',
    providerCode: 'grok',
    apiFormat: 'openai_chat',
    note: 'Grok 系列官方厂商(xAI),需海外信用卡注册',
  },
  Microsoft: {
    officialKeyUrl: 'https://portal.azure.com/',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/',
    defaultBaseUrl: '',
    providerCode: 'azure',
    apiFormat: 'openai_chat',
    note: 'Azure OpenAI / Azure TTS,需 Azure 订阅',
  },
  'Microsoft AI': {
    officialKeyUrl: 'https://portal.azure.com/',
    docsUrl: 'https://learn.microsoft.com/azure/ai-services/',
    defaultBaseUrl: '',
    providerCode: 'azure',
    apiFormat: 'openai_chat',
    note: 'Azure OpenAI / Azure TTS,需 Azure 订阅',
  },
  ElevenLabs: {
    officialKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    docsUrl: 'https://elevenlabs.io/docs/api-reference',
    defaultBaseUrl: 'https://api.elevenlabs.io',
    providerCode: 'elevenlabs',
    apiFormat: 'openai_chat',
    note: 'ElevenLabs 语音合成官方厂商',
  },
  'Voyage AI': {
    officialKeyUrl: 'https://dash.voyageai.com/api-keys',
    docsUrl: 'https://docs.voyageai.com/',
    defaultBaseUrl: 'https://api.voyageai.com',
    providerCode: 'voyage',
    apiFormat: 'openai_chat',
    note: 'Voyage 嵌入模型官方厂商',
  },
  Cohere: {
    officialKeyUrl: 'https://dashboard.cohere.com/api-keys',
    docsUrl: 'https://docs.cohere.com/',
    defaultBaseUrl: 'https://api.cohere.com',
    providerCode: 'cohere',
    apiFormat: 'openai_chat',
    note: 'Cohere 嵌入 / Rerank 官方厂商',
  },
  BAAI: {
    officialKeyUrl: 'https://huggingface.co/BAAI',
    docsUrl: 'https://huggingface.co/BAAI/bge-m3',
    defaultBaseUrl: '',
    providerCode: 'baai',
    apiFormat: 'openai_chat',
    note: 'BGE 系列开源嵌入模型,需通过 HuggingFace / 第三方平台部署',
  },
  Reve: {
    officialKeyUrl: '',
    docsUrl: '',
    defaultBaseUrl: '',
    providerCode: 'reve',
    apiFormat: 'openai_chat',
    note: 'Reve 生图模型,需通过第三方平台调用',
  },
  'Alibaba-ATH': {
    officialKeyUrl: 'https://dashscope.console.aliyun.com/apiKey',
    docsUrl: 'https://help.aliyun.com/zh/dashscope/',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode',
    providerCode: 'qwen',
    apiFormat: 'openai_chat',
    note: '阿里通义实验室视频模型,阿里云百炼平台',
  },
}

/** 查询 vendor 平台信息,返回降级兜底 */
export function getVendorPlatform(vendor: string): VendorPlatform | null {
  return VENDOR_PLATFORMS[vendor] ?? null
}

/** 一键导入预填 payload(通过 URL query 传递) */
export interface PrefillPayload {
  providerCode: string
  name: string
  baseUrlOverride: string
  apiFormat: 'openai_chat' | 'anthropic_messages' | 'openai_responses' | 'gemini_native'
  modelName?: string
  vendor?: string
}

/** 把预填 payload 编码为 URL 安全的 base64 */
export function encodePrefill(payload: PrefillPayload): string {
  const json = JSON.stringify(payload)
  // btoa 不支持 Unicode,先 encodeURIComponent 再转换
  return btoa(encodeURIComponent(json))
}

/** 解码预填 payload */
export function decodePrefill(encoded: string): PrefillPayload | null {
  try {
    const json = decodeURIComponent(atob(encoded))
    return JSON.parse(json) as PrefillPayload
  } catch {
    return null
  }
}
