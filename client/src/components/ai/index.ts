/**
 * AI组件统一导出
 * 
 * @module components/ai
 * @version 1.0.0
 */

// AI 能力选择器
export {
  AICapabilitySelector,
  CapabilityItem,
  GenerationTypeSelector,
} from './AICapabilitySelector'
export type {
  AICapabilityMode,
  ModelCategory,
  GenerationType,
  ImageProvider,
  VideoProvider,
  MCPTool,
  CapabilityItemData,
} from './AICapabilitySelector'

// 虚拟滚动消息列表 - 文件不存在，已移除导出
// export { default as VirtualMessageList } from './VirtualMessageList.vue'

// 核心AI对话组件
export { default as AIChat } from './AIChat.vue'
export { default as AIChatLegacy } from './AIChatLegacy.vue'
export { default as AIDialog } from './AIDialog.vue'
// 兼容性别名
export { default as FloatingChatDialog } from './AIChat.vue'
export { default as AgentManager } from './AgentManager.vue'
export { default as UnifiedAIPanel } from './UnifiedAIPanel.vue'
export { default as MarkdownStream } from './MarkdownStream.vue'
export { default as PromptTemplates } from './PromptTemplates.vue'
export { default as VoiceInput } from './VoiceInput.vue'
export { default as VoiceRecord } from './VoiceRecord.vue'
export { default as FileUpload } from './FileUpload.vue'
