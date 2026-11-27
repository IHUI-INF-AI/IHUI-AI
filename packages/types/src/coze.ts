// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Coze 跨端共享类型定义
 * 各端 Coze 客户端禁止本地定义类型,必须 import 本文件。
 * 字段命名与 Coze 官方 API 保持一致(snake_case);token/baseUrl/botId/timeout 为本地配置。
 */

/** Coze 客户端配置(PAT 直连 Coze 官方 API) */
export interface CozeConfig {
  /** Coze 个人访问令牌(PAT) */
  token: string
  /** API 基础地址,默认 https://api.coze.cn */
  baseUrl: string
  /** 默认 Bot ID */
  botId: string
  /** 请求超时(ms) */
  timeout: number
}

/** 对话消息(请求体) */
export interface CozeChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  content_type?: 'text' | 'object_string'
  /** Coze 消息类型,如 question / answer */
  type?: string
  meta_data?: Record<string, unknown>
}

/** 创建对话请求参数 */
export interface CozeCreateChatOptions {
  bot_id?: string
  user_id: string
  conversation_id?: string
  additional_messages?: CozeChatMessage[]
  custom_variables?: Record<string, unknown>
  parameters?: Record<string, unknown>
  auto_save_history?: boolean
}

/** Token 用量统计 */
export interface CozeUsage {
  input_count?: number
  output_count?: number
  token_count?: number
}

/** 创建对话响应 */
export interface CozeChatCreated {
  id: string
  conversation_id: string
  status: string
  usage?: CozeUsage
}

/** 对话状态查询响应 */
export interface CozeChatStatus {
  status: string
  usage?: CozeUsage
  last_error?: string
  completed_at?: number
}

/** 对话消息列表项 */
export interface CozeChatMessageItem {
  id: string
  type: string
  content: string
  content_type: string
  created_at: number
}

/** Workflow 运行结果 */
export interface CozeWorkflowRunResult {
  execute_id: string
  debug_url?: string
  data?: unknown
}

/** 流式对话回调处理器 */
export interface CozeStreamChatHandlers {
  onDelta?: (delta: string) => void
  onDone?: () => void
  onError?: (err: Error) => void
}

// =============================================================================
// 智能体（Bot）完整配置类型
// 权威来源：https://api.coze.cn/v1/bots/:bot_id?is_published=true
// 官方文档：https://docs.coze.cn/developer_guides/get_metadata_draft_published
// =============================================================================

/** 前缀缓存提示词（PromptInfo.prompt_mode=prefix 时返回） */
export interface CozeBotPrefixPromptInfo {
  /** 缓存提示词，固定规则/模板/背景信息 */
  prefix_prompt?: string
  /** 非缓存提示词，仅对当前请求生效的动态信息 */
  dynamic_prompt?: string
}

/** 提示词配置 */
export interface CozeBotPromptInfo {
  /** 人设与回复逻辑，0~20000 字符 */
  prompt?: string
  /** standard（默认）| prefix */
  prompt_mode?: string
  /** 前缀缓存模式下的提示词拆分 */
  prefix_prompt_info?: CozeBotPrefixPromptInfo
}

/** 开场白配置。官方同时存在 snake_case 与历史 PascalCase 两种返回形态。 */
export interface CozeBotOnboardingInfo {
  prologue?: string
  suggested_questions?: string[]
  /** 历史字段名，部分租户/版本会返回 */
  Prologue?: string
  SuggestedQuestions?: string[]
  OnboardingMode?: number
  CustomizedOnboardingPrompt?: string
  SuggestedQuestionsShowMode?: number
}

/** 插件工具（ApiInfo） */
export interface CozeBotPluginApiInfo {
  api_id?: string
  name?: string
  description?: string
  [key: string]: unknown
}

/** 插件（PluginInfo） */
export interface CozeBotPluginInfo {
  plugin_id?: string
  name?: string
  icon_url?: string
  description?: string
  api_info_list?: CozeBotPluginApiInfo[]
  [key: string]: unknown
}

/** 模型配置（ModelInfo） */
export interface CozeBotModelInfo {
  /** 采样候选集大小 */
  top_k?: number
  /** Top P 采样，0~1 */
  top_p?: number
  /** Coze 模型 ID，非本项目可路由模型名 */
  model_id?: string
  /** 输出 token 上限 */
  max_tokens?: number
  /** 模型展示名 */
  model_name?: string
  /** 模型参数，如 thinking_type / caching */
  parameters?: Record<string, unknown>
  /** 生成随机性 */
  temperature?: number
  /** 携带上下文轮数 */
  context_round?: number
  /** text | markdown | json */
  response_format?: string
  /** 重复主题惩罚 */
  presence_penalty?: number
  /** 重复语句惩罚 */
  frequency_penalty?: number
  /** 模型 API 协议：chat_api | responses_api */
  api_mode?: string
  /** 缓存类型：closed / open 等 */
  cache_type?: string
  [key: string]: unknown
}

/** 知识库条目 */
export interface CozeBotKnowledgeInfo {
  id?: string
  name?: string
  [key: string]: unknown
}

/** 知识库配置 */
export interface CozeBotKnowledge {
  knowledge_infos?: CozeBotKnowledgeInfo[]
  [key: string]: unknown
}

/** 智能体变量 */
export interface CozeBotVariable {
  /** 是否启用 */
  enable?: boolean
  /** 变量类型，当前仅 custom */
  channel?: string
  /** 变量名 */
  keyword?: string
  /** 变量描述 */
  description?: string
  /** 默认值 */
  default_value?: string
  /** 是否允许 Prompt 访问 */
  prompt_enable?: boolean
  [key: string]: unknown
}

/** 语音通话配置 */
export interface CozeBotMediaConfig {
  /** 是否关闭语音通话 */
  is_voice_call_closed?: boolean
  [key: string]: unknown
}

/** 音色 */
export interface CozeBotVoiceInfo {
  voice_id?: string
  language_code?: string
  [key: string]: unknown
}

/** 快捷指令组件 */
export interface CozeBotShortcutCommandComponent {
  name?: string
  description?: string
  type?: string
  tool_parameter?: string
  default_value?: string
  is_hide?: boolean
  [key: string]: unknown
}

/** 快捷指令使用的工具 */
export interface CozeBotShortcutCommandTool {
  name?: string
  /** plugin | workflow */
  type?: string
  [key: string]: unknown
}

/** 快捷指令 */
export interface CozeBotShortcutCommandInfo {
  id?: string
  name?: string
  command?: string
  description?: string
  query_template?: string
  icon_url?: string
  agent_id?: string
  components?: CozeBotShortcutCommandComponent[]
  tool?: CozeBotShortcutCommandTool
  [key: string]: unknown
}

/** 工作流 */
export interface CozeBotWorkflowInfo {
  id?: string
  name?: string
  description?: string
  icon_url?: string
  [key: string]: unknown
}

/** 背景图裁剪/渐变位置 */
export interface CozeBotBackgroundPosition {
  top?: number
  left?: number
  width?: number
  height?: number
  right?: number
  [key: string]: unknown
}

/** 单端背景图配置 */
export interface CozeBotBackgroundImageDetail {
  image_url?: string
  origin_image_url?: string
  theme_color?: string
  canvas_position?: CozeBotBackgroundPosition
  gradient_position?: CozeBotBackgroundPosition
  [key: string]: unknown
}

/** Web / 移动端背景图配置 */
export interface CozeBotBackgroundImageInfo {
  web_background_image?: CozeBotBackgroundImageDetail
  mobile_background_image?: CozeBotBackgroundImageDetail
  [key: string]: unknown
}

/** 用户问题建议配置 */
export interface CozeBotSuggestReplyInfo {
  /** enable 等 */
  reply_mode?: string
  customized_prompt?: string
  [key: string]: unknown
}

/**
 * `GET /v1/bots/:bot_id` 返回的完整智能体配置。
 * 保留 `[key: string]: unknown`，让未来新增字段在未更新类型时也不会被丢弃：
 * 服务端会把完整 payload 原样写入 `agents.coze_config_raw` 与快照表。
 */
export interface CozeBotConfig {
  bot_id?: string
  name?: string
  description?: string
  icon_url?: string
  create_time?: number
  update_time?: number
  version?: string
  prompt_info?: CozeBotPromptInfo
  onboarding_info?: CozeBotOnboardingInfo
  /** 0 单 Agent；1 多 Agent */
  bot_mode?: number
  plugin_info_list?: CozeBotPluginInfo[]
  model_info?: CozeBotModelInfo
  folder_id?: string
  knowledge?: CozeBotKnowledge
  variables?: CozeBotVariable[]
  media_config?: CozeBotMediaConfig
  owner_user_id?: string
  voice_info_list?: CozeBotVoiceInfo[]
  /** 历史字段，等同 voice_info_list */
  voice_data_list?: CozeBotVoiceInfo[]
  shortcut_commands?: CozeBotShortcutCommandInfo[]
  workflow_info_list?: CozeBotWorkflowInfo[]
  background_image_info?: CozeBotBackgroundImageInfo
  /** text | voice | call */
  default_user_input_type?: string
  suggest_reply_info?: CozeBotSuggestReplyInfo
  [key: string]: unknown
}

/** `GET /v1/bot/get_online_info` 的兼容形态（在线版字段子集） */
export type CozeBotOnlineInfoData = Pick<
  CozeBotConfig,
  | 'bot_id'
  | 'name'
  | 'description'
  | 'icon_url'
  | 'version'
  | 'prompt_info'
  | 'onboarding_info'
  | 'bot_mode'
  | 'plugin_info_list'
  | 'model_info'
  | 'knowledge'
  | 'variables'
  | 'media_config'
  | 'voice_info_list'
  | 'voice_data_list'
  | 'shortcut_commands'
  | 'workflow_info_list'
  | 'background_image_info'
  | 'default_user_input_type'
  | 'suggest_reply_info'
  | 'create_time'
  | 'update_time'
  | 'owner_user_id'
>

/** `GET /v1/bots` 列表项（BotSimpleInfo） */
export interface CozeBotListItem {
  id?: string
  name?: string
  description?: string
  icon_url?: string
  updated_at?: number
  published_at?: number
  is_published?: boolean
  owner_user_id?: string
  folder_id?: string
  [key: string]: unknown
}

/** `GET /v1/bots` 分页返回 */
export interface CozeBotListResult {
  items?: CozeBotListItem[]
  total?: number
  [key: string]: unknown
}

/** 公开详情可展示的安全能力面（不含提示词、模型参数、变量值、原始配置） */
export interface CozePublicCapabilities {
  prologue: string | null
  suggestedQuestions: string[]
  plugins: Array<{
    name?: string
    description?: string
    iconUrl?: string
    tools: Array<{ name?: string; description?: string }>
  }>
  workflows: Array<{ name?: string; description?: string; iconUrl?: string }>
  knowledge: Array<{ name?: string }>
  shortcutCommands: Array<{
    name?: string
    command?: string
    description?: string
    iconUrl?: string
    queryTemplate?: string
  }>
  defaultUserInputType: string | null
  botMode: number | null
  voiceCallClosed: boolean | null
}
