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
 * 必须同步这里(目录名 = URL 段名)。
 */
const STATIC_DOC_SLUGS: ReadonlySet<string> = new Set([
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

/**
 * 只有"文档请求"才落硬状态码;RSC 取数请求(客户端路由跳转)不落。
 *
 * 立因(2026-11-04 生产实测):Proxy 用 rewrite-with-status 落码时,生产 next start 是
 * `-H 0.0.0.0 -p 8851` 且反代带 `x-forwarded-proto: https`,Next 组装出的内部目标
 * `https://0.0.0.0:8851/...` 与请求 Host 的 `https://localhost:8851/...` 不同源 ⇒ 被判"外部代理"
 * ⇒ 真去 fetch 一个没有 TLS 的端口 ⇒ 500 `Internal Server Error`(21 字节)。
 * 所以硬码改成 Proxy 直接返回 Response,不再借 Next 的渲染通道。
 * RSC 请求的响应体必须是 RSC 载荷,Proxy 不能塞 HTML —— 这类请求放行,
 * 由页面自身 notFound() 渲染 not-found 界面(状态码对 RSC 无意义)。
 */
export function isDocsGateDocumentRequest(headers: Headers): boolean {
  if (headers.get('rsc') === '1') return false
  const accept = (headers.get('accept') ?? '').toLowerCase()
  return !accept.includes('text/x-component')
}

/** 硬状态码响应体:自包含 HTML(零脚本、零外链),404 与 500 文案分开且互不冒充。 */
export function renderDocsGateHtml(status: 404 | 500): string {
  const [title, heading, detail] =
    status === 404
      ? ['页面不存在', '文档不存在', '这个文档链接无效或已被移除。']
      : ['服务暂时不可用', '文档服务暂时不可用', '后端异常或超时,请稍后重试。']
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${status} · ${title} | 智汇AI</title><style>html,body{margin:0;height:100%;background:#0b0f14;color:#e6edf3;font:15px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}main{display:flex;min-height:100%;align-items:center;justify-content:center;padding:24px}div{max-width:520px;text-align:center}strong{display:block;font-size:40px;letter-spacing:.04em;color:#58a6ff}h1{margin:12px 0 8px;font-size:22px}p{margin:0 0 24px;color:#8b949e}a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}</style></head><body><main><div><strong>${status}</strong><h1>${heading}</h1><p>${detail}</p><a href="/docs">返回文档中心</a></div></main></body></html>`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
