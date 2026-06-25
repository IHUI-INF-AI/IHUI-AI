/**
 * AI 能力选择器类型定义
 * @module components/ai/AICapabilitySelector/types
 */

import type { AIModelInfo } from '@/api/ai/aiModelInfo'
import type { Agent } from '@/api/agent/agents'

/** AI 能力模式 */
export type AICapabilityMode = 'model' | 'agent' | 'agentic' | 'mcp' | 'generation'

/** 模型分类 - 与参考项目 ai_index.vue / ModelList 一致：type 0=other, 1=talk, 2=image, 3=video, 4=audio, 5=videoa */
export type ModelCategory = 'talk' | 'image' | 'video' | 'audio' | 'videoa' | 'other'

/** 生成类型 */
export type GenerationType = 'auto' | 'image' | 'video' | '3d' | 'vision' | 'audio' | 'music'

/** 图像服务商 */
export type ImageProvider = 'qwen' | 'doubao' | 'jimeng'

/** 视频服务商 */
export type VideoProvider = 'qwen' | 'kling' | 'one-click'

/** MCP 工具接口 */
export interface MCPTool {
  id: string
  name: string
  description?: string
  icon?: string
  category?: string
  /** 所属 MCP 服务器名称，用于列表展示 */
  serverName?: string
  /** 服务器功能简介，用于列表展示 */
  serverDescription?: string
}

/** 能力项通用接口 */
export interface CapabilityItemData {
  id: string
  name: string
  description?: string
  /** 前端组件（如 Lucide 图标），用于 <component :is="icon" /> */
  icon?: string
  /** 后端返回的图标 URL（模型 img、智能体 avatar 等），优先于 icon 展示 */
  iconUrl?: string
  isSelected?: boolean
  tags?: string[]
  metadata?: Record<string, unknown>
}

/** AI 能力选择器 Props */
export interface AICapabilitySelectorProps {
  /** 是否显示 */
  modelValue: boolean
  /** 当前 AI 模式 */
  currentMode?: AICapabilityMode
  /** 当前模型分类 */
  modelCategory?: ModelCategory
  /** 选中的模型 */
  selectedModel?: AIModelInfo | null
  /** 选中的智能体 */
  selectedAgent?: Agent | null
  /** 选中的 Agentic Swarm ID */
  selectedAgenticSwarmId?: string | null
  /** 模型列表 */
  models?: AIModelInfo[]
  /** 智能体列表 */
  agents?: Agent[]
  /** MCP 工具列表 */
  mcpTools?: MCPTool[]
  /** 当前生成类型 */
  generationType?: GenerationType
  /** 当前图像服务商 */
  imageProvider?: ImageProvider
  /** 当前视频服务商 */
  videoProvider?: VideoProvider
  /** 生成任务 ID */
  generationTaskId?: string | null
}

/** AI 能力选择器 Emits */
export interface AICapabilitySelectorEmits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:currentMode', mode: AICapabilityMode): void
  (e: 'update:modelCategory', category: ModelCategory): void
  (e: 'update:generationType', type: GenerationType): void
  (e: 'update:imageProvider', provider: ImageProvider): void
  (e: 'update:videoProvider', provider: VideoProvider): void
  (e: 'selectModel', modelCode: string): void
  (e: 'selectAgent', agentId: string): void
  (e: 'selectAgentic'): void
  (e: 'selectMCPTool', tool: MCPTool): void
  (e: 'openApiAccess', model: AIModelInfo): void
}

/** 能力项 Props */
export interface CapabilityItemProps {
  /** 能力数据 */
  data: CapabilityItemData
  /** 是否选中 */
  selected?: boolean
  /** 是否显示 API 访问按钮 */
  showApiAccess?: boolean
  /** 变体类型 */
  variant?: 'default' | 'compact' | 'featured'
}

/** 能力项 Emits */
export interface CapabilityItemEmits {
  (e: 'click', data: CapabilityItemData): void
  (e: 'apiAccess', data: CapabilityItemData): void
}

/** Tab 配置 */
export interface TabConfig {
  key: AICapabilityMode
  label: string
  icon?: string
}

/** 模型分类配置 */
export interface ModelCategoryConfig {
  key: ModelCategory
  label: string
  icon?: string
}

/** 生成类型配置 */
export interface GenerationTypeConfig {
  key: GenerationType
  label: string
  icon: string
  description?: string
}

/** 服务商配置 */
export interface ProviderConfig {
  key: string
  label: string
  icon?: string
}
