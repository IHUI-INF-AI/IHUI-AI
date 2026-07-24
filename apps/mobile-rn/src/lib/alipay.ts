/**
 * 支付宝支付封装(mobile-rn 端)。
 * 用 expo-web-browser 打开支付宝网页支付 URL(无需原生模块)。
 */
import * as WebBrowser from 'expo-web-browser'

/**
 * 调起支付宝网页支付。
 * @param payUrl 后端 createAlipayPagePayment 返回的 payUrl
 * @returns true=支付完成(用户关闭浏览器返回),false=打开失败
 */
export async function openAlipayPayment(payUrl: string): Promise<boolean> {
  if (!payUrl) throw new Error('payUrl is required')
  try {
    const result = await WebBrowser.openBrowserAsync(payUrl)
    // iOS: dismiss/cancel = 用户返回;Android: opened = 浏览器已打开(无法检测关闭)
    return (
      result.type === WebBrowser.WebBrowserResultType.DISMISS ||
      result.type === WebBrowser.WebBrowserResultType.CANCEL ||
      result.type === WebBrowser.WebBrowserResultType.OPENED
    )
  } catch (e) {
    console.warn('[alipay-pay] openBrowser failed:', e)
    throw new Error('ALIPAY_BROWSER_UNAVAILABLE')
  }
}
