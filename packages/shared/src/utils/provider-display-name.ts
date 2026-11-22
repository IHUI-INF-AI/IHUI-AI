// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 厂商/平台 code → 用户可读展示名的跨端唯一出口(移动端 / 小程序 / 其它非 Next 宿主)。
 *
 * 背景:AI 服务对 WorkBuddy 号池下发 `workbuddy_relay`(经中转桥接入,供可用性/能力判定),
 * 直接当标签会把这串内部实现暴露给用户。Web 侧另有零依赖副本(RSC 安全),两端语义必须一致:
 * 精确映射 → 剥内部后缀 → 美化兜底,绝不原样返回内部 code。
 *
 * 纯函数、零依赖:可进任何端(含小程序编译面)。
 */
const PROVIDER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  workbuddy: 'WorkBuddy',
  ihui_relay: 'IHUI Relay',
  stepfun: 'StepFun 阶跃星辰',
  cloudflare_workers_ai: 'Cloudflare Workers AI',
  agnes: 'Agnes',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  nvidia_nim: 'NVIDIA NIM',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  meta: 'Meta',
  mistral: 'Mistral',
  xai: 'xAI',
  cohere: 'Cohere',
  nvidia: 'NVIDIA',
  ai21: 'AI21',
  microsoft: 'Microsoft',
  perplexity: 'Perplexity',
  qwen: '通义千问',
  qwen_local: '通义千问 Local',
  zhipu: '智谱',
  moonshot: '月之暗面 Moonshot',
  doubao: '豆包',
  hunyuan: '腾讯混元',
  wenxin: '文心一言',
  minimax: 'MiniMax',
  baichuan: '百川',
  spark: '讯飞星火',
  yi: '零一万物',
  sensenova: '商汤日日新',
  skywork: '天工',
  internlm: '书生',
  zai: 'Z.ai 智谱国际',
  minimaxintl: 'MiniMax 国际',
  dashscopeintl: '通义国际',
  byteplus: 'BytePlus',
  pangu: '华为盘古',
  infini: '无问芯穹',
  pollinations: 'Pollinations',
}

/** 内部接入后缀:平台经中转桥接入时由后端追加(如 workbuddy_relay / foo-relay)。 */
const INTERNAL_RELAY_SUFFIX_RE = /[_-]relay$/i

/** `workbuddy_relay` → `workbuddy`(大小写 / 横线 / 下划线都认),幂等。 */
export function stripInternalRelaySuffix(code: string): string {
  return code.trim().replace(INTERNAL_RELAY_SUFFIX_RE, '')
}

/** 未登记 code 的兜底美化:`foo_bar` → `Foo Bar`,不保留内部接入后缀。 */
export function prettifyProviderCode(code: string): string {
  return stripInternalRelaySuffix(code)
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/** 对外展示名:精确映射 → 剥后缀后再映射 → 美化兜底。永不返回带 `relay` 后缀的原串。 */
export function providerDisplayName(code: string | null | undefined): string {
  if (!code) return ''
  const raw = code.trim()
  if (!raw) return ''
  const exact = PROVIDER_DISPLAY_NAMES[raw.toLowerCase()]
  if (exact) return exact
  const base = stripInternalRelaySuffix(raw).toLowerCase()
  const mapped = PROVIDER_DISPLAY_NAMES[base]
  if (mapped) return mapped
  return prettifyProviderCode(base)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
