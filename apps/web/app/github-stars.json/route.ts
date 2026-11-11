// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * 首页 Star 按钮的星标数数据出口。
 *
 * 浏览器读 `/github-stars.json`,本路由在服务端打 GitHub API 并缓存,
 * 这样访客再多也只会命中一次上游请求(详见 src/config/github-stars.ts)。
 *
 * 端点可达性:nginx 只把 `/api/` 整段转给 Fastify,其余路径落 Next,
 * 故本文件刻意放在根路径(与 `/desktop-feed.json` 同型),不能用 `/api/*`。
 */
import { fetchGithubStarCount } from '@/config/github-stars'

// 5 分钟:星标数变化很慢,足以"看起来实时",又远低于 GitHub 公开 API 的 60 req/h。
// 静态导出(output: 'export')模式下 Route Handler 也要求声明 revalidate 或 force-static。
export const revalidate = 300

export async function GET() {
  const stars = await fetchGithubStarCount()
  // 取不到时短缓存 30s,让上游恢复后尽快自愈;取到时按 5 分钟共享缓存。
  const cacheControl =
    stars === null
      ? 'public, max-age=30'
      : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
  return Response.json({ stars }, { headers: { 'Cache-Control': cacheControl } })
}
