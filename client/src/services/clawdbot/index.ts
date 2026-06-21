/**
 * Clawdbot / OpenClaw 核心模块
 * 
 * 基于 OpenClaw (原 Clawdbot/Moltbot) 开源项目的完整集成
 * 参考: https://github.com/openclaw/openclaw
 * 文档: https://docs.clawdbot.com/
 * 
 * 核心功能:
 * - WebSocket Gateway: 消息路由中心
 * - Channel Adapters: 多平台消息接入 (WhatsApp/Telegram/Discord/Slack/WeChat/Teams/LINE/Matrix等)
 * - Tool System: 浏览器自动化、文件系统、Shell命令、LLM任务
 * - Self-Evolution: 自我进化能力
 * - Skills Framework: 技能市场和管理 (ClawdHub)
 * - Memory System: 每日笔记和长期记忆
 * - Voice System: 语音唤醒、对话模式、TTS
 * - Canvas System: A2UI 交互式画布
 * - Nodes System: 设备节点（相机/屏幕/位置/通知）
 * - Integrations: 第三方服务集成
 * - Automation: Cron/Webhooks/Gmail PubSub/Polls/Hooks
 * - Multi-Agent: 多代理路由、子代理
 */

// 核心网关
export { ClawdbotGateway, getClawdbotGateway } from './gateway'
export type { GatewayConfig, GatewayMessage, GatewayEvent } from './gateway'

// Channel 适配器
export { ChannelManager, getChannelManager } from './channels'
export type { 
  ChannelAdapter, 
  ChannelMessage, 
  ChannelConfig,
  SupportedChannel 
} from './channels'

// 扩展 Channel 适配器
export { 
  GoogleChatAdapter,
  MattermostAdapter,
  SignalAdapter,
  IMessageAdapter,
  TeamsAdapter,
  LINEAdapter,
  MatrixAdapter,
  createExtendedAdapter,
} from './channels/extended-channels'

// 工具系统
export { ToolExecutor, getToolExecutor } from './tools'
export type { 
  ToolDefinition, 
  ToolExecutionResult,
  BrowserTool,
  FileSystemTool,
  ShellTool 
} from './tools'

// 扩展工具
export { 
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
} from './tools/extended-tools'

// 自我进化引擎
export { SelfEvolutionEngine, getSelfEvolutionEngine } from './self-evolution'
export type { 
  EvolutionTask, 
  SkillInstallation,
  CodeGeneration 
} from './self-evolution'

// 任务执行器
export { TaskExecutor, getTaskExecutor } from './task-executor'
export type { 
  Task, 
  TaskResult, 
  TaskStatus,
  TaskPlan 
} from './task-executor'

// 消息处理器
export { MessageProcessor, getMessageProcessor } from './message-processor'
export type { 
  ProcessedMessage, 
  MessageContext,
  IntentAnalysis 
} from './message-processor'

// 自动化系统
export { AutomationManager, getAutomationManager } from './automation'
export type {
  CronJob,
  WebhookConfig,
  GmailPubSubConfig,
  PollConfig,
  HookConfig,
  HookType,
} from './automation'

// ==================== 新增模块 ====================

// 记忆系统
export { MemoryManager, getMemoryManager } from './memory'
export type {
  MemoryEntry,
  MemoryType,
  MemoryMetadata,
  DailyNote,
  DailyNoteEntry,
  LongTermMemory,
  MemorySearchOptions,
  MemorySearchResult,
  MemoryConfig,
} from './memory'

// 语音系统
export { VoiceManager, getVoiceManager } from './voice'
export type {
  VoiceConfig,
  VoiceStatus,
  VoiceEvents,
  ElevenLabsVoice,
} from './voice'

// 画布系统 (A2UI)
export { CanvasManager, getCanvasManager } from './canvas'
export type {
  CanvasConfig,
  CanvasElement,
  CanvasElementType,
  CanvasElementData,
  CanvasState,
  CanvasAction,
  CanvasActionType,
  A2UICommand,
} from './canvas'

// 节点系统
export { NodeManager, getNodeManager } from './nodes'
export type {
  NodeType,
  NodeInfo,
  NodeCapability,
  CameraOptions,
  CameraCapture,
  ScreenRecordOptions,
  ScreenCapture,
  LocationInfo,
  LocationOptions,
  NotificationOptions,
  NotificationAction,
  ClipboardContent,
  SystemInfo,
} from './nodes'

// 技能系统 (ClawdHub)
export { SkillManager, getSkillManager } from './skills'
export type {
  Skill,
  SkillAuthor,
  SkillCategory,
  SkillDependency,
  SkillPermission,
  SkillConfigSchema,
  SkillStats,
  InstalledSkill,
  SkillSearchOptions,
  SkillSearchResult,
  SkillInstallOptions,
  CreateSkillRequest,
} from './skills'

// 第三方集成
export { IntegrationManager, getIntegrationManager } from './integrations'
export type {
  IntegrationType,
  IntegrationProvider,
  IntegrationConfig,
  IntegrationCredentials,
  OAuthConfig,
  IntegrationCapability,
  // Email
  Email,
  EmailAddress,
  EmailAttachment,
  EmailSearchOptions,
  // Calendar
  CalendarEvent,
  EventDateTime,
  Attendee,
  Reminder,
  RecurrenceRule,
  CalendarSearchOptions,
  // Git
  GitRepository,
  GitUser,
  GitIssue,
  GitPullRequest,
  GitBranch,
  GitLabel,
  GitMilestone,
  GitCommit,
  // Smart Home
  SmartDevice,
  SmartDeviceType,
  SmartDeviceState,
  SmartDeviceCapability,
  SmartScene,
  SmartAction,
} from './integrations'

// MCP 协议集成
export { MCPManager, getMCPManager, MCPServer, MCPClient } from './mcp'
export type {
  MCPMessageType,
  MCPRequest,
  MCPResponse,
  MCPError,
  MCPTool,
  MCPToolProperty,
  MCPToolCall,
  MCPToolResult,
  MCPContent,
  MCPResource,
  MCPResourceTemplate,
  MCPPrompt,
  MCPPromptArgument,
  MCPPromptMessage,
  MCPServerInfo,
  MCPCapabilities,
  MCPClientInfo,
  MCPServerConfig,
  MCPClientConfig,
  MCPConnectionState,
} from './mcp'

// ==================== 扩展模块 ====================

// 浏览器自动化
export { BrowserAutomation, getBrowserAutomation } from './browser'
export type {
  BrowserConfig,
  ProxyConfig,
  PageState,
  BrowserCookie,
  ElementLocator,
  ElementInfo,
  BoundingBox,
  ClickOptions,
  TypeOptions,
  ScreenshotOptions,
  WaitOptions,
  NavigateOptions,
  FileChooserOptions,
  NetworkRequest,
  NetworkResponse,
  ActionRecord,
  ActionType,
} from './browser'

// 设备配对
export { PairingManager, getPairingManager } from './pairing'
export type {
  DeviceType,
  PlatformType,
  PairingStatus,
  ConnectionStatus,
  DeviceInfo,
  DeviceCapability,
  PairedDevice,
  SyncSettings,
  DevicePermission,
  PairingRequest,
  PairingCode,
  SyncData,
  SyncDataType,
  SyncResult,
  SyncError,
  RemoteCommand,
  RemoteCommandType,
  PairingConfig,
} from './pairing'

// 模型管理
export { ModelManager, getModelManager } from './models'
export type {
  ModelProvider,
  ModelType,
  ModelDefinition,
  ModelCapability,
  ProviderConfig,
  ModelConfig,
  ModelUsageStats,
  DailyModelStats,
  ModelRequest,
  ModelResponse,
  ModelManagerConfig,
} from './models'

// 系统管理
export { SystemManager, getSystemManager } from './system'
export type {
  DiagnosticResult,
  SystemDiagnostics,
  HealthStatus,
  ServiceHealth,
  ResourceHealth,
  DashboardData,
  ActivityItem,
  ModelUsage,
  SkillUsage,
  ErrorItem,
  TimelineItem,
  ApprovalRequest,
  ApprovalType,
  ApprovalPolicy,
  SandboxConfig,
  SandboxStatus,
  MoltbookPost,
  MoltbookComment,
  MoltbookAgent,
  SystemManagerConfig,
} from './system'

// 统一的 Clawdbot 服务
export { ClawdbotService, getClawdbotService } from './clawdbot-service'
export type { 
  ClawdbotConfig, 
  ClawdbotStatus,
  ConversationMessage,
} from './clawdbot-service'
