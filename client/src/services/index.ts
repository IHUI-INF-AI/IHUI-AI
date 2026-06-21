/**
 * AI平台服务统一导出
 * 
 * @module services
 * @version 1.0.0
 */

// 认证流程服务 - 优化登录性能
export {
  AuthFlowService,
  authFlowLogin,
  authFlowPhoneLogin,
  authFlowRedirect,
} from './auth-flow.service'

export type {
  LoginCredentials,
  LoginResult,
  LoginOptions,
  RedirectOptions,
} from './auth-flow.service'

// 生成队列服务
export {
  GenerationQueueService,
  useGenerationQueue,
} from './GenerationQueueService'

// 提示词优化服务
export {
  usePromptOptimizer,
} from './PromptOptimizerService'

// 视频质量分析服务
export {
  VideoQualityAnalyzer,
  useVideoQualityAnalyzer,
} from './VideoQualityAnalyzer'

// 剧情AI助手服务
export {
  PlotAdvisorService,
  usePlotAdvisor,
} from './PlotAdvisorService'

// Clawdbot / OpenClaw 服务 - 智能AI助手
export {
  // 核心服务
  ClawdbotGateway,
  getClawdbotGateway,
  ChannelManager,
  getChannelManager,
  ToolExecutor,
  getToolExecutor,
  TaskExecutor,
  getTaskExecutor,
  SelfEvolutionEngine,
  getSelfEvolutionEngine,
  MessageProcessor,
  getMessageProcessor,
  ClawdbotService,
  getClawdbotService,
  // 自动化系统
  AutomationManager,
  getAutomationManager,
  // 扩展渠道适配器
  GoogleChatAdapter,
  MattermostAdapter,
  SignalAdapter,
  IMessageAdapter,
  TeamsAdapter,
  LINEAdapter,
  MatrixAdapter,
  createExtendedAdapter,
  // 扩展工具
  getExtendedTools,
  lobsterTool,
  llmTaskTool,
  applyPatchTool,
  elevatedTool,
  canvasTool,
  voiceCallTool,
  cameraCaptureTool,
  locationTool,
  agentSendTool,
  subAgentTool,
  reactionsTool,
} from './clawdbot'

export type {
  // Gateway 类型
  GatewayConfig,
  GatewayMessage,
  GatewayEvent,
  // Channel 类型
  ChannelAdapter,
  ChannelMessage,
  ChannelConfig,
  SupportedChannel,
  // Tool 类型
  ToolDefinition,
  ToolExecutionResult,
  BrowserTool,
  FileSystemTool,
  ShellTool,
  // Evolution 类型
  EvolutionTask,
  SkillInstallation,
  CodeGeneration,
  // Task 类型
  Task,
  TaskResult,
  TaskStatus,
  TaskPlan,
  // Message 类型
  ProcessedMessage,
  MessageContext,
  IntentAnalysis,
  // Automation 类型
  CronJob,
  WebhookConfig,
  GmailPubSubConfig,
  PollConfig,
  HookConfig,
  HookType,
} from './clawdbot'

// 导出类型
export type {
  SceneRecommendation,
  PlotIssue,
  CharacterArcAnalysis,
  PacingAnalysis,
  StoryOutline,
} from './PlotAdvisorService'
