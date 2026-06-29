/**
 * Skills Manager
 * 实现与Claude官方相同的技能加载和管理机制
 * 
 * 参考: https://github.com/anthropics/skills
 * Skills使用三级加载系统：
 * 1. Metadata (name + description) - 始终在上下文中 (~100 words)
 * 2. SKILL.md body - 当技能触发时 (<5k words)
 * 3. Bundled resources - 按需加载 (scripts/references/assets)
 */

import { logger } from '@/utils/logger'
import {
  getSkillsListFromBackend,
  getSkillMetadataFromBackend,
  getSkillContentFromBackend,
} from '@/api/skills-backend'
import type {
  SkillMetadata,
  SkillContent,
  SkillMatch,
  SkillMatchOptions,
} from '@/types/skills'

/**
 * 技能管理器
 * 负责加载、匹配和管理Claude Skills
 */
export class SkillsManager {
  private skillsCache: Map<string, SkillContent> = new Map()
  private metadataCache: Map<string, SkillMetadata> = new Map()
  private matchCache: Map<string, { matches: SkillMatch[]; timestamp: number }> = new Map()
  private resourceCache: Map<string, { content: string; timestamp: number }> = new Map()
  private matchCacheTTL = 5 * 60 * 1000
  private resourceCacheTTL = 30 * 60 * 1000
  private isInitializing = false
  private initializationPromise: Promise<void> | null = null
  private activeSkills: Set<string> = new Set()
  private skillUsageStats: Map<string, { count: number; lastUsed: number }> = new Map()
  private readonly STORAGE_KEY_ACTIVE_SKILLS = 'skills-active-list'
  private readonly STORAGE_KEY_USAGE_STATS = 'skills-usage-stats'

  /**
   * 初始化技能管理器
   * 扫描.claude/skills目录并加载所有技能的metadata
   * 支持并发初始化（多个调用会等待同一个初始化过程）
   */
  async initialize(): Promise<void> {
    // 如果正在初始化，等待现有的初始化完成
    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise
    }

    // 如果已经初始化，直接返回
    if (this.metadataCache.size > 0) {
      return Promise.resolve()
    }

    // 开始初始化
    this.isInitializing = true
    this.initializationPromise = this._doInitialize()

    try {
      await this.initializationPromise
    } finally {
      this.isInitializing = false
      this.initializationPromise = null
    }
  }

  /**
   * 实际执行初始化
   */
  private async _doInitialize(): Promise<void> {
    try {
      // 从API获取技能列表
      const response = await getSkillsListFromBackend()

      if (response.success && response.data) {
        const skills = response.data.skills
        
        // 并行加载所有技能的metadata（提高性能）
        const metadataPromises = skills.map(async (skillInfo) => {
          try {
            const metadata = await this.loadSkillMetadata(skillInfo.path)
            if (metadata) {
              this.metadataCache.set(skillInfo.name, metadata)
            }
          } catch (error) {
            logger.warn(`Failed to load metadata for skill ${skillInfo.name}:`, error)
          }
        })

        await Promise.all(metadataPromises)
      } else {
        // 使用静态配置作为fallback
        await this.loadStaticSkillsMetadata()
      }

      // 加载持久化的激活技能和使用统计
      this.loadPersistedState()

      logger.info(`Skills manager initialized with ${this.metadataCache.size} skills`)
    } catch (error) {
      logger.warn('Failed to initialize skills from API, using static config:', error)
      await this.loadStaticSkillsMetadata()
      this.loadPersistedState()
    }
  }

  /**
   * 加载持久化的状态（激活技能和使用统计）
   */
  private loadPersistedState(): void {
    try {
      // 加载激活的技能
      if (typeof window !== 'undefined' && window.localStorage) {
        const activeSkillsJson = localStorage.getItem(this.STORAGE_KEY_ACTIVE_SKILLS)
        if (activeSkillsJson) {
          const activeSkillsArray = JSON.parse(activeSkillsJson) as string[]
          this.activeSkills = new Set(activeSkillsArray)
        }

        // 加载使用统计
        const statsJson = localStorage.getItem(this.STORAGE_KEY_USAGE_STATS)
        if (statsJson) {
          const stats = JSON.parse(statsJson) as Record<string, { count: number; lastUsed: number }>
          this.skillUsageStats = new Map(Object.entries(stats))
        }
      }
    } catch (error) {
      logger.warn('Failed to load persisted skills state:', error)
    }
  }

  /**
   * 保存持久化状态
   */
  private savePersistedState(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // 保存激活的技能
        localStorage.setItem(
          this.STORAGE_KEY_ACTIVE_SKILLS,
          JSON.stringify(Array.from(this.activeSkills))
        )

        // 保存使用统计
        const statsObj = Object.fromEntries(this.skillUsageStats)
        localStorage.setItem(
          this.STORAGE_KEY_USAGE_STATS,
          JSON.stringify(statsObj)
        )
      }
    } catch (error) {
      logger.warn('Failed to save persisted skills state:', error)
    }
  }

  /**
   * 加载静态技能metadata（fallback）
   */
  private async loadStaticSkillsMetadata(): Promise<void> {
    const staticSkills = [
      'docx', 'pdf', 'pptx', 'xlsx', 'doc-coauthoring',
      'mcp-builder', 'webapp-testing', 'langsmith-fetch', 'changelog-generator', 'skill-creator',
      'algorithmic-art', 'brand-guidelines', 'canvas-design', 'frontend-design',
      'content-research-writer', 'tailored-resume-generator', 'twitter-algorithm-optimizer',
      'file-organizer', 'meeting-insights-analyzer', 'x-publish',
    ]

    for (const skillName of staticSkills) {
      try {
        const metadata = await this.loadSkillMetadata(`.claude/skills/${skillName}`)
        if (metadata) {
          this.metadataCache.set(skillName, metadata)
        }
      } catch (error) {
        logger.warn(`Failed to load metadata for ${skillName}:`, error)
      }
    }
  }

  /**
   * 加载技能的metadata（仅YAML frontmatter）
   */
  async loadSkillMetadata(skillPath: string): Promise<SkillMetadata | null> {
    try {
      // 尝试从后端API获取SKILL.md的metadata
      const response = await getSkillMetadataFromBackend(skillPath)

      if (response.success && response.data) {
        return response.data as SkillMetadata
      }
    } catch (error) {
      logger.debug(`Failed to load metadata for ${skillPath}:`, error)
    }

    // Fallback: 从静态配置获取
    const skillName = skillPath.split('/').pop() || ''
    const staticMetadata = this.getStaticSkillMetadata(skillName)
    if (staticMetadata) {
      return staticMetadata
    }

    return null
  }

  /**
   * 从静态配置获取技能metadata（fallback）
   */
  private getStaticSkillMetadata(skillName: string): SkillMetadata | null {
    const staticSkills: Record<string, SkillMetadata> = {
      docx: {
        name: 'docx',
        description: 'Comprehensive document creation, editing, and analysis with support for tracked changes, comments, formatting preservation, and text extraction.',
      },
      pdf: {
        name: 'pdf',
        description: 'Extract text, tables, metadata, merge & annotate PDFs.',
      },
      pptx: {
        name: 'pptx',
        description: 'Read, generate, and adjust slides, layouts, templates.',
      },
      xlsx: {
        name: 'xlsx',
        description: 'Spreadsheet manipulation: formulas, charts, data transformations.',
      },
      'mcp-builder': {
        name: 'mcp-builder',
        description: 'Create high-quality MCP (Model Context Protocol) servers.',
      },
      'webapp-testing': {
        name: 'webapp-testing',
        description: 'Test web applications using Playwright.',
      },
      'x-publish': {
        name: 'x-publish',
        description: 'Automated publishing to X (Twitter) using Playwright MCP for browser automation.',
      },
    }

    return staticSkills[skillName] || null
  }

  /**
   * 加载完整的技能内容（包括instructions）
   */
  async loadSkill(skillName: string): Promise<SkillContent | null> {
    // 检查缓存
    if (this.skillsCache.has(skillName)) {
      const skill = this.skillsCache.get(skillName)!
      // 更新使用统计
      this.recordSkillUsage(skillName)
      return skill
    }

    try {
      // 尝试从后端API获取完整内容
      const response = await getSkillContentFromBackend(skillName)

      if (response.success && response.data) {
        const skillContent: SkillContent = {
          metadata: response.data.metadata,
          instructions: response.data.instructions,
          path: response.data.path,
          hasScripts: response.data.hasScripts,
          hasReferences: response.data.hasReferences,
          hasAssets: response.data.hasAssets,
        }

        this.skillsCache.set(skillName, skillContent)
        // 更新使用统计
        this.recordSkillUsage(skillName)
        return skillContent
      }
    } catch (error) {
      logger.warn(`Failed to load skill ${skillName} from backend, using fallback:`, error)
    }

    // Fallback: 使用静态配置和基本instructions
    const metadata = this.getStaticSkillMetadata(skillName)
    if (metadata) {
      const skillContent: SkillContent = {
        metadata,
        instructions: `This skill provides capabilities for: ${metadata.description}\n\nWhen using this skill, follow the instructions and best practices for ${metadata.name}.`,
        path: `.claude/skills/${skillName}`,
        hasScripts: false,
        hasReferences: false,
        hasAssets: false,
      }

      this.skillsCache.set(skillName, skillContent)
      // 更新使用统计
      this.recordSkillUsage(skillName)
      return skillContent
    }

    return null
  }

  /**
   * 记录技能使用
   */
  private recordSkillUsage(skillName: string): void {
    const now = Date.now()
    const stats = this.skillUsageStats.get(skillName) || { count: 0, lastUsed: 0 }
    stats.count++
    stats.lastUsed = now
    this.skillUsageStats.set(skillName, stats)
    // 定期保存（每10次使用保存一次）
    if (stats.count % 10 === 0) {
      this.savePersistedState()
    }
  }

  /**
   * 激活技能
   */
  activateSkill(skillName: string): void {
    this.activeSkills.add(skillName)
    this.savePersistedState()
    logger.info(`Skill activated: ${skillName}`)
  }

  /**
   * 停用技能
   */
  deactivateSkill(skillName: string): void {
    this.activeSkills.delete(skillName)
    this.savePersistedState()
    logger.info(`Skill deactivated: ${skillName}`)
  }

  /**
   * 检查技能是否激活
   */
  isSkillActive(skillName: string): boolean {
    return this.activeSkills.has(skillName)
  }

  /**
   * 获取激活的技能列表
   */
  getActiveSkills(): string[] {
    return Array.from(this.activeSkills)
  }

  /**
   * 获取技能使用统计
   */
  getSkillUsageStats(skillName?: string): Map<string, { count: number; lastUsed: number }> | { count: number; lastUsed: number } | null {
    if (skillName) {
      return this.skillUsageStats.get(skillName) || null
    }
    return new Map(this.skillUsageStats)
  }

  /**
   * 获取最常用的技能（用于推荐）
   */
  getMostUsedSkills(limit: number = 5): Array<{ name: string; description: string; count: number; lastUsed: number }> {
    const statsArray = Array.from(this.skillUsageStats.entries())
      .map(([name, stats]) => {
        // 获取技能的description
        const metadata = this.metadataCache.get(name)
        return {
          name,
          description: metadata?.description || '',
          ...stats,
        }
      })
      .sort((a, b) => {
        // 先按使用次数排序，再按最后使用时间排序
        if (b.count !== a.count) {
          return b.count - a.count
        }
        return b.lastUsed - a.lastUsed
      })
      .slice(0, limit)

    return statsArray
  }

  /**
   * 匹配用户消息到相关技能
   * 使用description进行语义匹配，支持缓存
   * 优先匹配激活的技能和常用技能
   */
  matchSkills(userMessage: string, options: SkillMatchOptions = {}): SkillMatch[] {
    const {
      maxMatches = 3,
      minScore = 1,
      categories,
      excludeCategories,
    } = options

    // 检查缓存
    const cacheKey = `${userMessage}:${maxMatches}:${minScore}`
    const cached = this.matchCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < this.matchCacheTTL) {
      return cached.matches
    }

    const message = userMessage.toLowerCase()
    const matches: SkillMatch[] = []

    for (const [skillName, metadata] of this.metadataCache.entries()) {
      // 分类过滤
      if (categories && categories.length > 0) {
        const skillCategory = (metadata as { category?: string }).category
        if (!skillCategory || !categories.includes(skillCategory)) {
          continue
        }
      }

      if (excludeCategories && excludeCategories.length > 0) {
        const skillCategory = (metadata as { category?: string }).category
        if (skillCategory && excludeCategories.includes(skillCategory)) {
          continue
        }
      }

      let score = 0
      const reasons: string[] = []

      // 检查技能名称是否在消息中（最高优先级）
      const skillNameLower = skillName.toLowerCase()
      if (message.includes(skillNameLower)) {
        score += 20
        reasons.push(`技能名称匹配: ${skillName}`)
      }

      // 检查description中的关键词
      const description = metadata.description.toLowerCase()
      const descriptionWords = description.split(/\s+/)
      
      for (const word of descriptionWords) {
        // 过滤停用词
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']
        if (stopWords.includes(word) || word.length < 3) continue

        if (message.includes(word)) {
          score += 2
          reasons.push(`关键词匹配: ${word}`)
        }
      }

      // 检查description中的关键短语（更高权重）
      const keyPhrases = [
        { phrase: 'create', weight: 5 },
        { phrase: 'edit', weight: 5 },
        { phrase: 'analyze', weight: 5 },
        { phrase: 'generate', weight: 5 },
        { phrase: 'test', weight: 5 },
        { phrase: 'organize', weight: 5 },
        { phrase: 'design', weight: 5 },
        { phrase: 'write', weight: 5 },
        { phrase: 'optimize', weight: 5 },
        { phrase: 'build', weight: 5 },
        { phrase: 'fetch', weight: 5 },
        { phrase: 'publish', weight: 5 },
        { phrase: 'document', weight: 4 },
        { phrase: 'spreadsheet', weight: 4 },
        { phrase: 'presentation', weight: 4 },
      ]

      for (const { phrase, weight } of keyPhrases) {
        if (description.includes(phrase) && message.includes(phrase)) {
          score += weight
          reasons.push(`短语匹配: ${phrase}`)
        }
      }

      // 如果技能已激活，增加分数
      if (this.activeSkills.has(skillName)) {
        score += 10
        reasons.push('技能已激活')
      }

      // 如果技能使用频率高，增加分数（基于使用统计）
      const usageStats = this.skillUsageStats.get(skillName)
      if (usageStats && usageStats.count > 0) {
        // 使用次数越多，加分越多（最多+5分）
        const usageBonus = Math.min(5, Math.floor(usageStats.count / 5))
        score += usageBonus
        if (usageBonus > 0) {
          reasons.push(`常用技能 (${usageStats.count}次使用)`)
        }
      }

      // 计算置信度
      let confidence: 'high' | 'medium' | 'low' = 'low'
      if (score >= 15) confidence = 'high'
      else if (score >= 8) confidence = 'medium'

      if (score >= minScore) {
        matches.push({
          skill: {
            metadata,
            instructions: '', // 将在需要时加载
            path: `.claude/skills/${skillName}`,
            hasScripts: false,
            hasReferences: false,
            hasAssets: false,
          },
          score,
          reason: reasons.join('; '),
          confidence,
        })
      }
    }

    // 按分数排序并返回前N个
    const sortedMatches = matches
      .sort((a, b) => b.score - a.score)
      .slice(0, maxMatches)

    // 缓存结果
    this.matchCache.set(cacheKey, {
      matches: sortedMatches,
      timestamp: Date.now(),
    })

    // 清理过期缓存
    this.cleanExpiredCache()

    return sortedMatches
  }

  /**
   * 清理过期的匹配缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now()
    for (const [key, value] of this.matchCache.entries()) {
      if (now - value.timestamp > this.matchCacheTTL) {
        this.matchCache.delete(key)
      }
    }
  }

  /**
   * 获取所有技能的metadata（用于显示）
   */
  getAllSkillsMetadata(): SkillMetadata[] {
    return Array.from(this.metadataCache.values())
  }

  /**
   * 构建包含技能的system prompt
   * 这是Claude官方的方式：将匹配的技能instructions注入到system prompt中
   */
  async buildSystemPromptWithSkills(
    userMessage: string,
    baseSystemPrompt?: string
  ): Promise<string> {
    // 匹配相关技能
    const matches = this.matchSkills(userMessage, { maxMatches: 3 })

    if (matches.length === 0) {
      return baseSystemPrompt || ''
    }

    // 加载匹配技能的完整内容
    const skillPrompts: string[] = []

    for (const match of matches) {
      const skill = await this.loadSkill(match.skill.metadata.name)
      if (skill) {
        // 构建技能prompt（按照Claude官方格式）
        const skillPrompt = `# ${skill.metadata.name} Skill

${skill.metadata.description}

## Instructions

${skill.instructions}

---
`
        skillPrompts.push(skillPrompt)
      }
    }

    // 组合system prompt
    let systemPrompt = baseSystemPrompt || ''

    if (skillPrompts.length > 0) {
      const skillsSection = `\n\n# Active Skills\n\nThe following skills are active for this conversation:\n\n${skillPrompts.join('\n')}`
      systemPrompt += skillsSection
    }

    return systemPrompt
  }

  /**
   * 检查技能是否需要加载资源文件
   * 实现按需加载scripts/references/assets
   */
  async loadSkillResource(
    skillName: string,
    resourceType: 'script' | 'reference' | 'asset',
    resourcePath: string
  ): Promise<string | null> {
    const cacheKey = `${skillName}:${resourceType}:${resourcePath}`
    const now = Date.now()
    
    const cached = this.resourceCache.get(cacheKey)
    if (cached && (now - cached.timestamp) < this.resourceCacheTTL) {
      logger.debug(`Resource cache hit: ${cacheKey}`)
      return cached.content
    }
    
    try {
      const { request } = await import('@/services/api')
      const response = await request({
        url: `/api/skills/${skillName}/resources/${resourceType}`,
        method: 'POST',
        data: { path: resourcePath },
      }) as { success?: boolean; data?: unknown }

      if (response && response.success && response.data) {
        const content = response.data as string
        
        this.resourceCache.set(cacheKey, { content, timestamp: now })
        logger.debug(`Loaded and cached ${resourceType} resource for skill ${skillName}: ${resourcePath}`)
        
        return content
      }
    } catch (error) {
      logger.error(`Failed to load resource ${resourcePath} for skill ${skillName}:`, error)
    }

    return null
  }

  /**
   * 检查技能是否有特定类型的资源
   */
  async checkSkillResource(
    skillName: string,
    resourceType: 'script' | 'reference' | 'asset'
  ): Promise<string[]> {
    try {
      const skill = await this.loadSkill(skillName)
      if (!skill) return []

      const hasResource = resourceType === 'script' ? skill.hasScripts :
                          resourceType === 'reference' ? skill.hasReferences :
                          skill.hasAssets
      
      if (!hasResource) return []

      const { request } = await import('@/services/api')
      const response = await request({
        url: `/api/skills/${skillName}/resources/${resourceType}/list`,
        method: 'GET',
      }) as { success?: boolean; data?: string[] }

      if (response && response.success && Array.isArray(response.data)) {
        return response.data
      }
    } catch (error) {
      logger.error(`Failed to check ${resourceType} resources for skill ${skillName}:`, error)
    }

    return []
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.skillsCache.clear()
    this.metadataCache.clear()
    this.matchCache.clear()
    this.resourceCache.clear()
  }

  clearResourceCache(): void {
    this.resourceCache.clear()
    logger.debug('Resource cache cleared')
  }

  /**
   * 清除所有状态（包括持久化数据）
   */
  clearAllState(): void {
    this.clearCache()
    this.activeSkills.clear()
    this.skillUsageStats.clear()
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(this.STORAGE_KEY_ACTIVE_SKILLS)
      localStorage.removeItem(this.STORAGE_KEY_USAGE_STATS)
    }
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.metadataCache.size > 0
  }

  /**
   * 获取初始化状态
   */
  getInitializationState(): {
    isInitialized: boolean
    isInitializing: boolean
    skillCount: number
  } {
    return {
      isInitialized: this.isInitialized(),
      isInitializing: this.isInitializing,
      skillCount: this.metadataCache.size,
    }
  }
}

// 单例实例
let skillsManagerInstance: SkillsManager | null = null

/**
 * 获取技能管理器实例
 */
export function getSkillsManager(): SkillsManager {
  if (!skillsManagerInstance) {
    skillsManagerInstance = new SkillsManager()
  }
  return skillsManagerInstance
}
