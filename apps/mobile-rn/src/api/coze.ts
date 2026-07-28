/** Coze 平台 API — mobile-rn 端。已下沉到 @ihui/api-client,本文件仅 re-export + 保留 AsyncStorage 持久化。 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COZE_DEFAULT_BASE_URL, COZE_DEFAULT_TIMEOUT, createCozeClient } from '@ihui/api-client'
import { COZE_CONFIG_STORAGE_KEY } from '@ihui/shared/constants'
import type { CozeConfig } from '@ihui/types'

// 旧 key (下划线),用于一次性迁移到新 key (连字符,与 web/miniapp-taro/extension 一致)
const LEGACY_STORAGE_KEY = 'coze_config_v1'

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

/**
 * 一次性迁移:旧 key `coze_config_v1` (下划线) → 新 key `coze-config-v1` (连字符)。
 * 与 web/miniapp-taro/extension 保持一致,避免用户升级后丢失配置。
 * 幂等:迁移完成后删除旧 key,下次调用直接读新 key。
 */
async function migrateLegacyKey(): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy !== null) {
      const current = await AsyncStorage.getItem(COZE_CONFIG_STORAGE_KEY)
      if (current === null) {
        await AsyncStorage.setItem(COZE_CONFIG_STORAGE_KEY, legacy)
      }
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  } catch { /* 静默 */ }
}

export async function loadCozeConfig(): Promise<CozeConfig> {
  await migrateLegacyKey()
  const raw = await AsyncStorage.getItem(COZE_CONFIG_STORAGE_KEY)
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
  await AsyncStorage.setItem(COZE_CONFIG_STORAGE_KEY, JSON.stringify(cfg))
}

export async function clearCozeConfig(): Promise<void> {
  await AsyncStorage.removeItem(COZE_CONFIG_STORAGE_KEY)
}

/** 测试连接(加载本地 config 后委托共享客户端) */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await loadCozeConfig()
  return createCozeClient(cfg).testConnection()
}
