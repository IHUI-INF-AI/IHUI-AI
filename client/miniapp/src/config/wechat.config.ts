/**
 * 微信 AppID 集中配置（单一来源，环境变量优先）
 *
 * 背景：
 *   miniapp/src/manifest.json 中存在两套微信 AppID（双重配置）：
 *     1. App 原生（oauth/payment/share.weixin）: wx85fa429a9331b5c8  → Android/iOS 原生 App
 *     2. mp-weixin（微信小程序）: wx27028e276ffdbc5d               → 微信小程序
 *   这两个 AppID 分别对应不同的微信开放平台注册应用，并非错误，但此前缺少统一管理入口。
 *
 * 修复策略：
 *   - manifest.json 中的 AppID 由 uni-app 在编译期读取，无法直接改为运行时环境变量，保留作为编译期默认值
 *   - 运行时代码统一从本文件读取 AppID，环境变量优先，回退到 manifest.json 默认值
 *   - 服务端（server/app/config.py）已使用环境变量：WX_MINI_APPID / WX_APP_APPID
 *   - 云函数（cloudfunctions/login/index.js）已使用环境变量：WX_MINIAPP_APPID
 *   - 本文件与上述环境变量命名保持一致，确保全栈配置统一
 *
 * 使用方式：
 *   import { WECHAT_APP_APPID, WECHAT_MINI_PROGRAM_APPID } from '@/config/wechat.config'
 */

/**
 * App 原生微信 AppID（Android/iOS 原生 App 的 OAuth/支付/分享）
 *
 * 环境变量: WX_APP_APPID（与服务端 server/app/config.py 保持一致）
 * 回退值: manifest.json → app-plus.distribute.sdkConfigs.oauth.weixin.appid
 */
export const WECHAT_APP_APPID: string =
  process.env.WX_APP_APPID || 'wx85fa429a9331b5c8'

/**
 * 微信小程序 AppID（mp-weixin 平台）
 *
 * 环境变量: WX_MINIAPP_APPID（与 cloudfunctions/login/index.js 保持一致）
 * 回退值: manifest.json → mp-weixin.appid
 */
export const WECHAT_MINI_PROGRAM_APPID: string =
  process.env.WX_MINIAPP_APPID || 'wx27028e276ffdbc5d'

/**
 * AppID 来源标识（用于调试与日志）
 */
export type WechatAppidSource = 'env' | 'manifest-default'

export const WECHAT_APP_APPID_SOURCE: WechatAppidSource =
  process.env.WX_APP_APPID ? 'env' : 'manifest-default'

export const WECHAT_MINI_PROGRAM_APPID_SOURCE: WechatAppidSource =
  process.env.WX_MINIAPP_APPID ? 'env' : 'manifest-default'

/**
 * 获取微信 AppID 配置摘要（用于调试）
 */
export function getWechatAppidSummary(): {
  appAppid: string
  appAppidSource: WechatAppidSource
  miniProgramAppid: string
  miniProgramAppidSource: WechatAppidSource
} {
  return {
    appAppid: WECHAT_APP_APPID,
    appAppidSource: WECHAT_APP_APPID_SOURCE,
    miniProgramAppid: WECHAT_MINI_PROGRAM_APPID,
    miniProgramAppidSource: WECHAT_MINI_PROGRAM_APPID_SOURCE,
  }
}

export default {
  WECHAT_APP_APPID,
  WECHAT_MINI_PROGRAM_APPID,
  WECHAT_APP_APPID_SOURCE,
  WECHAT_MINI_PROGRAM_APPID_SOURCE,
  getWechatAppidSummary,
}
