import type { SkillMarketEntry } from '@ihui/shared/skills/market'

/** 用户已安装的技能 — 对齐后端 SkillRecord(2026-07-21 立) */
export interface UserSkill {
  name: string
  description?: string
  content: string
  version: string
  license: string
  source: 'builtin' | 'user' | 'auto' | 'hub'
  tags?: string[]
  createdAt: string
  updatedAt: string
}

/** 用户技能列表响应 */
export interface UserSkillListResponse {
  skills: UserSkill[]
  total: number
}

/** 批量操作类型 */
export type BatchAction = 'install' | 'delete' | 'update' | null

/** 批量更新表单 */
export interface BatchUpdateForm {
  version: string
  tags: string
}

/** 导入结果 */
export interface ImportResult {
  success: number
  failed: number
  errors: string[]
}

export type { SkillMarketEntry }