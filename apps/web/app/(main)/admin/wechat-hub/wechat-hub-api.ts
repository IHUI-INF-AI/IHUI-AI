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
  analyzeWechat,
  callWechatMcpTool,
  connectWechatAccount,
  createWechatAccount,
  deleteWechatAccount,
  disconnectWechatAccount,
  fetchWechatAccounts,
  fetchWechatActions,
  fetchWechatCapabilities,
  fetchWechatConversations,
  fetchWechatMcpTools,
  fetchWechatMessages,
  fetchWechatQrCode,
  fetchWechatStatus,
  sendWechatMessage,
  updateWechatSettings,
} from '@ihui/api-client'
import type {
  WechatAccountCreateInput,
  WechatAccountStatusView,
  WechatAccountView,
  WechatActionLogView,
  WechatAnalysisKind,
  WechatAnalysisRunView,
  WechatBackendCapability,
  WechatConversationView,
  WechatMcpTool,
  WechatMessageView,
  WechatQrCodeView,
  WechatSendInput,
  WechatSendResult,
} from '@ihui/types'

async function call<T>(fn: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : fallback)
  }
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
    },
  ): Promise<WechatAccountView> => call(() => updateWechatSettings(id, patch), '保存设置失败'),
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
} as const
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
