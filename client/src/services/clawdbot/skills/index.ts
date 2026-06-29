import { t } from '@/utils/i18n'

/**
 * OpenClaw Skills System (ClawdHub)
 * 
 * 技能市场和管理系统:
 * - 技能发现和搜索
 * - 技能安装和卸载
 * - 技能版本管理
 * - 自动创建技能
 * - 社区技能分享
 * 
 * 参考: https://docs.clawd.bot/clawdhub
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 技能定义
 */
export interface Skill {
  id: string
  name: string
  description: string
  version: string
  author: SkillAuthor
  category: SkillCategory
  tags: string[]
  icon?: string
  readme?: string
  license: string
  repository?: string
  homepage?: string
  dependencies?: SkillDependency[]
  permissions?: SkillPermission[]
  config?: SkillConfigSchema
  entrypoint: string
  code?: string
  stats: SkillStats
  createdAt: number
  updatedAt: number
}

/**
 * 技能作者
 */
export interface SkillAuthor {
  id: string
  name: string
  avatar?: string
  verified?: boolean
}

/**
 * 技能类别
 */
export type SkillCategory =
  | 'utility'       // 实用工具
  | 'automation'    // 自动化
  | 'integration'   // 集成
  | 'analysis'      // 分析
  | 'communication' // 通信
  | 'creative'      // 创意
  | 'development'   // 开发
  | 'productivity'  // 生产力
  | 'entertainment' // 娱乐
  | 'education'     // 教育
  | 'finance'       // 金融
  | 'health'        // 健康
  | 'other'         // 其他

/**
 * 技能依赖
 */
export interface SkillDependency {
  name: string
  version: string
  optional?: boolean
}

/**
 * 技能权限
 */
export interface SkillPermission {
  name: string
  description: string
  required: boolean
}

/**
 * 技能配置架构
 */
export interface SkillConfigSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description?: string
    default?: unknown
    required?: boolean
    enum?: unknown[]
  }>
}

/**
 * 技能统计
 */
export interface SkillStats {
  downloads: number
  rating: number
  ratingCount: number
  activeInstalls: number
}

/**
 * 已安装的技能
 */
export interface InstalledSkill extends Omit<Skill, 'config'> {
  installedAt: number
  lastUsed?: number
  usageCount: number
  enabled: boolean
  /** 运行时配置值（与 Skill.config 的配置架构不同） */
  config: Record<string, unknown>
  status: 'active' | 'inactive' | 'error' | 'updating'
  error?: string
}

/**
 * 技能搜索选项
 */
export interface SkillSearchOptions {
  query?: string
  category?: SkillCategory
  tags?: string[]
  author?: string
  sortBy?: 'downloads' | 'rating' | 'updated' | 'name'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

/**
 * 技能搜索结果
 */
export interface SkillSearchResult {
  skills: Skill[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 技能安装选项
 */
export interface SkillInstallOptions {
  version?: string
  config?: Record<string, unknown>
  autoEnable?: boolean
}

/**
 * 技能创建请求
 */
export interface CreateSkillRequest {
  name: string
  description: string
  task: string
  examples?: string[]
  category?: SkillCategory
  tags?: string[]
}

/**
 * 技能管理器
 */
export class SkillManager extends EventEmitter {
  private installed = reactive<Map<string, InstalledSkill>>(new Map())
  private available = reactive<Map<string, Skill>>(new Map())
  private initialized = ref(false)
  
  // 模拟的技能仓库
  private readonly CLAWDHUB_API = 'https://api.clawdhub.com/v1'

  constructor() {
    super()
  }

  /**
   * 初始化技能系统
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Skills] Initializing skills system...')

    // 加载已安装的技能
    await this.loadInstalledSkills()

    // 加载内置技能
    this.loadBuiltinSkills()

    this.initialized.value = true
    logger.info('[Skills] Skills system initialized')
    this.emit('initialized')
  }

  /**
   * 加载已安装的技能
   */
  private async loadInstalledSkills(): Promise<void> {
    try {
      const savedSkills = localStorage.getItem('openclaw_installed_skills')
      if (savedSkills) {
        const parsed = JSON.parse(savedSkills)
        for (const [id, skill] of Object.entries(parsed)) {
          this.installed.set(id, skill as InstalledSkill)
        }
      }
      logger.info(`[Skills] Loaded installed skills`)
    } catch (error) {
      logger.error('[Skills] Failed to load installed skills:', error)
    }
  }

  /**
   * 加载内置技能
   */
  private loadBuiltinSkills(): void {
    const builtinSkills: Skill[] = [
      {
        id: 'builtin_web_search',
        name: 'Web Search',
        description: t('text.index.搜索互联网获取信1'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'utility',
        tags: ['search', 'web', 'information'],
        license: 'MIT',
        entrypoint: 'search',
        stats: { downloads: 10000, rating: 4.8, ratingCount: 500, activeInstalls: 5000 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_code_executor',
        name: 'Code Executor',
        description: t('text.index.执行代码片段2'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'development',
        tags: ['code', 'execute', 'programming'],
        license: 'MIT',
        entrypoint: 'execute',
        stats: { downloads: 8000, rating: 4.7, ratingCount: 300, activeInstalls: 4000 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_file_manager',
        name: 'File Manager',
        description: t('text.index.管理文件和文件夹3'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'utility',
        tags: ['file', 'folder', 'management'],
        license: 'MIT',
        entrypoint: 'manage',
        stats: { downloads: 7000, rating: 4.6, ratingCount: 250, activeInstalls: 3500 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_email_assistant',
        name: 'Email Assistant',
        description: t('text.index.管理邮件阅读撰写4'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'communication',
        tags: ['email', 'gmail', 'communication'],
        license: 'MIT',
        entrypoint: 'email',
        stats: { downloads: 6000, rating: 4.5, ratingCount: 200, activeInstalls: 3000 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_calendar_manager',
        name: 'Calendar Manager',
        description: t('text.index.管理日历查看创建5'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'productivity',
        tags: ['calendar', 'schedule', 'events'],
        license: 'MIT',
        entrypoint: 'calendar',
        stats: { downloads: 5500, rating: 4.6, ratingCount: 180, activeInstalls: 2800 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_smart_home',
        name: 'Smart Home Control',
        description: t('text.index.控制智能家居设备6'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'automation',
        tags: ['smart-home', 'iot', 'automation'],
        license: 'MIT',
        entrypoint: 'home',
        stats: { downloads: 4000, rating: 4.4, ratingCount: 150, activeInstalls: 2000 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_weather',
        name: 'Weather Info',
        description: t('text.index.获取天气信息和预7'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'utility',
        tags: ['weather', 'forecast', 'information'],
        license: 'MIT',
        entrypoint: 'weather',
        stats: { downloads: 5000, rating: 4.7, ratingCount: 200, activeInstalls: 2500 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_translator',
        name: 'Translator',
        description: t('text.index.多语言翻译8'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'utility',
        tags: ['translate', 'language', 'multilingual'],
        license: 'MIT',
        entrypoint: 'translate',
        stats: { downloads: 4500, rating: 4.6, ratingCount: 170, activeInstalls: 2200 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
      {
        id: 'builtin_github',
        name: 'GitHub Integration',
        description: t('text.index.与GitHub仓9'),
        version: '1.0.0',
        author: { id: 'system', name: '智汇AI', verified: true },
        category: 'development',
        tags: ['github', 'git', 'version-control'],
        license: 'MIT',
        entrypoint: 'github',
        stats: { downloads: 3500, rating: 4.5, ratingCount: 140, activeInstalls: 1800 },
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
      },
    ]

    for (const skill of builtinSkills) {
      this.available.set(skill.id, skill)
    }
  }

  /**
   * 保存已安装技能
   */
  private saveInstalledSkills(): void {
    const obj: Record<string, InstalledSkill> = {}
    this.installed.forEach((skill, id) => {
      obj[id] = skill
    })
    localStorage.setItem('openclaw_installed_skills', JSON.stringify(obj))
  }

  /**
   * 搜索技能
   */
  async searchSkills(options: SkillSearchOptions = {}): Promise<SkillSearchResult> {
    const {
      query = '',
      category,
      tags,
      author,
      sortBy = 'downloads',
      sortOrder = 'desc',
      page = 1,
      pageSize = 20,
    } = options

    let skills = Array.from(this.available.values())

    // 文本搜索
    if (query) {
      const lowerQuery = query.toLowerCase()
      skills = skills.filter(s =>
        s.name.toLowerCase().includes(lowerQuery) ||
        s.description.toLowerCase().includes(lowerQuery) ||
        s.tags.some(t => t.toLowerCase().includes(lowerQuery))
      )
    }

    // 类别过滤
    if (category) {
      skills = skills.filter(s => s.category === category)
    }

    // 标签过滤
    if (tags && tags.length > 0) {
      skills = skills.filter(s => tags.some(t => s.tags.includes(t)))
    }

    // 作者过滤
    if (author) {
      skills = skills.filter(s => s.author.id === author || s.author.name === author)
    }

    // 排序
    skills.sort((a, b) => {
      let aVal: number | string, bVal: number | string
      switch (sortBy) {
        case 'downloads':
          aVal = a.stats.downloads
          bVal = b.stats.downloads
          break
        case 'rating':
          aVal = a.stats.rating
          bVal = b.stats.rating
          break
        case 'updated':
          aVal = a.updatedAt
          bVal = b.updatedAt
          break
        case 'name':
          aVal = a.name
          bVal = b.name
          break
        default:
          return 0
      }
      return sortOrder === 'asc' 
        ? (aVal > bVal ? 1 : -1) 
        : (aVal < bVal ? 1 : -1)
    })

    // 分页
    const total = skills.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const paginatedSkills = skills.slice(start, start + pageSize)

    return {
      skills: paginatedSkills,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * 获取技能详情
   */
  async getSkillDetails(skillId: string): Promise<Skill | null> {
    return this.available.get(skillId) || null
  }

  /**
   * 安装技能
   */
  async installSkill(skillId: string, options: SkillInstallOptions = {}): Promise<InstalledSkill> {
    const skill = this.available.get(skillId)
    if (!skill) {
      throw new Error(`技能不存在: ${skillId}`)
    }

    // 检查是否已安装
    if (this.installed.has(skillId)) {
      throw new Error(`技能已安装: ${skillId}`)
    }

    logger.info(`[Skills] Installing skill: ${skill.name}`)

    // 创建已安装技能
    const installedSkill: InstalledSkill = {
      ...skill,
      version: options.version || skill.version,
      installedAt: Date.now(),
      lastUsed: undefined,
      usageCount: 0,
      enabled: options.autoEnable ?? true,
      config: options.config || {},
      status: 'active',
    }

    this.installed.set(skillId, installedSkill)
    this.saveInstalledSkills()

    this.emit('skillInstalled', installedSkill)
    logger.info(`[Skills] Skill installed successfully: ${skill.name}`)

    return installedSkill
  }

  /**
   * 卸载技能
   */
  async uninstallSkill(skillId: string): Promise<void> {
    const skill = this.installed.get(skillId)
    if (!skill) {
      throw new Error(`技能未安装: ${skillId}`)
    }

    logger.info(`[Skills] Uninstalling skill: ${skill.name}`)

    this.installed.delete(skillId)
    this.saveInstalledSkills()

    this.emit('skillUninstalled', skillId)
    logger.info(`[Skills] Skill uninstalled successfully: ${skill.name}`)
  }

  /**
   * 启用技能
   */
  enableSkill(skillId: string): void {
    const skill = this.installed.get(skillId)
    if (skill) {
      skill.enabled = true
      skill.status = 'active'
      this.saveInstalledSkills()
      this.emit('skillEnabled', skillId)
    }
  }

  /**
   * 禁用技能
   */
  disableSkill(skillId: string): void {
    const skill = this.installed.get(skillId)
    if (skill) {
      skill.enabled = false
      skill.status = 'inactive'
      this.saveInstalledSkills()
      this.emit('skillDisabled', skillId)
    }
  }

  /**
   * 更新技能配置
   */
  updateSkillConfig(skillId: string, config: Record<string, unknown>): void {
    const skill = this.installed.get(skillId)
    if (skill) {
      skill.config = { ...skill.config, ...config }
      this.saveInstalledSkills()
      this.emit('skillConfigUpdated', { skillId, config })
    }
  }

  /**
   * 执行技能
   */
  async executeSkill(skillId: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const skill = this.installed.get(skillId)
    if (!skill) {
      throw new Error(`技能未安装: ${skillId}`)
    }

    if (!skill.enabled) {
      throw new Error(`技能已禁用: ${skillId}`)
    }

    logger.info(`[Skills] Executing skill: ${skill.name}`)

    // 更新使用统计
    skill.lastUsed = Date.now()
    skill.usageCount++
    this.saveInstalledSkills()

    // 实际执行逻辑需要根据技能代码实现
    // 这里返回模拟结果
    const result = {
      success: true,
      skillId,
      params,
      timestamp: Date.now(),
    }

    this.emit('skillExecuted', { skillId, params, result })
    
    return result
  }

  /**
   * 自动创建技能
   */
  async createSkill(request: CreateSkillRequest): Promise<Skill> {
    logger.info(`[Skills] Auto-creating skill: ${request.name}`)

    // 生成技能代码（实际应调用 LLM）
    const code = `
/**
 * ${request.name}
 * ${request.description}
 */
export async function execute(params) {
  // 占位：此处由用户或 LLM 根据 request.task 实现具体技能逻辑；详见 docs/BACKLOG_ONE_MONTH.md 十、10.1
  // 任务: ${request.task}
  return { success: true, message: t('api.index.技能执行完成') };
}
`.trim()

    const newSkill: Skill = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: request.name,
      description: request.description,
      version: '1.0.0',
      author: { id: 'user', name: '用户' },
      category: request.category || 'custom' as SkillCategory,
      tags: request.tags || [],
      license: 'MIT',
      entrypoint: 'execute',
      code,
      stats: { downloads: 0, rating: 0, ratingCount: 0, activeInstalls: 0 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    // 添加到可用技能
    this.available.set(newSkill.id, newSkill)

    this.emit('skillCreated', newSkill)
    logger.info(`[Skills] Skill created successfully: ${newSkill.name}`)

    return newSkill
  }

  /**
   * 发布技能到 ClawdHub
   */
  async publishSkill(skill: Skill): Promise<void> {
    logger.info(`[Skills] Publishing skill: ${skill.name}`)
    
    // TODO: 调用 ClawdHub API 发布技能
    this.emit('skillPublished', skill)
    logger.info(`[Skills] Skill published successfully: ${skill.name}`)
  }

  /**
   * 获取已安装技能
   */
  getInstalledSkills(): InstalledSkill[] {
    return Array.from(this.installed.values())
  }

  /**
   * 获取已安装技能（按 ID）
   */
  getInstalledSkill(skillId: string): InstalledSkill | undefined {
    return this.installed.get(skillId)
  }

  /**
   * 获取可用技能
   */
  getAvailableSkills(): Skill[] {
    return Array.from(this.available.values())
  }

  /**
   * 获取推荐技能
   */
  getRecommendedSkills(limit: number = 10): Skill[] {
    return Array.from(this.available.values())
      .filter(s => !this.installed.has(s.id))
      .sort((a, b) => b.stats.rating * b.stats.ratingCount - a.stats.rating * a.stats.ratingCount)
      .slice(0, limit)
  }

  /**
   * 获取热门技能
   */
  getPopularSkills(limit: number = 10): Skill[] {
    return Array.from(this.available.values())
      .sort((a, b) => b.stats.downloads - a.stats.downloads)
      .slice(0, limit)
  }

  /**
   * 按类别获取技能
   */
  getSkillsByCategory(category: SkillCategory): Skill[] {
    return Array.from(this.available.values()).filter(s => s.category === category)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    installedCount: number
    availableCount: number
    activeCount: number
    categories: Record<SkillCategory, number>
  } {
    const categories: Record<string, number> = {}
    for (const skill of this.installed.values()) {
      categories[skill.category] = (categories[skill.category] || 0) + 1
    }

    return {
      installedCount: this.installed.size,
      availableCount: this.available.size,
      activeCount: Array.from(this.installed.values()).filter(s => s.enabled).length,
      categories: categories as Record<SkillCategory, number>,
    }
  }

  /**
   * 关闭技能系统
   */
  shutdown(): void {
    this.saveInstalledSkills()
    this.initialized.value = false
    logger.info('[Skills] Skills system shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let skillManagerInstance: SkillManager | null = null

/**
 * 获取技能管理器实例
 */
export function getSkillManager(): SkillManager {
  if (!skillManagerInstance) {
    skillManagerInstance = new SkillManager()
  }
  return skillManagerInstance
}

export default SkillManager
