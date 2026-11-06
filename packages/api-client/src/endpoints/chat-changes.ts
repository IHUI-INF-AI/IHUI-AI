// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import type { ChatMessageProjection, ChatTurnChangeSet, ChatTurnChangeSetDetail } from '@ihui/types'
import { fetchApi } from '../client.js'

/**
 * 按轮变更集 / 流式投影 API(批次 4,2026-11-06 立)
 *
 * 对应后端 `apps/api/src/routes/chat-changes.ts`:
 *   GET  /api/chat/changes?conversationId&turnId&limit
 *   GET  /api/chat/changes/:changeSetId
 *   POST /api/chat/changes/:changeSetId/rewind
 *   GET  /api/chat/changes/projections?conversationId&messageId
 *
 * 为什么 wire 类型放 @ihui/types 的 chat 段:三端(web/mobile/小程序)都要消费同一形状,
 * 客户端包只负责搬运;把类型写在本包里会让另外两端各自再抄一份(§3 共享层优先)。
 */

/** 变更集列表查询参数 */
export interface ListChatTurnChangesParams {
  conversationId: string
  /** 只看某一轮(assistant 占位消息 id);不传 = 该会话最近若干轮 */
  turnId?: string
  /** 1..50,缺省 20(服务端同样夹取,客户端这里只是省一次往返) */
  limit?: number
}

/** 变更集列表 data */
export interface ListChatTurnChangesResult {
  items: ChatTurnChangeSet[]
}

/** 一轮的变更集 + 逐文件明细 data */
export type GetChatTurnChangeResult = ChatTurnChangeSetDetail

/**
 * 回滚结果:ai-service 原样返回(网关不重包)。
 * 三档结论由上游定义(回报中带 rewindStatus/逐文件结果),本包不复制那份判据,
 * 故留开放记录类型 —— 客户端按上游文档取字段,新增字段不会被本包旧版本吞掉。
 */
export type RewindChatTurnChangeResult = Record<string, unknown>

/** 投影读取 data */
export interface GetChatProjectionResult {
  projection: ChatMessageProjection
}

/** 查询某会话(或某轮)的变更集列表 */
export function listChatTurnChanges(params: ListChatTurnChangesParams) {
  const query: Record<string, string | number> = { conversationId: params.conversationId }
  if (params.turnId) query.turnId = params.turnId
  if (params.limit !== undefined) query.limit = params.limit
  return fetchApi<ListChatTurnChangesResult>('/api/chat/changes', { params: query })
}

/** 查询单个变更集及其逐文件明细(非本人会话一律 404,客户端按"不存在"处理) */
export function getChatTurnChange(changeSetId: string) {
  return fetchApi<GetChatTurnChangeResult>(`/api/chat/changes/${encodeURIComponent(changeSetId)}`)
}

/**
 * 回滚一轮变更集。
 * `dryRun=true` 只做可回滚性校验(返回上游判定,不写盘),UI 可先预检再确认。
 */
export function rewindChatTurnChange(changeSetId: string, body: { dryRun: boolean }) {
  return fetchApi<RewindChatTurnChangeResult>(
    `/api/chat/changes/${encodeURIComponent(changeSetId)}/rewind`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

/**
 * 读取服务端流式投影(断线/崩溃后恢复部分正文用)。
 * `messageId` = 客户端为 assistant 占位消息生成的 id(不是 chat_messages.id)。
 */
export function getChatProjection(params: { conversationId: string; messageId: string }) {
  return fetchApi<GetChatProjectionResult>('/api/chat/changes/projections', {
    params: { conversationId: params.conversationId, messageId: params.messageId },
  })
}
