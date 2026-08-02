/**
 * 兜底模型列表(独立模块,纯数据,可在 SSR 和 CSR 中共享)
 *
 * 2026-07-31 Phase C+D 收敛(AGENTS.md §3 共享层优先):
 *   本文件仅作后端 /llm/models 不可达时的最小降级,主数据源是
 *   /llm/models 动态拉取(后端已实现 provider 健康检查 + 自动过滤)。
 *   兜底列表仅保留项目已验证连通的主力 stepfun + Cloudflare 免费 zero_cost 模型。
 *   VENDOR_LABEL 覆盖 /llm/models 动态拉取的所有 vendor(见下方 40-56 行),
 *   使分组下拉菜单中的厂商名均能通过 t() 本地化,避免回退到原始 provider 字符串。
 *
 * 设计目的:
 *   - model-selector.tsx(AI 输入框客户端组件)在 fetchModels() 失败或返回空时使用
 *   - 其他需要展示模型列表的 SSR 组件的最终降级
 */

export interface FallbackModel {
  value: string
  label: string
  /** 厂商代码(用于 BrandIcon,如 'openai'、'deepseek') */
  vendor: string
  /** 描述 i18n 键(可选) */
  descriptionKey?: string
}

/** 兜底模型:仅后端不可达时使用(主数据源是 /llm/models 动态拉取) */
export const FALLBACK_MODELS: FallbackModel[] = [
  // === 项目主力(已验证连通 + 已配置 key,与 ai-service default_models.json 对齐)===
  { value: 'stepfun/step-router-v1', label: 'Step Router v1', vendor: 'stepfun' },
  { value: 'stepfun/step-3.7-flash', label: 'Step 3.7 Flash', vendor: 'stepfun' },
  // === Cloudflare Workers AI(免费 zero_cost,无需 key)===
  {
    value: '@cf/zai-org/glm-4.7-flash',
    label: 'GLM-4.7 Flash (CF 免费)',
    vendor: 'cloudflare_workers_ai',
  },
]

/** 厂商代码 → i18n key(覆盖 /llm/models 动态拉取的所有 vendor + ModelsNav PROVIDER_GROUPS 全部 80+ 厂商)
 * 渲染处用 t() 转换 key 为本地化显示名;未知厂商回退到原始 provider code 字符串 */
export const VENDOR_LABEL: Record<string, string> = {
  // === 项目主力(plan 套餐已接入)===
  stepfun: 'vendor.stepfun',
  cloudflare_workers_ai: 'vendor.cloudflareWorkersAi',
  agnes: 'vendor.agnes',
  gemini: 'vendor.gemini',
  openrouter: 'vendor.openrouter',
  nvidia_nim: 'vendor.nvidiaNim',
  // === 国际原厂 ===
  openai: 'vendor.openai',
  anthropic: 'vendor.anthropic',
  google: 'vendor.google',
  deepseek: 'vendor.deepseek',
  meta: 'vendor.meta',
  mistral: 'vendor.mistral',
  xai: 'vendor.xai',
  cohere: 'vendor.cohere',
  nvidia: 'vendor.nvidia',
  ai21: 'vendor.ai21',
  microsoft: 'vendor.microsoft',
  perplexity: 'vendor.perplexity',
  // === 国内厂商 ===
  qwen: 'vendor.qwen',
  zhipu: 'vendor.zhipu',
  moonshot: 'vendor.moonshot',
  doubao: 'vendor.doubao',
  hunyuan: 'vendor.hunyuan',
  wenxin: 'vendor.wenxin',
  minimax: 'vendor.minimax',
  baichuan: 'vendor.baichuan',
  spark: 'vendor.spark',
  yi: 'vendor.yi',
  sensenova: 'vendor.sensenova',
  skywork: 'vendor.skywork',
  internlm: 'vendor.internlm',
  ornith: 'vendor.ornith',
  codebrain: 'vendor.codebrain',
  mai: 'vendor.mai',
  // === 推理加速 ===
  groq: 'vendor.groq',
  together: 'vendor.together',
  fireworks: 'vendor.fireworks',
  novita: 'vendor.novita',
  lambda: 'vendor.lambda',
  baseten: 'vendor.baseten',
  crusoe: 'vendor.crusoe',
  targon: 'vendor.targon',
  centml: 'vendor.centml',
  nebius: 'vendor.nebius',
  upstage: 'vendor.upstage',
  leptonai: 'vendor.leptonai',
  hyperbolic: 'vendor.hyperbolic',
  featherless: 'vendor.featherless',
  parasail: 'vendor.parasail',
  friendli: 'vendor.friendli',
  anyscale: 'vendor.anyscale',
  infermatic: 'vendor.infermatic',
  replit: 'vendor.replit',
  // === 云平台 ===
  aws: 'vendor.aws',
  bedrock: 'vendor.bedrock',
  azure: 'vendor.azure',
  vertexai: 'vendor.vertexai',
  huggingface: 'vendor.huggingface',
  replicate: 'vendor.replicate',
  stability: 'vendor.stability',
  inflection: 'vendor.inflection',
  ibm: 'vendor.ibm',
  cerebras: 'vendor.cerebras',
  sambanova: 'vendor.sambanova',
  snowflake: 'vendor.snowflake',
  deepinfra: 'vendor.deepinfra',
  alephalpha: 'vendor.alephalpha',
  nous: 'vendor.nous',
  gemma: 'vendor.gemma',
  copilot: 'vendor.copilot',
  bing: 'vendor.bing',
  siliconcloud: 'vendor.siliconcloud',
  modelscope: 'vendor.modelscope',
  ppio: 'vendor.ppio',
  volcengine: 'vendor.volcengine',
  bailian: 'vendor.bailian',
  baai: 'vendor.baai',
  tii: 'vendor.tii',
  liquid: 'vendor.liquid',
  ai2: 'vendor.ai2',
  github_models: 'vendor.githubModels',
  vercel_ai_gateway: 'vendor.vercelAiGateway',
  opencode_zen: 'vendor.opencodeZen',
  modal: 'vendor.modal',
  inferencenet: 'vendor.inferencenet',
  nlpcloud: 'vendor.nlpcloud',
  scaleway: 'vendor.scaleway',
  alibaba_intl: 'vendor.alibabaIntl',
  // === 免费 zero_cost provider ===
  llm7: 'vendor.llm7',
  pollinations: 'vendor.pollinations',
  aihorde: 'vendor.aihorde',
  // === 本地 LLM ===
  ollama: 'vendor.ollama',
  lmstudio: 'vendor.lmstudio',
  openwebui: 'vendor.openwebui',
  local: 'vendor.local',
}
