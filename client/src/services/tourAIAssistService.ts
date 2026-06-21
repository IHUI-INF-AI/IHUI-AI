import { StorageManager } from '@/utils/storage'

export interface GeneratedContent {
  title: string
  content: string
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
  confidence: number
}

export interface StepSuggestion {
  id: string
  target: string
  title: string
  content: string
  order: number
  score: number
  reasons: string[]
}

export interface ContentOptimization {
  original: string
  optimized: string
  improvements: string[]
  score: number
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'local'
  model: string
  temperature: number
  maxTokens: number
  language: string
}

const CONFIG_KEY = 'tour_ai_config'
const SUGGESTIONS_KEY = 'tour_ai_suggestions'

const DEFAULT_CONFIG: AIConfig = {
  provider: 'local',
  model: 'default',
  temperature: 0.7,
  maxTokens: 500,
  language: 'zh-CN',
}

const STEP_TEMPLATES: Record<string, { title: string; content: string }> = {
  welcome: {
    title: '欢迎',
    content: '欢迎使用我们的产品！让我们带您了解主要功能。',
  },
  navigation: {
    title: '导航',
    content: '使用顶部导航栏可以快速访问各个功能模块。',
  },
  search: {
    title: '搜索',
    content: '在这里输入关键词，快速找到您需要的内容。',
  },
  settings: {
    title: '设置',
    content: '点击这里可以自定义您的偏好设置。',
  },
  profile: {
    title: '个人中心',
    content: '管理您的账户信息和个人资料。',
  },
  help: {
    title: '帮助',
    content: '遇到问题？点击这里获取帮助文档和支持。',
  },
  feature: {
    title: '功能介绍',
    content: '这是一个重要功能，可以帮助您完成关键任务。',
  },
  action: {
    title: '操作引导',
    content: '点击此按钮执行相应操作。',
  },
}

class TourAIAssistService {
  private config: AIConfig
  private suggestions: StepSuggestion[] = []

  constructor() {
    this.config = this.loadConfig()
    this.suggestions = StorageManager.getItem<StepSuggestion[]>(SUGGESTIONS_KEY) || []
  }

  private loadConfig(): AIConfig {
    const stored = StorageManager.getItem<AIConfig>(CONFIG_KEY)
    return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
  }

  private saveConfig(): void {
    StorageManager.setItem(CONFIG_KEY, this.config)
  }

  private saveSuggestions(): void {
    StorageManager.setItem(SUGGESTIONS_KEY, this.suggestions)
  }

  configure(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config }
    this.saveConfig()
  }

  getConfig(): AIConfig {
    return { ...this.config }
  }

  async generateContent(context: {
    pageUrl: string
    elementSelector?: string
    elementType?: string
    purpose: string
    existingSteps?: { title: string; content: string }[]
  }): Promise<GeneratedContent> {
    await this.simulateDelay()

    const templates = Object.values(STEP_TEMPLATES)
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)]

    let title = randomTemplate.title
    let content = randomTemplate.content

    if (context.purpose === 'welcome') {
      title = '欢迎'
      content = '欢迎使用我们的产品！让我们带您了解主要功能。'
    } else if (context.purpose === 'feature' && context.elementSelector) {
      title = '功能介绍'
      content = `这个区域是${context.elementSelector.replace(/[.#]/g, '')}功能，可以帮助您完成重要操作。`
    } else if (context.purpose === 'navigation') {
      title = '导航指南'
      content = '使用导航菜单可以快速切换不同功能模块。'
    }

    return {
      title,
      content,
      placement: 'bottom',
      confidence: 0.85,
    }
  }

  async suggestSteps(_context: {
    pageUrl: string
    pageContent?: string
    userGoal?: string
  }): Promise<StepSuggestion[]> {
    await this.simulateDelay()

    const suggestions: StepSuggestion[] = []
    const commonSelectors = [
      { selector: '.header', type: 'navigation' },
      { selector: '.search-input', type: 'search' },
      { selector: '.settings-button', type: 'settings' },
      { selector: '.profile-menu', type: 'profile' },
      { selector: '.help-link', type: 'help' },
      { selector: '.main-content', type: 'feature' },
    ]

    commonSelectors.forEach((item, index) => {
      const template = STEP_TEMPLATES[item.type] || STEP_TEMPLATES.feature
      suggestions.push({
        id: `suggestion-${index}`,
        target: item.selector,
        title: template.title,
        content: template.content,
        order: index,
        score: 0.8 - index * 0.05,
        reasons: ['常见交互元素', '用户常用功能', '提升用户体验'],
      })
    })

    this.suggestions = suggestions
    this.saveSuggestions()
    return suggestions
  }

  async optimizeContent(content: {
    title: string
    content: string
  }): Promise<ContentOptimization> {
    await this.simulateDelay()

    const improvements: string[] = []
    let optimizedTitle = content.title
    let optimizedContent = content.content

    if (content.title.length > 30) {
      optimizedTitle = content.title.substring(0, 30) + '...'
      improvements.push('标题过长，已截断至30字符')
    }

    if (content.content.length > 200) {
      optimizedContent = content.content.substring(0, 200) + '...'
      improvements.push('内容过长，已精简至200字符')
    }

    if (!content.title.trim()) {
      optimizedTitle = '引导步骤'
      improvements.push('添加了默认标题')
    }

    if (!content.content.trim()) {
      optimizedContent = '请按照提示进行操作。'
      improvements.push('添加了默认内容')
    }

    if (!content.content.endsWith('。') && !content.content.endsWith('！') && !content.content.endsWith('？')) {
      optimizedContent += '。'
      improvements.push('添加了句末标点')
    }

    const score = Math.max(0, 100 - improvements.length * 15)

    return {
      original: `${content.title}: ${content.content}`,
      optimized: `${optimizedTitle}: ${optimizedContent}`,
      improvements,
      score,
    }
  }

  async sortSteps(steps: { id: string; target?: string; title: string }[]): Promise<{ id: string; order: number; reason: string }[]> {
    await this.simulateDelay()

    const priorityTargets = ['.header', '.navigation', '.main-content', '.search', '.settings']
    
    const sorted = [...steps].sort((a, b) => {
      const aIndex = a.target ? priorityTargets.findIndex(t => a.target!.includes(t)) : 999
      const bIndex = b.target ? priorityTargets.findIndex(t => b.target!.includes(t)) : 999
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
    })

    return sorted.map((step, index) => ({
      id: step.id,
      order: index,
      reason: index === 0 ? '首步应介绍主要导航' : `按交互顺序排列`,
    }))
  }

  async generateTourFromDescription(description: string): Promise<{
    title: string
    description: string
    steps: GeneratedContent[]
  }> {
    await this.simulateDelay()

    const steps: GeneratedContent[] = []
    const stepCount = Math.min(5, Math.max(3, Math.floor(description.length / 50)))

    for (let i = 0; i < stepCount; i++) {
      const template = Object.values(STEP_TEMPLATES)[i % Object.keys(STEP_TEMPLATES).length]
      steps.push({
        title: template.title,
        content: template.content,
        placement: i === 0 ? 'center' : 'bottom',
        confidence: 0.75,
      })
    }

    return {
      title: '自动生成的引导',
      description: description.substring(0, 100),
      steps,
    }
  }

  getSuggestions(): StepSuggestion[] {
    return [...this.suggestions]
  }

  clearSuggestions(): void {
    this.suggestions = []
    this.saveSuggestions()
  }

  async analyzePage(pageContent: string): Promise<{
    elements: { selector: string; importance: number; suggested: boolean }[]
    recommendations: string[]
  }> {
    await this.simulateDelay()

    const elements = [
      { selector: '.header', importance: 0.9, suggested: true },
      { selector: '.main-content', importance: 0.85, suggested: true },
      { selector: '.navigation', importance: 0.8, suggested: true },
      { selector: '.search', importance: 0.75, suggested: true },
      { selector: '.sidebar', importance: 0.6, suggested: false },
      { selector: '.footer', importance: 0.3, suggested: false },
    ]

    const recommendations: string[] = []
    
    if (pageContent.length > 10000) {
      recommendations.push('页面内容较多，建议分多个引导步骤')
    }
    
    recommendations.push('建议从导航区域开始引导')
    recommendations.push('重要功能应优先展示')

    return { elements, recommendations }
  }

  private simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100))
  }

  getStepTemplates(): Record<string, { title: string; content: string }> {
    return { ...STEP_TEMPLATES }
  }

  addCustomTemplate(id: string, template: { title: string; content: string }): void {
    STEP_TEMPLATES[id] = template
  }
}

export const tourAIAssistService = new TourAIAssistService()
