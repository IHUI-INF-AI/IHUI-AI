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
  /** 代次档位(2026-08-29 立):latest 进默认列表,standard/legacy 收进"历史模型"折叠区 */
  tier?: ModelTier
  /** 系列名(如 `deepseek-v`),代次比较用,调试可查 */
  family?: string
}

export type { ModelTier, ModelUsageCategory }

/**
 * 把模型拆成"默认展示"与"历史模型"两区。
 *
 * 只有「代次=latest 且 用于对话」的进默认列表,其余全部收进历史模型折叠区
 * (历史过时版本 + 嵌入/重排/语音/图像等聊天场景调不通的专用模型)。
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
