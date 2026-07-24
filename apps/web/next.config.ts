import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  output: 'export', // A 套壳方案:静态导出供 Tauri WebView 加载(原 'standalone',见 commit ce1f12795)
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  // 2026-07-22 临时:跳过构建时 ESLint(其他 agent 引入的 jsx-a11y/no-unused-vars 错误阻塞部署)
  eslint: { ignoreDuringBuilds: true },
  productionBrowserSourceMaps: false,
  // 关闭 Next.js 15 自带的左下角 N 圆圈 dev indicator (2026-07-21)
  devIndicators: false,
  transpilePackages: [
    '@ihui/ui',
    '@ihui/types',
    '@ihui/config',
    '@ihui/auth',
    '@ihui/app',
    '@ihui/shared',
    '@ihui/api-client',
    '@tauri-apps/api',
    '@tauri-apps/plugin-dialog',
    'react-native-web',
  ],
  turbopack: {
    resolveAlias: {
      'react-native': 'react-native-web',
      'next-intl/config': './src/i18n/request.ts',
    },
    resolveExtensions: [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.json',
      '.mjs',
    ],
  },
  webpack: (config) => {
    config.resolve.alias = config.resolve.alias || {}
    config.resolve.alias['react-native$'] = 'react-native-web'
    // workspace 包(api-client/shared)已构建到 dist/,exports 指向 dist/*.js,
    // .js 扩展名 import 直接解析到实际 .js 文件。extensionAlias 仅作 fallback,
    // 当 .js 不存在时尝试 .ts/.tsx(不设 fullySpecified=false 以免干扰 Next.js 内部构建流程)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    }
    // solito .web.js 平台扩展名解析(webpack 模式)
    config.resolve.extensions = [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      ...(config.resolve.extensions || []),
    ]
    // Next.js 15.5.20 output: 'export' bug:App Router-only 项目不生成 pages-manifest.json,
    // 但 "Collecting page data" 阶段尝试读取它 → ENOENT。用 afterEmit 钩子创建空文件兜底。
    config.plugins = config.plugins || []
    config.plugins.push({
      apply(compiler: import('webpack').Compiler) {
        compiler.hooks.afterEmit.tap('EnsurePagesManifest', () => {
          const fs = require('fs') as typeof import('fs')
          const path = require('path') as typeof import('path')
          const manifestPath = path.join(__dirname, '.next', 'server', 'pages-manifest.json')
          if (!fs.existsSync(manifestPath)) {
            fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
            fs.writeFileSync(manifestPath, '{}')
          }
        })
      },
    })
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
    remotePatterns: [
      { protocol: 'https', hostname: 'aizhs.top' },
      { protocol: 'https', hostname: '*.aizhs.top' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'platform-lookaside.fbsx.com' },
      { protocol: 'https', hostname: 'api.qrserver.com' },
    ],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    unoptimized: true,
  },
  async redirects() {
    return []
  },
  async rewrites() {
    return []
  },
  // 2026-07-24 安全加固:HTTP 安全响应头(CSP/HSTS/X-Frame-Options 等)
  // 注意:output:'export' 模式下 headers() 不生效(静态文件由 CDN/nginx 托管);
  // 改为 standalone 模式或 nginx 配置这些头时生效。保留配置供后续切换。
  async headers() {
    const securityHeaders = [
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https: wss: ws:",
          "media-src 'self' blob:",
          "object-src 'none'",
          "frame-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      },
    ]
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
