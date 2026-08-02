/**
 * USDT 加密货币支付网关核心 service(2026-08-01 立)。
 *
 * 职责:
 * 1. getUsdtPaymentConfig / setUsdtPaymentConfig: 配置读写(存 system_configs 表,category='usdt_payment')
 * 2. createUsdtPayment: 创建充值订单(TRC20/ERC20),生成/复用充值地址,30 分钟过期
 * 3. checkUsdtPaymentStatus: 查询区块链 API(TronGrid for TRC20, Etherscan for ERC20)确认到账
 * 4. confirmUsdtPayment: 确认到账 + 更新 wallet 余额 + 记录流水(事务 + 幂等)
 * 5. pollPendingUsdtPayments: 批量轮询 pending 订单(供 BullMQ Worker 调用,TODO)
 * 6. listUserUsdtPayments / getUsdtPaymentDetail: 用户查询自己的订单
 * 7. listAllUsdtPayments: admin 查所有订单(支持筛选)
 *
 * 充值地址:从 env USDT_TRC20_ADDRESS / USDT_ERC20_ADDRESS 读取(不入库)。
 * 汇率:存 system_configs(key='usdt_payment.rate'),默认 1.0(1 USDT = 1 USD = 100 cents)。
 * 区块链 API key:从 env TRONGRID_API_KEY / ETHERSCAN_API_KEY 读取。
 *
 * 金额转换:
 *   amountCents(用户充值金额,分) → USDT amount = amountCents / 100 / rate
 *   amountPaid(实收 USDT) → tokens credited = round(amountPaid × rate × 100)
 */
import { eq, and, sql, desc, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { usdtPayments, systemConfigs, userMargins, tokenFlows } from '@ihui/database'
import type { UsdtPayment } from '@ihui/database'
import { generateOrderNumber } from '../utils/crypto-random.js'

// =============================================================================
// 常量
// =============================================================================

/** USDT 配置在 system_configs 表中的 category */
const USDT_CONFIG_CATEGORY = 'usdt_payment'

/** USDT 配置 key 前缀 */
const USDT_CONFIG_KEY_PREFIX = 'usdt_payment.'

/** 默认汇率(1 USDT = 1 USD) */
const DEFAULT_RATE = 1.0

/** 订单过期时间(分钟) */
const ORDER_EXPIRY_MINUTES = 30

/** USDT 小数位数(TRC20 和 ERC20 均为 6 位) */
const USDT_DECIMALS = 6

/** TRC20 USDT 合约地址(波场链上 USDT 代币合约) */
const TRC20_USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

/** ERC20 USDT 合约地址(以太坊主网 USDT 代币合约) */
const ERC20_USDT_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

/** 支持的网络列表 */
const SUPPORTED_NETWORKS = ['TRC20', 'ERC20'] as const

/** tokenFlows.opType: 0=充值 */
const FLOW_OP_RECHARGE = 0

// =============================================================================
// 类型定义
// =============================================================================

export type UsdtNetwork = (typeof SUPPORTED_NETWORKS)[number]

export interface UsdtPaymentConfig {
  /** USDT 兑 USD 汇率(1.0 = 1:1) */
  rate: number
  /** 支持的网络列表 */
  supportedNetworks: string[]
  /** TRC20 固定充值地址(从 env 读取) */
  trc20Address: string | null
  /** ERC20 固定充值地址(从 env 读取) */
  erc20Address: string | null
}

export interface CreateUsdtPaymentResult {
  orderId: string
  address: string
  network: string
  amount: number
  expiresAt: Date
  rate: number
}

export interface UsdtPaymentStatusResult {
  orderId: string
  status: string
  detected: boolean
  txHash: string | null
  amountPaid: number | null
}

export interface ConfirmResult {
  orderId: string
  status: string
  tokensCredited: number
}

export interface PollResult {
  checked: number
  confirmed: number
  failed: number
}

export interface ListResult {
  records: UsdtPayment[]
  total: number
}

export interface ListAllFilter {
  userId?: string
  status?: string
  network?: string
  page?: number
  pageSize?: number
}

// =============================================================================
// 区块链 API 响应类型
// =============================================================================

interface TronGridTrc20Tx {
  transaction_id: string
  value: string
  to: string
  from: string
  block_timestamp: number
}

interface TronGridResponse {
  data: TronGridTrc20Tx[]
  success: boolean
}

interface EtherscanTokenTx {
  hash: string
  value: string
  to: string
  from: string
  timeStamp: string
  tokenDecimal: string
}

interface EtherscanResponse {
  status: string
  message: string
  result: EtherscanTokenTx[]
}

interface BlockchainDetection {
  txHash: string
  amountPaid: number
}

// =============================================================================
// 1. 配置读写
// =============================================================================

/**
 * 读取 USDT 支付配置(从 system_configs 表 + 环境变量)。
 * - rate / supportedNetworks:从 system_configs 读取(未配置用默认值)
 * - trc20Address / erc20Address:从 env 读取(安全考虑,不入库)
 */
export async function getUsdtPaymentConfig(): Promise<UsdtPaymentConfig> {
  const rows = await dbRead
    .select({ key: systemConfigs.key, value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.category, USDT_CONFIG_CATEGORY))

  const map = new Map(rows.map((r) => [r.key, r.value]))

  const rate = parseNumber(map.get(`${USDT_CONFIG_KEY_PREFIX}rate`), DEFAULT_RATE)
  const networksRaw =
    map.get(`${USDT_CONFIG_KEY_PREFIX}supported_networks`) ?? SUPPORTED_NETWORKS.join(',')
  const supportedNetworks = networksRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    rate,
    supportedNetworks,
    trc20Address: process.env.USDT_TRC20_ADDRESS ?? null,
    erc20Address: process.env.USDT_ERC20_ADDRESS ?? null,
  }
}

/**
 * 更新 USDT 支付配置(upsert system_configs 表,admin 用)。
 * 仅传非 undefined 的字段,未传字段保持原值。
 */
export async function setUsdtPaymentConfig(
  patch: Partial<Pick<UsdtPaymentConfig, 'rate' | 'supportedNetworks'>>,
  updatedBy?: string,
): Promise<UsdtPaymentConfig> {
  const entries: Array<{ key: string; value: string }> = []
  if (patch.rate !== undefined) {
    entries.push({ key: 'rate', value: String(patch.rate) })
  }
  if (patch.supportedNetworks !== undefined) {
    entries.push({ key: 'supported_networks', value: patch.supportedNetworks.join(',') })
  }

  for (const e of entries) {
    const fullKey = `${USDT_CONFIG_KEY_PREFIX}${e.key}`
    await db
      .insert(systemConfigs)
      .values({
        key: fullKey,
        value: e.value,
        type: e.key === 'rate' ? 'number' : 'string',
        category: USDT_CONFIG_CATEGORY,
        description: `USDT 支付配置(${e.key})`,
        isPublic: false,
        updatedBy: updatedBy ?? null,
      })
      .onConflictDoUpdate({
        target: systemConfigs.key,
        set: { value: e.value, updatedBy: updatedBy ?? null, updatedAt: new Date() },
      })
  }

  return getUsdtPaymentConfig()
}

// =============================================================================
// 2. createUsdtPayment — 创建充值订单
// =============================================================================

/**
 * 创建 USDT 充值订单。
 *
 * 逻辑:
 * 1. 校验 network 支持(TRC20 / ERC20)
 * 2. 从 env 读取对应链的充值地址
 * 3. 读取汇率,计算应收 USDT 数量 = amountCents / 100 / rate
 * 4. 生成订单号(USDT 前缀),设置 30 分钟过期
 * 5. 写入 usdt_payments 表,status='pending'
 *
 * 边界:
 * - network 不支持 → 抛错
 * - env 充值地址未配置 → 抛错
 * - amountCents <= 0 → 抛错
 */
export async function createUsdtPayment(
  userId: string,
  amountCents: number,
  network: string,
): Promise<CreateUsdtPaymentResult> {
  if (amountCents <= 0) {
    throw Object.assign(new Error('充值金额必须大于 0'), { statusCode: 400 })
  }

  const upperNetwork = network.toUpperCase()
  if (!SUPPORTED_NETWORKS.includes(upperNetwork as UsdtNetwork)) {
    throw Object.assign(
      new Error(`不支持的网络: ${network},仅支持 ${SUPPORTED_NETWORKS.join('/')}`),
      {
        statusCode: 400,
      },
    )
  }

  const config = await getUsdtPaymentConfig()
  const address = upperNetwork === 'TRC20' ? config.trc20Address : config.erc20Address
  if (!address) {
    throw Object.assign(
      new Error(`${upperNetwork} 充值地址未配置(请设置环境变量 USDT_${upperNetwork}_ADDRESS)`),
      {
        statusCode: 500,
      },
    )
  }

  const usdtAmount = amountCents / 100 / config.rate
  const orderId = generateOrderNumber('USDT')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + ORDER_EXPIRY_MINUTES * 60 * 1000)

  await db.insert(usdtPayments).values({
    orderId,
    userId,
    address,
    network: upperNetwork,
    amount: usdtAmount.toFixed(8),
    amountPaid: '0',
    status: 'pending',
    expiresAt,
    createdAt: now,
  })

  return {
    orderId,
    address,
    network: upperNetwork,
    amount: usdtAmount,
    expiresAt,
    rate: config.rate,
  }
}

// =============================================================================
// 3. checkUsdtPaymentStatus — 查询区块链确认到账
// =============================================================================

/**
 * 查询订单的支付状态(含区块链到账检测)。
 *
 * 逻辑:
 * 1. 读取订单,若非 pending 直接返回当前状态
 * 2. 若已过期(status='pending' AND expires_at < now)→ 标记 expired,返回
 * 3. 调用区块链 API 查询充值地址的近期转入交易
 * 4. 匹配金额 >= 应收金额的交易 → 返回 detected=true + txHash + amountPaid
 *
 * 区块链 API:
 * - TRC20:TronGrid /v1/accounts/{address}/transactions/trc20
 * - ERC20:Etherscan /api?module=account&action=tokentx
 */
export async function checkUsdtPaymentStatus(orderId: string): Promise<UsdtPaymentStatusResult> {
  const [order] = await dbRead
    .select()
    .from(usdtPayments)
    .where(eq(usdtPayments.orderId, orderId))
    .limit(1)

  if (!order) {
    throw Object.assign(new Error('订单不存在'), { statusCode: 404 })
  }

  // 非 pending 状态直接返回
  if (order.status !== 'pending') {
    return {
      orderId,
      status: order.status,
      detected: order.status === 'confirmed',
      txHash: order.txHash,
      amountPaid: order.amountPaid !== '0' ? Number(order.amountPaid) : null,
    }
  }

  // 检查过期
  const now = new Date()
  if (order.expiresAt < now) {
    await db
      .update(usdtPayments)
      .set({ status: 'expired' })
      .where(and(eq(usdtPayments.orderId, orderId), eq(usdtPayments.status, 'pending')))
    return { orderId, status: 'expired', detected: false, txHash: null, amountPaid: null }
  }

  // 调用区块链 API 检测到账
  const expectedAmount = Number(order.amount)
  const sinceTimestamp = order.createdAt.getTime()
  let detection: BlockchainDetection | null = null

  try {
    if (order.network === 'TRC20') {
      detection = await checkTrc20Payment(order.address, expectedAmount, sinceTimestamp)
    } else if (order.network === 'ERC20') {
      detection = await checkErc20Payment(order.address, expectedAmount, sinceTimestamp)
    }
  } catch (err) {
    // 区块链 API 故障不阻断,返回 pending 等待下次轮询
    console.error(`[usdt-payment] 区块链 API 查询失败(orderId=${orderId}):`, err instanceof Error ? err.message : String(err))
    return { orderId, status: 'pending', detected: false, txHash: null, amountPaid: null }
  }

  if (detection && detection.amountPaid >= expectedAmount) {
    return {
      orderId,
      status: 'pending',
      detected: true,
      txHash: detection.txHash,
      amountPaid: detection.amountPaid,
    }
  }

  return { orderId, status: 'pending', detected: false, txHash: null, amountPaid: null }
}

/**
 * 查询 TronGrid TRC20 转入交易,匹配应收金额。
 */
async function checkTrc20Payment(
  address: string,
  expectedAmount: number,
  sinceTimestamp: number,
): Promise<BlockchainDetection | null> {
  const apiKey = process.env.TRONGRID_API_KEY
  const params = new URLSearchParams({
    limit: '50',
    order_by: 'block_timestamp,desc',
    contract_address: TRC20_USDT_CONTRACT,
    only_to: 'true',
  })
  const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?${params}`
  const headers: Record<string, string> = {}
  if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey

  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`TronGrid API 返回 ${response.status}`)
  }

  const data = (await response.json()) as TronGridResponse
  if (!data.success || !data.data) return null

  for (const tx of data.data) {
    if (tx.to !== address) continue
    if (tx.block_timestamp < sinceTimestamp) continue
    const amount = Number(tx.value) / Math.pow(10, USDT_DECIMALS)
    if (amount >= expectedAmount) {
      return { txHash: tx.transaction_id, amountPaid: amount }
    }
  }

  return null
}

/**
 * 查询 Etherscan ERC20 转入交易,匹配应收金额。
 */
async function checkErc20Payment(
  address: string,
  expectedAmount: number,
  sinceTimestamp: number,
): Promise<BlockchainDetection | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY
  const params = new URLSearchParams({
    module: 'account',
    action: 'tokentx',
    address,
    contractaddress: ERC20_USDT_CONTRACT,
    page: '1',
    offset: '50',
    sort: 'desc',
  })
  if (apiKey) params.set('apikey', apiKey)
  const url = `https://api.etherscan.io/api?${params}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Etherscan API 返回 ${response.status}`)
  }

  const data = (await response.json()) as EtherscanResponse
  if (data.status !== '1' || !Array.isArray(data.result)) return null

  for (const tx of data.result) {
    if (tx.to.toLowerCase() !== address.toLowerCase()) continue
    if (Number(tx.timeStamp) * 1000 < sinceTimestamp) continue
    const decimals = Number(tx.tokenDecimal) || USDT_DECIMALS
    const amount = Number(tx.value) / Math.pow(10, decimals)
    if (amount >= expectedAmount) {
      return { txHash: tx.hash, amountPaid: amount }
    }
  }

  return null
}

// =============================================================================
// 4. confirmUsdtPayment — 确认到账 + 更新 wallet 余额 + 记录流水
// =============================================================================

/**
 * 确认 USDT 支付到账(事务 + 幂等)。
 *
 * 逻辑:
 * 1. 原子翻转 status: pending → confirmed(WHERE status='pending',防并发)
 * 2. 计算 tokens = round(amountPaid × rate × 100)
 * 3. 事务内:更新 usdt_payments + 更新 user_margins.tokenQuantity + 插入 token_flows
 * 4. token_flows 的 (relatedOrderNo, opType) 唯一索引兜底防重复入账
 *
 * 幂等:
 * - status 已非 pending → 返回当前状态,不重复入账
 * - token_flows 唯一索引 → 即使并发也只入一条
 */
export async function confirmUsdtPayment(
  orderId: string,
  txHash: string,
  amountPaid: number,
): Promise<ConfirmResult> {
  const [order] = await dbRead
    .select()
    .from(usdtPayments)
    .where(eq(usdtPayments.orderId, orderId))
    .limit(1)

  if (!order) {
    throw Object.assign(new Error('订单不存在'), { statusCode: 404 })
  }

  if (order.status === 'confirmed') {
    // 2026-08-02 修复:已确认订单幂等返回,记录日志便于排查重复回调
    console.info(
      `[usdt-payment] 订单 ${orderId} 已确认,跳过重复回调(txHash=${txHash})`,
    )
    return { orderId, status: 'confirmed', tokensCredited: 0 }
  }

  if (order.status !== 'pending') {
    throw Object.assign(new Error(`订单状态为 ${order.status},无法确认`), { statusCode: 400 })
  }

  const config = await getUsdtPaymentConfig()
  const tokensCredited = Math.round(amountPaid * config.rate * 100)
  const now = new Date()

  const result = await db.transaction(async (tx) => {
    // 1. 原子翻转 status(只有 pending 才翻转,防并发)
    const [updated] = await tx
      .update(usdtPayments)
      .set({
        status: 'confirmed',
        txHash,
        amountPaid: amountPaid.toFixed(8),
        confirmedAt: now,
      })
      .where(and(eq(usdtPayments.orderId, orderId), eq(usdtPayments.status, 'pending')))
      .returning({ id: usdtPayments.id, userId: usdtPayments.userId })

    if (!updated) {
      // 2026-08-02 修复:原子更新返回 0 行表示已被并发确认,幂等跳过(防重复入账)
      // TODO: 后续在 usdt_payments.tx_hash 上加唯一约束,防同一 txHash 绑定多个订单
      console.info(
        `[usdt-payment] 订单 ${orderId} 原子更新未命中(已并发确认),跳过(txHash=${txHash})`,
      )
      return { confirmed: false, userId: null as string | null, tokensCredited: 0 }
    }

    // 2. 更新 wallet 余额(user_margins.tokenQuantity += tokens)
    const [margin] = await tx
      .select()
      .from(userMargins)
      .where(eq(userMargins.userId, updated.userId))
      .limit(1)

    const newBalance = (margin?.tokenQuantity ?? 0) + tokensCredited
    if (margin) {
      await tx
        .update(userMargins)
        .set({ tokenQuantity: newBalance, updatedAt: now })
        .where(eq(userMargins.userId, updated.userId))
    } else {
      await tx.insert(userMargins).values({
        userId: updated.userId,
        tokenQuantity: newBalance,
        frozenQuantity: 0,
        updatedAt: now,
      })
    }

    // 3. 记录流水(token_flows,opType=0 充值,幂等键 relatedOrderNo + opType)
    await tx.insert(tokenFlows).values({
      userId: updated.userId,
      opType: FLOW_OP_RECHARGE,
      quantity: tokensCredited,
      balanceAfter: newBalance,
      remark: `USDT 充值(${order.network}) ${amountPaid} USDT`,
      relatedOrderNo: orderId,
      createdAt: now,
    })

    return { confirmed: true, userId: updated.userId, tokensCredited }
  })

  if (!result.confirmed) {
    return { orderId, status: 'confirmed', tokensCredited: 0 }
  }

  return { orderId, status: 'confirmed', tokensCredited: result.tokensCredited }
}

// =============================================================================
// 5. pollPendingUsdtPayments — 批量轮询 pending 订单
// =============================================================================

/**
 * 批量轮询 pending 订单,检测到账并自动确认(供 BullMQ Worker 调用)。
 *
 * 逻辑:
 * 1. 查询 status='pending' AND expires_at > now 的订单(批量,默认 50 条)
 * 2. 对每条调 checkUsdtPaymentStatus
 * 3. 若 detected=true,调 confirmUsdtPayment
 * 4. 返回统计
 *
 * TODO:接入 BullMQ Worker 定时调用(cron 每 1 分钟)。
 */
export async function pollPendingUsdtPayments(batchSize = 50): Promise<PollResult> {
  const now = new Date()
  // 查询未过期的 pending 订单(status='pending' AND expires_at > now)
  const validPending = await dbRead
    .select({ orderId: usdtPayments.orderId })
    .from(usdtPayments)
    .where(and(eq(usdtPayments.status, 'pending'), sql`${usdtPayments.expiresAt} > ${now}`))
    .limit(batchSize)

  let checked = 0
  let confirmed = 0
  let failed = 0

  for (const { orderId } of validPending) {
    checked++
    try {
      const status = await checkUsdtPaymentStatus(orderId)
      if (status.detected && status.txHash && status.amountPaid) {
        await confirmUsdtPayment(orderId, status.txHash, status.amountPaid)
        confirmed++
      }
    } catch (err) {
      console.error(`[usdt-payment] 轮询订单 ${orderId} 失败:`, err instanceof Error ? err.message : String(err))
      failed++
    }
  }

  return { checked, confirmed, failed }
}

// =============================================================================
// 6. listUserUsdtPayments / getUsdtPaymentDetail — 用户查询
// =============================================================================

/**
 * 查询用户的 USDT 充值订单(分页,强制 userId 过滤)。
 */
export async function listUserUsdtPayments(
  userId: string,
  page: number,
  pageSize: number,
): Promise<ListResult> {
  const p = Math.max(1, page)
  const ps = Math.min(100, Math.max(1, pageSize))
  const where = eq(usdtPayments.userId, userId)

  const [records, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(usdtPayments)
      .where(where)
      .orderBy(desc(usdtPayments.createdAt))
      .limit(ps)
      .offset((p - 1) * ps),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(usdtPayments)
      .where(where),
  ])

  return { records, total: totalRows[0]?.c ?? 0 }
}

/**
 * 查询订单详情(可选 userId 过滤,用户端调用时传 userId 防越权)。
 */
export async function getUsdtPaymentDetail(
  orderId: string,
  userId?: string,
): Promise<UsdtPayment | null> {
  const conds: SQL[] = [eq(usdtPayments.orderId, orderId)]
  if (userId) conds.push(eq(usdtPayments.userId, userId))

  const [record] = await dbRead
    .select()
    .from(usdtPayments)
    .where(and(...conds))
    .limit(1)

  return record ?? null
}

// =============================================================================
// 7. listAllUsdtPayments — admin 查所有订单
// =============================================================================

/**
 * admin 查询所有 USDT 充值订单(支持筛选 + 分页)。
 */
export async function listAllUsdtPayments(filter: ListAllFilter): Promise<ListResult> {
  const page = Math.max(1, filter.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20))

  const conds: SQL[] = []
  if (filter.userId) conds.push(eq(usdtPayments.userId, filter.userId))
  if (filter.status) conds.push(eq(usdtPayments.status, filter.status))
  if (filter.network) conds.push(eq(usdtPayments.network, filter.network.toUpperCase()))
  const where = conds.length > 0 ? and(...conds) : undefined

  const [records, totalRows] = await Promise.all([
    dbRead
      .select()
      .from(usdtPayments)
      .where(where)
      .orderBy(desc(usdtPayments.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    dbRead
      .select({ c: sql<number>`count(*)::int` })
      .from(usdtPayments)
      .where(where),
  ])

  return { records, total: totalRows[0]?.c ?? 0 }
}

// =============================================================================
// 工具函数
// =============================================================================

/** 安全解析数字字符串,失败或 NaN 返回默认值 */
function parseNumber(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
