/**
 * Skills API
 * 用于获取和管理 Claude Skills
 */

import { request } from '@/services/api'
import type { ApiResponse } from '@/types/api'
import type { SkillInfo, SkillMetadata } from '@/types/skills'
import { logger } from '@/utils/logger'

// 重新导出类型，保持向后兼容
export type { SkillInfo, SkillMetadata }

export interface SkillsListResponse {
  skills: SkillInfo[]
  total: number
}

/**
 * 获取所有可用的 Skills 列表
 */
export async function getSkillsList(): Promise<ApiResponse<SkillsListResponse>> {
  try {
    // 尝试从后端API获取
    const response = await request({
      url: '/api/skills/list',
      method: 'GET',
    })
    
    return response as ApiResponse<SkillsListResponse>
  } catch (error) {
    logger.warn('Skills API not available, using static config', error)
    const staticSkills = getStaticSkillsList()
    return {
      code: 200,
      success: true,
      data: {
        skills: staticSkills,
        total: staticSkills.length,
      },
      message: 'Success',
    }
  }
}

/**
 * 获取静态 Skills 列表（从 .claude/skills 目录）
 * 这个列表应该与 .claude/skills 目录中的实际 skills 保持同步
 */
function getStaticSkillsList(): SkillInfo[] {
  return [
    // Document Processing
    {
      name: 'docx',
      description: 'Create, edit, analyze Word docs with tracked changes, comments, formatting',
      category: 'Document Processing',
      icon: 'FileText',
      path: '.claude/skills/docx',
    },
    {
      name: 'pdf',
      description: 'Extract text, tables, metadata, merge & annotate PDFs',
      category: 'Document Processing',
      icon: 'FileText',
      path: '.claude/skills/pdf',
    },
    {
      name: 'pptx',
      description: 'Read, generate, and adjust slides, layouts, templates',
      category: 'Document Processing',
      icon: 'Presentation',
      path: '.claude/skills/pptx',
    },
    {
      name: 'xlsx',
      description: 'Spreadsheet manipulation: formulas, charts, data transformations',
      category: 'Document Processing',
      icon: 'Table',
      path: '.claude/skills/xlsx',
    },
    {
      name: 'doc-coauthoring',
      description: 'Collaborative document editing workflows',
      category: 'Document Processing',
      icon: 'Users',
      path: '.claude/skills/doc-coauthoring',
    },
    // Development & Code Tools
    {
      name: 'mcp-builder',
      description: 'Create high-quality MCP (Model Context Protocol) servers',
      category: 'Development & Code Tools',
      icon: 'Code',
      path: '.claude/skills/mcp-builder',
    },
    {
      name: 'webapp-testing',
      description: 'Test web applications using Playwright',
      category: 'Development & Code Tools',
      icon: 'TestTube',
      path: '.claude/skills/webapp-testing',
    },
    {
      name: 'langsmith-fetch',
      description: 'Fetch and analyze execution traces from LangSmith Studio',
      category: 'Development & Code Tools',
      icon: 'Search',
      path: '.claude/skills/langsmith-fetch',
    },
    {
      name: 'changelog-generator',
      description: 'Automatically generate changelogs from git commits',
      category: 'Development & Code Tools',
      icon: 'GitBranch',
      path: '.claude/skills/changelog-generator',
    },
    {
      name: 'skill-creator',
      description: 'Guide for creating effective Claude Skills',
      category: 'Development & Code Tools',
      icon: 'Wand2',
      path: '.claude/skills/skill-creator',
    },
    // Design & Creative
    {
      name: 'algorithmic-art',
      description: 'Generate algorithmic art and visual designs',
      category: 'Design & Creative',
      icon: 'Palette',
      path: '.claude/skills/algorithmic-art',
    },
    {
      name: 'brand-guidelines',
      description: 'Apply brand colors and typography guidelines',
      category: 'Design & Creative',
      icon: 'Paintbrush',
      path: '.claude/skills/brand-guidelines',
    },
    {
      name: 'canvas-design',
      description: 'Create beautiful visual designs in PNG and PDF',
      category: 'Design & Creative',
      icon: 'Image',
      path: '.claude/skills/canvas-design',
    },
    {
      name: 'frontend-design',
      description: 'Frontend design patterns and best practices',
      category: 'Design & Creative',
      icon: 'Layout',
      path: '.claude/skills/frontend-design',
    },
    // Content & Writing
    {
      name: 'content-research-writer',
      description: 'High-quality content research and writing assistance',
      category: 'Content & Writing',
      icon: 'PenTool',
      path: '.claude/skills/content-research-writer',
    },
    {
      name: 'tailored-resume-generator',
      description: 'Generate tailored resumes based on job descriptions',
      category: 'Content & Writing',
      icon: 'FileText',
      path: '.claude/skills/tailored-resume-generator',
    },
    {
      name: 'twitter-algorithm-optimizer',
      description: 'Optimize tweets for maximum engagement',
      category: 'Content & Writing',
      icon: 'Twitter',
      path: '.claude/skills/twitter-algorithm-optimizer',
    },
    // Productivity & Organization
    {
      name: 'file-organizer',
      description: 'Intelligently organize files and folders',
      category: 'Productivity & Organization',
      icon: 'Folder',
      path: '.claude/skills/file-organizer',
    },
    {
      name: 'meeting-insights-analyzer',
      description: 'Analyze meeting transcripts for behavioral patterns',
      category: 'Productivity & Organization',
      icon: 'Users',
      path: '.claude/skills/meeting-insights-analyzer',
    },
    // Social Media
    {
      name: 'x-publish',
      description: 'Automated publishing to X (Twitter) using Playwright MCP',
      category: 'Social Media',
      icon: 'Send',
      path: '.claude/skills/x-publish',
    },
  ]
}

/**
 * 根据技能名称获取技能信息
 */
export async function getSkillInfo(skillName: string): Promise<ApiResponse<SkillInfo>> {
  try {
    const response = await request({
      url: `/api/skills/${skillName}`,
      method: 'GET',
    })
    
    return response as ApiResponse<SkillInfo>
  } catch (_error) {
    // 如果后端API不存在，从静态列表查找
    const skills = getStaticSkillsList()
    const skill = skills.find(s => s.name === skillName)
    
    if (skill) {
      return {
        code: 200,
        success: true,
        data: skill,
        message: 'Success',
      }
    }
    
    return {
      code: 404,
      success: false,
      message: `Skill ${skillName} not found`,
    }
  }
}

/**
 * 加载技能的完整内容（包括SKILL.md）
 */
export async function loadSkillContent(skillName: string): Promise<ApiResponse<{
  metadata: SkillMetadata
  instructions: string
  path: string
  hasScripts: boolean
  hasReferences: boolean
  hasAssets: boolean
}>> {
  try {
    // 尝试从后端API获取
    const response = await request({
      url: `/api/skills/${skillName}/content`,
      method: 'GET',
    })
    
    return response as ApiResponse<{
      metadata: SkillMetadata
      instructions: string
      path: string
      hasScripts: boolean
      hasReferences: boolean
      hasAssets: boolean
    }>
  } catch (error) {
    logger.warn(`Failed to load skill content for ${skillName}, using fallback`, error)
    
    // 返回基本信息
    const skills = getStaticSkillsList()
    const skill = skills.find(s => s.name === skillName)
    
    if (skill) {
      return {
        code: 200,
        success: true,
        data: {
          metadata: {
            name: skill.name,
            description: skill.description,
          },
          instructions: `This skill provides capabilities for: ${skill.description}`,
          path: skill.path,
          hasScripts: false,
          hasReferences: false,
          hasAssets: false,
        },
        message: 'Success (fallback)',
      }
    }
    
    return {
      code: 404,
      success: false,
      message: `Skill ${skillName} not found`,
    }
  }
}

/**
 * 获取技能的metadata（仅YAML frontmatter）
 */
export async function getSkillMetadata(skillPath: string): Promise<ApiResponse<SkillMetadata>> {
  try {
    const response = await request({
      url: `/api/skills/metadata`,
      method: 'POST',
      data: { path: skillPath },
    })
    
    return response as ApiResponse<SkillMetadata>
  } catch (_error) {
    // Fallback: 从静态列表获取
    const skillName = skillPath.split('/').pop() || ''
    const skills = getStaticSkillsList()
    const skill = skills.find(s => s.name === skillName)
    
    if (skill) {
      return {
        code: 200,
        success: true,
        data: {
          name: skill.name,
          description: skill.description,
        },
        message: 'Success (fallback)',
      }
    }
    
    return {
      code: 404,
      success: false,
      message: `Skill metadata not found for ${skillPath}`,
    }
  }
}

// SkillMetadata 已从 @/types/skills 导入并重新导出
