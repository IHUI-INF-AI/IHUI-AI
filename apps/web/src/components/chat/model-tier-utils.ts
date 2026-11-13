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
  isArchivedModel,
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
  /** 模型所属通道(2026-11-12 立):'pool' = 个人号池模型(走 /ws/relay/chat),
   *  缺省/undefined = 平台模型(走 agent runtime)。选中时随 onChange 第二参下传。 */
  channel?: 'platform' | 'pool'
  /** 模型 id（可选，2026-08-31 补：Auto-Model 徽章等按 id 匹配的场景使用） */
  id?: string
  /** 每百万 token 真实单价(2026-11-13 类型契约补齐):能力摘要行横比用,
   *  model-selector 的 pricePerMillionText 已读取,此前接口未登记导致 TS2339。 */
  inputPricePerMillion?: number
  outputPricePerMillion?: number
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
  /** 真实单价(元/百万 token,2026-11-13 立):倍率只是官方对标档位,横比以单价为准。
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
  /** 语义能力四布尔(2026-09-19 D23 立,后端 capabilities 透传):驱动能力过滤与徽章 */
  capabilities?: ModelCapabilities
  /** 是否已通过连通性探测(2026-11-11 立):仅后端 health_status==='healthy' 时为 true;
   *  pending(账户级错误/未探测)、unknown(无状态)与字段缺失都不可依赖,按未验证展示 */
  verified?: boolean
  /** 未验证原因/上游简短脱敏错误,仅作行标题提示 */
  healthError?: string
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
 * 把模型拆成"默认展示"与"历史模型"两区。
 *
 * 「代次=latest/standard 且 用于对话」的进默认列表,其余全部收进历史模型折叠区
 * (过时 legacy 版本 + 嵌入/重排/语音/图像等聊天场景调不通的专用模型)。
 * 后端字段缺失时(老后端 / 降级种子数据)一律按"最新对话模型"处理,
 * 宁可多显示也不误藏 —— 避免列表整体空掉。
 */
export function splitByTier(options: ModelOption[]): {
  primary: ModelOption[]
  archived: ModelOption[]
} {
  const primary: ModelOption[] = []
  const archived: ModelOption[] = []
  for (const opt of options) {
    const category = normalizeCategory(opt.category)
    const tier = normalizeTier(opt.tier)
    if (isArchivedModel(category, tier)) archived.push(opt)
    else primary.push(opt)
  }
  return { primary, archived }
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
      return a.label.localeCompare(b.label)
    })
  }
  return groups
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
