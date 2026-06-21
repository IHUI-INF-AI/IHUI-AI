/**
 * 自动生成 sitemap.xml
 *
 * 大白话：扫描项目里所有路由文件，把不需要登录就能访问的公开页面地址收集起来，
 * 拼成一个 sitemap.xml 文件，让搜索引擎知道我们有哪些页面可以收录。
 *
 * 运行方式：npm run generate:sitemap
 * 构建时自动调用：见 package.json 的 build 脚本
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ROUTER_MODULES_DIR = path.resolve(__dirname, '../src/router/modules')
const PUBLIC_SITEMAP_PATH = path.resolve(__dirname, '../public/sitemap.xml')
const SITE_BASE = 'https://www.zhihui-ai.com'

// 公开页面白名单：只有这些路径会进 sitemap
// 这些是真正面向访客的页面，不包含后台/用户中心/管理功能
const PUBLIC_PATHS = new Set<string>([
  '/',
  '/agents',
  '/agents/category',
  '/plaza',
  '/xuqiu',
  '/vip',
  '/open',
  '/open/agents',
  '/open/apis',
  '/open/docs',
  '/open/models',
  '/open/sdks',
  '/learn-ai',
  '/community',
  '/ai-community',
  '/courses',
  '/ai-career',
  '/ai-world',
  '/enterprise',
  '/tech-service',
  '/about',
  '/about/about-us',
  '/about/become-supplier',
  '/about/contact-us',
  '/about/news-center',
  '/docs',
  '/document-center',
  '/help',
  '/ranking',
  '/tools',
  '/privacy-policy',
  '/terms-of-service',
  '/user-agreement',
  '/payment-terms',
])

// 优先级映射：首页最高，核心产品页次之，其他默认 0.6
function getPriority(urlPath: string): string {
  if (urlPath === '/') return '1.0'
  const high = ['/agents', '/plaza', '/open', '/xuqiu']
  if (high.includes(urlPath)) return '0.9'
  const medium = ['/vip', '/learn-ai', '/community', '/ai-community', '/courses', '/ai-world', '/tools', '/ranking']
  if (medium.includes(urlPath)) return '0.8'
  const low = ['/about', '/docs', '/document-center', '/help', '/enterprise', '/tech-service']
  if (low.includes(urlPath)) return '0.7'
  return '0.6'
}

// 更新频率映射
function getChangefreq(urlPath: string): string {
  if (urlPath === '/') return 'daily'
  const daily = ['/agents', '/plaza', '/xuqiu', '/community', '/ai-community', '/ranking']
  if (daily.includes(urlPath)) return 'daily'
  const weekly = ['/vip', '/learn-ai', '/courses', '/open', '/docs', '/document-center', '/tools', '/ai-world']
  if (weekly.includes(urlPath)) return 'weekly'
  return 'monthly'
}

function main() {
  // 扫描路由文件，验证白名单路径是否都存在
  if (!fs.existsSync(ROUTER_MODULES_DIR)) {
    console.error(`[sitemap] 路由模块目录不存在: ${ROUTER_MODULES_DIR}`)
    process.exit(1)
  }

  const files = fs.readdirSync(ROUTER_MODULES_DIR).filter(f => f.endsWith('.ts') && !f.includes('.test.'))
  const allRoutePaths = new Set<string>()

  for (const file of files) {
    const filePath = path.join(ROUTER_MODULES_DIR, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    // 匹配 path: 'xxx' 或 path: "xxx"
    const pathRegex = /path\s*:\s*['"]([^'"]+)['"]/g
    let match
    while ((match = pathRegex.exec(content)) !== null) {
      allRoutePaths.add(match[1])
    }
  }

  // 检查白名单路径是否都在路由里存在
  const missing = Array.from(PUBLIC_PATHS).filter(p => !allRoutePaths.has(p))
  if (missing.length > 0) {
    console.warn(`[sitemap] 警告: 以下白名单路径在路由中未找到, 已跳过:`)
    missing.forEach(p => console.warn(`  - ${p}`))
  }

  // 只保留白名单中且在路由里存在的路径
  const validPaths = Array.from(PUBLIC_PATHS).filter(p => allRoutePaths.has(p))

  // 排序：首页第一，其他按字母序
  const sortedPaths = validPaths.sort((a, b) => {
    if (a === '/') return -1
    if (b === '/') return 1
    return a.localeCompare(b)
  })

  const today = new Date().toISOString().split('T')[0]

  const urls = sortedPaths.map(p => {
    const loc = `${SITE_BASE}${p === '/' ? '/' : p}`
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${getChangefreq(p)}</changefreq>
    <priority>${getPriority(p)}</priority>
  </url>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`

  fs.writeFileSync(PUBLIC_SITEMAP_PATH, xml, 'utf-8')
  console.log(`[sitemap] 已生成 ${sortedPaths.length} 个 URL -> ${PUBLIC_SITEMAP_PATH}`)
  console.log(`[sitemap] 路径列表:`)
  sortedPaths.forEach(p => console.log(`  - ${p}`))
}

main()
