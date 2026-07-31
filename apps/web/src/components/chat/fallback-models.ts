/**
 * 兜底模型列表(独立模块,纯数据,可在 SSR 和 CSR 中共享)
 *
 * 2026-07-31 Phase C+D 收敛(AGENTS.md §3 共享层优先):
 *   本文件仅作后端 /llm/models 不可达时的最小降级,主数据源是
 *   /llm/models 动态拉取(后端已实现 provider 健康检查 + 自动过滤)。
 *   兜底列表仅保留项目已验证连通的主力 stepfun + Cloudflare 免费 zero_cost 模型,
 *   不再硬编码厂商映射表(VENDOR_LABEL 仅保留兜底用到的 2 个 vendor),
 *   动态拉取的模型 vendor 由后端返回,分组标题缺失时回退到原始 provider 字符串。
 *
 * 设计目的:
 *   - model-selector.tsx(AI 输入框客户端组件)在 fetchModels() 失败或返回空时使用
 *   - 其他需要展示模型列表的 SSR 组件的最终降级
 */

export interface FallbackModel {
  value: string
  label: string
  /** 厂商代码(用于 BrandIcon,如 'openai'、'deepseek') */
  vendor: string
  /** 描述 i18n 键(可选) */
  descriptionKey?: string
}

/** 兜底模型:仅后端不可达时使用(主数据源是 /llm/models 动态拉取) */
export const FALLBACK_MODELS: FallbackModel[] = [
  // === 项目主力(已验证连通 + 已配置 key,与 ai-service default_models.json 对齐)===
  { value: 'stepfun/step-router-v1', label: 'Step Router v1', vendor: 'stepfun' },
  { value: 'stepfun/step-3.7-flash', label: 'Step 3.7 Flash', vendor: 'stepfun' },
  // === Cloudflare Workers AI(免费 zero_cost,无需 key)===
  {
    value: '@cf/zai-org/glm-4.7-flash',
    label: 'GLM-4.7 Flash (CF 免费)',
    vendor: 'cloudflare_workers_ai',
  },
]

/** 厂商代码 → i18n key(仅保留兜底用到的 2 个 vendor;动态拉取的模型 vendor 缺失时回退到原始字符串)
 * 渲染处用 t() 转换 key 为本地化显示名 */
export const VENDOR_LABEL: Record<string, string> = {
  stepfun: 'vendor.stepfun',
  cloudflare_workers_ai: 'vendor.cloudflareWorkersAi',
}
