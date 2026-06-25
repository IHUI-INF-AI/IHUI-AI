/**
 * Skills Backend API
 * 后端API接口，用于读取.claude/skills目录下的SKILL.md文件
 * 
 * 注意：这些API需要在后端实现，这里提供前端调用接口
 */

import { request } from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { SkillMetadata, SkillContentResponse } from '@/types/skills'

// 重新导出类型，保持向后兼容
export type { SkillMetadata, SkillContentResponse }

/**
 * 获取技能列表（扫描.claude/skills目录）
 */
export async function getSkillsListFromBackend(): Promise<ApiResponse<{
  skills: Array<{ name: string; path: string }>
  total: number
}>> {
  try {
    const response = await request({
      url: '/api/skills/list',
      method: 'GET',
    })
    
    return response as ApiResponse<{
      skills: Array<{ name: string; path: string }>
      total: number
    }>
  } catch (_error) {
    // Fallback: 返回空列表
    return {
      success: false,
      message: 'Skills API not available',
      code: 500,
      timestamp: Date.now(),
    }
  }
}

/**
 * 读取技能的metadata（仅YAML frontmatter）
 */
export async function getSkillMetadataFromBackend(
  skillPath: string
): Promise<ApiResponse<SkillMetadata>> {
  try {
    const response = await request({
      url: '/api/skills/metadata',
      method: 'POST',
      data: { path: skillPath },
    })
    
    return response as ApiResponse<SkillMetadata>
  } catch (_error) {
    return {
      success: false,
      message: `Failed to load metadata for ${skillPath}`,
      code: 500,
      timestamp: Date.now(),
    }
  }
}

/**
 * 读取技能的完整内容（包括SKILL.md的instructions）
 */
export async function getSkillContentFromBackend(
  skillName: string
): Promise<ApiResponse<SkillContentResponse>> {
  try {
    const response = await request({
      url: `/api/skills/${skillName}/content`,
      method: 'GET',
    })
    
    return response as ApiResponse<SkillContentResponse>
  } catch (_error) {
    return {
      success: false,
      message: `Failed to load content for skill ${skillName}`,
      code: 500,
      timestamp: Date.now(),
    }
  }
}

/**
 * 读取技能资源文件（scripts/references/assets）
 */
export async function getSkillResourceFromBackend(
  skillName: string,
  resourceType: 'script' | 'reference' | 'asset',
  resourcePath: string
): Promise<ApiResponse<string>> {
  try {
    const response = await request({
      url: `/api/skills/${skillName}/resources/${resourceType}`,
      method: 'POST',
      data: { path: resourcePath },
    })
    
    return response as ApiResponse<string>
  } catch (_error) {
    return {
      success: false,
      message: `Failed to load resource ${resourcePath}`,
      code: 500,
      timestamp: Date.now(),
    }
  }
}
