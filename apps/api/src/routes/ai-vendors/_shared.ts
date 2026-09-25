// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 厂商代理路由 - 共享定义。
 */
import { createHmac, createHash } from 'node:crypto'
import type { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify'
import { error } from '../../utils/response.js'
import {
  attachEgressFacts,
  collectEgressFacts,
  proxiedFetch,
} from '../../utils/proxy-dispatcher.js'
import { z } from 'zod'
import { generateTrackingId } from '../../utils/crypto-random.js'

export type { FastifyRequest, FastifyReply, FastifyPluginAsync }

export const taskIdParam = z.object({ taskId: z.string() })
export const vendorParam = z.object({ vendor: z.string() })
export const botIdParam = z.object({ botId: z.string() })
export const reqKeyParam = z.object({ reqKey: z.string() })
export const timbreIdParam = z.object({ timbreId: z.string() })
export const recordIdParam = z.object({ recordId: z.string() })

export const pageSizeQuery = z.object({ page_size: z.string().optional() })
export const tasksQuery = z.object({ vendor: z.string().optional(), status: z.string().optional() })
export const aigcRecordsQuery = z.object({
  type: z.string().optional(),
  vendor: z.string().optional(),
})
export const tokenQuery = z.object({ token: z.string().optional() })

/**
 * OpenAI chat/completions 官方完整参数集(全 optional,透传各厂商兼容端点)。
 * 2026-09-20 扩展:原仅 messages/model/temperature,现覆盖官方全部采样/惩罚/工具参数。
 */
export const chatBody = z.object({
  messages: z.array(z.unknown()).max(100).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  // 部分厂商(豆包/Qwen/Mistral)支持 top_k
  top_k: z.number().int().min(1).max(128).optional(),
  n: z.number().int().min(1).max(10).optional(),
  max_tokens: z.number().int().min(1).optional(),
  max_completion_tokens: z.number().int().min(1).optional(),
  stop: z.union([z.string(), z.array(z.string()).max(4)]).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  seed: z.number().int().optional(),
  response_format: z.record(z.string(), z.unknown()).optional(),
  logit_bias: z.record(z.string(), z.number()).optional(),
  logprobs: z.boolean().optional(),
  top_logprobs: z.number().int().min(0).max(20).optional(),
  stream: z.boolean().optional(),
  // SSE 流选项(include_usage 等)
  stream_options: z.record(z.string(), z.unknown()).optional(),
  user: z.string().optional(),
  // --- 2026-09-20 官方最新参数补齐 ---
  // 推理强度(GPT-5/o系列/xai Grok/Qwen3-thinking): minimal|low|medium|high
  reasoning_effort: z.string().optional(),
  // 输出详细度(GPT-5 专有): low|medium|high
  verbosity: z.enum(['low', 'medium', 'high']).optional(),
  // 函数工具定义(OpenAI function/strict 模式,上限 128 个)
  tools: z.array(z.unknown()).max(128).optional(),
  // 工具选择: 'none'|'auto'|'required' 或 {type:'function',function:{name}}
  tool_choice: z.unknown().optional(),
  // 并行工具调用开关
  parallel_tool_calls: z.boolean().optional(),
  // 联网搜索(gpt-4o-search/gpt-4o-mini-search 官方参数)
  web_search_options: z.record(z.string(), z.unknown()).optional(),
  // 多模态语音输出(audio:{voice,format})
  audio: z.record(z.string(), z.unknown()).optional(),
  // 输出模态声明(['text'] 或 ['text','audio'])
  modalities: z.array(z.string()).optional(),
  // 请求元数据(最多 16 个键值对,便于追踪)
  metadata: z.record(z.string(), z.string()).optional(),
  // 对话存储开关(distillation/eval 用)
  store: z.boolean().optional(),
  // 提示缓存路由键(稳定缓存命中)
  prompt_cache_key: z.string().optional(),
  // 安全标识(滥用检测,代替 user)
  safety_identifier: z.string().optional(),
  // 服务层级(auto|default|flex|priority|scale)
  service_tier: z.string().optional(),
  // 预测输出(代码编辑加速,使用 {type:'content',content})
  prediction: z.record(z.string(), z.unknown()).optional(),
  // --- 2026-09-21 官方最新参数补齐 ---
  // 思考模式对象(Claude/GLM/Kimi/Doubao 通用): {type:'enabled'|'disabled',budget_tokens?}
  thinking: z.unknown().optional(),
  // OpenRouter 统一推理对象: {effort,max_tokens,exclude}
  reasoning: z.unknown().optional(),
  // Qwen3/dashscope 思考开关
  enable_thinking: z.boolean().optional(),
  // Qwen3 思考预算
  thinking_budget: z.number().int().optional(),
  // vLLM/SGLang 模板参数(如 add_generation_prompt)
  chat_template_kwargs: z.record(z.string(), z.unknown()).optional(),
  // 采样最低概率阈值(截断低概率 token)
  min_p: z.number().min(0).max(1).optional(),
  // 重复惩罚(vLLM/Mistral 等)
  repetition_penalty: z.number().optional(),
  // OpenRouter 布尔推理开关
  include_reasoning: z.boolean().optional(),
  // 提前停止 token id 列表(vLLM)
  stop_token_ids: z.array(z.number().int()).optional(),
  // OpenAI 24h 提示缓存保留
  prompt_cache_retention: z.string().optional(),
})

/**
 * OpenAI images/generations 官方完整参数集(全 optional)。
 * 2026-09-20 扩展:补 n/quality/style/response_format/user,支持多图与质量控制。
 */
export const imageBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  size: z.string().optional(),
  n: z.number().int().min(1).max(10).optional(),
  quality: z.string().optional(),
  style: z.string().optional(),
  response_format: z.string().optional(),
  user: z.string().optional(),
  // --- 2026-09-20 gpt-image-1 官方最新参数补齐 ---
  // 背景透明化: transparent|opaque|auto(gpt-image-1)
  background: z.string().optional(),
  // 内容审核强度: low|auto(gpt-image-1)
  moderation: z.string().optional(),
  // JPEG/WebP 压缩率 0-100(gpt-image-1)
  output_compression: z.number().int().min(0).max(100).optional(),
  // 输出格式: png|jpeg|webp(gpt-image-1)
  output_format: z.string().optional(),
  // 流式部分图数量 0-3(gpt-image-1 stream 模式)
  partial_images: z.number().int().min(0).max(3).optional(),
  // 流式返回(部分图片 SSE)
  stream: z.boolean().optional(),
})
/**
 * TTS 全厂商官方参数集(全 optional,向后兼容)。
 * 2026-09-20 扩展:OpenAI/Dashscope(CosyVoice)/Doubao(火山TTS)/Gemini 全参数。
 */
export const ttsBody = z.object({
  text: z.string().optional(),
  model: z.string().optional(),
  voice: z.string().optional(),
  // OpenAI 兼容参数
  speed: z.number().optional(),
  response_format: z.string().optional(),
  // OpenAI gpt-4o-mini-tts 语音指令(2026-09-21 补齐)
  instructions: z.string().optional(),
  // Dashscope CosyVoice 官方参数
  speech_rate: z.number().optional(),
  volume: z.number().optional(),
  pitch_rate: z.number().optional(),
  rate: z.number().optional(),
  format: z.string().optional(),
  sample_rate: z.number().optional(),
  gain: z.number().optional(),
  language_type: z.string().optional(),
  text_type: z.string().optional(),
  // Doubao 火山 TTS 官方参数
  emotion: z.string().optional(),
  emotion_scale: z.number().optional(),
  enable_emotion: z.boolean().optional(),
  // Gemini TTS 官方参数
  languageCode: z.string().optional(),
  audioEncoding: z.string().optional(),
  speakingRate: z.number().optional(),
  pitch: z.number().optional(),
  effectsProfileId: z.string().optional(),
})
/**
 * ASR 全厂商官方参数集(全 optional)。
 * Dashscope(Paraformer/Gummy)/Gemini(Google STT) 全参数。
 */
export const asrBody = z.object({
  audioUrl: z.string().optional(),
  audioBase64: z.string().optional(),
  model: z.string().optional(),
  // Dashscope Paraformer/Gummy 官方参数
  audio_format: z.string().optional(),
  sample_rate: z.number().optional(),
  language_hints: z.array(z.string()).optional(),
  vocabulary_id: z.string().optional(),
  disfluency_removal_enabled: z.boolean().optional(),
  special_phrases: z.record(z.string(), z.string()).optional(),
  // Gemini/Google STT 官方参数
  encoding: z.string().optional(),
  sampleRateHertz: z.number().optional(),
  languageCode: z.string().optional(),
  audioChannelCount: z.number().optional(),
  enableWordTimeOffsets: z.boolean().optional(),
})
/**
 * 视频生成共用参数集(prompt+model)。
 * Dashscope(wanx-video)/Doubao(即梦video)/Gemini(Veo) 官方参数全透传。
 */
export const promptModelBody = z.object({
  prompt: z.string().optional(),
  model: z.string().optional(),
  // 生成数量(Gemini sampleCount 等)
  n: z.number().int().min(1).max(10).optional(),
  // Dashscope/Doubao 视频官方参数
  size: z.string().optional(),
  aspect_ratio: z.string().optional(),
  duration: z.number().optional(),
  fps: z.number().optional(),
  resolution: z.string().optional(),
  prompt_extend: z.boolean().optional(),
  watermark: z.boolean().optional(),
  seed: z.number().optional(),
  imageUrl: z.string().optional(),
  negativePrompt: z.string().optional(),
  image: z.string().optional(),
  camera: z.record(z.string(), z.unknown()).optional(),
  // 厂商私有参数包透传
  parameters: z.record(z.string(), z.unknown()).optional(),
})
/**
 * 文本/Embedding 共用参数集。
 * Dashscope(text-embedding)/Gemini(emb-004)/OpenAI 兼容全参数。
 */
export const textModelBody = z.object({
  text: z.string().optional(),
  model: z.string().optional(),
  // Dashscope text-embedding 官方参数
  text_type: z.string().optional(),
  dimension_type: z.number().optional(),
  // Gemini text-embedding-004 官方参数
  task_type: z.string().optional(),
  output_dimensionality: z.number().optional(),
  title: z.string().optional(),
  // OpenAI 兼容参数
  dimensions: z.number().optional(),
  encoding_format: z.string().optional(),
  user: z.string().optional(),
})
/**
 * 多模态对话共用参数集。
 * Dashscope(qwen-vl/omni)/Gemini(chat) 官方参数全透传。
 */
export const multimodalBody = z.object({
  messages: z.array(z.unknown()).max(100).optional(),
  model: z.string().optional(),
  // Dashscope 多模态官方参数
  top_k: z.number().optional(),
  top_p: z.number().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().optional(),
  seed: z.number().optional(),
  stream: z.boolean().optional(),
  result_format: z.string().optional(),
  incremental_output: z.boolean().optional(),
  vl_high_resolution_images: z.boolean().optional(),
  // Gemini 官方参数
  generationConfig: z.record(z.string(), z.unknown()).optional(),
  safetySettings: z.array(z.unknown()).optional(),
  tools: z.array(z.unknown()).optional(),
  toolConfig: z.record(z.string(), z.unknown()).optional(),
  systemInstruction: z.unknown().optional(),
})
export const promptOnlyBody = z.object({
  prompt: z.string().optional(),
  // Suno lyrics 官方参数
  style: z.string().optional(),
  title: z.string().optional(),
  // Volcengine Jimeng v31 官方参数
  req_key: z.string().optional(),
  aspect_ratio: z.string().optional(),
})
/**
 * 即梦(Jimeng) 图/视频 官方完整参数集(全 optional,双文件共用:proxy-tools + proxy-extended)。
 */
export const jimengBody = z.object({
  prompt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  seed: z.number().optional(),
  // 即梦/火山官方参数
  scale: z.number().optional(),
  req_key: z.string().optional(),
  watermark: z.boolean().optional(),
  logo_info: z.record(z.string(), z.unknown()).optional(),
  aspect_ratio: z.string().optional(),
  use_pre_llm: z.boolean().optional(),
  i2v_align: z.boolean().optional(),
  image_urls: z.array(z.string()).optional(),
  return_url: z.boolean().optional(),
  strength: z.number().optional(),
  generate_mode: z.string().optional(),
})

export { checkAuth as requireAuth } from '../../plugins/auth.js'

/**
 * 厂商出站的**唯一包装函数**(2026-09-26 起兼作"出口事实"的挂载点)。
 *
 * 返回签名刻意仍是裸 `Promise<Response>`(20+ 个调用方一字未动),但响应对象上多挂了一个
 * **不可枚举**的 `egress` 字段 —— 用 `readEgressFacts(res)` 取。为什么挂在响应上而不是打日志:
 * AGENTS §5b 那三条"网络时通时不通 / 钩子不继承 env / 服务身份 safe.directory 不相通"的排查,
 * 最后都只能靠人肉 `env | grep proxy` 现读,因为**没有任何一次调用把"我这趟实际用了哪份配置"
 * 作为返回值带回来**。类型形状见 `@ihui/types` 的 `egress-facts.ts`(全仓唯一形状,不得端内再造)。
 *
 * 行为不变量:本函数不新增失败模式、不改错误分支 —— 两个 return 分支的**路由判定与改造前逐字等值**
 * (`isProxiedUrl` 现在是 `collectEgressFacts().proxied` 的投影),挂载只是 defineProperty。
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // 一趟只算一次事实,决策与事实同源
  const egress = collectEgressFacts(url)
  try {
    // 命中代理白名单的被墙域名(OpenAI/Gemini/Groq 等)走 HTTP 代理,其余直连
    if (egress.proxied) {
      const headersRec: Record<string, string> = {}
      if (options.headers) Object.assign(headersRec, options.headers as Record<string, string>)
      const bodyStr =
        options.body === null || options.body === undefined
          ? undefined
          : typeof options.body === 'string'
            ? options.body
            : String(options.body)
      const proxied = await proxiedFetch(url, {
        method: options.method,
        headers: headersRec,
        body: bodyStr,
        signal: controller.signal,
      })
      return attachEgressFacts(proxied, egress)
    }
    const direct = await fetch(url, { ...options, signal: controller.signal })
    return attachEgressFacts(direct, egress)
  } finally {
    clearTimeout(timer)
  }
}

export interface VendorConfig {
  name: string
  keyEnv: string
  secretKeyEnv?: string
  baseUrl: string
  authHeader: (key: string) => Record<string, string>
}

export const VENDORS: Record<string, VendorConfig> = {
  dashscope: {
    name: 'Dashscope(阿里通义)',
    keyEnv: 'DASHSCOPE_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  doubao: {
    name: 'Doubao(豆包/字节)',
    keyEnv: 'DOUBAO_API_KEY',
    baseUrl: 'https://ark.cn-beijing.volces.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  gemini: {
    name: 'Gemini(Google)',
    keyEnv: 'GEMINI_API_KEY',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authHeader: (key) => ({ 'x-goog-api-key': key }),
  },
  suno: {
    name: 'Suno(音乐生成)',
    keyEnv: 'SUNO_API_KEY',
    baseUrl: 'https://api.suno.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  sora2: {
    name: 'Sora2(OpenAI 视频)',
    keyEnv: 'SORA2_API_KEY',
    baseUrl: 'https://api.openai.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  coze: {
    name: 'Coze(扣子)',
    keyEnv: 'COZE_API_KEY',
    baseUrl: 'https://api.coze.cn',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  agnes: {
    name: 'Agnes AI(文本/图片/视频)',
    keyEnv: 'AGNES_API_KEY',
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  x5m5x: {
    name: '极速API(按量/LLM)',
    keyEnv: 'X5M5X_API_KEY',
    baseUrl: 'https://api.x5m5x.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  x5m5xImage: {
    name: '极速API(生图)',
    keyEnv: 'X5M5X_IMAGE_KEY',
    baseUrl: 'https://api.x5m5x.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  x5m5xSubscribe: {
    name: '极速API(订阅/Auto-Model)',
    keyEnv: 'X5M5X_SUBSCRIBE_KEY',
    baseUrl: 'https://api.x5m5x.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  bailian: {
    name: 'Bailian(百炼/阿里云)',
    keyEnv: 'BAILIAN_API_KEY',
    baseUrl: 'https://dashscope.aliyuncs.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  jimeng4: {
    name: 'JiMeng4(即梦/字节AI绘画)',
    keyEnv: 'JIMENG4_API_KEY',
    secretKeyEnv: 'JIMENG4_SECRET_KEY',
    baseUrl: 'https://visual.volcengineapi.com',
    authHeader: () => ({}),
  },
  n8n: {
    name: 'N8N(工作流平台)',
    keyEnv: 'N8N_API_KEY',
    baseUrl: '',
    authHeader: (key) => ({ 'X-N8N-API-KEY': key }),
  },
  tencent: {
    name: 'Tencent(腾讯混元/ARC)',
    keyEnv: 'TENCENT_SECRET_ID',
    secretKeyEnv: 'TENCENT_SECRET_KEY',
    baseUrl: 'https://ai3d.tencentcloudapi.com',
    authHeader: () => ({}),
  },
  volcengine: {
    name: 'Volcengine(火山引擎/字节豆包企业版)',
    keyEnv: 'VOLCENGINE_API_KEY',
    secretKeyEnv: 'VOLCENGINE_SECRET_KEY',
    baseUrl: 'https://visual.volcengineapi.com',
    authHeader: () => ({}),
  },
  // --- OpenAI 兼容厂商(2026-09-20 用户提供的官方 key,统一 Bearer 鉴权) ---
  openai: {
    name: 'OpenAI',
    keyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  deepseek: {
    name: 'DeepSeek(深度求索)',
    keyEnv: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  siliconflow: {
    name: 'SiliconFlow(硅基流动)',
    keyEnv: 'SILICONFLOW_API_KEY',
    baseUrl: 'https://api.siliconflow.cn/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openrouter: {
    name: 'OpenRouter(聚合中转)',
    keyEnv: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  groq: {
    name: 'Groq(高速推理)',
    keyEnv: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  nvidia: {
    name: 'NVIDIA(NIM 推理云)',
    keyEnv: 'NVIDIA_API_KEY',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  step: {
    name: 'Step(阶跃星辰)',
    keyEnv: 'STEP_API_KEY',
    baseUrl: 'https://api.stepfun.com/step_plan/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  mimo: {
    name: 'MiMo(小米)',
    keyEnv: 'MIMO_API_KEY',
    // token-plan-cn 域只认 tp- 前缀套餐凭据,本项目 sk- key 必须走通用 api 域(2026-09-21 实测)
    baseUrl: 'https://api.xiaomimimo.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  zhipu: {
    name: 'Zhipu(智谱 GLM)',
    keyEnv: 'ZHIPU_API_KEY',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // --- 四大模态补齐(2026-09-20):文 9 / 图 2 / 视频 4 / 音频 2 ---
  // 文本:OpenAI 兼容 8 家(经 proxy-openai-compat)+ Anthropic 专有 Messages API(proxy-anthropic)
  moonshot: {
    name: 'Moonshot(Kimi 月之暗面)',
    keyEnv: 'MOONSHOT_API_KEY',
    baseUrl: 'https://api.moonshot.cn/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  minimax: {
    name: 'MiniMax(海螺)',
    keyEnv: 'MINIMAX_API_KEY',
    baseUrl: 'https://api.minimax.chat/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  baichuan: {
    name: 'Baichuan(百川)',
    keyEnv: 'BAICHUAN_API_KEY',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  spark: {
    name: 'Spark(讯飞星火)',
    keyEnv: 'SPARK_API_KEY',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  mistral: {
    name: 'Mistral',
    keyEnv: 'MISTRAL_API_KEY',
    baseUrl: 'https://api.mistral.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  xai: {
    name: 'xAI(Grok)',
    keyEnv: 'XAI_API_KEY',
    baseUrl: 'https://api.x.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  perplexity: {
    name: 'Perplexity(Sonar)',
    keyEnv: 'PERPLEXITY_API_KEY',
    baseUrl: 'https://api.perplexity.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  lingyiwanwu: {
    name: 'LingYi(零一万物 Yi)',
    keyEnv: 'LINGYIWANWU_API_KEY',
    baseUrl: 'https://api.lingyiwanwu.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    name: 'Anthropic(Claude)',
    keyEnv: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com',
    authHeader: (key) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
  },
  // 图像:专有 REST
  stability: {
    name: 'Stability AI(Stable Image)',
    keyEnv: 'STABILITY_API_KEY',
    baseUrl: 'https://api.stability.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  flux: {
    name: 'Flux(BFL Black Forest Labs)',
    keyEnv: 'FLUX_API_KEY',
    baseUrl: 'https://api.bfl.ai',
    authHeader: (key) => ({ 'x-key': key }),
  },
  // 视频:专有 REST(异步任务+轮询)
  kling: {
    name: 'Kling(可灵/快手)',
    keyEnv: 'KLING_API_KEY',
    secretKeyEnv: 'KLING_SECRET_KEY',
    baseUrl: 'https://api.klingai.com',
    authHeader: () => ({}),
  },
  runway: {
    name: 'Runway(Gen-4)',
    keyEnv: 'RUNWAY_API_KEY',
    baseUrl: 'https://api.dev.runwayml.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, 'X-Runway-Version': '2024-11-06' }),
  },
  luma: {
    name: 'Luma(Dream Machine)',
    keyEnv: 'LUMA_API_KEY',
    baseUrl: 'https://api.lumalabs.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // 音频:专有 REST
  elevenlabs: {
    name: 'ElevenLabs(TTS/音效)',
    keyEnv: 'ELEVENLABS_API_KEY',
    baseUrl: 'https://api.elevenlabs.io',
    authHeader: (key) => ({ 'xi-api-key': key }),
  },
  // --- 2026-09-20 n12a 平台补齐:文本 9 家(OpenAI 兼容) ---
  baidu: {
    name: 'Baidu(百度千帆)',
    keyEnv: 'BAIDU_API_KEY',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  hunyuan: {
    name: 'Hunyuan(腾讯混元)',
    keyEnv: 'HUNYUAN_API_KEY',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  ai360: {
    name: 'Ai360(360智脑)',
    keyEnv: 'AI360_API_KEY',
    baseUrl: 'https://api.360.cn/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  cohere: {
    name: 'Cohere(Command)',
    keyEnv: 'COHERE_API_KEY',
    baseUrl: 'https://api.cohere.com/compatibility/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  together: {
    name: 'Together AI(开源聚合)',
    keyEnv: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  fireworks: {
    name: 'Fireworks AI',
    keyEnv: 'FIREWORKS_API_KEY',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  cerebras: {
    name: 'Cerebras(超高速推理)',
    keyEnv: 'CEREBRAS_API_KEY',
    baseUrl: 'https://api.cerebras.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  deepinfra: {
    name: 'DeepInfra',
    keyEnv: 'DEEPINFRA_API_KEY',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  ai21: {
    name: 'AI21 Labs(Jamba)',
    keyEnv: 'AI21_API_KEY',
    baseUrl: 'https://api.ai21.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // --- 2026-09-20 n12a 平台补齐:媒体 5 家(专有 REST) ---
  ideogram: {
    name: 'Ideogram(生图/文字渲染)',
    keyEnv: 'IDEOGRAM_API_KEY',
    baseUrl: 'https://api.ideogram.ai',
    authHeader: (key) => ({ 'Api-Key': key }),
  },
  recraft: {
    name: 'Recraft(矢量生图)',
    keyEnv: 'RECRAFT_API_KEY',
    baseUrl: 'https://external.api.recraft.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  vidu: {
    name: 'Vidu(生数科技/视频)',
    keyEnv: 'VIDU_API_KEY',
    baseUrl: 'https://api.vidu.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  pixverse: {
    name: 'PixVerse(爱诗科技/视频)',
    keyEnv: 'PIXVERSE_API_KEY',
    baseUrl: 'https://app-api.pixverse.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, 'AI-Application-Group': 'default' }),
  },
  fishaudio: {
    name: 'Fish Audio(TTS/声音克隆)',
    keyEnv: 'FISHAUDIO_API_KEY',
    baseUrl: 'https://api.fish.audio',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // --- 2026-09-20 n13a 平台补齐:文本 12 家(官方 OpenAI 兼容端点) ---
  longcat: {
    name: 'LongCat(美团)',
    keyEnv: 'LONGCAT_API_KEY',
    baseUrl: 'https://api.longcat.chat/openai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  sensenova: {
    name: 'SenseNova(商汤日日新)',
    keyEnv: 'SENSENOVA_API_KEY',
    baseUrl: 'https://api.sensenova.cn/compatible-mode/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  upstage: {
    name: 'Upstage(Solar)',
    keyEnv: 'UPSTAGE_API_KEY',
    baseUrl: 'https://api.upstage.ai/v1/solar',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  hyperbolic: {
    name: 'Hyperbolic',
    keyEnv: 'HYPERBOLIC_API_KEY',
    baseUrl: 'https://api.hyperbolic.xyz/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  novita: {
    name: 'Novita AI',
    keyEnv: 'NOVITA_API_KEY',
    baseUrl: 'https://api.novita.ai/v3/openai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  nebius: {
    name: 'Nebius AI Studio',
    keyEnv: 'NEBIUS_API_KEY',
    baseUrl: 'https://api.studio.nebius.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  writer: {
    name: 'Writer(Palmyra)',
    keyEnv: 'WRITER_API_KEY',
    baseUrl: 'https://api.writer.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  lambda: {
    name: 'Lambda(Lambda Cloud)',
    keyEnv: 'LAMBDA_API_KEY',
    baseUrl: 'https://api.lambda.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  sambanova: {
    name: 'SambaNova(超高速推理)',
    keyEnv: 'SAMBANOVA_API_KEY',
    baseUrl: 'https://api.sambanova.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  ppio: {
    name: 'PPIO(派欧云)',
    keyEnv: 'PPIO_API_KEY',
    baseUrl: 'https://api.ppinfra.com/v3/openai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  meta: {
    name: 'Meta(Llama API)',
    keyEnv: 'META_API_KEY',
    baseUrl: 'https://api.llama.com/compat/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  azure: {
    name: 'Azure OpenAI(企业版)',
    keyEnv: 'AZURE_OPENAI_API_KEY',
    baseUrl: '',
    authHeader: (key) => ({ 'api-key': key }),
  },
  // --- 2026-09-20 n13a 平台补齐:媒体 5 家(专有 REST) ---
  leonardo: {
    name: 'Leonardo AI(生图)',
    keyEnv: 'LEONARDO_API_KEY',
    baseUrl: 'https://cloud.leonardo.ai/api/rest/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, accept: 'application/json' }),
  },
  firefly: {
    name: 'Adobe Firefly(生图)',
    keyEnv: 'ADOBE_CLIENT_ID',
    secretKeyEnv: 'ADOBE_CLIENT_SECRET',
    baseUrl: 'https://firefly-api.adobe.com',
    authHeader: () => ({}),
  },
  deepgram: {
    name: 'Deepgram(Nova STT)',
    keyEnv: 'DEEPGRAM_API_KEY',
    baseUrl: 'https://api.deepgram.com',
    authHeader: (key) => ({ Authorization: `Token ${key}` }),
  },
  cartesia: {
    name: 'Cartesia(Sonic TTS)',
    keyEnv: 'CARTESIA_API_KEY',
    baseUrl: 'https://api.cartesia.ai',
    authHeader: (key) => ({ 'X-API-Key': key, 'Cartesia-Version': '2025-04-16' }),
  },
  'azure-speech': {
    name: 'Azure Speech(语音)',
    keyEnv: 'AZURE_SPEECH_KEY',
    baseUrl: '',
    authHeader: (key) => ({ 'Ocp-Apim-Subscription-Key': key }),
  },
  // --- 2026-09-20 n14a 平台补齐:文本 10 家 + 向量 2 家(OpenAI 兼容) ---
  hf: {
    name: 'Hugging Face(Router)',
    keyEnv: 'HF_API_KEY',
    baseUrl: 'https://router.huggingface.co/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  featherless: {
    name: 'Featherless AI',
    keyEnv: 'FEATHERLESS_API_KEY',
    baseUrl: 'https://api.featherless.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  kluster: {
    name: 'Kluster AI',
    keyEnv: 'KLUSTER_API_KEY',
    baseUrl: 'https://api.kluster.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  chutes: {
    name: 'Chutes',
    keyEnv: 'CHUTES_API_KEY',
    baseUrl: 'https://api.chutes.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  parasail: {
    name: 'Parasail AI',
    keyEnv: 'PARASAIL_API_KEY',
    baseUrl: 'https://api.parasail.io/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  ovh: {
    name: 'OVHcloud(AI Endpoints)',
    keyEnv: 'OVH_API_KEY',
    baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  baseten: {
    name: 'Baseten',
    keyEnv: 'BASETEN_API_KEY',
    baseUrl: 'https://inference.baseten.co/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  ollama: {
    name: 'Ollama(本地)',
    keyEnv: 'OLLAMA_API_KEY',
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    authHeader: (key): Record<string, string> => (key ? { Authorization: `Bearer ${key}` } : {}),
  },
  skywork: {
    name: 'Skywork(昆仑万维天工)',
    keyEnv: 'SKYWORK_API_KEY',
    baseUrl: 'https://api.skywork.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  openbmb: {
    name: 'OpenBMB(面壁MiniCPM)',
    keyEnv: 'OPENBMB_API_KEY',
    baseUrl: 'https://api.openbmb.cn/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  voyage: {
    name: 'Voyage AI(向量化)',
    keyEnv: 'VOYAGE_API_KEY',
    baseUrl: 'https://api.voyageai.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  jina: {
    name: 'Jina AI(向量/重排)',
    keyEnv: 'JINA_API_KEY',
    baseUrl: 'https://api.jina.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  // --- 2026-09-20 n14c 平台补齐:原生协议 2 家 ---
  assemblyai: {
    name: 'AssemblyAI(语音转写)',
    keyEnv: 'ASSEMBLYAI_API_KEY',
    baseUrl: 'https://api.assemblyai.com',
    authHeader: (key) => ({ authorization: key }),
  },
  replicate: {
    name: 'Replicate(开源模型托管)',
    keyEnv: 'REPLICATE_API_TOKEN',
    baseUrl: 'https://api.replicate.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}`, Prefer: 'wait=60' }),
  },
  // --- 2026-09-21 n15a 平台补齐:文本 19 家(OpenAI 兼容) ---
  bedrock: {
    name: 'Bedrock(AWS OpenAI 兼容)',
    keyEnv: 'BEDROCK_API_KEY',
    baseUrl:
      process.env.BEDROCK_BASE_URL || 'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  modelscope: {
    name: 'ModelScope(魔搭社区)',
    keyEnv: 'MODELSCOPE_API_KEY',
    baseUrl: 'https://api-inference.modelscope.cn/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  zai: {
    name: 'Z.ai(智谱海外 GLM)',
    keyEnv: 'ZAI_API_KEY',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  minimaxintl: {
    name: 'MiniMax International(海外)',
    keyEnv: 'MINIMAXINTL_API_KEY',
    baseUrl: 'https://api.minimax.io/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  dashscopeintl: {
    name: 'DashScope International(阿里海外)',
    keyEnv: 'DASHSCOPEINTL_API_KEY',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  byteplus: {
    name: 'BytePlus(字节海外)',
    keyEnv: 'BYTEPLUS_API_KEY',
    baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  pangu: {
    name: 'Pangu(华为盘古)',
    keyEnv: 'PANGU_API_KEY',
    baseUrl: 'https://api.modelarts-maas.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  internlm: {
    name: 'InternLM(书生·浦语)',
    keyEnv: 'INTERNLM_API_KEY',
    baseUrl: 'https://api.intern-ai.org.cn/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  infini: {
    name: 'Infini-AI(无问芯穹)',
    keyEnv: 'INFINI_API_KEY',
    baseUrl: 'https://cloud.infini-ai.com/maas/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  vercel: {
    name: 'Vercel AI Gateway',
    keyEnv: 'VERCEL_API_KEY',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  scaleway: {
    name: 'Scaleway(生成式AI)',
    keyEnv: 'SCALEWAY_API_KEY',
    baseUrl: 'https://api.scaleway.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  friendli: {
    name: 'FriendliAI',
    keyEnv: 'FRIENDLI_API_KEY',
    baseUrl: 'https://inference.friendli.ai/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  nscale: {
    name: 'Nscale',
    keyEnv: 'NSCALE_API_KEY',
    baseUrl: 'https://inference.api.nscale.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  gmi: {
    name: 'GMI Cloud',
    keyEnv: 'GMI_API_KEY',
    baseUrl: 'https://api.gmi-serving.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  ubicloud: {
    name: 'Ubicloud(AI 推理)',
    keyEnv: 'UBICLOUD_API_KEY',
    baseUrl: 'https://ai.ubicloud.com/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  inferencenet: {
    name: 'Inference.net',
    keyEnv: 'INFERENCENET_API_KEY',
    baseUrl: 'https://api.inference.net/v1',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  lmstudio: {
    name: 'LM Studio(本地)',
    keyEnv: 'LMSTUDIO_API_KEY',
    baseUrl: process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1',
    authHeader: (key): Record<string, string> => (key ? { Authorization: `Bearer ${key}` } : {}),
  },
  vllm: {
    name: 'vLLM(自托管)',
    keyEnv: 'VLLM_API_KEY',
    baseUrl: process.env.VLLM_BASE_URL || 'http://localhost:8000/v1',
    authHeader: (key): Record<string, string> => (key ? { Authorization: `Bearer ${key}` } : {}),
  },
  xinference: {
    name: 'Xinference(自托管)',
    keyEnv: 'XINFERENCE_API_KEY',
    baseUrl: process.env.XINFERENCE_BASE_URL || 'http://localhost:9997/v1',
    authHeader: (key): Record<string, string> => (key ? { Authorization: `Bearer ${key}` } : {}),
  },
  // --- 2026-09-21 n15b 媒体平台补齐:媒体 10 家(专有 REST) ---
  fal: {
    name: 'Fal.ai(聚合推理)',
    keyEnv: 'FAL_API_KEY',
    baseUrl: 'https://queue.fal.run',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  mureka: {
    name: 'Mureka(音乐生成)',
    keyEnv: 'MUREKA_API_KEY',
    baseUrl: 'https://api.mureka.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  playai: {
    name: 'PlayAI(语音)',
    keyEnv: 'PLAYAI_API_KEY',
    baseUrl: 'https://api.play.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  hume: {
    name: 'Hume(情感语音/EVI)',
    keyEnv: 'HUME_API_KEY',
    baseUrl: 'https://api.hume.ai',
    authHeader: (key) => ({ 'X-Hume-Api-Key': key }),
  },
  inworld: {
    name: 'Inworld(语音/角色)',
    keyEnv: 'INWORLD_API_KEY',
    baseUrl: 'https://api.inworld.ai',
    authHeader: (key) => ({
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
    }),
  },
  soniox: {
    name: 'Soniox(语音转写)',
    keyEnv: 'SONIOX_API_KEY',
    baseUrl: 'https://api.soniox.com',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  gladia: {
    name: 'Gladia(语音转写)',
    keyEnv: 'GLADIA_API_KEY',
    baseUrl: 'https://api.gladia.io',
    authHeader: (key) => ({ 'x-gladia-key': key }),
  },
  getimg: {
    name: 'GetImg.ai(生图)',
    keyEnv: 'GETIMG_API_KEY',
    baseUrl: 'https://api.getimg.ai',
    authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
  },
  bria: {
    name: 'Bria(商用生图)',
    keyEnv: 'BRIA_API_KEY',
    baseUrl: 'https://engine.prod.bria-api.com',
    authHeader: (key) => ({ api_token: key }),
  },
  freepik: {
    name: 'Freepik(生图聚合)',
    keyEnv: 'FREEPIK_API_KEY',
    baseUrl: 'https://api.freepik.com',
    authHeader: (key) => ({ 'x-freepik-api-key': key }),
  },
}

// key 可选厂商(本地/自托管,2026-09-21 扩展):无 key 时以空串继续
const OPTIONAL_KEY_VENDORS = new Set(['ollama', 'lmstudio', 'vllm', 'xinference'])

export function requireVendorKey(vendor: string, reply: FastifyReply): string | null {
  const cfg = VENDORS[vendor]
  if (!cfg) {
    reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    return null
  }
  const key = process.env[cfg.keyEnv]
  if (!key) {
    // 本地/自托管部署 key 可选:无 key 时以空串继续(其 authHeader 对空 key 返回空头)
    if (OPTIONAL_KEY_VENDORS.has(vendor)) return ''
    reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
    return null
  }
  return key
}

export function requireVendorKeys(
  vendor: string,
  reply: FastifyReply,
): { key: string; secret: string } | null {
  const cfg = VENDORS[vendor]
  if (!cfg || !cfg.secretKeyEnv) {
    reply.status(400).send(error(400, `不支持的厂商: ${vendor}`))
    return null
  }
  const key = process.env[cfg.keyEnv]
  const secret = process.env[cfg.secretKeyEnv]
  if (!key || !secret) {
    reply.status(503).send(error(503, `${cfg.name} 服务未配置`))
    return null
  }
  return { key, secret }
}

export function buildTencentHeaders(
  action: string,
  payload: string,
  secretId: string,
  secretKey: string,
): Record<string, string> {
  const service = 'ai3d'
  const algorithm = 'TC3-HMAC-SHA256'
  const timestamp = Math.floor(Date.now() / 1000)
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10)
  const host = 'ai3d.tencentcloudapi.com'
  const contentType = 'application/json; charset=utf-8'
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const hashedPayload = createHash('sha256').update(payload).digest('hex')
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${hashedPayload}`
  const credentialScope = `${date}/${service}/tc3_request`
  const hashedRequest = createHash('sha256').update(canonicalRequest).digest('hex')
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedRequest}`
  const secretDate = createHmac('sha256', `TC3${secretKey}`).update(date).digest()
  const secretService = createHmac('sha256', secretDate).update(service).digest()
  const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest()
  const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex')
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return {
    'Content-Type': contentType,
    'X-TC-Action': action,
    'X-TC-Version': '2025-05-13',
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': 'ap-guangzhou',
    Authorization: authorization,
  }
}

export function volcengineSign(
  queryParams: Record<string, string>,
  body: unknown,
  accessKey: string,
  secretKey: string,
): { url: string; headers: Record<string, string>; body: string } {
  const host = 'visual.volcengineapi.com'
  const ts = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const datestamp = ts.slice(0, 8)
  const payloadStr = JSON.stringify(body)
  const payloadHash = createHash('sha256').update(payloadStr).digest('hex')
  const canonicalQs = Object.keys(queryParams)
    .sort()
    .map((k) => `${k}=${queryParams[k]}`)
    .join('&')
  const signedHeaders = 'content-type;host;x-content-sha256;x-date'
  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-content-sha256:${payloadHash}\nx-date:${ts}\n`
  const canonicalRequest = `POST\n/\n${canonicalQs}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const algorithm = 'HMAC-SHA256'
  const credentialScope = `${datestamp}/cn-north-1/cv/request`
  const stringToSign = `${algorithm}\n${ts}\n${credentialScope}\n${createHash('sha256').update(canonicalRequest).digest('hex')}`
  const kDate = createHmac('sha256', secretKey).update(datestamp).digest()
  const kRegion = createHmac('sha256', kDate).update('cn-north-1').digest()
  const kService = createHmac('sha256', kRegion).update('cv').digest()
  const kSigning = createHmac('sha256', kService).update('request').digest()
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex')
  const authorization = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  return {
    url: `https://${host}?${canonicalQs}`,
    headers: {
      'X-Date': ts,
      Authorization: authorization,
      'X-Content-Sha256': payloadHash,
      'Content-Type': 'application/json',
    },
    body: payloadStr,
  }
}

export async function pollVolcengineTask(
  accessKey: string,
  secretKey: string,
  reqKey: string,
  taskId: string,
  reply: FastifyReply,
  maxPolls = 60,
  intervalMs = 5000,
): Promise<Record<string, unknown> | null> {
  const pollParams = { Action: 'CVSync2AsyncGetResult', Version: '2022-08-31' }
  const pollBody = { req_key: reqKey, task_id: taskId }
  for (let i = 0; i < maxPolls; i++) {
    await new Promise((r) => setTimeout(r, intervalMs))
    const signed = volcengineSign(pollParams, pollBody, accessKey, secretKey)
    const resp = await fetchWithTimeout(
      signed.url,
      { method: 'POST', headers: signed.headers, body: signed.body },
      60_000,
    )
    const data = (await resp.json().catch(() => ({}))) as Record<string, unknown>
    const dataBlock = data.data as Record<string, unknown> | undefined
    if (dataBlock?.status === 'done') return data
  }
  reply.status(504).send(error(504, '异步任务轮询超时'))
  return null
}

export async function callVendor(
  vendor: string,
  url: string,
  reply: FastifyReply,
  options: RequestInit = {},
  timeoutMs = 30_000,
): Promise<unknown | null> {
  const key = requireVendorKey(vendor, reply)
  if (key === null) return null
  const cfg = VENDORS[vendor]!
  try {
    const resp = await fetchWithTimeout(
      url,
      {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...cfg.authHeader(key),
          ...(options.headers ?? {}),
        },
      },
      timeoutMs,
    )
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      reply
        .status(502)
        .send(
          error(502, `${cfg.name} 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 500)}`),
        )
      return null
    }
    return data
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    reply.status(502).send(error(502, `${cfg.name} 调用异常: ${msg}`))
    return null
  }
}

export interface AsyncTask {
  taskId: string
  userId: string
  vendor: string
  type: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  result?: unknown
  error?: string
  createdAt: number
  updatedAt: number
}

export interface AigcRecord {
  recordId: string
  userId: string
  type: string
  vendor: string
  prompt: string
  resultUrl?: string
  createdAt: number
}

export interface Timbre {
  timbreId: string
  userId: string
  voiceName: string
  audioUrl: string
  vendor: string
  status: 'training' | 'ready' | 'failed'
  createdAt: number
}

export interface UsageStat {
  userId: string
  vendor: string
  calls: number
  lastCallAt: number
}

export const taskStore = new Map<string, AsyncTask>()
export const aigcStore = new Map<string, AigcRecord>()
export const timbreStore = new Map<string, Timbre>()
export const usageStore = new Map<string, UsageStat>()
export const n8nAgentStore = new Map<string, Record<string, unknown>>()
export const tencentActiveJobs = new Map<string, Record<string, unknown>>()

export function genId(prefix: string): string {
  // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成追踪 ID
  // 风险:Math.random 可预测 → 攻击者可枚举其他用户的任务/事件 ID
  return generateTrackingId(prefix)
}

export function recordUsage(userId: string, vendor: string): void {
  const k = `${userId}:${vendor}`
  const cur = usageStore.get(k)
  const now = Date.now()
  if (cur) {
    cur.calls += 1
    cur.lastCallAt = now
  } else {
    usageStore.set(k, { userId, vendor, calls: 1, lastCallAt: now })
  }
}

export function createTask(
  userId: string,
  vendor: string,
  type: string,
  payload?: unknown,
): AsyncTask {
  const now = Date.now()
  const task: AsyncTask = {
    taskId: genId('task'),
    userId,
    vendor,
    type,
    status: 'pending',
    result: payload,
    createdAt: now,
    updatedAt: now,
  }
  taskStore.set(task.taskId, task)
  return task
}

export async function cloneTimbre(
  userId: string,
  voiceName: string,
  audioUrl: string,
  vendor = 'doubao',
): Promise<{ timbre?: Timbre; error?: string }> {
  const vendorCfg = VENDORS[vendor]
  if (!vendorCfg) return { error: `不支持的厂商: ${vendor}` }
  const key = process.env[vendorCfg.keyEnv]
  if (!key) return { error: `${vendorCfg.name} 服务未配置` }
  try {
    const resp = await fetchWithTimeout(`${vendorCfg.baseUrl}/v1/voice/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...vendorCfg.authHeader(key) },
      body: JSON.stringify({ voice_name: voiceName, audio_url: audioUrl }),
    })
    const data = await resp.json().catch(() => ({}))
    if (!resp.ok)
      return {
        error: `${vendorCfg.name} 调用失败: ${resp.status} ${JSON.stringify(data).slice(0, 200)}`,
      }
    const timbre: Timbre = {
      timbreId: genId('timbre'),
      userId,
      voiceName,
      audioUrl,
      vendor,
      status: 'ready',
      createdAt: Date.now(),
    }
    timbreStore.set(timbre.timbreId, timbre)
    return { timbre }
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
    return { error: `${vendorCfg.name} 调用异常: ${msg}` }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
