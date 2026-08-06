/**
 * 兜底模型列表(跨端共享,纯数据,可在 SSR 和 CSR 中共享)
 *
 * 2026-08-04 Phase E 收敛(AGENTS.md §3 共享层优先):
 *   本文件从 apps/web 提取到共享层,4 端(web/extension/mobile-rn/cli)统一 import。
 *   仅作后端 /llm/models 不可达时的最小降级,主数据源是 /llm/models 动态拉取
 *   (后端已实现 provider 健康检查 + 自动过滤)。
 *   兜底列表仅保留项目已验证连通的主力 stepfun + Cloudflare 免费 zero_cost 模型。
 *
 * 各端形态适配:
 *   - web 端直接使用 FallbackModel(value/label/vendor),见 model-selector.tsx。
 *   - extension/mobile-rn/cli 端使用 LlmModel(id/name/provider/context_length/input_price),
 *     需在端内 map 转换并补充 context_length + input_price 默认值。
 *
 * 设计目的:
 *   - model-selector.tsx(web)/ ChatPage(extension)/ ChatScreen(mobile-rn)/ repl(cli)
 *     在 fetchModels() 失败或返回空时使用
 *   - 其他需要展示模型列表的 SSR 组件的最终降级
 */

export interface FallbackModel {
  value: string
  label: string
  /** 厂商代码(用于 BrandIcon,如 'openai'、'deepseek') */
  vendor: string
  /** 描述 i18n 键(可选) */
  descriptionKey?: string
  /**
   * 积分消耗倍数(2026-08-06 立,对齐 workbuddy 风格)
   * - 小数显示(如 0.77x / 0.05x)
   * - 0 = 免费模型(zero_cost provider / 本地)
   * - 未设置时由 model_id 关键词自动推断(0/1/3/10/30 五档)
   * - 显示时通过 tierToDisplayMultiplier 映射为小数
   */
  pointsMultiplier?: number
  /** 是否支持会员 2.5 折(显示 "会员2.5折" 红色徽章 + 升级权益 popover 触发) */
  memberDiscountEligible?: boolean
  /** 是否正式版(显示 "正式版" 灰色徽章,标记 GA/稳定版) */
  isOfficial?: boolean
  /** 是否有专属补贴(显示 "专属补贴" 橙红徽章,标记厂商补贴价) */
  subsidy?: boolean
  /** 是否锁定(显示 🔒 锁图标,>1.0 倍数的模型需升级才能用) */
  locked?: boolean
}

/** 兜底模型:仅后端不可达时使用(主数据源是 /llm/models 动态拉取) */
export const FALLBACK_MODELS: FallbackModel[] = [
  // === 项目主力(已验证连通 + 已配置 key,与 ai-service default_models.json 对齐)===
  // stepfun/step-router-v1 是"自动路由"模式,无积分倍数(走任务类型自动调度)
  { value: 'stepfun/step-router-v1', label: 'Step Router v1', vendor: 'stepfun' },
  {
    value: 'stepfun/step-3.7-flash',
    label: 'Step 3.7 Flash',
    vendor: 'stepfun',
    // 0.05x + 正式版:经济型主力,免费 plan 套餐可高频调用
    pointsMultiplier: 0.05,
    isOfficial: true,
  },
  // === Cloudflare Workers AI(免费 zero_cost,无需 key)===
  {
    value: '@cf/zai-org/glm-4.7-flash',
    label: 'GLM-4.7 Flash (CF 免费)',
    vendor: 'cloudflare_workers_ai',
    // 0 = 免费(zero_cost provider),显示"免费"无小数
    pointsMultiplier: 0,
    isOfficial: true,
  },
]
