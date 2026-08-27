/**
 * 小程序远程图标 CDN 路由(2026-08-27 立)
 * - 直接从磁盘读取 deploy/server-root 出图(原 cdn-server.js 的静态根目录),
 *   由 web(8801) 同源托管,Host 无关:公网 https://aizhs.top/cdn/{path} 出图。
 * - 背景:小程序图标原托管于 file.aizhs.top / bspapp.com(已失效),
 *   cdn-server.js 仅监听本机 80 端口、img.aizhs.top DNS 未配置,公网不可达;
 *   此路由给出无需改 DNS/隧道/Cloudflare 的稳定公网入口。
 * - 安全:仅允许读取 server-root 白名单目录,严格防路径穿越(拒绝 .. / 绝对段)。
 */
import { NextRequest, NextResponse } from 'next/server'
import { existsSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

export const dynamic = 'force-dynamic'

// web 进程 cwd 恒为 apps/web(run-web.ps1 Set-Location),server-root 在仓库 deploy/server-root
const CDN_ROOT = resolve(process.cwd(), '..', '..', 'deploy', 'server-root')

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
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
  const filePath = resolve(CDN_ROOT, ...path)
  // 必须在白名单根目录内(解析后严格前缀校验,防 ../ 逃逸)
  if (filePath !== CDN_ROOT && !filePath.startsWith(CDN_ROOT + sep)) {
    return new NextResponse('Not Found', { status: 404 })
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    return new NextResponse('Not Found', { status: 404 })
  }
  // 空文件(占位哨兵)不返回 0 字节 200,直接 404;真图替换后自然 200
  if (statSync(filePath).size === 0) {
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
