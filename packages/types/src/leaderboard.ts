/**
 * 大模型排行榜共享类型(跨端共享)。
 * 参考 arena.ai/leaderboard,Elo 评分 + 排名 + 核心参数 + 能力雷达。
 */

/** 模型分类(6 类 + agent 智能体) */
export type ModelCategory =
  | 'llm' // 大语言模型
  | 'image' // 生图模型
  | 'video' // 视频模型
  | 'multimodal' // 多模态模型
  | 'audio' // 语音模型
  | 'embedding' // 嵌入模型
  | 'agent' // Agent 智能体

/** LLM 子分类 */
export type LlmSubcategory =
  | 'general' // 通用对话
  | 'coding' // 代码编程
  | 'reasoning' // 推理思考
  | 'agent' // Agent 智能体(LLM 类)

/** 能力雷达图 5 维评分(0-100) */
export interface ModelCapabilities {
  coding: number
  math: number
  reasoning: number
  creative: number
  chinese: number
}

/** 排行榜条目(对应 model_leaderboard 表) */
export interface LeaderboardEntry {
  id: string
  modelId: string
  modelName: string
  vendor: string
  category: ModelCategory
  subcategory: string | null
  arenaScore: number | null
  arenaRank: number | null
  rankDelta: number | null
  rankSpreadLow: number | null
  rankSpreadHigh: number | null
  scoreCi: number | null
  winRate: number | null
  voteCount: number | null
  contextWindow: string | null
  maxOutput: string | null
  inputPrice: string | null
  outputPrice: string | null
  releaseDate: string | null
  highlight: string | null
  capabilities: ModelCapabilities | null
  license: string
  isOverall: boolean
  sortOrder: number
}

/** 排行榜查询结果 */
export interface LeaderboardResult {
  category: ModelCategory | 'overall'
  subcategory: string | null
  total: number
  list: LeaderboardEntry[]
}

/** 分类 Tab 配置 */
export interface CategoryTab {
  key: ModelCategory | 'overall'
  label: string
  icon: string
}

/** LLM 子分类 Tab 配置 */
export interface LlmSubcategoryTab {
  key: LlmSubcategory
  label: string
}
