// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D193 决策收件箱(2026-09-30 立)—— @ihui/api-client 跨流类型存根。
 *
 * `listPendingDecisions`(只读"待我决策"查询)的真实实现落在 api-client 流,
 * 尚未入库;此处用**模块扩充**(module augmentation,非覆盖)补齐端内消费
 * (SidebarUserRow 装车链)所需的类型,避免 TS2305 阻塞 web 流自洽。
 * api-client 流落地后若签名一致,本文件可整体删除。
 */
import '@ihui/api-client'

declare module '@ihui/api-client' {
  /** 待我决策条目(服务端只读记录) */
  export interface PendingDecisionRecord {
    id: string
    /** 所属会话线程;null 表示无法跳会话(仍可开面板) */
    threadId: string | null
    /** tool_approval / elicitation 等 */
    type: string
    /** 人读摘要;空串时界面落类型标签 */
    summary: string
    /** ISO 时间;null 表示服务端未落时间 */
    createdAt: string | null
  }

  /** 分页信封(与既有列表端点同形) */
  export interface PendingDecisionsPage {
    success: boolean
    data: { items: PendingDecisionRecord[]; total: number }
  }

  /** D193:待我决策收件箱(只读,不写任何状态) */
  export function listPendingDecisions(): Promise<PendingDecisionsPage>

  // ── D179 会话 Issue 绑定流(2026-09-30):api-client 流尚未入库的类型存根 ──

  /** Issue 来源平台 */
  export type IssueProvider = 'github' | 'linear'

  /** 会话业务元数据里的 Issue 绑定(chat_conversations.metadata.issueBinding) */
  export interface IssueBinding {
    provider: IssueProvider
    id: string
    title: string
    url: string
    /** 绑定时间 ISO;服务端未落时空串 */
    boundAt: string
  }

  /** Issue 搜索结果条目 */
  export interface IssueSearchItem {
    provider: IssueProvider
    id: string
    title: string
    url: string
  }

  /** Issue 搜索结果集 */
  export interface IssueSearchData {
    items: IssueSearchItem[]
    /** 来源平台是否已在服务端配置凭证(未配置 → 前端落 issueNotConfigured 空态) */
    configured: boolean
  }

  /** 搜索 GitHub/Linear Issue(只读) */
  export function searchIssues(params: {
    provider: IssueProvider
    query: string
  }): Promise<{ success: boolean; data: IssueSearchData; error?: string }>

  /** 绑定 Issue 到会话(写 metadata.issueBinding) */
  export function bindIssue(
    conversationId: string,
    binding: { provider: IssueProvider; id: string; title: string; url: string },
  ): Promise<{ success: boolean; data: { issueBinding: IssueBinding }; error?: string }>

  /** 解绑会话 Issue(清空 metadata.issueBinding → 独立任务) */
  export function unbindIssue(
    conversationId: string,
  ): Promise<{ success: boolean; data: Record<string, never>; error?: string }>
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
