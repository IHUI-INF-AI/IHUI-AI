import { StorageManager } from '@/utils/storage'

export interface TourTemplate {
  id: string
  name: string
  description: string
  category: 'onboarding' | 'feature' | 'update' | 'advanced' | 'custom'
  tags: string[]
  steps: TourTemplateStep[]
  config: TourTemplateConfig
  isBuiltIn: boolean
  createdAt: number
  updatedAt: number
}

export interface TourTemplateStep {
  id: string
  target?: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  showSkip?: boolean
  order: number
}

export interface TourTemplateConfig {
  autoStart: boolean
  showProgress: boolean
  allowSkip: boolean
  showCloseButton: boolean
  overlayOpacity: number
  animationDuration: number
}

const STORAGE_KEY = 'tour_templates'

const BUILTIN_TEMPLATES: TourTemplate[] = [
  {
    id: 'template-new-user-onboarding',
    name: '新用户入门引导',
    description: '适用于首次访问网站的新用户，介绍基本功能和导航',
    category: 'onboarding',
    tags: ['新用户', '入门', '基础'],
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: [
      { id: 'welcome', title: '欢迎来到智汇AI', content: '让我们带您了解平台的核心功能', placement: 'center', order: 0 },
      { id: 'navigation', target: '.glass-header', title: '顶部导航', content: '在这里您可以访问所有主要功能', placement: 'bottom', order: 1 },
      { id: 'agents', target: '[href="/agents"]', title: 'AI智能体', content: '探索我们丰富的AI智能体库', placement: 'bottom', order: 2 },
      { id: 'chat', target: '.chat-button', title: 'AI对话', content: '点击开始与AI助手对话', placement: 'left', order: 3 },
      { id: 'settings', target: '[href="/settings"]', title: '个人设置', content: '自定义您的使用体验', placement: 'bottom', order: 4 },
    ],
    config: {
      autoStart: true,
      showProgress: true,
      allowSkip: true,
      showCloseButton: true,
      overlayOpacity: 0.5,
      animationDuration: 300,
    },
  },
  {
    id: 'template-feature-discovery',
    name: '功能发现引导',
    description: '帮助用户发现和了解平台的高级功能',
    category: 'feature',
    tags: ['功能', '发现', '高级'],
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: [
      { id: 'intro', title: '发现更多功能', content: '智汇AI有许多强大的功能等待您发现', placement: 'center', order: 0 },
      { id: 'search', target: '.search-input', title: '智能搜索', content: '使用AI驱动的搜索快速找到您需要的内容', placement: 'bottom', order: 1 },
      { id: 'filter', target: '.filter-panel', title: '高级筛选', content: '按类别、评分等条件筛选智能体', placement: 'right', order: 2 },
      { id: 'favorite', target: '.favorite-button', title: '收藏功能', content: '收藏您喜欢的智能体，方便下次使用', placement: 'left', order: 3 },
    ],
    config: {
      autoStart: false,
      showProgress: true,
      allowSkip: true,
      showCloseButton: true,
      overlayOpacity: 0.5,
      animationDuration: 300,
    },
  },
  {
    id: 'template-vip-introduction',
    name: 'VIP会员介绍',
    description: '介绍VIP会员的专属权益和功能',
    category: 'feature',
    tags: ['VIP', '会员', '权益'],
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: [
      { id: 'vip-intro', title: 'VIP会员专属权益', content: '解锁更多高级功能，享受专属服务', placement: 'center', order: 0 },
      { id: 'vip-badge', target: '.vip-badge', title: '专属标识', content: '展示您的VIP身份', placement: 'bottom', order: 1 },
      { id: 'vip-features', target: '.vip-features', title: '专属功能', content: '访问仅限VIP的高级AI功能', placement: 'top', order: 2 },
      { id: 'vip-support', target: '.support-link', title: '优先支持', content: '享受VIP专属客服支持', placement: 'bottom', order: 3 },
    ],
    config: {
      autoStart: false,
      showProgress: true,
      allowSkip: true,
      showCloseButton: true,
      overlayOpacity: 0.5,
      animationDuration: 300,
    },
  },
  {
    id: 'template-update-announcement',
    name: '功能更新公告',
    description: '通知用户新功能更新和改进',
    category: 'update',
    tags: ['更新', '公告', '新功能'],
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: [
      { id: 'update-title', title: '新功能上线', content: '我们为您带来了全新的功能体验', placement: 'center', order: 0 },
      { id: 'new-feature-1', target: '.new-feature-1', title: '新功能一', content: '描述新功能的具体内容和使用方法', placement: 'bottom', order: 1 },
      { id: 'new-feature-2', target: '.new-feature-2', title: '新功能二', content: '描述新功能的具体内容和使用方法', placement: 'bottom', order: 2 },
      { id: 'feedback', target: '.feedback-button', title: '反馈建议', content: '您的反馈对我们很重要', placement: 'left', order: 3 },
    ],
    config: {
      autoStart: true,
      showProgress: false,
      allowSkip: true,
      showCloseButton: true,
      overlayOpacity: 0.3,
      animationDuration: 200,
    },
  },
  {
    id: 'template-advanced-features',
    name: '高级功能教程',
    description: '深入介绍平台的高级功能和技巧',
    category: 'advanced',
    tags: ['高级', '教程', '技巧'],
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: [
      { id: 'advanced-intro', title: '高级功能教程', content: '掌握这些技巧，让您的AI体验更上一层楼', placement: 'center', order: 0 },
      { id: 'prompt-tips', target: '.prompt-section', title: '提示词技巧', content: '学习如何编写更有效的提示词', placement: 'right', order: 1 },
      { id: 'context-settings', target: '.context-settings', title: '上下文设置', content: '调整AI的响应风格和详细程度', placement: 'left', order: 2 },
      { id: 'history-management', target: '.history-panel', title: '历史管理', content: '管理和搜索您的对话历史', placement: 'left', order: 3 },
      { id: 'export-options', target: '.export-button', title: '导出选项', content: '将对话导出为多种格式', placement: 'top', order: 4 },
    ],
    config: {
      autoStart: false,
      showProgress: true,
      allowSkip: true,
      showCloseButton: true,
      overlayOpacity: 0.5,
      animationDuration: 300,
    },
  },
  {
    id: 'template-settings-guide',
    name: '设置向导',
    description: '帮助用户配置个人偏好和账户设置',
    category: 'onboarding',
    tags: ['设置', '配置', '个性化'],
    isBuiltIn: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    steps: [
      { id: 'settings-intro', title: '个性化设置', content: '让我们帮您配置最佳使用体验', placement: 'center', order: 0 },
      { id: 'theme', target: '.theme-switch', title: '主题设置', content: '选择您喜欢的明暗主题', placement: 'bottom', order: 1 },
      { id: 'language', target: '.language-select', title: '语言设置', content: '选择您的首选语言', placement: 'bottom', order: 2 },
      { id: 'notifications', target: '.notification-settings', title: '通知设置', content: '管理您的通知偏好', placement: 'left', order: 3 },
      { id: 'privacy', target: '.privacy-settings', title: '隐私设置', content: '控制您的数据和隐私选项', placement: 'left', order: 4 },
    ],
    config: {
      autoStart: false,
      showProgress: true,
      allowSkip: true,
      showCloseButton: true,
      overlayOpacity: 0.5,
      animationDuration: 300,
    },
  },
]

class TourTemplateService {
  private templates: Map<string, TourTemplate>

  constructor() {
    this.templates = new Map()
    this.loadTemplates()
  }

  private loadTemplates(): void {
    BUILTIN_TEMPLATES.forEach(template => {
      this.templates.set(template.id, template)
    })

    const stored = StorageManager.getItem<Record<string, TourTemplate>>(STORAGE_KEY)
    if (stored) {
      Object.entries(stored).forEach(([id, template]) => {
        if (!this.templates.has(id)) {
          this.templates.set(id, template)
        }
      })
    }
  }

  private saveTemplates(): void {
    const customTemplates: Record<string, TourTemplate> = {}
    this.templates.forEach((template, id) => {
      if (!template.isBuiltIn) {
        customTemplates[id] = template
      }
    })
    StorageManager.setItem(STORAGE_KEY, customTemplates)
  }

  getAllTemplates(): TourTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => {
      if (a.isBuiltIn !== b.isBuiltIn) {
        return a.isBuiltIn ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })
  }

  getTemplatesByCategory(category: TourTemplate['category']): TourTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category)
  }

  getTemplatesByTag(tag: string): TourTemplate[] {
    return this.getAllTemplates().filter(t => t.tags.includes(tag))
  }

  getTemplateById(id: string): TourTemplate | undefined {
    return this.templates.get(id)
  }

  createTemplate(template: Omit<TourTemplate, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>): TourTemplate {
    const newTemplate: TourTemplate = {
      ...template,
      id: `template-custom-${Date.now()}`,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.templates.set(newTemplate.id, newTemplate)
    this.saveTemplates()
    return newTemplate
  }

  updateTemplate(id: string, updates: Partial<Omit<TourTemplate, 'id' | 'isBuiltIn' | 'createdAt'>>): TourTemplate | null {
    const template = this.templates.get(id)
    if (!template || template.isBuiltIn) return null

    const updated: TourTemplate = {
      ...template,
      ...updates,
      updatedAt: Date.now(),
    }
    this.templates.set(id, updated)
    this.saveTemplates()
    return updated
  }

  deleteTemplate(id: string): boolean {
    const template = this.templates.get(id)
    if (!template || template.isBuiltIn) return false

    this.templates.delete(id)
    this.saveTemplates()
    return true
  }

  duplicateTemplate(id: string): TourTemplate | null {
    const original = this.templates.get(id)
    if (!original) return null

    const duplicate: TourTemplate = {
      ...JSON.parse(JSON.stringify(original)),
      id: `template-custom-${Date.now()}`,
      name: `${original.name} (副本)`,
      isBuiltIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.templates.set(duplicate.id, duplicate)
    this.saveTemplates()
    return duplicate
  }

  importTemplate(json: string): TourTemplate | null {
    try {
      const template = JSON.parse(json) as TourTemplate
      if (!template.name || !template.steps || !Array.isArray(template.steps)) {
        return null
      }
      return this.createTemplate({
        name: template.name,
        description: template.description || '',
        category: template.category || 'custom',
        tags: template.tags || [],
        steps: template.steps,
        config: template.config || this.getDefaultConfig(),
      })
    } catch {
      return null
    }
  }

  exportTemplate(id: string): string | null {
    const template = this.templates.get(id)
    if (!template) return null
    return JSON.stringify(template, null, 2)
  }

  exportAllTemplates(): string {
    return JSON.stringify(this.getAllTemplates(), null, 2)
  }

  getDefaultConfig(): TourTemplateConfig {
    return {
      autoStart: false,
      showProgress: true,
      allowSkip: true,
      showCloseButton: true,
      overlayOpacity: 0.5,
      animationDuration: 300,
    }
  }

  getCategories(): { value: TourTemplate['category']; label: string }[] {
    return [
      { value: 'onboarding', label: '入门引导' },
      { value: 'feature', label: '功能介绍' },
      { value: 'update', label: '更新公告' },
      { value: 'advanced', label: '高级教程' },
      { value: 'custom', label: '自定义' },
    ]
  }

  getAllTags(): string[] {
    const tags = new Set<string>()
    this.templates.forEach(template => {
      template.tags.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }

  searchTemplates(query: string): TourTemplate[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllTemplates().filter(template => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      template.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    )
  }

  applyTemplate(templateId: string, tourId: string): { tourId: string; steps: TourTemplateStep[]; config: TourTemplateConfig } | null {
    const template = this.templates.get(templateId)
    if (!template) return null

    return {
      tourId,
      steps: template.steps,
      config: template.config,
    }
  }
}

export const tourTemplateService = new TourTemplateService()
