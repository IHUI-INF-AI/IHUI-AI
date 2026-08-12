import { type PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import {
  checkLoginStatus,
  getToken,
  getUserInfo,
  setToken,
  setRefreshToken,
  setUserInfo,
  tokenStore,
} from './utils/auth'
import { exchangeSsoCode } from './utils/sso'
import { initPrivacyGuard } from './utils/privacy'
import { initPushSubscription } from './utils/push-init'
import { isMiniAppEnvironment } from './utils/miniapp-login'
import { useUserStore } from './stores/user'
import { KEEP_KEYS_ON_CLEAR, IHUI_KEY_PREFIX } from './constants/storage'
import {
  createNotificationClient,
  setBaseUrl,
  setTransport,
  setDeviceFingerprintProvider,
} from '@ihui/api-client'
import { bindTokenStoreToApiClient } from '@ihui/shared/auth'
import { createTaroTransport } from './utils/api-client-transport'
import { taroWebSocketFactory } from './utils/taro-websocket-adapter'
import { BASE_URL } from './utils/api-config'
import { taroDeviceFingerprintCollector } from './lib/device-fingerprint'
import { I18nProvider, useI18n } from './i18n'
import CustomerServiceFloat from './components/CustomerServiceFloat'
import { initCrashReport } from './utils/crash-report'
import './app.css'

// 初始化 api-client:注入 Taro transport + token provider + baseUrl
// 使 @ihui/api-client 共享端点可在小程序运行时使用(替代 native fetch)
// token provider 通过 bindTokenStoreToApiClient 统一接入跨端 TokenStore 契约
bindTokenStoreToApiClient(tokenStore)
setBaseUrl(BASE_URL.replace(/\/api$/, ''))
setTransport(createTaroTransport())
setDeviceFingerprintProvider(taroDeviceFingerprintCollector)

// 2026-08-06: 全局崩溃捕获上报(onError + onUnhandledRejection → /api/crash-reports)
initCrashReport()

// 2026-08-12 修复:pageError "Object" 异常字符串化
// 子组件 try/catch 中 console.error(throwObj) 时,React 会被事件循环还原为
// { name: '', message: 'Object', stack: '' }。这里加全局监听器,记录真实 message + stack,
// 方便在 DevTools console 找到 throw 位置。
if (typeof window !== 'undefined') {
  // Taro H5 dev 模式兼容兜底:部分小程序原生 API 在 H5 不可用,调用会被 Promise
  // reject 为 {errMsg: '...'} 对象,触发 pageError "Object"。这里把不存在的
  // wx.* API 替换为 noop,避免环境性 reject 噪音。
  const w = window as unknown as Record<string, unknown>
  const wxLike = (w.wx ?? w.jWeixin) as Record<string, unknown> | undefined
  if (wxLike && typeof wxLike === 'object') {
    const noopApis = ['onMemoryWarning', 'onNeedPrivacyAuthorization', 'getMenuButtonBoundingClientRect', 'onNetworkStatusChange']
    for (const api of noopApis) {
      if (typeof wxLike[api] === 'function') {
        try {
          wxLike[api] = () => null
        } catch {
          // 静默
        }
      }
    }
  }
  const fmtErr = (label: string, e: unknown) => {
    try {
      if (e && typeof e === 'object') {
        const obj = e as { message?: unknown; stack?: unknown; name?: unknown }
        const msg = obj.message
        const stack = obj.stack
        // eslint-disable-next-line no-console
        console.error(
          `[${label}]`,
          typeof msg === 'string' && msg ? msg : '(non-string message)',
          typeof stack === 'string' ? stack : '',
          e,
        )
      } else {
        // eslint-disable-next-line no-console
        console.error(`[${label}]`, String(e))
      }
    } catch {
      // 静默,避免 catch 内再抛
    }
  }
  window.addEventListener('error', (ev) => {
    fmtErr('pageError', ev.error ?? ev.message)
  })
  window.addEventListener('unhandledrejection', (ev) => {
    fmtErr('unhandledrejection', ev.reason)
  })
}

// 2026-07-22 P0 Round 5 鲁棒性加固:防 NetworkStatusListener 在组件卸载后仍触发 toast
let networkListenerRegistered = false

/**
 * 2026-07-22 P0 Round 5 鲁棒性加固:全局网络状态监听。
 * - 网络断开(networkType === 'none')时 toast 提示
 * - 网络恢复时不弹 toast(WebSocket 重连逻辑自行恢复连接,避免打扰用户)
 * - 用模块级 flag 防止 HMR/多次挂载导致重复注册 listener
 */
function NetworkStatusHandler() {
  const { t } = useI18n()
  useLaunch(() => {
    if (networkListenerRegistered) return
    networkListenerRegistered = true
    Taro.onNetworkStatusChange((res) => {
      if (!res.isConnected || res.networkType === 'none') {
        Taro.showToast({ title: t('error.network'), icon: 'none', duration: 2000 })
      }
    })
  })
  return null
}

// 2026-07-22 防 iOS OOM crash:防 MemoryWarningListener 在 HMR/多次挂载下重复注册
let memoryListenerRegistered = false

const MEMORY_LEVEL_TRIM = 5
const MEMORY_LEVEL_CRITICAL = 10
const MEMORY_LEVEL_URGENT = 15

/**
 * 2026-07-22 防 iOS OOM crash:全局内存告警监听。
 * - level >= 5  (TRIM):清理非关键 storage(保留 token/userInfo,清 ihui_ 前缀的其他 key)
 * - level >= 10 (CRITICAL):通过 eventCenter 通知各页面释放内存
 * - level >= 15 (URGENT):reLaunch 重启到首页
 * - 用模块级 flag 防止 HMR/多次挂载导致重复注册 listener
 */
function MemoryWarningHandler() {
  useLaunch(() => {
    if (memoryListenerRegistered) return
    if (typeof Taro.onMemoryWarning !== 'function') return
    memoryListenerRegistered = true
    Taro.onMemoryWarning((res) => {
      const level = res?.level ?? 0
      console.warn('[IHUI] memory warning, level:', level)
      // L5+: 清理非关键 storage
      if (level >= MEMORY_LEVEL_TRIM) {
        try {
          const info = Taro.getStorageInfoSync()
          // 2026-07-28 Q-4: 用 KEEP_KEYS_ON_CLEAR + IHUI_KEY_PREFIX 常量替代硬编码
          for (const key of info.keys) {
            if (!KEEP_KEYS_ON_CLEAR.includes(key) && key.startsWith(IHUI_KEY_PREFIX)) {
              Taro.removeStorageSync(key)
            }
          }
        } catch {
          // ignore
        }
      }
      // L10+: 通知各页面释放内存
      if (level >= MEMORY_LEVEL_CRITICAL) {
        try {
          Taro.eventCenter.trigger('memory:release', { level })
        } catch {
          // ignore
        }
      }
      // L15+: 重启到首页
      if (level >= MEMORY_LEVEL_URGENT) {
        Taro.reLaunch({ url: '/pages/index/index' })
      }
    })
  })
  return null
}

/**
 * 检查小程序启动参数是否带 sso_code(外部场景:H5 / 扫码 / deep link 携带)。
 * 若有则调 /api/auth/sso/exchange 换 token,实现"从 web 已登录态无缝继承到小程序"。
 * 失败静默,不打扰用户(用户仍可走小程序自身登录流程)。
 */
function SsoLaunchHandler() {
  const { t } = useI18n()
  useLaunch((options) => {
    // 2026-07-27 移除 loadFontFace:远程字体 https://aizhs.top/fonts/ 在小程序环境
    // TLS 连接失败 + 渲染层 ERR_CACHE_MISS/ERR_CONNECTION_CLOSED,fail 回调只能
    // 抑制 JS 层错误,渲染层网络错误仍上报控制台。系统字体兜底,功能不受影响。
    initPrivacyGuard()
    // 2026-07-27 移除 showShareMenu:未认证 appId(wx27028e276ffdbc5d)调用报
    // "no permission",fail 回调无法抑制微信框架内部 thirdErrorReport 上报。
    // useShareAppMessage/useShareTimeline hook 已自动启用分享,无需手动调用。
    initPushSubscription()

    // 启动时主流程:
    // 1) 优先消费外部 SSO code(已登录 web 扫码进入)
    // 2) 否则在小程序环境(微信/支付宝),未登录则尝试静默登录(自动适配平台)
    // 3) 登录态就绪后建立 WebSocket 通知连接
    const launchQuery = (options?.query ?? {}) as Record<string, unknown>
    void (async () => {
      await consumeSsoCodeFromLaunch(launchQuery, () => t('login.loginSuccess'))
      // 未登录且是小程序环境(微信或支付宝)→ 静默跨端登录
      if (!getToken() && isMiniAppEnvironment()) {
        try {
          await useUserStore.getState().trySilentMiniAppLogin()
        } catch {
          // 静默失败给轻量提示(非小程序环境或用户拒绝授权时常见)
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
      <NetworkStatusHandler />
      <MemoryWarningHandler />
      <SsoLaunchHandler />
      {children}
      <CustomerServiceFloat />
      <FontLoader />
    </I18nProvider>
  )
}

/** 动态加载阿里妈妈方圆体 VF，避免 webpack CSS url() 解析错误 */
function FontLoader() {
  useLaunch(() => {
    if (typeof document === 'undefined') return
    try {
      const style = document.createElement('style')
      style.textContent = `@font-face {
        font-family: 'AlimamaFangYuanTi';
        src: url('/static/fonts/AlimamaFangYuanTiVF-Thin.ttf') format('truetype');
        font-weight: 100 900;
        font-style: normal;
        font-display: block;
      }`
      document.head.appendChild(style)
    } catch {
      // 静默失败
    }
  })
  return null
}

export default App
