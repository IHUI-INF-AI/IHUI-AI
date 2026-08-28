/**
 * 图片/文件 CDN 路由(2026-08-27 立)
 * - 直接从磁盘读取 API 服务的公开上传目录 apps/api/uploads/public 出图,
 *   由 web(8801) 同源托管,Host 无关:根域 aizhs.top / bsm.aizhs.top 等走 web
 *   的请求统一由此路由返回,避免经 next.config rewrites 反向代理到 8802。
 * - 注意:file.aizhs.top 公网指向第三方「写字楼租金管理系统」(同 Cloudflare
 *   zone 另一 tunnel/origin),非我方域名,勿依赖/勿尝试 reclaim。
 * - api.aizhs.top/uploads 由 Cloudflare 隧道直指 8802,由 API 的 @fastify/static 服务,不经此路由。
 * - 小程序远程图标见 apps/web/app/cdn/[[...path]]/route.ts(直读 deploy/server-root)。
 * - 安全:仅允许读取 uploads/public 白名单目录,严格防路径穿越(拒绝 .. / 绝对段)。
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { existsSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

export const dynamic = 'force-dynamic'

// web 进程 cwd 恒为 apps/web(run-web.ps1 Set-Location),uploads/public 在同级 apps/api/uploads/public
const PUBLIC_UPLOADS_ROOT = resolve(process.cwd(), '..', 'api', 'uploads', 'public')

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.zip': 'application/zip',
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params
  if (!path || path.length === 0) {
    return new NextResponse('Not Found', { status: 404 })
  }
  // 防路径穿越:逐段校验,拒绝空段 / 父目录段 / 含路径分隔符的段
  for (const seg of path) {
    if (seg === '' || seg === '..' || seg.startsWith('/') || seg.startsWith('\\')) {
      return new NextResponse('Not Found', { status: 404 })
    }
  }
  const filePath = resolve(PUBLIC_UPLOADS_ROOT, ...path)
  // 必须在白名单根目录内(解析后严格前缀校验,防 ../ 逃逸)
  if (filePath !== PUBLIC_UPLOADS_ROOT && !filePath.startsWith(PUBLIC_UPLOADS_ROOT + sep)) {
    return new NextResponse('Not Found', { status: 404 })
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return new NextResponse('Not Found', { status: 404 })
  }
  const ext = extname(filePath).toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'
  const { readFile } = await import('node:fs/promises')
  const data = await readFile(filePath)
  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
