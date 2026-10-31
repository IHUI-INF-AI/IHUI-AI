// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
 *
 * dev + nonce 补 `'unsafe-eval`(2026-10-31 修,dev-only,不动 2026-10-30 的收紧):
 * 原三元结构 `nonce ? <nonce 分支> : (dev ? … : …)` 让"发了 nonce 就整条跳过 dev 分支",
 * 而 proxy.ts 对 HTML 路径**开发态也发 nonce** ⇒ dev 页永远拿不到 'unsafe-eval' ⇒
 * Next dev 的 HMR / React Refresh / eval 型 source map 被 CSP 拦死,页面落进错误边界
 * (控制台原文 `eval() is not supported in this environment ... CSP`),§17「UI 改动必须
 * 真浏览器验证」因此结构性失效。**仅 dev 态**在 nonce 分支追加 'unsafe-eval';
 * 生产态 nonce 分支一字不变(仍无 'unsafe-eval',也依铁律②不带 'unsafe-inline')。
 */
export function buildCsp({ nonce, dev }: BuildCspOptions): string {
  const scriptSrc = nonce
    ? dev
      ? // dev-only 放宽:只加 'unsafe-eval',绝不加 'unsafe-inline'(CSP3 下会被忽略的双写)
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${SCRIPT_SRC_HOSTS}`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${SCRIPT_SRC_HOSTS}`
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
    // 2026-10-30 收口(沿用当日已落地的收紧,不得回退成 `https:` 通配):
    // AI 对话 / 文章 / 用户附件里的图现在全部经同源代理 /api/media/image 加载
    // (浏览器同源、自动带 httpOnly auth cookie,源站 CDN 不再被直连),
    // 于是外部域名不再进入 CSP 评估面 —— 原先"https 图片可当数据外泄信道"的残余风险就此清零。
    // 保留的 7 个域名与 `images.remotePatterns` 完全一致:那是 next/image 已约束的
    // 头像/图标信任边界,同尺收窄,不引入新信任面。
    // ⚠️ 有人把这行改回 `https:` 就等于把上面那次收口推翻,且不会报错 —— 只会静默放开外泄面。
    "img-src 'self' data: blob: https://aizhs.top https://*.aizhs.top https://api.dicebear.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://platform-lookaside.fbsx.com https://api.qrserver.com https://test-for-dp.oss-cn-guangzhou.aliyuncs.com",
    "font-src 'self' data:",
    dev
      ? "connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:* http://ipc.localhost https://ipc.localhost"
      : // 2026-10-31 收口:生产档原为 `https: wss:` 通配 —— 那等于让"任意 https 域"都能当
        // XSS 之后的数据外泄信道(同源策略里 connect-src 是最后一道)。逐目标枚举过
        // (apps/web/src + app + packages,含 WS/EventSource/beacon/tauri-http 四类出口):
        // 浏览器真正会连的外部源只有 api.aizhs.top 的 https + wss(WS 换票与流式),
        // 其余(静态图/下载/媒体)都经同源 /api/* 代理;桌面壳另有 ipc.localhost(自定义协议)。
        // 与 apps/desktop/src-tauri/tauri.conf.json 的 CSP 同源同名单,改一处必须同改另一处。
        "connect-src 'self' https://api.aizhs.top wss://api.aizhs.top http://ipc.localhost https://ipc.localhost",
    // 2026-10-30 末已根治收紧:视频/音频全部走同源代理(<video src="/api/media/stream?url=…">,
    // 经 web rewrites 同源访问,浏览器自动带 httpOnly auth cookie),故不需要 https: 通配;
    // 后端复用下载代理的 SSRF 闸门并透传 Range(播放器可拖拽 seek)。blob: 保留 —— 下载按钮
    // 走 fetch→ObjectURL 落盘,正是 blob: 源。
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
