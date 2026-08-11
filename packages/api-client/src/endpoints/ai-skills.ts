import { fetchApi } from '../client'

/**
 * AI Skills TOP API(2026-07-23 新增,对应后端 /api/ai-skills)
 *
 * 包含 19 个 skill 元数据 + 调用入口:
 * - 10 个 CODEX 自媒体必装(agent-reach / horizon / media-crawler / hugshu-design / auto-redbook-skills /
 *   generative-media-skills / nuwa-skill / guizang-social-card-skill / social-auto-upload + media-crawler 复盘)
 * - 9 个 GitHub 本周热门(superpowers / caveman / graphify / agent-skills / awesome-claude-skills /
 *   taste-skill / obsidian-skills / claude-plugins-official / awesome-agent-skills / guizang-ppt-skill)
 *
 * 4 个真集成可调用(nuwa-skill / hugshu-design / auto-redbook-skills / guizang-ppt-skill),
 * 其余 15 个以元数据 + GitHub 链接占位。
 */

export interface AiSkillMeta {
  id: string
  name: string
  description: string
  icon: string
  category: 'code' | 'media' | 'ai-top'
  tags: string[]
  source: 'builtin' | 'auto' | 'ai-top'
  sourceUrl: string
  available: boolean
  promptTemplate: string
}

export interface AiSkillInvokeRequest {
  /** 变量对应 skill prompt_template 的 {key} 形参 */
  variables: Record<string, unknown>
  /** 指定模型(空走默认) */
  model?: string
  /** 用户 UUID(私有模型配置) */
  ownerUuid?: string
}

export interface AiSkillInvokeResponse {
  skillId: string
  ok: boolean
  available: boolean
  content: string
  /** text | html | json */
  contentType: 'text' | 'html' | 'json'
  /** 占位 skill 的引导文本 */
  guidance: string
  sourceUrl: string
  error: string | null
  duration_ms: number
  model: string
}

/** 列出 AI Skills。可传 category 筛选(默认 ai-top,传 'all' 返回全部)。 */
export function listAiSkills(params?: { category?: string }) {
  const qs = params?.category ? `?category=${encodeURIComponent(params.category)}` : ''
  return fetchApi<AiSkillMeta[]>(`/api/ai-skills${qs}`)
}

/** 推荐结果项 */
export interface AiSkillRecommendation {
  skill_id: string
  name: string
  description: string
  icon: string
  category: string
  tags: string[]
  score: number
  reason: string
  available: boolean
}

/** 获取 AI Skill 推荐列表(2026-08-09 新增,Phase 1) */
export function getAiSkillRecommendations(params?: { context?: string; top_k?: number }) {
  const qs = new URLSearchParams()
  if (params?.context) qs.set('context', params.context)
  if (params?.top_k) qs.set('top_k', String(params.top_k))
  const qstr = qs.toString()
  return fetchApi<AiSkillRecommendation[]>(`/api/ai-skills/recommendations${qstr ? `?${qstr}` : ''}`)
}

/** 获取单个 AI Skill 详情 */
export function getAiSkill(skillId: string) {
  return fetchApi<AiSkillMeta>(`/api/ai-skills/${encodeURIComponent(skillId)}`)
}

/** 调用 AI Skill(真集成 4 个可调,其余 15 个返回 ok=false + guidance) */
export function invokeAiSkill(skillId: string, req: AiSkillInvokeRequest) {
  return fetchApi<AiSkillInvokeResponse>(`/api/ai-skills/${encodeURIComponent(skillId)}/invoke`, {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

// ===== Phase 3: Stats (2026-08-11 新增) =====

export interface PerSkillStats {
  skillName: string
  callCount: number
  successCount: number
  successRate: number
  avgDurationMs: number
}

export interface TrendDay {
  date: string
  calls: number
  success: number
  failures: number
}

export interface AiSkillStatsData {
  totalCalls: number
  successRate: number
  avgDurationMs: number
  totalTokens: number
  perSkill: PerSkillStats[]
  trend: {
    last7Days: TrendDay[]
    last30Days: TrendDay[]
  }
}

/** 获取 AI Skill 使用统计(Phase 3) */
export function getAiSkillStats() {
  return fetchApi<AiSkillStatsData>('/api/ai-skills/stats')
}

// ===== Phase 4: Export/Import/Rate (2026-08-11 新增) =====

export interface SkillExportData {
  name: string
  description: string
  icon: string
  category: string
  tags: string[]
  source: string
  promptTemplate: string
  sourceUrl: string
}

export interface SkillImportData {
  name: string
  description?: string
  icon?: string
  category?: string
  tags?: string[]
  promptTemplate?: string
  sourceUrl?: string
}

export interface SkillImportResult {
  id: string
  name: string
  description: string
  icon: string
  category: string
  tags: string[]
  source: string
  promptTemplate: string
  sourceUrl: string
}

export interface RatingRecord {
  skillId: string
  rating: number
  comment: string
  createdAt: string
}

export interface RatingStats {
  average: number
  total: number
  distribution: Record<number, number>
}

export interface SkillRatingsData {
  ratings: RatingRecord[]
  stats: RatingStats
}

/** 导出 AI Skill 为 JSON */
export function exportAiSkill(skillId: string) {
  return fetchApi<SkillExportData>(`/api/ai-skills/export/${encodeURIComponent(skillId)}`, {
    method: 'POST',
  })
}

/** 导入 AI Skill */
export function importAiSkill(data: SkillImportData) {
  return fetchApi<SkillImportResult>('/api/ai-skills/import', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 评分 AI Skill(1-5 星) */
export function rateAiSkill(skillId: string, rating: number, comment?: string) {
  return fetchApi<RatingRecord>(`/api/ai-skills/${encodeURIComponent(skillId)}/rate`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  })
}

/** 获取 AI Skill 评分列表 */
export function getAiSkillRatings(skillId: string) {
  return fetchApi<SkillRatingsData>(`/api/ai-skills/${encodeURIComponent(skillId)}/ratings`)
}
