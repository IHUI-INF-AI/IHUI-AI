// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Qoder 上游模型清单规范化(2026-11-24 立)。
 *
 * 事实源:SDK 在每次 query 主动推的 `available_models_update` 系统帧
 * (本机 2026-11-24 实弹:CN 版推 14 个模型,含 isNew 的 Qwen4-Max/DeepSeek-V4-Pro/
 * GLM-5.4/Kimi-K3.1-Pro;上游无 models HTTP 端点,取证见
 * docs/RELAY_QODER_LISTMODELS_EVIDENCE.md)。此前桥把该帧当"只用于观测"丢弃,
 * 上游上新永远进不了号池模型表。本模块是帧→清单的唯一解析真相源,
 * 由 scripts/qoder-chat-bridge.mjs 与测试共用。
 *
 * 纪律:只保留 enabled 且 id 非空的条目;同 id 去重;解析不出任何条目返回 null
 * (不伪造空清单冒充"上游没有模型")。
 */

/** 规范化后的单条模型形状:{id, value?, displayName?, isNew?}
 *  id 为上游可转发 key,displayName 仅展示。 */

/**
 * available_models_update 帧 → 规范化清单。纯函数,供桥与测试共用。
 * 非该 subtype / 无 models[] / 清洗后为空 → null(如实报告取不到)。
 */
export function normalizeModelCatalogFrame(msg) {
  if (!msg || msg.type !== 'system' || msg.subtype !== 'available_models_update') return null
  const raw = Array.isArray(msg.models) ? msg.models : null
  if (!raw) return null
  const models = []
  const seen = new Set()
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue
    if (m.isEnabled === false) continue
    const value = typeof m.value === 'string' ? m.value.trim() : ''
    const id = typeof m.modelId === 'string' && m.modelId.trim() ? m.modelId.trim() : value
    if (!id || seen.has(id)) continue
    seen.add(id)
    models.push({
      id,
      ...(value ? { value } : {}),
      ...(typeof m.displayName === 'string' ? { displayName: m.displayName } : {}),
      ...(typeof m.isNew === 'boolean' ? { isNew: m.isNew } : {}),
    })
  }
  return models.length > 0 ? { models, fetchedAt: Date.now() } : null
}
