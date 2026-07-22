/**
 * 第三方扫码登录 SDK 加载工具(微信 / 企业微信 / 钉钉 / 飞书)
 *
 * 按需动态加载各厂商官方 SDK 脚本,加载完成后挂载到 window 上。
 * 同一 SDK 多次加载复用同一个 <script> 标签(基于 src 去重)。
 *
 * 各厂商 SDK 文档:
 * - 微信 WxLogin:https://developers.weixin.qq.com/doc/oplatform/Third-party_Platforms/2.0/api/Before_Enabling_Third-party_Platforms/website_app_login.html
 * - 企业微信 wwLogin:https://developer.work.weixin.qq.com/document/path/91022
 * - 钉钉 DTFrameLogin:https://open.dingtalk.com/document/orgapp/dingtalk-manually-implements-the-qr-code-login-function
 * - 飞书 QRLogin:https://open.feishu.cn/document/common-capabilities/sso/web-application-sso/qr-sdk-documentation
 */

// ---- 各厂商 SDK 接口类型 ----

export interface WechatQrOptions {
  /** true=iframe 内跳转;false=整页跳转(默认) */
  self_redirect?: boolean
  /** 容器 DOM id */
  id: string
  appid: string
  scope: 'snsapi_login'
  redirect_uri: string
  state: string
  style?: 'black' | 'white'
  /** 自定义二维码样式 CSS URL */
  href?: string
}

export interface WecomLoginPanelOptions {
  /** 容器 DOM selector(如 '#ww-login') */
  el: string
  params: {
    login_type: 'CorpApp' | 'ServiceApp'
    /** 企业 corp_id */
    appid: string
    agentid: string
    redirect_uri: string
    state?: string
    /** callback=回调模式;top=整页跳转(默认) */
    redirect_type?: 'callback' | 'top'
    lang?: 'zh' | 'en'
  }
}

export interface WecomLoginPanelInstance {
  destroy?: () => void
  setParams?: (params: WecomLoginPanelOptions['params']) => void
}

export interface FeishuQrOptions {
  id: string
  /** 完整的 OAuth 授权 URL(包含 client_id / redirect_uri / response_type=code / state) */
  goto: string
  width: string
  height: string
  style?: string
}

export interface FeishuQrInstance {
  destroy?: () => void
}

export interface DingtalkFrameOptions {
  id: string
  width: number
  height: number
  /** 钉钉 OAuth2 授权 URL(https://login.dingtalk.com/oauth2/auth?...) */
  goto: string
  style?: string
}

export interface DingtalkLoginResult {
  redirectUrl: string
  authCode: string
  state: string
}

export interface DingtalkFrameInstance {
  destroy?: () => void
}

// ---- window 全局类型扩展 ----

declare global {
  interface Window {
    WxLogin?: new (opts: WechatQrOptions) => unknown
    ww?: {
      createWWLoginPanel: (opts: WecomLoginPanelOptions) => WecomLoginPanelInstance
    }
    QRLogin?: new (opts: FeishuQrOptions) => FeishuQrInstance
    DTFrameLogin?: new (
      opts: DingtalkFrameOptions,
      onSuccess: (res: DingtalkLoginResult) => void,
      onError: (msg: string) => void,
    ) => DingtalkFrameInstance
  }
}

// ---- SDK URL 常量 ----

const WECHAT_SDK_URL = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js'
const WECOM_SDK_URL = 'https://wwopen.wsopen.qq.com/wwopen/wwopen/js/wecom-login-1.0.0.js'
const FEISHU_SDK_URL =
  'https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js'
const DINGTALK_SDK_URL = 'https://g.alicdn.com/dingding/dinglogin/0.1.8/dinglogin.js'

// ---- 通用 script 加载器(src 去重 + Promise 缓存) ----

const scriptPromises = new Map<string, Promise<void>>()

function loadScript(src: string): Promise<void> {
  const cached = scriptPromises.get(src)
  if (cached) return cached
  const promise = new Promise<void>((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('document 不可用'))
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      if (existing.getAttribute('data-loaded') === 'true') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`脚本加载失败: ${src}`)))
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.defer = true
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      script.setAttribute('data-loaded', 'true')
      resolve()
    }
    script.onerror = () => reject(new Error(`脚本加载失败: ${src}`))
    document.head.appendChild(script)
  })
  scriptPromises.set(src, promise)
  return promise
}

// ---- 各厂商 SDK 加载入口 ----

export function loadWechatQrSdk(): Promise<void> {
  return loadScript(WECHAT_SDK_URL).then(() => {
    if (!window.WxLogin) throw new Error('WxLogin SDK 加载完成但未挂载到 window')
  })
}

export function loadWecomQrSdk(): Promise<void> {
  return loadScript(WECOM_SDK_URL).then(() => {
    if (!window.ww?.createWWLoginPanel) {
      throw new Error('wecom SDK 加载完成但 createWWLoginPanel 未挂载到 window')
    }
  })
}

export function loadFeishuQrSdk(): Promise<void> {
  return loadScript(FEISHU_SDK_URL).then(() => {
    if (!window.QRLogin) throw new Error('QRLogin SDK 加载完成但未挂载到 window')
  })
}

export function loadDingtalkQrSdk(): Promise<void> {
  return loadScript(DINGTALK_SDK_URL).then(() => {
    if (!window.DTFrameLogin) throw new Error('DTFrameLogin SDK 加载完成但未挂载到 window')
  })
}
