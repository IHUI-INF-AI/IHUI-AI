/**
 * OpenClaw System Management
 * 
 * 系统管理功能:
 * - 系统诊断 (Doctor)
 * - 健康检查 (Health)
 * - 仪表板 (Dashboard)
 * - 更新管理 (Update)
 * - 安全审批 (Approvals)
 * - 沙箱模式 (Sandbox)
 * - 日志管理 (Logs)
 * - Moltbook 社交 (Social)
 * 
 * 参考: https://docs.clawd.bot/cli
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'

// ==================== 系统诊断 ====================

/**
 * 诊断结果
 */
export interface DiagnosticResult {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
  details?: Record<string, unknown>
  fixSuggestion?: string
}

/**
 * 系统诊断
 */
export interface SystemDiagnostics {
  timestamp: number
  duration: number
  overall: 'healthy' | 'degraded' | 'unhealthy'
  results: DiagnosticResult[]
}

// ==================== 健康检查 ====================

/**
 * 健康状态
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  uptime: number
  version: string
  services: ServiceHealth[]
  resources: ResourceHealth
  lastCheck: number
}

/**
 * 服务健康
 */
export interface ServiceHealth {
  name: string
  status: 'running' | 'stopped' | 'error'
  latency?: number
  lastError?: string
  lastCheck: number
}

/**
 * 资源健康
 */
export interface ResourceHealth {
  memory: {
    used: number
    total: number
    percentage: number
  }
  storage: {
    used: number
    total: number
    percentage: number
  }
  cpu?: {
    usage: number
    cores: number
  }
}

// ==================== 仪表板 ====================

/**
 * 仪表板数据
 */
export interface DashboardData {
  overview: {
    totalMessages: number
    totalTasks: number
    activeSkills: number
    connectedDevices: number
    uptimeHours: number
  }
  recentActivity: ActivityItem[]
  topModels: ModelUsage[]
  skillUsage: SkillUsage[]
  errors: ErrorItem[]
  timeline: TimelineItem[]
}

/**
 * 活动项
 */
export interface ActivityItem {
  id: string
  type: 'message' | 'task' | 'skill' | 'error' | 'system'
  description: string
  timestamp: number
  metadata?: Record<string, unknown>
}

/**
 * 模型使用
 */
export interface ModelUsage {
  modelId: string
  name: string
  requests: number
  tokens: number
  cost: number
}

/**
 * 技能使用
 */
export interface SkillUsage {
  skillId: string
  name: string
  executions: number
  successRate: number
}

/**
 * 错误项
 */
export interface ErrorItem {
  id: string
  type: string
  message: string
  stack?: string
  timestamp: number
  resolved: boolean
}

/**
 * 时间线项
 */
export interface TimelineItem {
  timestamp: number
  type: string
  value: number
}

// ==================== 安全审批 ====================

/**
 * 审批请求
 */
export interface ApprovalRequest {
  id: string
  type: ApprovalType
  action: string
  description: string
  requestedBy: string
  risk: 'low' | 'medium' | 'high' | 'critical'
  details: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  createdAt: number
  expiresAt: number
  decidedAt?: number
  decidedBy?: string
  reason?: string
}

/**
 * 审批类型
 */
export type ApprovalType =
  | 'file_access'
  | 'shell_command'
  | 'network_request'
  | 'skill_install'
  | 'setting_change'
  | 'data_export'
  | 'integration_connect'
  | 'device_pair'
  | 'custom'

/**
 * 审批策略
 */
export interface ApprovalPolicy {
  type: ApprovalType
  autoApprove: boolean
  requireReason: boolean
  notifyOnRequest: boolean
  expiryTime: number
  allowedActions?: string[]
  blockedActions?: string[]
}

// ==================== 沙箱模式 ====================

/**
 * 沙箱配置
 */
export interface SandboxConfig {
  enabled: boolean
  allowedDomains: string[]
  blockedDomains: string[]
  allowFileAccess: boolean
  allowNetworkAccess: boolean
  allowShellCommands: boolean
  maxMemory: number
  maxCpu: number
  timeout: number
  logLevel: 'none' | 'errors' | 'all'
}

/**
 * 沙箱状态
 */
export interface SandboxStatus {
  enabled: boolean
  activeInstances: number
  totalExecutions: number
  blockedActions: number
  lastViolation?: {
    type: string
    action: string
    timestamp: number
  }
}

// ==================== Moltbook 社交 ====================

/**
 * Moltbook 帖子
 */
export interface MoltbookPost {
  id: string
  authorId: string
  authorName: string
  content: string
  category?: string
  tags: string[]
  likes: number
  comments: number
  shares: number
  createdAt: number
  updatedAt: number
}

/**
 * Moltbook 评论
 */
export interface MoltbookComment {
  id: string
  postId: string
  authorId: string
  authorName: string
  content: string
  likes: number
  createdAt: number
}

/**
 * Moltbook 代理
 */
export interface MoltbookAgent {
  id: string
  name: string
  description: string
  avatar?: string
  followers: number
  following: number
  posts: number
  skills: string[]
  verified: boolean
  joinedAt: number
}

// ==================== 系统管理器 ====================

/**
 * 系统管理器配置
 */
export interface SystemManagerConfig {
  /** 健康检查间隔 (秒) */
  healthCheckInterval?: number
  /** 日志保留天数 */
  logRetentionDays?: number
  /** 启用沙箱 */
  sandboxEnabled?: boolean
  /** 审批超时 (秒) */
  approvalTimeout?: number
  /** Moltbook API */
  moltbookApiUrl?: string
}

/**
 * 系统管理器
 */
export class SystemManager extends EventEmitter {
  private config: Required<SystemManagerConfig>
  private initialized = ref(false)
  private startTime = Date.now()
  
  // 健康状态
  private healthStatus = reactive<HealthStatus>({
    status: 'healthy',
    uptime: 0,
    version: '1.0.0',
    services: [],
    resources: {
      memory: { used: 0, total: 0, percentage: 0 },
      storage: { used: 0, total: 0, percentage: 0 },
    },
    lastCheck: Date.now(),
  })

  // 审批
  private approvalRequests = reactive<Map<string, ApprovalRequest>>(new Map())
  private approvalPolicies = reactive<Map<ApprovalType, ApprovalPolicy>>(new Map())

  // 沙箱
  private sandboxConfig = reactive<SandboxConfig>({
    enabled: false,
    allowedDomains: [],
    blockedDomains: [],
    allowFileAccess: false,
    allowNetworkAccess: true,
    allowShellCommands: false,
    maxMemory: 256 * 1024 * 1024,
    maxCpu: 50,
    timeout: 30000,
    logLevel: 'errors',
  })
  private sandboxStatus = reactive<SandboxStatus>({
    enabled: false,
    activeInstances: 0,
    totalExecutions: 0,
    blockedActions: 0,
  })

  // 活动记录
  private activities = ref<ActivityItem[]>([])
  private errors = ref<ErrorItem[]>([])

  // 定时器
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null

  constructor(config: SystemManagerConfig = {}) {
    super()
    this.config = {
      healthCheckInterval: config.healthCheckInterval || 60,
      logRetentionDays: config.logRetentionDays || 7,
      sandboxEnabled: config.sandboxEnabled ?? false,
      approvalTimeout: config.approvalTimeout || 300,
      moltbookApiUrl: config.moltbookApiUrl || 'https://api.moltbook.com/v1',
    }
  }

  /**
   * 初始化系统管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized.value) return

    logger.info('[System] Initializing system manager...')

    // 初始化默认审批策略
    this.initializeApprovalPolicies()

    // 加载配置
    await this.loadConfig()

    // 启动健康检查
    this.startHealthCheck()

    // 初始沙箱状态
    this.sandboxStatus.enabled = this.config.sandboxEnabled

    this.initialized.value = true
    logger.info('[System] System manager initialized')
    this.emit('initialized')
  }

  /**
   * 初始化审批策略
   */
  private initializeApprovalPolicies(): void {
    const defaultPolicies: ApprovalPolicy[] = [
      { type: 'file_access', autoApprove: false, requireReason: true, notifyOnRequest: true, expiryTime: 300 },
      { type: 'shell_command', autoApprove: false, requireReason: true, notifyOnRequest: true, expiryTime: 60 },
      { type: 'network_request', autoApprove: true, requireReason: false, notifyOnRequest: false, expiryTime: 300 },
      { type: 'skill_install', autoApprove: false, requireReason: false, notifyOnRequest: true, expiryTime: 600 },
      { type: 'setting_change', autoApprove: true, requireReason: false, notifyOnRequest: false, expiryTime: 300 },
      { type: 'data_export', autoApprove: false, requireReason: true, notifyOnRequest: true, expiryTime: 300 },
      { type: 'integration_connect', autoApprove: false, requireReason: false, notifyOnRequest: true, expiryTime: 600 },
      { type: 'device_pair', autoApprove: false, requireReason: false, notifyOnRequest: true, expiryTime: 300 },
      { type: 'custom', autoApprove: false, requireReason: true, notifyOnRequest: true, expiryTime: 300 },
    ]

    for (const policy of defaultPolicies) {
      this.approvalPolicies.set(policy.type, policy)
    }
  }

  /**
   * 加载配置
   */
  private async loadConfig(): Promise<void> {
    try {
      const savedSandbox = localStorage.getItem('openclaw_sandbox_config')
      if (savedSandbox) {
        Object.assign(this.sandboxConfig, JSON.parse(savedSandbox))
      }

      const savedPolicies = localStorage.getItem('openclaw_approval_policies')
      if (savedPolicies) {
        const policies = JSON.parse(savedPolicies) as ApprovalPolicy[]
        for (const policy of policies) {
          this.approvalPolicies.set(policy.type, policy)
        }
      }
    } catch (error) {
      logger.error('[System] Failed to load config:', error)
    }
  }

  /**
   * 保存配置
   */
  private saveConfig(): void {
    localStorage.setItem('openclaw_sandbox_config', JSON.stringify(this.sandboxConfig))
    localStorage.setItem('openclaw_approval_policies', JSON.stringify(Array.from(this.approvalPolicies.values())))
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      void this.performHealthCheck()
    }, this.config.healthCheckInterval * 1000)

    // 立即执行一次
    void this.performHealthCheck()
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    this.healthStatus.uptime = Math.floor((Date.now() - this.startTime) / 1000)
    this.healthStatus.lastCheck = Date.now()

    // 检查内存
    if ((performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory) {
      const memory = (performance as Performance & { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
      this.healthStatus.resources.memory = {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      }
    }

    // 检查存储
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      this.healthStatus.resources.storage = {
        used: estimate.usage || 0,
        total: estimate.quota || 0,
        percentage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0,
      }
    }

    // 确定整体状态
    if (this.healthStatus.resources.memory.percentage > 90 ||
        this.healthStatus.resources.storage.percentage > 90) {
      this.healthStatus.status = 'degraded'
    } else {
      this.healthStatus.status = 'healthy'
    }

    this.emit('healthChecked', this.healthStatus)
  }

  /**
   * 运行系统诊断
   */
  async runDiagnostics(): Promise<SystemDiagnostics> {
    const startTime = Date.now()
    const results: DiagnosticResult[] = []

    logger.info('[System] Running system diagnostics...')

    // 检查浏览器功能
    results.push({
      name: 'Browser Support',
      status: this.checkBrowserSupport() ? 'pass' : 'warn',
      message: this.checkBrowserSupport() ? '浏览器支持所有功能' : '部分功能可能不可用',
    })

    // 检查存储
    const storageOk = await this.checkStorage()
    results.push({
      name: 'Storage',
      status: storageOk ? 'pass' : 'warn',
      message: storageOk ? '存储空间充足' : '存储空间不足',
    })

    // 检查网络
    results.push({
      name: 'Network',
      status: navigator.onLine ? 'pass' : 'fail',
      message: navigator.onLine ? '网络连接正常' : '网络未连接',
    })

    // 检查 LocalStorage
    const localStorageOk = this.checkLocalStorage()
    results.push({
      name: 'LocalStorage',
      status: localStorageOk ? 'pass' : 'fail',
      message: localStorageOk ? 'LocalStorage 可用' : 'LocalStorage 不可用',
      fixSuggestion: localStorageOk ? undefined : '请检查浏览器隐私设置',
    })

    // 检查 WebSocket
    results.push({
      name: 'WebSocket',
      status: 'WebSocket' in window ? 'pass' : 'fail',
      message: 'WebSocket' in window ? 'WebSocket 支持' : 'WebSocket 不支持',
    })

    const overall = results.some(r => r.status === 'fail') ? 'unhealthy' :
                    results.some(r => r.status === 'warn') ? 'degraded' : 'healthy'

    const diagnostics: SystemDiagnostics = {
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      overall,
      results,
    }

    this.emit('diagnosticsCompleted', diagnostics)

    return diagnostics
  }

  /**
   * 检查浏览器支持
   */
  private checkBrowserSupport(): boolean {
    return (
      'fetch' in window &&
      'Promise' in window &&
      'localStorage' in window &&
      'WebSocket' in window
    )
  }

  /**
   * 检查存储
   */
  private async checkStorage(): Promise<boolean> {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate()
      const usedPercentage = estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
      return usedPercentage < 80
    }
    return true
  }

  /**
   * 检查 LocalStorage
   */
  private checkLocalStorage(): boolean {
    try {
      localStorage.setItem('__test__', 'test')
      localStorage.removeItem('__test__')
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): HealthStatus {
    return { ...this.healthStatus }
  }

  /**
   * 获取仪表板数据
   */
  getDashboardData(): DashboardData {
    return {
      overview: {
        totalMessages: this.activities.value.filter(a => a.type === 'message').length,
        totalTasks: this.activities.value.filter(a => a.type === 'task').length,
        activeSkills: 0, // 从技能管理器获取
        connectedDevices: 0, // 从配对管理器获取
        uptimeHours: Math.floor(this.healthStatus.uptime / 3600),
      },
      recentActivity: this.activities.value.slice(-20).reverse(),
      topModels: [], // 从模型管理器获取
      skillUsage: [], // 从技能管理器获取
      errors: this.errors.value.filter(e => !e.resolved).slice(-10),
      timeline: [],
    }
  }

  /**
   * 记录活动
   */
  logActivity(type: ActivityItem['type'], description: string, metadata?: Record<string, unknown>): void {
    const activity: ActivityItem = {
      id: `activity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      description,
      timestamp: Date.now(),
      metadata,
    }

    this.activities.value.push(activity)

    // 保留最近1000条
    if (this.activities.value.length > 1000) {
      this.activities.value = this.activities.value.slice(-1000)
    }

    this.emit('activityLogged', activity)
  }

  /**
   * 记录错误
   */
  logError(type: string, message: string, stack?: string): void {
    const error: ErrorItem = {
      id: `error_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      message,
      stack,
      timestamp: Date.now(),
      resolved: false,
    }

    this.errors.value.push(error)
    this.emit('errorLogged', error)
  }

  /**
   * 解决错误
   */
  resolveError(errorId: string): void {
    const error = this.errors.value.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      this.emit('errorResolved', errorId)
    }
  }

  // ==================== 审批系统 ====================

  /**
   * 请求审批
   */
  requestApproval(
    type: ApprovalType,
    action: string,
    description: string,
    details: Record<string, unknown> = {},
    risk: ApprovalRequest['risk'] = 'medium'
  ): ApprovalRequest {
    const policy = this.approvalPolicies.get(type)
    
    // 检查是否自动批准
    if (policy?.autoApprove) {
      const approved: ApprovalRequest = {
        id: `approval_${Date.now()}`,
        type,
        action,
        description,
        requestedBy: 'system',
        risk,
        details,
        status: 'approved',
        createdAt: Date.now(),
        expiresAt: Date.now() + (policy?.expiryTime || this.config.approvalTimeout) * 1000,
        decidedAt: Date.now(),
        decidedBy: 'auto',
      }
      return approved
    }

    const request: ApprovalRequest = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      action,
      description,
      requestedBy: 'user',
      risk,
      details,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + (policy?.expiryTime || this.config.approvalTimeout) * 1000,
    }

    this.approvalRequests.set(request.id, request)

    // 设置过期
    setTimeout(() => {
      const req = this.approvalRequests.get(request.id)
      if (req && req.status === 'pending') {
        req.status = 'expired'
        this.emit('approvalExpired', request.id)
      }
    }, (policy?.expiryTime || this.config.approvalTimeout) * 1000)

    this.emit('approvalRequested', request)

    return request
  }

  /**
   * 批准请求
   */
  approveRequest(requestId: string, reason?: string): void {
    const request = this.approvalRequests.get(requestId)
    if (request && request.status === 'pending') {
      request.status = 'approved'
      request.decidedAt = Date.now()
      request.decidedBy = 'user'
      request.reason = reason
      this.emit('approvalApproved', request)
    }
  }

  /**
   * 拒绝请求
   */
  rejectRequest(requestId: string, reason?: string): void {
    const request = this.approvalRequests.get(requestId)
    if (request && request.status === 'pending') {
      request.status = 'rejected'
      request.decidedAt = Date.now()
      request.decidedBy = 'user'
      request.reason = reason
      this.emit('approvalRejected', request)
    }
  }

  /**
   * 获取待审批请求
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.approvalRequests.values())
      .filter(r => r.status === 'pending' && Date.now() < r.expiresAt)
  }

  /**
   * 更新审批策略
   */
  updateApprovalPolicy(policy: ApprovalPolicy): void {
    this.approvalPolicies.set(policy.type, policy)
    this.saveConfig()
    this.emit('policyUpdated', policy)
  }

  // ==================== 沙箱系统 ====================

  /**
   * 启用沙箱
   */
  enableSandbox(): void {
    this.sandboxConfig.enabled = true
    this.sandboxStatus.enabled = true
    this.saveConfig()
    this.emit('sandboxEnabled')
  }

  /**
   * 禁用沙箱
   */
  disableSandbox(): void {
    this.sandboxConfig.enabled = false
    this.sandboxStatus.enabled = false
    this.saveConfig()
    this.emit('sandboxDisabled')
  }

  /**
   * 更新沙箱配置
   */
  updateSandboxConfig(config: Partial<SandboxConfig>): void {
    Object.assign(this.sandboxConfig, config)
    this.saveConfig()
    this.emit('sandboxConfigUpdated', this.sandboxConfig)
  }

  /**
   * 获取沙箱状态
   */
  getSandboxStatus(): SandboxStatus {
    return { ...this.sandboxStatus }
  }

  /**
   * 检查操作是否被沙箱阻止
   */
  checkSandboxPermission(action: string, target?: string): boolean {
    if (!this.sandboxConfig.enabled) return true

    // 检查网络请求
    if (action === 'network' && target) {
      const domain = new URL(target).hostname
      if (this.sandboxConfig.blockedDomains.includes(domain)) {
        this.sandboxStatus.blockedActions++
        return false
      }
      if (this.sandboxConfig.allowedDomains.length > 0 && 
          !this.sandboxConfig.allowedDomains.includes(domain)) {
        this.sandboxStatus.blockedActions++
        return false
      }
    }

    // 检查文件访问
    if (action === 'file' && !this.sandboxConfig.allowFileAccess) {
      this.sandboxStatus.blockedActions++
      return false
    }

    // 检查 shell 命令
    if (action === 'shell' && !this.sandboxConfig.allowShellCommands) {
      this.sandboxStatus.blockedActions++
      return false
    }

    return true
  }

  // ==================== Moltbook 社交 ====================

  /**
   * 获取 Moltbook 帖子
   */
  async getMoltbookPosts(category?: string, limit: number = 20): Promise<MoltbookPost[]> {
    // 实际实现需要调用 Moltbook API
    logger.info(`[System] Fetching Moltbook posts: category=${category}, limit=${limit}`)
    return []
  }

  /**
   * 发布 Moltbook 帖子
   */
  async publishMoltbookPost(content: string, category?: string, tags: string[] = []): Promise<MoltbookPost> {
    logger.info(`[System] Publishing Moltbook post`)
    
    return {
      id: `post_${Date.now()}`,
      authorId: 'current_agent',
      authorName: '智汇AI助手',
      content,
      category,
      tags,
      likes: 0,
      comments: 0,
      shares: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  }

  /**
   * 关闭系统管理器
   */
  shutdown(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.saveConfig()
    this.initialized.value = false

    logger.info('[System] System manager shut down')
    this.emit('shutdown')
  }
}

// 单例实例
let systemManagerInstance: SystemManager | null = null

/**
 * 获取系统管理器实例
 */
export function getSystemManager(config?: SystemManagerConfig): SystemManager {
  if (!systemManagerInstance) {
    systemManagerInstance = new SystemManager(config)
  }
  return systemManagerInstance
}

export default SystemManager
