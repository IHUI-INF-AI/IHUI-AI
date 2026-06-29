/**
 * OpenClaw Complete Composable
 * 
 * 提供在 Vue 组件中使用所有 OpenClaw 服务的完整 API
 */

import { ref, reactive, onMounted } from 'vue'
import { logger } from '@/utils/logger'

// 导入所有服务
import { getClawdbotService } from '@/services/clawdbot/clawdbot-service'
import { getMemoryManager, type MemoryEntry, type DailyNote, type MemorySearchOptions, type MemorySearchResult } from '@/services/clawdbot/memory'
import { getVoiceManager, type VoiceConfig, type VoiceStatus } from '@/services/clawdbot/voice'
import { getCanvasManager, type CanvasElement, type A2UICommand } from '@/services/clawdbot/canvas'
import { getNodeManager, type NodeInfo, type CameraCapture, type ScreenCapture, type LocationInfo } from '@/services/clawdbot/nodes'
import { getSkillManager, type Skill, type InstalledSkill, type SkillSearchOptions } from '@/services/clawdbot/skills'
import { getIntegrationManager, type IntegrationConfig, type IntegrationProvider } from '@/services/clawdbot/integrations'
import { getMCPManager, type MCPTool } from '@/services/clawdbot/mcp'
import { getBrowserAutomation, type PageState, type ElementLocator } from '@/services/clawdbot/browser'
import { getPairingManager, type PairedDevice, type PairingCode, type RemoteCommandType } from '@/services/clawdbot/pairing'
import { getModelManager, type ModelDefinition, type ModelProvider, type ModelUsageStats } from '@/services/clawdbot/models'
import { getSystemManager, type HealthStatus, type DashboardData, type ApprovalRequest, type SandboxConfig } from '@/services/clawdbot/system'
import { getAutomationManager, type CronJob, type WebhookConfig } from '@/services/clawdbot/automation'

/**
 * OpenClaw 状态
 */
export interface OpenClawState {
  initialized: boolean
  loading: boolean
  error: string | null
  
  // 记忆
  memories: MemoryEntry[]
  dailyNotes: DailyNote[]
  
  // 语音
  voiceStatus: VoiceStatus | null
  
  // 画布
  canvasElements: CanvasElement[]
  
  // 节点
  nodes: NodeInfo[]
  
  // 技能
  installedSkills: InstalledSkill[]
  availableSkills: Skill[]
  
  // 集成
  integrations: IntegrationConfig[]
  
  // MCP
  mcpTools: MCPTool[]
  
  // 浏览器
  browserState: PageState | null
  
  // 配对
  pairedDevices: PairedDevice[]
  
  // 模型
  models: ModelDefinition[]
  currentModel: string
  modelStats: ModelUsageStats[]
  
  // 系统
  health: HealthStatus | null
  dashboard: DashboardData | null
  pendingApprovals: ApprovalRequest[]
  sandboxEnabled: boolean
  
  // 自动化
  cronJobs: CronJob[]
  webhooks: WebhookConfig[]
}

/**
 * 使用 OpenClaw 完整功能
 */
export function useOpenClaw() {
  // 获取所有服务实例
  const clawdbot = getClawdbotService()
  const memoryManager = getMemoryManager()
  const voiceManager = getVoiceManager()
  const canvasManager = getCanvasManager()
  const nodeManager = getNodeManager()
  const skillManager = getSkillManager()
  const integrationManager = getIntegrationManager()
  const mcpManager = getMCPManager()
  const browserAutomation = getBrowserAutomation()
  const pairingManager = getPairingManager()
  const modelManager = getModelManager()
  const systemManager = getSystemManager()
  const automationManager = getAutomationManager()

  // 状态
  const state = reactive<OpenClawState>({
    initialized: false,
    loading: false,
    error: null,
    memories: [],
    dailyNotes: [],
    voiceStatus: null,
    canvasElements: [],
    nodes: [],
    installedSkills: [],
    availableSkills: [],
    integrations: [],
    mcpTools: [],
    browserState: null,
    pairedDevices: [],
    models: [],
    currentModel: '',
    modelStats: [],
    health: null,
    dashboard: null,
    pendingApprovals: [],
    sandboxEnabled: false,
    cronJobs: [],
    webhooks: [],
  })

  // 当前活动的面板
  const activePanel = ref<string>('chat')

  /**
   * 初始化所有服务
   */
  async function initialize(): Promise<boolean> {
    if (state.initialized) return true

    state.loading = true
    state.error = null

    try {
      logger.info('[OpenClaw] Initializing all services...')

      // 并行初始化所有服务
      await Promise.all([
        clawdbot.initialize(),
        memoryManager.initialize(),
        nodeManager.initialize(),
        skillManager.initialize(),
        integrationManager.initialize(),
        mcpManager.initialize(),
        pairingManager.initialize(),
        modelManager.initialize(),
        systemManager.initialize(),
      ])

      // 加载初始数据
      await refreshAllData()

      state.initialized = true
      logger.info('[OpenClaw] All services initialization complete')

      return true
    } catch (error) {
      state.error = (error as Error).message
      logger.error('[OpenClaw] Initialization failed:', error)
      return false
    } finally {
      state.loading = false
    }
  }

  /**
   * 刷新所有数据
   */
  async function refreshAllData(): Promise<void> {
    // 记忆
    state.memories = memoryManager.getAllMemories()
    state.dailyNotes = memoryManager.getRecentNotes(7)

    // 语音
    state.voiceStatus = voiceManager.getStatus()

    // 画布
    state.canvasElements = canvasManager.getAllElements()

    // 节点
    state.nodes = nodeManager.getNodes()

    // 技能
    state.installedSkills = skillManager.getInstalledSkills()
    state.availableSkills = skillManager.getAvailableSkills()

    // 集成
    state.integrations = integrationManager.getIntegrations()

    // MCP
    const mcpServer = mcpManager.getServer('default')
    state.mcpTools = mcpServer?.getTools() || []

    // 浏览器
    state.browserState = browserAutomation.getPageState()

    // 配对
    state.pairedDevices = pairingManager.getPairedDevices()

    // 模型
    state.models = modelManager.getAllModels()
    state.currentModel = modelManager.getCurrentModel()?.id || ''
    state.modelStats = modelManager.getUsageStats() as ModelUsageStats[]

    // 系统
    state.health = systemManager.getHealthStatus()
    state.dashboard = systemManager.getDashboardData()
    state.pendingApprovals = systemManager.getPendingApprovals()
    state.sandboxEnabled = systemManager.getSandboxStatus().enabled

    // 自动化
    state.cronJobs = automationManager.getCronJobs()
    state.webhooks = automationManager.getWebhooks()
  }

  // ==================== 记忆系统 ====================

  /**
   * 添加记忆
   */
  async function addMemory(content: string, type: MemoryEntry['type'] = 'custom'): Promise<MemoryEntry> {
    const entry = await memoryManager.addMemory(content, type)
    state.memories = memoryManager.getAllMemories()
    return entry
  }

  /**
   * 搜索记忆
   */
  async function searchMemory(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    return memoryManager.search(options)
  }

  /**
   * 添加每日笔记
   */
  async function addDailyNote(content: string, type: 'activity' | 'decision' | 'learning' | 'note' | 'task' | 'reminder' = 'note') {
    await memoryManager.addToDailyNote(content, type)
    state.dailyNotes = memoryManager.getRecentNotes(7)
  }

  /**
   * 导出记忆为 Markdown
   */
  function exportMemoryAsMarkdown(): string {
    return memoryManager.exportLongTermMemoryAsMarkdown()
  }

  // ==================== 语音系统 ====================

  /**
   * 初始化语音
   */
  async function initVoice(config?: VoiceConfig): Promise<boolean> {
    if (config) {
      voiceManager.updateConfig(config)
    }
    const result = await voiceManager.initialize()
    state.voiceStatus = voiceManager.getStatus()
    return result
  }

  /**
   * 开始语音监听
   */
  function startVoiceListening(): void {
    voiceManager.startListening()
    state.voiceStatus = voiceManager.getStatus()
  }

  /**
   * 停止语音监听
   */
  function stopVoiceListening(): void {
    voiceManager.stopListening()
    state.voiceStatus = voiceManager.getStatus()
  }

  /**
   * 语音合成
   */
  async function speak(text: string): Promise<void> {
    await voiceManager.speak(text)
  }

  /**
   * 进入对话模式
   */
  function enterTalkMode(): void {
    voiceManager.enterTalkMode()
    state.voiceStatus = voiceManager.getStatus()
  }

  /**
   * 退出对话模式
   */
  function exitTalkMode(): void {
    voiceManager.exitTalkMode()
    state.voiceStatus = voiceManager.getStatus()
  }

  // ==================== 画布系统 ====================

  /**
   * 添加画布元素
   */
  function addCanvasElement(element: Partial<CanvasElement> & { type: CanvasElement['type'] }): CanvasElement {
    const el = canvasManager.addElement(element)
    state.canvasElements = canvasManager.getAllElements()
    return el
  }

  /**
   * 更新画布元素
   */
  function updateCanvasElement(id: string, updates: Partial<CanvasElement>): void {
    canvasManager.updateElement(id, updates)
    state.canvasElements = canvasManager.getAllElements()
  }

  /**
   * 删除画布元素
   */
  function removeCanvasElement(id: string): void {
    canvasManager.removeElement(id)
    state.canvasElements = canvasManager.getAllElements()
  }

  /**
   * 执行 A2UI 命令
   */
  async function executeA2UICommand(command: A2UICommand): Promise<unknown> {
    const result = await canvasManager.executeA2UICommand(command)
    state.canvasElements = canvasManager.getAllElements()
    return result
  }

  /**
   * 导出画布
   */
  function exportCanvas(format: 'json' | 'svg' = 'json'): string {
    return format === 'svg' ? canvasManager.exportSVG() : canvasManager.exportJSON()
  }

  // ==================== 节点系统 ====================

  /**
   * 拍照
   */
  async function capturePhoto(): Promise<CameraCapture> {
    const capture = await nodeManager.capturePhoto()
    return capture
  }

  /**
   * 截屏
   */
  async function captureScreen(): Promise<ScreenCapture> {
    return nodeManager.captureScreen()
  }

  /**
   * 获取位置
   */
  async function getCurrentLocation(): Promise<LocationInfo> {
    return nodeManager.getCurrentLocation()
  }

  /**
   * 显示通知
   */
  async function showNotification(title: string, body?: string): Promise<Notification | null> {
    return nodeManager.showNotification({ title, body })
  }

  /**
   * 读取剪贴板
   */
  async function readClipboard() {
    return nodeManager.readClipboard()
  }

  /**
   * 写入剪贴板
   */
  async function writeClipboard(text: string): Promise<void> {
    await nodeManager.writeClipboard({ text })
  }

  // ==================== 技能系统 ====================

  /**
   * 搜索技能
   */
  async function searchSkills(options: SkillSearchOptions = {}) {
    return skillManager.searchSkills(options)
  }

  /**
   * 安装技能
   */
  async function installSkill(skillId: string): Promise<InstalledSkill> {
    const skill = await skillManager.installSkill(skillId)
    state.installedSkills = skillManager.getInstalledSkills()
    return skill
  }

  /**
   * 卸载技能
   */
  async function uninstallSkill(skillId: string): Promise<void> {
    await skillManager.uninstallSkill(skillId)
    state.installedSkills = skillManager.getInstalledSkills()
  }

  /**
   * 执行技能
   */
  async function executeSkill(skillId: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return skillManager.executeSkill(skillId, params)
  }

  /**
   * 创建自定义技能
   */
  async function createSkill(name: string, description: string, task: string): Promise<Skill> {
    const skill = await skillManager.createSkill({ name, description, task })
    state.availableSkills = skillManager.getAvailableSkills()
    return skill
  }

  // ==================== 集成系统 ====================

  /**
   * 添加集成
   */
  async function addIntegration(
    provider: IntegrationProvider,
    credentials: { accessToken?: string; apiKey?: string }
  ): Promise<IntegrationConfig> {
    const config = await integrationManager.addIntegration(provider, credentials)
    state.integrations = integrationManager.getIntegrations()
    return config
  }

  /**
   * 移除集成
   */
  async function removeIntegration(id: string): Promise<void> {
    await integrationManager.removeIntegration(id)
    state.integrations = integrationManager.getIntegrations()
  }

  // ==================== 浏览器自动化 ====================

  /**
   * 导航到 URL
   */
  async function browserNavigate(url: string): Promise<void> {
    await browserAutomation.navigate(url)
    state.browserState = browserAutomation.getPageState()
  }

  /**
   * 点击元素
   */
  async function browserClick(locator: ElementLocator): Promise<void> {
    await browserAutomation.click(locator)
  }

  /**
   * 输入文本
   */
  async function browserType(locator: ElementLocator, text: string): Promise<void> {
    await browserAutomation.type(locator, text)
  }

  /**
   * 截图
   */
  async function browserScreenshot(): Promise<string> {
    return browserAutomation.screenshot()
  }

  // ==================== 设备配对 ====================

  /**
   * 生成配对码
   */
  function generatePairingCode(): PairingCode {
    return pairingManager.generatePairingCode()
  }

  /**
   * 获取已配对设备
   */
  function getPairedDevices(): PairedDevice[] {
    return pairingManager.getPairedDevices()
  }

  /**
   * 取消配对
   */
  async function unpairDevice(deviceId: string): Promise<void> {
    await pairingManager.unpairDevice(deviceId)
    state.pairedDevices = pairingManager.getPairedDevices()
  }

  /**
   * 发送远程命令
   */
  async function sendRemoteCommand(deviceId: string, type: RemoteCommandType, payload: unknown) {
    return pairingManager.sendRemoteCommand(deviceId, type, payload)
  }

  // ==================== 模型管理 ====================

  /**
   * 切换模型
   */
  function switchModel(modelId: string): void {
    modelManager.setCurrentModel(modelId)
    state.currentModel = modelId
  }

  /**
   * 获取模型列表
   */
  function getModels(provider?: ModelProvider): ModelDefinition[] {
    return provider ? modelManager.getModelsByProvider(provider) : modelManager.getAllModels()
  }

  /**
   * 配置提供商
   */
  function configureProvider(provider: ModelProvider, apiKey: string, baseUrl?: string): void {
    modelManager.configureProvider({
      provider,
      name: provider,
      apiKey,
      baseUrl,
      enabled: true,
      models: modelManager.getModelsByProvider(provider).map(m => m.id),
    })
  }

  /**
   * 估算成本
   */
  function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
    return modelManager.estimateCost(modelId, inputTokens, outputTokens)
  }

  // ==================== 系统管理 ====================

  /**
   * 运行诊断
   */
  async function runDiagnostics() {
    return systemManager.runDiagnostics()
  }

  /**
   * 获取仪表板数据
   */
  function getDashboard(): DashboardData {
    return systemManager.getDashboardData()
  }

  /**
   * 批准请求
   */
  function approveRequest(requestId: string, reason?: string): void {
    systemManager.approveRequest(requestId, reason)
    state.pendingApprovals = systemManager.getPendingApprovals()
  }

  /**
   * 拒绝请求
   */
  function rejectRequest(requestId: string, reason?: string): void {
    systemManager.rejectRequest(requestId, reason)
    state.pendingApprovals = systemManager.getPendingApprovals()
  }

  /**
   * 启用/禁用沙箱
   */
  function toggleSandbox(enabled: boolean): void {
    if (enabled) {
      systemManager.enableSandbox()
    } else {
      systemManager.disableSandbox()
    }
    state.sandboxEnabled = enabled
  }

  /**
   * 更新沙箱配置
   */
  function updateSandboxConfig(config: Partial<SandboxConfig>): void {
    systemManager.updateSandboxConfig(config)
  }

  // ==================== 自动化 ====================

  /**
   * 创建 Cron Job
   */
  function createCronJob(name: string, schedule: string, task: string): CronJob {
    const job = automationManager.createCronJob({
      name,
      schedule,
      task,
      enabled: true,
    })
    state.cronJobs = automationManager.getCronJobs()
    return job
  }

  /**
   * 删除 Cron Job
   */
  function deleteCronJob(id: string): void {
    automationManager.deleteCronJob(id)
    state.cronJobs = automationManager.getCronJobs()
  }

  /**
   * 创建 Webhook
   * @todo 需要在 automationManager 中实现 createWebhook 方法
   */
  function createWebhook(name: string, endpoint: string, events: string[]): WebhookConfig {
    // 存根实现：返回虚拟 webhook
    const webhook: WebhookConfig = {
      id: `webhook_${Date.now()}`,
      name,
      endpoint,
      events,
      secret: crypto.randomUUID?.() || `secret_${Date.now()}`,
      enabled: true,
      createdAt: Date.now(),
      triggerCount: 0,
    }
    state.webhooks = [...state.webhooks, webhook]
    return webhook
  }

  /**
   * 删除 Webhook
   */
  function deleteWebhook(id: string): void {
    automationManager.deleteWebhook(id)
    state.webhooks = automationManager.getWebhooks()
  }

  // ==================== 清理 ====================

  /**
   * 关闭所有服务
   */
  async function shutdown(): Promise<void> {
    try {
      await Promise.all([
        clawdbot.shutdown(),
        memoryManager.shutdown(),
        voiceManager.shutdown(),
        canvasManager.shutdown(),
        nodeManager.shutdown(),
        skillManager.shutdown(),
        integrationManager.shutdown(),
        mcpManager.shutdown(),
        browserAutomation.close(),
        pairingManager.shutdown(),
        modelManager.shutdown(),
        systemManager.shutdown(),
      ])
    } catch (e) { console.error(e) }

    state.initialized = false
    logger.info('[OpenClaw] All services closed')
  }

  // 组件挂载时自动初始化
  onMounted(() => {
    void initialize()
  })

  return {
    // 状态
    state,
    activePanel,

    // 初始化
    initialize,
    shutdown,
    refreshAllData,

    // 记忆系统
    addMemory,
    searchMemory,
    addDailyNote,
    exportMemoryAsMarkdown,

    // 语音系统
    initVoice,
    startVoiceListening,
    stopVoiceListening,
    speak,
    enterTalkMode,
    exitTalkMode,

    // 画布系统
    addCanvasElement,
    updateCanvasElement,
    removeCanvasElement,
    executeA2UICommand,
    exportCanvas,

    // 节点系统
    capturePhoto,
    captureScreen,
    getCurrentLocation,
    showNotification,
    readClipboard,
    writeClipboard,

    // 技能系统
    searchSkills,
    installSkill,
    uninstallSkill,
    executeSkill,
    createSkill,

    // 集成系统
    addIntegration,
    removeIntegration,

    // 浏览器自动化
    browserNavigate,
    browserClick,
    browserType,
    browserScreenshot,

    // 设备配对
    generatePairingCode,
    getPairedDevices,
    unpairDevice,
    sendRemoteCommand,

    // 模型管理
    switchModel,
    getModels,
    configureProvider,
    estimateCost,

    // 系统管理
    runDiagnostics,
    getDashboard,
    approveRequest,
    rejectRequest,
    toggleSandbox,
    updateSandboxConfig,

    // 自动化
    createCronJob,
    deleteCronJob,
    createWebhook,
    deleteWebhook,
  }
}

/**
 * 导出类型
 */
export type UseOpenClawReturn = ReturnType<typeof useOpenClaw>
