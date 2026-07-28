/**
 * 支付结果码跨端共享常量
 * 消除 mobile-rn 和 miniapp-taro 两端支付宝 resultCode 硬编码重复
 */

// 支付宝小程序 resultCode(支付宝官方文档)
export const ALIPAY_RESULT_CODE = {
  SUCCESS: '9000',
  PENDING: '8000',
  FAILED: '4000',
  CANCEL: '6001',
  NETWORK_ERROR: '6002',
} as const

export type AlipayResultCode = (typeof ALIPAY_RESULT_CODE)[keyof typeof ALIPAY_RESULT_CODE]

export function isAlipaySuccess(code: string): boolean {
  return code === ALIPAY_RESULT_CODE.SUCCESS
}

export function isAlipayCancel(code: string): boolean {
  return code === ALIPAY_RESULT_CODE.CANCEL
}

export function isAlipayPending(code: string): boolean {
  return code === ALIPAY_RESULT_CODE.PENDING
}

// 微信支付错误码(微信官方文档)
export const WECHAT_PAY_ERROR_CODE = {
  SUCCESS: 0,
  CANCEL: -2,
  NETWORK_ERROR: -1,
  INSUFFICIENT_FUNDS: -100,
} as const

export function isWechatPaySuccess(code: number): boolean {
  return code === WECHAT_PAY_ERROR_CODE.SUCCESS
}

export function isWechatPayCancel(code: number): boolean {
  return code === WECHAT_PAY_ERROR_CODE.CANCEL
}
