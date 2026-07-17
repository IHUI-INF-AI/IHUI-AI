import { type PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { checkLoginStatus, getToken, getUserInfo } from './utils/auth'
import { showShareMenu } from './utils/share'
import { initPrivacyGuard } from './utils/privacy'
import { initPushSubscription } from './utils/push-init'
import { createNotificationClient } from '@ihui/api-client'
import { taroWebSocketFactory } from './utils/taro-websocket-adapter'
import { BASE_URL } from './utils/request'
import { I18nProvider } from './i18n'
import CustomerServiceFloat from './components/CustomerServiceFloat'
import './app.css'

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch(() => {
    initPrivacyGuard()
    checkLoginStatus()
    showShareMenu()
    initPushSubscription()
    const token = getToken()
    const userInfo = getUserInfo()
    if (token && userInfo?.uuid) {
      createNotificationClient(
        { baseUrl: BASE_URL, tokenProvider: () => getToken() },
        {
          onMessage: (msg) => Taro.eventCenter.trigger('wsNotification', msg),
        },
        { webSocketFactory: taroWebSocketFactory },
      ).connect()
    }
  })
  return (
    <I18nProvider>
      {children}
      <CustomerServiceFloat />
    </I18nProvider>
  )
}

export default App
