// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联管理器。
 *
 * 职责边界：
 *  - 账号生命周期（创建/连接/断开/删除/状态回写）
 *  - 入站消息归一化入库（会话归并 + 消息去重 + 未读计数）
 *  - 出站策略（白名单/限流/敏感词/审计）与投递
 *  - 分析任务编排（缓存命中 + 结果落库）
 *
 * 适配器只做协议，数据库与策略都在这里，避免"每个后端各写一套策略"。
 */

import { createHash, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import {
  wechatHubAccounts,
  wechatHubActionLogs,
  wechatHubAnalysisRuns,
  wechatHubConversations,
  wechatHubMessages,
} from '@ihui/database'
import type {
  WechatAccountCreateInput,
  WechatAccountStatus,
  WechatAccountStatusView,
  WechatAccountView,
  WechatActionLogView,
  WechatAnalysisKind,
  WechatAnalysisRunView,
  WechatBackendCapability,
  WechatConversationView,
  WechatMessageView,
  WechatQrCodeView,
  WechatSendInput,
  WechatSendResult,
} from '@ihui/types'
import { db, dbRead } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { decryptJSON, encryptJSON, type EncryptedPayload } from '../../utils/crypto.js'
import { logger } from '../../utils/logger.js'
import { analyzeMessages, hashAnalysisInput } from './analysis.js'
import { BridgeAdapter } from './bridge-adapter.js'
import { IlinkAdapter } from './ilink-adapter.js'
import { MockAdapter } from './mock-adapter.js'
import type {
  WechatAdapter,
  WechatAdapterContext,
  WechatHubLogger,
  WechatInboundEvent,
  WechatRuntimeAccount,
  WechatSendOptions,
} from './types.js'
import { localRejected } from './types.js'
import {
  BACKEND_CAPABILITIES,
  asRecord,
  asString,
  iso,
  toStringRecord,
  toAccountView,
  toActionView,
  toAnalysisView,
  toConversationView,
  toMessageView,
  type AccountRow,
  type ConversationRow,
  type JsonRecord,
} from './views.js'
import {
  patchAccountCredentials,
  patchAccountMetadata,
  updateAccountCursor,
  updateAccountStatus,
} from './account-store.js'
import { applySendPolicy } from './send-policy.js'

const HUB_LOGGER: WechatHubLogger = {
  info: (obj, msg) => logger.info(msg ?? '[wechat-hub]', obj),
  warn: (obj, msg) => logger.warn(msg ?? '[wechat-hub]', obj),
  error: (obj, msg) => logger.error(msg ?? '[wechat-hub]', obj),
  debug: (obj, msg) => logger.debug(msg ?? '[wechat-hub]', obj),
}

export class WechatHubManager {
  private adapters = new Map<string, WechatAdapter>()
  private rateWindows = new Map<string, { minute: number; count: number }>()
  private connecting = new Set<string>()

  getCapabilities(): WechatBackendCapability[] {
    return BACKEND_CAPABILITIES
  }

  async createAccount(userId: string, input: WechatAccountCreateInput): Promise<WechatAccountView> {
    const existing = await dbRead
      .select({ id: wechatHubAccounts.id })
      .from(wechatHubAccounts)
      .where(and(eq(wechatHubAccounts.userId, userId), eq(wechatHubAccounts.label, input.label)))
      .limit(1)
    if (existing.length > 0) {
      throw new AppError('同名下已存在微信账号', 409, 'WECHAT_ACCOUNT_DUPLICATE')
    }
    const inserted = await db
      .insert(wechatHubAccounts)
      .values({
        userId,
        label: input.label,
        backend: input.backend,
        status: 'disconnected',
        credentialsEncrypted: encryptJSON(input.credentials ?? {}) as unknown as JsonRecord,
        metadata: asRecord(input.metadata),
      })
      .returning()
    const row = inserted[0]
    if (!row) throw new AppError('创建微信账号失败', 500, 'WECHAT_ACCOUNT_CREATE_FAILED')
    await this.writeAction(
      row.id,
      userId,
      'account.create',
      null,
      {
        backend: row.backend,
        label: row.label,
      },
      'success',
    )
    return toAccountView(row)
  }

  async listAccounts(userId: string): Promise<WechatAccountView[]> {
    const rows = await dbRead
      .select()
      .from(wechatHubAccounts)
      .where(eq(wechatHubAccounts.userId, userId))
      .orderBy(desc(wechatHubAccounts.createdAt))
      .limit(50)
    return rows.map((row) => toAccountView(row))
  }

  async deleteAccount(userId: string, accountId: string): Promise<void> {
    const row = await this.assertAccount(userId, accountId)
    await this.disconnectAccount(userId, accountId).catch(() => undefined)
    await this.writeAction(row.id, userId, 'account.delete', null, {}, 'success')
    await db.delete(wechatHubAccounts).where(eq(wechatHubAccounts.id, row.id))
  }

  async connectAccount(userId: string, accountId: string): Promise<void> {
    if (this.connecting.has(accountId)) return
    this.connecting.add(accountId)
    try {
      const row = await this.assertAccount(userId, accountId)
      const runtime = this.loadRuntime(row)
      const adapter = this.createAdapter(runtime.backend, accountId)
      this.adapters.set(accountId, adapter)
      try {
        await adapter.connect(this.buildContext(accountId, runtime))
      } catch (e) {
        this.adapters.delete(accountId)
        await updateAccountStatus(accountId, 'error', e instanceof Error ? e.message : '连接失败')
        throw new AppError(
          e instanceof Error ? e.message : '微信账号连接失败',
          502,
          'WECHAT_CONNECT_FAILED',
        )
      }
    } finally {
      this.connecting.delete(accountId)
    }
  }

  async disconnectAccount(userId: string, accountId: string): Promise<void> {
    const row = await this.assertAccount(userId, accountId)
    const adapter = this.adapters.get(accountId)
    if (adapter) {
      await adapter.disconnect()
      this.adapters.delete(accountId)
    }
    await updateAccountStatus(accountId, 'disconnected', null)
    await this.writeAction(row.id, userId, 'account.disconnect', null, {}, 'success')
  }

  async getStatus(userId: string, accountId: string): Promise<WechatAccountStatusView> {
    const row = await this.assertAccount(userId, accountId)
    const adapter = this.adapters.get(accountId)
    const status = adapter?.getStatus() ?? (row.status as WechatAccountStatus)
    const qr = adapter?.getQrCode() ?? null
    return {
      accountId: row.id,
      status,
      online: status === 'online',
      lastError: row.lastError,
      lastPollAt: iso(row.lastPollAt),
      pendingQrCode: qr?.qrcode ?? null,
    }
  }

  async getQrCode(userId: string, accountId: string): Promise<WechatQrCodeView | null> {
    await this.assertAccount(userId, accountId)
    return this.adapters.get(accountId)?.getQrCode() ?? null
  }

  async updateSettings(
    userId: string,
    accountId: string,
    patch: {
      allowlistEnabled?: boolean
      allowedTargets?: string[]
      blockedWords?: string[]
      rateLimitPerMinute?: number
    },
  ): Promise<WechatAccountView> {
    const row = await this.assertAccount(userId, accountId)
    const metadata: JsonRecord = { ...asRecord(row.metadata) }
    if (patch.allowedTargets) metadata.allowedTargets = patch.allowedTargets
    if (patch.blockedWords) metadata.blockedWords = patch.blockedWords
    if (patch.rateLimitPerMinute !== undefined) {
      metadata.rateLimitPerMinute = Math.max(1, Math.min(120, patch.rateLimitPerMinute))
    }
    const updated = await db
      .update(wechatHubAccounts)
      .set({
        ...(patch.allowlistEnabled !== undefined
          ? { allowlistEnabled: patch.allowlistEnabled }
          : {}),
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(wechatHubAccounts.id, row.id))
      .returning()
    const next = updated[0]
    if (!next) throw new AppError('保存账号设置失败', 500, 'WECHAT_SETTINGS_FAILED')
    await this.writeAction(
      row.id,
      userId,
      'account.settings',
      null,
      {
        allowlistEnabled: next.allowlistEnabled,
        allowedTargets: patch.allowedTargets?.length ?? 0,
        blockedWords: patch.blockedWords?.length ?? 0,
        rateLimitPerMinute: patch.rateLimitPerMinute ?? null,
      },
      'success',
    )
    return toAccountView(next)
  }

  async listConversations(
    userId: string,
    accountId: string,
    limit = 50,
  ): Promise<WechatConversationView[]> {
    await this.assertAccount(userId, accountId)
    const rows = await dbRead
      .select()
      .from(wechatHubConversations)
      .where(eq(wechatHubConversations.accountId, accountId))
      .orderBy(desc(wechatHubConversations.lastMessageAt))
      .limit(Math.min(Math.max(limit, 1), 200))
    return rows.map((row) => toConversationView(row))
  }

  async listMessages(
    userId: string,
    accountId: string,
    conversationId: string | null,
    limit = 50,
    before: Date | null = null,
  ): Promise<WechatMessageView[]> {
    await this.assertAccount(userId, accountId)
    if (conversationId) {
      await this.assertConversation(accountId, conversationId)
    }
    const where = conversationId
      ? and(
          eq(wechatHubMessages.accountId, accountId),
          eq(wechatHubMessages.conversationId, conversationId),
        )
      : eq(wechatHubMessages.accountId, accountId)
    const rows = await dbRead
      .select()
      .from(wechatHubMessages)
      .where(where)
      .orderBy(desc(wechatHubMessages.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200))
    const filtered = before
      ? rows.filter((row) => row.createdAt.getTime() < before.getTime())
      : rows
    return filtered.reverse().map((row) => toMessageView(row))
  }

  async searchMessages(
    userId: string,
    accountId: string,
    query: string,
    limit = 20,
  ): Promise<WechatMessageView[]> {
    await this.assertAccount(userId, accountId)
    const term = query.trim()
    if (term.length === 0) return []
    const rows = await dbRead
      .select()
      .from(wechatHubMessages)
      .where(
        and(
          eq(wechatHubMessages.accountId, accountId),
          ilike(wechatHubMessages.content, `%${term.replace(/[%_]/g, '\\$&')}%`),
        ),
      )
      .orderBy(desc(wechatHubMessages.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100))
    return rows.reverse().map((row) => toMessageView(row))
  }

  async listActions(
    userId: string,
    accountId: string,
    limit = 100,
  ): Promise<WechatActionLogView[]> {
    await this.assertAccount(userId, accountId)
    const rows = await dbRead
      .select()
      .from(wechatHubActionLogs)
      .where(
        and(eq(wechatHubActionLogs.accountId, accountId), eq(wechatHubActionLogs.userId, userId)),
      )
      .orderBy(desc(wechatHubActionLogs.createdAt))
      .limit(Math.min(Math.max(limit, 1), 200))
    return rows.map((row) => toActionView(row))
  }

  async send(userId: string, input: WechatSendInput): Promise<WechatSendResult> {
    const row = await this.assertAccount(userId, input.accountId)
    const runtime = this.loadRuntime(row)
    const adapter = this.adapters.get(input.accountId)
    if (!adapter || adapter.getStatus() !== 'online') {
      throw new AppError('账号尚未连接，请先扫码/连接桥', 409, 'WECHAT_ACCOUNT_OFFLINE')
    }
    const rejected = applySendPolicy(runtime, input, this.rateWindows)
    if (rejected) {
      await this.writeAction(
        row.id,
        userId,
        'message.send',
        input.target,
        {
          kind: input.kind ?? 'text',
          dryRun: Boolean(input.dryRun),
          rejectedBy: rejected.rejectedBy,
        },
        rejected.status,
      )
      return rejected
    }
    if (input.dryRun) {
      return localRejected('dry-run：只校验不投递', 'dry-run')
    }

    const options: WechatSendOptions = {
      replyToMessageId: input.replyToMessageId,
      idempotencyKey: `ihui-${createHash('sha256')
        .update(
          `${input.accountId}:${input.target}:${input.text ?? input.mediaUrl ?? ''}:${Date.now()}`,
        )
        .digest('hex')
        .slice(0, 24)}`,
    }
    const result =
      input.kind === 'text' || !input.kind || input.kind === 'link' || input.kind === 'card'
        ? await adapter.sendText(input.target, input.text ?? input.mediaUrl ?? '', options)
        : ((await adapter.sendMedia?.(
            input.target,
            {
              kind: input.kind,
              url: input.mediaUrl ?? '',
            },
            options,
          )) ?? localRejected('当前后端不支持媒体发送', 'backend-no-media'))

    await this.recordOutbound(row.id, input, result)
    await this.writeAction(
      row.id,
      userId,
      'message.send',
      input.target,
      {
        kind: input.kind ?? 'text',
        status: result.status,
        attempts: result.attempts,
        platformMessageId: result.platformMessageId,
      },
      result.ok ? 'success' : 'failed',
    )
    return result
  }

  async analyze(
    userId: string,
    input: {
      accountId: string
      conversationId?: string
      kind: WechatAnalysisKind
      limit?: number
      model?: string
      force?: boolean
    },
  ): Promise<WechatAnalysisRunView> {
    const row = await this.assertAccount(userId, input.accountId)
    const conversation = input.conversationId
      ? await this.assertConversation(input.accountId, input.conversationId)
      : null
    const limit = Math.min(Math.max(input.limit ?? 200, 10), 1_000)
    const where = conversation
      ? and(
          eq(wechatHubMessages.accountId, input.accountId),
          eq(wechatHubMessages.conversationId, conversation.id),
        )
      : eq(wechatHubMessages.accountId, input.accountId)
    const messageRows = await dbRead
      .select()
      .from(wechatHubMessages)
      .where(where)
      .orderBy(desc(wechatHubMessages.createdAt))
      .limit(limit)
    const messages = messageRows.reverse().map((item) => toMessageView(item))
    const inputHash = hashAnalysisInput(
      input.kind,
      conversation?.id ?? null,
      messages.map((message) => message.id),
    )

    if (!input.force) {
      const cached = await dbRead
        .select()
        .from(wechatHubAnalysisRuns)
        .where(
          and(
            eq(wechatHubAnalysisRuns.accountId, input.accountId),
            eq(wechatHubAnalysisRuns.kind, input.kind),
            eq(wechatHubAnalysisRuns.inputHash, inputHash),
            eq(wechatHubAnalysisRuns.status, 'success'),
          ),
        )
        .orderBy(desc(wechatHubAnalysisRuns.createdAt))
        .limit(1)
      const hit = cached[0]
      if (hit) return toAnalysisView(hit)
    }

    const inserted = await db
      .insert(wechatHubAnalysisRuns)
      .values({
        accountId: input.accountId,
        conversationId: conversation?.id ?? null,
        kind: input.kind,
        status: 'running',
        inputHash,
        model: input.model ?? null,
      })
      .returning()
    const run = inserted[0]
    if (!run) throw new AppError('创建分析任务失败', 500, 'WECHAT_ANALYZE_CREATE_FAILED')

    try {
      const { result, model, tokens } = await analyzeMessages(
        input.kind,
        conversation?.title ?? null,
        messages,
      )
      const updated = await db
        .update(wechatHubAnalysisRuns)
        .set({
          status: 'success',
          result,
          model: input.model ?? model,
          tokens,
          completedAt: new Date(),
        })
        .where(eq(wechatHubAnalysisRuns.id, run.id))
        .returning()
      const done = updated[0] ?? run
      await this.writeAction(
        row.id,
        userId,
        'analysis.run',
        conversation?.platformChatId ?? null,
        {
          kind: input.kind,
          messageCount: messages.length,
          model: input.model ?? model,
        },
        'success',
      )
      return toAnalysisView(done)
    } catch (e) {
      const message = e instanceof Error ? e.message : '分析失败'
      await db
        .update(wechatHubAnalysisRuns)
        .set({ status: 'failed', error: message, completedAt: new Date() })
        .where(eq(wechatHubAnalysisRuns.id, run.id))
      await this.writeAction(
        row.id,
        userId,
        'analysis.run',
        conversation?.platformChatId ?? null,
        {
          kind: input.kind,
          messageCount: messages.length,
          error: message,
        },
        'failed',
      )
      const failed = { ...run, status: 'failed' as const, error: message }
      return toAnalysisView(failed)
    }
  }

  async handleBridgeWebhook(
    accountId: string,
    payload: unknown,
    secret: string | null,
  ): Promise<number> {
    const rows = await dbRead
      .select()
      .from(wechatHubAccounts)
      .where(eq(wechatHubAccounts.id, accountId))
      .limit(1)
    const row = rows[0]
    if (!row || row.backend !== 'bridge') {
      throw new AppError('桥账号不存在', 404, 'WECHAT_BRIDGE_NOT_FOUND')
    }
    const runtime = this.loadRuntime(row)
    const expected = runtime.credentials.webhookSecret ?? asString(runtime.metadata.webhookSecret)
    if (!expected) {
      throw new AppError('桥账号未配置 webhookSecret', 400, 'WECHAT_WEBHOOK_SECRET_MISSING')
    }
    if (!secret || !this.safeEqual(secret, expected)) {
      throw new AppError('webhook 验签失败', 401, 'WECHAT_WEBHOOK_UNAUTHORIZED')
    }
    const adapter = this.adapters.get(accountId) ?? new BridgeAdapter()
    const events = adapter.handleWebhook?.(payload) ?? []
    for (const event of events) {
      await this.ingestEvent(accountId, event)
    }
    return events.length
  }

  // ===== 入站管道 =====

  async ingestEvent(accountId: string, event: WechatInboundEvent): Promise<void> {
    const conversationId = await this.upsertConversation(accountId, event)
    const inserted = await db
      .insert(wechatHubMessages)
      .values({
        accountId,
        conversationId,
        direction: 'inbound',
        kind: event.kind,
        content: event.content,
        mediaUrl: event.mediaUrl,
        senderId: event.senderId,
        senderName: event.senderName,
        platformMessageId: event.platformMessageId,
        sentAt: event.sentAt,
        deliveryStatus: 'sent',
        rawPayload: event.raw,
      })
      .onConflictDoNothing()
      .returning({ id: wechatHubMessages.id })
    if (inserted.length === 0) return
    await db
      .update(wechatHubConversations)
      .set({
        lastMessageAt: event.sentAt,
        unreadCount: sql`${wechatHubConversations.unreadCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(wechatHubConversations.id, conversationId))
    logger.debug('[wechat-hub] 入站消息入库', {
      accountId,
      conversationId,
      messageId: event.platformMessageId,
    })
  }

  private async upsertConversation(accountId: string, event: WechatInboundEvent): Promise<string> {
    const inserted = await db
      .insert(wechatHubConversations)
      .values({
        accountId,
        platformChatId: event.platformChatId,
        kind: event.conversationKind,
        title: event.conversationTitle ?? '',
        memberCount: event.conversationKind === 'group' ? 0 : 2,
        lastMessageAt: event.sentAt,
        metadata: {
          lastSenderId: event.senderId,
          lastSenderName: event.senderName,
        },
      })
      .onConflictDoNothing()
      .returning({ id: wechatHubConversations.id })
    const insertedId = inserted[0]?.id
    if (insertedId) return insertedId

    const existing = await dbRead
      .select({ id: wechatHubConversations.id })
      .from(wechatHubConversations)
      .where(
        and(
          eq(wechatHubConversations.accountId, accountId),
          eq(wechatHubConversations.platformChatId, event.platformChatId),
        ),
      )
      .limit(1)
    const existingId = existing[0]?.id
    if (!existingId) throw new AppError('会话归并失败', 500, 'WECHAT_CONVERSATION_UPSERT_FAILED')

    if (event.conversationTitle) {
      await db
        .update(wechatHubConversations)
        .set({
          ...(event.conversationTitle ? { title: event.conversationTitle } : {}),
          updatedAt: new Date(),
        })
        .where(eq(wechatHubConversations.id, existingId))
    }
    return existingId
  }

  // ===== 出站策略 =====

  private async recordOutbound(
    accountId: string,
    input: WechatSendInput,
    result: WechatSendResult,
  ): Promise<void> {
    const conversationId = await this.upsertOutboundConversation(accountId, input)
    await db.insert(wechatHubMessages).values({
      accountId,
      conversationId,
      direction: 'outbound',
      kind: input.kind ?? 'text',
      content: input.text ?? (input.mediaUrl ? `[${input.kind ?? 'media'}] ${input.mediaUrl}` : ''),
      mediaUrl: input.mediaUrl ?? null,
      senderId: null,
      senderName: null,
      platformMessageId: result.platformMessageId,
      sentAt: new Date(),
      deliveryStatus: result.ok ? 'sent' : 'failed',
      errorMessage: result.reason,
      rawPayload: {
        status: result.status,
        attempts: result.attempts,
        rejectedBy: result.rejectedBy,
      },
    })
    await db
      .update(wechatHubConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(wechatHubConversations.id, conversationId))
  }

  private async upsertOutboundConversation(
    accountId: string,
    input: WechatSendInput,
  ): Promise<string> {
    const inserted = await db
      .insert(wechatHubConversations)
      .values({
        accountId,
        platformChatId: input.target,
        kind: 'private',
        title: '',
        memberCount: 2,
        lastMessageAt: new Date(),
        metadata: {},
      })
      .onConflictDoNothing()
      .returning({ id: wechatHubConversations.id })
    const insertedId = inserted[0]?.id
    if (insertedId) return insertedId
    const existing = await dbRead
      .select({ id: wechatHubConversations.id })
      .from(wechatHubConversations)
      .where(
        and(
          eq(wechatHubConversations.accountId, accountId),
          eq(wechatHubConversations.platformChatId, input.target),
        ),
      )
      .limit(1)
    const id = existing[0]?.id
    if (!id) throw new AppError('出站会话归并失败', 500, 'WECHAT_OUTBOUND_CONVERSATION_FAILED')
    return id
  }

  // ===== 适配器与回写 =====

  private createAdapter(
    backend: WechatRuntimeAccount['backend'],
    accountId: string,
  ): WechatAdapter {
    switch (backend) {
      case 'ilink':
        return new IlinkAdapter()
      case 'bridge':
        return new BridgeAdapter()
      case 'mock':
        return new MockAdapter()
      default:
        throw new AppError(`不支持的微信后端: ${accountId}`, 400, 'WECHAT_BACKEND_UNSUPPORTED')
    }
  }

  private buildContext(accountId: string, runtime: WechatRuntimeAccount): WechatAdapterContext {
    return {
      account: runtime,
      logger: HUB_LOGGER,
      onEvent: async (event) => this.ingestEvent(accountId, event),
      onStatus: async (status, error) => updateAccountStatus(accountId, status, error ?? null),
      onCursor: async (cursor) => updateAccountCursor(accountId, cursor),
      onCredentials: async (patch) => patchAccountCredentials(accountId, patch),
      onMetadata: async (patch) => patchAccountMetadata(accountId, patch),
    }
  }

  private loadRuntime(row: AccountRow): WechatRuntimeAccount {
    let credentials: Record<string, string> = {}
    try {
      const decrypted = decryptJSON(row.credentialsEncrypted as unknown as EncryptedPayload)
      credentials = toStringRecord(decrypted)
    } catch {
      credentials = {}
    }
    return {
      id: row.id,
      userId: row.userId,
      label: row.label,
      backend: row.backend as WechatRuntimeAccount['backend'],
      status: row.status as WechatAccountStatus,
      credentials,
      cursor: row.cursor,
      metadata: asRecord(row.metadata),
      allowlistEnabled: row.allowlistEnabled,
    }
  }

  // ===== 查询辅助 =====

  private async assertAccount(userId: string, accountId: string): Promise<AccountRow> {
    const rows = await dbRead
      .select()
      .from(wechatHubAccounts)
      .where(and(eq(wechatHubAccounts.id, accountId), eq(wechatHubAccounts.userId, userId)))
      .limit(1)
    const row = rows[0]
    if (!row) throw new AppError('微信账号不存在', 404, 'WECHAT_ACCOUNT_NOT_FOUND')
    return row
  }

  private async assertConversation(
    accountId: string,
    conversationId: string,
  ): Promise<ConversationRow> {
    const rows = await dbRead
      .select()
      .from(wechatHubConversations)
      .where(
        and(
          eq(wechatHubConversations.id, conversationId),
          eq(wechatHubConversations.accountId, accountId),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row) throw new AppError('会话不存在', 404, 'WECHAT_CONVERSATION_NOT_FOUND')
    return row
  }

  private async writeAction(
    accountId: string,
    userId: string,
    action: string,
    target: string | null,
    payload: JsonRecord,
    status: string,
    error?: string,
  ): Promise<void> {
    await db.insert(wechatHubActionLogs).values({
      accountId,
      userId,
      action,
      target,
      payload,
      status,
      error: error ?? null,
    })
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left)
    const rightBuffer = Buffer.from(right)
    if (leftBuffer.length !== rightBuffer.length) return false
    return timingSafeEqual(leftBuffer, rightBuffer)
  }
}

export const wechatHubManager = new WechatHubManager()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
