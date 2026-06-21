/**
 * Skills 类型定义
 * 统一所有技能相关的类型定义，避免重复和不一致
 */

/**
 * 技能元数据（YAML frontmatter）
 */
export interface SkillMetadata {
  name: string
  description: string
  license?: string
  version?: string
  author?: string
  tags?: string[]
  [key: string]: any
}

/**
 * 技能完整内容
 */
export interface SkillContent {
  metadata: SkillMetadata
  instructions: string
  path: string
  hasScripts: boolean
  hasReferences: boolean
  hasAssets: boolean
}

/**
 * 技能匹配结果
 */
export interface SkillMatch {
  skill: SkillContent
  score: number
  reason: string
  confidence?: 'high' | 'medium' | 'low'
}

/**
 * 技能信息（用于UI显示）
 */
export interface SkillInfo {
  name: string
  description: string
  category?: string
  icon?: string
  path: string
  metadata?: SkillMetadata
}

/**
 * 技能状态
 */
export interface SkillState {
  name: string
  isActive: boolean
  activatedAt?: number
  usageCount?: number
  lastUsed?: number
}

/**
 * 技能列表响应
 */
export interface SkillsListResponse {
  skills: SkillInfo[]
  total: number
}

/**
 * 技能内容响应
 */
export interface SkillContentResponse {
  metadata: SkillMetadata
  instructions: string
  path: string
  hasScripts: boolean
  hasReferences: boolean
  hasAssets: boolean
}

/**
 * 技能资源类型
 */
export type SkillResourceType = 'script' | 'reference' | 'asset'

/**
 * 技能匹配选项
 */
export interface SkillMatchOptions {
  maxMatches?: number
  minScore?: number
  categories?: string[]
  excludeCategories?: string[]
}
