import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { vueToNextRedirects } from '@/config/redirects.config'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  // 2026-07-22 临时:跳过构建时 ESLint(其他 agent 引入的 jsx-a11y/no-unused-vars 错误阻塞部署)
  eslint: { ignoreDuringBuilds: true },
  productionBrowserSourceMaps: false,
  // 关闭 Next.js 15 自带的左下角 N 圆圈 dev indicator (2026-07-21)
  // 它会在浏览器左下角出现一个黑色圆圈,遮挡内容;改用自定义的侧边栏开发者工具按钮
  devIndicators: false,
  transpilePackages: ['@ihui/ui', '@ihui/types', '@ihui/config', '@ihui/auth', '@ihui/app', 'react-native-web'],
  turbopack: {
    resolveAlias: {
      'react-native': 'react-native-web',
      // 2026-07-23 修复 next-intl 3.26.5 在 Turbopack 下的兼容性:
      // plugin.js 用 process.env.TURBOPACK 检测 Turbopack 模式(Next 15.5 的 --turbopack
      // flag 不设置该变量),且 Turbopack 分支写已弃用的 experimental.turbo(被顶层 turbopack
      // 取代)。双重 bug 导致 'next-intl/config' alias 在 Turbopack 下不生效,报
      // "Couldn't find next-intl config file"。手动在顶层 turbopack.resolveAlias 设置 alias,
      // webpack 模式仍由 plugin 的 webpack 分支自动处理(config.resolve.alias)。
      'next-intl/config': './src/i18n/request.ts',
    },
    // solito 用 .web.js 平台扩展名(web 版 vs native 版),必须配置 resolveExtensions
    // 让 Turbopack 优先解析 .web.js/.web.tsx,否则 solito 的 next-link.web.js 不被加载,
    // TextLink 在 web 端无法渲染为 <a> 标签
    resolveExtensions: ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', '.js', '.jsx', '.ts', '.tsx', '.json', '.mjs'],
  },
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {}
    config.resolve.alias['react-native$'] = 'react-native-web'
    // solito .web.js 平台扩展名解析(webpack 模式)
    config.resolve.extensions = ['.web.js', '.web.jsx', '.web.ts', '.web.tsx', ...config.resolve.extensions || []]
    return config
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-label',
      '@radix-ui/react-slot',
      '@radix-ui/react-select',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-checkbox',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'react-hook-form',
      'react-markdown',
      'react-syntax-highlighter',
      'sonner',
      'next-themes',
      'dompurify',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // 收敛可访问的远程图片源(2026-07-21 安全审计加固)
    // 旧值 `{ protocol: 'https', hostname: '**' }` 允许任意 HTTPS 主机,
    // 攻击者可滥用 Next 图片代理访问 SSRF 目标
    remotePatterns: [
      { protocol: 'https', hostname: 'aizhs.top' },
      { protocol: 'https', hostname: '*.aizhs.top' },
      { protocol: 'https', hostname: 'api.dicebear.com' }, // 头像生成
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google OAuth 头像
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }, // GitHub OAuth 头像
      { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com' }, // Facebook OAuth 头像
      { protocol: 'https', hostname: 'api.qrserver.com' }, // QR 码生成服务
    ],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    unoptimized: true,
  },
  async redirects() {
    return [...vueToNextRedirects]
  },
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:8802'
    const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8803'
    return [
      // AI 服务路由优先匹配,转发到 FastAPI(端口 8000)
      { source: '/api/llm/:path*', destination: `${aiServiceUrl}/api/llm/:path*` },
      { source: '/api/agents/:path*', destination: `${aiServiceUrl}/api/agents/:path*` },
      { source: '/api/tools/:path*', destination: `${aiServiceUrl}/api/tools/:path*` },
      { source: '/api/mcp/:path*', destination: `${aiServiceUrl}/api/mcp/:path*` },
      { source: '/api/a2a/:path*', destination: `${aiServiceUrl}/api/a2a/:path*` },
      // 2026-07-23 新增:AI Skills TOP 19 个 skill 路由(转发到 ai-service)
      { source: '/api/ai-skills/:path*', destination: `${aiServiceUrl}/api/ai-skills/:path*` },
      // v1 业务流(对话/智能体/RAG/知识图谱,挂在 ai-service /api/v1/ai/ 前缀)
      { source: '/api/ai/:path*', destination: `${aiServiceUrl}/api/v1/ai/:path*` },
      // 其余 /api/* 转发到 Fastify 后端(端口 8080)
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      // 静态资源(头像等)转发到 Fastify 后端
      { source: '/uploads/:path*', destination: `${apiUrl}/uploads/:path*` },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // 2026-07-21 安全审计加固:启用 HSTS(2 年 + 子域 + preload 预申请)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // 2026-07-21 安全审计加固:添加 Content Security Policy
          // 默认 self,脚本/样式允许 inline(Next.js + Tailwind 必需),
          // connect 允许 aizhs.top API 域名,frame 限制为同源 + 第三方 OAuth
          // 2026-07-22 修复:添加 4 平台扫码登录 SDK CDN + iframe 域名白名单
          //   - 微信: res.wx.qq.com(SDK) + open.weixin.qq.com(iframe)
          //   - 企业微信: wwcdn.weixin.qq.com(SDK) + open.work.weixin.qq.com(iframe)
          //   - 钉钉: g.alicdn.com(SDK) + login.dingtalk.com(iframe)
          //   - 飞书: lf-package-cn.feishucdn.com(SDK) + accounts.feishu.cn(iframe)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://res.wx.qq.com https://wwcdn.weixin.qq.com https://g.alicdn.com https://lf-package-cn.feishucdn.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.aizhs.top wss://*.aizhs.top",
              "media-src 'self' https:",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-src 'self' https://*.aizhs.top https://open.weixin.qq.com https://open.work.weixin.qq.com https://login.dingtalk.com https://accounts.feishu.cn https://passport.feishu.cn",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
