// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * CSP 的**单一真相源**(2026-10-30 抽出)。
 *
 * 立因:同一份策略原先有两处消费者,而两处必须逐字一致才不出现"两个 CSP 头取交集"
 * 的意外收窄或放宽 —— 一处是 `next.config.ts` 的 `headers()`(静态、无 nonce),
 * 一处是 `middleware.ts`(逐请求、带 nonce)。两处各抄一份,迟早写歪,而写歪的表现
 * 是**白屏或某类第三方 SDK 静默加载失败**,不是报错。
 *
 * 为什么需要两套(nonce 有/无)而不是统一上 nonce —— 见 `PUBLIC_HTML_CACHE_SOURCES` 的注释:
 * 站内有一批公开内容页走 EO 边缘缓存(`s-maxage`),per-request nonce 与共享缓存互斥:
 * 要么缓存件里的 nonce 被跨用户复用(削弱 nonce 的唯一性保证),要么这批页面不能再被缓存
 * (推翻 2026-10-21 的公网提速成果,而那是针对境内回源慢做的)。故按"页面有无用户态"分档,
 * 而不是一刀切。
 */

/**
 * 扫码登录 / 人机校验类 SDK 的脚本源白名单。
 * 只在**无 nonce** 的分支里是有效约束;有 nonce + strict-dynamic 时,CSP3 浏览器会忽略
 * 这份 host 列表(改由"已信任脚本动态插入"决定),保留它是为了老浏览器仍能加载这些 SDK。
 */
export const SCRIPT_SRC_HOSTS = [
  // res.wx.qq.com:微信 WxLogin.js
  // wwcdn.weixin.qq.com:企业微信 wwLogin-1.2.7.js
  // g.alicdn.com:钉钉 h5-dingtalk-login 0.21.0
  // lf-package-cn.feishucdn.com:飞书 LarkSSOSDKWebQRCode-1.0.3.js
  'https://res.wx.qq.com',
  'https://wwcdn.weixin.qq.com',
  'https://g.alicdn.com',
  'https://lf-package-cn.feishucdn.com',
  'https://cdn.jsdelivr.net',
  'https://challenges.cloudflare.com',
].join(' ')

export interface BuildCspOptions {
  /** 逐请求 nonce。给了就走"nonce + strict-dynamic"分支,不给走"unsafe-inline"分支。 */
  nonce?: string
  /** 开发模式:Next dev 的 HMR / React Refresh 与 eval-based source map 依赖 eval。 */
  dev: boolean
}

/**
 * 生成 CSP 字符串。
 *
 * 有 nonce 时**必须**同时摘掉 `'unsafe-inline'`:按 CSP3,`script-src` 里一旦出现 nonce,
 * `'unsafe-inline'` 会被浏览器**忽略**。留着它不会"多一层兜底",只会让读代码的人误以为
 * 内联脚本仍被放行,而实际已被拦 —— 这种"看起来有、实际没有"的双写是排查事故时最费时间的。
 *
 * ⚠️ 调用方必须把同一条字符串**同时**写进请求头与响应头:Next 从**请求头**的
 * `content-security-policy` 里读 nonce 并给自有 inline bootstrap script 打上它;
 * 响应头那份才是浏览器实际执行的策略。两边不一致 ⇒ nonce 对不上 ⇒ 白屏。
 */
export function buildCsp({ nonce, dev }: BuildCspOptions): string {
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${SCRIPT_SRC_HOSTS}`
    : dev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${SCRIPT_SRC_HOSTS}`
      : `script-src 'self' 'unsafe-inline' ${SCRIPT_SRC_HOSTS}`

  return [
    "default-src 'self'",
    scriptSrc,
    // style-src 保留 'unsafe-inline':样式注入的利用面远小于脚本执行,且 Next/Tailwind
    // 的运行时 <style> 与组件内联 style 依赖它;上 nonce 需要全链路改造(样式属性无法带 nonce),
    // 收益与成本不成比例。这是一处**明确接受**的残余风险,不是遗漏。
    "style-src 'self' 'unsafe-inline'",
    // 2026-10-28 评估后**保留** https: 通配,不按 images.remotePatterns 收窄:
    // AI 返回的图片 URL 来自模型输出、用户头像来自第三方 OAuth,域名不可枚举。
    // 收窄会直接打断功能(见 next.config.ts 同处注释)。已知残余风险:https 图片可被
    // 当作数据外泄信道。正确解法是后端图片代理 + 域名白名单,属跨端改造。
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    dev
      ? "connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:* http://ipc.localhost https://ipc.localhost"
      : "connect-src 'self' https: wss: http://ipc.localhost https://ipc.localhost",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    // 必须是 'self' 而非 'none' —— WorkPanel 内置浏览器用 iframe 嵌同源页面,
    // 'none' 会连自己都嵌不了(2026-08-02 踩过)。
    "frame-ancestors 'self'",
    // 扫码登录 SDK 内部创建 iframe 渲染二维码;frame-src 放开 https: 供 WorkPanel 内嵌外部站点。
    "frame-src 'self' https: https://open.weixin.qq.com https://open.work.weixin.qq.com https://login.dingtalk.com https://passport.feishu.cn https://challenges.cloudflare.com",
    "form-action 'self'",
  ].join('; ')
}
