// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 兜底模型列表(跨端共享,纯数据,可在 SSR 和 CSR 中共享)
 *
 * 2026-08-04 Phase E 收敛(AGENTS.md §3 共享层优先):
 *   本文件从 apps/web 提取到共享层,4 端(web/extension/mobile-rn/cli)统一 import。
 *   仅作后端 /llm/models 不可达时的最小降级,主数据源是 /llm/models 动态拉取
 *   (后端已实现 provider 健康检查 + 自动过滤)。
 *   2026-11-27 起兜底只保留「智能路由」哨兵(`auto`),由服务端 auto 路由现选可用档;
 *   不再硬编码任何厂商模型 id —— 死档会让「列表拉取失败」直接变成「首帧必失败」。
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
   * 积分消耗倍数(5 档 tier:0 免费 / 1 经济 / 3 标准 / 10 高级 / 30 旗舰)。
   * 2026-11-23 改语义:此前这里直接写展示小数(0.77x),与后端 `points_multiplier`
   * 的 tier 口径混用,付费兜底档被写成 0 后一律渲染成「免费」。现在统一存 tier,
   * 展示侧直接使用该值(接口可用时被后端 DB 值覆盖);缺省按 model_id 推断。
   */
  pointsMultiplier?: number
  /** 是否正式版(显示 "正式版" 灰色徽章,标记 GA/稳定版) */
  isOfficial?: boolean
  /** 是否有专属补贴(显示 "专属补贴" 橙红徽章,标记厂商补贴价) */
  subsidy?: boolean
  /** 是否锁定(显示 🔒 锁图标,>1.0 倍数的模型需升级才能用) */
  locked?: boolean
}

/**
 * 动态智能路由哨兵(2026-11-27 立)。
 *
 * ai-service 在 `model === "auto"` 或为空时调用 `_resolve_auto_model()`
 * (apps/ai-service/app/core/llm_gateway.py:2250/2659),从 model_availability
 * 的可用池里按健康度、成本与能力现挑一档 —— 兜底表不需要、也不应该再硬编码
 * 任何厂商模型 id。
 *
 * 为什么这张表只剩哨兵:
 *  - `ihui/*` 全部失效。ihui_relay/SwiftAPI 上游已于 2026-10-24 弃用移除
 *    (apps/ai-service/app/core/model_naming.py:21-23);生产价格目录 16,476 行里
 *    `ihui/*` 命中 0 条。继续挂着 = "模型列表拉取失败 ⇒ 首帧必失败"。
 *  - `@cf/zai-org/glm-4.7-flash` 额度已耗尽(model-selector 内既有注释),
 *    留着会把断网用户再送进一条死路。
 *  - `stepfun/*` 2026-10-26 永久退役,由 apps/api/src/utils/retired-providers.ts
 *    与 Python 侧 default_model.py 统一守卫。
 */
export const AUTO_MODEL_ID = 'auto'

/** 已死/已退役前缀:任何候选写回本表前先过这道闸,防止死档复活。 */
export const DEAD_FALLBACK_PREFIXES = ['ihui/', 'stepfun/'] as const

/** 候选 id 是否命中已死前缀(大小写不敏感;空值不算死档)。 */
export function isDeadFallbackModelId(id: string | null | undefined): boolean {
  const m = (id ?? '').trim().toLowerCase()
  if (!m) return false
  return DEAD_FALLBACK_PREFIXES.some((prefix) => m.startsWith(prefix))
}

/** 兜底原始表:列出的是"语义",不是厂商模型 id。 */
const RAW_FALLBACK_MODELS: FallbackModel[] = [
  {
    value: AUTO_MODEL_ID,
    label: '智能路由 (智汇AI)',
    vendor: 'ihui_relay',
    // 展示按标准档(3);真实扣分以后端 auto 路由选中的模型为准。
    pointsMultiplier: 3,
    isOfficial: true,
  },
]

/** 兜底模型:仅后端不可达时使用(主数据源是 /llm/models 动态拉取) */
export const FALLBACK_MODELS: FallbackModel[] = RAW_FALLBACK_MODELS.filter(
  (m) => !isDeadFallbackModelId(m.value),
)

/**
 * 取兜底默认档。
 *
 * 恒返回可发送的 id:表被误删空时回落到 `auto`,而不是让调用方拿 `list[0]!`
 * 崩在空表上,或退回一条已死的厂商档。
 */
export function pickFallbackModelId(): string {
  return FALLBACK_MODELS[0]?.value ?? AUTO_MODEL_ID
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
