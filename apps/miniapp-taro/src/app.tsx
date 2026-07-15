import { type PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { checkLoginStatus, getToken, getUserInfo } from './utils/auth'
import { showShareMenu } from './utils/share'
import websocketManager from './utils/websocket'
import { BASE_URL } from './utils/request'
import { I18nProvider } from './i18n'
import './app.css'

const WS_BASE = BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '')

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch(() => {
    checkLoginStatus()
    showShareMenu()
    const token = getToken()
    const userInfo = getUserInfo()
    if (token && userInfo?.uuid) {
      websocketManager.connect(`${WS_BASE}/ws/notifications?token=${token}`, userInfo.uuid)
    }
  })
  return <I18nProvider>{children}</I18nProvider>
}

export default App
