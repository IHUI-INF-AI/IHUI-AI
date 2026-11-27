// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * BankCard 可写存储（2026-11-27）。
 *
 * 立因：`/wallet/bank-cards` 此前只能从 withdrawal_flows.account_info 只读投影，
 * 没有新增/删除/设默认的写入口。这里复用 user_preferences（group=bank_cards）承载
 * 用户显式绑定的卡，value 用 AES-256-GCM（encryptJSON）加密，不新开表也不把完整卡号
 * 回传客户端；历史提现投影继续作为只读数据源，与显式绑定卡合并展示。
 *
 * 约束：
 * - 只接受 12–19 位数字卡号，去空格/连字符后做 Luhn 校验；
 * - 每用户最多 20 张显式卡；重复卡号返回 exists；
 * - 默认卡只允许一张；删默认卡后自动把最新一张设为默认；
 * - 历史提现投影没有“默认卡”语义，不能被本存储伪造成默认。
 */
import { randomUUID } from 'node:crypto'
import {
  deleteUserPreference,
  findUserPreferences,
  upsertUserPreference,
  USER_PREFERENCE_GROUPS,
} from '../db/user-preferences-queries.js'
import { encryptJSON, decryptJSON, type EncryptedPayload } from '../utils/crypto.js'
import { projectBankCards, type ProjectedBankCard, type WithdrawalAccountRow } from './bank-card-projection.js'

export const BANK_CARD_GROUP = USER_PREFERENCE_GROUPS.bankCards
export const BANK_CARD_MAX = 20
const CARD_MIN_DIGITS = 12
const CARD_MAX_DIGITS = 19

/** 进程内 per-user 串行队列；键为 userId，值为队尾 promise。 */
const bankCardUserQueues = new Map<string, Promise<void>>()

export type BankCardErrorCode = 'invalid-number' | 'exists' | 'limit'

export class BankCardStoreError extends Error {
  constructor(public readonly code: BankCardErrorCode) {
    super(code)
    this.name = 'BankCardStoreError'
  }
}

export interface StoredBankCard {
  id: string
  /** 完整卡号只存在服务端加密值里，绝不进入 DTO。 */
  number: string
  holder: string
  bankName: string
  isDefault: boolean
  createdAt: string
}

export interface BankCardInput {
  number: string
  holder: string
  bankName: string
  isDefault?: boolean
}

/** 去掉空格/连字符，只留数字；长度或 Luhn 不合法返回 null。 */
export function normalizeBankCardNumber(raw: string): string | null {
  const digits = String(raw ?? '').replace(/[\s-]/g, '')
  if (!/^\d+$/.test(digits)) return null
  if (digits.length < CARD_MIN_DIGITS || digits.length > CARD_MAX_DIGITS) return null
  if (!passesLuhn(digits)) return null
  return digits
}

/** 标准 Luhn 校验，防明显假卡号；不替代支付网关的卡 bin 校验。 */
export function passesLuhn(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

export function maskBankCardNumber(number: string): string {
  const digits = String(number ?? '').replace(/\D/g, '')
  return digits.length >= 4 ? `**** **** **** ${digits.slice(-4)}` : ''
}

export function toBankCardItem(card: StoredBankCard): ProjectedBankCard {
  return {
    id: card.id,
    number: maskBankCardNumber(card.number),
    holder: card.holder,
    bankName: card.bankName,
    isDefault: card.isDefault,
  }
}

export function mergeBankCards(
  stored: readonly StoredBankCard[],
  projected: readonly ProjectedBankCard[],
  limit = BANK_CARD_MAX,
): ProjectedBankCard[] {
  const orderedStored = sortStoredBankCards(stored)
  const seen = new Set(orderedStored.map((card) => maskBankCardNumber(card.number)))
  const merged: ProjectedBankCard[] = orderedStored.map(toBankCardItem)
  for (const card of projected) {
    if (seen.has(card.number)) continue
    seen.add(card.number)
    merged.push(card)
  }
  return merged
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .slice(0, limit)
}

/** 解析一条 user_preferences 值；任何损坏/旧格式都跳过，不阻断整个列表。 */
export function parseStoredBankCard(id: string, value: string | null): StoredBankCard | null {
  if (!value) return null
  try {
    const payload = JSON.parse(value) as EncryptedPayload
    const data = decryptJSON(payload) as Partial<StoredBankCard> | null
    if (!data || typeof data !== 'object') return null
    const number = typeof data.number === 'string' ? normalizeBankCardNumber(data.number) : null
    if (!number) return null
    return {
      id,
      number,
      holder: typeof data.holder === 'string' && data.holder.trim() ? data.holder.trim() : '—',
      bankName: typeof data.bankName === 'string' && data.bankName.trim() ? data.bankName.trim() : '银行卡',
      isDefault: data.isDefault === true,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date(0).toISOString(),
    }
  } catch {
    return null
  }
}

function serializeStoredBankCard(card: StoredBankCard): string {
  return JSON.stringify(
    encryptJSON({
      number: card.number,
      holder: card.holder,
      bankName: card.bankName,
      isDefault: card.isDefault,
      createdAt: card.createdAt,
    }),
  )
}

export function sortStoredBankCards(cards: readonly StoredBankCard[]): StoredBankCard[] {
  return [...cards].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export async function listStoredBankCards(userId: string): Promise<StoredBankCard[]> {
  return withBankCardUserLock(userId, () => loadStoredBankCards(userId))
}

/**
 * 每用户串行队列：add / delete / setDefault / list 共用同一把进程内锁，
 * 防止并发 POST 先读后写绕过重复卡号检查。跨进程/多实例仍需数据库唯一键，
 * 这里解决单实例内最接近用户操作的竞态，不承诺分布式互斥。
 */
async function withBankCardUserLock<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const previous = bankCardUserQueues.get(userId) ?? Promise.resolve()
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => gate)
  bankCardUserQueues.set(userId, tail)
  await previous
  try {
    return await task()
  } finally {
    release()
    if (bankCardUserQueues.get(userId) === tail) bankCardUserQueues.delete(userId)
  }
}

async function loadStoredBankCards(userId: string): Promise<StoredBankCard[]> {
  const { list } = await findUserPreferences(userId, BANK_CARD_GROUP)
  const cards = list
    .map((row) => parseStoredBankCard(row.key, row.value))
    .filter((card): card is StoredBankCard => card !== null)
  return sortStoredBankCards(cards).slice(0, BANK_CARD_MAX)
}

async function persistCard(userId: string, card: StoredBankCard): Promise<void> {
  await upsertUserPreference(userId, BANK_CARD_GROUP, card.id, serializeStoredBankCard(card))
}

export async function addStoredBankCard(
  userId: string,
  input: BankCardInput,
): Promise<StoredBankCard> {
  const number = normalizeBankCardNumber(input.number)
  if (!number) throw new BankCardStoreError('invalid-number')

  return withBankCardUserLock(userId, async () => {
    const existing = await loadStoredBankCards(userId)
    if (existing.some((card) => card.number === number)) throw new BankCardStoreError('exists')
    if (existing.length >= BANK_CARD_MAX) throw new BankCardStoreError('limit')

    const now = new Date().toISOString()
    const makeDefault =
      input.isDefault === true || existing.length === 0 || !existing.some((card) => card.isDefault)
    if (makeDefault) {
      for (const card of existing) {
        if (!card.isDefault) continue
        await persistCard(userId, { ...card, isDefault: false })
      }
    }

    const card: StoredBankCard = {
      id: randomUUID(),
      number,
      holder: input.holder.trim() || '—',
      bankName: input.bankName.trim() || '银行卡',
      isDefault: makeDefault,
      createdAt: now,
    }
    await persistCard(userId, card)
    return card
  })
}

/** 只删显式绑定卡；历史提现投影的 id 找不到时返回 false，不误删流水。 */
export async function deleteStoredBankCard(userId: string, id: string): Promise<boolean> {
  return withBankCardUserLock(userId, async () => {
    const existing = await loadStoredBankCards(userId)
    const target = existing.find((card) => card.id === id)
    if (!target) return false

    await deleteUserPreference(userId, BANK_CARD_GROUP, id)
    if (target.isDefault) {
      const remaining = existing.filter((card) => card.id !== id)
      const newest = sortStoredBankCards(remaining)[0]
      if (newest) await persistCard(userId, { ...newest, isDefault: true })
    }
    return true
  })
}

export async function setDefaultStoredBankCard(userId: string, id: string): Promise<boolean> {
  return withBankCardUserLock(userId, async () => {
    const existing = await loadStoredBankCards(userId)
    if (!existing.some((card) => card.id === id)) return false
    for (const card of existing) {
      await persistCard(userId, { ...card, isDefault: card.id === id })
    }
    return true
  })
}

/** GET 合并：显式绑定卡优先，历史提现投影去重后补位；默认卡排最前。 */
export async function listWalletBankCards(
  userId: string,
  projectedRows: readonly WithdrawalAccountRow[],
): Promise<ProjectedBankCard[]> {
  const stored = await listStoredBankCards(userId)
  return mergeBankCards(stored, projectBankCards(projectedRows, userId))
}
