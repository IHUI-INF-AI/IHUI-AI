// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D29 团队级知识引擎 API 客户端(G-35,2026-09-26 新增)
 *
 * 对应 apps/api /api/knowledge-team 路由(prefix 由 routes/index.ts 注册,
 * 路径合成对账见 apps/api/tests/knowledge-team-routes-registered.test.ts):
 * - listKnowledgeSpaces        GET    /spaces                  团队下的知识空间(?teamId=)
 * - createKnowledgeSpace       POST   /spaces                  建空间(团队 owner/admin)
 * - getKnowledgeSpace          GET    /spaces/:spaceId         空间详情(带 myRole)
 * - listKnowledgeSpaceMembers  GET    /spaces/:spaceId/members 空间成员与角色
 * - setKnowledgeSpaceMember    PUT    /spaces/:spaceId/members 授权/改角色/撤权(role=null)
 * - listKnowledgeSpaceItems    GET    /spaces/:spaceId/items   条目列表(kind/status/keyword 过滤)
 * - createKnowledgeSpaceItem   POST   /spaces/:spaceId/items   新建条目(editor+)
 * - listKnowledgeSpaceRevisions GET   /spaces/:spaceId/revisions 空间审计流
 * - getKnowledgeItem           GET    /items/:itemId           条目详情
 * - reviseKnowledgeItem        PUT    /items/:itemId           成员修正(expectedRevision 乐观并发)
 * - setKnowledgeItemStatus     POST   /items/:itemId/status    发布 / 归档(editor+)
 * - listKnowledgeItemRevisions GET    /items/:itemId/revisions 单条目版本流
 *
 * 类型与 apps/api/src/services/knowledge-team-service.ts 的 DTO 逐字段对齐;
 * 此处刻意本地声明(与 team-memory.ts 同形态)—— api-client 不依赖 @ihui/database。
 */

import { fetchApi } from '../client.js'

// =============================================================================
// 枚举与 DTO
// =============================================================================

/** 空间角色(偏序 owner > editor > viewer;与 TEAM_KNOWLEDGE_ROLES 同集) */
export type TeamKnowledgeRole = 'owner' | 'editor' | 'viewer'

/** 条目类型(与 TEAM_KNOWLEDGE_KINDS 同集) */
export type TeamKnowledgeKind = 'memory' | 'wiki' | 'card'

/** 条目状态(与 TEAM_KNOWLEDGE_STATUSES 同集) */
export type TeamKnowledgeStatus = 'draft' | 'published' | 'archived'

/** 审计动作(与 TEAM_KNOWLEDGE_ACTIONS 同集) */
export type TeamKnowledgeAction = 'create' | 'revise' | 'publish' | 'archive'

/** 改动前后的可比对摘要(不存正文本身,digest 为规范化正文 sha256 前 16 位) */
export interface KnowledgeContentSummary {
  title: string
  status: string
  length: number
  digest: string
}

/** 知识空间 DTO(读面必带 myRole,前端据此致灰按钮) */
export interface KnowledgeSpaceDTO {
  id: string
  teamId: string
  name: string
  settings: Record<string, unknown>
  visibility: string
  status: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
  myRole: TeamKnowledgeRole
}

/** 知识条目 DTO */
export interface KnowledgeItemDTO {
  id: string
  spaceId: string
  kind: TeamKnowledgeKind
  title: string
  content: Record<string, unknown>
  plainText: string
  tags: string[]
  status: TeamKnowledgeStatus
  revision: number
  sourceRef: Record<string, unknown> | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

/** 审计流 DTO */
export interface KnowledgeRevisionDTO {
  id: string
  itemId: string
  spaceId: string
  revisionNo: number
  action: TeamKnowledgeAction
  actorUserId: string | null
  actorRole: TeamKnowledgeRole | null
  beforeSummary: KnowledgeContentSummary | null
  afterSummary: KnowledgeContentSummary | null
  changeNote: string | null
  createdAt: string
}

/** 空间成员 DTO */
export interface KnowledgeSpaceMemberDTO {
  userId: string
  role: TeamKnowledgeRole
  grantedBy: string | null
  updatedAt: string
}

// =============================================================================
// 入参
// =============================================================================

export interface ListKnowledgeSpacesParams {
  teamId: string
  includeArchived?: boolean
}

export interface CreateKnowledgeSpaceInput {
  teamId: string
  name: string
  settings?: Record<string, unknown>
  visibility?: 'team' | 'restricted'
}

export interface SetKnowledgeSpaceMemberInput {
  userId: string
  /** null = 撤权;必填,漏传会被当成"撤销",服务端同样强制 */
  role: TeamKnowledgeRole | null
}

export interface ListKnowledgeSpaceItemsParams {
  kind?: TeamKnowledgeKind
  status?: TeamKnowledgeStatus
  keyword?: string
  limit?: number
  offset?: number
}

export interface CreateKnowledgeSpaceItemInput {
  kind: TeamKnowledgeKind
  title: string
  content: Record<string, unknown>
  plainText?: string
  tags?: string[]
  status?: TeamKnowledgeStatus
  sourceRef?: Record<string, unknown> | null
  changeNote?: string
}

export interface ReviseKnowledgeItemInput {
  title?: string
  content?: Record<string, unknown>
  plainText?: string
  tags?: string[]
  changeNote?: string
  /** 乐观并发:调用方持有的版本号,服务端不一致时 409 REVISION_CONFLICT */
  expectedRevision: number
}

export interface SetKnowledgeItemStatusInput {
  status: TeamKnowledgeStatus
  changeNote?: string
}

export interface ListKnowledgeRevisionsParams {
  action?: TeamKnowledgeAction
  limit?: number
}

// =============================================================================
// 空间
// =============================================================================

/** 列出团队下的知识空间(仅返回调用人有生效角色的空间) */
export async function listKnowledgeSpaces(
  params: ListKnowledgeSpacesParams,
): Promise<KnowledgeSpaceDTO[]> {
  const qs = new URLSearchParams()
  qs.set('teamId', params.teamId)
  if (params.includeArchived) qs.set('includeArchived', 'true')
  const res = await fetchApi<KnowledgeSpaceDTO[]>(`/api/knowledge-team/spaces?${qs.toString()}`)
  if (!res.success) throw new Error(res.error || '查询知识空间失败')
  return res.data
}

/** 创建知识空间(要求团队 owner/admin) */
export async function createKnowledgeSpace(
  input: CreateKnowledgeSpaceInput,
): Promise<KnowledgeSpaceDTO> {
  const res = await fetchApi<KnowledgeSpaceDTO>('/api/knowledge-team/spaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '创建知识空间失败')
  return res.data
}

/** 空间详情(带调用人的 myRole) */
export async function getKnowledgeSpace(spaceId: string): Promise<KnowledgeSpaceDTO> {
  const res = await fetchApi<KnowledgeSpaceDTO>(
    `/api/knowledge-team/spaces/${encodeURIComponent(spaceId)}`,
  )
  if (!res.success) throw new Error(res.error || '查询知识空间失败')
  return res.data
}

// =============================================================================
// 成员与角色
// =============================================================================

/** 空间成员与角色列表 */
export async function listKnowledgeSpaceMembers(
  spaceId: string,
): Promise<KnowledgeSpaceMemberDTO[]> {
  const res = await fetchApi<KnowledgeSpaceMemberDTO[]>(
    `/api/knowledge-team/spaces/${encodeURIComponent(spaceId)}/members`,
  )
  if (!res.success) throw new Error(res.error || '查询空间成员失败')
  return res.data
}

/** 授权 / 改角色 / 撤权(role=null),要求调用人是空间 owner */
export async function setKnowledgeSpaceMember(
  spaceId: string,
  input: SetKnowledgeSpaceMemberInput,
): Promise<{ spaceId: string; userId: string; role: TeamKnowledgeRole | null }> {
  const res = await fetchApi<{ spaceId: string; userId: string; role: TeamKnowledgeRole | null }>(
    `/api/knowledge-team/spaces/${encodeURIComponent(spaceId)}/members`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error || '变更空间成员失败')
  return res.data
}

// =============================================================================
// 条目
// =============================================================================

/** 空间条目列表(kind/status/keyword 过滤) */
export async function listKnowledgeSpaceItems(
  spaceId: string,
  params: ListKnowledgeSpaceItemsParams = {},
): Promise<KnowledgeItemDTO[]> {
  const qs = new URLSearchParams()
  if (params.kind) qs.set('kind', params.kind)
  if (params.status) qs.set('status', params.status)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  if (params.offset !== undefined) qs.set('offset', String(params.offset))
  const res = await fetchApi<KnowledgeItemDTO[]>(
    `/api/knowledge-team/spaces/${encodeURIComponent(spaceId)}/items?${qs.toString()}`,
  )
  if (!res.success) throw new Error(res.error || '查询知识条目失败')
  return res.data
}

/** 新建条目(editor+),落库同事务写 create 审计 */
export async function createKnowledgeSpaceItem(
  spaceId: string,
  input: CreateKnowledgeSpaceItemInput,
): Promise<KnowledgeItemDTO> {
  const res = await fetchApi<KnowledgeItemDTO>(
    `/api/knowledge-team/spaces/${encodeURIComponent(spaceId)}/items`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error || '创建知识条目失败')
  return res.data
}

/** 条目详情 */
export async function getKnowledgeItem(itemId: string): Promise<KnowledgeItemDTO> {
  const res = await fetchApi<KnowledgeItemDTO>(
    `/api/knowledge-team/items/${encodeURIComponent(itemId)}`,
  )
  if (!res.success) throw new Error(res.error || '查询知识条目失败')
  return res.data
}

/** 成员修正(editor+,带 expectedRevision 乐观并发) */
export async function reviseKnowledgeItem(
  itemId: string,
  input: ReviseKnowledgeItemInput,
): Promise<KnowledgeItemDTO> {
  const res = await fetchApi<KnowledgeItemDTO>(
    `/api/knowledge-team/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error || '修正知识条目失败')
  return res.data
}

/** 发布 / 归档(editor+) */
export async function setKnowledgeItemStatus(
  itemId: string,
  input: SetKnowledgeItemStatusInput,
): Promise<KnowledgeItemDTO> {
  const res = await fetchApi<KnowledgeItemDTO>(
    `/api/knowledge-team/items/${encodeURIComponent(itemId)}/status`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error || '变更条目状态失败')
  return res.data
}

// =============================================================================
// 审计流
// =============================================================================

/** 空间审计流(按时间倒序) */
export async function listKnowledgeSpaceRevisions(
  spaceId: string,
  params: ListKnowledgeRevisionsParams = {},
): Promise<KnowledgeRevisionDTO[]> {
  const qs = new URLSearchParams()
  if (params.action) qs.set('action', params.action)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const res = await fetchApi<KnowledgeRevisionDTO[]>(
    `/api/knowledge-team/spaces/${encodeURIComponent(spaceId)}/revisions?${qs.toString()}`,
  )
  if (!res.success) throw new Error(res.error || '查询空间审计流失败')
  return res.data
}

/** 单条目版本流(按版本序) */
export async function listKnowledgeItemRevisions(
  itemId: string,
  params: ListKnowledgeRevisionsParams = {},
): Promise<KnowledgeRevisionDTO[]> {
  const qs = new URLSearchParams()
  if (params.action) qs.set('action', params.action)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const res = await fetchApi<KnowledgeRevisionDTO[]>(
    `/api/knowledge-team/items/${encodeURIComponent(itemId)}/revisions?${qs.toString()}`,
  )
  if (!res.success) throw new Error(res.error || '查询条目版本历史失败')
  return res.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
