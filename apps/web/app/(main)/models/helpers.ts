// 模型页辅助函数与数据(厂商分组 / 兜底模型 / 收藏 / 元数据)
// 本文件已拆分为子模块(providers / fallback-models / model-meta / models-api / favorites),对外 API 通过再导出保持兼容。

export { VENDOR_LABEL as PROVIDER_LABEL } from '@/components/chat/fallback-models'
export {
  PROVIDER_GROUP_LABEL,
  PROVIDER_GROUPS,
  PROVIDERS,
  SORT_KEY,
  QUICK_FILTER_KEY,
} from './helpers/providers'
export { FALLBACK_MODELS } from './helpers/fallback-models'
export {
  HIGHLIGHT_MODEL_IDS,
  MODEL_DESCRIPTIONS,
  PRESET_PROMPTS,
  LIVE_2026_MODELS,
} from './helpers/model-meta'
export { enrichModels, fetchModels } from './helpers/models-api'
export { getFavoriteModelIds, setFavoriteModelIds, toggleFavoriteModel } from './helpers/favorites'
