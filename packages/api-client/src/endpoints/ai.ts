/**
 * AI 相关 API
 * 合并迁移自旧架构：ai-bot-sites, ai-career, ai-chat-types, ai-community,
 * ai-education, ai-feed, ai-index, ai-models, ai-proxy, ai-team, ai-world,
 * aiChat, aiModelInfo, aigc
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

// ===================== 类型定义 =====================

export interface AiModel {
  id: string
  name: string
  provider: string
  description?: string
  avatar?: string
  type?: string
  status?: number
  sort?: number
  [key: string]: unknown
}

export interface AiModelInfo {
  id: string
  name: string
  url: string
  description?: string
  type?: string
  status?: number
  [key: string]: unknown
}

export interface AiBotSite {
  id: string
  name: string
  url: string
  description?: string
  logo?: string
  category?: string
  [key: string]: unknown
}

export interface AiCareerItem {
  id: string
  title: string
  description?: string
  content?: string
  cover?: string
  [key: string]: unknown
}

export interface AiChatType {
  id: string
  name: string
  description?: string
  icon?: string
  sort?: number
  [key: string]: unknown
}

export interface AiFeedItem {
  id: string
  title: string
  content?: string
  cover?: string
  authorId?: string
  authorName?: string
  publishTime?: string
  [key: string]: unknown
}

export interface AiWorldItem {
  id: string
  name: string
  description?: string
  cover?: string
  url?: string
  [key: string]: unknown
}

export interface AiTeamItem {
  id: string
  name: string
  description?: string
  avatar?: string
  memberCount?: number
  [key: string]: unknown
}

export interface AiCommunityItem {
  id: string
  title: string
  content?: string
  authorId?: string
  authorName?: string
  createdAt?: string
  [key: string]: unknown
}

export interface AiEducationItem {
  id: string
  title: string
  description?: string
  cover?: string
  content?: string
  [key: string]: unknown
}

export interface AiProxyParams {
  model?: string
  messages?: Array<{ role: string; content: unknown }>
  prompt?: string
  url?: string
  [key: string]: unknown
}

export interface AigcTask {
  taskId: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  result?: unknown
  error?: string
  createdAt?: string
  updatedAt?: string
}

export interface PageQuery {
  page?: number
  pageSize?: number
  [key: string]: string | number | undefined | null
}

// ===================== ai-models =====================

/** 获取 AI 模型列表 */
export async function getAiModels(query: PageQuery = {}): Promise<ApiResult<PageData<AiModel>>> {
  return fetchApi<PageData<AiModel>>(`/api/ai/models${buildQs(query)}`)
}

/** 获取 AI 模型详情 */
export async function getAiModelDetail(id: string): Promise<ApiResult<AiModel>> {
  return fetchApi<AiModel>(`/api/ai/models/${id}`)
}

/** 创建 AI 模型 */
export async function createAiModel(input: Partial<AiModel>): Promise<ApiResult<AiModel>> {
  return fetchApi<AiModel>('/api/ai/models', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 AI 模型 */
export async function updateAiModel(
  id: string,
  input: Partial<AiModel>,
): Promise<ApiResult<AiModel>> {
  return fetchApi<AiModel>(`/api/ai/models/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 AI 模型 */
export async function deleteAiModel(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai/models/${id}`, { method: 'DELETE' })
}

// ===================== aiModelInfo =====================

/** 获取 AI 模型信息列表 */
export async function getAiModelInfoList(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AiModelInfo>>> {
  return fetchApi<PageData<AiModelInfo>>(`/api/ai-ext/model-info/list${buildQs(query)}`)
}

/** 获取 AI 模型信息详情 */
export async function getAiModelInfoDetail(id: string): Promise<ApiResult<AiModelInfo>> {
  return fetchApi<AiModelInfo>(`/api/ai-ext/model-info/${id}`)
}

/** 创建 AI 模型信息 */
export async function createAiModelInfo(
  input: Partial<AiModelInfo>,
): Promise<ApiResult<AiModelInfo>> {
  return fetchApi<AiModelInfo>('/api/ai-ext/model-info', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 AI 模型信息 */
export async function updateAiModelInfo(
  id: string,
  input: Partial<AiModelInfo>,
): Promise<ApiResult<AiModelInfo>> {
  return fetchApi<AiModelInfo>(`/api/ai-ext/model-info/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 AI 模型信息 */
export async function deleteAiModelInfo(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai-ext/model-info/${id}`, { method: 'DELETE' })
}

// ===================== ai-bot-sites =====================

/** 获取 AI 站点列表 */
export async function getAiBotSites(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AiBotSite>>> {
  return fetchApi<PageData<AiBotSite>>(`/api/system-ext/bot-sites/list${buildQs(query)}`)
}

/** 获取 AI 站点详情 */
export async function getAiBotSiteDetail(id: string): Promise<ApiResult<AiBotSite>> {
  return fetchApi<AiBotSite>(`/api/system-ext/bot-sites/${id}`)
}

/** 创建 AI 站点 */
export async function createAiBotSite(input: Partial<AiBotSite>): Promise<ApiResult<AiBotSite>> {
  return fetchApi<AiBotSite>('/api/system-ext/bot-sites', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 AI 站点 */
export async function updateAiBotSite(
  id: string,
  input: Partial<AiBotSite>,
): Promise<ApiResult<AiBotSite>> {
  return fetchApi<AiBotSite>(`/api/system-ext/bot-sites/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 AI 站点 */
export async function deleteAiBotSite(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/system-ext/bot-sites/${id}`, { method: 'DELETE' })
}

// ===================== ai-career =====================

/** 获取 AI 职业列表 */
export async function getAiCareers(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AiCareerItem>>> {
  return fetchApi<PageData<AiCareerItem>>(`/api/ai/careers${buildQs(query)}`)
}

/** 获取 AI 职业详情 */
export async function getAiCareerDetail(id: string): Promise<ApiResult<AiCareerItem>> {
  return fetchApi<AiCareerItem>(`/api/ai/careers/${id}`)
}

// ===================== ai-chat-types =====================

/** 获取 AI 聊天类型列表 */
export async function getAiChatTypes(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AiChatType>>> {
  return fetchApi<PageData<AiChatType>>(`/api/ai/chat-types${buildQs(query)}`)
}

/** 创建 AI 聊天类型 */
export async function createAiChatType(input: Partial<AiChatType>): Promise<ApiResult<AiChatType>> {
  return fetchApi<AiChatType>('/api/ai/chat-types', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 AI 聊天类型 */
export async function updateAiChatType(
  id: string,
  input: Partial<AiChatType>,
): Promise<ApiResult<AiChatType>> {
  return fetchApi<AiChatType>(`/api/ai/chat-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 AI 聊天类型 */
export async function deleteAiChatType(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai/chat-types/${id}`, { method: 'DELETE' })
}

// ===================== ai-community =====================

/** 获取 AI 社区列表 */
export async function getAiCommunities(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AiCommunityItem>>> {
  return fetchApi<PageData<AiCommunityItem>>(`/api/ai/community${buildQs(query)}`)
}

/** 获取 AI 社区详情 */
export async function getAiCommunityDetail(id: string): Promise<ApiResult<AiCommunityItem>> {
  return fetchApi<AiCommunityItem>(`/api/ai/community/${id}`)
}

/** 创建 AI 社区帖子 */
export async function createAiCommunity(
  input: Partial<AiCommunityItem>,
): Promise<ApiResult<AiCommunityItem>> {
  return fetchApi<AiCommunityItem>('/api/ai/community', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

// ===================== ai-education =====================

/** 获取 AI 教育列表 */
export async function getAiEducations(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AiEducationItem>>> {
  return fetchApi<PageData<AiEducationItem>>(`/api/ai-education${buildQs(query)}`)
}

/** 获取 AI 教育详情 */
export async function getAiEducationDetail(id: string): Promise<ApiResult<AiEducationItem>> {
  return fetchApi<AiEducationItem>(`/api/ai-education/${id}`)
}

// ===================== ai-feed =====================

/** 获取 AI Feed 列表 */
export async function getAiFeeds(query: PageQuery = {}): Promise<ApiResult<PageData<AiFeedItem>>> {
  return fetchApi<PageData<AiFeedItem>>(`/api/ai-feed${buildQs(query)}`)
}

/** 获取 AI Feed 详情 */
export async function getAiFeedDetail(id: string): Promise<ApiResult<AiFeedItem>> {
  return fetchApi<AiFeedItem>(`/api/ai-feed/${id}`)
}

// ===================== ai-index =====================

/** 获取 AI 首页数据 */
export async function getAiIndex(): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/ai/index')
}

// ===================== ai-world =====================

/** 获取 AI 世界列表 */
export async function getAiWorlds(
  query: PageQuery = {},
): Promise<ApiResult<PageData<AiWorldItem>>> {
  return fetchApi<PageData<AiWorldItem>>(`/api/ai-world${buildQs(query)}`)
}

/** 获取 AI 世界详情 */
export async function getAiWorldDetail(id: string): Promise<ApiResult<AiWorldItem>> {
  return fetchApi<AiWorldItem>(`/api/ai-world/${id}`)
}

// ===================== ai-team =====================

/** 获取 AI 团队列表 */
export async function getAiTeams(query: PageQuery = {}): Promise<ApiResult<PageData<AiTeamItem>>> {
  return fetchApi<PageData<AiTeamItem>>(`/api/ai/team${buildQs(query)}`)
}

/** 获取 AI 团队详情 */
export async function getAiTeamDetail(id: string): Promise<ApiResult<AiTeamItem>> {
  return fetchApi<AiTeamItem>(`/api/ai/team/${id}`)
}

/** 创建 AI 团队 */
export async function createAiTeam(input: Partial<AiTeamItem>): Promise<ApiResult<AiTeamItem>> {
  return fetchApi<AiTeamItem>('/api/ai/team', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 更新 AI 团队 */
export async function updateAiTeam(
  id: string,
  input: Partial<AiTeamItem>,
): Promise<ApiResult<AiTeamItem>> {
  return fetchApi<AiTeamItem>(`/api/ai/team/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

/** 删除 AI 团队 */
export async function deleteAiTeam(id: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai/team/${id}`, { method: 'DELETE' })
}

// ===================== ai-proxy =====================

/** AI 代理请求（通用 POST*/
export async function aiProxy(url: string, params: AiProxyParams): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>(url, {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ===================== aiChat =====================

/** 发AI 聊天消息 */
export async function sendAiChat(input: {
  message: string
  model?: string
  conversationId?: string
  [key: string]: unknown
}): Promise<ApiResult<unknown>> {
  return fetchApi<unknown>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取 AI 聊天历史记录 */
export async function getAiChatHistory(
  conversationId: string,
  query: PageQuery = {},
): Promise<ApiResult<PageData<unknown>>> {
  return fetchApi<PageData<unknown>>(`/api/ai/history${buildQs({ ...query, conversationId })}`)
}

/** 创建 AI 会话 */
export async function createAiConversation(input: {
  title?: string
  model?: string
  [key: string]: unknown
}): Promise<ApiResult<{ conversationId: string }>> {
  return fetchApi<{ conversationId: string }>('/api/ai/chat/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 获取 AI 会话列表 */
export async function getAiConversations(
  query: PageQuery = {},
): Promise<ApiResult<PageData<unknown>>> {
  return fetchApi<PageData<unknown>>(`/api/ai/chat/conversations${buildQs(query)}`)
}

/** 删除 AI 会话 */
export async function deleteAiConversation(
  conversationId: string,
): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai/chat/conversations/${conversationId}`, {
    method: 'DELETE',
  })
}

// ===================== aigc =====================

/** 创建 AIGC 任务 */
export async function createAigcTask(input: {
  type: string
  prompt: string
  model?: string
  params?: Record<string, unknown>
  [key: string]: unknown
}): Promise<ApiResult<AigcTask>> {
  return fetchApi<AigcTask>('/api/ai/aigc/records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** 查询 AIGC 任务状*/
export async function getAigcTask(taskId: string): Promise<ApiResult<AigcTask>> {
  return fetchApi<AigcTask>(`/api/ai/aigc/records/${taskId}`)
}

/** 获取 AIGC 任务列表 */
export async function getAigcTasks(query: PageQuery = {}): Promise<ApiResult<PageData<AigcTask>>> {
  return fetchApi<PageData<AigcTask>>(`/api/ai/aigc/records${buildQs(query)}`)
}

/** 取消 AIGC 任务 */
// 后端缺失
export async function cancelAigcTask(taskId: string): Promise<ApiResult<{ success: boolean }>> {
  return fetchApi<{ success: boolean }>(`/api/ai/aigc/tasks/${taskId}/cancel`, { method: 'POST' })
}

// ===================== ai-career-advice =====================

export interface CareerAdviceInput {
  school: string
  classLevel: string
  scoreRange: string
  languageDifficulty: string
  scienceCharacteristics: string
  learningObstacle: string
  hobbies: string
  target: string
}

export interface CareerAdviceResult {
  content: string
}

export async function getCareerAdvice(
  input: CareerAdviceInput,
): Promise<ApiResult<CareerAdviceResult>> {
  return fetchApi<CareerAdviceResult>('/api/ai/career-advice', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
