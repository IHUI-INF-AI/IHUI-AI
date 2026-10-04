// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * packages/types/src/app.ts 的业务域拆分产物之一 —— 本文件承载「commerce」域。
 *
 * 拆分原因:原 app.ts 单文件行数已超架构契约表对受管模块的单文件上限(config/architecture-policy.yaml
 * 的 contract-file-lines / C1),按业务域拆多入口是既定出路(EX-C2-1 的理由原文即此)。
 * 公开导出面由 ./app.ts 这个 barrel 用 export * 原样递出,与拆分前逐名等值 —— 消费端不得因此改动。
 * 要加类型请加到对应域文件;不要让类型回到 app.ts(app.ts 只允许再导出)。
 */

import type { TFunction } from './app-shared.js'


/**
 * 订单状态(用户端共享屏展示子集,与后端 /api/orders 契约对齐)。
 *
 * 注意:admin-types.ts 的 `OrderStatus` 是后台完整状态机(7 值含 refunding/failed),
 * 此处 `AppOrderStatus` 是用户端展示子集(含 shipped 实物发货),两者语义不同,
 * 故加 `App` 前缀避免 `export *` 冲突。
 */
export type AppOrderStatus =
  'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded' | string

/** 订单 Tab */
export type OrderTab = 'all' | 'pending' | 'paid' | 'shipped' | 'completed' | string

/** 订单列表项(平台注入,字段对齐 mobile-rn OrderScreen Order) */
export interface OrderItem {
  id: string
  orderNo: string
  title: string
  /** 商品图 URL,有值则卡片渲染 130×130 圆角图 */
  image?: string
  amount: number
  status: AppOrderStatus
  createdAt: string
}

/** Order 屏 props */
export interface OrderScreenProps {
  t: TFunction
  items: OrderItem[]
  /** 当前激活 tab */
  activeTab: OrderTab
  /** tab 切换回调,平台注入重新拉取逻辑 */
  onSelectTab: (tab: OrderTab) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击订单卡片回调,平台注入导航跳转 */
  onPressItem: (item: OrderItem) => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 钱包余额信息(平台注入,字段对齐 @ihui/api-client WalletBalance) */
export interface WalletBalance {
  /** 可用余额 */
  balance: number
  /** 冻结金额 */
  frozenBalance: number
  /** 累计充值 */
  totalRecharge: number
  /** 累计提现 */
  totalWithdraw: number
}

/** 钱包记录类型(与后端 /api/wallet/records 契约对齐) */
export type WalletRecordType =
  'recharge' | 'withdraw' | 'consume' | 'refund' | 'commission' | string

/** 钱包记录列表项(平台注入) */
export interface WalletRecordItem {
  id: string
  amount: number
  balanceAfter: number
  type: WalletRecordType
  status: string
  payMethod: string | null
  remark: string | null
  createdAt: string
}

/** Wallet 屏 props */
export interface WalletScreenProps {
  t: TFunction
  balance: WalletBalance | null
  loading: boolean
  error: string
  onRefresh: () => void
  /** 点击充值/提现等操作回调,平台注入导航跳转 */
  onAction?: (action: 'recharge' | 'withdraw') => void
  onBack: () => void
  /** 已解析配色方案,驱动 tokens 明暗;默认 'light' */
  colorScheme?: 'light' | 'dark'
}

/** 退款状态(用户端共享屏展示子集,与后端 /api/refund 契约对齐)。
 * 注意:admin-types.ts 的 `RefundStatus` 是后台完整状态机,此处 `AppRefundStatus` 是用户端展示子集,
 * 加 `App` 前缀避免 `export *` 冲突(同 `AppOrderStatus` 模式)。
 */
export type AppRefundStatus = 'pending' | 'approved' | 'rejected' | 'refunded' | string

/** 退款历史列表项(平台注入,字段对齐 mobile-rn RefundHistoryScreen Item) */
export interface RefundHistoryItem {
  id: string
  amount: number
  status: AppRefundStatus
  reason: string
  createdAt: string
}

/** RefundHistory 屏 props */
export interface RefundHistoryScreenProps {
  t: TFunction
  items: RefundHistoryItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  /** 点击退款卡片回调,平台注入导航跳转 */
  onPressItem: (item: RefundHistoryItem) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 退款详情(平台注入,字段对齐 mobile-rn RefundDetailScreen Detail) */
export interface RefundDetailItem {
  id: string
  orderNo: string
  amount: number
  status: string
  reason: string
  createdAt: string
}

/** RefundDetail 屏 props */
export interface RefundDetailScreenProps {
  t: TFunction
  item: RefundDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 订单详情(平台注入,字段对齐 mobile-rn OrderDetailScreen OrderDetail) */
export interface OrderDetailItem {
  id: string
  orderNo: string
  amount: number
  status: string
  productName: string
  createdAt: string
  paidAt?: string
}

/** OrderDetail 屏 props */
export interface OrderDetailScreenProps {
  t: TFunction
  item: OrderDetailItem | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** WithdrawScreen props(表单屏,状态由 wrapper 管理,共享层只负责渲染) */
export interface WithdrawScreenProps {
  t: TFunction
  amount: string
  bankCardId: string
  loading: boolean
  error: string
  success: string
  onAmountChange: (text: string) => void
  onBankCardIdChange: (text: string) => void
  onSubmit: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 批次 10(2026-07-29):订单日志/订单跟踪/课程章节/学习进度 */

/** 订单日志项(平台注入,字段对齐 mobile-rn OrderLogScreen Item) */
export interface OrderLogItem {
  id: string
  action: string
  operator: string
  time: string
  note: string
}

/** OrderLogScreen props */
export interface OrderLogScreenProps {
  t: TFunction
  items: OrderLogItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 订单跟踪项(平台注入,字段对齐 mobile-rn OrderTrackScreen Item) */
export interface OrderTrackItem {
  id: string
  status: string
  time: string
  location: string
  desc: string
}

/** OrderTrackScreen props */
export interface OrderTrackScreenProps {
  t: TFunction
  items: OrderTrackItem[]
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 优惠券状态 */
export type CouponStatus = 'available' | 'used' | 'expired' | string

/** 优惠券列表项(平台注入,字段对齐 mobile-rn CouponScreen CouponItem) */
export interface CouponItem {
  id: string
  name: string
  amount: number
  minSpend: number
  validUntil: string
  status: CouponStatus
}

/** CouponScreen props */
export interface CouponScreenProps {
  t: TFunction
  items: CouponItem[]
  activeTab: CouponStatus
  onSelectTab: (tab: CouponStatus) => void
  loading: boolean
  refreshing: boolean
  error: string
  onRefresh: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 收益记录(对齐 mobile-rn IncomeScreen CommissionItem) */
export interface IncomeCommissionItem {
  id: string
  title: string
  amount: number
  time: string
  settled: boolean
  /** 关联订单号(复制按钮用;后端无订单数据时为 undefined) */
  orderId?: string
  /** 是否取消结算(后端无该状态时为 undefined,与 settled=false 的待结算区分) */
  cancelled?: boolean
}
export interface IncomeData {
  /** 累计收益(overview.totalCommission,分) */
  totalEarnings: number
  /** 今日收益(day-month-summary daySummary 今日合计,分) */
  todayCommission: number
  /** 可提现余额(overview.availableCommission,分) */
  balance: number
  /** 待结算佣金(overview.pendingCommission,分) */
  pendingCommission: number
  /** 已提现(overview.withdrawnCommission,分) */
  withdrawnCommission: number
  list: IncomeCommissionItem[]
}
export interface IncomeScreenProps {
  t: TFunction
  data: IncomeData
  loading: boolean
  error: string
  onWithdraw: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 模型收益 Tab key(全部/待结算/已结算) */
export type ModelIncomeTab = 'all' | 'pending' | 'settled' | string

/** 模型收益列表项(平台注入,字段对齐 mobile-rn ModelIncomeScreen CommissionRecord) */
export interface ModelIncomeItem {
  id: string
  orderId: string
  /** 结算状态(原始 status 字段,'settled'/'2' 视为已结算) */
  status: string
  createdAt: string
  userNickname: string
  orderAmount: number
  /** 佣金费率(百分比) */
  rate: number
  commissionAmount: number
}

/** 模型收益概要(平台注入,字段对齐 @ihui/api-client CommissionOverview + DayMonthSummary) */
export interface ModelIncomeSummary {
  /** 累计收益 */
  totalCommission: number
  /** 可提现 */
  availableCommission: number
  /** 已提现 */
  withdrawnCommission: number
  /** 待结算 */
  pendingCommission: number
  /** 今日收益 */
  day: number
}

/** ModelIncomeScreen props */
export interface ModelIncomeScreenProps {
  t: TFunction
  items: ModelIncomeItem[]
  summary: ModelIncomeSummary | null
  loading: boolean
  refreshing: boolean
  error: string
  activeTab: ModelIncomeTab
  onSelectTab: (tab: ModelIncomeTab) => void
  onRefresh: () => void
  /** 提现弹窗可见性(wrapper 控制) */
  showWithdrawModal: boolean
  onOpenWithdraw: () => void
  onCloseWithdraw: () => void
  onConfirmWithdraw: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** Token 记录 Tab key(全部/消耗/充值) */
export type TokenRecordType = 'all' | 'cost' | 'recharge' | string

/** Token 余额(平台注入,字段对齐 @ihui/api-client TokenBalance,补充 frozen 占位) */
export interface TokenValueBalance {
  /** 可用算力 */
  balance: number
  /** 冻结(TokenBalance API 不返回,占位 0) */
  frozen: number
  /** 累计消耗 */
  totalUsed: number
}

/** Token 流水记录项(平台注入,合并消耗 + 充值,字段对齐 mobile-rn TokenValueScreen Record) */
export interface TokenValueRecord {
  id: string
  type: 'cost' | 'recharge'
  title: string
  /** 金额(消耗为负,充值为正) */
  amount: number
  /** 已格式化的时间文本 */
  time: string
}

/** Token 充值套餐(产品配置,静态前端数据,字段对齐 mobile-rn TokenValueScreen Package) */
export interface TokenValuePackage {
  id: string
  tokens: number
  price: number
  bonus: number
  popular?: boolean
}

/** TokenValueScreen props */
export interface TokenValueScreenProps {
  t: TFunction
  balance: TokenValueBalance | null
  records: TokenValueRecord[]
  loading: boolean
  refreshing: boolean
  error: string
  activeTab: TokenRecordType
  onSelectTab: (tab: TokenRecordType) => void
  onRefresh: () => void
  /** 点击充值套餐回调,平台注入支付确认(Alert/弹窗/导航) */
  onRecharge: (pkg: TokenValuePackage) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 财务汇总(平台注入,字段对齐 mobile-rn FinanceScreen FinanceSummary) */
export interface FinanceSummary {
  balance: number
  todayIncome: number
  totalIncome: number
  totalExpense: number
}

/** FinanceScreen props(注入式:wrapper 保留 API 调用) */
export interface FinanceScreenProps {
  t: TFunction
  summary: FinanceSummary | null
  loading: boolean
  error: string
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

/** 优惠券状态(available/used/expired) */
export type PromotionCouponStatus = 'available' | 'used' | 'expired'

/** 优惠券条目(平台注入,字段对齐 mobile-rn PromotionScreen Coupon) */
export interface PromotionCoupon {
  id: string
  name: string
  amount: number
  minSpend: number
  expireDate: string
  status: PromotionCouponStatus
}

export interface TopupFailScreenProps {
  t: TFunction
  reason?: string
  onRetry: () => void
  onContactService?: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export interface TopupSuccessScreenProps {
  t: TFunction
  amount: number
  orderId: string
  time?: string
  onViewOrder?: () => void
  onGoHome?: () => void
  faqItems?: readonly string[]
  onFaqVisibleChange?: (v: boolean) => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}

export interface EarnCommissionScreenProps {
  t: TFunction
  onBack: () => void
  overview: { totalCommission: number; invitedCount: number } | null
  onOpenVip: () => void
  colorScheme?: 'light' | 'dark'
}

/** 充值 Screen Props */
export interface AppTopupScreenProps {
  t: TFunction
  selectedId: string
  customAmount: string
  payMethod: string
  balance: number
  refreshing: boolean
  introVisible: boolean
  /** 当前用户档位,用于高亮对应充值比例(normal 普通 / vip 会员 / trader 操盘手;trader 由 AuthUser.identityType === 'trader' 判定) */
  userTier: 'normal' | 'vip' | 'trader'
  amountOptions: { id: string; amount: number; label: string }[]
  payMethods: { id: string; label: string; icon?: string }[]
  onSelectAmount: (id: string) => void
  onCustomAmountChange: (text: string) => void
  onSelectPayMethod: (id: string) => void
  onRefresh: () => void
  onSubmit: () => void
  onCloseIntro: () => void
  onBack: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
