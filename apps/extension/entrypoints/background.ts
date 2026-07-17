import { initApi, getRefreshToken, getToken } from '../lib/token'
import { startAutoRefresh, scheduleRefreshAlarm } from '../lib/token-utils'

export default defineBackground(() => {
  startAutoRefresh()

  initApi()
    .then(() => {
      if (getRefreshToken() && getToken()) {
        const t = getToken()
        if (t) scheduleRefreshAlarm(t)
      }
    })
    .catch((err) => {
      console.error('[IHUI AI] background initApi failed:', err)
    })

  chrome.runtime.onInstalled.addListener(() => {
    console.log('[IHUI AI] 扩展已安装')
  })
})
