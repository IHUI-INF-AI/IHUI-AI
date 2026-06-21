/**
 * Clawdbot Composable
 * 
 * 提供在 Vue 组件中使用 Clawdbot 服务的便捷 API
 */

import { ref, computed, onUnmounted } from 'vue'
import { 
  getClawdbotService, 
  type ClawdbotConfig,
  type ClawdbotStatus,
  type ConversationMessage,
} from '@/services/clawdbot/clawdbot-service'
import { 
  getToolExecutor, 
  type ToolDefinition, 
  type ToolExecutionResult 
} from '@/services/clawdbot/tools'
import { 
  getTaskExecutor, 
  type Task, 
  type TaskResult 
} from '@/services/clawdbot/task-executor'
import { 
  getSelfEvolutionEngine, 
  type SkillInstallation 
} from '@/services/clawdbot/self-evolution'
import { logger } from '@/utils/logger'

/**
 * Clawdbot Composable 返回类型
 */
export interface UseClawdbotReturn {
  // 状态
  initialized: ReturnType<typeof ref<boolean>>
  status: ReturnType<typeof computed<ClawdbotStatus>>
  isProcessing: ReturnType<typeof ref<boolean>>
  currentConversationId: ReturnType<typeof ref<string>>
  messages: ReturnType<typeof ref<ConversationMessage[]>>
  
  // 初始化
  initialize: (config?: ClawdbotConfig) => Promise<boolean>
  shutdown: () => Promise<void>
  
  // 消息
  sendMessage: (content: string, options?: {
    attachments?: Array<{ type: string; url: string; name?: string }>
  }) => Promise<string>
  clearConversation: () => void
  
  // 工具
  tools: ReturnType<typeof ref<ToolDefinition[]>>
  executeTool: (toolName: string, params: Record<string, unknown>) => Promise<ToolExecutionResult>
  
  // 任务
  tasks: ReturnType<typeof ref<Task[]>>
  createTask: (description: string) => Promise<Task>
  executeTask: (taskId: string) => Promise<TaskResult>
  cancelTask: (taskId: string) => void
  
  // 技能
  skills: ReturnType<typeof ref<SkillInstallation[]>>
  installSkill: (spec: { name: string; description: string; code: string }) => Promise<SkillInstallation>
  uninstallSkill: (name: string) => Promise<void>
  
  // 事件处理
  onMessage: (handler: (message: ConversationMessage) => void) => () => void
  onToolExecuted: (handler: (result: { toolName: string; result: ToolExecutionResult }) => void) => () => void
  onTaskCompleted: (handler: (task: Task) => void) => () => void
  onSkillInstalled: (handler: (skill: SkillInstallation) => void) => () => void
}

/**
 * 使用 Clawdbot 服务
 */
export function useClawdbot(): UseClawdbotReturn {
  // 获取服务实例
  const clawdbot = getClawdbotService()
  const toolExecutor = getToolExecutor()
  const taskExecutor = getTaskExecutor()
  const evolutionEngine = getSelfEvolutionEngine()
  
  // 状态
  const initialized = ref(false)
  const isProcessing = ref(false)
  const currentConversationId = ref(`conv_${Date.now()}`)
  const messages = ref<ConversationMessage[]>([])
  const tools = ref<ToolDefinition[]>([])
  const tasks = ref<Task[]>([])
  const skills = ref<SkillInstallation[]>([])
  
  // 事件处理器存储
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const eventHandlers: Map<string, Set<Function>> = new Map()
  
  // 计算属性
  const status = computed(() => clawdbot.getStatus())
  
  /**
   * 初始化
   */
  async function initialize(config?: ClawdbotConfig): Promise<boolean> {
    try {
      isProcessing.value = true
      const success = await clawdbot.initialize(config)
      
      if (success) {
        initialized.value = true
        
        // 加载初始数据
        tools.value = toolExecutor.getAllTools()
        tasks.value = taskExecutor.getAllTasks()
        skills.value = evolutionEngine.getInstalledSkills()
        
        // 设置事件监听
        setupEventListeners()
        
        logger.info('[useClawdbot] Initialization successful')
      }
      
      return success
    } catch (error) {
      logger.error('[useClawdbot] Initialization failed:', error)
      return false
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * 设置事件监听
   */
  function setupEventListeners(): void {
    // 消息事件
    clawdbot.on('gateway:message', (message: any) => {
      const handlers = eventHandlers.get('message')
      handlers?.forEach(handler => handler(message))
    })
    
    // 任务完成事件
    clawdbot.on('task:completed', (task: Task) => {
      tasks.value = taskExecutor.getAllTasks()
      const handlers = eventHandlers.get('taskCompleted')
      handlers?.forEach(handler => handler(task))
    })
    
    // 任务失败事件
    clawdbot.on('task:failed', (_task: Task) => {
      tasks.value = taskExecutor.getAllTasks()
    })
    
    // 技能安装事件
    clawdbot.on('evolution:skillInstalled', (skill: SkillInstallation) => {
      skills.value = evolutionEngine.getInstalledSkills()
      tools.value = toolExecutor.getAllTools()
      const handlers = eventHandlers.get('skillInstalled')
      handlers?.forEach(handler => handler(skill))
    })
  }
  
  /**
   * 关闭服务
   */
  async function shutdown(): Promise<void> {
    await clawdbot.shutdown()
    initialized.value = false
  }
  
  /**
   * 发送消息
   */
  async function sendMessage(
    content: string,
    options?: { attachments?: Array<{ type: string; url: string; name?: string }> }
  ): Promise<string> {
    isProcessing.value = true
    
    try {
      // 添加用户消息到本地
      const userMessage: ConversationMessage = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      messages.value.push(userMessage)
      
      // 发送消息
      const messageId = await clawdbot.sendMessage(content, {
        conversationId: currentConversationId.value,
        attachments: options?.attachments?.map(a => ({
          type: a.type as 'file' | 'image' | 'audio' | 'video',
          url: a.url,
          name: a.name,
        })),
      })
      
      // 更新消息历史
      setTimeout(() => {
        messages.value = clawdbot.getConversationHistory(currentConversationId.value)
      }, 1000)
      
      return messageId
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * 清除对话
   */
  function clearConversation(): void {
    clawdbot.clearConversation(currentConversationId.value)
    messages.value = []
    currentConversationId.value = `conv_${Date.now()}`
  }
  
  /**
   * 执行工具
   */
  async function executeTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    isProcessing.value = true
    
    try {
      const result = await clawdbot.executeTool(toolName, params, {
        conversationId: currentConversationId.value,
      })
      
      // 触发事件
      const handlers = eventHandlers.get('toolExecuted')
      handlers?.forEach(handler => handler({ toolName, result }))
      
      return result
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * 创建任务
   */
  async function createTask(description: string): Promise<Task> {
    const task = await clawdbot.createTask(description)
    tasks.value = taskExecutor.getAllTasks()
    return task
  }
  
  /**
   * 执行任务
   */
  async function executeTask(taskId: string): Promise<TaskResult> {
    isProcessing.value = true
    
    try {
      const result = await clawdbot.executeTask(taskId)
      tasks.value = taskExecutor.getAllTasks()
      return result
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * 取消任务
   */
  function cancelTask(taskId: string): void {
    taskExecutor.cancelTask(taskId)
    tasks.value = taskExecutor.getAllTasks()
  }
  
  /**
   * 安装技能
   */
  async function installSkill(spec: {
    name: string
    description: string
    code: string
  }): Promise<SkillInstallation> {
    const skill = await clawdbot.installSkill(spec)
    skills.value = evolutionEngine.getInstalledSkills()
    tools.value = toolExecutor.getAllTools()
    return skill
  }
  
  /**
   * 卸载技能
   */
  async function uninstallSkill(name: string): Promise<void> {
    await clawdbot.uninstallSkill(name)
    skills.value = evolutionEngine.getInstalledSkills()
    tools.value = toolExecutor.getAllTools()
  }
  
  /**
   * 注册事件处理器
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  function registerHandler(event: string, handler: Function): () => void {
    if (!eventHandlers.has(event)) {
      eventHandlers.set(event, new Set())
    }
    eventHandlers.get(event)!.add(handler)
    
    return () => {
      eventHandlers.get(event)?.delete(handler)
    }
  }
  
  // 事件注册快捷方法
  const onMessage = (handler: (message: ConversationMessage) => void) => 
    registerHandler('message', handler)
  
  const onToolExecuted = (handler: (result: { toolName: string; result: ToolExecutionResult }) => void) => 
    registerHandler('toolExecuted', handler)
  
  const onTaskCompleted = (handler: (task: Task) => void) => 
    registerHandler('taskCompleted', handler)
  
  const onSkillInstalled = (handler: (skill: SkillInstallation) => void) => 
    registerHandler('skillInstalled', handler)
  
  // 组件卸载时清理
  onUnmounted(() => {
    eventHandlers.clear()
  })
  
  return {
    // 状态
    initialized,
    status,
    isProcessing,
    currentConversationId,
    messages,
    
    // 初始化
    initialize,
    shutdown,
    
    // 消息
    sendMessage,
    clearConversation,
    
    // 工具
    tools,
    executeTool,
    
    // 任务
    tasks,
    createTask,
    executeTask,
    cancelTask,
    
    // 技能
    skills,
    installSkill,
    uninstallSkill,
    
    // 事件处理
    onMessage,
    onToolExecuted,
    onTaskCompleted,
    onSkillInstalled,
  }
}

/**
 * 全局 Clawdbot 实例（用于非组件场景）
 */
export const globalClawdbot = getClawdbotService()
