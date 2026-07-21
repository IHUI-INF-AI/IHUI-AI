import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { vueToNextRedirects } from '@/config/redirects.config'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  productionBrowserSourceMaps: false,
  // 关闭 Next.js 15 自带的左下角 N 圆圈 dev indicator (2026-07-21)
  // 它会在浏览器左下角出现一个黑色圆圈,遮挡内容;改用自定义的侧边栏开发者工具按钮
  devIndicators: false,
  transpilePackages: ['@ihui/ui', '@ihui/types', '@ihui/config', '@ihui/auth'],
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
    ],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    unoptimized: true,
  },
  async redirects() {
    return [...vueToNextRedirects]
  },
  async rewrites() {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
    const aiServiceUrl = process.env.AI_SERVICE_URL ?? 'http://localhost:8000'
    return [
      // AI 服务路由优先匹配,转发到 FastAPI(端口 8000)
      { source: '/api/llm/:path*', destination: `${aiServiceUrl}/api/llm/:path*` },
      { source: '/api/agents/:path*', destination: `${aiServiceUrl}/api/agents/:path*` },
      { source: '/api/tools/:path*', destination: `${aiServiceUrl}/api/tools/:path*` },
      { source: '/api/mcp/:path*', destination: `${aiServiceUrl}/api/mcp/:path*` },
      { source: '/api/a2a/:path*', destination: `${aiServiceUrl}/api/a2a/:path*` },
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
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.aizhs.top wss://*.aizhs.top",
              "media-src 'self' https:",
              "object-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-src 'self' https://*.aizhs.top",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
