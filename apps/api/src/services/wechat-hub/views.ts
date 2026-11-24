// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联（WeChat Hub）视图映射与后端能力矩阵。
 *
 * 从 manager 抽出：行数据 → 对外视图的统一出口、能力矩阵常量、JSON 取值小工具。
 * 全部按 request.userId 已验过的账号行转换；metadata 出口必须脱敏（token / webhookSecret / contacts 原文不出现）。
 */

import type {
  WechatAccountStatus,
  WechatAccountView,
  WechatActionLogView,
  WechatAnalysisKind,
  WechatAnalysisResult,
  WechatAnalysisRunView,
  WechatBackendCapability,
  WechatConversationView,
  WechatMessageView,
} from '@ihui/types'
import type {
  wechatHubAccounts,
  wechatHubActionLogs,
  wechatHubAnalysisRuns,
  wechatHubConversations,
  wechatHubMessages,
} from '@ihui/database'

export type JsonRecord = Record<string, unknown>
export type AccountRow = typeof wechatHubAccounts.$inferSelect
export type ConversationRow = typeof wechatHubConversations.$inferSelect
export type MessageRow = typeof wechatHubMessages.$inferSelect
export type AnalysisRow = typeof wechatHubAnalysisRuns.$inferSelect
export type ActionRow = typeof wechatHubActionLogs.$inferSelect

export const BACKEND_CAPABILITIES: WechatBackendCapability[] = [
  {
    backend: 'ilink',
    label: 'iLink / ClawBot（腾讯官方）',
    compliance: 'official',
    supports: {
      qrcodeLogin: true,
      text: true,
      image: true,
      file: true,
      video: true,
      voice: true,
      group: false,
      moments: false,
      typing: true,
      proactivePush: true,
      webhookInbound: false,
    },
    notes:
      '官方扫码登录、长轮询、文本/图片/文件/视频、typing、主动推送；仅私聊，不支持群聊与朋友圈。',
  },
  {
    backend: 'bridge',
    label: '本地桥（WeChatFerry / RPA / chatlog）',
    compliance: 'local-bridge',
    supports: {
      qrcodeLogin: false,
      text: true,
      image: true,
      file: true,
      video: true,
      voice: true,
      group: true,
      moments: true,
      typing: true,
      proactivePush: true,
      webhookInbound: true,
    },
    notes:
      '功能取决于桥实现：WeChatFerry 可覆盖群聊/朋友圈/群管理；RPA 覆盖界面可见操作；chatlog 只读。',
  },
  {
    backend: 'mock',
    label: 'Mock（演示/测试）',
    compliance: 'mock',
    supports: {
      qrcodeLogin: false,
      text: true,
      image: true,
      file: true,
      video: true,
      voice: true,
      group: true,
      moments: false,
      typing: true,
      proactivePush: true,
      webhookInbound: true,
    },
    notes: '不连外部服务，用于联调 UI、跑测试与演示完整链路。',
  },
]

export function asRecord(value: unknown): JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : {}
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function toStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value)
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string') result[key] = item
  }
  return result
}

export function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

function isAnalysisResult(value: unknown): value is WechatAnalysisResult {
  return typeof asRecord(value).summary === 'string'
}

export function publicMetadata(metadata: JsonRecord): JsonRecord {
  const safe: JsonRecord = { ...metadata }
  delete safe.contacts
  delete safe.token
  delete safe.webhookSecret
  const contacts = asRecord(metadata.contacts)
  safe.contactsCount = Object.keys(contacts).length
  return safe
}

export function toAccountView(row: AccountRow): WechatAccountView {
  return {
    id: row.id,
    label: row.label,
    backend: row.backend as WechatAccountView['backend'],
    status: row.status as WechatAccountStatus,
    externalId: row.externalId,
    avatarUrl: row.avatarUrl,
    lastError: row.lastError,
    lastPollAt: iso(row.lastPollAt),
    allowlistEnabled: row.allowlistEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metadata: publicMetadata(asRecord(row.metadata)),
  }
}

export function toConversationView(row: ConversationRow): WechatConversationView {
  return {
    id: row.id,
    accountId: row.accountId,
    platformChatId: row.platformChatId,
    kind: row.kind as WechatConversationView['kind'],
    title: row.title,
    memberCount: row.memberCount,
    unreadCount: row.unreadCount,
    lastMessageAt: iso(row.lastMessageAt),
    metadata: asRecord(row.metadata),
  }
}

export function toMessageView(row: MessageRow): WechatMessageView {
  return {
    id: row.id,
    accountId: row.accountId,
    conversationId: row.conversationId,
    direction: row.direction as WechatMessageView['direction'],
    kind: row.kind as WechatMessageView['kind'],
    content: row.content,
    mediaUrl: row.mediaUrl,
    senderId: row.senderId,
    senderName: row.senderName,
    platformMessageId: row.platformMessageId,
    sentAt: row.sentAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    rawPayload: asRecord(row.rawPayload),
  }
}

export function toAnalysisView(row: AnalysisRow): WechatAnalysisRunView {
  return {
    id: row.id,
    accountId: row.accountId,
    conversationId: row.conversationId,
    kind: row.kind as WechatAnalysisKind,
    status: row.status as WechatAnalysisRunView['status'],
    result: isAnalysisResult(row.result) ? row.result : null,
    model: row.model,
    tokens: row.tokens,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    completedAt: iso(row.completedAt),
  }
}

export function toActionView(row: ActionRow): WechatActionLogView {
  return {
    id: row.id,
    accountId: row.accountId,
    action: row.action,
    target: row.target,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
