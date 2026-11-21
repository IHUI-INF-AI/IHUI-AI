// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型选择器 —— 代次分区与用途分组(2026-08-29 立)
 *
 * 单独成文件的原因:这两个函数是**纯函数**,不依赖 React / i18n / 图标库。
 * 抽出来后可以脱离组件依赖树做单测(直接从 model-selector.tsx import 会连带
 * 拉起 emoji-mart,其 native.json 缺 `type: json` import 属性会让 vitest 崩掉)。
 *
 * 判定规则一律来自后端 `ai-service/app/services/model_catalog.py`,
 * 这里只做"拿到字段后怎么分",前端不重复实现代次判定。
 */

import {
  MODEL_CATEGORY_META,
  MODEL_TIER_ORDER,
  isSelectableChatModel,
  normalizeCategory,
  normalizeTier,
  type ModelCapabilities,
  type ModelCapabilityKey,
  type ModelTier,
  type ModelUsageCategory,
} from '@ihui/shared'

export interface ModelOption {
  value: string
  label: string
  /** 模型 id（可选，2026-08-31 补：Auto-Model 徽章等按 id 匹配的场景使用） */
  id?: string
  descriptionKey?: string
  /** 厂商代码,用于 BrandIcon 显示 */
  vendor?: string
  /** 自定义图标 URL(可选,优先于 vendor) */
  iconUrl?: string
  /** 积分消耗倍数(2026-08-06 立,对齐 workbuddy 风格)
   *  - 小数显示(如 0.77x / 0.05x)
   *  - 0 = 免费模型
   *  - 优先取后端返回的 points_multiplier(后端 infer 5 档后映射为小数)或前端 tierToDisplayMultiplier */
  pointsMultiplier?: number
  /** 真实单价(元/百万 token,2026-11-13 立):倍率只是官方对齐档位,横比以单价为准。
   *  由后端模型目录带出;缺省则选择器不显示单价行。 */
  inputPricePerMillion?: number
  outputPricePerMillion?: number
  /** 是否支持会员 2.5 折(显示 "会员2.5折" 红色徽章 + 升级权益 popover 触发) */
  memberDiscountEligible?: boolean
  /** 是否正式版(显示 "正式版" 灰色徽章) */
  isOfficial?: boolean
  /** 是否有专属补贴(显示 "专属补贴" 橙红徽章) */
  subsidy?: boolean
  /** 是否锁定(显示锁图标,需升级才能使用) */
  locked?: boolean
  /** 用途分类(2026-08-29 立,后端 model_catalog 产出;决定"这模型是干什么的") */
  category?: ModelUsageCategory
  /** 代次档位(2026-08-29 立):latest/standard 进默认列表,legacy 收进"历史模型"折叠区 */
  tier?: ModelTier
  /** 系列名(如 `deepseek-v`),代次比较用,调试可查 */
  family?: string
  /** 后端代次判定原因(2026-11-21 立,`classify_reason` 原样透传):
   *  `minor-behind` = 同系列次版本落后(上一代,如 Agnes 图像 2.1 < 2.5),
   *  默认列表不再摆出来;其余原因(含字段缺失)按可展示处理,不误藏。 */
  classifyReason?: string
  /** 语义能力四布尔(2026-09-19 D23 立,后端 capabilities 透传):驱动能力过滤与徽章 */
  capabilities?: ModelCapabilities
  /** 是否已通过连通性探测(2026-11-11 立):仅后端 health_status==='healthy' 时为 true;
   *  pending(账户级错误/未探测)、unknown(无状态)与字段缺失都不可依赖,按未验证展示 */
  verified?: boolean
  /** 该结论的核对时刻(epoch ms,2026-11-18 立):号池腿由「本轮现拉上游模型清单」给出,
   *  仅作可选透传,不影响渲染判定。 */
  verifiedAt?: number
  /** 未验证原因/上游简短脱敏错误,仅作行标题提示 */
  healthError?: string
  /** 失败原因分档(2026-11-18 立,后端 `health_reason` 透传):
   *  quota=额度/余额耗尽、auth=密钥失效、model_missing=上游已下线、
   *  rate_limit=限流(暂时,不据此禁用)、空串=探测结论而非运行时回写。
   *  与 verified 互补:verified 回答"通不通",这里回答"为什么不通"。 */
  healthReason?: string
  /** 实测能力(2026-11-11 立,后端 `caps_verified` 原样透传;缺失=未知)。
   *  null = 未测/未知,与 verified(可用性已验证)相互独立。 */
  capsVerified?: CapsVerified
}

/** 实测能力(与后端 `caps_verified` 同形) */
export interface CapsVerified {
  stream: boolean | null
  tools: boolean | null
  context: { ok: boolean | null; tokens: number }
}

export type CapabilityState = 'ok' | 'fail' | 'unknown'

export interface CapabilitySegment {
  key: 'stream' | 'tools' | 'context'
  state: CapabilityState
  /** 已拼好 ✓/✗/? 的展示文案(长上下文通过时为 "长上下文16K") */
  text: string
}

/** tokens → 测试规模标签(以 1000 取整,如 16000 → "16K") */
export function formatContextTokens(tokens: number): string {
  return `${Math.round(tokens / 1000)}K`
}

const CAP_SYMBOL: Record<CapabilityState, string> = {
  ok: '✓',
  fail: '✗',
  unknown: '?',
}

function toCapState(ok: boolean | null | undefined): CapabilityState {
  if (ok === true) return 'ok'
  if (ok === false) return 'fail'
  return 'unknown'
}

/**
 * 能力摘要三段(流式 · 工具 · 长上下文)。
 * `capsVerified` 整体缺失时也返回三段问号,保证每一行结构一致;
 * 是否已验证(verified)不参与判定 —— 未验证模型同样展示实测能力。
 */
export function buildCapabilitySegments(
  opt: Pick<ModelOption, 'capsVerified'>,
  labels: { stream: string; tools: string; context: string },
): CapabilitySegment[] {
  const caps = opt.capsVerified
  const stream = toCapState(caps?.stream)
  const tools = toCapState(caps?.tools)
  const context = toCapState(caps?.context?.ok)
  return [
    { key: 'stream', state: stream, text: `${labels.stream}${CAP_SYMBOL[stream]}` },
    { key: 'tools', state: tools, text: `${labels.tools}${CAP_SYMBOL[tools]}` },
    {
      key: 'context',
      state: context,
      text:
        context === 'ok'
          ? `${labels.context}${formatContextTokens(caps?.context?.tokens ?? 0)}`
          : `${labels.context}${CAP_SYMBOL[context]}`,
    },
  ]
}

export type { ModelTier, ModelUsageCategory, ModelCapabilities, ModelCapabilityKey }

/**
 * 一个模型 id 的全部"可命中写法"(2026-11-18 立)。
 *
 * 同一个模型在三处有三种写法(真机实测):
 * - 号池下发 `cf/@cf/zai-org/glm-4.7-flash`(`toPoolModelId` 给上游名套了一层平台前缀)
 * - 健康台账键 `@cf/zai-org/glm-4.7-flash`(网关按上游真名记账,CF 官方名自带 `@`)
 * - 裸名 `glm-4.7-flash`(某些平台登记行不带 `<平台>/` 前缀)
 * 谁跟谁比都可能差一层,所以不猜"哪个才是真 id",而是把每种的候选写法都列出来,
 * 任一相同即视为同一模型。误命中的失效方向:只会让"确实被判死"的模型更早灰掉,
 * 不会让坏模型变成可点。
 */
export function idProbeKeys(id: string): string[] {
  const raw = (id || '').trim().toLowerCase()
  if (!raw) return []
  const noAt = raw.replace(/@/g, '')
  const stripFirst = (s: string) => (s.includes('/') ? s.slice(s.indexOf('/') + 1) : s)
  const keys = new Set([raw, noAt, stripFirst(raw), stripFirst(noAt)])
  // `cf/cf/...`:上游名本身就以 `<平台>/` 开头时前缀会叠一层
  const parts = noAt.split('/')
  if (parts.length > 2 && parts[0] === parts[1]) keys.add(parts.slice(1).join('/'))
  return [...keys]
}

/** 两个 id 是否指同一模型(按 idProbeKeys 的候选集合取交集)。 */
export function sameModelId(a: string, b: string): boolean {
  const keys = new Set(idProbeKeys(a))
  return idProbeKeys(b).some((key) => keys.has(key))
}

/**
 * 按激活的能力键过滤模型(D23 2026-09-19 立,历史模型区"搜索 + 能力过滤"组合用)。
 *
 * 语义(与 splitByTier 的"宁可多显示也不误藏"原则对齐):
 * - `required` 为空 → 原样返回(不过滤)
 * - `opt.capabilities` 整体缺失(老后端/降级种子)→ 视为"未知",**保留**,
 *   避免激活过滤器后列表突然空掉
 * - 字段存在 → 逐键 `caps[key] === true` 才保留(缺键/非布尔按 false,多键 AND)
 */
export function filterByCapabilities(
  options: ModelOption[],
  required: ModelCapabilityKey[],
): ModelOption[] {
  if (required.length === 0) return options
  return options.filter((opt) => {
    if (!opt.capabilities) return true // 未知不误藏
    return required.every((key) => opt.capabilities?.[key] === true)
  })
}

/**
 * 模型选择器的可选项(2026-11-20 机主定档:取消「历史模型」折叠区;
 * 同日追加:图像/视频/语音等分类模型要能选)。
 *
 * 只保留 `isSelectableChatModel` 为真的模型:legacy(清单命中或版本比较判旧的)与
 * 检索/审核类中间件(embedding / rerank / guard)直接**不展示**;图像/视频/语音/OCR
 * 等模态模型照常出现,行内以用途徽章区分。后端字段缺失时兜底为 chat+latest ⇒ 保留,
 * 宁可多显示也不误藏。
 *
 * 2026-11-21 追加(用户报「列表里还有历史旧代模型」):后端判为 `minor-behind`
 * 的**同系列次版本落后**条目(如 `Agnes 图像 2.1 Flash(上一代)`)不再进默认列表 ——
 * 它既没老到 legacy 被筛掉,又确实是上一代。当前代但未进白名单的 standard
 * (`unclassified-default`)照旧保留,不能一刀切藏掉能调通的模型。
 *
 * 返回值仍保留 `archived`(恒为空)只为兼容调用方的既有结构;UI 侧
 * `archived.length > 0` 的条件会让历史区整块不再渲染。
 */
export function splitByTier(options: ModelOption[]): {
  primary: ModelOption[]
  archived: ModelOption[]
} {
  const primary: ModelOption[] = []
  for (const opt of options) {
    if (opt.classifyReason?.startsWith('minor-behind')) continue
    const category = normalizeCategory(opt.category)
    const tier = normalizeTier(opt.tier)
    if (isSelectableChatModel(category, tier, opt.id)) primary.push(opt)
  }
  return { primary, archived: [] }
}

/**
 * 历史模型区按用途分类分组:
 * - 组间:对话类在前,专业用途(嵌入/语音/图像…)按 MODEL_CATEGORY_META.order
 * - 组内:standard 排在 legacy 前面(还能用的旧版本优先于明显过时的),再按名称排序
 */
export function groupByCategory(
  options: ModelOption[],
): Array<[ModelUsageCategory, ModelOption[]]> {
  const map = new Map<ModelUsageCategory, ModelOption[]>()
  for (const opt of options) {
    const cat = normalizeCategory(opt.category)
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(opt)
  }
  const groups = Array.from(map.entries()).sort(
    (a, b) => MODEL_CATEGORY_META[a[0]].order - MODEL_CATEGORY_META[b[0]].order,
  )
  for (const [, items] of groups) {
    items.sort((a, b) => {
      const ta = MODEL_TIER_ORDER[normalizeTier(a.tier)]
      const tb = MODEL_TIER_ORDER[normalizeTier(b.tier)]
      if (ta !== tb) return ta - tb
      // 2026-11-21 立(用户报「模型名大小写没区分好」):名称比较必须**忽略大小写**
      // ——默认 sensitivity=variant 时 `GLM-5.3` 与 `glm-5.3-flash` 的先后受原始
      // 大小写影响,列表看起来是乱的。numeric 让 v4.1 排在 v4.10 之前(数字序,
      // 不是字典序);大小写完全相同的两个名字再回落到原始串比较,保证顺序稳定。
      const byName = a.label.localeCompare(b.label, 'zh-Hans-CN', {
        sensitivity: 'base',
        numeric: true,
      })
      return byName !== 0 ? byName : a.label.localeCompare(b.label)
    })
  }
  return groups
}

const MODEL_BRAND_TOKENS: Record<string, string> = {
  gpt: 'GPT',
  glm: 'GLM',
  qwen: 'Qwen',
  deepseek: 'DeepSeek',
  claude: 'Claude',
  gemini: 'Gemini',
  llama: 'Llama',
  mistral: 'Mistral',
  grok: 'Grok',
  kimi: 'Kimi',
  mimo: 'MiMo',
  minimax: 'MiniMax',
  whisper: 'Whisper',
  flux: 'FLUX',
  sdxl: 'SDXL',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  nvidia: 'NVIDIA',
  xai: 'xAI',
  hunyuan: 'Hunyuan',
  ernie: 'ERNIE',
  doubao: 'Doubao',
  // 用途/能力缩写统一大写,避免 `mimo-v2.5-tts` 被整成 "Tts"
  tts: 'TTS',
  asr: 'ASR',
  ocr: 'OCR',
  vl: 'VL',
  vlm: 'VLM',
  oss: 'OSS',
}

/** 裸代码形名称:全小写 ASCII、带分隔符(如 `deepseek-v4.1-flash` / `gpt-5.4-mini`) */
const RAW_MODEL_CODE_RE = /^[a-z0-9@][a-z0-9@._:/+-]*$/

function isRawModelCode(value: string): boolean {
  return !!value && RAW_MODEL_CODE_RE.test(value) && /[a-z]/.test(value)
}

/** 把裸模型代码整理成人类可读名:`deepseek-v4.1-flash` → `DeepSeek V4.1 Flash`。
 *  只在名称本身是裸代码时才用,已带大写/中文的展示名一律原样保留(不乱改品牌写法)。 */
function prettifyModelCode(code: string): string {
  // 去掉上游命名空间(openrouter/、@cf/zai-org/…),只留最后一段模型本体
  const raw = code.trim()
  const body = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw
  return body
    .split(/[/\-_:\s]+/)
    .filter(Boolean)
    .map((token) => {
      const lower = token.toLowerCase()
      const brand = MODEL_BRAND_TOKENS[lower]
      if (brand) return brand
      if (/^v?\d+([.]\d+)*$/.test(lower)) return token.replace(/^v/i, 'V')
      if (/^\d+[a-z]$/.test(lower)) return token.slice(0, -1) + token.slice(-1).toUpperCase()
      return token.charAt(0).toUpperCase() + token.slice(1)
    })
    .join(' ')
}

/**
 * 选择器展示名(2026-11-21 立,治「模型名有的还没区分好大小写字母」)。
 *
 * 后端 `name` 有两种形态:人工整理的展示名(`DeepSeek V4.1 Flash`)与从 id 抄来的
 * 裸代码(`deepseek-v4.1-flash` / `gpt-5.4-mini`)。同一列表里混着两种,看起来就像
 * 「大小写没区分好」。这里只把**裸代码形**整理成统一词形,其余原样返回:
 *  - `name` 有内容且不是裸代码 → 原样用 `name`
 *  - `name` 缺失或是裸代码 → 优先整理 `name`,再退回整理 `id`
 *  - 都为空 → 返回 `id` 原值(不吞掉条目)
 */
export function formatModelDisplayLabel(name: string | undefined, id: string): string {
  const shown = (name ?? '').trim()
  if (shown && !isRawModelCode(shown)) return shown
  const pretty = prettifyModelCode(shown || (id ?? '').trim())
  return pretty || shown || (id ?? '')
}

/**
 * 平台组内按用途排序(2026-11-21 立,用户定档「保持平台一级、组内按用途排序」)。
 *
 * 直接复用 `groupByCategory` 的分组与组内排序口径(§0.6 单一真相源):
 * 组间顺序 = `MODEL_CATEGORY_META.order`(对话 → 视觉 → 语音 → 图像 → 视频…),
 * 组内 = 代次(latest → standard → legacy)→ 名称。
 * 返回新数组,不改传入列表(调用方在 useMemo 里持有 option 原件)。
 */
export function sortByCategoryOrder(options: ModelOption[]): ModelOption[] {
  return groupByCategory(options).flatMap(([, items]) => items)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
