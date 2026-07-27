// Re-export from utils/pay for backward compat with the platform barrel.
// src/platform/index.ts does `export * from './pay'`; deleting this file would break it.
// Original platform-specific implementation was merged into utils/pay on 2026-07-27
// (utils/pay is the comprehensive superset: handles mp-weixin / mp-alipay / app / web / unknown
// plus App-side orderInfo building, whereas the old platform/pay.ts only covered mp-weixin & mp-alipay).
export {
  unifiedPay,
  requestWxPayment,
  requestAliPayment,
  type AnyPayParams,
  type WxPayParams,
  type AliPayParams,
  type PayPlatform,
} from '../utils/pay'