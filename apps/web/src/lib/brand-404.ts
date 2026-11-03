// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

//
// brand-404.ts — /docs/[slug] 硬 404 的品牌页资源(2026-11-04 立)
//
// 为什么不再在 Proxy 里拼字符串:404 的语义(状态码 / noindex / 不回显 slug)已经正确,
// 但 808 字节的自包含页丢掉了站点品牌。这里把「构建期预渲染的静态 HTML」作为唯一资源:
//   1. 构建期由 scripts/build-brand-404.mts 渲染站内 NotFound 组件 + 编译最小 Tailwind CSS,
//      写到 <distDir>/static/brand-404.html;
//   2. 运行期 Proxy 只读这份资产并以 404 返回,不在请求期拼任何内容。
//
// 为什么不回显 slug:assembleBrand404Html 的入参里没有 slug/path(结构上不可能拼进去),
// 运行期也只读资产原文。测试用 sentinel slug 证伪。
//
// distDir 必须镜像 next.config.ts 的 IHUI_BUILD_DIST(蓝绿 .next-blue / .next-green):
// 资产要和当前实例正在服务的 CSS/产物同属一份 dist,否则会读到另一个颜色槽的旧页。
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const BRAND_404_TITLE = '404 · 页面未找到 | 智汇AI'

/** 当前活跃 dist 目录;与 next.config.ts 的 IHUI_BUILD_DIST 同源。 */
export function brand404DistDir(env: Record<string, string | undefined> = process.env): string {
  const distDir = env.IHUI_BUILD_DIST?.trim()
  return distDir || '.next'
}

/** 品牌 404 静态资产路径(distDir 可以是相对名或绝对路径)。 */
export function brand404Path(distDir?: string, cwd: string = process.cwd()): string {
  return path.resolve(cwd, distDir ?? brand404DistDir(), 'static', 'brand-404.html')
}

export interface AssembleBrand404Input {
  /** 构建期 renderToStaticMarkup 的产物 */
  markup: string
  /** 构建期 Tailwind 编译出的最小 CSS */
  css: string
  title?: string
}

/**
 * 纯拼装:doctype + lang + noindex + title + 内联 CSS + 预渲染 markup。
 * 入参没有请求路径/slug —— 这是「不回显 slug」的结构性保证,不是运行时过滤。
 */
export function assembleBrand404Html({
  markup,
  css,
  title = BRAND_404_TITLE,
}: AssembleBrand404Input): string {
  return [
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${title}</title>`,
    `<style>${css}</style>`,
    '</head><body>',
    markup,
    '</body></html>',
  ].join('')
}

export type Brand404Reader = (file: string) => Promise<string>

let cachedHtml: string | null = null

/** 读取构建期资产;成功后进程内缓存(404 热路径不重复读盘);缺失/空文件返回 null。 */
export async function loadBrand404Html(
  deps: { readFile?: Brand404Reader; distDir?: string; cwd?: string } = {},
): Promise<string | null> {
  if (cachedHtml) return cachedHtml
  const file = brand404Path(deps.distDir, deps.cwd)
  try {
    const read = deps.readFile ?? ((target: string) => readFile(target, 'utf8'))
    const html = await read(file)
    if (!html.trim()) return null
    cachedHtml = html
    return html
  } catch {
    return null
  }
}

/** 404 响应体:资产优先;仅开发/旧产物缺失时回退(生产构建必产资产,缺失即构建红)。 */
export function brand404Body(asset: string | null, fallback: string): string {
  return asset ?? fallback
}

/** 测试隔离用:清掉模块级缓存。 */
export function resetBrand404Cache(): void {
  cachedHtml = null
}
