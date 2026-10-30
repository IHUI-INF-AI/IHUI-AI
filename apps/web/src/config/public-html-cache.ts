// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 公开内容页的边缘缓存白名单 —— **单一真相源**(2026-10-30 抽出)。
 *
 * 两个消费者,必须同源:
 *   ① `next.config.ts` 的 `headers()` —— 给这些路径发 `Cache-Control: public, s-maxage=…`;
 *   ② `middleware.ts` —— **排除**这些路径,不给它们上 per-request nonce。
 *
 * 为什么要排除,这是本轮唯一一处真正的架构取舍,写清楚免得后人"顺手统一":
 * per-request nonce 的语义是"这条响应里的 nonce 只对这一条响应有效"。而边缘缓存(libs:
 * 腾讯 EO / CDN)会把**同一条响应**发给成千上万个用户 —— 缓存件里的 nonce 就此变成
 * 一个所有人共享的常量:
 *   - 要么接受"nonce 被跨用户复用"(它不再唯一,只剩"不可预测注入点"这半条价值);
 *   - 要么让这批页面不可缓存 —— 那就推翻 2026-10-21 为境内回源慢做的公网提速。
 * 两者都不是"白拿"。故按**页面有没有服务端用户态**分档:
 *   - 白名单内(本节所列)= 无用户态、可共享缓存 ⇒ 保留 `'unsafe-inline'`,缓存收益不受影响;
 *   - 其余全部(含 登录 / 聊天 / 钱包 / 订单 / 后台 / 设置 / 用户中心 / SSO 回调)= 逐请求 nonce。
 * XSS 真正能变现的地方(会话令牌、钱包、后台权限)恰好全在后者。
 *
 * 判据(**与本数组完全一致**,加入者必须同时满足):
 *   - 页面没有服务端用户态(不读 cookies / headers / session / 鉴权);
 *   - 用户相关数据都在客户端 hydrate 后填充 ⇒ 共享 HTML 外壳不串号。
 * 明确排除(不得加进来):/login、/sso/*、OAuth 回调、/admin/*、/edu/edu-management/*、
 * /user/*、/member/*、/messages/*、/chat/*、/wallet/*、/orders/*、/settings/*、
 * /developer/*、/publish/*、/distribution/*、/h5/share/*、一次性 code / 授权流。
 * 已知限制:根 layout 用 cookies() 读 locale,共享缓存只影响 <html lang> 首帧;
 * 正文由客户端 i18n 渲染。要按语种分缓存需在 EO 配 Cookie: locale。
 */

export interface PublicHtmlCacheRule {
  source: string
  value: string
}

export const PUBLIC_HTML_CACHE_RULES: PublicHtmlCacheRule[] = [
  // 状态页:Next 数据缓存 60s;边缘只留 60s,故障态最多多活 1 分钟。
  { source: '/status', value: 'public, s-maxage=60, stale-while-revalidate=60' },
  // 新闻/博客:正文变化快,边缘 5 分钟 + 回退 1 小时。
  { source: '/ai-news', value: 'public, s-maxage=300, stale-while-revalidate=3600' },
  { source: '/blog/:path*', value: 'public, s-maxage=300, stale-while-revalidate=3600' },
  { source: '/news/:path*', value: 'public, s-maxage=300, stale-while-revalidate=3600' },
  {
    source: '/announcements/:path*',
    value: 'public, s-maxage=300, stale-while-revalidate=3600',
  },
  { source: '/articles/:path*', value: 'public, s-maxage=300, stale-while-revalidate=3600' },
  // 静态营销/文档/协议/对比页:内容低频变化,5 分钟 + 回退 1 天。
  { source: '/agreement/:path*', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/legal/:path*', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/faq', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/help/:path*', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/contact', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/use-cases/:path*', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  {
    source: '/ja/use-cases/:path*',
    value: 'public, s-maxage=300, stale-while-revalidate=86400',
  },
  {
    source: '/ko/use-cases/:path*',
    value: 'public, s-maxage=300, stale-while-revalidate=86400',
  },
  {
    source: '/zh-TW/use-cases/:path*',
    value: 'public, s-maxage=300, stale-while-revalidate=86400',
  },
  { source: '/compare/:path*', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/docs/:path+', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/en/:path+', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/models-pricing', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/developers', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  { source: '/enterprise', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  {
    source: '/enterprise/inquiry',
    value: 'public, s-maxage=300, stale-while-revalidate=86400',
  },
  { source: '/free-ai', value: 'public, s-maxage=300, stale-while-revalidate=86400' },
  // 下载页:版本号由 generateStaticParams 决定,10 分钟 + 回退 1 小时。
  { source: '/download/:platform', value: 'public, s-maxage=600, stale-while-revalidate=3600' },
  // 市场列表壳:内容更新较频繁,2 分钟 + 回退 1 小时。
  { source: '/agents', value: 'public, s-maxage=120, stale-while-revalidate=3600' },
  { source: '/models', value: 'public, s-maxage=120, stale-while-revalidate=3600' },
  { source: '/plaza', value: 'public, s-maxage=120, stale-while-revalidate=3600' },
  { source: '/ai-world', value: 'public, s-maxage=120, stale-while-revalidate=3600' },
  { source: '/skills-market', value: 'public, s-maxage=120, stale-while-revalidate=3600' },
  { source: '/mcp-store', value: 'public, s-maxage=120, stale-while-revalidate=3600' },
  { source: '/capability-market', value: 'public, s-maxage=120, stale-while-revalidate=3600' },
]

/**
 * 把 Next 的 `source` 模式(`:path*` / `:path+` / `:param`)折成一条正则。
 * 只支持本数组实际用到的三种形态 —— 不做通用路由器,免得这段代码自己成为"第三种真相"。
 */
function sourceToRegExp(source: string): RegExp {
  const escaped = source
    .split('/')
    .map((seg) => {
      if (seg === ':path*') return '(?:/.*)?'
      if (seg === ':path+') return '/.+'
      if (seg.startsWith(':')) return '/[^/]+'
      return '/' + seg
    })
    .join('')
  return new RegExp(`^${escaped}/?$`)
}

const PUBLIC_HTML_CACHE_MATCHERS = PUBLIC_HTML_CACHE_RULES.map((r) => sourceToRegExp(r.source))

/**
 * 该 pathname 是否属于"公开可缓存页"(⇒ 不上 nonce、保留 unsafe-inline)。
 * middleware 与文档共用这一判据,避免"加了缓存规则但忘了排除 nonce"。
 */
export function isPublicCacheablePath(pathname: string): boolean {
  return PUBLIC_HTML_CACHE_MATCHERS.some((re) => re.test(pathname))
}
