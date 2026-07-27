/** Coze 平台 API — mobile-rn 端。已下沉到 @ihui/api-client,本文件仅 re-export + 保留 AsyncStorage 持久化。 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COZE_DEFAULT_BASE_URL, COZE_DEFAULT_TIMEOUT, createCozeClient } from '@ihui/api-client'
import type { CozeConfig } from '@ihui/types'

const STORAGE_KEY = 'coze_config_v1'

// ===== 共享层 re-export(类型 + 常量 + 错误类 + 工厂) =====
export { COZE_DEFAULT_BASE_URL, COZE_DEFAULT_TIMEOUT, CozeApiError, createCozeClient } from '@ihui/api-client'
export type { CozeClient } from '@ihui/api-client'
export type {
  CozeConfig,
  CozeChatMessage,
  CozeCreateChatOptions,
  CozeUsage,
  CozeChatCreated,
  CozeChatStatus,
  CozeChatMessageItem,
  CozeWorkflowRunResult,
  CozeStreamChatHandlers,
} from '@ihui/types'

// 旧名称别名(向后兼容)
export type { CozeChatMessage as ChatMessage } from '@ihui/types'
export type { CozeCreateChatOptions as CreateChatOptions } from '@ihui/types'
export type { CozeChatCreated as ChatCreated } from '@ihui/types'
export type { CozeChatStatus as ChatStatus } from '@ihui/types'
export type { CozeChatMessageItem as ChatMessageItem } from '@ihui/types'
export type { CozeWorkflowRunResult as WorkflowRunResult } from '@ihui/types'
export type { CozeStreamChatHandlers as StreamChatHandlers } from '@ihui/types'

// ===== 平台特定逻辑(AsyncStorage 持久化,不可下沉) =====
export async function loadCozeConfig(): Promise<CozeConfig> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<CozeConfig>
      return {
        token: p.token ?? '',
        baseUrl: p.baseUrl ?? COZE_DEFAULT_BASE_URL,
        botId: p.botId ?? '',
        timeout: p.timeout ?? COZE_DEFAULT_TIMEOUT,
      }
    } catch { /* fallthrough */ }
  }
  return { token: '', baseUrl: COZE_DEFAULT_BASE_URL, botId: '', timeout: COZE_DEFAULT_TIMEOUT }
}

export async function saveCozeConfig(cfg: CozeConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

export async function clearCozeConfig(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

/** 测试连接(加载本地 config 后委托共享客户端) */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await loadCozeConfig()
  return createCozeClient(cfg).testConnection()
}
