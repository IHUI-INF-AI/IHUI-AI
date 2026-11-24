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
  /** 该操作独立基址(台账 base_url_override);空串用连接器 spec 基址 */
  base_url?: string
  query: Record<string, unknown>
  body: Record<string, unknown> | null
  response_path: string
  confirm: boolean
  /** 是否默认停用(台账生成的写操作默认 true,需显式 opt-in) */
  disabled?: boolean
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
  /** public | platform_env | tenant | ''(手动配置) */
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
  /** 台账展开平台;填写后按 api_ids/domains 从目录重新生成 operations(会覆盖直传 operations) */
  platform?: string
  /** 展开指定的台账 API id */
  api_ids?: string[]
  /** 展开指定业务域 */
  domains?: string[]
}

/** 平台托管可用性(缺失项只给环境变量名) */
export interface ConnectorManagedStatus {
  available: boolean
  supported: boolean
  credential_source: 'platform_env' | 'public' | 'tenant' | ''
  missing: string[]
  reason: string
  /** 是否处于多企业 SaaS 模式(平台应用凭据按租户归属) */
  multi_tenant?: boolean
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

// ===================== 平台目录覆盖(coverage) =====================

/** 覆盖目录支持的平台标识(冻结契约枚举) */
export type CoveragePlatform = 'feishu' | 'dingtalk' | 'wecom'

/** 能力探测状态枚举(与后端冻结契约逐字对齐,不得增删) */
export type CoverageState =
  | 'unprobed'
  | 'available'
  | 'permission_denied'
  | 'need_user_token'
  | 'need_admin'
  | 'unsupported'
  | 'error'
  | 'unjudged'

/** 目录台账来源信息 */
export interface CoverageSource {
  index_url: string
  fetched_at: string
  declared_total: number
  enumeration_method: string
}

/** 各状态分桶计数(全局 totals 与分域计数共用同一组键) */
export interface CoverageStateCounts {
  available: number
  permission_denied: number
  need_user_token: number
  need_admin: number
  unsupported: number
  error: number
  unprobed: number
}

/** 全局汇总计数 */
export interface CoverageTotals extends CoverageStateCounts {
  apis: number
  domains: number
}

/** 单个业务域的目录条目 */
export interface CoverageDomain extends CoverageStateCounts {
  key: string
  label: string
  count: number
  complete: boolean
  /** 域级备注/未展开原因(台账自带,可空) */
  reason?: string
}

/** 单条 API 的探测结果状态 */
export interface CoverageApiStatus {
  state: CoverageState
  http_code: number | null
  platform_code: string | null
  reason: string
  missing_scope: string
  probed_at: string | null
}

/** 目录中的单条 API(事件条目复用同一视图) */
export interface CoverageApi {
  id: string
  domain: string
  name: string
  method: string
  path: string
  auth: string
  scope: string
  read: boolean
  event: boolean
  doc_url: string
  /** 操作独立基址覆盖(台账 base_url_override),可空 */
  base_url_override?: string
  /** 台账是否已核验该条目,可空 */
  verified?: boolean
  status: CoverageApiStatus
}

/** 未展开业务域(台账枚举时遗留、未进入 apis 清单的域) */
export interface CoverageUnenumeratedDomain {
  key: string
  label: string
  reason: string
}

/** 事件/回调条目汇总(不计入 totals.apis) */
export interface CoverageEventsView {
  count: number
  items: CoverageApi[]
}

/** 平台目录覆盖响应 */
export interface CoverageCatalog {
  platform: CoveragePlatform
  label: string
  catalog_state: 'ok' | 'unjudged'
  source: CoverageSource
  totals: CoverageTotals
  domains: CoverageDomain[]
  apis: CoverageApi[]
  /** 事件/回调条目,单独计数,不计入 totals.apis */
  events: CoverageEventsView
  /** 台账遗留、未展开进 apis 的业务域 */
  unenumerated_domains: CoverageUnenumeratedDomain[]
  /** 台账未判定原因(catalog_state=unjudged 时给出) */
  unjudged_reason: string
}

/** 探测请求体 */
export interface CoverageProbeRequest {
  api_ids: string[]
  domains: string[]
  limit: number
  read_only: boolean
}

/** 单条探测结果 */
export interface CoverageProbeItem {
  api_id: string
  state: CoverageState
  http_code: number | null
  platform_code: string | null
  reason: string
  missing_scope: string
}

/** 探测响应 */
export interface CoverageProbeResponse {
  probed: number
  skipped: number
  summary: Record<string, unknown>
  results: CoverageProbeItem[]
}

/** 分片规划请求体 */
export interface CoveragePlanRequest {
  platform: CoveragePlatform
  domains: string[]
  api_ids: string[]
}

/** 规划出的单个分片连接器 */
export interface CoveragePlanConnector {
  key: string
  label: string
  domain: string
  api_ids: string[]
  /** 片内操作条数(计数) */
  operations: number
  /** 可直接落库的完整操作定义;长度与 operations 计数一致 */
  operation_defs: ConnectorOperation[]
}

/** 分片规划响应 */
export interface CoveragePlanResponse {
  platform: string
  selected: number
  connectors: CoveragePlanConnector[]
  dropped: number
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

/** 获取平台 API 目录与能力探测覆盖状态 */
export async function getConnectorCoverage(
  platform: CoveragePlatform,
): Promise<ApiResult<CoverageCatalog>> {
  return fetchApi<CoverageCatalog>('/api/connectors/coverage', { params: { platform } })
}

/** 对目录中的 API 发起探测(默认只读),返回逐条状态用于就地回填 */
export async function probeConnectorCoverage(
  key: string,
  input: CoverageProbeRequest,
): Promise<ApiResult<CoverageProbeResponse>> {
  return fetchApi<CoverageProbeResponse>(`/api/connectors/${encodeURIComponent(key)}/probe`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 按域 / 按 API 规划分片连接器清单(每片 ≤200 操作) */
export async function getConnectorCoveragePlan(
  key: string,
  input: CoveragePlanRequest,
): Promise<ApiResult<CoveragePlanResponse>> {
  return fetchApi<CoveragePlanResponse>(
    `/api/connectors/${encodeURIComponent(key)}/coverage/plan`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
