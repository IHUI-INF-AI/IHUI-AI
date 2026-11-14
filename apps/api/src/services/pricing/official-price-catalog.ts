// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 厂商官方价目(2026-11-14 立)。
 *
 * 背景:三源价表(LiteLLM / OpenRouter / models.dev)对长尾模型覆盖不足,
 * 上一次 sweep 把 94 个「拿不到三源权威价」的模型下架了事。机主裁定:
 * 「所有模型都要有价格 并且不能瞎定」—— 下架不是答案,但也不能插值/取中位数。
 *
 * 本文件是**人工核对过的厂商官方价目快照**,每条都可追溯到官方页面:
 *   - Google Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
 *   - xAI(LiteLLM 的 xai/ 命名空间镜像官方价): https://docs.x.ai/docs/models
 *   - Agnes 官方定价: https://wiki.agnes-ai.com/en/docs/pricing
 *   - 硅基流动官方价目: https://cloud-rd.siliconflow.cn/pricing
 *   - HuggingFace Inference Providers Router: https://router.huggingface.co/v1/models
 *   - 小米 MiMo 开放平台: https://mimo.mi.com/docs/zh-CN/pricing
 *
 * 单位约定(**成本价**,未乘利润系数):
 *   - token:分/千 token(CNY)
 *   - per_image / per_video / per_call:分/张、分/秒、分/次
 *   - USD 按 AI_PRICE_USD_TO_CNY(默认 7.2)折算后写入
 */

export type OfficialBillingMode = 'token' | 'per_image' | 'per_video' | 'per_call' | 'free'

export interface OfficialPriceEntry {
  /** 渠道编码,必须与 ai_model_config.provider_code 一致 */
  providerCode: string
  /** 模型 id(小写) */
  modelId: string
  billingMode: OfficialBillingMode
  /** token 模式:成本 分/千 token */
  inputPer1k?: number
  outputPer1k?: number
  /** 官方明确「无输出 token」(如决策模型),输出价按 0 记账是合法状态 */
  outputNotApplicable?: boolean
  /** 非 token 模式:成本 分/单位 */
  unitPriceCents?: number
  /** per_video 计价单位 */
  videoUnit?: 'call' | 'second'
  /** 计价依据(分辨率/时长/字符等),写进 metadata 供复核 */
  unitBasis?: string
  /** 官方价目出处 */
  source: string
  /** 抓取日期 */
  retrievedAt: string
  note?: string
}

const GOOGLE_PRICING = 'https://ai.google.dev/gemini-api/docs/pricing'
const XAI_VIA_LITELLM =
  'https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json (xai/)'
const AGNES_PRICING = 'https://wiki.agnes-ai.com/en/docs/pricing'
const SILICONFLOW_PRICING = 'https://cloud-rd.siliconflow.cn/pricing'
const HF_ROUTER = 'https://router.huggingface.co/v1/models'
const MIMO_PRICING = 'https://mimo.mi.com/docs/zh-CN/pricing'
const AT = '2026-11-14'

// USD → 分:USD/1M token → 分/1k token 乘 0.72;USD/张|秒|次 → 分乘 720。
// USD 汇率与 model-price-resolver 的 AI_PRICE_USD_TO_CNY(7.2)一致。

const gemini: OfficialPriceEntry[] = [
  {
    providerCode: 'gemini',
    modelId: 'gemini-2.5-flash-native-audio-latest',
    billingMode: 'token',
    inputPer1k: 0.36,
    outputPer1k: 1.44,
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方 $0.50/M 文本输入、$2.00/M 文本输出;音频 token 溢价未纳入(计费链路只记文本口径)',
  },
  {
    providerCode: 'gemini',
    modelId: 'gemini-2.5-flash-native-audio-preview-09-2025',
    billingMode: 'token',
    inputPer1k: 0.36,
    outputPer1k: 1.44,
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '同 native-audio-latest',
  },
  {
    providerCode: 'gemini',
    modelId: 'gemini-2.5-flash-native-audio-preview-12-2025',
    billingMode: 'token',
    inputPer1k: 0.36,
    outputPer1k: 1.44,
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '同 native-audio-latest',
  },
  {
    providerCode: 'gemini',
    modelId: 'gemini-3.5-transcribe-live',
    billingMode: 'token',
    inputPer1k: 2.52,
    outputPer1k: 15.12,
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方 $3.50/M 音频输入、$21.00/M 文本输出',
  },
  {
    providerCode: 'gemini',
    modelId: 'gemini-decision-1',
    billingMode: 'token',
    inputPer1k: 0.072,
    outputPer1k: 0,
    outputNotApplicable: true,
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方 $0.10/M 输入,输出 0 token(Not applicable)',
  },
  {
    providerCode: 'gemini',
    modelId: 'gemini-robotics-er-2-streaming-preview',
    billingMode: 'token',
    inputPer1k: 0.72,
    outputPer1k: 3.6,
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方 $1.00/M 输入、$5.00/M 输出(2026-12-31 前优惠价)',
  },
  {
    providerCode: 'gemini',
    modelId: 'deep-research-pro-preview-12-2025',
    billingMode: 'token',
    inputPer1k: 1.44,
    outputPer1k: 8.64,
    source: XAI_VIA_LITELLM,
    retrievedAt: AT,
    note: 'LiteLLM gemini/ 命名空间镜像官方 $2/M 输入、$12/M 输出',
  },
  {
    providerCode: 'gemini',
    modelId: 'lyria-3-clip-preview',
    billingMode: 'per_call',
    unitPriceCents: 28.8,
    unitBasis: '每首(30 秒片段)',
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方 $0.04 / song',
  },
  {
    providerCode: 'gemini',
    modelId: 'lyria-3-pro-preview',
    billingMode: 'per_call',
    unitPriceCents: 57.6,
    unitBasis: '每首(完整歌曲)',
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方 $0.08 / song',
  },
  {
    providerCode: 'gemini',
    modelId: 'lyria-3.5',
    billingMode: 'per_call',
    unitPriceCents: 57.6,
    unitBasis: '每首(完整歌曲)',
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方 $0.08 / song',
  },
  {
    providerCode: 'gemini',
    modelId: 'lyria-realtime-exp',
    billingMode: 'per_call',
    unitPriceCents: 57.6,
    unitBasis: '每次',
    source: GOOGLE_PRICING,
    retrievedAt: AT,
    note: '官方价目表未单列 RealTime;LiteLLM gemini/lyria-realtime-exp 按 $0.08/次',
  },
]

const xai: OfficialPriceEntry[] = [
  {
    providerCode: 'xai',
    modelId: 'grok-imagine-image',
    billingMode: 'per_image',
    unitPriceCents: 14.4,
    unitBasis: '每张',
    source: XAI_VIA_LITELLM,
    retrievedAt: AT,
    note: '官方 $0.02 / image',
  },
  {
    providerCode: 'xai',
    modelId: 'grok-imagine-image-2.0',
    billingMode: 'per_image',
    unitPriceCents: 43.2,
    unitBasis: '每张(2K)',
    source: XAI_VIA_LITELLM,
    retrievedAt: AT,
    note: '官方 $0.04(1K)/$0.06(2K),按 2K 上限计价防止低于成本',
  },
  {
    providerCode: 'xai',
    modelId: 'grok-imagine-video',
    billingMode: 'per_video',
    videoUnit: 'second',
    unitPriceCents: 36,
    unitBasis: '每秒(480P)',
    source: XAI_VIA_LITELLM,
    retrievedAt: AT,
    note: '官方 $0.05/秒(480P)、$0.07/秒(720P)',
  },
  {
    providerCode: 'xai',
    modelId: 'grok-imagine-video-1.5',
    billingMode: 'per_video',
    videoUnit: 'second',
    unitPriceCents: 57.6,
    unitBasis: '每秒(480P)',
    source: XAI_VIA_LITELLM,
    retrievedAt: AT,
    note: '官方 $0.08/秒(480P)、$0.14/秒(720P)、$0.25/秒(1080P)',
  },
  {
    providerCode: 'xai',
    modelId: 'grok-imagine-video-1.5-lite',
    billingMode: 'per_video',
    videoUnit: 'second',
    unitPriceCents: 14.4,
    unitBasis: '每秒(480P)',
    source: XAI_VIA_LITELLM,
    retrievedAt: AT,
    note: '官方 $0.02/秒(480P)、$0.03/秒(720P)',
  },
]

const agnes: OfficialPriceEntry[] = [
  {
    providerCode: 'agnes',
    modelId: 'agnes-2.5-flash',
    billingMode: 'token',
    inputPer1k: 0.036,
    outputPer1k: 0.108,
    source: AGNES_PRICING,
    retrievedAt: AT,
    note: '官方标价 $0.05/M 输入、$0.15/M 输出(当前限免,按标价记成本)',
  },
  {
    providerCode: 'agnes',
    modelId: 'agnes-3.0-flash',
    billingMode: 'token',
    inputPer1k: 0.036,
    outputPer1k: 0.108,
    source: AGNES_PRICING,
    retrievedAt: AT,
    note: '官方标价 $0.05/M 输入、$0.15/M 输出(当前限免,按标价记成本)',
  },
  {
    providerCode: 'agnes',
    modelId: 'agnes-image-2.0-flash',
    billingMode: 'per_image',
    unitPriceCents: 7.2,
    unitBasis: '每张(1K)',
    source: AGNES_PRICING,
    retrievedAt: AT,
    note: '官方 $10/1000 张(1K);2K $0.018、3K $0.021、4K $0.024',
  },
  {
    providerCode: 'agnes',
    modelId: 'agnes-image-2.1-flash',
    billingMode: 'per_image',
    unitPriceCents: 7.2,
    unitBasis: '每张(1K)',
    source: AGNES_PRICING,
    retrievedAt: AT,
    note: '同 agnes-image-2.0-flash',
  },
  {
    providerCode: 'agnes',
    modelId: 'agnes-image-2.5-flash',
    billingMode: 'per_image',
    unitPriceCents: 7.2,
    unitBasis: '每张(1K)',
    source: AGNES_PRICING,
    retrievedAt: AT,
    note: '同 agnes-image-2.0-flash',
  },
  {
    providerCode: 'agnes',
    modelId: 'agnes-video-2.5',
    billingMode: 'per_video',
    videoUnit: 'second',
    unitPriceCents: 18,
    unitBasis: '每秒(720P)',
    source: AGNES_PRICING,
    retrievedAt: AT,
    note: '官方 $0.025/秒(720P)、$0.040/秒(1080P/1K)、$0.055/秒(2K)',
  },
  {
    providerCode: 'agnes',
    modelId: 'agnes-video-2.5-flash',
    billingMode: 'per_video',
    videoUnit: 'second',
    unitPriceCents: 18,
    unitBasis: '每秒(720P)',
    source: AGNES_PRICING,
    retrievedAt: AT,
    note: '与 agnes-video-2.5 同计价规则',
  },
]

const siliconflow: OfficialPriceEntry[] = [
  // 对话/embedding/rerank:¥/M token × 0.1 = 分/千 token
  { providerCode: 'siliconflow', modelId: 'qwen/qwen2.5-14b-instruct', billingMode: 'token', inputPer1k: 0.07, outputPer1k: 0.07, source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'qwen/qwen2.5-32b-instruct', billingMode: 'token', inputPer1k: 0.126, outputPer1k: 0.126, source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'qwen/qwen2.5-72b-instruct-128k', billingMode: 'token', inputPer1k: 0.413, outputPer1k: 0.413, source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'qwen/qwen3-omni-30b-a3b-instruct', billingMode: 'token', inputPer1k: 0.07, outputPer1k: 0.28, source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'qwen/qwen3-omni-30b-a3b-captioner', billingMode: 'token', inputPer1k: 0.07, outputPer1k: 0.28, source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'qwen/qwen3-vl-8b-thinking', billingMode: 'token', inputPer1k: 0.05, outputPer1k: 0.5, source: SILICONFLOW_PRICING, retrievedAt: AT },
  {
    providerCode: 'siliconflow',
    modelId: 'qwen/qwen3-vl-reranker-8b',
    billingMode: 'token',
    inputPer1k: 0.07,
    outputPer1k: 0,
    outputNotApplicable: true,
    source: SILICONFLOW_PRICING,
    retrievedAt: AT,
    note: '重排序模型官方只计输入 ¥0.70/M,无输出价',
  },
  { providerCode: 'siliconflow', modelId: 'thudm/glm-4-32b-0414', billingMode: 'token', inputPer1k: 0.189, outputPer1k: 0.189, source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'inclusionai/ling-mini-2.0', billingMode: 'token', inputPer1k: 0.05, outputPer1k: 0.2, source: SILICONFLOW_PRICING, retrievedAt: AT },
  // 生图:¥/张 × 100 = 分/张
  { providerCode: 'siliconflow', modelId: 'openmoss-team/moss-image', billingMode: 'per_image', unitPriceCents: 15, unitBasis: '每张', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'tongyi-mai/z-image', billingMode: 'per_image', unitPriceCents: 30, unitBasis: '每张', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'tongyi-mai/z-image-turbo', billingMode: 'per_image', unitPriceCents: 10, unitBasis: '每张', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'qwen/qwen-image-edit', billingMode: 'per_image', unitPriceCents: 30, unitBasis: '每张', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'qwen/qwen-image-edit-2509', billingMode: 'per_image', unitPriceCents: 30, unitBasis: '每张', source: SILICONFLOW_PRICING, retrievedAt: AT },
  // 视频:¥/秒 × 100 = 分/秒
  { providerCode: 'siliconflow', modelId: 'minimaxai/minimax-h3', billingMode: 'per_video', videoUnit: 'second', unitPriceCents: 50, unitBasis: '每秒', source: SILICONFLOW_PRICING, retrievedAt: AT },
  // 官方免费(¥0,合法零价)
  { providerCode: 'siliconflow', modelId: 'xingchenagi/xing4.0-29b', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'paddlepaddle/paddleocr-vl-1.5', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'baai/bge-large-zh-v1.5', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'baai/bge-large-en-v1.5', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'tencent/hunyuan-mt-7b', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'thudm/glm-4-9b-0414', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'thudm/glm-z1-9b-0414', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'kwai-kolors/kolors', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'xingchenagi/xingchengsr-v1.0', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'xingchenagi/xingchenasr-v3.2', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'xingchenagi/xingchenasr-v3.2-ultra', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'xingchenagi/xingchenasr-diarize-v3.0', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
  { providerCode: 'siliconflow', modelId: 'funaudiollm/sensevoicesmall', billingMode: 'free', source: SILICONFLOW_PRICING, retrievedAt: AT },
]

const huggingface: OfficialPriceEntry[] = [
  { providerCode: 'huggingface', modelId: 'bsc-lt/alia-40b-instruct-2606', billingMode: 'token', inputPer1k: 0.216, outputPer1k: 0.432, source: HF_ROUTER, retrievedAt: AT, note: 'Router 提供方 publicai $0.30/$0.60 per M' },
  { providerCode: 'huggingface', modelId: 'aisingapore/nemotron-sea-lion-v4.8-120b-a12b', billingMode: 'token', inputPer1k: 0.36, outputPer1k: 1.44, source: HF_ROUTER, retrievedAt: AT, note: 'Router 提供方 publicai $0.50/$2.00 per M' },
  { providerCode: 'huggingface', modelId: 'aisingapore/qwen-sea-lion-v4.5-27b-it', billingMode: 'token', inputPer1k: 0.144, outputPer1k: 0.288, source: HF_ROUTER, retrievedAt: AT, note: 'Router 提供方 publicai $0.20/$0.40 per M' },
  { providerCode: 'huggingface', modelId: 'ibm-granite/granite-4.2-30b', billingMode: 'token', inputPer1k: 0.1152, outputPer1k: 0.468, source: HF_ROUTER, retrievedAt: AT, note: 'Router 提供方 deepinfra $0.16/$0.65 per M' },
  { providerCode: 'huggingface', modelId: 'ibm-granite/granite-4.2-3b', billingMode: 'token', inputPer1k: 0.0216, outputPer1k: 0.0864, source: HF_ROUTER, retrievedAt: AT, note: 'Router 提供方 deepinfra $0.03/$0.12 per M' },
  { providerCode: 'huggingface', modelId: 'swiss-ai/apertus-70b-instruct-2509', billingMode: 'token', inputPer1k: 0.5904, outputPer1k: 2.1024, source: HF_ROUTER, retrievedAt: AT, note: 'Router 提供方 publicai $0.82/$2.92 per M' },
  { providerCode: 'huggingface', modelId: 'swiss-ai/apertus-8b-instruct-2509', billingMode: 'token', inputPer1k: 0.072, outputPer1k: 0.144, source: HF_ROUTER, retrievedAt: AT, note: 'Router 提供方 publicai $0.10/$0.20 per M' },
]

const mimo: OfficialPriceEntry[] = [
  { providerCode: 'mimo', modelId: 'mimo-v2.5-tts', billingMode: 'free', source: MIMO_PRICING, retrievedAt: AT, note: '官方 TTS 系列限时免费(0x 积分)' },
  { providerCode: 'mimo', modelId: 'mimo-v2.5-tts-voiceclone', billingMode: 'free', source: MIMO_PRICING, retrievedAt: AT, note: '官方 TTS 系列限时免费' },
  { providerCode: 'mimo', modelId: 'mimo-v2.5-tts-voicedesign', billingMode: 'free', source: MIMO_PRICING, retrievedAt: AT, note: '官方 TTS 系列限时免费' },
]

const openrouter: OfficialPriceEntry[] = [
  { providerCode: 'openrouter', modelId: 'lyria-3-clip-preview', billingMode: 'per_call', unitPriceCents: 28.8, unitBasis: '每首(30 秒片段)', source: GOOGLE_PRICING, retrievedAt: AT, note: 'Google 官方 $0.04/song' },
  { providerCode: 'openrouter', modelId: 'lyria-3-pro-preview', billingMode: 'per_call', unitPriceCents: 57.6, unitBasis: '每首(完整歌曲)', source: GOOGLE_PRICING, retrievedAt: AT, note: 'Google 官方 $0.08/song' },
  { providerCode: 'openrouter', modelId: 'openrouter/free', billingMode: 'free', source: 'https://openrouter.ai/api/v1/models', retrievedAt: AT, note: '开放路由免费档,上游价 0' },
]

export const OFFICIAL_PRICE_CATALOG: readonly OfficialPriceEntry[] = [
  ...gemini,
  ...xai,
  ...agnes,
  ...siliconflow,
  ...huggingface,
  ...mimo,
  ...openrouter,
]

const INDEX = new Map<string, OfficialPriceEntry>()
for (const e of OFFICIAL_PRICE_CATALOG) INDEX.set(`${e.providerCode}|${e.modelId}`, e)

/** 精确命中官方价目(provider+模型名,不做任何模糊匹配) */
export function lookupOfficialPrice(
  providerCode: string,
  modelId: string,
): OfficialPriceEntry | undefined {
  return INDEX.get(`${providerCode}|${modelId.toLowerCase()}`)
}
