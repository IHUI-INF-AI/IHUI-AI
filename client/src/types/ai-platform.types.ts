/**
 * AI平台统一类型定义
 * 
 * 整合所有AI功能模块的类型定义，确保类型一致性
 * @module types/ai-platform
 * @version 2.0.0
 */

// ============================================================================
// 1. 基础类型
// ============================================================================

/** 通用ID类型 */
export type UUID = string

/** 时间戳类型 */
export type Timestamp = string | number

/** 状态基础类型 */
export type BaseStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/** 优先级类型 */
export type Priority = 'low' | 'normal' | 'high' | 'urgent'

/** 严重程度类型 */
export type Severity = 'low' | 'medium' | 'high' | 'critical'

// ============================================================================
// 2. 消息相关类型 (AI对话框)
// ============================================================================

/** 消息角色类型 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 消息状态 */
export type MessageStatus = 'sending' | 'sent' | 'failed' | 'streaming'

/** 文件附件 */
export interface FileAttachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
  preview?: string
  uploadedAt: Timestamp
}

/** 引用消息 */
export interface QuotedMessage {
  id: string
  role: MessageRole
  content: string
  createTime?: Timestamp
}

/** Token 使用统计 */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** 消息元数据 */
export interface MessageMetadata {
  model?: string
  agent?: string
  /** 智能体头像 URL（与 agent 对应，用于消息状态行与左侧头像展示） */
  agent_avatar?: string
  swarm?: boolean | string
  tools?: string[]
  tokensUsed?: number // 兼容旧字段
  usage?: TokenUsage // 完整的 Token 使用统计
  processingTime?: number
  mode?: 'model' | 'agent' | 'agentic' | 'mcp' | 'hybrid' | 'generation'
  capabilityId?: string
  capabilityType?: string
  generationType?: 'image' | 'video' | '3d' | 'vision' | 'auto'
  /** 大模型/智能体返回：图片 URL 列表（与 ai_index2/ai_assistant 一致） */
  imgUrlList?: string[]
  /** 大模型返回：视频 URL */
  videoUrl?: string
  /** 智能体返回：视频 URL 列表 */
  videoUrlList?: string[]
  /** 音频 URL */
  audioUrl?: string
  /** 思考过程（可展开） */
  thinkingContent?: string
  /** 消耗智汇值/Token 数（兼容后端 total_tokens） */
  total_tokens?: number
  [key: string]: any
}

/** 聊天消息 */
export interface ChatMessage {
  id: UUID
  role: MessageRole
  content: string
  status: MessageStatus
  createTime: Timestamp
  updateTime?: Timestamp
  
  // 可选属性
  files?: FileAttachment[]
  quotedMessage?: QuotedMessage
  replyTo?: string
  metadata?: MessageMetadata
  model?: string
  
  // 状态标记
  isStreaming?: boolean
  liked?: boolean
  showMetadata?: boolean
  edited?: boolean
  error?: string
}

/** 对话历史 */
export interface Conversation {
  id: UUID
  title: string
  messages: ChatMessage[]
  createTime: Timestamp
  updateTime: Timestamp
  model?: string
  agent?: string
  tags?: string[]
}

// ============================================================================
// 3. 生成任务相关类型
// ============================================================================

/** 生成类型 */
export type GenerationType = 'image' | 'video' | '3d' | 'audio' | 'text'

/** 生成任务状态 */
export interface GenerationTaskStatus {
  status: BaseStatus
  progress: number
  stage?: string
  estimatedTime?: number
  startedAt?: Timestamp
  completedAt?: Timestamp
  error?: string
}

/** 生成任务 */
export interface GenerationTask {
  id: UUID
  type: GenerationType
  model: string
  prompt: string
  priority: Priority
  status: GenerationTaskStatus
  
  // 生成参数
  parameters?: Record<string, unknown>
  negativePrompt?: string
  seed?: number
  
  // 结果
  result?: GenerationResult
  
  // 元数据
  createdAt: Timestamp
  createdBy?: string
  tags?: string[]
}

/** 生成结果 */
export interface GenerationResult {
  id: UUID
  type: GenerationType
  url: string
  thumbnailUrl?: string
  metadata: GenerationResultMetadata
  createdAt: Timestamp
}

/** 生成结果元数据 */
export interface GenerationResultMetadata {
  width?: number
  height?: number
  duration?: number
  frameCount?: number
  size: number
  format: string
  model: string
  prompt: string
  parameters?: Record<string, unknown>
}

// ============================================================================
// 4. 短剧创作相关类型
// ============================================================================

/** 角色形象 */
export interface CharacterAppearance {
  characterId?: string
  imageUrl?: string
  description: string
}

/** 角色声音 */
export interface CharacterVoice {
  characterId?: string
  voiceId?: string
  description: string
  sampleUrl?: string
}

/** 角色定义 */
export interface Character {
  id: UUID
  name: string
  appearance: CharacterAppearance
  voice: CharacterVoice
  traits?: string[]
  backstory?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 场景片段状态 */
export type SceneFragmentStatus = 'pending' | 'generating' | 'completed' | 'failed'

/** 质量报告 */
export interface QualityReport {
  overallScore: number
  clarity: number
  colorSaturation: number
  motionSmoothness: number
  characterConsistency: number
  issues: QualityIssue[]
  recommendations: string[]
  analyzedAt: Timestamp
}

/** 质量问题 */
export interface QualityIssue {
  type: 'blur' | 'stutter' | 'color' | 'consistency' | 'audio' | 'other'
  severity: Severity
  description: string
  suggestion: string
  timestamp?: number
  frameIndex?: number
}

/** 重试记录 */
export interface RetryRecord {
  attempt: number
  timestamp: Timestamp
  reason: FailureReason
  success: boolean
  error?: string
  durationMs?: number
}

/** 失败原因 */
export interface FailureReason {
  type: 'api_error' | 'prompt_issue' | 'resource_limit' | 'network_error' | 'timeout' | 'unknown'
  message: string
  canRetry: boolean
  retryDelay?: number
  shouldOptimizePrompt?: boolean
}

/** 场景片段 */
export interface SceneFragment {
  id: UUID
  sequence: number
  character: string
  scene: string
  description: string
  
  // 提示词
  firstFramePrompt: string
  videoPrompt: string
  
  // 角色相关
  characterAppearance: CharacterAppearance
  voice: CharacterVoice
  
  // 生成结果
  videoUrl?: string
  videoDuration?: number
  progress?: number
  lastFrameImage?: string
  
  // 配置
  usePreviousLastFrame: boolean
  
  // 状态
  status: SceneFragmentStatus
  extractingFrame?: boolean
  retryCount?: number
  retryHistory?: RetryRecord[]
  
  // 质量相关
  qualityScore?: number
  qualityReport?: QualityReport
  
  // 时间戳
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ============================================================================
// 5. 工作流相关类型
// ============================================================================

/** 工作流步骤类型 */
export type WorkflowStepType = 
  | 'generate-prompt' 
  | 'generate-video' 
  | 'extract-frame' 
  | 'quality-check' 
  | 'retry' 
  | 'wait'
  | 'notify'
  | 'condition'

/** 工作流步骤 */
export interface WorkflowStep {
  id: UUID
  type: WorkflowStepType
  name?: string
  config: Record<string, unknown>
  condition?: (fragment: SceneFragment) => boolean
  enabled: boolean
  order?: number
}

/** 工作流定义 */
export interface Workflow {
  id: UUID
  name: string
  description: string
  steps: WorkflowStep[]
  enabled: boolean
  isTemplate?: boolean
  tags?: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 工作流执行结果 */
export interface WorkflowResult {
  fragmentId: UUID
  workflowId: UUID
  success: boolean
  completedSteps: string[]
  failedSteps: string[]
  skippedSteps?: string[]
  error?: string
  startedAt: Timestamp
  completedAt?: Timestamp
  duration?: number
}

// ============================================================================
// 6. 任务队列相关类型
// ============================================================================

/** 队列任务状态 */
export type QueueTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'paused'

/** 队列任务 */
export interface QueueTask<T = unknown> {
  id: UUID
  type: string
  priority: number
  status: QueueTaskStatus
  payload: T
  
  // 执行相关
  retryCount: number
  maxRetries: number
  
  // 时间戳
  createdAt: Timestamp
  startedAt?: Timestamp
  completedAt?: Timestamp
  
  // 结果
  result?: any
  error?: string
}

/** 队列统计 */
export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  total: number
  avgProcessingTime?: number
  throughput?: number
}

// ============================================================================
// 7. 通知相关类型
// ============================================================================

/** 通知类型 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'progress'

/** 通知 */
export interface Notification {
  id: UUID
  type: NotificationType
  title: string
  message: string
  
  // 进度相关
  progress?: number
  progressMax?: number
  
  // 操作相关
  actions?: NotificationAction[]
  
  // 配置
  duration?: number
  dismissible?: boolean
  persistent?: boolean
  
  // 时间戳
  createdAt: Timestamp
  readAt?: Timestamp
}

/** 通知操作 */
export interface NotificationAction {
  id: string
  label: string
  type: 'primary' | 'default' | 'danger'
  handler: () => void | Promise<void>
}

// ============================================================================
// 8. 上下文分析相关类型
// ============================================================================

/** 角色关系 */
export interface CharacterRelationship {
  character: string
  appearance: string
  voice: string
  fragmentCount: number
  lastAppearance: number
}

/** 场景转换 */
export interface SceneTransition {
  from: string
  to: string
  sequence: number
  transitionType: 'same' | 'different' | 'related'
}

/** 上下文摘要 */
export interface ContextSummary {
  characters: CharacterRelationship[]
  sceneFlow: SceneTransition[]
  plotSummary: string
  keyElements: string[]
  previousFragments: SceneFragment[]
}

// ============================================================================
// 9. 提示词相关类型
// ============================================================================

/** 提示词评分 */
export interface PromptScore {
  overall: number
  completeness: number
  consistency: number
  detail: number
  creativity?: number
  issues: string[]
  suggestions: string[]
}

/** 增强提示词 */
export interface EnhancedPrompt {
  prompt: string
  score: PromptScore
  contextUsed: boolean
  optimized: boolean
  iterations?: number
}

/** 提示词模板 */
export interface PromptTemplate {
  id: UUID
  name: string
  description: string
  template: string
  variables: string[]
  category: string
  tags?: string[]
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ============================================================================
// 10. 视频质量分析相关类型
// ============================================================================

/** 帧分析结果 */
export interface FrameAnalysis {
  frameIndex: number
  timestamp: number
  clarity: number
  brightness: number
  contrast: number
  colorfulness: number
  motionBlur: number
  issues: QualityIssue[]
}

/** 视频分析结果 */
export interface VideoAnalysisResult {
  videoUrl: string
  duration: number
  frameCount: number
  fps: number
  resolution: { width: number; height: number }
  
  // 整体评分
  overallScore: number
  
  // 各维度评分
  clarityScore: number
  motionScore: number
  colorScore: number
  consistencyScore: number
  
  // 帧级分析
  keyFrames: FrameAnalysis[]
  problematicFrames: FrameAnalysis[]
  
  // 问题和建议
  issues: QualityIssue[]
  recommendations: string[]
  
  // 时间戳
  analyzedAt: Timestamp
}

// ============================================================================
// 11. 资源库相关类型
// ============================================================================

/** 生成资源 */
export interface GeneratedResource {
  id: UUID
  type: GenerationType
  url: string
  thumbnailUrl?: string
  prompt: string
  model: string
  
  metadata: {
    width?: number
    height?: number
    duration?: number
    size: number
    format: string
  }
  
  tags: string[]
  favorite: boolean
  usageCount: number
  
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** 资源筛选条件 */
export interface ResourceFilter {
  type?: GenerationType[]
  model?: string[]
  tags?: string[]
  favorite?: boolean
  dateRange?: {
    start: Timestamp
    end: Timestamp
  }
  keyword?: string
}

// ============================================================================
// 12. 事件类型
// ============================================================================

/** 平台事件类型 */
export type PlatformEventType =
  | 'message:sent'
  | 'message:received'
  | 'message:error'
  | 'generation:start'
  | 'generation:progress'
  | 'generation:complete'
  | 'generation:error'
  | 'workflow:start'
  | 'workflow:step:complete'
  | 'workflow:complete'
  | 'workflow:error'
  | 'quality:analyzed'
  | 'notification:created'
  | 'resource:created'

/** 平台事件 */
export interface PlatformEvent<T = unknown> {
  type: PlatformEventType
  payload: T
  timestamp: Timestamp
  source?: string
}

// ============================================================================
// 13. 配置相关类型
// ============================================================================

/** 生成队列配置 */
export interface QueueConfig {
  maxConcurrent: number
  defaultPriority: Priority
  delayBetweenTasks: number
  autoRetryOnFailure: boolean
  maxRetries: number
  saveProgress: boolean
}

/** 质量检测配置 */
export interface QualityConfig {
  minScore: number
  autoRetryBelowScore: number
  samplingRate: number
  analysisTimeout: number
}

/** 通知配置 */
export interface NotificationConfig {
  defaultDuration: number
  maxNotifications: number
  enableSound: boolean
  enableBrowserNotifications: boolean
  groupSimilar: boolean
}

/** 上下文管理配置 */
export interface ContextConfig {
  maxTokens: number
  windowSize: number
  summarizeThreshold: number
  preserveSystemMessages: boolean
}

// ============================================================================
// 14. 工具函数类型
// ============================================================================

/** 事件处理器 */
export type EventHandler<T = unknown> = (event: PlatformEvent<T>) => void | Promise<void>

/** 取消订阅函数 */
export type Unsubscribe = () => void

/** 进度回调 */
export type ProgressCallback = (progress: number, message?: string) => void

/** 流式回调 */
export type StreamCallback = (chunk: string) => void

/** 完成回调 */
export type CompleteCallback<T = unknown> = (result: T) => void

/** 错误回调 */
export type ErrorCallback = (error: Error) => void
