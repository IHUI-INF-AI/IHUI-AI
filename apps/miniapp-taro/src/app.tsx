import { type PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { checkLoginStatus, getToken, getUserInfo, setToken, setRefreshToken, setUserInfo } from './utils/auth'
import { exchangeSsoCode } from './utils/sso'
import { showShareMenu } from './utils/share'
import { initPrivacyGuard } from './utils/privacy'
import { initPushSubscription } from './utils/push-init'
import { isWechatMiniProgram } from './utils/wechat-login'
import { useUserStore } from './stores/user'
import { createNotificationClient } from '@ihui/api-client'
import { taroWebSocketFactory } from './utils/taro-websocket-adapter'
import { BASE_URL } from './utils/request'
import { I18nProvider, useI18n } from './i18n'
import CustomerServiceFloat from './components/CustomerServiceFloat'
import './app.css'

/**
 * 检查小程序启动参数是否带 sso_code(外部场景:H5 / 扫码 / deep link 携带)。
 * 若有则调 /api/auth/sso/exchange 换 token,实现"从 web 已登录态无缝继承到小程序"。
 * 失败静默,不打扰用户(用户仍可走小程序自身登录流程)。
 */
function SsoLaunchHandler() {
  const { t } = useI18n()
  useLaunch((options) => {
    Taro.loadFontFace({
      family: 'HarmonyOS Sans SC',
      source: 'url("https://ihui.ai/fonts/HarmonyOS_SansSC_Regular.ttf")',
      global: true,
    })
    initPrivacyGuard()
    showShareMenu()
    initPushSubscription()

    // 启动时主流程:
    // 1) 优先消费外部 SSO code(已登录 web 扫码进入)
    // 2) 否则在微信小程序环境,未登录则尝试静默微信登录(wx.login 拿 code → 后端换 token)
    // 3) 登录态就绪后建立 WebSocket 通知连接
    const launchQuery = (options?.query ?? {}) as Record<string, unknown>
    void (async () => {
      await consumeSsoCodeFromLaunch(launchQuery, () => t('login.loginSuccess'))
      // 未登录且是微信环境 → 静默微信登录
      if (!getToken() && isWechatMiniProgram()) {
        try {
          await useUserStore.getState().trySilentWechatLogin()
        } catch {
          // 静默失败给轻量提示(非 weapp 环境或用户拒绝授权时常见)
          Taro.showToast({ title: t('login.wechatFailed'), icon: 'none' })
        }
      }
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
    })()
  })
  return null
}

async function consumeSsoCodeFromLaunch(
  query: Record<string, unknown>,
  successMsg: () => string,
): Promise<void> {
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
    Taro.showToast({ title: successMsg(), icon: 'success' })
  } catch {
    // SSO code 失效或网络异常,静默忽略
  }
}

function App({ children }: PropsWithChildren<unknown>) {
  return (
    <I18nProvider>
      <SsoLaunchHandler />
      {children}
      <CustomerServiceFloat />
    </I18nProvider>
  )
}

export default App
