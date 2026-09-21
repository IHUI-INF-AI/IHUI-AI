// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import Image from 'next/image'
// 2026-09-12 路由提速改造(深路径导入):
// 原写法 `import { ... } from '@lobehub/icons'` 会命中包的 barrel 入口
// (es/index.js → es/icons.js,~300 条 re-export),被迫解析/编译 es/ 下 2231 个 js 模块,
// 是每个路由冷编译(dev 下 ~3s)与缓存膨胀(~150MB/路由)的主要放大器之一。
// 改为深路径 default 导入(es/<Name>/index.js 为 `export default Icons`,包无 exports 字段
// 不阻断深路径),编译期只解析实际用到的 102 个厂商目录。
import OpenAI from '@lobehub/icons/es/OpenAI'
import Anthropic from '@lobehub/icons/es/Anthropic'
import Google from '@lobehub/icons/es/Google'
import DeepSeek from '@lobehub/icons/es/DeepSeek'
import Qwen from '@lobehub/icons/es/Qwen'
import Zhipu from '@lobehub/icons/es/Zhipu'
import Moonshot from '@lobehub/icons/es/Moonshot'
import Doubao from '@lobehub/icons/es/Doubao'
import Stepfun from '@lobehub/icons/es/Stepfun'
import Meta from '@lobehub/icons/es/Meta'
import Minimax from '@lobehub/icons/es/Minimax'
import Hunyuan from '@lobehub/icons/es/Hunyuan'
import Baidu from '@lobehub/icons/es/Baidu'
import Kimi from '@lobehub/icons/es/Kimi'
import Baichuan from '@lobehub/icons/es/Baichuan'
import Spark from '@lobehub/icons/es/Spark'
import Wenxin from '@lobehub/icons/es/Wenxin'
import Yi from '@lobehub/icons/es/Yi'
import ZeroOne from '@lobehub/icons/es/ZeroOne'
import SenseNova from '@lobehub/icons/es/SenseNova'
import Tiangong from '@lobehub/icons/es/Tiangong'
import InternLM from '@lobehub/icons/es/InternLM'
import ByteDance from '@lobehub/icons/es/ByteDance'
import Coze from '@lobehub/icons/es/Coze'
import Qingyan from '@lobehub/icons/es/Qingyan'
import ChatGLM from '@lobehub/icons/es/ChatGLM'
import AgnesAI from '@lobehub/icons/es/AgnesAI' // 2026-08-02 新增:Agnes 安格(国内厂商)
import Alibaba from '@lobehub/icons/es/Alibaba'
import Tencent from '@lobehub/icons/es/Tencent'
import Huawei from '@lobehub/icons/es/Huawei'
// 国际原厂
import Mistral from '@lobehub/icons/es/Mistral'
import XAI from '@lobehub/icons/es/XAI'
import Cohere from '@lobehub/icons/es/Cohere'
import Nvidia from '@lobehub/icons/es/Nvidia'
import Ai21 from '@lobehub/icons/es/Ai21'
import Microsoft from '@lobehub/icons/es/Microsoft'
import Perplexity from '@lobehub/icons/es/Perplexity'
// 国际推理平台
import Groq from '@lobehub/icons/es/Groq'
import Together from '@lobehub/icons/es/Together'
import Fireworks from '@lobehub/icons/es/Fireworks'
// 国际云/平台/聚合(本次新增)
import Aws from '@lobehub/icons/es/Aws'
import Bedrock from '@lobehub/icons/es/Bedrock'
import Azure from '@lobehub/icons/es/Azure'
import AzureAI from '@lobehub/icons/es/AzureAI'
import OpenRouter from '@lobehub/icons/es/OpenRouter'
import HuggingFace from '@lobehub/icons/es/HuggingFace'
import Replicate from '@lobehub/icons/es/Replicate'
import Stability from '@lobehub/icons/es/Stability'
import Inflection from '@lobehub/icons/es/Inflection'
import IBM from '@lobehub/icons/es/IBM'
import Cerebras from '@lobehub/icons/es/Cerebras'
import SambaNova from '@lobehub/icons/es/SambaNova'
import Snowflake from '@lobehub/icons/es/Snowflake'
import DeepInfra from '@lobehub/icons/es/DeepInfra'
import AlephAlpha from '@lobehub/icons/es/AlephAlpha'
import NousResearch from '@lobehub/icons/es/NousResearch'
import Github from '@lobehub/icons/es/Github'
import GithubCopilot from '@lobehub/icons/es/GithubCopilot'
import VertexAI from '@lobehub/icons/es/VertexAI'
import GoogleCloud from '@lobehub/icons/es/GoogleCloud'
import Gemma from '@lobehub/icons/es/Gemma'
import PaLM from '@lobehub/icons/es/PaLM'
import Copilot from '@lobehub/icons/es/Copilot'
import Bing from '@lobehub/icons/es/Bing'
// 国际推理/云平台扩展(本次新增)
import Novita from '@lobehub/icons/es/Novita'
import Lambda from '@lobehub/icons/es/Lambda'
import Baseten from '@lobehub/icons/es/Baseten'
import Crusoe from '@lobehub/icons/es/Crusoe'
import Targon from '@lobehub/icons/es/Targon'
import CentML from '@lobehub/icons/es/CentML'
import Nebius from '@lobehub/icons/es/Nebius'
import Ollama from '@lobehub/icons/es/Ollama'
import Upstage from '@lobehub/icons/es/Upstage'
import LeptonAI from '@lobehub/icons/es/LeptonAI'
import Hyperbolic from '@lobehub/icons/es/Hyperbolic'
import Featherless from '@lobehub/icons/es/Featherless'
import Parasail from '@lobehub/icons/es/Parasail'
import OpenWebUI from '@lobehub/icons/es/OpenWebUI'
import LmStudio from '@lobehub/icons/es/LmStudio'
import Friendli from '@lobehub/icons/es/Friendli'
import Anyscale from '@lobehub/icons/es/Anyscale'
import Infermatic from '@lobehub/icons/es/Infermatic'
import Replit from '@lobehub/icons/es/Replit'
// 国内推理/云平台扩展
import SiliconCloud from '@lobehub/icons/es/SiliconCloud'
import ModelScope from '@lobehub/icons/es/ModelScope'
import PPIO from '@lobehub/icons/es/PPIO'
import Volcengine from '@lobehub/icons/es/Volcengine'
import Bailian from '@lobehub/icons/es/Bailian'
import BAAI from '@lobehub/icons/es/BAAI'
import TII from '@lobehub/icons/es/TII'
import Liquid from '@lobehub/icons/es/Liquid'
import Ai2 from '@lobehub/icons/es/Ai2'
import Figma from '@lobehub/icons/es/Figma'
// 2026-07-31 补全:plugins-data.ts 中已有 vendor 但此前未映射的 7 个真实矢量
import Vercel from '@lobehub/icons/es/Vercel'
import Cloudflare from '@lobehub/icons/es/Cloudflare'
import Notion from '@lobehub/icons/es/Notion'
import Adobe from '@lobehub/icons/es/Adobe'
import Brave from '@lobehub/icons/es/Brave'
import AlibabaCloud from '@lobehub/icons/es/AlibabaCloud'
import HuaweiCloud from '@lobehub/icons/es/HuaweiCloud'
// 2026-08-02 补全:ModelsNav PROVIDER_GROUPS 缺失映射的 provider
import OpenCode from '@lobehub/icons/es/OpenCode' // opencode_zen(OpenCode Zen 开源推理框架)
import Qoder from '@lobehub/icons/es/Qoder' // qoder/if(Qoder AI 代码平台)

import { AppWindow, Video, Server, Cpu, Globe, Boxes, type LucideIcon } from 'lucide-react'

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
 *              Aleph Alpha / NousResearch / GitHub / Github Copilot / Vertex AI
 *              Google Cloud / Gemma / PaLM / Microsoft Copilot / Bing / Figma
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
 *   - 2026-07-31 兜底:Chrome / Remotion / Hyperframes(lobehub 无收录,lucide 同色兜底)
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
  gemini: Google, // 2026-08-02 alias:Google AI Studio Gemini(provider_code=gemini)
  deepseek: DeepSeek,
  meta: Meta,
  mistral: Mistral,
  xai: XAI,
  grok: XAI, // Grok 是 xAI 公司产品
  cohere: Cohere,
  nvidia: Nvidia,
  nvidia_nim: Nvidia, // 2026-08-02 alias:后端 provider_code 用 nvidia_nim
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
  github: Github,
  github_models: Github, // 2026-08-02 alias:后端 provider_code 用 github_models
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
  agnes: AgnesAI, // Agnes 安格
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
  alibaba_intl: Alibaba, // 2026-08-02 alias:后端 provider_code 用 alibaba_intl(阿里云国际版)
  tencent: Tencent,
  huawei: Huawei,
  // 2026-07-31 Codex 10 插件补全:Chrome / Figma(已收录) / Remotion / Hyperframes
  chrome: AppWindow, // lucide 兜底(@lobehub 无 Chrome 真实矢量;v1 品牌图标移除,Chrome→AppWindow 语义化替代)
  figma: Figma, // @lobehub/icons 真实 Figma 矢量
  remotion: Video, // lucide 兜底(@lobehub 无 Remotion 真实矢量,与 video 共享)
  hyperframes: Video, // lucide 兜底(@lobehub 无 Hyperframes 真实矢量,与 video 共享)
  // 2026-07-31 补全 7 个真实矢量:@lobehub/icons 5.14 已收录,此前遗漏映射
  vercel: Vercel,
  vercel_ai_gateway: Vercel, // 2026-08-02 alias:后端 provider_code 用 vercel_ai_gateway
  cloudflare: Cloudflare,
  cloudflare_workers_ai: Cloudflare, // 2026-08-02 alias:后端 provider_code 用 cloudflare_workers_ai
  notion: Notion,
  adobe: Adobe,
  brave: Brave,
  'alibaba-cloud': AlibabaCloud,
  'huawei-cloud': HuaweiCloud,
  // 2026-08-02 补全:ModelsNav PROVIDER_GROUPS 缺失映射的 provider
  opencode_zen: OpenCode, // OpenCode Zen(lobehub 真实矢量)
  opencode: OpenCode, // alias
  qoder: Qoder, // Qoder AI(lobehub 真实矢量)
  if: Qoder, // alias:后端 provider_code 用 if(qoder 内部代号)
  // 无 lobehub 真实矢量的 provider:lucide 语义化兜底(非 logo.png)
  // 语义:Server=云服务 / Cpu=本地算力 / Globe=网络服务 / Boxes=聚合平台
  modal: Server, // Modal(云函数推理平台)
  inferencenet: Server, // InferenceNet(推理网络)
  nlpcloud: Globe, // NLP Cloud(NLP API 服务)
  scaleway: Server, // Scaleway(欧洲云服务商)
  local: Cpu, // 本地 LLM 泛指(非特定厂商)
  ornith: Boxes, // Ornith(国内新势力,无公开 logo,用 Boxes 兜底)
  codebrain: Boxes, // CodeBrain(国内新势力,无公开 logo)
  mai: Boxes, // Mai(国内新势力,无公开 logo)
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
  /**
   * lucide-react 兜底图标(2026-07-31 新增,根因修复):
   * vendor 在 VENDOR_COMPONENTS 中无映射时,优先使用此图标而非 logo.png。
   * 解决 PluginMarketplace 之前 vendor 找不到就显示 logo.png(蝴蝶结)、
   * 完全忽略 plugin.fallbackIcon 字段的 bug。
   */
  fallbackIcon?: LucideIcon
}

export function BrandIcon({
  vendor,
  iconSvg: _iconSvg,
  iconUrl: _iconUrl,
  size = 16,
  className,
  fallbackIcon: FallbackIcon,
}: BrandIconProps) {
  const VendorIcon = vendor ? VENDOR_COMPONENTS[vendor.toLowerCase()] : undefined

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

  // vendor 无映射但有 lucide fallbackIcon(2026-07-31 修复):优先用业务图标,避免乱码 logo
  if (FallbackIcon) {
    return (
      <span
        className={cn('inline-flex shrink-0 items-center justify-center', className)}
        style={{ width: size, height: size, color: 'currentColor' }}
        aria-hidden="true"
      >
        <FallbackIcon size={size} />
      </span>
    )
  }

  // 终极兜底:项目纯图标 logo.png(蝴蝶结 + IHUI INF 弧形,无右侧"智汇AI社区"横向文字)
  // 仅在 vendor 无映射 + 无 fallbackIcon 时使用(无 vendor 字段的旧调用方)
  return (
    <Image
      src="/images/logo.png?v=20260719-unify"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      className={cn('inline-flex shrink-0 object-contain', className)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
