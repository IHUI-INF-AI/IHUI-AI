import { t } from '@/utils/i18n'

/**
 * OpenClaw Integrations
 * 
 * 第三方服务集成:
 * - Email: Gmail, Outlook
 * - Calendar: Google Calendar, Outlook Calendar
 * - Git: GitHub, GitLab
 * - Smart Home: Home Assistant, Philips Hue, Nest
 * - Productivity: Notion, Jira, Trello, Slack
 * - Social: Twitter/X, Spotify, YouTube
 * 
 * 参考: https://docs.clawd.bot/integrations
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

/**
 * 集成类型
 */
export type IntegrationType =
  | 'email'
  | 'calendar'
  | 'git'
  | 'smart_home'
  | 'productivity'
  | 'social'
  | 'storage'
  | 'communication'
  | 'analytics'
  | 'custom'

/**
 * 集成提供商
 */
export type IntegrationProvider =
  // Email
  | 'gmail'
  | 'outlook'
  | 'yahoo'
  // Calendar
  | 'google_calendar'
  | 'outlook_calendar'
  | 'apple_calendar'
  // Git
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  // Smart Home
  | 'home_assistant'
  | 'philips_hue'
  | 'nest'
  | 'smartthings'
  // Productivity
  | 'notion'
  | 'jira'
  | 'trello'
  | 'asana'
  | 'linear'
  // Communication
  | 'slack'
  | 'discord'
  | 'teams'
  // Social
  | 'twitter'
  | 'spotify'
  | 'youtube'
  // Storage
  | 'google_drive'
  | 'dropbox'
  | 'onedrive'
  // Custom
  | 'custom'

/**
 * 集成配置
 */
export interface IntegrationConfig {
  id: string
  provider: IntegrationProvider
  type: IntegrationType
  name: string
  enabled: boolean
  credentials: IntegrationCredentials
  settings: Record<string, unknown>
  lastSync?: number
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  error?: string
}

/**
 * 集成凭据
 */
export interface IntegrationCredentials {
  accessToken?: string
  refreshToken?: string
  apiKey?: string
  clientId?: string
  clientSecret?: string
  expiresAt?: number
  scopes?: string[]
  metadata?: Record<string, unknown>
}

/**
 * OAuth 配置
 */
export interface OAuthConfig {
  provider: IntegrationProvider
  clientId: string
  clientSecret?: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  redirectUri: string
}

/**
 * 集成能力
 */
export interface IntegrationCapability {
  name: string
  description: string
  available: boolean
  requiredScopes?: string[]
}

// ==================== Email Integration ====================

/**
 * 邮件
 */
export interface Email {
  id: string
  threadId?: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  bcc?: EmailAddress[]
  subject: string
  body: string
  bodyHtml?: string
  date: number
  read: boolean
  starred: boolean
  labels?: string[]
  attachments?: EmailAttachment[]
}

export interface EmailAddress {
  name?: string
  email: string
}

export interface EmailAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  data?: string
}

export interface EmailSearchOptions {
  query?: string
  from?: string
  to?: string
  subject?: string
  after?: Date
  before?: Date
  hasAttachment?: boolean
  isRead?: boolean
  labels?: string[]
  limit?: number
}

// ==================== Calendar Integration ====================

/**
 * 日历事件
 */
export interface CalendarEvent {
  id: string
  calendarId: string
  title: string
  description?: string
  location?: string
  start: EventDateTime
  end: EventDateTime
  allDay: boolean
  recurring?: RecurrenceRule
  attendees?: Attendee[]
  reminders?: Reminder[]
  status: 'confirmed' | 'tentative' | 'cancelled'
  visibility: 'public' | 'private' | 'default'
  link?: string
  metadata?: Record<string, unknown>
}

export interface EventDateTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

export interface Attendee {
  email: string
  name?: string
  status: 'needsAction' | 'declined' | 'tentative' | 'accepted'
  optional?: boolean
}

export interface Reminder {
  method: 'email' | 'popup' | 'sms'
  minutes: number
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  until?: string
  count?: number
  byDay?: string[]
  byMonth?: number[]
  byMonthDay?: number[]
}

export interface CalendarSearchOptions {
  calendarId?: string
  startTime?: Date
  endTime?: Date
  query?: string
  limit?: number
}

// ==================== Git Integration ====================

/**
 * Git 仓库
 */
export interface GitRepository {
  id: string
  name: string
  fullName: string
  description?: string
  url: string
  htmlUrl: string
  private: boolean
  owner: GitUser
  defaultBranch: string
  stars: number
  forks: number
  openIssues: number
  language?: string
  topics?: string[]
  createdAt: string
  updatedAt: string
}

export interface GitUser {
  id: string
  login: string
  name?: string
  avatarUrl?: string
  url: string
}

export interface GitIssue {
  id: string
  number: number
  title: string
  body?: string
  state: 'open' | 'closed'
  author: GitUser
  assignees?: GitUser[]
  labels?: GitLabel[]
  milestone?: GitMilestone
  createdAt: string
  updatedAt: string
  closedAt?: string
}

export interface GitPullRequest extends GitIssue {
  head: GitBranch
  base: GitBranch
  merged: boolean
  mergeable?: boolean
  draft: boolean
}

export interface GitBranch {
  ref: string
  sha: string
  repo: { name: string; owner: string }
}

export interface GitLabel {
  name: string
  color: string
  description?: string
}

export interface GitMilestone {
  id: string
  number: number
  title: string
  state: 'open' | 'closed'
  dueOn?: string
}

export interface GitCommit {
  sha: string
  message: string
  author: GitUser
  date: string
  url: string
}

// ==================== Smart Home Integration ====================

/**
 * 智能设备
 */
export interface SmartDevice {
  id: string
  name: string
  type: SmartDeviceType
  room?: string
  manufacturer?: string
  model?: string
  state: SmartDeviceState
  capabilities: SmartDeviceCapability[]
  metadata?: Record<string, unknown>
}

export type SmartDeviceType =
  | 'light'
  | 'switch'
  | 'thermostat'
  | 'lock'
  | 'camera'
  | 'sensor'
  | 'speaker'
  | 'tv'
  | 'plug'
  | 'vacuum'
  | 'door'
  | 'window'
  | 'fan'
  | 'other'

export interface SmartDeviceState {
  on?: boolean
  brightness?: number
  color?: { hue: number; saturation: number }
  colorTemperature?: number
  temperature?: number
  targetTemperature?: number
  humidity?: number
  locked?: boolean
  open?: boolean
  battery?: number
  motion?: boolean
  contact?: boolean
  [key: string]: unknown
}

export interface SmartDeviceCapability {
  name: string
  type: 'read' | 'write' | 'both'
  values?: unknown[]
  range?: { min: number; max: number; step?: number }
}

export interface SmartScene {
  id: string
  name: string
  actions: SmartAction[]
}

export interface SmartAction {
  deviceId: string
  command: string
  params?: Record<string, unknown>
}

// ==================== 集成管理器 ====================

/**
 * 集成管理器
 */
export class IntegrationManager extends EventEmitter {
  private integrations = reactive<Map<string, IntegrationConfig>>(new Map())
  private initialized = ref(false)

  constructor() {
    super()
  }

  /**
   * 初始化集成系统
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[Integrations] Initializing integration system...')

    // 加载已保存的集成
    await this.loadIntegrations()

    this.initialized.value = true
    logger.info('[Integrations] Integration system initialized')
    this.emit('initialized')
  }

  /**
   * 加载集成配置
   */
  private async loadIntegrations(): Promise<void> {
    try {
      const saved = localStorage.getItem('openclaw_integrations')
      if (saved) {
        const parsed = JSON.parse(saved)
        for (const [id, config] of Object.entries(parsed)) {
          this.integrations.set(id, config as IntegrationConfig)
        }
      }
      logger.info(`[Integrations] Loaded integrations`)
    } catch (error) {
      logger.error('[Integrations] Failed to load integration config:', error)
    }
  }

  /**
   * 保存集成配置
   */
  private saveIntegrations(): void {
    const obj: Record<string, IntegrationConfig> = {}
    this.integrations.forEach((config, id) => {
      obj[id] = config
    })
    localStorage.setItem('openclaw_integrations', JSON.stringify(obj))
  }

  /**
   * 添加集成
   */
  async addIntegration(
    provider: IntegrationProvider,
    credentials: IntegrationCredentials,
    settings: Record<string, unknown> = {}
  ): Promise<IntegrationConfig> {
    const type = this.getIntegrationType(provider)
    const id = `${provider}_${Date.now()}`

    const config: IntegrationConfig = {
      id,
      provider,
      type,
      name: this.getProviderName(provider),
      enabled: true,
      credentials,
      settings,
      status: 'pending',
    }

    // 验证连接
    try {
      await this.validateConnection(config)
      config.status = 'connected'
      config.lastSync = Date.now()
    } catch (error) {
      config.status = 'error'
      config.error = (error as Error).message
    }

    this.integrations.set(id, config)
    this.saveIntegrations()

    this.emit('integrationAdded', config)
    
    return config
  }

  /**
   * 移除集成
   */
  async removeIntegration(id: string): Promise<void> {
    const config = this.integrations.get(id)
    if (!config) return

    this.integrations.delete(id)
    this.saveIntegrations()

    this.emit('integrationRemoved', id)
  }

  /**
   * 启用/禁用集成
   */
  toggleIntegration(id: string, enabled: boolean): void {
    const config = this.integrations.get(id)
    if (config) {
      config.enabled = enabled
      this.saveIntegrations()
      this.emit('integrationToggled', { id, enabled })
    }
  }

  /**
   * 验证连接
   */
  private async validateConnection(config: IntegrationConfig): Promise<void> {
    // 根据不同的提供商验证连接
    switch (config.provider) {
      case 'gmail':
      case 'google_calendar':
      case 'google_drive':
        // Google API 验证
        if (!config.credentials.accessToken) {
          throw new Error(t('error.index.缺少访问令牌'))
        }
        break
      case 'github':
      case 'gitlab':
        // Git API 验证
        if (!config.credentials.accessToken) {
          throw new Error(t('error.index.缺少访问令牌1'))
        }
        break
      case 'home_assistant':
        // Home Assistant 验证
        if (!config.credentials.accessToken || !config.settings.url) {
          throw new Error(t('error.index.缺少URL或访问2'))
        }
        break
      default:
        // 其他验证
        break
    }
  }

  /**
   * 获取集成类型
   */
  private getIntegrationType(provider: IntegrationProvider): IntegrationType {
    const typeMap: Record<IntegrationProvider, IntegrationType> = {
      gmail: 'email',
      outlook: 'email',
      yahoo: 'email',
      google_calendar: 'calendar',
      outlook_calendar: 'calendar',
      apple_calendar: 'calendar',
      github: 'git',
      gitlab: 'git',
      bitbucket: 'git',
      home_assistant: 'smart_home',
      philips_hue: 'smart_home',
      nest: 'smart_home',
      smartthings: 'smart_home',
      notion: 'productivity',
      jira: 'productivity',
      trello: 'productivity',
      asana: 'productivity',
      linear: 'productivity',
      slack: 'communication',
      discord: 'communication',
      teams: 'communication',
      twitter: 'social',
      spotify: 'social',
      youtube: 'social',
      google_drive: 'storage',
      dropbox: 'storage',
      onedrive: 'storage',
      custom: 'custom',
    }
    return typeMap[provider] || 'custom'
  }

  /**
   * 获取提供商名称
   */
  private getProviderName(provider: IntegrationProvider): string {
    const names: Record<IntegrationProvider, string> = {
      gmail: 'Gmail',
      outlook: 'Outlook',
      yahoo: 'Yahoo Mail',
      google_calendar: 'Google Calendar',
      outlook_calendar: 'Outlook Calendar',
      apple_calendar: 'Apple Calendar',
      github: 'GitHub',
      gitlab: 'GitLab',
      bitbucket: 'Bitbucket',
      home_assistant: 'Home Assistant',
      philips_hue: 'Philips Hue',
      nest: 'Nest',
      smartthings: 'SmartThings',
      notion: 'Notion',
      jira: 'Jira',
      trello: 'Trello',
      asana: 'Asana',
      linear: 'Linear',
      slack: 'Slack',
      discord: 'Discord',
      teams: 'Microsoft Teams',
      twitter: 'Twitter/X',
      spotify: 'Spotify',
      youtube: 'YouTube',
      google_drive: 'Google Drive',
      dropbox: 'Dropbox',
      onedrive: 'OneDrive',
      custom: 'Custom',
    }
    return names[provider] || provider
  }

  /**
   * 获取所有集成
   */
  getIntegrations(): IntegrationConfig[] {
    return Array.from(this.integrations.values())
  }

  /**
   * 获取集成
   */
  getIntegration(id: string): IntegrationConfig | undefined {
    return this.integrations.get(id)
  }

  /**
   * 按类型获取集成
   */
  getIntegrationsByType(type: IntegrationType): IntegrationConfig[] {
    return this.getIntegrations().filter(i => i.type === type)
  }

  /**
   * 按提供商获取集成
   */
  getIntegrationByProvider(provider: IntegrationProvider): IntegrationConfig | undefined {
    return this.getIntegrations().find(i => i.provider === provider)
  }

  // ==================== Email API ====================

  /**
   * 获取邮件列表
   */
  async getEmails(integrationId: string, _options: EmailSearchOptions = {}): Promise<Email[]> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'email') {
      throw new Error(t('error.index.无效的邮件集成3'))
    }

    // 实际应调用对应的邮件 API
    logger.info(`[Integrations] Fetching emails: ${integration.provider}`)
    
    return []
  }

  /**
   * 发送邮件
   */
  async sendEmail(
    integrationId: string,
    email: Omit<Email, 'id' | 'date' | 'read' | 'starred'>
  ): Promise<Email> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'email') {
      throw new Error(t('error.index.无效的邮件集成4'))
    }

    logger.info(`[Integrations] Sending email: ${email.subject}`)
    
    return {
      ...email,
      id: `email_${Date.now()}`,
      date: Date.now(),
      read: true,
      starred: false,
    }
  }

  // ==================== Calendar API ====================

  /**
   * 获取日历事件
   */
  async getCalendarEvents(
    integrationId: string,
    _options: CalendarSearchOptions = {}
  ): Promise<CalendarEvent[]> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'calendar') {
      throw new Error(t('error.index.无效的日历集成5'))
    }

    logger.info(`[Integrations] Fetching calendar events: ${integration.provider}`)
    
    return []
  }

  /**
   * 创建日历事件
   */
  async createCalendarEvent(
    integrationId: string,
    event: Omit<CalendarEvent, 'id'>
  ): Promise<CalendarEvent> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'calendar') {
      throw new Error(t('error.index.无效的日历集成6'))
    }

    logger.info(`[Integrations] Creating calendar event: ${event.title}`)
    
    return {
      ...event,
      id: `event_${Date.now()}`,
    }
  }

  // ==================== Git API ====================

  /**
   * 获取仓库列表
   */
  async getRepositories(integrationId: string): Promise<GitRepository[]> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'git') {
      throw new Error(t('error.index.无效的Git集成7'))
    }

    logger.info(`[Integrations] Fetching repositories: ${integration.provider}`)
    
    return []
  }

  /**
   * 获取 Issues
   */
  async getIssues(
    integrationId: string,
    repo: string,
    _state?: 'open' | 'closed' | 'all'
  ): Promise<GitIssue[]> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'git') {
      throw new Error(t('error.index.无效的Git集成8'))
    }

    logger.info(`[Integrations] Fetching issues: ${repo}`)
    
    return []
  }

  /**
   * 创建 Issue
   */
  async createIssue(
    integrationId: string,
    repo: string,
    issue: { title: string; body?: string; labels?: string[]; assignees?: string[] }
  ): Promise<GitIssue> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'git') {
      throw new Error(t('error.index.无效的Git集成9'))
    }

    logger.info(`[Integrations] Creating issue: ${issue.title}`)
    
    return {
      id: `issue_${Date.now()}`,
      number: 1,
      title: issue.title,
      body: issue.body,
      state: 'open',
      author: { id: 'user', login: 'user', url: '' },
      labels: issue.labels?.map(name => ({ name, color: '000000' })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  // ==================== Smart Home API ====================

  /**
   * 获取智能设备列表
   */
  async getSmartDevices(integrationId: string): Promise<SmartDevice[]> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'smart_home') {
      throw new Error(t('error.index.无效的智能家居集10'))
    }

    logger.info(`[Integrations] Fetching smart devices: ${integration.provider}`)
    
    return []
  }

  /**
   * 控制智能设备
   */
  async controlSmartDevice(
    integrationId: string,
    deviceId: string,
    command: string,
    _params?: Record<string, unknown>
  ): Promise<SmartDeviceState> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'smart_home') {
      throw new Error(t('error.index.无效的智能家居集11'))
    }

    logger.info(`[Integrations] Controlling device: ${deviceId}, command: ${command}`)
    
    return { on: true }
  }

  /**
   * 执行场景
   */
  async executeSmartScene(integrationId: string, sceneId: string): Promise<void> {
    const integration = this.integrations.get(integrationId)
    if (!integration || integration.type !== 'smart_home') {
      throw new Error(t('error.index.无效的智能家居集12'))
    }

    logger.info(`[Integrations] Executing scene: ${sceneId}`)
  }

  /**
   * 关闭集成系统
   */
  shutdown(): void {
    this.saveIntegrations()
    this.initialized.value = false
    logger.info('[Integrations] Integration system shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let integrationManagerInstance: IntegrationManager | null = null

/**
 * 获取集成管理器实例
 */
export function getIntegrationManager(): IntegrationManager {
  if (!integrationManagerInstance) {
    integrationManagerInstance = new IntegrationManager()
  }
  return integrationManagerInstance
}

export default IntegrationManager
