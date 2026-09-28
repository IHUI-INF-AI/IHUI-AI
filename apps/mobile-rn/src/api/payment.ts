// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
