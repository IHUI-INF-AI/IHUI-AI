// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mock 适配器：本地演示与自动化测试用。
 * 不连任何外部服务；handleWebhook 可注入入站消息，sendText 返回稳定回执。
 */

import type {
  WechatAccountStatus,
  WechatActionResult,
  WechatBackend,
  WechatBridgeAction,
  WechatQrCodeView,
  WechatSendResult,
} from '@ihui/types'
import type {
  WechatAdapter,
  WechatAdapterContext,
  WechatInboundEvent,
  WechatMediaInput,
  WechatSendOptions,
} from './types.js'
import { normalizeBridgePayload } from './bridge-adapter.js'

export class MockAdapter implements WechatAdapter {
  readonly backend: WechatBackend = 'mock'

  private ctx: WechatAdapterContext | null = null
  private status: WechatAccountStatus = 'disconnected'
  private sent: Array<{ target: string; text: string; at: number }> = []

  async connect(ctx: WechatAdapterContext): Promise<void> {
    this.ctx = ctx
    this.status = 'online'
    await ctx.onStatus('online')
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected'
    if (this.ctx) await this.ctx.onStatus('disconnected')
  }

  getStatus(): WechatAccountStatus {
    return this.status
  }

  getQrCode(): WechatQrCodeView | null {
    return null
  }

  async sendText(
    target: string,
    text: string,
    _options?: WechatSendOptions,
  ): Promise<WechatSendResult> {
    this.sent.push({ target, text, at: Date.now() })
    return {
      ok: true,
      status: 'delivered',
      platformMessageId: `mock-${Date.now()}-${this.sent.length}`,
      reason: null,
      attempts: 1,
      rejectedBy: null,
    }
  }

  async sendMedia(
    target: string,
    media: WechatMediaInput,
    _options?: WechatSendOptions,
  ): Promise<WechatSendResult> {
    this.sent.push({ target, text: `[${media.kind}] ${media.url}`, at: Date.now() })
    return {
      ok: true,
      status: 'delivered',
      platformMessageId: `mock-media-${Date.now()}-${this.sent.length}`,
      reason: null,
      attempts: 1,
      rejectedBy: null,
    }
  }

  handleWebhook(payload: unknown): WechatInboundEvent[] {
    return normalizeBridgePayload(payload)
  }

  async performAction(
    action: WechatBridgeAction,
    payload: Record<string, unknown>,
  ): Promise<WechatActionResult> {
    return {
      ok: true,
      status: 'accepted',
      data: { action, ...payload, mock: true },
      reason: null,
    }
  }

  /** 测试辅助：返回已发送记录 */
  listSent(): Array<{ target: string; text: string; at: number }> {
    return [...this.sent]
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
