'use client'

import * as React from 'react'
import {
  OpenAI,
  Anthropic,
  Google,
  DeepSeek,
  Qwen,
  Zhipu,
  Moonshot,
  Doubao,
  Stepfun,
  Meta,
  Minimax,
  Hunyuan,
  Baidu,
  Kimi,
  Baichuan,
  Spark,
  Wenxin,
  Yi,
  ZeroOne,
  SenseNova,
  Tiangong,
  InternLM,
  ByteDance,
  Coze,
  Qingyan,
  ChatGLM,
  Alibaba,
  Tencent,
  Huawei,
  // 国际原厂
  Mistral,
  XAI,
  Cohere,
  Nvidia,
  Ai21,
  Microsoft,
  Perplexity,
  // 国际推理平台
  Groq,
  Together,
  Fireworks,
  // 国际云/平台/聚合(本次新增)
  Aws,
  Bedrock,
  Azure,
  AzureAI,
  OpenRouter,
  HuggingFace,
  Replicate,
  Stability,
  Inflection,
  IBM,
  Cerebras,
  SambaNova,
  Snowflake,
  DeepInfra,
  AlephAlpha,
  NousResearch,
  GithubCopilot,
  VertexAI,
  GoogleCloud,
  Gemma,
  PaLM,
  Copilot,
  Bing,
  // 国际推理/云平台扩展(本次新增)
  Novita,
  Lambda,
  Baseten,
  Crusoe,
  Targon,
  CentML,
  Nebius,
  Ollama,
  Upstage,
  LeptonAI,
  Hyperbolic,
  Featherless,
  Parasail,
  OpenWebUI,
  LmStudio,
  Friendli,
  Anyscale,
  Infermatic,
  Replit,
  // 国内推理/云平台扩展
  SiliconCloud,
  ModelScope,
  PPIO,
  Volcengine,
  Bailian,
  BAAI,
  TII,
  Liquid,
  Ai2,
} from '@lobehub/icons'

import { cn } from '@/lib/utils'

/**
 * BrandIcon — 厂商图标组件,基于 @lobehub/icons(1575+ AI/LLM 厂商真实矢量图标)
 *
 * 图标来源:https://www.npmjs.com/package/@lobehub/icons
 * 所有图标均为厂商官方真实矢量 SVG(单色 Mono 版本,通过 currentColor 着色)
 *
 * 支持厂商(共 80+ 个):
 *   - 国际原厂:OpenAI / Anthropic / Google / DeepSeek / Meta / Mistral / xAI Grok
 *              Cohere / Nvidia / AI21 / Microsoft / Perplexity
 *   - 国际推理平台:Groq / Together / Fireworks
 *   - 国际云/平台/聚合:AWS / AWS Bedrock / Azure / Azure AI / OpenRouter
 *              HuggingFace / Replicate / Stability AI / Inflection AI (Pi)
 *              IBM Watsonx / Cerebras / SambaNova / Snowflake / DeepInfra
 *              Aleph Alpha / NousResearch / Github Copilot / Vertex AI
 *              Google Cloud / Gemma / PaLM / Microsoft Copilot / Bing
 *   - 国际推理/云平台扩展:Novita / Lambda / Baseten / Crusoe / Targon
 *              CentML / Nebius / Ollama / Upstage / LeptonAI
 *              Hyperbolic / Featherless / Parasail / OpenWebUI / LmStudio
 *              Friendli / Anyscale / Infermatic / Replit
 *   - 国内推理/云平台扩展:SiliconCloud / ModelScope / PPIO / Volcengine
 *              Bailian / BAAI / TII / Liquid / Ai2
 *   - 国内原厂:Qwen 通义千问 / Zhipu 智谱 / Moonshot 月之暗面 / Doubao 豆包
 *              Stepfun 阶跃星辰 / Minimax / Hunyuan 腾讯混元 / Baidu 百度
 *              Baichuan 百川 / Spark 讯飞星火 / Wenxin 文心一言 / Yi 零一万物
 *              SenseNova 商汤 / Tiangong 天工 / InternLM 书生
 *   - 集团:ByteDance / Coze / Alibaba / Tencent / Huawei / Tongyi / Qingyan / ChatGLM / Kimi
 */

/** 厂商代码 → @lobehub/icons 组件映射 */
const VENDOR_COMPONENTS: Record<
  string,
  React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>
> = {
  // 国际原厂
  openai: OpenAI,
  anthropic: Anthropic,
  google: Google,
  deepseek: DeepSeek,
  meta: Meta,
  mistral: Mistral,
  xai: XAI,
  grok: XAI, // Grok 是 xAI 公司产品
  cohere: Cohere,
  nvidia: Nvidia,
  ai21: Ai21,
  microsoft: Microsoft,
  perplexity: Perplexity,
  // 国际推理平台
  groq: Groq,
  together: Together,
  fireworks: Fireworks,
  // 国际云/平台/聚合(本次新增)
  aws: Aws,
  bedrock: Bedrock,
  azure: Azure,
  azureai: AzureAI,
  openrouter: OpenRouter,
  huggingface: HuggingFace,
  replicate: Replicate,
  stability: Stability,
  inflection: Inflection,
  ibm: IBM,
  watsonx: IBM,
  cerebras: Cerebras,
  sambanova: SambaNova,
  snowflake: Snowflake,
  deepinfra: DeepInfra,
  alephalpha: AlephAlpha,
  nous: NousResearch,
  nousresearch: NousResearch,
  github: GithubCopilot,
  githubcopilot: GithubCopilot,
  vertexai: VertexAI,
  vertex: VertexAI,
  googlecloud: GoogleCloud,
  gemma: Gemma,
  palm: PaLM,
  copilot: Copilot,
  bing: Bing,
  // 国际推理/云平台扩展(本次新增)
  novita: Novita,
  lambda: Lambda,
  baseten: Baseten,
  crusoe: Crusoe,
  targon: Targon,
  centml: CentML,
  nebius: Nebius,
  ollama: Ollama,
  upstage: Upstage,
  leptonai: LeptonAI,
  hyperbolic: Hyperbolic,
  featherless: Featherless,
  parasail: Parasail,
  openwebui: OpenWebUI,
  lmstudio: LmStudio,
  friendli: Friendli,
  anyscale: Anyscale,
  infermatic: Infermatic,
  replit: Replit,
  // 国内推理/云平台扩展
  siliconcloud: SiliconCloud,
  modelscope: ModelScope,
  ppio: PPIO,
  volcengine: Volcengine,
  bailian: Bailian,
  baai: BAAI,
  tii: TII,
  liquid: Liquid,
  ai2: Ai2,
  // 国内原厂
  qwen: Qwen,
  zhipu: Zhipu,
  moonshot: Moonshot,
  doubao: Doubao,
  stepfun: Stepfun,
  minimax: Minimax,
  hunyuan: Hunyuan,
  baidu: Baidu,
  kimi: Kimi,
  baichuan: Baichuan,
  spark: Spark,
  wenxin: Wenxin,
  ernie: Wenxin, // 文心一言
  yi: Yi,
  '01ai': ZeroOne,
  zeroone: ZeroOne,
  sensenova: SenseNova,
  tiangong: Tiangong,
  skywork: Tiangong, // 天工 Skywork
  internlm: InternLM,
  // 集团
  bytedance: ByteDance,
  coze: Coze,
  tongyi: Qwen, // 通义 = Qwen 同厂商
  qingyan: Qingyan,
  chatglm: ChatGLM,
  alibaba: Alibaba,
  tencent: Tencent,
  huawei: Huawei,
}

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
  // === 反查 providerCode 前缀(如 'openai/gpt-4o' → 'openai') ===
  if (m.includes('/')) {
    const providerCode = m.split('/')[0]
    if (providerCode && VENDOR_COMPONENTS[providerCode]) return providerCode
  }
  return undefined
}

export interface BrandIconProps {
  /** 厂商代码(如 'openai'、'deepseek') */
  vendor?: string | null
  /** 内嵌 SVG 字符串(保留接口兼容,实际不再使用) */
  iconSvg?: string | null
  /** 图标 URL(保留接口兼容,实际不再使用) */
  iconUrl?: string | null
  /** 像素尺寸,默认 16 */
  size?: number
  className?: string
}

export function BrandIcon({
  vendor,
  iconSvg: _iconSvg,
  iconUrl: _iconUrl,
  size = 16,
  className,
}: BrandIconProps) {
  const VendorIcon = vendor ? VENDOR_COMPONENTS[vendor.toLowerCase()] : undefined
  const fallbackLetter = vendor ? vendor.charAt(0).toUpperCase() : '?'

  if (VendorIcon) {
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size, color: 'currentColor' }}
        aria-hidden="true"
      >
        <VendorIcon size={size} style={{ display: 'flex' }} />
      </span>
    )
  }

  // 兜底:首字母徽章
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground font-medium',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(8, size * 0.55) }}
      aria-hidden="true"
    >
      {fallbackLetter}
    </span>
  )
}
