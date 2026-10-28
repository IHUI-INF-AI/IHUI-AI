// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D179 会话/新对话 Issue 绑定流(2026-09-30 用户拍板立项)—— 出口三件套。
 *
 * 竞品口径:searchIssues「搜索 Issue 标识、标题或项目」/ bindIssue「绑定 Issue」/
 * unbindIssue「改为独立任务」。绑定只落会话业务元数据(chat_conversations.metadata.
 * issueBinding),读取随既有会话查询带出(ConversationDetail.metadata),本文件不设独立 GET。
 */
import { fetchApi } from '../client.js'

/** 会话绑定的 Issue 元数据(chat_conversations.metadata.issueBinding,服务端盖章 boundAt) */
export interface IssueBinding {
  provider: 'github' | 'linear'
  id: string
  title: string
  url: string
  /** 绑定时刻(ISO 8601) */
  boundAt: string
}

/** MCP Issue 搜索条目(ai-service /api/agent/issues/search 规范化输出,上限 20 条) */
export interface IssueSearchItem {
  id: string
  title: string
  url: string
  provider: 'github' | 'linear'
}

export interface IssueSearchData {
  provider: 'github' | 'linear'
  /** 命中的 MCP Server 注册名;null = 该 provider 未配置(configured:false) */
  serverName: string | null
  configured: boolean
  /** 已配置但调用失败时的原因(未配置/成功为 null) */
  error: string | null
  items: IssueSearchItem[]
}

export type IssueProvider = 'github' | 'linear'

/** D179(竞品 searchIssues):按 provider 搜 Issue,经 ai-service 既有 mcp_client 通道 */
export function searchIssues(input: { provider: IssueProvider; query: string }) {
  return fetchApi<IssueSearchData>('/api/chat/issues/search', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** D179(竞品 bindIssue):给会话绑定/换绑 Issue(POST,覆盖旧绑定) */
export function bindIssue(conversationId: string, input: Omit<IssueBinding, 'boundAt'>) {
  return fetchApi<{ issueBinding: IssueBinding }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/issue`,
    { method: 'POST', body: JSON.stringify(input) },
  )
}

/** D179(竞品 unbindIssue):解绑 = 清空绑定(「改为独立任务」) */
export function unbindIssue(conversationId: string) {
  return fetchApi<{ unbound: boolean }>(
    `/api/chat/conversations/${encodeURIComponent(conversationId)}/issue`,
    { method: 'DELETE' },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
