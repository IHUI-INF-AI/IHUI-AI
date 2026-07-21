import { fetchApi } from '../client.js'

/**
 * 用户自定义 AI 对话框技能 API(对应后端 /api/chat/skills)
 * 2026-07-21 新增:Skill 库后端 CRUD
 */

export type ChatSkillCategory = 'template' | 'slash' | 'self-media' | 'openclaw' | 'mcp' | 'custom'
export type ChatSkillScenario = 'writing' | 'coding' | 'media' | 'tool' | 'custom'

export interface ChatSkill {
  id: string
  userId: string
  name: string
  category: ChatSkillCategory
  scenario: ChatSkillScenario
  prompt: string
  icon: string | null
  sortOrder: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ChatSkillInput {
  name: string
  category?: ChatSkillCategory
  scenario?: ChatSkillScenario
  prompt: string
  icon?: string | null
  sortOrder?: number
  enabled?: boolean
}

export interface ChatSkillUpdate {
  name?: string
  category?: ChatSkillCategory
  scenario?: ChatSkillScenario
  prompt?: string
  icon?: string | null
  sortOrder?: number
  enabled?: boolean
}

/** 列出当前用户的所有技能 */
export function listChatSkills() {
  return fetchApi<{ skills: ChatSkill[]; total: number }>('/api/chat/skills')
}

/** 创建一条新技能 */
export function createChatSkill(input: ChatSkillInput) {
  return fetchApi<{ skill: ChatSkill }>('/api/chat/skills', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新一条技能(部分字段) */
export function updateChatSkill(id: string, patch: ChatSkillUpdate) {
  return fetchApi<{ skill: ChatSkill }>(`/api/chat/skills/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

/** 删除一条技能 */
export function deleteChatSkill(id: string) {
  return fetchApi<{ deleted: boolean }>(`/api/chat/skills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
