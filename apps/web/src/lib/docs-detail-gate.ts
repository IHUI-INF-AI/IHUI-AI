// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// docs-detail-gate.ts — /docs/[slug] 的硬状态码闸(Proxy 面专用,2026-11-03 立)
//
// 为什么落在这里:页面侧的 notFound()/抛错在本应用恒被 loading.tsx 的流式外壳吞成 200
// (根段与 (main) 段各有一个 loading.tsx,探针矩阵 v-b/c/d/g 实测)。Proxy 在响应头发出前
// 就能改写状态码,是唯一能给硬 404 / 硬 500 的位置 —— 上游 docs-slug-probe 的提交说明
// 也把「判定前移到请求时(Proxy 层)」列为真 404 的必需路径。
//
// 判据不在本文件复算:四态由 docs-slug-probe.classifyDocResponse 判,状态码由
// docProbeHttpStatus 落(AGENTS.md §22c:判据一律 import 源模块)。
import type { NextRequest } from 'next/server'

import { docProbeHttpStatus, probeDocBySlug, type DocProbeOptions } from './docs-slug-probe'

/**
 * 与 `app/(main)/docs/<目录>` 一一对应的静态文档页。
 *
 * 这些 slug 由各自的 page.tsx 直接渲染(内容写在仓库里,不查后端),后端未必有同名记录;
 * 若把它们也送去探针,后端一句「没有」就会把本来正常的页面判成 404。新增静态文档页时
 * 必须同步这里(目录名 = URL 段名)。导出仅供镜像测试对账目录树(§22c:不在测试里复算)。
 */
export const STATIC_DOC_SLUGS: ReadonlySet<string> = new Set([
  'agent',
  'api',
  'manual',
  'mcp',
  'models',
  'quickstart',
  'rag',
  'self-host',
  'team',
  'workflow',
])

/**
 * 取出「需要探针判定」的文档详情 slug;不是文档详情请求(含静态文档页、/docs 索引、
 * /docs/manual/xxx 这类多段路径)一律返回 null = 完全不碰。
 *
 * 只认单段:本应用只有默认语言有 `/docs/[slug]` 路由(`/en/docs` 是独立静态页,
 * 构建清单里没有 `/en/docs/[slug]`),所以不做语言前缀展开。
 */
export function extractDocsDetailSlug(pathname: string): string | null {
  const matched = /^\/docs\/([^/]+)\/?$/.exec(pathname)
  const raw = matched?.[1]
  if (!raw) return null
  let slug: string
  try {
    slug = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (!slug || STATIC_DOC_SLUGS.has(slug)) return null
  return slug
}

/**
 * 文档详情请求的硬状态码:404 / 500 / null(放行 200)。
 * 探针超时压到 2.5s:Proxy 在请求首字节之前同步跑,不能让后端抖动把整页拖成超时。
 */
export async function docsDetailGateStatus(
  pathname: string,
  options: DocProbeOptions = {},
): Promise<404 | 500 | null> {
  const slug = extractDocsDetailSlug(pathname)
  if (!slug) return null
  const result = await probeDocBySlug(slug, {
    timeoutMs: 2500,
    dataCache: false,
    ...options,
  })
  return docProbeHttpStatus(result.state)
}

/** Proxy 便于直接喂 NextRequest;与上面同一条判据,零分叉。 */
export function docsDetailGateStatusOf(request: NextRequest): Promise<404 | 500 | null> {
  return docsDetailGateStatus(request.nextUrl.pathname)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
