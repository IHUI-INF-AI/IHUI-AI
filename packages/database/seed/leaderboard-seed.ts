import { createDb } from '../src/client.js'
import { modelLeaderboard } from '../src/schema/model-leaderboard.js'

const db = createDb(
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui',
)

/**
 * 大模型排行榜种子数据(参考 arena.ai 2026-07-22 采集)。
 *
 * 分类:llm(通用/代码/推理) / image(生图) / video(视频) / multimodal(多模态) / audio(语音) / embedding(嵌入) / agent(智能体) / overall(总榜)。
 *
 * 唯一约束 (modelId, category):
 * - LLM 三个子类共享 category='llm',同一模型会冲突 → coding/reasoning 的 modelId 加 '#coding'/'#reasoning' 后缀。
 * - 总榜条目 category='overall'(不保留原分类),避免与各类别条目冲突;isOverall=true。
 * - 总榜中 claude-fable-5 重复出现(LLM #1 + Multimodal #4),第二条被 onConflictDoNothing 跳过 → 总榜 9 条。
 */

interface Capabilities {
  coding: number
  math: number
  reasoning: number
  creative: number
  chinese: number
}

type Entry = typeof modelLeaderboard.$inferInsert

const cap = (c: Capabilities): string => JSON.stringify(c)

// =============================================================================
// LLM 大语言模型 — 通用(general)
// =============================================================================

const llmGeneral: Entry[] = [
  {
    modelId: 'claude-fable-5', modelName: 'Claude Fable 5', vendor: 'Anthropic',
    category: 'llm', subcategory: 'general', arenaScore: 1507, arenaRank: 1, scoreCi: 7,
    contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50',
    releaseDate: '2026-07-15', highlight: 'Anthropic 旗舰模型,综合能力全面领先',
    capabilities: cap({ coding: 95, math: 90, reasoning: 94, creative: 88, chinese: 90 }),
    license: 'Proprietary', isOverall: false, sortOrder: 1,
  },
  {
    modelId: 'claude-opus-4-6-thinking', modelName: 'Claude Opus 4.6 Thinking', vendor: 'Anthropic',
    category: 'llm', subcategory: 'general', arenaScore: 1504, arenaRank: 2, scoreCi: 4,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    releaseDate: '2026-07-10', highlight: '深度推理强项,数学与代码表现突出',
    capabilities: cap({ coding: 93, math: 92, reasoning: 95, creative: 84, chinese: 88 }),
    license: 'Proprietary', isOverall: false, sortOrder: 2,
  },
  {
    modelId: 'claude-opus-4-7-thinking', modelName: 'Claude Opus 4.7 Thinking', vendor: 'Anthropic',
    category: 'llm', subcategory: 'general', arenaScore: 1503, arenaRank: 3, scoreCi: 4,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    releaseDate: '2026-07-12', highlight: 'Opus 4.6 升级版,推理能力进一步提升',
    capabilities: cap({ coding: 94, math: 91, reasoning: 95, creative: 85, chinese: 89 }),
    license: 'Proprietary', isOverall: false, sortOrder: 3,
  },
  {
    modelId: 'claude-opus-4-6', modelName: 'Claude Opus 4.6', vendor: 'Anthropic',
    category: 'llm', subcategory: 'general', arenaScore: 1498, arenaRank: 4, scoreCi: 4,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    releaseDate: '2026-07-10', highlight: '非 thinking 版本,响应速度快,通用能力强',
    capabilities: cap({ coding: 90, math: 87, reasoning: 89, creative: 86, chinese: 87 }),
    license: 'Proprietary', isOverall: false, sortOrder: 4,
  },
  {
    modelId: 'claude-opus-4-7', modelName: 'Claude Opus 4.7', vendor: 'Anthropic',
    category: 'llm', subcategory: 'general', arenaScore: 1494, arenaRank: 5, scoreCi: 4,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    releaseDate: '2026-07-12', highlight: 'Opus 4.6 标准版升级,均衡表现',
    capabilities: cap({ coding: 91, math: 88, reasoning: 90, creative: 87, chinese: 88 }),
    license: 'Proprietary', isOverall: false, sortOrder: 5,
  },
  {
    modelId: 'muse-spark-1-1', modelName: 'Muse Spark 1.1', vendor: 'Meta',
    category: 'llm', subcategory: 'general', arenaScore: 1493, arenaRank: 6, scoreCi: 8,
    contextWindow: '1M', inputPrice: 'N/A', outputPrice: 'N/A',
    releaseDate: '2026-07-14', highlight: 'Meta 开源旗舰,1M 上下文,性价比极高',
    capabilities: cap({ coding: 89, math: 86, reasoning: 88, creative: 85, chinese: 82 }),
    license: '开源', isOverall: false, sortOrder: 6,
  },
  {
    modelId: 'muse-spark', modelName: 'Muse Spark', vendor: 'Meta',
    category: 'llm', subcategory: 'general', arenaScore: 1487, arenaRank: 7, scoreCi: 6,
    contextWindow: '1M', inputPrice: 'N/A', outputPrice: 'N/A',
    releaseDate: '2026-07-01', highlight: 'Meta 首代 Muse Spark,长文本理解优秀',
    capabilities: cap({ coding: 87, math: 84, reasoning: 86, creative: 83, chinese: 80 }),
    license: '开源', isOverall: false, sortOrder: 7,
  },
  {
    modelId: 'gemini-3-pro', modelName: 'Gemini 3 Pro', vendor: 'Google',
    category: 'llm', subcategory: 'general', arenaScore: 1486, arenaRank: 8, scoreCi: 4,
    contextWindow: '2M', maxOutput: '128K', inputPrice: '$2', outputPrice: '$12',
    releaseDate: '2026-07-17', highlight: 'Google 旗舰,2M 超长上下文,多模态融合',
    capabilities: cap({ coding: 88, math: 89, reasoning: 89, creative: 84, chinese: 85 }),
    license: 'Proprietary', isOverall: false, sortOrder: 8,
  },
  {
    modelId: 'kimi-k3', modelName: 'Kimi K3', vendor: 'Moonshot',
    category: 'llm', subcategory: 'general', arenaScore: 1486, arenaRank: 9, scoreCi: 11,
    contextWindow: '1M', inputPrice: '开源', outputPrice: '开源',
    releaseDate: '2026-07-17', highlight: '月之暗面 2.8 万亿参数开源模型,国产之光',
    capabilities: cap({ coding: 88, math: 85, reasoning: 87, creative: 86, chinese: 93 }),
    license: '开源', isOverall: false, sortOrder: 9,
  },
  {
    modelId: 'gpt-5-6-sol-xhigh', modelName: 'GPT-5.6 Sol xHigh', vendor: 'OpenAI',
    category: 'llm', subcategory: 'general', arenaScore: 1486, arenaRank: 10, scoreCi: 9,
    contextWindow: '1.05M', maxOutput: '128K', inputPrice: '$5', outputPrice: '$30',
    releaseDate: '2026-07-09', highlight: 'OpenAI 编程特化型号,代码生成强劲',
    capabilities: cap({ coding: 92, math: 88, reasoning: 89, creative: 83, chinese: 84 }),
    license: 'Proprietary', isOverall: false, sortOrder: 10,
  },
]

// =============================================================================
// LLM 大语言模型 — 代码编程(coding)
// modelId 加 '#coding' 后缀以避免与 general 的 (modelId, category) 冲突
// =============================================================================

const llmCoding: Entry[] = [
  {
    modelId: 'claude-opus-4-7-thinking#coding', modelName: 'Claude Opus 4.7 Thinking', vendor: 'Anthropic',
    category: 'llm', subcategory: 'coding', arenaScore: 1567, arenaRank: 1, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: 'WebDev Arena 编程榜首,全栈开发能力最强',
    capabilities: cap({ coding: 98, math: 90, reasoning: 95, creative: 80, chinese: 85 }),
    license: 'Proprietary', isOverall: false, sortOrder: 11,
  },
  {
    modelId: 'claude-opus-4-7#coding', modelName: 'Claude Opus 4.7', vendor: 'Anthropic',
    category: 'llm', subcategory: 'coding', arenaScore: 1557, arenaRank: 2, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: '标准版编程能力同样强劲,响应更快',
    capabilities: cap({ coding: 96, math: 88, reasoning: 90, creative: 82, chinese: 86 }),
    license: 'Proprietary', isOverall: false, sortOrder: 12,
  },
  {
    modelId: 'claude-opus-4-8-thinking#coding', modelName: 'Claude Opus 4.8 Thinking', vendor: 'Anthropic',
    category: 'llm', subcategory: 'coding', arenaScore: 1552, arenaRank: 3, scoreCi: 6,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: 'Opus 4.8 thinking 版,编程推理双强',
    capabilities: cap({ coding: 97, math: 91, reasoning: 96, creative: 81, chinese: 84 }),
    license: 'Proprietary', isOverall: false, sortOrder: 13,
  },
  {
    modelId: 'claude-opus-4-8#coding', modelName: 'Claude Opus 4.8', vendor: 'Anthropic',
    category: 'llm', subcategory: 'coding', arenaScore: 1545, arenaRank: 4, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: 'Opus 4.8 标准版,编程效率与质量兼顾',
    capabilities: cap({ coding: 95, math: 89, reasoning: 91, creative: 83, chinese: 85 }),
    license: 'Proprietary', isOverall: false, sortOrder: 14,
  },
  {
    modelId: 'claude-opus-4-6-thinking#coding', modelName: 'Claude Opus 4.6 Thinking', vendor: 'Anthropic',
    category: 'llm', subcategory: 'coding', arenaScore: 1543, arenaRank: 5, scoreCi: 4,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: '老牌编程强者,复杂重构表现稳定',
    capabilities: cap({ coding: 96, math: 92, reasoning: 95, creative: 79, chinese: 83 }),
    license: 'Proprietary', isOverall: false, sortOrder: 15,
  },
  {
    modelId: 'claude-opus-4-6#coding', modelName: 'Claude Opus 4.6', vendor: 'Anthropic',
    category: 'llm', subcategory: 'coding', arenaScore: 1538, arenaRank: 6, scoreCi: 4,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: '标准版编程能力扎实,调试能力强',
    capabilities: cap({ coding: 94, math: 87, reasoning: 89, creative: 82, chinese: 84 }),
    license: 'Proprietary', isOverall: false, sortOrder: 16,
  },
  {
    modelId: 'qwen3-7-max#coding', modelName: 'Qwen3.7 Max', vendor: 'Alibaba',
    category: 'llm', subcategory: 'coding', arenaScore: 1537, arenaRank: 7, scoreCi: 7,
    contextWindow: '1M', inputPrice: '¥2', outputPrice: '¥6',
    highlight: '阿里通义千问编程特化,国产编程第一',
    capabilities: cap({ coding: 94, math: 88, reasoning: 87, creative: 78, chinese: 92 }),
    license: 'Proprietary', isOverall: false, sortOrder: 17,
  },
  {
    modelId: 'glm-5-1#coding', modelName: 'GLM-5.1', vendor: 'Z.ai',
    category: 'llm', subcategory: 'coding', arenaScore: 1532, arenaRank: 8, scoreCi: 8,
    contextWindow: '128K', inputPrice: '¥3', outputPrice: '¥6',
    highlight: '智谱 GLM 编程版,中文代码注释优秀',
    capabilities: cap({ coding: 92, math: 85, reasoning: 86, creative: 76, chinese: 94 }),
    license: 'Proprietary', isOverall: false, sortOrder: 18,
  },
  {
    modelId: 'minimax-m3#coding', modelName: 'MiniMax M3', vendor: 'MiniMax',
    category: 'llm', subcategory: 'coding', arenaScore: 1528, arenaRank: 9, scoreCi: 9,
    contextWindow: '245K', inputPrice: '¥4', outputPrice: '¥8',
    highlight: 'MiniMax 旗舰,长代码生成稳定',
    capabilities: cap({ coding: 91, math: 83, reasoning: 85, creative: 80, chinese: 88 }),
    license: 'Proprietary', isOverall: false, sortOrder: 19,
  },
  {
    modelId: 'claude-sonnet-4-6#coding', modelName: 'Claude Sonnet 4.6', vendor: 'Anthropic',
    category: 'llm', subcategory: 'coding', arenaScore: 1522, arenaRank: 10, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$3', outputPrice: '$15',
    highlight: '高性价比编程模型,日常开发首选',
    capabilities: cap({ coding: 93, math: 85, reasoning: 88, creative: 81, chinese: 83 }),
    license: 'Proprietary', isOverall: false, sortOrder: 20,
  },
]

// =============================================================================
// LLM 大语言模型 — 推理思考(reasoning)
// modelId 加 '#reasoning' 后缀;参考 general 排名,评分略低 5-10 分
// =============================================================================

const llmReasoning: Entry[] = [
  {
    modelId: 'claude-fable-5#reasoning', modelName: 'Claude Fable 5', vendor: 'Anthropic',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1500, arenaRank: 1, scoreCi: 8,
    contextWindow: '1M', maxOutput: '128K', inputPrice: '$10', outputPrice: '$50',
    highlight: '复杂推理与多步规划能力顶尖',
    capabilities: cap({ coding: 92, math: 93, reasoning: 96, creative: 85, chinese: 89 }),
    license: 'Proprietary', isOverall: false, sortOrder: 21,
  },
  {
    modelId: 'claude-opus-4-6-thinking#reasoning', modelName: 'Claude Opus 4.6 Thinking', vendor: 'Anthropic',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1496, arenaRank: 2, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: '数学证明与逻辑推理专精',
    capabilities: cap({ coding: 90, math: 94, reasoning: 97, creative: 81, chinese: 86 }),
    license: 'Proprietary', isOverall: false, sortOrder: 22,
  },
  {
    modelId: 'claude-opus-4-7-thinking#reasoning', modelName: 'Claude Opus 4.7 Thinking', vendor: 'Anthropic',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1495, arenaRank: 3, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: '深度思考链路更长,推理准确率高',
    capabilities: cap({ coding: 91, math: 93, reasoning: 96, creative: 82, chinese: 87 }),
    license: 'Proprietary', isOverall: false, sortOrder: 23,
  },
  {
    modelId: 'claude-opus-4-6#reasoning', modelName: 'Claude Opus 4.6', vendor: 'Anthropic',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1490, arenaRank: 4, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: '非 thinking 推理仍属第一梯队',
    capabilities: cap({ coding: 88, math: 89, reasoning: 91, creative: 84, chinese: 85 }),
    license: 'Proprietary', isOverall: false, sortOrder: 24,
  },
  {
    modelId: 'claude-opus-4-7#reasoning', modelName: 'Claude Opus 4.7', vendor: 'Anthropic',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1486, arenaRank: 5, scoreCi: 5,
    contextWindow: '1M', maxOutput: '64K', inputPrice: '$5', outputPrice: '$25',
    highlight: '均衡推理,响应速度与深度兼顾',
    capabilities: cap({ coding: 89, math: 90, reasoning: 92, creative: 85, chinese: 86 }),
    license: 'Proprietary', isOverall: false, sortOrder: 25,
  },
  {
    modelId: 'muse-spark-1-1#reasoning', modelName: 'Muse Spark 1.1', vendor: 'Meta',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1485, arenaRank: 6, scoreCi: 9,
    contextWindow: '1M', inputPrice: 'N/A', outputPrice: 'N/A',
    highlight: '开源推理强模型,长链推理稳定',
    capabilities: cap({ coding: 87, math: 88, reasoning: 90, creative: 83, chinese: 80 }),
    license: '开源', isOverall: false, sortOrder: 26,
  },
  {
    modelId: 'muse-spark#reasoning', modelName: 'Muse Spark', vendor: 'Meta',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1479, arenaRank: 7, scoreCi: 7,
    contextWindow: '1M', inputPrice: 'N/A', outputPrice: 'N/A',
    highlight: '初代推理表现扎实,开源生态完善',
    capabilities: cap({ coding: 85, math: 86, reasoning: 88, creative: 81, chinese: 78 }),
    license: '开源', isOverall: false, sortOrder: 27,
  },
  {
    modelId: 'gemini-3-pro#reasoning', modelName: 'Gemini 3 Pro', vendor: 'Google',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1478, arenaRank: 8, scoreCi: 5,
    contextWindow: '2M', maxOutput: '128K', inputPrice: '$2', outputPrice: '$12',
    highlight: '2M 上下文推理,长文档分析强项',
    capabilities: cap({ coding: 86, math: 91, reasoning: 90, creative: 82, chinese: 83 }),
    license: 'Proprietary', isOverall: false, sortOrder: 28,
  },
  {
    modelId: 'kimi-k3#reasoning', modelName: 'Kimi K3', vendor: 'Moonshot',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1478, arenaRank: 9, scoreCi: 12,
    contextWindow: '1M', inputPrice: '开源', outputPrice: '开源',
    highlight: '国产开源推理旗舰,中文推理优秀',
    capabilities: cap({ coding: 86, math: 87, reasoning: 89, creative: 84, chinese: 92 }),
    license: '开源', isOverall: false, sortOrder: 29,
  },
  {
    modelId: 'gpt-5-6-sol-xhigh#reasoning', modelName: 'GPT-5.6 Sol xHigh', vendor: 'OpenAI',
    category: 'llm', subcategory: 'reasoning', arenaScore: 1478, arenaRank: 10, scoreCi: 10,
    contextWindow: '1.05M', maxOutput: '128K', inputPrice: '$5', outputPrice: '$30',
    highlight: 'OpenAI 推理模式,数学竞赛级表现',
    capabilities: cap({ coding: 90, math: 90, reasoning: 91, creative: 81, chinese: 82 }),
    license: 'Proprietary', isOverall: false, sortOrder: 30,
  },
]

// =============================================================================
// 生图模型(image, Text-to-Image)
// =============================================================================

const imageModels: Entry[] = [
  {
    modelId: 'gpt-image-2-medium', modelName: 'GPT Image 2 Medium', vendor: 'OpenAI',
    category: 'image', subcategory: null, arenaScore: 1385, arenaRank: 1, scoreCi: 5,
    highlight: 'OpenAI 旗舰生图,细节还原与文字渲染顶尖',
    capabilities: cap({ coding: 35, math: 30, reasoning: 65, creative: 95, chinese: 70 }),
    license: 'Proprietary', isOverall: false, sortOrder: 31,
  },
  {
    modelId: 'reve-2-1', modelName: 'Reve 2.1', vendor: 'Reve',
    category: 'image', subcategory: null, arenaScore: 1302, arenaRank: 2, scoreCi: 12,
    highlight: '新兴生图黑马,风格化表现突出',
    capabilities: cap({ coding: 32, math: 28, reasoning: 62, creative: 92, chinese: 68 }),
    license: 'Proprietary', isOverall: false, sortOrder: 32,
  },
  {
    modelId: 'muse-image', modelName: 'Muse Image', vendor: 'Meta',
    category: 'image', subcategory: null, arenaScore: 1280, arenaRank: 3, scoreCi: 8,
    highlight: 'Meta 开源生图,编辑能力灵活',
    capabilities: cap({ coding: 34, math: 29, reasoning: 63, creative: 90, chinese: 66 }),
    license: '开源', isOverall: false, sortOrder: 33,
  },
  {
    modelId: 'reve-2-0', modelName: 'Reve 2.0', vendor: 'Reve',
    category: 'image', subcategory: null, arenaScore: 1271, arenaRank: 4, scoreCi: 6,
    highlight: 'Reve 初代,艺术风格多样',
    capabilities: cap({ coding: 30, math: 27, reasoning: 60, creative: 91, chinese: 65 }),
    license: 'Proprietary', isOverall: false, sortOrder: 34,
  },
  {
    modelId: 'gemini-3-1-flash-image', modelName: 'Gemini 3.1 Flash Image', vendor: 'Google',
    category: 'image', subcategory: null, arenaScore: 1261, arenaRank: 5, scoreCi: 7,
    highlight: 'Google 轻量生图,速度快质量稳',
    capabilities: cap({ coding: 33, math: 31, reasoning: 66, creative: 88, chinese: 72 }),
    license: 'Proprietary', isOverall: false, sortOrder: 35,
  },
  {
    modelId: 'mai-image-2-5', modelName: 'MAI Image 2.5', vendor: 'Microsoft AI',
    category: 'image', subcategory: null, arenaScore: 1257, arenaRank: 6, scoreCi: 5,
    highlight: '微软生图模型,商务场景表现佳',
    capabilities: cap({ coding: 31, math: 29, reasoning: 64, creative: 89, chinese: 67 }),
    license: 'Proprietary', isOverall: false, sortOrder: 36,
  },
  {
    modelId: 'gemini-3-1-flash-lite-image', modelName: 'Gemini 3.1 Flash Lite Image', vendor: 'Google',
    category: 'image', subcategory: null, arenaScore: 1250, arenaRank: 7, scoreCi: 8,
    highlight: '极速生图,适合高并发场景',
    capabilities: cap({ coding: 30, math: 28, reasoning: 62, creative: 86, chinese: 70 }),
    license: 'Proprietary', isOverall: false, sortOrder: 37,
  },
  {
    modelId: 'gemini-3-pro-image-2k', modelName: 'Gemini 3 Pro Image 2K', vendor: 'Google',
    category: 'image', subcategory: null, arenaScore: 1245, arenaRank: 8, scoreCi: 3,
    highlight: '2K 高分辨率生图,细节丰富',
    capabilities: cap({ coding: 34, math: 32, reasoning: 68, creative: 91, chinese: 73 }),
    license: 'Proprietary', isOverall: false, sortOrder: 38,
  },
  {
    modelId: 'gpt-image-1-5-high-fidelity', modelName: 'GPT Image 1.5 High Fidelity', vendor: 'OpenAI',
    category: 'image', subcategory: null, arenaScore: 1240, arenaRank: 9, scoreCi: 3,
    highlight: '高保真模式,摄影级真实感',
    capabilities: cap({ coding: 32, math: 30, reasoning: 65, creative: 93, chinese: 68 }),
    license: 'Proprietary', isOverall: false, sortOrder: 39,
  },
  {
    modelId: 'gemini-3-pro-image-preview', modelName: 'Gemini 3 Pro Image Preview', vendor: 'Google',
    category: 'image', subcategory: null, arenaScore: 1232, arenaRank: 10, scoreCi: 5,
    highlight: 'Gemini 生图预览版,多模态融合',
    capabilities: cap({ coding: 33, math: 31, reasoning: 67, creative: 87, chinese: 71 }),
    license: 'Proprietary', isOverall: false, sortOrder: 40,
  },
]

// =============================================================================
// 视频模型(video, Text-to-Video)
// =============================================================================

const videoModels: Entry[] = [
  {
    modelId: 'gemini-omni-flash', modelName: 'Gemini Omni Flash', vendor: 'Google',
    category: 'video', subcategory: null, arenaScore: 1527, arenaRank: 1, scoreCi: 13, voteCount: 5449,
    highlight: 'Google 全能视频生成,运动一致性最佳',
    capabilities: cap({ coding: 35, math: 30, reasoning: 60, creative: 94, chinese: 65 }),
    license: 'Proprietary', isOverall: false, sortOrder: 41,
  },
  {
    modelId: 'dreamina-seedance-2-0-720p', modelName: 'Dreamina Seedance 2.0 720p', vendor: 'Bytedance',
    category: 'video', subcategory: null, arenaScore: 1482, arenaRank: 2, scoreCi: 10, voteCount: 41953,
    highlight: '字节梦境 2.0,国产视频第一,720p 画质',
    capabilities: cap({ coding: 32, math: 28, reasoning: 58, creative: 92, chinese: 75 }),
    license: 'Proprietary', isOverall: false, sortOrder: 42,
  },
  {
    modelId: 'muse-video', modelName: 'Muse Video', vendor: 'Meta',
    category: 'video', subcategory: null, arenaScore: 1459, arenaRank: 3, scoreCi: 15, voteCount: 2152,
    highlight: 'Meta 开源视频,运动控制灵活',
    capabilities: cap({ coding: 34, math: 29, reasoning: 57, creative: 90, chinese: 62 }),
    license: '开源', isOverall: false, sortOrder: 43,
  },
  {
    modelId: 'happyhorse-1-0', modelName: 'HappyHorse 1.0', vendor: 'Alibaba-ATH',
    category: 'video', subcategory: null, arenaScore: 1430, arenaRank: 4, scoreCi: 13, voteCount: 21985,
    highlight: '阿里通义万相视频,角色一致性强',
    capabilities: cap({ coding: 33, math: 27, reasoning: 56, creative: 89, chinese: 74 }),
    license: 'Proprietary', isOverall: false, sortOrder: 44,
  },
  {
    modelId: 'sora-2-pro', modelName: 'Sora 2 Pro', vendor: 'OpenAI',
    category: 'video', subcategory: null, arenaScore: 1366, arenaRank: 5, scoreCi: 8, voteCount: 39773,
    highlight: 'OpenAI 视频旗舰,物理模拟逼真',
    capabilities: cap({ coding: 36, math: 32, reasoning: 62, creative: 93, chinese: 66 }),
    license: 'Proprietary', isOverall: false, sortOrder: 45,
  },
  {
    modelId: 'veo-3-1-audio-1080p', modelName: 'Veo 3.1 Audio 1080p', vendor: 'Google',
    category: 'video', subcategory: null, arenaScore: 1364, arenaRank: 6, scoreCi: 11, voteCount: 23200,
    highlight: 'Google Veo 3.1,原生音频+1080p',
    capabilities: cap({ coding: 35, math: 31, reasoning: 61, creative: 91, chinese: 68 }),
    license: 'Proprietary', isOverall: false, sortOrder: 46,
  },
  {
    modelId: 'veo-3-1-audio', modelName: 'Veo 3.1 Audio', vendor: 'Google',
    category: 'video', subcategory: null, arenaScore: 1364, arenaRank: 7, scoreCi: 14, voteCount: 13691,
    highlight: 'Veo 3.1 标准版,音画同步生成',
    capabilities: cap({ coding: 34, math: 30, reasoning: 60, creative: 90, chinese: 67 }),
    license: 'Proprietary', isOverall: false, sortOrder: 47,
  },
  {
    modelId: 'veo-3-1-fast-audio', modelName: 'Veo 3.1 Fast Audio', vendor: 'Google',
    category: 'video', subcategory: null, arenaScore: 1362, arenaRank: 8, scoreCi: 11, voteCount: 39333,
    highlight: '快速生成模式,适合迭代调试',
    capabilities: cap({ coding: 33, math: 29, reasoning: 59, creative: 88, chinese: 66 }),
    license: 'Proprietary', isOverall: false, sortOrder: 48,
  },
  {
    modelId: 'veo-3-1-fast-audio-1080p', modelName: 'Veo 3.1 Fast Audio 1080p', vendor: 'Google',
    category: 'video', subcategory: null, arenaScore: 1360, arenaRank: 9, scoreCi: 10, voteCount: 23506,
    highlight: '快速+高清,兼顾速度与画质',
    capabilities: cap({ coding: 34, math: 30, reasoning: 60, creative: 89, chinese: 67 }),
    license: 'Proprietary', isOverall: false, sortOrder: 49,
  },
  {
    modelId: 'grok-imagine-video-720p', modelName: 'Grok Imagine Video 720p', vendor: 'SpaceXAI',
    category: 'video', subcategory: null, arenaScore: 1352, arenaRank: 10, scoreCi: 8, voteCount: 144437,
    highlight: 'xAI 视频生成,投票数最高,风格独特',
    capabilities: cap({ coding: 32, math: 28, reasoning: 57, creative: 90, chinese: 64 }),
    license: 'Proprietary', isOverall: false, sortOrder: 50,
  },
]

// =============================================================================
// 多模态模型(multimodal, Vision)
// =============================================================================

const multimodalModels: Entry[] = [
  {
    modelId: 'claude-fable-5', modelName: 'Claude Fable 5', vendor: 'Anthropic',
    category: 'multimodal', subcategory: null, arenaScore: 1318, arenaRank: 1, scoreCi: 9, voteCount: 7411,
    contextWindow: '1M', inputPrice: '$10', outputPrice: '$50',
    highlight: '视觉理解+推理双强,图表分析顶尖',
    capabilities: cap({ coding: 90, math: 85, reasoning: 92, creative: 85, chinese: 88 }),
    license: 'Proprietary', isOverall: false, sortOrder: 51,
  },
  {
    modelId: 'claude-opus-4-7-thinking', modelName: 'Claude Opus 4.7 Thinking', vendor: 'Anthropic',
    category: 'multimodal', subcategory: null, arenaScore: 1306, arenaRank: 2, scoreCi: 7, voteCount: 19381,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: '视觉推理深度强,复杂图表解析优秀',
    capabilities: cap({ coding: 88, math: 86, reasoning: 91, creative: 83, chinese: 87 }),
    license: 'Proprietary', isOverall: false, sortOrder: 52,
  },
  {
    modelId: 'claude-opus-4-6-thinking', modelName: 'Claude Opus 4.6 Thinking', vendor: 'Anthropic',
    category: 'multimodal', subcategory: null, arenaScore: 1299, arenaRank: 3, scoreCi: 7, voteCount: 19223,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: '多模态推理稳定,OCR+理解一体化',
    capabilities: cap({ coding: 87, math: 85, reasoning: 90, creative: 82, chinese: 86 }),
    license: 'Proprietary', isOverall: false, sortOrder: 53,
  },
  {
    modelId: 'claude-opus-4-7', modelName: 'Claude Opus 4.7', vendor: 'Anthropic',
    category: 'multimodal', subcategory: null, arenaScore: 1298, arenaRank: 4, scoreCi: 7, voteCount: 19867,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: '标准版多模态,响应快理解准',
    capabilities: cap({ coding: 86, math: 84, reasoning: 89, creative: 84, chinese: 87 }),
    license: 'Proprietary', isOverall: false, sortOrder: 54,
  },
  {
    modelId: 'claude-opus-4-6', modelName: 'Claude Opus 4.6', vendor: 'Anthropic',
    category: 'multimodal', subcategory: null, arenaScore: 1295, arenaRank: 5, scoreCi: 7, voteCount: 23584,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: '投票数最高,视觉理解口碑好',
    capabilities: cap({ coding: 85, math: 83, reasoning: 88, creative: 83, chinese: 85 }),
    license: 'Proprietary', isOverall: false, sortOrder: 55,
  },
  {
    modelId: 'muse-spark', modelName: 'Muse Spark', vendor: 'Meta',
    category: 'multimodal', subcategory: null, arenaScore: 1294, arenaRank: 6, scoreCi: 9, voteCount: 5625,
    contextWindow: '1M',
    highlight: '开源多模态,图像理解全面',
    capabilities: cap({ coding: 84, math: 82, reasoning: 86, creative: 82, chinese: 80 }),
    license: '开源', isOverall: false, sortOrder: 56,
  },
  {
    modelId: 'gemini-3-pro', modelName: 'Gemini 3 Pro', vendor: 'Google',
    category: 'multimodal', subcategory: null, arenaScore: 1289, arenaRank: 7, scoreCi: 8, voteCount: 13183,
    contextWindow: '1M', inputPrice: '$2', outputPrice: '$12',
    highlight: '原生多模态,视频理解能力强',
    capabilities: cap({ coding: 86, math: 88, reasoning: 88, creative: 83, chinese: 84 }),
    license: 'Proprietary', isOverall: false, sortOrder: 57,
  },
  {
    modelId: 'gemini-3-5-flash-medium', modelName: 'Gemini 3.5 Flash Medium', vendor: 'Google',
    category: 'multimodal', subcategory: null, arenaScore: 1287, arenaRank: 8, scoreCi: 11, voteCount: 4232,
    contextWindow: '1M', inputPrice: '$1.5', outputPrice: '$9',
    highlight: '高性价比多模态,速度快',
    capabilities: cap({ coding: 83, math: 85, reasoning: 85, creative: 80, chinese: 82 }),
    license: 'Proprietary', isOverall: false, sortOrder: 58,
  },
  {
    modelId: 'gpt-5-5', modelName: 'GPT-5.5', vendor: 'OpenAI',
    category: 'multimodal', subcategory: null, arenaScore: 1286, arenaRank: 9, scoreCi: 7, voteCount: 17412,
    contextWindow: '1.1M', inputPrice: '$5', outputPrice: '$30',
    highlight: 'OpenAI 多模态旗舰,图文混合理解强',
    capabilities: cap({ coding: 87, math: 86, reasoning: 87, creative: 82, chinese: 83 }),
    license: 'Proprietary', isOverall: false, sortOrder: 59,
  },
  {
    modelId: 'claude-opus-4-8-thinking', modelName: 'Claude Opus 4.8 Thinking', vendor: 'Anthropic',
    category: 'multimodal', subcategory: null, arenaScore: 1286, arenaRank: 10, scoreCi: 8, voteCount: 9956,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: 'Opus 4.8 多模态推理,新一代视觉理解',
    capabilities: cap({ coding: 88, math: 87, reasoning: 92, creative: 81, chinese: 85 }),
    license: 'Proprietary', isOverall: false, sortOrder: 60,
  },
]

// =============================================================================
// Agent 智能体(agent)
// arenaScore = netImprovement * 100;winRate = netImprovement;voteCount = sessions
// =============================================================================

const agentModels: Entry[] = [
  {
    modelId: 'claude-fable-5-high', modelName: 'Claude Fable 5 High', vendor: 'Anthropic',
    category: 'agent', subcategory: null, arenaScore: 1394, arenaRank: 1, scoreCi: 8,
    winRate: 13.94, voteCount: 16059,
    contextWindow: '1M', inputPrice: '$10', outputPrice: '$50',
    highlight: 'Agent 净提升 13.94% 居首,复杂任务规划最强',
    capabilities: cap({ coding: 95, math: 82, reasoning: 94, creative: 78, chinese: 85 }),
    license: 'Proprietary', isOverall: false, sortOrder: 61,
  },
  {
    modelId: 'gpt-5-6-sol-xhigh', modelName: 'GPT-5.6 Sol xHigh', vendor: 'OpenAI',
    category: 'agent', subcategory: null, arenaScore: 1094, arenaRank: 2, scoreCi: 9,
    winRate: 10.94, voteCount: 7881,
    contextWindow: '1.05M', inputPrice: '$5', outputPrice: '$30',
    highlight: 'Agent 净提升 10.94%,代码任务自动化出色',
    capabilities: cap({ coding: 93, math: 80, reasoning: 90, creative: 72, chinese: 80 }),
    license: 'Proprietary', isOverall: false, sortOrder: 62,
  },
  {
    modelId: 'claude-opus-4-8-thinking', modelName: 'Claude Opus 4.8 Thinking', vendor: 'Anthropic',
    category: 'agent', subcategory: null, arenaScore: 928, arenaRank: 3, scoreCi: 5,
    winRate: 9.28, voteCount: 33392,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: 'Agent 净提升 9.28%,会话数高口碑好',
    capabilities: cap({ coding: 92, math: 84, reasoning: 93, creative: 75, chinese: 83 }),
    license: 'Proprietary', isOverall: false, sortOrder: 63,
  },
  {
    modelId: 'gpt-5-5-xhigh', modelName: 'GPT-5.5 xHigh', vendor: 'OpenAI',
    category: 'agent', subcategory: null, arenaScore: 826, arenaRank: 4, scoreCi: 6,
    winRate: 8.26, voteCount: 36289,
    contextWindow: '1.1M', inputPrice: '$5', outputPrice: '$30',
    highlight: 'Agent 净提升 8.26%,工具调用稳定',
    capabilities: cap({ coding: 90, math: 78, reasoning: 88, creative: 70, chinese: 78 }),
    license: 'Proprietary', isOverall: false, sortOrder: 64,
  },
  {
    modelId: 'claude-sonnet-5-high', modelName: 'Claude Sonnet 5 High', vendor: 'Anthropic',
    category: 'agent', subcategory: null, arenaScore: 800, arenaRank: 5, scoreCi: 6,
    winRate: 8.0, voteCount: 23640,
    contextWindow: '1M', inputPrice: '$3', outputPrice: '$15',
    highlight: 'Agent 净提升 8.0%,高性价比智能体首选',
    capabilities: cap({ coding: 89, math: 76, reasoning: 87, creative: 74, chinese: 82 }),
    license: 'Proprietary', isOverall: false, sortOrder: 65,
  },
  {
    modelId: 'claude-opus-4-7-thinking', modelName: 'Claude Opus 4.7 Thinking', vendor: 'Anthropic',
    category: 'agent', subcategory: null, arenaScore: 773, arenaRank: 6, scoreCi: 5,
    winRate: 7.73, voteCount: 34357,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: 'Agent 净提升 7.73%,推理型任务表现稳',
    capabilities: cap({ coding: 91, math: 83, reasoning: 92, creative: 73, chinese: 84 }),
    license: 'Proprietary', isOverall: false, sortOrder: 66,
  },
  {
    modelId: 'claude-opus-4-7', modelName: 'Claude Opus 4.7', vendor: 'Anthropic',
    category: 'agent', subcategory: null, arenaScore: 763, arenaRank: 7, scoreCi: 5,
    winRate: 7.63, voteCount: 34950,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: 'Agent 净提升 7.63%,会话数最高',
    capabilities: cap({ coding: 88, math: 80, reasoning: 88, creative: 75, chinese: 83 }),
    license: 'Proprietary', isOverall: false, sortOrder: 67,
  },
  {
    modelId: 'gpt-5-5-high', modelName: 'GPT-5.5 High', vendor: 'OpenAI',
    category: 'agent', subcategory: null, arenaScore: 716, arenaRank: 8, scoreCi: 5,
    winRate: 7.16, voteCount: 61455,
    contextWindow: '1.1M', inputPrice: '$5', outputPrice: '$30',
    highlight: 'Agent 净提升 7.16%,会话数遥遥领先',
    capabilities: cap({ coding: 87, math: 77, reasoning: 86, creative: 71, chinese: 77 }),
    license: 'Proprietary', isOverall: false, sortOrder: 68,
  },
  {
    modelId: 'glm-5-2-max', modelName: 'GLM-5.2 Max', vendor: 'Z.ai',
    category: 'agent', subcategory: null, arenaScore: 624, arenaRank: 9, scoreCi: 10,
    winRate: 6.24,
    contextWindow: '128K', inputPrice: '¥3', outputPrice: '¥6',
    highlight: '国产 Agent 第一,净提升 6.24%',
    capabilities: cap({ coding: 86, math: 75, reasoning: 85, creative: 72, chinese: 90 }),
    license: 'Proprietary', isOverall: false, sortOrder: 69,
  },
  {
    modelId: 'glm-5-1', modelName: 'GLM-5.1', vendor: 'Z.ai',
    category: 'agent', subcategory: null, arenaScore: 186, arenaRank: 10, scoreCi: 12,
    winRate: 1.86,
    contextWindow: '128K', inputPrice: '¥3', outputPrice: '¥6',
    highlight: '智谱初代 Agent,净提升 1.86%',
    capabilities: cap({ coding: 84, math: 73, reasoning: 82, creative: 70, chinese: 92 }),
    license: 'Proprietary', isOverall: false, sortOrder: 70,
  },
]

// =============================================================================
// 语音模型(audio)
// =============================================================================

const audioModels: Entry[] = [
  {
    modelId: 'eleven-multilingual-v2', modelName: 'Eleven Multilingual v2', vendor: 'ElevenLabs',
    category: 'audio', subcategory: null, arenaScore: 1420, arenaRank: 1, scoreCi: 6, voteCount: 50000,
    highlight: 'ElevenLabs 旗舰,多语言语音自然度顶尖',
    capabilities: cap({ coding: 30, math: 28, reasoning: 35, creative: 90, chinese: 60 }),
    license: 'Proprietary', isOverall: false, sortOrder: 71,
  },
  {
    modelId: 'openai-tts-hd', modelName: 'OpenAI TTS HD', vendor: 'OpenAI',
    category: 'audio', subcategory: null, arenaScore: 1395, arenaRank: 2, scoreCi: 5, voteCount: 80000,
    highlight: 'OpenAI 高清语音合成,音质清晰',
    capabilities: cap({ coding: 32, math: 30, reasoning: 38, creative: 88, chinese: 55 }),
    license: 'Proprietary', isOverall: false, sortOrder: 72,
  },
  {
    modelId: 'azure-tts-neural', modelName: 'Azure TTS Neural', vendor: 'Microsoft',
    category: 'audio', subcategory: null, arenaScore: 1380, arenaRank: 3, scoreCi: 5, voteCount: 120000,
    highlight: '微软神经语音,企业级稳定,中文支持好',
    capabilities: cap({ coding: 31, math: 29, reasoning: 36, creative: 86, chinese: 65 }),
    license: 'Proprietary', isOverall: false, sortOrder: 73,
  },
  {
    modelId: 'gemini-tts-pro', modelName: 'Gemini TTS Pro', vendor: 'Google',
    category: 'audio', subcategory: null, arenaScore: 1365, arenaRank: 4, scoreCi: 7, voteCount: 30000,
    highlight: 'Google 语音合成,情感表达丰富',
    capabilities: cap({ coding: 33, math: 31, reasoning: 40, creative: 87, chinese: 58 }),
    license: 'Proprietary', isOverall: false, sortOrder: 74,
  },
  {
    modelId: 'minimax-voice', modelName: 'MiniMax Voice', vendor: 'MiniMax',
    category: 'audio', subcategory: null, arenaScore: 1350, arenaRank: 5, scoreCi: 8, voteCount: 25000,
    highlight: '国产语音合成,中文拟真度高',
    capabilities: cap({ coding: 30, math: 28, reasoning: 35, creative: 85, chinese: 88 }),
    license: 'Proprietary', isOverall: false, sortOrder: 75,
  },
]

// =============================================================================
// 嵌入模型(embedding)
// =============================================================================

const embeddingModels: Entry[] = [
  {
    modelId: 'text-embedding-3-large', modelName: 'Text Embedding 3 Large', vendor: 'OpenAI',
    category: 'embedding', subcategory: null, arenaScore: 1450, arenaRank: 1, scoreCi: 5,
    contextWindow: '8K',
    highlight: 'OpenAI 旗舰嵌入,8192 维,检索精度最高',
    capabilities: cap({ coding: 65, math: 72, reasoning: 68, creative: 60, chinese: 65 }),
    license: 'Proprietary', isOverall: false, sortOrder: 76,
  },
  {
    modelId: 'voyage-3-large', modelName: 'Voyage 3 Large', vendor: 'Voyage AI',
    category: 'embedding', subcategory: null, arenaScore: 1430, arenaRank: 2, scoreCi: 6,
    highlight: 'Voyage AI 旗舰,RAG 检索优化强',
    capabilities: cap({ coding: 64, math: 70, reasoning: 67, creative: 58, chinese: 63 }),
    license: 'Proprietary', isOverall: false, sortOrder: 77,
  },
  {
    modelId: 'cohere-embed-v4', modelName: 'Cohere Embed v4', vendor: 'Cohere',
    category: 'embedding', subcategory: null, arenaScore: 1410, arenaRank: 3, scoreCi: 6,
    highlight: 'Cohere 嵌入 v4,多语言支持好',
    capabilities: cap({ coding: 62, math: 68, reasoning: 65, creative: 57, chinese: 62 }),
    license: 'Proprietary', isOverall: false, sortOrder: 78,
  },
  {
    modelId: 'bge-m3', modelName: 'BGE-M3', vendor: 'BAAI',
    category: 'embedding', subcategory: null, arenaScore: 1390, arenaRank: 4, scoreCi: 8,
    highlight: '智源开源嵌入,多语言+长文本',
    capabilities: cap({ coding: 63, math: 67, reasoning: 64, creative: 56, chinese: 72 }),
    license: '开源', isOverall: false, sortOrder: 79,
  },
  {
    modelId: 'gemini-embedding-exp', modelName: 'Gemini Embedding Exp', vendor: 'Google',
    category: 'embedding', subcategory: null, arenaScore: 1370, arenaRank: 5, scoreCi: 7,
    highlight: 'Google 实验性嵌入,性能前沿',
    capabilities: cap({ coding: 61, math: 66, reasoning: 63, creative: 55, chinese: 60 }),
    license: 'Proprietary', isOverall: false, sortOrder: 80,
  },
]

// =============================================================================
// 总榜(overall)
// category='overall',isOverall=true;按统一归一化分数排序。
// 注:claude-fable-5 重复(LLM#1 + Multimodal#4),#4 被 onConflictDoNothing 跳过 → 9 条。
// =============================================================================

const overallModels: Entry[] = [
  {
    modelId: 'claude-fable-5', modelName: 'Claude Fable 5', vendor: 'Anthropic',
    category: 'overall', subcategory: null, arenaScore: 1507, arenaRank: 1, scoreCi: 7,
    contextWindow: '1M', inputPrice: '$10', outputPrice: '$50',
    highlight: '总榜第一,LLM 通用冠军,综合能力全面领先',
    capabilities: cap({ coding: 95, math: 90, reasoning: 94, creative: 88, chinese: 90 }),
    license: 'Proprietary', isOverall: true, sortOrder: 91,
  },
  {
    modelId: 'gpt-image-2-medium', modelName: 'GPT Image 2 Medium', vendor: 'OpenAI',
    category: 'overall', subcategory: null, arenaScore: 1500, arenaRank: 2, scoreCi: 5,
    highlight: '总榜第二,生图冠军,归一化分 1500',
    capabilities: cap({ coding: 35, math: 30, reasoning: 65, creative: 95, chinese: 70 }),
    license: 'Proprietary', isOverall: true, sortOrder: 92,
  },
  {
    modelId: 'gemini-omni-flash', modelName: 'Gemini Omni Flash', vendor: 'Google',
    category: 'overall', subcategory: null, arenaScore: 1527, arenaRank: 3, scoreCi: 13, voteCount: 5449,
    highlight: '总榜第三,视频生成冠军,运动一致性最佳',
    capabilities: cap({ coding: 35, math: 30, reasoning: 60, creative: 94, chinese: 65 }),
    license: 'Proprietary', isOverall: true, sortOrder: 93,
  },
  // #4 claude-fable-5 (Multimodal) 与 #1 冲突 → onConflictDoNothing 跳过
  {
    modelId: 'claude-fable-5-high', modelName: 'Claude Fable 5 High', vendor: 'Anthropic',
    category: 'overall', subcategory: null, arenaScore: 1394, arenaRank: 4, scoreCi: 8,
    winRate: 13.94, voteCount: 16059,
    contextWindow: '1M', inputPrice: '$10', outputPrice: '$50',
    highlight: '总榜第四,Agent 冠军,净提升 13.94%',
    capabilities: cap({ coding: 95, math: 82, reasoning: 94, creative: 78, chinese: 85 }),
    license: 'Proprietary', isOverall: true, sortOrder: 94,
  },
  {
    modelId: 'claude-opus-4-6-thinking', modelName: 'Claude Opus 4.6 Thinking', vendor: 'Anthropic',
    category: 'overall', subcategory: null, arenaScore: 1504, arenaRank: 5, scoreCi: 4,
    contextWindow: '1M', inputPrice: '$5', outputPrice: '$25',
    highlight: '总榜第五,LLM 通用亚军,深度推理强项',
    capabilities: cap({ coding: 93, math: 92, reasoning: 95, creative: 84, chinese: 88 }),
    license: 'Proprietary', isOverall: true, sortOrder: 95,
  },
  {
    modelId: 'dreamina-seedance-2-0-720p', modelName: 'Dreamina Seedance 2.0 720p', vendor: 'Bytedance',
    category: 'overall', subcategory: null, arenaScore: 1482, arenaRank: 6, scoreCi: 10, voteCount: 41953,
    highlight: '总榜第六,视频亚军,国产视频第一',
    capabilities: cap({ coding: 32, math: 28, reasoning: 58, creative: 92, chinese: 75 }),
    license: 'Proprietary', isOverall: true, sortOrder: 96,
  },
  {
    modelId: 'eleven-multilingual-v2', modelName: 'Eleven Multilingual v2', vendor: 'ElevenLabs',
    category: 'overall', subcategory: null, arenaScore: 1420, arenaRank: 7, scoreCi: 6, voteCount: 50000,
    highlight: '总榜第七,语音冠军,多语言自然度顶尖',
    capabilities: cap({ coding: 30, math: 28, reasoning: 35, creative: 90, chinese: 60 }),
    license: 'Proprietary', isOverall: true, sortOrder: 97,
  },
  {
    modelId: 'text-embedding-3-large', modelName: 'Text Embedding 3 Large', vendor: 'OpenAI',
    category: 'overall', subcategory: null, arenaScore: 1450, arenaRank: 8, scoreCi: 5,
    contextWindow: '8K',
    highlight: '总榜第八,嵌入冠军,8192 维检索精度最高',
    capabilities: cap({ coding: 65, math: 72, reasoning: 68, creative: 60, chinese: 65 }),
    license: 'Proprietary', isOverall: true, sortOrder: 98,
  },
  {
    modelId: 'gpt-5-6-sol-xhigh', modelName: 'GPT-5.6 Sol xHigh', vendor: 'OpenAI',
    category: 'overall', subcategory: null, arenaScore: 1486, arenaRank: 9, scoreCi: 9,
    contextWindow: '1.05M', inputPrice: '$5', outputPrice: '$30',
    highlight: '总榜第九,LLM 通用季军,编程特化型号',
    capabilities: cap({ coding: 92, math: 88, reasoning: 89, creative: 83, chinese: 84 }),
    license: 'Proprietary', isOverall: true, sortOrder: 99,
  },
]

// =============================================================================
// 汇总 + seed 函数
// =============================================================================

const entries: Entry[] = [
  ...llmGeneral,
  ...llmCoding,
  ...llmReasoning,
  ...imageModels,
  ...videoModels,
  ...multimodalModels,
  ...agentModels,
  ...audioModels,
  ...embeddingModels,
  ...overallModels,
]

export async function seedLeaderboard() {
  console.log(`[seed] leaderboard: 开始导入 ${entries.length} 条排行榜数据...`)
  await db
    .insert(modelLeaderboard)
    .values(entries)
    .onConflictDoNothing({ target: [modelLeaderboard.modelId, modelLeaderboard.category] })
  console.log(`[seed] leaderboard: ${entries.length} 条导入完成`)
}