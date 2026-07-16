import { initApi } from '../lib/token'

export default defineBackground(() => {
  initApi().catch((err) => {
    console.error('[IHUI AI] background initApi failed:', err)
  })

  chrome.runtime.onInstalled.addListener(() => {
    console.log('[IHUI AI] 扩展已安装')
  })
})
