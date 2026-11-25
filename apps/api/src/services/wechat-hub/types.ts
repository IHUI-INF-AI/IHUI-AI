// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联运行时契约（API 侧内部类型）。
 *
 * 设计要点：
 * 1. 适配器只负责「协议/桥」差异，不碰数据库、不做策略；
 * 2. 所有入站消息先归一化成 WechatInboundEvent，再由 pipeline 入库；
 * 3. 账号状态、游标、凭据变更通过回调写回，适配器不直接依赖 drizzle。
 */

import type {
  WechatAccountStatus,
  WechatActionResult,
  WechatBackend,
  WechatBridgeAction,
  WechatConversationKind,
  WechatMessageKind,
  WechatQrCodeView,
  WechatSendResult,
} from '@ihui/types'

export interface WechatHubLogger {
  info: (obj: Record<string, unknown>, msg?: string) => void
  warn: (obj: Record<string, unknown>, msg?: string) => void
  error: (obj: Record<string, unknown>, msg?: string) => void
  debug: (obj: Record<string, unknown>, msg?: string) => void
}

/** 适配器看到的账号（凭据已解密，仅在内存里存在） */
export interface WechatRuntimeAccount {
  id: string
  userId: string
  label: string
  backend: WechatBackend
  status: WechatAccountStatus
  credentials: Record<string, string>
  cursor: string | null
  metadata: Record<string, unknown>
  allowlistEnabled: boolean
}

export interface WechatGroupMemberInput {
  memberId: string
  nickname: string
  role: 'owner' | 'admin' | 'member' | string
}

/** 成员映射条目：本地联系人/群成员下发给桥，供昵称 → 本地成员 id 回填。 */
export interface WechatMemberMapEntry {
  /** 平台成员 id（联系人 platformUserId / 群成员 memberId） */
  memberId: string
  /** 展示昵称；空昵称在编排层已跳过，不下发空串 */
  nickname: string
  source: 'contact' | 'group-member'
  /** 群成员所在会话标题；联系人条目为 null */
  chatTitle: string | null
}

/** 归一化后的入站消息 */
export interface WechatInboundEvent {
  platformMessageId: string
  platformChatId: string
  conversationKind: WechatConversationKind
  conversationTitle: string | null
  senderId: string | null
  senderName: string | null
  kind: WechatMessageKind
  content: string
  mediaUrl: string | null
  sentAt: Date
  /** 桥推送的群成员快照；iLink 私聊为空 */
  groupMembers?: WechatGroupMemberInput[]
  /** 裁剪后的原始字段，用于排障；不要整包落库 */
  raw: Record<string, unknown>
  /** iLink 回复所需；桥后端可为空 */
  contextToken: string | null
}

export interface WechatSendOptions {
  /** iLink 回复所需的 context_token；不传则从账号联系人缓存里取 */
  contextToken?: string
  replyToMessageId?: string
  /** 群聊 @ 成员；bridge 后端透传 */
  mentions?: string[]
  /** 幂等键；同一 key 的重复调用由上层拦截 */
  idempotencyKey?: string
}

export interface WechatMediaInput {
  kind: 'image' | 'file' | 'video' | 'voice'
  url: string
  fileName?: string
}

export interface WechatAdapterContext {
  account: WechatRuntimeAccount
  onEvent: (event: WechatInboundEvent) => Promise<void>
  onStatus: (status: WechatAccountStatus, error?: string) => Promise<void>
  onCursor: (cursor: string) => Promise<void>
  /** 成功轮询心跳：用于刷新账号“最近轮询”，与游标变化解耦 */
  onPoll?: () => Promise<void>
  onCredentials: (patch: Record<string, string>) => Promise<void>
  onMetadata: (patch: Record<string, unknown>) => Promise<void>
  logger: WechatHubLogger
}

/** 桥本地归档读取结果；适配器只做协议归一化，不做账号归属校验。 */
export interface WechatBridgeArchiveRead {
  ok: boolean
  total: number
  moments: Record<string, unknown>[]
  reason: string | null
}

/** 桥本地媒体文件描述；只描述真实落盘文件，不补占位图。 */
export interface WechatMomentMediaFile {
  name: string
  size: number
  contentType: string
}

/** 桥本地媒体二进制读取结果。 */
export interface WechatMomentMediaRead {
  contentType: string
  data: Buffer
}

export interface WechatAdapter {
  readonly backend: WechatBackend
  /** 建立连接：iLink 生成二维码；bridge 探活；mock 直接 online */
  connect(ctx: WechatAdapterContext): Promise<void>
  disconnect(): Promise<void>
  getStatus(): WechatAccountStatus
  getQrCode(): WechatQrCodeView | null
  sendText(target: string, text: string, options?: WechatSendOptions): Promise<WechatSendResult>
  sendMedia?(
    target: string,
    media: WechatMediaInput,
    options?: WechatSendOptions,
  ): Promise<WechatSendResult>
  typing?(target: string, on: boolean): Promise<void>
  /** bridge 后端的 webhook 入站：把桥推送的 payload 归一化成事件 */
  handleWebhook?(payload: unknown): WechatInboundEvent[]
  /** bridge 后端的扩展动作（联系人/群管理/朋友圈）；iLink 不实现。 */
  performAction?(
    action: WechatBridgeAction,
    payload: Record<string, unknown>,
  ): Promise<WechatActionResult>
  /** bridge 后端读本地归档 JSONL；iLink/mock 不实现。 */
  readMomentArchive?(limit: number): Promise<WechatBridgeArchiveRead>
  /** bridge 后端读本地媒体目录；iLink/mock 不实现。 */
  listMomentMedia?(momentId: string): Promise<WechatMomentMediaFile[]>
  /** bridge 后端读单个本地媒体；未命中返回 null，不伪造。 */
  readMomentMedia?(momentId: string, name: string): Promise<WechatMomentMediaRead | null>
  /** bridge 后端下发本地联系人/群成员映射；iLink/mock 不实现。 */
  pushMemberMap?(entries: WechatMemberMapEntry[]): Promise<WechatActionResult>
}

export function localRejected(reason: string, rejectedBy: string): WechatSendResult {
  return {
    ok: false,
    status: 'local-rejected',
    platformMessageId: null,
    reason,
    attempts: 0,
    rejectedBy,
  }
}

export function transportError(reason: string, attempts = 1): WechatSendResult {
  return {
    ok: false,
    status: 'transport-error',
    platformMessageId: null,
    reason,
    attempts,
    rejectedBy: null,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
