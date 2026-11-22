// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 站点 basePath 的单一事实源(GitHub Pages 项目站点挂在 /<repo>/ 下)。
 *
 * 为什么需要单独一份(2026-11-05 死链修复):
 *  - Next 的 `basePath`/`assetPrefix` 只改写 router、`<Link>`、`next/image` 这类内建出口;
 *    配置/数据里手写的站内绝对路径(`/downloads/...`)不会被改写。
 *  - GitHub Pages 上这些 href 解析到 `https://<user>.github.io/downloads/...`(根域),
 *    而不是 `https://<user>.github.io/IHUI-AI/downloads/...` ⇒ 实测 404。
 *  - 浏览器侧读不到 `next.config.ts` 的私有值,故构建期由 next.config 的 `env`
 *    注入 `NEXT_PUBLIC_BASE_PATH`(公开值,会被内联进客户端 bundle);
 *    服务端与构建脚本用 `resolveBasePath()` 现算 —— 两个出口都来自本文件,不写第二份口径。
 */

/** 构建期注入的 basePath;非 Pages 构建为空串(本机根路径仍然正确)。 */
export const BASE_PATH: string = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/**
 * 与 next.config.ts 同口径:仅 `GITHUB_PAGES=true` 启用;仓库名取 `GITHUB_REPOSITORY`
 * 的第二段(CI 一定在),取不到才回落到仓名字面量 —— 不在别处硬编码 `/IHUI-AI`。
 */
export function resolveBasePath(env: Record<string, string | undefined> = process.env): string {
  if (env.GITHUB_PAGES !== 'true') return ''
  const repoName = (env.GITHUB_REPOSITORY ?? '').split('/')[1] || 'IHUI-AI'
  return `/${repoName}`
}

/**
 * 给站内绝对路径加 basePath。
 *  - 只有以 `/` 开头的站内路径参与;外链(http/https)、相对路径、空串原样返回。
 *  - 已带前缀的路径不重复加(幂等),避免调用方二次包裹时冒出 `/IHUI-AI/IHUI-AI/...`。
 *  - basePath 为空 ⇒ 原样返回,保证本机(`/`)与生产根路径口径不变。
 */
export function withBasePath(href: string): string {
  if (BASE_PATH === '' || !href.startsWith('/')) return href
  if (href === BASE_PATH || href.startsWith(`${BASE_PATH}/`)) return href
  return `${BASE_PATH}${href}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
