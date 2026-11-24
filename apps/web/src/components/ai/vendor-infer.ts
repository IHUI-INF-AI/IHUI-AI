// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * vendor-infer.ts - 厂商代码推断的**零依赖**真源(2026-09-30 立)
 *
 * 背景(AI 面板首屏延迟根治):
 *   inferVendor 原先与 BrandIcon 同居于 brand-icon.tsx,而后者静态 import 了
 *   ~95 个 @lobehub/icons/es/<Name> 深路径组件。AISidePanel 只用 inferVendor
 *   这个纯函数,却因同一模块被迫把 95 个图标组件拖进自己的 chunk —— 这是
 *   "面板要过一会才显示"的最大单点成因。
 *
 * 方案:把纯函数与厂商代码清单抽到本文件(零 import),brand-icon.tsx 改为
 *   re-export 兼容旧调用方;AISidePanel 从本文件导入 → 图标组件彻底移出面板主 chunk。
 *
 * 防漂移(关键):
 *   - VENDOR_CODES 是厂商代码的唯一真源;
 *   - brand-icon.tsx 的 VENDOR_COMPONENTS 用 satisfies Record<VendorCode, ...> 编译期锁死,
 *     新增/删除厂商必须同步改这里,否则 tsc 直接报错(不会静默漂移);
 *   - 守门 scripts/check-ai-panel-mount-guards.mjs R2 断言 inferVendor 不得改回从 brand-icon 导入。
 */

/** 全量厂商代码清单(唯一真源,与 brand-icon.tsx 的 VENDOR_COMPONENTS 键一一对应) */
export const VENDOR_CODES = [
  'openai',
  'anthropic',
  'google',
  'gemini',
  'deepseek',
  'meta',
  'mistral',
  'xai',
  'grok',
  'cohere',
  'nvidia',
  'nvidia_nim',
  'ai21',
  'microsoft',
  'perplexity',
  'groq',
  'together',
  'fireworks',
  'aws',
  'bedrock',
  'azure',
  'azureai',
  'openrouter',
  'huggingface',
  'replicate',
  'stability',
  'inflection',
  'ibm',
  'watsonx',
  'cerebras',
  'sambanova',
  'snowflake',
  'deepinfra',
  'alephalpha',
  'nous',
  'nousresearch',
  'github',
  'github_models',
  'githubcopilot',
  'vertexai',
  'vertex',
  'googlecloud',
  'gemma',
  'palm',
  'copilot',
  'bing',
  'novita',
  'lambda',
  'baseten',
  'crusoe',
  'targon',
  'centml',
  'nebius',
  'ollama',
  'upstage',
  'leptonai',
  'hyperbolic',
  'featherless',
  'parasail',
  'openwebui',
  'lmstudio',
  'friendli',
  'anyscale',
  'infermatic',
  'replit',
  'siliconcloud',
  'modelscope',
  'ppio',
  'volcengine',
  'bailian',
  'baai',
  'tii',
  'liquid',
  'ai2',
  'qwen',
  'zhipu',
  'moonshot',
  'doubao',
  'agnes',
  'stepfun',
  'minimax',
  'hunyuan',
  'baidu',
  'kimi',
  'baichuan',
  'spark',
  'wenxin',
  'ernie',
  'yi',
  '01ai',
  'zeroone',
  'sensenova',
  'tiangong',
  'skywork',
  'internlm',
  'bytedance',
  'coze',
  'tongyi',
  'qingyan',
  'chatglm',
  'alibaba',
  'alibaba_intl',
  'tencent',
  'huawei',
  'chrome',
  'figma',
  'remotion',
  'hyperframes',
  'vercel',
  'vercel_ai_gateway',
  'cloudflare',
  'cloudflare_workers_ai',
  'notion',
  'adobe',
  'brave',
  'alibaba-cloud',
  'huawei-cloud',
  'opencode_zen',
  'opencode',
  'qoder',
  'if',
  'modal',
  'inferencenet',
  'nlpcloud',
  'scaleway',
  'local',
  'ornith',
  'codebrain',
  'mai',
] as const

export type VendorCode = (typeof VENDOR_CODES)[number]

const VENDOR_CODE_SET: ReadonlySet<string> = new Set<string>(VENDOR_CODES)

/** 根据 model 字符串前缀推断厂商代码 */
export function inferVendor(model: string | undefined | null): string | undefined {
  if (!model) return undefined
  const m = model.toLowerCase()
  // 去掉 providerCode/ 前缀(如 'stepfun/step-3.7-flash' → 'step-3.7-flash')
  const bare = m.includes('/') ? m.split('/').slice(1).join('/') : m
  // === 国际原厂 ===
  if (
    bare.startsWith('gpt') ||
    bare.startsWith('o1') ||
    bare.startsWith('o3') ||
    bare.startsWith('o4') ||
    bare.startsWith('chatgpt')
  )
    return 'openai'
  if (bare.startsWith('claude')) return 'anthropic'
  if (bare.startsWith('gemini') || bare.startsWith('palm') || bare.startsWith('bard'))
    return 'google'
  if (bare.startsWith('deepseek')) return 'deepseek'
  if (bare.startsWith('llama') || bare.startsWith('meta-llama')) return 'meta'
  if (
    bare.startsWith('mistral') ||
    bare.startsWith('mixtral') ||
    bare.startsWith('codestral') ||
    bare.startsWith('pixtral') ||
    bare.startsWith('open-mistral') ||
    bare.startsWith('open-mixtral')
  )
    return 'mistral'
  if (bare.startsWith('grok')) return 'xai'
  if (
    bare.startsWith('command-r') ||
    bare.startsWith('command-a') ||
    bare.startsWith('command-light') ||
    bare.startsWith('command-nightly') ||
    bare.startsWith('cohere')
  )
    return 'cohere'
  if (bare.startsWith('nemotron') || bare.startsWith('llama-3.1-nemotron')) return 'nvidia'
  if (bare.startsWith('jamba') || bare.startsWith('j2-')) return 'ai21'
  if (bare.startsWith('phi-') || bare.startsWith('phi3') || bare.startsWith('phi4'))
    return 'microsoft'
  if (bare.startsWith('sonar') || bare.startsWith('pplx') || bare.startsWith('perplexity'))
    return 'perplexity'
  // === 国际云/平台/聚合(本次新增) ===
  if (bare.startsWith('amazon') || bare.startsWith('aws') || bare.startsWith('titan-')) return 'aws'
  if (
    bare.startsWith('bedrock') ||
    bare.startsWith('anthropic.claude') ||
    bare.startsWith('amazon.nova') ||
    bare.startsWith('meta.llama') ||
    bare.startsWith('ai21.jamba')
  )
    return 'bedrock'
  if (
    bare.startsWith('azure') ||
    bare.startsWith('azure-openai') ||
    bare.startsWith('gpt-4o-azure') ||
    bare.startsWith('azure-gpt')
  )
    return 'azure'
  if (bare.startsWith('openrouter/') || bare.startsWith('openrouter')) return 'openrouter'
  if (bare.startsWith('huggingface/') || bare.startsWith('hf/') || bare.startsWith('huggingface'))
    return 'huggingface'
  if (bare.startsWith('replicate/') || bare.startsWith('replicate')) return 'replicate'
  if (
    bare.startsWith('stable-') ||
    bare.startsWith('stability') ||
    bare.startsWith('sdxl') ||
    bare.startsWith('sd3') ||
    bare.startsWith('stable-diffusion')
  )
    return 'stability'
  if (bare.startsWith('pi-') || bare.startsWith('inflection')) return 'inflection'
  if (
    bare.startsWith('watsonx') ||
    bare.startsWith('ibm/') ||
    bare.startsWith('ibm-') ||
    bare.startsWith('granite')
  )
    return 'ibm'
  if (bare.startsWith('cerebras') || bare.startsWith('cerebras-llama')) return 'cerebras'
  if (bare.startsWith('sambanova') || bare.startsWith('samba-')) return 'sambanova'
  if (bare.startsWith('snowflake') || bare.startsWith('arctic')) return 'snowflake'
  if (bare.startsWith('deepinfra/') || bare.startsWith('deepinfra')) return 'deepinfra'
  if (
    bare.startsWith('aleph-alpha') ||
    bare.startsWith('alephalpha') ||
    bare.startsWith('luminous')
  )
    return 'alephalpha'
  if (bare.startsWith('nous-') || bare.startsWith('nous/') || bare.startsWith('hermes'))
    return 'nous'
  if (bare.startsWith('vertex/') || bare.startsWith('vertex-ai')) return 'vertexai'
  if (bare.startsWith('gemma')) return 'gemma'
  if (bare.startsWith('palm') || bare.startsWith('bard')) return 'palm'
  if (bare.startsWith('copilot') || bare.startsWith('microsoft-copilot')) return 'copilot'
  if (bare.startsWith('bing') || bare.startsWith('bing-chat')) return 'bing'
  // === 国际推理/云平台扩展 ===
  if (bare.startsWith('novita/') || bare.startsWith('novita')) return 'novita'
  if (bare.startsWith('lambda/') || bare.startsWith('lambda-')) return 'lambda'
  if (bare.startsWith('baseten/') || bare.startsWith('baseten')) return 'baseten'
  if (bare.startsWith('crusoe/') || bare.startsWith('crusoe-')) return 'crusoe'
  if (bare.startsWith('targon/') || bare.startsWith('targon-')) return 'targon'
  if (bare.startsWith('centml/') || bare.startsWith('centml-')) return 'centml'
  if (bare.startsWith('nebius/') || bare.startsWith('nebius-')) return 'nebius'
  if (
    bare.startsWith('ollama/') ||
    bare.startsWith('ollama-') ||
    bare.startsWith('llama3.1:') ||
    bare.startsWith('llama3:')
  )
    return 'ollama'
  if (bare.startsWith('upstage/') || bare.startsWith('solar-')) return 'upstage'
  if (bare.startsWith('leptonai/') || bare.startsWith('lepton-')) return 'leptonai'
  if (bare.startsWith('hyperbolic/') || bare.startsWith('hyperbolic-')) return 'hyperbolic'
  if (bare.startsWith('featherless/') || bare.startsWith('featherless-')) return 'featherless'
  if (bare.startsWith('parasail/') || bare.startsWith('parasail-')) return 'parasail'
  if (bare.startsWith('openwebui/') || bare.startsWith('open-webui-')) return 'openwebui'
  if (bare.startsWith('lmstudio/') || bare.startsWith('lm-studio-')) return 'lmstudio'
  if (bare.startsWith('friendli/') || bare.startsWith('friendli-')) return 'friendli'
  if (bare.startsWith('anyscale/') || bare.startsWith('anyscale-')) return 'anyscale'
  if (bare.startsWith('infermatic/') || bare.startsWith('infermatic-')) return 'infermatic'
  if (bare.startsWith('replit/') || bare.startsWith('replit-') || bare.startsWith('replit-code-'))
    return 'replit'
  // === 国内推理/云平台扩展 ===
  if (
    bare.startsWith('siliconcloud/') ||
    bare.startsWith('siliconflow/') ||
    bare.startsWith('siliconcloud-')
  )
    return 'siliconcloud'
  if (
    bare.startsWith('modelscope/') ||
    bare.startsWith('modelscope-') ||
    bare.startsWith('dashscope/')
  )
    return 'modelscope'
  if (bare.startsWith('ppio/') || bare.startsWith('ppio-')) return 'ppio'
  if (bare.startsWith('volcengine/') || bare.startsWith('volc-') || bare.startsWith('ark/'))
    return 'volcengine'
  if (
    bare.startsWith('bailian/') ||
    bare.startsWith('bailian-') ||
    bare.startsWith('dashscope/bailian')
  )
    return 'bailian'
  if (bare.startsWith('baai/') || bare.startsWith('flag-') || bare.startsWith('aquila-'))
    return 'baai'
  if (
    bare.startsWith('tii/') ||
    bare.startsWith('falcon-') ||
    bare.startsWith('falcon2-') ||
    bare.startsWith('falcon3-')
  )
    return 'tii'
  if (bare.startsWith('liquid/') || bare.startsWith('lfm-') || bare.startsWith('liquid-'))
    return 'liquid'
  if (
    bare.startsWith('ai2/') ||
    bare.startsWith('olmo-') ||
    bare.startsWith('tulu-') ||
    bare.startsWith('molmo-')
  )
    return 'ai2'
  // === 国内厂商 ===
  if (bare.startsWith('qwen') || bare.startsWith('wan') || bare.startsWith('tongyi')) return 'qwen'
  if (bare.startsWith('glm') || bare.startsWith('chatglm')) return 'zhipu'
  if (bare.startsWith('moonshot') || bare.startsWith('kimi')) return 'moonshot'
  if (bare.startsWith('doubao')) return 'doubao'
  if (bare.startsWith('agnes')) return 'agnes'
  if (bare.startsWith('step') || bare.startsWith('stepfun')) return 'stepfun'
  if (bare.startsWith('minimax') || bare.startsWith('abab') || bare.startsWith('hailuo'))
    return 'minimax'
  if (bare.startsWith('hunyuan')) return 'hunyuan'
  if (bare.startsWith('ernie') || bare.startsWith('wenxin')) return 'wenxin'
  if (bare.startsWith('baichuan')) return 'baichuan'
  if (bare.startsWith('spark')) return 'spark'
  if (bare.startsWith('yi-') || bare.startsWith('yi01')) return 'yi'
  if (bare.startsWith('sensenova')) return 'sensenova'
  if (bare.startsWith('skywork')) return 'skywork'
  if (bare.startsWith('internlm')) return 'internlm'
  // === 2026-07 国内新势力(无 lobehub 官方图标,fallback 项目 logo) ===
  if (bare.startsWith('ornith')) return 'ornith'
  if (bare.startsWith('codebrain')) return 'codebrain'
  if (bare.startsWith('mai')) return 'mai'
  // === 反查 providerCode 前缀(如 'openai/gpt-4o' → 'openai') ===
  if (m.includes('/')) {
    const providerCode = m.split('/')[0]
    if (providerCode && VENDOR_CODE_SET.has(providerCode)) return providerCode
  }
  return undefined
}

/** 判断某厂商代码是否在册(供调试/测试使用) */
export function isKnownVendor(code: string | undefined | null): boolean {
  if (!code) return false
  return VENDOR_CODE_SET.has(code)
}
