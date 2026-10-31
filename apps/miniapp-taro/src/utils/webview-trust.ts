// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/** WebView 应用层信任白名单:仅 https(开发回环允许 http)且 host 在受信集合内才允许加载。
 * 纵深防御:微信业务域名白名单之外,再拦一层应用层 host 校验,防深链把 WebView 引到任意页。
 * 非信任 URL 由承载页走"复制链接、浏览器打开"的降级出口,不在应用内加载。
 *
 * 2026-11-01:这张表是**端侧策略**;判定机制在 `@ihui/shared/utils/webview-trust`。 */
import { isTrustedWebviewUrl as isSharedTrustedWebviewUrl } from '@ihui/shared'

const TRUSTED_WEBVIEW_HOSTS = new Set<string>([
  'aizhs.top',
  'api.aizhs.top',
  'open.weixin.qq.com',
  'open.work.weixin.qq.com',
  'login.dingtalk.com',
  'passport.feishu.cn',
  'challenges.cloudflare.com',
  // 2026-10-31 R12:备案查询入口(pkg-about/about/icp-record)必须能打开,否则只剩复制链接。
  'beian.miit.gov.cn',
  // 2026-10-31 R12:VIP 自动续费签约页(微信支付契约 redirect_url)的三个官方域。
  'payapp.weixin.qq.com',
  'pay.weixin.qq.com',
  'wxpay.wxutil.com',
])

const LOOPBACK_HOSTS = new Set<string>(['localhost', '127.0.0.1', '::1'])

/**
 * 判定机制已上收到共享层唯一实现 `@ihui/shared` 的 `isTrustedWebviewUrl`
 * (2026-11-01:RN `WebViewScreen` 缺同一道闸 ⇒ 会话授权码会被签给任意 origin,
 *  而本端的这份实现是仓内唯一的一份"事实判据" —— 两份实现必漂移,漂移侧表现是安静)。
 * 本文件保留的原因:① 调用方(`pages/webview/index.tsx`)的 import 路径不变;
 * ② 端侧**策略**(哪些第三方域可额外信任:微信/钉钉/飞书/备案/Cloudflare 挑战页)
 *    本来就属于小程序端,只有机制该共享。
 * `LOOPBACK_HOSTS` 留作端侧口径的显式交代(与共享层同一集合);若两处出现分歧即为本锁的失败。
 */
export function isTrustedWebviewUrl(raw: string): boolean {
  return isSharedTrustedWebviewUrl(raw, { extraHosts: Array.from(TRUSTED_WEBVIEW_HOSTS) })
}

export { LOOPBACK_HOSTS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
