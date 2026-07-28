/**
 * 跨端支付错误分类(纯逻辑,零平台依赖)
 *
 * 消除 miniapp-taro (utils/pay.ts + platform/pay.ts) 与未来 mobile-rn 端
 * 错误分类逻辑重复。各端通过 classifyPayError / is*Error 判断错误类型后,
 * 自行调用 Taro.showToast / console.warn 等平台 API 提示用户。
 */

/** 支付错误类型枚举 */
export type PayErrorType =
  | 'cancel'
  | 'wxNotInstalled'
  | 'aliNotInstalled'
  | 'paramError'
  | 'unknown'

/** 支付错误对象形态(Taro / WeChat lib / Alipay SDK 错误结构的并集) */
export interface PayErrorLike {
  errMsg?: string
  code?: number
  message?: string
}

/** 用户取消支付(msg 含 'cancel') */
export function isCancelError(err: PayErrorLike): boolean {
  const msg = err.errMsg || err.message || ''
  return msg.includes('cancel')
}

/** 微信未安装(code=-100 或 errMsg 含 '62000') */
export function isWxNotInstalled(err: PayErrorLike): boolean {
  if (err.code === -100) return true
  return (err.errMsg || '').includes('62000')
}

/** 支付宝未安装(code=-100 或 errMsg 含 '62009') */
export function isAliNotInstalled(err: PayErrorLike): boolean {
  if (err.code === -100) return true
  return (err.errMsg || '').includes('62009')
}

/** 参数错误(msg 含 'parameter' 或 '参数') */
export function isParamError(err: PayErrorLike): boolean {
  const msg = err.errMsg || err.message || ''
  return msg.includes('parameter') || msg.includes('参数')
}

/**
 * 把任意 err 归一化为 PayErrorType,方便 switch/case 分发。
 * 接受 unknown 类型,内部尝试兼容 Error / PayErrorLike / string / 其他对象。
 */
export function classifyPayError(err: unknown): PayErrorType {
  const e: PayErrorLike =
    err instanceof Error
      ? { message: err.message }
      : typeof err === 'object' && err !== null
        ? (err as PayErrorLike)
        : { message: String(err) }
  if (isCancelError(e)) return 'cancel'
  if (isWxNotInstalled(e)) return 'wxNotInstalled'
  if (isAliNotInstalled(e)) return 'aliNotInstalled'
  if (isParamError(e)) return 'paramError'
  return 'unknown'
}
