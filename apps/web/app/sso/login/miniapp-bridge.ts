// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /sso/login → 微信小程序 web-view 的 sso_code 回传腿(G-957,2026-10-26)。
 *
 * 背景:小程序端授权入口打开 `本页?client_id=miniapp-taro&redirect=ihui-miniapp://sso/callback`,
 * 但微信小程序 web-view 里 **没有** OS 级 custom scheme 处理器(既有现读定性,
 * 见 apps/miniapp-taro/tests/webview-sso-return.test.ts 头注),`window.location.href`
 * 那条 deep-link 路径在该宿主里必然静默无效。唯一回传通道 = 微信 JS-SDK 的
 * `wx.miniProgram.postMessage`,且消息**不即时送达** —— 微信在「用户返回小程序 /
 * web-view 销毁 / 分享」时机才整批投递给 bindmessage,因此本腿交接成功后本页必须
 * 留在"请返回小程序"的完成卡,绝不能自行跳转(跳走反而丢投递时机)。
 *
 * 契约(与小程序接收侧共用):载荷 `{ type: 'ihui-sso-code', sso_code }`,
 * 接收侧出口 = apps/miniapp-taro/src/utils/sso.ts 的 extractSsoCodeFromWebviewMessages
 * (SSO_WEBVIEW_MESSAGE_TYPE = 'ihui-sso-code');type 字面量在此按接收侧契约登记,
 * 若两边要改必须同批 —— 单向漂移的表现是小程序"收到消息但取不到码"的静默死路。
 *
 * SDK 来源:微信官方 CDN jweixin-1.6.0.js(web-view 内加载外部脚本不受小程序后台
 * 「业务域名」限制,业务域名只校验主文档 URL;res.wx.qq.com 无需报备)。
 * 失败方向(AGENTS §0.10):SDK 加载失败/超时 ⇒ reject 由调用方如实提示,绝不静默当成功。
 */

/** 小程序接收侧契约的 type 字面量(与 SSO_WEBVIEW_MESSAGE_TYPE 逐字同源,勿单改一边)
 * @public 仅测试钉住(判据先行族,G-1200042):生产面暂无消费方,单测直接 import;若日后有生产消费方应删本标注
 */
export const SSO_WEBVIEW_POST_TYPE = 'ihui-sso-code'

/** 微信官方 JS-SDK(web-view 基础能力,postMessage 所在)
 * @public 仅测试钉住(判据先行族,G-1200042):生产面暂无消费方,单测直接 import;若日后有生产消费方应删本标注
 */
export const WECHAT_JWEIXIN_SRC = 'https://res.wx.qq.com/open/js/jweixin-1.6.0.js'

/** SDK script 注入的兜底超时:微信 CDN 偶发慢,但不允许用户对着一页表单干等 */
const JWEIXIN_LOAD_TIMEOUT_MS = 8_000

interface WechatMiniProgram {
  postMessage: (opts: { data: unknown }) => void
}

interface WechatGlobal {
  miniProgram?: WechatMiniProgram
}

declare global {
  interface Window {
    wx?: WechatGlobal
  }
}

/**
 * 当前浏览器是不是微信小程序 web-view 宿主。
 * 微信 web-view 的 UA 形如 `... MicroMessenger/8.0.x miniProgram/...`,判 'miniprogram'
 * 子串(大小写不敏感)是微信官方文档给出的宿主判据;普通微信内 H5 不带该标记。
 */
export function isWechatMiniProgramHost(
  ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean {
  return ua.toLowerCase().includes('miniprogram')
}

/** 小程序回传腿的载荷构造(单测锚点:字段名与 type 契约锁在这里)
 * @public 仅测试钉住(判据先行族,G-1200042):生产面暂无消费方,单测直接 import;若日后有生产消费方应删本标注
 */
export function buildMiniappSsoPayload(ssoCode: string): { type: string; sso_code: string } {
  return { type: SSO_WEBVIEW_POST_TYPE, sso_code: ssoCode }
}

function loadWechatJsSdk(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolveLoad, rejectLoad) => {
    if (typeof document === 'undefined') {
      rejectLoad(new Error('no document (non-browser host)'))
      return
    }
    // 幂等:同源 SDK 已在(本页二次签发/手动重签)则直接复用,不再注第二份 script
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    const script = existing ?? document.createElement('script')
    const timer = setTimeout(() => rejectLoad(new Error('jweixin load timeout')), timeoutMs)
    const finish = () => {
      clearTimeout(timer)
      if (window.wx?.miniProgram) {
        resolveLoad()
      } else {
        rejectLoad(new Error('jweixin loaded but wx.miniProgram unavailable'))
      }
    }
    if (existing) {
      // 已注入过:要么早已就绪,要么仍在加载 —— 直接按当前状态裁决
      finish()
      return
    }
    script.src = src
    script.onload = () => finish()
    script.onerror = () => {
      clearTimeout(timer)
      rejectLoad(new Error('jweixin script failed to load'))
    }
    document.head.appendChild(script)
  })
}

/**
 * 把签发好的一次性 sso_code 交接给小程序宿主。
 * resolve = postMessage 已发出(投递时机仍由微信掌握,调用方须渲染"返回小程序"提示);
 * reject = SDK 拿不到/加载失败,调用方如实提示,由用户手动返回(小程序侧 app.tsx
 * 启动腿 query.sso_code 通道仍在,但那条路要求手动带码,不在此强造)。
 */
export async function handOffSsoCodeToMiniapp(ssoCode: string): Promise<void> {
  if (!ssoCode) throw new Error('empty sso_code')
  await loadWechatJsSdk(WECHAT_JWEIXIN_SRC, JWEIXIN_LOAD_TIMEOUT_MS)
  window.wx?.miniProgram?.postMessage({ data: buildMiniappSsoPayload(ssoCode) })
}

export const __test__ = {
  isWechatMiniProgramHost,
  buildMiniappSsoPayload,
  SSO_WEBVIEW_POST_TYPE,
  WECHAT_JWEIXIN_SRC,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
