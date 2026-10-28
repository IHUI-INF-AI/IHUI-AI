// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * O64 号池凭证回写 CAS(2026-10-23 立,设计 docs/engineering/account-pool-checkin-sync-design.md)。
 *
 * 背景:签到引擎(ai-service Qoder 自刷新)产生的新 refresh_token/expires_at 要回流号池,
 * 否则号池的凭证会比签到侧旧 → 号池调度器再刷新时用旧 refresh_token 打官方,白白消耗
 * 轮换次数甚至撞「refresh_token 一次性使用」语义而失败。
 *
 * CAS 语义:回写带 baseVersion(签到侧 device_map.pool_cred_version 记录的号池版本),
 * 仅当号池行 cred_version 仍等于 baseVersion 才写(并 +1)。版本已变 = 号池侧在签到
 * 刷新之后又有新写入(导入覆盖/其它通路),以号池为准丢弃本次回写 —— 旧凭证永不覆盖
 * 新凭证,与推送侧防降级构成同一原则的两半。
 */
import { and, eq } from 'drizzle-orm'
import { aiRelayAccountPool } from '@ihui/database'
import { db } from '../db/index.js'
import { encryptField } from '../utils/crypto.js'

export interface CredentialWritebackInput {
  /** 号池账号 id(签到侧 device_map.pool_account_id) */
  poolAccountId: string
  /** 签到侧记录的号池凭证版本(CAS 基准) */
  baseVersion: number
  /** 新 refresh_token(null = 清空;缺省 undefined 不动该列) */
  refreshToken?: string | null
  /** 新到期时刻(epoch 秒/毫秒或 ISO 字符串;null 清空) */
  expiresAt?: string | null
}

export type CredentialWritebackResult =
  | { status: 'applied'; credVersion: number }
  | { status: 'conflict'; currentVersion: number }
  | { status: 'not_found' }

/**
 * 解析到期时刻为 Date。三种形态都认:
 * - epoch 秒(qoder device_map["expires_at"] = exp.timestamp(),可为 float 字符串)
 * - epoch 毫秒(>1e12 视为已是 ms,不再乘)
 * - ISO 8601(号池导入面常用)
 * 无法解析/<=0 → null(epoch<=0 是 qoder 侧「缺失」的哨兵值,不当成 1970)。
 */
export function parseExpiresAt(raw: string | null | undefined): Date | null {
  if (raw === null || raw === undefined) return null
  const s = raw.trim()
  if (!s) return null
  const asNum = Number(s)
  if (!Number.isNaN(asNum)) {
    // 纯数字形态 = epoch 秒/毫秒;<=0 是缺失哨兵(qoder 侧 expires_at<=0 语义),
    // 绝不落到 new Date(s) 被当年份简写解析('0' → 2000-01-01)
    if (asNum <= 0) return null
    const ms = asNum > 1e12 ? asNum : asNum * 1000
    const d = new Date(ms)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** CAS 回写:applied = 已落新凭证并 +1;conflict = 号池已有更新(丢弃);not_found = 行已删 */
export async function applyPoolCredentialWriteback(
  input: CredentialWritebackInput,
): Promise<CredentialWritebackResult> {
  const [current] = await db
    .select({ credVersion: aiRelayAccountPool.credVersion })
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.id, input.poolAccountId))
    .limit(1)
  if (!current) return { status: 'not_found' }
  if (current.credVersion !== input.baseVersion) {
    return { status: 'conflict', currentVersion: current.credVersion }
  }

  const patch: Record<string, unknown> = {
    credVersion: current.credVersion + 1,
    lastRefreshAt: new Date(),
    updatedAt: new Date(),
  }
  if (input.refreshToken !== undefined) {
    patch.refreshTokenEnc = input.refreshToken ? encryptField(input.refreshToken) : null
  }
  if (input.expiresAt !== undefined) {
    patch.tokenExpiresAt = parseExpiresAt(input.expiresAt)
  }

  // 条件写(读后写间隙防护):版本仍匹配才落;0 行 = 并发方刚写过,按 conflict 丢弃
  const updated = await db
    .update(aiRelayAccountPool)
    .set(patch)
    .where(
      and(
        eq(aiRelayAccountPool.id, input.poolAccountId),
        eq(aiRelayAccountPool.credVersion, input.baseVersion),
      ),
    )
    .returning({ credVersion: aiRelayAccountPool.credVersion })
  if (updated.length === 0 || !updated[0]) {
    const [latest] = await db
      .select({ credVersion: aiRelayAccountPool.credVersion })
      .from(aiRelayAccountPool)
      .where(eq(aiRelayAccountPool.id, input.poolAccountId))
      .limit(1)
    return {
      status: 'conflict',
      currentVersion: latest ? latest.credVersion : current.credVersion,
    }
  }
  return { status: 'applied', credVersion: updated[0].credVersion }
}
