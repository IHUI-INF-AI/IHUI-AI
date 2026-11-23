// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 适配器工厂：把账号行解成运行态、按后端建适配器、装配回调上下文。
 * 从 manager 拆出，避免单文件越过 800 行阈值。
 */

import type { WechatAccountStatus } from '@ihui/types'
import { AppError } from '../../errors/AppError.js'
import { decryptJSON, type EncryptedPayload } from '../../utils/crypto.js'
import { logger } from '../../utils/logger.js'
import {
  patchAccountCredentials,
  patchAccountMetadata,
  touchAccountPoll,
  updateAccountCursor,
  updateAccountStatus,
} from './account-store.js'
import { BridgeAdapter } from './bridge-adapter.js'
import { IlinkAdapter } from './ilink-adapter.js'
import { MockAdapter } from './mock-adapter.js'
import type {
  WechatAdapter,
  WechatAdapterContext,
  WechatHubLogger,
  WechatInboundEvent,
  WechatRuntimeAccount,
} from './types.js'
import { asRecord, toStringRecord, type AccountRow } from './views.js'

const HUB_LOGGER: WechatHubLogger = {
  info: (obj, msg) => logger.info(msg ?? '[wechat-hub]', obj),
  warn: (obj, msg) => logger.warn(msg ?? '[wechat-hub]', obj),
  error: (obj, msg) => logger.error(msg ?? '[wechat-hub]', obj),
  debug: (obj, msg) => logger.debug(msg ?? '[wechat-hub]', obj),
}

export function createAdapter(
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

export function buildContext(
  accountId: string,
  runtime: WechatRuntimeAccount,
  onEvent: (event: WechatInboundEvent) => Promise<void>,
  logger: WechatHubLogger,
): WechatAdapterContext {
  return {
    account: runtime,
    logger,
    onEvent,
    onStatus: async (status, error) => updateAccountStatus(accountId, status, error ?? null),
    onCursor: async (cursor) => updateAccountCursor(accountId, cursor),
    onPoll: async () => touchAccountPoll(accountId),
    onCredentials: async (patch) => patchAccountCredentials(accountId, patch),
    onMetadata: async (patch) => patchAccountMetadata(accountId, patch),
  }
}

export function loadRuntime(row: AccountRow): WechatRuntimeAccount {
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

export { HUB_LOGGER }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
