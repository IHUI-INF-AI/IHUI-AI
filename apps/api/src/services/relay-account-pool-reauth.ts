// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  resolveRelayAccountReauth,
  summarizeRelayAccountReauth,
  type RelayAccountReauthReason,
} from '@ihui/shared'
import type {
  CheckinLastRecord,
  CheckinSideRow,
  FetchPoolAccountsResult,
} from './relay-account-pool-reconcile.js'

/** 号池单行的分类输入(只取脱敏投影,不含 token/cookie 密文)。 */
export interface PoolReauthRow {
  id: string
  providerCode: string
  uid: string | null
  name: string | null
  isEnabled: boolean
  healthStatus: string | null
  tempUnschedulable: boolean | null
  tokenExpiresAt: Date | null
  hasRefreshToken: boolean | null
  lastErrorMessage: string | null
  /** 由调用方用 isRefreshableProviderCode 判定后传入,保持本模块纯函数可测 */
  refreshSupported: boolean
}

export interface PoolReauthItem {
  id: string
  providerCode: string
  uid: string | null
  name: string | null
  isEnabled: boolean
  healthStatus: string | null
  tempUnschedulable: boolean | null
  tokenExpiresAt: string | null
  hasRefreshToken: boolean
  lastErrorMessage: string | null
  needsReauth: boolean
  reauthReason: RelayAccountReauthReason | null
  /** 全部命中证据,主原因在第一位;计数只按 reauthReason 去重 */
  reauthReasons: RelayAccountReauthReason[]
  reauthDetail: string | null
  reauthNextAction: string | null
  /** 原始签到证据(成功/跳过也有),没有记录为 null */
  lastCheckin: CheckinLastRecord | null
  lastCheckinAt: string | null
}

export type ReauthCounts = ReturnType<typeof summarizeRelayAccountReauth>

export interface ReauthReport {
  items: PoolReauthItem[]
  counts: ReauthCounts
  /** 签到侧是否真的拉到了;false 时不得把「没拉到」写成「没有 claim 失败」 */
  checkinSource: { ok: boolean; error: string | null }
}

function toCheckinSignal(record: CheckinLastRecord | null) {
  if (!record) return null
  return {
    ok: record.ok,
    action: record.action,
    code: record.code,
    message: record.message,
    classifiedErrorType: record.classifiedErrorType,
  }
}

/** 单行分类(纯函数):buildReauthReport 与 checkin-status 共用,避免两套判据。 */
export function classifyPoolRow(
  row: PoolReauthRow,
  record: CheckinLastRecord | null,
  now: number = Date.now(),
) {
  return resolveRelayAccountReauth(
    {
      providerCode: row.providerCode,
      tokenExpiryMs: row.tokenExpiresAt instanceof Date ? row.tokenExpiresAt.getTime() : null,
      hasRefreshToken: row.hasRefreshToken === true,
      refreshSupported: row.refreshSupported,
      healthStatus: row.healthStatus,
      tempUnschedulable: row.tempUnschedulable,
      lastErrorMessage: row.lastErrorMessage,
      lastCheckin: toCheckinSignal(record),
    },
    now,
  )
}

/**
 * 汇总号池侧 needs_reauth(纯函数,零 DB/零 HTTP)。
 *
 * 数据面两张:号池行(health/down/到期/refresh 能力)+ 签到侧 lastRecord
 * (claim 拒绝证据)。签到侧拉取失败时只做池侧分类,`checkinSource` 显式报错;
 * 不把不可达降级成「全部健康」。
 */
export function buildReauthReport(
  rows: readonly PoolReauthRow[],
  checkin: FetchPoolAccountsResult | null,
  now: number = Date.now(),
): ReauthReport {
  const byPoolId = new Map<string, CheckinSideRow>()
  if (checkin?.ok) {
    for (const account of checkin.accounts) {
      if (account.poolAccountId) byPoolId.set(account.poolAccountId, account)
    }
  }

  const items: PoolReauthItem[] = rows.map((row) => {
    const side = byPoolId.get(row.id) ?? null
    const record = side?.lastRecord ?? null
    const result = classifyPoolRow(row, record, now)
    return {
      id: row.id,
      providerCode: row.providerCode,
      uid: row.uid,
      name: row.name,
      isEnabled: row.isEnabled,
      healthStatus: row.healthStatus,
      tempUnschedulable: row.tempUnschedulable,
      tokenExpiresAt: row.tokenExpiresAt instanceof Date ? row.tokenExpiresAt.toISOString() : null,
      hasRefreshToken: row.hasRefreshToken === true,
      lastErrorMessage: row.lastErrorMessage,
      needsReauth: result.needsReauth,
      reauthReason: result.reason,
      reauthReasons: result.reasons,
      reauthDetail: result.detail,
      reauthNextAction: result.nextAction,
      lastCheckin: record,
      lastCheckinAt: record?.createdAt ?? null,
    }
  })

  return {
    items,
    counts: summarizeRelayAccountReauth(
      items.map((item) => ({
        providerCode: item.providerCode,
        needsReauth: item.needsReauth,
        reason: item.reauthReason,
      })),
    ),
    checkinSource:
      checkin === null
        ? { ok: false, error: '未拉取签到侧' }
        : { ok: checkin.ok, error: checkin.error },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
