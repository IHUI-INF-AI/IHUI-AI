// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 平台展示名解析 — 纯函数模块(零依赖,可被 RSC 直接 import)
 *
 * 2026-08-04 Phase E 收敛:FALLBACK_MODELS + FallbackModel 已提取到 @ihui/shared,
 *   需要 FALLBACK_MODELS 的客户端组件直接从 @ihui/shared 取;本文件禁止 import 根桶(会把带 useEffect 的客户端模块带进 RSC)。
 *   本文件仅保留 VENDOR_LABEL(web 端 model-selector.tsx 本地使用,
 *   覆盖 /llm/models 动态拉取的所有 vendor + ModelsNav PROVIDER_GROUPS 全部 80+ 厂商),
 *   使分组下拉菜单中的厂商名均能通过 t() 本地化,避免回退到原始 provider 字符串。
 *
 * 设计目的:
 *   - model-selector.tsx(AI 输入框客户端组件)在 fetchModels() 失败或返回空时使用
 *   - 其他需要展示模型列表的 SSR 组件的最终降级
 */


/** 厂商代码 → i18n key(覆盖 /llm/models 动态拉取的所有 vendor + ModelsNav PROVIDER_GROUPS 全部 80+ 厂商)
 * 渲染处统一走 resolveVendorDisplayName();未知厂商回退到美化后的 code(内部 `_relay` 后缀一律剥掉) */
export const VENDOR_LABEL: Record<string, string> = {
  // === 项目主力(plan 套餐已接入)===
  ihui_relay: 'vendor.ihuiRelay',
  /**
   * 2026-11-18 修「分组名把内部 code 漏给用户」:ai-service `build_model_catalog` 把
   * workbuddy 号池模型的 provider 写成 `workbuddy_relay`(走中转桥,供可用性/能力判定用),
   * 前端按 VENDOR_LABEL 查不到就原样回退 ⇒ 下拉里出现「WORKBUDDY_RELAY」这种内部串。
   * 账号池侧同一平台的 provider 是 `workbuddy`,两者必须落到同一个展示名。
   */
  workbuddy: 'WorkBuddy',
  workbuddy_relay: 'WorkBuddy',
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
  qwen_local: 'vendor.qwenLocal',
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
  // === 2026-09-21 补:新厂商(值为显示名,next-intl 对非 i18n key 原样回显,后续可迁移 vendor.* key) ===
  zai: 'Z.ai 智谱国际',
  minimaxintl: 'MiniMax 国际',
  dashscopeintl: '通义国际',
  byteplus: 'BytePlus',
  pangu: '华为盘古',
  infini: '无问芯穹',
  mureka: 'Mureka 天工音乐',
  // === 推理加速(补) ===
  vercel: 'Vercel Gateway',
  nscale: 'Nscale',
  gmi: 'GMI Cloud',
  ubicloud: 'Ubicloud',
  vllm: 'vLLM',
  xinference: 'Xinference',
  fal: 'Fal.ai',
  // === 语音/媒体(补) ===
  hume: 'Hume',
  inworld: 'Inworld',
  soniox: 'Soniox',
  gladia: 'Gladia',
  getimg: 'GetIMG',
  bria: 'Bria',
  freepik: 'Freepik',
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
  // === 个人号池平台(与 apps/api 的 RELAY_PROVIDERS 同一批 code;品牌名不译) ===
  // 这些 code 会作为 /llm/models 与 /api/account-pool/models 的 provider 下发,
  // 选择器按 provider 分组 ⇒ 缺映射就会把平台内部 code 直接摆给用户看。
  trae: 'Trae',
  codearts: 'CodeArts',
  qoder: 'Qoder',
  codex: 'Codex',
  opencode: 'OpenCode',
  zcode: 'ZCode',
  loomy: 'Loomy',
  lingma: '通义灵码',
  grokbot: 'GrokBot',
  raccoon: 'Raccoon',
  cursor: 'Cursor',
}

/**
 * vendor code → 展示名(带别名归并)。
 *
 * 2026-11-18 立:`key` 命中映射表时为 i18n key 或原样显示的显示名;`_relay` 结尾的
 * 内部接入别名(平台经中转桥接入,如 workbuddy_relay)回退到平台自身的展示名。
 * 2026-11-22 起未命中的 code 也回退到美化后的名字(剥后缀 + 分词大写),绝不原样外露。
 */
/** 内部接入后缀(平台经中转桥接入时由后端加在 provider code 上,如 workbuddy_relay)。
 *  2026-11-22 用户定档:「所有平台的名都不希望有这个后缀」——展示名一律剥掉,不区分平台。 */
const INTERNAL_VENDOR_SUFFIX_RE = /[_-]relay$/i

/** 剥掉内部接入后缀:`workbuddy_relay` → `workbuddy`(大小写 / 横线 / 下划线都认)。 */
export function stripInternalVendorSuffix(vendor: string): string {
  return vendor.replace(INTERNAL_VENDOR_SUFFIX_RE, '')
}

/** 原始 code 美化:unknown_provider → `Unknown Provider`;永不保留 `_relay` 后缀。 */
export function prettifyVendorCode(vendor: string): string {
  return stripInternalVendorSuffix(vendor)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function resolveVendorLabel(vendor: string | undefined): {
  /** 命中的 i18n key / 显示名;未命中为 null */
  key: string | null
  /** 回退显示名(已剥内部后缀并美化,永不含 `_relay`) */
  fallback: string
} {
  if (!vendor) return { key: null, fallback: '' }
  const direct = VENDOR_LABEL[vendor] ?? VENDOR_LABEL[vendor.toLowerCase()]
  if (direct) return { key: direct, fallback: prettifyVendorCode(vendor) }
  const base = stripInternalVendorSuffix(vendor)
  if (base !== vendor) {
    const mapped = VENDOR_LABEL[base] ?? VENDOR_LABEL[base.toLowerCase()]
    return { key: mapped ?? null, fallback: prettifyVendorCode(base) }
  }
  return { key: null, fallback: prettifyVendorCode(vendor) }
}

/**
 * 平台展示名唯一出口:有 i18n key 走 t(),无 key 用美化后的兜底名。
 * 所有"平台名 / 厂商名"展示都应走它,不要直接拼 provider code。
 */
export function resolveVendorDisplayName(
  vendor: string | undefined,
  t?: (key: string) => string,
): string {
  const { key, fallback } = resolveVendorLabel(vendor)
  if (!key) return fallback
  if (key.startsWith('vendor.')) return t ? t(key) : fallback
  return key
}

/** 分组归并键:同一品牌的多套接入 code 落到同一组标题(否则会出现两个同名分组) */
export function vendorGroupKey(vendor: string): string {
  const { key, fallback } = resolveVendorLabel(vendor)
  return key ?? fallback
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
