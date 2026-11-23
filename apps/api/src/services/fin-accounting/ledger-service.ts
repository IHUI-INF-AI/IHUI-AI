// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账套域服务:客户(纳税主体) / 账套 / 会计科目 / 期初余额。
 *
 * 边界:
 *   · 本文件只管"账的骨架",不产生任何凭证;
 *   · 期初余额是本账套的第一份余额快照,写入即冻结借贷合计必须相等的契约;
 *   · 所有金额出口走 cents 工具,写库值一律 fromCents() 的两位小数字符串。
 */

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { finAccount, finClient, finLedger, finOpeningBalance, finPeriodClose } from '@ihui/database'
import { fromCents, sumCents, toCents } from './money.js'
import { DEFAULT_CHART, resolveChart, type AccountCategory } from './chart-of-accounts.js'
import { assertPeriod } from './period.js'

const STANDARDS = ['small_business', 'general'] as const
const DIRECTIONS = ['debit', 'credit'] as const
const CATEGORIES: AccountCategory[] = ['asset', 'liability', 'equity', 'revenue', 'expense', 'cost']

export interface ClientInput {
  name: string
  shortName?: string | undefined
  taxNo?: string | undefined
  taxpayerType?: 'general' | 'small' | undefined
  industry?: string | undefined
  region?: string | undefined
  taxAuthority?: string | undefined
  legalPerson?: string | undefined
  contactName?: string | undefined
  contactPhone?: string | undefined
  startDate?: string | undefined
  remark?: string | undefined
}

export interface LedgerInput {
  clientId: string
  name: string
  accountingStandard?: (typeof STANDARDS)[number] | undefined
  startPeriod: string
}

export interface OpeningRow {
  accountCode: string
  debit?: string | number | undefined
  credit?: string | number | undefined
  aux?: Record<string, string> | undefined
}

// ============================= 客户 =============================

export async function createClient(input: ClientInput, userId?: string | null) {
  const name = input.name?.trim()
  if (!name) throw new AppError('客户名称必填', 400, 'FIN_CLIENT_NAME_REQUIRED')
  if (input.taxNo && !/^[0-9A-Z]{15,20}$/.test(input.taxNo.trim())) {
    throw new AppError(
      '统一社会信用代码必须是 15~20 位大写字母/数字',
      400,
      'FIN_CLIENT_TAX_NO_INVALID',
    )
  }
  try {
    const [row] = await db
      .insert(finClient)
      .values({
        name,
        shortName: input.shortName?.trim() || null,
        taxNo: input.taxNo?.trim().toUpperCase() || null,
        taxpayerType: input.taxpayerType ?? 'small',
        industry: input.industry?.trim() || null,
        region: input.region?.trim() || null,
        taxAuthority: input.taxAuthority?.trim() || null,
        legalPerson: input.legalPerson?.trim() || null,
        contactName: input.contactName?.trim() || null,
        contactPhone: input.contactPhone?.trim() || null,
        startDate: input.startDate ?? null,
        remark: input.remark?.trim() || null,
        createdBy: userId ?? null,
      })
      .returning()
    return row!
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('该统一社会信用代码已存在', 409, 'FIN_CLIENT_TAX_NO_DUPLICATE')
    }
    throw err
  }
}

export async function listClients(params: {
  page?: number
  limit?: number
  keyword?: string
  status?: string
}) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const where = [isNull(finClient.deletedAt)]
  if (params.status) where.push(eq(finClient.status, params.status))
  if (params.keyword?.trim()) {
    const kw = `%${params.keyword.trim()}%`
    where.push(sql`(${finClient.name} ILIKE ${kw} OR ${finClient.taxNo} ILIKE ${kw})`)
  }
  const cond = and(...where)
  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(finClient)
      .where(cond)
      .orderBy(desc(finClient.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(finClient)
      .where(cond),
  ])
  return { list: rows, page, limit, total: countRows[0]?.n ?? 0 }
}

export async function getClient(id: string) {
  const [row] = await db
    .select()
    .from(finClient)
    .where(and(eq(finClient.id, id), isNull(finClient.deletedAt)))
  if (!row) throw new AppError('客户不存在或已删除', 404, 'FIN_CLIENT_NOT_FOUND')
  return row
}

export async function updateClient(id: string, input: Partial<ClientInput>) {
  await getClient(id)
  const patch: Record<string, unknown> = { updatedAt: new Date() }
  const dirs: Array<[keyof ClientInput, string]> = [
    ['name', 'name'],
    ['shortName', 'shortName'],
    ['taxNo', 'taxNo'],
    ['taxpayerType', 'taxpayerType'],
    ['industry', 'industry'],
    ['region', 'region'],
    ['taxAuthority', 'taxAuthority'],
    ['legalPerson', 'legalPerson'],
    ['contactName', 'contactName'],
    ['contactPhone', 'contactPhone'],
    ['startDate', 'startDate'],
    ['remark', 'remark'],
  ]
  for (const [from, to] of dirs) {
    const v = input[from]
    if (v !== undefined) patch[to] = typeof v === 'string' ? v.trim() || null : v
  }
  try {
    const [row] = await db.update(finClient).set(patch).where(eq(finClient.id, id)).returning()
    return row!
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError('该统一社会信用代码已被其他客户占用', 409, 'FIN_CLIENT_TAX_NO_DUPLICATE')
    }
    throw err
  }
}

export async function archiveClient(id: string) {
  await getClient(id)
  const ledgers = await db
    .select({ id: finLedger.id })
    .from(finLedger)
    .where(and(eq(finLedger.clientId, id), isNull(finLedger.deletedAt)))
  if (ledgers.length > 0) {
    throw new AppError(
      `该客户仍有 ${ledgers.length} 个在用账套,请先归档账套再归档客户`,
      409,
      'FIN_CLIENT_HAS_LEDGER',
    )
  }
  const [row] = await db
    .update(finClient)
    .set({ status: 'closed', deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(finClient.id, id))
    .returning()
  return row!
}

// ============================= 账套 =============================

export async function createLedger(input: LedgerInput, userId?: string | null) {
  const name = input.name?.trim()
  if (!name) throw new AppError('账套名称必填', 400, 'FIN_LEDGER_NAME_REQUIRED')
  assertPeriod(input.startPeriod, 'startPeriod')
  const standard = input.accountingStandard ?? 'small_business'
  if (!STANDARDS.includes(standard)) {
    throw new AppError('accountingStandard 必须是 small_business/general', 400, 'FIN_BAD_STANDARD')
  }
  await getClient(input.clientId)

  return db.transaction(async (tx) => {
    let row: typeof finLedger.$inferSelect
    try {
      const inserted = await tx
        .insert(finLedger)
        .values({
          clientId: input.clientId,
          name,
          accountingStandard: standard,
          startPeriod: input.startPeriod,
          currentPeriod: input.startPeriod,
          createdBy: userId ?? null,
        })
        .returning()
      row = inserted[0]!
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new AppError('该客户下已有同名账套', 409, 'FIN_LEDGER_NAME_DUPLICATE')
      }
      throw err
    }

    const chart = resolveChart(DEFAULT_CHART)
    await tx.insert(finAccount).values(
      chart.map((a) => ({
        ledgerId: row.id,
        code: a.code,
        name: a.name,
        category: a.category,
        direction: a.direction,
        parentCode: a.parentCode ?? null,
        level: a.level,
        isLeaf: a.isLeaf,
        auxConfig: a.aux ?? {},
        isSystem: true,
      })),
    )
    await tx
      .insert(finPeriodClose)
      .values({ ledgerId: row.id, period: row.startPeriod, status: 'open' })
    return row
  })
}

export async function listLedgers(clientId?: string) {
  const where = [isNull(finLedger.deletedAt)]
  if (clientId) where.push(eq(finLedger.clientId, clientId))
  return db
    .select()
    .from(finLedger)
    .where(and(...where))
    .orderBy(desc(finLedger.createdAt))
}

export async function getLedger(id: string) {
  const [row] = await db
    .select()
    .from(finLedger)
    .where(and(eq(finLedger.id, id), isNull(finLedger.deletedAt)))
  if (!row) throw new AppError('账套不存在或已删除', 404, 'FIN_LEDGER_NOT_FOUND')
  return row
}

export async function updateLedger(
  id: string,
  patch: {
    name?: string
    accountingStandard?: (typeof STANDARDS)[number]
    status?: string
    reviewRequired?: boolean
  },
) {
  const ledger = await getLedger(id)
  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new AppError('账套名称不能为空', 400, 'FIN_LEDGER_NAME_REQUIRED')
    values['name'] = name
  }
  if (patch.accountingStandard !== undefined) {
    if (!STANDARDS.includes(patch.accountingStandard)) {
      throw new AppError('准则档非法', 400, 'FIN_BAD_STANDARD')
    }
    if (patch.accountingStandard !== ledger.accountingStandard) {
      const vouchers = await db.execute(
        sql`select count(*)::int as n from fin_voucher where ledger_id = ${id} and deleted_at is null`,
      )
      const n = Number((vouchers as unknown as Array<{ n: number }>)[0]?.n ?? 0)
      if (n > 0) {
        throw new AppError(
          `账套已有 ${n} 张凭证,会计准则不可切换(会造成报表口径漂移)`,
          409,
          'FIN_STANDARD_LOCKED',
        )
      }
    }
    values['accountingStandard'] = patch.accountingStandard
  }
  if (patch.status !== undefined) values['status'] = patch.status
  if (patch.reviewRequired !== undefined) {
    if (typeof patch.reviewRequired !== 'boolean') {
      throw new AppError('reviewRequired 必须是布尔值', 400, 'FIN_BAD_REVIEW_FLAG')
    }
    values['reviewRequired'] = patch.reviewRequired
  }
  const [row] = await db.update(finLedger).set(values).where(eq(finLedger.id, id)).returning()
  return row!
}

// ============================= 科目 =============================

export async function listAccounts(
  ledgerId: string,
  params?: { category?: string; enabled?: boolean },
) {
  await getLedger(ledgerId)
  const where = [eq(finAccount.ledgerId, ledgerId)]
  if (params?.category) where.push(eq(finAccount.category, params.category))
  if (params?.enabled !== undefined) where.push(eq(finAccount.enabled, params.enabled))
  return db
    .select()
    .from(finAccount)
    .where(and(...where))
    .orderBy(asc(finAccount.code))
}

export async function createAccount(
  ledgerId: string,
  input: {
    code: string
    name: string
    category?: AccountCategory
    direction?: 'debit' | 'credit'
    parentCode?: string
    aux?: Record<string, boolean>
  },
) {
  await getLedger(ledgerId)
  const code = input.code?.trim()
  const name = input.name?.trim()
  if (!code || !/^\d{4}(\d{2})?(\d{2})?$/.test(code)) {
    throw new AppError('科目编码必须是 4/6/8 位数字', 400, 'FIN_BAD_ACCOUNT_CODE')
  }
  if (!name) throw new AppError('科目名称必填', 400, 'FIN_ACCOUNT_NAME_REQUIRED')

  return db.transaction(async (tx) => {
    const [dup] = await tx
      .select({ id: finAccount.id })
      .from(finAccount)
      .where(and(eq(finAccount.ledgerId, ledgerId), eq(finAccount.code, code)))
    if (dup) throw new AppError('科目编码已存在', 409, 'FIN_ACCOUNT_CODE_DUPLICATE')

    let parentCode: string | null = input.parentCode?.trim() || null
    if (!parentCode && code.length > 4) parentCode = code.slice(0, code.length - 2)
    let level = 1
    if (parentCode) {
      const [parent] = await tx
        .select()
        .from(finAccount)
        .where(and(eq(finAccount.ledgerId, ledgerId), eq(finAccount.code, parentCode)))
      if (!parent) throw new AppError('父级科目不存在', 400, 'FIN_PARENT_ACCOUNT_MISSING')
      if (parent.isLeaf) {
        throw new AppError('父级科目当前是末级科目,请先在其下建子科目', 409, 'FIN_PARENT_IS_LEAF')
      }
      level = parent.level + 1
    }
    const category = input.category
    if (category && !CATEGORIES.includes(category)) {
      throw new AppError('科目类别非法', 400, 'FIN_BAD_ACCOUNT_CATEGORY')
    }
    const direction = input.direction
    if (direction && !DIRECTIONS.includes(direction)) {
      throw new AppError('余额方向非法', 400, 'FIN_BAD_ACCOUNT_DIRECTION')
    }
    const [row] = await tx
      .insert(finAccount)
      .values({
        ledgerId,
        code,
        name,
        category: category ?? 'asset',
        direction: direction ?? 'debit',
        parentCode,
        level,
        isLeaf: true,
        auxConfig: input.aux ?? {},
        isSystem: false,
      })
      .returning()
    return row!
  })
}

export async function updateAccount(
  ledgerId: string,
  code: string,
  patch: { name?: string; aux?: Record<string, boolean>; enabled?: boolean },
) {
  const [row] = await db
    .select()
    .from(finAccount)
    .where(and(eq(finAccount.ledgerId, ledgerId), eq(finAccount.code, code)))
  if (!row) throw new AppError('科目不存在', 404, 'FIN_ACCOUNT_NOT_FOUND')
  const values: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new AppError('科目名称不能为空', 400, 'FIN_ACCOUNT_NAME_REQUIRED')
    values['name'] = name
  }
  if (patch.aux !== undefined) values['auxConfig'] = patch.aux
  if (patch.enabled !== undefined) {
    if (!patch.enabled && row.isSystem) {
      throw new AppError(
        '系统模板科目不允许停用,只能新增自定义科目替代',
        409,
        'FIN_SYSTEM_ACCOUNT_PROTECTED',
      )
    }
    values['enabled'] = patch.enabled
  }
  const [updated] = await db
    .update(finAccount)
    .set(values)
    .where(eq(finAccount.id, row.id))
    .returning()
  return updated!
}

// ============================= 期初余额 =============================

export async function getOpeningBalances(ledgerId: string, period?: string) {
  const ledger = await getLedger(ledgerId)
  const target = period ?? ledger.startPeriod
  assertPeriod(target, 'period')
  return db
    .select()
    .from(finOpeningBalance)
    .where(and(eq(finOpeningBalance.ledgerId, ledgerId), eq(finOpeningBalance.period, target)))
    .orderBy(asc(finOpeningBalance.accountCode))
}

/**
 * 设置/覆盖期初余额。
 *
 * 硬约束(逐条拒绝,不做"尽量凑平"):
 *   · 只能写在账套启用期间;
 *   · 该期间必须未结账;
 *   · 借贷合计必须相等 —— 这是会计恒等式,不平的期初会让后续所有报表失真;
 *   · 科目必须存在、启用、且是末级科目。
 */
export async function setOpeningBalances(ledgerId: string, period: string, rows: OpeningRow[]) {
  const ledger = await getLedger(ledgerId)
  assertPeriod(period, 'period')
  if (period !== ledger.startPeriod) {
    throw new AppError(
      `期初余额只能写在启用期间 ${ledger.startPeriod}(收到 ${period})`,
      400,
      'FIN_OPENING_PERIOD_MISMATCH',
    )
  }
  const [close] = await db
    .select()
    .from(finPeriodClose)
    .where(and(eq(finPeriodClose.ledgerId, ledgerId), eq(finPeriodClose.period, period)))
  if (close?.status === 'closed') {
    throw new AppError('该期间已结账,期初余额不可修改', 409, 'FIN_PERIOD_CLOSED')
  }

  const accounts = await db
    .select()
    .from(finAccount)
    .where(and(eq(finAccount.ledgerId, ledgerId), eq(finAccount.enabled, true)))
  const byCode = new Map(accounts.map((a) => [a.code, a]))

  let debitTotal = 0
  let creditTotal = 0
  const normalized = rows.map((r, idx) => {
    const accountCode = r.accountCode?.trim()
    if (!accountCode) throw new AppError(`第 ${idx + 1} 行缺少科目编码`, 400, 'FIN_OPENING_BAD_ROW')
    const acc = byCode.get(accountCode)
    if (!acc)
      throw new AppError(`科目 ${accountCode} 不存在或已停用`, 400, 'FIN_OPENING_ACCOUNT_MISSING')
    if (!acc.isLeaf)
      throw new AppError(
        `科目 ${accountCode} 不是末级科目,不能直接挂余额`,
        400,
        'FIN_OPENING_NOT_LEAF',
      )
    const debit = toCents(r.debit ?? 0, `rows[${idx}].debit`)
    const credit = toCents(r.credit ?? 0, `rows[${idx}].credit`)
    if (debit < 0 || credit < 0) {
      throw new AppError(
        `第 ${idx + 1} 行金额不能为负(方向用借/贷两列表达)`,
        400,
        'FIN_OPENING_NEGATIVE',
      )
    }
    if (debit > 0 && credit > 0) {
      throw new AppError(`第 ${idx + 1} 行不能同时有借方与贷方金额`, 400, 'FIN_OPENING_BOTH_SIDES')
    }
    debitTotal += debit
    creditTotal += credit
    return {
      ledgerId,
      period,
      accountCode,
      debitAmount: fromCents(debit),
      creditAmount: fromCents(credit),
      aux: r.aux ?? {},
      updatedAt: new Date(),
    }
  })

  if (debitTotal !== creditTotal) {
    throw new AppError(
      `期初借贷不平衡:借方合计 ${fromCents(debitTotal)} ≠ 贷方合计 ${fromCents(creditTotal)},` +
        `差额 ${fromCents(debitTotal - creditTotal)}(请核对,系统不会自动配平)`,
      400,
      'FIN_OPENING_UNBALANCED',
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(finOpeningBalance)
      .where(and(eq(finOpeningBalance.ledgerId, ledgerId), eq(finOpeningBalance.period, period)))
    if (normalized.length > 0) {
      await tx.insert(finOpeningBalance).values(normalized)
    }
  })

  return {
    period,
    rows: normalized.length,
    debitTotal: fromCents(debitTotal),
    creditTotal: fromCents(creditTotal),
    balanced: true,
  }
}

/** 期初校验摘要(资产 = 负债 + 权益 的展示口径) */
export async function summarizeOpening(ledgerId: string, period?: string) {
  const ledger = await getLedger(ledgerId)
  const target = period ?? ledger.startPeriod
  const rows = await getOpeningBalances(ledgerId, target)
  const accounts = await listAccounts(ledgerId)
  const byCode = new Map(accounts.map((a) => [a.code, a]))
  const bucket = { asset: 0, liability: 0, equity: 0, cost: 0, pnl: 0 }
  for (const r of rows) {
    const cat = byCode.get(r.accountCode)?.category
    const d = toCents(r.debitAmount)
    const c = toCents(r.creditAmount)
    if (cat === 'asset') bucket.asset += d - c
    else if (cat === 'liability') bucket.liability += c - d
    else if (cat === 'equity') bucket.equity += c - d
    else if (cat === 'cost') bucket.cost += d - c
    else bucket.pnl += d - c
  }
  return {
    period: target,
    debitTotal: fromCents(sumCents(rows.map((r) => r.debitAmount))),
    creditTotal: fromCents(sumCents(rows.map((r) => r.creditAmount))),
    assets: fromCents(bucket.asset + bucket.cost),
    liabilities: fromCents(bucket.liability),
    equity: fromCents(bucket.equity),
    pnl: fromCents(bucket.pnl),
    equationDelta: fromCents(
      bucket.asset + bucket.cost - bucket.liability - bucket.equity - bucket.pnl,
    ),
  }
}

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  )
}

export { assertPeriod, nextPeriodOf as nextPeriod, prevPeriod } from './period.js'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
