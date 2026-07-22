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
  DeepSeek: {
    officialKeyUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://platform.deepseek.com/api-docs/',
    defaultBaseUrl: 'https://api.deepseek.com',
    providerCode: 'deepseek',
    apiFormat: 'openai_chat',
    note: 'DeepSeek 系列官方厂商(深度求索),国内可直连注册,价格低廉',
  },
  Baichuan: {
    officialKeyUrl: 'https://platform.baichuan-ai.com/console/apikey',
    docsUrl: 'https://platform.baichuan-ai.com/docs',
    defaultBaseUrl: 'https://api.baichuan-ai.com/v1',
    providerCode: 'baichuan',
    apiFormat: 'openai_chat',
    note: '百川大模型官方厂商(百川智能),国内可直连注册',
  },
  SenseTime: {
    officialKeyUrl: 'https://platform.sensenova.cn/zh-CN/user-center/api-key',
    docsUrl: 'https://platform.sensenova.cn/zh-CN/docs',
    defaultBaseUrl: 'https://api.sensenova.cn/compatible-mode/v1',
    providerCode: 'sensetime',
    apiFormat: 'openai_chat',
    note: '日日新 SenseNova 系列官方厂商(商汤科技),国内可直连',
  },
  Kunlun: {
    officialKeyUrl: 'https://platform.tiangong.cn/',
    docsUrl: 'https://platform.tiangong.cn/pricing',
    defaultBaseUrl: 'https://api.tiangong.cn/v1',
    providerCode: 'kunlun',
    apiFormat: 'openai_chat',
    note: '天工大模型官方厂商(昆仑万维),国内可直连注册',
  },
  Tencent: {
    officialKeyUrl: 'https://console.cloud.tencent.com/hunyuan/api-key',
    docsUrl: 'https://cloud.tencent.com/document/product/1729',
    defaultBaseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    providerCode: 'hunyuan',
    apiFormat: 'openai_chat',
    note: '腾讯混元系列官方厂商,腾讯云平台,国内可直连',
  },
  Huawei: {
    officialKeyUrl: 'https://console.huaweicloud.com/devguru/mACS/mACS_03_0004.html',
    docsUrl: 'https://www.hiascend.com/document',
    defaultBaseUrl: 'https://maas.huaweicloud.com/v1',
    providerCode: 'pangu',
    apiFormat: 'openai_chat',
    note: '华为云盘古大模型,需华为云订阅',
  },
  Mistral: {
    officialKeyUrl: 'https://console.mistral.ai/api-keys/',
    docsUrl: 'https://docs.mistral.ai/',
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    providerCode: 'mistral',
    apiFormat: 'openai_chat',
    note: 'Mistral 系列官方厂商(法国),OpenAI 格式兼容,需海外信用卡',
  },
  '01.AI': {
    officialKeyUrl: 'https://platform.lingyiwanwu.com/apikeys',
    docsUrl: 'https://platform.lingyiwanwu.com/docs',
    defaultBaseUrl: 'https://api.lingyiwanwu.com/v1',
    providerCode: 'yi',
    apiFormat: 'openai_chat',
    note: '零一万物 Yi 系列官方厂商(李开复创办),国内可直连注册',
  },
  StepFun: {
    officialKeyUrl: 'https://platform.stepfun.com/console/apikey',
    docsUrl: 'https://platform.stepfun.com/docs',
    defaultBaseUrl: 'https://api.stepfun.com/v1',
    providerCode: 'stepfun',
    apiFormat: 'openai_chat',
    note: '阶跃星辰 Step 系列官方厂商,国内可直连注册',
  },
  Perplexity: {
    officialKeyUrl: 'https://www.perplexity.ai/settings/api',
    docsUrl: 'https://docs.perplexity.ai/',
    defaultBaseUrl: 'https://api.perplexity.ai',
    providerCode: 'perplexity',
    apiFormat: 'openai_chat',
    note: 'Perplexity Sonar 系列(联网搜索 RAG),OpenAI 格式兼容',
  },
  Groq: {
    officialKeyUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    providerCode: 'groq',
    apiFormat: 'openai_chat',
    note: 'Groq LPU 推理引擎,极速低延迟(>500 tokens/s),免费额度可用',
  },
  Cerebras: {
    officialKeyUrl: 'https://cloud.cerebras.ai/',
    docsUrl: 'https://inference-docs.cerebras.ai/',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    providerCode: 'cerebras',
    apiFormat: 'openai_chat',
    note: 'Cerebras Wafer-Scale Engine 推理,极速低延迟,免费额度可用',
  },
  'Lambda Labs': {
    officialKeyUrl: 'https://cloud.lambdalabs.com/api-keys',
    docsUrl: 'https://docs.lambdalabs.com/',
    defaultBaseUrl: 'https://api.lambdalabs.com/v1',
    providerCode: 'lambda',
    apiFormat: 'openai_chat',
    note: 'Lambda Labs 推理云,OpenAI 格式兼容,按 GPU 时长计费',
  },
  Modal: {
    officialKeyUrl: 'https://modal.com/settings',
    docsUrl: 'https://modal.com/docs',
    defaultBaseUrl: 'https://modal.com/v1',
    providerCode: 'modal',
    apiFormat: 'openai_chat',
    note: 'Modal Serverless GPU 推理,支持自定义模型部署,按毫秒计费',
  },
  Baseten: {
    officialKeyUrl: 'https://app.baseten.co/settings/api_keys',
    docsUrl: 'https://docs.baseten.co/',
    defaultBaseUrl: 'https://api.baseten.co/v1',
    providerCode: 'baseten',
    apiFormat: 'openai_chat',
    note: 'Baseten 推理平台,支持开源模型部署,按 GPU 时长计费',
  },
  RunPod: {
    officialKeyUrl: 'https://www.runpod.io/console/key',
    docsUrl: 'https://docs.runpod.io/',
    defaultBaseUrl: 'https://api.runpod.ai/v2',
    providerCode: 'runpod',
    apiFormat: 'openai_chat',
    note: 'RunPod GPU 云,支持 Serverless 推理 + 按需 GPU 实例',
  },
  Lepton: {
    officialKeyUrl: 'https://dashboard.lepton.ai/api-keys',
    docsUrl: 'https://www.lepton.ai/docs',
    defaultBaseUrl: 'https://api.lepton.ai/v1',
    providerCode: 'lepton',
    apiFormat: 'openai_chat',
    note: 'Lepton AI 推理平台,Jian Yang 创办,OpenAI 格式兼容',
  },
  OpenRouter: {
    officialKeyUrl: 'https://openrouter.ai/keys',
    docsUrl: 'https://openrouter.ai/docs',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    providerCode: 'openrouter',
    apiFormat: 'openai_chat',
    note: '聚合 200+ 模型,统一 OpenAI 格式,支持按量付费,无需多平台注册',
  },
  'Together AI': {
    officialKeyUrl: 'https://api.together.ai/settings/api-keys',
    docsUrl: 'https://docs.together.ai/',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    providerCode: 'together',
    apiFormat: 'openai_chat',
    note: '海外开源模型聚合,支持微调训练,OpenAI 格式兼容',
  },
  'Fireworks AI': {
    officialKeyUrl: 'https://fireworks.ai/api-keys',
    docsUrl: 'https://docs.fireworks.ai/',
    defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
    providerCode: 'fireworks',
    apiFormat: 'openai_chat',
    note: '海外开源模型聚合,低延迟推理,支持函数调用',
  },
  SiliconFlow: {
    officialKeyUrl: 'https://cloud.siliconflow.cn/account/ak',
    docsUrl: 'https://docs.siliconflow.cn/',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    providerCode: 'siliconflow',
    apiFormat: 'openai_chat',
    note: '硅基流动,国内主流开源模型聚合,OpenAI 格式兼容,国内直连速度快',
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
