// Barrel re-export — 兼容 `import { sendMessage } from '@/api/chat'` 旧路径
// 仅 re-export chat.ts，避免与 chat-history/chatRoom/sidebarChatHistory 命名冲突
export * from './chat'
