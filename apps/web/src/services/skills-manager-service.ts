/**
 * 技能管理服务（合并版）
 *
 * 合并自旧架构 services/skills-manager.ts。
 * 新架构基于 fetchApi 与纯 TypeScript，无 Vue 依赖。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

/* ------------------------------------------------------------------ */
/* 类型定义                                                            */
/* ------------------------------------------------------------------ */

export type SkillCategory =
  'productivity' | 'communication' | 'automation' | 'analytics' | 'integration' | 'custom'

export type SkillStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'offline'

export interface Skill {
  id: string
  name: string
  displayName: string
  description: string
  category: SkillCategory
  version: string
  author: { id: string; nickname: string; avatar: string | null }
  status: SkillStatus
  isOfficial: boolean
  isPublic: boolean
  icon: string | null
  entrypoint: string
  config: Record<string, unknown>
  capabilities: string[]
  dependencies: Array<{ skillId: string; versionRange: string }>
  tags: string[]
  installCount: number
  rating: number
  ratingCount: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface SkillVersion {
  version: string
  changelog: string
  publishedAt: string
  breaking: boolean
  downloadUrl: string
}

export interface SkillReview {
  id: string
  skillId: string
  userId: string
  userNickname: string
  userAvatar: string | null
  rating: number
  content: string
  createdAt: string
}

export interface SkillQuery {
  page?: number
  pageSize?: number
  keyword?: string
  category?: SkillCategory
  status?: SkillStatus
  tag?: string
  official?: boolean
  sort?: 'popular' | 'newest' | 'rating' | 'updated'
}

export interface SkillInput {
  name: string
  displayName: string
  description: string
  category: SkillCategory
  icon?: string
  entrypoint: string
  config?: Record<string, unknown>
  capabilities?: string[]
  dependencies?: Skill['dependencies']
  tags?: string[]
  isPublic?: boolean
}

export interface InstalledSkill {
  id: string
  skillId: string
  userId: string
  version: string
  enabled: boolean
  config: Record<string, unknown>
  installedAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* 技能 CRUD                                                           */
/* ------------------------------------------------------------------ */

export async function getSkills(query: SkillQuery = {}): Promise<ApiResult<PageData<Skill>>> {
  return fetchApi<PageData<Skill>>(`/skills${buildQs(query)}`)
}

export async function getSkillById(id: string): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>(`/skills/${encodeURIComponent(id)}`)
}

export async function createSkill(input: SkillInput): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>('/skills', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateSkill(
  id: string,
  input: Partial<SkillInput>,
): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>(`/skills/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteSkill(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/skills/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

/* ------------------------------------------------------------------ */
/* 审核 / 发布                                                         */
/* ------------------------------------------------------------------ */

export async function submitForReview(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/skills/${encodeURIComponent(id)}/submit-review`, {
    method: 'POST',
  })
}

export async function publishSkill(
  id: string,
  version: string,
  changelog: string,
): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>(`/skills/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: JSON.stringify({ version, changelog }),
  })
}

export async function offlineSkill(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/skills/${encodeURIComponent(id)}/offline`, {
    method: 'POST',
  })
}

/* ------------------------------------------------------------------ */
/* 版本管理                                                            */
/* ------------------------------------------------------------------ */

export async function listVersions(id: string): Promise<ApiResult<SkillVersion[]>> {
  return fetchApi<SkillVersion[]>(`/skills/${encodeURIComponent(id)}/versions`)
}

export async function rollbackVersion(id: string, version: string): Promise<ApiResult<Skill>> {
  return fetchApi<Skill>(`/skills/${encodeURIComponent(id)}/rollback`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  })
}

/* ------------------------------------------------------------------ */
/* 安装 / 卸载 / 启用                                                  */
/* ------------------------------------------------------------------ */

export async function installSkill(
  id: string,
  version?: string,
  config?: Record<string, unknown>,
): Promise<ApiResult<InstalledSkill>> {
  return fetchApi<InstalledSkill>(`/skills/${encodeURIComponent(id)}/install`, {
    method: 'POST',
    body: JSON.stringify({ version, config }),
  })
}

export async function uninstallSkill(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/skills/${encodeURIComponent(id)}/uninstall`, {
    method: 'DELETE',
  })
}

export async function listInstalledSkills(): Promise<ApiResult<InstalledSkill[]>> {
  return fetchApi<InstalledSkill[]>('/skills/installed')
}

export async function toggleSkill(
  id: string,
  enabled: boolean,
): Promise<ApiResult<{ enabled: boolean }>> {
  return fetchApi<{ enabled: boolean }>(`/skills/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  })
}

export async function updateInstalledConfig(
  id: string,
  config: Record<string, unknown>,
): Promise<ApiResult<InstalledSkill>> {
  return fetchApi<InstalledSkill>(`/skills/${encodeURIComponent(id)}/config`, {
    method: 'PUT',
    body: JSON.stringify(config),
  })
}

/* ------------------------------------------------------------------ */
/* 评分 / 评论                                                         */
/* ------------------------------------------------------------------ */

export async function getSkillReviews(
  id: string,
  query: { page?: number; pageSize?: number } = {},
): Promise<ApiResult<PageData<SkillReview>>> {
  return fetchApi<PageData<SkillReview>>(
    `/skills/${encodeURIComponent(id)}/reviews${buildQs(query)}`,
  )
}

export async function submitSkillReview(
  id: string,
  rating: number,
  content: string,
): Promise<ApiResult<SkillReview>> {
  return fetchApi<SkillReview>(`/skills/${encodeURIComponent(id)}/reviews`, {
    method: 'POST',
    body: JSON.stringify({ rating, content }),
  })
}

/* ------------------------------------------------------------------ */
/* 依赖检查                                                            */
/* ------------------------------------------------------------------ */

export function checkDependencies(
  skill: Skill,
  installed: InstalledSkill[],
): { ok: boolean; missing: string[] } {
  const installedMap = new Map(installed.map((i) => [i.skillId, i.version]))
  const missing: string[] = []
  for (const dep of skill.dependencies) {
    const v = installedMap.get(dep.skillId)
    if (!v) {
      missing.push(dep.skillId)
    }
  }
  return { ok: missing.length === 0, missing }
}

export function resolveDependencyTree(skills: Skill[], targetId: string): Skill[] {
  const byId = new Map(skills.map((s) => [s.id, s]))
  const visited = new Set<string>()
  const result: Skill[] = []
  const visit = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const skill = byId.get(id)
    if (!skill) return
    for (const dep of skill.dependencies) {
      visit(dep.skillId)
    }
    result.push(skill)
  }
  visit(targetId)
  return result
}
