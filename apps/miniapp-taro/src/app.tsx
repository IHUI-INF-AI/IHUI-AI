import { type PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { checkLoginStatus, getToken, getUserInfo, setToken, setRefreshToken, setUserInfo } from './utils/auth'
import { exchangeSsoCode } from './utils/sso'
import { showShareMenu } from './utils/share'
import { initPrivacyGuard } from './utils/privacy'
import { initPushSubscription } from './utils/push-init'
import { createNotificationClient } from '@ihui/api-client'
import { taroWebSocketFactory } from './utils/taro-websocket-adapter'
import { BASE_URL } from './utils/request'
import { I18nProvider } from './i18n'
import CustomerServiceFloat from './components/CustomerServiceFloat'
import './app.css'

/**
 * 检查小程序启动参数是否带 sso_code(外部场景:H5 / 扫码 / deep link 携带)。
 * 若有则调 /api/auth/sso/exchange 换 token,实现"从 web 已登录态无缝继承到小程序"。
 * 失败静默,不打扰用户(用户仍可走小程序自身登录流程)。
 */
async function consumeSsoCodeFromLaunch(query: Record<string, unknown>): Promise<void> {
  const code = typeof query.sso_code === 'string' ? query.sso_code : ''
  if (!code) return
  try {
    const data = await exchangeSsoCode(code)
    if (!data) return
    setToken(data.accessToken)
    setRefreshToken(data.refreshToken)
    setUserInfo({
      id: data.user.id,
      uuid: data.user.id, // WebSocket 连接判断用 userInfo.uuid,SsoTokenData.user.id 对齐
      nickname: data.user.nickname,
      avatar: data.user.avatar,
      phone: data.user.phone,
      email: data.user.email,
      roleId: data.user.roleId,
      status: data.user.status,
    })
    Taro.showToast({ title: '登录成功', icon: 'success' })
  } catch {
    // SSO code 失效或网络异常,静默忽略
  }
}

function App({ children }: PropsWithChildren<unknown>) {
  useLaunch((options) => {
    Taro.loadFontFace({
      family: 'HarmonyOS Sans SC',
      source: 'url("https://ihui.ai/fonts/HarmonyOS_SansSC_Regular.ttf")',
      global: true,
    })
    initPrivacyGuard()
    showShareMenu()
    initPushSubscription()

    // SSO 场景:外部带 sso_code 进入小程序,自动换 token 登录
    const launchQuery = (options?.query ?? {}) as Record<string, unknown>
    void consumeSsoCodeFromLaunch(launchQuery).then(() => {
      checkLoginStatus()
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
  })
  return (
    <I18nProvider>
      {children}
      <CustomerServiceFloat />
    </I18nProvider>
  )
}

export default App
