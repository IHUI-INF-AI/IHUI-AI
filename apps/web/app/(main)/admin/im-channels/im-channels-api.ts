/**
 * IM 渠道管理前端 API 封装(2026-07-31 立,P0)。
 *
 * 调 @ihui/api-client 的 6 个 IM 端点函数(AGENTS.md §3 禁止端内直接 fetch)。
 * 本文件做薄包装:统一 try/catch + Error 归一化,供 useQuery / useMutation 直接消费。
 */
import {
  fetchImAdapters,
  fetchImMessages,
  fetchImPlatforms,
  fetchImStatus,
  sendImMessage,
  upsertImAdapter,
  type FetchImMessagesParams,
  type ImMessageHistoryPage,
  type SendImMessageInput,
  type SendImMessageResult,
} from '@ihui/api-client'
import type {
  ImAdapterConfig,
  ImAdapterUpsertInput,
  ImGatewayStatus,
  ImPlatformMeta,
} from '@ihui/types'

async function call<T>(fn: () => Promise<T>, fallbackMsg: string): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const msg = err instanceof Error ? err.message : fallbackMsg
    throw new Error(msg)
  }
}

export const imChannelsApi = {
  /** 获取 16 平台元数据 */
  fetchPlatforms: (): Promise<ImPlatformMeta[]> => call(fetchImPlatforms, '获取 IM 平台元数据失败'),

  /** 获取已配置的适配器列表 */
  fetchAdapters: (): Promise<ImAdapterConfig[]> => call(fetchImAdapters, '获取 IM 适配器列表失败'),

  /** upsert 适配器配置 */
  upsertAdapter: (input: ImAdapterUpsertInput): Promise<ImAdapterConfig> =>
    call(() => upsertImAdapter(input), '保存 IM 适配器配置失败'),

  /** 获取 16 平台连接状态 */
  fetchStatus: (): Promise<ImGatewayStatus[]> => call(fetchImStatus, '获取 IM 网关状态失败'),

  /** 查询消息历史(分页) */
  fetchMessages: (params?: FetchImMessagesParams): Promise<ImMessageHistoryPage> =>
    call(() => fetchImMessages(params), '获取 IM 消息历史失败'),

  /** 发送出站测试消息 */
  sendMessage: (input: SendImMessageInput): Promise<SendImMessageResult> =>
    call(() => sendImMessage(input), '发送 IM 测试消息失败'),
} as const
