// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联（WeChat Hub）API 端点。
 *
 * 对接 apps/api 的 /api/wechat-hub/*：账号生命周期、会话/消息、发送、
 * AI 分析与 MCP 工具清单/调用。所有写操作都要求登录态，由后端按 request.userId 隔离。
 *
 * 类型契约来源 @ihui/types(wechat-hub.ts)，端内不得重新声明同名类型。
 */

import type {
  WechatAccountCreateInput,
  WechatAccountStatusView,
  WechatAccountView,
  WechatActionLogView,
  WechatActionResult,
  WechatAnalysisKind,
  WechatAnalysisRunView,
  WechatAutoReplyPreviewInput,
  WechatAutoReplyPreviewResult,
  WechatAutoReplyRuleInput,
  WechatAutoReplyRuleView,
  WechatBackendCapability,
  WechatBroadcastInput,
  WechatBroadcastResult,
  WechatContactUpdateInput,
  WechatContactView,
  WechatConversationView,
  WechatDigestScheduleInput,
  WechatDigestScheduleView,
  WechatExportInput,
  WechatExportResult,
  WechatGroupActionInput,
  WechatGroupMemberView,
  WechatGroupMembersSyncResult,
  WechatHistorySyncInput,
  WechatHistorySyncResult,
  WechatImportMessagesInput,
  WechatImportMessagesResult,
  WechatKnowledgeDocView,
  WechatKnowledgeHit,
  WechatMcpTool,
  WechatMessageView,
  WechatMomentArchiveInput,
  WechatMomentArchiveView,
  WechatMomentFetchInput,
  WechatMomentFetchResult,
  WechatMomentInput,
  WechatMomentMediaFileView,
  WechatQrCodeView,
  WechatSendInput,
  WechatSendResult,
} from '@ihui/types'
import { fetchApi, fetchRaw } from '../client.js'

/** GET /api/wechat-hub/capabilities */
export async function fetchWechatCapabilities(): Promise<WechatBackendCapability[]> {
  const res = await fetchApi<WechatBackendCapability[]>('/wechat-hub/capabilities', {
    method: 'GET',
  })
  if (!res.success) throw new Error(res.error || '获取微信后端能力失败')
  return res.data ?? []
}

/** GET /api/wechat-hub/accounts */
export async function fetchWechatAccounts(): Promise<WechatAccountView[]> {
  const res = await fetchApi<WechatAccountView[]>('/wechat-hub/accounts', { method: 'GET' })
  if (!res.success) throw new Error(res.error || '获取微信账号列表失败')
  return res.data ?? []
}

/** POST /api/wechat-hub/accounts */
export async function createWechatAccount(
  input: WechatAccountCreateInput,
): Promise<WechatAccountView> {
  const res = await fetchApi<WechatAccountView>('/wechat-hub/accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '创建微信账号失败')
  return res.data
}

/** DELETE /api/wechat-hub/accounts/:id */
export async function deleteWechatAccount(accountId: string): Promise<void> {
  const res = await fetchApi<{ deleted: boolean }>(`/wechat-hub/accounts/${accountId}`, {
    method: 'DELETE',
  })
  if (!res.success) throw new Error(res.error || '删除微信账号失败')
}

/** POST /api/wechat-hub/accounts/:id/connect */
export async function connectWechatAccount(accountId: string): Promise<void> {
  const res = await fetchApi<{ connected: boolean }>(`/wechat-hub/accounts/${accountId}/connect`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.success) throw new Error(res.error || '连接微信账号失败')
}

/** POST /api/wechat-hub/accounts/:id/disconnect */
export async function disconnectWechatAccount(accountId: string): Promise<void> {
  const res = await fetchApi<{ disconnected: boolean }>(
    `/wechat-hub/accounts/${accountId}/disconnect`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  if (!res.success) throw new Error(res.error || '断开微信账号失败')
}

/** GET /api/wechat-hub/accounts/:id/status */
export async function fetchWechatStatus(accountId: string): Promise<WechatAccountStatusView> {
  const res = await fetchApi<WechatAccountStatusView>(`/wechat-hub/accounts/${accountId}/status`, {
    method: 'GET',
  })
  if (!res.success) throw new Error(res.error || '获取微信账号状态失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/qrcode */
export async function fetchWechatQrCode(accountId: string): Promise<WechatQrCodeView | null> {
  const res = await fetchApi<WechatQrCodeView | null>(`/wechat-hub/accounts/${accountId}/qrcode`, {
    method: 'GET',
  })
  if (!res.success) throw new Error(res.error || '获取微信扫码二维码失败')
  return res.data ?? null
}

/** PATCH /api/wechat-hub/accounts/:id/settings */
export async function updateWechatSettings(
  accountId: string,
  patch: {
    allowlistEnabled?: boolean
    allowedTargets?: string[]
    blockedWords?: string[]
    rateLimitPerMinute?: number
    outboundWebhookUrl?: string
  },
): Promise<WechatAccountView> {
  const res = await fetchApi<WechatAccountView>(`/wechat-hub/accounts/${accountId}/settings`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  if (!res.success) throw new Error(res.error || '保存微信账号设置失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/outbound-webhook/test */
export async function testWechatOutboundWebhook(accountId: string, url?: string): Promise<void> {
  const res = await fetchApi<{ ok: boolean }>(
    `/wechat-hub/accounts/${accountId}/outbound-webhook/test`,
    { method: 'POST', ...(url !== undefined ? { body: JSON.stringify({ url }) } : {}) },
  )
  if (!res.success) throw new Error(res.error || '测试出站 Webhook 失败')
}

/** GET /api/wechat-hub/accounts/:id/conversations */
export async function fetchWechatConversations(
  accountId: string,
  limit = 50,
): Promise<WechatConversationView[]> {
  const res = await fetchApi<WechatConversationView[]>(
    `/wechat-hub/accounts/${accountId}/conversations?limit=${String(limit)}`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取微信会话失败')
  return res.data ?? []
}

/** GET /api/wechat-hub/accounts/:id/messages */
export async function fetchWechatMessages(
  accountId: string,
  conversationId: string | null,
  limit = 50,
): Promise<WechatMessageView[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (conversationId) params.set('conversationId', conversationId)
  const res = await fetchApi<WechatMessageView[]>(
    `/wechat-hub/accounts/${accountId}/messages?${params.toString()}`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取微信消息失败')
  return res.data ?? []
}

/** GET /api/wechat-hub/accounts/:id/actions */
export async function fetchWechatActions(
  accountId: string,
  limit = 100,
): Promise<WechatActionLogView[]> {
  const res = await fetchApi<WechatActionLogView[]>(
    `/wechat-hub/accounts/${accountId}/actions?limit=${String(limit)}`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取微信动作审计失败')
  return res.data ?? []
}

/** POST /api/wechat-hub/send */
export async function sendWechatMessage(input: WechatSendInput): Promise<WechatSendResult> {
  const res = await fetchApi<WechatSendResult>('/wechat-hub/send', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '发送微信消息失败')
  return res.data
}

/** POST /api/wechat-hub/analyze */
export async function analyzeWechat(input: {
  accountId: string
  conversationId?: string
  kind: WechatAnalysisKind
  limit?: number
  model?: string
  force?: boolean
}): Promise<WechatAnalysisRunView> {
  const res = await fetchApi<WechatAnalysisRunView>('/wechat-hub/analyze', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '微信 AI 分析失败')
  return res.data
}

/** GET /api/wechat-hub/mcp/tools */
export async function fetchWechatMcpTools(): Promise<WechatMcpTool[]> {
  const res = await fetchApi<WechatMcpTool[]>('/wechat-hub/mcp/tools', { method: 'GET' })
  if (!res.success) throw new Error(res.error || '获取微信 MCP 工具清单失败')
  return res.data ?? []
}

/** POST /api/wechat-hub/mcp/call */
export async function callWechatMcpTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetchApi<unknown>('/wechat-hub/mcp/call', {
    method: 'POST',
    body: JSON.stringify({ name, arguments: args }),
  })
  if (!res.success) throw new Error(res.error || '调用微信 MCP 工具失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/contacts */
export async function fetchWechatContacts(
  accountId: string,
  query = '',
): Promise<WechatContactView[]> {
  const params = new URLSearchParams()
  if (query.trim()) params.set('query', query.trim())
  const suffix = params.toString() ? `?${params.toString()}` : ''
  const res = await fetchApi<WechatContactView[]>(
    `/wechat-hub/accounts/${accountId}/contacts${suffix}`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取微信联系人失败')
  return res.data ?? []
}

/** PATCH /api/wechat-hub/accounts/:id/contacts/:contactId */
export async function updateWechatContact(
  accountId: string,
  contactId: string,
  patch: WechatContactUpdateInput,
): Promise<WechatContactView> {
  const res = await fetchApi<WechatContactView>(
    `/wechat-hub/accounts/${accountId}/contacts/${contactId}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  )
  if (!res.success) throw new Error(res.error || '保存微信联系人失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/conversations/:conversationId/members */
export async function fetchWechatGroupMembers(
  accountId: string,
  conversationId: string,
): Promise<WechatGroupMemberView[]> {
  const res = await fetchApi<WechatGroupMemberView[]>(
    `/wechat-hub/accounts/${accountId}/conversations/${conversationId}/members`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取群成员失败')
  return res.data ?? []
}

/** POST /api/wechat-hub/accounts/:id/conversations/:conversationId/members/sync */
export async function syncWechatGroupMembers(
  accountId: string,
  conversationId: string,
): Promise<WechatGroupMembersSyncResult> {
  const res = await fetchApi<WechatGroupMembersSyncResult>(
    `/wechat-hub/accounts/${accountId}/conversations/${conversationId}/members/sync`,
    { method: 'POST' },
  )
  if (!res.success) throw new Error(res.error || '同步群成员失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/auto-reply-rules */
export async function fetchWechatAutoReplyRules(
  accountId: string,
): Promise<WechatAutoReplyRuleView[]> {
  const res = await fetchApi<WechatAutoReplyRuleView[]>(
    `/wechat-hub/accounts/${accountId}/auto-reply-rules`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取自动回复规则失败')
  return res.data ?? []
}

/** POST /api/wechat-hub/accounts/:id/auto-reply-rules */
export async function createWechatAutoReplyRule(
  accountId: string,
  input: WechatAutoReplyRuleInput,
): Promise<WechatAutoReplyRuleView> {
  const res = await fetchApi<WechatAutoReplyRuleView>(
    `/wechat-hub/accounts/${accountId}/auto-reply-rules`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '创建自动回复规则失败')
  return res.data
}

/** PATCH /api/wechat-hub/accounts/:id/auto-reply-rules/:ruleId */
export async function updateWechatAutoReplyRule(
  accountId: string,
  ruleId: string,
  input: WechatAutoReplyRuleInput,
): Promise<WechatAutoReplyRuleView> {
  const res = await fetchApi<WechatAutoReplyRuleView>(
    `/wechat-hub/accounts/${accountId}/auto-reply-rules/${ruleId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '更新自动回复规则失败')
  return res.data
}

/** DELETE /api/wechat-hub/accounts/:id/auto-reply-rules/:ruleId */
export async function deleteWechatAutoReplyRule(accountId: string, ruleId: string): Promise<void> {
  const res = await fetchApi<{ deleted: boolean }>(
    `/wechat-hub/accounts/${accountId}/auto-reply-rules/${ruleId}`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error || '删除自动回复规则失败')
}

/** POST /api/wechat-hub/accounts/:id/auto-reply-rules/:ruleId/preview */
export async function previewWechatAutoReplyRule(
  accountId: string,
  ruleId: string,
  input: WechatAutoReplyPreviewInput,
): Promise<WechatAutoReplyPreviewResult> {
  const res = await fetchApi<WechatAutoReplyPreviewResult>(
    `/wechat-hub/accounts/${accountId}/auto-reply-rules/${ruleId}/preview`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '生成 AI 回复预览失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/export */
export async function exportWechatMessages(
  accountId: string,
  input: WechatExportInput = {},
): Promise<WechatExportResult> {
  const params = new URLSearchParams()
  if (input.format) params.set('format', input.format)
  if (input.conversationId) params.set('conversationId', input.conversationId)
  if (input.since) params.set('since', input.since)
  if (input.until) params.set('until', input.until)
  if (input.limit !== undefined) params.set('limit', String(input.limit))
  const query = params.toString()
  const res = await fetchApi<WechatExportResult>(
    `/wechat-hub/accounts/${accountId}/export${query ? `?${query}` : ''}`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '导出微信消息失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/import/messages */
export async function importWechatMessages(
  accountId: string,
  input: WechatImportMessagesInput,
): Promise<WechatImportMessagesResult> {
  const res = await fetchApi<WechatImportMessagesResult>(
    `/wechat-hub/accounts/${accountId}/import/messages`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '导入微信消息失败')
  return res.data
}

/**
 * POST /api/wechat-hub/accounts/:id/history/sync
 * 从本地桥自动回填历史消息（wcfhttp 走 /sql；mock 返回演示数据）。
 */
export async function syncWechatHistory(
  accountId: string,
  input: WechatHistorySyncInput = {},
): Promise<WechatHistorySyncResult> {
  const res = await fetchApi<WechatHistorySyncResult>(
    `/wechat-hub/accounts/${accountId}/history/sync`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '同步微信历史消息失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/digest-schedule */
export async function fetchWechatDigestSchedule(
  accountId: string,
): Promise<WechatDigestScheduleView | null> {
  const res = await fetchApi<WechatDigestScheduleView | null>(
    `/wechat-hub/accounts/${accountId}/digest-schedule`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取日报计划失败')
  return res.data ?? null
}

/** PUT /api/wechat-hub/accounts/:id/digest-schedule */
export async function saveWechatDigestSchedule(
  accountId: string,
  input: WechatDigestScheduleInput,
): Promise<WechatDigestScheduleView> {
  const res = await fetchApi<WechatDigestScheduleView>(
    `/wechat-hub/accounts/${accountId}/digest-schedule`,
    { method: 'PUT', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '保存日报计划失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/digest-schedule/run */
export async function runWechatDigest(accountId: string): Promise<WechatDigestScheduleView> {
  const res = await fetchApi<WechatDigestScheduleView>(
    `/wechat-hub/accounts/${accountId}/digest-schedule/run`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  if (!res.success) throw new Error(res.error || '执行日报失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/contacts/sync */
export async function syncWechatContacts(accountId: string): Promise<{
  synced: number
  inserted: number
  updated: number
  result: WechatActionResult
}> {
  const res = await fetchApi<{
    synced: number
    inserted: number
    updated: number
    result: WechatActionResult
  }>(`/wechat-hub/accounts/${accountId}/contacts/sync`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  if (!res.success) throw new Error(res.error || '同步微信联系人失败')
  return res.data
}

/** DELETE /api/wechat-hub/accounts/:id/contacts/:contactId/remote */
export async function deleteWechatRemoteContact(
  accountId: string,
  contactId: string,
): Promise<WechatActionResult> {
  const res = await fetchApi<WechatActionResult>(
    `/wechat-hub/accounts/${accountId}/contacts/${contactId}/remote`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error || '删除微信联系人失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/groups/action */
export async function runWechatGroupAction(
  accountId: string,
  input: WechatGroupActionInput,
): Promise<WechatActionResult> {
  const res = await fetchApi<WechatActionResult>(
    `/wechat-hub/accounts/${accountId}/groups/action`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '微信群动作失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/chat/switch */
export async function switchWechatChat(
  accountId: string,
  title: string,
): Promise<WechatActionResult> {
  const res = await fetchApi<WechatActionResult>(`/wechat-hub/accounts/${accountId}/chat/switch`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  if (!res.success) throw new Error(res.error || '切换微信会话失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/moments/fetch */
export async function fetchWechatMoments(
  accountId: string,
  input: WechatMomentFetchInput = {},
): Promise<WechatMomentFetchResult> {
  const res = await fetchApi<WechatMomentFetchResult>(
    `/wechat-hub/accounts/${accountId}/moments/fetch`,
    {
      method: 'POST',
      body: JSON.stringify(input),
      // DB sidecar 全量导出 715 条并校验本地媒体通常超过 30s；API 侧
      // moment.fetch 默认预算 360s，这里必须留出同等余量，否则前端会先
      // 报「请求超时(30s)」，而服务端其实仍在正常抓取。
      timeoutMs: 380_000,
    },
  )
  if (!res.success) throw new Error(res.error || '遍历朋友圈失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/moments/archive */
export async function fetchWechatMomentArchive(
  accountId: string,
  input: WechatMomentArchiveInput = {},
): Promise<WechatMomentArchiveView> {
  const params = new URLSearchParams()
  if (input.limit !== undefined) params.set('limit', String(input.limit))
  const query = params.toString()
  const res = await fetchApi<WechatMomentArchiveView>(
    `/wechat-hub/accounts/${accountId}/moments/archive${query ? `?${query}` : ''}`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取朋友圈归档失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/moments/media/list */
export async function fetchWechatMomentMediaList(
  accountId: string,
  momentId: string,
): Promise<WechatMomentMediaFileView[]> {
  const params = new URLSearchParams({ momentId })
  const res = await fetchApi<WechatMomentMediaFileView[]>(
    `/wechat-hub/accounts/${accountId}/moments/media/list?${params.toString()}`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取朋友圈本地媒体列表失败')
  return res.data ?? []
}

/** GET /api/wechat-hub/accounts/:id/moments/media，带鉴权头拉二进制。 */
export async function fetchWechatMomentMediaBlob(
  accountId: string,
  momentId: string,
  name: string,
): Promise<Blob> {
  const params = new URLSearchParams({ momentId, name })
  return fetchRaw(`/wechat-hub/accounts/${accountId}/moments/media?${params.toString()}`, {
    method: 'GET',
  })
}

/** POST /api/wechat-hub/accounts/:id/moments */
export async function publishWechatMoment(
  accountId: string,
  input: WechatMomentInput,
): Promise<WechatActionResult> {
  const res = await fetchApi<WechatActionResult>(`/wechat-hub/accounts/${accountId}/moments`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '发布朋友圈失败')
  return res.data
}

/** GET /api/wechat-hub/accounts/:id/knowledge */
export async function fetchWechatKnowledge(accountId: string): Promise<WechatKnowledgeDocView[]> {
  const res = await fetchApi<WechatKnowledgeDocView[]>(
    `/wechat-hub/accounts/${accountId}/knowledge`,
    { method: 'GET' },
  )
  if (!res.success) throw new Error(res.error || '获取知识库文档失败')
  return res.data ?? []
}

/** POST /api/wechat-hub/accounts/:id/knowledge */
export async function ingestWechatKnowledge(
  accountId: string,
  input: { title: string; text: string },
): Promise<{ chunkCount: number }> {
  const res = await fetchApi<{ chunkCount: number }>(
    `/wechat-hub/accounts/${accountId}/knowledge`,
    { method: 'POST', body: JSON.stringify(input) },
  )
  if (!res.success) throw new Error(res.error || '入库知识库失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/knowledge/search */
export async function searchWechatKnowledge(
  accountId: string,
  query: string,
  topK = 5,
): Promise<WechatKnowledgeHit[]> {
  const res = await fetchApi<WechatKnowledgeHit[]>(
    `/wechat-hub/accounts/${accountId}/knowledge/search`,
    { method: 'POST', body: JSON.stringify({ query, topK }) },
  )
  if (!res.success) throw new Error(res.error || '检索知识库失败')
  return res.data ?? []
}

/** DELETE /api/wechat-hub/accounts/:id/knowledge/:docId */
export async function deleteWechatKnowledge(
  accountId: string,
  docId: number,
): Promise<{ deleted: boolean }> {
  const res = await fetchApi<{ deleted: boolean }>(
    `/wechat-hub/accounts/${accountId}/knowledge/${String(docId)}`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error || '删除知识库文档失败')
  return res.data
}

/** POST /api/wechat-hub/accounts/:id/broadcast */
export async function broadcastWechat(
  accountId: string,
  input: Omit<WechatBroadcastInput, 'accountId'>,
): Promise<WechatBroadcastResult> {
  const res = await fetchApi<WechatBroadcastResult>(`/wechat-hub/accounts/${accountId}/broadcast`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '微信群发失败')
  return res.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
