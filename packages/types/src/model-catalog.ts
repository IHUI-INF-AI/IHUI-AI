// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型分类类型(2026-08-29 立)
 *
 * ai-service `app/services/model_catalog.py` 给每个模型打两个正交维度的标签,
 * 各端据此决定"默认展示"还是"收进历史模型折叠区"。类型定义放在 types 包,
 * 因为 api-client 依赖 types 而非 shared(依赖方向:types ← api-client ← shared),
 * 放在 shared 会造成循环依赖。
 *
 * 判定逻辑一律在后端,前端不做二次猜测,保证 8 端口径一致。
 */

/** 用途分类(这模型是干什么的),与后端 ModelUsageCategory 枚举值一一对应 */
export type ModelUsageCategory =
  | 'chat' // 文本对话 / 推理
  | 'vision' // 视觉理解(多模态对话)
  | 'embedding' // 向量嵌入
  | 'rerank' // 重排序
  | 'tts' // 语音合成
  | 'asr' // 语音识别
  | 'image' // 图像生成
  | 'video' // 视频生成
  | 'guard' // 安全审核
  | 'ocr' // 文字识别
  | 'other' // 未归类

/** 代次档位,与后端 ModelTier 枚举值一一对应 */
export type ModelTier =
  | 'latest' // 最新最强 —— 默认直接展示
  | 'standard' // 可用但非最新 —— 折叠区
  | 'legacy' // 已过时 —— 折叠区,排在最后

/** 模型语义能力键(D23 2026-09-19 立),与后端 derive_capabilities 四键一一对应 */
export type ModelCapabilityKey = 'vision' | 'reasoning' | 'tools' | 'fim'

/**
 * 语义能力四布尔(2026-09-19 D23 立)。
 * 由后端 `model_catalog.py` 的 `derive_capabilities` 派生(annotate_models 第三趟,
 * 显式预设覆盖同名键),消费方:`ModelRouter._to_capability`(auto 路由按能力匹配)
 * 与前端模型选择器(按能力过滤 + 能力徽章)。可选:老后端 / 缓存数据可能缺失。
 */
export interface ModelCapabilities {
  /** 视觉理解(多模态图片输入) */
  vision?: boolean
  /** 深度推理(推理系命名或 latest 对话模型) */
  reasoning?: boolean
  /** 工具调用(对话类且非 legacy) */
  tools?: boolean
  /** FIM(fill-in-the-middle)代码补全 */
  fim?: boolean
}

/** 后端附加在模型上的分类字段(全部可选,老后端 / 缓存数据可能缺失) */
export interface ModelCatalogFields {
  category?: ModelUsageCategory
  model_tier?: ModelTier
  /** 系列名(如 `deepseek-v` / `claude-opus`),代次比较用 */
  family?: string
  /**
   * 是否适合做 FIM(fill-in-the-middle)代码补全(2026-09-13 P1-9 立)。
   * 由后端 `model_catalog.py` 的 `_FIM_MODEL_RULES` 判定,前端不做二次猜测。
   * 不新增 `ModelUsageCategory` 枚举值:补全专用模型仍是 chat 用途,
   * 单独用布尔正交标记,避免影响「默认展示 vs 折叠」既有语义。
   */
  fim?: boolean
  /**
   * 语义能力四布尔(2026-09-19 D23 立,`derive_capabilities` 产出)。
   * 与顶层 `fim` 同口径(fim 键复用 `is_fim_model` 判定);保留顶层 `fim`
   * 是 P1-9 既有消费方的兼容字段,新消费方一律读 `capabilities`。
   */
  capabilities?: ModelCapabilities
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
