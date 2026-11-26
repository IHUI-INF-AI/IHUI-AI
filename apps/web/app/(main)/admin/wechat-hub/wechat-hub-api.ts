// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联前端 API 封装。
 *
 * 复用 @ihui/api-client 的 wechat-hub 端点(AGENTS.md §3 禁止端内直接 fetch)，
 * 这里只做错误归一化，方便 useQuery / useMutation 直接消费。
 */
import {
  ApiError,
  analyzeWechat,
  askWechat,
  askWechatSql,
  broadcastWechat,
  callWechatMcpTool,
  connectWechatAccount,
  createWechatAccount,
  createWechatAutoReplyRule,
  deleteWechatAccount,
  deleteWechatAutoReplyRule,
  deleteWechatKnowledge,
  deleteWechatJob,
  deleteWechatRemoteContact,
  disconnectWechatAccount,
  exportWechatMessages,
  importWechatMessages as importWechatMessagesApi,
  fetchApi,
  fetchWechatAccounts,
  fetchWechatActions,
  fetchWechatAutoReplyRules,
  fetchWechatCapabilities,
  fetchWechatCommands,
  fetchWechatContacts,
  fetchWechatBridgeStatus,
  fetchWechatConversations,
  fetchWechatDigestSchedule,
  fetchWechatGroupMembers,
  fetchWechatGroupWriteAudit,
  fetchWechatGroupWritePolicy,
  fetchWechatKnowledge,
  fetchWechatJobs,
  fetchWechatMcpTools,
  fetchWechatMessages,
  fetchWechatMoments,
  fetchWechatMomentArchive,
  fetchWechatMomentMediaBlob,
  fetchWechatMomentMediaList,
  fetchWechatQrCode,
  fetchWechatStatus,
  ingestWechatKnowledge,
  publishWechatMoment,
  previewWechatAutoReplyRule,
  previewWechatGroupAction,
  runWechatDigest,
  runWechatGroupAction,
  runWechatJobsNow,
  runWechatReport,
  saveWechatDigestSchedule,
  saveWechatJob,
  searchWechatKnowledge,
  sendWechatMessage,
  switchWechatChat,
  syncWechatContacts,
  syncWechatGroupMembers,
  syncWechatHistory,
  testWechatOutboundWebhook,
  transcribeWechatVoice,
  updateWechatAutoReplyRule,
  updateWechatContact,
  updateWechatGroupWritePolicy,
  updateWechatSettings,
  toggleWechatJob,
} from '@ihui/api-client'
import type {
  WechatAccountCreateInput,
  WechatAccountStatusView,
  WechatAccountView,
  WechatActionLogView,
  WechatActionResult,
  WechatAnalysisKind,
  WechatAnalysisRunView,
  WechatAskInput,
  WechatAskResult,
  WechatAskSqlResult,
  WechatAutoReplyPreviewInput,
  WechatAutoReplyPreviewResult,
  WechatAutoReplyRuleInput,
  WechatAutoReplyRuleView,
  WechatBackendCapability,
  WechatBroadcastInput,
  WechatBroadcastResult,
  WechatCommandView,
  WechatContactUpdateInput,
  WechatContactView,
  WechatConversationView,
  WechatDigestScheduleInput,
  WechatDigestScheduleView,
  WechatExportInput,
  WechatExportResult,
  WechatFriendAcceptView,
  WechatFriendsOverview,
  WechatFriendsPolicy,
  WechatGroupActionInput,
  WechatGroupActionPlan,
  WechatGroupMemberView,
  WechatGroupMembersSyncResult,
  WechatBridgeStatusView,
  WechatGroupWriteAuditView,
  WechatGroupWritePolicy,
  WechatHistorySyncInput,
  WechatHistorySyncResult,
  WechatImportMessagesInput,
  WechatImportMessagesResult,
  WechatJobInput,
  WechatJobRunResult,
  WechatJobView,
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
  WechatReportInput,
  WechatReportResult,
  WechatSendInput,
  WechatSendResult,
  WechatVoiceTranscribeBatchResult,
  WechatVoiceTranscribeResult,
} from '@ihui/types'

async function call<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : fallback)
  }
}

/**
 * 群写动作专用保留包装：ApiError 原样抛出，errorCode 不被降级成普通 Error，
 * 面板才能按错误码分流中文结论；其余异常仍走和 call() 一致的归一化。
 */
async function callKept<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new Error(e instanceof Error ? e.message : fallback)
  }
}

/**
 * 新朋友自动化端点：桥侧写动作默认关，需 BRIDGE_FRIENDS_AUTOMATION=on 且账号策略显式开启。
 * 信封处理与群写端点同形：失败分支把 status / errorCode 一并塞进 ApiError，
 * 交给面板按错误码分流中文结论；读取路径（扫描/策略/审计）不触发任何写动作。
 */

/** GET /wechat-hub/accounts/:id/friends/requests — 策略 + 扫描结果 + 审计聚合视图 */
async function fetchWechatFriendsOverview(
  accountId: string,
  force = false,
): Promise<WechatFriendsOverview> {
  const res = await fetchApi<WechatFriendsOverview>(
    `/wechat-hub/accounts/${accountId}/friends/requests${force ? '?force=1' : ''}`,
    { method: 'GET' },
  )
  if (!res.success) throw new ApiError(res.error || '获取新朋友申请失败', res.status, res.errorCode)
  return res.data
}

/** POST /wechat-hub/accounts/:id/friends/accept — 必须显式 confirmed:true 才放行写动作 */
async function acceptWechatFriend(
  accountId: string,
  requestId: string,
  confirmed: boolean,
): Promise<WechatFriendAcceptView> {
  const res = await fetchApi<WechatFriendAcceptView>(
    `/wechat-hub/accounts/${accountId}/friends/accept`,
    { method: 'POST', body: JSON.stringify({ requestId, confirmed }) },
  )
  if (!res.success) throw new ApiError(res.error || '通过好友申请失败', res.status, res.errorCode)
  return res.data
}

/** GET /wechat-hub/accounts/:id/friends/policy — 好友自动化开关与每小时上限 */
async function fetchWechatFriendsPolicy(accountId: string): Promise<WechatFriendsPolicy> {
  const res = await fetchApi<WechatFriendsPolicy>(
    `/wechat-hub/accounts/${accountId}/friends/policy`,
    { method: 'GET' },
  )
  if (!res.success) throw new ApiError(res.error || '获取新朋友策略失败', res.status, res.errorCode)
  return res.data
}

/** PUT /wechat-hub/accounts/:id/friends/policy */
async function updateWechatFriendsPolicy(
  accountId: string,
  patch: Partial<Pick<WechatFriendsPolicy, 'enabled' | 'maxAcceptsPerHour'>>,
): Promise<WechatFriendsPolicy> {
  const res = await fetchApi<WechatFriendsPolicy>(
    `/wechat-hub/accounts/${accountId}/friends/policy`,
    { method: 'PUT', body: JSON.stringify(patch) },
  )
  if (!res.success) throw new ApiError(res.error || '保存新朋友策略失败', res.status, res.errorCode)
  return res.data
}

export const wechatHubApi = {
  capabilities: (): Promise<WechatBackendCapability[]> =>
    call(fetchWechatCapabilities, '获取微信后端能力失败'),
  accounts: (): Promise<WechatAccountView[]> => call(fetchWechatAccounts, '获取微信账号失败'),
  createAccount: (input: WechatAccountCreateInput): Promise<WechatAccountView> =>
    call(() => createWechatAccount(input), '创建微信账号失败'),
  deleteAccount: (id: string): Promise<void> =>
    call(() => deleteWechatAccount(id), '删除微信账号失败'),
  connect: (id: string): Promise<void> => call(() => connectWechatAccount(id), '连接微信账号失败'),
  disconnect: (id: string): Promise<void> =>
    call(() => disconnectWechatAccount(id), '断开微信账号失败'),
  status: (id: string): Promise<WechatAccountStatusView> =>
    call(() => fetchWechatStatus(id), '获取微信状态失败'),
  qrcode: (id: string): Promise<WechatQrCodeView | null> =>
    call(() => fetchWechatQrCode(id), '获取微信二维码失败'),
  updateSettings: (
    id: string,
    patch: {
      allowlistEnabled?: boolean
      allowedTargets?: string[]
      blockedWords?: string[]
      rateLimitPerMinute?: number
      outboundWebhookUrl?: string
      agentModel?: string
      commandsEnabled?: boolean
      commandsInGroup?: boolean
      disabledCommands?: string[]
    },
  ): Promise<WechatAccountView> => call(() => updateWechatSettings(id, patch), '保存设置失败'),
  testOutboundWebhook: (id: string, url?: string): Promise<void> =>
    call(() => testWechatOutboundWebhook(id, url), '测试出站 Webhook 失败'),
  conversations: (id: string, limit = 50): Promise<WechatConversationView[]> =>
    call(() => fetchWechatConversations(id, limit), '获取微信会话失败'),
  messages: (id: string, conversationId: string | null, limit = 50): Promise<WechatMessageView[]> =>
    call(() => fetchWechatMessages(id, conversationId, limit), '获取微信消息失败'),
  actions: (id: string, limit = 100): Promise<WechatActionLogView[]> =>
    call(() => fetchWechatActions(id, limit), '获取动作审计失败'),
  send: (input: WechatSendInput): Promise<WechatSendResult> =>
    call(() => sendWechatMessage(input), '发送微信消息失败'),
  analyze: (input: {
    accountId: string
    conversationId?: string
    kind: WechatAnalysisKind
    limit?: number
    model?: string
    force?: boolean
  }): Promise<WechatAnalysisRunView> => call(() => analyzeWechat(input), '微信 AI 分析失败'),
  mcpTools: (): Promise<WechatMcpTool[]> => call(fetchWechatMcpTools, '获取 MCP 工具失败'),
  callTool: (name: string, args: Record<string, unknown>): Promise<unknown> =>
    call(() => callWechatMcpTool(name, args), '调用 MCP 工具失败'),
  contacts: (id: string, query = ''): Promise<WechatContactView[]> =>
    call(() => fetchWechatContacts(id, query), '获取联系人失败'),
  updateContact: (
    id: string,
    contactId: string,
    patch: WechatContactUpdateInput,
  ): Promise<WechatContactView> =>
    call(() => updateWechatContact(id, contactId, patch), '保存联系人失败'),
  groupMembers: (id: string, conversationId: string): Promise<WechatGroupMemberView[]> =>
    call(() => fetchWechatGroupMembers(id, conversationId), '获取群成员失败'),
  syncGroupMembers: (id: string, conversationId: string): Promise<WechatGroupMembersSyncResult> =>
    call(() => syncWechatGroupMembers(id, conversationId), '同步群成员失败'),
  autoReplyRules: (id: string): Promise<WechatAutoReplyRuleView[]> =>
    call(() => fetchWechatAutoReplyRules(id), '获取自动回复规则失败'),
  createAutoReplyRule: (
    id: string,
    input: WechatAutoReplyRuleInput,
  ): Promise<WechatAutoReplyRuleView> =>
    call(() => createWechatAutoReplyRule(id, input), '创建自动回复规则失败'),
  updateAutoReplyRule: (
    id: string,
    ruleId: string,
    input: WechatAutoReplyRuleInput,
  ): Promise<WechatAutoReplyRuleView> =>
    call(() => updateWechatAutoReplyRule(id, ruleId, input), '更新自动回复规则失败'),
  deleteAutoReplyRule: (id: string, ruleId: string): Promise<void> =>
    call(() => deleteWechatAutoReplyRule(id, ruleId), '删除自动回复规则失败'),
  previewAutoReplyRule: (
    id: string,
    ruleId: string,
    input: WechatAutoReplyPreviewInput,
  ): Promise<WechatAutoReplyPreviewResult> =>
    call(() => previewWechatAutoReplyRule(id, ruleId, input), '生成 AI 回复预览失败'),
  exportMessages: (id: string, input: WechatExportInput = {}): Promise<WechatExportResult> =>
    call(() => exportWechatMessages(id, input), '导出微信消息失败'),
  importMessages: (
    id: string,
    input: WechatImportMessagesInput,
  ): Promise<WechatImportMessagesResult> =>
    call(() => importWechatMessagesApi(id, input), '导入微信消息失败'),
  syncHistory: (id: string, input: WechatHistorySyncInput = {}): Promise<WechatHistorySyncResult> =>
    call(() => syncWechatHistory(id, input), '同步微信历史消息失败'),
  digestSchedule: (id: string): Promise<WechatDigestScheduleView | null> =>
    call(() => fetchWechatDigestSchedule(id), '获取日报计划失败'),
  saveDigestSchedule: (
    id: string,
    input: WechatDigestScheduleInput,
  ): Promise<WechatDigestScheduleView> =>
    call(() => saveWechatDigestSchedule(id, input), '保存日报计划失败'),
  runDigest: (id: string): Promise<WechatDigestScheduleView> =>
    call(() => runWechatDigest(id), '执行日报失败'),
  syncContacts: (
    id: string,
  ): Promise<{
    synced: number
    inserted: number
    updated: number
    result: WechatActionResult
  }> => call(() => syncWechatContacts(id), '同步联系人失败'),
  deleteRemoteContact: (id: string, contactId: string): Promise<WechatActionResult> =>
    call(() => deleteWechatRemoteContact(id, contactId), '删除远端联系人失败'),
  runGroupAction: (id: string, input: WechatGroupActionInput): Promise<WechatActionResult> =>
    callKept(() => runWechatGroupAction(id, input), '微信群动作失败'),
  groupPlan: (id: string, input: WechatGroupActionInput): Promise<WechatGroupActionPlan> =>
    callKept(() => previewWechatGroupAction(id, input), '生成群动作预览失败'),
  groupPolicy: (id: string): Promise<WechatGroupWritePolicy> =>
    callKept(() => fetchWechatGroupWritePolicy(id), '获取群写策略失败'),
  updateGroupPolicy: (
    id: string,
    patch: Partial<
      Pick<WechatGroupWritePolicy, 'enabled' | 'maxTargetsPerAction' | 'maxActionsPerHour'>
    >,
  ): Promise<WechatGroupWritePolicy> =>
    callKept(() => updateWechatGroupWritePolicy(id, patch), '保存群写策略失败'),
  friendsOverview: (id: string, force = false): Promise<WechatFriendsOverview> =>
    callKept(() => fetchWechatFriendsOverview(id, force), '获取新朋友申请失败'),
  acceptFriend: (
    id: string,
    requestId: string,
    confirmed: boolean,
  ): Promise<WechatFriendAcceptView> =>
    callKept(() => acceptWechatFriend(id, requestId, confirmed), '通过好友申请失败'),
  friendsPolicy: (id: string): Promise<WechatFriendsPolicy> =>
    callKept(() => fetchWechatFriendsPolicy(id), '获取新朋友策略失败'),
  updateFriendsPolicy: (
    id: string,
    patch: Partial<Pick<WechatFriendsPolicy, 'enabled' | 'maxAcceptsPerHour'>>,
  ): Promise<WechatFriendsPolicy> =>
    callKept(() => updateWechatFriendsPolicy(id, patch), '保存新朋友策略失败'),
  switchChat: (id: string, title: string): Promise<WechatActionResult> =>
    call(() => switchWechatChat(id, title), '切换微信会话失败'),
  publishMoment: (id: string, input: WechatMomentInput): Promise<WechatActionResult> =>
    call(() => publishWechatMoment(id, input), '发布朋友圈失败'),
  fetchMoments: (
    id: string,
    input: WechatMomentFetchInput = {},
  ): Promise<WechatMomentFetchResult> =>
    call(() => fetchWechatMoments(id, input), '遍历朋友圈失败'),
  fetchMomentArchive: (
    id: string,
    input: WechatMomentArchiveInput = {},
  ): Promise<WechatMomentArchiveView> =>
    call(() => fetchWechatMomentArchive(id, input), '获取朋友圈归档失败'),
  fetchMomentMediaList: (id: string, momentId: string): Promise<WechatMomentMediaFileView[]> =>
    call(() => fetchWechatMomentMediaList(id, momentId), '获取朋友圈本地媒体列表失败'),
  fetchMomentMediaBlob: (id: string, momentId: string, name: string): Promise<Blob> =>
    call(() => fetchWechatMomentMediaBlob(id, momentId, name), '读取朋友圈本地媒体失败'),
  knowledge: (id: string): Promise<WechatKnowledgeDocView[]> =>
    call(() => fetchWechatKnowledge(id), '获取知识库失败'),
  ingestKnowledge: (id: string, input: { title: string; text: string }) =>
    call(() => ingestWechatKnowledge(id, input), '知识库入库失败'),
  searchKnowledge: (id: string, query: string, topK = 5): Promise<WechatKnowledgeHit[]> =>
    call(() => searchWechatKnowledge(id, query, topK), '知识库检索失败'),
  deleteKnowledge: (id: string, docId: number): Promise<{ deleted: boolean }> =>
    call(() => deleteWechatKnowledge(id, docId), '删除知识库文档失败'),
  broadcast: (
    id: string,
    input: Omit<WechatBroadcastInput, 'accountId'>,
  ): Promise<WechatBroadcastResult> => call(() => broadcastWechat(id, input), '群发失败'),
  commands: (id: string): Promise<WechatCommandView[]> =>
    call(() => fetchWechatCommands(id), '获取指令列表失败'),
  report: (id: string, input: WechatReportInput): Promise<WechatReportResult> =>
    call(() => runWechatReport(id, input), '生成报告失败'),
  ask: (id: string, input: WechatAskInput): Promise<WechatAskResult> =>
    call(() => askWechat(id, input), '问聊天记录失败'),
  askSql: (id: string, input: { question: string }): Promise<WechatAskSqlResult> =>
    call(() => askWechatSql(id, input), '生成查询失败'),
  groupAudit: (id: string): Promise<WechatGroupWriteAuditView> =>
    callKept(() => fetchWechatGroupWriteAudit(id), '获取群写审计失败'),
  bridgeStatus: (id: string): Promise<WechatBridgeStatusView> =>
    callKept(() => fetchWechatBridgeStatus(id), '桥体检失败'),
  jobs: (id: string): Promise<WechatJobView[]> =>
    call(() => fetchWechatJobs(id), '获取定时任务失败'),
  saveJob: (id: string, input: WechatJobInput): Promise<WechatJobView> =>
    call(() => saveWechatJob(id, input), '保存定时任务失败'),
  toggleJob: (id: string, jobId: string, enabled: boolean): Promise<WechatJobView> =>
    call(() => toggleWechatJob(id, jobId, enabled), '切换定时任务失败'),
  deleteJob: (id: string, jobId: string): Promise<{ deleted: boolean }> =>
    call(() => deleteWechatJob(id, jobId), '删除定时任务失败'),
  runJobsNow: (): Promise<WechatJobRunResult[]> => call(runWechatJobsNow, '执行定时任务失败'),
  transcribeVoice: (
    id: string,
    input: { messageId?: string; limit?: number } = {},
  ): Promise<WechatVoiceTranscribeResult | WechatVoiceTranscribeBatchResult> =>
    call(() => transcribeWechatVoice(id, input), '语音转写失败'),
} as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
