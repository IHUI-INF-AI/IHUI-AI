/**
 * 短剧剧本编辑器 - 统一类型定义
 * 
 * 用于 DramaScriptExcel.vue 及其相关模块的类型定义
 */

export interface CharacterAppearance {
  characterId?: string
  imageUrl?: string
  description: string
}

export interface Voice {
  characterId?: string
  voiceId?: string
  description: string
}

export interface SceneFragment {
  id: string
  sequence: number
  character: string
  scene: string
  description: string
  firstFramePrompt: string
  videoPrompt: string
  characterAppearance: CharacterAppearance
  voice: Voice
  videoUrl?: string
  videoDuration?: number
  progress?: number
  lastFrameImage?: string
  usePreviousLastFrame: boolean
  status: 'pending' | 'generating' | 'completed' | 'failed'
  extractingFrame?: boolean
  retryCount?: number
  retryHistory?: RetryRecord[]
  qualityScore?: number
  qualityReport?: QualityReport
  createdAt: string
  updatedAt: string
}

export interface Character {
  id: string
  name: string
  appearance: {
    imageUrl?: string
    description: string
  }
  voice: {
    voiceId?: string
    description: string
  }
  createdAt: string
  updatedAt: string
}

export interface QualityReport {
  overallScore: number
  clarity: number
  colorSaturation: number
  motionSmoothness: number
  characterConsistency: number
  issues: QualityIssue[]
  recommendations: string[]
  analyzedAt: string
}

export interface QualityIssue {
  type: 'blur' | 'stutter' | 'color' | 'consistency' | 'other'
  severity: 'low' | 'medium' | 'high'
  description: string
  suggestion: string
}

export interface FailureReason {
  type: 'api_error' | 'prompt_issue' | 'resource_limit' | 'network_error' | 'timeout' | 'unknown'
  message: string
  canRetry: boolean
  retryDelay?: number
  shouldOptimizePrompt?: boolean
}

export interface RetryRecord {
  attempt: number
  timestamp: string
  reason: FailureReason
  success: boolean
  error?: string
}

export interface RetryStrategy {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  optimizePromptOnRetry: boolean
  autoRetry: boolean
}

export interface ContextSummary {
  characters: CharacterRelationship[]
  sceneFlow: SceneTransition[]
  plotSummary: string
  keyElements: string[]
  previousFragments: SceneFragment[]
}

export interface CharacterRelationship {
  character: string
  appearance: string
  voice: string
  fragmentCount: number
  lastAppearance: number
}

export interface SceneTransition {
  from: string
  to: string
  sequence: number
  transitionType: 'same' | 'different' | 'related'
}

export interface WorkflowStep {
  id: string
  type: 'generate-prompt' | 'generate-video' | 'extract-frame' | 'quality-check' | 'retry' | 'wait'
  config: Record<string, unknown>
  condition?: (fragment: SceneFragment) => boolean
  enabled: boolean
}

export interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowResult {
  fragmentId: string
  workflowId: string
  success: boolean
  completedSteps: string[]
  failedSteps: string[]
  error?: string
  startedAt: string
  completedAt?: string
  duration?: number
}

export interface Task {
  id: string
  fragment: SceneFragment
  priority: number
  type: 'generate-prompt' | 'generate-video' | 'extract-frame' | 'quality-check' | 'retry' | 'wait'
  workflowId?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  startedAt?: string
  completedAt?: string
  error?: string
  retryCount?: number
}

export interface BatchProcessor {
  addTask: (task: Task) => void
  start: () => void
  stop: () => void
  pause: () => void
  resume: () => void
  clear: () => void
  getStatus: () => {
    running: boolean
    paused: boolean
    queue: Task[]
    processing: Task[]
    completed: Task[]
    failed: Task[]
  }
}
