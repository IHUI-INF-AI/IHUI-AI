// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * model-names.mjs — 模型名官方归一化(seed / 运维脚本共用)
 *
 * 与 packages/shared/src/constants/model-names.ts 及
 * apps/ai-service/app/core/model_naming.py **同源**,修改任一实现时必须三端同步。
 *
 * 2026-09-13 立:上游各来源对同一模型使用不同大小写(如 minimax-m3 与 MiniMax-M3),
 * 会造成 ai_model_config_models 同模型并存两条;同表已建
 * (config_id, LOWER(model_id)) 表达式唯一索引,写入前必须归一再落库。
 */

/** 官方名映射表:键为小写形式,值为官方要求的标准写法 */
export const OFFICIAL_MODEL_NAMES = {
  'auto-model': 'Auto-Model',
  'minimax-m1': 'MiniMax-M1',
  'minimax-m2': 'MiniMax-M2',
  'minimax-m2-highspeed': 'MiniMax-M2-highspeed',
  'minimax-m2.5': 'MiniMax-M2.5',
  'minimax-m2.5-highspeed': 'MiniMax-M2.5-highspeed',
  'minimax-m2.7': 'MiniMax-M2.7',
  'minimax-m2.7-highspeed': 'MiniMax-M2.7-highspeed',
  'minimax-m3': 'MiniMax-M3',
  'minimax-m3-highspeed': 'MiniMax-M3-highspeed',
  'minimax-text-01': 'MiniMax-Text-01',
  'minimax-vl-01': 'MiniMax-VL-01',
}

/**
 * 归一模型名为官方标准形式。
 * 输入 'MiniMax-M3' / 'minimax-m3' / ' MINIMAX-M3 ' → 'MiniMax-M3'
 * 输入 'GPT-4o' → 'gpt-4o'(未知家族归一小写)
 * 输入 'deepseek/deepseek-v4' → 'deepseek/deepseek-v4'(前缀保留,后段归一)
 */
export function normalizeModelId(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed) return trimmed
  const slashIdx = trimmed.indexOf('/')
  if (slashIdx > 0) {
    return trimmed.slice(0, slashIdx + 1) + normalizeModelId(trimmed.slice(slashIdx + 1))
  }
  const lower = trimmed.toLowerCase()
  return OFFICIAL_MODEL_NAMES[lower] ?? lower
}
