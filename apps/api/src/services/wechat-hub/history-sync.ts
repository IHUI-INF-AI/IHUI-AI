// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 从本地桥自动回填历史消息：桥负责从 wcfhttp 的 /sql（或 mock）拉取，
 * IHUI 侧只做账号/会话归属校验、归一化和去重导入，不触发出站副作用。
 */

import { and, eq } from 'drizzle-orm'
import { wechatHubConversations } from '@ihui/database'
import type {
  WechatHistorySyncInput,
  WechatHistorySyncResult,
  WechatImportMessageRow,
} from '@ihui/types'
import { AppError } from '../../errors/AppError.js'
import { dbRead } from '../../db/index.js'
import { assertAccountForUser } from './guards.js'
import { importWechatMessages } from './import.js'
import { wechatHubManager } from './manager.js'

const DEFAULT_LIMIT = 500
const MAX_LIMIT = 2_000

function asLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.trunc(Number(value)), 1), MAX_LIMIT)
}

export async function syncHistoryFromBridge(
  userId: string,
  accountId: string,
  input: WechatHistorySyncInput = {},
): Promise<WechatHistorySyncResult> {
  await assertAccountForUser(userId, accountId)
  const limit = asLimit(input.limit)
  let chatId: string | undefined
  if (input.conversationId) {
    const rows = await dbRead
      .select({ platformChatId: wechatHubConversations.platformChatId })
      .from(wechatHubConversations)
      .where(
        and(
          eq(wechatHubConversations.id, input.conversationId),
          eq(wechatHubConversations.accountId, accountId),
        ),
      )
      .limit(1)
    if (rows.length === 0) {
      throw new AppError('会话不存在', 404, 'WECHAT_CONVERSATION_NOT_FOUND')
    }
    chatId = rows[0]?.platformChatId
  }

  const action = await wechatHubManager.performAction(userId, accountId, 'history.fetch', {
    limit,
    ...(chatId ? { chatId } : {}),
  })
  if (!action.ok) {
    return {
      fetched: 0,
      imported: 0,
      skipped: 0,
      conversations: 0,
      errors: [],
      status: action.status,
      reason: action.reason,
      source: null,
    }
  }

  const raw = action.data.messages
  const messages = Array.isArray(raw) ? (raw as WechatImportMessageRow[]) : []
  const source = {
    db: typeof action.data.db === 'string' ? action.data.db : null,
    table: typeof action.data.table === 'string' ? action.data.table : null,
  }
  const result = await importWechatMessages(userId, accountId, { messages })
  return {
    fetched: messages.length,
    imported: result.imported,
    skipped: result.skipped,
    conversations: result.conversations,
    errors: result.errors,
    status: action.status,
    reason: action.reason,
    source: source.db || source.table ? source : null,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
