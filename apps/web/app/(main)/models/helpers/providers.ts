// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ProviderGroup, Provider } from '../types'

export const PROVIDER_GROUP_LABEL: Record<ProviderGroup, string> = {
  international: '国际原厂',
  domestic: '国内厂商',
  inference: '推理加速',
  cloud: '云平台',
  aggregator: '聚合平台',
  local: '本地',
}

export const PROVIDER_GROUPS: { key: ProviderGroup; providers: Provider[] }[] = [
  {
    key: 'international',
    providers: [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'meta',
      'mistral',
      'xai',
      'cohere',
      'nvidia',
      'ai21',
      'microsoft',
      'perplexity',
    ],
  },
  {
    key: 'domestic',
    providers: [
      'qwen',
      'zhipu',
      'moonshot',
      'doubao',
      'stepfun',
      'hunyuan',
      'wenxin',
      'minimax',
      'baichuan',
      'spark',
      'yi',
      'sensenova',
      'skywork',
      'internlm',
      // 2026-07 新增国内新势力厂商
      'ornith',
      'codebrain',
      'mai',
    ],
  },
  {
    key: 'inference',
    providers: [
      'groq',
      'together',
      'fireworks',
      'novita',
      'lambda',
      'baseten',
      'crusoe',
      'targon',
      'centml',
      'nebius',
      'upstage',
      'leptonai',
      'hyperbolic',
      'featherless',
      'parasail',
      'friendli',
      'anyscale',
      'infermatic',
      'replit',
    ],
  },
  {
    key: 'cloud',
    providers: [
      'aws',
      'bedrock',
      'azure',
      'vertexai',
      'huggingface',
      'replicate',
      'stability',
      'inflection',
      'ibm',
      'cerebras',
      'sambanova',
      'snowflake',
      'deepinfra',
      'alephalpha',
      'nous',
      'gemma',
      'copilot',
      'bing',
      'siliconcloud',
      'modelscope',
      'ppio',
      'volcengine',
      'bailian',
      'baai',
      'tii',
      'liquid',
      'ai2',
      // 2026-07-22 新增免费 / 试用 credits provider
      'cloudflare_workers_ai',
      'nvidia_nim',
      'github_models',
      'vercel_ai_gateway',
      'opencode_zen',
      'modal',
      'inferencenet',
      'nlpcloud',
      'scaleway',
      'alibaba_intl',
    ],
  },
  {
    key: 'aggregator',
    providers: ['openrouter'],
  },
  {
    key: 'local',
    providers: ['ollama', 'openwebui', 'lmstudio', 'local'],
  },
]

export const PROVIDERS: Provider[] = PROVIDER_GROUPS.flatMap((g) => g.providers)

export const SORT_KEY: Record<string, string> = {
  recommended: 'sort.recommended',
  priceAsc: 'sort.priceAsc',
  priceDesc: 'sort.priceDesc',
  contextDesc: 'sort.contextDesc',
  nameAsc: 'sort.nameAsc',
}

export const QUICK_FILTER_KEY: Record<string, string> = {
  favorite: 'quickFilters.favorite',
  configured: 'quickFilters.configured',
  notConfigured: 'quickFilters.notConfigured',
  free: 'quickFilters.free',
  longContext: 'quickFilters.longContext',
  reasoning: 'quickFilters.reasoning',
  vision: 'quickFilters.vision',
  coding: 'quickFilters.coding',
  chinese: 'quickFilters.chinese',
  openSource: 'quickFilters.openSource',
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
