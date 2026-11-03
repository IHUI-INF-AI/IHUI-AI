// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇 AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top

/**
 * 小程序侧"服务器到底给没给会话"的唯一判据。
 *
 * 立因:`GET /auth/wechat/mini/login` 对查无绑定的 openid 回的是
 * `success({ needPhone: true, openId, unionId })` —— HTTP 200、code 0、**既没有 accessToken
 * 也没有 user**。这是新用户的常规分支,不是异常。而端内两条微信登录路径
 * (`utils/wechat-login.ts`、`utils/miniapp-login.ts`)都直接 `const { user } = result` 再去读
 * `user.nickname`,于是每次都抛 `TypeError: Cannot read properties of undefined`,被上层
 * catch 成一句"微信登录失败" —— 用户看到的是失败,真实状态是"还没绑定,下一步该用手机号"。
 *
 * 判据做成抛错而不是返回 null:任何新加的登录入口都必须先回答这一格才拿得到凭据,
 * 漏答的代价是当场红,不是静默把已有会话写成空 token。
 */

/** 后端登录答复里与本判据有关的那几格(形状故意收得比 LoginResult 宽:未绑定答复没有 user)。 */
export interface LoginSessionReply {
  accessToken?: unknown
  refreshToken?: unknown
  user?: unknown
  needPhone?: unknown
  openId?: unknown
}

/** openid 尚无绑定 ⇒ 该走手机号验证。带出 openId 供后续绑定链路复用。 */
export class WechatNotBoundError extends Error {
  readonly openId: string
  constructor(message: string, openId: string) {
    super(message)
    this.name = 'WechatNotBoundError'
    this.openId = openId
  }
}

/** 服务器既没给 token 也不是"未绑定"这一形 —— 答复本身不对,不给任何落盘机会。 */
export class LoginNoSessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LoginNoSessionError'
  }
}

/**
 * 通过 = 答复里确实有非空 accessToken 且带回了 user 对象;否则按"未绑定 / 答复不对"分两抛。
 * 文案由调用方注入(它才知道自己那条链路的 locale 取词入口),本模块保持零 IO。
 */
export function requireLoginSession(
  result: LoginSessionReply | undefined,
  messages: { notBound: string; noSession: string },
): void {
  const accessToken = result?.accessToken
  const user = result?.user
  if (typeof accessToken === 'string' && accessToken.length > 0 && user && typeof user === 'object')
    return

  if (result?.needPhone === true) {
    throw new WechatNotBoundError(messages.notBound, String(result.openId ?? ''))
  }
  throw new LoginNoSessionError(messages.noSession)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
