/**
 * 中文连接器端点(2026-09-02 立,P2-2 中文 Connectors)
 * 对应 ai-service 8803 的 /api/connectors 外部生态接口:
 *  - GET    /api/connectors                    → 全部连接器配置列表(脱敏)
 *  - POST   /api/connectors/config             → 新增/覆盖配置(app_secret 空串=保留旧值)
 *  - POST   /api/connectors/sync               → 同步数据源,返回文档列表
 *  - POST   /api/connectors/{key}/fetch        → 拉取单篇文档正文
 *  - POST   /api/connectors/{key}/enable|disable → 启停
 *  - DELETE /api/connectors/{key}              → 删除配置
 *
 * 注意:后端绝不返回 app_id/app_secret 明文,前端只通过 configured 判断是否已配置。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client'

// ===================== 类型定义 =====================

/** 连接器类型:语雀 / 飞书 / 企业微信 / 钉钉 */
export type ConnectorType = 'yuque' | 'feishu' | 'wecom' | 'dingtalk'

/** 连接器能力位(由注册表是否有对应模块决定) */
export interface ConnectorCapabilities {
  doc_list: boolean
  fetch_doc: boolean
}

/** 同步得到的文档条目 */
export interface ConnectorSyncItem {
  doc_id: string
  title: string
}

/** 连接器条目(脱敏:无 app_id/app_secret) */
export interface ConnectorEntry {
  /** 唯一标识,格式 {type}:{slug} */
  key: string
  /** 类型:yuque|feishu|wecom|dingtalk */
  type: string
  /** 展示名 */
  name: string
  /** 类型专属配置(语雀为 user/repo) */
  extra: Record<string, string>
  /** 是否已配置(app_id 非空 或 extra 非空) */
  configured: boolean
  /** 是否启用 */
  enabled: boolean
  installed_at: string
  updated_at: string
  last_sync_at: string
  /** 最近一次同步/操作错误信息(空=正常) */
  last_error: string
  /** 最近一次同步拉到的文档列表 */
  sync_items: ConnectorSyncItem[]
  capabilities: ConnectorCapabilities
}

/** 连接器列表响应 */
export interface ConnectorListResponse {
  connectors: ConnectorEntry[]
  count: number
}

/** 保存连接器配置请求参数 */
export interface SaveConnectorConfigInput {
  key: string
  type: string
  name: string
  /** 开放平台 app_id(飞书/企微/钉钉) */
  app_id: string
  /** 密钥(空串时保留旧值,防止回显覆盖) */
  app_secret: string
  /** 类型专属配置(语雀 user/repo) */
  extra: Record<string, string>
}

/** 同步响应 */
export interface ConnectorSyncResult {
  ok: boolean
  key: string
  type: string
  message: string
  items: ConnectorSyncItem[]
  last_sync_at: string
}

/** 单篇文档拉取响应 */
export interface ConnectorFetchResult {
  ok: boolean
  title: string
  content: string
  chars: number
  /** 内容超长被截断时为 true */
  truncated: boolean
  message: string
}

/** 删除响应 */
export interface ConnectorDeleteResult {
  ok: boolean
}

// ===================== 接口函数 =====================

/** 获取全部连接器配置(脱敏列表) */
export async function getConnectors(): Promise<ApiResult<ConnectorListResponse>> {
  return fetchApi<ConnectorListResponse>('/api/connectors')
}

/** 新增或覆盖连接器配置;返回脱敏条目 */
export async function saveConnectorConfig(
  input: SaveConnectorConfigInput,
): Promise<ApiResult<ConnectorEntry>> {
  return fetchApi<ConnectorEntry>('/api/connectors/config', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 同步连接器数据源,返回文档列表 */
export async function syncConnector(key: string): Promise<ApiResult<ConnectorSyncResult>> {
  return fetchApi<ConnectorSyncResult>('/api/connectors/sync', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
}

/** 拉取单篇文档正文 */
export async function fetchConnectorDoc(
  key: string,
  docId: string,
): Promise<ApiResult<ConnectorFetchResult>> {
  return fetchApi<ConnectorFetchResult>(`/api/connectors/${encodeURIComponent(key)}/fetch`, {
    method: 'POST',
    body: JSON.stringify({ doc_id: docId }),
  })
}

/** 启用/停用连接器 */
export async function setConnectorEnabled(
  key: string,
  enabled: boolean,
): Promise<ApiResult<ConnectorEntry>> {
  return fetchApi<ConnectorEntry>(
    `/api/connectors/${encodeURIComponent(key)}/${enabled ? 'enable' : 'disable'}`,
    { method: 'POST' },
  )
}

/** 删除连接器配置 */
export async function deleteConnector(key: string): Promise<ApiResult<ConnectorDeleteResult>> {
  return fetchApi<ConnectorDeleteResult>(`/api/connectors/${encodeURIComponent(key)}`, {
    method: 'DELETE',
  })
}
