// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * BrandIcon(web 平台实现,RNW 渲染 @lobehub/icons 真实厂商矢量)
 *
 * 镜像 apps/web/src/components/ai/brand-icon.tsx:
 * - 深路径 default 导入 @lobehub/icons/es/<Name>(规避 barrel 入口冷编译/缓存膨胀);
 * - VENDOR_COMPONENTS satisfies Record<VendorCode, ...> 键集合由 vendor-infer.ts
 *   的 VENDOR_CODES 编译期锁死,新增/删除厂商必须同步 vendor-infer.ts,否则 tsc 报错;
 * - 无映射厂商兜底:厂商首字母文本(与 native base 同语义,避免 logo.png 蝴蝶结)。
 *
 * 注:本文件仅 RNW 走(lobehub 组件是 react-dom SVG,native 崩溃);native 回落
 * brand-icon.tsx 的字母兜底。两端对调用方暴露相同 { vendor, size, color } 签名。
 */
import { Text, View, type ViewStyle } from 'react-native'

import { tokens } from '../theme/active-tokens'
import type { VendorCode } from '../lib/vendor-infer'

/** web 变体的入参档。`./brand-icon` 那份实现与本机这份同形,但它在被审面上还不存在,
 *  从那里具名导入会让干净检出与 CI 在编译期才炸(守门 D 拦的就是这一型)。 */
export interface BrandIconProps {
  /** 厂商代码(如 'openai'、'deepseek') */
  vendor?: string | null
  /** 像素尺寸,默认 16 */
  size?: number
  /** 图标颜色 */
  color?: string
}

// === 国际原厂 ===
import OpenAI from '@lobehub/icons/es/OpenAI/components/Mono'
import Anthropic from '@lobehub/icons/es/Anthropic/components/Mono'
import Google from '@lobehub/icons/es/Google/components/Mono'
import DeepSeek from '@lobehub/icons/es/DeepSeek/components/Mono'
import Meta from '@lobehub/icons/es/Meta/components/Mono'
import Mistral from '@lobehub/icons/es/Mistral/components/Mono'
import XAI from '@lobehub/icons/es/XAI/components/Mono'
import Cohere from '@lobehub/icons/es/Cohere/components/Mono'
import Nvidia from '@lobehub/icons/es/Nvidia/components/Mono'
import Ai21 from '@lobehub/icons/es/Ai21/components/Mono'
import Microsoft from '@lobehub/icons/es/Microsoft/components/Mono'
import Perplexity from '@lobehub/icons/es/Perplexity/components/Mono'
// === 国际推理平台 ===
import Groq from '@lobehub/icons/es/Groq/components/Mono'
import Together from '@lobehub/icons/es/Together/components/Mono'
import Fireworks from '@lobehub/icons/es/Fireworks/components/Mono'
// === 国际云/平台/聚合 ===
import Aws from '@lobehub/icons/es/Aws/components/Mono'
import Bedrock from '@lobehub/icons/es/Bedrock/components/Mono'
import Azure from '@lobehub/icons/es/Azure/components/Mono'
import AzureAI from '@lobehub/icons/es/AzureAI/components/Mono'
import OpenRouter from '@lobehub/icons/es/OpenRouter/components/Mono'
import HuggingFace from '@lobehub/icons/es/HuggingFace/components/Mono'
import Replicate from '@lobehub/icons/es/Replicate/components/Mono'
import Stability from '@lobehub/icons/es/Stability/components/Mono'
import Inflection from '@lobehub/icons/es/Inflection/components/Mono'
import IBM from '@lobehub/icons/es/IBM/components/Mono'
import Cerebras from '@lobehub/icons/es/Cerebras/components/Mono'
import SambaNova from '@lobehub/icons/es/SambaNova/components/Mono'
import Snowflake from '@lobehub/icons/es/Snowflake/components/Mono'
import DeepInfra from '@lobehub/icons/es/DeepInfra/components/Mono'
import AlephAlpha from '@lobehub/icons/es/AlephAlpha/components/Mono'
import NousResearch from '@lobehub/icons/es/NousResearch/components/Mono'
import Github from '@lobehub/icons/es/Github/components/Mono'
import GithubCopilot from '@lobehub/icons/es/GithubCopilot/components/Mono'
import VertexAI from '@lobehub/icons/es/VertexAI/components/Mono'
import GoogleCloud from '@lobehub/icons/es/GoogleCloud/components/Mono'
import Gemma from '@lobehub/icons/es/Gemma/components/Mono'
import PaLM from '@lobehub/icons/es/PaLM/components/Mono'
import Copilot from '@lobehub/icons/es/Copilot/components/Mono'
import Bing from '@lobehub/icons/es/Bing/components/Mono'
// === 国际推理/云平台扩展 ===
import Novita from '@lobehub/icons/es/Novita/components/Mono'
import Lambda from '@lobehub/icons/es/Lambda/components/Mono'
import Baseten from '@lobehub/icons/es/Baseten/components/Mono'
import Crusoe from '@lobehub/icons/es/Crusoe/components/Mono'
import Targon from '@lobehub/icons/es/Targon/components/Mono'
import CentML from '@lobehub/icons/es/CentML/components/Mono'
import Nebius from '@lobehub/icons/es/Nebius/components/Mono'
import Ollama from '@lobehub/icons/es/Ollama/components/Mono'
import Upstage from '@lobehub/icons/es/Upstage/components/Mono'
import LeptonAI from '@lobehub/icons/es/LeptonAI/components/Mono'
import Hyperbolic from '@lobehub/icons/es/Hyperbolic/components/Mono'
import Featherless from '@lobehub/icons/es/Featherless/components/Mono'
import Parasail from '@lobehub/icons/es/Parasail/components/Mono'
import OpenWebUI from '@lobehub/icons/es/OpenWebUI/components/Mono'
import LmStudio from '@lobehub/icons/es/LmStudio/components/Mono'
import Friendli from '@lobehub/icons/es/Friendli/components/Mono'
import Anyscale from '@lobehub/icons/es/Anyscale/components/Mono'
import Infermatic from '@lobehub/icons/es/Infermatic/components/Mono'
import Replit from '@lobehub/icons/es/Replit/components/Mono'
// === 国内推理/云平台扩展 ===
import SiliconCloud from '@lobehub/icons/es/SiliconCloud/components/Mono'
import ModelScope from '@lobehub/icons/es/ModelScope/components/Mono'
import PPIO from '@lobehub/icons/es/PPIO/components/Mono'
import Volcengine from '@lobehub/icons/es/Volcengine/components/Mono'
import Bailian from '@lobehub/icons/es/Bailian/components/Mono'
import BAAI from '@lobehub/icons/es/BAAI/components/Mono'
import TII from '@lobehub/icons/es/TII/components/Mono'
import Liquid from '@lobehub/icons/es/Liquid/components/Mono'
import Ai2 from '@lobehub/icons/es/Ai2/components/Mono'
import Figma from '@lobehub/icons/es/Figma/components/Mono'
// === 国内原厂 ===
import Qwen from '@lobehub/icons/es/Qwen/components/Mono'
import Zhipu from '@lobehub/icons/es/Zhipu/components/Mono'
import Moonshot from '@lobehub/icons/es/Moonshot/components/Mono'
import Doubao from '@lobehub/icons/es/Doubao/components/Mono'
import Stepfun from '@lobehub/icons/es/Stepfun/components/Mono'
import Minimax from '@lobehub/icons/es/Minimax/components/Mono'
import Hunyuan from '@lobehub/icons/es/Hunyuan/components/Mono'
import Baidu from '@lobehub/icons/es/Baidu/components/Mono'
import Kimi from '@lobehub/icons/es/Kimi/components/Mono'
import Baichuan from '@lobehub/icons/es/Baichuan/components/Mono'
import Spark from '@lobehub/icons/es/Spark/components/Mono'
import Wenxin from '@lobehub/icons/es/Wenxin/components/Mono'
import Yi from '@lobehub/icons/es/Yi/components/Mono'
import ZeroOne from '@lobehub/icons/es/ZeroOne/components/Mono'
import SenseNova from '@lobehub/icons/es/SenseNova/components/Mono'
import Tiangong from '@lobehub/icons/es/Tiangong/components/Mono'
import InternLM from '@lobehub/icons/es/InternLM/components/Mono'
// === 集团 ===
import ByteDance from '@lobehub/icons/es/ByteDance/components/Mono'
import Coze from '@lobehub/icons/es/Coze/components/Mono'
import Qingyan from '@lobehub/icons/es/Qingyan/components/Mono'
import ChatGLM from '@lobehub/icons/es/ChatGLM/components/Mono'
import AgnesAI from '@lobehub/icons/es/AgnesAI/components/Mono'
import Alibaba from '@lobehub/icons/es/Alibaba/components/Mono'
import Tencent from '@lobehub/icons/es/Tencent/components/Mono'
import Huawei from '@lobehub/icons/es/Huawei/components/Mono'
// === 补全:插件/平台真实矢量 ===
import Vercel from '@lobehub/icons/es/Vercel/components/Mono'
import Cloudflare from '@lobehub/icons/es/Cloudflare/components/Mono'
import Notion from '@lobehub/icons/es/Notion/components/Mono'
import Adobe from '@lobehub/icons/es/Adobe/components/Mono'
import Brave from '@lobehub/icons/es/Brave/components/Mono'
import AlibabaCloud from '@lobehub/icons/es/AlibabaCloud/components/Mono'
import HuaweiCloud from '@lobehub/icons/es/HuaweiCloud/components/Mono'
import OpenCode from '@lobehub/icons/es/OpenCode/components/Mono'
import Qoder from '@lobehub/icons/es/Qoder/components/Mono'

// === 无 lobehub 真实矢量的 provider:lucide 语义化兜底(语义同 web 端) ===
//   Server=云服务 / Cpu=本地算力 / Globe=网络服务 / Boxes=聚合平台 / AppWindow=Chrome / Video=视频
import { AppWindow, Boxes, Cpu, Globe, Server, Video } from 'lucide-react-native'

/**
 * 图标组件类型(VENDOR_COMPONENTS 的值类型)
 * - size:lobehub Mono / lucide 都接受;
 * - color:lucide-react-native 直接接受,lobehub Mono 忽略(改由外层 View 的 color
 *   设 currentColor 继承);类型同时含两者以兼容两类组件。
 */
type VendorIconComponent = React.ComponentType<{
  size?: number | string
  color?: string
}>

/**
 * 厂商代码 → @lobehub/icons 组件映射
 * satisfies Record<VendorCode, ...>:键集合由 vendor-infer.ts 的 VENDOR_CODES 编译期锁死,
 * 新增/删除厂商必须同步 vendor-infer.ts,否则 tsc 直接报错(不会静默漂移)。
 */
const VENDOR_COMPONENTS = {
  // 国际原厂
  openai: OpenAI,
  anthropic: Anthropic,
  google: Google,
  gemini: Google, // alias: provider_code=gemini
  deepseek: DeepSeek,
  meta: Meta,
  mistral: Mistral,
  xai: XAI,
  grok: XAI, // Grok 是 xAI 产品
  cohere: Cohere,
  nvidia: Nvidia,
  nvidia_nim: Nvidia, // alias: 后端 provider_code 用 nvidia_nim
  ai21: Ai21,
  microsoft: Microsoft,
  perplexity: Perplexity,
  // 国际推理平台
  groq: Groq,
  together: Together,
  fireworks: Fireworks,
  // 国际云/平台/聚合
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
  github_models: Github, // alias: 后端 provider_code 用 github_models
  githubcopilot: GithubCopilot,
  vertexai: VertexAI,
  vertex: VertexAI,
  googlecloud: GoogleCloud,
  gemma: Gemma,
  palm: PaLM,
  copilot: Copilot,
  bing: Bing,
  // 国际推理/云平台扩展
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
  alibaba_intl: Alibaba, // alias: 阿里云国际版
  tencent: Tencent,
  huawei: Huawei,
  // 补全真实矢量
  chrome: AppWindow, // lucide 兜底(@lobehub 无 Chrome 真实矢量)
  figma: Figma,
  remotion: Video, // lucide 兜底(@lobehub 无 Remotion 真实矢量)
  hyperframes: Video, // lucide 兜底(@lobehub 无 Hyperframes 真实矢量)
  vercel: Vercel,
  vercel_ai_gateway: Vercel, // alias
  cloudflare: Cloudflare,
  cloudflare_workers_ai: Cloudflare, // alias
  notion: Notion,
  adobe: Adobe,
  brave: Brave,
  'alibaba-cloud': AlibabaCloud,
  'huawei-cloud': HuaweiCloud,
  opencode_zen: OpenCode, // OpenCode Zen
  opencode: OpenCode, // alias
  qoder: Qoder, // Qoder AI
  if: Qoder, // alias: qoder 内部代号
  // 无 lobehub 真实矢量:lucide 语义化兜底
  modal: Server, // Modal 云函数推理平台
  inferencenet: Server, // InferenceNet 推理网络
  nlpcloud: Globe, // NLP Cloud NLP API
  scaleway: Server, // Scaleway 欧洲云
  local: Cpu, // 本地 LLM 泛指
  ornith: Boxes, // 国内新势力
  codebrain: Boxes,
  mai: Boxes,
} satisfies Record<VendorCode, VendorIconComponent>

/** web 实现:真实厂商矢量优先,未映射落回厂商首字母 */
export function BrandIcon({ vendor, size = 16, color }: BrandIconProps): React.ReactElement {
  const VendorIcon = vendor
    ? (VENDOR_COMPONENTS as Record<string, VendorIconComponent>)[vendor.toLowerCase()]
    : undefined

  if (VendorIcon) {
    const iconColor = color ?? tokens.text.secondary
    return (
      <View
        // 外层 View 的 color 设 currentColor:lobehub Mono 通过 currentColor 着色
        // (ViewStyle 未声明 color,RNW 运行时透传给 div,故 cast)
        style={
          {
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
          } as ViewStyle
        }
      >
        {/* lucide 吃 color prop;lobehub 忽略 color prop 但继承 currentColor */}
        <VendorIcon size={size} color={iconColor} />
      </View>
    )
  }

  // 未映射兜底:厂商首字母(与 native base 同语义)
  const letter = (vendor ?? '').trim().charAt(0).toUpperCase()
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text
        style={{
          fontSize: Math.max(10, Math.round(size * 0.8)),
          color: color ?? tokens.text.secondary,
          fontWeight: '600',
        }}
      >
        {letter}
      </Text>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
