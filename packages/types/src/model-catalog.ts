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

/** 后端附加在模型上的分类字段(全部可选,老后端 / 缓存数据可能缺失) */
export interface ModelCatalogFields {
  category?: ModelUsageCategory
  model_tier?: ModelTier
  /** 系列名(如 `deepseek-v` / `claude-opus`),代次比较用 */
  family?: string
}
