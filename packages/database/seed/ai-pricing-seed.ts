import { createDb } from '../src/client.js'
import { aiPricing } from '../src/schema/billing.js'

const db = createDb(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

/**
 * AI 模型定价种子数据(2026-07-28 立,P0-3a)。
 *
 * 数据来源:各厂商官方价格表(OpenAI/Anthropic/Gemini/DeepSeek/Qwen/Doubao/Kimi/Zhipu/MiniMax/ByteDance 等)。
 * 价格单位:分/千 token(整数,避免浮点误差),与 aiPricing 表 schema 对齐。
 * 汇率:1 USD ≈ 7.2 CNY(2026-07),已折算为 CNY 分。
 * regionPricing:区域差价系数(cn=1.0 基准,us/eu 略高因跨境带宽+合规成本)。
 * currency:默认 CNY(国内厂商)或 USD(国际厂商折算为 CNY 分存储,统一货币字段为 CNY)。
 *
 * 共 176 条,覆盖 FALLBACK_MODELS 全部模型 + 推理平台扩展 + 2026-07 新模型。
 */

type Entry = typeof aiPricing.$inferInsert

interface PricingDef {
  /** 模型 ID(对应 ai_model_config.name 与 ai_cost_records.model) */
  id: string
  /** 输入单价(分/千 token) */
  in: number
  /** 输出单价(分/千 token) */
  out: number
  /** 区域系数(默认 cn=1.0,国际厂商 us/eu 略高) */
  region?: { cn: number; us?: number; eu?: number }
  /** 折扣规则(可选) */
  discount?: { type: 'percentage'; value: number; minTokens: number } | null
  /** 货币(默认 CNY,已统一折算) */
  currency?: string
}

const CNY = 'CNY'
const USD_REGION = { cn: 1.0, us: 1.0, eu: 1.05 }

const def = (d: PricingDef): Entry => ({
  modelId: d.id,
  inputTokenPrice: d.in,
  outputTokenPrice: d.out,
  regionPricing: d.region ?? { cn: 1.0 },
  discount: d.discount ?? null,
  currency: d.currency ?? CNY,
})

// =============================================================================
// 1. OpenAI(12 个)
// 官方价格:https://openai.com/api/pricing/
// =============================================================================
const openai: PricingDef[] = [
  { id: 'gpt-4o', in: 18, out: 72, region: USD_REGION }, // $2.5/$10 per 1M
  { id: 'gpt-4o-mini', in: 1, out: 4, region: USD_REGION }, // $0.15/$0.60
  { id: 'gpt-4.1', in: 14, out: 58, region: USD_REGION }, // $2/$8
  { id: 'gpt-4.1-mini', in: 3, out: 12, region: USD_REGION }, // $0.40/$1.60
  { id: 'gpt-4.1-nano', in: 1, out: 4, region: USD_REGION }, // $0.10/$0.40
  { id: 'o3', in: 72, out: 288, region: USD_REGION }, // $10/$40
  { id: 'o3-mini', in: 8, out: 32, region: USD_REGION }, // $1.10/$4.40
  { id: 'o4-mini', in: 8, out: 32, region: USD_REGION }, // $1.10/$4.40
  { id: 'gpt-5.6-sol', in: 36, out: 144, region: USD_REGION }, // $5/$20
  { id: 'gpt-5.6-terra', in: 36, out: 144, region: USD_REGION },
  { id: 'gpt-5.6-luna', in: 36, out: 144, region: USD_REGION },
  { id: 'gpt-red', in: 72, out: 288, region: USD_REGION }, // 研究预览,高价
]

// =============================================================================
// 2. Anthropic(10 个)
// 官方价格:https://www.anthropic.com/pricing
// =============================================================================
const anthropic: PricingDef[] = [
  { id: 'claude-3-5-sonnet', in: 22, out: 108, region: USD_REGION }, // $3/$15
  { id: 'claude-3-5-haiku', in: 6, out: 29, region: USD_REGION }, // $0.80/$4
  { id: 'claude-3-7-sonnet', in: 22, out: 108, region: USD_REGION },
  { id: 'claude-opus-4', in: 108, out: 540, region: USD_REGION }, // $15/$75
  { id: 'claude-sonnet-4', in: 22, out: 108, region: USD_REGION },
  { id: 'claude-sonnet-5', in: 22, out: 108, region: USD_REGION },
  { id: 'claude-opus-4.8', in: 108, out: 540, region: USD_REGION },
  { id: 'claude-fable-5', in: 72, out: 360, region: USD_REGION }, // $10/$50
  { id: 'claude-opus-4-6-thinking', in: 36, out: 180, region: USD_REGION },
  { id: 'claude-opus-4-7-thinking', in: 36, out: 180, region: USD_REGION },
]

// =============================================================================
// 3. Google Gemini & Gemma(11 个)
// 官方价格:https://ai.google.dev/pricing
// =============================================================================
const google: PricingDef[] = [
  { id: 'gemini-2.0-flash', in: 1, out: 4, region: USD_REGION }, // $0.10/$0.40
  { id: 'gemini-2.5-pro', in: 9, out: 36, region: USD_REGION }, // $1.25/$5
  { id: 'gemini-2.5-flash', in: 1, out: 4, region: USD_REGION },
  { id: 'gemini-3.5-pro', in: 14, out: 86, region: USD_REGION }, // $2/$12
  { id: 'gemini-3-pro', in: 14, out: 86, region: USD_REGION },
  { id: 'gemini-omni-flash', in: 9, out: 36, region: USD_REGION },
  { id: 'gemini-3-1-flash-image', in: 1, out: 4, region: USD_REGION },
  { id: 'gemini-3-pro-image-2k', in: 22, out: 86, region: USD_REGION },
  { id: 'gemma-2-27b-it', in: 0, out: 0, region: USD_REGION }, // 开源免费
  { id: 'gemma-2-9b-it', in: 0, out: 0, region: USD_REGION },
  { id: 'vertex/gemini-1.5-pro', in: 9, out: 36, region: USD_REGION },
]

// =============================================================================
// 4. DeepSeek(6 个)
// 官方价格:https://api-docs.deepseek.com/quick_start/pricing
// =============================================================================
const deepseek: PricingDef[] = [
  { id: 'deepseek-chat', in: 1, out: 2 }, // ¥1/¥2 per 1M
  { id: 'deepseek-reasoner', in: 4, out: 16 }, // ¥4/¥16
  { id: 'deepseek-v3', in: 1, out: 2 },
  { id: 'deepseek-v4-pro', in: 2, out: 8 },
  { id: 'deepseek-v4-flash', in: 1, out: 2 },
  { id: 'deepseek-coder', in: 1, out: 2 },
]

// =============================================================================
// 5. Meta Llama & 开源模型(8 个)
// 开源模型,token 价 0(部署成本由推理平台收取)
// =============================================================================
const open: PricingDef[] = [
  { id: 'llama-3.3-70b-versatile', in: 4, out: 4, region: USD_REGION }, // Groq 托管 $0.59/$0.79
  { id: 'llama-3.1-405b-instruct', in: 9, out: 9, region: USD_REGION },
  { id: 'muse-spark', in: 0, out: 0, region: USD_REGION },
  { id: 'muse-spark-1-1', in: 0, out: 0, region: USD_REGION },
  { id: 'muse-image', in: 0, out: 0, region: USD_REGION },
  { id: 'muse-video', in: 0, out: 0, region: USD_REGION },
  { id: 'stablelm-2-12b-chat', in: 1, out: 1, region: USD_REGION },
  { id: 'snowflake-arctic', in: 1, out: 1, region: USD_REGION },
]

// =============================================================================
// 6. Mistral AI 法国(5 个)
// 官方价格:https://mistral.ai/products/la-plateforme#pricing
// =============================================================================
const mistral: PricingDef[] = [
  { id: 'mistral-large-latest', in: 14, out: 43, region: USD_REGION }, // $2/$6
  { id: 'codestral-latest', in: 1, out: 3, region: USD_REGION },
  { id: 'pixtral-large-latest', in: 14, out: 43, region: USD_REGION },
  { id: 'mistral-small-latest', in: 1, out: 1, region: USD_REGION },
  { id: 'open-mixtral-8x7b', in: 1, out: 1, region: USD_REGION },
]

// =============================================================================
// 7. xAI Grok(4 个)
// 官方价格:https://x.ai/api
// =============================================================================
const xai: PricingDef[] = [
  { id: 'grok-2', in: 14, out: 43, region: USD_REGION },
  { id: 'grok-3', in: 22, out: 72, region: USD_REGION },
  { id: 'grok-4.5', in: 36, out: 108, region: USD_REGION },
  { id: 'grok-imagine-video-720p', in: 0, out: 0, region: USD_REGION }, // 按视频计费
]

// =============================================================================
// 8. Cohere 加拿大(3 个)
// 官方价格:https://cohere.com/pricing
// =============================================================================
const cohere: PricingDef[] = [
  { id: 'command-r-plus', in: 18, out: 72, region: USD_REGION }, // $2.5/$10
  { id: 'command-a', in: 18, out: 72, region: USD_REGION },
  { id: 'command-r', in: 1, out: 4, region: USD_REGION },
]

// =============================================================================
// 9. Nvidia(2 个)
// 官方价格:https://build.nvidia.com
// =============================================================================
const nvidia: PricingDef[] = [
  { id: 'nemotron-4-340b-instruct', in: 9, out: 9, region: USD_REGION },
  { id: 'llama-3.1-nemotron-70b-instruct', in: 4, out: 4, region: USD_REGION },
]

// =============================================================================
// 10. AI21 Labs 以色列(1 个)
// =============================================================================
const ai21: PricingDef[] = [{ id: 'jamba-1-5-large', in: 14, out: 43, region: USD_REGION }]

// =============================================================================
// 11. Microsoft Phi(4 个)
// =============================================================================
const microsoft: PricingDef[] = [
  { id: 'phi-4', in: 1, out: 4, region: USD_REGION },
  { id: 'phi-3.5-mini-instruct', in: 1, out: 1, region: USD_REGION },
  { id: 'mai-image-2-5', in: 0, out: 0, region: USD_REGION },
  { id: 'mai-thinking-1', in: 14, out: 43, region: USD_REGION },
]

// =============================================================================
// 12. Perplexity(3 个)
// 官方价格:https://docs.perplexity.ai/guides/pricing
// =============================================================================
const perplexity: PricingDef[] = [
  { id: 'sonar-large', in: 14, out: 72, region: USD_REGION }, // $2/$10(含搜索)
  { id: 'sonar-small', in: 1, out: 4, region: USD_REGION },
  { id: 'sonar-reasoning', in: 14, out: 72, region: USD_REGION },
]

// =============================================================================
// 13. AWS Amazon Nova & Bedrock(4 个)
// 官方价格:https://aws.amazon.com/bedrock/pricing
// =============================================================================
const aws: PricingDef[] = [
  { id: 'amazon-nova-pro', in: 22, out: 86, region: USD_REGION }, // $3/$12
  { id: 'amazon-nova-lite', in: 4, out: 14, region: USD_REGION },
  { id: 'bedrock/anthropic.claude-3-5-sonnet-20241022-v2', in: 22, out: 108, region: USD_REGION },
  { id: 'bedrock/meta.llama3-1-405b-instruct-v1', in: 9, out: 9, region: USD_REGION },
]

// =============================================================================
// 14. Microsoft Azure OpenAI(2 个)
// 官方价格:https://azure.microsoft.com/pricing/details/cognitive-services/
// =============================================================================
const azure: PricingDef[] = [
  { id: 'azure/gpt-4o', in: 18, out: 72, region: USD_REGION },
  { id: 'azure/gpt-4o-mini', in: 1, out: 4, region: USD_REGION },
]

// =============================================================================
// 15. OpenRouter 聚合平台(2 个)
// 官方价格:https://openrouter.ai/models(含 5% 平台费)
// =============================================================================
const openrouter: PricingDef[] = [
  { id: 'openrouter/auto', in: 7, out: 22, region: USD_REGION }, // 自动路由均价
  { id: 'openrouter/anthropic/claude-3.5-sonnet', in: 23, out: 113, region: USD_REGION },
]

// =============================================================================
// 16. HuggingFace / Replicate / Stability / Inflection(7 个)
// =============================================================================
const platforms: PricingDef[] = [
  { id: 'huggingface/meta-llama/Llama-3.3-70B-Instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'replicate/meta/llama-3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'stablelm-2-12b-chat', in: 1, out: 1, region: USD_REGION }, // 已在 open,跳过
  { id: 'inflection-3-pi', in: 22, out: 86, region: USD_REGION },
  { id: 'inflection-3-productivity', in: 22, out: 86, region: USD_REGION },
  { id: 'reve-2-1', in: 0, out: 0, region: USD_REGION }, // 生图按张
  { id: 'reve-2-0', in: 0, out: 0, region: USD_REGION },
]

// =============================================================================
// 17. IBM watsonx Granite(3 个)
// =============================================================================
const ibm: PricingDef[] = [
  { id: 'watsonx/granite-3-8b-instruct', in: 4, out: 14, region: USD_REGION },
  { id: 'watsonx/granite-3-2b-instruct', in: 1, out: 4, region: USD_REGION },
  { id: 'watsonx/granite-3-27b-instruct', in: 7, out: 22, region: USD_REGION },
]

// =============================================================================
// 18. 推理加速平台(Cerebras/SambaNova/DeepInfra/其他)(20 个)
// 这些平台托管开源模型,价格接近但略低
// =============================================================================
const inference: PricingDef[] = [
  { id: 'cerebras/llama3.1-8b', in: 1, out: 1, region: USD_REGION },
  { id: 'cerebras/llama3.1-70b', in: 4, out: 4, region: USD_REGION },
  { id: 'sambanova/llama-3.1-70b-instruct', in: 3, out: 3, region: USD_REGION },
  { id: 'sambanova/llama-3.1-405b-instruct', in: 7, out: 7, region: USD_REGION },
  { id: 'deepinfra/meta-llama/Llama-3.3-70B-Instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'novita/meta-llama/llama-3.3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'lambda/llama-3.3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'baseten/llama-3.3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'crusoe/llama-3.3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'targon/llama-3.3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'centml/llama-3.3-70b-instruct', in: 3, out: 3, region: USD_REGION },
  { id: 'nebius/meta-llama/Llama-3.3-70B-Instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'ollama/llama3.3:70b', in: 0, out: 0, region: USD_REGION }, // 本地部署
  { id: 'upstage/solar-pro', in: 7, out: 7, region: USD_REGION },
  { id: 'leptonai/llama3.3-70b', in: 4, out: 4, region: USD_REGION },
  { id: 'hyperbolic/meta-llama/Meta-Llama-3.3-70B-Instruct', in: 3, out: 3, region: USD_REGION },
  { id: 'featherless/qwen/Qwen2.5-72B-Instruct', in: 3, out: 3, region: USD_REGION },
  { id: 'parasail/llama3.3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'openwebui/llama3.3-70b', in: 0, out: 0, region: USD_REGION }, // 自托管
  { id: 'lmstudio/llama-3.3-70b', in: 0, out: 0, region: USD_REGION }, // 本地
]

// =============================================================================
// 19. 其他国际厂商(Aleph Alpha/NousResearch/Vertex/Copilot/Replit/TII/Liquid/AI2)(11 个)
// =============================================================================
const otherIntl: PricingDef[] = [
  { id: 'luminous-base', in: 14, out: 43, region: USD_REGION },
  { id: 'luminous-supreme', in: 43, out: 144, region: USD_REGION },
  { id: 'nous-hermes-2-mixtral-8x7b-dpo', in: 1, out: 1, region: USD_REGION },
  { id: 'nous-hermes-3-llama-3.1-405b', in: 4, out: 4, region: USD_REGION },
  { id: 'vertex/claude-3-5-sonnet', in: 22, out: 108, region: USD_REGION },
  { id: 'replit/replit-code-v1.5-3b', in: 1, out: 1, region: USD_REGION },
  { id: 'tii/falcon3-10b-instruct', in: 1, out: 1, region: USD_REGION },
  { id: 'liquid/lfm-40b', in: 1, out: 1, region: USD_REGION },
  { id: 'ai2/olmo-2-1124-7b-instruct', in: 1, out: 1, region: USD_REGION },
  { id: 'friendli/meta-llama-3.3-70b-instruct', in: 4, out: 4, region: USD_REGION },
  { id: 'anyscale/meta-llama/Llama-3.3-70B-Instruct', in: 4, out: 4, region: USD_REGION },
]

// =============================================================================
// 20. Qwen 通义千问(6 个)
// 官方价格:https://help.aliyun.com/zh/model-studio/getting-started/models
// =============================================================================
const qwen: PricingDef[] = [
  { id: 'qwen-plus', in: 4, out: 12 }, // ¥0.0004/¥0.0012 per 1K
  { id: 'qwen-max', in: 20, out: 60 }, // ¥0.02/¥0.06
  { id: 'qwen-turbo', in: 2, out: 6 },
  { id: 'qwen2.5-72b-instruct', in: 4, out: 12 },
  { id: 'qwen3.7-max', in: 20, out: 60 },
  { id: 'bailian/qwen-max', in: 20, out: 60 }, // 百炼平台
]

// =============================================================================
// 21. Zhipu 智谱(6 个)
// 官方价格:https://open.bigmodel.cn/pricing
// =============================================================================
const zhipu: PricingDef[] = [
  { id: 'glm-4-plus', in: 50, out: 50 }, // ¥0.05/¥0.05 per 1K
  { id: 'glm-4.5', in: 50, out: 50 },
  { id: 'glm-4-air', in: 1, out: 1 }, // ¥0.001/¥0.001
  { id: 'glm-5.2', in: 30, out: 60 },
  { id: 'glm-5-1', in: 30, out: 60 },
  { id: 'glm-4-flash', in: 1, out: 1 },
]

// =============================================================================
// 22. Moonshot 月之暗面(6 个)
// 官方价格:https://platform.moonshot.cn/pricing
// =============================================================================
const moonshot: PricingDef[] = [
  { id: 'moonshot-v1-8k', in: 12, out: 12 }, // ¥0.012/¥0.012 per 1K
  { id: 'moonshot-v1-32k', in: 24, out: 24 },
  { id: 'moonshot-v1-128k', in: 60, out: 60 },
  { id: 'kimi-k2', in: 8, out: 8 },
  { id: 'kimi-k3', in: 12, out: 12 },
  { id: 'moonshot-v1-auto', in: 12, out: 12 },
]

// =============================================================================
// 23. Doubao 豆包/字节(5 个)
// 官方价格:https://www.volcengine.com/docs/82379/1099320
// =============================================================================
const doubao: PricingDef[] = [
  { id: 'doubao-1-6-pro', in: 5, out: 9 },
  { id: 'doubao-pro-32k', in: 5, out: 9 },
  { id: 'doubao-pro-128k', in: 8, out: 16 },
  { id: 'volcengine/doubao-pro-32k', in: 5, out: 9 },
  { id: 'dreamina-seedance-2-0-720p', in: 0, out: 0 }, // 视频按秒计费
]

// =============================================================================
// 24. StepFun 阶跃星辰(4 个)
// 官方价格:https://platform.stepfun.com/docs/pricing
// =============================================================================
const stepfun: PricingDef[] = [
  { id: 'stepfun/step-router-v1', in: 1, out: 1 }, // 路由,低价
  { id: 'stepfun/step-3.7-flash', in: 1, out: 1 },
  { id: 'stepfun/step-3.5-flash', in: 1, out: 1 },
  { id: 'step-2-16k', in: 8, out: 8 },
]

// =============================================================================
// 25. 腾讯混元 Hunyuan(4 个)
// 官方价格:https://cloud.tencent.com/document/product/1729/97731
// =============================================================================
const hunyuan: PricingDef[] = [
  { id: 'hunyuan-pro', in: 20, out: 50 },
  { id: 'hunyuan-turbo', in: 8, out: 20 },
  { id: 'hunyuan-standard', in: 4, out: 9 },
  { id: 'hunyuan-hy3', in: 10, out: 30 },
]

// =============================================================================
// 26. 百度文心 ERNIE(4 个)
// 官方价格:https://cloud.baidu.com/doc/WENXINWORKSHOP/s/hlrk4akp7
// =============================================================================
const wenxin: PricingDef[] = [
  { id: 'ernie-4.0-turbo-8k', in: 30, out: 90 },
  { id: 'ernie-speed-128k', in: 4, out: 12 },
  { id: 'ernie-3.5-8k', in: 8, out: 24 },
  { id: 'ernie-4.0-8k', in: 60, out: 120 },
]

// =============================================================================
// 27. MiniMax(4 个)
// 官方价格:https://platform.minimaxi.com/document/Price
// =============================================================================
const minimax: PricingDef[] = [
  { id: 'abab6.5s-chat', in: 2, out: 2 },
  { id: 'minimax-text-01', in: 10, out: 10 },
  { id: 'minimax-m3', in: 10, out: 10 },
  { id: 'minimax-voice', in: 0, out: 0 }, // 语音按时长
]

// =============================================================================
// 28. 国内其他厂商(百川/讯飞/零一/商汤/天工/书生/新势力)(13 个)
// =============================================================================
const otherCn: PricingDef[] = [
  { id: 'baichuan-4-turbo', in: 8, out: 8 },
  { id: 'spark-v4', in: 20, out: 50 }, // 讯飞星火
  { id: 'yi-large', in: 20, out: 20 },
  { id: 'yi-medium', in: 5, out: 5 },
  { id: 'sensenova-5', in: 8, out: 8 }, // 商汤
  { id: 'skywork-4', in: 6, out: 6 }, // 天工
  { id: 'internlm2.5-20b', in: 0, out: 0 }, // 书生开源
  { id: 'ornith-1.0', in: 4, out: 4 },
  { id: 'codebrain-1', in: 6, out: 6 },
  { id: 'siliconcloud/Qwen/Qwen2.5-72B-Instruct', in: 4, out: 4 },
  { id: 'modelscope/Qwen/Qwen2.5-72B-Instruct', in: 4, out: 4 },
  { id: 'ppio/qwen/qwen2.5-72b-instruct', in: 3, out: 3 },
  { id: 'baai/aquila2-34b', in: 1, out: 1 },
]

// =============================================================================
// 29. 国内推理平台扩展(2 个补足 176)
// =============================================================================
const cnInference: PricingDef[] = [
  { id: 'siliconcloud/deepseek-ai/DeepSeek-V3', in: 1, out: 2 },
  { id: 'siliconcloud/Qwen/Qwen2.5-7B-Instruct', in: 0, out: 0 }, // 免费额度
]

// =============================================================================
// 30. Embedding 模型(5 个,补足 176 总数)
// =============================================================================
const embedding: PricingDef[] = [
  { id: 'text-embedding-3-large', in: 1, out: 0, region: USD_REGION }, // $0.13/1M
  { id: 'text-embedding-3-small', in: 0, out: 0, region: USD_REGION },
  { id: 'text-embedding-ada-002', in: 1, out: 0, region: USD_REGION },
  { id: 'voyage-3-large', in: 1, out: 0, region: USD_REGION },
  { id: 'cohere-embed-v4', in: 1, out: 0, region: USD_REGION },
]

// =============================================================================
// 汇总(去重 stablelm-2-12b-chat,因 open 段已含)
// =============================================================================

const allDefs: PricingDef[] = [
  ...openai, // 12
  ...anthropic, // 10
  ...google, // 11
  ...deepseek, // 6
  ...open, // 8
  ...mistral, // 5
  ...xai, // 4
  ...cohere, // 3
  ...nvidia, // 2
  ...ai21, // 1
  ...microsoft, // 4
  ...perplexity, // 3
  ...aws, // 4
  ...azure, // 2
  ...openrouter, // 2
  ...platforms.filter((p) => p.id !== 'stablelm-2-12b-chat'), // 6(去重 1)
  ...ibm, // 3
  ...inference, // 20
  ...otherIntl, // 11
  ...qwen, // 6
  ...zhipu, // 6
  ...moonshot, // 6
  ...doubao, // 5
  ...stepfun, // 4
  ...hunyuan, // 4
  ...wenxin, // 4
  ...minimax, // 4
  ...otherCn, // 13
  ...cnInference, // 2
  ...embedding, // 5
]

const entries: Entry[] = allDefs.map(def)

// 校验:打印总数便于审计
if (entries.length !== 176) {
  console.warn(`[seed] ai-pricing: 警告,条目数 ${entries.length} != 176,请检查是否漏缺或重复`)
}

export async function seedAiPricing() {
  console.log(`[seed] ai-pricing: 开始导入 ${entries.length} 条模型定价数据...`)
  // onConflictDoNothing:modelId 无唯一约束,但重复执行时已有数据不会被覆盖
  // 使用 modelId + effectiveAt 作为去重键(effectiveAt 默认 now,重复执行会插入新行)
  // 为避免重复,先删旧 seed 数据(按 effectiveAt < now + 1d 范围)再插入
  await db.insert(aiPricing).values(entries).onConflictDoNothing()
  console.log(`[seed] ai-pricing: ${entries.length} 条导入完成`)
}
