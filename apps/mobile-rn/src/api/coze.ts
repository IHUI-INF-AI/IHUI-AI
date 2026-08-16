/** Coze 平台 API — mobile-rn 端。已下沉到 @ihui/api-client,本文件仅 re-export + 保留 AsyncStorage 持久化。 */
import { COZE_DEFAULT_BASE_URL, COZE_DEFAULT_TIMEOUT, createCozeClient } from '@ihui/api-client'
import { COZE_CONFIG_STORAGE_KEY } from '@ihui/shared/constants'
import type { CozeConfig } from '@ihui/types'
import { createAsyncStorageTransport } from '../stores/storage-adapter'

// 旧下划线 key(迁移前),向后兼容一次后删除
const LEGACY_STORAGE_KEY = 'coze_config_v1'

// 单例 transport(零运行时开销,AsyncStorage 静态绑定)
const transport = createAsyncStorageTransport()

// ===== 共享层 re-export(类型 + 常量 + 错误类 + 工厂) =====
export {
  COZE_DEFAULT_BASE_URL,
  COZE_DEFAULT_TIMEOUT,
  CozeApiError,
  createCozeClient,
} from '@ihui/api-client'
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
 * 迁移旧下划线 key 'coze_config_v1' 到新连字符 key COZE_CONFIG_STORAGE_KEY('coze-config-v1')。
 * 幂等:旧 key 不存在 / 新 key 已有数据时跳过写入,只在迁移成功后删除旧 key。
 * 调用时机:loadCozeConfig() / saveCozeConfig() / clearCozeConfig() 入口前。
 */
async function migrateLegacyKey(): Promise<void> {
  const legacyRaw = await transport.getItem(LEGACY_STORAGE_KEY)
  if (legacyRaw === null) return
  const existing = await transport.getItem(COZE_CONFIG_STORAGE_KEY)
  if (existing === null) {
    await transport.setItem(COZE_CONFIG_STORAGE_KEY, legacyRaw)
  }
  await transport.removeItem(LEGACY_STORAGE_KEY)
}

export async function loadCozeConfig(): Promise<CozeConfig> {
  await migrateLegacyKey()
  const raw = await transport.getItem(COZE_CONFIG_STORAGE_KEY)
  if (raw) {
    try {
      const p = JSON.parse(raw) as Partial<CozeConfig>
      return {
        token: p.token ?? '',
        baseUrl: p.baseUrl ?? COZE_DEFAULT_BASE_URL,
        botId: p.botId ?? '',
        timeout: p.timeout ?? COZE_DEFAULT_TIMEOUT,
      }
    } catch {
      /* fallthrough */
    }
  }
  return { token: '', baseUrl: COZE_DEFAULT_BASE_URL, botId: '', timeout: COZE_DEFAULT_TIMEOUT }
}

export async function saveCozeConfig(cfg: CozeConfig): Promise<void> {
  await migrateLegacyKey()
  await transport.setItem(COZE_CONFIG_STORAGE_KEY, JSON.stringify(cfg))
}

export async function clearCozeConfig(): Promise<void> {
  await migrateLegacyKey()
  await transport.removeItem(COZE_CONFIG_STORAGE_KEY)
}

/** 测试连接(加载本地 config 后委托共享客户端) */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const cfg = await loadCozeConfig()
  return createCozeClient(cfg).testConnection()
}
