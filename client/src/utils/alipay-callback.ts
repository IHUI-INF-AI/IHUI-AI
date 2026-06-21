/**
 * 支付宝回调处理
 * 用于处理支付宝支付回调
 * 注：签名验证由后端 /fund/ali/pay/alipay/notify 完成，前端不自行验签
 */

import { logger } from './logger'
import { aliPayNotify, type AlipayNotifyParams } from '@/api/ali-pay'

/**
 * 支付宝回调参数
 */
export interface AlipayCallbackParams {
  out_trade_no?: string
  trade_no?: string
  trade_status?: string
  total_amount?: string
  timestamp?: string
  sign?: string
  [key: string]: string | undefined
}

/**
 * 处理支付宝回调：将回调参数提交后端验签
 * @param params 回调参数
 */
export async function handleAlipayCallback(params: AlipayCallbackParams): Promise<boolean> {
  logger.info('[Alipay] Received callback:', params.out_trade_no)

  if (!params.out_trade_no || !params.trade_status) {
    logger.warn('[Alipay] Callback missing required fields')
    return false
  }

  try {
    const notifyParams: AlipayNotifyParams = {
      out_trade_no: params.out_trade_no,
      trade_no: params.trade_no || '',
      trade_status: params.trade_status,
      total_amount: Number(params.total_amount) || 0,
    }
    const res = await aliPayNotify(notifyParams)
    return Boolean(res.success)
  } catch (error) {
    logger.error('[Alipay] Notify backend failed:', error)
    return false
  }
}

/**
 * 处理支付宝 Body 回调
 * 用于处理从 body 传递的参数
 */
export async function handleAlipayBodyCallback(): Promise<void> {
  if (typeof window === 'undefined') return

  const urlParams = new URLSearchParams(window.location.search)
  const outTradeNo = urlParams.get('out_trade_no')
  const tradeStatus = urlParams.get('trade_status')

  if (outTradeNo && tradeStatus) {
    const params: AlipayCallbackParams = {
      out_trade_no: outTradeNo,
      trade_no: urlParams.get('trade_no') || undefined,
      trade_status: tradeStatus,
      total_amount: urlParams.get('total_amount') || undefined,
      timestamp: urlParams.get('timestamp') || undefined,
      sign: urlParams.get('sign') || undefined,
    }

    await handleAlipayCallback(params)
  }
}

/**
 * 检查是否是支付宝回调
 */
export function isAlipayCallback(): boolean {
  if (typeof window === 'undefined') return false

  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.has('out_trade_no') && urlParams.has('trade_status')
}

export default {
  handleAlipayCallback,
  handleAlipayBodyCallback,
  isAlipayCallback,
}
