// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信智联（WeChat Hub）账号持久化写操作。
 *
 * 从 manager 抽出：状态/游标/凭据/元数据的单点写库，适配器回调与 manager 生命周期共用。
 * 凭据只以密文落库（encryptJSON），读回时解密合并，绝不把明文写进日志或视图。
 */

import { eq } from 'drizzle-orm'
import { db, dbRead } from '../../db/index.js'
import { wechatHubAccounts } from '@ihui/database'
import { decryptJSON, encryptJSON, type EncryptedPayload } from '../../utils/crypto.js'
import type { WechatAccountStatus } from '@ihui/types'
import { asRecord, toStringRecord, type JsonRecord } from './views.js'

export async function updateAccountStatus(
  accountId: string,
  status: WechatAccountStatus,
  error: string | null,
): Promise<void> {
  await db
    .update(wechatHubAccounts)
    .set({
      status,
      lastError: error,
      updatedAt: new Date(),
      ...(status === 'online' ? { lastPollAt: new Date() } : {}),
    })
    .where(eq(wechatHubAccounts.id, accountId))
}

export async function updateAccountCursor(accountId: string, cursor: string): Promise<void> {
  const changed = { cursor, lastPollAt: new Date() }
  await db
    .update(wechatHubAccounts)
    .set({ ...changed, updatedAt: new Date() })
    .where(eq(wechatHubAccounts.id, accountId))
}

/** 轮询成功心跳：不改变游标，只刷新“最近轮询”时间。 */
export async function touchAccountPoll(accountId: string): Promise<void> {
  const now = new Date()
  await db
    .update(wechatHubAccounts)
    .set({ lastPollAt: now, updatedAt: now })
    .where(eq(wechatHubAccounts.id, accountId))
}

export async function patchAccountCredentials(
  accountId: string,
  patch: Record<string, string>,
): Promise<void> {
  const rows = await dbRead
    .select({ credentialsEncrypted: wechatHubAccounts.credentialsEncrypted })
    .from(wechatHubAccounts)
    .where(eq(wechatHubAccounts.id, accountId))
    .limit(1)
  const current = rows[0]
  if (!current) return
  let existing: Record<string, string> = {}
  try {
    existing = toStringRecord(
      decryptJSON(current.credentialsEncrypted as unknown as EncryptedPayload),
    )
  } catch {
    existing = {}
  }
  await db
    .update(wechatHubAccounts)
    .set({
      credentialsEncrypted: encryptJSON({ ...existing, ...patch }) as unknown as JsonRecord,
      updatedAt: new Date(),
    })
    .where(eq(wechatHubAccounts.id, accountId))
}

export async function patchAccountMetadata(
  accountId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const rows = await dbRead
    .select({ metadata: wechatHubAccounts.metadata })
    .from(wechatHubAccounts)
    .where(eq(wechatHubAccounts.id, accountId))
    .limit(1)
  const current = rows[0]
  if (!current) return
  await db
    .update(wechatHubAccounts)
    .set({
      metadata: { ...asRecord(current.metadata), ...patch },
      updatedAt: new Date(),
    })
    .where(eq(wechatHubAccounts.id, accountId))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
