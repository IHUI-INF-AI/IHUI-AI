/**
 * 图片站点地图(2026-07-26 立,GEO + Google Images 优化):
 * 遵循 [Google 图片站点地图规范](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)。
 *
 * 扫描 apps/web/public/images/ 下的所有图片资源,为 Google Images 抓取提供
 * 独立的 sitemap。Google 不会抓取嵌套在普通 sitemap 内的图片(2023 起官方要求),
 * 必须使用专用 image-sitemap。
 *
 * 路由:/image-sitemap.xml
 * 缓存:1 小时(同 sitemap.xml/rss.xml/atom.xml 策略)
 */
import fs from 'node:fs'
import path from 'node:path'

// 2026-07-26:Next.js output:'export' 静态导出模式要求所有 Route Handler
// 必须显式声明 force-static,否则构建报错。
export const dynamic = 'force-static'

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://aizhs.top'
const IMAGES_ROOT = path.join(process.cwd(), 'public', 'images')
const LICENSE_URL = 'https://aizhs.top/agreement'

const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.svg', '.gif'])

// 走查 apps/web/public/images/ 所有文件,产出 sitemap 友好的图片清单
function collectImages(): Array<{ url: string; relPath: string }> {
  if (!fs.existsSync(IMAGES_ROOT)) return []
  const out: Array<{ url: string; relPath: string }> = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!SUPPORTED_EXTS.has(ext)) continue
      // 排除带 query 的特殊文件(如 miniapp-qr.png 11 字节的空文件)
      const stat = fs.statSync(full)
      if (stat.size < 100) continue
      const rel = path.relative(path.join(process.cwd(), 'public'), full).replace(/\\/g, '/')
      out.push({
        url: `${SITE_URL}/${rel}`,
        relPath: rel,
      })
    }
  }
  walk(IMAGES_ROOT)
  // 按路径排序,保证每次构建输出稳定
  out.sort((a, b) => a.relPath.localeCompare(b.relPath))
  return out
}

// 从文件名/路径派生 title(用于 <image:title>);中文友好
function deriveTitle(relPath: string): string {
  const base = path.basename(relPath, path.extname(relPath))
  // 把 kebab-case / snake_case 转成标题
  const titled = base
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
  return `${titled} — 智汇 AI 官方素材`
}

function deriveCaption(relPath: string): string {
  const dir = path.dirname(relPath).replace(/\\/g, '/')
  if (dir.startsWith('images/ihui-ai')) return '智汇 AI 品牌主视觉(主色 / 背景 / 营销素材)'
  if (dir.startsWith('images/common')) return '智汇 AI 通用图标与装饰素材'
  if (dir.startsWith('images/flags')) return '智汇 AI 多语言国旗图标(中/繁/英/日/韩)'
  if (dir.startsWith('images/story')) return '智汇 AI 团队故事配图'
  if (dir.startsWith('images/oauth-providers')) return '智汇 AI 第三方登录品牌素材'
  if (dir.startsWith('images/loginSANFANG')) return '智汇 AI 扫码登录三方图标'
  if (dir.startsWith('images/brands')) return '智汇 AI 合作品牌素材'
  return '智汇 AI(IHUI AI)全栈 AI 操作系统官方图片资源'
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export async function GET() {
  const images = collectImages()
  const buildDate = new Date().toISOString()

  // 把图片聚合到承载页面(host page):首页 / 关于页 / 文档首页 / 品牌页
  // 每个 host page 下挂 6-8 张图片
  const HOST_PAGES = [
    { loc: `${SITE_URL}/`, priority: 1.0 },
    { loc: `${SITE_URL}/about`, priority: 0.8 },
    { loc: `${SITE_URL}/docs`, priority: 0.7 },
    { loc: `${SITE_URL}/brands`, priority: 0.5 },
  ]
  const urls: string[] = []
  const chunk = Math.max(1, Math.ceil(images.length / HOST_PAGES.length))
  HOST_PAGES.forEach((page, idx) => {
    const slice = images.slice(idx * chunk, (idx + 1) * chunk)
    if (slice.length === 0) return
    urls.push(`  <url>
    <loc>${escapeXml(page.loc)}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${page.priority}</priority>${slice
      .map(
        (img) => `
    <image:image>
      <image:loc>${escapeXml(img.url)}</image:loc>
      <image:title>${escapeXml(deriveTitle(img.relPath))}</image:title>
      <image:caption>${escapeXml(deriveCaption(img.relPath))}</image:caption>
      <image:license>${escapeXml(LICENSE_URL)}</image:license>
    </image:image>`,
      )
      .join('')}
  </url>`)
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
      'X-Build-Date': buildDate,
    },
  })
}
