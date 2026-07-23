import { fetchApi } from '../client.js'

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

/** 列出全部 19 个 AI Skills TOP */
export function listAiSkills() {
  return fetchApi<AiSkillMeta[]>('/api/ai-skills')
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
