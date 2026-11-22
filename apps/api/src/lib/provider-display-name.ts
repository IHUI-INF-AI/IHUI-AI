// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * provider code → 对外展示名(单一真相源)。
 *
 * 内部接入后缀(`_relay` / `-relay`,平台经中转桥接入时由 ai-service 模型目录临时改写)
 * 只用于后端可用性/能力判定,**永不出现在任何面向用户的文案或标签里**。
 * 公开状态页(渠道状态 + 最近事件描述)与前端展示面共用同一套规则:
 * 精确映射 → 剥后缀后按 base 映射 → configName → 美化兜底。
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  azure: 'Azure OpenAI',
  anthropic: 'Anthropic',
  claude: 'Claude',
  google: 'Google',
  gemini: 'Google Gemini',
  stepfun: '阶跃星辰 StepFun',
  deepseek: 'DeepSeek',
  qwen: '阿里通义千问',
  dashscope: '阿里通义千问',
  moonshot: '月之暗面 Moonshot',
  kimi: '月之暗面 Kimi',
  zhipu: '智谱 AI',
  glm: '智谱 GLM',
  minimax: 'MiniMax',
  baichuan: '百川智能',
  doubao: '字节豆包',
  hunyuan: '腾讯混元',
  yi: '零一万物',
  mistral: 'Mistral AI',
  meta: 'Meta Llama',
  llama: 'Meta Llama',
  xai: 'xAI Grok',
  grok: 'xAI Grok',
  ollama: 'Ollama(本地)',
  openrouter: 'OpenRouter',
  siliconflow: 'SiliconFlow',
  together: 'Together AI',
  fireworks: 'Fireworks AI',
  voyage: 'Voyage AI',
  cohere: 'Cohere',
  // 个人号池 / 反代平台(品牌名不译)
  workbuddy: 'WorkBuddy',
  trae: 'Trae',
  qoder: 'Qoder',
  codearts: 'CodeArts',
  codex: 'Codex',
  opencode: 'OpenCode',
  zcode: 'ZCode',
  loomy: 'Loomy',
  lingma: '通义灵码',
  grokbot: 'GrokBot',
  raccoon: 'Raccoon',
  cursor: 'Cursor',
  ihui: '智汇AI',
}

/** 内部接入后缀(大小写、下划线、连字符三种形态都要认)。 */
export const INTERNAL_RELAY_SUFFIX_RE = /[_-]relay$/i

/** 剥掉内部接入后缀;不是这一形态时原样返回。 */
export function stripInternalRelaySuffix(code: string): string {
  return code.replace(INTERNAL_RELAY_SUFFIX_RE, '')
}

/** 原始 code 美化:openai → Openai;永不把 `_relay` 后缀摆给用户。 */
export function prettifyProviderCode(code: string): string {
  return stripInternalRelaySuffix(code)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** 取某 provider 的对外展示名。configName 仅在无品牌映射时兜底。 */
export function resolveProviderDisplayName(
  providerCode: string,
  configName?: string | null,
): string {
  const mapped = PROVIDER_DISPLAY_NAMES[providerCode]
  if (mapped) return mapped
  const base = stripInternalRelaySuffix(providerCode)
  if (base !== providerCode) {
    const baseMapped = PROVIDER_DISPLAY_NAMES[base]
    if (baseMapped) return baseMapped
    const trimmed = configName?.trim()
    if (trimmed) return trimmed
    return prettifyProviderCode(base)
  }
  const trimmed = configName?.trim()
  if (trimmed) return trimmed
  return prettifyProviderCode(providerCode)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
