export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentTask {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

/**
 * AI 模型相关类型(跨端统一:mobile-rn/ModelConfigDialog + AiModelCard + web/miniapp-taro 后续接入)。
 */

/** 模型类型(用于 ModelConfigDialog 区分模型能力) */
export type ModelType = 'text' | 'image' | 'video' | 'audio' | 'multimodal';

/** 模型配置(用于 ModelConfigDialog 表单数据) */
export interface ModelConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
  streamEnabled: boolean;
  aspectRatio?: string;
  resolution?: string;
  frameCount?: number;
  timbre?: string;
}

/** 模型用户类型(用于 AiModelCard 显示徽章) */
export type ModelUserType =
  | 'freevip'
  | 'freeuse'
  | 'freetime'
  | 'hasbuy'
  | 'buymonth'
  | 'none';

/** AI 模型数据(用于 AiModelCard 渲染) */
export interface AiModelData {
  name: string;
  subname?: string;
  icon?: string;
  mumber?: number | string;
  userType?: ModelUserType;
  tags?: string[];
  [key: string]: unknown;
}