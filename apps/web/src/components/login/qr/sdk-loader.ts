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

/**
 * 企业微信 wwLogin-1.2.7.js 扫码登录 SDK 配置参数。
 *
 * 官方文档:https://developer.work.weixin.qq.com/document/path/91022
 * SDK 通过 UMD 模块挂载到 window.WwLogin(大写 W,构造函数)。
 *
 * 字段会被 SDK 序列化为 OAuth URL query 参数(排除 id),
 * 因此字段名必须与 https://open.work.weixin.qq.com/wwopen/sso/qrConnect 参数一致。
 */
export interface WecomLoginOptions {
  /** 容器 DOM id(SDK 内部 getElementById) */
  id: string
  /** 企业 CorpID */
  appid: string
  /** 应用 AgentId */
  agentid: string
  /** 授权回调地址(必须 urlencode) */
  redirect_uri: string
  /** 防 CSRF,OAuth state */
  state?: string
  /** 自定义二维码样式 CSS URL */
  href?: string
  /** 'zh' / 'en' */
  lang?: 'zh' | 'en'
  /** 是否手机端,true 则整页跳转不渲染 iframe */
  is_mobile?: boolean
}

export interface WecomLoginInstance {
  /** 销毁实例,移除 message 监听 */
  destroyed?: () => void
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
  /** 容器 DOM id */
  id: string
  /** iframe 宽度(默认 300) */
  width?: number
  /** iframe 高度(默认 300) */
  height?: number
}

/**
 * 钉钉 OAuth 授权参数(新版 h5-dingtalk-login SDK)
 *
 * 旧版 SDK(0.1.8)用单一 `goto` URL,新版(0.21.0+)拆解为结构化字段。
 * 字段与 https://login.dingtalk.com/oauth2/auth 查询参数一一对应。
 */
export interface DingtalkAuthParams {
  /** 应用 client_id(等同于 AppKey,SDK 内拼到 OAuth URL ?client_id=) */
  client_id: string
  /** 授权回调地址(必须与钉钉后台「安全设置 → 回调地址」一致) */
  redirect_uri: string
  /** 固定 'code' */
  response_type: 'code'
  /** 通常是 'openid'(可选附加 'corpid') */
  scope: string
  /** 防 CSRF,OAuth state */
  state?: string
  /** 'consent' = 每次都显示授权确认页 */
  prompt?: string
  /** 仅预发环境用 true */
  isPre?: boolean
  /** 企业 org_type(企业内部应用场景) */
  org_type?: string
  /** 企业 corpId */
  corpId?: string
  /** 独立登录场景 */
  exclusiveLogin?: string
  exclusiveCorpId?: string
}

export interface DingtalkLoginResult {
  /** 完整回调 URL(包含 authCode + state) */
  redirectUrl: string
  /** 钉钉返回的 authCode(换取 user token 用) */
  authCode: string
  /** OAuth state(回包) */
  state: string
}

export interface DingtalkFrameInstance {
  destroy?: () => void
}

// ---- window 全局类型扩展 ----

declare global {
  interface Window {
    WxLogin?: new (opts: WechatQrOptions) => unknown
    WwLogin?: new (opts: WecomLoginOptions) => WecomLoginInstance
    QRLogin?: new (opts: FeishuQrOptions) => FeishuQrInstance
    DTFrameLogin?: (
      opts: DingtalkFrameOptions,
      authParams: DingtalkAuthParams,
      onSuccess: (res: DingtalkLoginResult) => void,
      onError: (msg: string) => void,
    ) => DingtalkFrameInstance
  }
}

// ---- SDK URL 常量 ----

const WECHAT_SDK_URL = 'https://res.wx.qq.com/connect/zh_CN/htmledition/js/wxLogin.js'
// 企业微信官方扫码登录 SDK(wwLogin-1.2.7.js,2026-07-22 修复)
// 旧 URL https://wwopen.wsopen.qq.com/wwopen/wwopen/js/wecom-login-1.0.0.js 已下线(connection closed)
// ⚠️ wwcdn.weixin.qq.com 不返回 CORS header,loadScript 不能加 crossOrigin='anonymous',否则浏览器拒绝加载
const WECOM_SDK_URL = 'https://wwcdn.weixin.qq.com/node/wework/wwopen/js/wwLogin-1.2.7.js'
const FEISHU_SDK_URL =
  'https://lf-package-cn.feishucdn.com/obj/feishu-static/lark/passport/qrcode/LarkSSOSDKWebQRCode-1.0.3.js'
// 2026-07-22 修复:旧 URL https://g.alicdn.com/dingding/dinglogin/0.1.8/dinglogin.js 已 404
// 新 URL 来自 https://open.dingtalk.com/document/orgapp/dingtalk-manually-implements-the-qr-code-login-function 官方文档
const DINGTALK_SDK_URL = 'https://g.alicdn.com/dingding/h5-dingtalk-login/0.21.0/ddlogin.js'

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
    // 不设 crossOrigin='anonymous':
    // 微信/钉钉/飞书 CDN 都返回 Access-Control-Allow-Origin,但企业微信 wwcdn.weixin.qq.com 不返回,
    // 加 crossOrigin 会导致浏览器拒绝加载企业微信 SDK。脚本本身挂载 window 全局变量不需要 CORS。
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
    if (!window.WwLogin) throw new Error('WwLogin SDK 加载完成但未挂载到 window')
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
