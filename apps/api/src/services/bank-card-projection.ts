// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { createHash } from 'node:crypto'

/** withdrawal_flows 里与银行卡投影相关的最小行形状 */
export interface WithdrawalAccountRow {
  method: string | null
  accountInfo: unknown
  createdAt: Date | string | null
}

/** 与 packages/types BankCardItem 同形的 API 投影 DTO(不回传完整卡号) */
export interface ProjectedBankCard {
  id: string
  number: string
  holder: string
  bankName: string
  isDefault: boolean
}

const BANK_METHODS = new Set(['bank', 'bank_card'])
const MAX_CARDS = 20
const CARD_MIN_LENGTH = 8
const CARD_MAX_LENGTH = 32

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function maskCardNumber(account: string): string {
  return `**** **** **** ${account.slice(-4)}`
}

function timestamp(value: Date | string | null): number {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  const ms = date.getTime()
  return Number.isFinite(ms) ? ms : 0
}

/**
 * 把用户历史提现账户投影成 BankCardItem 列表。
 *
 * 为什么不建表:银行绑卡需要额外写入端点/默认卡/删除卡与迁移,当前产品只提供
 * 只读列表页;先用已有 withdrawal_flows.account_info 作真实数据源,按卡号去重,
 * 只回传掩码卡号。相同用户在首次提现后即可看到历史收款卡,不再恒空。
 */
export function projectBankCards(
  rows: readonly WithdrawalAccountRow[],
  userId: string,
  limit = MAX_CARDS,
): ProjectedBankCard[] {
  const sorted = [...rows].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt))
  const seen = new Set<string>()
  const cards: ProjectedBankCard[] = []

  for (const row of sorted) {
    if (!row.method || !BANK_METHODS.has(row.method)) continue
    const info = asRecord(row.accountInfo)
    if (!info) continue

    // 兼容历史提现字段:account / bankAccount / cardNumber
    const rawAccount = readString(info, 'account', 'bankAccount', 'cardNumber').replace(/\s+/g, '')
    if (rawAccount.length < CARD_MIN_LENGTH || rawAccount.length > CARD_MAX_LENGTH) continue
    if (seen.has(rawAccount)) continue
    seen.add(rawAccount)

    cards.push({
      id: createHash('sha256').update(`${userId}\u0000${rawAccount}`).digest('hex').slice(0, 24),
      number: maskCardNumber(rawAccount),
      holder: readString(info, 'holder', 'name') || '—',
      bankName: readString(info, 'bankName', 'bank') || '银行卡',
      // 历史提现流水没有"默认卡"语义;不把最近一张冒充默认卡。
      isDefault: false,
    })

    if (cards.length >= limit) break
  }

  return cards
}
