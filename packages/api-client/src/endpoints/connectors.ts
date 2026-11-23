// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中文连接器端点(2026-09-02 立,P2-2 中文 Connectors;2026-11-23 扩通用接入)
 * 对应 ai-service 8803 的 /api/connectors 外部生态接口:
 *  - GET    /api/connectors                     → 全部连接器配置列表(脱敏)
 *  - GET    /api/connectors/catalog             → 平台模板 + 操作目录
 *  - POST   /api/connectors/openapi/preview     → OpenAPI 文档 → 操作清单
 *  - POST   /api/connectors/config              → 新增/覆盖配置(app_secret 空串=保留旧值)
 *  - POST   /api/connectors/sync                → 同步数据源,返回条目列表
 *  - POST   /api/connectors/{key}/fetch         → 拉取单条正文
 *  - POST   /api/connectors/{key}/invoke        → 执行声明式操作(list/search/fetch/action)
 *  - POST   /api/connectors/{key}/enable|disable → 启停
 *  - DELETE /api/connectors/{key}               → 删除配置
 *
 * 注意:后端绝不返回 app_id/app_secret 明文,前端只通过 configured 判断是否已配置。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

// ===================== 类型定义 =====================

/** 旧四类(文档同步)+ 公众号 + 自定义 HTTP */
export type ConnectorType = 'yuque' | 'feishu' | 'wecom' | 'dingtalk' | 'wechat_mp' | 'custom'

/** 能力位:列表 / 搜索 / 拉单条 / 写操作 */
export type ConnectorCapability = 'list' | 'search' | 'fetch' | 'action'

/** 鉴权方式(平台 token 由后端用 app_id/app_secret 换取) */
export type ConnectorAuthKind =
  | 'none'
  | 'bearer'
  | 'header'
  | 'basic'
  | 'query'
  | 'feishu_tenant'
  | 'wecom_corp'
  | 'dingtalk'
  | 'wechat_mp'

/** 一条声明式操作定义 */
export interface ConnectorOperation {
  id: string
  name: string
  capability: ConnectorCapability
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query: Record<string, unknown>
  body: Record<string, unknown> | null
  response_path: string
  confirm: boolean
  description: string
}

/** 传输配置(请求头值不回传,只回传"哪些已配置") */
export interface ConnectorSpec {
  base_url: string
  auth_kind: ConnectorAuthKind
  auth_name: string
  auth_scheme: string
  headers: Record<string, string>
  headers_configured?: string[]
  timeout_s: number
  allow_write: boolean
  allow_private_hosts: boolean
}

/** 连接器能力位(旧字段保留,兼容文档同步) */
export interface ConnectorCapabilities {
  doc_list: boolean
  fetch_doc: boolean
}

/** 同步得到的条目 */
export interface ConnectorSyncItem {
  doc_id: string
  title: string
}

/** 连接器条目(脱敏:无 app_id/app_secret 明文) */
export interface ConnectorEntry {
  /** 唯一标识,格式 {type}:{slug} */
  key: string
  /** 类型 */
  type: string
  /** 展示名 */
  name: string
  /** 类型专属配置(键->是否已配置,兼容旧契约) */
  extra: Record<string, boolean>
  /** 非凭据类 extra 原值(编辑回填用,修复 user/repo 回填) */
  extra_fields?: Record<string, string>
  /** 是否已配置 */
  configured: boolean
  /** 是否平台托管(凭据由部署环境提供,用户不填) */
  managed?: boolean
  /** public | platform_env | ''(手动配置) */
  credential_source?: string
  /** 是否启用 */
  enabled: boolean
  /** preset | custom */
  mode: 'preset' | 'custom'
  /** 传输配置(脱敏) */
  spec: ConnectorSpec | null
  /** 声明式操作清单 */
  operations: ConnectorOperation[]
  operation_count: number
  /** 能力位布尔表(由操作清单推导) */
  operation_capabilities: Record<ConnectorCapability, boolean>
  installed_at: string
  updated_at: string
  last_sync_at: string
  /** 最近一次同步/操作错误信息(空=正常) */
  last_error: string
  /** 最近一次同步拉到的条目 */
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
  /** 开放平台 app_id(飞书/企微/钉钉/公众号) */
  app_id: string
  /** 密钥(空串时保留旧值,防止回显覆盖) */
  app_secret: string
  /** 类型专属配置(语雀 user/repo、企微/钉钉 space_id 等) */
  extra: Record<string, string>
  /** preset(预置平台)| custom(自定义 HTTP) */
  mode?: 'preset' | 'custom'
  /** 平台托管凭据(不填 app_id/app_secret;编辑托管连接器时保留) */
  managed?: boolean
  /** 传输配置(自定义接入/覆盖平台默认) */
  spec?: Partial<ConnectorSpec>
  /** 声明式操作清单(空=用平台模板默认) */
  operations?: ConnectorOperation[]
}

/** 平台托管可用性(缺失项只给环境变量名) */
export interface ConnectorManagedStatus {
  available: boolean
  supported: boolean
  credential_source: 'platform_env' | 'public' | ''
  missing: string[]
  reason: string
}

/** 模板目录条目 */
export interface ConnectorCatalogItem {
  type: string
  label: string
  base_url: string
  auth_kind: ConnectorAuthKind
  auth_name: string
  description: string
  operations: ConnectorOperation[]
  /** 平台托管状态(2026-11-23) */
  managed?: ConnectorManagedStatus
}

/** 不支持接入的渠道(带原因) */
export interface ConnectorUnsupportedItem {
  type: string
  label: string
  reason: string
}

/** 模板目录响应 */
export interface ConnectorCatalogResponse {
  version: string
  templates: ConnectorCatalogItem[]
  unsupported: ConnectorUnsupportedItem[]
  capabilities: ConnectorCapability[]
}

/** OpenAPI 导入预览响应 */
export interface OpenApiPreviewResult {
  base_url: string
  title: string
  version: string
  operation_count: number
  operations: ConnectorOperation[]
}

/** 通用操作调用响应 */
export interface ConnectorInvokeResult {
  ok: boolean
  status: number
  capability: ConnectorCapability
  operation_id: string
  message: string
  truncated: boolean
  data: unknown
  content?: string
  items?: ConnectorSyncItem[]
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

/** 连通性自检响应 */
export interface ConnectorCheckResult {
  ok: boolean
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

/** 获取平台模板目录(操作清单,不含凭据) */
export async function getConnectorCatalog(): Promise<ApiResult<ConnectorCatalogResponse>> {
  return fetchApi<ConnectorCatalogResponse>('/api/connectors/catalog')
}

/** 解析 OpenAPI/Swagger 文档为操作清单(不落盘) */
export async function previewOpenApi(input: {
  raw?: string
  spec?: Record<string, unknown>
  base_url?: string
}): Promise<ApiResult<OpenApiPreviewResult>> {
  return fetchApi<OpenApiPreviewResult>('/api/connectors/openapi/preview', {
    method: 'POST',
    body: JSON.stringify(input),
  })
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

/** 一键接入平台托管连接器(用户不填凭据) */
export async function connectManagedConnector(
  type: string,
  name = '',
): Promise<ApiResult<ConnectorEntry>> {
  return fetchApi<ConnectorEntry>('/api/connectors/managed/connect', {
    method: 'POST',
    body: JSON.stringify({ type, name }),
  })
}

/** 同步连接器数据源,返回条目列表 */
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

/** 执行一条声明式操作(写操作必须 confirm=true 且连接器开启 allow_write) */
export async function invokeConnectorOperation(
  key: string,
  operationId: string,
  params: Record<string, unknown> = {},
  confirm = false,
): Promise<ApiResult<ConnectorInvokeResult>> {
  return fetchApi<ConnectorInvokeResult>(`/api/connectors/${encodeURIComponent(key)}/invoke`, {
    method: 'POST',
    body: JSON.stringify({ operation_id: operationId, params, confirm }),
  })
}

/** 连通性自检:平台换 token / 自定义出站地址校验 */
export async function checkConnector(key: string): Promise<ApiResult<ConnectorCheckResult>> {
  return fetchApi<ConnectorCheckResult>(`/api/connectors/${encodeURIComponent(key)}/check`, {
    method: 'POST',
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
