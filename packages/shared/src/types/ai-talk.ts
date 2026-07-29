/**
 * AI Talk 业务类型定义
 * 从旧项目 Vue2 mixin (aiBase.js / ai_index.js) 迁移,用于 React hook 化的 talk 入口与模型分发。
 */

export type AiModelKey =
  | 'cosyvoice-v3'
  | 'keling'
  | 'sora-2'
  | 'volcengine-t2v'
  | 'doubao-seedream-4.0'
  | 'qwen-image'
  | 'qwen-image-Edit'
  | 'wan2.5-i2v-preview'
  | 'wan2.5-i2v-previe'
  | 'hunyuanTo3D'
  | 'qwen-plus'
  | 'Doubao-1.6'
  | 'GLM-4.5'
  | 'Nano_Banana'
  | 'veo3-frames'
  | 'qwen-omni'

/** 单条 Agent 响应内容项(对应旧项目 agent_content_list 元素) */
export interface AgentContentListItem {
  content: string
  content1?: string
  imgUrlList: string[]
  videoUrl?: string
  audioUrl?: string
  totalTokens: number
  isHaveSikao: boolean
  isAudio?: boolean
  hasLists?: boolean
  lists?: Array<{ type: 'image' | 'text' | 'video' | 'audio'; url?: string; text?: string }>
  thinkingContent?: string
  videoRatio?: string
  error?: string
  debugInfo?: string
}

/** 模型配置变更数据(对应旧项目 modelConfigDialog 交互) */
export interface ModelConfigChangeData {
  referenceAudio?: string
  orientation?: 'landscape' | 'portrait'
  selectedVoice?: { audioId: string } | string
  [key: string]: unknown
}

/** WebSocket 推送消息(兼容多种厂商响应结构) */
export type WebSocketMessage =
  | { event: 'conversation.message.delta'; data: { content: string } }
  | { event: 'conversation.chat.completed'; data: { content: string } }
  | { message: '流式响应完成' }
  | { code: 200; data: { type: 'success'; url?: string } }

/** 智汇 LLM 请求体(对应旧项目 ihuiLlmChat body) */
export interface IHuiLlmBody {
  prompt: string
  model_id: string
  user_uuid: string
  chat_id: string
  imgsList?: Array<{ imgUrl: string }>
  audioUrl?: string
  zidingyican?: unknown
}

/** 异步任务轮询结果(对应 keling/sora/hunyuan 等轮询接口返回) */
export interface TaskPollingResult {
  task_status: 'succeed' | 'failed' | 'completed' | 'processing' | 'pending'
  data?: {
    url?: string
    audio_url?: string
    video_url?: string
    image_url?: string
    [key: string]: unknown
  }
  total_tokens?: number
}
