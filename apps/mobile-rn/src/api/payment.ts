/**
 * 支付 API — mobile-rn 端薄封装。
 * 直接 re-export 自 @ihui/api-client,零冗余。
 */
export {
  createWechatAppPayment,
  getPaymentOrders,
  getPaymentOrderDetail,
  syncPaymentStatus,
  cancelPaymentOrder,
  checkPaymentStatus,
  createTopUpOrder,
  getTopUpStatus,
  getTopUpRecords,
} from '@ihui/api-client'
export type {
  WechatAppPaySignData,
  WechatAppPayResponse,
  PaymentOrder,
  PaymentStatus,
  PaymentMethod,
  TopUpOrder,
  TopUpStatus,
} from '@ihui/api-client'
