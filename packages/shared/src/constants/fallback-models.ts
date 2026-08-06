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

/**
 * 演示档位模型(2026-08-06 立,对齐 workbuddy 风格的 5 档展示)
 *
 * 设计目的:
 *   - 当前项目仅配置 stepfun(plan) + cloudflare(free) 两个 provider,真实模型积分倍数
 *     集中在 0.05x / 免费 档,无法在 UI 上展示 0.12x(标准) / 0.40x(高级) /
 *     0.77x(旗舰) / 1.65x(锁定) 4 个档位的真实样式。
 *   - 为让用户**第一眼就能看到完整的 5 档积分展示 + 徽章 + 锁定**,
 *     新增本演示列表:每个档位 1-2 个 demo 模型,默认 locked=true(明示"需升级")。
 *   - model-selector 合并 API + FALLBACK + DEMO 三方,真模型优先(同 id 时取真实数据),
 *     demo 仅作"档位展示"补充,不影响实际计费。
 *   - demo 模型的 value 用 `tier-demo/` 前缀 + 后端不存在的 id 防止误用:
 *     ① id 一眼能看出是 demo;② 真正下发到后端会被拒;③ 不污染后端 /llm/models。
 */
export const DEMO_TIER_MODELS: FallbackModel[] = [
  // === Tier 0:免费(zero_cost / 本地)===
  {
    value: 'tier-demo/ollama-llama3-8b',
    label: 'Llama 3 8B (本地 Ollama)',
    vendor: 'ollama',
    pointsMultiplier: 0,
    isOfficial: true,
  },
  // === Tier 1:经济(0.05x)===
  {
    value: 'tier-demo/gemini-2.0-flash-lite',
    label: 'Gemini 2.0 Flash Lite',
    vendor: 'gemini',
    pointsMultiplier: 0.05,
    isOfficial: true,
  },
  // === Tier 2:标准(0.12x)+ 会员2.5折 徽章 ===
  {
    value: 'tier-demo/step-2.1-code',
    label: 'Step 2.1 Code',
    vendor: 'stepfun',
    pointsMultiplier: 0.12,
    memberDiscountEligible: true,
  },
  // === Tier 3:高级(0.40x)+ 专属补贴 徽章(GLM-5.2 经典补贴案例)===
  {
    value: 'tier-demo/glm-5.2',
    label: 'GLM-5.2',
    vendor: 'zhipu',
    pointsMultiplier: 0.4,
    subsidy: true,
  },
  // === Tier 4:旗舰(0.77x)+ 会员2.5折 ===
  {
    value: 'tier-demo/step-2.1-pro',
    label: 'Step 2.1 Pro',
    vendor: 'stepfun',
    pointsMultiplier: 0.77,
    memberDiscountEligible: true,
  },
  // === Tier 5:超旗舰(1.65x 锁定)===
  {
    value: 'tier-demo/kimi-k3',
    label: 'Kimi K3',
    vendor: 'moonshot',
    pointsMultiplier: 1.65,
    locked: true,
  },
  {
    value: 'tier-demo/gpt-5',
    label: 'GPT-5',
    vendor: 'openai',
    pointsMultiplier: 1.65,
    locked: true,
  },
]
