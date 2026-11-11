// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * GitHub 仓库星标数(首页 Star 按钮的唯一取数出口)。
 *
 * 首页「Star on GitHub」按钮要展示仓库**真实**星标数,不能写死。
 * 取数刻意只走服务端:
 *  - 浏览器直连 api.github.com 的未认证配额是 60 次/小时/IP,访客一多就限流;
 *  - 国内访客直连 GitHub API 经常不可达,按钮会永远没有数字。
 * 服务端取一次、按 revalidate 缓存,浏览器统一读本站 `/github-stars.json`。
 */

/** 仓库全名:CI 里 GITHUB_REPOSITORY 一定有,生产/本机回落到仓名字面量。 */
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'IHUI-INF-AI/IHUI-AI'

/** 单次请求上限:GitHub 抖动时不能让首页数据出口一直挂着;8s 容忍首连 DNS/TLS 慢的国内链路。 */
const FETCH_TIMEOUT_MS = 8000

/**
 * 上游取数的数据缓存时长(5 分钟):星标数变化很慢,足以"看起来实时",
 * 又远低于 GitHub 公开 API 的 60 req/h 限流。与 `app/github-stars.json/route.ts`
 * 的 `revalidate` 同值(Next 要求 segment 配置写成字面量,故那边无法直接引用本常量)。
 */
const STARS_REVALIDATE_SECONDS = 300

/** Next 的 fetch 扩展选项(数据缓存);单测注入的自定义实现会忽略该字段。 */
type FetchWithNextCache = (
  input: string,
  init: RequestInit & { next?: { revalidate?: number } },
) => Promise<Response>

/**
 * 读仓库当前星标数。
 * 取不到(网络不可达 / 限流 / 字段异常)一律返回 null —— 由调用方决定降级形态,
 * 绝不用本地写死的数字或上一次的值冒充"实时"。
 */
export async function fetchGithubStarCount(
  fetchImpl: FetchWithNextCache = fetch,
): Promise<number | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'ihui-ai-web',
  }
  // 公开仓库不配 token 也能读(60 req/h);配了配额提升到 5000 req/h,属可选增益。
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

  try {
    const res = await fetchImpl(`https://api.github.com/repos/${GITHUB_REPO}`, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // 显式声明缓存时长:不依赖 segment revalidate 推导 fetch 默认缓存,
      // 也让静态导出(output: 'export')构建期就能把本路由预渲染成静态 JSON。
      next: { revalidate: STARS_REVALIDATE_SECONDS },
    })
    if (!res.ok) return null
    const data: unknown = await res.json()
    const stars = (data as { stargazers_count?: unknown } | null)?.stargazers_count
    return typeof stars === 'number' && Number.isFinite(stars) && stars >= 0 ? Math.trunc(stars) : null
  } catch {
    return null
  }
}
