// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skills 市场跨端共享类型(2026-07-23 立)。
 * 自研技能市场能力:IHUI-AI 补齐搜索/安装/评分分发闭环。
 */

export interface SkillMarketEntry {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  /** lucide 图标名(可选,前端按名渲染;缺省回退通用图标) */
  icon?: string
  installCount: number
  rating: number
  ratingCount: number
  createdAt: string
  updatedAt: string
  /**
   * listing 级上下架开关(P2-14 补齐,2026-09-25)。
   * 缺省即 true —— 既有种子数据与历史写入点都没有这个字段,按"未下架"解释,
   * 只有显式 false 才从市场列表隐身(下架不删条目,与 installCount/rating 一同保留)。
   */
  enabled?: boolean
  /**
   * 条目来源:builtin 平台内置 / user 用户上架 / hub 内部自进化同步写入。
   * 由服务端按调用身份推导(带 X-Internal-Secret 的走 hub,登录用户走 user),
   * 不接受客户端自报,否则等于把归属权交给请求体。
   */
  source?: 'builtin' | 'user' | 'hub'
  /**
   * 单次购买价格(人民币分,0 = 免费)。
   * 缺省按 0 解释,兼容价格字段落地前写入的历史条目。
   * 金额单位与钱包 `user_margins.token_quantity` 一致(1 分 = 1 余额单位),
   * 购买时按此价从买家钱包扣款,不做 VIP 折扣。
   */
  priceCents?: number
  /**
   * 作者分成比例(basis points,7000 = 70%)。
   * 由服务端按平台策略在发布时快照,后续调策略不改历史条目的分成口径;
   * 内置/无归属条目按 0 处理(全部归平台)。
   */
  revenueShareBps?: number
  /**
   * 上架者的用户 ID,owner 判定的唯一依据(服务端按 request.userId 比对此列)。
   * 内置种子与内部同步条目没有归属者 ⇒ 留空,任何人都不算 owner。
   *
   * **类型必须是 string:`users.id` 是 uuid(packages/database/src/schema/users.ts 的
   * `uuid('id').defaultRandom()`),而 request.userId 就是这个 uuid 原文。** 此前声明成
   * number、写入侧做 `Number(request.userId!)` ⇒ 生产环境恒为 NaN,而
   * `JSON.stringify(NaN)` 落成 `null`:归属者与自己条目的每一处 `===` 比较都必然为假
   * (NaN === NaN 为假),"本人可更新/下架自己的条目"在真机上永远 403,只有测试里塞数字
   * id 才看得见它工作。改回 string 后**不得**再在任何读写点强转。
   */
  ownerId?: string
}

export interface SkillRating {
  id: string
  /**
   * 与上面 `ownerId` 同族:`users.id` 是 uuid 原文,不得强转数字。
   * 此前这里写 `number`、写入侧做 `Number(userId)` ⇒ 落盘的是 `null`,
   * 评分记录从此查不回是谁评的(且 `userName` 显示成 `user-NaN` 的可能形态被掩盖)。
   */
  userId: string
  userName: string
  skillName: string
  score: number
  comment?: string
  createdAt: string
}

export interface SkillMarketQuery {
  q?: string
  tag?: string
  page?: number
  pageSize?: number
}

export interface SkillMarketListResponse {
  items: SkillMarketEntry[]
  total: number
  page: number
  pageSize: number
}

export interface SkillInstallResponse {
  name: string
  installed: boolean
  installCount: number
}

export interface SkillRateRequest {
  score: number
  comment?: string
}

/** 发布 skill 到市场的请求体。
 * content 为 skill 正文(供安装时复制到用户私有库),市场条目本身只存元数据。
 * priceCents 可选:0/缺省 = 免费;>0 表示单次买断价(人民币分)。
 * 作者分成比例不接受请求体自报,由服务端按平台策略快照。
 */
export interface SkillPublishRequest {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  content: string
  priceCents?: number
}

/** 发布端点响应(返回新建的市场条目) */
export type SkillPublishResponse = SkillMarketEntry

/** 购买并安装一个市场 Skill 的响应。 */
export interface SkillPurchaseResponse {
  name: string
  /** true = 已写入用户库并启用 */
  installed: boolean
  /** true = 这次调用实际发生了扣款(免费/已购/作者本人均为 false) */
  charged: boolean
  /** true = 本次之前已买过;不重复扣款 */
  alreadyPurchased: boolean
  /** true = 免费技能,未产生购买账本 */
  free: boolean
  priceCents: number
  authorShareCents: number
  platformShareCents: number
  currency: string
  /** 扣款后的钱包余额(未扣款时为 null) */
  balanceAfter: number | null
  installCount: number
}

/** 管理员退款购买记录后的响应。 */
export interface SkillPurchaseRefundResponse {
  purchaseId: string
  skillName: string
  buyerUserId: string
  alreadyRefunded: boolean
  refundedAmountCents: number
  /** 从卖家余额实际扣回的分成；余额不足时小于原分成，差额由平台承担。 */
  sellerClawbackCents: number
  buyerBalanceAfter: number | null
}

/** 管理员购买账本列表项（GET /admin/skills-market/purchases）。 */
export interface SkillMarketPurchaseAdminItem {
  id: string
  skillName: string
  skillVersion: string
  buyerUserId: string
  buyerNickname: string | null
  sellerUserId: string | null
  sellerNickname: string | null
  priceCents: number
  currency: string
  revenueShareBps: number
  authorShareCents: number
  platformShareCents: number
  /** paid = 在购；refunded = 已退款。 */
  status: 'paid' | 'refunded'
  createdAt: string
  refundedAt: string | null
  refundAmountCents: number
  /** 实际从卖家余额扣回的分成；NULL = 历史退款未记录。 */
  sellerClawbackCents: number | null
  refundReason: string | null
}

/** 管理员购买账本分页响应。 */
export interface SkillMarketPurchaseAdminListResponse {
  items: SkillMarketPurchaseAdminItem[]
  total: number
  page: number
  pageSize: number
}

/**
 * 技能市场结算口径（管理员，GET /admin/skills-market/settlement）。
 *
 * 与“钱包余额”区分：这是购买账本口径的成交/分成/退款汇总。
 * - grossSalesCents：所有成交订单（含后来退款）当时的成交额
 * - refundedGrossCents：已退款订单当时成交额
 * - netGmvCents = grossSalesCents - refundedGrossCents
 * - authorShareEarnedCents：所有成交订单作者应得分成（含后来退款）
 * - authorShareActiveCents：当前仍在购订单的作者分成
 * - authorShareOnRefundedCents：已退款订单原作者分成（应冲正）
 * - sellerClawbackCents：退款时实际从卖家余额扣回的分成
 * - platformBorneCents = authorShareOnRefundedCents - sellerClawbackCents（平台承担）
 * - authorNetCents = authorShareEarnedCents - sellerClawbackCents
 * - platformShareEarnedCents：所有成交订单平台分成
 * - platformShareActiveCents：当前仍在购订单的平台分成
 * - platformShareOnRefundedCents：已退款订单的平台分成（应冲正）
 * - platformNetCents = platformShareEarnedCents - platformShareOnRefundedCents - platformBorneCents
 */
export interface SkillMarketSettlementTotals {
  paidCount: number
  refundedCount: number
  grossSalesCents: number
  refundedGrossCents: number
  netGmvCents: number
  authorShareEarnedCents: number
  authorShareActiveCents: number
  authorShareOnRefundedCents: number
  sellerClawbackCents: number
  platformBorneCents: number
  authorNetCents: number
  platformShareEarnedCents: number
  platformShareActiveCents: number
  platformShareOnRefundedCents: number
  platformNetCents: number
  /** 已退款行中 seller_clawback_cents 为 NULL 的历史记录数；>0 时平台承担额不可精确复核。 */
  clawbackMissingCount: number
}

export interface SkillMarketSettlementRow extends SkillMarketSettlementTotals {
  skillName: string
  sellerUserId: string | null
  sellerNickname: string | null
}

/** 结算归期：按月下单时间归集；month=null 表示全部账期。 */
export interface SkillMarketSettlementPeriod {
  month: string | null
  /** 账期起点（含），ISO 字符串；全部账期时为 null。 */
  from: string | null
  /** 账期终点（不含），ISO 字符串；全部账期时为 null。 */
  to: string | null
}

export interface SkillMarketSettlementResponse {
  summary: SkillMarketSettlementTotals
  items: SkillMarketSettlementRow[]
  currency: 'CNY'
  period: SkillMarketSettlementPeriod
}

/** 卖家账户对账标记（只提示，不自动改账）。 */
export type SkillSellerAccountFlag =
  | 'platform_borne'
  | 'clawback_missing'
  | 'negative_wallet'
  | 'commission_mismatch'

/**
 * 技能市场卖家账户对账行（GET /admin/skills-market/seller-accounts）。
 *
 * 交易口径按账期从购买账本聚合；余额/提现/佣金是**当前**账户快照，不按账期回放。
 * `commissionGapCents = skillActiveCommissionCents - authorShareActiveCents`，
 * 正常应为 0；非 0 说明有效作者分成与有效技能佣金流水对不上，需要人工核查。
 */
export interface SkillSellerAccountRow {
  sellerUserId: string
  sellerNickname: string | null
  paidCount: number
  refundedCount: number
  grossSalesCents: number
  refundedGrossCents: number
  netGmvCents: number
  authorShareEarnedCents: number
  authorShareActiveCents: number
  authorShareOnRefundedCents: number
  sellerClawbackCents: number
  platformBorneCents: number
  authorNetCents: number
  /** 当前仍有效的技能作者分成佣金流水（type=3, status=1），全生命周期。 */
  skillActiveCommissionCents: number
  /** 当前已冲正的技能作者分成佣金流水（type=3, status=0），全生命周期。 */
  skillInvalidCommissionCents: number
  /** 当前账户全部有效佣金（含技能与其他类型）。 */
  activeCommissionCents: number
  /** 当前钱包可用余额（user_margins.token_quantity）。 */
  walletBalanceCents: number
  /** 在途/已完成提现按毛额占用；与可提现口径一致。 */
  withdrawalOccupiedCents: number
  pendingWithdrawalCents: number
  completedWithdrawalCents: number
  /** max(0, 全部有效佣金 - 提现占用)，与 /finance/withdrawal/available 同口径。 */
  withdrawableCents: number
  /** 有效技能佣金 - 有效作者分成；正常为 0。 */
  commissionGapCents: number
  flags: SkillSellerAccountFlag[]
}

export interface SkillSellerAccountsSummary {
  sellers: number
  platformBorneCents: number
  walletBalanceCents: number
  withdrawableCents: number
  mismatchCount: number
}

export interface SkillSellerAccountsResponse {
  items: SkillSellerAccountRow[]
  summary: SkillSellerAccountsSummary
  currency: 'CNY'
  period: SkillMarketSettlementPeriod
}

/** 作者收益明细单条（不暴露买家身份；退款按实际扣回冲减）。 */
export interface SkillEarningsItem {
  id: string
  skillName: string
  priceCents: number
  authorShareCents: number
  /** 退款时实际从作者余额扣回的分成；在购/历史未知退款为 null。 */
  sellerClawbackCents: number | null
  /** 作者实际留存 = authorShareCents - (sellerClawbackCents ?? 0)。 */
  netAuthorShareCents: number
  revenueShareBps: number
  status: 'paid' | 'refunded'
  createdAt: string
  refundedAt: string | null
}

/** 作者收益汇总(GET /skills/market/earnings)。 */
export interface SkillEarningsResponse {
  /** 全部销售（含后来退款）的作者分成毛额。 */
  totalAuthorShareCents: number
  /** 退款实际扣回的分成。 */
  sellerClawbackCents: number
  /** 作者实际留存 = totalAuthorShareCents - sellerClawbackCents。 */
  netAuthorShareCents: number
  paidCount: number
  refundedCount: number
  currency: string
  lastEarnedAt: string | null
  items: SkillEarningsItem[]
}

/** 订阅状态查询响应 */
export interface SkillSubscriptionResponse {
  subscribed: boolean
  subscriberCount: number
}

/** Skill 更新通知(存储于 Redis List skill-notifications:<userId>) */
export interface SkillNotification {
  id: string
  skillName: string
  message: string
  version?: string
  timestamp: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
