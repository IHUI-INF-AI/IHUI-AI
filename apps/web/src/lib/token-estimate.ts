/**
 * Token 估算工具(web 端 wrapper)。
 *
 * 2026-08-01 P3-4.2 批次5:前 3 个纯函数下沉到 @ihui/shared/utils/token-estimate,
 * 本文件保留 web 端专属的 estimateChatMessagesTokens(依赖 ChatMessage 类型)。
 */

// re-export shared 层的纯函数(跨端通用)
export {
  estimateTokens,
  estimateMessageTokens,
  estimateConversationTokens,
} from '@ihui/shared/utils/token-estimate'

import type { ChatMessage } from '@/stores/chat'
import { estimateMessageTokens } from '@ihui/shared/utils/token-estimate'

/** 估算 ChatMessage[] 的总 token 数(过滤 error 消息,web 端专属) */
export function estimateChatMessagesTokens(messages: ChatMessage[]): number {
  return messages
    .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
    .reduce((sum, m) => sum + estimateMessageTokens(m), 0)
}
